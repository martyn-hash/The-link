import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cron from "node-cron";
import { initEventLoopMonitor, wrapCronHandler, tryAcquireJobLock, releaseJobLock } from "./cron-telemetry";
import { runChSync } from "./ch-sync-service";
import { executeScheduledRun, runStartupCatchup } from "./scheduling-orchestrator";
import { waitForDatabaseReady } from "./db";
import { sendProjectMessageReminders } from "./projectMessageReminderService";
import { updateDashboardCache } from "./dashboard-cache-service";
import { warmViewCache } from "./view-cache-service";
import { storage, initializeDefaultNotificationTemplates } from "./storage/index";
import { seedTaskTypes } from "./seedData";
import { startNotificationCron } from "./notification-cron";
import { startSignatureReminderCron } from "./signature-reminder-cron";
import { startReminderNotificationCron } from "./reminder-notification-cron";
import { startQueryReminderCron } from "./query-reminder-cron";
import { startSequenceCron } from "./sequence-cron";
import { startEngagementCron } from "./engagement-cron";
import { recoverPendingTranscriptions } from "./transcription-service";
import fs from "fs";
import path from "path";
import cookieParser from "cookie-parser";

const app = express();
// Increase body size limit to 75MB for email attachments (5 files x 10MB = 50MB, + ~33% base64 encoding overhead = ~67MB)
app.use(express.json({ limit: '75mb' }));
app.use(express.urlencoded({ extended: false, limit: '75mb' }));
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
    
    // Initialize event loop monitoring for cron telemetry
    initEventLoopMonitor();
    
    // Seed initial task types
    await seedTaskTypes();
    
    // Initialize default notification templates
    await initializeDefaultNotificationTemplates();
    
    // Run startup catch-up to detect and execute any missed scheduling runs
    // This ensures server restarts don't cause missed overnight scheduling
    // Only runs if startupCatchUp setting is enabled (defaults to true)
    // IMPORTANT: This is wrapped in a non-fatal block - scheduler failures must NEVER crash the process
    try {
      // DB Readiness Gate: Wait for database to be ready before attempting catch-up
      // This prevents crash loops when the database is slow to start (e.g., Neon cold start)
      log('[Scheduling Orchestrator] Checking database readiness before catch-up...');
      const dbReady = await waitForDatabaseReady({ maxWaitMs: 120000 });
      
      if (!dbReady) {
        console.error('[Scheduling Orchestrator] Database not ready after 2 minutes - skipping startup catch-up (will retry on next scheduled run)');
      } else {
        const settings = await storage.getCompanySettings();
        const startupCatchUpEnabled = settings?.startupCatchUp !== false;
        
        if (startupCatchUpEnabled) {
          log('[Scheduling Orchestrator] Running startup catch-up check...');
          const catchupResult = await runStartupCatchup();
          log(`[Scheduling Orchestrator] ${catchupResult.message}`);
        } else {
          log('[Scheduling Orchestrator] Startup catch-up check disabled via company settings');
        }
      }
    } catch (catchupError) {
      // NON-FATAL: Log and continue - scheduler failures must never crash the web server
      console.error('[Scheduling Orchestrator] Error in startup catch-up (non-fatal, will retry on next scheduled run):', 
        catchupError instanceof Error ? catchupError.message : catchupError);
    }
    
    // Recover any pending transcription jobs that were interrupted by server restart
    try {
      await recoverPendingTranscriptions();
    } catch (transcriptionError) {
      console.error('[Transcription] Error recovering pending transcriptions:', transcriptionError);
    }
    
    // Setup nightly project scheduling via orchestrator
    // Runs every day at 1:00 AM UTC (before CH sync to ensure projects are created first)
    // The orchestrator handles duplicate prevention and email notifications
    cron.schedule('0 1 * * *', wrapCronHandler('SchedulingOrchestrator', '0 1 * * *', async () => {
      try {
        log('[Scheduling Orchestrator] Starting scheduled nightly run...');
        const result = await executeScheduledRun();
        log(`[Scheduling Orchestrator] Nightly run ${result.status}: ${result.message}`);
        
        if (result.schedulingResult?.errorsEncountered && result.schedulingResult.errorsEncountered > 0) {
          console.error(`[Scheduling Orchestrator] Nightly run had ${result.schedulingResult.errorsEncountered} errors:`, result.schedulingResult.errors);
        }
      } catch (error) {
        console.error('[Scheduling Orchestrator] Fatal error in nightly run:', error);
      }
    }), {
      timezone: "UTC"
    });
    
    log('[Scheduling Orchestrator] Nightly scheduler initialized (runs daily at 1:00 AM UTC with catch-up on restart)');
    
    // Setup nightly Companies House data synchronization
    // Runs every day at 2:00 AM UTC (after project scheduling)
    cron.schedule('0 2 * * *', wrapCronHandler('CHSync', '0 2 * * *', async () => {
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
    }), {
      timezone: "UTC"
    });
    
    log('[CH Sync] Nightly scheduler initialized (runs daily at 2:00 AM UTC)');
    
    // Setup nightly email resolver
    // Runs every day at 3:00 AM UTC (after Companies House sync)
    cron.schedule('0 3 * * *', wrapCronHandler('EmailResolver', '0 3 * * *', async () => {
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
    }), {
      timezone: "UTC"
    });
    
    log('[Email Resolver] Nightly scheduler initialized (runs daily at 3:00 AM UTC)');
    
    // Setup project message reminder checks
    // Runs at :02, :12, :22, :32, :42, :52 to avoid top-of-minute/hour collisions
    cron.schedule('2,12,22,32,42,52 * * * *', wrapCronHandler('ProjectMessageReminders', '2,12,22,32,42,52 * * * *', async () => {
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
    }));
    
    log('[Project Message Reminders] Scheduler initialized (runs every 10 minutes)');
    
    // Setup notification sender cron job
    // Runs every minute to check for and send due notifications
    startNotificationCron();
    
    // Setup signature reminder cron job
    // Runs daily at 9:00 AM UK time to send signature request reminders
    startSignatureReminderCron();
    
    // Setup quick reminder notification cron job
    // Runs every 15 minutes between 07:00-22:00 UK time to send push and email for due reminders
    startReminderNotificationCron();
    
    // Setup query reminder cron job
    // Runs every 5 minutes between 07:00-22:00 UK time to send automated reminders for bookkeeping queries
    startQueryReminderCron();
    
    // Setup campaign sequence progression cron job
    // Runs daily at 06:00 UK time to progress multi-step campaign sequences
    startSequenceCron();
    
    // Setup engagement score cron job
    // Runs weekly at 07:00 UK time on Sundays to process ignored campaigns
    startEngagementCron();
    
    // Setup dashboard cache updates
    // Overnight update: Runs at 03:05 UK time (staggered to avoid :00 collision) - Europe/London timezone
    cron.schedule('5 3 * * *', wrapCronHandler('DashboardCacheOvernight', '5 3 * * *', async () => {
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
    }), {
      timezone: "Europe/London" // UK timezone (handles GMT/BST automatically)
    });
    
    log('[Dashboard Cache] Overnight scheduler initialized (runs daily at 03:05 UK time)');
    
    // Hourly updates during business hours: HH:02 between 08:00-18:00 UK time (staggered from :00)
    // Uses distributed lock to prevent duplicate runs in autoscale
    cron.schedule('2 8-18 * * *', wrapCronHandler('DashboardCacheHourly', '2 8-18 * * *', async () => {
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
    }, { useLock: true, timezone: 'Europe/London' }), {
      timezone: "Europe/London" // UK timezone (handles GMT/BST automatically)
    });
    
    log('[Dashboard Cache] Hourly scheduler initialized (runs at HH:02 between 08:00-18:00 UK time)');
    
    // Setup view cache warming (heavy DB operation - uses distributed lock)
    // Runs at 04:20 UK time to pre-compute project views (well-spaced from other jobs)
    cron.schedule('20 4 * * *', wrapCronHandler('ViewCacheMorning', '20 4 * * *', async () => {
      try {
        log('[View Cache] Starting early morning view cache warming (04:20)...');
        const result = await warmViewCache();
        log(`[View Cache] Warming completed: ${result.status} - ${result.viewsCached}/${result.usersProcessed} views cached in ${result.executionTimeMs}ms`);
        if (result.errors.length > 0) {
          console.error('[View Cache] Warming errors:', result.errors.slice(0, 10));
        }
      } catch (error) {
        console.error('[View Cache] Fatal error in view cache warming:', error);
      }
    }, { useLock: true, timezone: 'Europe/London' }), {
      timezone: "Europe/London"
    });
    
    // 08:45 - spaced 43 minutes after dashboard cache at 08:02, well clear of 08:08 sent items
    cron.schedule('45 8 * * *', wrapCronHandler('ViewCacheMidMorning', '45 8 * * *', async () => {
      try {
        log('[View Cache] Starting morning view cache warming (08:45)...');
        const result = await warmViewCache();
        log(`[View Cache] Warming completed: ${result.status} - ${result.viewsCached}/${result.usersProcessed} views cached in ${result.executionTimeMs}ms`);
        if (result.errors.length > 0) {
          console.error('[View Cache] Warming errors:', result.errors.slice(0, 10));
        }
      } catch (error) {
        console.error('[View Cache] Fatal error in view cache warming:', error);
      }
    }, { useLock: true, timezone: 'Europe/London' }), {
      timezone: "Europe/London"
    });
    
    // 12:25 - spaced well away from hourly dashboard cache at 12:02
    cron.schedule('25 12 * * *', wrapCronHandler('ViewCacheMidday', '25 12 * * *', async () => {
      try {
        log('[View Cache] Starting midday view cache warming (12:25)...');
        const result = await warmViewCache();
        log(`[View Cache] Warming completed: ${result.status} - ${result.viewsCached}/${result.usersProcessed} views cached in ${result.executionTimeMs}ms`);
        if (result.errors.length > 0) {
          console.error('[View Cache] Warming errors:', result.errors.slice(0, 10));
        }
      } catch (error) {
        console.error('[View Cache] Fatal error in view cache warming:', error);
      }
    }, { useLock: true, timezone: 'Europe/London' }), {
      timezone: "Europe/London"
    });
    
    // 15:25 - spaced well away from hourly dashboard cache at 15:02
    cron.schedule('25 15 * * *', wrapCronHandler('ViewCacheAfternoon', '25 15 * * *', async () => {
      try {
        log('[View Cache] Starting afternoon view cache warming (15:25)...');
        const result = await warmViewCache();
        log(`[View Cache] Warming completed: ${result.status} - ${result.viewsCached}/${result.usersProcessed} views cached in ${result.executionTimeMs}ms`);
        if (result.errors.length > 0) {
          console.error('[View Cache] Warming errors:', result.errors.slice(0, 10));
        }
      } catch (error) {
        console.error('[View Cache] Fatal error in view cache warming:', error);
      }
    }, { useLock: true, timezone: 'Europe/London' }), {
      timezone: "Europe/London"
    });
    
    log('[View Cache] Scheduler initialized (runs daily at 04:20, 08:45, 12:25 & 15:25 UK time)');
    
    // Setup activity logs cleanup
    // Runs daily at 4:15 AM UTC (staggered from :00 to avoid collision)
    cron.schedule('15 4 * * *', wrapCronHandler('ActivityCleanup', '15 4 * * *', async () => {
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
    }), {
      timezone: "UTC"
    });
    
    log('[Activity Cleanup] Nightly scheduler initialized (runs daily at 4:15 AM UTC, 90-day retention)');
    
    // Setup sent items reply detection
    // Runs at :08, :18, :28, :38, :48, :58 during business hours (spaced 6 minutes from dashboard cache)
    // Scans Outlook Sent Items folders to detect replies sent directly from Outlook
    const { sentItemsReplyDetectionService } = await import('./services/sentItemsReplyDetectionService');
    cron.schedule('8,18,28,38,48,58 8-19 * * *', wrapCronHandler('SentItemsDetection', '8,18,28,38,48,58 8-19 * * *', async () => {
      try {
        log('[Sent Items Detection] Starting periodic check...');
        const result = await sentItemsReplyDetectionService.runDetection();
        log(`[Sent Items Detection] Check completed: ${result.checked} checked, ${result.matched} matched, ${result.completed} completed, ${result.errors} errors`);
      } catch (error) {
        console.error('[Sent Items Detection] Fatal error in detection job:', error);
      }
    }, { timezone: 'Europe/London' }), {
      timezone: "Europe/London"
    });
    
    log('[Sent Items Detection] Scheduler initialized (runs at :08, :18, :28... 08:00-19:00 UK time)');
    
    // Setup SLA breach detection
    // Runs at :14, :29, :44, :59 during business hours (well-spaced from other jobs)
    // Detects and marks emails that have exceeded their SLA deadline
    cron.schedule('14,29,44,59 8-18 * * *', wrapCronHandler('SLABreachDetection', '14,29,44,59 8-18 * * *', async () => {
      try {
        const { checkForSlaBreaches, markEmailsAsBreached } = await import('./services/slaService');
        const breaches = await checkForSlaBreaches();
        if (breaches.length > 0) {
          const emailIds = breaches.map(b => b.emailId);
          await markEmailsAsBreached(emailIds);
          log(`[SLA Breach Detection] Marked ${breaches.length} email(s) as breached`);
        }
      } catch (error) {
        console.error('[SLA Breach Detection] Fatal error in detection job:', error);
      }
    }, { timezone: 'Europe/London' }), {
      timezone: "Europe/London"
    });
    
    log('[SLA Breach Detection] Scheduler initialized (runs at :14, :29, :44, :59 08:00-18:00 UK time)');
  });
})();
