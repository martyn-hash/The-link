import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { systemFieldLibrary, systemFieldUsage } from "./tables";

export const validationRulesSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  pattern: z.string().optional(),
  patternMessage: z.string().optional(),
  allowedFileTypes: z.array(z.string()).optional(),
  maxFileSizeMb: z.number().optional(),
  currencyCode: z.string().optional(),
  decimalPlaces: z.number().optional(),
}).nullable();

export const displayConfigSchema = z.object({
  width: z.enum(["full", "half", "third", "quarter"]).optional(),
  showInSummary: z.boolean().optional(),
  sortOrder: z.number().optional(),
  conditionalDisplay: z.object({
    dependsOnFieldId: z.string(),
    operator: z.enum(["equals", "not_equals", "contains", "is_empty", "is_not_empty"]),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  }).optional(),
}).nullable();

const baseInsertSystemFieldLibrarySchema = createInsertSchema(systemFieldLibrary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

function validateFieldTypeOptions(data: { fieldType?: string | null; options?: string[] | null }): boolean {
  if (!data.fieldType) return true;
  switch (data.fieldType) {
    case "single_select":
    case "multi_select":
      return data.options !== null && data.options !== undefined && Array.isArray(data.options) && data.options.length > 0;
    default:
      return true;
  }
}

export const insertSystemFieldLibrarySchema = baseInsertSystemFieldLibrarySchema
  .extend({
    validationRules: validationRulesSchema.optional(),
    displayConfig: displayConfigSchema.optional(),
    defaultValue: z.any().optional(),
  })
  .refine(
    (data) => validateFieldTypeOptions(data),
    { message: "Select fields require at least one option", path: ["options"] }
  );

export const updateSystemFieldLibrarySchema = baseInsertSystemFieldLibrarySchema
  .partial()
  .extend({
    validationRules: validationRulesSchema.optional(),
    displayConfig: displayConfigSchema.optional(),
    defaultValue: z.any().optional(),
  })
  .refine(
    (data) => {
      if (data.fieldType === undefined) return true;
      return validateFieldTypeOptions(data);
    },
    { message: "Select fields require at least one option", path: ["options"] }
  );

export const insertSystemFieldUsageSchema = createInsertSchema(systemFieldUsage).omit({
  id: true,
  createdAt: true,
});

export const updateSystemFieldUsageSchema = insertSystemFieldUsageSchema.partial();

export const copyFieldToContextSchema = z.object({
  libraryFieldId: z.string(),
  context: z.enum([
    "stage_approval",
    "client_task",
    "request_template",
    "campaign_page",
    "reason_custom_field",
    "service_udf",
    "page_template"
  ]),
  contextEntityId: z.string(),
  contextEntityType: z.string().optional(),
  overrides: z.object({
    fieldName: z.string().optional(),
    isRequired: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
});

export type InsertSystemFieldLibrary = z.infer<typeof insertSystemFieldLibrarySchema>;
export type UpdateSystemFieldLibrary = z.infer<typeof updateSystemFieldLibrarySchema>;
export type SystemFieldLibrary = typeof systemFieldLibrary.$inferSelect;

export type InsertSystemFieldUsage = z.infer<typeof insertSystemFieldUsageSchema>;
export type UpdateSystemFieldUsage = z.infer<typeof updateSystemFieldUsageSchema>;
export type SystemFieldUsage = typeof systemFieldUsage.$inferSelect;

export type CopyFieldToContext = z.infer<typeof copyFieldToContextSchema>;
