import { storage } from './storage/index';
import { sendProjectMessageReminderEmail } from './sendgridService';

// Execution budget controls
const MAX_RUNTIME_MS = 8000; // 8 second hard limit
const YIELD_EVERY = 5; // Yield event loop every N users to prevent blocking

/**
 * Helper to yield the event loop - prevents multi-second blocks
 */
function yieldEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

export async function sendProjectMessageReminders(): Promise<{
  emailsSent: number;
  usersProcessed: number;
  errors: string[];
  budgetExceeded?: boolean;
}> {
  const errors: string[] = [];
  let emailsSent = 0;
  let budgetExceeded = false;
  const startTime = Date.now();
  
  try {
    console.log('[Project Message Reminders] Starting reminder check...');
    
    // Get unread summaries for messages older than 10 minutes
    // OPTIMIZED: Now uses bounded candidate selection (max 100) + batch hydration
    const summaries = await storage.getProjectMessageUnreadSummaries(10);
    
    console.log(`[Project Message Reminders] Found ${summaries.length} users with new unread messages older than 10 minutes`);
    
    let usersActuallyProcessed = 0;
    for (let i = 0; i < summaries.length; i++) {
      // Check execution budget
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_RUNTIME_MS) {
        console.log(`[Project Message Reminders] Budget exceeded at ${usersActuallyProcessed}/${summaries.length} users (${elapsed}ms), exiting gracefully`);
        budgetExceeded = true;
        break; // Partial completion is success - next run will continue
      }
      
      // Yield event loop periodically to prevent blocking
      if (i > 0 && i % YIELD_EVERY === 0) {
        await yieldEventLoop();
      }
      
      const summary = summaries[i];
      
      try {
        await sendProjectMessageReminderEmail(summary);
        emailsSent++;
        
        // Mark that we've sent a reminder email for each thread
        // This prevents re-sending reminders for the same unread messages
        for (const thread of summary.threads) {
          try {
            await storage.updateParticipantReminderSent(thread.threadId, summary.userId);
          } catch (updateError) {
            console.error(`[Project Message Reminders] Failed to update reminder timestamp for thread ${thread.threadId}, user ${summary.userId}:`, updateError);
            // Don't fail the whole process if we can't update the timestamp
          }
        }
      } catch (error) {
        const errorMsg = `Failed to send reminder to ${summary.email}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[Project Message Reminders] ${errorMsg}`);
        errors.push(errorMsg);
      }
      
      usersActuallyProcessed++;
    }
    
    const duration = Date.now() - startTime;
    console.log(`[Project Message Reminders] Completed in ${duration}ms: ${emailsSent}/${usersActuallyProcessed} emails sent (${summaries.length} candidates)${budgetExceeded ? ' (budget exceeded)' : ''}`);
    
    return {
      emailsSent,
      usersProcessed: usersActuallyProcessed,
      errors,
      budgetExceeded,
    };
  } catch (error) {
    const errorMsg = `Critical error in reminder service: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[Project Message Reminders] ${errorMsg}`);
    errors.push(errorMsg);
    
    return {
      emailsSent,
      usersProcessed: 0,
      errors,
      budgetExceeded,
    };
  }
}
