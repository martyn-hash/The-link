import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { pages, pageTemplates } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { Page, InsertPage, UpdatePage, PageTemplate, InsertPageTemplate, UpdatePageTemplate } from '@shared/schema';

export class PageStorage extends BaseStorage {
  async create(data: InsertPage): Promise<Page> {
    const [page] = await db.insert(pages).values(data).returning();
    return page;
  }

  async getById(id: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.id, id));
    return page;
  }

  async getBySlug(slug: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.slug, slug));
    return page;
  }

  async getByCampaignId(campaignId: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.campaignId, campaignId));
    return page;
  }

  async getAll(options?: {
    isPublished?: boolean;
    createdByUserId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Page[]> {
    let query = db.select().from(pages);
    
    const conditions = [];
    if (options?.isPublished !== undefined) {
      conditions.push(eq(pages.isPublished, options.isPublished));
    }
    if (options?.createdByUserId) {
      conditions.push(eq(pages.createdByUserId, options.createdByUserId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    query = query.orderBy(desc(pages.createdAt)) as typeof query;
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return query;
  }

  async update(id: string, data: UpdatePage): Promise<Page> {
    const [page] = await db
      .update(pages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pages.id, id))
      .returning();
    
    if (!page) {
      throw new Error(`Page with ID '${id}' not found`);
    }
    
    return page;
  }

  async delete(id: string): Promise<void> {
    await db.delete(pages).where(eq(pages.id, id));
  }

  async publish(id: string): Promise<Page> {
    return this.update(id, { isPublished: true });
  }

  async unpublish(id: string): Promise<Page> {
    return this.update(id, { isPublished: false });
  }

  async generateUniqueSlug(baseName: string): Promise<string> {
    const baseSlug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let slug = baseSlug;
    let counter = 1;
    
    while (await this.getBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  async createTemplate(data: InsertPageTemplate): Promise<PageTemplate> {
    const [template] = await db.insert(pageTemplates).values(data).returning();
    return template;
  }

  async getTemplateById(id: string): Promise<PageTemplate | undefined> {
    const [template] = await db.select().from(pageTemplates).where(eq(pageTemplates.id, id));
    return template;
  }

  async getActiveTemplates(category?: string): Promise<PageTemplate[]> {
    if (category) {
      return db.select().from(pageTemplates)
        .where(and(
          eq(pageTemplates.isActive, true),
          eq(pageTemplates.category, category)
        ))
        .orderBy(desc(pageTemplates.createdAt));
    }
    
    return db.select().from(pageTemplates)
      .where(eq(pageTemplates.isActive, true))
      .orderBy(desc(pageTemplates.createdAt));
  }

  async updateTemplate(id: string, data: UpdatePageTemplate): Promise<PageTemplate> {
    const [template] = await db
      .update(pageTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pageTemplates.id, id))
      .returning();
    
    if (!template) {
      throw new Error(`Page template with ID '${id}' not found`);
    }
    
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(pageTemplates).where(eq(pageTemplates.id, id));
  }
}

export const pageStorage = new PageStorage();
