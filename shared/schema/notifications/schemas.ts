import { createInsertSchema } from "drizzle-zod";
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

// Preview candidate schemas for notification previews
export const previewCandidateRecipientSchema = z.object({
  personId: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  canPreview: z.boolean(),
  ineligibleReason: z.string().optional(),
});

export const previewCandidateSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  projectId: z.string(),
  projectName: z.string().nullable(),
  projectDescription: z.string().nullable(),
  stageId: z.string().nullable(),
  stageName: z.string().nullable(),
  dueDate: z.date().nullable(),
  clientServiceId: z.string(),
  clientServiceName: z.string(),
  frequency: z.string().nullable(),
  recipients: z.array(previewCandidateRecipientSchema),
});

export const previewCandidatesResponseSchema = z.object({
  candidates: z.array(previewCandidateSchema),
  hasEligibleCandidates: z.boolean(),
  message: z.string().optional(),
});

// Stage change notification schemas
export const stageChangeNotificationRecipientSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  mobile: z.string().nullable().optional(), // For SMS notifications
  hasPushSubscription: z.boolean().optional(), // Whether user has push notifications enabled
});

export const stageChangeNotificationPreviewSchema = z.object({
  projectId: z.string(),
  newStageName: z.string(),
  oldStageName: z.string().optional(),
  dedupeKey: z.string(),
  recipients: z.array(stageChangeNotificationRecipientSchema),
  emailSubject: z.string(),
  emailBody: z.string(),
  pushTitle: z.string().nullable(),
  pushBody: z.string().nullable(),
  metadata: z.object({
    projectName: z.string(),
    clientName: z.string(),
    dueDate: z.string().optional(),
    changeReason: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const sendStageChangeNotificationSchema = z.object({
  projectId: z.string(),
  dedupeKey: z.string(),
  emailSubject: z.string(),
  emailBody: z.string(),
  pushTitle: z.string().nullable(),
  pushBody: z.string().nullable(),
  suppress: z.boolean().default(false),
  // Per-channel send controls (default to true for backward compatibility)
  sendEmail: z.boolean().default(true),
  sendPush: z.boolean().default(true),
  sendSms: z.boolean().default(false), // SMS off by default until configured
  smsBody: z.string().nullable().optional(),
  // Optional: specify recipient IDs for each channel
  emailRecipientIds: z.array(z.string()).optional(),
  pushRecipientIds: z.array(z.string()).optional(),
  smsRecipientIds: z.array(z.string()).optional(),
});
