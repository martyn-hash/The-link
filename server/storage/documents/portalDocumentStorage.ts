import { db } from "../../db";
import { 
  documents,
  type Document,
  type InsertDocument
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export class PortalDocumentStorage {
  // Portal document operations
  async listPortalDocuments(clientId: string, clientPortalUserId: string): Promise<Document[]> {
    const results = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.clientId, clientId),
          eq(documents.isPortalVisible, true)
        )
      )
      .orderBy(desc(documents.uploadedAt));
    return results;
  }

  async createPortalDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values({
        ...document,
        source: 'portal_upload',
        isPortalVisible: true,
      })
      .returning();
    return newDocument;
  }

  async deletePortalDocument(id: string, clientId: string, clientPortalUserId: string): Promise<void> {
    await db
      .delete(documents)
      .where(
        and(
          eq(documents.id, id),
          eq(documents.clientId, clientId),
          eq(documents.clientPortalUserId, clientPortalUserId)
        )
      );
  }

  async getPortalDocumentById(id: string, clientId: string, clientPortalUserId: string): Promise<Document | undefined> {
    const result = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, id),
          eq(documents.clientId, clientId),
          eq(documents.isPortalVisible, true)
        )
      )
      .limit(1);
    return result[0];
  }
}
