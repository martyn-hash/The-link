import { pgTable, pgEnum, varchar, text, boolean, integer, timestamp, index, unique, jsonb, real } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "../users/tables";
import { clients, people, clientPortalUsers } from "../clients/tables";
import { messages, messageThreads } from "../communications/tables";

export const signatureRequestStatusEnum = pgEnum("signature_request_status", [
  "draft",
  "pending",
  "partially_signed",
  "completed",
  "cancelled"
]);

export const signatureFieldTypeEnum = pgEnum("signature_field_type", [
  "signature",
  "typed_name"
]);

export const documentFolders = pgTable("document_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  source: varchar("source").notNull().default('direct_upload'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_document_folders_client_id").on(table.clientId),
  index("idx_document_folders_created_at").on(table.createdAt),
]);

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  folderId: varchar("folder_id").references(() => documentFolders.id, { onDelete: "cascade" }),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  clientPortalUserId: varchar("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "cascade" }),
  uploadName: varchar("upload_name"),
  source: varchar("source", {
    enum: ['direct_upload', 'message_attachment', 'task_upload', 'portal_upload', 'signature_request']
  }).notNull().default('direct_upload'),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }),
  threadId: varchar("thread_id").references(() => messageThreads.id, { onDelete: "cascade" }),
  taskInstanceId: varchar("task_instance_id"),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: varchar("file_type").notNull(),
  objectPath: text("object_path").notNull(),
  isPortalVisible: boolean("is_portal_visible").default(true),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => [
  index("idx_documents_client_id").on(table.clientId),
  index("idx_documents_folder_id").on(table.folderId),
  index("idx_documents_uploaded_at").on(table.uploadedAt),
  index("idx_documents_client_portal_user_id").on(table.clientPortalUserId),
  index("idx_documents_message_id").on(table.messageId),
  index("idx_documents_thread_id").on(table.threadId),
  index("idx_documents_task_instance_id").on(table.taskInstanceId),
  index("idx_documents_source").on(table.source),
]);

export const signatureRequests = pgTable("signature_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  friendlyName: varchar("friendly_name").notNull().default("Untitled Document"),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  status: signatureRequestStatusEnum("status").notNull().default("draft"),
  emailSubject: varchar("email_subject"),
  emailMessage: text("email_message"),
  redirectUrl: varchar("redirect_url"),
  reminderEnabled: boolean("reminder_enabled").notNull().default(true),
  reminderIntervalDays: integer("reminder_interval_days").notNull().default(3),
  remindersSentCount: integer("reminders_sent_count").notNull().default(0),
  lastReminderSentAt: timestamp("last_reminder_sent_at"),
  nextReminderDate: timestamp("next_reminder_date"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by").references(() => users.id),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_signature_requests_client_id").on(table.clientId),
  index("idx_signature_requests_document_id").on(table.documentId),
  index("idx_signature_requests_status").on(table.status),
  index("idx_signature_requests_created_by").on(table.createdBy),
]);

export const signatureFields = pgTable("signature_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureRequestId: varchar("signature_request_id").notNull().references(() => signatureRequests.id, { onDelete: "cascade" }),
  recipientPersonId: text("recipient_person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  fieldType: signatureFieldTypeEnum("field_type").notNull(),
  pageNumber: integer("page_number").notNull(),
  xPosition: real("x_position").notNull(),
  yPosition: real("y_position").notNull(),
  width: real("width").notNull(),
  height: real("height").notNull(),
  label: varchar("label"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signature_fields_request_id").on(table.signatureRequestId),
  index("idx_signature_fields_recipient_id").on(table.recipientPersonId),
]);

export const signatureRequestRecipients = pgTable("signature_request_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureRequestId: varchar("signature_request_id").notNull().references(() => signatureRequests.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  email: varchar("email").notNull(),
  secureToken: varchar("secure_token").notNull().unique(),
  tokenExpiresAt: timestamp("token_expires_at").notNull().default(sql`now() + interval '30 days'`),
  sentAt: timestamp("sent_at"),
  sendStatus: varchar("send_status").default('pending'),
  sendError: text("send_error"),
  viewedAt: timestamp("viewed_at"),
  signedAt: timestamp("signed_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  orderIndex: integer("order_index").notNull().default(0),
  activeSessionToken: varchar("active_session_token"),
  sessionLastActive: timestamp("session_last_active"),
  sessionDeviceInfo: varchar("session_device_info"),
  sessionBrowserInfo: varchar("session_browser_info"),
  sessionOsInfo: varchar("session_os_info"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signature_request_recipients_request_id").on(table.signatureRequestId),
  index("idx_signature_request_recipients_person_id").on(table.personId),
  index("idx_signature_request_recipients_token").on(table.secureToken),
  unique("unique_request_recipient").on(table.signatureRequestId, table.personId),
]);

export const signatures = pgTable("signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureFieldId: varchar("signature_field_id").notNull().references(() => signatureFields.id, { onDelete: "cascade" }),
  signatureRequestRecipientId: varchar("signature_request_recipient_id").notNull().references(() => signatureRequestRecipients.id, { onDelete: "cascade" }),
  signatureType: varchar("signature_type").notNull(),
  signatureData: text("signature_data").notNull(),
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signatures_field_id").on(table.signatureFieldId),
  index("idx_signatures_recipient_id").on(table.signatureRequestRecipientId),
]);

export const signatureAuditLogs = pgTable("signature_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureRequestRecipientId: varchar("signature_request_recipient_id").notNull().references(() => signatureRequestRecipients.id, { onDelete: "cascade" }),
  eventType: varchar("event_type").notNull(),
  eventDetails: jsonb("event_details"),
  signerName: varchar("signer_name").notNull(),
  signerEmail: varchar("signer_email").notNull(),
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  deviceInfo: varchar("device_info"),
  browserInfo: varchar("browser_info"),
  osInfo: varchar("os_info"),
  consentAccepted: boolean("consent_accepted").notNull().default(true),
  consentAcceptedAt: timestamp("consent_accepted_at"),
  signedAt: timestamp("signed_at"),
  documentHash: varchar("document_hash").notNull(),
  documentVersion: varchar("document_version").notNull(),
  authMethod: varchar("auth_method").notNull().default("email_link"),
  city: varchar("city"),
  country: varchar("country"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signature_audit_logs_recipient_id").on(table.signatureRequestRecipientId),
  index("idx_signature_audit_logs_signed_at").on(table.signedAt),
]);

export const signedDocuments = pgTable("signed_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureRequestId: varchar("signature_request_id").notNull().references(() => signatureRequests.id, { onDelete: "cascade" }).unique(),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  signedPdfPath: text("signed_pdf_path").notNull(),
  originalPdfHash: varchar("original_pdf_hash").notNull(),
  signedPdfHash: varchar("signed_pdf_hash").notNull(),
  auditTrailPdfPath: text("audit_trail_pdf_path"),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signed_documents_request_id").on(table.signatureRequestId),
  index("idx_signed_documents_client_id").on(table.clientId),
  index("idx_signed_documents_completed_at").on(table.completedAt),
]);
