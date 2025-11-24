import { storage } from '../storage/index';
import { downloadEmailAttachment } from '../utils/userOutlookClient';
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';

/**
 * Email Attachment Service
 * Handles downloading, deduplicating, and storing email attachments
 */
export class EmailAttachmentService {
  private gcStorage: Storage;
  private bucketName: string;

  constructor() {
    this.gcStorage = new Storage();
    // Get bucket from environment (set up by Replit Object Storage)
    this.bucketName = process.env.PRIVATE_OBJECT_DIR?.split('/')[1] || 'replit-objstore';
  }

  /**
   * Compute SHA-256 hash of attachment content for deduplication
   */
  private computeContentHash(content: Buffer): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  /**
   * Upload attachment content to object storage
   * Returns the object path
   */
  private async uploadToObjectStorage(
    content: Buffer,
    contentHash: string,
    fileName: string,
    contentType: string
  ): Promise<string> {
    // Store in private directory with hash-based path for deduplication
    const objectPath = `email-attachments/${contentHash.substring(0, 2)}/${contentHash}/${fileName}`;
    const bucket = this.gcStorage.bucket(this.bucketName);
    const file = bucket.file(objectPath);

    await file.save(content, {
      metadata: {
        contentType,
        metadata: {
          originalFileName: fileName,
          contentHash,
        }
      }
    });

    return objectPath;
  }

  /**
   * Process attachments for an email message
   * Downloads attachments from Graph API, deduplicates, and stores
   * 
   * @param userId - User ID who owns the mailbox
   * @param graphMessageId - Graph API message ID
   * @param internetMessageId - Global internet message ID for linking
   * @param attachments - Array of attachment metadata from Graph API
   */
  async processMessageAttachments(
    userId: string,
    graphMessageId: string,
    internetMessageId: string,
    attachments: Array<{
      id: string;
      name: string;
      size: number;
      contentType: string;
      isInline?: boolean;
    }>
  ): Promise<{ processed: number; skipped: number; errors: number }> {
    const stats = { processed: 0, skipped: 0, errors: 0 };

    console.log(`[Attachment Service] Processing ${attachments.length} attachments for message ${internetMessageId}`);

    for (let index = 0; index < attachments.length; index++) {
      const attachment = attachments[index];

      try {
        // Skip inline attachments (embedded images)
        if (attachment.isInline) {
          console.log(`[Attachment Service] Skipping inline attachment: ${attachment.name}`);
          stats.skipped++;
          continue;
        }

        // Skip very large attachments (>25MB) to avoid memory issues
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (attachment.size > maxSize) {
          console.warn(`[Attachment Service] Skipping large attachment (${attachment.size} bytes): ${attachment.name}`);
          stats.skipped++;
          continue;
        }

        // Download attachment content from Graph API
        console.log(`[Attachment Service] Downloading attachment: ${attachment.name} (${attachment.size} bytes)`);
        const content = await downloadEmailAttachment(userId, graphMessageId, attachment.id);

        // Compute content hash for deduplication
        const contentHash = this.computeContentHash(content);

        // Check if attachment already exists by hash
        let existingAttachment = await storage.getEmailAttachmentByHash(contentHash);

        if (!existingAttachment) {
          // Upload to object storage
          console.log(`[Attachment Service] Uploading new attachment to object storage: ${attachment.name}`);
          const objectPath = await this.uploadToObjectStorage(
            content,
            contentHash,
            attachment.name,
            attachment.contentType
          );

          // Create attachment record
          existingAttachment = await storage.createEmailAttachment({
            contentHash,
            fileName: attachment.name,
            fileSize: attachment.size,
            contentType: attachment.contentType,
            objectPath,
          });

          console.log(`[Attachment Service] Created new attachment record: ${existingAttachment.id}`);
        } else {
          console.log(`[Attachment Service] Attachment already exists (deduplicated): ${existingAttachment.id}`);
        }

        // Link attachment to message (idempotent - check if link already exists)
        const alreadyLinked = await storage.checkEmailMessageAttachmentExists(
          internetMessageId,
          existingAttachment.id
        );

        if (!alreadyLinked) {
          await storage.createEmailMessageAttachment({
            internetMessageId,
            attachmentId: existingAttachment.id,
            attachmentIndex: index,
          });
          console.log(`[Attachment Service] Linked attachment to message: ${existingAttachment.id}`);
        } else {
          console.log(`[Attachment Service] Attachment already linked to message: ${existingAttachment.id}`);
        }

        stats.processed++;
      } catch (error) {
        console.error(`[Attachment Service] Error processing attachment ${attachment.name}:`, error);
        stats.errors++;
      }
    }

    console.log(`[Attachment Service] Attachment processing complete for ${internetMessageId}:`, stats);
    return stats;
  }
}

// Export singleton instance
export const emailAttachmentService = new EmailAttachmentService();
