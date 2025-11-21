/**
 * Email Resolver Service
 * 
 * Scheduled service that retroactively matches quarantined emails when new
 * client aliases or domain allowlists are added.
 * 
 * Features:
 * - Processes unmatched_emails queue nightly
 * - Re-attempts matching with updated aliases/domains
 * - Promotes entire threads when any message matches
 * - Cleans up resolved emails from quarantine
 */

import { storage } from '../storage';
import type { UnmatchedEmail, ClientDomainAllowlist } from '@shared/schema';

export class EmailResolverService {
  /**
   * Process all quarantined emails and attempt to match them
   * This should be run nightly via cron job
   */
  async resolveQuarantinedEmails(): Promise<{
    processed: number;
    matched: number;
    stillUnmatched: number;
    errors: number;
  }> {
    const stats = {
      processed: 0,
      matched: 0,
      stillUnmatched: 0,
      errors: 0
    };

    try {
      console.log('[Email Resolver] Starting nightly resolution of quarantined emails');

      // Get all unmatched emails from quarantine
      const unmatchedEmails = await storage.getUnmatchedEmails();
      console.log(`[Email Resolver] Found ${unmatchedEmails.length} quarantined emails to process`);

      if (unmatchedEmails.length === 0) {
        console.log('[Email Resolver] No quarantined emails to process');
        return stats;
      }

      // Load current client email aliases and domain allowlist
      const allAliases = await this.getAllClientAliases();
      const domainAllowlist = await storage.getClientDomainAllowlist();

      // Process each unmatched email
      for (const unmatchedEmail of unmatchedEmails) {
        stats.processed++;

        try {
          // Attempt to match using current aliases/domains
          const matchResult = await this.matchUnmatchedEmail(
            unmatchedEmail,
            allAliases,
            domainAllowlist
          );

          if (matchResult.clientId) {
            // Match found! Resolve this email
            await this.resolveUnmatchedEmail(
              unmatchedEmail,
              matchResult.clientId,
              matchResult.confidence
            );
            stats.matched++;
            
            console.log(`[Email Resolver] Matched: ${unmatchedEmail.internetMessageId} → Client ${matchResult.clientId} (${matchResult.confidence} confidence)`);
          } else {
            // Still no match, increment retry count
            await storage.updateUnmatchedEmail(unmatchedEmail.internetMessageId, {
              retryCount: (unmatchedEmail.retryCount || 0) + 1,
              lastAttemptAt: new Date()
            });
            stats.stillUnmatched++;
          }
        } catch (error) {
          console.error(`[Email Resolver] Error processing ${unmatchedEmail.internetMessageId}:`, error);
          stats.errors++;
        }
      }

      console.log('[Email Resolver] Resolution complete:', stats);
      return stats;
    } catch (error) {
      console.error('[Email Resolver] Error in resolution process:', error);
      throw error;
    }
  }

  /**
   * Attempt to match an unmatched email using current aliases and domains
   */
  private async matchUnmatchedEmail(
    unmatchedEmail: UnmatchedEmail,
    aliases: Map<string, string>,
    domainAllowlist: ClientDomainAllowlist[]
  ): Promise<{ clientId: string | null; confidence: 'high' | 'medium' | 'low' }> {
    // Collect all participants from the email
    const participants: string[] = [
      unmatchedEmail.from,
      ...(unmatchedEmail.to || []),
      ...(unmatchedEmail.cc || [])
    ];

    // Layer 1: Exact email match (high confidence)
    for (const participant of participants) {
      const clientId = aliases.get(participant.toLowerCase());
      if (clientId) {
        console.log(`[Email Resolver] Exact match: ${participant} → ${clientId}`);
        return { clientId, confidence: 'high' };
      }
    }

    // Layer 2: Domain match (medium confidence)
    for (const participant of participants) {
      const domain = participant.split('@')[1];
      if (domain) {
        const domainMatch = domainAllowlist.find(d => d.domain === domain.toLowerCase());
        if (domainMatch) {
          console.log(`[Email Resolver] Domain match: ${domain} → ${domainMatch.clientId}`);
          return { clientId: domainMatch.clientId, confidence: 'medium' };
        }
      }
    }

    // No match found
    return { clientId: null, confidence: 'low' };
  }

