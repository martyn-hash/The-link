import { z } from 'zod';
import type { projectViewCache } from './tables';
import { insertProjectViewCacheSchema } from './schemas';

export type ProjectViewCache = typeof projectViewCache.$inferSelect;
export type InsertProjectViewCache = z.infer<typeof insertProjectViewCacheSchema>;

export interface CachedProjectView {
  projects: any[];
  stageStats: Record<string, number>;
  lastRefreshed: string;
}
