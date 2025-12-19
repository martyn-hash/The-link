import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { systemFieldLibrary, systemFieldUsage } from '@shared/schema';
import { eq, and, desc, sql, ilike, or, inArray } from 'drizzle-orm';
import type { 
  SystemFieldLibrary, 
  InsertSystemFieldLibrary, 
  UpdateSystemFieldLibrary,
  SystemFieldUsage,
  InsertSystemFieldUsage
} from '@shared/schema';

export class SystemFieldLibraryStorage extends BaseStorage {
  async create(data: InsertSystemFieldLibrary): Promise<SystemFieldLibrary> {
    const [field] = await db.insert(systemFieldLibrary).values(data).returning();
    return field;
  }

  async getById(id: string): Promise<SystemFieldLibrary | undefined> {
    const [field] = await db.select().from(systemFieldLibrary).where(eq(systemFieldLibrary.id, id));
    return field;
  }

  async getAll(options?: {
    category?: string;
    fieldType?: string;
    isArchived?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<SystemFieldLibrary[]> {
    let query = db.select().from(systemFieldLibrary);
    
    const conditions = [];
    
    if (options?.category) {
      conditions.push(eq(systemFieldLibrary.category, options.category as any));
    }
    if (options?.fieldType) {
      conditions.push(eq(systemFieldLibrary.fieldType, options.fieldType as any));
    }
    if (options?.isArchived !== undefined) {
      conditions.push(eq(systemFieldLibrary.isArchived, options.isArchived));
    }
    if (options?.search) {
      conditions.push(
        or(
          ilike(systemFieldLibrary.fieldName, `%${options.search}%`),
          ilike(systemFieldLibrary.description, `%${options.search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    query = query.orderBy(desc(systemFieldLibrary.createdAt)) as typeof query;
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return query;
  }

  async update(id: string, data: UpdateSystemFieldLibrary): Promise<SystemFieldLibrary> {
    const [field] = await db
      .update(systemFieldLibrary)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(systemFieldLibrary.id, id))
      .returning();
    
    if (!field) {
      throw new Error(`System field library entry with ID '${id}' not found`);
    }
    
    return field;
  }

  async archive(id: string): Promise<SystemFieldLibrary> {
    return this.update(id, { isArchived: true });
  }

  async restore(id: string): Promise<SystemFieldLibrary> {
    return this.update(id, { isArchived: false });
  }

  async delete(id: string): Promise<void> {
    await db.delete(systemFieldLibrary).where(eq(systemFieldLibrary.id, id));
  }

  async incrementUsageCount(id: string): Promise<void> {
    await db
      .update(systemFieldLibrary)
      .set({ 
        usageCount: sql`${systemFieldLibrary.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(systemFieldLibrary.id, id));
  }

  async decrementUsageCount(id: string): Promise<void> {
    await db
      .update(systemFieldLibrary)
      .set({ 
        usageCount: sql`GREATEST(0, ${systemFieldLibrary.usageCount} - 1)`,
        updatedAt: new Date()
      })
      .where(eq(systemFieldLibrary.id, id));
  }

  async getByCategory(category: string): Promise<SystemFieldLibrary[]> {
    return db.select()
      .from(systemFieldLibrary)
      .where(and(
        eq(systemFieldLibrary.category, category as any),
        eq(systemFieldLibrary.isArchived, false)
      ))
      .orderBy(systemFieldLibrary.fieldName);
  }

  async getByFieldType(fieldType: string): Promise<SystemFieldLibrary[]> {
    return db.select()
      .from(systemFieldLibrary)
      .where(and(
        eq(systemFieldLibrary.fieldType, fieldType as any),
        eq(systemFieldLibrary.isArchived, false)
      ))
      .orderBy(systemFieldLibrary.fieldName);
  }

  async recordUsage(data: InsertSystemFieldUsage): Promise<SystemFieldUsage> {
    const [usage] = await db.insert(systemFieldUsage).values(data).returning();
    await this.incrementUsageCount(data.libraryFieldId);
    return usage;
  }

  async getUsageByLibraryFieldId(libraryFieldId: string): Promise<SystemFieldUsage[]> {
    return db.select()
      .from(systemFieldUsage)
      .where(eq(systemFieldUsage.libraryFieldId, libraryFieldId))
      .orderBy(desc(systemFieldUsage.createdAt));
  }

  async getUsageByContext(context: string, contextEntityId: string): Promise<SystemFieldUsage[]> {
    return db.select()
      .from(systemFieldUsage)
      .where(and(
        eq(systemFieldUsage.context, context as any),
        eq(systemFieldUsage.contextEntityId, contextEntityId)
      ))
      .orderBy(desc(systemFieldUsage.createdAt));
  }

  async deleteUsage(id: string): Promise<void> {
    const [usage] = await db.select().from(systemFieldUsage).where(eq(systemFieldUsage.id, id));
    if (usage) {
      await db.delete(systemFieldUsage).where(eq(systemFieldUsage.id, id));
      await this.decrementUsageCount(usage.libraryFieldId);
    }
  }

  async getFieldsWithUsageStats(): Promise<(SystemFieldLibrary & { usageDetails: SystemFieldUsage[] })[]> {
    const fields = await this.getAll({ isArchived: false });
    const fieldIds = fields.map(f => f.id);
    
    if (fieldIds.length === 0) return [];
    
    const usages = await db.select()
      .from(systemFieldUsage)
      .where(inArray(systemFieldUsage.libraryFieldId, fieldIds));
    
    const usageMap = new Map<string, SystemFieldUsage[]>();
    for (const usage of usages) {
      const existing = usageMap.get(usage.libraryFieldId) || [];
      existing.push(usage);
      usageMap.set(usage.libraryFieldId, existing);
    }
    
    return fields.map(field => ({
      ...field,
      usageDetails: usageMap.get(field.id) || []
    }));
  }
}
