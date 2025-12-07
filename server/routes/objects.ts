import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";

export async function registerObjectRoutes(
  app: Express,
  isAuthenticated: any
) {
  const { authenticateStaffOrPortal, verifyAttachmentAccess } = await import('../middleware/attachmentAccess');

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
