import { db } from '../../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
  qboQcRuns, 
  qboQcResults, 
  qboQcResultItems, 
  qboQcApprovalHistory,
  users 
} from '@shared/schema';
import type { 
  QboQcRun,
  InsertQboQcRun,
  UpdateQboQcRun,
  QboQcResult,
  InsertQboQcResult,
  QboQcResultItem,
  InsertQboQcResultItem,
  UpdateQboQcResultItem,
  QboQcApprovalHistory,
  InsertQboQcApprovalHistory,
  QboQcRunWithDetails,
  QboQcResultWithItems,
  QcRunSummary,
} from '@shared/schema';

export class QcStorage {
  async createQcRun(data: InsertQboQcRun): Promise<QboQcRun> {
    const [run] = await db.insert(qboQcRuns).values(data).returning();
    return run;
  }

  async getQcRunById(id: string): Promise<QboQcRun | null> {
    const [run] = await db.select().from(qboQcRuns).where(eq(qboQcRuns.id, id));
    return run || null;
  }

  async updateQcRun(id: string, data: UpdateQboQcRun): Promise<QboQcRun> {
    const [updated] = await db
      .update(qboQcRuns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(qboQcRuns.id, id))
      .returning();
    return updated;
  }

  async getQcRunsByClientId(clientId: string, limit = 10): Promise<QboQcRun[]> {
    return db
      .select()
      .from(qboQcRuns)
      .where(eq(qboQcRuns.clientId, clientId))
      .orderBy(desc(qboQcRuns.createdAt))
      .limit(limit);
  }

  async getLatestQcRunByClientId(clientId: string): Promise<QboQcRun | null> {
    const [run] = await db
      .select()
      .from(qboQcRuns)
      .where(eq(qboQcRuns.clientId, clientId))
      .orderBy(desc(qboQcRuns.createdAt))
      .limit(1);
    return run || null;
  }

  async getQcRunWithDetails(runId: string): Promise<QboQcRunWithDetails | null> {
    const run = await this.getQcRunById(runId);
    if (!run) return null;

    const results = await this.getQcResultsByRunId(runId);
    const resultsWithItems: QboQcResultWithItems[] = [];

    for (const result of results) {
      const items = await this.getQcResultItemsByResultId(result.id);
      resultsWithItems.push({ ...result, items });
    }

    let triggeredByUser = undefined;
    if (run.triggeredBy) {
      const [user] = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(users).where(eq(users.id, run.triggeredBy));
      if (user) triggeredByUser = user;
    }

    return {
      ...run,
      results: resultsWithItems,
      triggeredByUser,
    };
  }

  async createQcResult(data: InsertQboQcResult): Promise<QboQcResult> {
    const [result] = await db.insert(qboQcResults).values(data).returning();
    return result;
  }

  async createQcResults(data: InsertQboQcResult[]): Promise<QboQcResult[]> {
    if (data.length === 0) return [];
    return db.insert(qboQcResults).values(data).returning();
  }

  async getQcResultsByRunId(runId: string): Promise<QboQcResult[]> {
    return db
      .select()
      .from(qboQcResults)
      .where(eq(qboQcResults.runId, runId))
      .orderBy(qboQcResults.section, qboQcResults.checkCode);
  }

  async createQcResultItem(data: InsertQboQcResultItem): Promise<QboQcResultItem> {
    const [item] = await db.insert(qboQcResultItems).values(data).returning();
    return item;
  }

  async createQcResultItems(data: InsertQboQcResultItem[]): Promise<QboQcResultItem[]> {
    if (data.length === 0) return [];
    return db.insert(qboQcResultItems).values(data).returning();
  }

  async getQcResultItemsByResultId(resultId: string): Promise<QboQcResultItem[]> {
    return db
      .select()
      .from(qboQcResultItems)
      .where(eq(qboQcResultItems.resultId, resultId))
      .orderBy(desc(qboQcResultItems.txnDate));
  }

  async updateQcResultItem(id: string, data: UpdateQboQcResultItem): Promise<QboQcResultItem> {
    const [updated] = await db
      .update(qboQcResultItems)
      .set(data)
      .where(eq(qboQcResultItems.id, id))
      .returning();
    return updated;
  }

