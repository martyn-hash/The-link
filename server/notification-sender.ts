import { db } from "./db";
import {
  scheduledNotifications,
  notificationHistory,
  clients,
  people,
  clientPortalUsers,
  companySettings,
  projects,
  projectTypes,
  clientServices,
  services,
  users,
  type ScheduledNotification,
  type InsertNotificationHistory,
} from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { getUncachableSendGridClient } from "./sendgridService";
import { sendPushNotification, type PushSubscriptionData } from "./push-service";
import { 
  processNotificationVariables, 
  type NotificationVariableContext 
} from "./notification-variables";

/**
 * Notification Sender Service
 * 
 * This service handles the actual sending of notifications via email, SMS, and push.
 */

interface SendNotificationResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

interface ValidationResult {
  isValid: boolean;
  failureReason?: string;
  channelData?: {
    email?: string;
    phone?: string;
    pushSubscriptions?: PushSubscriptionData[];
  };
}

/**
 * Validate email address format and existence
 */
function validateEmail(email: string | null): { isValid: boolean; reason?: string } {
  if (!email) {
    return { isValid: false, reason: "No email address found for recipient" };
  }

  // Basic email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, reason: "Invalid email address format" };
  }

  return { isValid: true };
}

/**
 * Validate SMS phone number (E.164 format)
 * Must start with + followed by 1-15 digits
 */
function validateE164Phone(phone: string | null): { isValid: boolean; reason?: string } {
  if (!phone) {
    return { isValid: false, reason: "No phone number found for recipient" };
  }

  // E.164 format: + followed by country code and number (1-15 digits total)
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (!e164Regex.test(phone)) {
    return { 
      isValid: false, 
      reason: "Invalid phone number format (must be E.164: +country code + number, e.g., +447441392660)" 
    };
  }

  return { isValid: true };
}

/**
 * Get push subscriptions for a client
 * Extracted for reuse in validation and sending
 */
async function getPushSubscriptionsForClient(clientId: string): Promise<PushSubscriptionData[]> {
  const portalUsers = await db
    .select({
      userId: clientPortalUsers.id,
      subscriptions: sql<any>`
        SELECT json_agg(json_build_object('endpoint', endpoint, 'keys', keys))
        FROM push_subscriptions
        WHERE client_portal_user_id = ${clientPortalUsers.id}
      `.as('subscriptions'),
    })
    .from(clientPortalUsers)
    .where(eq(clientPortalUsers.clientId, clientId));

  const allSubscriptions: PushSubscriptionData[] = [];
  for (const user of portalUsers) {
    if (user.subscriptions && Array.isArray(user.subscriptions)) {
      allSubscriptions.push(...user.subscriptions.filter(Boolean));
    }
  }

  return allSubscriptions;
}

/**
 * Pre-validate notification before sending to external APIs
 * This saves money by not making API calls for invalid recipients
 */
async function preValidateNotification(
  notification: ScheduledNotification,
  recipientInfo: { email: string | null; phone: string | null }
): Promise<ValidationResult> {
  const { email, phone } = recipientInfo;

  switch (notification.notificationType) {
    case "email": {
      // Validate email address
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        return {
          isValid: false,
          failureReason: emailValidation.reason,
        };
      }

      // Check that email content exists
      if (!notification.emailTitle || !notification.emailBody) {
        return {
          isValid: false,
          failureReason: "Missing email title or body",
        };
      }

      return {
        isValid: true,
        channelData: { email: email! },
      };
    }

    case "sms": {
      // Validate phone number (E.164 format)
      const phoneValidation = validateE164Phone(phone);
      if (!phoneValidation.isValid) {
        return {
          isValid: false,
          failureReason: phoneValidation.reason,
        };
      }

      // Check that SMS content exists
      if (!notification.smsContent) {
        return {
          isValid: false,
          failureReason: "Missing SMS content",
        };
      }

      return {
        isValid: true,
        channelData: { phone: phone! },
      };
    }

    case "push": {
      // Check that push content exists
      if (!notification.pushTitle || !notification.pushBody) {
        return {
          isValid: false,
          failureReason: "Missing push title or body",
        };
      }

      // Check for push subscriptions
      const pushSubscriptions = await getPushSubscriptionsForClient(notification.clientId);
      if (pushSubscriptions.length === 0) {
        return {
          isValid: false,
          failureReason: "No push subscriptions found for client",
        };
      }

      return {
        isValid: true,
        channelData: { pushSubscriptions },
      };
    }

    default:
      return {
        isValid: false,
        failureReason: `Unknown notification type: ${notification.notificationType}`,
      };
  }
}

