import { storage } from './storage/index';
import type { CachedTaskInstanceCounts } from '@shared/schema';

export interface TaskCountsCacheResult {
  status: 'success' | 'partial' | 'error';
  projectsProcessed: number;
  errors: string[];
  executionTimeMs: number;
}

export async function warmTaskInstanceCountsCache(): Promise<TaskCountsCacheResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let projectsProcessed = 0;

  try {
    const projects = await storage.getAllProjects({ archived: false });
    const projectIds = projects.map((p: any) => p.id);

    if (projectIds.length === 0) {
      return {
        status: 'success',
        projectsProcessed: 0,
        errors: [],
        executionTimeMs: Date.now() - startTime,
      };
    }

    const countsMap = await storage.getPendingClientProjectTaskCountsBatch(projectIds);
    const countsToCache: Array<{ projectId: string; pending: number; awaitingClient: number }> = [];

    for (const projectId of projectIds) {
      const counts = countsMap.get(projectId) || { pending: 0, awaitingClient: 0 };
      countsToCache.push({
        projectId,
        pending: counts.pending,
        awaitingClient: counts.awaitingClient,
      });
    }

    await (storage as any).taskCountsCacheStorage.setBulkCachedCounts(countsToCache);
    projectsProcessed = countsToCache.length;

    const executionTimeMs = Date.now() - startTime;
    
    return {
      status: errors.length === 0 ? 'success' : 'partial',
      projectsProcessed,
      errors,
      executionTimeMs,
    };
  } catch (error) {
    return {
      status: 'error',
      projectsProcessed,
      errors: [error instanceof Error ? error.message : String(error), ...errors],
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export async function getCachedTaskInstanceCounts(): Promise<CachedTaskInstanceCounts> {
  return (storage as any).taskCountsCacheStorage.getAllCachedCounts();
}

export async function markTaskCountsStaleForProjects(projectIds: string[]): Promise<number> {
  return (storage as any).taskCountsCacheStorage.markProjectsStale(projectIds);
}

export async function markAllTaskCountsStale(): Promise<number> {
  return (storage as any).taskCountsCacheStorage.markAllStale();
}

export async function refreshTaskCountsForProject(projectId: string): Promise<void> {
  const countsMap = await storage.getPendingClientProjectTaskCountsBatch([projectId]);
  const counts = countsMap.get(projectId) || { pending: 0, awaitingClient: 0 };
  await (storage as any).taskCountsCacheStorage.setCachedCount(projectId, counts.pending, counts.awaitingClient);
}

export async function hasAnyCachedTaskCounts(): Promise<boolean> {
  return (storage as any).taskCountsCacheStorage.hasAnyCachedData();
}
