import { pgTable, varchar, text, timestamp, boolean, index, unique, jsonb, integer, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../users/tables';
import { clients } from '../clients/tables';
import { inactiveReasonEnum, stageApprovalFieldTypeEnum, comparisonTypeEnum, customFieldTypeEnum } from '../enums';
import { services, workRoles, clientServices, peopleServices } from '../services/tables';

export const projectTypes: any = pgTable("project_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }),
  active: boolean("active").default(true),
  notificationsActive: boolean("notifications_active").default(true),
  singleProjectPerClient: boolean("single_project_per_client").default(false),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id),
  bookkeeperId: varchar("bookkeeper_id").notNull().references(() => users.id),
  clientManagerId: varchar("client_manager_id").notNull().references(() => users.id),
  projectOwnerId: varchar("project_owner_id").references(() => users.id),
  description: text("description").notNull(),
  currentStatus: varchar("current_status").notNull().default("No Latest Action"),
  currentAssigneeId: varchar("current_assignee_id").references(() => users.id),
  priority: varchar("priority").default("medium"),
  dueDate: timestamp("due_date"),
  archived: boolean("archived").default(false),
  inactive: boolean("inactive").default(false),
  inactiveReason: inactiveReasonEnum("inactive_reason"),
  inactiveAt: timestamp("inactive_at"),
  inactiveByUserId: varchar("inactive_by_user_id").references(() => users.id),
  completionStatus: varchar("completion_status"),
  projectMonth: varchar("project_month"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_projects_project_owner_id").on(table.projectOwnerId),
  index("idx_projects_current_assignee_id").on(table.currentAssigneeId),
  index("idx_projects_project_type_id").on(table.projectTypeId),
  index("idx_projects_archived").on(table.archived),
  index("idx_projects_client_id").on(table.clientId),
  index("idx_projects_current_status").on(table.currentStatus),
  index("idx_projects_due_date").on(table.dueDate),
  index("idx_projects_inactive").on(table.inactive),
  index("idx_projects_project_month").on(table.projectMonth),
]);

export const projectChronology = pgTable("project_chronology", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status").notNull(),
  assigneeId: varchar("assignee_id").references(() => users.id),
  changedById: varchar("changed_by_id").references(() => users.id),
  changeReason: varchar("change_reason"),
  notes: text("notes"),
  notesHtml: text("notes_html"),
  attachments: jsonb("attachments"),
  timestamp: timestamp("timestamp").defaultNow(),
  timeInPreviousStage: integer("time_in_previous_stage"),
  businessHoursInPreviousStage: integer("business_hours_in_previous_stage"),
});

export const stageApprovals = pgTable("stage_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_approvals_project_type_id").on(table.projectTypeId),
  unique("unique_approval_name_per_project_type").on(table.projectTypeId, table.name),
]);

export const stageApprovalFields = pgTable("stage_approval_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stageApprovalId: varchar("stage_approval_id").notNull().references(() => stageApprovals.id, { onDelete: "cascade" }),
  fieldName: varchar("field_name").notNull(),
  description: text("description"),
  fieldType: stageApprovalFieldTypeEnum("field_type").notNull(),
  isRequired: boolean("is_required").default(false),
  order: integer("order").notNull(),
  placeholder: varchar("placeholder"),
  expectedValueBoolean: boolean("expected_value_boolean"),
  comparisonType: comparisonTypeEnum("comparison_type"),
  expectedValueNumber: integer("expected_value_number"),
  options: text("options").array(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_approval_fields_stage_approval_id").on(table.stageApprovalId),
  check("check_boolean_field_validation", sql`
    (field_type != 'boolean' OR expected_value_boolean IS NOT NULL)
  `),
  check("check_number_field_validation", sql`
    (field_type != 'number' OR (comparison_type IS NOT NULL AND expected_value_number IS NOT NULL))
  `),
  check("check_multi_select_field_validation", sql`
    (field_type != 'multi_select' OR (options IS NOT NULL AND array_length(options, 1) > 0 AND options <> ARRAY[]::text[]))
  `),
  check("check_long_text_field_validation", sql`
    (field_type != 'long_text' OR (expected_value_boolean IS NULL AND comparison_type IS NULL AND expected_value_number IS NULL AND options IS NULL))
  `),
]);

export const stageApprovalResponses = pgTable("stage_approval_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fieldId: varchar("field_id").notNull().references(() => stageApprovalFields.id, { onDelete: "cascade" }),
  valueBoolean: boolean("value_boolean"),
  valueNumber: integer("value_number"),
  valueLongText: text("value_long_text"),
  valueMultiSelect: text("value_multi_select").array(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_approval_responses_project_id").on(table.projectId),
  index("idx_stage_approval_responses_field_id").on(table.fieldId),
  unique("unique_project_field_response").on(table.projectId, table.fieldId),
  check("check_single_value_populated", sql`
    (value_boolean IS NOT NULL AND value_number IS NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NOT NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NULL AND value_long_text IS NOT NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NULL AND value_long_text IS NULL AND value_multi_select IS NOT NULL)
  `),
]);

