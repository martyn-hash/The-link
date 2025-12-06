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
import { projectChronology, scheduledQueryReminders } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
 * Check if current day is a weekend (Saturday or Sunday) in UK time
 */
function isWeekendInUK(): boolean {
  const ukDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const dayOfWeek = ukDate.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
}

/**
 * Get the next weekday morning (9am UK time) for rescheduling weekend voice reminders
 */
function getNextWeekdayMorning(): Date {
  const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const dayOfWeek = ukNow.getDay();
  
  let daysToAdd = 1;
  if (dayOfWeek === 6) daysToAdd = 2; // Saturday -> Monday
  if (dayOfWeek === 0) daysToAdd = 1; // Sunday -> Monday
  
  const nextWeekday = new Date(ukNow);
  nextWeekday.setDate(nextWeekday.getDate() + daysToAdd);
  nextWeekday.setHours(9, 0, 0, 0); // 9am
  
  return nextWeekday;
}

/**
 * Reschedule weekend voice reminders to next weekday morning and filter them out
 * Belt-and-braces protection that both reschedules AND filters
 */
async function rescheduleAndFilterWeekendVoiceReminders(reminders: any[]): Promise<any[]> {
  if (!isWeekendInUK()) {
    return reminders;
  }
  
  const voiceReminders = reminders.filter(r => r.channel === 'voice');
  const nonVoiceReminders = reminders.filter(r => r.channel !== 'voice');
  
  if (voiceReminders.length > 0) {
    const nextWeekdayTime = getNextWeekdayMorning();
    
    for (const reminder of voiceReminders) {
      try {
        await db
          .update(scheduledQueryReminders)
          .set({ scheduledAt: nextWeekdayTime })
          .where(eq(scheduledQueryReminders.id, reminder.id));
        console.log(`[QueryReminderCron] Rescheduled voice reminder ${reminder.id} to ${nextWeekdayTime.toISOString()} - weekend restriction`);
      } catch (error) {
        console.error(`[QueryReminderCron] Failed to reschedule voice reminder ${reminder.id}:`, error);
      }
    }
  }
  
  return nonVoiceReminders;
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
    const allDueReminders = await getDueReminders();
    
    if (allDueReminders.length === 0) {
      return;
    }

    const dueReminders = await rescheduleAndFilterWeekendVoiceReminders(allDueReminders);
    
    if (dueReminders.length === 0) {
      console.log(`[QueryReminderCron] ${allDueReminders.length} reminder(s) due but all rescheduled (weekend voice restriction)`);
      return;
    }

    console.log(`[QueryReminderCron] Processing ${dueReminders.length} due reminder(s)${allDueReminders.length > dueReminders.length ? ` (${allDueReminders.length - dueReminders.length} voice rescheduled for weekend)` : ''}`);

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
