import * as cron from "node-cron";
import { processDueNotifications } from "./notification-sender";
import { wrapCronHandler } from "./cron-telemetry";

/**
 * Notification Cron Service
 * 
 * This service sets up a scheduled job to periodically check for and send due notifications.
 */

let cronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Start the notification cron job
 * 
 * This will check for due notifications at HH:08 between 07:00-19:00 UK time (staggered from :00).
 */
export function startNotificationCron(): void {
  if (cronJob) {
    console.log("[NotificationCron] Cron job already running");
    return;
  }

  // Run at :08 past each hour between 07:00-19:00 UK time (staggered from :00)
  cronJob = cron.schedule("8 7-19 * * *", wrapCronHandler('NotificationCron', '8 7-19 * * *', async () => {
    try {
      await processDueNotifications();
    } catch (error) {
      console.error("[NotificationCron] Error processing due notifications:", error);
    }
  }), {
    timezone: "Europe/London"
  });

  console.log("[NotificationCron] Notification cron job started (runs at HH:08 between 07:00-19:00 UK time)");
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
