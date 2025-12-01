/**
 * Scheduling Orchestrator Service
 * 
 * This service provides robust scheduling that:
 * 1. Detects missed scheduling runs on server startup
 * 2. Prevents duplicate runs for the same target date using database locks
 * 3. Provides catch-up logic for multi-day missed jobs (up to 7 days back)
 * 4. Maintains a complete audit trail of all scheduling operations
 * 5. Prevents concurrent execution via database locking
 */

import { storage } from "./storage/index";
import { runProjectScheduling, type SchedulingRunResult } from "./project-scheduler";
import { sendSchedulingSummaryEmail } from "./emailService";
import { db } from "./db";
import { schedulingRunLogs } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";

type TriggerSource = 'scheduled' | 'startup_catchup' | 'manual';

interface OrchestrationResult {
  status: 'executed' | 'skipped_already_ran' | 'skipped_too_early' | 'skipped_locked' | 'error';
  targetDate: string;
  triggerSource: TriggerSource;
  schedulingResult?: SchedulingRunResult;
  message: string;
  existingRunId?: string;
}

interface CatchupResult {
  datesChecked: string[];
  runsExecuted: OrchestrationResult[];
  message: string;
}

const MAX_CATCHUP_DAYS = 7;
const MAX_CATCHUP_ITERATIONS = 10;

let runningLock = false;

/**
 * Get the date string in YYYY-MM-DD format for a given Date object
 */
function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get the expected scheduling time for a given date (01:00 UTC)
 */
function getExpectedSchedulingTime(date: Date): Date {
  const scheduledTime = new Date(date);
  scheduledTime.setUTCHours(1, 0, 0, 0);
  return scheduledTime;
}

/**
 * Check if a scheduling run already exists for a given target date
 * A run is considered successful if status is 'success' or 'partial_failure'
 */
