import * as cron from "node-cron";
import { processDueReminders } from "./reminder-notification-service";
import { wrapCronHandler } from "./cron-telemetry";

let cronJob: ReturnType<typeof cron.schedule> | null = null;

export function startReminderNotificationCron(): void {
  if (cronJob) {
    console.log("[ReminderNotificationCron] Cron job already running");
    return;
  }

  // Run at :04, :19, :34, :49 (staggered from :00/:15/:30/:45)
  cronJob = cron.schedule("4,19,34,49 7-22 * * *", wrapCronHandler('ReminderNotificationCron', '4,19,34,49 7-22 * * *', async () => {
    await processDueReminders();
  }, { useLock: true, timezone: 'Europe/London' }), {
    timezone: "Europe/London"
  });

  console.log("[ReminderNotificationCron] Reminder notification cron job started (runs at :04, :19, :34, :49 07:00-22:00 UK time)");
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
