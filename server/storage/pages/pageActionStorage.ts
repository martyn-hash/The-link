import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { pageActions } from '@shared/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import type { PageAction, InsertPageAction, UpdatePageAction } from '@shared/schema';

export class PageActionStorage extends BaseStorage {
  async create(data: InsertPageAction): Promise<PageAction> {
    const [action] = await db.insert(pageActions).values(data).returning();
    return action;
  }

  async bulkCreate(pageId: string, actions: Omit<InsertPageAction, 'pageId'>[]): Promise<PageAction[]> {
    if (actions.length === 0) return [];
    
    const dataToInsert = actions.map(a => ({
      ...a,
      pageId,
    }));
    
    return db.insert(pageActions).values(dataToInsert).returning();
  }

  async getById(id: string): Promise<PageAction | undefined> {
    const [action] = await db.select().from(pageActions).where(eq(pageActions.id, id));
    return action;
  }

  async getByPageId(pageId: string): Promise<PageAction[]> {
    return db.select().from(pageActions)
      .where(eq(pageActions.pageId, pageId))
      .orderBy(asc(pageActions.sortOrder));
  }

  async getEnabledByPageId(pageId: string): Promise<PageAction[]> {
    return db.select().from(pageActions)
      .where(and(
        eq(pageActions.pageId, pageId),
        eq(pageActions.isEnabled, true)
      ))
      .orderBy(asc(pageActions.sortOrder));
  }

  async getByComponentId(componentId: string): Promise<PageAction[]> {
    return db.select().from(pageActions)
      .where(eq(pageActions.componentId, componentId))
      .orderBy(asc(pageActions.sortOrder));
  }

  async update(id: string, data: UpdatePageAction): Promise<PageAction> {
    const [action] = await db
      .update(pageActions)
      .set(data)
      .where(eq(pageActions.id, id))
      .returning();
    
    if (!action) {
      throw new Error(`Page action with ID '${id}' not found`);
    }
    
    return action;
  }

  async delete(id: string): Promise<void> {
    await db.delete(pageActions).where(eq(pageActions.id, id));
  }

  async deleteAllByPageId(pageId: string): Promise<void> {
    await db.delete(pageActions).where(eq(pageActions.pageId, pageId));
  }

  async setEnabled(id: string, isEnabled: boolean): Promise<PageAction> {
    return this.update(id, { isEnabled });
  }
}

export const pageActionStorage = new PageActionStorage();
