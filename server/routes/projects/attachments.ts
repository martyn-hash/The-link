import type { Express } from "express";
import { storage } from "../../storage/index";
import { ObjectStorageService, ObjectNotFoundError } from "../../objectStorage";

export function registerProjectAttachmentsRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  app.post("/api/projects/:id/stage-change-attachments/upload-url", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { fileName, fileType } = req.body;
      const projectId = req.params.id;

      if (!fileName || !fileType) {
        return res.status(400).json({ message: "fileName and fileType are required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      const fullPath = `${privateDir}/stage-change-attachments/${projectId}/${timestamp}_${sanitizedFileName}`;

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getUploadURLForPath(fullPath);

      const objectPath = `/${timestamp}_${sanitizedFileName}`;

      res.json({
        url: uploadURL,
        objectPath,
        fileName,
        fileType,
      });
    } catch (error) {
      console.error("Error generating upload URL for stage change attachment:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.get("/api/projects/:id/stage-change-attachments/*", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const projectId = req.params.id;

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const urlPath = req.path;
      let pathAfterProject = urlPath.replace(`/api/projects/${projectId}/stage-change-attachments`, '');
      
      const legacyPrefix = `/stage-change-attachments/${projectId}`;
      if (pathAfterProject.startsWith(legacyPrefix)) {
        pathAfterProject = pathAfterProject.substring(legacyPrefix.length);
      }
      
      const objectPath = `/objects/stage-change-attachments/${projectId}${pathAfterProject}`;

      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error("Error serving stage change attachment:", error);
        if (error instanceof ObjectNotFoundError) {
          return res.status(404).json({ message: "Attachment not found" });
        }
        return res.status(500).json({ message: "Error serving attachment" });
      }
    } catch (error) {
      console.error("Error serving stage change attachment:", error);
      res.status(500).json({ message: "Failed to serve attachment" });
    }
  });
}