  /**
   * Resolve an unmatched email by associating it with a client
   * This will:
   * 1. Update the message with clientId
   * 2. Get the thread and update it if needed
   * 3. Update all other messages in the thread (ancestry-based promotion)
   * 4. Remove the email from quarantine
   */
  private async resolveUnmatchedEmail(
    unmatchedEmail: UnmatchedEmail,
    clientId: string,
    confidence: 'high' | 'medium' | 'low'
  ): Promise<void> {
    try {
      // 1. Update the matched message
      const message = await storage.getEmailMessageByInternetMessageId(unmatchedEmail.internetMessageId);
      if (!message) {
        console.warn(`[Email Resolver] Message not found: ${unmatchedEmail.internetMessageId}`);
        return;
      }

      await storage.updateEmailMessage(message.id, {
        clientId,
        matchConfidence: confidence
      });

      // 2. Get the thread and update it if needed
      if (message.threadId) {
        const thread = await storage.getEmailThreadById(message.threadId);
        
        if (thread) {
          // Update thread if it doesn't have a client or has lower confidence
          const shouldUpdateThread = 
            !thread.clientId || 
            (thread.matchConfidence === 'low' && confidence !== 'low') ||
            (thread.matchConfidence === 'medium' && confidence === 'high');

          if (shouldUpdateThread) {
            await storage.updateEmailThread(thread.id, {
              clientId,
              matchConfidence: confidence
            });

            // 3. Ancestry-based promotion: update all other messages in this thread
            const threadMessages = await storage.getEmailMessagesByThreadId(thread.id);
            for (const threadMessage of threadMessages) {
              if (threadMessage.internetMessageId !== unmatchedEmail.internetMessageId) {
                const shouldUpdateMessage = 
                  !threadMessage.clientId ||
                  (threadMessage.matchConfidence === 'low' && confidence !== 'low') ||
                  (threadMessage.matchConfidence === 'medium' && confidence === 'high');

                if (shouldUpdateMessage) {
                  await storage.updateEmailMessage(threadMessage.id, {
                    clientId,
                    matchConfidence: confidence
                  });

                  // Remove from quarantine if it's there
                  const unmatchedExists = await storage.getUnmatchedEmailByMessageId(threadMessage.internetMessageId);
                  if (unmatchedExists) {
                    await storage.deleteUnmatchedEmail(threadMessage.internetMessageId);
                  }
                }
              }
            }
          }
        }
      }

      // 4. Remove the original email from quarantine
      await storage.deleteUnmatchedEmail(unmatchedEmail.internetMessageId);

    } catch (error) {
      console.error(`[Email Resolver] Error resolving ${unmatchedEmail.internetMessageId}:`, error);
      throw error;
    }
  }

  /**
   * Load all client email aliases into memory for efficient matching
   */
  private async getAllClientAliases(): Promise<Map<string, string>> {
    const aliasMap = new Map<string, string>();

    const aliases = await storage.getAllClientEmailAliases();
    
    for (const alias of aliases) {
      aliasMap.set(alias.emailLowercase, alias.clientId);
    }

    return aliasMap;
  }

  /**
   * Clean up old unmatched emails that have been in quarantine too long
   * This can be run periodically to prevent the quarantine from growing unbounded
   */
  async cleanupOldQuarantinedEmails(daysOld: number = 90): Promise<number> {
    try {
      console.log(`[Email Resolver] Cleaning up quarantined emails older than ${daysOld} days`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const unmatchedEmails = await storage.getUnmatchedEmails();
      let deletedCount = 0;

      for (const email of unmatchedEmails) {
        if (email.receivedDateTime < cutoffDate && (email.retryCount || 0) > 5) {
          await storage.deleteUnmatchedEmail(email.internetMessageId);
          deletedCount++;
        }
      }

      console.log(`[Email Resolver] Deleted ${deletedCount} old quarantined emails`);
      return deletedCount;
    } catch (error) {
      console.error('[Email Resolver] Error cleaning up old quarantined emails:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const emailResolverService = new EmailResolverService();
