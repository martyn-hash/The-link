import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import {
  services,
  clientServices,
  peopleServices,
  workRoles,
  serviceRoles,
  clientServiceRoleAssignments,
  chChangeRequests,
  serviceAssignmentViews,
} from "./tables";

export const udfDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Field name is required"),
  type: z.enum(["number", "date", "boolean", "short_text", "long_text", "dropdown"]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  regex: z.string().optional(),
  regexError: z.string().optional(),
});

export type UdfDefinition = z.infer<typeof udfDefinitionSchema>;

export const serviceClientTypeValues = ["company", "individual", "both"] as const;
export type ServiceClientType = typeof serviceClientTypeValues[number];

export const baseInsertServiceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  projectTypeId: z.string().optional().nullable(),
  udfDefinitions: z.array(udfDefinitionSchema).optional().default([]),
  isCompaniesHouseConnected: z.boolean().optional().default(false),
  chStartDateField: z.string().optional().nullable(),
  chDueDateField: z.string().optional().nullable(),
  chTargetDeliveryDaysOffset: z.number().int().min(0).optional().nullable(),
  isPersonalService: z.boolean().optional().default(false),
  applicableClientTypes: z.enum(serviceClientTypeValues).optional().default("company"),
  isStaticService: z.boolean().optional().default(false),
  isVatService: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const insertServiceSchema = baseInsertServiceSchema.refine((data) => {
  if (data.isCompaniesHouseConnected) {
    return data.chStartDateField && data.chDueDateField;
  }
  return true;
}, {
  message: "Companies House connected services must specify both start and due date field mappings",
});

export const updateServiceSchema = baseInsertServiceSchema.partial().refine((data) => {
  if (data.isCompaniesHouseConnected === true) {
    return data.chStartDateField && data.chDueDateField;
  }
  return true;
}, {
  message: "Companies House connected services must specify both start and due date field mappings",
});

export const insertChChangeRequestSchema = createInsertSchema(chChangeRequests).omit({
  id: true,
  createdAt: true,
  detectedAt: true,
});

export const updateChChangeRequestSchema = insertChChangeRequestSchema.partial();

export const insertWorkRoleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
});

export const insertServiceRoleSchema = createInsertSchema(serviceRoles).omit({
  id: true,
  createdAt: true,
});

export const insertClientServiceSchema = createInsertSchema(clientServices).omit({
  id: true,
  createdAt: true,
}).extend({
  frequency: z.enum(["monthly", "quarterly", "annually", "weekly", "daily"]).optional(),
  nextStartDate: z.union([z.date(), z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]).optional(),
  nextDueDate: z.union([z.date(), z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]).optional(),
  targetDeliveryDate: z.union([z.date(), z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]).optional(),
  udfValues: z.record(z.any()).optional(),
});

export const updateClientServiceSchema = insertClientServiceSchema.partial();

export const insertPeopleServiceSchema = createInsertSchema(peopleServices).omit({
  id: true,
  createdAt: true,
}).extend({
  frequency: z.enum(["monthly", "quarterly", "annually", "weekly", "daily"]).default("monthly"),
  nextStartDate: z.string().datetime().optional(),
  nextDueDate: z.string().datetime().optional(),
  targetDeliveryDate: z.union([z.date(), z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]).optional(),
});

export const updatePeopleServiceSchema = insertPeopleServiceSchema.partial();

export const insertClientServiceRoleAssignmentSchema = createInsertSchema(clientServiceRoleAssignments).omit({
  id: true,
  createdAt: true,
});

// Schema for saved view filters validation
export const serviceAssignmentViewFiltersSchema = z.object({
  serviceId: z.string().optional(),
  roleId: z.string().optional(),
  userId: z.string().optional(),
  serviceOwnerId: z.string().optional(),
  showInactive: z.boolean().optional(),
  viewType: z.enum(["client", "personal", "all"]).optional(),
  search: z.string().optional(),
});

export type ServiceAssignmentViewFilters = z.infer<typeof serviceAssignmentViewFiltersSchema>;

export const insertServiceAssignmentViewSchema = createInsertSchema(serviceAssignmentViews).omit({
  id: true,
  createdAt: true,
}).extend({
  filters: serviceAssignmentViewFiltersSchema,
});

export type ServiceAssignmentView = typeof serviceAssignmentViews.$inferSelect;
export type InsertServiceAssignmentView = z.infer<typeof insertServiceAssignmentViewSchema>;
