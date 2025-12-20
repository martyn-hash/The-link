import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setProcessRole } from "./cron-telemetry";
import { runStartupCatchup } from "./scheduling-orchestrator";
import { waitForDatabaseReady } from "./db";
import { storage, initializeDefaultNotificationTemplates } from "./storage/index";
import { seedTaskTypes } from "./seedData";
import { recoverPendingTranscriptions } from "./transcription-service";
import fs from "fs";
import path from "path";
import cookieParser from "cookie-parser";

// Track process startup time for diagnostics
const PROCESS_START_TIME = Date.now();

// Set process role for telemetry (web server, not cron worker)
setProcessRole('web');

// Global uncaught exception/rejection handlers - prevents silent crashes
process.on('uncaughtException', (error) => {
  console.error(`[${new Date().toISOString()}] [FATAL] Uncaught exception:`, error);
  console.error('[FATAL] Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] [FATAL] Unhandled promise rejection:`, reason);
  if (reason instanceof Error) {
    console.error('[FATAL] Stack trace:', reason.stack);
  }
  process.exit(1);
});

// Boot state tracking for debugging
function logBootState(state: string) {
  console.log(`[${new Date().toISOString()}] BOOT_STATE=${state}`);
}

logBootState('starting');

// Log process start
console.log(`[${new Date().toISOString()}] [Web Server] Process starting (PID: ${process.pid})`);
const PORT = Number(process.env.PORT) || 5000;
console.log(`[${new Date().toISOString()}] [Web Server] PORT=${PORT} (env.PORT=${process.env.PORT || 'unset'})`);

const app = express();

// CRITICAL: /healthz endpoint MUST be registered FIRST, before any middleware
// This ensures external health checks succeed even during heavy startup operations
// Track readiness state for /readyz endpoint
let isReady = false;

// Startup timeout - exit if not ready within 60 seconds
const STARTUP_TIMEOUT_MS = 60000;
setTimeout(() => {
  if (!isReady) {
    console.error(`[${new Date().toISOString()}] [FATAL] Startup timeout: app not ready after ${STARTUP_TIMEOUT_MS}ms`);
    process.exit(1);
  }
}, STARTUP_TIMEOUT_MS);

app.get('/healthz', (req, res) => {
  const uptime = Date.now() - PROCESS_START_TIME;
  res.status(200).json({
    status: 'ok',
    uptime_ms: uptime,
    timestamp: new Date().toISOString()
  });
});

// /readyz - Readiness probe: returns 200 only when app is fully initialized
// Use this to gate test execution until the app is ready to serve requests
app.get('/readyz', (req, res) => {
  const uptime = Date.now() - PROCESS_START_TIME;
  if (isReady) {
    res.status(200).json({
      status: 'ready',
      uptime_ms: uptime,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      uptime_ms: uptime,
      timestamp: new Date().toISOString()
    });
  }
});
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
  
  console.log(`[${new Date().toISOString()}] [Web Server] Starting to listen on 0.0.0.0:${port}...`);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    // CRITICAL: The server is now accepting connections - log immediately
    const startupTime = Date.now() - PROCESS_START_TIME;
    logBootState('web_listening');
    console.log(`READY host=0.0.0.0 port=${port} envPORT=${process.env.PORT || 'unset'} pid=${process.pid}`);
    console.log(`[${new Date().toISOString()}] [Web Server] READY - Listening on 0.0.0.0:${port} (startup: ${startupTime}ms)`);
    log(`serving on port ${port}`);
    log('[Web Server] Cron jobs are handled by the separate cron-worker process');
    
    // IMPORTANT: Defer all heavy async operations to next tick
    // This ensures the server can immediately respond to health checks
    // while background initialization continues
    setImmediate(async () => {
      logBootState('initialising_background');
      log('[Web Server] Running deferred startup tasks...');
      
      try {
        // Seed initial task types
        await seedTaskTypes();
        log('[Web Server] Task types seeded');
      } catch (seedError) {
        console.error('[Web Server] Error seeding task types (non-fatal):', seedError);
      }
      
      try {
        // Initialize default notification templates
        await initializeDefaultNotificationTemplates();
        log('[Web Server] Notification templates initialized');
      } catch (templateError) {
        console.error('[Web Server] Error initializing notification templates (non-fatal):', templateError);
      }
      
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
        log('[Web Server] Pending transcriptions recovered');
      } catch (transcriptionError) {
        console.error('[Transcription] Error recovering pending transcriptions (non-fatal):', transcriptionError);
      }
      
      // Mark app as fully ready for /readyz endpoint
      isReady = true;
      logBootState('ready');
      log('[Web Server] All startup tasks completed - app is now READY');
    });
  });
})();
