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
  people,
  clientPeople,
  type ScheduledQueryReminder,
  type InsertScheduledQueryReminder,
  type DialoraSettings,
  type DialoraOutboundWebhook
} from "@shared/schema";
import { eq, and, lte, inArray, or, isNull, sql } from "drizzle-orm";
import { getUncachableSendGridClient } from "../lib/sendgrid";
import { 
  triggerDialoraCall, 
  generateVoiceCallMessage,
  DialoraWebhookConfig,
  DialoraCallContext
} from "./dialoraService";
import { getAppUrl } from "../utils/getAppUrl";

/**
 * Fail-fast validation for Drizzle select columns
 * Catches schema mismatches early with clear error messages instead of cryptic Drizzle stack traces
 */
function validateSelectColumns(columns: Record<string, unknown>, context: string): void {
  for (const [key, value] of Object.entries(columns)) {
    if (value === undefined || value === null) {
      const error = `Invalid select column: ${key} (undefined). Check schema mismatch in ${context}`;
      console.error(`[QueryReminder] SCHEMA ERROR: ${error}`);
      throw new Error(error);
    }
  }
}

/**
 * Check if an error is non-retryable (permanent configuration/validation issue)
 * Uses specific keywords that indicate the sender won't succeed even with retries
 */
function isNonRetryableError(errorMessage: string): boolean {
  const lowerError = errorMessage.toLowerCase();
  
  // Explicit configuration/missing resource errors - these won't fix themselves
  const nonRetryablePatterns = [
    'not configured',
    'no email address',
    'no phone number',
    'no voice ai webhook',
    'no webhook configured',
    'sendgrid not configured',
    'voodoosms not configured',
    'api key not found',
    'authentication failed',
    'unauthorized',
    'forbidden'
  ];
  
  return nonRetryablePatterns.some(pattern => lowerError.includes(pattern));
}

/**
 * Retry wrapper for transient network failures
 * Retries up to maxRetries times with exponential backoff
 * Works with functions that return ReminderSendResult (success/error pattern)
 * Only skips retry for explicit configuration/validation errors, NOT generic HTTP errors
 */
async function withRetry(
  operation: () => Promise<ReminderSendResult>,
  maxRetries: number = 2,
  context: string = 'operation'
): Promise<ReminderSendResult> {
  let lastResult: ReminderSendResult = { success: false, error: 'No attempts made' };
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // If successful, return immediately
      if (result.success) {
        return result;
      }
      
      lastResult = result;
      
      // Only skip retry for explicit configuration/validation errors
      // Don't skip for generic HTTP errors (502, 503, "invalid response from upstream", etc.)
      if (isNonRetryableError(result.error || '')) {
        console.log(`[QueryReminder] ${context} failed with non-retryable error: ${result.error}`);
        return result;
      }
      
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`[QueryReminder] ${context} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${result.error}, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastResult = { success: false, error: errorMessage };
      
      // Only skip retry for explicit configuration errors
      if (isNonRetryableError(errorMessage)) {
        console.log(`[QueryReminder] ${context} threw non-retryable error: ${errorMessage}`);
        return lastResult;
      }
      
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`[QueryReminder] ${context} threw error (attempt ${attempt + 1}/${maxRetries + 1}): ${errorMessage}, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  return lastResult;
}

/**
 * Atomically claim a reminder for processing to prevent double-sends
 * Uses a status-based approach with time-window check
 * Returns true if this process successfully claimed the reminder
 */
