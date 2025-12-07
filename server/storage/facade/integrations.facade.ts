import { IntegrationStorage, PushNotificationStorage, EmailStorage } from '../integrations/index.js';

export interface IntegrationsFacadeDeps {
  integrationStorage: IntegrationStorage;
  pushNotificationStorage: PushNotificationStorage;
  emailStorage: EmailStorage;
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
  };
}
