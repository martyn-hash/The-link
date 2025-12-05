import type { Express } from "express";
import { storage } from "../storage/index";
import { z } from "zod";
import {
  validateParams,
  paramUuidSchema,
} from "./routeHelpers";
import {
  insertBookkeepingQuerySchema,
  updateBookkeepingQuerySchema,
} from "@shared/schema";

const paramProjectIdSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format")
});

const bulkUpdateStatusSchema = z.object({
  ids: z.array(z.string().uuid()),
  status: z.enum(['open', 'answered_by_staff', 'sent_to_client', 'answered_by_client', 'resolved']),
});

const markSentToClientSchema = z.object({
  ids: z.array(z.string().uuid()),
});

export function registerQueryRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
) {
  // GET /api/projects/:projectId/queries - Get all queries for a project
  app.get("/api/projects/:projectId/queries", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectId } = req.params;
      const queries = await storage.getQueriesByProjectId(projectId);
      res.json(queries);
    } catch (error) {
      console.error("Error fetching queries:", error);
      res.status(500).json({ message: "Failed to fetch queries" });
    }
  });

  // GET /api/projects/:projectId/queries/stats - Get query statistics for a project
  app.get("/api/projects/:projectId/queries/stats", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectId } = req.params;
      const stats = await storage.getQueryStatsByProjectId(projectId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching query stats:", error);
      res.status(500).json({ message: "Failed to fetch query statistics" });
    }
  });

  // GET /api/projects/:projectId/queries/count - Get query count for a project
  app.get("/api/projects/:projectId/queries/count", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectId } = req.params;
      const openOnly = req.query.openOnly === 'true';
      
      const count = openOnly 
        ? await storage.getOpenQueryCountByProjectId(projectId)
        : await storage.getQueryCountByProjectId(projectId);
      
      res.json({ count });
    } catch (error) {
      console.error("Error fetching query count:", error);
      res.status(500).json({ message: "Failed to fetch query count" });
    }
  });

  // GET /api/queries/:id - Get a specific query by ID
  app.get("/api/queries/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;
      const query = await storage.getQueryById(id);
      
      if (!query) {
        return res.status(404).json({ message: "Query not found" });
      }
      
      res.json(query);
    } catch (error) {
      console.error("Error fetching query:", error);
      res.status(500).json({ message: "Failed to fetch query" });
    }
  });

  // POST /api/projects/:projectId/queries - Create a new query for a project
  app.post("/api/projects/:projectId/queries", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectId } = req.params;
      const userId = req.effectiveUser?.id || req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const validationResult = insertBookkeepingQuerySchema.safeParse({
        ...req.body,
        projectId,
        createdById: userId,
        updatedById: userId,
      });

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid query data",
          errors: validationResult.error.issues
        });
      }

      const query = await storage.createQuery(validationResult.data);
      res.status(201).json(query);
    } catch (error) {
      console.error("Error creating query:", error);
      res.status(500).json({ message: "Failed to create query" });
    }
  });

  // POST /api/projects/:projectId/queries/bulk - Create multiple queries for a project
  app.post("/api/projects/:projectId/queries/bulk", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectId } = req.params;
      const userId = req.effectiveUser?.id || req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      if (!Array.isArray(req.body.queries)) {
        return res.status(400).json({ message: "queries must be an array" });
      }

      const queriesData = req.body.queries.map((q: any) => ({
        ...q,
        projectId,
        createdById: userId,
        updatedById: userId,
      }));

      const validationResults = queriesData.map((q: any) => 
        insertBookkeepingQuerySchema.safeParse(q)
      );

      const errors = validationResults
        .filter((r: any) => !r.success)
        .map((r: any, i: number) => ({ index: i, errors: r.error?.issues }));

      if (errors.length > 0) {
        return res.status(400).json({
          message: "Some queries have invalid data",
          errors
        });
      }

      const validData = validationResults.map((r: any) => r.data);
      const queries = await storage.createQueries(validData);
      res.status(201).json(queries);
    } catch (error) {
      console.error("Error creating bulk queries:", error);
      res.status(500).json({ message: "Failed to create queries" });
    }
  });

  // PATCH /api/queries/:id - Update a query
  app.patch("/api/queries/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;
      const userId = req.effectiveUser?.id || req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const existingQuery = await storage.getQueryById(id);
      if (!existingQuery) {
        return res.status(404).json({ message: "Query not found" });
      }

      const validationResult = updateBookkeepingQuerySchema.safeParse({
        ...req.body,
        updatedById: userId,
      });

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid query data",
          errors: validationResult.error.issues
        });
      }

      const query = await storage.updateQuery(id, validationResult.data);
      res.json(query);
    } catch (error) {
      console.error("Error updating query:", error);
      res.status(500).json({ message: "Failed to update query" });
    }
  });

  // POST /api/queries/bulk-status - Bulk update query status
  app.post("/api/queries/bulk-status", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.effectiveUser?.id || req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const validationResult = bulkUpdateStatusSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validationResult.error.issues
        });
      }

      const { ids, status } = validationResult.data;
      const updatedCount = await storage.bulkUpdateQueryStatus(ids, status, userId);
      
      res.json({ 
        message: `Updated ${updatedCount} queries`,
        updatedCount 
      });
    } catch (error) {
      console.error("Error bulk updating query status:", error);
      res.status(500).json({ message: "Failed to update queries" });
    }
  });

  // POST /api/queries/send-to-client - Mark queries as sent to client
  app.post("/api/queries/send-to-client", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const validationResult = markSentToClientSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validationResult.error.issues
        });
      }

      const { ids } = validationResult.data;
      const updatedCount = await storage.markQueriesAsSentToClient(ids);
      
      res.json({ 
        message: `Marked ${updatedCount} queries as sent to client`,
        updatedCount 
      });
    } catch (error) {
      console.error("Error marking queries as sent to client:", error);
      res.status(500).json({ message: "Failed to mark queries as sent to client" });
    }
  });

  // DELETE /api/queries/:id - Delete a query
  app.delete("/api/queries/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;
      
      const existingQuery = await storage.getQueryById(id);
      if (!existingQuery) {
        return res.status(404).json({ message: "Query not found" });
      }

      await storage.deleteQuery(id);
      res.json({ message: "Query deleted successfully" });
    } catch (error) {
      console.error("Error deleting query:", error);
      res.status(500).json({ message: "Failed to delete query" });
    }
  });

  // DELETE /api/projects/:projectId/queries - Delete all queries for a project
  app.delete("/api/projects/:projectId/queries", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectId } = req.params;
      const deletedCount = await storage.deleteQueriesByProjectId(projectId);
      
      res.json({ 
        message: `Deleted ${deletedCount} queries`,
        deletedCount 
      });
    } catch (error) {
      console.error("Error deleting project queries:", error);
      res.status(500).json({ message: "Failed to delete project queries" });
    }
  });
}
