import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
  check,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enum
export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "client_manager", "bookkeeper"]);

// Project status enum
export const projectStatusEnum = pgEnum("project_status", [
  "no_latest_action",
  "bookkeeping_work_required", 
  "in_review",
  "needs_client_input",
  "completed"
]);

// Note: Change reason enum removed - now using varchar for custom text input like kanban stages
// export const changeReasonEnum = pgEnum("change_reason", [
//   "errors_identified_from_bookkeeper",
//   "first_allocation_of_work", 
//   "queries_answered",
//   "work_completed_successfully",
//   "clarifications_needed"
// ]);

// Custom field type enum
export const customFieldTypeEnum = pgEnum("custom_field_type", ["number", "short_text", "long_text", "multi_select"]);

// Stage approval field type enum
export const stageApprovalFieldTypeEnum = pgEnum("stage_approval_field_type", ["boolean", "number", "long_text", "multi_select"]);

// Comparison type enum for number fields in stage approvals
export const comparisonTypeEnum = pgEnum("comparison_type", ["equal_to", "less_than", "greater_than"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").notNull().default("bookkeeper"),
  passwordHash: varchar("password_hash"), // Hashed password, nullable for OAuth-only users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User notification preferences table
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  notifyStageChanges: boolean("notify_stage_changes").notNull().default(true),
  notifyNewProjects: boolean("notify_new_projects").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Magic link tokens table
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

// Clients table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  email: varchar("email"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Projects table (individual client work items)
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id), // links to project type configuration
  bookkeeperId: varchar("bookkeeper_id").notNull().references(() => users.id),
  clientManagerId: varchar("client_manager_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  currentStatus: varchar("current_status").notNull().default("No Latest Action"),
  currentAssigneeId: varchar("current_assignee_id").references(() => users.id),
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  dueDate: timestamp("due_date"),
  archived: boolean("archived").default(false), // to hide completed monthly cycles
  inactive: boolean("inactive").default(false), // to mark projects as inactive
  projectMonth: varchar("project_month"), // DD/MM/YYYY format to track which month each project belongs to
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project chronology table
export const projectChronology = pgTable("project_chronology", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status").notNull(),
  assigneeId: varchar("assignee_id").references(() => users.id),
  changeReason: varchar("change_reason"),
  notes: text("notes"),
  timestamp: timestamp("timestamp").defaultNow(),
  timeInPreviousStage: integer("time_in_previous_stage"), // in minutes
  businessHoursInPreviousStage: integer("business_hours_in_previous_stage"), // in business minutes (for precision)
});

// Stage approvals configuration table
export const stageApprovals = pgTable("stage_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }), // owned by project type
  name: varchar("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_approvals_project_type_id").on(table.projectTypeId),
  // Name must be unique within a project type
  unique("unique_approval_name_per_project_type").on(table.projectTypeId, table.name),
]);

// Stage approval fields table - questions/fields for each stage approval
export const stageApprovalFields = pgTable("stage_approval_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stageApprovalId: varchar("stage_approval_id").notNull().references(() => stageApprovals.id, { onDelete: "cascade" }),
  fieldName: varchar("field_name").notNull(),
  fieldType: stageApprovalFieldTypeEnum("field_type").notNull(),
  isRequired: boolean("is_required").default(false),
  order: integer("order").notNull(),
  placeholder: varchar("placeholder"), // For all field types
  // For boolean fields - what value is required for approval
  expectedValueBoolean: boolean("expected_value_boolean"),
  // For number fields - comparison type and expected value
  comparisonType: comparisonTypeEnum("comparison_type"),
  expectedValueNumber: integer("expected_value_number"),
  // For multi_select fields - available options
  options: text("options").array(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_approval_fields_stage_approval_id").on(table.stageApprovalId),
  // CHECK constraint to ensure proper fields are populated based on fieldType
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

// Stage approval responses table - user responses when filling approval forms
export const stageApprovalResponses = pgTable("stage_approval_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fieldId: varchar("field_id").notNull().references(() => stageApprovalFields.id, { onDelete: "restrict" }),
  valueBoolean: boolean("value_boolean"), // For boolean field types
  valueNumber: integer("value_number"), // For number field types
  valueLongText: text("value_long_text"), // For long_text field types
  valueMultiSelect: text("value_multi_select").array(), // For multi_select field types
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_approval_responses_project_id").on(table.projectId),
  index("idx_stage_approval_responses_field_id").on(table.fieldId),
  unique("unique_project_field_response").on(table.projectId, table.fieldId),
  // CHECK constraint to ensure only one value column is populated and matches field type requirements
  check("check_single_value_populated", sql`
    (value_boolean IS NOT NULL AND value_number IS NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NOT NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NULL AND value_long_text IS NOT NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NULL AND value_long_text IS NULL AND value_multi_select IS NOT NULL)
  `),
]);

// Kanban stages configuration table
export const kanbanStages = pgTable("kanban_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }), // owned by project type
  name: varchar("name").notNull(),
  assignedRole: userRoleEnum("assigned_role"),
  order: integer("order").notNull(),
  color: varchar("color").default("#6b7280"),
  maxInstanceTime: integer("max_instance_time"), // Maximum hours for a single visit to this stage (optional)
  maxTotalTime: integer("max_total_time"), // Maximum cumulative hours across all visits to this stage (optional)
  stageApprovalId: varchar("stage_approval_id").references(() => stageApprovals.id, { onDelete: "set null" }), // Optional stage approval
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kanban_stages_project_type_id").on(table.projectTypeId),
  // Name must be unique within a project type
  unique("unique_stage_name_per_project_type").on(table.projectTypeId, table.name),
]);

