import { pgTable, varchar, text, boolean, integer, timestamp, index, jsonb, check, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "../users/tables";
import { clients } from "../clients/tables";
import { questionTypeEnum, riskLevelEnum, riskResponseEnum } from "../enums";
import { projectTypeNotifications, notificationTypeEnum } from "../../schema";

export { questionTypeEnum, riskLevelEnum, riskResponseEnum };

export const clientRequestTemplateCategories = pgTable("client_request_template_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_template_categories_order").on(table.order),
]);

export const clientRequestTemplates = pgTable("client_request_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => clientRequestTemplateCategories.id, { onDelete: "set null" }),
  name: varchar("name").notNull(),
  description: text("description"),
  status: varchar("status", { enum: ["draft", "active"] }).notNull().default("draft"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_templates_category_id").on(table.categoryId),
  index("idx_task_templates_status").on(table.status),
]);

export const clientRequestTemplateSections = pgTable("client_request_template_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => clientRequestTemplates.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_template_sections_template_id").on(table.templateId),
  index("idx_task_template_sections_order").on(table.templateId, table.order),
]);

export const clientRequestTemplateQuestions = pgTable("client_request_template_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull().references(() => clientRequestTemplateSections.id, { onDelete: "cascade" }),
  questionType: questionTypeEnum("question_type").notNull(),
  label: text("label").notNull(),
  helpText: text("help_text"),
  isRequired: boolean("is_required").notNull().default(false),
  order: integer("order").notNull().default(0),
  validationRules: jsonb("validation_rules"),
  options: text("options").array(),
  conditionalLogic: jsonb("conditional_logic"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_template_questions_section_id").on(table.sectionId),
  index("idx_task_template_questions_order").on(table.sectionId, table.order),
]);

export const clientCustomRequests = pgTable("client_custom_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  description: text("description"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_custom_requests_client_id").on(table.clientId),
]);

export const clientCustomRequestSections = pgTable("client_custom_request_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => clientCustomRequests.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_custom_request_sections_request_id").on(table.requestId),
  index("idx_client_custom_request_sections_order").on(table.requestId, table.order),
]);

export const clientCustomRequestQuestions = pgTable("client_custom_request_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull().references(() => clientCustomRequestSections.id, { onDelete: "cascade" }),
  questionType: questionTypeEnum("question_type").notNull(),
  label: text("label").notNull(),
  helpText: text("help_text"),
  isRequired: boolean("is_required").notNull().default(false),
  order: integer("order").notNull().default(0),
  validationRules: jsonb("validation_rules"),
  options: text("options").array(),
  conditionalLogic: jsonb("conditional_logic"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_custom_request_questions_section_id").on(table.sectionId),
  index("idx_client_custom_request_questions_order").on(table.sectionId, table.order),
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

export const riskAssessments = pgTable("risk_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  version: varchar("version").notNull(),
  amlPreparedBy: varchar("aml_prepared_by").references(() => users.id),
  preparationStarted: timestamp("preparation_started"),
  preparationCompleted: timestamp("preparation_completed"),
  enhancedDueDiligenceRequired: boolean("enhanced_due_diligence_required").default(false),
  amlReviewedBy: varchar("aml_reviewed_by").references(() => users.id),
  reviewStarted: timestamp("review_started"),
  reviewCompleted: timestamp("review_completed"),
  generalInformation: text("general_information"),
  riskLevel: riskLevelEnum("risk_level"),
  initialDate: timestamp("initial_date"),
  reviewDate: timestamp("review_date"),
  furtherRisksInitialDate: timestamp("further_risks_initial_date"),
  furtherRisksReviewDate: timestamp("further_risks_review_date"),
  moneyLaunderingOfficer: varchar("money_laundering_officer").references(() => users.id),
  mloReviewDate: timestamp("mlo_review_date"),
  electronicSearchReference: text("electronic_search_reference"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_risk_assessments_client_id").on(table.clientId),
  index("idx_risk_assessments_version").on(table.version),
]);

export const riskAssessmentResponses = pgTable("risk_assessment_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  riskAssessmentId: varchar("risk_assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  questionKey: varchar("question_key").notNull(),
  response: riskResponseEnum("response").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_risk_responses_assessment_id").on(table.riskAssessmentId),
  unique("unique_assessment_question").on(table.riskAssessmentId, table.questionKey),
]);
