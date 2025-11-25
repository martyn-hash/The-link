import { relations } from "drizzle-orm";
import {
  clientRequestTemplateCategories,
  clientRequestTemplates,
  clientRequestTemplateSections,
  clientRequestTemplateQuestions,
  clientCustomRequests,
  clientCustomRequestSections,
  clientCustomRequestQuestions,
  clientRequestReminders,
} from "./tables";

import { users } from "../users/tables";
import { clients } from "../clients/tables";
import { projectTypeNotifications, taskInstances, scheduledNotifications } from "../../schema";

export const clientRequestTemplateCategoriesRelations = relations(clientRequestTemplateCategories, ({ many }) => ({
  templates: many(clientRequestTemplates),
}));

export const clientRequestTemplatesRelations = relations(clientRequestTemplates, ({ one, many }) => ({
  category: one(clientRequestTemplateCategories, {
    fields: [clientRequestTemplates.categoryId],
    references: [clientRequestTemplateCategories.id],
  }),
  createdByUser: one(users, {
    fields: [clientRequestTemplates.createdBy],
    references: [users.id],
  }),
  sections: many(clientRequestTemplateSections),
  taskInstances: many(taskInstances),
}));

export const clientRequestTemplateSectionsRelations = relations(clientRequestTemplateSections, ({ one, many }) => ({
  template: one(clientRequestTemplates, {
    fields: [clientRequestTemplateSections.templateId],
    references: [clientRequestTemplates.id],
  }),
  questions: many(clientRequestTemplateQuestions),
}));

export const clientRequestTemplateQuestionsRelations = relations(clientRequestTemplateQuestions, ({ one }) => ({
  section: one(clientRequestTemplateSections, {
    fields: [clientRequestTemplateQuestions.sectionId],
    references: [clientRequestTemplateSections.id],
  }),
}));

export const clientCustomRequestsRelations = relations(clientCustomRequests, ({ one, many }) => ({
  client: one(clients, {
    fields: [clientCustomRequests.clientId],
    references: [clients.id],
  }),
  createdByUser: one(users, {
    fields: [clientCustomRequests.createdBy],
    references: [users.id],
  }),
  sections: many(clientCustomRequestSections),
  taskInstances: many(taskInstances),
}));

export const clientCustomRequestSectionsRelations = relations(clientCustomRequestSections, ({ one, many }) => ({
  request: one(clientCustomRequests, {
    fields: [clientCustomRequestSections.requestId],
    references: [clientCustomRequests.id],
  }),
  questions: many(clientCustomRequestQuestions),
}));

export const clientCustomRequestQuestionsRelations = relations(clientCustomRequestQuestions, ({ one }) => ({
  section: one(clientCustomRequestSections, {
    fields: [clientCustomRequestQuestions.sectionId],
    references: [clientCustomRequestSections.id],
  }),
}));

export const clientRequestRemindersRelations = relations(clientRequestReminders, ({ one, many }) => ({
  projectTypeNotification: one(projectTypeNotifications, {
    fields: [clientRequestReminders.projectTypeNotificationId],
    references: [projectTypeNotifications.id],
  }),
  scheduledNotifications: many(scheduledNotifications),
}));
