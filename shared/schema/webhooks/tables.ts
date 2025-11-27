import { pgTable, pgEnum, varchar, text, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "../users/tables";
import { clients } from "../clients/tables";

export const webhookStatusEnum = pgEnum("webhook_status", [
  "pending",
  "success", 
  "failed"
]);

export const webhookConfigs = pgTable("webhook_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  webhookUrl: text("webhook_url").notNull(),
  updateWebhookUrl: text("update_webhook_url"),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  requiredClientFields: text("required_client_fields").array().default(sql`'{}'::text[]`),
  requiredPersonFields: text("required_person_fields").array().default(sql`'{}'::text[]`),
  includedClientFields: text("included_client_fields").array().default(sql`'{}'::text[]`),
  includedPersonFields: text("included_person_fields").array().default(sql`'{}'::text[]`),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_webhook_configs_is_enabled").on(table.isEnabled),
  index("idx_webhook_configs_created_by").on(table.createdBy),
]);

export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookConfigId: varchar("webhook_config_id").notNull().references(() => webhookConfigs.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  triggeredBy: varchar("triggered_by").notNull().references(() => users.id, { onDelete: "set null" }),
  payload: jsonb("payload").notNull(),
  status: webhookStatusEnum("status").notNull().default("pending"),
  responseCode: varchar("response_code"),
  responseBody: text("response_body"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow(),
}, (table) => [
  index("idx_webhook_logs_webhook_config_id").on(table.webhookConfigId),
  index("idx_webhook_logs_client_id").on(table.clientId),
  index("idx_webhook_logs_triggered_by").on(table.triggeredBy),
  index("idx_webhook_logs_status").on(table.status),
  index("idx_webhook_logs_sent_at").on(table.sentAt),
  index("idx_webhook_logs_client_sent_at").on(table.clientId, table.sentAt),
]);
