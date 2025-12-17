import { relations } from 'drizzle-orm';
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
import { users } from '../users/tables';
import { projects, kanbanStages, changeReasons } from '../projects/tables';
import { projectTypes } from '../projects/base';
import { clients } from '../clients/tables';

export const clientProjectTaskTemplatesRelations = relations(clientProjectTaskTemplates, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [clientProjectTaskTemplates.projectTypeId],
    references: [projectTypes.id],
  }),
  sections: many(clientProjectTaskSections),
  questions: many(clientProjectTaskQuestions),
  overrides: many(clientProjectTaskOverrides),
  instances: many(clientProjectTaskInstances),
  onCompletionStage: one(kanbanStages, {
    fields: [clientProjectTaskTemplates.onCompletionStageId],
    references: [kanbanStages.id],
    relationName: "templateOnCompletionStage",
  }),
  onCompletionStageReason: one(changeReasons, {
    fields: [clientProjectTaskTemplates.onCompletionStageReasonId],
    references: [changeReasons.id],
    relationName: "templateOnCompletionReason",
  }),
}));

export const clientProjectTaskSectionsRelations = relations(clientProjectTaskSections, ({ one, many }) => ({
  template: one(clientProjectTaskTemplates, {
    fields: [clientProjectTaskSections.templateId],
    references: [clientProjectTaskTemplates.id],
  }),
  questions: many(clientProjectTaskQuestions),
}));

export const clientProjectTaskQuestionsRelations = relations(clientProjectTaskQuestions, ({ one }) => ({
  template: one(clientProjectTaskTemplates, {
    fields: [clientProjectTaskQuestions.templateId],
    references: [clientProjectTaskTemplates.id],
  }),
  section: one(clientProjectTaskSections, {
    fields: [clientProjectTaskQuestions.sectionId],
    references: [clientProjectTaskSections.id],
  }),
}));

export const clientProjectTaskOverridesRelations = relations(clientProjectTaskOverrides, ({ one, many }) => ({
  client: one(clients, {
    fields: [clientProjectTaskOverrides.clientId],
    references: [clients.id],
  }),
  baseTemplate: one(clientProjectTaskTemplates, {
    fields: [clientProjectTaskOverrides.baseTemplateId],
    references: [clientProjectTaskTemplates.id],
  }),
  questions: many(clientProjectTaskOverrideQuestions),
  instances: many(clientProjectTaskInstances),
  onCompletionStage: one(kanbanStages, {
    fields: [clientProjectTaskOverrides.onCompletionStageId],
    references: [kanbanStages.id],
    relationName: "overrideOnCompletionStage",
  }),
  onCompletionStageReason: one(changeReasons, {
    fields: [clientProjectTaskOverrides.onCompletionStageReasonId],
    references: [changeReasons.id],
    relationName: "overrideOnCompletionReason",
  }),
}));

export const clientProjectTaskOverrideQuestionsRelations = relations(clientProjectTaskOverrideQuestions, ({ one }) => ({
  override: one(clientProjectTaskOverrides, {
    fields: [clientProjectTaskOverrideQuestions.overrideId],
    references: [clientProjectTaskOverrides.id],
  }),
}));

export const clientProjectTaskInstancesRelations = relations(clientProjectTaskInstances, ({ one, many }) => ({
  project: one(projects, {
    fields: [clientProjectTaskInstances.projectId],
    references: [projects.id],
  }),
  client: one(clients, {
    fields: [clientProjectTaskInstances.clientId],
    references: [clients.id],
  }),
  template: one(clientProjectTaskTemplates, {
    fields: [clientProjectTaskInstances.templateId],
    references: [clientProjectTaskTemplates.id],
  }),
  override: one(clientProjectTaskOverrides, {
    fields: [clientProjectTaskInstances.overrideId],
    references: [clientProjectTaskOverrides.id],
  }),
  responses: many(clientProjectTaskResponses),
  tokens: many(clientProjectTaskTokens),
}));

export const clientProjectTaskResponsesRelations = relations(clientProjectTaskResponses, ({ one }) => ({
  instance: one(clientProjectTaskInstances, {
    fields: [clientProjectTaskResponses.instanceId],
    references: [clientProjectTaskInstances.id],
  }),
}));

export const clientProjectTaskTokensRelations = relations(clientProjectTaskTokens, ({ one }) => ({
  instance: one(clientProjectTaskInstances, {
    fields: [clientProjectTaskTokens.instanceId],
    references: [clientProjectTaskInstances.id],
  }),
  createdBy: one(users, {
    fields: [clientProjectTaskTokens.createdById],
    references: [users.id],
    relationName: "taskTokenCreatedBy",
  }),
}));
