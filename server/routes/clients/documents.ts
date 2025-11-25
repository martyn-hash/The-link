import type { Express } from "express";
import { storage } from "../../storage/index";
import { z } from "zod";
import {
  insertDocumentSchema,
  insertDocumentFolderSchema,
} from "@shared/schema";
import {
  validateParams,
  paramClientIdSchema,
  userHasClientAccess,
} from "../routeHelpers";
import { ObjectStorageService, ObjectNotFoundError } from "../../objectStorage";
import { ObjectPermission } from "../../objectAcl";

export function registerClientDocumentRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // GET /api/clients/:clientId/documents - Get all documents for a client
  app.get("/api/clients/:clientId/documents", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
      if (!hasAccess && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied. You don't have permission to access this client's documents." });
      }

      const documents = await storage.getDocumentsByClientId(clientId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // POST /api/clients/:clientId/documents - Upload document for client
  app.post("/api/clients/:clientId/documents", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
      if (!hasAccess && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied. You don't have permission to upload documents for this client." });
      }

      const documentData = insertDocumentSchema.parse({
        ...req.body,
        clientId,
        uploadedBy: effectiveUserId,
      });

      const document = await storage.createDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating document:", error instanceof Error ? error.message : error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid document data",
          errors: error.issues
        });
      }

      res.status(500).json({ message: "Failed to create document" });
    }
  });

  // DELETE /api/documents/:id - Delete document
  app.delete("/api/documents/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = z.object({
        id: z.string().min(1, "Document ID is required")
      }).safeParse(req.params);

      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid document ID",
          errors: paramValidation.error.issues
        });
      }

      const { id } = paramValidation.data;

      const document = await storage.getDocumentById(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.clientId) {
        const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
        const hasAccess = await userHasClientAccess(effectiveUserId, document.clientId);
        if (!hasAccess && !req.user.isAdmin) {
          return res.status(403).json({ message: "Access denied. You don't have permission to delete this document." });
        }
      }

      await storage.deleteDocument(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // GET /api/documents/:documentId/file - Download/serve document file
  app.get("/api/documents/:documentId/file", isAuthenticated, async (req: any, res: any) => {
    try {
      const { documentId } = req.params;

      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.clientId) {
        const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
        const hasAccess = await userHasClientAccess(effectiveUserId, document.clientId);
        if (!hasAccess && !req.user?.isAdmin) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (!document.objectPath) {
        return res.status(404).json({ message: "Document file path not available" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(document.objectPath);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving document file:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "Document file not found in storage" });
      }
      res.status(500).json({ message: "Failed to serve document file" });
    }
  });

  // GET /api/clients/:clientId/documents/:documentId/file - Download/serve document file for specific client
  app.get("/api/clients/:clientId/documents/:documentId/file", isAuthenticated, async (req: any, res: any) => {
    try {
      const { clientId, documentId } = req.params;

      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      if (document.clientId !== clientId) {
        return res.status(403).json({ message: "Document does not belong to this client" });
      }

      if (!document.objectPath) {
        return res.status(404).json({ message: "Document file path not available" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(document.objectPath);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving document file:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "Document file not found in storage" });
      }
      res.status(500).json({ message: "Failed to serve document file" });
    }
  });

  // POST /api/clients/:clientId/folders - Create folder for client
  app.post("/api/clients/:clientId/folders", isAuthenticated, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({ clientId: z.string() });
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

  // GET /api/clients/:clientId/folders - Get folders for client
  app.get("/api/clients/:clientId/folders", isAuthenticated, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({ clientId: z.string() });
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
}
