import type { Express } from "express";
import { storage } from "../storage";
import { updateCompanySettingsSchema } from "@shared/schema";
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
}
