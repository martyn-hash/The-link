import { db } from "./db";
import { internalTasks, users } from "@shared/schema";
import { eq, and, lte, isNull, isNotNull } from "drizzle-orm";
import { storage } from "./storage";
import { sendPushNotificationToMultiple, type PushNotificationPayload, type PushSubscriptionData } from "./push-service";
import { sendEmail } from "./emailService";
import { BATCH_SIZES } from "./utils/cronBatching";

interface ReminderNotificationResult {
  processed: number;
  pushSent: number;
  emailSent: number;
  errors: string[];
}

export async function processDueReminders(): Promise<ReminderNotificationResult> {
  const now = new Date();
  console.log(`[ReminderNotification] Processing due reminders at ${now.toISOString()}`);

  const result: ReminderNotificationResult = {
    processed: 0,
    pushSent: 0,
    emailSent: 0,
    errors: []
  };

  try {
    const dueReminders = await db
      .select({
        reminder: internalTasks,
        assignee: users
      })
      .from(internalTasks)
      .leftJoin(users, eq(internalTasks.assignedTo, users.id))
      .where(
        and(
          eq(internalTasks.isQuickReminder, true),
          eq(internalTasks.status, 'open'),
          isNotNull(internalTasks.dueDate),
          lte(internalTasks.dueDate, now),
          isNull(internalTasks.reminderNotificationSentAt)
        )
      );

    console.log(`[ReminderNotification] Found ${dueReminders.length} due reminder(s)`);

    // Process with event loop yields to prevent blocking
    for (let i = 0; i < dueReminders.length; i++) {
      const { reminder, assignee } = dueReminders[i];
      result.processed++;
      
      if (!assignee) {
        console.warn(`[ReminderNotification] Reminder ${reminder.id} has no assignee, skipping`);
        continue;
      }

      try {
        const pushSubscriptions = await storage.getPushSubscriptionsByUserId(assignee.id);
        if (pushSubscriptions.length > 0) {
          const payload: PushNotificationPayload = {
            title: '⏰ Reminder Due',
            body: reminder.title,
            url: '/internal-tasks',
            tag: `reminder-${reminder.id}`,
            requireInteraction: true,
            data: {
              type: 'reminder',
              reminderId: reminder.id
            }
          };

          const subscriptionData: PushSubscriptionData[] = pushSubscriptions.map((sub: { endpoint: string; keys: unknown }) => {
            const keys = sub.keys as { p256dh: string; auth: string };
            return {
              endpoint: sub.endpoint,
              keys: {
                p256dh: keys.p256dh,
                auth: keys.auth
              }
            };
          });

          const pushResult = await sendPushNotificationToMultiple(subscriptionData, payload);

          if (pushResult.successful > 0) {
            result.pushSent++;
            console.log(`[ReminderNotification] Push notification sent for reminder ${reminder.id}`);
          }
        } else {
          console.log(`[ReminderNotification] No push subscriptions for user ${assignee.id}`);
        }
      } catch (pushError) {
        console.error(`[ReminderNotification] Push notification error for reminder ${reminder.id}:`, pushError);
        result.errors.push(`Push error for ${reminder.id}: ${pushError instanceof Error ? pushError.message : 'Unknown error'}`);
      }

      try {
        if (assignee.email) {
          const emailSent = await sendReminderDueEmail(
            assignee.email,
            `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || 'Team Member',
            reminder.title,
            reminder.description,
            reminder.dueDate
          );

          if (emailSent) {
            result.emailSent++;
            console.log(`[ReminderNotification] Email sent for reminder ${reminder.id} to ${assignee.email}`);
          }
        }
      } catch (emailError) {
        console.error(`[ReminderNotification] Email error for reminder ${reminder.id}:`, emailError);
        result.errors.push(`Email error for ${reminder.id}: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`);
      }

      try {
        await db
          .update(internalTasks)
          .set({ reminderNotificationSentAt: now })
          .where(eq(internalTasks.id, reminder.id));
      } catch (updateError) {
        console.error(`[ReminderNotification] Failed to mark reminder ${reminder.id} as notified:`, updateError);
      }
      
      // Yield to event loop after each reminder to prevent blocking
      if (i < dueReminders.length - 1) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    console.log(`[ReminderNotification] Completed: ${result.processed} processed, ${result.pushSent} push sent, ${result.emailSent} emails sent`);
    return result;

  } catch (error) {
    console.error('[ReminderNotification] Error processing due reminders:', error);
    result.errors.push(`General error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

async function sendReminderDueEmail(
  recipientEmail: string,
  recipientName: string,
  reminderTitle: string,
  reminderDescription: string | null,
  dueDate: Date | null
): Promise<boolean> {
  const baseUrl = 'https://flow.growth.accountants';
  const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;
  const subject = `Reminder: ${reminderTitle} - The Link`;
  
  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleString('en-GB', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'Now';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 120px; height: auto; margin-bottom: 10px;" />
          <h1 style="color: #1e293b; margin: 0; font-size: 20px;">The Link</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">⏰ Reminder Due</h2>
          <p style="color: #475569; font-size: 16px;">Hello ${recipientName},</p>
          <p style="color: #475569; font-size: 16px;">Your reminder is now due:</p>
          
          <div style="background-color: #fef3c7; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #fcd34d;">
            <h3 style="margin-top: 0; color: #92400e; font-size: 18px;">🔔 ${reminderTitle}</h3>
            ${reminderDescription ? `<p style="margin-bottom: 12px; color: #374151;">${reminderDescription}</p>` : ''}
            <p style="margin-bottom: 0; color: #374151;"><strong>Due:</strong> ${formattedDueDate}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/internal-tasks" 
               style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
              View Reminders
            </a>
          </div>
          
          <p style="color: #475569; font-size: 16px;">Log into The Link to view or complete this reminder.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">
            <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
          </p>
          <p style="margin: 0; font-size: 13px;">
            Your workflow management partner
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hello ${recipientName},

Your reminder is now due:

REMINDER: ${reminderTitle}
${reminderDescription ? `Details: ${reminderDescription}` : ''}
Due: ${formattedDueDate}

Log into The Link to view or complete this reminder.

View Reminders: ${baseUrl}/internal-tasks

Best regards,
The Link Team
  `;

  return await sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
  });
}
