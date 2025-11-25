import { createInsertSchema } from "drizzle-zod";
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

export const insertClientRequestTemplateCategorySchema = createInsertSchema(clientRequestTemplateCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientRequestTemplateCategorySchema = insertClientRequestTemplateCategorySchema.partial();

export const insertClientRequestTemplateSchema = createInsertSchema(clientRequestTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientRequestTemplateSchema = insertClientRequestTemplateSchema.partial();

export const insertClientRequestTemplateSectionSchema = createInsertSchema(clientRequestTemplateSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientRequestTemplateSectionSchema = insertClientRequestTemplateSectionSchema.partial();

export const insertClientRequestTemplateQuestionSchema = createInsertSchema(clientRequestTemplateQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientRequestTemplateQuestionSchema = insertClientRequestTemplateQuestionSchema.partial();

export const insertClientCustomRequestSchema = createInsertSchema(clientCustomRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientCustomRequestSchema = insertClientCustomRequestSchema.partial();

export const insertClientCustomRequestSectionSchema = createInsertSchema(clientCustomRequestSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientCustomRequestSectionSchema = insertClientCustomRequestSectionSchema.partial();

export const insertClientCustomRequestQuestionSchema = createInsertSchema(clientCustomRequestQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientCustomRequestQuestionSchema = insertClientCustomRequestQuestionSchema.partial();

export const insertClientRequestReminderSchema = createInsertSchema(clientRequestReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientRequestReminderSchema = insertClientRequestReminderSchema.partial();
