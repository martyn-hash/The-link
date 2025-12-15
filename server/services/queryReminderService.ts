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
  projects,
  projectTypes,
  users,
  type ScheduledQueryReminder,
  type InsertScheduledQueryReminder,
  type DialoraSettings,
  type DialoraOutboundWebhook
} from "@shared/schema";
import { eq, and, lte, inArray, or } from "drizzle-orm";
import { getUncachableSendGridClient } from "../lib/sendgrid";
import { 
  triggerDialoraCall, 
  generateVoiceCallMessage,
  DialoraWebhookConfig,
  DialoraCallContext
} from "./dialoraService";
import { getAppUrl } from "../utils/getAppUrl";

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

export interface QueryForEmail {
  date: Date | string | null;
  description: string | null;
  moneyIn: string | null;
  moneyOut: string | null;
  ourQuery: string | null;
}

/**
 * Check if current time is a weekend (Saturday or Sunday) in UK time
 */
function isWeekendInUK(): boolean {
  const ukDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const dayOfWeek = ukDate.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
}

/**
 * Check if current time is evening (after 5pm) in UK time
 */
function isEveningInUK(): boolean {
  const ukTime = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });
  const hour = parseInt(ukTime.split(',')[1].trim().split(':')[0], 10);
  return hour >= 17; // 5pm or later
}

/**
 * Get the next weekday morning (9am UK time) for rescheduling weekend voice reminders
 */
