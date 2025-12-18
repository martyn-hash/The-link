import { db } from '../../db.js';
import { projectViewCache } from '@shared/schema';
import { eq, and, lt, sql, inArray } from 'drizzle-orm';
import type { ProjectViewCache, CachedProjectView } from '@shared/schema';
import crypto from 'crypto';

export interface CachedViewResult {
  data: CachedProjectView;
  isStale: boolean;
  staleAt: Date | null;
}

export class ViewCacheStorage {
  private generateFilterHash(filters: Record<string, any>): string {
    const sortedKeys = Object.keys(filters).sort();
    const normalized = sortedKeys.map(k => `${k}:${JSON.stringify(filters[k])}`).join('|');
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  async getCachedView(userId: string, viewKey: string, filters?: Record<string, any>): Promise<CachedProjectView | null> {
    const result = await this.getCachedViewWithMetadata(userId, viewKey, filters);
    return result ? result.data : null;
  }

  async getCachedViewWithMetadata(userId: string, viewKey: string, filters?: Record<string, any>): Promise<CachedViewResult | null> {
    const filterHash = filters ? this.generateFilterHash(filters) : 'default';
    
    const cached = await db
      .select()
      .from(projectViewCache)
      .where(
        and(
          eq(projectViewCache.userId, userId),
          eq(projectViewCache.viewKey, viewKey),
          eq(projectViewCache.filterHash, filterHash)
        )
      )
      .limit(1);

    if (cached.length === 0) {
      return null;
    }

    const entry = cached[0];
    
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      return null;
    }

    return {
      data: entry.cachedData as CachedProjectView,
      isStale: entry.isStale ?? false,
      staleAt: entry.staleAt,
    };
  }

  async setCachedView(
    userId: string, 
    viewKey: string, 
    data: CachedProjectView, 
    filters?: Record<string, any>,
    ttlMinutes: number = 1440
  ): Promise<ProjectViewCache> {
    const filterHash = filters ? this.generateFilterHash(filters) : 'default';
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const existing = await db
      .select({ id: projectViewCache.id })
      .from(projectViewCache)
      .where(
        and(
          eq(projectViewCache.userId, userId),
          eq(projectViewCache.viewKey, viewKey),
          eq(projectViewCache.filterHash, filterHash)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(projectViewCache)
        .set({
          cachedData: data as any,
          projectCount: String(data.projects?.length || 0),
          updatedAt: new Date(),
          expiresAt,
          isStale: false,
          staleAt: null,
        })
        .where(eq(projectViewCache.id, existing[0].id))
        .returning();
      return updated[0];
    } else {
      const inserted = await db
        .insert(projectViewCache)
        .values({
          userId,
          viewKey,
          filterHash,
          cachedData: data as any,
          projectCount: String(data.projects?.length || 0),
          expiresAt,
          isStale: false,
        })
        .returning();
      return inserted[0];
    }
  }

  async invalidateUserCache(userId: string): Promise<number> {
    const result = await db
      .delete(projectViewCache)
      .where(eq(projectViewCache.userId, userId))
      .returning({ id: projectViewCache.id });
    return result.length;
  }

  async invalidateViewCache(viewKey: string): Promise<number> {
    const result = await db
      .delete(projectViewCache)
      .where(eq(projectViewCache.viewKey, viewKey))
      .returning({ id: projectViewCache.id });
    return result.length;
  }

  async invalidateAllCache(): Promise<number> {
    const result = await db
      .delete(projectViewCache)
      .returning({ id: projectViewCache.id });
    return result.length;
  }

  async markAllViewsStale(): Promise<number> {
    const result = await db
      .update(projectViewCache)
      .set({
        isStale: true,
        staleAt: new Date(),
      })
      .where(eq(projectViewCache.isStale, false))
      .returning({ id: projectViewCache.id });
    return result.length;
  }

  async markUserViewsStale(userId: string): Promise<number> {
    const result = await db
      .update(projectViewCache)
      .set({
        isStale: true,
        staleAt: new Date(),
      })
      .where(eq(projectViewCache.userId, userId))
      .returning({ id: projectViewCache.id });
    return result.length;
  }

  async markUsersViewsStale(userIds: string[]): Promise<number> {
    if (userIds.length === 0) return 0;
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueUserIds.length === 0) return 0;
    
    const result = await db
      .update(projectViewCache)
      .set({
        isStale: true,
        staleAt: new Date(),
      })
      .where(inArray(projectViewCache.userId, uniqueUserIds))
      .returning({ id: projectViewCache.id });
    return result.length;
  }

  async clearStaleFlag(userId: string, viewKey: string, filterHash?: string): Promise<void> {
    const hash = filterHash || 'default';
    await db
      .update(projectViewCache)
      .set({
        isStale: false,
        staleAt: null,
      })
      .where(
        and(
          eq(projectViewCache.userId, userId),
          eq(projectViewCache.viewKey, viewKey),
          eq(projectViewCache.filterHash, hash)
        )
      );
  }

  async getAllStaleViews(): Promise<Array<{ userId: string; viewKey: string; filterHash: string; staleAt: Date | null }>> {
    const staleViews = await db
      .select({
        userId: projectViewCache.userId,
        viewKey: projectViewCache.viewKey,
        filterHash: projectViewCache.filterHash,
        staleAt: projectViewCache.staleAt,
      })
      .from(projectViewCache)
      .where(eq(projectViewCache.isStale, true));
    return staleViews;
  }

  async cleanupExpiredCache(): Promise<number> {
    const result = await db
      .delete(projectViewCache)
      .where(lt(projectViewCache.expiresAt, sql`NOW()`))
      .returning({ id: projectViewCache.id });
    return result.length;
  }

  async getAllUserCacheKeys(userId: string): Promise<string[]> {
    const caches = await db
      .select({ viewKey: projectViewCache.viewKey })
      .from(projectViewCache)
      .where(eq(projectViewCache.userId, userId));
    return Array.from(new Set(caches.map(c => c.viewKey)));
  }

  async getAllCachedUsersWithViews(): Promise<Array<{ userId: string; viewKey: string; filterHash: string }>> {
    const caches = await db
      .select({
        userId: projectViewCache.userId,
        viewKey: projectViewCache.viewKey,
        filterHash: projectViewCache.filterHash,
      })
      .from(projectViewCache);
    return caches;
  }

  async getUsersWithDefaultView(): Promise<string[]> {
    const caches = await db
      .select({ userId: projectViewCache.userId })
      .from(projectViewCache)
      .where(eq(projectViewCache.viewKey, 'default'));
    return Array.from(new Set(caches.map(c => c.userId)));
  }
}
