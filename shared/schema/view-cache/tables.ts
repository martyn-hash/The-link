import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
} from "drizzle-orm/pg-core";
import { users } from '../users/tables';

export const projectViewCache = pgTable("project_view_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  viewKey: varchar("view_key").notNull(),
  filterHash: varchar("filter_hash").notNull(),
  cachedData: jsonb("cached_data").notNull(),
  projectCount: varchar("project_count"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_project_view_cache_user_id").on(table.userId),
  index("idx_project_view_cache_view_key").on(table.viewKey),
  index("idx_project_view_cache_user_view").on(table.userId, table.viewKey),
  index("idx_project_view_cache_expires").on(table.expiresAt),
]);