/**
 * Send an email notification via SendGrid
 */
async function sendEmailNotification(
  recipientEmail: string,
  title: string,
  body: string,
  senderName?: string
): Promise<SendNotificationResult> {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const msg = {
      to: recipientEmail,
      from: {
        email: fromEmail,
        name: senderName || "The Link Team",
      },
      subject: title,
      html: body,
    };

    const response = await client.send(msg);
    const messageId = response[0]?.headers?.["x-message-id"] as string;

    console.log(`[NotificationSender] Email sent to ${recipientEmail}: ${title}`);

    return {
      success: true,
      externalId: messageId,
    };
  } catch (error: any) {
    console.error(`[NotificationSender] Failed to send email to ${recipientEmail}:`, error);
    return {
      success: false,
      error: error.message || "Unknown error sending email",
    };
  }
}

/**
 * Format phone number to E.164 international format for VoodooSMS API
 */
function formatPhoneForVoodooSMS(phone: string): string {
  // Clean the phone number - remove all non-digits
  const cleanPhone = phone.replace(/[^\d]/g, '');

  // Check if it's a UK mobile number (starts with 07 and has 11 digits)
  if (cleanPhone.startsWith('07') && cleanPhone.length === 11) {
    // Convert UK mobile (07xxxxxxxx) to international format (+447xxxxxxx)
    return `+447${cleanPhone.slice(2)}`;
  } else if (cleanPhone.startsWith('447') && cleanPhone.length === 12) {
    // Already in UK international format without +, just add the +
    return `+${cleanPhone}`;
  } else if (phone.startsWith('+447') && cleanPhone.length === 12) {
    // Already in correct international format
    return phone;
  } else {
    // For other formats, try to use as-is but ensure it starts with +
    return phone.startsWith('+') ? phone : `+${cleanPhone}`;
  }
}

/**
 * Send an SMS notification via VoodooSMS
 */
