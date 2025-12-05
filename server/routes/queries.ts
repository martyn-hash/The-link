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
  sendToClientSchema,
} from "@shared/schema";

const paramProjectIdSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format")
});

const paramTokenSchema = z.object({
  token: z.string().min(32, "Invalid token format")
});

const bulkUpdateStatusSchema = z.object({
  ids: z.array(z.string().uuid()),
  status: z.enum(['open', 'answered_by_staff', 'sent_to_client', 'answered_by_client', 'resolved']),
});

const markSentToClientSchema = z.object({
  ids: z.array(z.string().uuid()),
});

const clientResponseSchema = z.object({
  responses: z.array(z.object({
    queryId: z.string().uuid(),
    clientResponse: z.string().optional(),
    hasVat: z.boolean().optional(),
  }))
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

  // GET /api/queries/counts - Get open query counts for multiple projects (batch)
  app.get("/api/queries/counts", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Get all projects for the current user context
      const projects = await storage.getAllProjects({ archived: false });
      const projectIds = projects.map((p: any) => p.id);
      
      const countsMap = await storage.getOpenQueryCountsBatch(projectIds);
      
      // Convert Map to object for JSON response
      const counts: Record<string, number> = {};
      countsMap.forEach((count, projectId) => {
        counts[projectId] = count;
      });
      
      res.json(counts);
    } catch (error) {
      console.error("Error fetching query counts:", error);
      res.status(500).json({ message: "Failed to fetch query counts" });
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

      const validationResult = updateBookkeepingQuerySchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid query data",
          errors: validationResult.error.issues
        });
      }

      const query = await storage.updateQuery(id, validationResult.data, userId);
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

  // ========================================
  // SEND TO CLIENT / TOKEN ENDPOINTS
  // ========================================

  // POST /api/projects/:projectId/queries/send-to-client - Generate token and prepare for sending to client
  app.post("/api/projects/:projectId/queries/send-to-client", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const userId = req.effectiveUser?.id || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const validationResult = sendToClientSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validationResult.error.issues
        });
      }

      const { projectId } = req.params;
      const { queryIds, recipientEmail, recipientName, expiryDays } = validationResult.data;

      // Verify all queries exist and belong to this project
      for (const queryId of queryIds) {
        const query = await storage.getQueryById(queryId);
        if (!query) {
          return res.status(404).json({ message: `Query ${queryId} not found` });
        }
        if (query.projectId !== projectId) {
          return res.status(400).json({ message: `Query ${queryId} does not belong to this project` });
        }
      }

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      // Create token
      const token = await storage.createQueryResponseToken({
        projectId,
        expiresAt,
        createdById: userId,
        recipientEmail,
        recipientName: recipientName || null,
        queryCount: queryIds.length,
        queryIds,
      });

      // Mark queries as sent to client
      await storage.markQueriesAsSentToClient(queryIds);

      // Get project details for the response
      const project = await storage.getProject(projectId);

      res.json({
        token: token.token,
        tokenId: token.id,
        expiresAt: token.expiresAt,
        queryCount: queryIds.length,
        responseUrl: `/queries/respond/${token.token}`,
        project: project ? { id: project.id, description: project.description } : null,
      });
    } catch (error) {
      console.error("Error generating send-to-client token:", error);
      res.status(500).json({ message: "Failed to generate response token" });
    }
  });

  // GET /api/query-response/:token - Validate token and get queries (public endpoint)
  app.get("/api/query-response/:token", async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTokenSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid token format",
          errors: paramValidation.errors
        });
      }

      const { token } = req.params;
      const validation = await storage.validateQueryResponseToken(token);

      if (!validation.valid) {
        return res.status(400).json({ 
          message: validation.reason,
          expired: validation.reason === 'Token has expired',
          completed: validation.reason === 'Responses already submitted'
        });
      }

      const tokenData = validation.tokenData!;
      
      // Mark token as accessed on first view
      await storage.markQueryTokenAccessed(tokenData.id);

      // Get the queries for this token
      const queries = await storage.getQueriesForToken(token);

      // Get project details
      const project = await storage.getProject(tokenData.projectId);
      
      // Get client details for display
      let clientName = null;
      if (project) {
        const client = await storage.getClientById(project.clientId);
        clientName = client?.name;
      }

      res.json({
        tokenId: tokenData.id,
        projectId: tokenData.projectId,
        projectDescription: project?.description,
        clientName,
        recipientName: tokenData.recipientName,
        recipientEmail: tokenData.recipientEmail,
        queryCount: tokenData.queryCount,
        expiresAt: tokenData.expiresAt,
        queries: queries.map(q => ({
          id: q.id,
          date: q.date,
          description: q.description,
          moneyIn: q.moneyIn,
          moneyOut: q.moneyOut,
          hasVat: q.hasVat,
          ourQuery: q.ourQuery,
          clientResponse: q.clientResponse,
          status: q.status,
        })),
      });
    } catch (error) {
      console.error("Error validating query response token:", error);
      res.status(500).json({ message: "Failed to validate token" });
    }
  });

  // POST /api/query-response/:token - Submit client responses (public endpoint)
  app.post("/api/query-response/:token", async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTokenSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid token format",
          errors: paramValidation.errors
        });
      }

      const { token } = req.params;
      const validation = await storage.validateQueryResponseToken(token);

      if (!validation.valid) {
        return res.status(400).json({ 
          message: validation.reason,
          expired: validation.reason === 'Token has expired',
          completed: validation.reason === 'Responses already submitted'
        });
      }

      const validationResult = clientResponseSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid response data",
          errors: validationResult.error.issues
        });
      }

      const tokenData = validation.tokenData!;
      const { responses } = validationResult.data;

      // Verify all queries belong to this token
      const tokenQueries = await storage.getQueriesForToken(token);
      const tokenQueryIds = new Set(tokenQueries.map(q => q.id));

      for (const response of responses) {
        if (!tokenQueryIds.has(response.queryId)) {
          return res.status(400).json({ message: `Query ${response.queryId} is not part of this response session` });
        }
      }

      // Update each query with the client response
      let updatedCount = 0;
      for (const response of responses) {
        if (response.clientResponse || response.hasVat !== undefined) {
          await storage.updateQuery(response.queryId, {
            clientResponse: response.clientResponse,
            hasVat: response.hasVat,
            status: 'answered_by_client',
          });
          updatedCount++;
        }
      }

      // Mark the token as completed
      await storage.markQueryTokenCompleted(tokenData.id);

      res.json({
        message: "Responses submitted successfully",
        updatedCount,
      });
    } catch (error) {
      console.error("Error submitting client responses:", error);
      res.status(500).json({ message: "Failed to submit responses" });
    }
  });

  // GET /api/projects/:projectId/query-tokens - Get all tokens for a project
  app.get("/api/projects/:projectId/query-tokens", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectId } = req.params;
      const tokens = await storage.getQueryResponseTokensByProjectId(projectId);
      res.json(tokens);
    } catch (error) {
      console.error("Error fetching query tokens:", error);
      res.status(500).json({ message: "Failed to fetch query tokens" });
    }
  });
}
