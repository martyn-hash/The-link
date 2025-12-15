import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { campaignDeliveryQueue } from '@shared/schema';
import { eq, and, lte, asc, desc, sql } from 'drizzle-orm';
import type { CampaignDeliveryQueue, InsertCampaignDeliveryQueue, UpdateCampaignDeliveryQueue } from '@shared/schema';

export class CampaignDeliveryStorage extends BaseStorage {
  async create(data: InsertCampaignDeliveryQueue): Promise<CampaignDeliveryQueue> {
    const [item] = await db.insert(campaignDeliveryQueue).values(data).returning();
    return item;
  }

  async bulkCreate(items: InsertCampaignDeliveryQueue[]): Promise<CampaignDeliveryQueue[]> {
    if (items.length === 0) return [];
    return db.insert(campaignDeliveryQueue).values(items).returning();
  }

  async getById(id: string): Promise<CampaignDeliveryQueue | undefined> {
    const [item] = await db.select().from(campaignDeliveryQueue).where(eq(campaignDeliveryQueue.id, id));
    return item;
  }

  async getByRecipientId(recipientId: string): Promise<CampaignDeliveryQueue | undefined> {
    const [item] = await db.select().from(campaignDeliveryQueue)
      .where(eq(campaignDeliveryQueue.recipientId, recipientId));
    return item;
  }

  async update(id: string, data: UpdateCampaignDeliveryQueue): Promise<CampaignDeliveryQueue> {
    const [item] = await db
      .update(campaignDeliveryQueue)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaignDeliveryQueue.id, id))
      .returning();
    
    if (!item) {
      throw new Error(`Delivery queue item with ID '${id}' not found`);
    }
    
    return item;
  }

  async delete(id: string): Promise<void> {
    await db.delete(campaignDeliveryQueue).where(eq(campaignDeliveryQueue.id, id));
  }

  async getPendingItems(limit: number = 100): Promise<CampaignDeliveryQueue[]> {
    const now = new Date();
    return db.select().from(campaignDeliveryQueue)
      .where(and(
        eq(campaignDeliveryQueue.status, 'pending'),
        lte(campaignDeliveryQueue.nextAttemptAt, now)
      ))
      .orderBy(asc(campaignDeliveryQueue.priority), asc(campaignDeliveryQueue.nextAttemptAt))
      .limit(limit);
  }

  async getProcessingItems(): Promise<CampaignDeliveryQueue[]> {
    return db.select().from(campaignDeliveryQueue)
      .where(eq(campaignDeliveryQueue.status, 'processing'))
      .orderBy(desc(campaignDeliveryQueue.updatedAt));
  }

  async countByStatus(): Promise<Record<string, number>> {
    const results = await db
      .select({
        status: campaignDeliveryQueue.status,
        count: sql<number>`count(*)::int`
      })
      .from(campaignDeliveryQueue)
      .groupBy(campaignDeliveryQueue.status);
    
    return results.reduce((acc, { status, count }) => {
      if (status) acc[status] = count;
      return acc;
    }, {} as Record<string, number>);
  }

  async markAsProcessing(id: string): Promise<CampaignDeliveryQueue> {
    return this.update(id, { status: 'processing' });
  }

  async markAsCompleted(id: string): Promise<CampaignDeliveryQueue> {
    return this.update(id, { status: 'completed' });
  }

  async markAsFailed(id: string, error: string, scheduleRetry: boolean = false): Promise<CampaignDeliveryQueue> {
    const item = await this.getById(id);
    if (!item) {
      throw new Error(`Delivery queue item with ID '${id}' not found`);
    }

    const newAttemptCount = (item.attemptCount ?? 0) + 1;
    
    if (scheduleRetry && newAttemptCount < (item.maxAttempts ?? 3)) {
      const delays = [60, 300, 900];
      const delaySeconds = delays[newAttemptCount - 1] || 900;
      const nextAttempt = new Date(Date.now() + delaySeconds * 1000);
      
      return this.update(id, {
        status: 'pending',
        attemptCount: newAttemptCount,
        lastAttemptAt: new Date(),
        lastError: error,
        nextAttemptAt: nextAttempt,
      });
    }
    
    return this.update(id, {
      status: 'failed_permanent',
      attemptCount: newAttemptCount,
      lastAttemptAt: new Date(),
      lastError: error,
    });
  }

  async cleanupCompleted(olderThan?: Date): Promise<number> {
    const cutoff = olderThan ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await db.delete(campaignDeliveryQueue)
      .where(and(
        eq(campaignDeliveryQueue.status, 'completed'),
        lte(campaignDeliveryQueue.updatedAt, cutoff)
      ));
    return 0;
  }
}

export const campaignDeliveryStorage = new CampaignDeliveryStorage();
