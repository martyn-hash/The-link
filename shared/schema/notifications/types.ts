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
