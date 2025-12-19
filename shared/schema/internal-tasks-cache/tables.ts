import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from '../users/tables';

export const internalTasksCache = pgTable("internal_tasks_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cachedTasks: jsonb("cached_tasks").notNull().default([]),
  cachedReminders: jsonb("cached_reminders").notNull().default([]),
  taskCount: varchar("task_count"),
  reminderCount: varchar("reminder_count"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isStale: boolean("is_stale").default(false),
  staleAt: timestamp("stale_at"),
}, (table) => [
  index("idx_internal_tasks_cache_user_id").on(table.userId),
  index("idx_internal_tasks_cache_stale").on(table.isStale),
]);
