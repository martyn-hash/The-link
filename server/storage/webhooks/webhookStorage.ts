import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { 
  webhookConfigs, 
  webhookLogs,
  users,
  clients
} from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import type { 
  WebhookConfig, 
  InsertWebhookConfig, 
  UpdateWebhookConfig,
  WebhookLog, 
  InsertWebhookLog,
  WebhookLogWithDetails
} from '@shared/schema';

export class WebhookStorage extends BaseStorage {
  async getAllWebhookConfigs(): Promise<WebhookConfig[]> {
    return await db.select().from(webhookConfigs).orderBy(webhookConfigs.name);
  }

  async getEnabledWebhookConfigs(): Promise<WebhookConfig[]> {
    return await db.select().from(webhookConfigs)
      .where(eq(webhookConfigs.isEnabled, true))
      .orderBy(webhookConfigs.name);
  }

  async getWebhookConfigById(id: string): Promise<WebhookConfig | undefined> {
    const [config] = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, id));
    return config;
  }

  async createWebhookConfig(config: InsertWebhookConfig): Promise<WebhookConfig> {
    const [created] = await db.insert(webhookConfigs).values(config).returning();
    return created;
  }

  async updateWebhookConfig(id: string, config: UpdateWebhookConfig): Promise<WebhookConfig> {
    const [updated] = await db.update(webhookConfigs)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(webhookConfigs.id, id))
      .returning();
    if (!updated) {
      throw new Error('Webhook config not found');
    }
    return updated;
  }

  async deleteWebhookConfig(id: string): Promise<void> {
    await db.delete(webhookConfigs).where(eq(webhookConfigs.id, id));
  }

  async createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog> {
    const [created] = await db.insert(webhookLogs).values(log).returning();
    return created;
  }

  async updateWebhookLogStatus(
    id: string, 
    status: 'pending' | 'success' | 'failed',
    responseCode?: string,
    responseBody?: string,
    errorMessage?: string
  ): Promise<WebhookLog> {
    const [updated] = await db.update(webhookLogs)
      .set({ 
        status, 
        responseCode, 
        responseBody, 
        errorMessage 
      })
      .where(eq(webhookLogs.id, id))
      .returning();
    if (!updated) {
      throw new Error('Webhook log not found');
    }
    return updated;
  }

  async getWebhookLogsByClientId(clientId: string, limit = 50): Promise<WebhookLogWithDetails[]> {
    const logs = await db
      .select({
        id: webhookLogs.id,
        webhookConfigId: webhookLogs.webhookConfigId,
        clientId: webhookLogs.clientId,
        triggeredBy: webhookLogs.triggeredBy,
        payload: webhookLogs.payload,
        status: webhookLogs.status,
        responseCode: webhookLogs.responseCode,
        responseBody: webhookLogs.responseBody,
        errorMessage: webhookLogs.errorMessage,
        sentAt: webhookLogs.sentAt,
        webhookName: webhookConfigs.name,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(webhookLogs)
      .leftJoin(webhookConfigs, eq(webhookLogs.webhookConfigId, webhookConfigs.id))
      .leftJoin(users, eq(webhookLogs.triggeredBy, users.id))
      .where(eq(webhookLogs.clientId, clientId))
      .orderBy(desc(webhookLogs.sentAt))
      .limit(limit);

    return logs.map(log => ({
      ...log,
      webhookName: log.webhookName || 'Unknown Webhook',
      triggeredByName: [log.userFirstName, log.userLastName].filter(Boolean).join(' ') || 'Unknown User',
    }));
  }

  async getWebhookLogsByWebhookId(webhookConfigId: string, limit = 50): Promise<WebhookLogWithDetails[]> {
    const logs = await db
      .select({
        id: webhookLogs.id,
        webhookConfigId: webhookLogs.webhookConfigId,
        clientId: webhookLogs.clientId,
        triggeredBy: webhookLogs.triggeredBy,
        payload: webhookLogs.payload,
        status: webhookLogs.status,
        responseCode: webhookLogs.responseCode,
        responseBody: webhookLogs.responseBody,
        errorMessage: webhookLogs.errorMessage,
        sentAt: webhookLogs.sentAt,
        webhookName: webhookConfigs.name,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        clientName: clients.name,
      })
      .from(webhookLogs)
      .leftJoin(webhookConfigs, eq(webhookLogs.webhookConfigId, webhookConfigs.id))
      .leftJoin(users, eq(webhookLogs.triggeredBy, users.id))
      .leftJoin(clients, eq(webhookLogs.clientId, clients.id))
      .where(eq(webhookLogs.webhookConfigId, webhookConfigId))
      .orderBy(desc(webhookLogs.sentAt))
      .limit(limit);

    return logs.map(log => ({
      ...log,
      webhookName: log.webhookName || 'Unknown Webhook',
      triggeredByName: [log.userFirstName, log.userLastName].filter(Boolean).join(' ') || 'Unknown User',
    }));
  }

  async getRecentWebhookLogs(limit = 100): Promise<WebhookLogWithDetails[]> {
    const logs = await db
      .select({
        id: webhookLogs.id,
        webhookConfigId: webhookLogs.webhookConfigId,
        clientId: webhookLogs.clientId,
        triggeredBy: webhookLogs.triggeredBy,
        payload: webhookLogs.payload,
        status: webhookLogs.status,
        responseCode: webhookLogs.responseCode,
        responseBody: webhookLogs.responseBody,
        errorMessage: webhookLogs.errorMessage,
        sentAt: webhookLogs.sentAt,
        webhookName: webhookConfigs.name,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        clientName: clients.name,
      })
      .from(webhookLogs)
      .leftJoin(webhookConfigs, eq(webhookLogs.webhookConfigId, webhookConfigs.id))
      .leftJoin(users, eq(webhookLogs.triggeredBy, users.id))
      .leftJoin(clients, eq(webhookLogs.clientId, clients.id))
      .orderBy(desc(webhookLogs.sentAt))
      .limit(limit);

    return logs.map(log => ({
      ...log,
      webhookName: log.webhookName || 'Unknown Webhook',
      triggeredByName: [log.userFirstName, log.userLastName].filter(Boolean).join(' ') || 'Unknown User',
    }));
  }
}
