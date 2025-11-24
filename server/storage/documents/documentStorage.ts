import { db } from "../../db";
import { 
  documentFolders, 
  documents,
  users,
  type DocumentFolder,
  type InsertDocumentFolder,
  type Document,
  type InsertDocument
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export class DocumentStorage {
  // Document folder operations
  async createDocumentFolder(folder: InsertDocumentFolder): Promise<DocumentFolder> {
    const [newFolder] = await db
      .insert(documentFolders)
      .values(folder)
      .returning();
    return newFolder;
  }

  async getDocumentFolderById(id: string): Promise<DocumentFolder | undefined> {
    const result = await db
      .select()
      .from(documentFolders)
      .where(eq(documentFolders.id, id))
      .limit(1);
    return result[0];
  }

  async getDocumentFoldersByClientId(clientId: string): Promise<any[]> {
    const results = await db
      .select({
        id: documentFolders.id,
        clientId: documentFolders.clientId,
        name: documentFolders.name,
        createdBy: documentFolders.createdBy,
        source: documentFolders.source,
        createdAt: documentFolders.createdAt,
        updatedAt: documentFolders.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        documentCount: sql<number>`cast(count(${documents.id}) as int)`,
      })
      .from(documentFolders)
      .leftJoin(users, eq(documentFolders.createdBy, users.id))
      .leftJoin(documents, eq(documents.folderId, documentFolders.id))
      .where(eq(documentFolders.clientId, clientId))
      .groupBy(documentFolders.id, users.id)
      .orderBy(desc(documentFolders.createdAt));
    return results;
  }

  async deleteDocumentFolder(id: string): Promise<void> {
    await db.delete(documentFolders).where(eq(documentFolders.id, id));
  }

  // Document operations
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return newDocument;
  }

  async getDocumentById(id: string): Promise<Document | undefined> {
    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return result[0];
  }

  async getDocumentsByClientId(clientId: string): Promise<any[]> {
    const results = await db
      .select({
        id: documents.id,
        clientId: documents.clientId,
        folderId: documents.folderId,
        uploadedBy: documents.uploadedBy,
        uploadName: documents.uploadName,
        source: documents.source,
        fileName: documents.fileName,
        fileSize: documents.fileSize,
        fileType: documents.fileType,
        objectPath: documents.objectPath,
        uploadedAt: documents.uploadedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(eq(documents.clientId, clientId))
      .orderBy(desc(documents.uploadedAt));
    return results;
  }

  async getDocumentsByFolderId(folderId: string): Promise<any[]> {
    const results = await db
      .select({
        id: documents.id,
        clientId: documents.clientId,
        folderId: documents.folderId,
        uploadedBy: documents.uploadedBy,
        fileName: documents.fileName,
        fileSize: documents.fileSize,
        fileType: documents.fileType,
        objectPath: documents.objectPath,
        uploadedAt: documents.uploadedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(eq(documents.folderId, folderId))
      .orderBy(desc(documents.uploadedAt));
    return results;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Object storage helper
  async getSignedUrl(objectPath: string): Promise<string> {
    const { objectStorageClient } = await import('../../objectStorage');
    const bucketName = process.env.GCS_BUCKET_NAME;
    
    if (!bucketName) {
      throw new Error('GCS_BUCKET_NAME environment variable not set');
    }
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);
    
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });
    
    return url;
  }
}
