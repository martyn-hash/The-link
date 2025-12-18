/**
 * Query Reminder Cron Job
 * 
 * Processes scheduled query reminders every hour with claim-first architecture.
 * 
 * Features:
 * - Bounded: Max 50 reminders per run (FIFO order)
 * - Claim-first: Batch claim before hydration to prevent race conditions
 * - Time budget: 25 second max runtime with early exit
 * - Send timeouts: 8s email/SMS, 10s voice
 * - Only runs 07:00-22:00 UK time
 * - Smart cessation when all queries answered (batch pre-filter)
 * - JSON telemetry output for monitoring
 */

import cron from 'node-cron';
import { 
  getDueReminders, 
  processReminder, 
  markReminderFailed,
  batchClaimReminders,
  batchGetTokenStatuses,
  batchGetProjectNames,
  batchCancelCompletedReminders,
  batchReleaseReminderClaims
} from './services/queryReminderService';
import { db } from './db';
import { projectChronology, scheduledQueryReminders, communications, queryResponseTokens, projects } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { wrapCronHandler } from './cron-telemetry';

// Time budget: 25 seconds max runtime
const MAX_RUNTIME_MS = 25000;
// External send timeouts
const SEND_TIMEOUT_EMAIL_SMS = 8000;
const SEND_TIMEOUT_VOICE = 10000;
// Yield event loop every N reminders
const YIELD_EVERY = 3;

/**
 * Wrap an async operation with a timeout
 */
async function withSendTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Send timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]).catch((error) => {
    console.warn(`[QueryReminderCron] Send timeout: ${error.message}`);
    return fallback;
  });
}

/**
 * Yield to event loop
 */
function yieldEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

async function getProjectName(projectId: string | null): Promise<string | null> {
  if (!projectId) return null;
  try {
    const result = await db.select({ description: projects.description, projectMonth: projects.projectMonth }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!result[0]) return null;
    const month = result[0].projectMonth ? ` (${result[0].projectMonth})` : '';
    return `${result[0].description}${month}`;
  } catch {
    return null;
  }
}

interface CronRunStats {
  runTime: Date;
  withinOperatingHours: boolean;
  totalDue: number;
  voiceRescheduled: number;
  processed: number;
  sent: number;
  cancelled: number;
  failed: number;
}

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
 * Process due query reminders with claim-first architecture and time budget
 * 
 * Flow:
 * 1. Fetch bounded candidates (max 50, FIFO order)
 * 2. Batch claim all candidates immediately
 * 3. Batch pre-hydrate token statuses and project names
 * 4. Pre-filter already-complete tokens, batch cancel them
 * 5. Process remaining with send timeouts and time budget
 */
