import { ObjectStorageService, parseObjectPath, objectStorageClient } from '../objectStorage';
import { randomUUID } from 'crypto';

interface InlineAttachment {
  name: string;
  contentType: string;
  contentBytes: string; // Base64 encoded
  contentId: string;
  isInline: boolean;
}

interface ProcessedEmailContent {
  html: string;
  inlineAttachments: InlineAttachment[];
}

/**
 * Extract inline images from HTML email content and convert them to CID-based inline attachments.
 * This is necessary because images hosted on authenticated routes won't render in external email clients.
 * 
 * The function:
 * 1. Finds all <img> tags with src pointing to our /objects/ routes
 * 2. Fetches the image content from object storage
 * 3. Converts them to base64 inline attachments with Content-ID
 * 4. Replaces the img src with cid: references
 * 
 * @param htmlContent - The HTML email content with inline images
 * @param appHost - The host URL of the application (e.g., "myapp.replit.app")
 * @returns Processed HTML with CID references and array of inline attachments
 */
export async function processInlineImages(
  htmlContent: string,
  appHost?: string
): Promise<ProcessedEmailContent> {
  const inlineAttachments: InlineAttachment[] = [];
  let processedHtml = htmlContent;

  // Pattern to match img tags with src pointing to our object storage routes
  // Matches both absolute URLs (https://host/objects/...) and relative URLs (/objects/...)
  const imgPattern = /<img\s+([^>]*?)src=["']([^"']*\/objects\/[^"']+)["']([^>]*?)>/gi;
  
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = imgPattern.exec(htmlContent)) !== null) {
    matches.push(match);
  }
  
  if (matches.length === 0) {
    return { html: htmlContent, inlineAttachments: [] };
  }

  console.log(`[Inline Image Processor] Found ${matches.length} inline image(s) to process`);

  for (const match of matches) {
    const fullTag = match[0];
    const beforeSrc = match[1];
    const imageUrl = match[2];
    const afterSrc = match[3];
    
    try {
      // Extract the object path from the URL
      // Could be: https://host/objects/inline-images/xyz.png or /objects/inline-images/xyz.png
      const objectPathMatch = imageUrl.match(/\/objects\/(.+)$/);
      if (!objectPathMatch) {
        console.warn(`[Inline Image Processor] Could not extract object path from: ${imageUrl}`);
        continue;
      }
      
      const objectPath = `/objects/${objectPathMatch[1]}`;
      
      // Fetch the image from object storage
      const imageData = await fetchImageFromStorage(objectPath);
      if (!imageData) {
        console.warn(`[Inline Image Processor] Could not fetch image from storage: ${objectPath}`);
        continue;
      }
      
      // Generate a unique content ID for this image
      const contentId = `img_${randomUUID().replace(/-/g, '')}`;
      
      // Determine filename from path
      const pathParts = objectPath.split('/');
      const filename = pathParts[pathParts.length - 1] || `image_${contentId}`;
      
      // Create the inline attachment
      const attachment: InlineAttachment = {
        name: filename,
        contentType: imageData.contentType,
        contentBytes: imageData.base64Content,
        contentId: contentId,
        isInline: true,
      };
      
      inlineAttachments.push(attachment);
      
      // Replace the img src with cid: reference
      const newTag = `<img ${beforeSrc}src="cid:${contentId}"${afterSrc}>`;
      processedHtml = processedHtml.replace(fullTag, newTag);
      
      console.log(`[Inline Image Processor] Converted ${filename} to inline attachment with CID: ${contentId}`);
    } catch (error) {
      console.error(`[Inline Image Processor] Error processing image ${imageUrl}:`, error);
      // Continue with other images even if one fails
    }
  }

  return {
    html: processedHtml,
    inlineAttachments,
  };
}

/**
 * Fetch an image from object storage and return it as base64
 */
async function fetchImageFromStorage(objectPath: string): Promise<{ base64Content: string; contentType: string } | null> {
  try {
    const objectStorageService = new ObjectStorageService();
    
    // Get the private directory and construct full path
    const privateDir = objectStorageService.getPrivateObjectDir();
    
    // The objectPath is like /objects/inline-images/xyz.png
    // We need to convert to the full storage path
    const relativePath = objectPath.replace('/objects/', '');
    const fullPath = `${privateDir}/${relativePath}`;
    
    console.log(`[Inline Image Processor] Fetching image from: ${fullPath}`);
    
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`[Inline Image Processor] File does not exist: ${fullPath}`);
      return null;
    }
    
    // Get file metadata for content type
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'image/png';
    
    // Download the file content
    const [contents] = await file.download();
    const base64Content = contents.toString('base64');
    
    return {
      base64Content,
      contentType,
    };
  } catch (error) {
    console.error(`[Inline Image Processor] Error fetching image ${objectPath}:`, error);
    return null;
  }
}
