import { db } from "../../db.js";
import { 
  signatureRequests,
  signatureRequestRecipients,
  signatureFields,
  signatureAuditLogs,
  type SignatureRequest,
  type InsertSignatureRequest,
  type SignatureRequestRecipient,
  type InsertSignatureRequestRecipient,
  type SignatureField,
  type InsertSignatureField,
  type SignatureAuditLog,
  type InsertSignatureAuditLog
} from "../../../shared/schema.js";
import { eq, desc } from "drizzle-orm";

export class SignatureStorage {
  async createSignatureRequest(request: InsertSignatureRequest): Promise<SignatureRequest> {
    const [newRequest] = await db
      .insert(signatureRequests)
      .values(request)
      .returning();
    return newRequest;
  }

  async getSignatureRequestById(id: string): Promise<SignatureRequest | undefined> {
    const [request] = await db
      .select()
      .from(signatureRequests)
      .where(eq(signatureRequests.id, id));
    return request;
  }

  async getSignatureRequestsByClientId(clientId: string): Promise<SignatureRequest[]> {
    return await db
      .select()
      .from(signatureRequests)
      .where(eq(signatureRequests.clientId, clientId))
      .orderBy(desc(signatureRequests.createdAt));
  }

  async getSignatureRequestByPublicToken(token: string): Promise<SignatureRequest | undefined> {
    const [recipient] = await db
      .select()
      .from(signatureRequestRecipients)
      .where(eq(signatureRequestRecipients.secureToken, token));
    
    if (!recipient) return undefined;
    
    return this.getSignatureRequestById(recipient.signatureRequestId);
  }

  async updateSignatureRequest(id: string, request: Partial<InsertSignatureRequest>): Promise<SignatureRequest> {
    const [updated] = await db
      .update(signatureRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(signatureRequests.id, id))
      .returning();
    return updated;
  }

  async deleteSignatureRequest(id: string): Promise<void> {
    await db.delete(signatureRequests).where(eq(signatureRequests.id, id));
  }

  async createSignatureRequestRecipient(recipient: InsertSignatureRequestRecipient): Promise<SignatureRequestRecipient> {
    const [newRecipient] = await db
      .insert(signatureRequestRecipients)
      .values(recipient)
      .returning();
    return newRecipient;
  }

  async getSignatureRequestRecipientsByRequestId(requestId: string): Promise<SignatureRequestRecipient[]> {
    return await db
      .select()
      .from(signatureRequestRecipients)
      .where(eq(signatureRequestRecipients.signatureRequestId, requestId))
      .orderBy(signatureRequestRecipients.orderIndex);
  }

  async getSignatureRequestRecipientByToken(token: string): Promise<SignatureRequestRecipient | undefined> {
    const [recipient] = await db
      .select()
      .from(signatureRequestRecipients)
      .where(eq(signatureRequestRecipients.secureToken, token));
    return recipient;
  }

  async updateSignatureRequestRecipient(id: string, recipient: Partial<InsertSignatureRequestRecipient>): Promise<SignatureRequestRecipient> {
    const [updated] = await db
      .update(signatureRequestRecipients)
      .set(recipient)
      .where(eq(signatureRequestRecipients.id, id))
      .returning();
    return updated;
  }

  async deleteSignatureRequestRecipient(id: string): Promise<void> {
    await db.delete(signatureRequestRecipients).where(eq(signatureRequestRecipients.id, id));
  }

  async createSignatureField(field: InsertSignatureField): Promise<SignatureField> {
    const [newField] = await db
      .insert(signatureFields)
      .values(field)
      .returning();
    return newField;
  }

  async getSignatureFieldsByRequestId(requestId: string): Promise<SignatureField[]> {
    return await db
      .select()
      .from(signatureFields)
      .where(eq(signatureFields.signatureRequestId, requestId));
  }

  async getSignatureFieldsBySignerId(signerId: string): Promise<SignatureField[]> {
    return await db
      .select()
      .from(signatureFields)
      .where(eq(signatureFields.recipientPersonId, signerId));
  }

  async updateSignatureField(id: string, field: Partial<InsertSignatureField>): Promise<SignatureField> {
    const [updated] = await db
      .update(signatureFields)
      .set(field)
      .where(eq(signatureFields.id, id))
      .returning();
    return updated;
  }

  async deleteSignatureField(id: string): Promise<void> {
    await db.delete(signatureFields).where(eq(signatureFields.id, id));
  }

  async createSignatureAuditLog(log: InsertSignatureAuditLog): Promise<SignatureAuditLog> {
    const [newLog] = await db
      .insert(signatureAuditLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getSignatureAuditLogsByRequestId(requestId: string): Promise<SignatureAuditLog[]> {
    const recipients = await db
      .select({ id: signatureRequestRecipients.id })
      .from(signatureRequestRecipients)
      .where(eq(signatureRequestRecipients.signatureRequestId, requestId));
    
    if (recipients.length === 0) return [];
    
    const recipientIds = recipients.map(r => r.id);
    const logs: SignatureAuditLog[] = [];
    
    for (const recipientId of recipientIds) {
      const recipientLogs = await db
        .select()
        .from(signatureAuditLogs)
        .where(eq(signatureAuditLogs.signatureRequestRecipientId, recipientId))
        .orderBy(desc(signatureAuditLogs.createdAt));
      logs.push(...recipientLogs);
    }
    
    return logs.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }
}
