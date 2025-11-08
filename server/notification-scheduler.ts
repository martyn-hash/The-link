import { db } from "./db";
import {
  projectTypeNotifications,
  clientRequestReminders,
  scheduledNotifications,
  projectTypes,
  services,
  clientServices,
  clients,
  people,
  taskInstances,
  type InsertScheduledNotification,
  type ProjectTypeNotification,
  type ClientRequestReminder,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Notification Scheduler Service
 * 
 * This service handles the creation and management of scheduled notifications
 * based on project type configurations and client service assignments.
 */

interface ScheduleProjectNotificationsParams {
  clientServiceId: string;
  clientId: string;
  projectTypeId: string;
  nextStartDate: Date | null;
  nextDueDate: Date | null;
  relatedPeople?: string[]; // Person IDs who should receive notifications
}

/**
 * Calculate the notification date based on project date and offset configuration
 */
function calculateNotificationDate(
  referenceDate: Date,
  offsetType: "before" | "on" | "after",
  offsetDays: number
): Date {
  const notificationDate = new Date(referenceDate);
  
  switch (offsetType) {
    case "before":
      notificationDate.setDate(notificationDate.getDate() - offsetDays);
      break;
    case "on":
      // No offset needed
      break;
    case "after":
      notificationDate.setDate(notificationDate.getDate() + offsetDays);
      break;
  }
  
  return notificationDate;
}

/**
 * Schedule project notifications for a client service
 * 
 * This creates scheduled notification records based on the project type's
 * notification configuration and the service's start/due dates.
 */
export async function scheduleProjectNotifications(
  params: ScheduleProjectNotificationsParams
): Promise<void> {
  const {
    clientServiceId,
    clientId,
    projectTypeId,
    nextStartDate,
    nextDueDate,
    relatedPeople = [],
  } = params;

  console.log(`[NotificationScheduler] Scheduling notifications for client service ${clientServiceId}`);

  // Fetch all active project notifications for this project type (category = 'project')
  const notifications = await db
    .select()
    .from(projectTypeNotifications)
    .where(
      and(
        eq(projectTypeNotifications.projectTypeId, projectTypeId),
        eq(projectTypeNotifications.category, "project"),
        eq(projectTypeNotifications.isActive, true)
      )
    );

  if (notifications.length === 0) {
    console.log(`[NotificationScheduler] No project notifications configured for project type ${projectTypeId}`);
    return;
  }

  console.log(`[NotificationScheduler] Found ${notifications.length} project notification(s) to schedule`);

  // Create scheduled notifications for each configuration
  const scheduledNotificationsToInsert: InsertScheduledNotification[] = [];

  for (const notification of notifications) {
    // Determine the reference date
    let referenceDate: Date | null = null;
    
    if (notification.dateReference === "start_date" && nextStartDate) {
      referenceDate = nextStartDate;
    } else if (notification.dateReference === "due_date" && nextDueDate) {
      referenceDate = nextDueDate;
    }

    if (!referenceDate) {
      console.log(
        `[NotificationScheduler] Skipping notification ${notification.id} - missing reference date (${notification.dateReference})`
      );
      continue;
    }

    // Calculate when to send the notification
    const scheduledFor = calculateNotificationDate(
      referenceDate,
      notification.offsetType!,
      notification.offsetDays!
    );

    // If the notification is in the past, skip it
    if (scheduledFor < new Date()) {
      console.log(
        `[NotificationScheduler] Skipping notification ${notification.id} - scheduled date ${scheduledFor.toISOString()} is in the past`
      );
      continue;
    }

    // Determine recipients (if relatedPeople specified, create one notification per person, otherwise one for client)
    const recipients = relatedPeople.length > 0 ? relatedPeople : [null];

    for (const personId of recipients) {
      scheduledNotificationsToInsert.push({
        projectTypeNotificationId: notification.id,
        clientRequestReminderId: null,
        clientId,
        personId: personId || null,
        clientServiceId,
        projectId: null, // Will be set when project is created
        taskInstanceId: null,
        notificationType: notification.notificationType,
        scheduledFor,
        emailTitle: notification.emailTitle || null,
        emailBody: notification.emailBody || null,
        smsContent: notification.smsContent || null,
        pushContent: notification.pushContent || null,
        status: "scheduled",
        failureReason: null,
        cancelledBy: null,
        cancelReason: null,
        stopReminders: false,
      });
    }

    console.log(
      `[NotificationScheduler] Scheduled notification ${notification.id} for ${scheduledFor.toISOString()} (${recipients.length} recipient(s))`
    );
  }

  // Delete existing scheduled notifications for this client service that are still scheduled
  // This provides idempotency - re-running won't create duplicates
  await db
    .delete(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.clientServiceId, clientServiceId),
        eq(scheduledNotifications.status, "scheduled")
      )
    );

  // Insert all scheduled notifications
  if (scheduledNotificationsToInsert.length > 0) {
    await db.insert(scheduledNotifications).values(scheduledNotificationsToInsert);
    console.log(`[NotificationScheduler] Created ${scheduledNotificationsToInsert.length} scheduled notification(s)`);
  }
}

interface ScheduleClientRequestRemindersParams {
  taskInstanceId: string;
  clientId: string;
  projectTypeNotificationId: string;
  taskCreatedAt: Date;
  relatedPeople?: string[];
}

/**
 * Schedule client request reminders for a task instance
 * 
 * This creates scheduled notification records for reminders that should be sent
 * after a client request template is created.
 */
