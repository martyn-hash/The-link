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
  smsTemplates,
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

export const insertSmsTemplateSchema = createInsertSchema(smsTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSmsTemplateSchema = insertSmsTemplateSchema.partial();

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

// Stage change notification schemas (internal staff notifications - legacy)
export const stageChangeNotificationRecipientSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  mobile: z.string().nullable().optional(), // For SMS notifications
  hasPushSubscription: z.boolean().optional(), // Whether user has push notifications enabled
});

// Client Value Notification schemas (client-facing notifications sent via Outlook)
export const clientValueNotificationRecipientSchema = z.object({
  personId: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  mobile: z.string().nullable(), // From people.telephone or people.primaryPhone
  role: z.string().nullable(), // Officer role from clientPeople
  isPrimaryContact: z.boolean(),
  receiveNotifications: z.boolean(), // From people.receiveNotifications
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

// Client Value Notification preview (for client-facing notifications)
export const clientValueNotificationPreviewSchema = z.object({
  projectId: z.string(),
  newStageName: z.string(),
  oldStageName: z.string().optional(),
  dedupeKey: z.string(),
  recipients: z.array(clientValueNotificationRecipientSchema),
  emailSubject: z.string(),
  emailBody: z.string(),
  senderHasOutlook: z.boolean(), // Whether the current staff user has Microsoft Graph configured
  senderEmail: z.string().nullable(), // Staff user's email for sending
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

// Client Value Notification send schema (client-facing via Outlook)
export const sendClientValueNotificationSchema = z.object({
  projectId: z.string(),
  dedupeKey: z.string(),
  emailSubject: z.string(),
  emailBody: z.string(),
  suppress: z.boolean().default(false),
  // Per-channel send controls
  sendEmail: z.boolean().default(true),
  sendSms: z.boolean().default(false), // SMS off by default until VoodooSMS configured
  smsBody: z.string().nullable().optional(),
  // Recipient person IDs for each channel (from people table)
  emailRecipientIds: z.array(z.string()).optional(),
  smsRecipientIds: z.array(z.string()).optional(),
});
