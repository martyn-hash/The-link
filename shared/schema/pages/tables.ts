import { pgTable, varchar, text, timestamp, boolean, index, unique, jsonb, integer, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../users/tables';
import { clients, people } from '../clients/tables';
import { campaigns, campaignRecipients } from '../campaigns/tables';

export const pageComponentTypeEnum = pgEnum('page_component_type', [
  'text_block', 'heading', 'image', 'table', 'button', 'form',
  'callout', 'status_widget', 'timeline', 'faq_accordion',
  'comparison_table', 'video_embed', 'document_list', 'spacer'
]);

export const pageActionTypeEnum = pgEnum('page_action_type', [
  'interested', 'not_interested', 'documents_uploaded', 'book_call',
  'request_callback', 'confirm_details', 'request_extension',
  'custom_form', 'custom_webhook'
]);

export const pageTemplates = pgTable("page_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category"),
  layoutType: varchar("layout_type"),
  headerTitle: varchar("header_title"),
  headerSubtitle: text("header_subtitle"),
  themeColor: varchar("theme_color"),
  componentsTemplate: jsonb("components_template"),
  actionsTemplate: jsonb("actions_template"),
  isActive: boolean("is_active").default(true),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_page_templates_category").on(table.category),
  index("idx_page_templates_is_active").on(table.isActive),
]);

export const pages = pgTable("pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull(),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  templateId: varchar("template_id").references(() => pageTemplates.id),
  layoutType: varchar("layout_type").default('single_column'),
  headerTitle: varchar("header_title"),
  headerSubtitle: text("header_subtitle"),
  headerImagePath: varchar("header_image_path"),
  themeColor: varchar("theme_color"),
  backgroundColor: varchar("background_color"),
  isPublished: boolean("is_published").default(false),
  expiresAt: timestamp("expires_at"),
  requiresOtp: boolean("requires_otp").default(false),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pages_campaign").on(table.campaignId),
  index("idx_pages_slug").on(table.slug),
  index("idx_pages_is_published").on(table.isPublished),
  unique("unique_page_slug").on(table.slug),
]);

export const pageComponents = pgTable("page_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  componentType: pageComponentTypeEnum("component_type").notNull(),
  sectionIndex: integer("section_index").default(0),
  rowIndex: integer("row_index").default(0),
  columnIndex: integer("column_index").default(0),
  columnSpan: integer("column_span").default(1),
  content: jsonb("content"),
  sortOrder: integer("sort_order").default(0),
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_page_components_page").on(table.pageId),
  index("idx_page_components_section").on(table.sectionIndex),
  index("idx_page_components_sort").on(table.sortOrder),
]);

export const pageActions = pgTable("page_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  componentId: varchar("component_id").references(() => pageComponents.id),
  actionType: pageActionTypeEnum("action_type").notNull(),
  label: varchar("label").notNull(),
  description: text("description"),
  config: jsonb("config"),
  requiresOtp: boolean("requires_otp").default(false),
  successMessage: varchar("success_message"),
  successRedirectUrl: varchar("success_redirect_url"),
  isEnabled: boolean("is_enabled").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_page_actions_page").on(table.pageId),
  index("idx_page_actions_action_type").on(table.actionType),
]);

export const pageVisits = pgTable("page_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  recipientId: varchar("recipient_id").references(() => campaignRecipients.id),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  personId: varchar("person_id").notNull().references(() => people.id),
  visitToken: varchar("visit_token").notNull(),
  otpVerifiedAt: timestamp("otp_verified_at"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  referrer: varchar("referrer"),
  firstViewedAt: timestamp("first_viewed_at").defaultNow(),
  lastViewedAt: timestamp("last_viewed_at").defaultNow(),
  viewCount: integer("view_count").default(1),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_page_visits_page").on(table.pageId),
  index("idx_page_visits_recipient").on(table.recipientId),
  index("idx_page_visits_token").on(table.visitToken),
  index("idx_page_visits_client").on(table.clientId),
]);

export const pageActionLogs = pgTable("page_action_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  actionId: varchar("action_id").notNull().references(() => pageActions.id, { onDelete: "cascade" }),
  visitId: varchar("visit_id").notNull().references(() => pageVisits.id, { onDelete: "cascade" }),
  recipientId: varchar("recipient_id").references(() => campaignRecipients.id),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  personId: varchar("person_id").notNull().references(() => people.id),
  actionData: jsonb("action_data"),
  resultData: jsonb("result_data"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_page_action_logs_page").on(table.pageId),
  index("idx_page_action_logs_action").on(table.actionId),
  index("idx_page_action_logs_client").on(table.clientId),
  index("idx_page_action_logs_timestamp").on(table.timestamp),
]);
