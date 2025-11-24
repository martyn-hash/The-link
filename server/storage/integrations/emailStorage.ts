import { db } from "../../db";
import { eq, and, or, desc, isNull, lt, sql } from "drizzle-orm";
import {
  graphWebhookSubscriptions,
  graphSyncState,
  emailMessages,
  mailboxMessageMap,
  emailThreads,
  clientEmailAliases,
  unmatchedEmails,
  clientDomainAllowlist,
  emailAttachments,
  emailMessageAttachments,
  users,
  type GraphWebhookSubscription,
  type InsertGraphWebhookSubscription,
  type GraphSyncState,
  type InsertGraphSyncState,
  type EmailMessage,
  type InsertEmailMessage,
  type MailboxMessageMap,
  type InsertMailboxMessageMap,
  type EmailThread,
  type InsertEmailThread,
  type ClientEmailAlias,
  type InsertClientEmailAlias,
  type UnmatchedEmail,
  type InsertUnmatchedEmail,
  type ClientDomainAllowlist,
  type InsertClientDomainAllowlist,
  type EmailAttachment,
  type InsertEmailAttachment,
  type EmailMessageAttachment,
  type InsertEmailMessageAttachment,
} from "@shared/schema";

export class EmailStorage {
  async createGraphWebhookSubscription(subscription: InsertGraphWebhookSubscription): Promise<GraphWebhookSubscription> {
    const [newSubscription] = await db
      .insert(graphWebhookSubscriptions)
      .values(subscription)
      .returning();
    return newSubscription;
  }

  async getGraphWebhookSubscription(subscriptionId: string): Promise<GraphWebhookSubscription | undefined> {
    const result = await db
      .select()
      .from(graphWebhookSubscriptions)
      .where(eq(graphWebhookSubscriptions.subscriptionId, subscriptionId))
      .limit(1);
    return result[0];
  }

  async updateGraphWebhookSubscription(subscriptionId: string, updates: Partial<InsertGraphWebhookSubscription>): Promise<void> {
    await db
      .update(graphWebhookSubscriptions)
      .set(updates)
      .where(eq(graphWebhookSubscriptions.subscriptionId, subscriptionId));
  }

  async getActiveGraphWebhookSubscriptions(): Promise<GraphWebhookSubscription[]> {
    return await db
      .select()
      .from(graphWebhookSubscriptions)
      .where(eq(graphWebhookSubscriptions.isActive, true))
      .orderBy(graphWebhookSubscriptions.expiresAt);
  }

  async getExpiringGraphWebhookSubscriptions(hoursUntilExpiry: number): Promise<GraphWebhookSubscription[]> {
    const expiryThreshold = new Date();
    expiryThreshold.setHours(expiryThreshold.getHours() + hoursUntilExpiry);
    
    return await db
      .select()
      .from(graphWebhookSubscriptions)
      .where(
        and(
          eq(graphWebhookSubscriptions.isActive, true),
          lt(graphWebhookSubscriptions.expiresAt, expiryThreshold)
        )
      )
      .orderBy(graphWebhookSubscriptions.expiresAt);
  }

  async getGraphSyncState(userId: string, folderPath: string): Promise<GraphSyncState | undefined> {
    const result = await db
      .select()
      .from(graphSyncState)
      .where(
        and(
          eq(graphSyncState.userId, userId),
          eq(graphSyncState.folderPath, folderPath)
        )
      )
      .limit(1);
    return result[0];
  }

  async upsertGraphSyncState(state: InsertGraphSyncState): Promise<GraphSyncState> {
    const existing = await this.getGraphSyncState(state.userId, state.folderPath);
    
    if (existing) {
      const [updated] = await db
        .update(graphSyncState)
        .set({
          ...state,
          updatedAt: new Date()
        })
        .where(eq(graphSyncState.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(graphSyncState)
        .values(state)
        .returning();
      return created;
    }
  }

  async upsertEmailMessage(message: InsertEmailMessage): Promise<EmailMessage> {
    const existing = await this.getEmailMessageByInternetMessageId(message.internetMessageId);
    
    if (existing) {
      const updatePayload: Partial<InsertEmailMessage> = {};
      
      if (message.hasAttachments !== undefined) updatePayload.hasAttachments = message.hasAttachments;
      if (message.clientId && !existing.clientId) updatePayload.clientId = message.clientId;
      if (message.clientMatchConfidence && !existing.clientMatchConfidence) updatePayload.clientMatchConfidence = message.clientMatchConfidence;
      
      const [updated] = await db
        .update(emailMessages)
        .set({
          ...updatePayload,
          updatedAt: new Date()
        })
        .where(eq(emailMessages.internetMessageId, existing.internetMessageId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(emailMessages)
        .values(message)
        .returning();
      return created;
    }
  }

  async getEmailMessageByInternetMessageId(internetMessageId: string): Promise<EmailMessage | undefined> {
    const result = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.internetMessageId, internetMessageId))
      .limit(1);
    return result[0];
  }

  async getEmailMessageById(id: string): Promise<EmailMessage | undefined> {
    const result = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.internetMessageId, id))
      .limit(1);
    return result[0];
  }

