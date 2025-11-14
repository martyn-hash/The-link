import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cron from "node-cron";
import { runChSync } from "./ch-sync-service";
import { runProjectScheduling } from "./project-scheduler";
import { sendSchedulingSummaryEmail } from "./emailService";
import { sendProjectMessageReminders } from "./projectMessageReminderService";
import { updateDashboardCache } from "./dashboard-cache-service";
import { storage, initializeDefaultNotificationTemplates } from "./storage";
import { seedTaskTypes } from "./seedData";
import { runSchemaMigrations } from "./utils/schemaMigrations";
import { startNotificationCron } from "./notification-cron";
import { startSignatureReminderCron } from "./signature-reminder-cron";
import fs from "fs";
import path from "path";
import cookieParser from "cookie-parser";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Dynamic manifest route - serves portal or staff manifest based on cookie
  // MUST be before Vite setup to intercept the manifest request
  app.get('/manifest.json', async (req, res) => {
    const manifestType = req.cookies?.pwa_manifest || 'staff';
    const manifestPath = manifestType === 'portal' 
      ? path.resolve(import.meta.dirname, "..", "client", "public", "portal-manifest.json")
      : path.resolve(import.meta.dirname, "..", "client", "public", "manifest.json");
    
    try {
      const manifest = await fs.promises.readFile(manifestPath, 'utf-8');
      res.set('Content-Type', 'application/json');
      res.send(manifest);
    } catch (error) {
      // Fallback to staff manifest
      const staffManifest = await fs.promises.readFile(
        path.resolve(import.meta.dirname, "..", "client", "public", "manifest.json"),
        'utf-8'
      );
      res.set('Content-Type', 'application/json');
      res.send(staffManifest);
    }
  });

  // Add Cache-Control headers for HTML navigation requests to ensure fresh content loads
  // This prevents caching of index.html so users get latest bundle references immediately
  app.use((req, res, next) => {
    // Set no-cache headers for all HTML navigation requests (non-API, non-static-asset routes)
    // This catches requests for /, /portal/login, and other SPA routes
    const isApiRequest = req.path.startsWith('/api/');
    const isStaticAsset = req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico|json|webp)$/);
    const isManifest = req.path === '/manifest.json';
    
    if (!isApiRequest && !isStaticAsset && !isManifest) {
      // Set headers proactively for HTML navigation requests
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
    }
    
    next();
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Run schema migrations first to ensure database is up to date
    await runSchemaMigrations();
    
    // Seed initial task types
    await seedTaskTypes();
    
    // Initialize default notification templates
    await initializeDefaultNotificationTemplates();
    
    // Setup nightly project scheduling
    // Runs every day at 1:00 AM UTC (before CH sync to ensure projects are created first)
    cron.schedule('0 1 * * *', async () => {
      try {
        log('[Project Scheduler] Starting scheduled nightly run...');
        const result = await runProjectScheduling('scheduled');
        log(`[Project Scheduler] Nightly run completed: ${result.status} - ${result.projectsCreated} projects created, ${result.servicesRescheduled} services rescheduled`);
        if (result.errorsEncountered > 0) {
          console.error(`[Project Scheduler] Nightly run had ${result.errorsEncountered} errors:`, result.errors);
        }
        
        // Send email notifications to users who have enabled scheduling summaries
        try {
          log('[Project Scheduler] Sending notification emails...');
          const usersWithNotifications = await storage.getUsersWithSchedulingNotifications();
          
          if (usersWithNotifications.length > 0) {
            const emailPromises = usersWithNotifications.map(async (user) => {
              const userDisplayName = user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user.firstName || user.email || 'User';
              
              return sendSchedulingSummaryEmail(user.email!, userDisplayName, {
                status: result.status,
                servicesFoundDue: result.servicesFoundDue,
                projectsCreated: result.projectsCreated,
                servicesRescheduled: result.servicesRescheduled,
                errorsEncountered: result.errorsEncountered,
                executionTimeMs: result.executionTimeMs,
                summary: result.summary,
                errors: result.errors
              });
            });
            
            const emailResults = await Promise.allSettled(emailPromises);
            const successfulEmails = emailResults.filter(result => result.status === 'fulfilled' && result.value).length;
            const failedEmails = emailResults.filter(result => result.status === 'rejected' || !result.value).length;
            
            log(`[Project Scheduler] Email notifications sent: ${successfulEmails} successful, ${failedEmails} failed`);
          } else {
            log('[Project Scheduler] No users have enabled scheduling summary notifications');
          }
        } catch (emailError) {
          console.error('[Project Scheduler] Error sending notification emails:', emailError);
        }
      } catch (error) {
        console.error('[Project Scheduler] Fatal error in nightly run:', error);
      }
    }, {
      timezone: "UTC"
    });
    
    log('[Project Scheduler] Nightly scheduler initialized (runs daily at 1:00 AM UTC)');
    
    // Setup nightly Companies House data synchronization
    // Runs every day at 2:00 AM UTC (after project scheduling)
    cron.schedule('0 2 * * *', async () => {
      try {
        log('[CH Sync] Starting scheduled nightly sync...');
        const result = await runChSync();
        log(`[CH Sync] Nightly sync completed: ${result.processedClients} clients, ${result.createdRequests} requests, ${result.errors.length} errors`);
        if (result.errors.length > 0) {
          console.error('[CH Sync] Nightly sync errors:', result.errors);
        }
      } catch (error) {
        console.error('[CH Sync] Fatal error in nightly sync:', error);
      }
    }, {
      timezone: "UTC"
    });
    
    log('[CH Sync] Nightly scheduler initialized (runs daily at 2:00 AM UTC)');
    
    // Setup nightly email resolver
    // Runs every day at 3:00 AM UTC (after Companies House sync)
    cron.schedule('0 3 * * *', async () => {
      try {
        log('[Email Resolver] Starting nightly quarantine resolution...');
        const { emailResolverService } = await import('./services/emailResolverService');
        const stats = await emailResolverService.resolveQuarantinedEmails();
        log(`[Email Resolver] Nightly resolution complete: ${stats.matched} matched, ${stats.stillUnmatched} still unmatched, ${stats.errors} errors`);
        
        // Also run cleanup of old quarantined emails (>90 days old with >5 retry attempts)
        const cleanedCount = await emailResolverService.cleanupOldQuarantinedEmails(90);
        log(`[Email Resolver] Cleaned up ${cleanedCount} old quarantined emails`);
      } catch (error) {
        console.error('[Email Resolver] Error in nightly resolution:', error);
        log('[Email Resolver] Error in nightly resolution:', error instanceof Error ? error.message : String(error));
      }
    }, {
      timezone: "UTC"
    });
    
    log('[Email Resolver] Nightly scheduler initialized (runs daily at 3:00 AM UTC)');
    
    // Setup project message reminder checks
    // Runs every 10 minutes to check for unread messages >10 minutes old
    cron.schedule('*/10 * * * *', async () => {
      try {
        log('[Project Message Reminders] Starting reminder check...');
        const result = await sendProjectMessageReminders();
        log(`[Project Message Reminders] Check completed: ${result.emailsSent}/${result.usersProcessed} emails sent`);
        if (result.errors.length > 0) {
          console.error('[Project Message Reminders] Errors:', result.errors);
        }
      } catch (error) {
        console.error('[Project Message Reminders] Fatal error:', error);
      }
    });
    
    log('[Project Message Reminders] Scheduler initialized (runs every 10 minutes)');
    
    // Setup notification sender cron job
    // Runs every minute to check for and send due notifications
    startNotificationCron();
    
    // Setup signature reminder cron job
    // Runs daily at 9:00 AM UK time to send signature request reminders
    startSignatureReminderCron();
    
    // Setup dashboard cache updates
    // Overnight update: Runs at 03:00 UK time (3:00 AM GMT/BST) - Europe/London timezone
    cron.schedule('0 3 * * *', async () => {
      try {
        log('[Dashboard Cache] Starting overnight cache update...');
        const result = await updateDashboardCache();
        log(`[Dashboard Cache] Overnight update completed: ${result.status} - ${result.usersUpdated}/${result.usersProcessed} users updated in ${result.executionTimeMs}ms`);
        if (result.errors.length > 0) {
          console.error('[Dashboard Cache] Overnight update errors:', result.errors);
        }
      } catch (error) {
        console.error('[Dashboard Cache] Fatal error in overnight update:', error);
      }
    }, {
      timezone: "Europe/London" // UK timezone (handles GMT/BST automatically)
    });
    
    log('[Dashboard Cache] Overnight scheduler initialized (runs daily at 03:00 UK time)');
    
    // Hourly updates during business hours: 08:00-18:00 UK time
    cron.schedule('0 8-18 * * *', async () => {
      try {
        log('[Dashboard Cache] Starting hourly cache update...');
        const result = await updateDashboardCache();
        log(`[Dashboard Cache] Hourly update completed: ${result.status} - ${result.usersUpdated}/${result.usersProcessed} users updated in ${result.executionTimeMs}ms`);
        if (result.errors.length > 0) {
          console.error('[Dashboard Cache] Hourly update errors:', result.errors);
        }
      } catch (error) {
        console.error('[Dashboard Cache] Fatal error in hourly update:', error);
      }
    }, {
      timezone: "Europe/London" // UK timezone (handles GMT/BST automatically)
    });
    
    log('[Dashboard Cache] Hourly scheduler initialized (runs every hour 08:00-18:00 UK time)');
    
    // Setup activity logs cleanup
    // Runs daily at 4:00 AM UTC (after project scheduling, CH sync, and email resolver)
    cron.schedule('0 4 * * *', async () => {
      try {
        log('[Activity Cleanup] Starting cleanup job...');
        
        // Mark sessions without activity in 24+ hours as inactive
        const inactiveSessions = await storage.markInactiveSessions();
        log(`[Activity Cleanup] Marked ${inactiveSessions} stale sessions as inactive`);
        
        // Delete sessions older than 90 days
        const deletedSessions = await storage.cleanupOldSessions(90);
        log(`[Activity Cleanup] Deleted ${deletedSessions} sessions older than 90 days`);
        
        // Delete login attempts older than 90 days
        const deletedAttempts = await storage.cleanupOldLoginAttempts(90);
        log(`[Activity Cleanup] Deleted ${deletedAttempts} login attempts older than 90 days`);
        
        log('[Activity Cleanup] Cleanup completed successfully');
      } catch (error) {
        console.error('[Activity Cleanup] Fatal error in cleanup job:', error);
      }
    }, {
      timezone: "UTC"
    });
    
    log('[Activity Cleanup] Nightly scheduler initialized (runs daily at 4:00 AM UTC, 90-day retention)');
  });
})();
