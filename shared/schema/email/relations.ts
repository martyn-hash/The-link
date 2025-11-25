import { relations } from "drizzle-orm";
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

import { users } from "../users/tables";
import { clients } from "../clients/tables";

export const emailThreadsRelations = relations(emailThreads, ({ one, many }) => ({
  client: one(clients, {
    fields: [emailThreads.clientId],
    references: [clients.id],
  }),
  messages: many(emailMessages),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one, many }) => ({
  thread: one(emailThreads, {
    fields: [emailMessages.canonicalConversationId],
    references: [emailThreads.canonicalConversationId],
  }),
  client: one(clients, {
    fields: [emailMessages.clientId],
    references: [clients.id],
  }),
  mailboxOwner: one(users, {
    fields: [emailMessages.mailboxOwnerUserId],
    references: [users.id],
  }),
  mailboxMappings: many(mailboxMessageMap),
  attachmentLinks: many(emailMessageAttachments),
}));

export const mailboxMessageMapRelations = relations(mailboxMessageMap, ({ one }) => ({
  mailboxUser: one(users, {
    fields: [mailboxMessageMap.mailboxUserId],
    references: [users.id],
  }),
  emailMessage: one(emailMessages, {
    fields: [mailboxMessageMap.internetMessageId],
    references: [emailMessages.internetMessageId],
  }),
}));

export const unmatchedEmailsRelations = relations(unmatchedEmails, ({ one }) => ({
  emailMessage: one(emailMessages, {
    fields: [unmatchedEmails.internetMessageId],
    references: [emailMessages.internetMessageId],
  }),
  mailboxOwner: one(users, {
    fields: [unmatchedEmails.mailboxOwnerUserId],
    references: [users.id],
  }),
}));

export const clientEmailAliasesRelations = relations(clientEmailAliases, ({ one }) => ({
  client: one(clients, {
    fields: [clientEmailAliases.clientId],
    references: [clients.id],
  }),
}));

export const clientDomainAllowlistRelations = relations(clientDomainAllowlist, ({ one }) => ({
  client: one(clients, {
    fields: [clientDomainAllowlist.clientId],
    references: [clients.id],
  }),
  createdByUser: one(users, {
    fields: [clientDomainAllowlist.createdBy],
    references: [users.id],
  }),
}));

export const emailAttachmentsRelations = relations(emailAttachments, ({ many }) => ({
  messageLinks: many(emailMessageAttachments),
}));

export const emailMessageAttachmentsRelations = relations(emailMessageAttachments, ({ one }) => ({
  emailMessage: one(emailMessages, {
    fields: [emailMessageAttachments.internetMessageId],
    references: [emailMessages.internetMessageId],
  }),
  attachment: one(emailAttachments, {
    fields: [emailMessageAttachments.attachmentId],
    references: [emailAttachments.id],
  }),
}));

export const graphWebhookSubscriptionsRelations = relations(graphWebhookSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [graphWebhookSubscriptions.userId],
    references: [users.id],
  }),
}));

export const graphSyncStateRelations = relations(graphSyncState, ({ one }) => ({
  user: one(users, {
    fields: [graphSyncState.userId],
    references: [users.id],
  }),
}));
