import { pgTable, varchar, text, timestamp, boolean, index, decimal, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../users/tables';
import { projects } from '../projects/tables';
import { queryStatusEnum } from '../enums';

export const bookkeepingQueries = pgTable("bookkeeping_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  date: timestamp("date"),
  description: text("description"),
  moneyIn: decimal("money_in", { precision: 12, scale: 2 }),
  moneyOut: decimal("money_out", { precision: 12, scale: 2 }),
  hasVat: boolean("has_vat"),
  ourQuery: text("our_query"),
  clientResponse: text("client_response"),
  status: queryStatusEnum("status").notNull().default("open"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  answeredById: varchar("answered_by_id").references(() => users.id),
  resolvedById: varchar("resolved_by_id").references(() => users.id),
  sentToClientAt: timestamp("sent_to_client_at"),
  createdAt: timestamp("created_at").defaultNow(),
  answeredAt: timestamp("answered_at"),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("idx_bookkeeping_queries_project_id").on(table.projectId),
  index("idx_bookkeeping_queries_status").on(table.status),
  index("idx_bookkeeping_queries_created_by_id").on(table.createdById),
  index("idx_bookkeeping_queries_sent_to_client_at").on(table.sentToClientAt),
]);

export const queryResponseTokens = pgTable("query_response_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  accessedAt: timestamp("accessed_at"),
  completedAt: timestamp("completed_at"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  recipientName: varchar("recipient_name", { length: 255 }),
  queryCount: integer("query_count").notNull(),
  queryIds: text("query_ids").array(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_query_response_tokens_token").on(table.token),
  index("idx_query_response_tokens_project_id").on(table.projectId),
  index("idx_query_response_tokens_expires_at").on(table.expiresAt),
]);
