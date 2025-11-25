import { createInsertSchema } from "drizzle-zod";
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

export const insertDocumentFolderSchema = createInsertSchema(documentFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export const insertSignatureRequestSchema = createInsertSchema(signatureRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
});

export const insertSignatureFieldSchema = createInsertSchema(signatureFields).omit({
  id: true,
  createdAt: true,
});

export const insertSignatureRequestRecipientSchema = createInsertSchema(signatureRequestRecipients).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  viewedAt: true,
  signedAt: true,
});

export const insertSignatureSchema = createInsertSchema(signatures).omit({
  id: true,
  createdAt: true,
  signedAt: true,
});

export const insertSignatureAuditLogSchema = createInsertSchema(signatureAuditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertSignedDocumentSchema = createInsertSchema(signedDocuments).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
