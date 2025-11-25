import { relations } from "drizzle-orm";
import {
  documentFolders,
  documents,
  signatureRequests,
  signatureFields,
  signatureRequestRecipients,
  signatures,
  signatureAuditLogs,
  signedDocuments,
} from "./tables";

import { users } from "../users/tables";
import { clients, people, clientPortalUsers } from "../clients/tables";
import { messages, messageThreads } from "../communications/tables";

export const documentFoldersRelations = relations(documentFolders, ({ one, many }) => ({
  client: one(clients, {
    fields: [documentFolders.clientId],
    references: [clients.id],
  }),
  createdByUser: one(users, {
    fields: [documentFolders.createdBy],
    references: [users.id],
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  client: one(clients, {
    fields: [documents.clientId],
    references: [clients.id],
  }),
  folder: one(documentFolders, {
    fields: [documents.folderId],
    references: [documentFolders.id],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  clientPortalUser: one(clientPortalUsers, {
    fields: [documents.clientPortalUserId],
    references: [clientPortalUsers.id],
  }),
  message: one(messages, {
    fields: [documents.messageId],
    references: [messages.id],
  }),
  messageThread: one(messageThreads, {
    fields: [documents.threadId],
    references: [messageThreads.id],
  }),
}));

export const signatureRequestsRelations = relations(signatureRequests, ({ one, many }) => ({
  client: one(clients, {
    fields: [signatureRequests.clientId],
    references: [clients.id],
  }),
  document: one(documents, {
    fields: [signatureRequests.documentId],
    references: [documents.id],
  }),
  createdByUser: one(users, {
    fields: [signatureRequests.createdBy],
    references: [users.id],
  }),
  cancelledByUser: one(users, {
    fields: [signatureRequests.cancelledBy],
    references: [users.id],
  }),
  fields: many(signatureFields),
  recipients: many(signatureRequestRecipients),
  signedDocument: one(signedDocuments, {
    fields: [signatureRequests.id],
    references: [signedDocuments.signatureRequestId],
  }),
}));

export const signatureFieldsRelations = relations(signatureFields, ({ one, many }) => ({
  signatureRequest: one(signatureRequests, {
    fields: [signatureFields.signatureRequestId],
    references: [signatureRequests.id],
  }),
  recipientPerson: one(people, {
    fields: [signatureFields.recipientPersonId],
    references: [people.id],
  }),
  signatures: many(signatures),
}));

export const signatureRequestRecipientsRelations = relations(signatureRequestRecipients, ({ one, many }) => ({
  signatureRequest: one(signatureRequests, {
    fields: [signatureRequestRecipients.signatureRequestId],
    references: [signatureRequests.id],
  }),
  person: one(people, {
    fields: [signatureRequestRecipients.personId],
    references: [people.id],
  }),
  signatures: many(signatures),
  auditLogs: many(signatureAuditLogs),
}));

export const signaturesRelations = relations(signatures, ({ one }) => ({
  signatureField: one(signatureFields, {
    fields: [signatures.signatureFieldId],
    references: [signatureFields.id],
  }),
  signatureRequestRecipient: one(signatureRequestRecipients, {
    fields: [signatures.signatureRequestRecipientId],
    references: [signatureRequestRecipients.id],
  }),
}));

export const signatureAuditLogsRelations = relations(signatureAuditLogs, ({ one }) => ({
  signatureRequestRecipient: one(signatureRequestRecipients, {
    fields: [signatureAuditLogs.signatureRequestRecipientId],
    references: [signatureRequestRecipients.id],
  }),
}));

export const signedDocumentsRelations = relations(signedDocuments, ({ one }) => ({
  signatureRequest: one(signatureRequests, {
    fields: [signedDocuments.signatureRequestId],
    references: [signatureRequests.id],
  }),
  client: one(clients, {
    fields: [signedDocuments.clientId],
    references: [clients.id],
  }),
}));
