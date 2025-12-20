import type { Express } from "express";
import { storage } from "../storage/index";
import { updateCompanySettingsSchema, insertWebhookConfigSchema, updateWebhookConfigSchema } from "@shared/schema";
import multer from "multer";
import { ObjectStorageService, objectStorageClient, parseObjectPath } from "../objectStorage";
import bcrypt from "bcrypt";
import { z } from "zod";
import {
  isApplicationGraphConfigured,
  getUserByEmail,
  getUserEmails,
  getUserEmailById,
  getUserMailFolders,
  getUserCalendarEvents,
} from "../utils/applicationGraphClient";

const updateUserAccessFlagsSchema = z.object({
  accessEmail: z.boolean().optional(),
  accessCalendar: z.boolean().optional(),
});

/**
 * Super Admin routes for activity logs and login attempts
 */
export function registerSuperAdminRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireSuperAdmin: any
) {
  // Get activity logs with filters
  app.get(
    "/api/super-admin/activity-logs",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const {
          userId,
          onlyActive,
          limit = 100
        } = req.query;

        const sessions = await storage.getUserSessions(
          userId,
          {
            onlyActive: onlyActive === 'true',
            limit: parseInt(limit as string, 10)
          }
        );

        res.json(sessions);
      } catch (error) {
        console.error("Error fetching activity logs:", error);
        res.status(500).json({ message: "Failed to fetch activity logs" });
      }
    }
  );

  // Get login attempts
  app.get(
    "/api/super-admin/login-attempts",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const {
          email,
          limit = 100
        } = req.query;

        const attempts = await storage.getLoginAttempts({
          email,
          limit: parseInt(limit as string, 10)
        });

        res.json(attempts);
      } catch (error) {
        console.error("Error fetching login attempts:", error);
        res.status(500).json({ message: "Failed to fetch login attempts" });
      }
    }
  );

  // Export activity logs as CSV
  app.get(
    "/api/super-admin/activity-logs/export",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const {
          userId,
          onlyActive
        } = req.query;

        const sessions = await storage.getUserSessions(
          userId,
          {
            onlyActive: onlyActive === 'true'
          }
        );

        // Generate CSV
        const csvRows = [
          // Header row
          'User Email,User Name,Login Time,Last Activity,Logout Time,Session Duration (min),Browser,Device,OS,Platform,IP Address,City,Country,Push Enabled,Is Active'
        ];

        for (const session of sessions) {
          const row = [
            session.user.email || '',
            `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim(),
            session.loginTime ? new Date(session.loginTime).toISOString() : '',
            session.lastActivity ? new Date(session.lastActivity).toISOString() : '',
            session.logoutTime ? new Date(session.logoutTime).toISOString() : '',
            session.sessionDuration?.toString() || '',
            session.browser || '',
            session.device || '',
            session.os || '',
            session.platformType || '',
            session.ipAddress || '',
            session.city || '',
            session.country || '',
            session.pushEnabled ? 'Yes' : 'No',
            session.isActive ? 'Yes' : 'No'
          ].map(field => `"${field.replace(/"/g, '""')}"`); // Escape quotes
          
          csvRows.push(row.join(','));
        }

        const csv = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="activity-logs-${Date.now()}.csv"`);
        res.send(csv);
      } catch (error) {
        console.error("Error exporting activity logs:", error);
        res.status(500).json({ message: "Failed to export activity logs" });
      }
    }
  );

  // Logout a specific session (for admin to force logout)
  app.post(
    "/api/super-admin/sessions/:sessionId/logout",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { sessionId } = req.params;
        await storage.markSessionAsLoggedOut(sessionId);
        res.json({ message: "Session logged out successfully" });
      } catch (error) {
        console.error("Error logging out session:", error);
        res.status(500).json({ message: "Failed to logout session" });
      }
    }
  );

  // Get user activity tracking with filters
  app.get(
    "/api/super-admin/user-activity-tracking",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const {
          userId,
          entityType,
          dateFrom,
          dateTo,
          limit = 100
        } = req.query;

        const activityRecords = await storage.getUserActivityTracking({
          userId,
          entityType,
          dateFrom,
          dateTo,
          limit: parseInt(limit as string, 10)
        });

        res.json(activityRecords);
      } catch (error) {
        console.error("Error fetching user activity tracking:", error);
        res.status(500).json({ message: "Failed to fetch user activity tracking" });
      }
    }
  );

  // Export user activity tracking as CSV
  app.get(
    "/api/super-admin/user-activity-tracking/export",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const {
          userId,
          entityType,
          dateFrom,
          dateTo
        } = req.query;

        const activityRecords = await storage.getUserActivityTracking({
          userId,
          entityType,
          dateFrom,
          dateTo
        });

        // Generate CSV
        const csvRows = [
          // Header row
          'User Email,User Name,Entity Type,Entity ID,Viewed At'
        ];

        for (const record of activityRecords) {
          const row = [
            record.user.email || '',
            `${record.user.firstName || ''} ${record.user.lastName || ''}`.trim(),
            record.entityType || '',
            record.entityId || '',
            record.viewedAt ? new Date(record.viewedAt).toISOString() : ''
          ].map(field => `"${field.replace(/"/g, '""')}"`); // Escape quotes
          
          csvRows.push(row.join(','));
        }

        const csv = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="user-activity-tracking-${Date.now()}.csv"`);
        res.send(csv);
      } catch (error) {
        console.error("Error exporting user activity tracking:", error);
        res.status(500).json({ message: "Failed to export user activity tracking" });
      }
    }
  );

  // Get public company settings (feature flags for all authenticated users)
  app.get(
    "/api/company-settings",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const settings = await storage.getCompanySettings();
        
        // Return only public settings (feature flags visible to all staff)
        res.json({
          emailModuleActive: settings?.emailModuleActive || false,
          ringCentralLive: settings?.ringCentralLive || false,
          appIsLive: settings?.appIsLive || false,
          aiButtonEnabled: settings?.aiButtonEnabled || false,
          firmName: settings?.firmName || "The Link",
        });
      } catch (error) {
        console.error("Error fetching public company settings:", error);
        res.status(500).json({ message: "Failed to fetch company settings" });
      }
    }
  );

  // Get company settings (super admin - full access)
  app.get(
    "/api/super-admin/company-settings",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const settings = await storage.getCompanySettings();
        
        // If no settings exist, return default values
        if (!settings) {
          res.json({
            emailSenderName: "The Link Team"
          });
          return;
        }
        
        // Mask the NLAC password - only indicate if it's set
        const sanitizedSettings = {
          ...settings,
          nlacPassword: settings.nlacPassword ? "**********" : null,
          hasNlacPassword: !!settings.nlacPassword,
        };
        
        res.json(sanitizedSettings);
      } catch (error) {
        console.error("Error fetching company settings:", error);
        res.status(500).json({ message: "Failed to fetch company settings" });
      }
    }
  );

  // Update company settings
  app.put(
    "/api/super-admin/company-settings",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        // Validate request body
        const validationResult = updateCompanySettingsSchema.safeParse(req.body);
        
        if (!validationResult.success) {
          res.status(400).json({ 
            message: "Invalid company settings data",
            errors: validationResult.error.errors
          });
          return;
        }
        
        // Hash NLAC password if provided and not already hashed
        const settingsData = { ...validationResult.data };
        if (settingsData.nlacPassword) {
          // Check if already hashed (bcrypt hashes start with $2b$ or $2a$)
          if (!settingsData.nlacPassword.startsWith('$2')) {
            const saltRounds = 10;
            settingsData.nlacPassword = await bcrypt.hash(settingsData.nlacPassword, saltRounds);
          }
        }
        
        const updatedSettings = await storage.updateCompanySettings(settingsData);
        
        // Sanitize response - never expose the password hash
        const sanitizedSettings = {
          ...updatedSettings,
          nlacPassword: updatedSettings.nlacPassword ? "**********" : null,
          hasNlacPassword: !!updatedSettings.nlacPassword,
        };
        
        res.json(sanitizedSettings);
      } catch (error) {
        console.error("Error updating company settings:", error);
        res.status(500).json({ message: "Failed to update company settings" });
      }
    }
  );

  // Configure multer for logo uploads
  const logoUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
      // Only allow image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    },
  });

  // Upload company logo
  app.post(
    "/api/super-admin/company-logo",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    logoUpload.single('logo'),
    async (req: any, res: any) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No logo file provided" });
        }

        // Use same pattern as uploadSignedDocument
        const objectStorageService = new ObjectStorageService();
        
        // Create normalized object path (with /objects/ prefix)
        const timestamp = Date.now();
        const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const objectPath = `/objects/company-logos/logo-${timestamp}-${sanitizedFileName}`;
        
        // Convert /objects/... path to full bucket path (same as uploadSignedDocument)
        const privateDir = objectStorageService.getPrivateObjectDir();
        const entityId = objectPath.slice('/objects/'.length);
        const fullPath = `${privateDir}/${entityId}`;
        
        // Parse path and get file reference
        const { bucketName, objectName } = parseObjectPath(fullPath);
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);
        
        // Upload the logo
        await file.save(req.file.buffer, {
          contentType: req.file.mimetype,
          metadata: {
            contentType: req.file.mimetype,
            uploadedBy: req.effectiveUserId,
            uploadedAt: new Date().toISOString(),
          },
        });

        // Delete old logo if it exists
        const currentSettings = await storage.getCompanySettings();
        if (currentSettings?.logoObjectPath) {
          try {
            const oldLogoFile = await objectStorageService.getObjectEntityFile(currentSettings.logoObjectPath);
            await oldLogoFile.delete();
          } catch (error) {
            console.error("Error deleting old logo:", error);
            // Continue even if delete fails
          }
        }

        // Update company settings with new logo path
        const updatedSettings = await storage.updateCompanySettings({
          logoObjectPath: objectPath,
        });

        res.json({
          message: "Logo uploaded successfully",
          logoObjectPath: objectPath,
        });
      } catch (error: any) {
        console.error("Error uploading company logo:", error);
        res.status(500).json({ 
          message: "Failed to upload logo",
          error: error.message 
        });
      }
    }
  );

  // Delete company logo
  app.delete(
    "/api/super-admin/company-logo",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const currentSettings = await storage.getCompanySettings();
        
        if (!currentSettings?.logoObjectPath) {
          return res.status(404).json({ message: "No logo to delete" });
        }

        const objectStorageService = new ObjectStorageService();
        
        // Delete logo from object storage
        try {
          const logoFile = await objectStorageService.getObjectEntityFile(currentSettings.logoObjectPath);
          await logoFile.delete();
        } catch (error) {
          console.error("Error deleting logo file:", error);
          // Continue even if delete fails
        }

        // Update company settings to remove logo path
        await storage.updateCompanySettings({
          logoObjectPath: null,
        });

        res.json({ message: "Logo deleted successfully" });
      } catch (error: any) {
        console.error("Error deleting company logo:", error);
        res.status(500).json({ 
          message: "Failed to delete logo",
          error: error.message 
        });
      }
    }
  );

  // Database health check endpoint
  app.get(
    "/api/super-admin/db-health",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { db } = await import("../db");
        const { sql } = await import("drizzle-orm");

        const tableStats = await db.execute(sql`
          SELECT 
            schemaname,
            relname as table_name,
            n_live_tup as row_count,
            n_dead_tup as dead_rows,
            last_vacuum,
            last_autovacuum,
            last_analyze,
            last_autoanalyze
          FROM pg_stat_user_tables
          ORDER BY n_live_tup DESC
          LIMIT 30
        `);
        
        const indexUsage = await db.execute(sql`
          SELECT 
            schemaname,
            relname as table_name,
            indexrelname as index_name,
            idx_scan as times_used,
            idx_tup_read,
            idx_tup_fetch
          FROM pg_stat_user_indexes
          ORDER BY idx_scan DESC
          LIMIT 30
        `);

        const unusedIndexes = await db.execute(sql`
          SELECT 
            schemaname,
            relname as table_name,
            indexrelname as index_name,
            idx_scan as times_used,
            pg_size_pretty(pg_relation_size(indexrelid)) as size
          FROM pg_stat_user_indexes
          WHERE idx_scan = 0
          ORDER BY pg_relation_size(indexrelid) DESC
          LIMIT 20
        `);

        const sequentialScans = await db.execute(sql`
          SELECT 
            schemaname,
            relname as table_name,
            seq_scan,
            seq_tup_read,
            idx_scan,
            idx_tup_fetch
          FROM pg_stat_user_tables
          WHERE seq_scan > idx_scan
          ORDER BY seq_tup_read DESC
          LIMIT 15
        `);
        
        res.json({
          status: 'healthy',
          tables: tableStats.rows,
          indexes: {
            mostUsed: indexUsage.rows,
            unused: unusedIndexes.rows
          },
          sequentialScans: sequentialScans.rows,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error("Error getting DB health stats:", error);
        res.status(500).json({ 
          status: 'error',
          message: 'Failed to get extended stats',
          error: error.message 
        });
      }
    }
  );

  // Database slow queries check
  app.get(
    "/api/super-admin/db-health/slow-queries",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { db } = await import("../db");
        const { sql } = await import("drizzle-orm");

        const missingIndexCandidates = await db.execute(sql`
          SELECT 
            schemaname,
            relname as table_name,
            seq_scan,
            CASE WHEN seq_scan > 0 THEN seq_tup_read / seq_scan ELSE 0 END as avg_rows_per_scan
          FROM pg_stat_user_tables
          WHERE seq_scan > 0
          ORDER BY seq_tup_read DESC
          LIMIT 15
        `);

        const tableBlockers = await db.execute(sql`
          SELECT 
            relname as table_name,
            n_dead_tup as dead_tuples,
            n_live_tup as live_tuples,
            CASE WHEN n_live_tup > 0 THEN round(100.0 * n_dead_tup / n_live_tup, 2) ELSE 0 END as dead_ratio_pct,
            last_autovacuum
          FROM pg_stat_user_tables
          WHERE n_dead_tup > 1000
          ORDER BY n_dead_tup DESC
          LIMIT 10
        `);

        res.json({
          missingIndexCandidates: missingIndexCandidates.rows,
          tablesNeedingVacuum: tableBlockers.rows,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error("Error getting slow query stats:", error);
        res.status(500).json({ 
          message: 'Failed to get slow query stats',
          error: error.message 
        });
      }
    }
  );

  // ============================================================================
  // WEBHOOKS MANAGEMENT (Super Admin)
  // ============================================================================

  app.get(
    "/api/super-admin/webhooks",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const webhooks = await storage.getAllWebhookConfigs();
        res.json(webhooks);
      } catch (error) {
        console.error("Error fetching webhooks:", error);
        res.status(500).json({ message: "Failed to fetch webhooks" });
      }
    }
  );

  app.get(
    "/api/super-admin/webhooks/:id",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const webhook = await storage.getWebhookConfigById(req.params.id);
        if (!webhook) {
          return res.status(404).json({ message: "Webhook not found" });
        }
        res.json(webhook);
      } catch (error) {
        console.error("Error fetching webhook:", error);
        res.status(500).json({ message: "Failed to fetch webhook" });
      }
    }
  );

  app.post(
    "/api/super-admin/webhooks",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const validationResult = insertWebhookConfigSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({ 
            message: "Invalid webhook data", 
            errors: validationResult.error.errors 
          });
        }

        const webhook = await storage.createWebhookConfig({
          ...validationResult.data,
          createdBy: req.user.id,
        });
        res.status(201).json(webhook);
      } catch (error) {
        console.error("Error creating webhook:", error);
        res.status(500).json({ message: "Failed to create webhook" });
      }
    }
  );

  app.patch(
    "/api/super-admin/webhooks/:id",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const validationResult = updateWebhookConfigSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({ 
            message: "Invalid webhook data", 
            errors: validationResult.error.errors 
          });
        }

        const webhook = await storage.updateWebhookConfig(req.params.id, validationResult.data);
        res.json(webhook);
      } catch (error: any) {
        console.error("Error updating webhook:", error);
        if (error.message === 'Webhook config not found') {
          return res.status(404).json({ message: "Webhook not found" });
        }
        res.status(500).json({ message: "Failed to update webhook" });
      }
    }
  );

  app.delete(
    "/api/super-admin/webhooks/:id",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        await storage.deleteWebhookConfig(req.params.id);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting webhook:", error);
        res.status(500).json({ message: "Failed to delete webhook" });
      }
    }
  );

  app.get(
    "/api/super-admin/webhooks/:id/logs",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
        const logs = await storage.getWebhookLogsByWebhookId(req.params.id, limit);
        res.json(logs);
      } catch (error) {
        console.error("Error fetching webhook logs:", error);
        res.status(500).json({ message: "Failed to fetch webhook logs" });
      }
    }
  );

  app.get(
    "/api/super-admin/webhook-logs",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
        const logs = await storage.getRecentWebhookLogs(limit);
        res.json(logs);
      } catch (error) {
        console.error("Error fetching webhook logs:", error);
        res.status(500).json({ message: "Failed to fetch webhook logs" });
      }
    }
  );

  // ============================================================================
  // DATA CLEANUP (Super Admin) - Batch delete test/import data
  // ============================================================================

  // Helper function to validate clientIds are safe strings
  // Since we use Drizzle's inArray with parameterized queries, we're protected from SQL injection
  // This just ensures IDs are reasonable strings (alphanumeric with hyphens/underscores)
  const isValidClientId = (id: string): boolean => {
    if (typeof id !== 'string' || id.length === 0 || id.length > 100) return false;
    // Allow UUIDs and other alphanumeric IDs with hyphens and underscores
    const validIdRegex = /^[a-zA-Z0-9_-]+$/;
    return validIdRegex.test(id);
  };

  // List clients with their createdAt and counts of related data
  app.get(
    "/api/super-admin/data-cleanup/clients",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { dateFrom, dateTo, limit = 100 } = req.query;
        const { db } = await import("../db.js");
        const { sql } = await import("drizzle-orm");

        // Build date filter conditions using parameterized queries
        let dateFilter = sql`1=1`;
        if (dateFrom) {
          dateFilter = sql`${dateFilter} AND c.created_at >= ${new Date(dateFrom as string)}`;
        }
        if (dateTo) {
          dateFilter = sql`${dateFilter} AND c.created_at <= ${new Date(dateTo as string)}`;
        }

        const clientsWithCounts = await db.execute(sql`
          SELECT 
            c.id,
            c.name,
            c.email,
            c.created_at as "createdAt",
            c.client_type as "clientType",
            (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id) as "projectCount",
            (SELECT COUNT(*) FROM client_people cp WHERE cp.client_id = c.id) as "peopleCount",
            (SELECT COUNT(*) FROM client_services cs WHERE cs.client_id = c.id) as "serviceCount",
            (SELECT COUNT(*) FROM documents d WHERE d.client_id = c.id) as "documentCount",
            (SELECT COUNT(*) FROM message_threads mt WHERE mt.client_id = c.id) as "messageThreadCount",
            (SELECT COUNT(*) FROM communications com WHERE com.client_id = c.id) as "communicationCount",
            (SELECT COUNT(*) FROM task_instances ti WHERE ti.client_id = c.id) as "taskCount"
          FROM clients c
          WHERE ${dateFilter}
          ORDER BY c.created_at DESC
          LIMIT ${parseInt(limit as string, 10)}
        `);

        res.json(clientsWithCounts.rows);
      } catch (error) {
        console.error("Error fetching clients for cleanup:", error);
        res.status(500).json({ message: "Failed to fetch clients for cleanup" });
      }
    }
  );

  // Preview deletion impact for selected clients
  app.post(
    "/api/super-admin/data-cleanup/preview",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { clientIds } = req.body;
        
        console.log("[Data Cleanup Preview] Received clientIds:", JSON.stringify(clientIds));
        
        if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
          return res.status(400).json({ message: "clientIds array is required" });
        }

        // Validate all clientIds are valid ID strings
        const invalidIds = clientIds.filter((id: string) => !isValidClientId(id));
        if (invalidIds.length > 0) {
          console.log("[Data Cleanup Preview] Invalid IDs detected:", JSON.stringify(invalidIds));
          return res.status(400).json({ message: "Invalid client ID format detected", invalidIds });
        }

        const { db } = await import("../db.js");
        const { sql, inArray } = await import("drizzle-orm");
        const { clients, projects, clientPeople, clientServices, documents, documentFolders, 
                signatureRequests, messageThreads, communications, taskInstances, 
                clientPortalUsers, clientChronology, projectChronology, people } = await import("@shared/schema");

        // Use Drizzle's inArray for safe parameterized queries
        const [clientCount] = await db.select({ count: sql<number>`count(*)` }).from(clients).where(inArray(clients.id, clientIds));
        const [projectCount] = await db.select({ count: sql<number>`count(*)` }).from(projects).where(inArray(projects.clientId, clientIds));
        const [peopleLinkedCount] = await db.select({ count: sql<number>`count(DISTINCT ${clientPeople.personId})` }).from(clientPeople).where(inArray(clientPeople.clientId, clientIds));
        const [clientServiceCount] = await db.select({ count: sql<number>`count(*)` }).from(clientServices).where(inArray(clientServices.clientId, clientIds));
        const [documentCount] = await db.select({ count: sql<number>`count(*)` }).from(documents).where(inArray(documents.clientId, clientIds));
        const [folderCount] = await db.select({ count: sql<number>`count(*)` }).from(documentFolders).where(inArray(documentFolders.clientId, clientIds));
        const [signatureRequestCount] = await db.select({ count: sql<number>`count(*)` }).from(signatureRequests).where(inArray(signatureRequests.clientId, clientIds));
        const [messageThreadCount] = await db.select({ count: sql<number>`count(*)` }).from(messageThreads).where(inArray(messageThreads.clientId, clientIds));
        const [communicationCount] = await db.select({ count: sql<number>`count(*)` }).from(communications).where(inArray(communications.clientId, clientIds));
        const [taskInstanceCount] = await db.select({ count: sql<number>`count(*)` }).from(taskInstances).where(inArray(taskInstances.clientId, clientIds));
        const [portalUserCount] = await db.select({ count: sql<number>`count(*)` }).from(clientPortalUsers).where(inArray(clientPortalUsers.clientId, clientIds));
        const [chronologyCount] = await db.select({ count: sql<number>`count(*)` }).from(clientChronology).where(inArray(clientChronology.clientId, clientIds));
        
        // Get project IDs for these clients to count project chronology
        const clientProjects = await db.select({ id: projects.id }).from(projects).where(inArray(projects.clientId, clientIds));
        const projectIds = clientProjects.map(p => p.id);
        let projectChronologyCount = { count: 0 };
        if (projectIds.length > 0) {
          [projectChronologyCount] = await db.select({ count: sql<number>`count(*)` }).from(projectChronology).where(inArray(projectChronology.projectId, projectIds));
        }

        // Get list of people who will be orphaned (only linked to these clients)
        const linkedPersonIds = await db.selectDistinct({ personId: clientPeople.personId }).from(clientPeople).where(inArray(clientPeople.clientId, clientIds));
        const linkedIds = linkedPersonIds.map(p => p.personId);
        
        let orphanedPeopleList: Array<{ id: string; full_name: string; email: string | null }> = [];
        if (linkedIds.length > 0) {
          // Find people linked to these clients who have NO links to clients outside the selection
          // First get all client IDs they're linked to, then check if any are NOT in our selection
          const orphanedPeople = await db
            .select({ id: people.id, full_name: people.fullName, email: people.email })
            .from(people)
            .where(inArray(people.id, linkedIds))
            .then(async (linkedPeople) => {
              // For each linked person, check if they have any other client links
              const orphaned: typeof linkedPeople = [];
              for (const person of linkedPeople) {
                const otherLinks = await db
                  .select({ clientId: clientPeople.clientId })
                  .from(clientPeople)
                  .where(sql`${clientPeople.personId} = ${person.id} AND NOT (${inArray(clientPeople.clientId, clientIds)})`);
                if (otherLinks.length === 0) {
                  orphaned.push(person);
                }
              }
              return orphaned;
            });
          orphanedPeopleList = orphanedPeople as any;
        }

        res.json({
          summary: {
            clientCount: clientCount.count.toString(),
            projectCount: projectCount.count.toString(),
            peopleLinkedCount: peopleLinkedCount.count.toString(),
            clientServiceCount: clientServiceCount.count.toString(),
            documentCount: documentCount.count.toString(),
            folderCount: folderCount.count.toString(),
            signatureRequestCount: signatureRequestCount.count.toString(),
            messageThreadCount: messageThreadCount.count.toString(),
            communicationCount: communicationCount.count.toString(),
            taskInstanceCount: taskInstanceCount.count.toString(),
            portalUserCount: portalUserCount.count.toString(),
            chronologyCount: chronologyCount.count.toString(),
            projectChronologyCount: projectChronologyCount.count.toString()
          },
          orphanedPeople: orphanedPeopleList,
          clientIds
        });
      } catch (error) {
        console.error("Error generating cleanup preview:", error);
        res.status(500).json({ message: "Failed to generate cleanup preview" });
      }
    }
  );

  // Execute batch delete with cascading
  app.delete(
    "/api/super-admin/data-cleanup/batch",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { clientIds, deleteOrphanedPeople = true } = req.body;
        
        if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
          return res.status(400).json({ message: "clientIds array is required" });
        }

        // Validate all clientIds are valid ID strings
        const invalidIds = clientIds.filter((id: string) => !isValidClientId(id));
        if (invalidIds.length > 0) {
          return res.status(400).json({ message: "Invalid client ID format detected" });
        }

        const { db } = await import("../db.js");
        const { sql, inArray } = await import("drizzle-orm");
        const { 
          clients, projects, clientPeople, clientServices, people,
          projectChronology, stageApprovalResponses, schedulingExceptions,
          projectSchedulingHistory, projectMessageThreads, projectMessages,
          projectMessageParticipants, scheduledNotifications, notificationHistory,
          clientServiceRoleAssignments, peopleServices, peopleTagAssignments
        } = await import("@shared/schema");

        // Track deletion counts
        const deletionLog: Record<string, number> = {};

        // Execute deletions in the correct order within a transaction
        await db.transaction(async (tx) => {
          // 1. Get all project IDs for these clients
          const projectRows = await tx.select({ id: projects.id }).from(projects).where(inArray(projects.clientId, clientIds));
          const projectIds = projectRows.map(p => p.id);

          // 2. Get all client service IDs
          const serviceRows = await tx.select({ id: clientServices.id }).from(clientServices).where(inArray(clientServices.clientId, clientIds));
          const serviceIds = serviceRows.map(s => s.id);

          // 3. Get people IDs that will be orphaned
          const linkedPersonIds = await tx.selectDistinct({ personId: clientPeople.personId }).from(clientPeople).where(inArray(clientPeople.clientId, clientIds));
          const linkedIds = linkedPersonIds.map(p => p.personId);
          
          let orphanedPeopleIds: string[] = [];
          if (linkedIds.length > 0) {
            // Find people linked to these clients who have NO links to clients outside the selection
            const linkedPeople = await tx.select({ id: people.id }).from(people).where(inArray(people.id, linkedIds));
            for (const person of linkedPeople) {
              const otherLinks = await tx
                .select({ clientId: clientPeople.clientId })
                .from(clientPeople)
                .where(sql`${clientPeople.personId} = ${person.id} AND NOT (${inArray(clientPeople.clientId, clientIds)})`);
              if (otherLinks.length === 0) {
                orphanedPeopleIds.push(person.id);
              }
            }
          }

          // Delete in dependency order:
          
          // Project-related tables (no cascade from projects)
          if (projectIds.length > 0) {
            // Reason field responses (depends on project_chronology) - get chronology IDs first
            const chronologyIds = await tx.select({ id: projectChronology.id }).from(projectChronology).where(inArray(projectChronology.projectId, projectIds));
            if (chronologyIds.length > 0) {
              const { reasonFieldResponses } = await import("@shared/schema");
              const reasonResult = await tx.delete(reasonFieldResponses).where(inArray(reasonFieldResponses.chronologyId, chronologyIds.map(c => c.id)));
              deletionLog['reasonFieldResponses'] = reasonResult.rowCount || 0;
            } else {
              deletionLog['reasonFieldResponses'] = 0;
            }

            // Project chronology
            const chronResult = await tx.delete(projectChronology).where(inArray(projectChronology.projectId, projectIds));
            deletionLog['projectChronology'] = chronResult.rowCount || 0;

            // Stage approval responses
            const approvalResult = await tx.delete(stageApprovalResponses).where(inArray(stageApprovalResponses.projectId, projectIds));
            deletionLog['stageApprovalResponses'] = approvalResult.rowCount || 0;

            // Note: Scheduling exceptions use clientServiceId not projectId - handled in client services section

            // Project scheduling history
            const schedHistResult = await tx.delete(projectSchedulingHistory).where(inArray(projectSchedulingHistory.projectId, projectIds));
            deletionLog['projectSchedulingHistory'] = schedHistResult.rowCount || 0;

            // Get project message thread IDs
            const pmThreadRows = await tx.select({ id: projectMessageThreads.id }).from(projectMessageThreads).where(inArray(projectMessageThreads.projectId, projectIds));
            const pmThreadIds = pmThreadRows.map(t => t.id);

            if (pmThreadIds.length > 0) {
              // Project message participants
              const pmParticipantsResult = await tx.delete(projectMessageParticipants).where(inArray(projectMessageParticipants.threadId, pmThreadIds));
              deletionLog['projectMessageParticipants'] = pmParticipantsResult.rowCount || 0;

              // Project messages
              const pmMessagesResult = await tx.delete(projectMessages).where(inArray(projectMessages.threadId, pmThreadIds));
              deletionLog['projectMessages'] = pmMessagesResult.rowCount || 0;
            }

            // Project message threads
            const pmThreadsResult = await tx.delete(projectMessageThreads).where(inArray(projectMessageThreads.projectId, projectIds));
            deletionLog['projectMessageThreads'] = pmThreadsResult.rowCount || 0;

            // Scheduled notifications for projects
            const schedNotifResult = await tx.delete(scheduledNotifications).where(inArray(scheduledNotifications.projectId, projectIds));
            deletionLog['scheduledNotifications'] = schedNotifResult.rowCount || 0;

            // Notification history uses clientId - will be cascade deleted with clients

            // Now delete projects
            const projectsResult = await tx.delete(projects).where(inArray(projects.clientId, clientIds));
            deletionLog['projects'] = projectsResult.rowCount || 0;
          }

          // Client service role assignments
          if (serviceIds.length > 0) {
            const roleResult = await tx.delete(clientServiceRoleAssignments).where(inArray(clientServiceRoleAssignments.clientServiceId, serviceIds));
            deletionLog['clientServiceRoleAssignments'] = roleResult.rowCount || 0;

            // Project scheduling history for client services
            const csHistResult = await tx.delete(projectSchedulingHistory).where(inArray(projectSchedulingHistory.clientServiceId, serviceIds));
            deletionLog['clientServiceSchedulingHistory'] = csHistResult.rowCount || 0;

            // Scheduling exceptions for client services
            const csExResult = await tx.delete(schedulingExceptions).where(inArray(schedulingExceptions.clientServiceId, serviceIds));
            deletionLog['clientServiceSchedulingExceptions'] = csExResult.rowCount || 0;
          }

          // Client services (cascade will handle some)
          const csResult = await tx.delete(clientServices).where(inArray(clientServices.clientId, clientIds));
          deletionLog['clientServices'] = csResult.rowCount || 0;

          // People services for orphaned people
          if (deleteOrphanedPeople && orphanedPeopleIds.length > 0) {
            const psResult = await tx.delete(peopleServices).where(inArray(peopleServices.personId, orphanedPeopleIds));
            deletionLog['peopleServices'] = psResult.rowCount || 0;

            const ptaResult = await tx.delete(peopleTagAssignments).where(inArray(peopleTagAssignments.personId, orphanedPeopleIds));
            deletionLog['peopleTagAssignments'] = ptaResult.rowCount || 0;
          }

          // Delete client people links explicitly for the orphaned people count
          const cpResult = await tx.delete(clientPeople).where(inArray(clientPeople.clientId, clientIds));
          deletionLog['clientPeopleLinks'] = cpResult.rowCount || 0;

          // Delete orphaned people if requested
          if (deleteOrphanedPeople && orphanedPeopleIds.length > 0) {
            const peopleResult = await tx.delete(people).where(inArray(people.id, orphanedPeopleIds));
            deletionLog['people'] = peopleResult.rowCount || 0;
          }

          // Finally delete clients (cascades will handle remaining dependencies)
          const clientsResult = await tx.delete(clients).where(inArray(clients.id, clientIds));
          deletionLog['clients'] = clientsResult.rowCount || 0;
        });

        res.json({
          success: true,
          message: `Successfully deleted ${deletionLog['clients'] || 0} clients and related data`,
          deletionLog
        });
      } catch (error: any) {
        console.error("Error during batch cleanup:", error);
        res.status(500).json({ 
          message: "Failed to complete batch cleanup", 
          error: error.message,
          hint: "Some records may have foreign key constraints. Check the error details."
        });
      }
    }
  );

  // ============================================================================
  // USER ACCESS FLAGS MANAGEMENT (Super Admin)
  // Controls which users have their Microsoft email/calendar data synced
  // ============================================================================

  // Get all users with their access flags
  app.get(
    "/api/super-admin/users",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const allUsers = await storage.getAllUsers();
        // Return only necessary fields for the admin view
        const usersWithFlags = allUsers.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin,
          superAdmin: user.superAdmin,
          accessEmail: user.accessEmail ?? false,
          accessCalendar: user.accessCalendar ?? false,
          createdAt: user.createdAt,
        }));
        res.json(usersWithFlags);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    }
  );

  // Update a user's access flags (accessEmail, accessCalendar)
  app.patch(
    "/api/super-admin/users/:userId/access-flags",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { userId } = req.params;
        
        // Validate request body
        const validationResult = updateUserAccessFlagsSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({ 
            message: "Invalid access flags data", 
            errors: validationResult.error.errors 
          });
        }

        const { accessEmail, accessCalendar } = validationResult.data;
        
        // Build update object with only defined values
        const updates: { accessEmail?: boolean; accessCalendar?: boolean } = {};
        if (accessEmail !== undefined) updates.accessEmail = accessEmail;
        if (accessCalendar !== undefined) updates.accessCalendar = accessCalendar;

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ message: "No valid fields to update" });
        }

        const updatedUser = await storage.updateUser(userId, updates);
        
        res.json({
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          accessEmail: updatedUser.accessEmail ?? false,
          accessCalendar: updatedUser.accessCalendar ?? false,
        });
      } catch (error: any) {
        console.error("Error updating user access flags:", error);
        if (error.message === "User not found") {
          return res.status(404).json({ message: "User not found" });
        }
        res.status(500).json({ message: "Failed to update user access flags" });
      }
    }
  );

  // ============================================================================
  // GRAPH API TEST ENDPOINTS (Super Admin)
  // Read-only exploration of Microsoft Graph data before deployment
  // ============================================================================

  // Check if Graph API is configured
  app.get(
    "/api/super-admin/graph/status",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const configured = isApplicationGraphConfigured();
        res.json({ configured });
      } catch (error) {
        console.error("Error checking Graph status:", error);
        res.status(500).json({ message: "Failed to check Graph status" });
      }
    }
  );

  // Get users who have email or calendar access enabled
  app.get(
    "/api/super-admin/graph/eligible-users",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const allUsers = await storage.getAllUsers();
        // Filter to only users with accessEmail or accessCalendar enabled
        const eligibleUsers = allUsers
          .filter(user => user.accessEmail || user.accessCalendar)
          .map(user => ({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            accessEmail: user.accessEmail ?? false,
            accessCalendar: user.accessCalendar ?? false,
          }));
        res.json(eligibleUsers);
      } catch (error) {
        console.error("Error fetching eligible users:", error);
        res.status(500).json({ message: "Failed to fetch eligible users" });
      }
    }
  );

  // Get mail folders for a user
  app.get(
    "/api/super-admin/graph/users/:userEmail/folders",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { userEmail } = req.params;

        // Check if user has email access
        const allUsers = await storage.getAllUsers();
        const targetUser = allUsers.find(u => u.email === userEmail);
        if (!targetUser || !targetUser.accessEmail) {
          return res.status(403).json({ message: "User does not have email access enabled" });
        }

        const folders = await getUserMailFolders(userEmail);
        res.json(folders);
      } catch (error: any) {
        console.error("Error fetching mail folders:", error);
        res.status(500).json({ message: error.message || "Failed to fetch mail folders" });
      }
    }
  );

  // Get emails for a user with filtering and pagination
  app.get(
    "/api/super-admin/graph/users/:userEmail/messages",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { userEmail } = req.params;
        const { 
          folder = 'Inbox',
          startDate,
          endDate,
          search,
          top = '25',
          skip = '0'
        } = req.query;

        // Check if user has email access
        const allUsers = await storage.getAllUsers();
        const targetUser = allUsers.find(u => u.email === userEmail);
        if (!targetUser || !targetUser.accessEmail) {
          return res.status(403).json({ message: "User does not have email access enabled" });
        }

        // Build OData filter for date range
        const filters: string[] = [];
        
        if (startDate) {
          filters.push(`receivedDateTime ge ${startDate}T00:00:00Z`);
        }
        if (endDate) {
          filters.push(`receivedDateTime le ${endDate}T23:59:59Z`);
        }
        if (search) {
          // Search in subject and from
          filters.push(`contains(subject, '${search.replace(/'/g, "''")}') or contains(from/emailAddress/address, '${search.replace(/'/g, "''")}')`);
        }

        const result = await getUserEmails(userEmail, {
          folder: folder as string,
          top: parseInt(top as string, 10),
          skip: parseInt(skip as string, 10),
          filter: filters.length > 0 ? filters.join(' and ') : undefined,
        });

        res.json({
          messages: result.messages,
          hasMore: !!result.nextLink,
          count: result.count,
        });
      } catch (error: any) {
        console.error("Error fetching emails:", error);
        res.status(500).json({ message: error.message || "Failed to fetch emails" });
      }
    }
  );

  // Get a specific email with full body
  app.get(
    "/api/super-admin/graph/users/:userEmail/messages/:messageId",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { userEmail, messageId } = req.params;

        // Check if user has email access
        const allUsers = await storage.getAllUsers();
        const targetUser = allUsers.find(u => u.email === userEmail);
        if (!targetUser || !targetUser.accessEmail) {
          return res.status(403).json({ message: "User does not have email access enabled" });
        }

        const message = await getUserEmailById(userEmail, messageId, true);
        res.json(message);
      } catch (error: any) {
        console.error("Error fetching email:", error);
        res.status(500).json({ message: error.message || "Failed to fetch email" });
      }
    }
  );

  // Test webhook - allows sending a test payload to any webhook URL
  app.post(
    "/api/super-admin/webhooks/test",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { webhookUrl, variables } = req.body;

        if (!webhookUrl) {
          return res.status(400).json({ message: "Webhook URL is required" });
        }

        console.log(`[Webhook Test] Testing webhook: ${webhookUrl}`);
        console.log(`[Webhook Test] Payload:`, variables);

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(variables || {})
        });

        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }

        if (!response.ok) {
          return res.json({
            success: false,
            status: response.status,
            statusText: response.statusText,
            response: responseData
          });
        }

        res.json({
          success: true,
          status: response.status,
          statusText: response.statusText,
          response: responseData
        });
      } catch (error: any) {
        console.error("[Webhook Test] Error:", error);
        res.status(500).json({ 
          success: false,
          message: error.message || "Failed to test webhook" 
        });
      }
    }
  );

  // Get calendar events for a user
  app.get(
    "/api/super-admin/graph/users/:userEmail/calendar",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { userEmail } = req.params;
        const { 
          startDate,
          endDate,
          top = '50'
        } = req.query;

        // Check if user has calendar access
        const allUsers = await storage.getAllUsers();
        const targetUser = allUsers.find(u => u.email === userEmail);
        if (!targetUser || !targetUser.accessCalendar) {
          return res.status(403).json({ message: "User does not have calendar access enabled" });
        }

        // Default to current week if no dates provided
        const now = new Date();
        const defaultStart = new Date(now);
        defaultStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        const defaultEnd = new Date(defaultStart);
        defaultEnd.setDate(defaultStart.getDate() + 6); // End of week (Saturday)

        const startDateTime = startDate 
          ? `${startDate}T00:00:00Z` 
          : defaultStart.toISOString();
        const endDateTime = endDate 
          ? `${endDate}T23:59:59Z` 
          : defaultEnd.toISOString();

        const result = await getUserCalendarEvents(userEmail, {
          startDateTime,
          endDateTime,
          top: parseInt(top as string, 10),
        });

        res.json({
          events: result.events,
          hasMore: !!result.nextLink,
        });
      } catch (error: any) {
        console.error("Error fetching calendar events:", error);
        res.status(500).json({ message: error.message || "Failed to fetch calendar events" });
      }
    }
  );

  // ========================================
  // NOTIFICATION TESTING CONTROLS
  // Super admin only - for testing notification flows
  // ========================================

  // Reschedule a notification to a specific time (or immediate)
  app.post(
    "/api/super-admin/notifications/:notificationId/reschedule",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { notificationId } = req.params;
        const { scheduledFor, immediate } = req.body;

        // Calculate target time
        let targetTime: Date;
        if (immediate) {
          // Schedule for 1 minute ago to ensure it's picked up immediately
          targetTime = new Date();
          targetTime.setMinutes(targetTime.getMinutes() - 1);
        } else if (scheduledFor) {
          targetTime = new Date(scheduledFor);
          if (isNaN(targetTime.getTime())) {
            return res.status(400).json({ message: "Invalid scheduledFor date" });
          }
        } else {
          return res.status(400).json({ message: "Either 'immediate' or 'scheduledFor' is required" });
        }

        // Update the notification - reset all failure states to allow re-processing
        const updated = await storage.updateScheduledNotification(notificationId, {
          scheduledFor: targetTime,
          status: 'scheduled', // Reset to scheduled in case it was in another state
          failureReason: null, // Clear any previous failure reason
          updatedAt: new Date(), // Bump updated timestamp
        });

        if (!updated) {
          return res.status(404).json({ message: "Notification not found" });
        }

        console.log(`[SuperAdmin] Rescheduled notification ${notificationId} to ${targetTime.toISOString()} by ${req.user.email}`);

        res.json({
          success: true,
          message: immediate 
            ? `Notification rescheduled for immediate processing. Run the notification processor to send it.`
            : `Notification rescheduled to ${targetTime.toISOString()}`,
          notification: updated,
        });
      } catch (error: any) {
        console.error("Error rescheduling notification:", error);
        res.status(500).json({ message: error.message || "Failed to reschedule notification" });
      }
    }
  );

  // Manually trigger notification processing (runs the cron job)
  app.post(
    "/api/super-admin/notifications/process-now",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { processDueNotifications } = await import("../notification-sender");
        
        console.log(`[SuperAdmin] Manual notification processing triggered by ${req.user.email}`);
        
        await processDueNotifications();

        res.json({
          success: true,
          message: "Notification processing completed. Check the server logs for details.",
        });
      } catch (error: any) {
        console.error("Error processing notifications:", error);
        res.status(500).json({ message: error.message || "Failed to process notifications" });
      }
    }
  );

  // Get notification details for testing (includes task instance info)
  app.get(
    "/api/super-admin/notifications/:notificationId/details",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { notificationId } = req.params;
        
        const notification = await storage.getScheduledNotificationById(notificationId);
        if (!notification) {
          return res.status(404).json({ message: "Notification not found" });
        }

        // Get related task instance if exists
        let taskInstance = null;
        if (notification.taskInstanceId) {
          taskInstance = await storage.clientProjectTaskStorage.getInstanceById(notification.taskInstanceId);
        }

        // Get client and project info
        const client = notification.clientId 
          ? await storage.getClientById(notification.clientId)
          : null;
        const project = notification.projectId
          ? await storage.getProjectById(notification.projectId)
          : null;

        res.json({
          notification,
          taskInstance,
          client: client ? { id: client.id, name: client.name } : null,
          project: project ? { id: project.id, description: project.description } : null,
        });
      } catch (error: any) {
        console.error("Error fetching notification details:", error);
        res.status(500).json({ message: error.message || "Failed to fetch notification details" });
      }
    }
  );
}
