import { db } from '../../db.js';
import { internalTasksCache } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import type { InternalTasksCache } from '@shared/schema';

export interface InternalTasksCacheEntry {
  userId: string;
  tasks: unknown[];
  reminders: unknown[];
  taskCount: number;
  reminderCount: number;
  isStale: boolean;
  staleAt: Date | null;
  updatedAt: Date | null;
}

export interface CachedInternalTasksData {
  tasks: unknown[];
  reminders: unknown[];
  taskCount: number;
  reminderCount: number;
  lastRefreshed: string;
  isStale: boolean;
  staleAt: string | null;
}

export class InternalTasksCacheStorage {
  async getCachedDataForUser(userId: string): Promise<CachedInternalTasksData | null> {
    const cached = await db
      .select()
      .from(internalTasksCache)
      .where(eq(internalTasksCache.userId, userId))
      .limit(1);

    if (cached.length === 0) {
      return null;
    }

    const entry = cached[0];
    return {
      tasks: (entry.cachedTasks as unknown[]) ?? [],
      reminders: (entry.cachedReminders as unknown[]) ?? [],
      taskCount: parseInt(entry.taskCount ?? '0', 10),
      reminderCount: parseInt(entry.reminderCount ?? '0', 10),
      lastRefreshed: entry.updatedAt?.toISOString() ?? new Date().toISOString(),
      isStale: entry.isStale ?? false,
      staleAt: entry.staleAt?.toISOString() ?? null,
    };
  }

  async setCachedData(
    userId: string,
    tasks: unknown[],
    reminders: unknown[]
  ): Promise<InternalTasksCache> {
    const existing = await db
      .select({ id: internalTasksCache.id })
      .from(internalTasksCache)
      .where(eq(internalTasksCache.userId, userId))
      .limit(1);

    const now = new Date();
    const taskCount = String(tasks.length);
    const reminderCount = String(reminders.length);

    if (existing.length > 0) {
      const updated = await db
        .update(internalTasksCache)
        .set({
          cachedTasks: tasks,
          cachedReminders: reminders,
          taskCount,
          reminderCount,
          updatedAt: now,
          isStale: false,
          staleAt: null,
        })
        .where(eq(internalTasksCache.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      const inserted = await db
        .insert(internalTasksCache)
        .values({
          userId,
          cachedTasks: tasks,
          cachedReminders: reminders,
          taskCount,
          reminderCount,
          isStale: false,
        })
        .returning();
      return inserted[0];
    }
  }

  async markUserStale(userId: string): Promise<void> {
    await db
      .update(internalTasksCache)
      .set({
        isStale: true,
        staleAt: new Date(),
      })
      .where(eq(internalTasksCache.userId, userId));
  }

  async markUsersStale(userIds: string[]): Promise<number> {
    if (userIds.length === 0) return 0;
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return 0;

    const result = await db
      .update(internalTasksCache)
      .set({
        isStale: true,
        staleAt: new Date(),
      })
      .where(inArray(internalTasksCache.userId, uniqueIds))
      .returning({ id: internalTasksCache.id });
    return result.length;
  }

  async markAllStale(): Promise<number> {
    const result = await db
      .update(internalTasksCache)
      .set({
        isStale: true,
        staleAt: new Date(),
      })
      .where(eq(internalTasksCache.isStale, false))
      .returning({ id: internalTasksCache.id });
    return result.length;
  }

  async clearStaleFlag(userId: string): Promise<void> {
    await db
      .update(internalTasksCache)
      .set({
        isStale: false,
        staleAt: null,
      })
      .where(eq(internalTasksCache.userId, userId));
  }

  async invalidateUser(userId: string): Promise<void> {
    await db
      .delete(internalTasksCache)
      .where(eq(internalTasksCache.userId, userId));
  }

  async invalidateUsers(userIds: string[]): Promise<number> {
    if (userIds.length === 0) return 0;
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return 0;

    const result = await db
      .delete(internalTasksCache)
      .where(inArray(internalTasksCache.userId, uniqueIds))
      .returning({ id: internalTasksCache.id });
    return result.length;
  }

  async invalidateAll(): Promise<number> {
    const result = await db
      .delete(internalTasksCache)
      .returning({ id: internalTasksCache.id });
    return result.length;
  }

  async hasAnyCachedData(): Promise<boolean> {
    const count = await db
      .select({ id: internalTasksCache.id })
      .from(internalTasksCache)
      .limit(1);
    return count.length > 0;
  }

  async hasCachedDataForUser(userId: string): Promise<boolean> {
    const count = await db
      .select({ id: internalTasksCache.id })
      .from(internalTasksCache)
      .where(eq(internalTasksCache.userId, userId))
      .limit(1);
    return count.length > 0;
  }

  async getAllCachedUserIds(): Promise<string[]> {
    const entries = await db
      .select({ userId: internalTasksCache.userId })
      .from(internalTasksCache);
    return entries.map(e => e.userId);
  }
}
