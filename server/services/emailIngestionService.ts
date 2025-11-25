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
import { storage } from '../storage/index';
import { nanoid } from 'nanoid';
import type { EmailMessage, EmailThread, ClientDomainAllowlist, InsertEmailMessage } from '@shared/schema';
import { emailAttachmentService } from './emailAttachmentService';

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
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    contentType: string;
    isInline?: boolean;
  }>;
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
          .expand('attachments($select=id,name,size,contentType,isInline)') // Fetch attachment metadata
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
   * Check if an email address belongs to internal staff
   * Internal domains: @growth-accountants.com, @thelink.uk.com
   */
  isInternalEmail(email: string): boolean {
    if (!email) return false;
    const normalized = email.toLowerCase();
    return normalized.endsWith('@growth-accountants.com') || 
           normalized.endsWith('@thelink.uk.com');
  }

  /**
   * Detect if all participants in an email are internal staff
   */
  isInternalOnlyEmail(participants: string[]): boolean {
    if (participants.length === 0) return false;
    return participants.every(p => this.isInternalEmail(p));
  }

  /**
   * Determine email direction based on sender and recipients
   * - inbound: external sender to internal recipients
   * - outbound: internal sender to external recipients  
   * - internal: internal sender to internal recipients only
   * - external: external sender to external recipients (shouldn't happen in our mailbox)
   */
  determineEmailDirection(fromEmail: string | null, allRecipients: string[]): 'inbound' | 'outbound' | 'internal' | 'external' {
    const fromInternal = fromEmail ? this.isInternalEmail(fromEmail) : false;
    const hasInternalRecipients = allRecipients.some(r => this.isInternalEmail(r));
    const hasExternalRecipients = allRecipients.some(r => !this.isInternalEmail(r));

    if (fromInternal) {
      if (hasExternalRecipients) return 'outbound';
      return 'internal';
    } else {
      if (hasInternalRecipients) return 'inbound';
      return 'external';
    }
  }

  /**
   * Detect marketing/list emails based on headers and recipient count
   * Returns true if email appears to be marketing/automated
   */
  isMarketingEmail(
    headers?: Array<{ name: string; value: string }>,
    participantCount?: number
  ): boolean {
    if (!headers) return false;

    // Check for list-related headers
    const headerNames = headers.map(h => h.name.toLowerCase());
    const listHeaders = [
      'list-id',
      'list-unsubscribe',
      'list-subscribe',
      'list-post',
      'list-help',
      'list-owner',
      'precedence'
    ];

    if (listHeaders.some(h => headerNames.includes(h))) {
      return true;
    }

    // Check for auto-reply/out-of-office indicators
    const autoReplyHeaders = headers.filter(h => 
      h.name.toLowerCase() === 'x-auto-response-suppress' ||
      h.name.toLowerCase() === 'auto-submitted' ||
      h.name.toLowerCase() === 'x-autoreply'
    );

    if (autoReplyHeaders.length > 0) {
      return true;
    }

    // Large recipient count suggests mass email (>10 recipients)
    if (participantCount && participantCount > 10) {
      return true;
    }

    return false;
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
   * Compute subject stem by removing Re:, Fwd:, etc prefixes
   */
  computeSubjectStem(subject: string | null): string {
    if (!subject) return '';
    // Remove common prefixes like Re:, Fwd:, FW:, etc.
    return subject.replace(/^(Re|Fwd|FW|RE|Fw):\s*/gi, '').trim();
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

        // Get unique participant count
        const uniqueParticipants = Array.from(new Set(allParticipants));
        const participantCount = uniqueParticipants.length;

        // Determine email direction and internal-only status
        const direction = this.determineEmailDirection(fromEmail, [...toEmails, ...ccEmails, ...bccEmails]);
        const isInternalOnly = this.isInternalOnlyEmail(allParticipants);
        
        // Detect marketing/list emails (Phase 8.2)
        const isMarketingOrList = this.isMarketingEmail(graphMessage.internetMessageHeaders, participantCount);

        // Extract threading metadata
        const references = this.extractReferencesHeader(graphMessage.internetMessageHeaders);
        const inReplyTo = graphMessage.internetMessageHeaders?.find(
          h => h.name.toLowerCase() === 'in-reply-to'
        )?.value.replace(/<|>/g, '');

        // Prepare email message for upsert
        // Note: Field names must match schema (from, to, cc, bcc, sentDateTime, receivedDateTime)
        const emailMessage: InsertEmailMessage = {
          internetMessageId: graphMessage.internetMessageId!,
          canonicalConversationId: graphMessage.conversationId || graphMessage.internetMessageId!,
          conversationIdSeen: graphMessage.conversationId || graphMessage.internetMessageId!,
          subject: graphMessage.subject || '(no subject)',
          subjectStem: this.computeSubjectStem(graphMessage.subject || ''),
          bodyPreview: graphMessage.bodyPreview || '',
          body: graphMessage.body?.content || '',
          from: fromEmail || '',
          to: toEmails,
          cc: ccEmails,
          bcc: bccEmails,
          sentDateTime: graphMessage.sentDateTime ? new Date(graphMessage.sentDateTime) : new Date(),
          receivedDateTime: graphMessage.receivedDateTime ? new Date(graphMessage.receivedDateTime) : new Date(),
          hasAttachments: graphMessage.hasAttachments || false,
          inReplyTo,
          references,
          conversationIndex: graphMessage.conversationIndex || null,
          graphMessageId: graphMessage.id,
          direction,
          isInternalOnly,
          participantCount,
          clientId: null,
          clientMatchConfidence: null
        };

        // Upsert message (idempotent by internetMessageId)
        const savedMessage = await storage.upsertEmailMessage(emailMessage);

        // Create mailbox mapping for this user
        // Check if mapping already exists to avoid duplicates
        const existingMaps = await storage.getMailboxMessageMapsByMessageId(savedMessage.internetMessageId);
        const hasMapping = existingMaps.some(map => map.mailboxUserId === userId);

        if (!hasMapping) {
          await storage.createMailboxMessageMap({
            mailboxUserId: userId,
            mailboxMessageId: graphMessage.id,
            internetMessageId: savedMessage.internetMessageId,
            folderPath: folderType
          });
        }

        // Process attachments if the message has any (Phase 8.3)
        if (graphMessage.hasAttachments) {
          try {
            // Check if attachments metadata is already included (initial sync)
            let attachments = graphMessage.attachments;
            
            // If not included, fetch explicitly (happens during incremental delta syncs)
            if (!attachments || attachments.length === 0) {
              console.log(`[Email Ingestion] Fetching attachments for message ${graphMessage.id}`);
              attachments = await this.fetchMessageAttachments(userId, graphMessage.id);
            }

            if (attachments && attachments.length > 0) {
              await emailAttachmentService.processMessageAttachments(
                userId,
                graphMessage.id,
                savedMessage.internetMessageId,
                attachments.map((att: any) => ({
                  id: att.id,
                  name: att.name,
                  size: att.size,
                  contentType: att.contentType,
                  isInline: att.isInline
                }))
              );
            }
          } catch (error) {
            console.error('[Email Ingestion] Error processing attachments:', error);
            // Don't fail the entire ingestion if attachment processing fails
          }
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

      // Layer 1: Group by canonicalConversationId
      const conversationGroups = new Map<string, EmailMessage[]>();
      const orphanedMessages: EmailMessage[] = [];

      for (const message of unthreadedMessages) {
        if (message.canonicalConversationId) {
          if (!conversationGroups.has(message.canonicalConversationId)) {
            conversationGroups.set(message.canonicalConversationId, []);
          }
          conversationGroups.get(message.canonicalConversationId)!.push(message);
        } else {
          orphanedMessages.push(message);
        }
      }

      // Process canonicalConversationId groups
      for (const [conversationId, messages] of Array.from(conversationGroups.entries())) {
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
          console.error(`[Email Threading] Error threading orphaned message ${message.internetMessageId}:`, error);
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
        new Date(a.sentDateTime || a.receivedDateTime).getTime() - new Date(b.sentDateTime || b.receivedDateTime).getTime()
      );
      const firstMessage = sortedMessages[0];
      const lastMessage = sortedMessages[sortedMessages.length - 1];

      // Collect all participants
      const allParticipants = new Set<string>();
      messages.forEach(msg => {
        if (msg.from) allParticipants.add(msg.from);
        (msg.to || []).forEach((email: string) => allParticipants.add(email));
        (msg.cc || []).forEach((email: string) => allParticipants.add(email));
      });

      thread = await storage.createEmailThread({
        canonicalConversationId: conversationId,
        threadKey: null,
        subject: firstMessage.subject,
        participants: Array.from(allParticipants),
        messageCount: messages.length,
        firstMessageAt: firstMessage.sentDateTime || firstMessage.receivedDateTime,
        lastMessageAt: lastMessage.sentDateTime || lastMessage.receivedDateTime,
        clientId: null
      });
    } else {
      // Update thread with latest message info
      const sortedMessages = messages.sort((a, b) => 
        new Date(a.sentDateTime || a.receivedDateTime).getTime() - new Date(b.sentDateTime || b.receivedDateTime).getTime()
      );
      const lastMessage = sortedMessages[sortedMessages.length - 1];

      await storage.updateEmailThread(thread.canonicalConversationId, {
        messageCount: messages.length,
        lastMessageAt: lastMessage.sentDateTime || lastMessage.receivedDateTime
      });
    }

    // Link all messages to this thread by updating their threadKey
    for (const message of messages) {
      await storage.updateEmailMessage(message.internetMessageId, { 
        threadKey: thread.canonicalConversationId 
      });
    }
  }

  /**
   * Thread orphaned message using ancestry or threadKey (Layer 2 & 3)
   */
  private async threadOrphanedMessage(message: EmailMessage): Promise<void> {
    // Layer 2: Try to find thread by inReplyTo ancestry
    if (message.inReplyTo) {
      const parentMessage = await storage.getEmailMessageByInternetMessageId(message.inReplyTo);
      if (parentMessage && parentMessage.threadKey) {
        // Link to parent's thread
        await storage.updateEmailMessage(message.internetMessageId, { threadKey: parentMessage.threadKey });
        
        // Update thread's last message time
        const thread = await storage.getEmailThreadByThreadKey(parentMessage.threadKey);
        const messageTime = message.sentDateTime || message.receivedDateTime;
        if (thread && new Date(messageTime).getTime() > new Date(thread.lastMessageAt).getTime()) {
          await storage.updateEmailThread(thread.canonicalConversationId, {
            lastMessageAt: messageTime,
            messageCount: (thread.messageCount || 0) + 1
          });
        }
        return;
      }
    }

    // Layer 3: Compute threadKey for orphaned message
    const participants = [
      message.from,
      ...(message.to || []),
      ...(message.cc || [])
    ].filter((email): email is string => email !== null && email !== undefined);

    const refs = (message.references || []).filter((r): r is string => r !== null);
    const rootMessageId = refs.length > 0 
      ? refs[0] 
      : message.internetMessageId;

    const threadKey = await this.computeThreadKey(
      rootMessageId,
      message.subject || '',
      participants
    );

    // Check if thread with this threadKey exists
    let thread = await storage.getEmailThreadByThreadKey(threadKey);
    const messageTime = message.sentDateTime || message.receivedDateTime;

    if (!thread) {
      // Create new thread with threadKey
      thread = await storage.createEmailThread({
        canonicalConversationId: threadKey,
        threadKey,
        subject: message.subject,
        participants,
        messageCount: 1,
        firstMessageAt: messageTime,
        lastMessageAt: messageTime,
        clientId: null
      });
    } else {
      // Update thread
      await storage.updateEmailThread(thread.canonicalConversationId, {
        messageCount: (thread.messageCount || 0) + 1,
        lastMessageAt: messageTime
      });
    }

    // Link message to thread
    await storage.updateEmailMessage(message.internetMessageId, { threadKey: thread.threadKey });
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
            await storage.updateEmailThread(thread.canonicalConversationId, {
              clientId: matchResult.clientId
            });

            // Update all messages in this thread
            const messages = await storage.getEmailMessagesByThreadId(thread.canonicalConversationId);
            for (const message of messages) {
              await storage.updateEmailMessage(message.internetMessageId, {
                clientId: matchResult.clientId,
                clientMatchConfidence: matchResult.confidence
              });
            }

            stats.matched++;
          } else {
            // No match - quarantine all messages in this thread
            const messages = await storage.getEmailMessagesByThreadId(thread.canonicalConversationId);
            for (const message of messages) {
              // Check if message is already in quarantine to prevent duplicates
              const existing = await storage.getUnmatchedEmailByMessageId(message.internetMessageId);
              if (!existing) {
                // Extract subject stem (remove Re:, Fwd: prefixes)
                const subjectStem = message.subject?.replace(/^(Re:|Fwd?:)\s*/gi, '').trim() || null;
                
                // Determine mailbox owner (first mailbox that has this message)
                const mailboxMappings = await storage.getMailboxMessageMapsByMessageId(message.internetMessageId);
                const mailboxOwnerUserId = mailboxMappings[0]?.mailboxUserId || null;
                
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
          console.error(`[Client Association] Error matching thread ${thread.canonicalConversationId}:`, error);
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

/**
 * Perform incremental delta sync for a user's mailbox
 * This is a convenience wrapper for the syncUserMailbox method
 */
export async function performIncrementalDeltaSync(userId: string): Promise<void> {
  return emailIngestionService.syncUserMailbox(userId);
}
