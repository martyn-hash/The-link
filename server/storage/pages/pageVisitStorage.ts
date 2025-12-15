import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { pageVisits, pageActionLogs } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type {
  PageVisit,
  InsertPageVisit,
  UpdatePageVisit,
  PageActionLog,
  InsertPageActionLog,
} from '@shared/schema';

export class PageVisitStorage extends BaseStorage {
  async create(data: InsertPageVisit): Promise<PageVisit> {
    const [visit] = await db.insert(pageVisits).values(data).returning();
    return visit;
  }

  async getById(id: string): Promise<PageVisit | undefined> {
    const [visit] = await db.select().from(pageVisits).where(eq(pageVisits.id, id));
    return visit;
  }

  async getByToken(visitToken: string): Promise<PageVisit | undefined> {
    const [visit] = await db.select().from(pageVisits).where(eq(pageVisits.visitToken, visitToken));
    return visit;
  }

  async getByPageId(pageId: string): Promise<PageVisit[]> {
    return db.select().from(pageVisits)
      .where(eq(pageVisits.pageId, pageId))
      .orderBy(desc(pageVisits.lastViewedAt));
  }

  async getByClientId(clientId: string): Promise<PageVisit[]> {
    return db.select().from(pageVisits)
      .where(eq(pageVisits.clientId, clientId))
      .orderBy(desc(pageVisits.lastViewedAt));
  }

  async update(id: string, data: UpdatePageVisit): Promise<PageVisit> {
    const [visit] = await db
      .update(pageVisits)
      .set(data)
      .where(eq(pageVisits.id, id))
      .returning();
    
    if (!visit) {
      throw new Error(`Page visit with ID '${id}' not found`);
    }
    
    return visit;
  }

  async recordVisit(pageId: string, data: Omit<InsertPageVisit, 'pageId'>): Promise<PageVisit> {
    const existing = await this.getByToken(data.visitToken);
    
    if (existing) {
      const [updated] = await db.update(pageVisits)
        .set({
          lastViewedAt: new Date(),
          viewCount: (existing.viewCount ?? 1) + 1,
        })
        .where(eq(pageVisits.id, existing.id))
        .returning();
      return updated;
    }
    
    return this.create({
      ...data,
      pageId,
    });
  }

  async verifyOtp(visitId: string): Promise<PageVisit> {
    return this.update(visitId, { otpVerifiedAt: new Date() });
  }

  async countByPageId(pageId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pageVisits)
      .where(eq(pageVisits.pageId, pageId));
    
    return result[0]?.count ?? 0;
  }

  async createActionLog(data: InsertPageActionLog): Promise<PageActionLog> {
    const [log] = await db.insert(pageActionLogs).values(data).returning();
    return log;
  }

  async getActionLogsByPageId(pageId: string): Promise<PageActionLog[]> {
    return db.select().from(pageActionLogs)
      .where(eq(pageActionLogs.pageId, pageId))
      .orderBy(desc(pageActionLogs.timestamp));
  }

  async getActionLogsByVisitId(visitId: string): Promise<PageActionLog[]> {
    return db.select().from(pageActionLogs)
      .where(eq(pageActionLogs.visitId, visitId))
      .orderBy(desc(pageActionLogs.timestamp));
  }

  async getActionLogsByClientId(clientId: string): Promise<PageActionLog[]> {
    return db.select().from(pageActionLogs)
      .where(eq(pageActionLogs.clientId, clientId))
      .orderBy(desc(pageActionLogs.timestamp));
  }

  async countActionsByPageId(pageId: string): Promise<Record<string, number>> {
    const results = await db
      .select({
        actionId: pageActionLogs.actionId,
        count: sql<number>`count(*)::int`
      })
      .from(pageActionLogs)
      .where(eq(pageActionLogs.pageId, pageId))
      .groupBy(pageActionLogs.actionId);
    
    return results.reduce((acc, { actionId, count }) => {
      acc[actionId] = count;
      return acc;
    }, {} as Record<string, number>);
  }

  async existsForRecipient(recipientId: string, actionType?: string): Promise<boolean> {
    const conditions = [eq(pageActionLogs.recipientId, recipientId)];
    
    if (actionType) {
      conditions.push(eq(pageActionLogs.actionType, actionType));
    }
    
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pageActionLogs)
      .where(and(...conditions));
    
    return (result[0]?.count ?? 0) > 0;
  }
}

export const pageVisitStorage = new PageVisitStorage();
