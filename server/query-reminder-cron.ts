/**
 * Query Reminder Cron Job
 * 
 * Processes scheduled query reminders every hour.
 * Checks for due reminders and sends them via the appropriate channel.
 * 
 * Features:
 * - Only runs 07:00-22:00 UK time
 * - Smart cessation when all queries answered
 * - Full audit trail logging
 * - Hourly monitoring email to martyn@growth.accountants
 */

import cron from 'node-cron';
import { getDueReminders, processReminder, checkAndCancelRemindersIfComplete, migrateePlaceholderReminders } from './services/queryReminderService';
import { db } from './db';
import { projectChronology, scheduledQueryReminders, communications, queryResponseTokens, projects } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getUncachableSendGridClient } from './lib/sendgrid';

interface ReminderProcessingResult {
  reminderId: string;
  channel: string;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  success: boolean;
  error?: string;
}

interface CronRunStats {
  runTime: Date;
  withinOperatingHours: boolean;
  totalDue: number;
  voiceRescheduled: number;
  processed: number;
  sent: number;
  cancelled: number;
  failed: number;
  results: ReminderProcessingResult[];
}

let isRunning = false;

/**
 * Check if current time is within operating hours (7am-10pm UK time)
 */
function isWithinOperatingHours(): boolean {
  const ukTime = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });
  const hour = parseInt(ukTime.split(',')[1].trim().split(':')[0], 10);
  return hour >= 7 && hour < 22;
}

/**
 * Check if current day is a weekend (Saturday or Sunday) in UK time
 */
