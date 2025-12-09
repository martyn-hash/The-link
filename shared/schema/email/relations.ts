import { relations } from "drizzle-orm";
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

export const inboxesRelations = relations(inboxes, ({ one, many }) => ({
  linkedUser: one(users, {
    fields: [inboxes.linkedUserId],
    references: [users.id],
  }),
  userAccess: many(userInboxAccess),
}));

export const userInboxAccessRelations = relations(userInboxAccess, ({ one }) => ({
  user: one(users, {
    fields: [userInboxAccess.userId],
    references: [users.id],
    relationName: "userAccess",
  }),
  inbox: one(inboxes, {
    fields: [userInboxAccess.inboxId],
    references: [inboxes.id],
  }),
  grantedByUser: one(users, {
    fields: [userInboxAccess.grantedBy],
    references: [users.id],
    relationName: "grantedByUser",
  }),
}));
