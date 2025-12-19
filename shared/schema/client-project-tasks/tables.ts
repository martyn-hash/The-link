import { pgTable, varchar, text, timestamp, boolean, index, integer, jsonb, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../users/tables';
import { projects, kanbanStages, changeReasons } from '../projects/tables';
import { projectTypes } from '../projects/base';
import { clients } from '../clients/tables';
import { systemFieldLibrary } from '../system-field-library/tables';
import { clientProjectTaskStatusEnum, taskQuestionSourceEnum, questionTypeEnum } from '../enums';

export interface TaskFileAttachment {
  objectPath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface StageChangeRule {
  ifStageId: string;
  thenStageId: string;
  thenReasonId?: string | null;
}

export const clientProjectTaskTemplates = pgTable("client_project_task_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  instructions: text("instructions"),
  onCompletionStageId: varchar("on_completion_stage_id").references(() => kanbanStages.id, { onDelete: "set null" }),
  onCompletionStageReasonId: varchar("on_completion_stage_reason_id").references(() => changeReasons.id, { onDelete: "set null" }),
  stageChangeRules: jsonb("stage_change_rules").$type<StageChangeRule[]>(),
  requireAllQuestions: boolean("require_all_questions").default(true),
  expiryDaysAfterStart: integer("expiry_days_after_start").default(7),
  requireOtp: boolean("require_otp").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cpt_templates_project_type_id").on(table.projectTypeId),
  index("idx_cpt_templates_is_active").on(table.isActive),
]);

export const clientProjectTaskSections = pgTable("client_project_task_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => clientProjectTaskTemplates.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cpt_sections_template_id").on(table.templateId),
  index("idx_cpt_sections_order").on(table.templateId, table.order),
]);

export const clientProjectTaskQuestions = pgTable("client_project_task_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => clientProjectTaskTemplates.id, { onDelete: "cascade" }),
  sectionId: varchar("section_id").references(() => clientProjectTaskSections.id, { onDelete: "set null" }),
  libraryFieldId: varchar("library_field_id").references(() => systemFieldLibrary.id, { onDelete: "set null" }),
  questionType: questionTypeEnum("question_type").notNull(),
  label: varchar("label", { length: 500 }).notNull(),
  helpText: text("help_text"),
  isRequired: boolean("is_required").default(false),
  order: integer("order").notNull(),
  options: text("options").array(),
  placeholder: varchar("placeholder", { length: 255 }),
  conditionalLogic: jsonb("conditional_logic"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cpt_questions_template_id").on(table.templateId),
  index("idx_cpt_questions_section_id").on(table.sectionId),
  index("idx_cpt_questions_order").on(table.templateId, table.order),
]);

export const clientProjectTaskOverrides = pgTable("client_project_task_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  baseTemplateId: varchar("base_template_id").notNull().references(() => clientProjectTaskTemplates.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  instructions: text("instructions"),
  onCompletionStageId: varchar("on_completion_stage_id").references(() => kanbanStages.id, { onDelete: "set null" }),
  onCompletionStageReasonId: varchar("on_completion_stage_reason_id").references(() => changeReasons.id, { onDelete: "set null" }),
  removedQuestionIds: text("removed_question_ids").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cpt_overrides_client_id").on(table.clientId),
  index("idx_cpt_overrides_base_template_id").on(table.baseTemplateId),
  unique("unique_client_template_override").on(table.clientId, table.baseTemplateId),
]);

export const clientProjectTaskOverrideQuestions = pgTable("client_project_task_override_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  overrideId: varchar("override_id").notNull().references(() => clientProjectTaskOverrides.id, { onDelete: "cascade" }),
  libraryFieldId: varchar("library_field_id").references(() => systemFieldLibrary.id, { onDelete: "set null" }),
  questionType: questionTypeEnum("question_type").notNull(),
  label: varchar("label", { length: 500 }).notNull(),
  helpText: text("help_text"),
  isRequired: boolean("is_required").default(false),
  order: integer("order").notNull(),
  options: text("options").array(),
  placeholder: varchar("placeholder", { length: 255 }),
  conditionalLogic: jsonb("conditional_logic"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cpt_override_questions_override_id").on(table.overrideId),
  index("idx_cpt_override_questions_order").on(table.overrideId, table.order),
]);

export const clientProjectTaskInstances = pgTable("client_project_task_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  templateId: varchar("template_id").notNull().references(() => clientProjectTaskTemplates.id, { onDelete: "restrict" }),
  overrideId: varchar("override_id").references(() => clientProjectTaskOverrides.id, { onDelete: "set null" }),
  scheduledNotificationId: varchar("scheduled_notification_id"),
  status: clientProjectTaskStatusEnum("status").notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  startedAt: timestamp("started_at"),
  submittedAt: timestamp("submitted_at"),
  completedByName: varchar("completed_by_name", { length: 255 }),
  completedByEmail: varchar("completed_by_email", { length: 255 }),
  stageChangeCompletedAt: timestamp("stage_change_completed_at"),
  preProjectTargetStageId: varchar("pre_project_target_stage_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cpt_instances_project_id").on(table.projectId),
  index("idx_cpt_instances_client_id").on(table.clientId),
  index("idx_cpt_instances_template_id").on(table.templateId),
  index("idx_cpt_instances_status").on(table.status),
  index("idx_cpt_instances_override_id").on(table.overrideId),
]);

export const clientProjectTaskResponses = pgTable("client_project_task_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull().references(() => clientProjectTaskInstances.id, { onDelete: "cascade" }),
  questionId: varchar("question_id").notNull(),
  questionSource: taskQuestionSourceEnum("question_source").notNull(),
  valueText: text("value_text"),
  valueNumber: integer("value_number"),
  valueDate: timestamp("value_date"),
  valueBoolean: boolean("value_boolean"),
  valueMultiSelect: text("value_multi_select").array(),
  valueFile: jsonb("value_file").$type<TaskFileAttachment>(),
  answeredAt: timestamp("answered_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cpt_responses_instance_id").on(table.instanceId),
  index("idx_cpt_responses_question_id").on(table.questionId),
  unique("unique_instance_question_response").on(table.instanceId, table.questionId),
]);

export const clientProjectTaskTokens = pgTable("client_project_task_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull().references(() => clientProjectTaskInstances.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  accessedAt: timestamp("accessed_at"),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  recipientName: varchar("recipient_name", { length: 255 }),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  isReissued: boolean("is_reissued").default(false),
  otpVerifiedAt: timestamp("otp_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cpt_tokens_instance_id").on(table.instanceId),
  index("idx_cpt_tokens_token").on(table.token),
  index("idx_cpt_tokens_expires_at").on(table.expiresAt),
]);

export const clientProjectTaskOtps = pgTable("client_project_task_otps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().references(() => clientProjectTaskTokens.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cpt_otps_token_id").on(table.tokenId),
  index("idx_cpt_otps_expires_at").on(table.expiresAt),
]);
