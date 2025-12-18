/**
 * Cron Worker Process
 * 
 * Dedicated process for running all scheduled cron jobs, separate from the web server.
 * This prevents heavy cron jobs from blocking HTTP requests and vice versa.
 * 
 * Features:
 * - Isolated database connection pool (smaller than web server)
 * - Global CRONS_ENABLED kill-switch for emergency shutdown
 * - All cron telemetry tagged with process_role: "cron-worker"
 * - Independent lifecycle from web server
 */

// Set PROCESS_ROLE env var before any imports that depend on it (like db.ts)
process.env.PROCESS_ROLE = 'cron-worker';

import cron from "node-cron";
import { initEventLoopMonitor, wrapCronHandler, setProcessRole } from "./cron-telemetry";
import { withTimeout, JOB_TIMEOUTS } from "./utils/cronBatching";
import { runChSync } from "./ch-sync-service";
import { executeScheduledRun } from "./scheduling-orchestrator";
import { waitForDatabaseReady } from "./db";
import { sendProjectMessageReminders } from "./projectMessageReminderService";
import { updateDashboardCache } from "./dashboard-cache-service";
import { warmViewCache } from "./view-cache-service";
import { storage } from "./storage/index";
import { startNotificationCron } from "./notification-cron";
import { startSignatureReminderCron } from "./signature-reminder-cron";
import { startReminderNotificationCron } from "./reminder-notification-cron";
import { startQueryReminderCron } from "./query-reminder-cron";
import { startSequenceCron } from "./sequence-cron";
import { startEngagementCron } from "./engagement-cron";
import { startAIWeeklyAnalysisCron } from "./ai-weekly-analysis-cron";

const CRONS_ENABLED = process.env.CRONS_ENABLED !== 'false';

