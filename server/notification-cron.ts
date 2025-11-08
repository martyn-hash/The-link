import * as cron from "node-cron";
import { processDueNotifications } from "./notification-sender";

/**
 * Notification Cron Service
 * 
 * This service sets up a scheduled job to periodically check for and send due notifications.
 */

let cronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Start the notification cron job
 * 
 * This will check for due notifications every minute.
 */
export function startNotificationCron(): void {
  if (cronJob) {
    console.log("[NotificationCron] Cron job already running");
    return;
  }

  // Run every minute
  cronJob = cron.schedule("* * * * *", async () => {
    try {
      await processDueNotifications();
    } catch (error) {
      console.error("[NotificationCron] Error processing due notifications:", error);
    }
  });

  console.log("[NotificationCron] Notification cron job started (runs every minute)");
}

/**
 * Stop the notification cron job
 */
export function stopNotificationCron(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("[NotificationCron] Notification cron job stopped");
  }
}

/**
 * Manually trigger notification processing (for testing)
 */
export async function triggerNotificationProcessing(): Promise<void> {
  console.log("[NotificationCron] Manually triggering notification processing");
  await processDueNotifications();
}
