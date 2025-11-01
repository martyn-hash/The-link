import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./auth";
import { verifyMessageAttachmentAccess, verifyThreadAccess } from "./middleware/attachmentAccess";

// Import route helpers (middleware and utilities)
import {
  resolveEffectiveUser,
  requireAdmin,
  requireManager,
  upload
} from "./routes/routeHelpers";

// Import modular route registration functions
import { registerPortalRoutes } from "./routes/portal";
import { registerConfigRoutes } from "./routes/config";
import { registerClientRoutes } from "./routes/clients";
import { registerPeopleRoutes } from "./routes/people";
import { registerProjectRoutes } from "./routes/projects";
import { registerServiceRoutes } from "./routes/services";
import { registerTaskRoutes } from "./routes/tasks";
import { registerMessageRoutes } from "./routes/messages";
import { registerIntegrationRoutes } from "./routes/integrations";
import { registerAuthAndMiscRoutes } from "./routes/auth";
import { registerInternalTaskRoutes } from "./routes/internalTasks";

/**
 * Register all application routes
 *
 * This function sets up authentication middleware and registers all route modules.
 * Routes have been organized into logical modules for better maintainability:
 *
 * - Portal: Client portal authentication, messaging, documents, tasks
 * - Config: System configuration (stages, approvals, project types, etc.)
 * - Clients: Client management, Companies House integration, tags, services
 * - People: People management, tags, services, company relationships
 * - Projects: Project CRUD, scheduling, views, CSV upload
 * - Services: Service management, work roles, role assignments
 * - Tasks: Task templates, instances, custom requests
 * - Messages: Internal messaging, project messaging, communications
 * - Integrations: OAuth (Outlook, RingCentral), push notifications, email, SMS
 * - Auth: Authentication, users, dashboards, documents, analytics
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Cache-Control middleware for API endpoints
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      // Dynamic API endpoints should not be cached
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // Register all route modules
  // Order matters for some routes (e.g., portal auth routes must come before authenticated portal routes)

  registerPortalRoutes(app);
  await registerAuthAndMiscRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerConfigRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerClientRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerPeopleRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager, upload);
  registerServiceRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerTaskRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerInternalTaskRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin);
  registerMessageRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, verifyMessageAttachmentAccess, verifyThreadAccess);
  registerIntegrationRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin);

  const httpServer = createServer(app);
  return httpServer;
}
