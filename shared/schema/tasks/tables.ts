import { pgTable, varchar, text, boolean, integer, timestamp, index, unique, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "../users/tables";
import { clients, people, clientPortalUsers } from "../clients/tables";
import { internalTaskStatusEnum, internalTaskPriorityEnum, taskInstanceStatusEnum } from "../enums";
import { clientRequestTemplates, clientCustomRequests } from "../requests/tables";

export { taskInstanceStatusEnum, internalTaskStatusEnum, internalTaskPriorityEnum };

export const taskInstances = pgTable("task_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => clientRequestTemplates.id),
  customRequestId: varchar("custom_request_id").references(() => clientCustomRequests.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  personId: varchar("person_id").references(() => people.id, { onDelete: "cascade" }),
  clientPortalUserId: varchar("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "cascade" }),
  status: taskInstanceStatusEnum("status").notNull().default("not_started"),
  assignedBy: varchar("assigned_by").references(() => users.id),
  dueDate: timestamp("due_date"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_instances_template_id").on(table.templateId),
  index("idx_task_instances_custom_request_id").on(table.customRequestId),
  index("idx_task_instances_client_id").on(table.clientId),
  index("idx_task_instances_person_id").on(table.personId),
  index("idx_task_instances_client_portal_user_id").on(table.clientPortalUserId),
  index("idx_task_instances_status").on(table.status),
]);

export const taskInstanceResponses = pgTable("task_instance_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskInstanceId: varchar("task_instance_id").notNull().references(() => taskInstances.id, { onDelete: "cascade" }),
  questionId: varchar("question_id").notNull(),
  responseValue: text("response_value"),
  fileUrls: text("file_urls").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_instance_responses_task_instance_id").on(table.taskInstanceId),
  index("idx_task_instance_responses_question_id").on(table.questionId),
  unique("unique_task_instance_question").on(table.taskInstanceId, table.questionId),
]);

export const taskTypes = pgTable("task_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const internalTasks = pgTable("internal_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  status: internalTaskStatusEnum("status").notNull().default("open"),
  priority: internalTaskPriorityEnum("priority").notNull().default("low"),
  taskTypeId: varchar("task_type_id").references(() => taskTypes.id, { onDelete: "set null" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  assignedTo: varchar("assigned_to").notNull().references(() => users.id),
  dueDate: timestamp("due_date").notNull(),
  closedAt: timestamp("closed_at"),
  closedBy: varchar("closed_by").references(() => users.id),
  closureNote: text("closure_note"),
  totalTimeSpentMinutes: integer("total_time_spent_minutes").default(0),
  isQuickReminder: boolean("is_quick_reminder").default(false),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_internal_tasks_status").on(table.status),
  index("idx_internal_tasks_priority").on(table.priority),
  index("idx_internal_tasks_created_by").on(table.createdBy),
  index("idx_internal_tasks_assigned_to").on(table.assignedTo),
  index("idx_internal_tasks_task_type_id").on(table.taskTypeId),
  index("idx_internal_tasks_due_date").on(table.dueDate),
  index("idx_internal_tasks_is_quick_reminder").on(table.isQuickReminder),
  index("idx_internal_tasks_is_archived").on(table.isArchived),
]);

export const taskConnections = pgTable("task_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => internalTasks.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_task_connections_task_id").on(table.taskId),
  index("idx_task_connections_entity").on(table.entityType, table.entityId),
]);

export const taskProgressNotes = pgTable("task_progress_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => internalTasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_task_progress_notes_task_id").on(table.taskId),
  index("idx_task_progress_notes_user_id").on(table.userId),
  index("idx_task_progress_notes_created_at").on(table.createdAt),
]);

export const taskTimeEntries = pgTable("task_time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => internalTasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_task_time_entries_task_id").on(table.taskId),
  index("idx_task_time_entries_user_id").on(table.userId),
  index("idx_task_time_entries_start_time").on(table.startTime),
]);

export const taskDocuments = pgTable("task_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => internalTasks.id, { onDelete: "cascade" }),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  storagePath: varchar("storage_path").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_task_documents_task_id").on(table.taskId),
  index("idx_task_documents_uploaded_by").on(table.uploadedBy),
]);