export const kanbanStages = pgTable("kanban_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  assignedWorkRoleId: varchar("assigned_work_role_id").references(() => workRoles.id, { onDelete: "set null" }),
  assignedUserId: varchar("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  order: integer("order").notNull(),
  color: varchar("color").default("#6b7280"),
  maxInstanceTime: integer("max_instance_time"),
  maxTotalTime: integer("max_total_time"),
  stageApprovalId: varchar("stage_approval_id").references(() => stageApprovals.id, { onDelete: "set null" }),
  canBeFinalStage: boolean("can_be_final_stage").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kanban_stages_project_type_id").on(table.projectTypeId),
  index("idx_kanban_stages_assigned_work_role_id").on(table.assignedWorkRoleId),
  index("idx_kanban_stages_assigned_user_id").on(table.assignedUserId),
]);

export const changeReasons = pgTable("change_reasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }),
  reason: varchar("reason").notNull(),
  description: varchar("description"),
  showCountInProject: boolean("show_count_in_project").default(false),
  countLabel: varchar("count_label"),
  stageApprovalId: varchar("stage_approval_id").references(() => stageApprovals.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_change_reasons_project_type_id").on(table.projectTypeId),
  index("idx_change_reasons_stage_approval_id").on(table.stageApprovalId),
]);

export const stageReasonMaps = pgTable("stage_reason_maps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stageId: varchar("stage_id").notNull().references(() => kanbanStages.id, { onDelete: "cascade" }),
  reasonId: varchar("reason_id").notNull().references(() => changeReasons.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_reason_maps_stage_id").on(table.stageId),
  index("idx_stage_reason_maps_reason_id").on(table.reasonId),
  unique("unique_stage_reason").on(table.stageId, table.reasonId),
]);

export const reasonCustomFields = pgTable("reason_custom_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reasonId: varchar("reason_id").notNull().references(() => changeReasons.id, { onDelete: "cascade" }),
  fieldName: varchar("field_name").notNull(),
  fieldType: customFieldTypeEnum("field_type").notNull(),
  isRequired: boolean("is_required").default(false),
  placeholder: varchar("placeholder"),
  description: text("description"),
  options: text("options").array(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reason_custom_fields_reason_id").on(table.reasonId),
  check("check_multi_select_options", sql`
    (field_type != 'multi_select' OR (options IS NOT NULL AND array_length(options, 1) > 0 AND options <> ARRAY[]::text[]))
  `),
]);

export const reasonFieldResponses = pgTable("reason_field_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chronologyId: varchar("chronology_id").notNull().references(() => projectChronology.id, { onDelete: "cascade" }),
  customFieldId: varchar("custom_field_id").notNull().references(() => reasonCustomFields.id, { onDelete: "restrict" }),
  fieldType: customFieldTypeEnum("field_type").notNull(),
  valueNumber: integer("value_number"),
  valueShortText: varchar("value_short_text", { length: 255 }),
  valueLongText: text("value_long_text"),
  valueMultiSelect: text("value_multi_select").array(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reason_field_responses_chronology_id").on(table.chronologyId),
  index("idx_reason_field_responses_custom_field_id").on(table.customFieldId),
  unique("unique_chronology_custom_field").on(table.chronologyId, table.customFieldId),
  check("check_single_value_column", sql`
    (field_type = 'number' AND value_number IS NOT NULL AND value_short_text IS NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (field_type = 'short_text' AND value_number IS NULL AND value_short_text IS NOT NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (field_type = 'long_text' AND value_number IS NULL AND value_short_text IS NULL AND value_long_text IS NOT NULL AND value_multi_select IS NULL) OR
    (field_type = 'multi_select' AND value_number IS NULL AND value_short_text IS NULL AND value_long_text IS NULL AND value_multi_select IS NOT NULL)
  `),
]);

export const projectSchedulingHistory = pgTable("project_scheduling_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientServiceId: varchar("client_service_id").references(() => clientServices.id, { onDelete: "set null" }),
  peopleServiceId: varchar("people_service_id").references(() => peopleServices.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  action: varchar("action").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  previousNextStartDate: timestamp("previous_next_start_date"),
  previousNextDueDate: timestamp("previous_next_due_date"),
  newNextStartDate: timestamp("new_next_start_date"),
  newNextDueDate: timestamp("new_next_due_date"),
  frequency: varchar("frequency"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_project_scheduling_history_client_service_id").on(table.clientServiceId),
  index("idx_project_scheduling_history_people_service_id").on(table.peopleServiceId),
  index("idx_project_scheduling_history_project_id").on(table.projectId),
  index("idx_project_scheduling_history_action").on(table.action),
  index("idx_project_scheduling_history_scheduled_date").on(table.scheduledDate),
  index("idx_project_scheduling_history_created_at").on(table.createdAt),
]);

export const schedulingRunLogs = pgTable("scheduling_run_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runDate: timestamp("run_date").notNull(),
  runType: varchar("run_type").notNull().default("scheduled"),
  status: varchar("status").notNull(),
  totalServicesChecked: integer("total_services_checked").notNull().default(0),
  servicesFoundDue: integer("services_found_due").notNull().default(0),
  projectsCreated: integer("projects_created").notNull().default(0),
  servicesRescheduled: integer("services_rescheduled").notNull().default(0),
  errorsEncountered: integer("errors_encountered").notNull().default(0),
  chServicesSkipped: integer("ch_services_skipped").notNull().default(0),
  executionTimeMs: integer("execution_time_ms"),
  errorDetails: jsonb("error_details"),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_scheduling_run_logs_run_date").on(table.runDate),
  index("idx_scheduling_run_logs_status").on(table.status),
  index("idx_scheduling_run_logs_run_type").on(table.runType),
]);
