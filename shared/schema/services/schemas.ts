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
} from "./tables";

export const udfDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Field name is required"),
  type: z.enum(["number", "date", "boolean", "short_text"]),
  required: z.boolean(),
  placeholder: z.string().optional(),
});

export const baseInsertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
}).extend({
  udfDefinitions: z.array(udfDefinitionSchema).optional().default([]),
  isCompaniesHouseConnected: z.boolean().optional().default(false),
  chStartDateField: z.string().optional(),
  chDueDateField: z.string().optional(),
  isPersonalService: z.boolean().optional().default(false),
  isStaticService: z.boolean().optional().default(false),
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

export const insertWorkRoleSchema = createInsertSchema(workRoles).omit({
  id: true,
  createdAt: true,
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
});

export const updatePeopleServiceSchema = insertPeopleServiceSchema.partial();

export const insertClientServiceRoleAssignmentSchema = createInsertSchema(clientServiceRoleAssignments).omit({
  id: true,
  createdAt: true,
});
