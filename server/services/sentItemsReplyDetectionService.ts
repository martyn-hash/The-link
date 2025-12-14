/**
 * Sent Items Reply Detection Service
 * 
 * Periodically scans the Sent Items folder for emails that match pending conversations
 * requiring a reply. When a match is found (by conversationId), marks the workflow
 * state as replied and triggers auto-completion if conditions are met.
 * 
 * This detects replies sent directly from Outlook (not through The Link).
 */

import { getApplicationGraphClient, isApplicationGraphConfigured, getUserEmails } from '../utils/applicationGraphClient';
import { storage } from '../storage/index';

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
      const inboxIdSet = new Set(pendingConversations.map(pc => pc.inboxId));
      const inboxIds = Array.from(inboxIdSet);

      // For each inbox, get the linked user email and check their sent items
      for (const inboxId of inboxIds) {
        try {
          const inbox = await storage.getInboxById(inboxId);
          if (!inbox || !inbox.emailAddress) {
            console.warn(`[Sent Items Detection] Inbox ${inboxId} not found or has no email`);
            continue;
          }

          const userEmail = inbox.emailAddress;

          // Get recent sent items (last 24 hours to catch any missed)
          const sinceDate = new Date();
          sinceDate.setHours(sinceDate.getHours() - 24);

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
            }
          }
        } catch (error) {
          console.error(`[Sent Items Detection] Error checking inbox ${inboxId}:`, error);
          stats.errors++;
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