export async function scheduleClientRequestReminders(
  params: ScheduleClientRequestRemindersParams
): Promise<void> {
  const {
    taskInstanceId,
    clientId,
    projectTypeNotificationId,
    taskCreatedAt,
    relatedPeople = [],
  } = params;

  console.log(`[NotificationScheduler] Scheduling client request reminders for task ${taskInstanceId}`);

  // Fetch all active reminders for this project type notification
  const reminders = await db
    .select()
    .from(clientRequestReminders)
    .where(
      and(
        eq(clientRequestReminders.projectTypeNotificationId, projectTypeNotificationId),
        eq(clientRequestReminders.isActive, true)
      )
    );

  if (reminders.length === 0) {
    console.log(`[NotificationScheduler] No client request reminders configured for notification ${projectTypeNotificationId}`);
    return;
  }

  console.log(`[NotificationScheduler] Found ${reminders.length} client request reminder(s) to schedule`);

  // Create scheduled notifications for each reminder
  const scheduledNotificationsToInsert: InsertScheduledNotification[] = [];

  for (const reminder of reminders) {
    // Calculate when to send the reminder
    const scheduledFor = new Date(taskCreatedAt);
    scheduledFor.setDate(scheduledFor.getDate() + reminder.daysAfterCreation);

    // If the reminder is in the past, skip it
    if (scheduledFor < new Date()) {
      console.log(
        `[NotificationScheduler] Skipping reminder ${reminder.id} - scheduled date ${scheduledFor.toISOString()} is in the past`
      );
      continue;
    }

    // Determine recipients
    const recipients = relatedPeople.length > 0 ? relatedPeople : [null];

    for (const personId of recipients) {
      scheduledNotificationsToInsert.push({
        projectTypeNotificationId: null,
        clientRequestReminderId: reminder.id,
        clientId,
        personId: personId || null,
        clientServiceId: null,
        projectId: null,
        taskInstanceId,
        notificationType: reminder.notificationType,
        scheduledFor,
        emailTitle: reminder.emailTitle || null,
        emailBody: reminder.emailBody || null,
        smsContent: reminder.smsContent || null,
        pushContent: reminder.pushContent || null,
        status: "scheduled",
        failureReason: null,
        cancelledBy: null,
        cancelReason: null,
        stopReminders: false,
      });
    }

    console.log(
      `[NotificationScheduler] Scheduled reminder ${reminder.id} for ${scheduledFor.toISOString()} (${recipients.length} recipient(s))`
    );
  }

  // Delete existing scheduled reminders for this task instance that are still scheduled
  // This provides idempotency - re-running won't create duplicates
  await db
    .delete(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.taskInstanceId, taskInstanceId),
        eq(scheduledNotifications.status, "scheduled")
      )
    );

  // Insert all scheduled reminders
  if (scheduledNotificationsToInsert.length > 0) {
    await db.insert(scheduledNotifications).values(scheduledNotificationsToInsert);
    console.log(`[NotificationScheduler] Created ${scheduledNotificationsToInsert.length} scheduled reminder(s)`);
  }
}

/**
 * Cancel all scheduled notifications for a client service
 * 
 * This is used when a service is deactivated or removed from a client.
 */
export async function cancelClientServiceNotifications(
  clientServiceId: string,
  cancelledBy: string,
  cancelReason: string
): Promise<void> {
  console.log(`[NotificationScheduler] Cancelling notifications for client service ${clientServiceId}`);

  await db
    .update(scheduledNotifications)
    .set({
      status: "cancelled",
      cancelledBy,
      cancelledAt: new Date(),
      cancelReason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledNotifications.clientServiceId, clientServiceId),
        eq(scheduledNotifications.status, "scheduled")
      )
    );

  console.log(`[NotificationScheduler] Cancelled notifications for client service ${clientServiceId}`);
}

/**
 * Update scheduled notifications when service dates change
 * 
 * This recalculates notification dates when a client service's start/due dates are updated.
 */
export async function updateClientServiceNotificationDates(
  params: ScheduleProjectNotificationsParams,
  cancelledBy: string
): Promise<void> {
  const { clientServiceId } = params;

  console.log(`[NotificationScheduler] Updating notification dates for client service ${clientServiceId}`);

  // Cancel existing scheduled notifications
  await cancelClientServiceNotifications(
    clientServiceId,
    cancelledBy,
    "Service dates updated - notifications rescheduled"
  );

  // Create new scheduled notifications with updated dates
  await scheduleProjectNotifications(params);

  console.log(`[NotificationScheduler] Updated notification dates for client service ${clientServiceId}`);
}

/**
 * Cancel reminders for a task instance
 * 
 * This is used when a client submits a request or staff marks to stop reminders.
 */
export async function cancelTaskInstanceReminders(
  taskInstanceId: string,
  reason: string
): Promise<void> {
  console.log(`[NotificationScheduler] Cancelling reminders for task ${taskInstanceId}: ${reason}`);

  await db
    .update(scheduledNotifications)
    .set({
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: new Date(),
      stopReminders: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledNotifications.taskInstanceId, taskInstanceId),
        eq(scheduledNotifications.status, "scheduled")
      )
    );

  console.log(`[NotificationScheduler] Cancelled reminders for task ${taskInstanceId}`);
}

/**
 * Mark reminders to stop for a task instance
 * 
 * This prevents future reminders from being sent but doesn't cancel already scheduled ones.
 */
export async function stopTaskInstanceReminders(
  taskInstanceId: string,
  stoppedBy: string
): Promise<void> {
  console.log(`[NotificationScheduler] Stopping future reminders for task ${taskInstanceId}`);

  await db
    .update(scheduledNotifications)
    .set({
      stopReminders: true,
      cancelledBy: stoppedBy,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(scheduledNotifications.taskInstanceId, taskInstanceId),
        eq(scheduledNotifications.status, "scheduled")
      )
    );

  console.log(`[NotificationScheduler] Stopped future reminders for task ${taskInstanceId}`);
}