function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [cron-worker] ${message}`);
}

async function main() {
  log('Starting cron worker process...');
  
  // Set process role for telemetry tagging
  setProcessRole('cron-worker');
  
  // Check kill-switch
  if (!CRONS_ENABLED) {
    log('CRONS_ENABLED=false - cron execution disabled. Worker will exit.');
    log('Set CRONS_ENABLED=true (or remove the variable) to enable cron execution.');
    process.exit(0);
  }
  
  // Initialize event loop monitoring
  initEventLoopMonitor();
  log('Event loop monitor initialized');
  
  // Wait for database to be ready
  log('Waiting for database connection...');
  const dbReady = await waitForDatabaseReady({ maxWaitMs: 120000 });
  
  if (!dbReady) {
    log('ERROR: Database not ready after 2 minutes - exiting');
    process.exit(1);
  }
  
  log('Database connection established');
  
  // Schedule all cron jobs
  log('Scheduling cron jobs...');
  
  // === Nightly Operations (UTC) ===
  
  // Scheduling Orchestrator - 01:00 UTC
  cron.schedule('0 1 * * *', wrapCronHandler('SchedulingOrchestrator', '0 1 * * *', async () => {
    log('[Scheduling Orchestrator] Starting scheduled nightly run...');
    const result = await executeScheduledRun();
    log(`[Scheduling Orchestrator] Nightly run ${result.status}: ${result.message}`);
    
    if (result.schedulingResult?.errorsEncountered && result.schedulingResult.errorsEncountered > 0) {
      console.error(`[Scheduling Orchestrator] Nightly run had ${result.schedulingResult.errorsEncountered} errors:`, result.schedulingResult.errors);
    }
  }, { useLock: true }), {
    timezone: "UTC"
  });
  log('[SchedulingOrchestrator] Scheduled (01:00 UTC)');
  
  // Companies House Sync - 02:00 UTC
  cron.schedule('0 2 * * *', wrapCronHandler('CHSync', '0 2 * * *', async () => {
    log('[CH Sync] Starting scheduled nightly sync...');
    const result = await runChSync();
    log(`[CH Sync] Nightly sync completed: ${result.processedClients} clients, ${result.createdRequests} requests, ${result.errors.length} errors`);
    if (result.errors.length > 0) {
      console.error('[CH Sync] Nightly sync errors:', result.errors);
    }
  }, { useLock: true }), {
    timezone: "UTC"
  });
  log('[CHSync] Scheduled (02:00 UTC)');
  
  // Email Resolver - 03:00 UTC
  cron.schedule('0 3 * * *', wrapCronHandler('EmailResolver', '0 3 * * *', async () => {
    log('[Email Resolver] Starting nightly quarantine resolution...');
    const { emailResolverService } = await import('./services/emailResolverService');
    const stats = await emailResolverService.resolveQuarantinedEmails();
    log(`[Email Resolver] Nightly resolution complete: ${stats.matched} matched, ${stats.stillUnmatched} still unmatched, ${stats.errors} errors`);
    
    const cleanedCount = await emailResolverService.cleanupOldQuarantinedEmails(90);
    log(`[Email Resolver] Cleaned up ${cleanedCount} old quarantined emails`);
  }, { useLock: true }), {
    timezone: "UTC"
  });
  log('[EmailResolver] Scheduled (03:00 UTC)');
  
  // Activity Cleanup - 04:15 UTC
  cron.schedule('15 4 * * *', wrapCronHandler('ActivityCleanup', '15 4 * * *', async () => {
    log('[Activity Cleanup] Starting cleanup job...');
    
    const inactiveSessions = await storage.markInactiveSessions();
    log(`[Activity Cleanup] Marked ${inactiveSessions} stale sessions as inactive`);
    
    const deletedSessions = await storage.cleanupOldSessions(90);
    log(`[Activity Cleanup] Deleted ${deletedSessions} sessions older than 90 days`);
    
    const deletedAttempts = await storage.cleanupOldLoginAttempts(90);
    log(`[Activity Cleanup] Deleted ${deletedAttempts} login attempts older than 90 days`);
    
    log('[Activity Cleanup] Cleanup completed successfully');
  }, { useLock: true }), {
    timezone: "UTC"
  });
  log('[ActivityCleanup] Scheduled (04:15 UTC)');
  
  // === Cache Operations (UK Time) ===
  
  // Dashboard Cache Overnight - 03:05 UK
  cron.schedule('5 3 * * *', wrapCronHandler('DashboardCacheOvernight', '5 3 * * *', async () => {
    log('[Dashboard Cache] Starting overnight cache update...');
    const result = await updateDashboardCache();
    log(`[Dashboard Cache] Overnight update completed: ${result.status} - ${result.usersUpdated}/${result.usersProcessed} users updated in ${result.executionTimeMs}ms`);
    if (result.errors.length > 0) {
      console.error('[Dashboard Cache] Overnight update errors:', result.errors);
    }
  }, { useLock: true, timezone: 'Europe/London' }), {
    timezone: "Europe/London"
  });
  log('[DashboardCacheOvernight] Scheduled (03:05 UK)');
  
  // NOTE: DashboardCacheHourly removed - now using on-demand caching with 
  // invalidation hooks on project mutations. Dashboard cache is refreshed:
  // 1. On-demand when cache is stale (15-minute TTL) via /api/dashboard/cache
  // 2. Overnight via DashboardCacheOvernight to prime caches for morning logins
  // 3. On project create/update/status-change via invalidateDashboardCacheForUsers()
  
  // View Cache - Morning 04:20 UK
  cron.schedule('20 4 * * *', wrapCronHandler('ViewCacheMorning', '20 4 * * *', async () => {
    log('[View Cache] Starting early morning view cache warming (04:20)...');
    const result = await warmViewCache();
    log(`[View Cache] Warming completed: ${result.status} - ${result.viewsCached}/${result.usersProcessed} views cached in ${result.executionTimeMs}ms`);
    if (result.errors.length > 0) {
      console.error('[View Cache] Warming errors:', result.errors.slice(0, 10));
    }
  }, { useLock: true, timezone: 'Europe/London' }), {
    timezone: "Europe/London"
  });
  log('[ViewCacheMorning] Scheduled (04:20 UK)');
  
  // View Cache - Mid Morning 08:45 UK
  cron.schedule('45 8 * * *', wrapCronHandler('ViewCacheMidMorning', '45 8 * * *', async () => {
    log('[View Cache] Starting morning view cache warming (08:45)...');
    const result = await warmViewCache();
    log(`[View Cache] Warming completed: ${result.status} - ${result.viewsCached}/${result.usersProcessed} views cached in ${result.executionTimeMs}ms`);
    if (result.errors.length > 0) {
      console.error('[View Cache] Warming errors:', result.errors.slice(0, 10));
    }
  }, { useLock: true, timezone: 'Europe/London' }), {
    timezone: "Europe/London"
  });
  log('[ViewCacheMidMorning] Scheduled (08:45 UK)');
  
  // View Cache - Midday 12:25 UK
  cron.schedule('25 12 * * *', wrapCronHandler('ViewCacheMidday', '25 12 * * *', async () => {
    log('[View Cache] Starting midday view cache warming (12:25)...');
    const result = await warmViewCache();
    log(`[View Cache] Warming completed: ${result.status} - ${result.viewsCached}/${result.usersProcessed} views cached in ${result.executionTimeMs}ms`);
    if (result.errors.length > 0) {
      console.error('[View Cache] Warming errors:', result.errors.slice(0, 10));
    }
  }, { useLock: true, timezone: 'Europe/London' }), {
    timezone: "Europe/London"
  });
  log('[ViewCacheMidday] Scheduled (12:25 UK)');
  
  // View Cache - Afternoon 15:25 UK
  cron.schedule('25 15 * * *', wrapCronHandler('ViewCacheAfternoon', '25 15 * * *', async () => {
    log('[View Cache] Starting afternoon view cache warming (15:25)...');
    const result = await warmViewCache();
    log(`[View Cache] Warming completed: ${result.status} - ${result.viewsCached}/${result.usersProcessed} views cached in ${result.executionTimeMs}ms`);
    if (result.errors.length > 0) {
      console.error('[View Cache] Warming errors:', result.errors.slice(0, 10));
    }
  }, { useLock: true, timezone: 'Europe/London' }), {
    timezone: "Europe/London"
  });
  log('[ViewCacheAfternoon] Scheduled (15:25 UK)');
  
  // === Business Hours Jobs ===
  
  // Project Message Reminders - Hourly at :02 (with timeout protection)
  // OPTIMIZED: Reduced from every 30 min to hourly since job now uses bounded candidates
  // maxRetries: 0 because partial completion is success (progress tracked via last_reminder_sent_at)
  cron.schedule('2 * * * *', wrapCronHandler('ProjectMessageReminders', '2 * * * *', async () => {
    log('[Project Message Reminders] Starting reminder check...');
    const result = await withTimeout(
      () => sendProjectMessageReminders(),
      JOB_TIMEOUTS.NOTIFICATION,
      'ProjectMessageReminders'
    );
    log(`[Project Message Reminders] Check completed: ${result.emailsSent}/${result.usersProcessed} emails sent${result.budgetExceeded ? ' (budget exceeded, will continue next run)' : ''}`);
    if (result.errors.length > 0) {
      console.error('[Project Message Reminders] Errors:', result.errors);
    }
  }, { useLock: true, maxRetries: 0 }));
  log('[ProjectMessageReminders] Scheduled (hourly at :02)');
  
  // Sent Items Detection - Every 15 min during business hours (with timeout protection)
  const { sentItemsReplyDetectionService } = await import('./services/sentItemsReplyDetectionService');
  cron.schedule('8,23,38,53 8-19 * * *', wrapCronHandler('SentItemsDetection', '8,23,38,53 8-19 * * *', async () => {
    log('[Sent Items Detection] Starting periodic check...');
    const result = await withTimeout(
      () => sentItemsReplyDetectionService.runDetection(),
      JOB_TIMEOUTS.DETECTION,
      'SentItemsDetection'
    );
    log(`[Sent Items Detection] Check completed: ${result.checked} checked, ${result.matched} matched, ${result.completed} completed, ${result.errors} errors`);
  }, { useLock: true, timezone: 'Europe/London' }), {
    timezone: "Europe/London"
  });
  log('[SentItemsDetection] Scheduled (:08,:23,:38,:53 08:00-19:00 UK)');
  
  // SLA Breach Detection - Every 15 min during business hours (with timeout protection)
  cron.schedule('14,29,44,59 8-18 * * *', wrapCronHandler('SLABreachDetection', '14,29,44,59 8-18 * * *', async () => {
    await withTimeout(async () => {
      const { checkForSlaBreaches, markEmailsAsBreached } = await import('./services/slaService');
      const breaches = await checkForSlaBreaches();
      if (breaches.length > 0) {
        const emailIds = breaches.map(b => b.emailId);
        await markEmailsAsBreached(emailIds);
        log(`[SLA Breach Detection] Marked ${breaches.length} email(s) as breached`);
      }
    }, JOB_TIMEOUTS.DETECTION, 'SLABreachDetection');
  }, { useLock: true, timezone: 'Europe/London' }), {
    timezone: "Europe/London"
  });
  log('[SLABreachDetection] Scheduled (:14,:29,:44,:59 08:00-18:00 UK)');
  
  // === Module-based crons (these register their own schedules) ===
  startNotificationCron();
  log('[NotificationCron] Started');
  
  startSignatureReminderCron();
  log('[SignatureReminderCron] Started');
  
  startReminderNotificationCron();
  log('[ReminderNotificationCron] Started');
  
  startQueryReminderCron();
  log('[QueryReminderCron] Started');
  
  startSequenceCron();
  log('[SequenceCron] Started');
  
  startEngagementCron();
  log('[EngagementCron] Started');
  
  startAIWeeklyAnalysisCron();
  log('[AIWeeklyAnalysisCron] Started');
  
  log('All cron jobs scheduled successfully');
  log('Cron worker is now running. Press Ctrl+C to stop.');
  
  // Keep the process alive
  process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    log('Received SIGINT, shutting down gracefully...');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[cron-worker] Fatal error during startup:', error);
  process.exit(1);
});
