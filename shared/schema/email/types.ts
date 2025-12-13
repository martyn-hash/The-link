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
