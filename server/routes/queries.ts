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
  type QueryAttachment,
} from "@shared/schema";
import { sendBookkeepingQueryEmail } from "../emailService";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";
import { 
  checkQueryTokenRateLimit, 
  recordFailedTokenAttempt, 
  recordSuccessfulTokenAccess,
  isTokenLockedOut,
  sanitizeAttachment 
} from "../lib/queryTokenRateLimiter";

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

const attachmentSchema = z.object({
  objectPath: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  uploadedAt: z.string(),
});

// More lenient schema for saving - allows missing fields that might come from older data
const lenientAttachmentSchema = z.object({
  objectPath: z.string(),
  fileName: z.string(),
  fileType: z.string().optional().default('application/octet-stream'),
  fileSize: z.number().optional().default(0),
  uploadedAt: z.string().optional().default(() => new Date().toISOString()),
});

const clientResponseSchema = z.object({
  responses: z.array(z.object({
    queryId: z.string().uuid(),
    clientResponse: z.string().optional(),
    hasVat: z.boolean().nullable().optional(),
    attachments: z.array(lenientAttachmentSchema).optional(),
  }))
});

const uploadUrlRequestSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().positive(),
  queryId: z.string().uuid(),
});

const saveIndividualResponseSchema = z.object({
  clientResponse: z.string().optional(),
  hasVat: z.boolean().nullable().optional(),
  attachments: z.array(lenientAttachmentSchema).optional(),
});

