import { pgTable, varchar, text, timestamp, boolean, index, integer, decimal, jsonb, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from '../clients/tables';
import { users } from '../users/tables';

export const qboConnections = pgTable("qbo_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  realmId: varchar("realm_id").notNull(),
  companyName: varchar("company_name"),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at").notNull(),
  scope: varchar("scope"),
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  lastErrorMessage: text("last_error_message"),
  connectedBy: varchar("connected_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_qbo_connections_client_id").on(table.clientId),
  index("idx_qbo_connections_realm_id").on(table.realmId),
  index("idx_qbo_connections_is_active").on(table.isActive),
]);

export const qboOAuthStates = pgTable("qbo_oauth_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  state: varchar("state").notNull().unique(),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_qbo_oauth_states_state").on(table.state),
  index("idx_qbo_oauth_states_expires_at").on(table.expiresAt),
]);

export const qboQcRuns = pgTable("qbo_qc_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  connectionId: varchar("connection_id").notNull().references(() => qboConnections.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  status: varchar("status").notNull().default('pending'),
  totalChecks: integer("total_checks").default(0),
  passedChecks: integer("passed_checks").default(0),
  warningChecks: integer("warning_checks").default(0),
  failedChecks: integer("failed_checks").default(0),
  blockedChecks: integer("blocked_checks").default(0),
  score: decimal("score", { precision: 5, scale: 2 }),
  apiCallCount: integer("api_call_count").default(0),
  triggeredBy: varchar("triggered_by").references(() => users.id),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorLog: text("error_log"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_qbo_qc_runs_client_id").on(table.clientId),
  index("idx_qbo_qc_runs_connection_id").on(table.connectionId),
  index("idx_qbo_qc_runs_status").on(table.status),
  index("idx_qbo_qc_runs_created_at").on(table.createdAt),
]);

export const qboQcResults = pgTable("qbo_qc_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => qboQcRuns.id, { onDelete: "cascade" }),
  checkCode: varchar("check_code").notNull(),
  checkName: varchar("check_name").notNull(),
  section: varchar("section").notNull(),
  status: varchar("status").notNull(),
  value: text("value"),
  expected: text("expected"),
  summary: text("summary"),
  metadata: jsonb("metadata"),
  itemCount: integer("item_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_qbo_qc_results_run_id").on(table.runId),
  index("idx_qbo_qc_results_check_code").on(table.checkCode),
  index("idx_qbo_qc_results_status").on(table.status),
]);

export const qboQcResultItems = pgTable("qbo_qc_result_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resultId: varchar("result_id").notNull().references(() => qboQcResults.id, { onDelete: "cascade" }),
  externalId: varchar("external_id"),
  externalType: varchar("external_type"),
  label: varchar("label").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  txnDate: date("txn_date"),
  approvalStatus: varchar("approval_status").notNull().default('pending'),
  approvedBy: varchar("approved_by").references(() => users.id),
  resolutionNote: text("resolution_note"),
  resolvedAt: timestamp("resolved_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_qbo_qc_result_items_result_id").on(table.resultId),
  index("idx_qbo_qc_result_items_approval_status").on(table.approvalStatus),
  index("idx_qbo_qc_result_items_external_id").on(table.externalId),
]);

export const qboQcApprovalHistory = pgTable("qbo_qc_approval_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").notNull().references(() => qboQcResultItems.id, { onDelete: "cascade" }),
  action: varchar("action").notNull(),
  previousStatus: varchar("previous_status"),
  newStatus: varchar("new_status"),
  note: text("note"),
  performedBy: varchar("performed_by").notNull().references(() => users.id),
  performedAt: timestamp("performed_at").defaultNow(),
}, (table) => [
  index("idx_qbo_qc_approval_history_item_id").on(table.itemId),
  index("idx_qbo_qc_approval_history_performed_at").on(table.performedAt),
]);
