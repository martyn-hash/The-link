import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { campaigns, campaignTemplates } from '@shared/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import type { Campaign, InsertCampaign, UpdateCampaign } from '@shared/schema';

export class CampaignStorage extends BaseStorage {
  async create(data: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db.insert(campaigns).values(data).returning();
    return campaign;
  }

  async getById(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async getAll(options?: {
    status?: string | string[];
    category?: string;
    createdByUserId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Campaign[]> {
    let query = db.select().from(campaigns);
    
    const conditions = [];
    if (options?.status) {
      if (Array.isArray(options.status)) {
        conditions.push(inArray(campaigns.status, options.status as any[]));
      } else {
        conditions.push(eq(campaigns.status, options.status as any));
      }
    }
    if (options?.category) {
      conditions.push(eq(campaigns.category, options.category as any));
    }
    if (options?.createdByUserId) {
      conditions.push(eq(campaigns.createdByUserId, options.createdByUserId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    query = query.orderBy(desc(campaigns.createdAt)) as typeof query;
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return query;
  }

  async update(id: string, data: UpdateCampaign): Promise<Campaign> {
    const [campaign] = await db
      .update(campaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    
    if (!campaign) {
      throw new Error(`Campaign with ID '${id}' not found`);
    }
    
    return campaign;
  }

  async delete(id: string): Promise<void> {
    const result = await db.delete(campaigns).where(eq(campaigns.id, id));
    if (!result) {
      throw new Error(`Campaign with ID '${id}' not found`);
    }
  }

  async getByStatus(status: string | string[]): Promise<Campaign[]> {
    if (Array.isArray(status)) {
      return db.select().from(campaigns)
        .where(inArray(campaigns.status, status as any[]))
        .orderBy(desc(campaigns.createdAt));
    }
    return db.select().from(campaigns)
      .where(eq(campaigns.status, status as any))
      .orderBy(desc(campaigns.createdAt));
  }

  async getScheduledCampaigns(beforeTime?: Date): Promise<Campaign[]> {
    if (beforeTime) {
      return db.select().from(campaigns)
        .where(and(
          eq(campaigns.status, 'scheduled'),
          sql`${campaigns.scheduledFor} <= ${beforeTime}`
        ))
        .orderBy(asc(campaigns.scheduledFor));
    }
    
    return db.select().from(campaigns)
      .where(eq(campaigns.status, 'scheduled'))
      .orderBy(asc(campaigns.scheduledFor));
  }

  async getSequenceSteps(parentCampaignId: string): Promise<Campaign[]> {
    return db.select().from(campaigns)
      .where(eq(campaigns.parentCampaignId, parentCampaignId))
      .orderBy(asc(campaigns.sequenceOrder));
  }

  async getActiveSequences(): Promise<Campaign[]> {
    return db.select().from(campaigns)
      .where(and(
        eq(campaigns.isSequence, true),
        inArray(campaigns.status, ['approved', 'sending', 'scheduled'])
      ))
      .orderBy(desc(campaigns.createdAt));
  }

  async countByStatus(): Promise<Record<string, number>> {
    const results = await db
      .select({
        status: campaigns.status,
        count: sql<number>`count(*)::int`
      })
      .from(campaigns)
      .groupBy(campaigns.status);
    
    return results.reduce((acc, { status, count }) => {
      if (status) acc[status] = count;
      return acc;
    }, {} as Record<string, number>);
  }

  async getSentBefore(date: Date): Promise<Campaign[]> {
    return db.select().from(campaigns)
      .where(and(
        eq(campaigns.status, 'sent'),
        sql`${campaigns.sentAt} < ${date}`
      ))
      .orderBy(desc(campaigns.sentAt));
  }
}

export const campaignStorage = new CampaignStorage();
