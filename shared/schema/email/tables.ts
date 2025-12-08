import { pgTable, pgEnum, varchar, text, boolean, integer, timestamp, index, unique, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "../users/tables";
import { clients, clientEmailAliases, clientDomainAllowlist } from "../clients/tables";

export const emailDirectionEnum = pgEnum("email_direction", ["inbound", "outbound", "internal", "external"]);

export const emailMatchConfidenceEnum = pgEnum("email_match_confidence", ["high", "medium", "low"]);

export const emailSlaStatusEnum = pgEnum("email_sla_status", ["active", "complete", "snoozed"]);

export const emailThreads = pgTable("email_threads", {
  canonicalConversationId: varchar("canonical_conversation_id").primaryKey(),
  threadKey: varchar("thread_key").unique(),
  subject: text("subject"),
  participants: text("participants").array(),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  firstMessageAt: timestamp("first_message_at").notNull(),
  lastMessageAt: timestamp("last_message_at").notNull(),
  messageCount: integer("message_count").default(1),
  latestPreview: text("latest_preview"),
  latestDirection: emailDirectionEnum("latest_direction"),
  slaStatus: emailSlaStatusEnum("sla_status").default("active"),
  slaBecameActiveAt: timestamp("sla_became_active_at"),
  slaCompletedAt: timestamp("sla_completed_at"),
  slaCompletedBy: varchar("sla_completed_by").references(() => users.id, { onDelete: "set null" }),
  slaSnoozeUntil: timestamp("sla_snooze_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_threads_client_id").on(table.clientId),
  index("idx_email_threads_last_message_at").on(table.lastMessageAt),
  index("idx_email_threads_thread_key").on(table.threadKey),
  index("idx_email_threads_sla_status").on(table.slaStatus),
  index("idx_email_threads_sla_became_active_at").on(table.slaBecameActiveAt),
]);

export const emailMessages = pgTable("email_messages", {
  internetMessageId: varchar("internet_message_id").primaryKey(),
  canonicalConversationId: varchar("canonical_conversation_id").notNull().references(() => emailThreads.canonicalConversationId, { onDelete: "cascade" }),
  conversationIdSeen: varchar("conversation_id_seen").notNull(),
  threadKey: varchar("thread_key"),
  threadPosition: integer("thread_position"),
  from: varchar("from").notNull(),
  to: text("to").array(),
  cc: text("cc").array(),
  bcc: text("bcc").array(),
  subject: text("subject"),
  subjectStem: text("subject_stem"),
  body: text("body"),
  bodyPreview: text("body_preview"),
  receivedDateTime: timestamp("received_datetime").notNull(),
  sentDateTime: timestamp("sent_datetime"),
  inReplyTo: varchar("in_reply_to"),
  references: text("references").array(),
  direction: emailDirectionEnum("direction").notNull(),
  isInternalOnly: boolean("is_internal_only").default(false),
  participantCount: integer("participant_count"),
  hasAttachments: boolean("has_attachments").default(false),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  clientMatchConfidence: emailMatchConfidenceEnum("client_match_confidence"),
  mailboxOwnerUserId: varchar("mailbox_owner_user_id").references(() => users.id, { onDelete: "set null" }),
  graphMessageId: varchar("graph_message_id"),
  conversationIndex: text("conversation_index"),
  internetMessageHeaders: jsonb("internet_message_headers"),
  processedAt: timestamp("processed_at").defaultNow(),
  errorCount: integer("error_count").default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_messages_canonical_conversation_id").on(table.canonicalConversationId),
  index("idx_email_messages_thread_key").on(table.threadKey),
  index("idx_email_messages_in_reply_to").on(table.inReplyTo),
  index("idx_email_messages_client_id").on(table.clientId),
  index("idx_email_messages_client_id_received").on(table.clientId, table.receivedDateTime),
  index("idx_email_messages_from").on(table.from),
  index("idx_email_messages_mailbox_owner").on(table.mailboxOwnerUserId),
  index("idx_email_messages_direction").on(table.direction),
  index("idx_email_messages_is_internal_only").on(table.isInternalOnly),
  index("idx_email_messages_received_datetime").on(table.receivedDateTime),
]);

export const mailboxMessageMap = pgTable("mailbox_message_map", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mailboxUserId: varchar("mailbox_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mailboxMessageId: varchar("mailbox_message_id").notNull(),
  internetMessageId: varchar("internet_message_id").notNull().references(() => emailMessages.internetMessageId, { onDelete: "cascade" }),
  folderPath: varchar("folder_path"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_mailbox_graph_message").on(table.mailboxUserId, table.mailboxMessageId),
  unique("unique_mailbox_internet_message").on(table.mailboxUserId, table.internetMessageId),
  index("idx_mailbox_message_map_internet_message_id").on(table.internetMessageId),
  index("idx_mailbox_message_map_mailbox_user").on(table.mailboxUserId),
]);

export const unmatchedEmails = pgTable("unmatched_emails", {
  internetMessageId: varchar("internet_message_id").primaryKey().references(() => emailMessages.internetMessageId, { onDelete: "cascade" }),
  from: varchar("from").notNull(),
  to: text("to").array(),
  cc: text("cc").array(),
  subjectStem: text("subject_stem"),
  inReplyTo: varchar("in_reply_to"),
  references: text("references").array(),
  receivedDateTime: timestamp("received_datetime").notNull(),
  mailboxOwnerUserId: varchar("mailbox_owner_user_id").references(() => users.id, { onDelete: "set null" }),
  direction: emailDirectionEnum("direction").notNull(),
  retryCount: integer("retry_count").default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_unmatched_emails_from").on(table.from),
  index("idx_unmatched_emails_received_datetime").on(table.receivedDateTime),
  index("idx_unmatched_emails_in_reply_to").on(table.inReplyTo),
  index("idx_unmatched_emails_retry_count").on(table.retryCount),
]);

// Re-export client email tables from clients domain for backward compatibility
export { clientEmailAliases, clientDomainAllowlist };

export const emailAttachments = pgTable("email_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentHash: varchar("content_hash").notNull().unique(),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  contentType: varchar("content_type").notNull(),
  objectPath: text("object_path").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_email_attachments_content_hash").on(table.contentHash),
]);

export const emailMessageAttachments = pgTable("email_message_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  internetMessageId: varchar("internet_message_id").notNull().references(() => emailMessages.internetMessageId, { onDelete: "cascade" }),
  attachmentId: varchar("attachment_id").notNull().references(() => emailAttachments.id, { onDelete: "cascade" }),
  attachmentIndex: integer("attachment_index"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_message_attachment").on(table.internetMessageId, table.attachmentId),
  index("idx_email_message_attachments_message_id").on(table.internetMessageId),
  index("idx_email_message_attachments_attachment_id").on(table.attachmentId),
]);

export const graphWebhookSubscriptions = pgTable("graph_webhook_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").notNull().unique(),
  resource: varchar("resource").notNull(),
  changeType: varchar("change_type").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  clientState: varchar("client_state"),
  isActive: boolean("is_active").default(true),
  lastRenewedAt: timestamp("last_renewed_at"),
  lastNotificationAt: timestamp("last_notification_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_graph_subscriptions_user_id").on(table.userId),
  index("idx_graph_subscriptions_expires_at").on(table.expiresAt),
  index("idx_graph_subscriptions_is_active").on(table.isActive),
]);

export const graphSyncState = pgTable("graph_sync_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  folderPath: varchar("folder_path").notNull(),
  deltaLink: text("delta_link"),
  lastSyncAt: timestamp("last_sync_at"),
  lastMessageCount: integer("last_message_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_user_folder_sync").on(table.userId, table.folderPath),
  index("idx_graph_sync_state_user_id").on(table.userId),
  index("idx_graph_sync_state_last_sync").on(table.lastSyncAt),
]);
