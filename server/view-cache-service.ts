import { storage } from './storage/index';
import type { CachedProjectView } from '@shared/schema';

export interface ViewCacheResult {
  status: 'success' | 'partial' | 'error';
  usersProcessed: number;
  viewsCached: number;
  errors: string[];
  executionTimeMs: number;
}

export async function warmViewCache(): Promise<ViewCacheResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let usersProcessed = 0;
  let viewsCached = 0;

  try {
    const users = await storage.getAllUsers();
    
    for (const user of users) {
      try {
        const preferences = await storage.getUserProjectPreferences(user.id);
        
        const defaultFilters: Record<string, any> = {
          archived: false,
          inactive: false,
          showCompletedRegardless: false,
        };
        
        if (preferences?.defaultViewId && preferences.defaultViewType === 'saved') {
          const userViews = await storage.getProjectViewsByUserId(user.id);
          const savedView = userViews.find(v => v.id === preferences.defaultViewId);
          if (savedView?.filters) {
            Object.assign(defaultFilters, savedView.filters as Record<string, any>);
          }
        }

        const projects = await storage.getAllProjects(defaultFilters);

        const stageStats: Record<string, number> = {};
        for (const project of projects) {
          const stage = project.currentStatus || 'unknown';
          stageStats[stage] = (stageStats[stage] || 0) + 1;
        }

        const cacheData: CachedProjectView = {
          projects: projects,
          stageStats,
          lastRefreshed: new Date().toISOString(),
        };

        await (storage as any).viewCacheStorage.setCachedView(
          user.id,
          preferences?.defaultViewId || 'default',
          cacheData,
          defaultFilters,
          1440
        );

        viewsCached++;
        usersProcessed++;
      } catch (userError) {
        errors.push(`User ${user.id}: ${userError instanceof Error ? userError.message : String(userError)}`);
        usersProcessed++;
      }
    }

    const executionTimeMs = Date.now() - startTime;
    
    return {
      status: errors.length === 0 ? 'success' : 'partial',
      usersProcessed,
      viewsCached,
      errors,
      executionTimeMs,
    };
  } catch (error) {
    return {
      status: 'error',
      usersProcessed,
      viewsCached,
      errors: [error instanceof Error ? error.message : String(error), ...errors],
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export async function invalidateAllViewCaches(): Promise<number> {
  return (storage as any).viewCacheStorage.invalidateAllCache();
}

export async function invalidateUserViewCache(userId: string): Promise<number> {
  return (storage as any).viewCacheStorage.invalidateUserCache(userId);
}
