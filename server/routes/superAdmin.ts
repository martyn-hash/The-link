import type { Express } from "express";
import { storage } from "../storage";

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
}
