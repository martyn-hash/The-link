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
  unique,
} from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  emailSignature: text("email_signature"),
  isAdmin: boolean("is_admin").default(false),
  canSeeAdminMenu: boolean("can_see_admin_menu").default(false),
  superAdmin: boolean("super_admin").default(false),
  passwordHash: varchar("password_hash"),
  isFallbackUser: boolean("is_fallback_user").default(false),
  pushNotificationsEnabled: boolean("push_notifications_enabled").default(true),
  notificationPreferences: jsonb("notification_preferences"),
  canMakeServicesInactive: boolean("can_make_services_inactive").default(false),
  canMakeProjectsInactive: boolean("can_make_projects_inactive").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  loginTime: timestamp("login_time").notNull().defaultNow(),
  lastActivity: timestamp("last_activity").notNull().defaultNow(),
  logoutTime: timestamp("logout_time"),
  ipAddress: varchar("ip_address"),
  city: varchar("city"),
  country: varchar("country"),
  browser: varchar("browser"),
  device: varchar("device"),
  os: varchar("os"),
  platformType: varchar("platform_type"),
  pushEnabled: boolean("push_enabled").default(false),
  sessionDuration: integer("session_duration"),
  isActive: boolean("is_active").default(true),
}, (table) => [
  index("idx_user_sessions_user_id").on(table.userId),
  index("idx_user_sessions_login_time").on(table.loginTime),
  index("idx_user_sessions_is_active").on(table.isActive),
]);

export const loginAttempts = pgTable("login_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  ipAddress: varchar("ip_address"),
  success: boolean("success").notNull(),
  failureReason: varchar("failure_reason"),
  browser: varchar("browser"),
  os: varchar("os"),
}, (table) => [
  index("idx_login_attempts_email").on(table.email),
  index("idx_login_attempts_timestamp").on(table.timestamp),
  index("idx_login_attempts_success").on(table.success),
]);

export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  notifyStageChanges: boolean("notify_stage_changes").notNull().default(true),
  notifyNewProjects: boolean("notify_new_projects").notNull().default(true),
  notifySchedulingSummary: boolean("notify_scheduling_summary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tokenHash: varchar("token_hash").notNull().unique(),
  codeHash: varchar("code_hash").notNull(),
  email: varchar("email").notNull(),
  expiresAt: timestamp("expires_at").notNull().default(sql`now() + interval '10 minutes'`),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userOauthAccounts = pgTable("user_oauth_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider").notNull(),
  providerAccountId: varchar("provider_account_id").notNull(),
  email: varchar("email").notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  expiresAt: timestamp("expires_at").notNull(),
  scope: varchar("scope"),
  tokenType: varchar("token_type").default("Bearer"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_oauth_accounts_user_id").on(table.userId),
  index("idx_user_oauth_accounts_provider").on(table.provider),
  unique("unique_user_provider").on(table.userId, table.provider),
]);

export const projectViews = pgTable("project_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filters: text("filters").notNull(),
  viewMode: varchar("view_mode").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_project_views_user_id").on(table.userId),
]);

export const companyViews = pgTable("company_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filters: text("filters").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_company_views_user_id").on(table.userId),
]);

export const userColumnPreferences = pgTable("user_column_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  viewType: varchar("view_type").notNull().default("projects"),
  columnOrder: text("column_order").array().notNull(),
  visibleColumns: text("visible_columns").array().notNull(),
  columnWidths: jsonb("column_widths"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_column_preferences_user_id").on(table.userId),
  unique("unique_user_view_type").on(table.userId, table.viewType),
]);

export const dashboards = pgTable("dashboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  filters: text("filters").notNull(),
  widgets: jsonb("widgets").notNull(),
  visibility: varchar("visibility").notNull().default("private"),
  isHomescreenDashboard: boolean("is_homescreen_dashboard").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_dashboards_user_id").on(table.userId),
  index("idx_dashboards_visibility").on(table.visibility),
  index("idx_dashboards_homescreen").on(table.userId, table.isHomescreenDashboard),
]);

export const dashboardCache = pgTable("dashboard_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  myTasksCount: integer("my_tasks_count").notNull().default(0),
  myProjectsCount: integer("my_projects_count").notNull().default(0),
  overdueTasksCount: integer("overdue_tasks_count").notNull().default(0),
  behindScheduleCount: integer("behind_schedule_count").notNull().default(0),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_dashboard_cache_user_id").on(table.userId),
  index("idx_dashboard_cache_last_updated").on(table.lastUpdated),
]);

export const userProjectPreferences = pgTable("user_project_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  defaultViewId: varchar("default_view_id"),
  defaultViewType: varchar("default_view_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_project_preferences_user_id").on(table.userId),
]);
