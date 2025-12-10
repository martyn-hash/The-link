import { WebhookStorage } from '../webhooks/index.js';
import { QboStorage, QcStorage } from '../qbo/index.js';
import { QueryStorage, QueryTokenStorage, ScheduledReminderStorage } from '../queries/index.js';

export interface MiscFacadeDeps {
  webhookStorage: WebhookStorage;
  qboStorage: QboStorage;
  qcStorage: QcStorage;
  queryStorage: QueryStorage;
  queryTokenStorage: QueryTokenStorage;
  scheduledReminderStorage: ScheduledReminderStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyMiscFacade<TBase extends Constructor<MiscFacadeDeps>>(Base: TBase) {
  return class extends Base {
    // ============================================================================
    // WEBHOOKS OPERATIONS - WebhookStorage (12 methods)
    // ============================================================================

    async getAllWebhookConfigs() {
      return this.webhookStorage.getAllWebhookConfigs();
    }

    async getEnabledWebhookConfigs() {
      return this.webhookStorage.getEnabledWebhookConfigs();
    }

    async getWebhookConfigById(id: string) {
      return this.webhookStorage.getWebhookConfigById(id);
    }

    async createWebhookConfig(config: any) {
      return this.webhookStorage.createWebhookConfig(config);
    }

    async updateWebhookConfig(id: string, config: any) {
      return this.webhookStorage.updateWebhookConfig(id, config);
    }

    async deleteWebhookConfig(id: string) {
      return this.webhookStorage.deleteWebhookConfig(id);
    }

    async createWebhookLog(log: any) {
      return this.webhookStorage.createWebhookLog(log);
    }

    async updateWebhookLogStatus(
      id: string,
      status: 'pending' | 'success' | 'failed',
      responseCode?: string,
      responseBody?: string,
      errorMessage?: string
    ) {
      return this.webhookStorage.updateWebhookLogStatus(id, status, responseCode, responseBody, errorMessage);
    }

    async getWebhookLogsByClientId(clientId: string, limit?: number) {
      return this.webhookStorage.getWebhookLogsByClientId(clientId, limit);
    }

    async getWebhookLogsByWebhookId(webhookConfigId: string, limit?: number) {
      return this.webhookStorage.getWebhookLogsByWebhookId(webhookConfigId, limit);
    }

    async getRecentWebhookLogs(limit?: number) {
      return this.webhookStorage.getRecentWebhookLogs(limit);
    }

    async hasSuccessfulWebhookForClient(clientId: string, webhookConfigId: string) {
      return this.webhookStorage.hasSuccessfulWebhookForClient(clientId, webhookConfigId);
    }

    // ============================================================================
    // QBO CONNECTION OPERATIONS - QboStorage (17 methods)
    // ============================================================================

    async createQboConnection(data: any) {
      return this.qboStorage.createQboConnection(data);
    }

    async getQboConnectionById(id: string) {
      return this.qboStorage.getQboConnectionById(id);
    }

    async getQboConnectionByClientId(clientId: string) {
      return this.qboStorage.getQboConnectionByClientId(clientId);
    }

    async getQboConnectionByRealmId(realmId: string) {
      return this.qboStorage.getQboConnectionByRealmId(realmId);
    }

    async getAllQboConnections() {
      return this.qboStorage.getAllQboConnections();
    }

    async getActiveQboConnections() {
      return this.qboStorage.getActiveQboConnections();
    }

    async updateQboConnection(id: string, data: any) {
      return this.qboStorage.updateQboConnection(id, data);
    }

    async deactivateQboConnection(id: string) {
      return this.qboStorage.deactivateQboConnection(id);
    }

    async deleteQboConnection(id: string) {
      return this.qboStorage.deleteQboConnection(id);
    }

    async updateQboConnectionTokens(
      id: string,
      accessTokenEncrypted: string,
      refreshTokenEncrypted: string,
      accessTokenExpiresAt: Date,
      refreshTokenExpiresAt: Date
    ) {
      return this.qboStorage.updateQboConnectionTokens(id, accessTokenEncrypted, refreshTokenEncrypted, accessTokenExpiresAt, refreshTokenExpiresAt);
    }

    async updateQboConnectionError(id: string, errorMessage: string) {
      return this.qboStorage.updateQboConnectionError(id, errorMessage);
    }

    async updateQboConnectionLastSync(id: string) {
      return this.qboStorage.updateQboConnectionLastSync(id);
    }

    async createQboOAuthState(data: any) {
      return this.qboStorage.createQboOAuthState(data);
    }

    async getQboOAuthStateByState(state: string) {
      return this.qboStorage.getQboOAuthStateByState(state);
    }

    async markQboOAuthStateAsUsed(id: string) {
      return this.qboStorage.markQboOAuthStateAsUsed(id);
    }

    async cleanupExpiredQboOAuthStates() {
      return this.qboStorage.cleanupExpiredQboOAuthStates();
    }

    async getQboConnectionsWithClients() {
      return this.qboStorage.getQboConnectionsWithClients();
    }

    // ============================================================================
    // QC RUN/RESULT OPERATIONS - QcStorage (22 methods)
    // ============================================================================

    async createQcRun(data: any) {
      return this.qcStorage.createQcRun(data);
    }

    async getQcRunById(id: string) {
      return this.qcStorage.getQcRunById(id);
    }

    async updateQcRun(id: string, data: any) {
      return this.qcStorage.updateQcRun(id, data);
    }

    async getQcRunsByClientId(clientId: string, limit?: number) {
      return this.qcStorage.getQcRunsByClientId(clientId, limit);
    }

    async getLatestQcRunByClientId(clientId: string) {
      return this.qcStorage.getLatestQcRunByClientId(clientId);
    }

    async getQcRunWithDetails(runId: string) {
      return this.qcStorage.getQcRunWithDetails(runId);
    }

    async createQcResult(data: any) {
      return this.qcStorage.createQcResult(data);
    }

    async createQcResults(data: any[]) {
      return this.qcStorage.createQcResults(data);
    }

    async getQcResultsByRunId(runId: string) {
      return this.qcStorage.getQcResultsByRunId(runId);
    }

    async createQcResultItem(data: any) {
      return this.qcStorage.createQcResultItem(data);
    }

    async createQcResultItems(data: any[]) {
      return this.qcStorage.createQcResultItems(data);
    }

    async getQcResultItemsByResultId(resultId: string) {
      return this.qcStorage.getQcResultItemsByResultId(resultId);
    }

    async updateQcResultItem(id: string, data: any) {
      return this.qcStorage.updateQcResultItem(id, data);
    }

    async getQcResultItemById(id: string) {
      return this.qcStorage.getQcResultItemById(id);
    }

    async approveQcResultItem(itemId: string, userId: string, note: string | null) {
      return this.qcStorage.approveQcResultItem(itemId, userId, note);
    }

    async escalateQcResultItem(itemId: string, userId: string, note: string | null) {
      return this.qcStorage.escalateQcResultItem(itemId, userId, note);
    }

    async resolveQcResultItem(itemId: string, userId: string, note: string | null) {
      return this.qcStorage.resolveQcResultItem(itemId, userId, note);
    }

    async createApprovalHistory(data: any) {
      return this.qcStorage.createApprovalHistory(data);
    }

    async getApprovalHistoryByItemId(itemId: string) {
      return this.qcStorage.getApprovalHistoryByItemId(itemId);
    }

    async getPendingApprovalsByClientId(clientId: string) {
      return this.qcStorage.getPendingApprovalsByClientId(clientId);
    }

    async getQcRunSummary(runId: string) {
      return this.qcStorage.getQcRunSummary(runId);
    }

    async getLatestQcRunSummary(clientId: string) {
      return this.qcStorage.getLatestQcRunSummary(clientId);
    }

    // ============================================================================
    // QUERY OPERATIONS - QueryStorage (15 methods)
    // ============================================================================

    async createQuery(query: any) {
      return this.queryStorage.createQuery(query);
    }

    async createQueries(queries: any[]) {
      return this.queryStorage.createQueries(queries);
    }

    async getQueryById(id: string) {
      return this.queryStorage.getQueryById(id);
    }

    async getQueriesByProjectId(projectId: string) {
      return this.queryStorage.getQueriesByProjectId(projectId);
    }

    async getQueryCountByProjectId(projectId: string) {
      return this.queryStorage.getQueryCountByProjectId(projectId);
    }

    async getOpenQueryCountByProjectId(projectId: string) {
      return this.queryStorage.getOpenQueryCountByProjectId(projectId);
    }

    async getOpenQueryCountsBatch(projectIds: string[]) {
      return this.queryStorage.getOpenQueryCountsBatch(projectIds);
    }

    async updateQuery(id: string, query: any, userId?: string) {
      return this.queryStorage.updateQuery(id, query, userId);
    }

    async deleteQuery(id: string) {
      return this.queryStorage.deleteQuery(id);
    }

    async deleteQueriesByProjectId(projectId: string) {
      return this.queryStorage.deleteQueriesByProjectId(projectId);
    }

    async bulkUpdateQueryStatus(ids: string[], status: any, updatedById: string) {
      return this.queryStorage.bulkUpdateQueryStatus(ids, status, updatedById);
    }

    async markQueriesAsSentToClient(ids: string[]) {
      return this.queryStorage.markQueriesAsSentToClient(ids);
    }

    async getQueriesByStatus(projectId: string, status: any) {
      return this.queryStorage.getQueriesByStatus(projectId, status);
    }

    async getQueryStatsByProjectId(projectId: string) {
      return this.queryStorage.getQueryStatsByProjectId(projectId);
    }

    // ============================================================================
    // QUERY GROUP OPERATIONS - QueryStorage (8 methods)
    // ============================================================================

    async createQueryGroup(data: { projectId: string; groupName: string; description?: string; createdById: string }) {
      return this.queryStorage.createQueryGroup(data);
    }

    async getQueryGroupById(id: string) {
      return this.queryStorage.getQueryGroupById(id);
    }

    async getQueryGroupsByProjectId(projectId: string) {
      return this.queryStorage.getQueryGroupsByProjectId(projectId);
    }

    async updateQueryGroup(id: string, data: { groupName?: string; description?: string }) {
      return this.queryStorage.updateQueryGroup(id, data);
    }

    async deleteQueryGroup(id: string) {
      return this.queryStorage.deleteQueryGroup(id);
    }

    async assignQueriesToGroup(queryIds: string[], groupId: string) {
      return this.queryStorage.assignQueriesToGroup(queryIds, groupId);
    }

    async removeQueriesFromGroup(queryIds: string[]) {
      return this.queryStorage.removeQueriesFromGroup(queryIds);
    }

    async getQueriesWithGroups(projectId: string) {
      return this.queryStorage.getQueriesWithGroups(projectId);
    }

    // ============================================================================
    // QUERY TOKEN OPERATIONS - QueryTokenStorage (12 methods)
    // ============================================================================

    async createQueryResponseToken(data: any) {
      return this.queryTokenStorage.createToken(data);
    }

    async getQueryResponseTokenByValue(token: string) {
      return this.queryTokenStorage.getTokenByValue(token);
    }

    async getQueryResponseTokenById(id: string) {
      return this.queryTokenStorage.getTokenById(id);
    }

    async getQueryResponseTokensByProjectId(projectId: string) {
      return this.queryTokenStorage.getTokensByProjectId(projectId);
    }

    async markQueryTokenAccessed(tokenId: string) {
      return this.queryTokenStorage.markTokenAccessed(tokenId);
    }

    async markQueryTokenCompleted(tokenId: string) {
      return this.queryTokenStorage.markTokenCompleted(tokenId);
    }

    async updateQueryResponseToken(tokenId: string, updates: { recipientEmail?: string; recipientName?: string | null }) {
      return this.queryTokenStorage.updateToken(tokenId, updates);
    }

    async validateQueryResponseToken(token: string) {
      return this.queryTokenStorage.validateToken(token);
    }

    async getQueriesForToken(token: string) {
      return this.queryTokenStorage.getQueriesForToken(token);
    }

    async cleanupExpiredQueryTokens() {
      return this.queryTokenStorage.cleanupExpiredTokens();
    }

    async extendQueryResponseTokenExpiry(tokenId: string, additionalDays: number) {
      return this.queryTokenStorage.extendTokenExpiry(tokenId, additionalDays);
    }

    async getActiveQueryResponseTokensByProjectId(projectId: string) {
      return this.queryTokenStorage.getActiveTokensByProjectId(projectId);
    }

    // ============================================================================
    // SCHEDULED QUERY REMINDERS OPERATIONS - ScheduledReminderStorage (13 methods)
    // ============================================================================

    async createScheduledQueryReminder(data: any) {
      return this.scheduledReminderStorage.create(data);
    }

    async createScheduledQueryReminders(data: any[]) {
      return this.scheduledReminderStorage.createMany(data);
    }

    async getScheduledQueryReminderById(id: string) {
      return this.scheduledReminderStorage.getById(id);
    }

    async getScheduledQueryRemindersByTokenId(tokenId: string) {
      return this.scheduledReminderStorage.getByTokenId(tokenId);
    }

    async getScheduledQueryRemindersByProjectId(projectId: string) {
      return this.scheduledReminderStorage.getByProjectId(projectId);
    }

    async getDueQueryReminders() {
      return this.scheduledReminderStorage.getDueReminders();
    }

    async updateScheduledQueryReminderStatus(id: string, status: any, extras?: any) {
      return this.scheduledReminderStorage.updateStatus(id, status, extras);
    }

    async cancelScheduledQueryReminder(id: string, cancelledById: string) {
      return this.scheduledReminderStorage.cancel(id, cancelledById);
    }

    async cancelAllQueryRemindersForToken(tokenId: string, cancelledById: string) {
      return this.scheduledReminderStorage.cancelAllForToken(tokenId, cancelledById);
    }

    async skipRemainingQueryRemindersForToken(tokenId: string, reason?: string) {
      return this.scheduledReminderStorage.skipRemainingForToken(tokenId, reason);
    }

    async getPendingQueryReminderCountForToken(tokenId: string) {
      return this.scheduledReminderStorage.getPendingCountForToken(tokenId);
    }

    async deleteScheduledQueryReminder(id: string) {
      return this.scheduledReminderStorage.delete(id);
    }

    async deleteAllQueryRemindersForToken(tokenId: string) {
      return this.scheduledReminderStorage.deleteAllForToken(tokenId);
    }
  };
}
