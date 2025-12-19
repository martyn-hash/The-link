import { relations } from 'drizzle-orm';
import { internalTasksCache } from './tables';
import { users } from '../users/tables';

export const internalTasksCacheRelations = relations(internalTasksCache, ({ one }) => ({
  user: one(users, {
    fields: [internalTasksCache.userId],
    references: [users.id],
  }),
}));
