import { createInsertSchema } from "drizzle-zod";
import {
  pushSubscriptions,
  pushNotificationTemplates,
  notificationIcons,
  projectTypeNotifications,
  clientRequestReminders,
  scheduledNotifications,
  notificationHistory,
} from "./tables";

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPushNotificationTemplateSchema = createInsertSchema(pushNotificationTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationIconSchema = createInsertSchema(notificationIcons).omit({
  id: true,
  createdAt: true,
});

export const insertProjectTypeNotificationSchema = createInsertSchema(projectTypeNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProjectTypeNotificationSchema = insertProjectTypeNotificationSchema.partial();

export const insertClientRequestReminderSchema = createInsertSchema(clientRequestReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientRequestReminderSchema = insertClientRequestReminderSchema.partial();

export const insertScheduledNotificationSchema = createInsertSchema(scheduledNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
});

export const updateScheduledNotificationSchema = insertScheduledNotificationSchema.partial();

export const insertNotificationHistorySchema = createInsertSchema(notificationHistory).omit({
  id: true,
  createdAt: true,
});
