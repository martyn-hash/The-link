import { relations } from 'drizzle-orm';
import { taskInstanceCountsCache } from './tables';
import { projects } from '../projects/tables';

export const taskInstanceCountsCacheRelations = relations(taskInstanceCountsCache, ({ one }) => ({
  project: one(projects, {
    fields: [taskInstanceCountsCache.projectId],
    references: [projects.id],
  }),
}));
