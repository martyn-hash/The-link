import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as tables from "@shared/schema/drizzle";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const schemaWithRelations = {
  ...tables,
  ...Object.fromEntries(
    Object.entries(schema).filter(([key, value]) => {
      if (value === null || value === undefined) return false;
      if (key.endsWith('Relations')) return true;
      return false;
    })
  ),
};

// Determine pool size based on process role
// Web server: Higher pool (handles concurrent HTTP requests)
// Cron worker: Smaller pool (sequential job execution)
const PROCESS_ROLE = process.env.PROCESS_ROLE || 'web';
const POOL_SIZE = PROCESS_ROLE === 'cron-worker' ? 8 : 15;

// Pool configuration with isolated sizing per process type
// - Web: 15 connections for concurrent HTTP requests
// - Cron: 8 connections for sequential job processing
// - 60s idle timeout to reduce connection churn during quiet periods
// - 15s connection timeout for slow cold starts (Neon serverless)
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: POOL_SIZE,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 15000,
  allowExitOnIdle: false,
});

console.log(`[Database] Pool initialized for ${PROCESS_ROLE} (max: ${POOL_SIZE} connections)`);

// Track pool metrics for observability
let totalConnectionsCreated = 0;
let lastPoolLogTime = 0;
const POOL_LOG_INTERVAL_MS = 300000; // Log pool stats every 5 minutes max

pool.on('error', (err: Error) => {
  console.error('[Database Pool] Unexpected pool error:', err.message);
});

pool.on('connect', () => {
  totalConnectionsCreated++;
  const now = Date.now();
  // Only log pool stats periodically to reduce log noise
  if (now - lastPoolLogTime > POOL_LOG_INTERVAL_MS) {
    lastPoolLogTime = now;
    console.log(`[Database Pool] Stats: total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount}, created=${totalConnectionsCreated}`);
  }
});

// Export pool metrics for telemetry
export function getPoolMetrics() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    totalCreated: totalConnectionsCreated,
  };
}

export const db = drizzle({ client: pool, schema: schemaWithRelations });

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Database] Connection check failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    operationName = 'database operation'
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      const isRetryable = isRetryableError(lastError);
      
      if (!isRetryable || attempt === maxRetries) {
        console.error(`[Database Retry] ${operationName} failed after ${attempt} attempt(s):`, lastError.message);
        throw lastError;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const jitter = Math.random() * 500;
      
      console.warn(`[Database Retry] ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay + jitter)}ms:`, lastError.message);
      
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
}

export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const retryablePatterns = [
    'connection terminated',
    'connection refused',
    'connection reset',
    'connection timeout',
    'socket hang up',
    'econnreset',
    'econnrefused',
    'etimedout',
    'epipe',
    'network error',
    'websocket',
    'closed',
    'unexpected end',
    'too many connections',
    'connection pool',
    'unable to acquire',
    'timeout exceeded',
  ];

  return retryablePatterns.some(pattern => message.includes(pattern));
}

/**
 * Wait for database to be ready before proceeding with startup operations.
 * Uses exponential backoff with jitter to poll the database.
 * 
 * @param maxWaitMs Maximum time to wait (default 2 minutes)
 * @param baseDelayMs Initial delay between attempts (default 1s)
 * @param maxDelayMs Maximum delay between attempts (default 30s)
 * @returns true if database is ready, false if timed out
 */
export async function waitForDatabaseReady(options: {
  maxWaitMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
} = {}): Promise<boolean> {
  const {
    maxWaitMs = 120000, // 2 minutes max wait
    baseDelayMs = 1000,  // Start with 1s delay
    maxDelayMs = 30000   // Cap at 30s delay
  } = options;

  const startTime = Date.now();
  let attempt = 0;

  console.log('[Database] Waiting for database to be ready...');

  while (Date.now() - startTime < maxWaitMs) {
    attempt++;
    
    try {
      const isReady = await checkDatabaseConnection();
      if (isReady) {
        const elapsedMs = Date.now() - startTime;
        console.log(`[Database] Database ready after ${attempt} attempt(s) (${Math.round(elapsedMs / 1000)}s)`);
        return true;
      }
    } catch (error) {
      // Silently continue - checkDatabaseConnection already logs errors
    }

    // Calculate delay with exponential backoff and jitter
    const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
    const jitter = Math.random() * 1000; // Up to 1s jitter
    const delay = exponentialDelay + jitter;

    const elapsedMs = Date.now() - startTime;
    const remainingMs = maxWaitMs - elapsedMs;

    if (remainingMs <= delay) {
      // Not enough time for another attempt
      break;
    }

    console.log(`[Database] Connection attempt ${attempt} failed, retrying in ${Math.round(delay / 1000)}s (${Math.round(remainingMs / 1000)}s remaining)...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  const totalElapsed = Date.now() - startTime;
  console.error(`[Database] Database not ready after ${attempt} attempt(s) (${Math.round(totalElapsed / 1000)}s) - giving up`);
  return false;
}
