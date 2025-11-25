import { z } from "zod";
import {
  clientRequestTemplateCategories,
  clientRequestTemplates,
  clientRequestTemplateSections,
  clientRequestTemplateQuestions,
  clientCustomRequests,
  clientCustomRequestSections,
  clientCustomRequestQuestions,
  clientRequestReminders,
  riskAssessments,
  riskAssessmentResponses,
} from "./tables";
import {
  insertClientRequestTemplateCategorySchema,
  updateClientRequestTemplateCategorySchema,
  insertClientRequestTemplateSchema,
  updateClientRequestTemplateSchema,
  insertClientRequestTemplateSectionSchema,
  updateClientRequestTemplateSectionSchema,
  insertClientRequestTemplateQuestionSchema,
  updateClientRequestTemplateQuestionSchema,
  insertClientCustomRequestSchema,
  updateClientCustomRequestSchema,
  insertClientCustomRequestSectionSchema,
  updateClientCustomRequestSectionSchema,
  insertClientCustomRequestQuestionSchema,
  updateClientCustomRequestQuestionSchema,
  insertClientRequestReminderSchema,
  updateClientRequestReminderSchema,
  insertRiskAssessmentSchema,
  updateRiskAssessmentSchema,
  insertRiskAssessmentResponseSchema,
} from "./schemas";

export type ClientRequestTemplateCategory = typeof clientRequestTemplateCategories.$inferSelect;
export type InsertClientRequestTemplateCategory = z.infer<typeof insertClientRequestTemplateCategorySchema>;
export type UpdateClientRequestTemplateCategory = z.infer<typeof updateClientRequestTemplateCategorySchema>;

export type ClientRequestTemplate = typeof clientRequestTemplates.$inferSelect;
export type InsertClientRequestTemplate = z.infer<typeof insertClientRequestTemplateSchema>;
export type UpdateClientRequestTemplate = z.infer<typeof updateClientRequestTemplateSchema>;

export type ClientRequestTemplateSection = typeof clientRequestTemplateSections.$inferSelect;
export type InsertClientRequestTemplateSection = z.infer<typeof insertClientRequestTemplateSectionSchema>;
export type UpdateClientRequestTemplateSection = z.infer<typeof updateClientRequestTemplateSectionSchema>;

export type ClientRequestTemplateQuestion = typeof clientRequestTemplateQuestions.$inferSelect;
export type InsertClientRequestTemplateQuestion = z.infer<typeof insertClientRequestTemplateQuestionSchema>;
export type UpdateClientRequestTemplateQuestion = z.infer<typeof updateClientRequestTemplateQuestionSchema>;

export type ClientCustomRequest = typeof clientCustomRequests.$inferSelect;
export type InsertClientCustomRequest = z.infer<typeof insertClientCustomRequestSchema>;
export type UpdateClientCustomRequest = z.infer<typeof updateClientCustomRequestSchema>;

export type ClientCustomRequestSection = typeof clientCustomRequestSections.$inferSelect;
export type InsertClientCustomRequestSection = z.infer<typeof insertClientCustomRequestSectionSchema>;
export type UpdateClientCustomRequestSection = z.infer<typeof updateClientCustomRequestSectionSchema>;

export type ClientCustomRequestQuestion = typeof clientCustomRequestQuestions.$inferSelect;
export type InsertClientCustomRequestQuestion = z.infer<typeof insertClientCustomRequestQuestionSchema>;
export type UpdateClientCustomRequestQuestion = z.infer<typeof updateClientCustomRequestQuestionSchema>;

export type ClientRequestReminder = typeof clientRequestReminders.$inferSelect;
export type InsertClientRequestReminder = z.infer<typeof insertClientRequestReminderSchema>;
export type UpdateClientRequestReminder = z.infer<typeof updateClientRequestReminderSchema>;

export type RiskAssessment = typeof riskAssessments.$inferSelect;
export type InsertRiskAssessment = z.infer<typeof insertRiskAssessmentSchema>;
export type UpdateRiskAssessment = z.infer<typeof updateRiskAssessmentSchema>;

export type RiskAssessmentResponse = typeof riskAssessmentResponses.$inferSelect;
export type InsertRiskAssessmentResponse = z.infer<typeof insertRiskAssessmentResponseSchema>;