async function sendSMSNotification(
  recipientPhone: string,
  content: string
): Promise<SendNotificationResult> {
  try {
    const apiKey = process.env.VOODOO_SMS_API_KEY;
    
    if (!apiKey) {
      console.error('[NotificationSender] VOODOO_SMS_API_KEY not configured');
      return {
        success: false,
        error: 'SMS service not configured - missing API key',
      };
    }

    // Format phone number for VoodooSMS API
    const formattedPhone = formatPhoneForVoodooSMS(recipientPhone);

    // Prepare SMS data for VoodooSMS API
    const smsData = {
      to: formattedPhone,
      from: "GrowthAcc",
      msg: content,
      external_reference: `notification-${Date.now()}`
    };

    console.log(`[NotificationSender] Sending SMS via VoodooSMS to ${formattedPhone}`);

    // Send SMS via VoodooSMS API
    const response = await fetch('https://api.voodoosms.com/sendsms', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(smsData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NotificationSender] VoodooSMS API error:', response.status, errorText);
      return {
        success: false,
        error: `VoodooSMS API error: ${response.status}`,
      };
    }

    const smsResponse = await response.json() as { message_id?: string; status?: string };

    console.log(`[NotificationSender] SMS sent successfully to ${formattedPhone}:`, smsResponse);

    return {
      success: true,
      externalId: smsResponse.message_id || `sms-${Date.now()}`,
    };
  } catch (error: any) {
    console.error(`[NotificationSender] Failed to send SMS to ${recipientPhone}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error sending SMS',
    };
  }
}

/**
 * Send a push notification
 * Now uses pre-fetched subscriptions to avoid duplicate queries
 */
async function sendPushNotificationViaService(
  clientId: string,
  personId: string | null,
  title: string,
  body: string,
  subscriptions?: PushSubscriptionData[]
): Promise<SendNotificationResult> {
  try {
    // Use provided subscriptions or fetch them if not provided (backward compatibility)
    const allSubscriptions = subscriptions || await getPushSubscriptionsForClient(clientId);

    if (allSubscriptions.length === 0) {
      console.log(`[NotificationSender] No push subscriptions found for client ${clientId}`);
      return {
        success: false,
        error: "No push subscriptions found",
      };
    }

    // Send push notification to all subscriptions
    const payload = {
      title,
      body,
      data: {
        type: "client_notification",
        clientId,
        personId: personId || undefined,
      },
    };

    let successCount = 0;
    for (const subscription of allSubscriptions) {
      try {
        await sendPushNotification(subscription, payload);
        successCount++;
      } catch (error) {
        console.error(`[NotificationSender] Failed to send to subscription:`, error);
      }
    }

    console.log(
      `[NotificationSender] Push notification sent to ${successCount}/${allSubscriptions.length} subscriptions for client ${clientId}`
    );

    return {
      success: successCount > 0,
      externalId: `push-${clientId}-${Date.now()}`,
      error: successCount === 0 ? "Failed to send to any subscriptions" : undefined,
    };
  } catch (error: any) {
    console.error(`[NotificationSender] Failed to send push notification to client ${clientId}:`, error);
    return {
      success: false,
      error: error.message || "Unknown error sending push notification",
    };
  }
}

/**
 * Get recipient contact information for a scheduled notification
 */
async function getRecipientInfo(notification: ScheduledNotification): Promise<{
  email: string | null;
  phone: string | null;
}> {
  let email: string | null = null;
  let phone: string | null = null;

  // If personId is specified, get their contact info
  if (notification.personId) {
    const [person] = await db
      .select({
        email: people.primaryEmail,
        phone: people.primaryPhone,
        receiveNotifications: people.receiveNotifications,
      })
      .from(people)
      .where(eq(people.id, notification.personId))
      .limit(1);

    // Check if person has opted out of notifications
    if (person && person.receiveNotifications === false) {
      console.log(`[NotificationSender] Person ${notification.personId} has opted out of notifications - skipping`);
      return { email: null, phone: null };
    }

    if (person) {
      email = person.email;
      phone = person.phone;
    }
  }

  // If no person or person has no contact info, try client
  if (!email && !phone) {
    const [client] = await db
      .select({
        email: clients.email,
      })
      .from(clients)
      .where(eq(clients.id, notification.clientId))
      .limit(1);

    if (client) {
      email = client.email;
    }
  }

  return { email, phone };
}

/**
 * Build notification variable context by fetching all required data
 * Uses parallel queries for efficiency
 */
async function buildNotificationVariableContext(
  notification: ScheduledNotification,
  firmSettings: typeof companySettings.$inferSelect | null
): Promise<NotificationVariableContext> {
  // Fetch all required data in parallel
  const [clientData, personData, projectData, serviceData] = await Promise.all([
    // Always fetch client data
    db
      .select({
        id: clients.id,
        name: clients.name,
        email: clients.email,
        clientType: clients.clientType,
        financialYearEnd: clients.nextAccountsPeriodEnd,
      })
      .from(clients)
      .where(eq(clients.id, notification.clientId))
      .limit(1),
    
    // Fetch person data if personId exists
    notification.personId
      ? db
          .select({
            id: people.id,
            fullName: people.fullName,
            email: people.primaryEmail,
          })
          .from(people)
          .where(eq(people.id, notification.personId))
          .limit(1)
      : Promise.resolve([]),
    
    // Fetch project data with staff if projectId exists
    notification.projectId
      ? db
          .select({
            id: projects.id,
            description: projects.description,
            projectTypeName: projectTypes.name,
            currentStatus: projects.currentStatus,
            dueDate: projects.dueDate,
            projectOwnerId: projects.projectOwnerId,
            currentAssigneeId: projects.currentAssigneeId,
          })
          .from(projects)
          .leftJoin(projectTypes, eq(projects.projectTypeId, projectTypes.id))
          .where(eq(projects.id, notification.projectId))
          .limit(1)
      : Promise.resolve([]),
    
    // Fetch service data if clientServiceId exists
    notification.clientServiceId
      ? db
          .select({
            name: services.name,
            description: services.description,
            frequency: clientServices.frequency,
            nextStartDate: clientServices.nextStartDate,
            nextDueDate: clientServices.nextDueDate,
          })
          .from(clientServices)
          .leftJoin(services, eq(clientServices.serviceId, services.id))
          .where(eq(clientServices.id, notification.clientServiceId))
          .limit(1)
      : Promise.resolve([]),
  ]);
  
  // Fetch staff users if we have project data with assignees
  let projectOwner;
  let assignedStaff;
  
  if (projectData[0]) {
    const staffIds = [
      projectData[0].projectOwnerId,
      projectData[0].currentAssigneeId,
    ].filter(Boolean);
    
    if (staffIds.length > 0) {
      const staffData = await db
        .select()
        .from(users)
        .where(sql`${users.id} = ANY(${staffIds})`);
      
      projectOwner = staffData.find(u => u.id === projectData[0].projectOwnerId);
      assignedStaff = staffData.find(u => u.id === projectData[0].currentAssigneeId);
    }
  }
  
  // Build and return the context
  const context: NotificationVariableContext = {
    client: clientData[0] ? {
      id: clientData[0].id,
      name: clientData[0].name,
      email: clientData[0].email,
      clientType: clientData[0].clientType,
      financialYearEnd: clientData[0].financialYearEnd,
    } : undefined,
    
    person: personData[0] ? {
      id: personData[0].id,
      fullName: personData[0].fullName,
      email: personData[0].email,
    } : undefined,
    
    project: projectData[0] ? {
      id: projectData[0].id,
      description: projectData[0].description,
      projectTypeName: projectData[0].projectTypeName || "",
      currentStatus: projectData[0].currentStatus,
      startDate: null, // Projects don't have startDate - use service nextStartDate instead
      dueDate: projectData[0].dueDate,
    } : undefined,
    
    service: serviceData[0] ? {
      name: serviceData[0].name || "",
      description: serviceData[0].description,
      frequency: serviceData[0].frequency,
      nextStartDate: serviceData[0].nextStartDate,
      nextDueDate: serviceData[0].nextDueDate,
    } : undefined,
    
    projectOwner,
    assignedStaff,
    
    firmSettings: firmSettings ? {
      firmName: firmSettings.firmName || "The Link",
      firmPhone: firmSettings.firmPhone,
      firmEmail: firmSettings.firmEmail,
      portalUrl: firmSettings.portalUrl,
    } : undefined,
  };
  
  return context;
}

/**
 * Process a single scheduled notification
 */
async function processSingleNotification(
  notification: ScheduledNotification,
  firmSettings: typeof companySettings.$inferSelect | null
): Promise<void> {
  console.log(`[NotificationSender] Processing notification ${notification.id} (${notification.notificationType})`);

  // Re-check the notification status to prevent race conditions
  // (e.g., notification was cancelled while we were processing the batch)
  const [currentNotification] = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.id, notification.id))
    .limit(1);

  if (!currentNotification) {
    console.log(`[NotificationSender] Notification ${notification.id} no longer exists, skipping`);
    return;
  }

  if (currentNotification.status !== "scheduled") {
    console.log(
      `[NotificationSender] Notification ${notification.id} status changed to ${currentNotification.status}, skipping`
    );
    return;
  }

  // Build variable context by fetching all required data
  const variableContext = await buildNotificationVariableContext(currentNotification, firmSettings);
  
  // Process notification content variables
  const processedEmailTitle = currentNotification.emailTitle 
    ? processNotificationVariables(currentNotification.emailTitle, variableContext)
    : null;
  const processedEmailBody = currentNotification.emailBody
    ? processNotificationVariables(currentNotification.emailBody, variableContext)
    : null;
  const processedSmsContent = currentNotification.smsContent
    ? processNotificationVariables(currentNotification.smsContent, variableContext)
    : null;
  const processedPushTitle = currentNotification.pushTitle
    ? processNotificationVariables(currentNotification.pushTitle, variableContext)
    : null;
  const processedPushBody = currentNotification.pushBody
    ? processNotificationVariables(currentNotification.pushBody, variableContext)
    : null;

  // Get email sender name from firm settings
  const senderName = firmSettings?.emailSenderName || "The Link Team";

  // Get recipient contact information using the refreshed notification data
  const { email, phone } = await getRecipientInfo(currentNotification);

  // Create a notification object with processed content for validation
  const processedNotification = {
    ...currentNotification,
    emailTitle: processedEmailTitle,
    emailBody: processedEmailBody,
    smsContent: processedSmsContent,
    pushTitle: processedPushTitle,
    pushBody: processedPushBody,
  };

  // Pre-validate notification before making expensive API calls
  // This saves money by not calling SendGrid/VoodooSMS/push for invalid recipients
  const validation = await preValidateNotification(processedNotification, { email, phone });

  let result: SendNotificationResult;

  if (!validation.isValid) {
    // Validation failed - mark as failed WITHOUT making API call
    // This saves money by not calling external APIs for invalid recipients
    console.error(
      `[NotificationSender] Validation failed for notification ${currentNotification.id}: ${validation.failureReason}`
    );

    // Immediately persist the failure to database
    await db
      .update(scheduledNotifications)
      .set({
        status: "failed",
        failureReason: validation.failureReason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledNotifications.id, notification.id),
          eq(scheduledNotifications.status, "scheduled")
        )
      );

    // Create history record for audit trail
    const historyRecord: InsertNotificationHistory = {
      scheduledNotificationId: currentNotification.id,
      clientId: currentNotification.clientId,
      recipientEmail: email,
      recipientPhone: phone,
      notificationType: currentNotification.notificationType,
      content:
        currentNotification.notificationType === "email"
          ? `${currentNotification.emailTitle}\n\n${currentNotification.emailBody}`
          : currentNotification.notificationType === "sms"
          ? currentNotification.smsContent || ""
          : `${currentNotification.pushTitle || ""} - ${currentNotification.pushBody || ""}`,
      status: "failed",
      sentAt: null,
      failureReason: validation.failureReason,
      externalId: null,
      metadata: null,
    };

    await db.insert(notificationHistory).values(historyRecord);

    console.log(
      `[NotificationSender] Notification ${currentNotification.id} marked as failed: ${validation.failureReason}`
    );

    // Early return - no need to proceed with sending
    return;
  }

  // Validation passed - send the notification using validated channel data
  switch (currentNotification.notificationType) {
    case "email":
      result = await sendEmailNotification(
        validation.channelData!.email!,
        processedEmailTitle!,
        processedEmailBody!,
        senderName
      );
      break;

    case "sms":
      result = await sendSMSNotification(
        validation.channelData!.phone!,
        processedSmsContent!
      );
      break;

    case "push":
      result = await sendPushNotificationViaService(
        currentNotification.clientId,
        currentNotification.personId,
        processedPushTitle!,
        processedPushBody!,
        validation.channelData!.pushSubscriptions
      );
      break;

    default:
      console.error(`[NotificationSender] Unknown notification type: ${currentNotification.notificationType}`);
      result = {
        success: false,
        error: `Unknown notification type: ${currentNotification.notificationType}`,
      };
  }

  // Update the scheduled notification status with conditional WHERE to prevent race conditions
  // Only update if still in "scheduled" status to avoid overwriting a concurrent cancellation
  if (result.success) {
    await db
      .update(scheduledNotifications)
      .set({
        status: "sent",
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledNotifications.id, notification.id),
          eq(scheduledNotifications.status, "scheduled")
        )
      );
  } else {
    await db
      .update(scheduledNotifications)
      .set({
        status: "failed",
        failureReason: result.error,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scheduledNotifications.id, notification.id),
          eq(scheduledNotifications.status, "scheduled")
        )
      );
  }

  // Record in notification history (using refreshed notification data)
  const historyRecord: InsertNotificationHistory = {
    scheduledNotificationId: currentNotification.id,
    clientId: currentNotification.clientId,
    recipientEmail: email,
    recipientPhone: phone,
    notificationType: currentNotification.notificationType,
    content:
      currentNotification.notificationType === "email"
        ? `${currentNotification.emailTitle}\n\n${currentNotification.emailBody}`
        : currentNotification.notificationType === "sms"
        ? currentNotification.smsContent || ""
        : `${currentNotification.pushTitle || ""} - ${currentNotification.pushBody || ""}`,
    status: result.success ? "sent" : "failed",
    sentAt: result.success ? new Date() : null,
    failureReason: result.error || null,
    externalId: result.externalId || null,
    metadata: null,
  };

  await db.insert(notificationHistory).values(historyRecord);

  console.log(
    `[NotificationSender] Notification ${currentNotification.id} ${result.success ? "sent" : "failed"}`
  );
}

/**
 * Process all due notifications
 * 
 * This function should be called periodically (e.g., every minute) to check for
 * and send any notifications that are due.
 */
export async function processDueNotifications(): Promise<void> {
  console.log("[NotificationSender] Checking for due notifications...");

  // Fetch firm settings once for the entire batch (performance optimization)
  const [firmSettings] = await db.select().from(companySettings).limit(1);

  // Find all scheduled notifications that are due and not stopped
  const dueNotifications = await db
    .select()
    .from(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.status, "scheduled"),
        lte(scheduledNotifications.scheduledFor, new Date()),
        eq(scheduledNotifications.stopReminders, false)
      )
    );

  if (dueNotifications.length === 0) {
    console.log("[NotificationSender] No due notifications found");
    return;
  }

  console.log(`[NotificationSender] Found ${dueNotifications.length} due notification(s)`);

  // Process each notification
  for (const notification of dueNotifications) {
    try {
      await processSingleNotification(notification, firmSettings || null);
    } catch (error) {
      console.error(`[NotificationSender] Error processing notification ${notification.id}:`, error);
      
      // Mark as failed
      await db
        .update(scheduledNotifications)
        .set({
          status: "failed",
          failureReason: error instanceof Error ? error.message : "Unknown error",
          updatedAt: new Date(),
        })
        .where(eq(scheduledNotifications.id, notification.id));
    }
  }

  console.log(`[NotificationSender] Processed ${dueNotifications.length} notification(s)`);
}

/**
 * Send a test notification (for admin testing purposes)
 */
export async function sendTestNotification(
  notificationType: "email" | "sms" | "push",
  recipient: {
    email?: string;
    phone?: string;
    clientId?: string;
  },
  content: {
    title?: string;
    body?: string;
    smsContent?: string;
    pushTitle?: string;
    pushBody?: string;
  }
): Promise<SendNotificationResult> {
  console.log(`[NotificationSender] Sending test ${notificationType} notification`);

  // Get company settings for email sender name
  const [settings] = await db.select().from(companySettings).limit(1);
  const senderName = settings?.emailSenderName || "The Link Team";

  switch (notificationType) {
    case "email":
      if (!recipient.email || !content.title || !content.body) {
        return {
          success: false,
          error: "Missing email, title, or body for test email",
        };
      }
      return await sendEmailNotification(recipient.email, content.title, content.body, senderName);

    case "sms":
      if (!recipient.phone || !content.smsContent) {
        return {
          success: false,
          error: "Missing phone or SMS content for test SMS",
        };
      }
      return await sendSMSNotification(recipient.phone, content.smsContent);

    case "push":
      if (!recipient.clientId || !content.pushTitle || !content.pushBody) {
        return {
          success: false,
          error: "Missing client ID, push title, or push body for test push notification",
        };
      }
      return await sendPushNotificationViaService(recipient.clientId, null, content.pushTitle, content.pushBody);

    default:
      return {
        success: false,
        error: "Invalid notification type",
      };
  }
}
