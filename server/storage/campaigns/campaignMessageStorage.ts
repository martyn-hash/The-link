import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { campaignMessages } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { CampaignMessage, InsertCampaignMessage, UpdateCampaignMessage } from '@shared/schema';

export class CampaignMessageStorage extends BaseStorage {
  async create(data: InsertCampaignMessage): Promise<CampaignMessage> {
    const [message] = await db.insert(campaignMessages).values(data).returning();
    return message;
  }

  async getById(id: string): Promise<CampaignMessage | undefined> {
    const [message] = await db.select().from(campaignMessages).where(eq(campaignMessages.id, id));
    return message;
  }

  async getByCampaignId(campaignId: string): Promise<CampaignMessage[]> {
    return db.select().from(campaignMessages)
      .where(eq(campaignMessages.campaignId, campaignId))
      .orderBy(desc(campaignMessages.createdAt));
  }

  async getForChannel(campaignId: string, channel: string): Promise<CampaignMessage | undefined> {
    const [message] = await db.select().from(campaignMessages)
      .where(and(
        eq(campaignMessages.campaignId, campaignId),
        eq(campaignMessages.channel, channel as any),
        eq(campaignMessages.isActive, true)
      ));
    return message;
  }

  async getActiveMessages(campaignId: string): Promise<CampaignMessage[]> {
    return db.select().from(campaignMessages)
      .where(and(
        eq(campaignMessages.campaignId, campaignId),
        eq(campaignMessages.isActive, true)
      ))
      .orderBy(desc(campaignMessages.createdAt));
  }

  async update(id: string, data: UpdateCampaignMessage): Promise<CampaignMessage> {
    const [message] = await db
      .update(campaignMessages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaignMessages.id, id))
      .returning();
    
    if (!message) {
      throw new Error(`Campaign message with ID '${id}' not found`);
    }
    
    return message;
  }

  async delete(id: string): Promise<void> {
    await db.delete(campaignMessages).where(eq(campaignMessages.id, id));
  }

  async deleteAllByCampaignId(campaignId: string): Promise<void> {
    await db.delete(campaignMessages).where(eq(campaignMessages.campaignId, campaignId));
  }

  async setActive(id: string, isActive: boolean): Promise<CampaignMessage> {
    return this.update(id, { isActive });
  }

  async upsertForChannel(campaignId: string, channel: string, data: Omit<InsertCampaignMessage, 'campaignId' | 'channel'>): Promise<CampaignMessage> {
    const existing = await this.getForChannel(campaignId, channel);
    
    if (existing) {
      return this.update(existing.id, data);
    }
    
    return this.create({
      ...data,
      campaignId,
      channel: channel as any,
    });
  }
}

export const campaignMessageStorage = new CampaignMessageStorage();
