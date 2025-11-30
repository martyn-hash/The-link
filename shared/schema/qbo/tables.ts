import { pgTable, varchar, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
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
