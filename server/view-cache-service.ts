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
        const userViews = await storage.getProjectViewsByUserId(user.id);
        
        let defaultFilters: Record<string, any> = {
          archived: false,
          inactive: false,
          showCompletedRegardless: false,
        };
        
        if (preferences?.defaultViewId && preferences.defaultViewType === 'saved') {
          const savedView = userViews.find(v => v.id === preferences.defaultViewId);
          if (savedView?.filters) {
            defaultFilters = {
              archived: false,
              inactive: false,
              showCompletedRegardless: false,
              ...(savedView.filters as Record<string, any>),
            };
          }
        }

        const defaultProjects = await storage.getAllProjects(defaultFilters);
        const defaultStageStats: Record<string, number> = {};
        for (const project of defaultProjects) {
          const stage = project.currentStatus || 'unknown';
          defaultStageStats[stage] = (defaultStageStats[stage] || 0) + 1;
        }
        const defaultCacheData: CachedProjectView = {
          projects: defaultProjects,
          stageStats: defaultStageStats,
          lastRefreshed: new Date().toISOString(),
        };
        await (storage as any).viewCacheStorage.setCachedView(
          user.id,
          'default',
          defaultCacheData,
          defaultFilters,
          1440
        );
        viewsCached++;

        for (const view of userViews) {
          try {
            const viewFilters: Record<string, any> = {
              archived: false,
              inactive: false,
              showCompletedRegardless: false,
              ...(view.filters as Record<string, any> || {}),
            };
            
            const projects = await storage.getAllProjects(viewFilters);
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
              view.id,
              cacheData,
              viewFilters,
              1440
            );
            viewsCached++;
          } catch (viewError) {
            errors.push(`User ${user.id} View ${view.id}: ${viewError instanceof Error ? viewError.message : String(viewError)}`);
          }
        }

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
