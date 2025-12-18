/**
 * Dashboard Cache Invalidation Service
 * 
 * Provides on-demand cache invalidation when projects change.
 * Instead of a heavy hourly batch job, this invalidates cache entries
 * for affected users when their project data changes.
 * 
 * The /api/dashboard/cache endpoint already computes on-demand when
 * cache is missing, so invalidation just needs to delete stale entries.
 */

import { db } from "./db";
import { dashboardCache } from "@shared/schema";
import { eq, inArray, lt } from "drizzle-orm";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Invalidate dashboard cache for specific users
 * Called when project mutations affect these users' dashboard metrics
 */
export async function invalidateDashboardCacheForUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  
  // Remove duplicates
  const uniqueUserIds = Array.from(new Set(userIds.filter(id => id)));
  if (uniqueUserIds.length === 0) return;
  
  try {
    await db.delete(dashboardCache).where(inArray(dashboardCache.userId, uniqueUserIds));
    console.log(`[Dashboard Cache] Invalidated cache for ${uniqueUserIds.length} user(s)`);
  } catch (error) {
    // Log but don't throw - cache invalidation shouldn't break the mutation
    console.error('[Dashboard Cache] Error invalidating cache:', error instanceof Error ? error.message : error);
  }
}

/**
 * Invalidate dashboard cache for a single user
 */
export async function invalidateDashboardCacheForUser(userId: string): Promise<void> {
  if (!userId) return;
  
  try {
    await db.delete(dashboardCache).where(eq(dashboardCache.userId, userId));
  } catch (error) {
    console.error(`[Dashboard Cache] Error invalidating cache for user ${userId}:`, error instanceof Error ? error.message : error);
  }
}

/**
 * Check if a user's cache is stale (older than TTL)
 */
export function isCacheStale(lastUpdated: Date | null): boolean {
  if (!lastUpdated) return true;
  const age = Date.now() - lastUpdated.getTime();
  return age > CACHE_TTL_MS;
}

/**
 * Get the cache TTL in minutes (for documentation/logging)
 */
export function getCacheTtlMinutes(): number {
  return CACHE_TTL_MS / (60 * 1000);
}

/**
 * Cleanup old cache entries (for nightly maintenance)
 * Only deletes entries older than 24 hours that haven't been accessed
 */
export async function cleanupStaleCacheEntries(): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const result = await db.delete(dashboardCache).where(lt(dashboardCache.lastUpdated, cutoffDate));
    return result.rowCount || 0;
  } catch (error) {
    console.error('[Dashboard Cache] Error cleaning up stale entries:', error instanceof Error ? error.message : error);
    return 0;
  }
}
