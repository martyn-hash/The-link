/**
 * Query Reminder Service
 * 
 * Handles automated reminder delivery for bookkeeping queries via multiple channels:
 * - Email (via Outlook/SendGrid)
 * - SMS (via VoodooSMS)
 * - Voice (via Dialora.ai)
 * 
 * Features:
 * - Smart cessation when all queries answered
 * - Adaptive messaging for partial completion
 * - Full audit trail via chronology
 */

import { db } from "../db";
import { 
  scheduledQueryReminders,
  bookkeepingQueries,
  queryResponseTokens,
  clients,
  type ScheduledQueryReminder,
  type InsertScheduledQueryReminder
} from "@shared/schema";
import { eq, and, lte, inArray, or } from "drizzle-orm";
import { getUncachableSendGridClient } from "../lib/sendgrid";
import { 
  triggerDialoraCall, 
  generateVoiceCallMessage 
} from "./dialoraService";

interface ReminderSendResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

interface QueryStatus {
  totalQueries: number;
  answeredQueries: number;
  pendingQueries: number;
  allAnswered: boolean;
}

/**
 * Format phone number to E.164 international format for VoodooSMS
 */
function formatPhoneForVoodooSMS(phone: string): string {
  const cleanPhone = phone.replace(/[^\d]/g, '');
  if (cleanPhone.startsWith('07') && cleanPhone.length === 11) {
    return '+44' + cleanPhone.slice(1);
  }
  if (cleanPhone.startsWith('44') && cleanPhone.length >= 11) {
    return '+' + cleanPhone;
  }
  return phone.startsWith('+') ? phone : `+${cleanPhone}`;
}

/**
 * Check the current status of queries for a token
 */
export async function getQueryStatusForToken(tokenId: string): Promise<QueryStatus | null> {
  try {
    const token = await db
      .select()
      .from(queryResponseTokens)
      .where(eq(queryResponseTokens.id, tokenId))
      .limit(1);

    if (token.length === 0) {
      return null;
    }

    const queryIds = token[0].queryIds || [];
    if (queryIds.length === 0) {
      return { totalQueries: 0, answeredQueries: 0, pendingQueries: 0, allAnswered: true };
    }

    const queries = await db
      .select({ status: bookkeepingQueries.status })
      .from(bookkeepingQueries)
      .where(inArray(bookkeepingQueries.id, queryIds));

    const totalQueries = queries.length;
    const answeredQueries = queries.filter(q => 
      q.status === 'answered_by_client' || q.status === 'resolved'
    ).length;
    const pendingQueries = totalQueries - answeredQueries;

    return {
      totalQueries,
      answeredQueries,
      pendingQueries,
      allAnswered: pendingQueries === 0
    };
  } catch (error) {
    console.error('[QueryReminder] Error checking query status:', error);
    return null;
  }
}

/**
 * Send an email reminder
 */
async function sendEmailReminder(
  recipientEmail: string,
  recipientName: string,
  clientName: string,
  pendingQueries: number,
  totalQueries: number,
  responseLink: string
): Promise<ReminderSendResult> {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    if (!client) {
      return { success: false, error: 'SendGrid not configured' };
    }

    const subject = pendingQueries === totalQueries 
      ? `Reminder: ${pendingQueries} Bookkeeping ${pendingQueries === 1 ? 'Query' : 'Queries'} Awaiting Your Response`
      : `Reminder: ${pendingQueries} of ${totalQueries} Queries Still Need Your Response`;

    const body = generateReminderEmailBody(recipientName, clientName, pendingQueries, totalQueries, responseLink);

    await client.send({
      to: recipientEmail,
      from: fromEmail,
      subject,
      html: body
    });

    return { success: true };
  } catch (error) {
    console.error('[QueryReminder] Email send failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Email send failed' 
    };
  }
}

/**
 * Generate the HTML body for reminder emails
 */
