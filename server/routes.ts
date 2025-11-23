import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./auth";
import { verifyMessageAttachmentAccess, verifyThreadAccess } from "./middleware/attachmentAccess";
import { storage } from "./storage/index";

// Import route helpers (middleware and utilities)
import {
  resolveEffectiveUser,
  requireAdmin,
  requireSuperAdmin,
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
import { registerEmailRoutes } from "./routes/emails";
import { registerSuperAdminRoutes } from "./routes/superAdmin";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerSignatureRoutes } from "./routes/signatures";

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

  // Activity tracking middleware - tracks page navigation for authenticated staff users
  app.use(async (req: any, res, next) => {
    try {
      // Only track page navigation (GET requests that aren't API calls or static assets)
      const isPageNavigation = req.method === 'GET' && 
                                !req.path.startsWith('/api/') && 
                                !req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico|json|webp)$/);
      
      // Only track activity for authenticated staff users (use session.userId since req.user is populated later)
      if (isPageNavigation && req.session?.userId) {
        // Update session activity asynchronously (don't block the request)
        storage.updateUserSessionActivity(req.session.userId).catch((err: Error) => {
          console.error('Failed to update session activity:', err);
        });
      }
    } catch (err) {
      console.error('Error in activity tracking middleware:', err);
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
  registerEmailRoutes(app, isAuthenticated, resolveEffectiveUser);
  registerSuperAdminRoutes(app, isAuthenticated, resolveEffectiveUser, requireSuperAdmin);
  registerNotificationRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerSignatureRoutes(app, isAuthenticated, resolveEffectiveUser);

  const httpServer = createServer(app);
  return httpServer;
}
