import { pgTable, pgEnum, varchar, text, boolean, integer, timestamp, index, unique, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "../users/tables";
import { clients, people, clientPortalUsers } from "../clients/tables";
import { projects, projectTypes, kanbanStages } from "../projects/tables";
import { clientServices } from "../services/tables";
import { clientRequestTemplates } from "../requests/tables";
import { taskInstances } from "../tasks/tables";
import { clientProjectTaskTemplates } from "../client-project-tasks/tables";

export const pushTemplateTypeEnum = pgEnum("push_template_type", [
  "new_message_staff",
  "new_message_client",
  "document_request", 
  "task_assigned",
  "project_stage_change",
  "status_update",
  "reminder"
]);

export const notificationTypeEnum = pgEnum("notification_type", ["email", "sms", "push"]);

export const notificationCategoryEnum = pgEnum("notification_category", ["project", "stage"]);

export const dateReferenceEnum = pgEnum("date_reference", ["start_date", "due_date"]);

export const dateOffsetTypeEnum = pgEnum("date_offset_type", ["before", "on", "after"]);

export const stageTriggerEnum = pgEnum("stage_trigger", ["entry", "exit"]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "scheduled", 
  "sent", 
  "failed", 
  "cancelled",
  "suppressed"
]);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  clientPortalUserId: varchar("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  keys: jsonb("keys").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("push_subscriptions_user_id_idx").on(table.userId),
  clientPortalUserIdIdx: index("push_subscriptions_client_portal_user_id_idx").on(table.clientPortalUserId),
  uniqueEndpoint: unique("unique_push_subscription_endpoint").on(table.endpoint),
}));

export const pushNotificationTemplates = pgTable("push_notification_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateType: pushTemplateTypeEnum("template_type").notNull(),
  name: varchar("name").notNull(),
  titleTemplate: varchar("title_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  iconUrl: varchar("icon_url"),
  badgeUrl: varchar("badge_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  templateTypeIdx: index("push_templates_type_idx").on(table.templateType),
}));

export const notificationIcons = pgTable("notification_icons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: varchar("file_name").notNull(),
  storagePath: text("storage_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uploadedByIdx: index("notification_icons_uploaded_by_idx").on(table.uploadedBy),
}));

export const projectTypeNotifications = pgTable("project_type_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }),
  category: notificationCategoryEnum("category").notNull(),
  notificationType: notificationTypeEnum("notification_type").notNull(),
  dateReference: dateReferenceEnum("date_reference"),
  offsetType: dateOffsetTypeEnum("offset_type"),
  offsetDays: integer("offset_days"),
  stageId: varchar("stage_id").references(() => kanbanStages.id, { onDelete: "cascade" }),
  stageTrigger: stageTriggerEnum("stage_trigger"),
  emailTitle: varchar("email_title"),
  emailBody: text("email_body"),
  smsContent: varchar("sms_content", { length: 160 }),
  pushTitle: varchar("push_title", { length: 50 }),
  pushBody: varchar("push_body", { length: 120 }),
  clientRequestTemplateId: varchar("client_request_template_id").references(() => clientRequestTemplates.id, { onDelete: "set null" }),
  taskTemplateId: varchar("task_template_id").references(() => clientProjectTaskTemplates.id, { onDelete: "set null" }),
  eligibleStageIds: text("eligible_stage_ids").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_project_type_notifications_project_type_id").on(table.projectTypeId),
  index("idx_project_type_notifications_stage_id").on(table.stageId),
  index("idx_project_type_notifications_category").on(table.category),
  index("idx_project_type_notifications_client_request_template_id").on(table.clientRequestTemplateId),
  index("idx_project_type_notifications_task_template_id").on(table.taskTemplateId),
  check("check_project_notification_fields", sql`
    (category != 'project' OR (date_reference IS NOT NULL AND offset_type IS NOT NULL AND offset_days IS NOT NULL))
  `),
  check("check_stage_notification_fields", sql`
    (category != 'stage' OR (stage_id IS NOT NULL AND stage_trigger IS NOT NULL))
  `),
  check("check_email_notification_content", sql`
    (notification_type != 'email' OR (email_title IS NOT NULL AND email_body IS NOT NULL))
  `),
  check("check_sms_notification_content", sql`
    (notification_type != 'sms' OR sms_content IS NOT NULL)
  `),
  check("check_push_notification_content", sql`
    (notification_type != 'push' OR (push_title IS NOT NULL AND push_body IS NOT NULL))
  `),
]);