async function hasSuccessfulRunForDate(targetDate: string): Promise<{ exists: boolean; runId?: string }> {
  try {
    const recentLogs = await storage.getSchedulingRunLogs(100);
    
    for (const log of recentLogs) {
      const logDate = getDateString(log.runDate);
      if (logDate === targetDate) {
        if (log.status === 'success' || log.status === 'partial_failure') {
          console.log(`[Orchestrator] Found existing successful run for ${targetDate}: ${log.id} (status: ${log.status})`);
          return { exists: true, runId: log.id };
        }
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error(`[Orchestrator] Error checking for existing run on ${targetDate}:`, error);
    return { exists: false };
  }
}

/**
 * Try to acquire a lock for a specific date using database insert
 * Uses INSERT ... ON CONFLICT to ensure atomicity
 * Returns the lock ID if acquired, null if lock already exists
 */
async function tryAcquireLock(targetDate: Date, triggerSource: TriggerSource): Promise<string | null> {
  try {
    const targetDateString = getDateString(targetDate);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const existingLock = await db
      .select()
      .from(schedulingRunLogs)
      .where(
        and(
          eq(schedulingRunLogs.status, 'in_progress'),
          gte(schedulingRunLogs.createdAt, oneHourAgo)
        )
      )
      .limit(1);
    
    if (existingLock.length > 0) {
      console.log(`[Orchestrator] Lock already held by run ${existingLock[0].id}`);
      return null;
    }
    
    const existingRunToday = await db
      .select()
      .from(schedulingRunLogs)
      .where(
        sql`DATE(${schedulingRunLogs.runDate}) = ${targetDateString} AND ${schedulingRunLogs.status} IN ('success', 'partial_failure', 'in_progress')`
      )
      .limit(1);
    
    if (existingRunToday.length > 0) {
      console.log(`[Orchestrator] Run already exists or in progress for ${targetDateString}: ${existingRunToday[0].id} (status: ${existingRunToday[0].status})`);
      return null;
    }
    
    const [log] = await db
      .insert(schedulingRunLogs)
      .values({
        runDate: targetDate,
        runType: triggerSource === 'startup_catchup' ? 'catchup' : triggerSource,
        status: 'in_progress',
        totalServicesChecked: 0,
        servicesFoundDue: 0,
        projectsCreated: 0,
        servicesRescheduled: 0,
        errorsEncountered: 0,
        chServicesSkipped: 0,
        summary: 'Run in progress...'
      })
      .returning();
    
    console.log(`[Orchestrator] Acquired lock ${log.id} for ${targetDateString}`);
    return log.id;
  } catch (error) {
    console.error('[Orchestrator] Error acquiring lock:', error);
    return null;
  }
}

/**
 * Update the lock entry with final results
 */
async function updateLockWithResults(
  lockId: string,
  schedulingResult: SchedulingRunResult
): Promise<void> {
  try {
    await db
      .update(schedulingRunLogs)
      .set({
        status: schedulingResult.status,
        totalServicesChecked: schedulingResult.totalServicesChecked,
        servicesFoundDue: schedulingResult.servicesFoundDue,
        projectsCreated: schedulingResult.projectsCreated,
        servicesRescheduled: schedulingResult.servicesRescheduled,
        errorsEncountered: schedulingResult.errorsEncountered,
        chServicesSkipped: schedulingResult.chServicesProcessedWithoutRescheduling,
        executionTimeMs: schedulingResult.executionTimeMs,
        errorDetails: schedulingResult.errors.length > 0 ? schedulingResult.errors : null,
        summary: schedulingResult.summary
      })
      .where(eq(schedulingRunLogs.id, lockId));
  } catch (error) {
    console.error('[Orchestrator] Error updating lock with results:', error);
  }
}

/**
 * Mark a lock entry as failed
 */
async function markLockAsFailed(lockId: string, errorMessage: string): Promise<void> {
  try {
    await db
      .update(schedulingRunLogs)
      .set({
        status: 'failure',
        summary: errorMessage
      })
      .where(eq(schedulingRunLogs.id, lockId));
  } catch (error) {
    console.error('[Orchestrator] Error marking lock as failed:', error);
  }
}

/**
 * Execute scheduling for a specific target date with idempotency protection and locking
 * IMPORTANT: targetDate is passed to runProjectScheduling so it evaluates due services for that specific day
 */
export async function ensureRunForDate(
  targetDate: Date,
  triggerSource: TriggerSource
): Promise<OrchestrationResult> {
  const targetDateString = getDateString(targetDate);
  const now = new Date();
  
  console.log(`[Orchestrator] Checking if scheduling run needed for ${targetDateString} (trigger: ${triggerSource})`);
  
  const result: OrchestrationResult = {
    status: 'error',
    targetDate: targetDateString,
    triggerSource,
    message: ''
  };

  try {
    const existingRun = await hasSuccessfulRunForDate(targetDateString);
    
    if (existingRun.exists) {
      result.status = 'skipped_already_ran';
      result.existingRunId = existingRun.runId;
      result.message = `Scheduling already completed for ${targetDateString} (run: ${existingRun.runId})`;
      console.log(`[Orchestrator] ${result.message}`);
      return result;
    }
    
    if (triggerSource === 'scheduled') {
      const expectedTime = getExpectedSchedulingTime(targetDate);
      const timeDiff = now.getTime() - expectedTime.getTime();
      
      if (timeDiff < -60000) {
        result.status = 'skipped_too_early';
        result.message = `Too early to run scheduling for ${targetDateString} (expected at 01:00 UTC)`;
        console.log(`[Orchestrator] ${result.message}`);
        return result;
      }
    }
    
    if (runningLock) {
      result.status = 'skipped_locked';
      result.message = `Another scheduling run is already in progress (in-memory lock)`;
      console.log(`[Orchestrator] ${result.message}`);
      return result;
    }
    
    runningLock = true;
    let lockId: string | null = null;
    
    try {
      lockId = await tryAcquireLock(targetDate, triggerSource);
      if (!lockId) {
        result.status = 'skipped_locked';
        result.message = `Could not acquire database lock for ${targetDateString} - another run may be in progress or already completed`;
        console.log(`[Orchestrator] ${result.message}`);
        return result;
      }
      
      console.log(`[Orchestrator] Acquired lock ${lockId}, executing scheduling for ${targetDateString}...`);
      
      const schedulingResult = await runProjectScheduling(
        triggerSource === 'manual' ? 'manual' : 'scheduled',
        targetDate
      );
      
      await updateLockWithResults(lockId, schedulingResult);
      
      result.schedulingResult = schedulingResult;
      result.status = 'executed';
      result.message = `Successfully ran scheduling for ${targetDateString}: ${schedulingResult.projectsCreated} projects created, ${schedulingResult.servicesRescheduled} services rescheduled`;
      
      console.log(`[Orchestrator] ${result.message}`);
      
      await sendSchedulingEmails(schedulingResult, triggerSource);
      
      return result;
      
    } catch (error) {
      if (lockId) {
        await markLockAsFailed(lockId, error instanceof Error ? error.message : 'Unknown error');
      }
      throw error;
    } finally {
      runningLock = false;
    }
    
  } catch (error) {
    result.status = 'error';
    result.message = `Error running scheduling for ${targetDateString}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`[Orchestrator] ${result.message}`);
    return result;
  }
}

/**
 * Send scheduling summary emails
 */
async function sendSchedulingEmails(schedulingResult: SchedulingRunResult, triggerSource: TriggerSource): Promise<void> {
  try {
    console.log(`[Orchestrator] Sending notification emails (trigger: ${triggerSource})...`);
    const usersWithNotifications = await storage.getUsersWithSchedulingNotifications();
    
    if (usersWithNotifications.length === 0) {
      console.log('[Orchestrator] No users have enabled scheduling summary notifications');
      return;
    }
    
    const emailPromises = usersWithNotifications.map(async (user) => {
      const userDisplayName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.firstName || user.email || 'User';
      
      const enhancedSummary = triggerSource === 'startup_catchup'
        ? `[Catch-up Run] ${schedulingResult.summary}`
        : schedulingResult.summary;
      
      return sendSchedulingSummaryEmail(user.email!, userDisplayName, {
        status: schedulingResult.status,
        servicesFoundDue: schedulingResult.servicesFoundDue,
        projectsCreated: schedulingResult.projectsCreated,
        servicesRescheduled: schedulingResult.servicesRescheduled,
        errorsEncountered: schedulingResult.errorsEncountered,
        executionTimeMs: schedulingResult.executionTimeMs,
        summary: enhancedSummary,
        errors: schedulingResult.errors
      });
    });
    
    const emailResults = await Promise.allSettled(emailPromises);
    const successfulEmails = emailResults.filter(result => result.status === 'fulfilled' && result.value).length;
    const failedEmails = emailResults.filter(result => result.status === 'rejected' || !result.value).length;
    
    console.log(`[Orchestrator] Email notifications sent: ${successfulEmails} successful, ${failedEmails} failed`);
  } catch (emailError) {
    console.error('[Orchestrator] Error sending notification emails:', emailError);
  }
}

/**
 * Find the date of the last successful scheduling run
 */
async function findLastSuccessfulRunDate(): Promise<Date | null> {
  try {
    const recentLogs = await storage.getSchedulingRunLogs(100);
    
    for (const log of recentLogs) {
      if (log.status === 'success' || log.status === 'partial_failure') {
        return new Date(log.runDate);
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Orchestrator] Error finding last successful run:', error);
    return null;
  }
}

/**
 * Run startup catch-up to detect and execute any missed scheduling runs
 * 
 * Logic:
 * 1. Find the last successful run date
 * 2. Start checking from the day after the last success
 * 3. But limit total iterations to MAX_CATCHUP_ITERATIONS to prevent runaway loops
 * 4. Also apply MAX_CATCHUP_DAYS as a hard limit from today
 * 5. Execute catch-up runs in chronological order
 */
export async function runStartupCatchup(): Promise<CatchupResult> {
  const now = new Date();
  const result: CatchupResult = {
    datesChecked: [],
    runsExecuted: [],
    message: ''
  };
  
  console.log('[Orchestrator] Starting startup catch-up check...');
  
  try {
    const todayExpectedTime = getExpectedSchedulingTime(now);
    
    const lastSuccessfulRun = await findLastSuccessfulRunDate();
    
    const maxLookbackDate = new Date(now);
    maxLookbackDate.setDate(maxLookbackDate.getDate() - MAX_CATCHUP_DAYS);
    maxLookbackDate.setUTCHours(0, 0, 0, 0);
    
    let startCheckDate: Date;
    
    if (lastSuccessfulRun) {
      const dayAfterLastRun = new Date(lastSuccessfulRun);
      dayAfterLastRun.setDate(dayAfterLastRun.getDate() + 1);
      dayAfterLastRun.setUTCHours(0, 0, 0, 0);
      
      startCheckDate = dayAfterLastRun;
      
      if (startCheckDate < maxLookbackDate) {
        console.log(`[Orchestrator] Last successful run was on ${getDateString(lastSuccessfulRun)}, but limiting to ${MAX_CATCHUP_DAYS} days back`);
        startCheckDate = maxLookbackDate;
      } else {
        console.log(`[Orchestrator] Last successful run was on ${getDateString(lastSuccessfulRun)}, checking from ${getDateString(startCheckDate)}`);
      }
    } else {
      startCheckDate = maxLookbackDate;
      console.log(`[Orchestrator] No recent successful runs found, checking last ${MAX_CATCHUP_DAYS} days from ${getDateString(startCheckDate)}`);
    }
    
    const missedDates: Date[] = [];
    const checkDate = new Date(startCheckDate);
    let iterations = 0;
    
    while (checkDate <= now && iterations < MAX_CATCHUP_ITERATIONS) {
      iterations++;
      const dateString = getDateString(checkDate);
      result.datesChecked.push(dateString);
      
      const expectedTime = getExpectedSchedulingTime(checkDate);
      if (now < expectedTime) {
        console.log(`[Orchestrator] ${dateString}: Scheduling time hasn't passed yet`);
        checkDate.setDate(checkDate.getDate() + 1);
        continue;
      }
      
      const existingRun = await hasSuccessfulRunForDate(dateString);
      if (!existingRun.exists) {
        console.log(`[Orchestrator] ${dateString}: Run was missed, adding to catch-up queue`);
        missedDates.push(new Date(checkDate));
      } else {
        console.log(`[Orchestrator] ${dateString}: Already completed`);
      }
      
      checkDate.setDate(checkDate.getDate() + 1);
    }
    
    if (iterations >= MAX_CATCHUP_ITERATIONS) {
      console.log(`[Orchestrator] Reached maximum catch-up iterations (${MAX_CATCHUP_ITERATIONS}), stopping scan`);
    }
    
    if (missedDates.length === 0) {
      result.message = `Startup catch-up complete: No missed runs detected. Checked ${result.datesChecked.length} date(s).`;
      console.log(`[Orchestrator] ${result.message}`);
      return result;
    }
    
    console.log(`[Orchestrator] Found ${missedDates.length} missed run(s), executing catch-up in chronological order...`);
    
    for (const missedDate of missedDates) {
      const dateString = getDateString(missedDate);
      console.log(`[Orchestrator] Executing catch-up for ${dateString}...`);
      
      const catchupResult = await ensureRunForDate(missedDate, 'startup_catchup');
      result.runsExecuted.push(catchupResult);
      
      if (catchupResult.status === 'error') {
        console.error(`[Orchestrator] Catch-up failed for ${dateString}: ${catchupResult.message}`);
      }
    }
    
    const executedDates = result.runsExecuted
      .filter(r => r.status === 'executed')
      .map(r => r.targetDate);
    const projectsCreated = result.runsExecuted
      .filter(r => r.schedulingResult)
      .reduce((sum, r) => sum + (r.schedulingResult?.projectsCreated || 0), 0);
    const failedDates = result.runsExecuted
      .filter(r => r.status === 'error')
      .map(r => r.targetDate);
    
    if (failedDates.length > 0) {
      result.message = `Startup catch-up complete with errors: Executed ${executedDates.length} run(s), failed ${failedDates.length} run(s). Created ${projectsCreated} project(s). Failed dates: ${failedDates.join(', ')}`;
    } else {
      result.message = `Startup catch-up complete: Executed ${executedDates.length} missed run(s) for ${executedDates.join(', ')}. Created ${projectsCreated} project(s).`;
    }
    
    console.log(`[Orchestrator] ${result.message}`);
    return result;
    
  } catch (error) {
    result.message = `Startup catch-up failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`[Orchestrator] ${result.message}`);
    return result;
  }
}

/**
 * Execute scheduling via the orchestrator (for use in cron job)
 * This wraps the scheduling run with proper tracking and duplicate prevention
 */
export async function executeScheduledRun(): Promise<OrchestrationResult> {
  const now = new Date();
  console.log('[Orchestrator] Starting scheduled run...');
  return ensureRunForDate(now, 'scheduled');
}

/**
 * Get scheduling run status for admin dashboard
 */
export async function getSchedulingStatus(): Promise<{
  lastSuccessfulRun: {
    date: string;
    projectsCreated: number;
    servicesRescheduled: number;
    status: string;
  } | null;
  todayRunCompleted: boolean;
  yesterdayRunCompleted: boolean;
  recentRuns: Array<{
    id: string;
    date: string;
    status: string;
    projectsCreated: number;
    runType: string;
  }>;
}> {
  const now = new Date();
  const todayString = getDateString(now);
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = getDateString(yesterday);
  
  try {
    const recentLogs = await storage.getSchedulingRunLogs(10);
    
    const successfulLogs = recentLogs.filter(log => 
      log.status === 'success' || log.status === 'partial_failure'
    );
    
    const lastSuccessful = successfulLogs[0];
    
    const todayRun = await hasSuccessfulRunForDate(todayString);
    const yesterdayRun = await hasSuccessfulRunForDate(yesterdayString);
    
    return {
      lastSuccessfulRun: lastSuccessful ? {
        date: getDateString(lastSuccessful.runDate),
        projectsCreated: lastSuccessful.projectsCreated,
        servicesRescheduled: lastSuccessful.servicesRescheduled,
        status: lastSuccessful.status
      } : null,
      todayRunCompleted: todayRun.exists,
      yesterdayRunCompleted: yesterdayRun.exists,
      recentRuns: recentLogs.map(log => ({
        id: log.id,
        date: getDateString(log.runDate),
        status: log.status,
        projectsCreated: log.projectsCreated,
        runType: log.runType
      }))
    };
  } catch (error) {
    console.error('[Orchestrator] Error getting scheduling status:', error);
    return {
      lastSuccessfulRun: null,
      todayRunCompleted: false,
      yesterdayRunCompleted: false,
      recentRuns: []
    };
  }
}
