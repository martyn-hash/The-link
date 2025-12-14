import { db } from "../../db";
import { eq, and, or, desc, isNull, lt, sql, asc, gte, lte } from "drizzle-orm";
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
  inboxes,
  userInboxAccess,
  users,
  inboxEmails,
  emailQuarantine,
  emailClassifications,
  emailWorkflowState,
  emailClassificationOverrides,
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
  type Inbox,
  type InsertInbox,
  type UserInboxAccess,
  type InsertUserInboxAccess,
  type InboxEmail,
  type InsertInboxEmail,
  type EmailQuarantine,
  type InsertEmailQuarantine,
  type EmailClassification,
  type InsertEmailClassification,
  type EmailWorkflowState,
  type InsertEmailWorkflowState,
  type EmailClassificationOverride,
  type InsertEmailClassificationOverride,
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

  async createEmailMessage(message: InsertEmailMessage): Promise<EmailMessage> {
    const [created] = await db
      .insert(emailMessages)
      .values(message)
      .returning();
    return created;
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

  async getMailboxMessageMapByGraphId(userId: string, graphMessageId: string): Promise<MailboxMessageMap | undefined> {
    const result = await db
      .select()
      .from(mailboxMessageMap)
      .where(
        and(
          eq(mailboxMessageMap.mailboxUserId, userId),
          eq(mailboxMessageMap.mailboxMessageId, graphMessageId)
        )
      )
      .limit(1);
    return result[0];
  }

  async deleteMailboxMessageMapsByUserId(userId: string): Promise<void> {
    await db.delete(mailboxMessageMap).where(eq(mailboxMessageMap.mailboxUserId, userId));
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

  // ========== INBOX MANAGEMENT ==========

  async createInbox(inbox: InsertInbox): Promise<Inbox> {
    const [created] = await db
      .insert(inboxes)
      .values(inbox)
      .returning();
    return created;
  }

  async getInboxById(id: string): Promise<Inbox | undefined> {
    const result = await db
      .select()
      .from(inboxes)
      .where(eq(inboxes.id, id))
      .limit(1);
    return result[0];
  }

  async getInboxByEmailAddress(emailAddress: string): Promise<Inbox | undefined> {
    const result = await db
      .select()
      .from(inboxes)
      .where(eq(inboxes.emailAddress, emailAddress.toLowerCase()))
      .limit(1);
    return result[0];
  }

  async getAllInboxes(): Promise<Inbox[]> {
    return await db
      .select()
      .from(inboxes)
      .orderBy(asc(inboxes.displayName), asc(inboxes.emailAddress));
  }

  async getActiveInboxes(): Promise<Inbox[]> {
    return await db
      .select()
      .from(inboxes)
      .where(eq(inboxes.isActive, true))
      .orderBy(asc(inboxes.displayName), asc(inboxes.emailAddress));
  }

  async getInboxesByType(inboxType: string): Promise<Inbox[]> {
    return await db
      .select()
      .from(inboxes)
      .where(eq(inboxes.inboxType, inboxType))
      .orderBy(asc(inboxes.emailAddress));
  }

  async getInboxByLinkedUserId(userId: string): Promise<Inbox | undefined> {
    const result = await db
      .select()
      .from(inboxes)
      .where(eq(inboxes.linkedUserId, userId))
      .limit(1);
    return result[0];
  }

  async updateInbox(id: string, updates: Partial<InsertInbox>): Promise<Inbox> {
    const [updated] = await db
      .update(inboxes)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(inboxes.id, id))
      .returning();
    return updated;
  }

  async deleteInbox(id: string): Promise<void> {
    await db.delete(inboxes).where(eq(inboxes.id, id));
  }

  async upsertInboxForUser(userId: string, emailAddress: string, displayName?: string): Promise<Inbox> {
    const existing = await this.getInboxByEmailAddress(emailAddress);
    
    if (existing) {
      if (!existing.linkedUserId) {
        return await this.updateInbox(existing.id, { linkedUserId: userId });
      }
      return existing;
    }
    
    return await this.createInbox({
      emailAddress: emailAddress.toLowerCase(),
      displayName: displayName || emailAddress,
      inboxType: 'user',
      linkedUserId: userId,
      isActive: true,
    });
  }

  // ========== USER INBOX ACCESS ==========

  async createUserInboxAccess(access: InsertUserInboxAccess): Promise<UserInboxAccess> {
    const [created] = await db
      .insert(userInboxAccess)
      .values(access)
      .returning();
    return created;
  }

  async getUserInboxAccessById(id: string): Promise<UserInboxAccess | undefined> {
    const result = await db
      .select()
      .from(userInboxAccess)
      .where(eq(userInboxAccess.id, id))
      .limit(1);
    return result[0];
  }

  async getUserInboxAccessByUserAndInbox(userId: string, inboxId: string): Promise<UserInboxAccess | undefined> {
    const result = await db
      .select()
      .from(userInboxAccess)
      .where(
        and(
          eq(userInboxAccess.userId, userId),
          eq(userInboxAccess.inboxId, inboxId)
        )
      )
      .limit(1);
    return result[0];
  }

  async getInboxAccessByUserId(userId: string): Promise<(UserInboxAccess & { inbox: Inbox })[]> {
    const result = await db
      .select({
        id: userInboxAccess.id,
        userId: userInboxAccess.userId,
        inboxId: userInboxAccess.inboxId,
        accessLevel: userInboxAccess.accessLevel,
        grantedBy: userInboxAccess.grantedBy,
        grantedAt: userInboxAccess.grantedAt,
        createdAt: userInboxAccess.createdAt,
        inbox: inboxes,
      })
      .from(userInboxAccess)
      .innerJoin(inboxes, eq(userInboxAccess.inboxId, inboxes.id))
      .where(eq(userInboxAccess.userId, userId))
      .orderBy(asc(inboxes.emailAddress));
    
    return result.map(r => ({
      id: r.id,
      userId: r.userId,
      inboxId: r.inboxId,
      accessLevel: r.accessLevel,
      grantedBy: r.grantedBy,
      grantedAt: r.grantedAt,
      createdAt: r.createdAt,
      inbox: r.inbox,
    }));
  }

  async getInboxAccessByInboxId(inboxId: string): Promise<(UserInboxAccess & { user: { id: string; email: string | null; firstName: string | null; lastName: string | null } })[]> {
    const result = await db
      .select({
        id: userInboxAccess.id,
        userId: userInboxAccess.userId,
        inboxId: userInboxAccess.inboxId,
        accessLevel: userInboxAccess.accessLevel,
        grantedBy: userInboxAccess.grantedBy,
        grantedAt: userInboxAccess.grantedAt,
        createdAt: userInboxAccess.createdAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(userInboxAccess)
      .innerJoin(users, eq(userInboxAccess.userId, users.id))
      .where(eq(userInboxAccess.inboxId, inboxId))
      .orderBy(asc(users.firstName), asc(users.lastName));
    
    return result;
  }

  async updateUserInboxAccess(id: string, updates: Partial<InsertUserInboxAccess>): Promise<UserInboxAccess> {
    const [updated] = await db
      .update(userInboxAccess)
      .set(updates)
      .where(eq(userInboxAccess.id, id))
      .returning();
    return updated;
  }

  async deleteUserInboxAccess(id: string): Promise<void> {
    await db.delete(userInboxAccess).where(eq(userInboxAccess.id, id));
  }

  async deleteUserInboxAccessByUserAndInbox(userId: string, inboxId: string): Promise<void> {
    await db.delete(userInboxAccess).where(
      and(
        eq(userInboxAccess.userId, userId),
        eq(userInboxAccess.inboxId, inboxId)
      )
    );
  }

  async grantInboxAccess(userId: string, inboxId: string, accessLevel: string, grantedBy: string): Promise<UserInboxAccess> {
    const existing = await this.getUserInboxAccessByUserAndInbox(userId, inboxId);
    
    if (existing) {
      return await this.updateUserInboxAccess(existing.id, { accessLevel, grantedBy });
    }
    
    return await this.createUserInboxAccess({
      userId,
      inboxId,
      accessLevel,
      grantedBy,
    });
  }

  async revokeInboxAccess(userId: string, inboxId: string): Promise<void> {
    await this.deleteUserInboxAccessByUserAndInbox(userId, inboxId);
  }

  async getUserAccessibleInboxes(userId: string): Promise<Inbox[]> {
    const accessRecords = await this.getInboxAccessByUserId(userId);
    return accessRecords.map(a => a.inbox);
  }

  async canUserAccessInbox(userId: string, inboxId: string): Promise<boolean> {
    const access = await this.getUserInboxAccessByUserAndInbox(userId, inboxId);
    return !!access;
  }

  async ensureUserHasOwnInboxAccess(userId: string, userEmail: string): Promise<void> {
    const inbox = await this.upsertInboxForUser(userId, userEmail);
    const hasAccess = await this.canUserAccessInbox(userId, inbox.id);
    
    if (!hasAccess) {
      await this.grantInboxAccess(userId, inbox.id, 'full', userId);
    }
  }

  // ========== INBOX EMAILS (SLA TRACKING) ==========

  async createInboxEmail(email: InsertInboxEmail): Promise<InboxEmail> {
    const [created] = await db
      .insert(inboxEmails)
      .values(email)
      .returning();
    return created;
  }

  async getInboxEmailById(id: string): Promise<InboxEmail | undefined> {
    const result = await db
      .select()
      .from(inboxEmails)
      .where(eq(inboxEmails.id, id))
      .limit(1);
    return result[0];
  }

  async getInboxEmailByMicrosoftId(inboxId: string, microsoftId: string): Promise<InboxEmail | undefined> {
    const result = await db
      .select()
      .from(inboxEmails)
      .where(
        and(
          eq(inboxEmails.inboxId, inboxId),
          eq(inboxEmails.microsoftId, microsoftId)
        )
      )
      .limit(1);
    return result[0];
  }

  async getEmailsByInbox(
    inboxId: string,
    filters?: {
      status?: 'pending_reply' | 'replied' | 'no_action_needed' | 'overdue' | 'all';
      clientMatchedOnly?: boolean;
      dueTodayOnly?: boolean;
      overdueOnly?: boolean;
      sinceDate?: Date;
      search?: string;
      limit?: number;
      offset?: number;
      includeCompleted?: boolean; // Default false - exclude completed emails
    }
  ): Promise<(InboxEmail & { workflowState?: { state: string; completedAt: Date | null } })[]> {
    const conditions: any[] = [eq(inboxEmails.inboxId, inboxId)];

    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(inboxEmails.status, filters.status));
    }

    if (filters?.clientMatchedOnly) {
      conditions.push(sql`${inboxEmails.matchedClientId} IS NOT NULL`);
    }

    if (filters?.dueTodayOnly) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      conditions.push(
        and(
          gte(inboxEmails.slaDeadline, todayStart),
          lte(inboxEmails.slaDeadline, todayEnd)
        )
      );
    }

    if (filters?.overdueOnly) {
      const now = new Date();
      conditions.push(
        and(
          lt(inboxEmails.slaDeadline, now),
          eq(inboxEmails.status, 'pending_reply')
        )
      );
    }
    
    if (filters?.sinceDate) {
      conditions.push(gte(inboxEmails.receivedAt, filters.sinceDate));
    }
    
    if (filters?.search) {
      const searchTerm = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${inboxEmails.subject}) LIKE ${searchTerm}`,
          sql`LOWER(${inboxEmails.fromAddress}) LIKE ${searchTerm}`,
          sql`LOWER(${inboxEmails.fromName}) LIKE ${searchTerm}`,
          sql`LOWER(${inboxEmails.bodyPreview}) LIKE ${searchTerm}`
        )
      );
    }

    // Exclude completed emails by default (Step 5: Email as Workflow)
    if (!filters?.includeCompleted) {
      conditions.push(
        or(
          isNull(emailWorkflowState.state),
          sql`${emailWorkflowState.state} != 'complete'`
        )
      );
    }

    let query = db
      .select({
        email: inboxEmails,
        workflowState: {
          state: emailWorkflowState.state,
          completedAt: emailWorkflowState.completedAt,
        },
      })
      .from(inboxEmails)
      .leftJoin(emailWorkflowState, eq(inboxEmails.id, emailWorkflowState.emailId))
      .where(and(...conditions))
      .orderBy(desc(inboxEmails.receivedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    const results = await query;
    
    // Flatten the result to match expected format
    return results.map(r => ({
      ...r.email,
      workflowState: r.workflowState?.state ? {
        state: r.workflowState.state,
        completedAt: r.workflowState.completedAt,
      } : undefined,
    }));
  }

  async updateInboxEmail(id: string, updates: Partial<InsertInboxEmail>): Promise<InboxEmail> {
    const [updated] = await db
      .update(inboxEmails)
      .set(updates)
      .where(eq(inboxEmails.id, id))
      .returning();
    return updated;
  }

  async updateInboxEmailStatus(id: string, status: 'pending_reply' | 'replied' | 'no_action_needed' | 'overdue'): Promise<InboxEmail> {
    return await this.updateInboxEmail(id, { status });
  }

  async markInboxEmailAsReplied(id: string): Promise<InboxEmail> {
    return await this.updateInboxEmail(id, { 
      status: 'replied', 
      repliedAt: new Date() 
    });
  }

  async getEmailsNeedingSlaCheck(): Promise<InboxEmail[]> {
    const now = new Date();
    return await db
      .select()
      .from(inboxEmails)
      .where(
        and(
          eq(inboxEmails.status, 'pending_reply'),
          sql`${inboxEmails.slaDeadline} IS NOT NULL`,
          lt(inboxEmails.slaDeadline, now)
        )
      )
      .orderBy(asc(inboxEmails.slaDeadline));
  }

  async markOverdueEmails(): Promise<number> {
    const now = new Date();
    const result = await db
      .update(inboxEmails)
      .set({ status: 'overdue' })
      .where(
        and(
          eq(inboxEmails.status, 'pending_reply'),
          sql`${inboxEmails.slaDeadline} IS NOT NULL`,
          lt(inboxEmails.slaDeadline, now)
        )
      )
      .returning();
    return result.length;
  }

  async upsertInboxEmail(email: InsertInboxEmail): Promise<InboxEmail> {
    const existing = await this.getInboxEmailByMicrosoftId(email.inboxId, email.microsoftId);
    
    if (existing) {
      const updatePayload: Partial<InsertInboxEmail> = {};
      if (email.matchedClientId && !existing.matchedClientId) {
        updatePayload.matchedClientId = email.matchedClientId;
      }
      if (email.slaDeadline && !existing.slaDeadline) {
        updatePayload.slaDeadline = email.slaDeadline;
      }
      if (email.bodyHtml && !existing.bodyHtml) {
        updatePayload.bodyHtml = email.bodyHtml;
      }
      
      // Update directly to include syncedAt (not in InsertInboxEmail)
      const [updated] = await db
        .update(inboxEmails)
        .set({ ...updatePayload, syncedAt: new Date() })
        .where(eq(inboxEmails.id, existing.id))
        .returning();
      return updated;
    } else {
      return await this.createInboxEmail(email);
    }
  }

  async markOldEmailsAsNoAction(inboxId: string, thresholdDate: Date): Promise<number> {
    const result = await db
      .update(inboxEmails)
      .set({ status: 'no_action_needed' })
      .where(
        and(
          eq(inboxEmails.inboxId, inboxId),
          eq(inboxEmails.direction, 'inbound'),
          eq(inboxEmails.status, 'pending_reply'),
          lt(inboxEmails.receivedAt, thresholdDate)
        )
      )
      .returning();
    return result.length;
  }

  async getInboxEmailsForClient(clientId: string): Promise<InboxEmail[]> {
    return await db
      .select()
      .from(inboxEmails)
      .where(eq(inboxEmails.matchedClientId, clientId))
      .orderBy(desc(inboxEmails.receivedAt));
  }

  async getEmailsByConversationId(conversationId: string): Promise<InboxEmail[]> {
    return await db
      .select()
      .from(inboxEmails)
      .where(eq(inboxEmails.conversationId, conversationId))
      .orderBy(asc(inboxEmails.receivedAt));
  }

  async markConversationEmailsAsReplied(conversationId: string): Promise<number> {
    const result = await db
      .update(inboxEmails)
      .set({ 
        status: 'replied', 
        repliedAt: new Date() 
      })
      .where(
        and(
          eq(inboxEmails.conversationId, conversationId),
          eq(inboxEmails.status, 'pending_reply')
        )
      )
      .returning();
    return result.length;
  }

  async markEmailsAsRepliedByRecipient(recipientEmail: string): Promise<number> {
    const result = await db
      .update(inboxEmails)
      .set({ 
        status: 'replied', 
        repliedAt: new Date() 
      })
      .where(
        and(
          eq(inboxEmails.fromAddress, recipientEmail.toLowerCase()),
          eq(inboxEmails.status, 'pending_reply')
        )
      )
      .returning();
    return result.length;
  }

  async deleteInboxEmail(id: string): Promise<void> {
    await db.delete(inboxEmails).where(eq(inboxEmails.id, id));
  }

  async getInboxEmailStats(inboxId: string): Promise<{
    total: number;
    pendingReply: number;
    overdue: number;
    dueToday: number;
    replied: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const now = new Date();

    const result = await db
      .select({
        total: sql<number>`count(*)`,
        pendingReply: sql<number>`count(*) filter (where ${inboxEmails.status} = 'pending_reply')`,
        overdue: sql<number>`count(*) filter (where ${inboxEmails.status} = 'overdue' or (${inboxEmails.status} = 'pending_reply' and ${inboxEmails.slaDeadline} < ${now}))`,
        dueToday: sql<number>`count(*) filter (where ${inboxEmails.status} = 'pending_reply' and ${inboxEmails.slaDeadline} >= ${todayStart} and ${inboxEmails.slaDeadline} <= ${todayEnd})`,
        replied: sql<number>`count(*) filter (where ${inboxEmails.status} = 'replied')`,
      })
      .from(inboxEmails)
      .where(eq(inboxEmails.inboxId, inboxId));

    return {
      total: Number(result[0]?.total ?? 0),
      pendingReply: Number(result[0]?.pendingReply ?? 0),
      overdue: Number(result[0]?.overdue ?? 0),
      dueToday: Number(result[0]?.dueToday ?? 0),
      replied: Number(result[0]?.replied ?? 0),
    };
  }

  // ========== EMAIL QUARANTINE ==========

  async createEmailQuarantine(quarantine: InsertEmailQuarantine): Promise<EmailQuarantine> {
    const [created] = await db
      .insert(emailQuarantine)
      .values(quarantine)
      .returning();
    return created;
  }

  async getEmailQuarantineById(id: string): Promise<EmailQuarantine | undefined> {
    const result = await db
      .select()
      .from(emailQuarantine)
      .where(eq(emailQuarantine.id, id))
      .limit(1);
    return result[0];
  }

  async getQuarantineByMicrosoftId(inboxId: string, microsoftId: string): Promise<EmailQuarantine | undefined> {
    const result = await db
      .select()
      .from(emailQuarantine)
      .where(
        and(
          eq(emailQuarantine.inboxId, inboxId),
          eq(emailQuarantine.microsoftId, microsoftId)
        )
      )
      .limit(1);
    return result[0];
  }

  async getQuarantinedEmails(filters?: {
    inboxId?: string;
    restoredOnly?: boolean;
    pendingOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<EmailQuarantine[]> {
    const conditions: any[] = [];

    if (filters?.inboxId) {
      conditions.push(eq(emailQuarantine.inboxId, filters.inboxId));
    }

    if (filters?.restoredOnly) {
      conditions.push(sql`${emailQuarantine.restoredAt} IS NOT NULL`);
    }

    if (filters?.pendingOnly) {
      conditions.push(isNull(emailQuarantine.restoredAt));
    }

    let query = db
      .select()
      .from(emailQuarantine)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(emailQuarantine.receivedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    return await query;
  }

  async restoreQuarantinedEmail(id: string, userId: string, clientId: string): Promise<EmailQuarantine> {
    const [updated] = await db
      .update(emailQuarantine)
      .set({
        restoredAt: new Date(),
        restoredBy: userId,
        restoredToClientId: clientId,
      })
      .where(eq(emailQuarantine.id, id))
      .returning();
    return updated;
  }

  async deleteQuarantinedEmail(id: string): Promise<void> {
    await db.delete(emailQuarantine).where(eq(emailQuarantine.id, id));
  }

  async getQuarantineStats(inboxId?: string): Promise<{ total: number; pending: number; restored: number }> {
    const conditions: any[] = [];
    if (inboxId) {
      conditions.push(eq(emailQuarantine.inboxId, inboxId));
    }

    const result = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`count(*) filter (where ${emailQuarantine.restoredAt} IS NULL)`,
        restored: sql<number>`count(*) filter (where ${emailQuarantine.restoredAt} IS NOT NULL)`,
      })
      .from(emailQuarantine)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      total: Number(result[0]?.total ?? 0),
      pending: Number(result[0]?.pending ?? 0),
      restored: Number(result[0]?.restored ?? 0),
    };
  }

  // ========== EMAIL CLASSIFICATIONS ==========

  async createEmailClassification(classification: InsertEmailClassification): Promise<EmailClassification> {
    const [created] = await db
      .insert(emailClassifications)
      .values(classification)
      .returning();
    return created;
  }

  async getEmailClassificationByEmailId(emailId: string): Promise<EmailClassification | undefined> {
    const result = await db
      .select()
      .from(emailClassifications)
      .where(eq(emailClassifications.emailId, emailId))
      .limit(1);
    return result[0];
  }

  async upsertEmailClassification(classification: InsertEmailClassification): Promise<EmailClassification> {
    const existing = await this.getEmailClassificationByEmailId(classification.emailId);
    
    if (existing) {
      const [updated] = await db
        .update(emailClassifications)
        .set({
          ...classification,
          updatedAt: new Date(),
        })
        .where(eq(emailClassifications.id, existing.id))
        .returning();
      return updated;
    } else {
      return await this.createEmailClassification(classification);
    }
  }

  async updateEmailClassification(id: string, updates: Partial<InsertEmailClassification>): Promise<EmailClassification> {
    const [updated] = await db
      .update(emailClassifications)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(emailClassifications.id, id))
      .returning();
    return updated;
  }

  // ========== EMAIL WORKFLOW STATE ==========

  async createEmailWorkflowState(state: InsertEmailWorkflowState): Promise<EmailWorkflowState> {
    const [created] = await db
      .insert(emailWorkflowState)
      .values(state)
      .returning();
    return created;
  }

  async getEmailWorkflowStateByEmailId(emailId: string): Promise<EmailWorkflowState | undefined> {
    const result = await db
      .select()
      .from(emailWorkflowState)
      .where(eq(emailWorkflowState.emailId, emailId))
      .limit(1);
    return result[0];
  }

  async upsertEmailWorkflowState(state: InsertEmailWorkflowState): Promise<EmailWorkflowState> {
    const existing = await this.getEmailWorkflowStateByEmailId(state.emailId);
    
    if (existing) {
      const [updated] = await db
        .update(emailWorkflowState)
        .set({
          ...state,
          updatedAt: new Date(),
        })
        .where(eq(emailWorkflowState.id, existing.id))
        .returning();
      return updated;
    } else {
      return await this.createEmailWorkflowState(state);
    }
  }

  async updateEmailWorkflowState(id: string, updates: Partial<InsertEmailWorkflowState>): Promise<EmailWorkflowState> {
    const [updated] = await db
      .update(emailWorkflowState)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(emailWorkflowState.id, id))
      .returning();
    return updated;
  }

  /**
   * Mark an email as complete in the workflow
   * Creates workflow state if it doesn't exist
   * Returns existing state if already complete (no-op for duplicate calls)
   */
  async completeEmail(emailId: string, userId: string, note?: string): Promise<EmailWorkflowState> {
    const existing = await this.getEmailWorkflowStateByEmailId(emailId);
    
    if (existing) {
      // If already complete, return existing state (no-op)
      if (existing.state === 'complete') {
        return existing;
      }
      
      const [updated] = await db
        .update(emailWorkflowState)
        .set({
          state: 'complete',
          completedAt: new Date(),
          completedBy: userId,
          completionNote: note || null,
          updatedAt: new Date(),
        })
        .where(eq(emailWorkflowState.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(emailWorkflowState)
        .values({
          emailId,
          state: 'complete',
          completedAt: new Date(),
          completedBy: userId,
          completionNote: note || null,
        })
        .returning();
      return created;
    }
  }

  /**
   * Uncomplete an email (reopen it)
   * Returns existing state if already pending (no-op for duplicate calls)
   */
  async uncompleteEmail(emailId: string): Promise<EmailWorkflowState | undefined> {
    const existing = await this.getEmailWorkflowStateByEmailId(emailId);
    
    if (existing) {
      // If already pending, return existing state (no-op)
      if (existing.state === 'pending') {
        return existing;
      }
      
      const [updated] = await db
        .update(emailWorkflowState)
        .set({
          state: 'pending',
          completedAt: null,
          completedBy: null,
          completionNote: null,
          updatedAt: new Date(),
        })
        .where(eq(emailWorkflowState.id, existing.id))
        .returning();
      return updated;
    }
    return undefined;
  }

  // ========== EMAIL CLASSIFICATION OVERRIDES ==========

  async createClassificationOverride(override: InsertEmailClassificationOverride): Promise<EmailClassificationOverride> {
    const [created] = await db
      .insert(emailClassificationOverrides)
      .values(override)
      .returning();
    return created;
  }

  async getClassificationOverridesByEmailId(emailId: string): Promise<EmailClassificationOverride[]> {
    return await db
      .select()
      .from(emailClassificationOverrides)
      .where(eq(emailClassificationOverrides.emailId, emailId))
      .orderBy(desc(emailClassificationOverrides.overrideAt));
  }

  // ========== UNCLASSIFIED EMAILS ==========

  async getUnclassifiedInboxEmails(inboxId?: string): Promise<InboxEmail[]> {
    const classifiedEmailIds = db
      .select({ emailId: emailClassifications.emailId })
      .from(emailClassifications);
    
    const conditions: any[] = [
      sql`${inboxEmails.id} NOT IN (${classifiedEmailIds})`
    ];
    
    if (inboxId) {
      conditions.push(eq(inboxEmails.inboxId, inboxId));
    }

    return await db
      .select()
      .from(inboxEmails)
      .where(and(...conditions))
      .orderBy(desc(inboxEmails.receivedAt));
  }

  // ========== WORKFLOW STATS FOR TOOLBAR ==========

  /**
   * Get workflow-based stats for the Comms Workspace toolbar
   * Returns counts for each slicing category based on classifications
   */
  async getWorkflowStats(inboxId?: string): Promise<{
    requiresTask: number;
    requiresReply: number;
    urgent: number;
    opportunities: number;
    informationOnly: number;
    allOutstanding: number;
  }> {
    const conditions: any[] = [];
    
    if (inboxId) {
      conditions.push(eq(inboxEmails.inboxId, inboxId));
    }

    // Join classifications with workflow state to get accurate counts
    const baseQuery = db
      .select({
        requiresTask: sql<number>`count(*) filter (where ${emailClassifications.requiresTask} = true and coalesce(${emailWorkflowState.taskRequirementMet}, false) = false and coalesce(${emailWorkflowState.state}, 'pending') != 'complete')`,
        requiresReply: sql<number>`count(*) filter (where ${emailClassifications.requiresReply} = true and coalesce(${emailWorkflowState.replySent}, false) = false and coalesce(${emailWorkflowState.state}, 'pending') != 'complete')`,
        urgent: sql<number>`count(*) filter (where ${emailClassifications.urgency} in ('critical', 'high') and coalesce(${emailWorkflowState.state}, 'pending') != 'complete')`,
        opportunities: sql<number>`count(*) filter (where ${emailClassifications.opportunity} in ('upsell', 'cross_sell', 'referral', 'expansion'))`,
        informationOnly: sql<number>`count(*) filter (where ${emailClassifications.informationOnly} = true and coalesce(${emailWorkflowState.state}, 'pending') != 'complete')`,
        allOutstanding: sql<number>`count(*) filter (where coalesce(${emailWorkflowState.state}, 'pending') != 'complete')`,
      })
      .from(emailClassifications)
      .innerJoin(inboxEmails, eq(emailClassifications.emailId, inboxEmails.id))
      .leftJoin(emailWorkflowState, eq(emailClassifications.emailId, emailWorkflowState.emailId));

    let result;
    if (conditions.length > 0) {
      result = await baseQuery.where(and(...conditions));
    } else {
      result = await baseQuery;
    }

    return {
      requiresTask: Number(result[0]?.requiresTask ?? 0),
      requiresReply: Number(result[0]?.requiresReply ?? 0),
      urgent: Number(result[0]?.urgent ?? 0),
      opportunities: Number(result[0]?.opportunities ?? 0),
      informationOnly: Number(result[0]?.informationOnly ?? 0),
      allOutstanding: Number(result[0]?.allOutstanding ?? 0),
    };
  }

  /**
   * Get emails filtered by workflow classification
   * Used by the Comms Workspace toolbar slicing
   */
  async getEmailsByWorkflowFilter(
    inboxId: string,
    filter: 'requires_task' | 'requires_reply' | 'urgent' | 'opportunities' | 'information_only' | 'all_outstanding',
    options: {
      limit?: number;
      offset?: number;
      sinceDays?: number;
    } = {}
  ): Promise<(InboxEmail & { classification?: any; workflowState?: any })[]> {
    const { limit = 50, offset = 0, sinceDays = 7 } = options;
    
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - sinceDays);

    const conditions: any[] = [
      eq(inboxEmails.inboxId, inboxId),
      gte(inboxEmails.receivedAt, sinceDate),
    ];

    // Add filter-specific conditions
    switch (filter) {
      case 'requires_task':
        conditions.push(eq(emailClassifications.requiresTask, true));
        conditions.push(or(
          isNull(emailWorkflowState.taskRequirementMet),
          eq(emailWorkflowState.taskRequirementMet, false)
        ));
        conditions.push(or(
          isNull(emailWorkflowState.state),
          sql`${emailWorkflowState.state} != 'complete'`
        ));
        break;
      case 'requires_reply':
        conditions.push(eq(emailClassifications.requiresReply, true));
        conditions.push(or(
          isNull(emailWorkflowState.replySent),
          eq(emailWorkflowState.replySent, false)
        ));
        conditions.push(or(
          isNull(emailWorkflowState.state),
          sql`${emailWorkflowState.state} != 'complete'`
        ));
        break;
      case 'urgent':
        conditions.push(sql`${emailClassifications.urgency} in ('critical', 'high')`);
        conditions.push(or(
          isNull(emailWorkflowState.state),
          sql`${emailWorkflowState.state} != 'complete'`
        ));
        break;
      case 'opportunities':
        conditions.push(sql`${emailClassifications.opportunity} in ('upsell', 'cross_sell', 'referral', 'expansion')`);
        break;
      case 'information_only':
        conditions.push(eq(emailClassifications.informationOnly, true));
        conditions.push(or(
          isNull(emailWorkflowState.state),
          sql`${emailWorkflowState.state} != 'complete'`
        ));
        break;
      case 'all_outstanding':
        conditions.push(or(
          isNull(emailWorkflowState.state),
          sql`${emailWorkflowState.state} != 'complete'`
        ));
        break;
    }

    const results = await db
      .select({
        email: inboxEmails,
        classification: emailClassifications,
        workflowState: emailWorkflowState,
      })
      .from(inboxEmails)
      .innerJoin(emailClassifications, eq(inboxEmails.id, emailClassifications.emailId))
      .leftJoin(emailWorkflowState, eq(inboxEmails.id, emailWorkflowState.emailId))
      .where(and(...conditions))
      .orderBy(desc(inboxEmails.receivedAt))
      .limit(limit)
      .offset(offset);

    return results.map(r => ({
      ...r.email,
      classification: r.classification,
      workflowState: r.workflowState,
    }));
  }
}
