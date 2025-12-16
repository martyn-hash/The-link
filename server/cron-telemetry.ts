/**
 * Cron Telemetry Service
 * 
 * Provides instrumentation for cron jobs to diagnose missed executions:
 * - Event loop lag monitoring (using perf_hooks)
 * - Drift logging (expected vs actual execution time using cron-parser)
 * - Job overlap detection with run IDs
 * - Process uptime and memory reporting
 * - Distributed job locking via pg_advisory_lock (optional)
 */

import { monitorEventLoopDelay } from 'perf_hooks';
import { CronExpressionParser, CronExpression } from 'cron-parser';
import { db } from './db';
import { sql } from 'drizzle-orm';
type EventLoopDelayMonitor = ReturnType<typeof monitorEventLoopDelay>;
import { nanoid } from 'nanoid';

interface EventLoopStats {
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

interface JobRunContext {
  jobName: string;
  runId: string;
  expectedTime: Date;
  actualStartTime: Date;
  driftMs: number;
  eventLoopStats: EventLoopStats;
  processUptimeSec: number;
  memoryUsageMB: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  lockAcquired?: boolean;
}

interface ActiveJob {
  jobName: string;
  runId: string;
  startTime: Date;
}

const activeJobs: Map<string, ActiveJob> = new Map();
let eventLoopMonitor: EventLoopDelayMonitor | null = null;
const REPORT_INTERVAL_MS = 5 * 60 * 1000; // Report event loop stats every 5 minutes

/**
 * Initialize the event loop delay monitor
 */
export function initEventLoopMonitor(): void {
  if (eventLoopMonitor) {
    return;
  }
  
  try {
    eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
    eventLoopMonitor.enable();
    console.log('[CronTelemetry] Event loop monitor initialized (resolution: 20ms)');
    
    // Schedule periodic reporting
    setInterval(() => {
      reportEventLoopStats();
    }, REPORT_INTERVAL_MS);
  } catch (error) {
    console.error('[CronTelemetry] Failed to initialize event loop monitor:', error);
  }
}

/**
 * Get current event loop delay statistics
 */
function getEventLoopStats(): EventLoopStats {
  if (!eventLoopMonitor) {
    return {
      minMs: 0,
      maxMs: 0,
      meanMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
    };
  }
  
  const nsToMs = (ns: number) => Number((ns / 1e6).toFixed(2));
  
  return {
    minMs: nsToMs(eventLoopMonitor.min),
    maxMs: nsToMs(eventLoopMonitor.max),
    meanMs: nsToMs(eventLoopMonitor.mean),
    p50Ms: nsToMs(eventLoopMonitor.percentile(50)),
    p95Ms: nsToMs(eventLoopMonitor.percentile(95)),
    p99Ms: nsToMs(eventLoopMonitor.percentile(99)),
  };
}

/**
 * Report event loop stats periodically
 */
function reportEventLoopStats(): void {
  const stats = getEventLoopStats();
  console.log(`[CronTelemetry] Event loop delay: min=${stats.minMs}ms, p50=${stats.p50Ms}ms, p95=${stats.p95Ms}ms, max=${stats.maxMs}ms`);
  
  // Reset the histogram after reporting to get fresh stats
  if (eventLoopMonitor) {
    eventLoopMonitor.reset();
  }
}

/**
 * Get current memory usage in MB
 */
function getMemoryUsage() {
  const usage = process.memoryUsage();
  const toMB = (bytes: number) => Number((bytes / 1024 / 1024).toFixed(2));
  
  return {
    heapUsed: toMB(usage.heapUsed),
    heapTotal: toMB(usage.heapTotal),
    rss: toMB(usage.rss),
    external: toMB(usage.external),
  };
}

/**
 * Calculate the expected execution time based on cron expression
 * 
 * Strategy: Find the most recent scheduled tick that is ≤ the actual start time.
 * This correctly surfaces drift even when a job starts several minutes late.
 * 
 * We parse from 1 second after actual start and call prev() to get the
 * most recent scheduled time before (or at) the actual start.
 */
function calculateExpectedTime(cronExpression: string, timezone?: string, actualStartTime?: Date): Date {
  try {
    const now = actualStartTime || new Date();
    
    // Parse starting from 1 second after "now" so that prev() includes
    // a tick that matches exactly the current minute
    const slightlyAfterNow = new Date(now.getTime() + 1000);
    
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: slightlyAfterNow,
      tz: timezone,
    });
    
