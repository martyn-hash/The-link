import type { Express } from "express";
import { storage } from "../storage/index";
import { updateCompanySettingsSchema, insertWebhookConfigSchema, updateWebhookConfigSchema } from "@shared/schema";
import multer from "multer";
import { ObjectStorageService, objectStorageClient, parseObjectPath } from "../objectStorage";

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

  // Get company settings
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
        
        res.json(settings);
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
        
        const updatedSettings = await storage.updateCompanySettings(validationResult.data);
        res.json(updatedSettings);
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
}