  async getEmailMessagesByThreadId(threadId: string): Promise<EmailMessage[]> {
    return await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.canonicalConversationId, threadId))
      .orderBy(emailMessages.sentDateTime);
  }

  async updateEmailMessage(id: string, updates: Partial<InsertEmailMessage>): Promise<EmailMessage> {
    const [updated] = await db
      .update(emailMessages)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(emailMessages.internetMessageId, id))
      .returning();
    return updated;
  }

  async createMailboxMessageMap(mapping: InsertMailboxMessageMap): Promise<MailboxMessageMap> {
    const [created] = await db
      .insert(mailboxMessageMap)
      .values(mapping)
      .returning();
    return created;
  }

  async getMailboxMessageMapsByUserId(userId: string): Promise<MailboxMessageMap[]> {
    return await db
      .select()
      .from(mailboxMessageMap)
      .where(eq(mailboxMessageMap.mailboxUserId, userId))
      .orderBy(mailboxMessageMap.createdAt);
  }

  async getMailboxMessageMapsByMessageId(messageId: string): Promise<MailboxMessageMap[]> {
    const message = await this.getEmailMessageById(messageId);
    if (!message) {
      return [];
    }

    return await db
      .select()
      .from(mailboxMessageMap)
      .where(eq(mailboxMessageMap.internetMessageId, message.internetMessageId));
  }

  async userHasAccessToMessage(userId: string, internetMessageId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(mailboxMessageMap)
      .where(
        and(
          eq(mailboxMessageMap.mailboxUserId, userId),
          eq(mailboxMessageMap.internetMessageId, internetMessageId)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async getUserGraphMessageId(userId: string, internetMessageId: string): Promise<string | undefined> {
    const result = await db
      .select()
      .from(mailboxMessageMap)
      .where(
        and(
          eq(mailboxMessageMap.mailboxUserId, userId),
          eq(mailboxMessageMap.internetMessageId, internetMessageId)
        )
      )
      .limit(1);

    return result[0]?.mailboxMessageId;
  }

  async createEmailThread(thread: InsertEmailThread): Promise<EmailThread> {
    const [created] = await db
      .insert(emailThreads)
      .values(thread)
      .returning();
    return created;
  }

  async getEmailThreadById(id: string): Promise<EmailThread | undefined> {
    const result = await db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.canonicalConversationId, id))
      .limit(1);
    return result[0];
  }

  async getEmailThreadByConversationId(conversationId: string): Promise<EmailThread | undefined> {
    const result = await db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.canonicalConversationId, conversationId))
      .limit(1);
    return result[0];
  }

  async getEmailThreadByThreadKey(threadKey: string): Promise<EmailThread | undefined> {
    const result = await db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.threadKey, threadKey))
      .limit(1);
    return result[0];
  }

  async getEmailThreadsByClientId(clientId: string): Promise<EmailThread[]> {
    return await db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.clientId, clientId))
      .orderBy(desc(emailThreads.lastMessageAt));
  }

  async getEmailThreadsByUserId(userId: string, myEmailsOnly: boolean): Promise<EmailThread[]> {
    if (myEmailsOnly) {
      const user = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (!user || user.length === 0 || !user[0].email) {
        return [];
      }
      
      const userEmail = user[0].email.toLowerCase();
      
      const results = await db
        .selectDistinctOn([emailThreads.canonicalConversationId], {
          canonicalConversationId: emailThreads.canonicalConversationId,
          threadKey: emailThreads.threadKey,
          subject: emailThreads.subject,
          participants: emailThreads.participants,
          clientId: emailThreads.clientId,
          firstMessageAt: emailThreads.firstMessageAt,
          lastMessageAt: emailThreads.lastMessageAt,
          messageCount: emailThreads.messageCount,
          latestPreview: emailThreads.latestPreview,
          latestDirection: emailThreads.latestDirection,
          createdAt: emailThreads.createdAt,
          updatedAt: emailThreads.updatedAt,
        })
        .from(emailThreads)
        .innerJoin(
          emailMessages,
          eq(emailMessages.canonicalConversationId, emailThreads.canonicalConversationId)
        )
        .where(
          or(
            eq(emailMessages.from, userEmail),
            sql`${userEmail} = ANY(${emailMessages.to})`,
            sql`${userEmail} = ANY(${emailMessages.cc})`
          )
        )
        .orderBy(emailThreads.canonicalConversationId, desc(emailThreads.lastMessageAt));
      
      return results;
    } else {
      const results = await db
        .selectDistinctOn([emailThreads.canonicalConversationId], {
          canonicalConversationId: emailThreads.canonicalConversationId,
          threadKey: emailThreads.threadKey,
          subject: emailThreads.subject,
          participants: emailThreads.participants,
          clientId: emailThreads.clientId,
          firstMessageAt: emailThreads.firstMessageAt,
          lastMessageAt: emailThreads.lastMessageAt,
          messageCount: emailThreads.messageCount,
          latestPreview: emailThreads.latestPreview,
          latestDirection: emailThreads.latestDirection,
          createdAt: emailThreads.createdAt,
          updatedAt: emailThreads.updatedAt,
        })
        .from(emailThreads)
        .innerJoin(
          emailMessages,
          eq(emailMessages.canonicalConversationId, emailThreads.canonicalConversationId)
        )
        .innerJoin(
          mailboxMessageMap,
          eq(mailboxMessageMap.internetMessageId, emailMessages.internetMessageId)
        )
        .where(eq(mailboxMessageMap.mailboxUserId, userId))
        .orderBy(emailThreads.canonicalConversationId, desc(emailThreads.lastMessageAt));
      
      return results;
    }
  }

  async getAllEmailThreads(): Promise<EmailThread[]> {
    return await db
      .select()
      .from(emailThreads)
      .orderBy(desc(emailThreads.lastMessageAt));
  }

  async getThreadsWithoutClient(): Promise<EmailThread[]> {
    return await db
      .select()
      .from(emailThreads)
      .where(isNull(emailThreads.clientId))
      .orderBy(desc(emailThreads.lastMessageAt));
  }

  async updateEmailThread(id: string, updates: Partial<InsertEmailThread>): Promise<EmailThread> {
    const [updated] = await db
      .update(emailThreads)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(emailThreads.canonicalConversationId, id))
      .returning();
    return updated;
  }

  async getUnthreadedMessages(): Promise<EmailMessage[]> {
    return await db
      .select()
      .from(emailMessages)
      .where(isNull(emailMessages.canonicalConversationId))
      .orderBy(emailMessages.sentDateTime);
  }

  async getAllClientEmailAliases(): Promise<ClientEmailAlias[]> {
    return await db
      .select()
      .from(clientEmailAliases)
      .orderBy(clientEmailAliases.createdAt);
  }

  async createClientEmailAlias(alias: InsertClientEmailAlias): Promise<ClientEmailAlias> {
    const [created] = await db
      .insert(clientEmailAliases)
      .values(alias)
      .returning();
    return created;
  }

  async getClientEmailAliasesByClientId(clientId: string): Promise<ClientEmailAlias[]> {
    return await db
      .select()
      .from(clientEmailAliases)
      .where(eq(clientEmailAliases.clientId, clientId))
      .orderBy(clientEmailAliases.createdAt);
  }

  async getClientByEmailAlias(email: string): Promise<{ clientId: string } | undefined> {
    const result = await db
      .select({ clientId: clientEmailAliases.clientId })
      .from(clientEmailAliases)
      .where(eq(clientEmailAliases.emailLowercase, email.toLowerCase()))
      .limit(1);
    return result[0];
  }

  async deleteClientEmailAlias(id: string): Promise<void> {
    await db.delete(clientEmailAliases).where(eq(clientEmailAliases.id, id));
  }

  async createUnmatchedEmail(unmatched: InsertUnmatchedEmail): Promise<UnmatchedEmail> {
    const [created] = await db
      .insert(unmatchedEmails)
      .values(unmatched)
      .returning();
    return created;
  }

  async getUnmatchedEmails(filters?: { resolvedOnly?: boolean }): Promise<UnmatchedEmail[]> {
    return await db
      .select()
      .from(unmatchedEmails)
      .orderBy(desc(unmatchedEmails.receivedDateTime));
  }

  async getUnmatchedEmailByMessageId(internetMessageId: string): Promise<UnmatchedEmail | undefined> {
    const result = await db
      .select()
      .from(unmatchedEmails)
      .where(eq(unmatchedEmails.internetMessageId, internetMessageId))
      .limit(1);
    return result[0];
  }

  async updateUnmatchedEmail(internetMessageId: string, updates: Partial<InsertUnmatchedEmail>): Promise<UnmatchedEmail> {
    const [updated] = await db
      .update(unmatchedEmails)
      .set(updates)
      .where(eq(unmatchedEmails.internetMessageId, internetMessageId))
      .returning();
    return updated;
  }

  async deleteUnmatchedEmail(internetMessageId: string): Promise<void> {
    await db.delete(unmatchedEmails).where(eq(unmatchedEmails.internetMessageId, internetMessageId));
  }

  async resolveUnmatchedEmail(internetMessageId: string, clientId: string, resolvedBy: string): Promise<void> {
    await this.deleteUnmatchedEmail(internetMessageId);
  }

  async createClientDomainAllowlist(domain: InsertClientDomainAllowlist): Promise<ClientDomainAllowlist> {
    const [created] = await db
      .insert(clientDomainAllowlist)
      .values(domain)
      .returning();
    return created;
  }

  async getClientDomainAllowlist(): Promise<ClientDomainAllowlist[]> {
    return await db
      .select()
      .from(clientDomainAllowlist)
      .orderBy(clientDomainAllowlist.domain);
  }

  async getClientByDomain(domain: string): Promise<{ clientId: string } | undefined> {
    const result = await db
      .select({ clientId: clientDomainAllowlist.clientId })
      .from(clientDomainAllowlist)
      .where(eq(clientDomainAllowlist.domain, domain.toLowerCase()))
      .limit(1);
    return result[0];
  }

  async deleteClientDomainAllowlist(id: string): Promise<void> {
    await db.delete(clientDomainAllowlist).where(eq(clientDomainAllowlist.id, id));
  }

  async createEmailAttachment(attachment: InsertEmailAttachment): Promise<EmailAttachment> {
    const [created] = await db
      .insert(emailAttachments)
      .values(attachment)
      .returning();
    return created;
  }

  async getEmailAttachmentByHash(contentHash: string): Promise<EmailAttachment | undefined> {
    const result = await db
      .select()
      .from(emailAttachments)
      .where(eq(emailAttachments.contentHash, contentHash))
      .limit(1);
    return result[0];
  }

  async getEmailAttachmentById(id: string): Promise<EmailAttachment | undefined> {
    const result = await db
      .select()
      .from(emailAttachments)
      .where(eq(emailAttachments.id, id))
      .limit(1);
    return result[0];
  }

  async createEmailMessageAttachment(mapping: InsertEmailMessageAttachment): Promise<EmailMessageAttachment> {
    const [created] = await db
      .insert(emailMessageAttachments)
      .values(mapping)
      .returning();
    return created;
  }

  async getEmailMessageAttachmentByAttachmentId(attachmentId: string): Promise<EmailMessageAttachment[]> {
    return await db
      .select()
      .from(emailMessageAttachments)
      .where(eq(emailMessageAttachments.attachmentId, attachmentId));
  }

  async getAttachmentsByMessageId(internetMessageId: string): Promise<EmailAttachment[]> {
    const result = await db
      .select({
        id: emailAttachments.id,
        contentHash: emailAttachments.contentHash,
        fileName: emailAttachments.fileName,
        fileSize: emailAttachments.fileSize,
        contentType: emailAttachments.contentType,
        objectPath: emailAttachments.objectPath,
        createdAt: emailAttachments.createdAt,
      })
      .from(emailMessageAttachments)
      .innerJoin(emailAttachments, eq(emailMessageAttachments.attachmentId, emailAttachments.id))
      .where(eq(emailMessageAttachments.internetMessageId, internetMessageId))
      .orderBy(emailMessageAttachments.attachmentIndex);
    
    return result;
  }

  async checkEmailMessageAttachmentExists(internetMessageId: string, attachmentId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(emailMessageAttachments)
      .where(
        and(
          eq(emailMessageAttachments.internetMessageId, internetMessageId),
          eq(emailMessageAttachments.attachmentId, attachmentId)
        )
      )
      .limit(1);
    
    return result.length > 0;
  }

  async getSignedUrl(objectPath: string): Promise<string> {
    const { objectStorageClient } = await import('../../objectStorage');
    const bucketName = process.env.GCS_BUCKET_NAME;
    
    if (!bucketName) {
      throw new Error('GCS_BUCKET_NAME environment variable not set');
    }
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);
    
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });
    
    return url;
  }
}
