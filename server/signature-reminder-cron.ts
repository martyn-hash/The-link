import * as cron from "node-cron";
import { processPendingReminders } from "./signature-reminder-sender";

/**
 * Signature Reminder Cron Service
 * 
 * This service sets up a scheduled job to check for and send signature request reminders.
 */

let cronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Start the signature reminder cron job
 * 
 * This will check for pending signature reminders daily at 9:00 AM UK time.
 */
export function startSignatureReminderCron(): void {
  if (cronJob) {
    console.log("[SignatureReminderCron] Cron job already running");
    return;
  }

  // Run daily at 9:00 AM UK time
  cronJob = cron.schedule("0 9 * * *", async () => {
    try {
      await processPendingReminders();
    } catch (error) {
      console.error("[SignatureReminderCron] Error processing signature reminders:", error);
    }
  }, {
    timezone: "Europe/London"
  });

  console.log("[SignatureReminderCron] Signature reminder cron job started (runs daily at 09:00 UK time)");
}

/**
 * Stop the signature reminder cron job
 */
export function stopSignatureReminderCron(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("[SignatureReminderCron] Signature reminder cron job stopped");
  }
}

/**
 * Manually trigger reminder processing (for testing)
 */
export async function triggerReminderProcessing(): Promise<void> {
  console.log("[SignatureReminderCron] Manually triggering reminder processing");
  await processPendingReminders();
}
