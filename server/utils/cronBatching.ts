/**
 * Cron Batching Utilities
 * 
 * Provides utilities for batching cron job work to prevent blocking the event loop
 * and timeouts for ensuring jobs complete within budget.
 */

/**
 * Process items in batches with event loop yields between batches.
 * Each batch gets its own execution context, allowing other work to proceed.
 * 
 * @param items - Array of items to process
 * @param processor - Async function to process each batch
 * @param batchSize - Number of items per batch (default: 50)
 * @returns Statistics about processing
 */
export async function processBatched<T>(
  items: T[],
  processor: (batch: T[]) => Promise<void>,
  batchSize = 50
): Promise<{ processed: number; batches: number }> {
  let processed = 0;
  let batches = 0;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processor(batch);
    processed += batch.length;
    batches++;
    
    // Yield to event loop between batches to prevent blocking
    await new Promise(resolve => setImmediate(resolve));
  }
  
  return { processed, batches };
}

/**
 * Process items one at a time with event loop yields after each item.
 * Useful for heavy individual operations that shouldn't be batched together.
 * 
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param yieldAfter - Yield to event loop after this many items (default: 1)
 * @returns Statistics about processing
 */
export async function processWithYield<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  yieldAfter = 1
): Promise<{ results: R[]; processed: number }> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const result = await processor(items[i], i);
    results.push(result);
    
    // Yield to event loop periodically
    if ((i + 1) % yieldAfter === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  
  return { results, processed: items.length };
}

/**
 * Wrap an async function with a timeout.
 * Logs warning if job uses >80% of its time budget.
 * Properly clears the timer when the function completes to avoid unhandled rejections.
 * 
 * @param fn - Async function to wrap
 * @param timeoutMs - Maximum execution time in milliseconds
 * @param jobName - Name of the job for logging
 * @returns Result of the function
 * @throws Error if timeout is exceeded
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  jobName: string
): Promise<T> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${jobName} exceeded ${timeoutMs}ms timeout`));
    }, timeoutMs);
    
    // Ensure timer doesn't prevent process exit
    if (timer.unref) {
      timer.unref();
    }
  });
  
  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    
    // Clear timer when function completes successfully
    if (timer) {
      clearTimeout(timer);
    }
    
    const elapsed = Date.now() - start;
    const budgetUsed = (elapsed / timeoutMs) * 100;
    
    if (budgetUsed > 80) {
      console.warn(`[${jobName}] Used ${budgetUsed.toFixed(0)}% of execution budget (${elapsed}ms / ${timeoutMs}ms)`);
    }
    
    return result;
  } catch (error) {
    // Clear timer on error too
    if (timer) {
      clearTimeout(timer);
    }
    throw error;
  }
}

/**
 * Default timeout values for different job categories (in milliseconds)
 */
export const JOB_TIMEOUTS = {
  CACHE_REBUILD: 60_000,      // 60 seconds - Heavy DB operations
  NOTIFICATION: 30_000,        // 30 seconds - External API calls
  SYNC: 60_000,               // 60 seconds - External API dependencies
  CLEANUP: 30_000,            // 30 seconds - Simple DB operations
  DETECTION: 45_000,          // 45 seconds - API calls with processing
} as const;

/**
 * Default batch sizes for different operation types
 */
export const BATCH_SIZES = {
  INBOX_PROCESSING: 5,        // Process 5 inboxes at a time
  REMINDER_PROCESSING: 50,    // Process 50 reminders at a time
  CACHE_UPDATE: 20,           // Update 20 cache entries at a time
  NOTIFICATION_SEND: 10,      // Send 10 notifications at a time
} as const;
