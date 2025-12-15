import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { campaignTargetCriteria } from '@shared/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import type { CampaignTargetCriteria, InsertCampaignTargetCriteria } from '@shared/schema';

export class CampaignTargetStorage extends BaseStorage {
  async create(data: InsertCampaignTargetCriteria): Promise<CampaignTargetCriteria> {
    const [criteria] = await db.insert(campaignTargetCriteria).values(data).returning();
    return criteria;
  }

  async bulkCreate(campaignId: string, criteria: Omit<InsertCampaignTargetCriteria, 'campaignId'>[]): Promise<CampaignTargetCriteria[]> {
    if (criteria.length === 0) return [];
    
    const dataToInsert = criteria.map(c => ({
      ...c,
      campaignId,
    }));
    
    return db.insert(campaignTargetCriteria).values(dataToInsert).returning();
  }

  async getByCampaignId(campaignId: string): Promise<CampaignTargetCriteria[]> {
    return db.select().from(campaignTargetCriteria)
      .where(eq(campaignTargetCriteria.campaignId, campaignId))
      .orderBy(asc(campaignTargetCriteria.filterGroup), asc(campaignTargetCriteria.sortOrder));
  }

  async getById(id: string): Promise<CampaignTargetCriteria | undefined> {
    const [criteria] = await db.select().from(campaignTargetCriteria).where(eq(campaignTargetCriteria.id, id));
    return criteria;
  }

  async update(id: string, data: Partial<InsertCampaignTargetCriteria>): Promise<CampaignTargetCriteria> {
    const [criteria] = await db
      .update(campaignTargetCriteria)
      .set(data)
      .where(eq(campaignTargetCriteria.id, id))
      .returning();
    
    if (!criteria) {
      throw new Error(`Campaign target criteria with ID '${id}' not found`);
    }
    
    return criteria;
  }

  async delete(id: string): Promise<void> {
    await db.delete(campaignTargetCriteria).where(eq(campaignTargetCriteria.id, id));
  }

  async deleteAllByCampaignId(campaignId: string): Promise<void> {
    await db.delete(campaignTargetCriteria).where(eq(campaignTargetCriteria.campaignId, campaignId));
  }

  async replaceAll(campaignId: string, criteria: Omit<InsertCampaignTargetCriteria, 'campaignId'>[]): Promise<CampaignTargetCriteria[]> {
    await this.deleteAllByCampaignId(campaignId);
    return this.bulkCreate(campaignId, criteria);
  }

  async getGroupedByCampaignId(campaignId: string): Promise<Map<number, CampaignTargetCriteria[]>> {
    const criteria = await this.getByCampaignId(campaignId);
    const grouped = new Map<number, CampaignTargetCriteria[]>();
    
    for (const c of criteria) {
      const group = c.filterGroup ?? 0;
      if (!grouped.has(group)) {
        grouped.set(group, []);
      }
      grouped.get(group)!.push(c);
    }
    
    return grouped;
  }
}

export const campaignTargetStorage = new CampaignTargetStorage();
