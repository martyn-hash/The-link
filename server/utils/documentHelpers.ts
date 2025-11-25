/**
 * Document Helper Functions
 * Auto-creation of document records from message attachments
 */

import { db } from '../db';
import { documents, documentFolders } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface MessageAttachment {
  fileName: string;
  fileType: string;
  fileSize: number;
  objectPath: string;
}

interface CreateDocumentsFromAttachmentsParams {
  clientId: string;
  messageId: string;
  threadId: string;
  attachments: MessageAttachment[];
  uploadedBy?: string; // Staff user ID
  clientPortalUserId?: string; // Portal user ID
}

/**
 * Automatically creates document records for message attachments
 * Links them to a "Message Attachments" folder
 */
export async function createDocumentsFromAttachments({
  clientId,
  messageId,
  threadId,
  attachments,
  uploadedBy,
  clientPortalUserId,
}: CreateDocumentsFromAttachmentsParams): Promise<void> {
  if (!attachments || attachments.length === 0) {
    return;
  }

  try {
    // Step 1: Check if "Message Attachments" folder exists for this client
    let messageAttachmentsFolder = await db.query.documentFolders.findFirst({
      where: and(
        eq(documentFolders.clientId, clientId),
        eq(documentFolders.name, 'Message Attachments')
      ),
    });

    // Step 2: Create the folder if it doesn't exist
    if (!messageAttachmentsFolder) {
      // System-generated folders (like "Message Attachments") are created with NULL creator
      // This is more accurate than attributing system actions to a specific user
      // Individual documents track the actual uploader (staff or portal user)
      const [newFolder] = await db
        .insert(documentFolders)
        .values({
          clientId,
          name: 'Message Attachments',
          createdBy: uploadedBy || null, // NULL for portal user uploads (system-generated)
          source: 'message_attachment',
        })
        .returning();

      messageAttachmentsFolder = newFolder;
    }

    // Step 3: Create document records for each attachment
    const documentRecords = attachments.map((attachment) => ({
      clientId,
      folderId: messageAttachmentsFolder!.id,
      messageId,
      threadId,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      fileType: attachment.fileType,
      objectPath: attachment.objectPath,
      source: 'message_attachment' as const,
      uploadedBy: uploadedBy || null,
      clientPortalUserId: clientPortalUserId || null,
      isPortalVisible: true,
    }));

    await db.insert(documents).values(documentRecords);

    console.log(
      `Created ${documentRecords.length} document records for message ${messageId}`
    );
  } catch (error) {
    console.error('Error creating documents from attachments:', error);
    // Don't throw - we don't want to fail the message creation if document creation fails
    // The attachments are still stored in the message's attachments JSON field
  }
}

/**
 * Gets all documents linked to a specific message
 */
export async function getDocumentsByMessageId(
  messageId: string
): Promise<any[]> {
  return db.query.documents.findMany({
    where: eq(documents.messageId, messageId),
    orderBy: (documents, { desc }) => [desc(documents.uploadedAt)],
  });
}

/**
 * Gets all documents linked to a specific thread
 */
export async function getDocumentsByThreadId(threadId: string): Promise<any[]> {
  return db.query.documents.findMany({
    where: eq(documents.threadId, threadId),
    orderBy: (documents, { desc }) => [desc(documents.uploadedAt)],
  });
}

/**
 * Gets count of documents by source type for a client
 */
export async function getDocumentCountBySource(
  clientId: string,
  source: 'direct_upload' | 'message_attachment' | 'task_upload' | 'portal_upload' | 'signature_request'
): Promise<number> {
  const results = await db
    .select()
    .from(documents)
    .where(and(eq(documents.clientId, clientId), eq(documents.source, source)));

  return results.length;
}
