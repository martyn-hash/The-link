import { pgTable, varchar, text, timestamp, boolean, index, decimal, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../users/tables';
import { projects } from '../projects/tables';
import { clients } from '../clients/tables';
import { queryStatusEnum } from '../enums';

// Reminder channel enum (email, sms, voice)
export const reminderChannelEnum = pgEnum('reminder_channel', ['email', 'sms', 'voice']);

// Reminder status enum
export const reminderStatusEnum = pgEnum('reminder_status', ['pending', 'sent', 'failed', 'cancelled', 'skipped']);

// Answered by type enum (for suggestion history)
export const answeredByTypeEnum = pgEnum('answered_by_type', ['staff', 'client']);

export interface QueryAttachment {
  objectPath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export const queryGroups = pgTable("query_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  groupName: varchar("group_name", { length: 255 }).notNull(),
  description: text("description"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_query_groups_project_id").on(table.projectId),
]);

export const bookkeepingQueries = pgTable("bookkeeping_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  groupId: varchar("group_id").references(() => queryGroups.id, { onDelete: "set null" }),
  date: timestamp("date"),
  description: text("description"),
  moneyIn: decimal("money_in", { precision: 12, scale: 2 }),
  moneyOut: decimal("money_out", { precision: 12, scale: 2 }),
  hasVat: boolean("has_vat"),
  ourQuery: text("our_query"),
  comment: text("comment"),
  clientResponse: text("client_response"),
  clientAttachments: jsonb("client_attachments").$type<QueryAttachment[]>(),
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
  index("idx_bookkeeping_queries_group_id").on(table.groupId),
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

// Scheduled reminders for query follow-up (email, SMS, voice)
export const scheduledQueryReminders = pgTable("scheduled_query_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => queryResponseTokens.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  channel: reminderChannelEnum("channel").notNull(),
  status: reminderStatusEnum("status").notNull().default("pending"),
  recipientPhone: varchar("recipient_phone", { length: 50 }),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  recipientName: varchar("recipient_name", { length: 255 }),
  message: text("message"),
  messageIntro: text("message_intro"),
  messageSignoff: text("message_signoff"),
  queriesRemaining: integer("queries_remaining"),
  queriesTotal: integer("queries_total"),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  dialoraCallId: varchar("dialora_call_id", { length: 255 }),
  cancelledById: varchar("cancelled_by_id").references(() => users.id),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_scheduled_query_reminders_token_id").on(table.tokenId),
  index("idx_scheduled_query_reminders_project_id").on(table.projectId),
  index("idx_scheduled_query_reminders_scheduled_at").on(table.scheduledAt),
  index("idx_scheduled_query_reminders_status").on(table.status),
]);

// Query answer history for auto-suggest feature
export const queryAnswerHistory = pgTable("query_answer_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  descriptionPrefix: varchar("description_prefix", { length: 100 }).notNull(),
  moneyDirection: varchar("money_direction", { length: 10 }),
  answerText: text("answer_text").notNull(),
  answeredByType: answeredByTypeEnum("answered_by_type").notNull(),
  answeredById: varchar("answered_by_id").references(() => users.id),
  answeredAt: timestamp("answered_at").notNull(),
  sourceQueryId: varchar("source_query_id").notNull().references(() => bookkeepingQueries.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_query_answer_history_client_prefix").on(table.clientId, table.descriptionPrefix),
  index("idx_query_answer_history_prefix").on(table.descriptionPrefix),
  index("idx_query_answer_history_source_query").on(table.sourceQueryId),
]);
