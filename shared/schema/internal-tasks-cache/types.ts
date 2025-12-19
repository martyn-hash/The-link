import { z } from 'zod';
import { internalTasksCache } from './tables';
import { insertInternalTasksCacheSchema, selectInternalTasksCacheSchema } from './schemas';

export type InternalTasksCache = typeof internalTasksCache.$inferSelect;
export type InsertInternalTasksCache = z.infer<typeof insertInternalTasksCacheSchema>;
export type SelectInternalTasksCache = z.infer<typeof selectInternalTasksCacheSchema>;
