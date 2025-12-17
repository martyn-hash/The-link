import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  clientProjectTaskTemplates,
  clientProjectTaskSections,
  clientProjectTaskQuestions,
  clientProjectTaskOverrides,
  clientProjectTaskOverrideQuestions,
  clientProjectTaskInstances,
  clientProjectTaskResponses,
  clientProjectTaskTokens,
} from './tables';

const conditionalLogicSchema = z.object({
  showIf: z.object({
    questionId: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty']),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  }).optional(),
  logic: z.enum(['and', 'or']).optional(),
  conditions: z.array(z.object({
    questionId: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty']),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  })).optional(),
}).nullable();

export const insertClientProjectTaskTemplateSchema = createInsertSchema(clientProjectTaskTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientProjectTaskTemplateSchema = insertClientProjectTaskTemplateSchema.partial();

export const insertClientProjectTaskSectionSchema = createInsertSchema(clientProjectTaskSections).omit({
  id: true,
  createdAt: true,
});

export const updateClientProjectTaskSectionSchema = insertClientProjectTaskSectionSchema.partial();

export const insertClientProjectTaskQuestionSchema = createInsertSchema(clientProjectTaskQuestions).omit({
  id: true,
  createdAt: true,
}).extend({
  conditionalLogic: conditionalLogicSchema.optional(),
});

export const updateClientProjectTaskQuestionSchema = insertClientProjectTaskQuestionSchema.partial();

export const insertClientProjectTaskOverrideSchema = createInsertSchema(clientProjectTaskOverrides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientProjectTaskOverrideSchema = insertClientProjectTaskOverrideSchema.partial();

export const insertClientProjectTaskOverrideQuestionSchema = createInsertSchema(clientProjectTaskOverrideQuestions).omit({
  id: true,
  createdAt: true,
}).extend({
  conditionalLogic: conditionalLogicSchema.optional(),
});

export const updateClientProjectTaskOverrideQuestionSchema = insertClientProjectTaskOverrideQuestionSchema.partial();

export const insertClientProjectTaskInstanceSchema = createInsertSchema(clientProjectTaskInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  startedAt: true,
  submittedAt: true,
  stageChangeCompletedAt: true,
});

export const updateClientProjectTaskInstanceSchema = z.object({
  status: z.enum(['pending', 'sent', 'in_progress', 'submitted', 'approved', 'rejected', 'expired']).optional(),
  sentById: z.string().optional(),
  sentAt: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  startedAt: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  submittedAt: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  completedByName: z.string().optional(),
  completedByEmail: z.string().optional(),
  stageChangeCompletedAt: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  preProjectTargetStageId: z.string().optional(),
  projectId: z.string().optional(),
});

const fileAttachmentSchema = z.object({
  objectPath: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  uploadedAt: z.string(),
});

export const insertClientProjectTaskResponseSchema = createInsertSchema(clientProjectTaskResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  valueDate: z.union([z.string(), z.date(), z.null()]).optional().transform((val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  answeredAt: z.union([z.string(), z.date(), z.null()]).optional().transform((val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  valueFile: fileAttachmentSchema.optional().nullable(),
});

export const updateClientProjectTaskResponseSchema = insertClientProjectTaskResponseSchema.partial();

export const insertClientProjectTaskTokenSchema = createInsertSchema(clientProjectTaskTokens).omit({
  id: true,
  createdAt: true,
  accessedAt: true,
}).extend({
  expiresAt: z.union([z.string(), z.date()]).transform((val) => {
    if (val instanceof Date) return val;
    return new Date(val);
  }),
});

export const createTaskTemplateWithQuestionsSchema = z.object({
  template: insertClientProjectTaskTemplateSchema,
  questions: z.array(insertClientProjectTaskQuestionSchema.omit({ templateId: true })).optional(),
});

export const createTaskInstanceSchema = z.object({
  projectId: z.string().optional(),
  clientId: z.string(),
  templateId: z.string(),
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  expiresAt: z.union([z.string(), z.date()]).optional(),
});

export const submitTaskResponsesSchema = z.object({
  responses: z.array(z.object({
    questionId: z.string(),
    questionSource: z.enum(['template', 'override']),
    valueText: z.string().optional().nullable(),
    valueNumber: z.number().optional().nullable(),
    valueDate: z.union([z.string(), z.date()]).optional().nullable(),
    valueBoolean: z.boolean().optional().nullable(),
    valueMultiSelect: z.array(z.string()).optional().nullable(),
    valueFile: fileAttachmentSchema.optional().nullable(),
  })),
  completedByName: z.string().optional(),
  completedByEmail: z.string().email().optional(),
});
