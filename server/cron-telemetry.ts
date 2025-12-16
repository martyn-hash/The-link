/**
 * Cron Telemetry Service
 * 
 * Provides instrumentation for cron jobs to diagnose missed executions:
 * - Event loop lag monitoring (using perf_hooks)
 * - Drift logging (expected vs actual execution time)
 * - Job overlap detection with run IDs
 * - Process uptime and memory reporting
 */

import { monitorEventLoopDelay, EventLoopDelayMonitor } from 'perf_hooks';
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
}

interface ActiveJob {
  jobName: string;
  runId: string;
  startTime: Date;
}

const activeJobs: Map<string, ActiveJob> = new Map();
let eventLoopMonitor: EventLoopDelayMonitor | null = null;
let lastReportTime: number = 0;
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
 * For hourly jobs (0 * * * *), returns the top of the current hour
 * For jobs at specific minutes, returns that minute of the current hour
 */
function calculateExpectedTime(cronExpression: string): Date {
  const now = new Date();
  
  // Parse common patterns
  const parts = cronExpression.split(' ');
  const minute = parts[0];
  const hour = parts[1];
  
  const expected = new Date(now);
  expected.setSeconds(0);
  expected.setMilliseconds(0);
  
  if (minute === '0' || minute.startsWith('0')) {
    // Runs at top of hour
    expected.setMinutes(0);
  } else if (minute.match(/^\d+$/)) {
    // Runs at specific minute
    expected.setMinutes(parseInt(minute, 10));
  } else if (minute.startsWith('*/')) {
    // Runs every N minutes - find the closest past interval
    const interval = parseInt(minute.slice(2), 10);
    const currentMinute = now.getMinutes();
    expected.setMinutes(Math.floor(currentMinute / interval) * interval);
  }
  
  return expected;
}

/**
 * Start a cron job run - call at the beginning of every cron handler
 * Returns a context object with telemetry data
 */
export function startCronJob(jobName: string, cronExpression: string): JobRunContext {
  const runId = nanoid(8);
  const actualStartTime = new Date();
  const expectedTime = calculateExpectedTime(cronExpression);
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
  
  // Log drift if significant (> 1 second)
  if (Math.abs(driftMs) > 1000) {
    console.log(`[CronTelemetry] [${jobName}] [${runId}] DRIFT: expected=${expectedTime.toISOString()}, actual=${actualStartTime.toISOString()}, drift=${driftMs}ms`);
  }
  
  // Log comprehensive telemetry at start
  console.log(`[CronTelemetry] [${jobName}] [${runId}] START | drift=${driftMs}ms | uptime=${context.processUptimeSec}s | heap=${context.memoryUsageMB.heapUsed}/${context.memoryUsageMB.heapTotal}MB | rss=${context.memoryUsageMB.rss}MB | eventLoop: p50=${context.eventLoopStats.p50Ms}ms, p95=${context.eventLoopStats.p95Ms}ms, max=${context.eventLoopStats.maxMs}ms`);
  
  return context;
}

/**
 * End a cron job run - call when the job completes
 */
export function endCronJob(context: JobRunContext, status: 'success' | 'error' = 'success', errorMessage?: string): void {
  const endTime = new Date();
  const durationMs = endTime.getTime() - context.actualStartTime.getTime();
  
  // Unregister from active jobs
  activeJobs.delete(context.runId);
  
  const currentMemory = getMemoryUsage();
  const heapDelta = currentMemory.heapUsed - context.memoryUsageMB.heapUsed;
  
  if (status === 'error') {
    console.log(`[CronTelemetry] [${context.jobName}] [${context.runId}] END (ERROR) | duration=${durationMs}ms | error=${errorMessage}`);
  } else {
    console.log(`[CronTelemetry] [${context.jobName}] [${context.runId}] END | duration=${durationMs}ms | heapDelta=${heapDelta > 0 ? '+' : ''}${heapDelta.toFixed(2)}MB`);
  }
}

/**
 * Create a wrapped cron handler with automatic telemetry
 * Usage: cron.schedule('0 * * * *', wrapCronHandler('MyJob', '0 * * * *', async () => { ... }))
 */
export function wrapCronHandler(
  jobName: string,
  cronExpression: string,
  handler: () => Promise<void>
): () => Promise<void> {
  return async () => {
    const ctx = startCronJob(jobName, cronExpression);
    try {
      await handler();
      endCronJob(ctx, 'success');
    } catch (error) {
      endCronJob(ctx, 'error', error instanceof Error ? error.message : String(error));
      throw error;
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