    // Get the previous scheduled time (the one that should have triggered this run)
    const prevTick = interval.prev().toDate();
    
    return prevTick;
  } catch (error) {
    // Fallback: return current time truncated to the minute
    const fallback = new Date();
    fallback.setSeconds(0);
    fallback.setMilliseconds(0);
    console.warn(`[CronTelemetry] Failed to parse cron expression "${cronExpression}": ${error}`);
    return fallback;
  }
}

/**
 * MurmurHash3-like hash for consistent lock IDs
 * Produces a stable 32-bit integer for pg_advisory_lock
 */
function hashJobName(jobName: string): number {
  // Use a simple but stable hashing algorithm
  // Start with a base offset to avoid collisions with other lock users
  const CRON_LOCK_NAMESPACE = 0x4352_4F4E; // "CRON" in hex
  
  let hash = CRON_LOCK_NAMESPACE;
  for (let i = 0; i < jobName.length; i++) {
    const char = jobName.charCodeAt(i);
    hash = Math.imul(hash ^ char, 0x5bd1_e995);
    hash ^= hash >>> 15;
  }
  
  // Ensure positive 31-bit integer (pg_advisory_lock uses bigint, but we want safe range)
  return (hash >>> 0) & 0x7FFF_FFFF;
}

/**
 * Try to acquire an advisory lock for a job using pg_advisory_try_lock
 * This prevents multiple autoscale instances from running the same job
 * Returns true if lock acquired, false if another instance holds it
 */
export async function tryAcquireJobLock(jobName: string): Promise<boolean> {
  try {
    const lockId = hashJobName(jobName);
    
    // Use raw SQL to ensure we get the boolean result correctly
    const result = await db.execute(
      sql`SELECT pg_try_advisory_lock(${lockId})::text as acquired`
    );
    
    // Parse the result - PostgreSQL returns 't' for true, 'f' for false
    const rows = result.rows as Array<{ acquired: string }>;
    const acquired = rows.length > 0 && (rows[0]?.acquired === 't' || rows[0]?.acquired === 'true');
    
    if (acquired) {
      console.log(`[CronTelemetry] [${jobName}] Advisory lock ${lockId} acquired`);
    } else {
      console.log(`[CronTelemetry] [${jobName}] Lock ${lockId} not acquired - another instance is running this job`);
    }
    
    return acquired;
  } catch (error) {
    console.error(`[CronTelemetry] [${jobName}] Error acquiring lock:`, error);
    // On error, allow the job to run (fail-open for single-instance case)
    // This ensures the job runs in development/single-instance scenarios
    return true;
  }
}

/**
 * Release an advisory lock for a job
 */
export async function releaseJobLock(jobName: string): Promise<void> {
  try {
    const lockId = hashJobName(jobName);
    await db.execute(sql`SELECT pg_advisory_unlock(${lockId})`);
    console.log(`[CronTelemetry] [${jobName}] Advisory lock ${lockId} released`);
  } catch (error) {
    console.error(`[CronTelemetry] [${jobName}] Error releasing lock:`, error);
  }
}

/**
 * Start a cron job run - call at the beginning of every cron handler
 * Returns a context object with telemetry data
 */
