import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  projects,
  projectChronology,
  projectTypes,
  kanbanStages,
  changeReasons,
  stageApprovals,
  stageApprovalFields,
  stageApprovalResponses,
  stageReasonMaps,
  reasonCustomFields,
  reasonFieldResponses,
  projectSchedulingHistory,
  schedulingRunLogs,
  schedulingExceptions,
} from './tables';

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

export const insertProjectTypeSchema = createInsertSchema(projectTypes).omit({
  id: true,
  createdAt: true,
});

export const updateProjectTypeSchema = insertProjectTypeSchema.partial();

const baseKanbanStageSchema = createInsertSchema(kanbanStages).omit({
  id: true,
  createdAt: true,
});

export const insertKanbanStageSchema = baseKanbanStageSchema.refine((data) => {
  if (data.assignedWorkRoleId && data.assignedUserId) {
    return false;
  }
  return true;
}, {
  message: "A stage can only have either a work role or a direct user assignment, not both",
  path: ["assignedWorkRoleId", "assignedUserId"],
});

export const updateKanbanStageSchema = baseKanbanStageSchema.partial().refine((data) => {
  if (data.assignedWorkRoleId && data.assignedUserId) {
    return false;
  }
  return true;
}, {
  message: "A stage can only have either a work role or a direct user assignment, not both",
  path: ["assignedWorkRoleId", "assignedUserId"],
});

export const insertChangeReasonSchema = createInsertSchema(changeReasons).omit({
  id: true,
  createdAt: true,
});

export const updateChangeReasonSchema = insertChangeReasonSchema.partial();

export const insertStageApprovalSchema = createInsertSchema(stageApprovals).omit({
  id: true,
  createdAt: true,
});

export const updateStageApprovalSchema = insertStageApprovalSchema.partial();

const baseStageApprovalFieldSchema = createInsertSchema(stageApprovalFields).omit({
  id: true,
  createdAt: true,
});

export const insertStageApprovalFieldSchema = baseStageApprovalFieldSchema.refine((data) => {
  switch (data.fieldType) {
    case 'boolean':
      return data.expectedValueBoolean !== null && data.expectedValueBoolean !== undefined;
    case 'number':
      return data.comparisonType !== null && data.comparisonType !== undefined &&
             data.expectedValueNumber !== null && data.expectedValueNumber !== undefined;
    case 'multi_select':
      return data.options !== null && data.options !== undefined && Array.isArray(data.options) && data.options.length > 0;
    case 'long_text':
      return true;
    default:
      return true;
  }
}, {
  message: "Field type specific validation failed",
  path: ["fieldType"],
});

export const updateStageApprovalFieldSchema = baseStageApprovalFieldSchema.partial().refine((data) => {
  if (!data.fieldType) return true;
  switch (data.fieldType) {
    case 'boolean':
      return data.expectedValueBoolean !== null && data.expectedValueBoolean !== undefined;
    case 'number':
      return data.comparisonType !== null && data.comparisonType !== undefined &&
             data.expectedValueNumber !== null && data.expectedValueNumber !== undefined;
    case 'multi_select':
      return data.options !== null && data.options !== undefined && Array.isArray(data.options) && data.options.length > 0;
    case 'long_text':
      return true;
    default:
      return true;
  }
}, {
  message: "Field type specific validation failed",
  path: ["fieldType"],
});

export const insertStageApprovalResponseSchema = createInsertSchema(stageApprovalResponses).omit({
  id: true,
  createdAt: true,
});

export const insertStageReasonMapSchema = createInsertSchema(stageReasonMaps).omit({
  id: true,
  createdAt: true,
});

export const insertReasonCustomFieldSchema = createInsertSchema(reasonCustomFields).omit({
  id: true,
  createdAt: true,
});

export const updateReasonCustomFieldSchema = insertReasonCustomFieldSchema.partial();

export const insertReasonFieldResponseSchema = createInsertSchema(reasonFieldResponses).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchedulingHistorySchema = createInsertSchema(projectSchedulingHistory).omit({
  id: true,
  createdAt: true,
});

export const insertSchedulingRunLogSchema = createInsertSchema(schedulingRunLogs).omit({
  id: true,
  createdAt: true,
});

// Backward compatibility alias (legacy used plural name)
export const insertSchedulingRunLogsSchema = insertSchedulingRunLogSchema;

export const insertSchedulingExceptionSchema = createInsertSchema(schedulingExceptions).omit({
  id: true,
  createdAt: true,
});

export const completeProjectSchema = z.object({
  projectId: z.string(),
  chronologyNotes: z.string().optional(),
  completionStatus: z.enum(["completed_successfully", "completed_unsuccessfully"]),
});

export const updateProjectStatusSchema = z.object({
  projectId: z.string(),
  newStatus: z.string(),
  notes: z.string().optional(),
  notesHtml: z.string().optional(),
  changeReason: z.string().optional(),
  // Optional IDs to skip lookup queries - if provided, we use these directly
  // instead of looking up stage/reason by name
  stageId: z.string().uuid().optional(),
  reasonId: z.string().uuid().optional(),
  attachments: z.array(z.object({
    fileName: z.string(),
    fileSize: z.number(),
    fileType: z.string(),
    objectPath: z.string(),
  })).optional(),
  fieldResponses: z.array(z.object({
    customFieldId: z.string(),
    fieldType: z.enum(["number", "short_text", "long_text", "multi_select"]),
    valueNumber: z.number().optional(),
    valueShortText: z.string().optional(),
    valueLongText: z.string().optional(),
    valueMultiSelect: z.array(z.string()).optional(),
  })).optional(),
});

export function normalizeProjectMonth(input: string): string {
  const cleaned = input.trim();
  
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    return cleaned;
  }
  
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');
    
    const dayNum = parseInt(paddedDay, 10);
    const monthNum = parseInt(paddedMonth, 10);
    const yearNum = parseInt(year, 10);
    
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31 || yearNum < 2000 || yearNum > 2100) {
      throw new Error("Invalid date values");
    }
    
    return `${paddedDay}/${paddedMonth}/${year}`;
  }
  
  throw new Error("Invalid project month format");
}

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

export {
  insertProjectViewSchema,
  insertUserProjectPreferencesSchema,
  updateUserProjectPreferencesSchema,
} from '../users/schemas';
