import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { campaignTemplates } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { CampaignTemplate, InsertCampaignTemplate, UpdateCampaignTemplate } from '@shared/schema';

export class CampaignTemplateStorage extends BaseStorage {
  async create(data: InsertCampaignTemplate): Promise<CampaignTemplate> {
    const [template] = await db.insert(campaignTemplates).values(data).returning();
    return template;
  }

  async getById(id: string): Promise<CampaignTemplate | undefined> {
    const [template] = await db.select().from(campaignTemplates).where(eq(campaignTemplates.id, id));
    return template;
  }

  async getAll(options?: {
    category?: string;
    isActive?: boolean;
    createdByUserId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CampaignTemplate[]> {
    let query = db.select().from(campaignTemplates);
    
    const conditions = [];
    if (options?.category) {
      conditions.push(eq(campaignTemplates.category, options.category as any));
    }
    if (options?.isActive !== undefined) {
      conditions.push(eq(campaignTemplates.isActive, options.isActive));
    }
    if (options?.createdByUserId) {
      conditions.push(eq(campaignTemplates.createdByUserId, options.createdByUserId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    query = query.orderBy(desc(campaignTemplates.createdAt)) as typeof query;
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return query;
  }

  async getActive(category?: string): Promise<CampaignTemplate[]> {
    if (category) {
      return db.select().from(campaignTemplates)
        .where(and(
          eq(campaignTemplates.isActive, true),
          eq(campaignTemplates.category, category as any)
        ))
        .orderBy(desc(campaignTemplates.createdAt));
    }
    
    return db.select().from(campaignTemplates)
      .where(eq(campaignTemplates.isActive, true))
      .orderBy(desc(campaignTemplates.createdAt));
  }

  async update(id: string, data: UpdateCampaignTemplate): Promise<CampaignTemplate> {
    const [template] = await db
      .update(campaignTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(campaignTemplates.id, id))
      .returning();
    
    if (!template) {
      throw new Error(`Campaign template with ID '${id}' not found`);
    }
    
    return template;
  }

  async delete(id: string): Promise<void> {
    const result = await db.delete(campaignTemplates).where(eq(campaignTemplates.id, id));
    if (!result) {
      throw new Error(`Campaign template with ID '${id}' not found`);
    }
  }

  async setActive(id: string, isActive: boolean): Promise<CampaignTemplate> {
    return this.update(id, { isActive });
  }

  async cloneToCampaign(templateId: string, campaignData: { name: string; createdByUserId: string }): Promise<any> {
    const template = await this.getById(templateId);
    if (!template) {
      throw new Error(`Template with ID '${templateId}' not found`);
    }

    return {
      name: campaignData.name,
      description: template.description,
      category: template.category,
      templateId: template.id,
      targetCriteria: template.targetCriteriaTemplate,
      recipientRules: template.recipientRules,
      createdByUserId: campaignData.createdByUserId,
    };
  }
}

export const campaignTemplateStorage = new CampaignTemplateStorage();
