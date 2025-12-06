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
    hasVat: z.boolean().optional(),
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
  <a href="${fullResponseUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Click here to respond to these queries
  </a>
</p>

<p style="color: #64748b; font-size: 14px;">This link will expire on ${formatDate(expiresAt)}.</p>
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
          message: "This link doesn't seem to be working. Please check you have the complete link from your email.",
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
      const validation = await storage.validateQueryResponseToken(token);

      if (!validation.valid) {
        return res.status(400).json({ 
          message: validation.reason,
          expired: validation.reason === 'Token has expired',
          completed: validation.reason === 'Responses already submitted'
        });
      }

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
      const validation = await storage.validateQueryResponseToken(token);

      if (!validation.valid) {
        return res.status(400).json({ 
          message: validation.reason,
          expired: validation.reason === 'Token has expired',
          completed: validation.reason === 'Responses already submitted'
        });
      }

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
        updateData.clientAttachments = attachments as QueryAttachment[];
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
            updateData.clientAttachments = response.attachments as QueryAttachment[];
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
  <a href="https://example.com/test-link" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
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
}
