import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { campaignRecipients, campaigns } from '@shared/schema';
import { eq, and, desc, asc, sql, inArray, isNull, not } from 'drizzle-orm';
import type { CampaignRecipient, InsertCampaignRecipient, UpdateCampaignRecipient } from '@shared/schema';

export class CampaignRecipientStorage extends BaseStorage {
  async create(data: InsertCampaignRecipient): Promise<CampaignRecipient> {
    const [recipient] = await db.insert(campaignRecipients).values(data).returning();
    return recipient;
  }

  async bulkCreate(campaignId: string, recipients: Omit<InsertCampaignRecipient, 'campaignId'>[]): Promise<CampaignRecipient[]> {
    if (recipients.length === 0) return [];
    
    const dataToInsert = recipients.map(r => ({
      ...r,
      campaignId,
    }));
    
    return db.insert(campaignRecipients).values(dataToInsert).returning();
  }

  async getById(id: string): Promise<CampaignRecipient | undefined> {
    const [recipient] = await db.select().from(campaignRecipients).where(eq(campaignRecipients.id, id));
    return recipient;
  }

  async getByCampaignId(campaignId: string, options?: {
    status?: string | string[];
    channel?: string;
    limit?: number;
    offset?: number;
  }): Promise<CampaignRecipient[]> {
    let query = db.select().from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaignId));
    
    const conditions = [eq(campaignRecipients.campaignId, campaignId)];
    
    if (options?.status) {
      if (Array.isArray(options.status)) {
        conditions.push(inArray(campaignRecipients.status, options.status as any[]));
      } else {
        conditions.push(eq(campaignRecipients.status, options.status as any));
      }
    }
    if (options?.channel) {
      conditions.push(eq(campaignRecipients.channel, options.channel as any));
    }

    if (conditions.length > 1) {
      query = db.select().from(campaignRecipients).where(and(...conditions));
    }

    query = query.orderBy(desc(campaignRecipients.createdAt)) as typeof query;
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return query;
  }

  async update(id: string, data: UpdateCampaignRecipient): Promise<CampaignRecipient> {
    const [recipient] = await db
      .update(campaignRecipients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaignRecipients.id, id))
      .returning();
    
    if (!recipient) {
      throw new Error(`Campaign recipient with ID '${id}' not found`);
    }
    
    return recipient;
  }

  async delete(id: string): Promise<void> {
    await db.delete(campaignRecipients).where(eq(campaignRecipients.id, id));
  }

  async countByCampaignId(campaignId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaignId));
    
    return result[0]?.count ?? 0;
  }

  async countOptedOut(campaignId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignRecipients)
      .where(and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.status, 'opted_out')
      ));
    
    return result[0]?.count ?? 0;
  }

  async getSample(campaignId: string, count: number = 3): Promise<CampaignRecipient[]> {
    return db.select().from(campaignRecipients)
      .where(and(
        eq(campaignRecipients.campaignId, campaignId),
        not(eq(campaignRecipients.manuallyRemoved, true))
      ))
      .limit(count);
  }

  async getPendingForDelivery(campaignId: string): Promise<CampaignRecipient[]> {
    return db.select().from(campaignRecipients)
      .where(and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.status, 'pending'),
        not(eq(campaignRecipients.manuallyRemoved, true))
      ));
  }

  async getRecentByCategory(campaignId: string, category: string, days: number = 7): Promise<CampaignRecipient[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return db.select().from(campaignRecipients)
      .where(and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.lastCampaignCategory, category),
        sql`${campaignRecipients.lastCampaignReceivedAt} >= ${cutoffDate}`
      ));
  }

  async countByStatus(campaignId: string): Promise<Record<string, number>> {
    const results = await db
      .select({
        status: campaignRecipients.status,
        count: sql<number>`count(*)::int`
      })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaignId))
      .groupBy(campaignRecipients.status);
    
    return results.reduce((acc, { status, count }) => {
      if (status) acc[status] = count;
      return acc;
    }, {} as Record<string, number>);
  }

  async getByPersonId(personId: string, limit?: number): Promise<CampaignRecipient[]> {
    let query = db.select().from(campaignRecipients)
      .where(eq(campaignRecipients.personId, personId))
      .orderBy(desc(campaignRecipients.createdAt));
    
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    
    return query;
  }

  async getByClientId(clientId: string, limit?: number): Promise<CampaignRecipient[]> {
    let query = db.select().from(campaignRecipients)
      .where(eq(campaignRecipients.clientId, clientId))
      .orderBy(desc(campaignRecipients.createdAt));
    
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    
    return query;
  }

  async findByMessageId(externalMessageId: string): Promise<CampaignRecipient | undefined> {
    const [recipient] = await db.select().from(campaignRecipients)
      .where(eq(campaignRecipients.externalMessageId, externalMessageId));
    return recipient;
  }

  async getLastForPersonChannel(personId: string, channel: string): Promise<{ sentAt: Date | null; category: string | null } | undefined> {
    const [recipient] = await db
      .select({
        sentAt: campaignRecipients.sentAt,
        category: campaignRecipients.lastCampaignCategory,
      })
      .from(campaignRecipients)
      .where(and(
        eq(campaignRecipients.personId, personId),
        eq(campaignRecipients.channel, channel as any)
      ))
      .orderBy(desc(campaignRecipients.sentAt))
      .limit(1);
    
    return recipient;
  }
}

export const campaignRecipientStorage = new CampaignRecipientStorage();
