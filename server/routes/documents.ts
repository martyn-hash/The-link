import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage/index";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";
import { insertDocumentSchema, insertDocumentFolderSchema } from "@shared/schema";
import { validateParams } from "./routeHelpers";

const clientIdSchema = z.object({ clientId: z.string() });
const documentIdSchema = z.object({ id: z.string().uuid() });
const folderIdSchema = z.object({ folderId: z.string().uuid() });
const folderIdAsIdSchema = z.object({ id: z.string().uuid() });

export function registerDocumentRoutes(
  app: Express,
  isAuthenticated: any
) {
  app.get("/api/clients/:clientId/documents", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const documents = await storage.getDocumentsByClientId(clientId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/clients/:clientId/documents", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const userId = req.user?.id;

      const documentURL = req.body.documentURL || req.body.objectPath;
      if (!documentURL) {
        return res.status(400).json({ error: "documentURL or objectPath is required" });
      }

      if (req.body.folderId) {
        const folder = await storage.getDocumentFolderById(req.body.folderId);
        if (!folder) {
          return res.status(404).json({ message: "Folder not found" });
        }
        if (folder.clientId !== clientId) {
          return res.status(403).json({ message: "Folder does not belong to this client" });
        }
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        documentURL,
        {
          owner: userId,
          visibility: "private",
        },
      );

      const documentData = insertDocumentSchema.parse({
        clientId,
        folderId: req.body.folderId || null,
        uploadedBy: userId,
        uploadName: req.body.uploadName || 'Untitled Upload',
        source: req.body.source || 'direct upload',
        fileName: req.body.fileName,
        fileSize: req.body.fileSize,
        fileType: req.body.fileType,
        objectPath,
      });

      const document = await storage.createDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating document:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  app.get("/api/documents/:id/file", isAuthenticated, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const document = await storage.getDocumentById(id);
      if (!document) {
        console.log(`[Admin Document Access Denied] Document not found: ${id}`);
        return res.status(404).json({ message: "Document not found" });
      }

      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(document.objectPath);
        objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error('Error serving admin document:', error);
        if (error instanceof ObjectNotFoundError) {
          return res.status(404).json({ message: 'Document file not found' });
        }
        return res.status(500).json({ message: 'Error serving document' });
      }
    } catch (error) {
      console.error("Error serving admin document:", error);
      res.status(500).json({ message: "Failed to serve document" });
    }
  });

  app.delete("/api/documents/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(documentIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid document ID",
          errors: paramValidation.errors
        });
      }

      const { id } = paramValidation.data;

      const document = await storage.getDocumentById(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      await storage.deleteDocument(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  app.post("/api/clients/:clientId/folders", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const userId = req.user?.id;

      const folderData = insertDocumentFolderSchema.parse({
        clientId,
        name: req.body.name,
        createdBy: userId,
        source: req.body.source || 'manual',
      });

      const folder = await storage.createDocumentFolder(folderData);
      res.status(201).json(folder);
    } catch (error) {
      console.error("Error creating folder:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to create folder" });
    }
  });

  app.get("/api/clients/:clientId/folders", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const folders = await storage.getDocumentFoldersByClientId(clientId);
      res.json(folders);
    } catch (error) {
      console.error("Error fetching folders:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  });

  app.get("/api/folders/:folderId/documents", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(folderIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid folder ID",
          errors: paramValidation.errors
        });
      }

      const { folderId } = paramValidation.data;
      const documents = await storage.getDocumentsByFolderId(folderId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching folder documents:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.delete("/api/folders/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(folderIdAsIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid folder ID",
          errors: paramValidation.errors
        });
      }

      const { id } = paramValidation.data;

      const folder = await storage.getDocumentFolderById(id);
      if (!folder) {
        return res.status(404).json({ message: "Folder not found" });
      }

      await storage.deleteDocumentFolder(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting folder:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });
}