function getNextWeekdayMorning(): Date {
  const ukNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const dayOfWeek = ukNow.getDay();
  
  let daysToAdd = 1;
  if (dayOfWeek === 6) daysToAdd = 2; // Saturday -> Monday
  if (dayOfWeek === 0) daysToAdd = 1; // Sunday -> Monday
  
  const nextWeekday = new Date(ukNow);
  nextWeekday.setDate(nextWeekday.getDate() + daysToAdd);
  nextWeekday.setHours(9, 0, 0, 0); // 9am
  
  return nextWeekday;
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
 * Get unanswered queries for a token (for including in reminder emails)
 */
export async function getUnansweredQueriesForToken(tokenId: string): Promise<QueryForEmail[]> {
  try {
    const token = await db
      .select()
      .from(queryResponseTokens)
      .where(eq(queryResponseTokens.id, tokenId))
      .limit(1);

    if (token.length === 0) {
      return [];
    }

    const queryIds = token[0].queryIds || [];
    if (queryIds.length === 0) {
      return [];
    }

    const queries = await db
      .select({
        status: bookkeepingQueries.status,
        date: bookkeepingQueries.date,
        description: bookkeepingQueries.description,
        moneyIn: bookkeepingQueries.moneyIn,
        moneyOut: bookkeepingQueries.moneyOut,
        ourQuery: bookkeepingQueries.ourQuery,
      })
      .from(bookkeepingQueries)
      .where(inArray(bookkeepingQueries.id, queryIds));

    return queries
      .filter(q => q.status !== 'answered_by_client' && q.status !== 'resolved')
      .map(q => ({
        date: q.date,
        description: q.description,
        moneyIn: q.moneyIn,
        moneyOut: q.moneyOut,
        ourQuery: q.ourQuery,
      }));
  } catch (error) {
    console.error('[QueryReminder] Error fetching unanswered queries:', error);
    return [];
  }
}

/**
 * Get unanswered queries for a reminder by reminder ID (for preview)
 * Looks up the reminder to get its tokenId, then fetches unanswered queries
 */
export async function getUnansweredQueriesForReminder(reminderId: string): Promise<QueryForEmail[]> {
  try {
    const reminder = await db
      .select({ tokenId: scheduledQueryReminders.tokenId })
      .from(scheduledQueryReminders)
      .where(eq(scheduledQueryReminders.id, reminderId))
      .limit(1);

    if (reminder.length === 0) {
      return [];
    }

    return getUnansweredQueriesForToken(reminder[0].tokenId);
  } catch (error) {
    console.error('[QueryReminder] Error fetching unanswered queries for reminder:', error);
    return [];
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
  responseLink: string,
  unansweredQueries: QueryForEmail[],
  expiresAt: Date | null,
  customIntro?: string | null,
  customSignoff?: string | null
): Promise<ReminderSendResult> {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    if (!client) {
      return { success: false, error: 'SendGrid not configured' };
    }

    const subject = pendingQueries === totalQueries 
      ? `Reminder: ${pendingQueries} Bookkeeping ${pendingQueries === 1 ? 'Query' : 'Queries'} Awaiting Your Response`
      : `Reminder: ${pendingQueries} of ${totalQueries} Queries Still Need Your Response`;

    const body = generateReminderEmailBody(recipientName, clientName, pendingQueries, totalQueries, responseLink, unansweredQueries, expiresAt, customIntro, customSignoff);

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
 * Format currency for email display
 */
function formatCurrencyForEmail(amount: string | null): string {
  if (!amount) return '-';
  const num = parseFloat(amount);
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(num);
}

/**
 * Format date for email display
 */
function formatDateForEmail(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Generate the HTML body for reminder emails
 */
function generateReminderEmailBody(
  recipientName: string,
  clientName: string,
  pendingQueries: number,
  totalQueries: number,
  responseLink: string,
  unansweredQueries: QueryForEmail[],
  expiresAt: Date | null,
  customIntro?: string | null,
  customSignoff?: string | null
): string {
  const firstName = recipientName?.split(' ')[0] || '';
  const greeting = firstName ? `Hi ${firstName}` : 'Hello';
  
  const introHtml = customIntro 
    ? customIntro 
    : `<p>${greeting},</p><p>I'm following up about the outstanding bookkeeping queries that still need your response.</p>`;
  
  const signoffHtml = customSignoff 
    ? customSignoff 
    : `<p>If you have any questions, please don't hesitate to get in touch with us.</p><p>Kind regards,<br/>The Team</p>`;

  const borderColor = '#d0d7de';
  const cellStyle = `border:1px solid ${borderColor}; padding:8px; font-size:13px;`;
  const headerStyle = `border:1px solid ${borderColor}; padding:8px; font-weight:bold; font-size:13px; background-color:#f6f8fa;`;
  
  const queriesTableHtml = unansweredQueries.length > 0 ? `
<p style="margin-top: 24px;"><strong>Outstanding queries:</strong></p>
<table border="1" cellpadding="0" cellspacing="0" bordercolor="${borderColor}" style="border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; width:100%; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin:16px 0; border:1px solid ${borderColor};">
  <tr>
    <th align="left" style="${headerStyle} color:#334155;">Date</th>
    <th align="left" style="${headerStyle} color:#334155;">Description</th>
    <th align="right" style="${headerStyle} color:#16a34a;">Money In</th>
    <th align="right" style="${headerStyle} color:#dc2626;">Money Out</th>
    <th align="left" style="${headerStyle} color:#334155;">Our Query</th>
  </tr>
  ${unansweredQueries.map((q, i) => `
  <tr${i % 2 === 1 ? ' style="background-color:#f8fafc;"' : ''}>
    <td align="left" style="${cellStyle} color:#475569;">${formatDateForEmail(q.date)}</td>
    <td align="left" style="${cellStyle} color:#475569;">${q.description || ''}</td>
    <td align="right" style="${cellStyle} color:#16a34a;">${formatCurrencyForEmail(q.moneyIn)}</td>
    <td align="right" style="${cellStyle} color:#dc2626;">${formatCurrencyForEmail(q.moneyOut)}</td>
    <td align="left" style="${cellStyle} color:#1e293b; font-weight:500;">${q.ourQuery || ''}</td>
  </tr>
  `).join('')}
</table>` : '';

  const expiryText = expiresAt 
    ? `<p style="color: #64748b; font-size: 14px; text-align: center;"><strong>This link will expire on ${formatDateForEmail(expiresAt)}.</strong></p>` 
    : '';

  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${introHtml}
      
      ${queriesTableHtml}
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${responseLink}" style="background-color: #0f7b94; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          View Queries
        </a>
      </div>
      
      ${expiryText}
      
      ${signoffHtml}
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
 * Get Dialora webhook configuration for a project
 * Checks if voice AI is enabled at the PROJECT TYPE level (admin decision), 
 * then cycles through active webhooks based on reminder count
 */
async function getDialoraWebhookConfig(
  projectId: string,
  tokenId: string
): Promise<DialoraWebhookConfig | null> {
  try {
    const project = await db
      .select({ 
        projectTypeId: projects.projectTypeId
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project[0]?.projectTypeId) return null;

    const projectType = await db
      .select({ 
        dialoraSettings: projectTypes.dialoraSettings,
        useVoiceAiForQueries: projectTypes.useVoiceAiForQueries,
        name: projectTypes.name
      })
      .from(projectTypes)
      .where(eq(projectTypes.id, project[0].projectTypeId))
      .limit(1);

    if (!projectType[0]?.useVoiceAiForQueries) {
      console.log(`[QueryReminder] Voice AI not enabled for project type "${projectType[0]?.name || 'Unknown'}" (project ${projectId})`);
      return null;
    }

    const settings = projectType[0]?.dialoraSettings as DialoraSettings | null;
    if (!settings?.outboundWebhooks?.length) {
      console.log(`[QueryReminder] No webhooks configured for project type "${projectType[0]?.name}", voice AI disabled`);
      return null;
    }

    const activeWebhooks = settings.outboundWebhooks.filter(w => w.active);
    if (activeWebhooks.length === 0) return null;

    const sentReminders = await db
      .select({ id: scheduledQueryReminders.id })
      .from(scheduledQueryReminders)
      .where(
        and(
          eq(scheduledQueryReminders.tokenId, tokenId),
          eq(scheduledQueryReminders.channel, 'voice'),
          eq(scheduledQueryReminders.status, 'sent')
        )
      );

    const webhookIndex = sentReminders.length % activeWebhooks.length;
    const selectedWebhook = activeWebhooks[webhookIndex];

    console.log(`[QueryReminder] Using webhook ${webhookIndex + 1}/${activeWebhooks.length}: ${selectedWebhook.name}`);

    return {
      url: selectedWebhook.url,
      messageTemplate: selectedWebhook.messageTemplate
    };
  } catch (error) {
    console.error('[QueryReminder] Failed to get dialora config:', error);
    return null;
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
  totalQueries: number,
  webhookConfig: DialoraWebhookConfig | null,
  context?: DialoraCallContext
): Promise<ReminderSendResult> {
  try {
    if (!webhookConfig?.url) {
      return {
        success: false,
        error: 'No voice AI webhook configured for this project'
      };
    }

    const message = webhookConfig.messageTemplate || 
      generateVoiceCallMessage(recipientName, pendingQueries, totalQueries);
    
    const result = await triggerDialoraCall(
      {
        name: recipientName || 'Client',
        phone: recipientPhone,
        email: recipientEmail || '',
        company: clientName,
        message,
        querycount: pendingQueries
      },
      webhookConfig,
      context
    );

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
  console.log(`[QueryReminder] Processing ${reminder.channel} reminder ${reminder.id}:`, {
    tokenId: reminder.tokenId,
    recipientName: reminder.recipientName,
    recipientEmail: reminder.recipientEmail,
    recipientPhone: reminder.recipientPhone,
    scheduledAt: reminder.scheduledAt,
    projectId: reminder.projectId
  });

  const queryStatus = await getQueryStatusForToken(reminder.tokenId);
  
  if (!queryStatus) {
    console.error(`[QueryReminder] Failed reminder ${reminder.id}: Query token ${reminder.tokenId} not found`);
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

  // Always use production URL for emails
  const responseLink = `${getAppUrl()}/queries/respond/${token[0].token}`;
  
  const clientData = await db
    .select({ 
      name: clients.name,
      tradingAs: clients.tradingAs,
      companyNumber: clients.companyNumber,
      companyUtr: clients.companyUtr,
      telephone: clients.telephone,
      email: clients.primaryContactEmail
    })
    .from(clients)
    .innerJoin(queryResponseTokens, eq(queryResponseTokens.clientId, clients.id))
    .where(eq(queryResponseTokens.id, reminder.tokenId))
    .limit(1);

  const clientName = clientData[0]?.name || 'Your Company';
  const clientInfo = clientData[0];
  
  const projectData = token[0].projectId ? await db
    .select({
      name: projects.name,
      reference: projects.reference,
      dueDate: projects.dueDate,
      status: projects.status
    })
    .from(projects)
    .where(eq(projects.id, token[0].projectId))
    .limit(1)
  : [];
  
  const projectInfo = projectData[0];

  let result: ReminderSendResult;

  switch (reminder.channel) {
    case 'email':
      if (!reminder.recipientEmail) {
        result = { success: false, error: 'No email address for recipient' };
      } else {
        const unansweredQueries = await getUnansweredQueriesForToken(reminder.tokenId);
        result = await sendEmailReminder(
          reminder.recipientEmail,
          reminder.recipientName || '',
          clientName,
          queryStatus.pendingQueries,
          queryStatus.totalQueries,
          responseLink,
          unansweredQueries,
          token[0].expiresAt,
          reminder.messageIntro,
          reminder.messageSignoff
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
      } else if (isWeekendInUK()) {
        const nextWeekdayTime = getNextWeekdayMorning();
        await db
          .update(scheduledQueryReminders)
          .set({ scheduledAt: nextWeekdayTime })
          .where(eq(scheduledQueryReminders.id, reminder.id));
        console.log(`[QueryReminder] Rescheduling voice call ${reminder.id} to ${nextWeekdayTime.toISOString()} - weekend restriction`);
        return { success: false, error: 'Rescheduled to next weekday morning (weekend restriction)' };
      } else {
        const webhookConfig = token[0].projectId 
          ? await getDialoraWebhookConfig(token[0].projectId, reminder.tokenId)
          : null;
        
        const nameParts = (reminder.recipientName || '').split(' ');
        const dialoraContext: DialoraCallContext = {
          recipient: {
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            fullName: reminder.recipientName || '',
            email: reminder.recipientEmail || '',
            phone: reminder.recipientPhone || ''
          },
          client: {
            name: clientInfo?.name || '',
            tradingAs: clientInfo?.tradingAs || undefined,
            companyNumber: clientInfo?.companyNumber || undefined,
            companyUtr: clientInfo?.companyUtr || undefined,
            telephone: clientInfo?.telephone || undefined,
            email: clientInfo?.email || undefined
          },
          project: projectInfo ? {
            name: projectInfo.name || undefined,
            reference: projectInfo.reference || undefined,
            dueDate: projectInfo.dueDate 
              ? new Date(projectInfo.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : undefined,
            status: projectInfo.status || undefined
          } : undefined,
          queries: {
            pending: queryStatus.pendingQueries,
            total: queryStatus.totalQueries,
            answered: queryStatus.answeredQueries
          }
        };
        
        result = await sendVoiceReminder(
          reminder.recipientPhone,
          reminder.recipientName || '',
          reminder.recipientEmail || '',
          clientName,
          queryStatus.pendingQueries,
          queryStatus.totalQueries,
          webhookConfig,
          dialoraContext
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
  
  // Get start of today in UK time
  const ukNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const startOfTodayUK = new Date(ukNow);
  startOfTodayUK.setHours(0, 0, 0, 0);
  
  // Convert back to UTC for DB comparison
  const ukOffset = ukNow.getTime() - now.getTime();
  const startOfTodayUTC = new Date(startOfTodayUK.getTime() - ukOffset);
  
  const allDue = await db
    .select()
    .from(scheduledQueryReminders)
    .where(
      and(
        eq(scheduledQueryReminders.status, 'pending'),
        lte(scheduledQueryReminders.scheduledAt, now)
      )
    );
  
  // Filter out reminders scheduled before today (missed from previous days)
  const todayOnwards = allDue.filter(r => {
    if (!r.scheduledAt) return false;
    return new Date(r.scheduledAt) >= startOfTodayUTC;
  });
  
  // Cancel old missed reminders
  const missedReminders = allDue.filter(r => {
    if (!r.scheduledAt) return false;
    return new Date(r.scheduledAt) < startOfTodayUTC;
  });
  
  for (const missed of missedReminders) {
    await db
      .update(scheduledQueryReminders)
      .set({
        status: 'cancelled',
        cancelledAt: now
      })
      .where(eq(scheduledQueryReminders.id, missed.id));
    console.log(`[QueryReminder] Cancelled missed reminder ${missed.id} (scheduled ${missed.scheduledAt?.toISOString()})`);
  }
  
  if (missedReminders.length > 0) {
    console.log(`[QueryReminder] Cancelled ${missedReminders.length} missed reminder(s) from previous days`);
  }
  
  return todayOnwards;
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

export interface ReminderWithCreator extends ScheduledQueryReminder {
  tokenCreatorFirstName: string | null;
}

/**
 * Get all reminders for a project with token creator information
 */
export async function getRemindersForProject(projectId: string): Promise<ReminderWithCreator[]> {
  const results = await db
    .select({
      reminder: scheduledQueryReminders,
      creatorFirstName: users.firstName,
    })
    .from(scheduledQueryReminders)
    .leftJoin(queryResponseTokens, eq(scheduledQueryReminders.tokenId, queryResponseTokens.id))
    .leftJoin(users, eq(queryResponseTokens.createdById, users.id))
    .where(eq(scheduledQueryReminders.projectId, projectId))
    .orderBy(scheduledQueryReminders.scheduledAt);
    
  return results.map(r => ({
    ...r.reminder,
    tokenCreatorFirstName: r.creatorFirstName,
  }));
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

/**
 * Update a pending reminder (reschedule date/time, change channel, or edit message)
 */
export async function updateReminder(
  reminderId: string,
  updates: { 
    scheduledAt?: Date; 
    channel?: 'email' | 'sms' | 'voice'; 
    message?: string;
    messageIntro?: string;
    messageSignoff?: string;
  }
): Promise<typeof scheduledQueryReminders.$inferSelect | null> {
  const updateData: Partial<typeof scheduledQueryReminders.$inferInsert> = {};
  
  if (updates.scheduledAt) {
    updateData.scheduledAt = updates.scheduledAt;
  }
  if (updates.channel) {
    updateData.channel = updates.channel;
  }
  if (updates.message !== undefined) {
    updateData.message = updates.message;
  }
  if (updates.messageIntro !== undefined) {
    updateData.messageIntro = updates.messageIntro;
  }
  if (updates.messageSignoff !== undefined) {
    updateData.messageSignoff = updates.messageSignoff;
  }

  const result = await db
    .update(scheduledQueryReminders)
    .set(updateData)
    .where(
      and(
        eq(scheduledQueryReminders.id, reminderId),
        eq(scheduledQueryReminders.status, 'pending')
      )
    )
    .returning();

  return result[0] || null;
}
