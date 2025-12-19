import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { projects } from '../projects/tables';

export const taskInstanceCountsCache = pgTable("task_instance_counts_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  pendingCount: integer("pending_count").notNull().default(0),
  awaitingClientCount: integer("awaiting_client_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isStale: boolean("is_stale").default(false),
  staleAt: timestamp("stale_at"),
}, (table) => [
  index("idx_task_counts_cache_project_id").on(table.projectId),
  index("idx_task_counts_cache_stale").on(table.isStale),
]);
