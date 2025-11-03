import { storage } from "./storage";
import { sendPushNotificationToMultiple, type PushNotificationPayload } from "./push-service";
import type { PushSubscriptionData } from "./push-service";

export interface NotificationContext {
  projectName?: string;
  clientName?: string;
  staffName?: string;
  fromStage?: string;
  toStage?: string;
  dueDate?: string;
  documentName?: string;
  taskTitle?: string;
  message?: string;
  assigneeName?: string;
  [key: string]: string | undefined;
}

/**
 * Render a notification template by replacing placeholders with actual values
 */
export function renderTemplate(template: string, context: NotificationContext): string {
  let rendered = template;
  
  Object.entries(context).forEach(([key, value]) => {
    if (value !== undefined) {
      const placeholder = new RegExp(`\\{${key}\\}`, 'g');
      rendered = rendered.replace(placeholder, value);
    }
  });
  
  return rendered;
}

/**
 * Send a notification using a template
 */
export async function sendTemplateNotification(
  templateType: string,
  userIds: string[],
  context: NotificationContext,
  url?: string
): Promise<{
  successful: number;
  failed: number;
  expiredSubscriptions: string[];
}> {
  // Get the template
  const template = await storage.getPushNotificationTemplateByType(templateType);
  
  if (!template) {
    console.error(`[Notification Template] Template not found: ${templateType}`);
    throw new Error(`Template not found: ${templateType}`);
  }
  
  // Check if template is active
  if (!template.isActive) {
    console.log(`[Notification Template] Template ${templateType} is disabled, skipping notification`);
    return {
      successful: 0,
      failed: 0,
      expiredSubscriptions: []
    };
  }
  
  // Render the template
  const title = renderTemplate(template.titleTemplate, context);
  const body = renderTemplate(template.bodyTemplate, context);
  
  // Create the payload
  const payload: PushNotificationPayload = {
    title,
    body,
    icon: template.iconUrl || "/pwa-icon-192.png",
    badge: template.badgeUrl || undefined,
    url: url || "/",
    tag: templateType
  };
  
  // Get all subscriptions for the users
  let allSubscriptions: any[] = [];
  for (const userId of userIds) {
    const subs = await storage.getPushSubscriptionsByUserId(userId);
    allSubscriptions = allSubscriptions.concat(subs);
  }
  
  if (allSubscriptions.length === 0) {
    console.log(`[Notification Template] No subscriptions found for users:`, userIds);
    return {
      successful: 0,
      failed: 0,
      expiredSubscriptions: []
    };
  }
  
  console.log(`[Notification Template] Sending ${templateType} notification to ${userIds.length} user(s), ${allSubscriptions.length} subscription(s)`);
  
  // Send the notification
  const result = await sendPushNotificationToMultiple(
    allSubscriptions.map(sub => ({
      endpoint: sub.endpoint,
      keys: sub.keys as { p256dh: string; auth: string }
    })),
    payload
  );
  
  // Clean up expired subscriptions
  if (result.expiredSubscriptions.length > 0) {
    for (const endpoint of result.expiredSubscriptions) {
      await storage.deletePushSubscription(endpoint);
    }
  }
  
  console.log(`[Notification Template] Notification sent: ${result.successful} successful, ${result.failed} failed`);
  
  return result;
}

/**
 * Send a notification for a project stage change
 */
export async function sendProjectStageChangeNotification(
  projectId: string,
  projectName: string,
  clientName: string,
  fromStage: string,
  toStage: string,
  assigneeId: string,
  assigneeName: string
): Promise<void> {
  try {
    await sendTemplateNotification(
      'project_stage_change',
      [assigneeId],
      {
        projectName,
        clientName,
        fromStage,
        toStage,
        assigneeName
      },
      `/projects/${projectId}`
    );
  } catch (error) {
    console.error('[Notification Template] Error sending project stage change notification:', error);
    // Don't throw - we don't want to fail the stage change if notification fails
  }
}

/**
 * Send a notification for a new message
 */
export async function sendNewMessageNotification(
  recipientUserIds: string[],
  senderName: string,
  message: string,
  url: string
): Promise<void> {
  try {
    await sendTemplateNotification(
      'new_message',
      recipientUserIds,
      {
        staffName: senderName,
        message: message.substring(0, 100) // Truncate long messages
      },
      url
    );
  } catch (error) {
    console.error('[Notification Template] Error sending new message notification:', error);
  }
}

/**
 * Send a notification for a task assignment
 */
export async function sendTaskAssignedNotification(
  assigneeId: string,
  taskTitle: string,
  assignerName: string,
  dueDate?: string,
  url?: string
): Promise<void> {
  try {
    await sendTemplateNotification(
      'task_assigned',
      [assigneeId],
      {
        taskTitle,
        staffName: assignerName,
        dueDate: dueDate || 'Not set'
      },
      url
    );
  } catch (error) {
    console.error('[Notification Template] Error sending task assigned notification:', error);
  }
}
