import { pgTable, varchar, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../users/tables';

export const auditChangelog = pgTable("audit_changelog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  changeType: varchar("change_type").notNull(),
  changedByUserId: varchar("changed_by_user_id").notNull().references(() => users.id),
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value"),
  changeDescription: text("change_description"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_audit_changelog_entity").on(table.entityType, table.entityId),
  index("idx_audit_changelog_changed_by").on(table.changedByUserId),
  index("idx_audit_changelog_timestamp").on(table.timestamp),
  index("idx_audit_changelog_change_type").on(table.changeType),
]);
