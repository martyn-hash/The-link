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

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  console.error('[Database Pool] Unexpected pool error:', err.message);
});

pool.on('connect', () => {
  console.log('[Database Pool] New connection established');
});

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

function isRetryableError(error: Error): boolean {
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
  ];

  return retryablePatterns.some(pattern => message.includes(pattern));
}
