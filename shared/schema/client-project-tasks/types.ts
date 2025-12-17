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
import {
  insertClientProjectTaskTemplateSchema,
  updateClientProjectTaskTemplateSchema,
  insertClientProjectTaskSectionSchema,
  updateClientProjectTaskSectionSchema,
  insertClientProjectTaskQuestionSchema,
  updateClientProjectTaskQuestionSchema,
  insertClientProjectTaskOverrideSchema,
  updateClientProjectTaskOverrideSchema,
  insertClientProjectTaskOverrideQuestionSchema,
  updateClientProjectTaskOverrideQuestionSchema,
  insertClientProjectTaskInstanceSchema,
  updateClientProjectTaskInstanceSchema,
  insertClientProjectTaskResponseSchema,
  updateClientProjectTaskResponseSchema,
  insertClientProjectTaskTokenSchema,
  createTaskTemplateWithQuestionsSchema,
  createTaskInstanceSchema,
  submitTaskResponsesSchema,
} from './schemas';
import type { User } from '../users/types';
import type { Project } from '../projects/types';
import type { Client } from '../clients/types';
import type { KanbanStage, ChangeReason } from '../projects/types';

export type ClientProjectTaskTemplate = typeof clientProjectTaskTemplates.$inferSelect;
export type InsertClientProjectTaskTemplate = z.infer<typeof insertClientProjectTaskTemplateSchema>;
export type UpdateClientProjectTaskTemplate = z.infer<typeof updateClientProjectTaskTemplateSchema>;

export type ClientProjectTaskSection = typeof clientProjectTaskSections.$inferSelect;
export type InsertClientProjectTaskSection = z.infer<typeof insertClientProjectTaskSectionSchema>;
export type UpdateClientProjectTaskSection = z.infer<typeof updateClientProjectTaskSectionSchema>;

export type ClientProjectTaskQuestion = typeof clientProjectTaskQuestions.$inferSelect;
export type InsertClientProjectTaskQuestion = z.infer<typeof insertClientProjectTaskQuestionSchema>;
export type UpdateClientProjectTaskQuestion = z.infer<typeof updateClientProjectTaskQuestionSchema>;

export type ClientProjectTaskOverride = typeof clientProjectTaskOverrides.$inferSelect;
export type InsertClientProjectTaskOverride = z.infer<typeof insertClientProjectTaskOverrideSchema>;
export type UpdateClientProjectTaskOverride = z.infer<typeof updateClientProjectTaskOverrideSchema>;

export type ClientProjectTaskOverrideQuestion = typeof clientProjectTaskOverrideQuestions.$inferSelect;
export type InsertClientProjectTaskOverrideQuestion = z.infer<typeof insertClientProjectTaskOverrideQuestionSchema>;
export type UpdateClientProjectTaskOverrideQuestion = z.infer<typeof updateClientProjectTaskOverrideQuestionSchema>;

export type ClientProjectTaskInstance = typeof clientProjectTaskInstances.$inferSelect;
export type InsertClientProjectTaskInstance = z.infer<typeof insertClientProjectTaskInstanceSchema>;
export type UpdateClientProjectTaskInstance = z.infer<typeof updateClientProjectTaskInstanceSchema>;

export type ClientProjectTaskResponse = typeof clientProjectTaskResponses.$inferSelect;
export type InsertClientProjectTaskResponse = z.infer<typeof insertClientProjectTaskResponseSchema>;
export type UpdateClientProjectTaskResponse = z.infer<typeof updateClientProjectTaskResponseSchema>;

export type ClientProjectTaskToken = typeof clientProjectTaskTokens.$inferSelect;
export type InsertClientProjectTaskToken = z.infer<typeof insertClientProjectTaskTokenSchema>;

export type CreateTaskTemplateWithQuestions = z.infer<typeof createTaskTemplateWithQuestionsSchema>;
export type CreateTaskInstance = z.infer<typeof createTaskInstanceSchema>;
export type SubmitTaskResponses = z.infer<typeof submitTaskResponsesSchema>;

export type ClientProjectTaskStatus = 'pending' | 'sent' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'expired';
export type TaskQuestionSource = 'template' | 'override';

export type ClientProjectTaskSectionWithRelations = ClientProjectTaskSection & {
  questions?: ClientProjectTaskQuestion[];
};

export type ClientProjectTaskTemplateWithRelations = ClientProjectTaskTemplate & {
  projectType?: { id: string; name: string };
  sections?: ClientProjectTaskSection[];
  questions?: ClientProjectTaskQuestion[];
  onCompletionStage?: KanbanStage | null;
  onCompletionStageReason?: ChangeReason | null;
};

export type ClientProjectTaskOverrideWithRelations = ClientProjectTaskOverride & {
  client?: Client;
  baseTemplate?: ClientProjectTaskTemplate;
  questions?: ClientProjectTaskOverrideQuestion[];
  onCompletionStage?: KanbanStage | null;
  onCompletionStageReason?: ChangeReason | null;
};

export type ClientProjectTaskInstanceWithRelations = ClientProjectTaskInstance & {
  project?: Project | null;
  client?: Client;
  template?: ClientProjectTaskTemplate;
  override?: ClientProjectTaskOverride | null;
  responses?: ClientProjectTaskResponse[];
  currentToken?: ClientProjectTaskToken | null;
};

export type ClientProjectTaskTokenWithRelations = ClientProjectTaskToken & {
  instance?: ClientProjectTaskInstance;
  createdBy?: User;
};

export interface MergedTaskQuestion {
  id: string;
  source: TaskQuestionSource;
  questionType: string;
  label: string;
  helpText: string | null;
  isRequired: boolean | null;
  order: number;
  options: string[] | null;
  placeholder: string | null;
  conditionalLogic: unknown | null;
}

export interface ConditionalLogic {
  showIf?: {
    questionId: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
    value?: string | number | boolean | string[];
  };
  logic?: 'and' | 'or';
  conditions?: Array<{
    questionId: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
    value?: string | number | boolean | string[];
  }>;
}