async function processQueryReminders(): Promise<void> {
  const startTime = Date.now();
  const stats: CronRunStats = {
    runTime: new Date(),
    withinOperatingHours: isWithinOperatingHours(),
    totalDue: 0,
    voiceRescheduled: 0,
    processed: 0,
    sent: 0,
    cancelled: 0,
    failed: 0
  };

  if (isRunning) {
    console.log('[QueryReminderCron] Previous run still in progress, skipping');
    return;
  }

  if (!stats.withinOperatingHours) {
    console.log('[QueryReminderCron] Outside operating hours (07:00-22:00 UK), skipping');
    return;
  }

  isRunning = true;
  let budgetExceeded = false;

  try {
    // PHASE 1: Fetch bounded candidates (max 50, FIFO)
    const allDueReminders = await getDueReminders();
    stats.totalDue = allDueReminders.length;
    
    if (allDueReminders.length === 0) {
      console.log('[QueryReminderCron] No due reminders');
      return;
    }

    // Weekend voice rescheduling (lightweight - just updates scheduledAt)
    const dueReminders = await rescheduleAndFilterWeekendVoiceReminders(allDueReminders);
    stats.voiceRescheduled = allDueReminders.length - dueReminders.length;
    
    if (dueReminders.length === 0) {
      console.log(`[QueryReminderCron] ${allDueReminders.length} reminder(s) due but all rescheduled (weekend voice restriction)`);
      return;
    }

    // PHASE 2: Batch claim all candidates immediately (claim-first pattern)
    const reminderIds = dueReminders.map(r => r.id);
    const claimedIds = await batchClaimReminders(reminderIds);
    const claimedSet = new Set(claimedIds);
    
    // Filter to only claimed reminders
    const claimedReminders = dueReminders.filter(r => claimedSet.has(r.id));
    const skippedCount = dueReminders.length - claimedReminders.length;
    
    if (claimedReminders.length === 0) {
      console.log(`[QueryReminderCron] All ${dueReminders.length} reminders claimed by another instance`);
      return;
    }
    
    if (skippedCount > 0) {
      console.log(`[QueryReminderCron] Skipped ${skippedCount} reminders (claimed by another instance)`);
    }

    // PHASE 3: Batch pre-hydrate token statuses and project names
    const tokenIds = Array.from(new Set(claimedReminders.map(r => r.tokenId)));
    const projectIds = Array.from(new Set(claimedReminders.map(r => r.projectId).filter(Boolean))) as string[];
    
    const [tokenStatusMap, projectNameMap] = await Promise.all([
      batchGetTokenStatuses(tokenIds),
      batchGetProjectNames(projectIds)
    ]);

    // PHASE 4: Pre-filter already-complete tokens, batch cancel
    const completedReminderIds: string[] = [];
    const toProcessReminders: typeof claimedReminders = [];
    
    for (const reminder of claimedReminders) {
      const tokenStatus = tokenStatusMap.get(reminder.tokenId);
      if (tokenStatus?.allAnswered) {
        completedReminderIds.push(reminder.id);
        stats.cancelled++;
      } else {
        toProcessReminders.push(reminder);
      }
    }
    
    if (completedReminderIds.length > 0) {
      await batchCancelCompletedReminders(completedReminderIds);
      console.log(`[QueryReminderCron] Pre-cancelled ${completedReminderIds.length} reminders (queries already complete)`);
    }

    console.log(`[QueryReminderCron] Processing ${toProcessReminders.length} claimed reminders (${stats.cancelled} pre-cancelled)`);

    // PHASE 5: Process remaining with send timeouts and time budget
    for (let i = 0; i < toProcessReminders.length; i++) {
      // Check time budget BEFORE processing
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_RUNTIME_MS) {
        console.log(`[QueryReminderCron] Budget exceeded at ${i}/${toProcessReminders.length} (${elapsed}ms), exiting gracefully`);
        budgetExceeded = true;
        
        // Release claims for unprocessed reminders so they can be picked up next run
        const unprocessedIds = toProcessReminders.slice(i).map(r => r.id);
        if (unprocessedIds.length > 0) {
          await batchReleaseReminderClaims(unprocessedIds);
        }
        break;
      }
      
      // Yield event loop periodically
      if (i > 0 && i % YIELD_EVERY === 0) {
        await yieldEventLoop();
      }

      const reminder = toProcessReminders[i];
      stats.processed++;
      const projectName = projectNameMap.get(reminder.projectId || '') || null;
      
      try {
        // Process reminder with timeout based on channel
        const timeoutMs = reminder.channel === 'voice' ? SEND_TIMEOUT_VOICE : SEND_TIMEOUT_EMAIL_SMS;
        
        const result = await withSendTimeout(
          () => processReminder(reminder),
          timeoutMs,
          { success: false, error: `Send timeout after ${timeoutMs}ms` }
        );
        
        if (result.success) {
          console.log(`[QueryReminderCron] Sent ${reminder.channel} reminder ${reminder.id}`);
          stats.sent++;
          
          // Log chronology (non-blocking, don't fail the reminder for this)
          if (reminder.projectId) {
            logReminderToChronologyAndComms(reminder, projectName).catch(err => {
              console.error('[QueryReminderCron] Failed to log chronology/comms:', err);
            });
          }
        } else {
          // Send failed (including timeout) - mark as failed so it doesn't strand
          console.error(`[QueryReminderCron] Failed to send reminder ${reminder.id}:`, result.error);
          await markReminderFailed(reminder.id, result.error || 'Unknown send failure');
          stats.failed++;
        }
      } catch (reminderError) {
        const errorMessage = reminderError instanceof Error ? reminderError.message : 'Unknown error';
        console.error(`[QueryReminderCron] Error processing reminder ${reminder.id}:`, reminderError);
        
        await markReminderFailed(reminder.id, errorMessage);
        stats.failed++;
      }
    }
  } catch (error) {
    console.error('[QueryReminderCron] Error in reminder processing:', error);
  } finally {
    isRunning = false;
    const duration = Date.now() - startTime;
    
    // Emit lightweight JSON telemetry instead of HTML email
    console.log(`[QueryReminderCron:JSON] ${JSON.stringify({
      runTime: stats.runTime.toISOString(),
      durationMs: duration,
      totalDue: stats.totalDue,
      voiceRescheduled: stats.voiceRescheduled,
      processed: stats.processed,
      sent: stats.sent,
      cancelled: stats.cancelled,
      failed: stats.failed,
      budgetExceeded
    })}`);
  }
}