export function startCronJob(jobName: string, cronExpression: string, timezone?: string): JobRunContext {
  const runId = nanoid(8);
  const actualStartTime = new Date();
  const expectedTime = calculateExpectedTime(cronExpression, timezone, actualStartTime);
  const driftMs = actualStartTime.getTime() - expectedTime.getTime();
  
  const context: JobRunContext = {
    jobName,
    runId,
    expectedTime,
    actualStartTime,
    driftMs,
    eventLoopStats: getEventLoopStats(),
    processUptimeSec: Math.round(process.uptime()),
    memoryUsageMB: getMemoryUsage(),
  };
  
  // Log concurrent job detection
  const concurrentJobs = Array.from(activeJobs.values());
  if (concurrentJobs.length > 0) {
    console.log(`[CronTelemetry] [${jobName}] [${runId}] JOB OVERLAP DETECTED - ${concurrentJobs.length} other job(s) running: ${concurrentJobs.map(j => `${j.jobName}(${j.runId})`).join(', ')}`);
  }
  
  // Register this job as active
  activeJobs.set(runId, {
    jobName,
    runId,
    startTime: actualStartTime,
  });
  
  // Log drift if significant (> 5 seconds - reasonable threshold for cron precision)
  if (Math.abs(driftMs) > 5000) {
    console.log(`[CronTelemetry] [${jobName}] [${runId}] DRIFT WARNING: expected=${expectedTime.toISOString()}, actual=${actualStartTime.toISOString()}, drift=${driftMs}ms`);
  }
  
  // Log comprehensive telemetry at start
  console.log(`[CronTelemetry] [${jobName}] [${runId}] START | drift=${driftMs}ms | uptime=${context.processUptimeSec}s | heap=${context.memoryUsageMB.heapUsed}/${context.memoryUsageMB.heapTotal}MB | rss=${context.memoryUsageMB.rss}MB | eventLoop: p50=${context.eventLoopStats.p50Ms}ms, p95=${context.eventLoopStats.p95Ms}ms, max=${context.eventLoopStats.maxMs}ms`);
  
  return context;
}

/**
 * End a cron job run - call when the job completes
 */
export function endCronJob(context: JobRunContext, status: 'success' | 'error' | 'skipped' = 'success', errorMessage?: string): void {
  const endTime = new Date();
  const durationMs = endTime.getTime() - context.actualStartTime.getTime();
  
  // Unregister from active jobs
  activeJobs.delete(context.runId);
  
  const currentMemory = getMemoryUsage();
  const heapDelta = currentMemory.heapUsed - context.memoryUsageMB.heapUsed;
  
  if (status === 'error') {
    console.log(`[CronTelemetry] [${context.jobName}] [${context.runId}] END (ERROR) | duration=${durationMs}ms | error=${errorMessage}`);
  } else if (status === 'skipped') {
    console.log(`[CronTelemetry] [${context.jobName}] [${context.runId}] END (SKIPPED) | reason=${errorMessage}`);
  } else {
    console.log(`[CronTelemetry] [${context.jobName}] [${context.runId}] END | duration=${durationMs}ms | heapDelta=${heapDelta > 0 ? '+' : ''}${heapDelta.toFixed(2)}MB`);
  }
}

interface WrapOptions {
  useLock?: boolean;  // Whether to use pg_advisory_lock for distributed coordination
  timezone?: string;  // Timezone for cron expression parsing
}

/**
 * Create a wrapped cron handler with automatic telemetry
 * Usage: cron.schedule('0 * * * *', wrapCronHandler('MyJob', '0 * * * *', async () => { ... }))
 * 
 * Options:
 * - useLock: Enable pg_advisory_lock to prevent duplicate runs across autoscale instances
 * - timezone: Timezone for accurate drift calculation (e.g., 'Europe/London')
 */
export function wrapCronHandler(
  jobName: string,
  cronExpression: string,
  handler: () => Promise<void>,
  options: WrapOptions = {}
): () => Promise<void> {
  const { useLock = false, timezone } = options;
  
  return async () => {
    const ctx = startCronJob(jobName, cronExpression, timezone);
    
    // If distributed locking is enabled, try to acquire lock first
    if (useLock) {
      const acquired = await tryAcquireJobLock(jobName);
      if (!acquired) {
        endCronJob(ctx, 'skipped', 'Lock held by another instance');
        return;
      }
      ctx.lockAcquired = true;
    }
    
    try {
      await handler();
      endCronJob(ctx, 'success');
    } catch (error) {
      endCronJob(ctx, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      // Release lock if we acquired one
      if (ctx.lockAcquired) {
        await releaseJobLock(jobName);
      }
    }
  };
}

/**
 * Get list of currently active jobs (for monitoring)
 */
export function getActiveJobs(): ActiveJob[] {
  return Array.from(activeJobs.values());
}

/**
 * Get current telemetry snapshot (for API endpoints)
 */
export function getTelemetrySnapshot() {
  return {
    timestamp: new Date().toISOString(),
    processUptime: Math.round(process.uptime()),
    memory: getMemoryUsage(),
    eventLoop: getEventLoopStats(),
    activeJobs: getActiveJobs(),
  };
}