  async getQcResultItemById(id: string): Promise<QboQcResultItem | null> {
    const [item] = await db.select().from(qboQcResultItems).where(eq(qboQcResultItems.id, id));
    return item || null;
  }

  async approveQcResultItem(
    itemId: string, 
    userId: string, 
    note: string | null
  ): Promise<QboQcResultItem> {
    const item = await this.getQcResultItemById(itemId);
    if (!item) throw new Error('Item not found');

    await this.createApprovalHistory({
      itemId,
      action: 'approve',
      previousStatus: item.approvalStatus,
      newStatus: 'approved',
      note,
      performedBy: userId,
    });

    return this.updateQcResultItem(itemId, {
      approvalStatus: 'approved',
      approvedBy: userId,
      resolutionNote: note,
      resolvedAt: new Date(),
    });
  }

  async escalateQcResultItem(
    itemId: string, 
    userId: string, 
    note: string | null
  ): Promise<QboQcResultItem> {
    const item = await this.getQcResultItemById(itemId);
    if (!item) throw new Error('Item not found');

    await this.createApprovalHistory({
      itemId,
      action: 'escalate',
      previousStatus: item.approvalStatus,
      newStatus: 'escalated',
      note,
      performedBy: userId,
    });

    return this.updateQcResultItem(itemId, {
      approvalStatus: 'escalated',
      resolutionNote: note,
    });
  }

  async resolveQcResultItem(
    itemId: string, 
    userId: string, 
    note: string | null
  ): Promise<QboQcResultItem> {
    const item = await this.getQcResultItemById(itemId);
    if (!item) throw new Error('Item not found');

    await this.createApprovalHistory({
      itemId,
      action: 'resolve',
      previousStatus: item.approvalStatus,
      newStatus: 'resolved',
      note,
      performedBy: userId,
    });

    return this.updateQcResultItem(itemId, {
      approvalStatus: 'resolved',
      approvedBy: userId,
      resolutionNote: note,
      resolvedAt: new Date(),
    });
  }

  async createApprovalHistory(data: InsertQboQcApprovalHistory): Promise<QboQcApprovalHistory> {
    const [history] = await db.insert(qboQcApprovalHistory).values(data).returning();
    return history;
  }

  async getApprovalHistoryByItemId(itemId: string): Promise<QboQcApprovalHistory[]> {
    return db
      .select()
      .from(qboQcApprovalHistory)
      .where(eq(qboQcApprovalHistory.itemId, itemId))
      .orderBy(desc(qboQcApprovalHistory.performedAt));
  }

  async getPendingApprovalsByClientId(clientId: string): Promise<QboQcResultItem[]> {
    const latestRun = await this.getLatestQcRunByClientId(clientId);
    if (!latestRun) return [];

    const results = await this.getQcResultsByRunId(latestRun.id);
    const pendingItems: QboQcResultItem[] = [];

    for (const result of results) {
      const items = await db
        .select()
        .from(qboQcResultItems)
        .where(and(
          eq(qboQcResultItems.resultId, result.id),
          eq(qboQcResultItems.approvalStatus, 'pending')
        ));
      pendingItems.push(...items);
    }

    return pendingItems;
  }

  async getQcRunSummary(runId: string): Promise<QcRunSummary | null> {
    const run = await this.getQcRunById(runId);
    if (!run) return null;

    const results = await this.getQcResultsByRunId(runId);
    let pendingApprovals = 0;

    for (const result of results) {
      const pendingItems = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(qboQcResultItems)
        .where(and(
          eq(qboQcResultItems.resultId, result.id),
          eq(qboQcResultItems.approvalStatus, 'pending')
        ));
      pendingApprovals += pendingItems[0]?.count || 0;
    }

    return {
      id: run.id,
      clientId: run.clientId,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      status: run.status as any,
      totalChecks: run.totalChecks || 0,
      passedChecks: run.passedChecks || 0,
      warningChecks: run.warningChecks || 0,
      failedChecks: run.failedChecks || 0,
      blockedChecks: run.blockedChecks || 0,
      score: run.score ? parseFloat(run.score) : null,
      completedAt: run.completedAt,
      pendingApprovals,
    };
  }

  async getLatestQcRunSummary(clientId: string): Promise<QcRunSummary | null> {
    const run = await this.getLatestQcRunByClientId(clientId);
    if (!run) return null;
    return this.getQcRunSummary(run.id);
  }
}
