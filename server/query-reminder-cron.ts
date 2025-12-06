/**
 * Query Reminder Cron Job
 * 
 * Processes scheduled query reminders every 5 minutes.
 * Checks for due reminders and sends them via the appropriate channel.
 * 
 * Features:
 * - Only runs 07:00-22:00 UK time
 * - Smart cessation when all queries answered
 * - Full audit trail logging
 */

import cron from 'node-cron';
import { getDueReminders, processReminder, checkAndCancelRemindersIfComplete } from './services/queryReminderService';
import { db } from './db';
import { projectChronology } from '@shared/schema';

let isRunning = false;

/**
 * Check if current time is within operating hours (7am-10pm UK time)
 */
function isWithinOperatingHours(): boolean {
  const ukTime = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });
  const hour = parseInt(ukTime.split(',')[1].trim().split(':')[0], 10);
  return hour >= 7 && hour < 22;
}

/**
 * Process all due query reminders
 */
async function processQueryReminders(): Promise<void> {
  if (isRunning) {
    console.log('[QueryReminderCron] Previous run still in progress, skipping');
    return;
  }

  if (!isWithinOperatingHours()) {
    console.log('[QueryReminderCron] Outside operating hours (07:00-22:00 UK), skipping');
    return;
  }

  isRunning = true;

  try {
    const dueReminders = await getDueReminders();
    
    if (dueReminders.length === 0) {
      return;
    }

    console.log(`[QueryReminderCron] Processing ${dueReminders.length} due reminder(s)`);

    for (const reminder of dueReminders) {
      try {
        const wasComplete = await checkAndCancelRemindersIfComplete(reminder.tokenId);
        
        if (wasComplete) {
          console.log(`[QueryReminderCron] Skipped reminder ${reminder.id} - queries already complete`);
          continue;
        }

        const result = await processReminder(reminder);
        
        if (result.success) {
          console.log(`[QueryReminderCron] Sent ${reminder.channel} reminder ${reminder.id}`);
          
          if (reminder.projectId) {
            try {
              await db.insert(projectChronology).values({
                projectId: reminder.projectId,
                entryType: 'communication_added',
                toStatus: 'no_change',
                notes: `Automated ${reminder.channel} reminder sent to ${reminder.recipientName || 'client'} for pending bookkeeping queries`,
                changeReason: 'Query Reminder Sent'
              });
            } catch (chronError) {
              console.error('[QueryReminderCron] Failed to log chronology:', chronError);
            }
          }
        } else {
          console.error(`[QueryReminderCron] Failed to send reminder ${reminder.id}:`, result.error);
        }
      } catch (reminderError) {
        console.error(`[QueryReminderCron] Error processing reminder ${reminder.id}:`, reminderError);
      }
    }
  } catch (error) {
    console.error('[QueryReminderCron] Error in reminder processing:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the query reminder cron job
 * Runs every 5 minutes
 */
export function startQueryReminderCron(): void {
  cron.schedule('*/5 * * * *', async () => {
    await processQueryReminders();
  });

  console.log('[QueryReminderCron] Started - running every 5 minutes during 07:00-22:00 UK time');
}
