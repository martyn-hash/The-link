import { relations } from 'drizzle-orm';
import { projectViewCache } from './tables';
import { users } from '../users/tables';

export const projectViewCacheRelations = relations(projectViewCache, ({ one }) => ({
  user: one(users, {
    fields: [projectViewCache.userId],
    references: [users.id],
  }),
}));
