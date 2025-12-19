import { db } from '../../db.js';
import { taskInstanceCountsCache } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { TaskInstanceCountsCache, CachedTaskInstanceCounts } from '@shared/schema';

export interface TaskCountsCacheEntry {
  projectId: string;
  pending: number;
  awaitingClient: number;
  isStale: boolean;
  staleAt: Date | null;
  updatedAt: Date | null;
}

export class TaskCountsCacheStorage {
  async getAllCachedCounts(): Promise<CachedTaskInstanceCounts> {
    const cached = await db
      .select()
      .from(taskInstanceCountsCache);

    const counts: Record<string, { pending: number; awaitingClient: number }> = {};
    let hasStale = false;
    let earliestStale: string | null = null;

    for (const entry of cached) {
      counts[entry.projectId] = {
        pending: entry.pendingCount,
        awaitingClient: entry.awaitingClientCount,
      };
      if (entry.isStale) {
        hasStale = true;
        if (entry.staleAt && (!earliestStale || entry.staleAt.toISOString() < earliestStale)) {
          earliestStale = entry.staleAt.toISOString();
        }
      }
    }

    return {
      counts,
      lastRefreshed: cached.length > 0 && cached[0].updatedAt 
        ? cached[0].updatedAt.toISOString() 
        : new Date().toISOString(),
      isStale: hasStale,
      staleAt: earliestStale,
    };
  }

  async getCachedCountsForProject(projectId: string): Promise<TaskCountsCacheEntry | null> {
    const cached = await db
      .select()
      .from(taskInstanceCountsCache)
      .where(eq(taskInstanceCountsCache.projectId, projectId))
      .limit(1);

    if (cached.length === 0) {
      return null;
    }

    const entry = cached[0];
    return {
      projectId: entry.projectId,
      pending: entry.pendingCount,
      awaitingClient: entry.awaitingClientCount,
      isStale: entry.isStale ?? false,
      staleAt: entry.staleAt,
      updatedAt: entry.updatedAt,
    };
  }

  async setCachedCount(
    projectId: string, 
    pending: number, 
    awaitingClient: number
  ): Promise<TaskInstanceCountsCache> {
    const existing = await db
      .select({ id: taskInstanceCountsCache.id })
      .from(taskInstanceCountsCache)
      .where(eq(taskInstanceCountsCache.projectId, projectId))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(taskInstanceCountsCache)
        .set({
          pendingCount: pending,
          awaitingClientCount: awaitingClient,
          updatedAt: new Date(),
          isStale: false,
          staleAt: null,
        })
        .where(eq(taskInstanceCountsCache.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      const inserted = await db
        .insert(taskInstanceCountsCache)
        .values({
          projectId,
          pendingCount: pending,
          awaitingClientCount: awaitingClient,
          isStale: false,
        })
        .returning();
      return inserted[0];
    }
  }

  async setBulkCachedCounts(
    counts: Array<{ projectId: string; pending: number; awaitingClient: number }>
  ): Promise<number> {
    let updated = 0;
    for (const count of counts) {
      await this.setCachedCount(count.projectId, count.pending, count.awaitingClient);
      updated++;
    }
    return updated;
  }

  async markProjectStale(projectId: string): Promise<void> {
    await db
      .update(taskInstanceCountsCache)
      .set({
        isStale: true,
        staleAt: new Date(),
      })
      .where(eq(taskInstanceCountsCache.projectId, projectId));
  }

  async markProjectsStale(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const uniqueIds = Array.from(new Set(projectIds.filter(Boolean)));
    if (uniqueIds.length === 0) return 0;

    const result = await db
      .update(taskInstanceCountsCache)
      .set({
        isStale: true,
        staleAt: new Date(),
      })
      .where(inArray(taskInstanceCountsCache.projectId, uniqueIds))
      .returning({ id: taskInstanceCountsCache.id });
    return result.length;
  }

  async markAllStale(): Promise<number> {
    const result = await db
      .update(taskInstanceCountsCache)
      .set({
        isStale: true,
        staleAt: new Date(),
      })
      .where(eq(taskInstanceCountsCache.isStale, false))
      .returning({ id: taskInstanceCountsCache.id });
    return result.length;
  }

  async clearStaleFlag(projectId: string): Promise<void> {
    await db
      .update(taskInstanceCountsCache)
      .set({
        isStale: false,
        staleAt: null,
      })
      .where(eq(taskInstanceCountsCache.projectId, projectId));
  }

  async invalidateProject(projectId: string): Promise<void> {
    await db
      .delete(taskInstanceCountsCache)
      .where(eq(taskInstanceCountsCache.projectId, projectId));
  }

  async invalidateAll(): Promise<number> {
    const result = await db
      .delete(taskInstanceCountsCache)
      .returning({ id: taskInstanceCountsCache.id });
    return result.length;
  }

  async hasAnyCachedData(): Promise<boolean> {
    const count = await db
      .select({ id: taskInstanceCountsCache.id })
      .from(taskInstanceCountsCache)
      .limit(1);
    return count.length > 0;
  }
}
