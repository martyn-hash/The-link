import { relations } from "drizzle-orm";
import {
  taskInstances,
  taskInstanceResponses,
  taskTypes,
  internalTasks,
  taskConnections,
  taskProgressNotes,
  taskTimeEntries,
  taskDocuments,
} from "./tables";

import { users } from "../users/tables";
import { clients, people, clientPortalUsers } from "../clients/tables";
import { clientRequestTemplates, clientCustomRequests } from "../../schema";

export const taskInstancesRelations = relations(taskInstances, ({ one, many }) => ({
  template: one(clientRequestTemplates, {
    fields: [taskInstances.templateId],
    references: [clientRequestTemplates.id],
  }),
  customRequest: one(clientCustomRequests, {
    fields: [taskInstances.customRequestId],
    references: [clientCustomRequests.id],
  }),
  client: one(clients, {
    fields: [taskInstances.clientId],
    references: [clients.id],
  }),
  person: one(people, {
    fields: [taskInstances.personId],
    references: [people.id],
  }),
  clientPortalUser: one(clientPortalUsers, {
    fields: [taskInstances.clientPortalUserId],
    references: [clientPortalUsers.id],
  }),
  assignedByUser: one(users, {
    fields: [taskInstances.assignedBy],
    references: [users.id],
    relationName: "taskInstanceAssignedBy",
  }),
  approvedByUser: one(users, {
    fields: [taskInstances.approvedBy],
    references: [users.id],
    relationName: "taskInstanceApprovedBy",
  }),
  responses: many(taskInstanceResponses),
}));

export const taskInstanceResponsesRelations = relations(taskInstanceResponses, ({ one }) => ({
  taskInstance: one(taskInstances, {
    fields: [taskInstanceResponses.taskInstanceId],
    references: [taskInstances.id],
  }),
}));

export const taskTypesRelations = relations(taskTypes, ({ many }) => ({
  internalTasks: many(internalTasks),
}));

export const internalTasksRelations = relations(internalTasks, ({ one, many }) => ({
  taskType: one(taskTypes, {
    fields: [internalTasks.taskTypeId],
    references: [taskTypes.id],
  }),
  createdByUser: one(users, {
    fields: [internalTasks.createdBy],
    references: [users.id],
    relationName: "internalTaskCreatedBy",
  }),
  assignedToUser: one(users, {
    fields: [internalTasks.assignedTo],
    references: [users.id],
    relationName: "internalTaskAssignedTo",
  }),
  closedByUser: one(users, {
    fields: [internalTasks.closedBy],
    references: [users.id],
    relationName: "internalTaskClosedBy",
  }),
  archivedByUser: one(users, {
    fields: [internalTasks.archivedBy],
    references: [users.id],
    relationName: "internalTaskArchivedBy",
  }),
  connections: many(taskConnections),
  progressNotes: many(taskProgressNotes),
  timeEntries: many(taskTimeEntries),
  documents: many(taskDocuments),
}));

export const taskConnectionsRelations = relations(taskConnections, ({ one }) => ({
  task: one(internalTasks, {
    fields: [taskConnections.taskId],
    references: [internalTasks.id],
  }),
}));

export const taskProgressNotesRelations = relations(taskProgressNotes, ({ one }) => ({
  task: one(internalTasks, {
    fields: [taskProgressNotes.taskId],
    references: [internalTasks.id],
  }),
  user: one(users, {
    fields: [taskProgressNotes.userId],
    references: [users.id],
  }),
}));

export const taskTimeEntriesRelations = relations(taskTimeEntries, ({ one }) => ({
  task: one(internalTasks, {
    fields: [taskTimeEntries.taskId],
    references: [internalTasks.id],
  }),
  user: one(users, {
    fields: [taskTimeEntries.userId],
    references: [users.id],
  }),
}));

export const taskDocumentsRelations = relations(taskDocuments, ({ one }) => ({
  task: one(internalTasks, {
    fields: [taskDocuments.taskId],
    references: [internalTasks.id],
  }),
  uploadedByUser: one(users, {
    fields: [taskDocuments.uploadedBy],
    references: [users.id],
  }),
}));
