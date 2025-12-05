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
import { sendBookkeepingQueryEmail } from "../emailService";

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

      // Get project and client details for the email
      const project = await storage.getProject(projectId);
      const client = project ? await storage.getClientById(project.clientId) : null;
      const sender = await storage.getUser(userId);
      
      // Get the queries for the email
      const queriesForEmail = await Promise.all(
        queryIds.map(id => storage.getQueryById(id))
      );
      const validQueries = queriesForEmail.filter(q => q !== null) as any[];
      
      // Send the email notification
      const responseUrl = `/queries/respond/${token.token}`;
      const emailSent = await sendBookkeepingQueryEmail(
        recipientEmail,
        recipientName || recipientEmail.split('@')[0],
        client?.name || 'Your Client',
        project?.description || 'Bookkeeping',
        responseUrl,
        validQueries.map(q => ({
          date: q.date,
          description: q.description,
          moneyIn: q.moneyIn,
          moneyOut: q.moneyOut,
          hasVat: q.hasVat,
          ourQuery: q.ourQuery,
        })),
        expiresAt,
        sender?.firstName || undefined
      );
      
      // Return response with email status
      // Note: Even if email fails, the token is still valid and can be shared manually
      res.json({
        token: token.token,
        tokenId: token.id,
        expiresAt: token.expiresAt,
        queryCount: queryIds.length,
        responseUrl,
        emailSent,
        emailWarning: !emailSent ? 'Email could not be sent. You can share the link manually.' : undefined,
        project: project ? { id: project.id, description: project.description } : null,
      });
    } catch (error) {
      console.error("Error generating send-to-client token:", error);
      res.status(500).json({ message: "Failed to generate response token" });
    }
  });

  // POST /api/projects/:projectId/queries/prepare-email - Generate token and return email content (for use with Email Dialog)
  app.post("/api/projects/:projectId/queries/prepare-email", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
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

      const { queryIds, expiryDays, includeOnlineLink = true } = req.body;
      
      if (!queryIds || !Array.isArray(queryIds) || queryIds.length === 0) {
        return res.status(400).json({ message: "queryIds is required and must be a non-empty array" });
      }
      
      // Validate expiryDays if link is included
      if (includeOnlineLink) {
        const days = expiryDays ?? 3; // Default to 3 days
        if (typeof days !== 'number' || days < 1 || days > 30) {
          return res.status(400).json({ message: "expiryDays must be between 1 and 30 when including online link" });
        }
      }

      const { projectId } = req.params;

      // Verify all queries exist and belong to this project
      const queries = [];
      for (const queryId of queryIds) {
        const query = await storage.getQueryById(queryId);
        if (!query) {
          return res.status(404).json({ message: `Query ${queryId} not found` });
        }
        if (query.projectId !== projectId) {
          return res.status(400).json({ message: `Query ${queryId} does not belong to this project` });
        }
        queries.push(query);
      }

      // Get project and client details
      const project = await storage.getProject(projectId);
      const client = project ? await storage.getClientById(project.clientId) : null;
      const sender = await storage.getUser(userId);

      // Only create token and URLs if online link is requested
      let token = null;
      let responseUrl = null;
      let fullResponseUrl = null;
      let expiresAt = null;
      const effectiveExpiryDays = expiryDays ?? 3; // Default to 3 days

      if (includeOnlineLink) {
        // Calculate expiry date
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + effectiveExpiryDays);

        // Create token (we'll use a placeholder email for now, updated when actually sent)
        token = await storage.createQueryResponseToken({
          projectId,
          expiresAt,
          createdById: userId,
          recipientEmail: 'pending@placeholder.com', // Will be updated when email is sent
          recipientName: null,
          queryCount: queryIds.length,
          queryIds,
        });

        // Build the response URL
        responseUrl = `/queries/respond/${token.token}`;
        fullResponseUrl = `${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0] || 'https://yourapp.replit.app'}${responseUrl}`;
      }

      // Format currency helper
      const formatCurrency = (amount: string | null) => {
        if (!amount) return '';
        const num = parseFloat(amount);
        if (isNaN(num)) return '';
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(num);
      };

      // Format date helper
      const formatDate = (date: Date | string | null) => {
        if (!date) return '';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      };

      // Build HTML table for queries with explicit borders for email client compatibility
      const borderStyle = '1px solid #e2e8f0';
      const queriesTableHtml = `
<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border: ${borderStyle};">
  <thead>
    <tr style="background-color: #f8fafc;">
      <th style="padding: 12px; text-align: left; font-weight: 600; color: #334155; border: ${borderStyle};">Date</th>
      <th style="padding: 12px; text-align: left; font-weight: 600; color: #334155; border: ${borderStyle};">Description</th>
      <th style="padding: 12px; text-align: right; font-weight: 600; color: #16a34a; border: ${borderStyle};">Money In</th>
      <th style="padding: 12px; text-align: right; font-weight: 600; color: #dc2626; border: ${borderStyle};">Money Out</th>
      <th style="padding: 12px; text-align: left; font-weight: 600; color: #334155; border: ${borderStyle};">Query</th>
    </tr>
  </thead>
  <tbody>
    ${queries.map((q, i) => `
    <tr style="${i % 2 === 1 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;'}">
      <td style="padding: 12px; color: #475569; border: ${borderStyle};">${formatDate(q.date)}</td>
      <td style="padding: 12px; color: #475569; border: ${borderStyle};">${q.description || ''}</td>
      <td style="padding: 12px; text-align: right; color: #16a34a; border: ${borderStyle};">${q.moneyIn ? formatCurrency(q.moneyIn) : '-'}</td>
      <td style="padding: 12px; text-align: right; color: #dc2626; border: ${borderStyle};">${q.moneyOut ? formatCurrency(q.moneyOut) : '-'}</td>
      <td style="padding: 12px; color: #1e293b; font-weight: 500; border: ${borderStyle};">${q.ourQuery || ''}</td>
    </tr>
    `).join('')}
  </tbody>
</table>`;

      // Build the full email content - conditionally include link based on includeOnlineLink
      const emailSubject = `Bookkeeping Queries - ${project?.description || 'Your Account'}`;
      
      const linkSection = includeOnlineLink && fullResponseUrl ? `
<p style="margin: 24px 0;">
  <a href="${fullResponseUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Click here to respond to these queries
  </a>
</p>

<p style="color: #64748b; font-size: 14px;">This link will expire on ${formatDate(expiresAt)}.</p>
` : '';

      const emailContent = `
<p>Hello,</p>

<p>We have some questions about the following transactions that we need your help to clarify:</p>

${queriesTableHtml}

${linkSection}

<p>If you have any questions, please don't hesitate to get in touch.</p>

<p>Best regards,<br>${sender?.firstName || 'The Team'}</p>
`;

      res.json({
        tokenId: token?.id || null,
        token: token?.token || null,
        expiresAt: expiresAt,
        queryCount: queryIds.length,
        responseUrl,
        fullResponseUrl,
        emailSubject,
        emailContent,
        includeOnlineLink,
        project: project ? { id: project.id, description: project.description, clientId: project.clientId } : null,
        client: client ? { id: client.id, name: client.name } : null,
      });
    } catch (error) {
      console.error("Error preparing query email:", error);
      res.status(500).json({ message: "Failed to prepare query email" });
    }
  });

  // POST /api/projects/:projectId/queries/mark-sent - Mark queries as sent and log to chronology
  app.post("/api/projects/:projectId/queries/mark-sent", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
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

      const { queryIds, tokenId, recipientEmail, recipientName } = req.body;
      
      if (!queryIds || !Array.isArray(queryIds) || queryIds.length === 0) {
        return res.status(400).json({ message: "queryIds is required and must be a non-empty array" });
      }

      const { projectId } = req.params;

      // Mark queries as sent to client
      await storage.markQueriesAsSentToClient(queryIds);

      // Update token with actual recipient if provided
      if (tokenId && recipientEmail) {
        await storage.updateQueryResponseToken(tokenId, {
          recipientEmail,
          recipientName: recipientName || null,
        });
      }

      // Get project details for chronology
      const project = await storage.getProject(projectId);
      const sender = await storage.getUser(userId);

      // Log to project chronology
      if (project) {
        const senderName = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() : 'Staff';
        const chronologyNote = `Bookkeeping queries sent to client: ${queryIds.length} queries sent to ${recipientEmail || 'client'}`;
        
        await storage.createChronologyEntry({
          projectId,
          fromStatus: null,
          toStatus: 'no_change',
          assigneeId: project.currentAssigneeId,
          changedById: userId,
          notes: chronologyNote,
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        message: `${queryIds.length} queries marked as sent`,
        queriesUpdated: queryIds.length,
      });
    } catch (error) {
      console.error("Error marking queries as sent:", error);
      res.status(500).json({ message: "Failed to mark queries as sent" });
    }
  });

  // GET /api/projects/:projectId/queries/tokens - Get active tokens for a project
  app.get("/api/projects/:projectId/queries/tokens", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectId } = req.params;
      const tokens = await storage.getActiveQueryResponseTokensByProjectId(projectId);

      res.json(tokens);
    } catch (error) {
      console.error("Error getting project query tokens:", error);
      res.status(500).json({ message: "Failed to get query tokens" });
    }
  });

  // POST /api/queries/tokens/:tokenId/extend - Extend token expiry
  app.post("/api/queries/tokens/:tokenId/extend", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { tokenId } = req.params;
      const { additionalDays } = req.body;

      if (!tokenId) {
        return res.status(400).json({ message: "Token ID is required" });
      }

      if (typeof additionalDays !== 'number' || additionalDays < 1 || additionalDays > 30) {
        return res.status(400).json({ message: "additionalDays must be between 1 and 30" });
      }

      const token = await storage.extendQueryResponseTokenExpiry(tokenId, additionalDays);
      
      if (!token) {
        return res.status(404).json({ message: "Token not found" });
      }

      res.json({
        success: true,
        message: `Token expiry extended by ${additionalDays} days`,
        token,
      });
    } catch (error) {
      console.error("Error extending token expiry:", error);
      res.status(500).json({ message: "Failed to extend token expiry" });
    }
  });

  // POST /api/queries/tokens/:tokenId/send-reminder - Send a reminder email for pending queries
  app.post("/api/queries/tokens/:tokenId/send-reminder", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { tokenId } = req.params;
      const userId = req.effectiveUser?.id || req.user?.id;

      if (!tokenId) {
        return res.status(400).json({ message: "Token ID is required" });
      }

      // Get the token
      const token = await storage.getQueryResponseTokenById(tokenId);
      if (!token) {
        return res.status(404).json({ message: "Token not found" });
      }

      // Check if token is expired
      if (new Date(token.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Cannot send reminder for expired link. Please extend the link first." });
      }

      // Check if already completed
      if (token.completedAt) {
        return res.status(400).json({ message: "This response link has already been completed." });
      }

      // Get project and client details
      const project = await storage.getProject(token.projectId);
      const client = project ? await storage.getClientById(project.clientId) : null;
      const sender = await storage.getUser(userId);

      // Get the queries for this token
      const queries = await storage.getQueriesForToken(token.token);

      // Build the response URL
      const responseUrl = `/queries/respond/${token.token}`;
      const fullResponseUrl = `${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0] || 'https://yourapp.replit.app'}${responseUrl}`;

      // Format date helper
      const formatDate = (date: Date | string | null) => {
        if (!date) return '';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      };

      // Build reminder email subject and content
      const emailSubject = `Reminder: Bookkeeping Queries - ${project?.description || 'Your Account'}`;
      const emailContent = `
<p>Hello${token.recipientName ? ` ${token.recipientName}` : ''},</p>

<p>This is a friendly reminder that we are still waiting for your response to ${queries.length} bookkeeping ${queries.length === 1 ? 'query' : 'queries'} for ${client?.name || 'your account'}.</p>

<p style="margin: 24px 0;">
  <a href="${fullResponseUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Click here to respond to these queries
  </a>
</p>

<p style="color: #64748b; font-size: 14px;">This link will expire on ${formatDate(token.expiresAt)}.</p>

<p>If you have any questions, please don't hesitate to get in touch.</p>

<p>Best regards,<br>${sender?.firstName || 'The Team'}</p>
`;

      res.json({
        success: true,
        emailSubject,
        emailContent,
        recipientEmail: token.recipientEmail,
        recipientName: token.recipientName,
        tokenId: token.id,
        projectId: token.projectId,
        clientId: project?.clientId,
      });
    } catch (error) {
      console.error("Error preparing reminder:", error);
      res.status(500).json({ message: "Failed to prepare reminder" });
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
