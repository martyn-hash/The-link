import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { projectSchedulingHistory, schedulingRunLogs } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import type { 
  ProjectSchedulingHistory, 
  InsertProjectSchedulingHistory,
  SchedulingRunLogs,
  InsertSchedulingRunLogs
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
}
