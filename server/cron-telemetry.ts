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
import { db, pool, isRetryableError } from './db';
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

export interface JobRunContext {
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

/**
 * Job metrics for tracking rows processed and batches completed
 */
export interface JobMetrics {
  rowsProcessed: number;
  batchesCompleted: number;
  budgetUsedPct?: number;
}

/**
 * Storage for job metrics keyed by runId
 */
const jobMetricsStore: Map<string, JobMetrics> = new Map();

/**
 * Update job metrics for the current run
 * Call this during job execution to track progress
 */
export function updateJobMetrics(runId: string, metrics: Partial<JobMetrics>): void {
  const existing = jobMetricsStore.get(runId) || { rowsProcessed: 0, batchesCompleted: 0 };
  jobMetricsStore.set(runId, { ...existing, ...metrics });
}

/**
 * Increment rows processed count
 */
export function incrementRowsProcessed(runId: string, count: number = 1): void {
  const existing = jobMetricsStore.get(runId) || { rowsProcessed: 0, batchesCompleted: 0 };
  existing.rowsProcessed += count;
  jobMetricsStore.set(runId, existing);
}

/**
 * Increment batches completed count
 */
export function incrementBatchesCompleted(runId: string, count: number = 1): void {
  const existing = jobMetricsStore.get(runId) || { rowsProcessed: 0, batchesCompleted: 0 };
  existing.batchesCompleted += count;
  jobMetricsStore.set(runId, existing);
}

/**
 * Get job metrics for a run
 */
export function getJobMetrics(runId: string): JobMetrics | undefined {
  return jobMetricsStore.get(runId);
}

/**
 * Clear job metrics for a run (called when job ends)
 */
function clearJobMetrics(runId: string): JobMetrics | undefined {
  const metrics = jobMetricsStore.get(runId);
  jobMetricsStore.delete(runId);
  return metrics;
}

/**
 * Wrap a database operation with timing and log warning if it exceeds threshold
 * @param operationName - Name of the operation for logging
 * @param operation - The async database operation to execute
 * @param warningThresholdMs - Threshold in ms to log warning (default: 5000)
 */
export async function trackDbOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  warningThresholdMs: number = 5000
): Promise<T> {
  const start = Date.now();
  try {
    const result = await operation();
    const elapsed = Date.now() - start;
    
    if (elapsed > warningThresholdMs) {
      console.warn(`[CronTelemetry] SLOW DB OPERATION: ${operationName} took ${elapsed}ms (threshold: ${warningThresholdMs}ms)`);
    }
    
    return result;
  } catch (error) {
    const elapsed = Date.now() - start;
    console.error(`[CronTelemetry] DB OPERATION FAILED: ${operationName} failed after ${elapsed}ms`, error);
    throw error;
  }
}

const activeJobs: Map<string, ActiveJob> = new Map();
let eventLoopMonitor: EventLoopDelayMonitor | null = null;
const REPORT_INTERVAL_MS = 5 * 60 * 1000; // Report event loop stats every 5 minutes

// Process role for telemetry tagging (web vs cron-worker)
let currentProcessRole: 'web' | 'cron-worker' = 'web';
// Instance ID for duplicate runner detection
let cronInstanceId: string | null = null;

/**
 * Set the process role for telemetry tagging
 * Call this early in the process lifecycle to identify whether
 * this is the web server or the cron worker
 */
export function setProcessRole(role: 'web' | 'cron-worker'): void {
  currentProcessRole = role;
  console.log(`[CronTelemetry] Process role set to: ${role}`);
}

/**
 * Get the current process role
 */
export function getProcessRole(): 'web' | 'cron-worker' {
  return currentProcessRole;
}

/**
 * Set the cron instance ID for duplicate runner detection
 * Call this at cron-worker boot to enable instance tracking
 */
export function setCronInstanceId(instanceId: string): void {
  cronInstanceId = instanceId;
  console.log(`[CronTelemetry] Instance ID set to: ${instanceId}`);
}

/**
 * Get the current cron instance ID (null if not set)
 */
export function getCronInstanceId(): string | null {
  return cronInstanceId;
}

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
 * Result of lock acquisition attempt
 */
export interface LockAcquisitionResult {
  acquired: boolean;
  reason: 'ACQUIRED' | 'HELD_BY_OTHER' | 'DB_UNAVAILABLE';
  attempts: number;
  elapsedMs: number;
  error?: string;
}

