import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { projectSchedulingHistory, schedulingRunLogs, schedulingExceptions } from '@shared/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import type { 
  ProjectSchedulingHistory, 
  InsertProjectSchedulingHistory,
  SchedulingRunLogs,
  InsertSchedulingRunLogs,
  SchedulingException,
  InsertSchedulingException
} from '@shared/schema';

/**
 * ProjectSchedulingStorage handles project scheduling history and run logs
 * Tracks automated project generation and scheduling operations
 */
export class ProjectSchedulingStorage extends BaseStorage {
  // ============================================================================
  // PROJECT SCHEDULING HISTORY
  // ============================================================================

  async createProjectSchedulingHistory(data: InsertProjectSchedulingHistory): Promise<ProjectSchedulingHistory> {
    const [history] = await db
      .insert(projectSchedulingHistory)
      .values(data)
      .returning();
    return history;
  }

  async getProjectSchedulingHistoryByServiceId(
    serviceId: string, 
    serviceType: 'client' | 'people'
  ): Promise<ProjectSchedulingHistory[]> {
    const whereCondition = serviceType === 'client' 
      ? eq(projectSchedulingHistory.clientServiceId, serviceId)
      : eq(projectSchedulingHistory.peopleServiceId, serviceId);

    return await db
      .select()
      .from(projectSchedulingHistory)
      .where(whereCondition)
      .orderBy(desc(projectSchedulingHistory.createdAt))
      .limit(50);
  }

  async getProjectSchedulingHistoryByProjectId(projectId: string): Promise<ProjectSchedulingHistory[]> {
    return await db
      .select()
      .from(projectSchedulingHistory)
      .where(eq(projectSchedulingHistory.projectId, projectId))
      .orderBy(desc(projectSchedulingHistory.createdAt));
  }

  async getProjectSchedulingHistory(filters?: { limit?: number }): Promise<ProjectSchedulingHistory[]> {
    return await db
      .select()
      .from(projectSchedulingHistory)
      .orderBy(desc(projectSchedulingHistory.createdAt))
      .limit(filters?.limit || 50);
  }

  // ============================================================================
  // SCHEDULING RUN LOGS
  // ============================================================================

  async createSchedulingRunLog(data: InsertSchedulingRunLogs): Promise<SchedulingRunLogs> {
    const [log] = await db
      .insert(schedulingRunLogs)
      .values(data)
      .returning();
    return log;
  }

  async getSchedulingRunLogs(limit: number = 20): Promise<SchedulingRunLogs[]> {
    return await db
      .select()
      .from(schedulingRunLogs)
      .orderBy(desc(schedulingRunLogs.runDate))
      .limit(limit);
  }

  async getLatestSchedulingRunLog(): Promise<SchedulingRunLogs | undefined> {
    const [log] = await db
      .select()
      .from(schedulingRunLogs)
      .orderBy(desc(schedulingRunLogs.runDate))
      .limit(1);
    return log;
  }

  // ============================================================================
  // SCHEDULING EXCEPTIONS
  // ============================================================================

  async createSchedulingException(data: InsertSchedulingException): Promise<SchedulingException> {
    const [exception] = await db
      .insert(schedulingExceptions)
      .values(data)
      .returning();
    return exception;
  }

  async getSchedulingExceptions(filters?: {
    runLogId?: string;
    errorType?: string;
    resolved?: boolean;
    serviceType?: string;
    limit?: number;
  }): Promise<SchedulingException[]> {
    let query = db.select().from(schedulingExceptions);
    
    const conditions = [];
    if (filters?.runLogId) {
      conditions.push(eq(schedulingExceptions.runLogId, filters.runLogId));
    }
    if (filters?.errorType) {
      conditions.push(eq(schedulingExceptions.errorType, filters.errorType));
    }
    if (filters?.resolved !== undefined) {
      conditions.push(eq(schedulingExceptions.resolved, filters.resolved));
    }
    if (filters?.serviceType) {
      conditions.push(eq(schedulingExceptions.serviceType, filters.serviceType));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return await query
      .orderBy(desc(schedulingExceptions.createdAt))
      .limit(filters?.limit || 100);
  }

  async getUnresolvedSchedulingExceptions(): Promise<SchedulingException[]> {
    return await db
      .select()
      .from(schedulingExceptions)
      .where(eq(schedulingExceptions.resolved, false))
      .orderBy(desc(schedulingExceptions.createdAt));
  }

  async resolveSchedulingException(
    exceptionId: string, 
    resolvedByUserId: string,
    notes?: string
  ): Promise<SchedulingException | undefined> {
    const [exception] = await db
      .update(schedulingExceptions)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedByUserId,
        notes: notes || null,
      })
      .where(eq(schedulingExceptions.id, exceptionId))
      .returning();
    return exception;
  }

  async resolveAllExceptionsForService(
    serviceId: string,
    serviceType: 'client' | 'people',
    resolvedByUserId: string,
    notes?: string
  ): Promise<number> {
    const condition = serviceType === 'client'
      ? eq(schedulingExceptions.clientServiceId, serviceId)
      : eq(schedulingExceptions.peopleServiceId, serviceId);

    const result = await db
      .update(schedulingExceptions)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedByUserId,
        notes: notes || 'Resolved via bulk action',
      })
      .where(and(condition, eq(schedulingExceptions.resolved, false)))
      .returning();
    
    return result.length;
  }

  async getSchedulingExceptionsByRunLog(runLogId: string): Promise<SchedulingException[]> {
    return await db
      .select()
      .from(schedulingExceptions)
      .where(eq(schedulingExceptions.runLogId, runLogId))
      .orderBy(desc(schedulingExceptions.createdAt));
  }
}
