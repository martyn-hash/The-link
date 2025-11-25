import { z } from "zod";
import {
  pushSubscriptions,
  pushNotificationTemplates,
  notificationIcons,
  projectTypeNotifications,
  clientRequestReminders,
  scheduledNotifications,
  notificationHistory,
} from "./tables";
import {
  insertPushSubscriptionSchema,
  insertPushNotificationTemplateSchema,
  insertNotificationIconSchema,
  insertProjectTypeNotificationSchema,
  updateProjectTypeNotificationSchema,
  insertClientRequestReminderSchema,
  updateClientRequestReminderSchema,
  insertScheduledNotificationSchema,
  updateScheduledNotificationSchema,
  insertNotificationHistorySchema,
  previewCandidateRecipientSchema,
  previewCandidateSchema,
  previewCandidatesResponseSchema,
  stageChangeNotificationRecipientSchema,
  stageChangeNotificationPreviewSchema,
  sendStageChangeNotificationSchema,
} from "./schemas";

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

export type PushNotificationTemplate = typeof pushNotificationTemplates.$inferSelect;
export type InsertPushNotificationTemplate = z.infer<typeof insertPushNotificationTemplateSchema>;

export type NotificationIcon = typeof notificationIcons.$inferSelect;
export type InsertNotificationIcon = z.infer<typeof insertNotificationIconSchema>;

export type ProjectTypeNotification = typeof projectTypeNotifications.$inferSelect;
export type InsertProjectTypeNotification = z.infer<typeof insertProjectTypeNotificationSchema>;
export type UpdateProjectTypeNotification = z.infer<typeof updateProjectTypeNotificationSchema>;

export type ClientRequestReminder = typeof clientRequestReminders.$inferSelect;
export type InsertClientRequestReminder = z.infer<typeof insertClientRequestReminderSchema>;
export type UpdateClientRequestReminder = z.infer<typeof updateClientRequestReminderSchema>;

export type ScheduledNotification = typeof scheduledNotifications.$inferSelect;
export type InsertScheduledNotification = z.infer<typeof insertScheduledNotificationSchema>;
export type UpdateScheduledNotification = z.infer<typeof updateScheduledNotificationSchema>;

export type NotificationHistory = typeof notificationHistory.$inferSelect;
export type InsertNotificationHistory = z.infer<typeof insertNotificationHistorySchema>;

// Preview candidate types
export type PreviewCandidateRecipient = z.infer<typeof previewCandidateRecipientSchema>;
export type PreviewCandidate = z.infer<typeof previewCandidateSchema>;
export type PreviewCandidatesResponse = z.infer<typeof previewCandidatesResponseSchema>;

// Stage change notification types
export type StageChangeNotificationRecipient = z.infer<typeof stageChangeNotificationRecipientSchema>;
export type StageChangeNotificationPreview = z.infer<typeof stageChangeNotificationPreviewSchema>;
export type SendStageChangeNotification = z.infer<typeof sendStageChangeNotificationSchema>;