function generateReminderEmailBody(
  recipientName: string,
  clientName: string,
  pendingQueries: number,
  totalQueries: number,
  responseLink: string
): string {
  const greeting = recipientName ? `Dear ${recipientName}` : 'Hello';
  const statusText = pendingQueries === totalQueries
    ? `We have ${pendingQueries} bookkeeping ${pendingQueries === 1 ? 'query' : 'queries'} that ${pendingQueries === 1 ? 'requires' : 'require'} your attention.`
    : `Thank you for your responses so far. We still have ${pendingQueries} of ${totalQueries} queries remaining that need your input.`;

  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p>${greeting},</p>
      
      <p>This is a friendly reminder regarding the bookkeeping queries for <strong>${clientName}</strong>.</p>
      
      <p>${statusText}</p>
      
      <p>Please click the button below to view and respond to the outstanding queries:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${responseLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          View Queries
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        If you have any questions, please don't hesitate to get in touch with us.
      </p>
      
      <p>Best regards,<br/>The Link</p>
    </div>
  `;
}

/**
 * Send an SMS reminder via VoodooSMS
 */
async function sendSMSReminder(
  recipientPhone: string,
  recipientName: string,
  pendingQueries: number,
  responseLink: string
): Promise<ReminderSendResult> {
  try {
    const apiKey = process.env.VOODOO_SMS_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'VoodooSMS not configured' };
    }

    const formattedPhone = formatPhoneForVoodooSMS(recipientPhone);
    const name = recipientName ? ` ${recipientName.split(' ')[0]}` : '';
    
    const message = pendingQueries === 1
      ? `Hi${name}, you have 1 bookkeeping query awaiting your response. Please click here to respond: ${responseLink}`
      : `Hi${name}, you have ${pendingQueries} bookkeeping queries awaiting your response. Please click here to respond: ${responseLink}`;

    const response = await fetch('https://api.voodoosms.com/sendsms', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: formattedPhone,
        from: 'GrowthAcc',
        msg: message,
        external_reference: `query-reminder-${Date.now()}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `VoodooSMS error: ${response.status} - ${errorText}` };
    }

    const result = await response.json() as { message_id?: string };
    return { success: true, externalId: result.message_id };
  } catch (error) {
    console.error('[QueryReminder] SMS send failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'SMS send failed' 
    };
  }
}

/**
 * Send a voice reminder via Dialora
 */
async function sendVoiceReminder(
  recipientPhone: string,
  recipientName: string,
  recipientEmail: string,
  clientName: string,
  pendingQueries: number,
  totalQueries: number
): Promise<ReminderSendResult> {
  try {
    const message = generateVoiceCallMessage(recipientName, pendingQueries, totalQueries);
    
    const result = await triggerDialoraCall({
      name: recipientName || 'Client',
      phone: recipientPhone,
      email: recipientEmail || '',
      company: clientName,
      message,
      querycount: pendingQueries
    });

    return {
      success: result.success,
      externalId: result.callId,
      error: result.error
    };
  } catch (error) {
    console.error('[QueryReminder] Voice call failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Voice call failed' 
    };
  }
}

/**
 * Process a single scheduled reminder
 */
export async function processReminder(reminder: ScheduledQueryReminder): Promise<ReminderSendResult> {
  const queryStatus = await getQueryStatusForToken(reminder.tokenId);
  
  if (!queryStatus) {
    return { success: false, error: 'Query token not found' };
  }

  if (queryStatus.allAnswered) {
    await db
      .update(scheduledQueryReminders)
      .set({ 
        status: 'cancelled',
        cancelledAt: new Date()
      })
      .where(eq(scheduledQueryReminders.id, reminder.id));
    
    console.log(`[QueryReminder] Cancelled reminder ${reminder.id} - all queries answered`);
    return { success: true, error: 'Cancelled - all queries answered' };
  }

  const token = await db
    .select()
    .from(queryResponseTokens)
    .where(eq(queryResponseTokens.id, reminder.tokenId))
    .limit(1);

  if (token.length === 0 || !token[0].token) {
    return { success: false, error: 'Invalid query token' };
  }

  const responseLink = `${process.env.PUBLIC_URL || ''}/queries/respond/${token[0].token}`;
  
  const clientData = await db
    .select({ name: clients.name })
    .from(clients)
    .innerJoin(queryResponseTokens, eq(queryResponseTokens.projectId, clients.id))
    .where(eq(queryResponseTokens.id, reminder.tokenId))
    .limit(1);

  const clientName = clientData[0]?.name || 'Your Company';

  let result: ReminderSendResult;

  switch (reminder.channel) {
    case 'email':
      if (!reminder.recipientEmail) {
        result = { success: false, error: 'No email address for recipient' };
      } else {
        result = await sendEmailReminder(
          reminder.recipientEmail,
          reminder.recipientName || '',
          clientName,
          queryStatus.pendingQueries,
          queryStatus.totalQueries,
          responseLink
        );
      }
      break;

    case 'sms':
      if (!reminder.recipientPhone) {
        result = { success: false, error: 'No phone number for SMS' };
      } else {
        result = await sendSMSReminder(
          reminder.recipientPhone,
          reminder.recipientName || '',
          queryStatus.pendingQueries,
          responseLink
        );
      }
      break;

    case 'voice':
      if (!reminder.recipientPhone) {
        result = { success: false, error: 'No phone number for voice call' };
      } else {
        result = await sendVoiceReminder(
          reminder.recipientPhone,
          reminder.recipientName || '',
          reminder.recipientEmail || '',
          clientName,
          queryStatus.pendingQueries,
          queryStatus.totalQueries
        );
      }
      break;

    default:
      result = { success: false, error: `Unknown communication channel: ${reminder.channel}` };
  }

  await db
    .update(scheduledQueryReminders)
    .set({
      status: result.success ? 'sent' : 'failed',
      sentAt: result.success ? new Date() : null,
      dialoraCallId: reminder.channel === 'voice' ? result.externalId : null,
      errorMessage: result.error || null,
      queriesRemaining: queryStatus.pendingQueries,
      queriesTotal: queryStatus.totalQueries
    })
    .where(eq(scheduledQueryReminders.id, reminder.id));

  return result;
}

