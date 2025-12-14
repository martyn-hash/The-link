import { z } from "zod";
import {
  emailMessages,
  mailboxMessageMap,
  emailThreads,
  unmatchedEmails,
  emailAttachments,
  emailMessageAttachments,
  graphWebhookSubscriptions,
  graphSyncState,
  inboxes,
  userInboxAccess,
  inboxEmails,
  emailQuarantine,
  emailClassifications,
  emailWorkflowState,
  emailClassificationOverrides,
} from "./tables";
import {
  insertEmailMessageSchema,
  insertMailboxMessageMapSchema,
  insertEmailThreadSchema,
  insertUnmatchedEmailSchema,
  insertEmailAttachmentSchema,
  insertEmailMessageAttachmentSchema,
  insertGraphWebhookSubscriptionSchema,
  insertGraphSyncStateSchema,
  insertInboxSchema,
  insertUserInboxAccessSchema,
  insertInboxEmailSchema,
  insertEmailQuarantineSchema,
  insertEmailClassificationSchema,
  insertEmailWorkflowStateSchema,
  insertEmailClassificationOverrideSchema,
} from "./schemas";

export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;

export type MailboxMessageMap = typeof mailboxMessageMap.$inferSelect;
export type InsertMailboxMessageMap = z.infer<typeof insertMailboxMessageMapSchema>;

export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;

export type UnmatchedEmail = typeof unmatchedEmails.$inferSelect;
export type InsertUnmatchedEmail = z.infer<typeof insertUnmatchedEmailSchema>;

export type EmailAttachment = typeof emailAttachments.$inferSelect;
export type InsertEmailAttachment = z.infer<typeof insertEmailAttachmentSchema>;

export type EmailMessageAttachment = typeof emailMessageAttachments.$inferSelect;
export type InsertEmailMessageAttachment = z.infer<typeof insertEmailMessageAttachmentSchema>;

export type GraphWebhookSubscription = typeof graphWebhookSubscriptions.$inferSelect;
export type InsertGraphWebhookSubscription = z.infer<typeof insertGraphWebhookSubscriptionSchema>;

export type GraphSyncState = typeof graphSyncState.$inferSelect;
export type InsertGraphSyncState = z.infer<typeof insertGraphSyncStateSchema>;

export type Inbox = typeof inboxes.$inferSelect;
export type InsertInbox = z.infer<typeof insertInboxSchema>;

export type UserInboxAccess = typeof userInboxAccess.$inferSelect;
export type InsertUserInboxAccess = z.infer<typeof insertUserInboxAccessSchema>;

export type InboxEmail = typeof inboxEmails.$inferSelect;
export type InsertInboxEmail = z.infer<typeof insertInboxEmailSchema>;

// Comms workflow types
export type EmailQuarantine = typeof emailQuarantine.$inferSelect;
export type InsertEmailQuarantine = z.infer<typeof insertEmailQuarantineSchema>;

export type EmailClassification = typeof emailClassifications.$inferSelect;
export type InsertEmailClassification = z.infer<typeof insertEmailClassificationSchema>;

export type EmailWorkflowState = typeof emailWorkflowState.$inferSelect;
export type InsertEmailWorkflowState = z.infer<typeof insertEmailWorkflowStateSchema>;

export type EmailClassificationOverride = typeof emailClassificationOverrides.$inferSelect;
export type InsertEmailClassificationOverride = z.infer<typeof insertEmailClassificationOverrideSchema>;

// Classification-related type definitions
export type SentimentLabel = "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
export type OpportunityType = "upsell" | "cross_sell" | "referral" | "expansion" | "retention_risk" | "testimonial";
export type UrgencyLevel = "critical" | "high" | "normal" | "low";
export type WorkflowState = "pending" | "working" | "blocked" | "complete";
export type QuarantineReason = "no_client_match" | "no_contact_match" | "dev_override_disabled";
