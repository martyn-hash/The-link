import { z } from "zod";
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
import {
  insertDocumentFolderSchema,
  insertDocumentSchema,
  insertSignatureRequestSchema,
  insertSignatureFieldSchema,
  insertSignatureRequestRecipientSchema,
  insertSignatureSchema,
  insertSignatureAuditLogSchema,
  insertSignedDocumentSchema,
} from "./schemas";

export type DocumentFolder = typeof documentFolders.$inferSelect;
export type InsertDocumentFolder = z.infer<typeof insertDocumentFolderSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type SignatureRequest = typeof signatureRequests.$inferSelect;
export type InsertSignatureRequest = z.infer<typeof insertSignatureRequestSchema>;

export type SignatureField = typeof signatureFields.$inferSelect;
export type InsertSignatureField = z.infer<typeof insertSignatureFieldSchema>;

export type SignatureRequestRecipient = typeof signatureRequestRecipients.$inferSelect;
export type InsertSignatureRequestRecipient = z.infer<typeof insertSignatureRequestRecipientSchema>;

export type Signature = typeof signatures.$inferSelect;
export type InsertSignature = z.infer<typeof insertSignatureSchema>;

export type SignatureAuditLog = typeof signatureAuditLogs.$inferSelect;
export type InsertSignatureAuditLog = z.infer<typeof insertSignatureAuditLogSchema>;

export type SignedDocument = typeof signedDocuments.$inferSelect;
export type InsertSignedDocument = z.infer<typeof insertSignedDocumentSchema>;
