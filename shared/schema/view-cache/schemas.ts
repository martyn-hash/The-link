import { createInsertSchema } from 'drizzle-zod';
import { projectViewCache } from './tables';

export const insertProjectViewCacheSchema = createInsertSchema(projectViewCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
