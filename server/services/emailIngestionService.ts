/**
 * Email Ingestion Service
 * 
 * Handles Microsoft Graph integration for email threading and deduplication.
 * Features:
 * - Webhook subscription management
 * - Delta sync for Inbox and Sent Items
 * - Message fetching with lean field selection
 * - Idempotent processing using internetMessageId
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { getUserOutlookClient } from '../utils/userOutlookClient';
import { storage } from '../storage';
import { nanoid } from 'nanoid';
import type { EmailMessage, EmailThread, ClientDomainAllowlist, InsertEmailMessage } from '@shared/schema';

// Message fields to fetch from Graph API
// Keep this lean to minimize data transfer and processing time
const MESSAGE_SELECT_FIELDS = [
  'id',
  'internetMessageId',
  'conversationId',
  'conversationIndex',
  'subject',
  'from',
  'toRecipients',
  'ccRecipients',
  'bccRecipients',
  'receivedDateTime',
  'sentDateTime',
  'hasAttachments',
  'body',
  'bodyPreview',
  'inReplyTo',
  'internetMessageHeaders'
].join(',');

interface GraphMessage {
  id: string;
  internetMessageId?: string;
  conversationId?: string;
  conversationIndex?: string;
  subject?: string;
  from?: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  toRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  bccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
  body?: {
    contentType: string;
    content: string;
  };
  bodyPreview?: string;
  inReplyTo?: string;
  internetMessageHeaders?: Array<{ name: string; value: string }>;
}

interface DeltaSyncResult {
  messages: GraphMessage[];
  deltaLink: string;
  hasMore: boolean;
}

export class EmailIngestionService {
  /**
   * Subscribe to mailbox changes via webhooks
   * Creates subscriptions for both Inbox and Sent Items
   */
  async createWebhookSubscription(
    userId: string,
    folderType: 'Inbox' | 'SentItems',
    notificationUrl: string
  ): Promise<string> {
    try {
      const client = await getUserOutlookClient(userId);
      
      // Generate client state for validation
      const clientState = nanoid(32);
      
      // Subscription expires in 3 days (max for mail resources)
      const expirationDateTime = new Date();
      expirationDateTime.setDate(expirationDateTime.getDate() + 3);

      const subscription = await client.api('/subscriptions').post({
        changeType: 'created,updated',
        notificationUrl,
        resource: `me/mailFolders('${folderType}')/messages`,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState
      });

      // Store subscription in database
      await storage.createGraphWebhookSubscription({
        userId,
        subscriptionId: subscription.id,
        resource: `me/mailFolders('${folderType}')/messages`,
        changeType: 'created,updated',
        expiresAt: new Date(subscription.expirationDateTime),
        clientState,
        isActive: true,
        lastRenewedAt: new Date()
      });

      console.log(`[Email Ingestion] Created webhook subscription for user ${userId}, folder ${folderType}`);
      return subscription.id;
    } catch (error) {
      console.error('[Email Ingestion] Error creating webhook subscription:', error);
      throw error;
    }
  }

  /**
   * Renew an expiring webhook subscription
   */
  async renewWebhookSubscription(subscriptionId: string): Promise<void> {
    try {
      // Get subscription from database
      const subscription = await storage.getGraphWebhookSubscription(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      const client = await getUserOutlookClient(subscription.userId);
      
      // Extend expiration by 3 days
      const expirationDateTime = new Date();
      expirationDateTime.setDate(expirationDateTime.getDate() + 3);

      await client.api(`/subscriptions/${subscriptionId}`).patch({
        expirationDateTime: expirationDateTime.toISOString()
      });

      // Update database
      await storage.updateGraphWebhookSubscription(subscriptionId, {
        expiresAt: expirationDateTime,
        lastRenewedAt: new Date()
      });

      console.log(`[Email Ingestion] Renewed webhook subscription ${subscriptionId}`);
    } catch (error) {
      console.error('[Email Ingestion] Error renewing webhook subscription:', error);
      throw error;
    }
  }

  /**
   * Delete a webhook subscription
   */
  async deleteWebhookSubscription(subscriptionId: string): Promise<void> {
    try {
      const subscription = await storage.getGraphWebhookSubscription(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      const client = await getUserOutlookClient(subscription.userId);
      
      // Delete from Graph
      await client.api(`/subscriptions/${subscriptionId}`).delete();
      
      // Mark as inactive in database (don't delete to preserve history)
      await storage.updateGraphWebhookSubscription(subscriptionId, {
        isActive: false
      });

      console.log(`[Email Ingestion] Deleted webhook subscription ${subscriptionId}`);
    } catch (error) {
      console.error('[Email Ingestion] Error deleting webhook subscription:', error);
      throw error;
    }
  }

  /**
   * Perform delta sync for a mailbox folder
   * Returns messages and new delta link for next sync
   */
  async performDeltaSync(
    userId: string,
    folderType: 'Inbox' | 'SentItems'
  ): Promise<DeltaSyncResult> {
    try {
      const client = await getUserOutlookClient(userId);
      
      // Get existing delta link from database
      const syncState = await storage.getGraphSyncState(userId, folderType);
      const deltaLink = syncState?.deltaLink;

      const messages: GraphMessage[] = [];
      let nextLink: string | undefined;
      let newDeltaLink: string | undefined;

      // CRITICAL: When using a delta link, DO NOT add query parameters
      // Graph API rejects .select()/.top() on delta tokens
      let response;
      
      if (deltaLink) {
        // Incremental sync: use delta link exactly as returned
        response = await client.api(deltaLink).get();
      } else {
        // Initial sync: start fresh delta with field selection
        response = await client
          .api(`/me/mailFolders('${folderType}')/messages/delta`)
          .select(MESSAGE_SELECT_FIELDS)
          .top(50) // Fetch in batches of 50
          .get();
      }

      // Collect all messages from paged responses
      do {
        if (response.value) {
          messages.push(...response.value);
        }

        // Check for next page or delta link
        nextLink = response['@odata.nextLink'];
        newDeltaLink = response['@odata.deltaLink'];

        if (nextLink) {
          // Use next link exactly as returned (no additional params)
          response = await client.api(nextLink).get();
        }
      } while (nextLink);

      // Save new delta link to database
      if (newDeltaLink) {
        await storage.upsertGraphSyncState({
          userId,
          folderPath: folderType,
          deltaLink: newDeltaLink,
          lastSyncAt: new Date(),
          lastMessageCount: messages.length
        });
      }

      console.log(`[Email Ingestion] Delta sync for user ${userId}, folder ${folderType}: ${messages.length} messages`);

      return {
        messages,
        deltaLink: newDeltaLink || deltaLink || '',
        hasMore: !!nextLink // If we still have nextLink, there's more data
      };
    } catch (error) {
      console.error('[Email Ingestion] Error performing delta sync:', error);
      throw error;
    }
  }

  /**
   * Fetch a single message by ID with full details
   */
  async fetchMessage(userId: string, messageId: string): Promise<GraphMessage> {
    try {
      const client = await getUserOutlookClient(userId);
      
      const message = await client
        .api(`/me/messages/${messageId}`)
        .select(MESSAGE_SELECT_FIELDS)
        .get();

      return message;
    } catch (error) {
      console.error('[Email Ingestion] Error fetching message:', error);
      throw error;
    }
  }

  /**
   * Fetch message attachments
   */
  async fetchMessageAttachments(userId: string, messageId: string) {
    try {
      const client = await getUserOutlookClient(userId);
      
      const attachments = await client
        .api(`/me/messages/${messageId}/attachments`)
        .select('id,name,size,contentType,contentBytes,isInline')
        .get();

      return attachments.value || [];
    } catch (error) {
      console.error('[Email Ingestion] Error fetching attachments:', error);
      throw error;
    }
  }

  /**
   * Extract References header from internet message headers
   * Returns array of message IDs in ancestry chain
   */
  extractReferencesHeader(headers?: Array<{ name: string; value: string }>): string[] {
    if (!headers) return [];

    const referencesHeader = headers.find(
      h => h.name.toLowerCase() === 'references'
    );

    if (!referencesHeader) return [];

    // Parse references - format: <id1> <id2> <id3>
    const matches = referencesHeader.value.match(/<([^>]+)>/g);
    if (!matches) return [];

    return matches.map(m => m.slice(1, -1)); // Remove < and >
  }

  /**
   * Normalize email address to lowercase
   */
  normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Extract email addresses from recipients array
   */
  extractEmails(recipients?: Array<{ emailAddress: { address: string } }>): string[] {
    if (!recipients) return [];
    return recipients.map(r => this.normalizeEmail(r.emailAddress.address));
  }

  /**
   * Normalize subject by removing Re:, Fwd:, etc.
   */
  normalizeSubject(subject?: string): string {
    if (!subject) return '';
    
    // Remove common reply/forward prefixes (case insensitive)
    return subject
      .replace(/^(re|fwd|fw):\s*/gi, '')
      .trim()
      .toLowerCase();
  }

  /**
   * Compute fallback thread key
   * Format: hash(rootInternetMessageId + normalizedSubject + participantsSet)
   */
  async computeThreadKey(
    rootInternetMessageId: string,
    subject: string,
    participants: string[]
  ): Promise<string> {
    const normalizedSubject = this.normalizeSubject(subject);
    const uniqueParticipants = Array.from(new Set(participants));
    const sortedParticipants = uniqueParticipants.sort().join(',');
    const input = `${rootInternetMessageId}:${normalizedSubject}:${sortedParticipants}`;
    
    // Simple hash (in production, use crypto.subtle.digest)
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Ingest messages from delta sync
   * Idempotently upserts messages and creates mailbox mappings
   */
  async ingestMessages(
    userId: string,
    messages: GraphMessage[],
    folderType: 'Inbox' | 'SentItems'
  ): Promise<{ processed: number; skipped: number; errors: number }> {
    const stats = { processed: 0, skipped: 0, errors: 0 };

    console.log(`[Email Ingestion] Ingesting ${messages.length} messages for user ${userId} from ${folderType}`);

    for (const graphMessage of messages) {
      try {
        // Skip if no internetMessageId (required for deduplication)
        if (!graphMessage.internetMessageId) {
          console.warn('[Email Ingestion] Skipping message without internetMessageId:', graphMessage.id);
          stats.skipped++;
          continue;
        }

        // Extract sender email
        const fromEmail = graphMessage.from?.emailAddress?.address 
          ? this.normalizeEmail(graphMessage.from.emailAddress.address)
          : null;

        // Extract recipient emails
        const toEmails = this.extractEmails(graphMessage.toRecipients);
        const ccEmails = this.extractEmails(graphMessage.ccRecipients);
        const bccEmails = this.extractEmails(graphMessage.bccRecipients);

        // Combine all participants
        const allParticipants = [
          fromEmail,
          ...toEmails,
          ...ccEmails,
          ...bccEmails
        ].filter((email): email is string => email !== null);

        // Extract threading metadata
        const references = this.extractReferencesHeader(graphMessage.internetMessageHeaders);
        const inReplyTo = graphMessage.internetMessageHeaders?.find(
          h => h.name.toLowerCase() === 'in-reply-to'
        )?.value.replace(/<|>/g, '');

        // Prepare email message for upsert
        const emailMessage: InsertEmailMessage = {
          internetMessageId: graphMessage.internetMessageId,
          conversationId: graphMessage.conversationId || null,
          subject: graphMessage.subject || '(no subject)',
          bodyPreview: graphMessage.bodyPreview || '',
          body: graphMessage.body?.content || '',
          bodyType: graphMessage.body?.contentType || 'text',
          fromEmail,
          fromName: graphMessage.from?.emailAddress?.name || null,
          toEmails,
          ccEmails,
          bccEmails,
          sentAt: graphMessage.sentDateTime ? new Date(graphMessage.sentDateTime) : new Date(),
          receivedAt: graphMessage.receivedDateTime ? new Date(graphMessage.receivedDateTime) : new Date(),
          importance: graphMessage.importance || 'normal',
          isRead: graphMessage.isRead || false,
          isDraft: graphMessage.isDraft || false,
          hasAttachments: graphMessage.hasAttachments || false,
          inReplyTo,
          references,
          // Threading will be computed in Phase 4
          threadId: null,
          // Client association will be computed in Phase 5
          clientId: null,
          matchConfidence: null
        };

        // Upsert message (idempotent by internetMessageId)
        const savedMessage = await storage.upsertEmailMessage(emailMessage);

        // Create mailbox mapping for this user
        // Check if mapping already exists to avoid duplicates
        const existingMaps = await storage.getMailboxMessageMapsByMessageId(savedMessage.id);
        const hasMapping = existingMaps.some(map => map.userId === userId);

        if (!hasMapping) {
          await storage.createMailboxMessageMap({
            userId,
            messageId: savedMessage.id,
            graphMessageId: graphMessage.id,
            folderPath: folderType,
            isDeleted: false,
            changeKey: graphMessage.changeKey || null,
            receivedAt: graphMessage.receivedDateTime ? new Date(graphMessage.receivedDateTime) : new Date()
          });
        }

        stats.processed++;
      } catch (error) {
        console.error('[Email Ingestion] Error ingesting message:', error);
        stats.errors++;
      }
    }

    console.log(`[Email Ingestion] Ingestion complete for user ${userId}:`, stats);
    return stats;
  }

  /**
   * Perform full sync for a user's mailbox
   * Runs delta sync and ingests messages
   */
  async syncUserMailbox(userId: string): Promise<void> {
    try {
      console.log(`[Email Ingestion] Starting mailbox sync for user ${userId}`);

      // Sync Inbox
      const inboxResult = await this.performDeltaSync(userId, 'Inbox');
      await this.ingestMessages(userId, inboxResult.messages, 'Inbox');

      // Sync Sent Items
      const sentResult = await this.performDeltaSync(userId, 'SentItems');
      await this.ingestMessages(userId, sentResult.messages, 'SentItems');

      // Run threading on unthreaded messages
      await this.processThreading();

      // Run client association on unmatched threads
      await this.processClientAssociation();

      console.log(`[Email Ingestion] Mailbox sync complete for user ${userId}`);
    } catch (error) {
      console.error('[Email Ingestion] Error syncing mailbox:', error);
      throw error;
    }
  }

  /**
   * Process threading for unthreaded messages
   * Multi-layered approach:
   * 1. Group by conversationId
   * 2. Build ancestry chains using inReplyTo/references
   * 3. Compute threadKey hash for orphaned messages
   */
  async processThreading(): Promise<{ threaded: number; errors: number }> {
    const stats = { threaded: 0, errors: 0 };

    try {
      console.log('[Email Threading] Starting threading process');

      // Get all unthreaded messages
      const unthreadedMessages = await storage.getUnthreadedMessages();
      console.log(`[Email Threading] Found ${unthreadedMessages.length} unthreaded messages`);

      // Layer 1: Group by conversationId
      const conversationGroups = new Map<string, EmailMessage[]>();
      const orphanedMessages: EmailMessage[] = [];

      for (const message of unthreadedMessages) {
        if (message.conversationId) {
          if (!conversationGroups.has(message.conversationId)) {
            conversationGroups.set(message.conversationId, []);
          }
          conversationGroups.get(message.conversationId)!.push(message);
        } else {
          orphanedMessages.push(message);
        }
      }

      // Process conversationId groups
      for (const [conversationId, messages] of conversationGroups) {
        try {
          await this.threadByConversationId(conversationId, messages);
          stats.threaded += messages.length;
        } catch (error) {
          console.error(`[Email Threading] Error threading conversationId ${conversationId}:`, error);
          stats.errors++;
        }
      }

      // Layer 2 & 3: Process orphaned messages (no conversationId)
      // Build ancestry chains and compute threadKey
      for (const message of orphanedMessages) {
        try {
          await this.threadOrphanedMessage(message);
          stats.threaded++;
        } catch (error) {
          console.error(`[Email Threading] Error threading orphaned message ${message.id}:`, error);
          stats.errors++;
        }
      }

      console.log(`[Email Threading] Threading complete:`, stats);
      return stats;
    } catch (error) {
      console.error('[Email Threading] Error in threading process:', error);
      throw error;
    }
  }

  /**
   * Thread messages by conversationId (Layer 1)
   */
  private async threadByConversationId(
    conversationId: string,
    messages: EmailMessage[]
  ): Promise<void> {
    // Check if thread already exists for this conversationId
    let thread = await storage.getEmailThreadByConversationId(conversationId);

    if (!thread) {
      // Create new thread
      const sortedMessages = messages.sort((a, b) => 
        new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      );
      const firstMessage = sortedMessages[0];
      const lastMessage = sortedMessages[sortedMessages.length - 1];

      // Collect all participants
      const allParticipants = new Set<string>();
      messages.forEach(msg => {
        if (msg.fromEmail) allParticipants.add(msg.fromEmail);
        msg.toEmails.forEach(email => allParticipants.add(email));
        msg.ccEmails.forEach(email => allParticipants.add(email));
      });

      thread = await storage.createEmailThread({
        conversationId,
        threadKey: null, // Not using threadKey for conversationId-based threads
        subject: firstMessage.subject,
        participants: Array.from(allParticipants),
        messageCount: messages.length,
        firstMessageAt: firstMessage.sentAt,
        lastMessageAt: lastMessage.sentAt,
        clientId: null, // Will be set in Phase 5
        matchConfidence: null
      });
    } else {
      // Update thread with latest message info
      const sortedMessages = messages.sort((a, b) => 
        new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      );
      const lastMessage = sortedMessages[sortedMessages.length - 1];

      await storage.updateEmailThread(thread.id, {
        messageCount: messages.length,
        lastMessageAt: lastMessage.sentAt
      });
    }

    // Link all messages to this thread
    for (const message of messages) {
      await storage.updateEmailMessage(message.id, { threadId: thread.id });
    }
  }

  /**
   * Thread orphaned message using ancestry or threadKey (Layer 2 & 3)
   */
  private async threadOrphanedMessage(message: EmailMessage): Promise<void> {
    // Layer 2: Try to find thread by inReplyTo ancestry
    if (message.inReplyTo) {
      const parentMessage = await storage.getEmailMessageByInternetMessageId(message.inReplyTo);
      if (parentMessage && parentMessage.threadId) {
        // Link to parent's thread
        await storage.updateEmailMessage(message.id, { threadId: parentMessage.threadId });
        
        // Update thread's last message time
        const thread = await storage.getEmailThreadById(parentMessage.threadId);
        if (thread && new Date(message.sentAt) > new Date(thread.lastMessageAt)) {
          await storage.updateEmailThread(thread.id, {
            lastMessageAt: message.sentAt,
            messageCount: thread.messageCount + 1
          });
        }
        return;
      }
    }

    // Layer 3: Compute threadKey for orphaned message
    const participants = [
      message.fromEmail,
      ...message.toEmails,
      ...message.ccEmails
    ].filter((email): email is string => email !== null);

    const rootMessageId = message.references.length > 0 
      ? message.references[0] 
      : message.internetMessageId;

    const threadKey = await this.computeThreadKey(
      rootMessageId,
      message.subject,
      participants
    );

    // Check if thread with this threadKey exists
    let thread = await storage.getEmailThreadByThreadKey(threadKey);

    if (!thread) {
      // Create new thread with threadKey
      thread = await storage.createEmailThread({
        conversationId: null,
        threadKey,
        subject: message.subject,
        participants,
        messageCount: 1,
        firstMessageAt: message.sentAt,
        lastMessageAt: message.sentAt,
        clientId: null,
        matchConfidence: null
      });
    } else {
      // Update thread
      await storage.updateEmailThread(thread.id, {
        messageCount: thread.messageCount + 1,
        lastMessageAt: message.sentAt
      });
    }

    // Link message to thread
    await storage.updateEmailMessage(message.id, { threadId: thread.id });
  }

  /**
   * Process client association for threads without clientId
   * Multi-layered matching:
   * 1. Exact email match against client_email_aliases (high confidence)
   * 2. Domain match against client_domain_allowlist (medium confidence)
   * 3. Unmatched → quarantine to unmatched_emails (low confidence)
   */
  async processClientAssociation(): Promise<{ matched: number; quarantined: number; errors: number }> {
    const stats = { matched: 0, quarantined: 0, errors: 0 };

    try {
      console.log('[Client Association] Starting client association process');

      // Get all threads without clientId using optimized query
      const unmatchedThreads = await storage.getThreadsWithoutClient();

      console.log(`[Client Association] Found ${unmatchedThreads.length} unmatched threads`);

      // Load all client email aliases and domain allowlist into memory for efficient matching
      const allAliases = await this.getAllClientAliases();
      const domainAllowlist = await storage.getClientDomainAllowlist();

      for (const thread of unmatchedThreads) {
        try {
          const matchResult = await this.matchThreadToClient(thread, allAliases, domainAllowlist);

          if (matchResult.clientId) {
            // Match found - update thread and all its messages
            await storage.updateEmailThread(thread.id, {
              clientId: matchResult.clientId,
              matchConfidence: matchResult.confidence
            });

            // Update all messages in this thread
            const messages = await storage.getEmailMessagesByThreadId(thread.id);
            for (const message of messages) {
              await storage.updateEmailMessage(message.id, {
                clientId: matchResult.clientId,
                matchConfidence: matchResult.confidence
              });
            }

            stats.matched++;
          } else {
            // No match - quarantine all messages in this thread
            const messages = await storage.getEmailMessagesByThreadId(thread.id);
            for (const message of messages) {
              // Check if message is already in quarantine to prevent duplicates
              const existing = await storage.getUnmatchedEmailByMessageId(message.internetMessageId);
              if (!existing) {
                // Extract subject stem (remove Re:, Fwd: prefixes)
                const subjectStem = message.subject?.replace(/^(Re:|Fwd?:)\s*/gi, '').trim() || null;
                
                // Determine mailbox owner (first mailbox that has this message)
                const mailboxMappings = await storage.getMailboxMessageMapsByMessageId(message.internetMessageId);
                const mailboxOwnerUserId = mailboxMappings[0]?.userId || null;
                
                await storage.createUnmatchedEmail({
                  internetMessageId: message.internetMessageId,
                  from: message.from,
                  to: message.to || [],
                  cc: message.cc || [],
                  subjectStem,
                  inReplyTo: message.inReplyTo,
                  references: message.references || [],
                  receivedDateTime: message.receivedDateTime,
                  mailboxOwnerUserId,
                  direction: message.direction,
                  retryCount: 0,
                  lastAttemptAt: null
                });
              }
            }

            stats.quarantined++;
          }
        } catch (error) {
          console.error(`[Client Association] Error matching thread ${thread.id}:`, error);
          stats.errors++;
        }
      }

      console.log(`[Client Association] Association complete:`, stats);
      return stats;
    } catch (error) {
      console.error('[Client Association] Error in client association process:', error);
      throw error;
    }
  }

  /**
   * Match a thread to a client using email aliases and domain allowlist
   */
  private async matchThreadToClient(
    thread: EmailThread,
    aliases: Map<string, string>, // email -> clientId
    domainAllowlist: ClientDomainAllowlist[]
  ): Promise<{ clientId: string | null; confidence: 'high' | 'medium' | 'low' }> {
    // Skip if no participants
    if (!thread.participants || thread.participants.length === 0) {
      return { clientId: null, confidence: 'low' };
    }

    // Layer 1: Exact email match (high confidence)
    for (const participant of thread.participants) {
      const clientId = aliases.get(participant.toLowerCase());
      if (clientId) {
        console.log(`[Client Association] Exact match: ${participant} → ${clientId}`);
        return { clientId, confidence: 'high' };
      }
    }

    // Layer 2: Domain match (medium confidence)
    for (const participant of thread.participants) {
      const domain = participant.split('@')[1];
      if (domain) {
        const domainMatch = domainAllowlist.find(d => d.domain === domain.toLowerCase());
        if (domainMatch) {
          console.log(`[Client Association] Domain match: ${domain} → ${domainMatch.clientId}`);
          return { clientId: domainMatch.clientId, confidence: 'medium' };
        }
      }
    }

    // No match found
    return { clientId: null, confidence: 'low' };
  }

  /**
   * Load all client email aliases into memory for efficient matching
   */
  private async getAllClientAliases(): Promise<Map<string, string>> {
    const aliasMap = new Map<string, string>();

    // Get all client email aliases from storage
    const aliases = await storage.getAllClientEmailAliases();
    
    // Build map: email -> clientId
    for (const alias of aliases) {
      aliasMap.set(alias.emailLowercase, alias.clientId);
    }

    return aliasMap;
  }
}

// Export singleton instance
export const emailIngestionService = new EmailIngestionService();