const paramTokenQueryIdSchema = z.object({
  token: z.string().min(32, "Invalid token format"),
  queryId: z.string().uuid("Invalid query ID format"),
});

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];

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

  // POST /api/projects/:projectId/queries/notify-assignees - Notify project assignees about query status
  const notifyAssigneesSchema = z.object({
    userIds: z.array(z.string().uuid()),
    message: z.string().min(1),
  });

  app.post("/api/projects/:projectId/queries/notify-assignees", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectId } = req.params;
      const data = notifyAssigneesSchema.parse(req.body);

      // Get project with client info
      const project = await storage.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get the query stats for the notification content
      const stats = await storage.getQueryStatsByProjectId(projectId);

      // Get users to notify
      const usersToNotify = await Promise.all(
        data.userIds.map(async (userId) => {
          return storage.getUser(userId);
        })
      );

      const validUsers = usersToNotify.filter(Boolean);
      if (validUsers.length === 0) {
        return res.status(400).json({ message: "No valid users to notify" });
      }

      const { sendEmail } = await import('../emailService');

      let sentCount = 0;
      const clientName = project.client?.name || 'Unknown Client';
      const projectTypeName = project.projectType?.name || 'Project';
      const baseUrl = process.env.PUBLIC_URL ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '');

      for (const user of validUsers) {
        if (!user) continue;

        // Send email notification
        if (user.email) {
          try {
            const emailContent = `
              <h2>Bookkeeping Query Status Update</h2>
              <p><strong>Client:</strong> ${clientName}</p>
              <p><strong>Project:</strong> ${projectTypeName}</p>
              <h3>Current Status</h3>
              <ul>
                <li>Open queries: ${stats.open}</li>
                <li>Sent to client: ${stats.sentToClient}</li>
                <li>Awaiting staff review: ${stats.answeredByClient}</li>
                <li>Resolved: ${stats.resolved}</li>
              </ul>
              <p>${data.message}</p>
              <p><a href="${baseUrl}/projects/${projectId}?tab=queries">View Queries</a></p>
            `;

            await sendEmail({
              to: user.email,
              subject: `Query Status Update: ${clientName} - ${projectTypeName}`,
              html: emailContent,
            });
            sentCount++;
          } catch (emailError) {
            console.error(`Failed to send email to user ${user.id}:`, emailError);
          }
        }
      }

      res.json({ success: true, notifiedCount: sentCount });
    } catch (error) {
      console.error("Error notifying assignees:", error);
      res.status(500).json({ message: "Failed to notify assignees" });
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
      
      // Get project type to check if Voice AI is available
      let voiceAiAvailable = false;
      if (project?.projectTypeId) {
        const projectType = await storage.projectTypesStorage.getProjectTypeById(project.projectTypeId);
        if (projectType?.useVoiceAiForQueries) {
          // Check if there are active webhooks configured
          const dialoraSettings = projectType.dialoraSettings as { outboundWebhooks?: Array<{ active: boolean }> } | null;
          const hasActiveWebhooks = dialoraSettings?.outboundWebhooks?.some(w => w.active) ?? false;
          voiceAiAvailable = hasActiveWebhooks;
        }
      }

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

        // Build the response URL with proper domain handling
        responseUrl = `/queries/respond/${token.token}`;
        
        // Get base URL: APP_URL for production only, Replit domain for dev
        let baseUrl: string;
        const isProduction = process.env.NODE_ENV === 'production';
        
        if (isProduction && process.env.APP_URL) {
          // Production: use the configured APP_URL
          baseUrl = process.env.APP_URL;
        } else {
          // Development: use Replit dev domain
          const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
          if (replitDomain) {
            // Clean up the domain and ensure https:// prefix
            baseUrl = replitDomain.replace(/^render:\/\/\//, '').replace(/^\/+/, '');
            if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
              baseUrl = `https://${baseUrl}`;
            }
          } else {
            baseUrl = 'http://localhost:5000';
          }
        }
        fullResponseUrl = `${baseUrl}${responseUrl}`;
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

      // Build HTML table for queries with HTML border attributes for maximum email client compatibility (especially Outlook)
      const borderColor = '#d0d7de';
      const cellStyle = `border:1px solid ${borderColor}; padding:8px; font-size:13px;`;
      const headerStyle = `border:1px solid ${borderColor}; padding:8px; font-weight:bold; font-size:13px; background-color:#f6f8fa;`;
      
      const queriesTableHtml = `
<table border="1" cellpadding="0" cellspacing="0" bordercolor="${borderColor}" style="border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; width:100%; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin:16px 0; border:1px solid ${borderColor};">
  <tr>
    <th align="left" style="${headerStyle} color:#334155;">Date</th>
    <th align="left" style="${headerStyle} color:#334155;">Description</th>
    <th align="right" style="${headerStyle} color:#16a34a;">Money In</th>
    <th align="right" style="${headerStyle} color:#dc2626;">Money Out</th>
    <th align="left" style="${headerStyle} color:#334155;">Our Query</th>
  </tr>
  ${queries.map((q, i) => `
  <tr${i % 2 === 1 ? ' style="background-color:#f8fafc;"' : ''}>
    <td align="left" style="${cellStyle} color:#475569;">${formatDate(q.date)}</td>
    <td align="left" style="${cellStyle} color:#475569;">${q.description || ''}</td>
    <td align="right" style="${cellStyle} color:#16a34a;">${q.moneyIn ? formatCurrency(q.moneyIn) : '-'}</td>
    <td align="right" style="${cellStyle} color:#dc2626;">${q.moneyOut ? formatCurrency(q.moneyOut) : '-'}</td>
    <td align="left" style="${cellStyle} color:#1e293b; font-weight:500;">${q.ourQuery || ''}</td>
  </tr>
  `).join('')}
</table>`;

      // Build the email content in separate parts for protected HTML handling
      const emailSubject = `Bookkeeping Queries - ${project?.description || 'Your Account'}`;
      
      // Link section (part of protected HTML)
      const linkSection = includeOnlineLink && fullResponseUrl ? `
<p style="margin: 24px 0;">
  <a href="${fullResponseUrl}" style="display: inline-block; background-color: #0f7b94; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Click here to respond to these queries
  </a>
</p>

<p style="color: #64748b; font-size: 14px;"><strong>This link will expire on ${formatDate(expiresAt)}.</strong></p>
` : '';

      // Editable intro section
      const emailIntro = `<p>Hello,</p>

<p>We have some questions about the following transactions that we need your help to clarify:</p>`;

      // Protected HTML block (table + button) - should not go through rich text editor
      const protectedHtml = `${queriesTableHtml}

${linkSection}`;

      // Editable sign-off section
      const emailSignoff = `<p>If you have any questions, please don't hesitate to get in touch.</p>

<p>Best regards,<br>${sender?.firstName || 'The Team'}</p>`;

      // Full combined content (for backward compatibility and final email)
      const emailContent = `${emailIntro}

${protectedHtml}

${emailSignoff}`;

      res.json({
        tokenId: token?.id || null,
        token: token?.token || null,
        expiresAt: expiresAt,
        queryCount: queryIds.length,
        responseUrl,
        fullResponseUrl,
        emailSubject,
        emailContent,
        // New structured content for protected HTML handling
        emailIntro,
        protectedHtml,
        emailSignoff,
        includeOnlineLink,
        // Voice AI availability based on project type settings
        voiceAiAvailable,
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

      // Build the response URL with proper domain handling
      const responseUrl = `/queries/respond/${token.token}`;
      
      // Get base URL: APP_URL for production only, Replit domain for dev
      let baseUrl: string;
      const isProduction = process.env.NODE_ENV === 'production';
      
      if (isProduction && process.env.APP_URL) {
        // Production: use the configured APP_URL
        baseUrl = process.env.APP_URL;
      } else {
        // Development: use Replit dev domain
        const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0];
        if (replitDomain) {
          // Clean up the domain and ensure https:// prefix
          baseUrl = replitDomain.replace(/^render:\/\/\//, '').replace(/^\/+/, '');
          if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            baseUrl = `https://${baseUrl}`;
          }
        } else {
          baseUrl = 'http://localhost:5000';
        }
      }
      const fullResponseUrl = `${baseUrl}${responseUrl}`;

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
  <a href="${fullResponseUrl}" style="display: inline-block; background-color: #0f7b94; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Click here to respond to these queries
  </a>
</p>

<p style="color: #64748b; font-size: 14px;"><strong>This link will expire on ${formatDate(token.expiresAt)}.</strong></p>

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
          message: "This link doesn't seem to be working. Please check you have the complete link from your email.",
          errors: paramValidation.errors
        });
      }

      const { token } = req.params;
      const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';

      // Rate limiting check
      const rateLimit = checkQueryTokenRateLimit(clientIP, 'access');
      if (!rateLimit.allowed) {
        return res.status(429).json({
          message: "Too many requests. Please wait a moment and try again.",
          retryAfter: rateLimit.retryAfter
        });
      }

      // Check if token is locked out due to too many failed attempts
      const lockout = isTokenLockedOut(token);
      if (lockout.locked) {
        return res.status(429).json({
          message: "This link has been temporarily locked due to too many failed access attempts. Please try again later.",
          retryAfter: lockout.retryAfter
        });
      }

      const validation = await storage.validateQueryResponseToken(token);

      if (!validation.valid) {
        // Record failed attempt for lockout tracking
        recordFailedTokenAttempt(token);
        return res.status(400).json({ 
          message: validation.reason,
          expired: validation.reason === 'Token has expired',
          completed: validation.reason === 'Responses already submitted'
        });
      }

      // Record successful access
      recordSuccessfulTokenAccess(token);
      
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
          clientAttachments: q.clientAttachments,
          status: q.status,
        })),
      });
    } catch (error) {
      console.error("Error validating query response token:", error);
      res.status(500).json({ message: "Something went wrong loading the page. Please refresh and try again." });
    }
  });

  // POST /api/query-response/:token/upload-url - Generate upload URL for attachment (public endpoint)
  app.post("/api/query-response/:token/upload-url", async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTokenSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "This link doesn't seem to be working. Please check you have the complete link from your email.",
          errors: paramValidation.errors
        });
      }

      const { token } = req.params;
      const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';

      // Rate limiting check
      const rateLimit = checkQueryTokenRateLimit(clientIP, 'upload');
      if (!rateLimit.allowed) {
        return res.status(429).json({
          message: "Too many upload requests. Please wait a moment and try again.",
          retryAfter: rateLimit.retryAfter
        });
      }

      // Check if token is locked out
      const lockout = isTokenLockedOut(token);
      if (lockout.locked) {
        return res.status(429).json({
          message: "This link has been temporarily locked. Please try again later.",
          retryAfter: lockout.retryAfter
        });
      }

      const validation = await storage.validateQueryResponseToken(token);

      if (!validation.valid) {
        recordFailedTokenAttempt(token);
        return res.status(400).json({ 
          message: validation.reason,
          expired: validation.reason === 'Token has expired',
          completed: validation.reason === 'Responses already submitted'
        });
      }
      
      recordSuccessfulTokenAccess(token);

      const bodyValidation = uploadUrlRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "We couldn't prepare your file for upload. Please try again.",
          errors: bodyValidation.error.issues
        });
      }

      const { fileName, fileType, fileSize, queryId } = bodyValidation.data;

      // Validate file size
      if (fileSize > MAX_ATTACHMENT_SIZE) {
        return res.status(400).json({ message: "File is too large. Maximum size is 10MB." });
      }

      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(fileType)) {
        return res.status(400).json({ message: "File type not allowed. Please upload images, PDFs, or Office documents." });
      }

      // Verify the query belongs to this token
      const tokenQueries = await storage.getQueriesForToken(token);
      const tokenQueryIds = new Set(tokenQueries.map(q => q.id));
      if (!tokenQueryIds.has(queryId)) {
        return res.status(400).json({ message: "Query not found in this response session" });
      }

      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();

      res.json({
        url: uploadURL,
        objectPath,
        fileName,
        fileType,
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "We couldn't prepare your file for upload. Please try again in a moment." });
    }
  });

  // PATCH /api/query-response/:token/queries/:queryId - Save individual query response (public endpoint, auto-save)
  app.patch("/api/query-response/:token/queries/:queryId", async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTokenQueryIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "We couldn't find this question. Please refresh the page and try again.",
          errors: paramValidation.errors
        });
      }

      const { token, queryId } = req.params;
      const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';

      // Rate limiting check (higher limit for auto-save)
      const rateLimit = checkQueryTokenRateLimit(clientIP, 'save');
      if (!rateLimit.allowed) {
        return res.status(429).json({
          message: "You're saving too quickly. Your last save was successful - please wait a moment.",
          retryAfter: rateLimit.retryAfter
        });
      }

      // Check if token is locked out
      const lockout = isTokenLockedOut(token);
      if (lockout.locked) {
        return res.status(429).json({
          message: "This link has been temporarily locked. Please try again later.",
          retryAfter: lockout.retryAfter
        });
      }

      const validation = await storage.validateQueryResponseToken(token);

      if (!validation.valid) {
        recordFailedTokenAttempt(token);
        return res.status(400).json({ 
          message: validation.reason,
          expired: validation.reason === 'Token has expired',
          completed: validation.reason === 'Responses already submitted'
        });
      }

      recordSuccessfulTokenAccess(token);

      const bodyValidation = saveIndividualResponseSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        // Log detailed validation errors for debugging
        console.error("[Query Response] Validation failed for query", queryId);
        console.error("[Query Response] Request body:", JSON.stringify(req.body, null, 2));
        console.error("[Query Response] Validation errors:", JSON.stringify(bodyValidation.error.issues, null, 2));
        
        return res.status(400).json({
          message: "We couldn't save your response. Please check your answer and try again.",
          errors: bodyValidation.error.issues
        });
      }

      // Verify the query belongs to this token
      const tokenQueries = await storage.getQueriesForToken(token);
      const tokenQueryIds = new Set(tokenQueries.map(q => q.id));
      if (!tokenQueryIds.has(queryId)) {
        return res.status(400).json({ message: "Query not found in this response session" });
      }

      const { clientResponse, hasVat, attachments } = bodyValidation.data;

      // Get current query to check existing state
      const currentQuery = tokenQueries.find(q => q.id === queryId);

      // Build update data - only include fields that were actually sent
      const updateData: any = {};
      
      if (clientResponse !== undefined) {
        updateData.clientResponse = clientResponse;
      }
      
      if (hasVat !== undefined) {
        updateData.hasVat = hasVat;
      }
      
      if (attachments !== undefined) {
        // Validate and sanitize all attachments for security
        const sanitizedAttachments: QueryAttachment[] = [];
        for (const attachment of attachments) {
          const result = sanitizeAttachment(attachment as QueryAttachment);
          if (!result.valid) {
            console.error(`[Query Response] Invalid attachment for query ${queryId}:`, result.error, attachment);
            return res.status(400).json({
              message: `Invalid file: ${result.error}`,
            });
          }
          sanitizedAttachments.push(result.sanitized!);
        }
        updateData.clientAttachments = sanitizedAttachments;
      }

      // Smart status update logic:
      // - If client provides a response (non-empty text or attachments), mark as answered_by_client
      // - If client clears their response (and has no attachments), revert to sent_to_client
      // Only update status if currently in sent_to_client or answered_by_client state
      if (currentQuery && ['sent_to_client', 'answered_by_client'].includes(currentQuery.status)) {
        const hasResponse = (clientResponse !== undefined ? clientResponse.trim() : (currentQuery.clientResponse || '').trim());
        const hasAttachments = attachments !== undefined 
          ? (attachments.length > 0)
          : ((currentQuery.clientAttachments as QueryAttachment[] | null)?.length ?? 0) > 0;
        
        if (hasResponse || hasAttachments) {
          // Client has provided content - mark as answered
          if (currentQuery.status !== 'answered_by_client') {
            updateData.status = 'answered_by_client';
          }
        } else {
          // Client has cleared their response - revert to sent
          if (currentQuery.status !== 'sent_to_client') {
            updateData.status = 'sent_to_client';
          }
        }
      }

      // Only update if there's something to update
      if (Object.keys(updateData).length > 0) {
        await storage.updateQuery(queryId, updateData);
      }

      res.json({
        success: true,
        savedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error saving individual query response:", error);
      res.status(500).json({ message: "We couldn't save your response just now. Don't worry - try again in a moment." });
    }
  });

  // POST /api/query-response/:token - Submit client responses (public endpoint)
  app.post("/api/query-response/:token", async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTokenSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "This link doesn't seem to be working. Please check you have the complete link from your email.",
          errors: paramValidation.errors
        });
      }

      const { token } = req.params;
      const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';

      // Rate limiting check
      const rateLimit = checkQueryTokenRateLimit(clientIP, 'submit');
      if (!rateLimit.allowed) {
        return res.status(429).json({
          message: "Too many submission attempts. Please wait a moment and try again.",
          retryAfter: rateLimit.retryAfter
        });
      }

      // Check if token is locked out
      const lockout = isTokenLockedOut(token);
      if (lockout.locked) {
        return res.status(429).json({
          message: "This link has been temporarily locked. Please try again later.",
          retryAfter: lockout.retryAfter
        });
      }

      const validation = await storage.validateQueryResponseToken(token);

      if (!validation.valid) {
        recordFailedTokenAttempt(token);
        return res.status(400).json({ 
          message: validation.reason,
          expired: validation.reason === 'Token has expired',
          completed: validation.reason === 'Responses already submitted'
        });
      }

      recordSuccessfulTokenAccess(token);

      const validationResult = clientResponseSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.error("Client response validation failed:", JSON.stringify(validationResult.error.issues, null, 2));
        console.error("Request body was:", JSON.stringify(req.body, null, 2));
        
        // Provide a friendly error message
        const issues = validationResult.error.issues;
        let friendlyMessage = "We couldn't process your responses. ";
        
        if (issues.some(i => i.path.includes('queryId'))) {
          friendlyMessage += "Some responses couldn't be matched to their questions. Please refresh and try again.";
        } else if (issues.some(i => i.path.includes('responses'))) {
          friendlyMessage += "Please make sure all your answers are filled in correctly.";
        } else {
          friendlyMessage += "Please check your answers and try again.";
        }
        
        return res.status(400).json({
          message: friendlyMessage,
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

      // Update each query with the client response and attachments
      let updatedCount = 0;
      for (const response of responses) {
        if (response.clientResponse || response.hasVat !== undefined || response.attachments?.length) {
          const updateData: any = {
            status: 'answered_by_client',
          };
          
          if (response.clientResponse !== undefined) {
            updateData.clientResponse = response.clientResponse;
          }
          
          if (response.hasVat !== undefined) {
            updateData.hasVat = response.hasVat;
          }
          
          if (response.attachments?.length) {
            // Validate and sanitize attachments for security
            const sanitizedAttachments: QueryAttachment[] = [];
            for (const attachment of response.attachments) {
              const result = sanitizeAttachment(attachment as QueryAttachment);
              if (!result.valid) {
                console.error(`[Query Submit] Invalid attachment for query ${response.queryId}:`, result.error, attachment);
                return res.status(400).json({
                  message: `Invalid file: ${result.error}`,
                });
              }
              sanitizedAttachments.push(result.sanitized!);
            }
            updateData.clientAttachments = sanitizedAttachments;
          }
          
          await storage.updateQuery(response.queryId, updateData);
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
      res.status(500).json({ message: "Something went wrong sending your responses. Please try again." });
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

  // POST /api/test/query-email - Send a test query email via SendGrid (protected by secret token)
  app.post("/api/test/query-email", async (req: any, res: any) => {
    try {
      const { to, secret } = req.body;
      
      // Require a secret token for security (use TEST_ADMIN_PASSWORD as the secret)
      const expectedSecret = process.env.TEST_ADMIN_PASSWORD;
      if (!expectedSecret || secret !== expectedSecret) {
        return res.status(401).json({ message: "Invalid or missing secret token" });
      }
      
      if (!to) {
        return res.status(400).json({ message: "Recipient email (to) is required" });
      }

      // Import SendGrid dynamically
      const { getUncachableSendGridClient } = await import('../sendgridService');
      const { client, fromEmail } = await getUncachableSendGridClient();

      // Sample data for testing the table
      const sampleData = [
        { date: '01 Dec 2024', description: 'Payment from Customer XYZ', moneyIn: '£500.00', moneyOut: '-', query: 'What is this payment for?' },
        { date: '05 Dec 2024', description: 'Transfer to ABC Ltd', moneyIn: '-', moneyOut: '£250.00', query: 'Please provide invoice for this payment' },
        { date: '10 Dec 2024', description: 'Cash deposit', moneyIn: '£150.00', moneyOut: '-', query: 'What is the source of this deposit?' },
      ];

      // Build the email table HTML (exact same format as production emails)
      const borderColor = '#d0d7de';
      const cellStyle = `border:1px solid ${borderColor}; padding:8px; font-size:13px;`;
      const headerStyle = `border:1px solid ${borderColor}; padding:8px; font-weight:bold; font-size:13px; background-color:#f6f8fa;`;
      
      const tableHtml = `
<table border="1" cellpadding="0" cellspacing="0" bordercolor="${borderColor}" style="border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; width:100%; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin:16px 0; border:1px solid ${borderColor};">
  <tr>
    <th align="left" style="${headerStyle} color:#334155;">Date</th>
    <th align="left" style="${headerStyle} color:#334155;">Description</th>
    <th align="right" style="${headerStyle} color:#16a34a;">Money In</th>
    <th align="right" style="${headerStyle} color:#dc2626;">Money Out</th>
    <th align="left" style="${headerStyle} color:#334155;">Our Query</th>
  </tr>
  ${sampleData.map((row, i) => `
  <tr${i % 2 === 1 ? ' style="background-color:#f8fafc;"' : ''}>
    <td align="left" style="${cellStyle} color:#475569;">${row.date}</td>
    <td align="left" style="${cellStyle} color:#475569;">${row.description}</td>
    <td align="right" style="${cellStyle} color:#16a34a;">${row.moneyIn}</td>
    <td align="right" style="${cellStyle} color:#dc2626;">${row.moneyOut}</td>
    <td align="left" style="${cellStyle} color:#1e293b; font-weight:500;">${row.query}</td>
  </tr>
  `).join('')}
</table>`;

      const emailContent = `
<p>Hello,</p>

<p>This is a <strong>test email</strong> to verify the bookkeeping query table renders correctly with borders in your email client.</p>

<p>We have some questions about the following transactions that we need your help to clarify:</p>

${tableHtml}

<p style="margin: 24px 0;">
  <a href="https://example.com/test-link" style="display: inline-block; background-color: #0f7b94; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Click here to respond to these queries
  </a>
</p>

<p style="color: #64748b; font-size: 14px;">This is a test email - no action required.</p>

<p>Best regards,<br>The Link Test</p>
`;

      const msg = {
        to,
        from: {
          email: fromEmail,
          name: 'The Link (Test)'
        },
        subject: 'TEST: Bookkeeping Query Table Email',
        html: emailContent,
        text: 'This is a test email to verify the bookkeeping query table renders correctly. Please view this email in HTML mode.',
      };

      await client.send(msg);

      res.json({
        success: true,
        message: `Test email sent to ${to}`,
        tableHtml,
      });
    } catch (error) {
      console.error("Error sending test query email:", error);
      res.status(500).json({ 
        message: "Failed to send test email",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ==================== SCHEDULED REMINDERS ROUTES ====================
  
  // Get all reminders for a project
  app.get("/api/projects/:projectId/query-reminders", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ message: "Invalid project ID", errors: paramValidation.errors });
      }

      const { projectId } = req.params;
      
      const { getRemindersForProject } = await import('../services/queryReminderService');
      const reminders = await getRemindersForProject(projectId);
      
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching query reminders:", error);
      res.status(500).json({ message: "Failed to fetch query reminders" });
    }
  });

  // Cancel a single reminder
  app.post("/api/query-reminders/:id/cancel", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ message: "Invalid reminder ID", errors: paramValidation.errors });
      }

      const { id } = req.params;
      
      const { cancelReminder } = await import('../services/queryReminderService');
      const cancelled = await cancelReminder(id, req.user?.id);
      
      if (!cancelled) {
        return res.status(404).json({ message: "Reminder not found or already processed" });
      }
      
      res.json({ success: true, message: "Reminder cancelled" });
    } catch (error) {
      console.error("Error cancelling reminder:", error);
      res.status(500).json({ message: "Failed to cancel reminder" });
    }
  });

  // Get unanswered queries for a reminder (for preview)
  app.get("/api/query-reminders/:id/unanswered-queries", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ message: "Invalid reminder ID", errors: paramValidation.errors });
      }

      const { id } = req.params;
      
      const { getUnansweredQueriesForReminder } = await import('../services/queryReminderService');
      const queries = await getUnansweredQueriesForReminder(id);
      
      res.json(queries);
    } catch (error) {
      console.error("Error fetching unanswered queries for reminder:", error);
      res.status(500).json({ message: "Failed to fetch unanswered queries" });
    }
  });

  // Update a reminder (reschedule date/time/channel/message/intro/signoff)
  const updateReminderSchema = z.object({
    scheduledAt: z.string().optional(),
    channel: z.enum(['email', 'sms', 'voice']).optional(),
    message: z.string().optional(),
    messageIntro: z.string().optional(),
    messageSignoff: z.string().optional(),
  });

  app.patch("/api/query-reminders/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ message: "Invalid reminder ID", errors: paramValidation.errors });
      }

      const { id } = req.params;
      const data = updateReminderSchema.parse(req.body);
      
      if (!data.scheduledAt && !data.channel && !data.message && data.messageIntro === undefined && data.messageSignoff === undefined) {
        return res.status(400).json({ message: "No update fields provided" });
      }

      const { updateReminder } = await import('../services/queryReminderService');
      const updated = await updateReminder(id, {
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        channel: data.channel,
        message: data.message,
        messageIntro: data.messageIntro,
        messageSignoff: data.messageSignoff,
      });
      
      if (!updated) {
        return res.status(404).json({ message: "Reminder not found or cannot be updated" });
      }
      
      res.json({ success: true, reminder: updated });
    } catch (error) {
      console.error("Error updating reminder:", error);
      res.status(500).json({ message: "Failed to update reminder" });
    }
  });

  const paramTokenIdSchema = z.object({ tokenId: z.string().uuid() });

  // Cancel all pending reminders for a token
  app.post("/api/query-tokens/:tokenId/cancel-reminders", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTokenIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ message: "Invalid token ID", errors: paramValidation.errors });
      }

      const { tokenId } = req.params;
      
      const { cancelAllRemindersForToken } = await import('../services/queryReminderService');
      const count = await cancelAllRemindersForToken(tokenId, req.user?.id);
      
      res.json({ success: true, cancelledCount: count });
    } catch (error) {
      console.error("Error cancelling all reminders:", error);
      res.status(500).json({ message: "Failed to cancel reminders" });
    }
  });

  // Schedule reminders for a query token
  const scheduleRemindersSchema = z.object({
    reminders: z.array(z.object({
      scheduledAt: z.string().transform(s => new Date(s)),
      channel: z.enum(['email', 'sms', 'voice']),
      message: z.string().optional(),
    })),
    recipientName: z.string(),
    recipientEmail: z.string().email().nullable().optional(),
    recipientPhone: z.string().nullable().optional(),
    totalQueries: z.number().int().positive(),
  });

  app.post("/api/query-tokens/:tokenId/schedule-reminders", isAuthenticated, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTokenIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ message: "Invalid token ID", errors: paramValidation.errors });
      }

      const { tokenId } = req.params;
      const data = scheduleRemindersSchema.parse(req.body);
      
      // Get the token to find the project ID
      const token = await storage.getQueryResponseTokenById(tokenId);
      if (!token) {
        return res.status(404).json({ message: "Token not found" });
      }

      const { scheduleReminders } = await import('../services/queryReminderService');
      const scheduled = await scheduleReminders(
        tokenId,
        token.projectId,
        data.recipientName,
        data.recipientEmail || null,
        data.recipientPhone || null,
        data.reminders.map(r => ({
          scheduledAt: r.scheduledAt,
          channel: r.channel,
          message: r.message,
        })),
        data.totalQueries
      );
      
      res.json({ success: true, reminders: scheduled });
    } catch (error) {
      console.error("Error scheduling reminders:", error);
      res.status(500).json({ message: "Failed to schedule reminders" });
    }
  });

  // ==================== PROJECT-SCOPED REMINDER ROUTES ====================

  // GET /api/projects/:projectId/queries/reminders - Get all reminders for a project
  app.get("/api/projects/:projectId/queries/reminders", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ message: "Invalid project ID", errors: paramValidation.errors });
      }

      const { projectId } = req.params;
      const reminders = await storage.getScheduledQueryRemindersByProjectId(projectId);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching project reminders:", error);
      res.status(500).json({ message: "Failed to fetch reminders" });
    }
  });

  // POST /api/projects/:projectId/queries/reminders - Create reminders for a token
  const projectRemindersSchema = z.object({
    tokenId: z.string().uuid(),
    reminders: z.array(z.object({
      scheduledAt: z.string(),
      channel: z.enum(['email', 'sms', 'voice']),
    })),
  });

  app.post("/api/projects/:projectId/queries/reminders", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ message: "Invalid project ID", errors: paramValidation.errors });
      }

      const { projectId } = req.params;
      const data = projectRemindersSchema.parse(req.body);
      
      // Get the token to verify it belongs to this project and get recipient info
      const token = await storage.getQueryResponseTokenById(data.tokenId);
      if (!token) {
        return res.status(404).json({ message: "Token not found" });
      }
      if (token.projectId !== projectId) {
        return res.status(403).json({ message: "Token does not belong to this project" });
      }

      // Get the first recipient from the token to use as recipient info
      const recipientEmail = token.recipientEmail || null;
      const recipientName = token.recipientName || 'Client';
      
      // Get recipient phone from people associated with this client (if available)
      let recipientPhone: string | null = null;
      const project = await storage.getProjectById(projectId);
      if (project?.clientId) {
        const clientPeople = await storage.getClientPeopleByClientId(project.clientId);
        const primaryContact = clientPeople.find((cp: any) => cp.isPrimaryContact) || clientPeople[0];
        if (primaryContact?.person?.telephone) {
          recipientPhone = primaryContact.person.telephone;
        }
      }

      const { scheduleReminders } = await import('../services/queryReminderService');
      const scheduled = await scheduleReminders(
        data.tokenId,
        projectId,
        recipientName,
        recipientEmail,
        recipientPhone,
        data.reminders.map(r => ({
          scheduledAt: new Date(r.scheduledAt),
          channel: r.channel,
          message: undefined,
        })),
        token.queryCount || 1
      );
      
      res.json({ success: true, reminders: scheduled });
    } catch (error: any) {
      console.error("Error creating project reminders:", error);
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: "Validation failed", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create reminders" });
    }
  });

  // DELETE /api/projects/:projectId/queries/reminders/:reminderId - Cancel a specific reminder
  const paramReminderIdSchema = z.object({
    projectId: z.string().uuid(),
    reminderId: z.string().uuid(),
  });

  app.delete("/api/projects/:projectId/queries/reminders/:reminderId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramReminderIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ message: "Invalid parameters", errors: paramValidation.errors });
      }

      const { projectId, reminderId } = req.params;
      
      // Verify the reminder belongs to this project
      const reminder = await storage.getScheduledQueryReminderById(reminderId);
      if (!reminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }
      if (reminder.projectId !== projectId) {
        return res.status(403).json({ message: "Reminder does not belong to this project" });
      }

      const { cancelReminder } = await import('../services/queryReminderService');
      const cancelled = await cancelReminder(reminderId, req.user?.id);
      
      if (!cancelled) {
        return res.status(400).json({ message: "Reminder could not be cancelled (may already be processed)" });
      }
      
      res.json({ success: true, message: "Reminder cancelled" });
    } catch (error) {
      console.error("Error cancelling project reminder:", error);
      res.status(500).json({ message: "Failed to cancel reminder" });
    }
  });

  // ==================== DIALORA WEBHOOK ====================
  
  // Inbound webhook for Dialora call status updates
  app.post("/api/webhooks/dialora/call-status", async (req, res) => {
    try {
      const { call_id, status, duration, outcome, transcript } = req.body;
      
      console.log(`[Dialora Webhook] Received call status update: ${call_id} - ${status}`);
      
      // Update the reminder record with the call status
      if (call_id) {
        const { db } = await import('../db');
        const { scheduledQueryReminders } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        
        await db
          .update(scheduledQueryReminders)
          .set({
            errorMessage: status === 'completed' 
              ? `Call completed (${duration || 0}s)${outcome ? `: ${outcome}` : ''}`
              : `Call ${status}${outcome ? `: ${outcome}` : ''}`
          })
          .where(eq(scheduledQueryReminders.dialoraCallId, call_id));
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Dialora Webhook] Error processing call status:", error);
      res.status(500).json({ message: "Error processing webhook" });
    }
  });
}
