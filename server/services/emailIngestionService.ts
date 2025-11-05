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
}

// Export singleton instance
export const emailIngestionService = new EmailIngestionService();