export const clientRequestReminders = pgTable("client_request_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeNotificationId: varchar("project_type_notification_id").notNull().references(() => projectTypeNotifications.id, { onDelete: "cascade" }),
  notificationType: notificationTypeEnum("notification_type").notNull(),
  daysAfterCreation: integer("days_after_creation").notNull(),
  emailTitle: varchar("email_title"),
  emailBody: text("email_body"),
  smsContent: varchar("sms_content", { length: 160 }),
  pushTitle: varchar("push_title", { length: 50 }),
  pushBody: varchar("push_body", { length: 120 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_request_reminders_notification_id").on(table.projectTypeNotificationId),
  check("check_email_reminder_content", sql`
    (notification_type != 'email' OR (email_title IS NOT NULL AND email_body IS NOT NULL))
  `),
  check("check_sms_reminder_content", sql`
    (notification_type != 'sms' OR sms_content IS NOT NULL)
  `),
  check("check_push_reminder_content", sql`
    (notification_type != 'push' OR (push_title IS NOT NULL AND push_body IS NOT NULL))
  `),
]);

export const scheduledNotifications = pgTable("scheduled_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeNotificationId: varchar("project_type_notification_id").references(() => projectTypeNotifications.id, { onDelete: "cascade" }),
  clientRequestReminderId: varchar("client_request_reminder_id").references(() => clientRequestReminders.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  personId: varchar("person_id").references(() => people.id, { onDelete: "cascade" }),
  clientServiceId: varchar("client_service_id").references(() => clientServices.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  taskInstanceId: varchar("task_instance_id").references(() => taskInstances.id, { onDelete: "cascade" }),
  notificationType: notificationTypeEnum("notification_type").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  dateReference: dateReferenceEnum("date_reference"),
  emailTitle: varchar("email_title"),
  emailBody: text("email_body"),
  smsContent: varchar("sms_content", { length: 160 }),
  pushTitle: varchar("push_title", { length: 50 }),
  pushBody: varchar("push_body", { length: 120 }),
  status: notificationStatusEnum("status").notNull().default("scheduled"),
  sentAt: timestamp("sent_at"),
  failureReason: text("failure_reason"),
  cancelledBy: varchar("cancelled_by").references(() => users.id, { onDelete: "set null" }),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  stopReminders: boolean("stop_reminders").default(false),
  eligibleStageIdsSnapshot: text("eligible_stage_ids_snapshot").array(),
  suppressedAt: timestamp("suppressed_at"),
  reactivatedAt: timestamp("reactivated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_scheduled_notifications_project_type_notification_id").on(table.projectTypeNotificationId),
  index("idx_scheduled_notifications_client_request_reminder_id").on(table.clientRequestReminderId),
  index("idx_scheduled_notifications_client_id").on(table.clientId),
  index("idx_scheduled_notifications_person_id").on(table.personId),
  index("idx_scheduled_notifications_client_service_id").on(table.clientServiceId),
  index("idx_scheduled_notifications_project_id").on(table.projectId),
  index("idx_scheduled_notifications_task_instance_id").on(table.taskInstanceId),
  index("idx_scheduled_notifications_scheduled_for").on(table.scheduledFor),
  index("idx_scheduled_notifications_status").on(table.status),
  index("idx_scheduled_notifications_client_status_scheduled").on(table.clientId, table.status, table.scheduledFor),
  index("idx_scheduled_notifications_client_status_sent").on(table.clientId, table.status, table.sentAt),
  index("idx_scheduled_notifications_status_scheduled_for").on(table.status, table.scheduledFor),
  check("check_notification_source", sql`
    (project_type_notification_id IS NOT NULL AND client_request_reminder_id IS NULL) OR
    (project_type_notification_id IS NULL AND client_request_reminder_id IS NOT NULL)
  `),
]);

export const notificationHistory = pgTable("notification_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduledNotificationId: varchar("scheduled_notification_id").references(() => scheduledNotifications.id, { onDelete: "set null" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  recipientEmail: varchar("recipient_email"),
  recipientPhone: varchar("recipient_phone"),
  notificationType: notificationTypeEnum("notification_type").notNull(),
  content: text("content").notNull(),
  status: notificationStatusEnum("status").notNull(),
  sentAt: timestamp("sent_at"),
  failureReason: text("failure_reason"),
  externalId: varchar("external_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notification_history_scheduled_notification_id").on(table.scheduledNotificationId),
  index("idx_notification_history_client_id").on(table.clientId),
  index("idx_notification_history_sent_at").on(table.sentAt),
  index("idx_notification_history_status").on(table.status),
  index("idx_notification_history_notification_type").on(table.notificationType),
  index("idx_notification_history_client_created").on(table.clientId, table.createdAt),
]);

export const smsTemplates = pgTable("sms_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nameIdx: index("sms_templates_name_idx").on(table.name),
}));
