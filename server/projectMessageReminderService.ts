import { storage } from './storage';
import { sendProjectMessageReminderEmail } from './sendgridService';

export async function sendProjectMessageReminders(): Promise<{
  emailsSent: number;
  usersProcessed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let emailsSent = 0;
  
  try {
    console.log('[Project Message Reminders] Starting reminder check...');
    
    // Get unread summaries for messages older than 10 minutes
    // This will only return threads with NEW unread messages since the last reminder
    const summaries = await storage.getProjectMessageUnreadSummaries(10);
    
    console.log(`[Project Message Reminders] Found ${summaries.length} users with new unread messages older than 10 minutes`);
    
    for (const summary of summaries) {
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
    }
    
    console.log(`[Project Message Reminders] Completed: ${emailsSent}/${summaries.length} emails sent`);
    
    return {
      emailsSent,
      usersProcessed: summaries.length,
      errors,
    };
  } catch (error) {
    const errorMsg = `Critical error in reminder service: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[Project Message Reminders] ${errorMsg}`);
    errors.push(errorMsg);
    
    return {
      emailsSent,
      usersProcessed: 0,
      errors,
    };
  }
}
