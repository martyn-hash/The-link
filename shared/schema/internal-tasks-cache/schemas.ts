import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { internalTasksCache } from './tables';

export const insertInternalTasksCacheSchema = createInsertSchema(internalTasksCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectInternalTasksCacheSchema = createSelectSchema(internalTasksCache);
