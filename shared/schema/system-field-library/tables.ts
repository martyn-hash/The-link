import { pgTable, pgEnum, varchar, text, boolean, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "../users/tables";

export const systemFieldTypeEnum = pgEnum("system_field_type", [
  "short_text",
  "long_text",
  "number",
  "boolean",
  "date",
  "single_select",
  "multi_select",
  "email",
  "phone",
  "url",
  "currency",
  "percentage",
  "user_select",
  "file_upload",
  "image_upload"
]);

export const fieldContextEnum = pgEnum("field_context", [
  "stage_approval",
  "client_task",
  "request_template",
  "campaign_page",
  "reason_custom_field",
  "service_udf",
  "page_template"
]);

export const fieldCategoryEnum = pgEnum("field_category", [
  "general",
  "contact",
  "financial",
  "compliance",
  "documentation",
  "scheduling",
  "custom"
]);

export const systemFieldLibrary = pgTable("system_field_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldName: varchar("field_name", { length: 255 }).notNull(),
  fieldType: systemFieldTypeEnum("field_type").notNull(),
  description: text("description"),
  placeholder: varchar("placeholder", { length: 255 }),
  helpText: text("help_text"),
  category: fieldCategoryEnum("category").notNull().default("general"),
  tags: text("tags").array(),
  options: text("options").array(),
  validationRules: jsonb("validation_rules"),
  displayConfig: jsonb("display_config"),
  defaultValue: jsonb("default_value"),
  isRequired: boolean("is_required").default(false),
  isArchived: boolean("is_archived").default(false),
  usageCount: integer("usage_count").default(0),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_system_field_library_field_type").on(table.fieldType),
  index("idx_system_field_library_category").on(table.category),
  index("idx_system_field_library_is_archived").on(table.isArchived),
  index("idx_system_field_library_created_by").on(table.createdBy),
]);

export const systemFieldUsage = pgTable("system_field_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  libraryFieldId: varchar("library_field_id").notNull().references(() => systemFieldLibrary.id, { onDelete: "cascade" }),
  context: fieldContextEnum("context").notNull(),
  contextEntityId: varchar("context_entity_id").notNull(),
  contextEntityType: varchar("context_entity_type", { length: 100 }),
  instanceFieldId: varchar("instance_field_id"),
  fieldNameOverride: varchar("field_name_override", { length: 255 }),
  isRequiredOverride: boolean("is_required_override"),
  optionsOverride: text("options_override").array(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_system_field_usage_library_field_id").on(table.libraryFieldId),
  index("idx_system_field_usage_context").on(table.context),
  index("idx_system_field_usage_context_entity_id").on(table.contextEntityId),
]);
