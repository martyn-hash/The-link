/**
 * Project domain relations for Drizzle ORM
 * 
 * These relations enable the relational query builder:
 * db.query.projects.findFirst({ with: { client: true, chronology: true } })
 * 
 * Imports are directly from domain modules to avoid circular dependencies.
 */
import { relations } from 'drizzle-orm';
import {
  projects,
  projectChronology,
  projectTypes,
  kanbanStages,
  changeReasons,
  stageReasonMaps,
  stageApprovals,
  stageApprovalFields,
  stageApprovalResponses,
  projectSchedulingHistory,
  reasonCustomFields,
  reasonFieldResponses,
  schedulingRunLogs,
} from './tables';
import { users } from '../users/tables';
import { clients } from '../clients/tables';
import { services, workRoles, clientServices, peopleServices } from '../services/tables';

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
    relationName: 'projectBookkeeper',
  }),
  clientManager: one(users, {
    fields: [projects.clientManagerId],
    references: [users.id],
    relationName: 'projectClientManager',
  }),
  projectOwner: one(users, {
    fields: [projects.projectOwnerId],
    references: [users.id],
    relationName: 'projectOwner',
  }),
  currentAssignee: one(users, {
    fields: [projects.currentAssigneeId],
    references: [users.id],
    relationName: 'projectCurrentAssignee',
  }),
  inactiveByUser: one(users, {
    fields: [projects.inactiveByUserId],
    references: [users.id],
    relationName: 'projectInactiveBy',
  }),
  chronology: many(projectChronology),
  stageApprovalResponses: many(stageApprovalResponses),
  schedulingHistory: many(projectSchedulingHistory, { relationName: 'projectSchedulingHistory' }),
}));

export const projectChronologyRelations = relations(projectChronology, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectChronology.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [projectChronology.assigneeId],
    references: [users.id],
    relationName: 'chronologyAssignee',
  }),
  changedBy: one(users, {
    fields: [projectChronology.changedById],
    references: [users.id],
    relationName: 'chronologyChangedBy',
  }),
  fieldResponses: many(reasonFieldResponses),
}));

export const projectTypesRelations = relations(projectTypes, ({ one, many }) => ({
  service: one(services, {
    fields: [projectTypes.serviceId],
    references: [services.id],
  }),
  kanbanStages: many(kanbanStages),
  changeReasons: many(changeReasons),
  stageApprovals: many(stageApprovals),
  projects: many(projects),
}));

export const kanbanStagesRelations = relations(kanbanStages, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [kanbanStages.projectTypeId],
    references: [projectTypes.id],
  }),
  assignedWorkRole: one(workRoles, {
    fields: [kanbanStages.assignedWorkRoleId],
    references: [workRoles.id],
  }),
  assignedUser: one(users, {
    fields: [kanbanStages.assignedUserId],
    references: [users.id],
  }),
  stageApproval: one(stageApprovals, {
    fields: [kanbanStages.stageApprovalId],
    references: [stageApprovals.id],
  }),
  stageReasonMaps: many(stageReasonMaps),
}));

export const changeReasonsRelations = relations(changeReasons, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [changeReasons.projectTypeId],
    references: [projectTypes.id],
  }),
  stageApproval: one(stageApprovals, {
    fields: [changeReasons.stageApprovalId],
    references: [stageApprovals.id],
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

export const stageApprovalsRelations = relations(stageApprovals, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [stageApprovals.projectTypeId],
    references: [projectTypes.id],
  }),
  fields: many(stageApprovalFields),
  kanbanStages: many(kanbanStages),
  changeReasons: many(changeReasons),
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

export const projectSchedulingHistoryRelations = relations(projectSchedulingHistory, ({ one }) => ({
  clientService: one(clientServices, {
    fields: [projectSchedulingHistory.clientServiceId],
    references: [clientServices.id],
  }),
  peopleService: one(peopleServices, {
    fields: [projectSchedulingHistory.peopleServiceId],
    references: [peopleServices.id],
  }),
  project: one(projects, {
    fields: [projectSchedulingHistory.projectId],
    references: [projects.id],
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

export const schedulingRunLogsRelations = relations(schedulingRunLogs, () => ({}));