// Change reasons configuration table
export const changeReasons = pgTable("change_reasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }), // owned by project type
  reason: varchar("reason").notNull(),
  description: varchar("description"),
  showCountInProject: boolean("show_count_in_project").default(false),
  countLabel: varchar("count_label"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_change_reasons_project_type_id").on(table.projectTypeId),
  // Reason must be unique within a project type
  unique("unique_reason_per_project_type").on(table.projectTypeId, table.reason),
]);

// Project types configuration table (renamed from project descriptions)
export const projectTypes = pgTable("project_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(), // project type name (e.g. "Monthly Bookkeeping", "Payroll")
  description: text("description"), // optional description of the project type
  active: boolean("active").default(true), // to enable/disable project types
  order: integer("order").notNull(), // for sorting in UI
  createdAt: timestamp("created_at").defaultNow(),
});

// Stage-Reason mapping table (many-to-many relationship)
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

// Custom fields per change reason
export const reasonCustomFields = pgTable("reason_custom_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reasonId: varchar("reason_id").notNull().references(() => changeReasons.id, { onDelete: "cascade" }),
  fieldName: varchar("field_name").notNull(),
  fieldType: customFieldTypeEnum("field_type").notNull(),
  isRequired: boolean("is_required").default(false),
  placeholder: varchar("placeholder"),
  options: text("options").array(), // For multi-select field options
  order: integer("order").notNull(), // for sorting in UI
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reason_custom_fields_reason_id").on(table.reasonId),
  // CHECK constraint to ensure options is non-empty when field_type = 'multi_select'
  check("check_multi_select_options", sql`
    (field_type != 'multi_select' OR (options IS NOT NULL AND array_length(options, 1) > 0 AND options <> ARRAY[]::text[]))
  `),
]);

// Field responses tied to project chronology
export const reasonFieldResponses = pgTable("reason_field_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chronologyId: varchar("chronology_id").notNull().references(() => projectChronology.id, { onDelete: "cascade" }),
  customFieldId: varchar("custom_field_id").notNull().references(() => reasonCustomFields.id, { onDelete: "restrict" }),
  fieldType: customFieldTypeEnum("field_type").notNull(), // Store fieldType for validation
  valueNumber: integer("value_number"), // For number field types
  valueShortText: varchar("value_short_text", { length: 255 }), // For short_text field types
  valueLongText: text("value_long_text"), // For long_text field types
  valueMultiSelect: text("value_multi_select").array(), // For multi_select field types
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reason_field_responses_chronology_id").on(table.chronologyId),
  index("idx_reason_field_responses_custom_field_id").on(table.customFieldId),
  unique("unique_chronology_custom_field").on(table.chronologyId, table.customFieldId),
  // CHECK constraint to ensure only one value column is populated based on fieldType
  check("check_single_value_column", sql`
    (field_type = 'number' AND value_number IS NOT NULL AND value_short_text IS NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (field_type = 'short_text' AND value_number IS NULL AND value_short_text IS NOT NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (field_type = 'long_text' AND value_number IS NULL AND value_short_text IS NULL AND value_long_text IS NOT NULL AND value_multi_select IS NULL) OR
    (field_type = 'multi_select' AND value_number IS NULL AND value_short_text IS NULL AND value_long_text IS NULL AND value_multi_select IS NOT NULL AND array_length(value_multi_select, 1) > 0)
  `),
]);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  assignedProjects: many(projects, { relationName: "assignee" }),
  bookkeepingProjects: many(projects, { relationName: "bookkeeper" }),
  managedProjects: many(projects, { relationName: "clientManager" }),
  chronologyEntries: many(projectChronology),
  magicLinkTokens: many(magicLinkTokens),
  notificationPreferences: one(userNotificationPreferences),
}));

