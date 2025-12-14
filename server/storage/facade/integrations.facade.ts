import { IntegrationStorage, PushNotificationStorage, EmailStorage, SmsTemplateStorage } from '../integrations/index.js';

export interface IntegrationsFacadeDeps {
  integrationStorage: IntegrationStorage;
  pushNotificationStorage: PushNotificationStorage;
  emailStorage: EmailStorage;
  smsTemplateStorage: SmsTemplateStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyIntegrationsFacade<TBase extends Constructor<IntegrationsFacadeDeps>>(Base: TBase) {
  return class extends Base {
    // ============================================================================
    // USER INTEGRATIONS & OAUTH - IntegrationStorage (10 methods)
    // ============================================================================

    async getUserIntegrations(userId: string): Promise<any> {
      return this.integrationStorage.getUserIntegrations(userId) as any;
    }

    async getUserIntegrationByType(userId: string, integrationType: 'office365' | 'voodoo_sms' | 'ringcentral') {
      return this.integrationStorage.getUserIntegrationByType(userId, integrationType);
    }

    async getUserIntegration(userId: string, provider: string) {
      return this.integrationStorage.getUserIntegrationByType(userId, provider as any);
    }

    async createUserIntegration(integration: any) {
      return this.integrationStorage.createUserIntegration(integration);
    }

    async updateUserIntegration(id: string, updates: any) {
      return this.integrationStorage.updateUserIntegration(id, updates);
    }

    async deleteUserIntegration(id: string) {
      return this.integrationStorage.deleteUserIntegration(id);
    }

    async createUserOauthAccount(account: any) {
      return this.integrationStorage.createUserOauthAccount(account);
    }

    async getUserOauthAccount(userId: string, provider: string) {
      return this.integrationStorage.getUserOauthAccount(userId, provider);
    }

    async updateUserOauthAccount(id: string, account: any) {
      return this.integrationStorage.updateUserOauthAccount(id, account);
    }

    async deleteUserOauthAccount(userId: string, provider: string) {
      return this.integrationStorage.deleteUserOauthAccount(userId, provider);
    }

    // ============================================================================
    // PUSH NOTIFICATIONS - PushNotificationStorage (16 methods)
    // ============================================================================

    async createPushSubscription(subscription: any) {
      return this.pushNotificationStorage.createPushSubscription(subscription);
    }

    async getPushSubscriptionsByUserId(userId: string) {
      return this.pushNotificationStorage.getPushSubscriptionsByUserId(userId);
    }

    async getPushSubscriptionsByClientPortalUserId(clientPortalUserId: string) {
      return this.pushNotificationStorage.getPushSubscriptionsByClientPortalUserId(clientPortalUserId);
    }

    async deletePushSubscription(endpoint: string) {
      return this.pushNotificationStorage.deletePushSubscription(endpoint);
    }

    async deletePushSubscriptionByEndpoint(endpoint: string) {
      return this.pushNotificationStorage.deletePushSubscription(endpoint);
    }

    async deletePushSubscriptionsByUserId(userId: string) {
      return this.pushNotificationStorage.deletePushSubscriptionsByUserId(userId);
    }

    async getAllPushNotificationTemplates() {
      return this.pushNotificationStorage.getAllPushNotificationTemplates();
    }

    async getPushNotificationTemplateByType(templateType: string) {
      return this.pushNotificationStorage.getPushNotificationTemplateByType(templateType);
    }

    async getPushNotificationTemplateById(id: string) {
      return this.pushNotificationStorage.getPushNotificationTemplateById(id);
    }

    async updatePushNotificationTemplate(id: string, template: any) {
      return this.pushNotificationStorage.updatePushNotificationTemplate(id, template);
    }

    async createPushNotificationTemplate(template: any) {
      return this.pushNotificationStorage.createPushNotificationTemplate(template);
    }

    async deletePushNotificationTemplate(id: string) {
      return this.pushNotificationStorage.deletePushNotificationTemplate(id);
    }

    async getAllNotificationIcons() {
      return this.pushNotificationStorage.getAllNotificationIcons();
    }

    async getNotificationIconById(id: string) {
      return this.pushNotificationStorage.getNotificationIconById(id);
    }

    async createNotificationIcon(icon: any) {
      return this.pushNotificationStorage.createNotificationIcon(icon);
    }

    async deleteNotificationIcon(id: string) {
      return this.pushNotificationStorage.deleteNotificationIcon(id);
    }

    async updateNotificationIcon(id: string, icon: any) {
      return this.pushNotificationStorage.updateNotificationIcon(id, icon);
    }

    // ============================================================================
    // EMAIL OPERATIONS - EmailStorage (38 methods)
    // ============================================================================

    async createGraphWebhookSubscription(subscription: any) {
      return this.emailStorage.createGraphWebhookSubscription(subscription);
    }

    async getGraphWebhookSubscription(subscriptionId: string) {
      return this.emailStorage.getGraphWebhookSubscription(subscriptionId);
    }

    async updateGraphWebhookSubscription(subscriptionId: string, updates: any) {
      return this.emailStorage.updateGraphWebhookSubscription(subscriptionId, updates);
    }

    async getActiveGraphWebhookSubscriptions() {
      return this.emailStorage.getActiveGraphWebhookSubscriptions();
    }

    async getExpiringGraphWebhookSubscriptions(hoursUntilExpiry: number) {
      return this.emailStorage.getExpiringGraphWebhookSubscriptions(hoursUntilExpiry);
    }

    async getGraphSyncState(userId: string, folderPath: string) {
      return this.emailStorage.getGraphSyncState(userId, folderPath);
    }

    async upsertGraphSyncState(state: any) {
      return this.emailStorage.upsertGraphSyncState(state);
    }

    async upsertEmailMessage(message: any) {
      return this.emailStorage.upsertEmailMessage(message);
    }

    async createEmailMessage(message: any) {
      return this.emailStorage.createEmailMessage(message);
    }

    async getEmailMessageByInternetMessageId(internetMessageId: string) {
      return this.emailStorage.getEmailMessageByInternetMessageId(internetMessageId);
    }

    async getEmailMessagesByThreadId(threadId: string) {
      return this.emailStorage.getEmailMessagesByThreadId(threadId);
    }

    async updateEmailMessage(id: string, updates: any) {
      return this.emailStorage.updateEmailMessage(id, updates);
    }

    async createMailboxMessageMap(mapping: any) {
      return this.emailStorage.createMailboxMessageMap(mapping);
    }

    async createEmailThread(thread: any) {
      return this.emailStorage.createEmailThread(thread);
    }

    async updateEmailThread(canonicalConversationId: string, updates: any) {
      return this.emailStorage.updateEmailThread(canonicalConversationId, updates);
    }

    async getEmailThreadById(canonicalConversationId: string) {
      return this.emailStorage.getEmailThreadById(canonicalConversationId);
    }

    async getEmailThreadByConversationId(conversationId: string) {
      return this.emailStorage.getEmailThreadByConversationId(conversationId);
    }

    async getEmailThreadByThreadKey(threadKey: string) {
      return this.emailStorage.getEmailThreadByThreadKey(threadKey);
    }

    async createUnmatchedEmail(unmatchedEmail: any) {
      return this.emailStorage.createUnmatchedEmail(unmatchedEmail);
    }

    async updateUnmatchedEmail(id: string, updates: any) {
      return this.emailStorage.updateUnmatchedEmail(id, updates);
    }

    async getUnthreadedMessages() {
      return this.emailStorage.getUnthreadedMessages();
    }

    async getEmailMessageById(id: string) {
      return this.emailStorage.getEmailMessageById(id);
    }

    async getMailboxMessageMapsByUserId(userId: string) {
      return this.emailStorage.getMailboxMessageMapsByUserId(userId);
    }

    async getMailboxMessageMapByGraphId(userId: string, graphMessageId: string) {
      return this.emailStorage.getMailboxMessageMapByGraphId(userId, graphMessageId);
    }

    async deleteMailboxMessageMapsByUserId(userId: string) {
      return this.emailStorage.deleteMailboxMessageMapsByUserId(userId);
    }

    async getMailboxMessageMapsByMessageId(messageId: string) {
      return this.emailStorage.getMailboxMessageMapsByMessageId(messageId);
    }

    async userHasAccessToMessage(userId: string, internetMessageId: string) {
      return this.emailStorage.userHasAccessToMessage(userId, internetMessageId);
    }

    async getUserGraphMessageId(userId: string, internetMessageId: string) {
      return this.emailStorage.getUserGraphMessageId(userId, internetMessageId);
    }

    async getEmailThreadsByClientId(clientId: string) {
      return this.emailStorage.getEmailThreadsByClientId(clientId);
    }

    async getEmailThreadsByUserId(userId: string, myEmailsOnly: boolean) {
      return this.emailStorage.getEmailThreadsByUserId(userId, myEmailsOnly);
    }

    async getAllEmailThreads() {
      return this.emailStorage.getAllEmailThreads();
    }

    async getThreadsWithoutClient() {
      return this.emailStorage.getThreadsWithoutClient();
    }

    async getUnmatchedEmails(filters?: { resolvedOnly?: boolean }) {
      return this.emailStorage.getUnmatchedEmails(filters);
    }

    async getUnmatchedEmailByMessageId(internetMessageId: string) {
      return this.emailStorage.getUnmatchedEmailByMessageId(internetMessageId);
    }

    async deleteUnmatchedEmail(internetMessageId: string) {
      return this.emailStorage.deleteUnmatchedEmail(internetMessageId);
    }

    async resolveUnmatchedEmail(internetMessageId: string, clientId: string, resolvedBy: string) {
      return this.emailStorage.resolveUnmatchedEmail(internetMessageId, clientId, resolvedBy);
    }

    async createEmailAttachment(attachment: any) {
      return this.emailStorage.createEmailAttachment(attachment);
    }

    async getEmailAttachmentByHash(contentHash: string) {
      return this.emailStorage.getEmailAttachmentByHash(contentHash);
    }

    async getEmailAttachmentById(id: string) {
      return this.emailStorage.getEmailAttachmentById(id);
    }

    async createEmailMessageAttachment(mapping: any) {
      return this.emailStorage.createEmailMessageAttachment(mapping);
    }

    async getEmailMessageAttachmentByAttachmentId(attachmentId: string) {
      return this.emailStorage.getEmailMessageAttachmentByAttachmentId(attachmentId);
    }

    async getAttachmentsByMessageId(internetMessageId: string) {
      return this.emailStorage.getAttachmentsByMessageId(internetMessageId);
    }

    async checkEmailMessageAttachmentExists(internetMessageId: string, attachmentId: string) {
      return this.emailStorage.checkEmailMessageAttachmentExists(internetMessageId, attachmentId);
    }

    // ============================================================================
    // INBOX MANAGEMENT - EmailStorage (17 methods)
    // ============================================================================

    async createInbox(inbox: any) {
      return this.emailStorage.createInbox(inbox);
    }

    async getInboxById(id: string) {
      return this.emailStorage.getInboxById(id);
    }

    async getInboxByEmailAddress(emailAddress: string) {
      return this.emailStorage.getInboxByEmailAddress(emailAddress);
    }

    async getAllInboxes() {
      return this.emailStorage.getAllInboxes();
    }

    async getActiveInboxes() {
      return this.emailStorage.getActiveInboxes();
    }

    async getInboxesByType(inboxType: string) {
      return this.emailStorage.getInboxesByType(inboxType);
    }

    async getInboxByLinkedUserId(userId: string) {
      return this.emailStorage.getInboxByLinkedUserId(userId);
    }

    async updateInbox(id: string, updates: any) {
      return this.emailStorage.updateInbox(id, updates);
    }

    async deleteInbox(id: string) {
      return this.emailStorage.deleteInbox(id);
    }

    async upsertInboxForUser(userId: string, emailAddress: string, displayName?: string) {
      return this.emailStorage.upsertInboxForUser(userId, emailAddress, displayName);
    }

    async createUserInboxAccess(access: any) {
      return this.emailStorage.createUserInboxAccess(access);
    }

    async getUserInboxAccessById(id: string) {
      return this.emailStorage.getUserInboxAccessById(id);
    }

    async getUserInboxAccessByUserAndInbox(userId: string, inboxId: string) {
      return this.emailStorage.getUserInboxAccessByUserAndInbox(userId, inboxId);
    }

    async getInboxAccessByUserId(userId: string) {
      return this.emailStorage.getInboxAccessByUserId(userId);
    }

    async getInboxAccessByInboxId(inboxId: string) {
      return this.emailStorage.getInboxAccessByInboxId(inboxId);
    }

    async updateUserInboxAccess(id: string, updates: any) {
      return this.emailStorage.updateUserInboxAccess(id, updates);
    }

    async deleteUserInboxAccess(id: string) {
      return this.emailStorage.deleteUserInboxAccess(id);
    }

    async grantInboxAccess(userId: string, inboxId: string, accessLevel: string, grantedBy: string) {
      return this.emailStorage.grantInboxAccess(userId, inboxId, accessLevel, grantedBy);
    }

    async revokeInboxAccess(userId: string, inboxId: string) {
      return this.emailStorage.revokeInboxAccess(userId, inboxId);
    }

    async getUserAccessibleInboxes(userId: string) {
      return this.emailStorage.getUserAccessibleInboxes(userId);
    }

    async canUserAccessInbox(userId: string, inboxId: string) {
      return this.emailStorage.canUserAccessInbox(userId, inboxId);
    }

    async ensureUserHasOwnInboxAccess(userId: string, userEmail: string) {
      return this.emailStorage.ensureUserHasOwnInboxAccess(userId, userEmail);
    }

    // ============================================================================
    // INBOX EMAILS (SLA TRACKING) - EmailStorage (12 methods)
    // ============================================================================

    async createInboxEmail(email: any) {
      return this.emailStorage.createInboxEmail(email);
    }

    async getInboxEmailById(id: string) {
      return this.emailStorage.getInboxEmailById(id);
    }

    async getInboxEmailByMicrosoftId(inboxId: string, microsoftId: string) {
      return this.emailStorage.getInboxEmailByMicrosoftId(inboxId, microsoftId);
    }

    async getEmailsByInbox(inboxId: string, filters?: any) {
      return this.emailStorage.getEmailsByInbox(inboxId, filters);
    }

    async updateInboxEmail(id: string, updates: any) {
      return this.emailStorage.updateInboxEmail(id, updates);
    }

    async updateInboxEmailStatus(id: string, status: 'pending_reply' | 'replied' | 'no_action_needed' | 'overdue') {
      return this.emailStorage.updateInboxEmailStatus(id, status);
    }

    async markInboxEmailAsReplied(id: string) {
      return this.emailStorage.markInboxEmailAsReplied(id);
    }

    async getEmailsNeedingSlaCheck() {
      return this.emailStorage.getEmailsNeedingSlaCheck();
    }

    async markOverdueEmails() {
      return this.emailStorage.markOverdueEmails();
    }

    async markOldEmailsAsNoAction(inboxId: string, thresholdDate: Date) {
      return this.emailStorage.markOldEmailsAsNoAction(inboxId, thresholdDate);
    }

    async upsertInboxEmail(email: any) {
      return this.emailStorage.upsertInboxEmail(email);
    }

    async getInboxEmailsForClient(clientId: string) {
      return this.emailStorage.getInboxEmailsForClient(clientId);
    }

    async getInboxEmailStats(inboxId: string) {
      return this.emailStorage.getInboxEmailStats(inboxId);
    }

    async markConversationEmailsAsReplied(conversationId: string) {
      return this.emailStorage.markConversationEmailsAsReplied(conversationId);
    }

    async markEmailsAsRepliedByRecipient(recipientEmail: string) {
      return this.emailStorage.markEmailsAsRepliedByRecipient(recipientEmail);
    }

    async getEmailsByConversationId(conversationId: string) {
      return this.emailStorage.getEmailsByConversationId(conversationId);
    }

    // ============================================================================
    // EMAIL QUARANTINE - EmailStorage
    // ============================================================================

    async createEmailQuarantine(quarantine: any) {
      return this.emailStorage.createEmailQuarantine(quarantine);
    }

    async getEmailQuarantineById(id: string) {
      return this.emailStorage.getEmailQuarantineById(id);
    }

    async getQuarantineByMicrosoftId(inboxId: string, microsoftId: string) {
      return this.emailStorage.getQuarantineByMicrosoftId(inboxId, microsoftId);
    }

    async getQuarantinedEmails(filters?: any) {
      return this.emailStorage.getQuarantinedEmails(filters);
    }

    async restoreQuarantinedEmail(id: string, userId: string, clientId: string) {
      return this.emailStorage.restoreQuarantinedEmail(id, userId, clientId);
    }

    async deleteQuarantinedEmail(id: string) {
      return this.emailStorage.deleteQuarantinedEmail(id);
    }

    async getQuarantineStats(inboxId?: string) {
      return this.emailStorage.getQuarantineStats(inboxId);
    }

    // ============================================================================
    // EMAIL CLASSIFICATIONS - EmailStorage
    // ============================================================================

    async createEmailClassification(classification: any) {
      return this.emailStorage.createEmailClassification(classification);
    }

    async getEmailClassificationByEmailId(emailId: string) {
      return this.emailStorage.getEmailClassificationByEmailId(emailId);
    }

    async upsertEmailClassification(classification: any) {
      return this.emailStorage.upsertEmailClassification(classification);
    }

    async updateEmailClassification(id: string, updates: any) {
      return this.emailStorage.updateEmailClassification(id, updates);
    }

    // ============================================================================
    // EMAIL WORKFLOW STATE - EmailStorage
    // ============================================================================

    async createEmailWorkflowState(state: any) {
      return this.emailStorage.createEmailWorkflowState(state);
    }

    async getEmailWorkflowStateByEmailId(emailId: string) {
      return this.emailStorage.getEmailWorkflowStateByEmailId(emailId);
    }

    async upsertEmailWorkflowState(state: any) {
      return this.emailStorage.upsertEmailWorkflowState(state);
    }

    async updateEmailWorkflowState(id: string, updates: any) {
      return this.emailStorage.updateEmailWorkflowState(id, updates);
    }

    // ============================================================================
    // EMAIL CLASSIFICATION OVERRIDES - EmailStorage
    // ============================================================================

    async createClassificationOverride(override: any) {
      return this.emailStorage.createClassificationOverride(override);
    }

    async getClassificationOverridesByEmailId(emailId: string) {
      return this.emailStorage.getClassificationOverridesByEmailId(emailId);
    }

    async getUnclassifiedInboxEmails(inboxId?: string) {
      return this.emailStorage.getUnclassifiedInboxEmails(inboxId);
    }

    // ============================================================================
    // SMS TEMPLATES - SmsTemplateStorage (6 methods)
    // ============================================================================

    async getAllSmsTemplates() {
      return this.smsTemplateStorage.getAllSmsTemplates();
    }

    async getActiveSmsTemplates() {
      return this.smsTemplateStorage.getActiveSmsTemplates();
    }

    async getSmsTemplateById(id: string) {
      return this.smsTemplateStorage.getSmsTemplateById(id);
    }

    async createSmsTemplate(template: any) {
      return this.smsTemplateStorage.createSmsTemplate(template);
    }

    async updateSmsTemplate(id: string, template: any) {
      return this.smsTemplateStorage.updateSmsTemplate(id, template);
    }

    async deleteSmsTemplate(id: string) {
      return this.smsTemplateStorage.deleteSmsTemplate(id);
    }
  };
}