/**
 * Try to acquire an advisory lock for a job using pg_advisory_try_lock
 * This prevents multiple autoscale instances from running the same job
 * 
 * SAFETY: Uses fail-closed semantics - if DB is unreachable after retries,
 * returns acquired=false to prevent potential duplicate execution.
 * 
 * Retry policy: 3 attempts with exponential backoff (250ms, 500ms, 1s) + jitter
 * Only retries on transient DB connectivity errors, NOT on lock contention.
 */
export async function tryAcquireJobLock(jobName: string): Promise<LockAcquisitionResult> {
  const lockId = hashJobName(jobName);
  const startTime = Date.now();
  const MAX_ATTEMPTS = 3;
  const BASE_DELAY_MS = 250;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Use raw SQL to ensure we get the boolean result correctly
      const result = await db.execute(
        sql`SELECT pg_try_advisory_lock(${lockId})::text as acquired`
      );
      
      // Parse the result - PostgreSQL returns 't' for true, 'f' for false
      const rows = result.rows as Array<{ acquired: string }>;
      const acquired = rows.length > 0 && (rows[0]?.acquired === 't' || rows[0]?.acquired === 'true');
      
      const elapsedMs = Date.now() - startTime;
      
      if (acquired) {
        console.log(`[CronTelemetry] [${jobName}] Advisory lock ${lockId} acquired (attempt ${attempt}, ${elapsedMs}ms)`);
        return { acquired: true, reason: 'ACQUIRED', attempts: attempt, elapsedMs };
      } else {
        // Lock is held by another instance - do NOT retry, this is expected behavior
        console.log(`[CronTelemetry] [${jobName}] LOCK_SKIP reason=HELD_BY_OTHER lockId=${lockId} attempts=${attempt} elapsedMs=${elapsedMs}`);
        return { acquired: false, reason: 'HELD_BY_OTHER', attempts: attempt, elapsedMs };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const elapsedMs = Date.now() - startTime;
      
      // Only retry on transient connectivity errors
      if (!isRetryableError(lastError)) {
        console.error(`[CronTelemetry] [${jobName}] LOCK_SKIP reason=NON_RETRYABLE_ERROR lockId=${lockId} attempts=${attempt} elapsedMs=${elapsedMs} error=${lastError.message}`);
        return { 
          acquired: false, 
          reason: 'DB_UNAVAILABLE', 
          attempts: attempt, 
          elapsedMs, 
          error: lastError.message 
        };
      }
      
      if (attempt < MAX_ATTEMPTS) {
        // Exponential backoff with jitter: 250ms, 500ms, 1s (+ 0-100ms jitter)
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 100;
        console.warn(`[CronTelemetry] [${jobName}] Lock acquisition failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${Math.round(delay)}ms: ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries exhausted - FAIL CLOSED (do not run job)
  const elapsedMs = Date.now() - startTime;
  console.error(`[CronTelemetry] [${jobName}] LOCK_SKIP reason=DB_UNAVAILABLE lockId=${lockId} attempts=${MAX_ATTEMPTS} elapsedMs=${elapsedMs} error=${lastError?.message || 'unknown'}`);
  
  return { 
    acquired: false, 
    reason: 'DB_UNAVAILABLE', 
    attempts: MAX_ATTEMPTS, 
    elapsedMs, 
    error: lastError?.message 
  };
}

/**
 * Release an advisory lock for a job
 * Uses a fresh connection from the pool to avoid stale connection issues
 * that can occur after job timeouts
 */
export async function releaseJobLock(jobName: string): Promise<void> {
  const lockId = hashJobName(jobName);
  
  // Use a fresh connection from the pool to avoid stale connection issues
  // This is critical when releasing locks after timeouts, as the original
  // connection may have been closed/terminated
  let client;
  try {
    client = await pool.connect();
    await client.query(`SELECT pg_advisory_unlock(${lockId})`);
    console.log(`[CronTelemetry] [${jobName}] Advisory lock ${lockId} released`);
  } catch (error) {
    // Log error but don't throw - lock will auto-release when connection closes
    console.error(`[CronTelemetry] [${jobName}] Error releasing lock (will auto-release on connection close):`, error instanceof Error ? error.message : error);
  } finally {
    if (client) {
      try {
        client.release();
      } catch {
        // Ignore release errors
      }
    }
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
  
  // Get and clear job metrics
  const metrics = clearJobMetrics(context.runId);
  
  const currentMemory = getMemoryUsage();
  const heapDelta = currentMemory.heapUsed - context.memoryUsageMB.heapUsed;
  
  // Build metrics string if we have metrics
  const metricsStr = metrics 
    ? ` | rows=${metrics.rowsProcessed} | batches=${metrics.batchesCompleted}${metrics.budgetUsedPct ? ` | budget=${metrics.budgetUsedPct.toFixed(0)}%` : ''}`
    : '';
  
  if (status === 'error') {
    console.log(`[CronTelemetry] [${context.jobName}] [${context.runId}] END (ERROR) | duration=${durationMs}ms${metricsStr} | error=${errorMessage}`);
  } else if (status === 'skipped') {
    console.warn(`[CronTelemetry] [${context.jobName}] [${context.runId}] WARN: END (SKIPPED) | reason=${errorMessage}`);
  } else {
    console.log(`[CronTelemetry] [${context.jobName}] [${context.runId}] END | duration=${durationMs}ms${metricsStr} | heapDelta=${heapDelta > 0 ? '+' : ''}${heapDelta.toFixed(2)}MB`);
  }
}

interface WrapOptions {
  useLock?: boolean;  // Whether to use pg_advisory_lock for distributed coordination
  timezone?: string;  // Timezone for cron expression parsing
  maxRetries?: number; // Maximum retry attempts (default: 2)
  retryDelayMs?: number; // Base delay between retries in ms (default: 1000, uses exponential backoff)
}

interface CronJobTelemetry {
  job_name: string;
  run_id: string;
  instance_id?: string;
  timestamp: string;
  process_role: 'web' | 'cron-worker';
  status: 'started' | 'success' | 'error' | 'skipped' | 'retrying';
  drift_ms: number;
  duration_ms?: number;
  lock_acquired?: boolean;
  lock_wait_ms?: number;
  retry_count?: number;
  error_message?: string;
  rows_processed?: number;
  batches_completed?: number;
  budget_used_pct?: number;
  event_loop: {
    p50_ms: number;
    p95_ms: number;
    max_ms: number;
  };
  memory: {
    heap_used_mb: number;
    heap_total_mb: number;
    rss_mb: number;
  };
  process_uptime_sec: number;
  concurrent_jobs: string[];
}

/**
 * Emit structured JSON telemetry for monitoring systems
 */
function emitTelemetry(telemetry: CronJobTelemetry): void {
  console.log(`[CronTelemetry:JSON] ${JSON.stringify(telemetry)}`);
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a wrapped cron handler with automatic telemetry, error handling, and retries
 * Usage: cron.schedule('0 * * * *', wrapCronHandler('MyJob', '0 * * * *', async () => { ... }))
 * 
 * Options:
 * - useLock: Enable pg_advisory_lock to prevent duplicate runs across autoscale instances
 * - timezone: Timezone for accurate drift calculation (e.g., 'Europe/London')
 * - maxRetries: Maximum retry attempts on failure (default: 2)
 * - retryDelayMs: Base delay between retries with exponential backoff (default: 1000ms)
 * 
 * SAFETY: Handler errors are ALWAYS caught - the wrapper never throws to prevent process crashes
 */
export function wrapCronHandler(
  jobName: string,
  cronExpression: string,
  handler: () => Promise<void>,
  options: WrapOptions = {}
): () => Promise<void> {
  const { 
    useLock = false, 
    timezone,
    maxRetries = 2,
    retryDelayMs = 1000
  } = options;
  
  return async () => {
    const ctx = startCronJob(jobName, cronExpression, timezone);
    const concurrentJobNames = Array.from(activeJobs.values())
      .filter(j => j.runId !== ctx.runId)
      .map(j => j.jobName);
    
    let lockWaitMs = 0;
    let retryCount = 0;
    let lastError: Error | null = null;
    
    // Build base telemetry object
    const baseTelemetry: Omit<CronJobTelemetry, 'status' | 'duration_ms' | 'error_message' | 'retry_count'> = {
      job_name: jobName,
      run_id: ctx.runId,
      instance_id: cronInstanceId || undefined,
      timestamp: ctx.actualStartTime.toISOString(),
      process_role: currentProcessRole,
      drift_ms: ctx.driftMs,
      event_loop: {
        p50_ms: ctx.eventLoopStats.p50Ms,
        p95_ms: ctx.eventLoopStats.p95Ms,
        max_ms: ctx.eventLoopStats.maxMs,
      },
      memory: {
        heap_used_mb: ctx.memoryUsageMB.heapUsed,
        heap_total_mb: ctx.memoryUsageMB.heapTotal,
        rss_mb: ctx.memoryUsageMB.rss,
      },
      process_uptime_sec: ctx.processUptimeSec,
      concurrent_jobs: concurrentJobNames,
    };
    
    // Emit start telemetry
    emitTelemetry({ ...baseTelemetry, status: 'started' });
    
    // If distributed locking is enabled, try to acquire lock first
    if (useLock) {
      const lockResult = await tryAcquireJobLock(jobName);
      lockWaitMs = lockResult.elapsedMs;
      
      if (!lockResult.acquired) {
        // FAIL-CLOSED: Do not run job if lock not acquired (held by other OR DB unavailable)
        const skipReason = lockResult.reason === 'HELD_BY_OTHER' 
          ? 'Lock held by another instance'
          : `DB unavailable after ${lockResult.attempts} attempt(s) (${lockResult.elapsedMs}ms): ${lockResult.error || 'unknown error'}`;
        
        const skipTelemetry: CronJobTelemetry = {
          ...baseTelemetry,
          status: 'skipped',
          lock_acquired: false,
          lock_wait_ms: lockWaitMs,
          duration_ms: Date.now() - ctx.actualStartTime.getTime(),
          error_message: skipReason,
        };
        emitTelemetry(skipTelemetry);
        endCronJob(ctx, 'skipped', skipReason);
        return;
      }
      ctx.lockAcquired = true;
    }
    
    // Execute handler with retry logic
    while (retryCount <= maxRetries) {
      try {
        await handler();
        
        // Success - emit telemetry and exit
        const metrics = getJobMetrics(ctx.runId);
        const successTelemetry: CronJobTelemetry = {
          ...baseTelemetry,
          status: 'success',
          lock_acquired: ctx.lockAcquired,
          lock_wait_ms: useLock ? lockWaitMs : undefined,
          duration_ms: Date.now() - ctx.actualStartTime.getTime(),
          retry_count: retryCount,
          rows_processed: metrics?.rowsProcessed,
          batches_completed: metrics?.batchesCompleted,
          budget_used_pct: metrics?.budgetUsedPct,
        };
        emitTelemetry(successTelemetry);
        endCronJob(ctx, 'success');
        
        // Release lock if we acquired one
        if (ctx.lockAcquired) {
          await releaseJobLock(jobName).catch(e => 
            console.error(`[CronTelemetry] [${jobName}] Failed to release lock:`, e)
          );
        }
        return;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;
        
        if (retryCount <= maxRetries) {
          // Emit retry telemetry
          const retryTelemetry: CronJobTelemetry = {
            ...baseTelemetry,
            status: 'retrying',
            lock_acquired: ctx.lockAcquired,
            lock_wait_ms: useLock ? lockWaitMs : undefined,
            duration_ms: Date.now() - ctx.actualStartTime.getTime(),
            retry_count: retryCount,
            error_message: lastError.message,
          };
          emitTelemetry(retryTelemetry);
          
          console.warn(`[CronTelemetry] [${jobName}] [${ctx.runId}] Retry ${retryCount}/${maxRetries} after error: ${lastError.message}`);
          
          // Exponential backoff: 1s, 2s, 4s...
          const backoffMs = retryDelayMs * Math.pow(2, retryCount - 1);
          await sleep(backoffMs);
        }
      }
    }
    
    // All retries exhausted - emit error telemetry
    const finalMetrics = getJobMetrics(ctx.runId);
    const errorTelemetry: CronJobTelemetry = {
      ...baseTelemetry,
      status: 'error',
      lock_acquired: ctx.lockAcquired,
      lock_wait_ms: useLock ? lockWaitMs : undefined,
      duration_ms: Date.now() - ctx.actualStartTime.getTime(),
      retry_count: retryCount,
      error_message: lastError?.message || 'Unknown error',
      rows_processed: finalMetrics?.rowsProcessed,
      batches_completed: finalMetrics?.batchesCompleted,
      budget_used_pct: finalMetrics?.budgetUsedPct,
    };
    emitTelemetry(errorTelemetry);
    
    console.error(`[CronTelemetry] [${jobName}] [${ctx.runId}] FAILED after ${retryCount} attempts: ${lastError?.message}`);
    endCronJob(ctx, 'error', lastError?.message);
    
    // Release lock if we acquired one
    if (ctx.lockAcquired) {
      await releaseJobLock(jobName).catch(e => 
        console.error(`[CronTelemetry] [${jobName}] Failed to release lock:`, e)
      );
    }
    
    // IMPORTANT: Do NOT rethrow - this prevents process crashes
    // The error is logged and telemetry is emitted, but the cron scheduler continues
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
