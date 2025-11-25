import { z } from "zod";
import {
  emailMessages,
  mailboxMessageMap,
  emailThreads,
  unmatchedEmails,
  clientEmailAliases,
  clientDomainAllowlist,
  emailAttachments,
  emailMessageAttachments,
  graphWebhookSubscriptions,
  graphSyncState,
} from "./tables";
import {
  insertEmailMessageSchema,
  insertMailboxMessageMapSchema,
  insertEmailThreadSchema,
  insertUnmatchedEmailSchema,
  insertClientEmailAliasSchema,
  insertClientDomainAllowlistSchema,
  insertEmailAttachmentSchema,
  insertEmailMessageAttachmentSchema,
  insertGraphWebhookSubscriptionSchema,
  insertGraphSyncStateSchema,
} from "./schemas";

export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;

export type MailboxMessageMap = typeof mailboxMessageMap.$inferSelect;
export type InsertMailboxMessageMap = z.infer<typeof insertMailboxMessageMapSchema>;

export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;

export type UnmatchedEmail = typeof unmatchedEmails.$inferSelect;
export type InsertUnmatchedEmail = z.infer<typeof insertUnmatchedEmailSchema>;

export type ClientEmailAlias = typeof clientEmailAliases.$inferSelect;
export type InsertClientEmailAlias = z.infer<typeof insertClientEmailAliasSchema>;

export type ClientDomainAllowlist = typeof clientDomainAllowlist.$inferSelect;
export type InsertClientDomainAllowlist = z.infer<typeof insertClientDomainAllowlistSchema>;

export type EmailAttachment = typeof emailAttachments.$inferSelect;
export type InsertEmailAttachment = z.infer<typeof insertEmailAttachmentSchema>;

export type EmailMessageAttachment = typeof emailMessageAttachments.$inferSelect;
export type InsertEmailMessageAttachment = z.infer<typeof insertEmailMessageAttachmentSchema>;

export type GraphWebhookSubscription = typeof graphWebhookSubscriptions.$inferSelect;
export type InsertGraphWebhookSubscription = z.infer<typeof insertGraphWebhookSubscriptionSchema>;

export type GraphSyncState = typeof graphSyncState.$inferSelect;
export type InsertGraphSyncState = z.infer<typeof insertGraphSyncStateSchema>;
