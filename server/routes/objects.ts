import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient, parseObjectPath } from "../objectStorage";
import { z } from "zod";
import { randomUUID } from "crypto";

const inlineImageSchema = z.object({
  imageData: z.string().min(1, "Image data is required"),
  filename: z.string().optional(),
});

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export async function registerObjectRoutes(
  app: Express,
  isAuthenticated: any
) {
  const { authenticateStaffOrPortal, verifyAttachmentAccess } = await import('../middleware/attachmentAccess');

  app.post("/api/objects/upload/inline-image", isAuthenticated, async (req: any, res: any) => {
    try {
      const validation = inlineImageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validation.error.issues
        });
      }

      const { imageData, filename } = validation.data;

      const dataUrlMatch = imageData.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
      if (!dataUrlMatch) {
        return res.status(400).json({
          message: "Invalid image format. Please use PNG, JPEG, GIF, or WebP."
        });
      }

      const imageType = dataUrlMatch[1] === 'jpg' ? 'jpeg' : dataUrlMatch[1];
      const base64Data = dataUrlMatch[2];
      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length > MAX_IMAGE_SIZE) {
        return res.status(400).json({
          message: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`
        });
      }

      const objectStorageService = new ObjectStorageService();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const imageId = randomUUID();
      const extension = imageType === 'jpeg' ? 'jpg' : imageType;
      const objectName = `inline-images/${imageId}.${extension}`;
      const fullPath = `${privateDir}/${objectName}`;

      const { bucketName, objectName: objName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objName);

      await file.save(buffer, {
        contentType: `image/${imageType}`,
        metadata: {
          contentType: `image/${imageType}`,
          uploadedBy: req.user?.id || 'unknown',
          uploadedAt: new Date().toISOString(),
        },
      });

      const objectPath = `/objects/${objectName}`;
      const baseUrl = process.env.BASE_URL || 'https://flow.growth.accountants';
      const permanentUrl = `${baseUrl}${objectPath}`;

      console.log(`[Inline Image Upload] User ${req.user?.id} uploaded image: ${objectPath} (${(buffer.length / 1024).toFixed(1)} KB)`);

      res.json({
        success: true,
        url: permanentUrl,
        objectPath,
        size: buffer.length,
        contentType: `image/${imageType}`,
      });
    } catch (error) {
      console.error("Error uploading inline image:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req: any, res: any) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error generating upload URL:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.get("/objects/:objectPath(*)", authenticateStaffOrPortal, async (req: any, res: any) => {
    const userId = req.user?.id;
    const portalUserId = req.portalUser?.id;
    const objectPath = req.path;

    try {
      const { hasAccess } = await verifyAttachmentAccess(userId, portalUserId, objectPath);

      if (!hasAccess) {
        console.log(`[Access Denied] Staff: ${userId || 'none'}, Portal: ${portalUserId || 'none'}, Path: ${objectPath}`);
        return res.status(403).json({ message: 'You do not have permission to access this file' });
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: 'File not found' });
      }
      return res.status(500).json({ message: 'Error accessing file' });
    }
  });
}
