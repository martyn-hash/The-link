import { pgTable, varchar, text, timestamp, boolean, integer, PgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const projectTypes = pgTable("project_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  serviceId: varchar("service_id"),
  active: boolean("active").default(true),
  notificationsActive: boolean("notifications_active").default(true),
  singleProjectPerClient: boolean("single_project_per_client").default(false),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