export const magicLinkTokensRelations = relations(magicLinkTokens, ({ one }) => ({
  user: one(users, {
    fields: [magicLinkTokens.userId],
    references: [users.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  projectType: one(projectTypes, {
    fields: [projects.projectTypeId],
    references: [projectTypes.id],
  }),
  bookkeeper: one(users, {
    fields: [projects.bookkeeperId],
    references: [users.id],
    relationName: "bookkeeper",
  }),
  clientManager: one(users, {
    fields: [projects.clientManagerId],
    references: [users.id],
    relationName: "clientManager",
  }),
  currentAssignee: one(users, {
    fields: [projects.currentAssigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  chronology: many(projectChronology),
}));

export const projectChronologyRelations = relations(projectChronology, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectChronology.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [projectChronology.assigneeId],
    references: [users.id],
  }),
  fieldResponses: many(reasonFieldResponses),
}));

export const kanbanStagesRelations = relations(kanbanStages, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [kanbanStages.projectTypeId],
    references: [projectTypes.id],
  }),
  stageReasonMaps: many(stageReasonMaps),
  stageApproval: one(stageApprovals, {
    fields: [kanbanStages.stageApprovalId],
    references: [stageApprovals.id],
  }),
}));

export const changeReasonsRelations = relations(changeReasons, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [changeReasons.projectTypeId],
    references: [projectTypes.id],
  }),
  stageReasonMaps: many(stageReasonMaps),
  customFields: many(reasonCustomFields),
}));

export const stageReasonMapsRelations = relations(stageReasonMaps, ({ one }) => ({
  stage: one(kanbanStages, {
    fields: [stageReasonMaps.stageId],
    references: [kanbanStages.id],
  }),
  reason: one(changeReasons, {
    fields: [stageReasonMaps.reasonId],
    references: [changeReasons.id],
  }),
}));

export const reasonCustomFieldsRelations = relations(reasonCustomFields, ({ one, many }) => ({
  reason: one(changeReasons, {
    fields: [reasonCustomFields.reasonId],
    references: [changeReasons.id],
  }),
  responses: many(reasonFieldResponses),
}));

export const reasonFieldResponsesRelations = relations(reasonFieldResponses, ({ one }) => ({
  chronology: one(projectChronology, {
    fields: [reasonFieldResponses.chronologyId],
    references: [projectChronology.id],
  }),
  customField: one(reasonCustomFields, {
    fields: [reasonFieldResponses.customFieldId],
    references: [reasonCustomFields.id],
  }),
}));

export const stageApprovalsRelations = relations(stageApprovals, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [stageApprovals.projectTypeId],
    references: [projectTypes.id],
  }),
  fields: many(stageApprovalFields),
  linkedStages: many(kanbanStages),
}));

export const stageApprovalFieldsRelations = relations(stageApprovalFields, ({ one, many }) => ({
  stageApproval: one(stageApprovals, {
    fields: [stageApprovalFields.stageApprovalId],
    references: [stageApprovals.id],
  }),
  responses: many(stageApprovalResponses),
}));

