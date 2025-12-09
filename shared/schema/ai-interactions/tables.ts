import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from '../users/tables';

export const aiInteractionStatusEnum = pgEnum("ai_interaction_status", [
  "success",
  "failed", 
  "partial",
  "clarification_needed"
]);

export const aiInteractions = pgTable("ai_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id"),
  requestText: text("request_text").notNull(),
  intentDetected: varchar("intent_detected"),
  status: aiInteractionStatusEnum("status").notNull().default("failed"),
  resolvedEntityType: varchar("resolved_entity_type"),
  resolvedEntityId: varchar("resolved_entity_id"),
  resolvedEntityName: varchar("resolved_entity_name"),
  responseMessage: text("response_message"),
  confidenceScore: integer("confidence_score"),
  currentViewContext: jsonb("current_view_context"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_interactions_user_id").on(table.userId),
  index("idx_ai_interactions_status").on(table.status),
  index("idx_ai_interactions_intent").on(table.intentDetected),
  index("idx_ai_interactions_created_at").on(table.createdAt),
]);

export const aiFunctionInvocations = pgTable("ai_function_invocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  interactionId: varchar("interaction_id").notNull().references(() => aiInteractions.id, { onDelete: "cascade" }),
  functionName: varchar("function_name").notNull(),
  functionArguments: jsonb("function_arguments"),
  succeeded: boolean("succeeded").notNull().default(false),
  errorCode: varchar("error_code"),
  errorMessage: text("error_message"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_function_invocations_interaction_id").on(table.interactionId),
  index("idx_ai_function_invocations_function_name").on(table.functionName),
  index("idx_ai_function_invocations_succeeded").on(table.succeeded),
]);

export const aiInsights = pgTable("ai_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  totalInteractions: integer("total_interactions").notNull().default(0),
  successfulInteractions: integer("successful_interactions").notNull().default(0),
  failedInteractions: integer("failed_interactions").notNull().default(0),
  topFailedIntents: jsonb("top_failed_intents"),
  aggregatedFailures: jsonb("aggregated_failures"),
  openaiAnalysis: text("openai_analysis"),
  recommendations: jsonb("recommendations"),
  sentToEmail: varchar("sent_to_email"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_insights_week_start").on(table.weekStartDate),
  index("idx_ai_insights_created_at").on(table.createdAt),
]);
