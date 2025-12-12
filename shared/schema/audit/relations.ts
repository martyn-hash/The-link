import { relations } from 'drizzle-orm';
import { auditChangelog } from './tables';
import { users } from '../users/tables';

export const auditChangelogRelations = relations(auditChangelog, ({ one }) => ({
  changedBy: one(users, {
    fields: [auditChangelog.changedByUserId],
    references: [users.id],
  }),
}));