export const stageApprovalResponsesRelations = relations(stageApprovalResponses, ({ one }) => ({
  project: one(projects, {
    fields: [stageApprovalResponses.projectId],
    references: [projects.id],
  }),
  field: one(stageApprovalFields, {
    fields: [stageApprovalResponses.fieldId],
    references: [stageApprovalFields.id],
  }),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMagicLinkTokenSchema = createInsertSchema(magicLinkTokens).omit({
  id: true,
  createdAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProjectSchema = insertProjectSchema.partial();

export const insertProjectChronologySchema = createInsertSchema(projectChronology).omit({
  id: true,
  timestamp: true,
});

// Base schema without refinements (for use with .partial())
const baseKanbanStageSchema = createInsertSchema(kanbanStages).omit({
  id: true,
  createdAt: true,
});

export const insertKanbanStageSchema = baseKanbanStageSchema.refine((data) => {
  // Validate maxInstanceTime is positive if provided
  if (data.maxInstanceTime !== undefined && data.maxInstanceTime !== null && data.maxInstanceTime <= 0) {
    return false;
  }
  // Validate maxTotalTime is positive if provided  
  if (data.maxTotalTime !== undefined && data.maxTotalTime !== null && data.maxTotalTime <= 0) {
    return false;
  }
  return true;
}, {
  message: "Time limits must be positive numbers when specified",
});

export const updateKanbanStageSchema = baseKanbanStageSchema.partial().refine((data) => {
  // Validate maxInstanceTime is positive if provided
  if (data.maxInstanceTime !== undefined && data.maxInstanceTime !== null && data.maxInstanceTime <= 0) {
    return false;
  }
  // Validate maxTotalTime is positive if provided  
  if (data.maxTotalTime !== undefined && data.maxTotalTime !== null && data.maxTotalTime <= 0) {
    return false;
  }
  return true;
}, {
  message: "Time limits must be positive numbers when specified",
});

export const insertChangeReasonSchema = createInsertSchema(changeReasons).omit({
  id: true,
  createdAt: true,
});

export const updateChangeReasonSchema = insertChangeReasonSchema.partial();

export const insertProjectTypeSchema = createInsertSchema(projectTypes).omit({
  id: true,
  createdAt: true,
});

export const updateProjectTypeSchema = insertProjectTypeSchema.partial();

export const insertStageReasonMapSchema = createInsertSchema(stageReasonMaps).omit({
  id: true,
  createdAt: true,
});

// Base schema without refinements (for use with .partial())
const baseReasonCustomFieldSchema = createInsertSchema(reasonCustomFields).omit({
  id: true,
  createdAt: true,
});

export const insertReasonCustomFieldSchema = baseReasonCustomFieldSchema.refine((data) => {
  // When fieldType is 'multi_select', options must be present and non-empty
  if (data.fieldType === 'multi_select') {
    if (!data.options || !Array.isArray(data.options) || data.options.length === 0) {
      return false;
    }
    
    // All options must be non-empty trimmed strings
    const trimmedOptions = data.options.map(opt => opt?.trim()).filter(Boolean);
    if (trimmedOptions.length !== data.options.length) {
      return false;
    }
    
    // All options must be unique
    const uniqueOptions = new Set(trimmedOptions);
    if (uniqueOptions.size !== trimmedOptions.length) {
      return false;
    }
  }
  return true;
}, {
  message: "Multi-select fields must have at least one unique, non-empty option",
}).transform((data) => {
  // Trim options for multi-select fields
  if (data.fieldType === 'multi_select' && data.options) {
    return {
      ...data,
      options: data.options.map(opt => opt.trim()).filter(Boolean)
    };
  }
  return data;
});

// Update schema for patches (allows partial updates)
export const updateReasonCustomFieldSchema = baseReasonCustomFieldSchema.partial().refine((data) => {
  // If fieldType is being set to 'multi_select', options must be present and non-empty
  if (data.fieldType === 'multi_select') {
    if (!data.options || !Array.isArray(data.options) || data.options.length === 0) {
      return false;
    }
    
    // All options must be non-empty trimmed strings
    const trimmedOptions = data.options.map(opt => opt?.trim()).filter(Boolean);
    if (trimmedOptions.length !== data.options.length) {
      return false;
    }
    
    // All options must be unique
    const uniqueOptions = new Set(trimmedOptions);
    if (uniqueOptions.size !== trimmedOptions.length) {
      return false;
    }
  }
  return true;
}, {
  message: "Multi-select fields must have at least one unique, non-empty option",
}).transform((data) => {
  // Trim options for multi-select fields
  if (data.fieldType === 'multi_select' && data.options) {
    return {
      ...data,
      options: data.options.map(opt => opt.trim()).filter(Boolean)
    };
  }
  return data;
});

export const insertReasonFieldResponseSchema = createInsertSchema(reasonFieldResponses).omit({
  id: true,
  createdAt: true,
});

// Stage approval schemas
export const insertStageApprovalSchema = createInsertSchema(stageApprovals).omit({
  id: true,
  createdAt: true,
});

export const updateStageApprovalSchema = insertStageApprovalSchema.partial();

// Base schema for stage approval fields without refinements (for use with .partial())
const baseStageApprovalFieldSchema = createInsertSchema(stageApprovalFields).omit({
  id: true,
  createdAt: true,
});

export const insertStageApprovalFieldSchema = baseStageApprovalFieldSchema.refine((data) => {
  // Boolean fields must have expectedValueBoolean
  if (data.fieldType === 'boolean' && data.expectedValueBoolean == null) {
    return false;
  }
  // Number fields must have both comparisonType and expectedValueNumber  
  if (data.fieldType === 'number' && (data.comparisonType == null || data.expectedValueNumber == null)) {
    return false;
  }
  // Multi select fields must have options
  if (data.fieldType === 'multi_select' && (!data.options || data.options.length === 0)) {
    return false;
  }
  // Long text fields should not have validation fields
  if (data.fieldType === 'long_text' && (data.expectedValueBoolean != null || data.comparisonType != null || data.expectedValueNumber != null || data.options != null)) {
    return false;
  }
  return true;
}, {
  message: "Field validation requirements not met for the specified field type",
});

export const updateStageApprovalFieldSchema = baseStageApprovalFieldSchema.partial().refine((data) => {
  // If fieldType is being set, validate accordingly
  if (data.fieldType === 'boolean' && data.expectedValueBoolean == null) {
    return false;
  }
  if (data.fieldType === 'number' && (data.comparisonType == null || data.expectedValueNumber == null)) {
    return false;
  }
  if (data.fieldType === 'multi_select' && (!data.options || data.options.length === 0)) {
    return false;
  }
  if (data.fieldType === 'long_text' && (data.expectedValueBoolean != null || data.comparisonType != null || data.expectedValueNumber != null || data.options != null)) {
    return false;
  }
  return true;
}, {
  message: "Field validation requirements not met for the specified field type",
});

export const insertStageApprovalResponseSchema = createInsertSchema(stageApprovalResponses).omit({
  id: true,
  createdAt: true,
});

export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserNotificationPreferencesSchema = insertUserNotificationPreferencesSchema.partial();

// Project update schema  
export const updateProjectStatusSchema = z.object({
  projectId: z.string(),
  newStatus: z.string(), // Now accepts any kanban stage name
  changeReason: z.string().min(1, "Change reason is required").max(255, "Change reason too long"),
  notes: z.string().optional(),
  fieldResponses: z.array(z.object({
    customFieldId: z.string(),
    // fieldType removed - will be derived server-side from the custom field definition
    valueNumber: z.number().int().optional(),
    valueShortText: z.string().max(255).optional(),
    valueLongText: z.string().optional(),
    valueMultiSelect: z.array(z.string()).optional(),
  })).optional(),
});

// Month normalization helper function for project storage (preserves exact day)
export function normalizeProjectMonth(input: string): string {
  // Handle various date formats and normalize to DD/MM/YYYY
  const cleaned = input.trim();
  
  // Check if already in DD/MM/YYYY format with leading zeros
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Handle D/M/YYYY or DD/M/YYYY or D/MM/YYYY formats
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');
    
    // Validate day and month ranges
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    
    if (dayNum < 1 || dayNum > 31) {
      throw new Error(`Invalid day: ${day}. Day must be between 01 and 31.`);
    }
    if (monthNum < 1 || monthNum > 12) {
      throw new Error(`Invalid month: ${month}. Month must be between 01 and 12.`);
    }
    
    return `${paddedDay}/${paddedMonth}/${year}`;
  }
  
  throw new Error(`Invalid project month format: ${cleaned}. Expected DD/MM/YYYY format.`);
}

// Month normalization for filtering (always uses first day of month)
export function normalizeMonthForFiltering(input?: string | Date): string {
  let date: Date;
  
  if (!input) {
    // Default to current month
    date = new Date();
  } else if (typeof input === 'string') {
    // Parse DD/MM/YYYY format
    const cleaned = input.trim();
    const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      throw new Error(`Invalid date format: ${cleaned}. Expected DD/MM/YYYY format.`);
    }
  } else {
    date = input;
  }
  
  // Always use the first day of the month for filtering
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const day = '01';
  const month = String(firstDay.getMonth() + 1).padStart(2, '0');
  const year = firstDay.getFullYear();
  
  return `${day}/${month}/${year}`;
}

// Get current month normalized for filtering (first day of current month)
export function getCurrentMonthForFiltering(): string {
  return normalizeMonthForFiltering();
}

// CSV upload schema
export const csvProjectSchema = z.object({
  clientName: z.string().min(1),
  projectDescription: z.string().min(1),
  bookkeeperEmail: z.string().email(),
  clientManagerEmail: z.string().email(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  dueDate: z.string().optional(),
  projectMonth: z.string().min(1, "Project month is required").refine(
    (val) => {
      try {
        normalizeProjectMonth(val);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: "Project month must be in DD/MM/YYYY format (e.g., 01/12/2024)"
    }
  ),
});

// Types
export type User = typeof users.$inferSelect;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type InsertMagicLinkToken = z.infer<typeof insertMagicLinkTokenSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectChronology = typeof projectChronology.$inferSelect;
export type InsertProjectChronology = z.infer<typeof insertProjectChronologySchema>;
export type KanbanStage = typeof kanbanStages.$inferSelect;
export type InsertKanbanStage = z.infer<typeof insertKanbanStageSchema>;
export type ChangeReason = typeof changeReasons.$inferSelect;
export type InsertChangeReason = z.infer<typeof insertChangeReasonSchema>;
// Project type definitions
export const projectTypesRelations = relations(projectTypes, ({ many }) => ({
  projects: many(projects),
  kanbanStages: many(kanbanStages),
  changeReasons: many(changeReasons),
  stageApprovals: many(stageApprovals),
}));

// Type definitions
export type ProjectType = typeof projectTypes.$inferSelect;
export type InsertProjectType = z.infer<typeof insertProjectTypeSchema>;
export type UpdateProjectType = z.infer<typeof updateProjectTypeSchema>;
export type StageReasonMap = typeof stageReasonMaps.$inferSelect;
export type InsertStageReasonMap = z.infer<typeof insertStageReasonMapSchema>;
export type ReasonCustomField = typeof reasonCustomFields.$inferSelect;
export type InsertReasonCustomField = z.infer<typeof insertReasonCustomFieldSchema>;
export type ReasonFieldResponse = typeof reasonFieldResponses.$inferSelect;
export type InsertReasonFieldResponse = z.infer<typeof insertReasonFieldResponseSchema>;
export type StageApproval = typeof stageApprovals.$inferSelect;
export type InsertStageApproval = z.infer<typeof insertStageApprovalSchema>;
export type UpdateStageApproval = z.infer<typeof updateStageApprovalSchema>;
export type StageApprovalField = typeof stageApprovalFields.$inferSelect;
export type InsertStageApprovalField = z.infer<typeof insertStageApprovalFieldSchema>;
export type UpdateStageApprovalField = z.infer<typeof updateStageApprovalFieldSchema>;
export type StageApprovalResponse = typeof stageApprovalResponses.$inferSelect;
export type InsertStageApprovalResponse = z.infer<typeof insertStageApprovalResponseSchema>;
export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreferences = z.infer<typeof insertUserNotificationPreferencesSchema>;
export type UpdateUserNotificationPreferences = z.infer<typeof updateUserNotificationPreferencesSchema>;
export type UpdateProjectStatus = z.infer<typeof updateProjectStatusSchema>;
export type CSVProject = z.infer<typeof csvProjectSchema>;

// Extended types with relations
export type ProjectWithRelations = Project & {
  client: Client;
  bookkeeper: User;
  clientManager: User;
  currentAssignee?: User;
  chronology: (ProjectChronology & { 
    assignee?: User; 
    fieldResponses: (ReasonFieldResponse & { customField: ReasonCustomField })[];
  })[];
  progressMetrics?: {
    reasonId: string;
    label: string;
    total: number;
  }[];
};