async function claimReminder(reminderId: string): Promise<boolean> {
  try {
    // Use a time-window check: if another process claimed it in the last 5 minutes,
    // skip processing (the other process is likely still working on it)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // Atomically update only if still 'pending' and not recently claimed
    // We add a processing marker to errorMessage temporarily
    const processingMarker = `__PROCESSING__${Date.now()}`;
    const result = await db
      .update(scheduledQueryReminders)
      .set({ 
        errorMessage: processingMarker
      })
      .where(
        and(
          eq(scheduledQueryReminders.id, reminderId),
          eq(scheduledQueryReminders.status, 'pending'),
          // Only claim if not already being processed (no __PROCESSING__ marker)
          or(
            isNull(scheduledQueryReminders.errorMessage),
            sql`${scheduledQueryReminders.errorMessage} NOT LIKE '__PROCESSING__%'`
          )
        )
      )
      .returning({ id: scheduledQueryReminders.id });
    
    if (result.length > 0) {
      console.log(`[QueryReminder] Claimed reminder ${reminderId} for processing`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[QueryReminder] Failed to claim reminder ${reminderId}:`, error);
    return false;
  }
}

/**
 * Release a reminder claim without marking it as failed
 * Called when we skip processing (e.g., already answered, token expired)
 * or when an unexpected error occurs before we update the final status
 */
async function releaseReminderClaim(reminderId: string): Promise<void> {
  try {
    await db
      .update(scheduledQueryReminders)
      .set({ 
        errorMessage: null
      })
      .where(
        and(
          eq(scheduledQueryReminders.id, reminderId),
          // Only clear if still has our processing marker
          sql`${scheduledQueryReminders.errorMessage} LIKE '__PROCESSING__%'`
        )
      );
  } catch (error) {
    console.error(`[QueryReminder] Failed to release claim for ${reminderId}:`, error);
  }
}

/**
 * Mark a reminder as failed without crashing the whole job
 * Exported for use by cron job error handling
 */
export async function markReminderFailed(reminderId: string, errorMessage: string): Promise<void> {
  try {
    await db
      .update(scheduledQueryReminders)
      .set({
        status: 'failed',
        errorMessage
        // Note: sentAt intentionally left null for failures to distinguish from successful sends
      })
      .where(eq(scheduledQueryReminders.id, reminderId));
    console.error(`[QueryReminder] Marked reminder ${reminderId} as failed: ${errorMessage}`);
  } catch (updateError) {
    console.error(`[QueryReminder] Failed to update reminder ${reminderId} status:`, updateError);
  }
}

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
 * Extract first name from various name formats
 * Handles: "SURNAME, FirstName MiddleName" -> "FirstName"
 * Handles: "FirstName LastName" -> "FirstName"
 * Handles: "FirstName" -> "FirstName"
 */
function extractFirstName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  
  const trimmed = fullName.trim();
  
  // Check if name is in "SURNAME, FirstName MiddleName" format
  if (trimmed.includes(',')) {
    const afterComma = trimmed.split(',')[1]?.trim();
    if (afterComma) {
      // Get the first word after the comma (the actual first name)
      const firstName = afterComma.split(' ')[0];
      // Capitalize properly (handle ALL CAPS)
      return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }
  }
  
  // Standard "FirstName LastName" format - take first word
  const firstName = trimmed.split(' ')[0];
  
  // If it's all uppercase (like a surname), return empty to use generic greeting
  if (firstName === firstName.toUpperCase() && firstName.length > 2) {
    return '';
  }
  
  return firstName;
}

/**
 * Parse full name into first and last name components
 * Handles: "SURNAME, FirstName MiddleName" -> { firstName: "Firstname", lastName: "Surname" }
 * Handles: "FirstName LastName" -> { firstName: "FirstName", lastName: "LastName" }
 */
function parseFullName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const trimmed = fullName.trim();
  
  // Check if name is in "SURNAME, FirstName MiddleName" format
  if (trimmed.includes(',')) {
    const [surnameRaw, restRaw] = trimmed.split(',').map(s => s.trim());
    const restParts = restRaw?.split(' ').filter(Boolean) || [];
    const firstName = restParts[0] || '';
    // Capitalize properly
    const formattedFirst = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : '';
    const formattedLast = surnameRaw ? surnameRaw.charAt(0).toUpperCase() + surnameRaw.slice(1).toLowerCase() : '';
    return { firstName: formattedFirst, lastName: formattedLast };
  }
  
  // Standard "FirstName LastName" format
  const parts = trimmed.split(' ').filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || ''
  };
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
  const firstName = extractFirstName(recipientName);
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
    const firstName = extractFirstName(recipientName);
    const name = firstName ? ` ${firstName}` : '';
    
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
  // Idempotency check: Atomically claim this reminder to prevent double-sends
  // in autoscaled environments where multiple instances might pick up the same reminder
  const claimed = await claimReminder(reminder.id);
  if (!claimed) {
    console.log(`[QueryReminder] Reminder ${reminder.id} already being processed by another instance`);
    return { success: false, error: 'Already being processed by another instance' };
  }

  // Track whether we've updated the reminder to a final state
  // If we exit early without updating, we must release the claim
  let finalStateUpdated = false;

  try {
    console.log(`[QueryReminder] Processing ${reminder.channel} reminder ${reminder.id}:`, {
      tokenId: reminder.tokenId,
      recipientName: reminder.recipientName,
      recipientEmail: reminder.recipientEmail,
      recipientPhone: reminder.recipientPhone,
      scheduledAt: reminder.scheduledAt,
      projectId: reminder.projectId
    });

    // Check for and fix placeholder recipients or missing phone for SMS/voice
    const needsEmailFix = reminder.recipientEmail?.includes('placeholder') || reminder.recipientEmail?.includes('pending@');
    const needsPhoneFix = (reminder.channel === 'sms' || reminder.channel === 'voice') && !reminder.recipientPhone;
    
    if (needsEmailFix || needsPhoneFix) {
      console.log(`[QueryReminder] Reminder ${reminder.id} needs hydration: email=${needsEmailFix}, phone=${needsPhoneFix}`);
      const fixedReminder = await fixPlaceholderRecipient(reminder);
      if (!fixedReminder) {
        await releaseReminderClaim(reminder.id);
        return { success: false, error: needsPhoneFix ? 'No phone number available for SMS/voice reminder' : 'Could not resolve placeholder recipient' };
      }
      reminder = fixedReminder;
    }

    const queryStatus = await getQueryStatusForToken(reminder.tokenId);
    
    if (!queryStatus) {
      console.error(`[QueryReminder] Failed reminder ${reminder.id}: Query token ${reminder.tokenId} not found`);
      await releaseReminderClaim(reminder.id);
      return { success: false, error: 'Query token not found' };
    }

    if (queryStatus.allAnswered) {
      await db
        .update(scheduledQueryReminders)
        .set({ 
          status: 'cancelled',
          cancelledAt: new Date(),
          errorMessage: null // Clear the processing marker
        })
        .where(eq(scheduledQueryReminders.id, reminder.id));
      finalStateUpdated = true;
      
      console.log(`[QueryReminder] Cancelled reminder ${reminder.id} - all queries answered`);
      return { success: true, error: 'Cancelled - all queries answered' };
    }

    const token = await db
      .select()
      .from(queryResponseTokens)
      .where(eq(queryResponseTokens.id, reminder.tokenId))
      .limit(1);

    if (token.length === 0 || !token[0].token) {
      await releaseReminderClaim(reminder.id);
      return { success: false, error: 'Invalid query token' };
    }

    // Check if token has expired - don't send reminders for expired links
    if (token[0].expiresAt && new Date(token[0].expiresAt) < new Date()) {
      await db
        .update(scheduledQueryReminders)
        .set({ 
          status: 'cancelled',
          cancelledAt: new Date(),
          errorMessage: 'Token expired - link no longer valid'
        })
        .where(eq(scheduledQueryReminders.id, reminder.id));
      finalStateUpdated = true;
      
      console.log(`[QueryReminder] Cancelled reminder ${reminder.id} - token expired at ${token[0].expiresAt}`);
      return { success: true, error: 'Cancelled - token expired' };
    }

  // Always use production URL for emails
  const responseLink = `${getAppUrl()}/queries/respond/${token[0].token}`;
  
  // Validate select columns before querying to catch schema mismatches early
  const clientSelectCols = { 
    name: clients.name,
    tradingAs: clients.tradingAs,
    companyNumber: clients.companyNumber,
    companyUtr: clients.companyUtr,
    telephone: clients.companyTelephone,
    email: clients.email
  };
  validateSelectColumns(clientSelectCols, 'clientData query');
  
  // Get client data by joining through projects (queryResponseTokens has projectId, not clientId)
  const clientData = await db
    .select(clientSelectCols)
    .from(clients)
    .innerJoin(projects, eq(projects.clientId, clients.id))
    .where(eq(projects.id, token[0].projectId))
    .limit(1);

  const clientName = clientData[0]?.name || 'Your Company';
  const clientInfo = clientData[0];
  
  const projectSelectCols = {
    description: projects.description,
    dueDate: projects.dueDate,
    currentStatus: projects.currentStatus
  };
  validateSelectColumns(projectSelectCols, 'projectData query');
  
  const projectData = token[0].projectId ? await db
    .select(projectSelectCols)
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
        // Apply retry logic for transient network failures (up to 2 retries)
        result = await withRetry(
          () => sendEmailReminder(
            reminder.recipientEmail!,
            reminder.recipientName || '',
            clientName,
            queryStatus.pendingQueries,
            queryStatus.totalQueries,
            responseLink,
            unansweredQueries,
            token[0].expiresAt,
            reminder.messageIntro,
            reminder.messageSignoff
          ),
          2,
          'email send'
        );
      }
      break;

    case 'sms':
      if (!reminder.recipientPhone) {
        result = { success: false, error: 'No phone number for SMS' };
      } else {
        // Apply retry logic for transient network failures (up to 2 retries)
        result = await withRetry(
          () => sendSMSReminder(
            reminder.recipientPhone!,
            reminder.recipientName || '',
            queryStatus.pendingQueries,
            responseLink
          ),
          2,
          'SMS send'
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
          .set({ 
            scheduledAt: nextWeekdayTime,
            errorMessage: null // Clear the processing marker
          })
          .where(eq(scheduledQueryReminders.id, reminder.id));
        finalStateUpdated = true; // Status stays pending but claim is released via errorMessage clear
        console.log(`[QueryReminder] Rescheduling voice call ${reminder.id} to ${nextWeekdayTime.toISOString()} - weekend restriction`);
        return { success: false, error: 'Rescheduled to next weekday morning (weekend restriction)' };
      } else {
        const webhookConfig = token[0].projectId 
          ? await getDialoraWebhookConfig(token[0].projectId, reminder.tokenId)
          : null;
        
        const parsedName = parseFullName(reminder.recipientName || '');
        const dialoraContext: DialoraCallContext = {
          recipient: {
            firstName: parsedName.firstName,
            lastName: parsedName.lastName,
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
            name: projectInfo.description || undefined,
            dueDate: projectInfo.dueDate 
              ? new Date(projectInfo.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : undefined,
            status: projectInfo.currentStatus || undefined
          } : undefined,
          queries: {
            pending: queryStatus.pendingQueries,
            total: queryStatus.totalQueries,
            answered: queryStatus.answeredQueries
          }
        };
        
        // Apply retry logic for transient network failures (up to 2 retries)
        result = await withRetry(
          () => sendVoiceReminder(
            reminder.recipientPhone!,
            reminder.recipientName || '',
            reminder.recipientEmail || '',
            clientName,
            queryStatus.pendingQueries,
            queryStatus.totalQueries,
            webhookConfig,
            dialoraContext
          ),
          2,
          'voice call'
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
    finalStateUpdated = true;

    return result;
  } catch (error) {
    // Unexpected error - release claim and return failure
    console.error(`[QueryReminder] Unexpected error processing reminder ${reminder.id}:`, error);
    await releaseReminderClaim(reminder.id);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unexpected processing error' 
    };
  }
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
 * Check if a recipient email is a placeholder
 */
function isPlaceholderEmail(email: string | null): boolean {
  if (!email) return true;
  return email.includes('placeholder') || email.includes('pending@');
}

/**
 * Attempt to hydrate placeholder recipient data from project/client contacts
 * Returns updated recipient info or null if cannot be resolved
 * 
 * Note: Staff already selects the person when creating reminders, so this is only
 * a fallback for legacy reminders with placeholder/missing data.
 */
export async function hydrateRecipientFromProjectData(
  projectId: string | null
): Promise<{ email: string; name: string; phone: string | null } | null> {
  if (!projectId) return null;
  
  try {
    const projectData = await db
      .select({
        clientId: projects.clientId
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    
    if (!projectData[0]?.clientId) return null;
    
    const clientId = projectData[0].clientId;
    
    // Validate columns before queries
    const personSelectCols = {
      firstName: people.firstName,
      email: people.email,
      phone: people.telephone
    };
    validateSelectColumns(personSelectCols, 'hydrateRecipient person query');
    
    // Try to find primary contact via clientPeople junction table
    const primaryPerson = await db
      .select(personSelectCols)
      .from(people)
      .innerJoin(clientPeople, eq(clientPeople.personId, people.id))
      .where(and(
        eq(clientPeople.clientId, clientId),
        eq(clientPeople.isPrimaryContact, true)
      ))
      .limit(1);
    
    if (primaryPerson[0]?.email) {
      return {
        email: primaryPerson[0].email,
        name: primaryPerson[0].firstName || 'Client',
        phone: primaryPerson[0].phone || null
      };
    }
    
    // Fallback: any person linked to this client
    const anyPerson = await db
      .select(personSelectCols)
      .from(people)
      .innerJoin(clientPeople, eq(clientPeople.personId, people.id))
      .where(eq(clientPeople.clientId, clientId))
      .limit(1);
    
    if (anyPerson[0]?.email) {
      return {
        email: anyPerson[0].email,
        name: anyPerson[0].firstName || 'Client',
        phone: anyPerson[0].phone || null
      };
    }
    
    // Last resort: client's own email
    const clientFallbackCols = {
      name: clients.name,
      email: clients.email
    };
    validateSelectColumns(clientFallbackCols, 'hydrateRecipient client fallback query');
    
    const clientData = await db
      .select(clientFallbackCols)
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);
    
    if (clientData[0]?.email) {
      return {
        email: clientData[0].email,
        name: clientData[0].name || 'Client',
        phone: null
      };
    }
    
    return null;
  } catch (error) {
    console.error('[QueryReminder] Error hydrating recipient:', error);
    return null;
  }
}

/**
 * Fix placeholder recipients in a reminder before sending
 * Updates both the reminder and the token with real data
 */
export async function fixPlaceholderRecipient(reminder: ScheduledQueryReminder): Promise<ScheduledQueryReminder | null> {
  const needsEmailFix = isPlaceholderEmail(reminder.recipientEmail);
  const needsPhoneFix = (reminder.channel === 'sms' || reminder.channel === 'voice') && !reminder.recipientPhone;
  
  if (!needsEmailFix && !needsPhoneFix) {
    return reminder;
  }
  
  console.log(`[QueryReminder] Attempting to hydrate recipient for reminder ${reminder.id} (email=${needsEmailFix}, phone=${needsPhoneFix})`);
  
  const realRecipient = await hydrateRecipientFromProjectData(reminder.projectId);
  
  // For phone-only fix, we need at least a phone number
  if (needsPhoneFix && !realRecipient?.phone) {
    console.error(`[QueryReminder] Cannot hydrate phone for ${reminder.channel} reminder ${reminder.id} - no phone found, cancelling`);
    await db
      .update(scheduledQueryReminders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        errorMessage: `No phone number available for ${reminder.channel} reminder`
      })
      .where(eq(scheduledQueryReminders.id, reminder.id));
    return null;
  }
  
  // For email fix, we need at least an email
  if (needsEmailFix && !realRecipient?.email) {
    console.error(`[QueryReminder] Cannot hydrate email for reminder ${reminder.id} - no email found, cancelling`);
    await db
      .update(scheduledQueryReminders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        errorMessage: 'Could not resolve placeholder recipient - no valid contact found'
      })
      .where(eq(scheduledQueryReminders.id, reminder.id));
    return null;
  }
  
  // Build update object based on what needs fixing
  const reminderUpdate: Record<string, any> = {};
  const tokenUpdate: Record<string, any> = {};
  
  if (needsEmailFix && realRecipient) {
    reminderUpdate.recipientEmail = realRecipient.email;
    reminderUpdate.recipientName = realRecipient.name;
    tokenUpdate.recipientEmail = realRecipient.email;
    tokenUpdate.recipientName = realRecipient.name;
  }
  
  if (needsPhoneFix && realRecipient?.phone) {
    reminderUpdate.recipientPhone = realRecipient.phone;
  }
  
  if (Object.keys(reminderUpdate).length > 0) {
    await db
      .update(scheduledQueryReminders)
      .set(reminderUpdate)
      .where(eq(scheduledQueryReminders.id, reminder.id));
  }
  
  if (Object.keys(tokenUpdate).length > 0) {
    await db
      .update(queryResponseTokens)
      .set(tokenUpdate)
      .where(eq(queryResponseTokens.id, reminder.tokenId));
  }
  
  const fixedEmail = needsEmailFix ? realRecipient!.email : reminder.recipientEmail;
  const fixedPhone = needsPhoneFix ? realRecipient!.phone : reminder.recipientPhone;
  
  console.log(`[QueryReminder] Hydrated reminder ${reminder.id}: email=${fixedEmail}, phone=${fixedPhone}`);
  
  return {
    ...reminder,
    recipientEmail: fixedEmail,
    recipientName: needsEmailFix ? realRecipient!.name : reminder.recipientName,
    recipientPhone: fixedPhone
  };
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