function isWeekendInUK(): boolean {
  const ukDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  const dayOfWeek = ukDate.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
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
 * Reschedule weekend voice reminders to next weekday morning and filter them out
 * Belt-and-braces protection that both reschedules AND filters
 */
async function rescheduleAndFilterWeekendVoiceReminders(reminders: any[]): Promise<any[]> {
  if (!isWeekendInUK()) {
    return reminders;
  }
  
  const voiceReminders = reminders.filter(r => r.channel === 'voice');
  const nonVoiceReminders = reminders.filter(r => r.channel !== 'voice');
  
  if (voiceReminders.length > 0) {
    const nextWeekdayTime = getNextWeekdayMorning();
    
    for (const reminder of voiceReminders) {
      try {
        await db
          .update(scheduledQueryReminders)
          .set({ scheduledAt: nextWeekdayTime })
          .where(eq(scheduledQueryReminders.id, reminder.id));
        console.log(`[QueryReminderCron] Rescheduled voice reminder ${reminder.id} to ${nextWeekdayTime.toISOString()} - weekend restriction`);
      } catch (error) {
        console.error(`[QueryReminderCron] Failed to reschedule voice reminder ${reminder.id}:`, error);
      }
    }
  }
  
  return nonVoiceReminders;
}

/**
 * Process all due query reminders
 */
async function processQueryReminders(): Promise<void> {
  const stats: CronRunStats = {
    runTime: new Date(),
    withinOperatingHours: isWithinOperatingHours(),
    totalDue: 0,
    voiceRescheduled: 0,
    processed: 0,
    sent: 0,
    cancelled: 0,
    failed: 0,
    results: []
  };

  if (isRunning) {
    console.log('[QueryReminderCron] Previous run still in progress, skipping');
    return;
  }

  if (!stats.withinOperatingHours) {
    console.log('[QueryReminderCron] Outside operating hours (07:00-22:00 UK), skipping');
    return;
  }

  isRunning = true;

  try {
    const allDueReminders = await getDueReminders();
    stats.totalDue = allDueReminders.length;
    
    if (allDueReminders.length === 0) {
      return;
    }

    const dueReminders = await rescheduleAndFilterWeekendVoiceReminders(allDueReminders);
    stats.voiceRescheduled = allDueReminders.length - dueReminders.length;
    
    if (dueReminders.length === 0) {
      console.log(`[QueryReminderCron] ${allDueReminders.length} reminder(s) due but all rescheduled (weekend voice restriction)`);
      return;
    }

    console.log(`[QueryReminderCron] Processing ${dueReminders.length} due reminder(s)${stats.voiceRescheduled > 0 ? ` (${stats.voiceRescheduled} voice rescheduled for weekend)` : ''}`);

    for (const reminder of dueReminders) {
      stats.processed++;
      
      try {
        const wasComplete = await checkAndCancelRemindersIfComplete(reminder.tokenId);
        
        if (wasComplete) {
          console.log(`[QueryReminderCron] Skipped reminder ${reminder.id} - queries already complete`);
          stats.cancelled++;
          stats.results.push({
            reminderId: reminder.id,
            channel: reminder.channel,
            recipientName: reminder.recipientName,
            recipientEmail: reminder.recipientEmail,
            recipientPhone: reminder.recipientPhone,
            success: true,
            error: 'Cancelled - queries complete'
          });
          continue;
        }

        const result = await processReminder(reminder);
        
        if (result.success) {
          console.log(`[QueryReminderCron] Sent ${reminder.channel} reminder ${reminder.id}`);
          stats.sent++;
          stats.results.push({
            reminderId: reminder.id,
            channel: reminder.channel,
            recipientName: reminder.recipientName,
            recipientEmail: reminder.recipientEmail,
            recipientPhone: reminder.recipientPhone,
            success: true
          });
          
          if (reminder.projectId) {
            try {
              await db.insert(projectChronology).values({
                projectId: reminder.projectId,
                entryType: 'communication_added',
                toStatus: 'no_change',
                notes: `Automated ${reminder.channel} reminder sent to ${reminder.recipientName || 'client'} for pending bookkeeping queries`,
                changeReason: 'Query Reminder Sent'
              });
            } catch (chronError) {
              console.error('[QueryReminderCron] Failed to log chronology:', chronError);
            }

            // Log to communications table for client comms history
            try {
              // Map channel to communication type - only process known channels
              const channelTypeMap: Record<string, 'email_sent' | 'sms_sent' | 'phone_call'> = {
                email: 'email_sent',
                sms: 'sms_sent',
                voice: 'phone_call'
              };
              
              const communicationType = channelTypeMap[reminder.channel];
              if (!communicationType) {
                console.warn(`[QueryReminderCron] Unknown channel "${reminder.channel}" - skipping communications log`);
              } else {
                const tokenData = await db
                  .select({ createdById: queryResponseTokens.createdById })
                  .from(queryResponseTokens)
                  .where(eq(queryResponseTokens.id, reminder.tokenId))
                  .limit(1);

                const projectData = await db
                  .select({ clientId: projects.clientId })
                  .from(projects)
                  .where(eq(projects.id, reminder.projectId))
                  .limit(1);

                if (tokenData[0]?.createdById && projectData[0]?.clientId) {
                  const channelLabels: Record<string, string> = {
                    email: 'Email',
                    sms: 'SMS',
                    voice: 'Voice Call'
                  };
                  const channelLabel = channelLabels[reminder.channel] || reminder.channel;
                  const queryCount = reminder.queriesRemaining || 'pending';
                  const queryWord = (reminder.queriesRemaining === 1) ? 'query' : 'queries';
                  
                  // Use actual send time - the send just succeeded, so use now; sentAt may not be set yet
                  const sentTimestamp = new Date();
                  
                  await db.insert(communications).values({
                    clientId: projectData[0].clientId,
                    projectId: reminder.projectId,
                    userId: tokenData[0].createdById,
                    type: communicationType,
                    subject: `Query Reminder ${channelLabel}`,
                    content: `Automated ${channelLabel.toLowerCase()} reminder sent to ${reminder.recipientName || 'client'} for ${queryCount} outstanding bookkeeping ${queryWord}.`,
                    actualContactTime: sentTimestamp,
                    isRead: true,
                    metadata: {
                      source: 'query_reminder',
                      channel: reminder.channel,
                      reminderId: reminder.id,
                      tokenId: reminder.tokenId,
                      recipientName: reminder.recipientName,
                      recipientEmail: reminder.recipientEmail,
                      recipientPhone: reminder.recipientPhone,
                      queriesRemaining: reminder.queriesRemaining,
                      queriesTotal: reminder.queriesTotal
                    }
                  });
                  console.log(`[QueryReminderCron] Logged ${reminder.channel} reminder to communications for client ${projectData[0].clientId}`);
                }
              }
            } catch (commError) {
              console.error('[QueryReminderCron] Failed to log to communications:', commError);
            }
          }
        } else {
          console.error(`[QueryReminderCron] Failed to send reminder ${reminder.id}:`, result.error);
          stats.failed++;
          stats.results.push({
            reminderId: reminder.id,
            channel: reminder.channel,
            recipientName: reminder.recipientName,
            recipientEmail: reminder.recipientEmail,
            recipientPhone: reminder.recipientPhone,
            success: false,
            error: result.error
          });
        }
      } catch (reminderError) {
        console.error(`[QueryReminderCron] Error processing reminder ${reminder.id}:`, reminderError);
        stats.failed++;
        stats.results.push({
          reminderId: reminder.id,
          channel: reminder.channel,
          recipientName: reminder.recipientName,
          recipientEmail: reminder.recipientEmail,
          recipientPhone: reminder.recipientPhone,
          success: false,
          error: reminderError instanceof Error ? reminderError.message : 'Unknown error'
        });
      }
    }
  } catch (error) {
    console.error('[QueryReminderCron] Error in reminder processing:', error);
  } finally {
    isRunning = false;
    await sendMonitoringEmail(stats);
  }
}

/**
 * Send monitoring email to martyn@growth.accountants
 * Shows summary of the cron run with all reminder details
 */
async function sendMonitoringEmail(stats: CronRunStats): Promise<void> {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    if (!client) {
      console.log('[QueryReminderCron] SendGrid not configured, skipping monitoring email');
      return;
    }

    const ukTime = stats.runTime.toLocaleString('en-GB', { timeZone: 'Europe/London' });
    
    const isProduction = !!process.env.REPLIT_DEPLOYMENT;
    const envLabel = isProduction ? 'LIVE' : 'DEV';
    const envColor = isProduction ? '#28a745' : '#dc3545';
    
    const statusEmoji = stats.failed > 0 ? '⚠️' : (stats.sent > 0 ? '✅' : '📋');
    const subject = `[${envLabel}] ${statusEmoji} Query Reminder Cron Report - ${ukTime}`;

    let resultsTableHtml = '';
    if (stats.results.length > 0) {
      resultsTableHtml = `
        <h3 style="margin-top: 20px;">Reminder Details:</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
          <tr style="background-color: #f0f0f0;">
            <th>Channel</th>
            <th>Recipient</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Error</th>
          </tr>
          ${stats.results.map(r => `
            <tr style="background-color: ${r.success ? '#e8f5e9' : '#ffebee'};">
              <td>${r.channel}</td>
              <td>${r.recipientName || '-'}</td>
              <td>${r.recipientEmail || '-'}</td>
              <td>${r.recipientPhone || '-'}</td>
              <td>${r.success ? '✅ Sent' : '❌ Failed'}</td>
              <td>${r.error || '-'}</td>
            </tr>
          `).join('')}
        </table>
      `;
    }

    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="display: inline-block; background-color: ${envColor}; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold; font-size: 16px; margin-bottom: 15px;">
          ${envLabel} ENVIRONMENT
        </div>
        <h2>Query Reminder Cron Report</h2>
        <p><strong>Environment:</strong> ${isProduction ? 'Production (Live)' : 'Development'}</p>
        <p><strong>Run Time:</strong> ${ukTime}</p>
        <p><strong>Operating Hours:</strong> ${stats.withinOperatingHours ? 'Yes (07:00-22:00 UK)' : 'No - Outside operating hours'}</p>
        
        <h3>Summary:</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; font-size: 14px;">
          <tr>
            <td><strong>Total Due Reminders</strong></td>
            <td>${stats.totalDue}</td>
          </tr>
          <tr>
            <td><strong>Voice Rescheduled (Weekend)</strong></td>
            <td>${stats.voiceRescheduled}</td>
          </tr>
          <tr>
            <td><strong>Processed</strong></td>
            <td>${stats.processed}</td>
          </tr>
          <tr style="background-color: #e8f5e9;">
            <td><strong>Successfully Sent</strong></td>
            <td>${stats.sent}</td>
          </tr>
          <tr>
            <td><strong>Cancelled (queries complete)</strong></td>
            <td>${stats.cancelled}</td>
          </tr>
          <tr style="background-color: ${stats.failed > 0 ? '#ffebee' : 'inherit'};">
            <td><strong>Failed</strong></td>
            <td>${stats.failed}</td>
          </tr>
        </table>
        
        ${resultsTableHtml}
        
        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          This is an automated monitoring email from the Query Reminder System (${isProduction ? 'Production' : 'Development'} environment).
        </p>
      </div>
    `;

    await client.send({
      to: 'martyn@growth.accountants',
      from: fromEmail,
      subject,
      html: body
    });

    console.log('[QueryReminderCron] Monitoring email sent to martyn@growth.accountants');
  } catch (error) {
    console.error('[QueryReminderCron] Failed to send monitoring email:', error);
  }
}

/**
 * Start the query reminder cron job
 * Runs every hour on the hour
 */
export async function startQueryReminderCron(): Promise<void> {
  // Run migration to fix placeholder reminders on startup
  try {
    await migrateePlaceholderReminders();
  } catch (error) {
    console.error('[QueryReminderCron] Error running placeholder migration:', error);
  }

  cron.schedule('0 * * * *', async () => {
    await processQueryReminders();
  });

  console.log('[QueryReminderCron] Started - running hourly during 07:00-22:00 UK time');
}