/**
 * Get all reminders that are due for processing
 */
export async function getDueReminders(): Promise<ScheduledQueryReminder[]> {
  const now = new Date();
  
  return db
    .select()
    .from(scheduledQueryReminders)
    .where(
      and(
        eq(scheduledQueryReminders.status, 'pending'),
        lte(scheduledQueryReminders.scheduledAt, now)
      )
    );
}

/**
 * Cancel all pending reminders for a token
 */
export async function cancelAllRemindersForToken(
  tokenId: string, 
  cancelledById?: string
): Promise<number> {
  const result = await db
    .update(scheduledQueryReminders)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledById: cancelledById || null
    })
    .where(
      and(
        eq(scheduledQueryReminders.tokenId, tokenId),
        eq(scheduledQueryReminders.status, 'pending')
      )
    )
    .returning({ id: scheduledQueryReminders.id });

  return result.length;
}

/**
 * Check if all queries for a token are answered and cancel remaining reminders
 */
export async function checkAndCancelRemindersIfComplete(tokenId: string): Promise<boolean> {
  const status = await getQueryStatusForToken(tokenId);
  
  if (status?.allAnswered) {
    const cancelled = await cancelAllRemindersForToken(tokenId);
    if (cancelled > 0) {
      console.log(`[QueryReminder] Cancelled ${cancelled} reminders for token ${tokenId} - all queries answered`);
    }
    return true;
  }
  
  return false;
}

/**
 * Schedule reminders for a new query token
 */
export async function scheduleReminders(
  tokenId: string,
  projectId: string,
  recipientName: string,
  recipientEmail: string | null,
  recipientPhone: string | null,
  reminders: Array<{
    scheduledAt: Date;
    channel: 'email' | 'sms' | 'voice';
    message?: string;
  }>,
  totalQueries: number
): Promise<ScheduledQueryReminder[]> {
  const insertData: InsertScheduledQueryReminder[] = reminders.map((r) => ({
    tokenId,
    projectId,
    recipientName,
    recipientEmail,
    recipientPhone,
    scheduledAt: r.scheduledAt,
    channel: r.channel,
    message: r.message || null,
    queriesTotal: totalQueries,
    queriesRemaining: totalQueries,
    status: 'pending' as const
  }));

  const scheduled = await db
    .insert(scheduledQueryReminders)
    .values(insertData)
    .returning();

  console.log(`[QueryReminder] Scheduled ${scheduled.length} reminders for token ${tokenId}`);
  
  return scheduled;
}

/**
 * Get all reminders for a project
 */
export async function getRemindersForProject(projectId: string): Promise<ScheduledQueryReminder[]> {
  return db
    .select()
    .from(scheduledQueryReminders)
    .where(eq(scheduledQueryReminders.projectId, projectId))
    .orderBy(scheduledQueryReminders.scheduledAt);
}

/**
 * Cancel a single reminder
 */
export async function cancelReminder(
  reminderId: string,
  cancelledById?: string
): Promise<boolean> {
  const result = await db
    .update(scheduledQueryReminders)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledById: cancelledById || null
    })
    .where(
      and(
        eq(scheduledQueryReminders.id, reminderId),
        eq(scheduledQueryReminders.status, 'pending')
      )
    )
    .returning({ id: scheduledQueryReminders.id });

  return result.length > 0;
}
