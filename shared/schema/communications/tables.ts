import { pgTable, pgEnum, varchar, text, boolean, integer, timestamp, index, unique, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "../users/tables";
import { clients, people, clientPortalUsers } from "../clients/tables";
import { projects, services } from "../../schema";

export const communicationTypeEnum = pgEnum("communication_type", [
  "phone_call",
  "note",
  "sms_sent", 
  "sms_received",
  "email_sent",
  "email_received"
]);

export const integrationTypeEnum = pgEnum("integration_type", [
  "office365",
  "voodoo_sms",
  "ringcentral"
]);

export const threadStatusEnum = pgEnum("thread_status", [
  "open",
  "closed", 
  "archived"
]);

export const viewedEntityTypeEnum = pgEnum("viewed_entity_type", [
  "client", 
  "project", 
  "person", 
  "communication"
]);

export const communications = pgTable("communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  personId: varchar("person_id").references(() => people.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: communicationTypeEnum("type").notNull(),
  subject: varchar("subject"),
  content: text("content").notNull(),
  actualContactTime: timestamp("actual_contact_time").notNull(),
  loggedAt: timestamp("logged_at").defaultNow(),
  metadata: jsonb("metadata"),
  isRead: boolean("is_read").default(true),
  threadId: varchar("thread_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  clientIdLoggedAtIdx: index("communications_client_id_logged_at_idx").on(table.clientId, table.loggedAt),
  personIdLoggedAtIdx: index("communications_person_id_logged_at_idx").on(table.personId, table.loggedAt),
  projectIdLoggedAtIdx: index("communications_project_id_logged_at_idx").on(table.projectId, table.loggedAt),
  threadIdIdx: index("communications_thread_id_idx").on(table.threadId),
}));

export const userIntegrations = pgTable("user_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  integrationType: integrationTypeEnum("integration_type").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueUserIntegrationType: unique("unique_user_integration_type").on(table.userId, table.integrationType),
}));

export const messageThreads = pgTable("message_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  subject: varchar("subject").notNull(),
  status: threadStatusEnum("status").notNull().default('open'),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  lastMessageByStaff: boolean("last_message_by_staff").default(false),
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdByClientPortalUserId: varchar("created_by_client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  clientIdLastMessageIdx: index("message_threads_client_id_last_message_idx").on(table.clientId, table.lastMessageAt),
  statusIdx: index("message_threads_status_idx").on(table.status),
  isArchivedIdx: index("message_threads_is_archived_idx").on(table.isArchived),
  lastMessageByStaffIdx: index("message_threads_last_message_by_staff_idx").on(table.lastMessageByStaff),
}));

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => messageThreads.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  clientPortalUserId: varchar("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "set null" }),
  attachments: jsonb("attachments"),
  isReadByStaff: boolean("is_read_by_staff").default(false),
  isReadByClient: boolean("is_read_by_client").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  threadIdCreatedAtIdx: index("messages_thread_id_created_at_idx").on(table.threadId, table.createdAt),
  isReadByStaffIdx: index("messages_is_read_by_staff_idx").on(table.isReadByStaff),
  isReadByClientIdx: index("messages_is_read_by_client_idx").on(table.isReadByClient),
}));

export const userActivityTracking = pgTable("user_activity_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entityType: viewedEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  viewedAt: timestamp("viewed_at").defaultNow(),
}, (table) => ({
  userViewedAtIdx: index("user_activity_tracking_user_viewed_at_idx").on(table.userId, table.viewedAt),
  uniqueUserEntityView: unique("unique_user_entity_view").on(table.userId, table.entityType, table.entityId),
}));

export const projectMessageThreads = pgTable("project_message_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  topic: varchar("topic").notNull(),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  lastMessageByUserId: varchar("last_message_by_user_id").references(() => users.id, { onDelete: "set null" }),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  projectIdLastMessageIdx: index("project_message_threads_project_id_last_message_idx").on(table.projectId, table.lastMessageAt),
  isArchivedIdx: index("project_message_threads_is_archived_idx").on(table.isArchived),
}));

export const projectMessages = pgTable("project_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => projectMessageThreads.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "set null" }),
  attachments: jsonb("attachments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  threadIdCreatedAtIdx: index("project_messages_thread_id_created_at_idx").on(table.threadId, table.createdAt),
  userIdIdx: index("project_messages_user_id_idx").on(table.userId),
}));

export const projectMessageParticipants = pgTable("project_message_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => projectMessageThreads.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at"),
  lastReadMessageId: varchar("last_read_message_id").references(() => projectMessages.id, { onDelete: "set null" }),
  lastReminderEmailSentAt: timestamp("last_reminder_email_sent_at"),
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  threadIdIdx: index("project_message_participants_thread_id_idx").on(table.threadId),
  userIdIdx: index("project_message_participants_user_id_idx").on(table.userId),
  uniqueThreadUser: unique("unique_project_thread_user").on(table.threadId, table.userId),
}));

export const staffMessageThreads = pgTable("staff_message_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topic: varchar("topic").notNull(),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  lastMessageByUserId: varchar("last_message_by_user_id").references(() => users.id, { onDelete: "set null" }),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  lastMessageIdx: index("staff_message_threads_last_message_idx").on(table.lastMessageAt),
  isArchivedIdx: index("staff_message_threads_is_archived_idx").on(table.isArchived),
}));

export const staffMessages = pgTable("staff_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => staffMessageThreads.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "set null" }),
  attachments: jsonb("attachments"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  threadIdCreatedAtIdx: index("staff_messages_thread_id_created_at_idx").on(table.threadId, table.createdAt),
  userIdIdx: index("staff_messages_user_id_idx").on(table.userId),
}));

export const staffMessageParticipants = pgTable("staff_message_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => staffMessageThreads.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at"),
  lastReadMessageId: varchar("last_read_message_id").references(() => staffMessages.id, { onDelete: "set null" }),
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  threadIdIdx: index("staff_message_participants_thread_id_idx").on(table.threadId),
  userIdIdx: index("staff_message_participants_user_id_idx").on(table.userId),
  uniqueThreadUser: unique("unique_staff_thread_user").on(table.threadId, table.userId),
}));
