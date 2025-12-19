import { createInsertSchema } from 'drizzle-zod';
import { taskInstanceCountsCache } from './tables';

export const insertTaskInstanceCountsCacheSchema = createInsertSchema(taskInstanceCountsCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
