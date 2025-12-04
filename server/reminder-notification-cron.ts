import * as cron from "node-cron";
import { processDueReminders } from "./reminder-notification-service";

let cronJob: ReturnType<typeof cron.schedule> | null = null;

export function startReminderNotificationCron(): void {
  if (cronJob) {
    console.log("[ReminderNotificationCron] Cron job already running");
    return;
  }

  cronJob = cron.schedule("*/15 7-22 * * *", async () => {
    try {
      await processDueReminders();
    } catch (error) {
      console.error("[ReminderNotificationCron] Error processing due reminders:", error);
    }
  }, {
    timezone: "Europe/London"
  });

  console.log("[ReminderNotificationCron] Reminder notification cron job started (runs every 15 minutes 07:00-22:00 UK time)");
}

export function stopReminderNotificationCron(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("[ReminderNotificationCron] Reminder notification cron job stopped");
  }
}

export async function triggerReminderProcessing(): Promise<void> {
  console.log("[ReminderNotificationCron] Manually triggering reminder processing");
  await processDueReminders();
}
