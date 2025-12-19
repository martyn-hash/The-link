import { z } from 'zod';
import type { taskInstanceCountsCache } from './tables';
import { insertTaskInstanceCountsCacheSchema } from './schemas';

export type TaskInstanceCountsCache = typeof taskInstanceCountsCache.$inferSelect;
export type InsertTaskInstanceCountsCache = z.infer<typeof insertTaskInstanceCountsCacheSchema>;

export interface CachedTaskInstanceCounts {
  counts: Record<string, { pending: number; awaitingClient: number }>;
  lastRefreshed: string;
  isStale: boolean;
  staleAt: string | null;
}
