import { relations } from "drizzle-orm";
import {
  pushSubscriptions,
  pushNotificationTemplates,
  notificationIcons,
  projectTypeNotifications,
  clientRequestReminders,
  scheduledNotifications,
  notificationHistory,
} from "./tables";

import { users } from "../users/tables";
import { clients, people, clientPortalUsers } from "../clients/tables";
import { projects, projectTypes, kanbanStages } from "../projects/tables";
import { clientServices } from "../services/tables";
import { clientRequestTemplates } from "../requests/tables";
import { taskInstances } from "../tasks/tables";

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
  clientPortalUser: one(clientPortalUsers, {
    fields: [pushSubscriptions.clientPortalUserId],
    references: [clientPortalUsers.id],
  }),
}));

export const pushNotificationTemplatesRelations = relations(pushNotificationTemplates, () => ({}));

export const notificationIconsRelations = relations(notificationIcons, ({ one }) => ({
  uploadedByUser: one(users, {
    fields: [notificationIcons.uploadedBy],
    references: [users.id],
  }),
}));

export const projectTypeNotificationsRelations = relations(projectTypeNotifications, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [projectTypeNotifications.projectTypeId],
    references: [projectTypes.id],
  }),
  stage: one(kanbanStages, {
    fields: [projectTypeNotifications.stageId],
    references: [kanbanStages.id],
  }),
  clientRequestTemplate: one(clientRequestTemplates, {
    fields: [projectTypeNotifications.clientRequestTemplateId],
    references: [clientRequestTemplates.id],
  }),
  reminders: many(clientRequestReminders),
  scheduledNotifications: many(scheduledNotifications, { relationName: "projectTypeNotificationSource" }),
}));

export const clientRequestRemindersRelations = relations(clientRequestReminders, ({ one, many }) => ({
  projectTypeNotification: one(projectTypeNotifications, {
    fields: [clientRequestReminders.projectTypeNotificationId],
    references: [projectTypeNotifications.id],
  }),
  scheduledNotifications: many(scheduledNotifications, { relationName: "clientRequestReminderSource" }),
}));

export const scheduledNotificationsRelations = relations(scheduledNotifications, ({ one, many }) => ({
  projectTypeNotification: one(projectTypeNotifications, {
    fields: [scheduledNotifications.projectTypeNotificationId],
    references: [projectTypeNotifications.id],
    relationName: "projectTypeNotificationSource",
  }),
  clientRequestReminder: one(clientRequestReminders, {
    fields: [scheduledNotifications.clientRequestReminderId],
    references: [clientRequestReminders.id],
    relationName: "clientRequestReminderSource",
  }),
  client: one(clients, {
    fields: [scheduledNotifications.clientId],
    references: [clients.id],
  }),
  person: one(people, {
    fields: [scheduledNotifications.personId],
    references: [people.id],
  }),
  clientService: one(clientServices, {
    fields: [scheduledNotifications.clientServiceId],
    references: [clientServices.id],
  }),
  project: one(projects, {
    fields: [scheduledNotifications.projectId],
    references: [projects.id],
  }),
  taskInstance: one(taskInstances, {
    fields: [scheduledNotifications.taskInstanceId],
    references: [taskInstances.id],
  }),
  cancelledByUser: one(users, {
    fields: [scheduledNotifications.cancelledBy],
    references: [users.id],
  }),
  history: many(notificationHistory),
}));

export const notificationHistoryRelations = relations(notificationHistory, ({ one }) => ({
  scheduledNotification: one(scheduledNotifications, {
    fields: [notificationHistory.scheduledNotificationId],
    references: [scheduledNotifications.id],
  }),
  client: one(clients, {
    fields: [notificationHistory.clientId],
    references: [clients.id],
  }),
}));
