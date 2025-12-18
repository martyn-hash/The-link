/**
 * Sent Items Reply Detection Service
 * 
 * Periodically scans the Sent Items folder for emails that match pending conversations
 * requiring a reply. When a match is found (by conversationId), marks the workflow
 * state as replied and triggers auto-completion if conditions are met.
 * 
 * This detects replies sent directly from Outlook (not through The Link).
 * 
 * Delta Scanning (Phase 2 optimization):
 * - Uses lastSentItemsCheckedAt per inbox to only scan new messages since last check
 * - Applies 2-minute overlap buffer to handle out-of-order API responses
 * - Falls back to 24-hour window for first-time scans
 * - Only updates timestamp on successful completion (no errors for that inbox)
 */

import { getApplicationGraphClient, isApplicationGraphConfigured, getUserEmails } from '../utils/applicationGraphClient';
import { storage } from '../storage/index';
import { BATCH_SIZES } from '../utils/cronBatching';

// 2-minute overlap buffer for out-of-order API responses
const OVERLAP_BUFFER_MS = 2 * 60 * 1000;

// Default fallback window for first-time scans (24 hours)
const DEFAULT_FALLBACK_HOURS = 24;

interface SentItemsCheckResult {
  checked: number;
  matched: number;
  completed: number;
  errors: number;
}

export class SentItemsReplyDetectionService {
  /**
   * Run the detection process for all active inboxes.
   * Scans recent sent items and matches against pending reply conversations.
   */
  async runDetection(): Promise<SentItemsCheckResult> {
    const stats: SentItemsCheckResult = {
      checked: 0,
      matched: 0,
      completed: 0,
      errors: 0,
    };

    if (!isApplicationGraphConfigured()) {
      console.log('[Sent Items Detection] Microsoft Graph not configured, skipping');
      return stats;
    }

    try {
      console.log('[Sent Items Detection] Starting detection run...');

      // Get all conversations that need a reply
      const pendingConversations = await storage.getPendingReplyConversations();
      if (pendingConversations.length === 0) {
        console.log('[Sent Items Detection] No pending reply conversations found');
        return stats;
      }

      console.log(`[Sent Items Detection] Found ${pendingConversations.length} pending reply conversations`);

      // Build a map of conversationId to pending info
      const pendingMap = new Map<string, { inboxId: string; emailId: string }>();
      for (const pc of pendingConversations) {
        pendingMap.set(pc.conversationId, { inboxId: pc.inboxId, emailId: pc.emailId });
      }

      // Get unique inbox IDs from pending conversations
      const inboxIdSet = new Set(pendingConversations.map((pc: { inboxId: string }) => pc.inboxId));
      const inboxIds = Array.from(inboxIdSet);

      // For each inbox, get the linked user email and check their sent items
      // Process with event loop yields between inboxes to prevent blocking
      for (let i = 0; i < inboxIds.length; i++) {
        const inboxId = inboxIds[i];
        let inboxHasError = false;
        const scanStartTime = new Date();
        
        try {
          const inbox = await storage.getInboxById(inboxId);
          if (!inbox || !inbox.emailAddress) {
            console.warn(`[Sent Items Detection] Inbox ${inboxId} not found or has no email`);
            continue;
          }

          const userEmail = inbox.emailAddress;

          // Delta scanning: Use lastSentItemsCheckedAt with overlap buffer, or fall back to 24-hour window
          let sinceDate: Date;
          const lastChecked = inbox.lastSentItemsCheckedAt;
          
          if (lastChecked) {
            // Apply 2-minute overlap buffer to handle out-of-order API responses
            sinceDate = new Date(lastChecked.getTime() - OVERLAP_BUFFER_MS);
            console.log(`[Sent Items Detection] Inbox ${inbox.emailAddress}: Delta scan from ${sinceDate.toISOString()} (last checked: ${lastChecked.toISOString()})`);
          } else {
            // First-time scan: use 24-hour fallback window
            sinceDate = new Date();
            sinceDate.setHours(sinceDate.getHours() - DEFAULT_FALLBACK_HOURS);
            console.log(`[Sent Items Detection] Inbox ${inbox.emailAddress}: First-time scan, using ${DEFAULT_FALLBACK_HOURS}-hour window`);
          }

          const sentItems = await getUserEmails(userEmail, {
            folder: 'SentItems',
            top: 100,
            filter: `sentDateTime ge ${sinceDate.toISOString()}`,
            orderBy: 'sentDateTime desc',
            select: ['id', 'conversationId', 'sentDateTime', 'subject'],
          });

          stats.checked += sentItems.messages.length;

          // Check each sent item for matching conversation
          for (const sentMessage of sentItems.messages) {
            if (!sentMessage.conversationId) continue;

            const pending = pendingMap.get(sentMessage.conversationId);
            if (!pending) continue;

            // Found a match! This is a reply sent from Outlook
            console.log(`[Sent Items Detection] Found matching sent item for conversation ${sentMessage.conversationId}`);

            try {
              // Mark the reply as sent
              const markedCount = await storage.markReplyAsSentForConversation(
                sentMessage.conversationId,
                sentMessage.id
              );

              if (markedCount > 0) {
                stats.matched += markedCount;
                console.log(`[Sent Items Detection] Marked ${markedCount} emails as replied for conversation ${sentMessage.conversationId}`);

                // Try to auto-complete the conversation
                const completedCount = await storage.autoCompleteConversationEmailsIfPossible(
                  sentMessage.conversationId
                );

                if (completedCount > 0) {
                  stats.completed += completedCount;
                  console.log(`[Sent Items Detection] Auto-completed ${completedCount} emails for conversation ${sentMessage.conversationId}`);
                }
              }

              // Remove from pending map to avoid duplicate processing
              pendingMap.delete(sentMessage.conversationId);
            } catch (error) {
              console.error(`[Sent Items Detection] Error processing match for conversation ${sentMessage.conversationId}:`, error);
              stats.errors++;
              inboxHasError = true;
            }
          }
          
          // Only update lastSentItemsCheckedAt if no errors occurred for this inbox
          if (!inboxHasError) {
            await storage.updateInboxLastSentItemsCheckedAt(inboxId, scanStartTime);
          } else {
            console.warn(`[Sent Items Detection] Inbox ${inbox.emailAddress}: Not updating timestamp due to errors`);
          }
        } catch (error) {
          console.error(`[Sent Items Detection] Error checking inbox ${inboxId}:`, error);
          stats.errors++;
          // Ensure inboxHasError is true to prevent any timestamp update
          inboxHasError = true;
        }
        
        // Yield to event loop after each inbox to prevent blocking
        // This is especially important for inboxes with many pending conversations
        if (i < inboxIds.length - 1) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      console.log(`[Sent Items Detection] Detection complete:`, stats);
      return stats;
    } catch (error) {
      console.error('[Sent Items Detection] Error in detection run:', error);
      stats.errors++;
      return stats;
    }
  }
}

// Export singleton instance
export const sentItemsReplyDetectionService = new SentItemsReplyDetectionService();