/**
 * Log reminder to chronology and communications (non-blocking)
 */
async function logReminderToChronologyAndComms(
  reminder: { id: string; channel: string; projectId: string | null; tokenId: string; recipientName: string | null; queriesRemaining?: number | null; queriesTotal?: number | null },
  projectName: string | null
): Promise<void> {
  if (!reminder.projectId) return;
  
  // Chronology entry
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

  // Communications entry
  try {
    const channelTypeMap: Record<string, 'email_sent' | 'sms_sent' | 'phone_call'> = {
      email: 'email_sent',
      sms: 'sms_sent',
      voice: 'phone_call'
    };
    
    const communicationType = channelTypeMap[reminder.channel];
    if (!communicationType) return;
    
    const [tokenData, projectData] = await Promise.all([
      db.select({ createdById: queryResponseTokens.createdById })
        .from(queryResponseTokens)
        .where(eq(queryResponseTokens.id, reminder.tokenId))
        .limit(1),
      db.select({ clientId: projects.clientId })
        .from(projects)
        .where(eq(projects.id, reminder.projectId))
        .limit(1)
    ]);

    if (tokenData[0]?.createdById && projectData[0]?.clientId) {
      const channelLabels: Record<string, string> = { email: 'Email', sms: 'SMS', voice: 'Voice Call' };
      const channelLabel = channelLabels[reminder.channel] || reminder.channel;
      const queryCount = reminder.queriesRemaining || 'pending';
      const queryWord = (reminder.queriesRemaining === 1) ? 'query' : 'queries';
      
      await db.insert(communications).values({
        clientId: projectData[0].clientId,
        projectId: reminder.projectId,
        userId: tokenData[0].createdById,
        type: communicationType,
        subject: `Query Reminder ${channelLabel}`,
        content: `Automated ${channelLabel.toLowerCase()} reminder sent to ${reminder.recipientName || 'client'} for ${queryCount} outstanding bookkeeping ${queryWord}.`,
        actualContactTime: new Date(),
        isRead: true,
        metadata: {
          source: 'query_reminder',
          channel: reminder.channel,
          reminderId: reminder.id,
          tokenId: reminder.tokenId,
          queriesRemaining: reminder.queriesRemaining,
          queriesTotal: reminder.queriesTotal
        }
      });
    }
  } catch (commError) {
    console.error('[QueryReminderCron] Failed to log to communications:', commError);
  }
}

/**
 * Start the query reminder cron job
 * Runs at HH:10 every hour (staggered from :00)
 */
export async function startQueryReminderCron(): Promise<void> {
  // Run at :10 past each hour (staggered from :00)
  cron.schedule('10 * * * *', wrapCronHandler('QueryReminderCron', '10 * * * *', async () => {
    await processQueryReminders();
  }, { useLock: true }));

  console.log('[QueryReminderCron] Started - running at HH:10 hourly during 07:00-22:00 UK time');
}
