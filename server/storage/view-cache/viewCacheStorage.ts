import { db } from '../../db.js';
import { projectViewCache } from '@shared/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import type { ProjectViewCache, CachedProjectView } from '@shared/schema';
import crypto from 'crypto';

export class ViewCacheStorage {
  private generateFilterHash(filters: Record<string, any>): string {
    const sortedKeys = Object.keys(filters).sort();
    const normalized = sortedKeys.map(k => `${k}:${JSON.stringify(filters[k])}`).join('|');
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  async getCachedView(userId: string, viewKey: string, filters?: Record<string, any>): Promise<CachedProjectView | null> {
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

    return entry.cachedData as CachedProjectView;
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
