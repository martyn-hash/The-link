import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { pageComponents } from '@shared/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import type { PageComponent, InsertPageComponent, UpdatePageComponent } from '@shared/schema';

export class PageComponentStorage extends BaseStorage {
  async create(data: InsertPageComponent): Promise<PageComponent> {
    const [component] = await db.insert(pageComponents).values(data).returning();
    return component;
  }

  async bulkCreate(pageId: string, components: Omit<InsertPageComponent, 'pageId'>[]): Promise<PageComponent[]> {
    if (components.length === 0) return [];
    
    const dataToInsert = components.map(c => ({
      ...c,
      pageId,
    }));
    
    return db.insert(pageComponents).values(dataToInsert).returning();
  }

  async getById(id: string): Promise<PageComponent | undefined> {
    const [component] = await db.select().from(pageComponents).where(eq(pageComponents.id, id));
    return component;
  }

  async getByPageId(pageId: string): Promise<PageComponent[]> {
    return db.select().from(pageComponents)
      .where(eq(pageComponents.pageId, pageId))
      .orderBy(
        asc(pageComponents.sectionIndex),
        asc(pageComponents.rowIndex),
        asc(pageComponents.columnIndex),
        asc(pageComponents.sortOrder)
      );
  }

  async getVisibleByPageId(pageId: string): Promise<PageComponent[]> {
    return db.select().from(pageComponents)
      .where(and(
        eq(pageComponents.pageId, pageId),
        eq(pageComponents.isVisible, true)
      ))
      .orderBy(
        asc(pageComponents.sectionIndex),
        asc(pageComponents.rowIndex),
        asc(pageComponents.columnIndex),
        asc(pageComponents.sortOrder)
      );
  }

  async update(id: string, data: UpdatePageComponent): Promise<PageComponent> {
    const [component] = await db
      .update(pageComponents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pageComponents.id, id))
      .returning();
    
    if (!component) {
      throw new Error(`Page component with ID '${id}' not found`);
    }
    
    return component;
  }

  async delete(id: string): Promise<void> {
    await db.delete(pageComponents).where(eq(pageComponents.id, id));
  }

  async deleteAllByPageId(pageId: string): Promise<void> {
    await db.delete(pageComponents).where(eq(pageComponents.pageId, pageId));
  }

  async replaceAll(pageId: string, components: Omit<InsertPageComponent, 'pageId'>[]): Promise<PageComponent[]> {
    await this.deleteAllByPageId(pageId);
    return this.bulkCreate(pageId, components);
  }

  async updateSortOrder(id: string, sortOrder: number): Promise<PageComponent> {
    return this.update(id, { sortOrder });
  }

  async setVisibility(id: string, isVisible: boolean): Promise<PageComponent> {
    return this.update(id, { isVisible });
  }
}

export const pageComponentStorage = new PageComponentStorage();
