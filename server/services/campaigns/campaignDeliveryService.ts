import { db } from '../../db.js';
import { campaignRecipients, campaignDeliveryQueue, campaigns, campaignEngagement } from '@shared/schema';
import { eq, and, lte, asc, sql } from 'drizzle-orm';
import { campaignRecipientStorage, campaignDeliveryStorage, campaignAnalyticsStorage, campaignStorage } from '../../storage/campaigns/index.js';
import { resolveMergeData, renderMessageForRecipient } from './mergeFieldService.js';
import { campaignMessageStorage } from '../../storage/campaigns/index.js';
import { contactPreferencesStorage } from '../../storage/contacts/index.js';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [60, 300, 900];

export async function queueCampaignForDelivery(campaignId: string): Promise<void> {
  const recipients = await campaignRecipientStorage.getByCampaignId(campaignId, {
    status: 'pending'
  });

  for (const recipient of recipients) {
    if (recipient.manuallyRemoved) continue;

    const mergeData = await resolveMergeData(
      recipient.clientId,
      recipient.personId,
      campaignId
    );

    const message = await campaignMessageStorage.getForChannel(campaignId, recipient.channel);
    if (!message) continue;

    const preferenceToken = await contactPreferencesStorage.createPreferenceToken(recipient.personId);
    const rendered = await renderMessageForRecipient(message, mergeData, preferenceToken);

    await campaignRecipientStorage.update(recipient.id, {
      resolvedMergeData: mergeData as any,
      renderedContent: rendered as any,
      status: 'queued',
      queuedAt: new Date(),
    });

    await campaignDeliveryStorage.create({
      recipientId: recipient.id,
      channel: recipient.channel,
      priority: 5,
      status: 'pending',
      attemptCount: 0,
      maxAttempts: MAX_RETRY_ATTEMPTS,
      nextAttemptAt: new Date(),
    });
  }
}

export async function processDeliveryQueue(batchSize: number = 100): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const pending = await campaignDeliveryStorage.getPendingItems(batchSize);
  
  let succeeded = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await campaignDeliveryStorage.update(item.id, { status: 'processing' });

      const recipient = await campaignRecipientStorage.getById(item.recipientId);
      if (!recipient) {
        await campaignDeliveryStorage.update(item.id, { 
          status: 'failed_permanent',
          lastError: 'Recipient not found'
        });
        failed++;
        continue;
      }

      const result = await sendToChannel(recipient);

      if (result.success) {
        await campaignRecipientStorage.update(recipient.id, {
          status: 'sent',
          sentAt: new Date(),
          externalMessageId: result.messageId,
        });
        await campaignDeliveryStorage.update(item.id, { status: 'completed' });
        await logEngagementEvent(recipient.campaignId, recipient.id, 'sent', recipient.channel);
        succeeded++;
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      await handleDeliveryFailure(item, error);
      failed++;
    }
  }

  await checkCampaignCompletion();

  return { processed: pending.length, succeeded, failed };
}

async function handleDeliveryFailure(item: any, error: Error): Promise<void> {
  const newAttemptCount = (item.attemptCount || 0) + 1;

  if (newAttemptCount >= item.maxAttempts) {
    await campaignDeliveryStorage.update(item.id, {
      status: 'failed_permanent',
      attemptCount: newAttemptCount,
      lastAttemptAt: new Date(),
      lastError: error.message,
    });

    const recipient = await campaignRecipientStorage.getById(item.recipientId);
    if (recipient) {
      await campaignRecipientStorage.update(item.recipientId, {
        status: 'failed',
        failureReason: `Failed after ${newAttemptCount} attempts: ${error.message}`,
      });
      await logEngagementEvent(recipient.campaignId, recipient.id, 'failed', recipient.channel, {
        error: error.message,
        attempts: newAttemptCount,
      });
    }
  } else {
    const delaySeconds = RETRY_DELAYS[newAttemptCount - 1] || 900;
    const nextAttempt = new Date(Date.now() + delaySeconds * 1000);

    await campaignDeliveryStorage.update(item.id, {
      status: 'pending',
      attemptCount: newAttemptCount,
      lastAttemptAt: new Date(),
      lastError: error.message,
      nextAttemptAt: nextAttempt,
    });
  }
}

async function sendToChannel(recipient: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const rendered = recipient.renderedContent as any;

  switch (recipient.channel) {
    case 'email':
      return sendEmailViaSendGrid({
        to: recipient.channelAddress,
        subject: rendered?.subject || 'No Subject',
        html: rendered?.body || '',
        text: rendered?.plainTextBody || '',
        customArgs: {
          campaignId: recipient.campaignId,
          recipientId: recipient.id,
        },
      });

    case 'sms':
      return sendSmsViaVoodoo({
        to: recipient.channelAddress,
        message: rendered?.smsContent || rendered?.body || '',
        reference: recipient.id,
      });

    case 'voice':
      return { success: false, error: 'Voice channel not yet implemented' };

    default:
      return { success: false, error: `Unknown channel: ${recipient.channel}` };
  }
}

async function sendEmailViaSendGrid(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  customArgs?: Record<string, string>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const sgMail = await import('@sendgrid/mail');
    
    if (!process.env.SENDGRID_API_KEY) {
      return { success: false, error: 'SendGrid API key not configured' };
    }

    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: params.to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@thelink.app',
      subject: params.subject,
      text: params.text,
      html: params.html,
      customArgs: params.customArgs,
    };

    const [response] = await sgMail.default.send(msg);
    const messageId = response.headers['x-message-id'] as string;

    return { success: true, messageId };
  } catch (error: any) {
    console.error('[Campaign Delivery] SendGrid error:', error);
    return { success: false, error: error.message || 'SendGrid delivery failed' };
  }
}

async function sendSmsViaVoodoo(params: {
  to: string;
  message: string;
  reference: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const apiKey = process.env.VOODOOSMS_API_KEY;
    const senderId = process.env.VOODOOSMS_SENDER_ID || 'TheLink';

    if (!apiKey) {
      return { success: false, error: 'VoodooSMS API key not configured' };
    }

    const response = await fetch('https://www.voodooSMS.com/vapi/server/sendSMS', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        uid: apiKey,
        pass: process.env.VOODOOSMS_PASSWORD || '',
        dest: params.to,
        msg: params.message,
        orig: senderId,
        reference: params.reference,
        format: 'json',
      }).toString(),
    });

    const result = await response.json();

    if (result.result === 200 || result.result === '200') {
      return { success: true, messageId: result.reference_id || params.reference };
    }

    return { success: false, error: result.resultText || 'SMS delivery failed' };
  } catch (error: any) {
    console.error('[Campaign Delivery] VoodooSMS error:', error);
    return { success: false, error: error.message || 'VoodooSMS delivery failed' };
  }
}

async function logEngagementEvent(
  campaignId: string,
  recipientId: string,
  eventType: string,
  channel: string,
  eventData?: any
): Promise<void> {
  try {
    await campaignAnalyticsStorage.createEngagementEvent({
      campaignId,
      recipientId,
      eventType: eventType as any,
      channel: channel as any,
      eventData: eventData || null,
      ipAddress: null,
      userAgent: null,
    });
  } catch (error) {
    console.error('[Campaign Delivery] Failed to log engagement:', error);
  }
}

async function checkCampaignCompletion(): Promise<void> {
  const sendingCampaigns = await campaignStorage.getByStatus('sending');

  for (const campaign of sendingCampaigns) {
    const pendingCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignDeliveryQueue)
      .where(and(
        eq(campaignDeliveryQueue.status, 'pending'),
        sql`${campaignDeliveryQueue.recipientId} IN (
          SELECT id FROM campaign_recipients WHERE campaign_id = ${campaign.id}
        )`
      ));

    const processingCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignDeliveryQueue)
      .where(and(
        eq(campaignDeliveryQueue.status, 'processing'),
        sql`${campaignDeliveryQueue.recipientId} IN (
          SELECT id FROM campaign_recipients WHERE campaign_id = ${campaign.id}
        )`
      ));

    if ((pendingCount[0]?.count || 0) === 0 && (processingCount[0]?.count || 0) === 0) {
      await campaignStorage.update(campaign.id, {
        status: 'sent',
        sentAt: new Date(),
      });
      console.log(`[Campaign Delivery] Campaign ${campaign.id} marked as sent`);
    }
  }
}

export async function getDeliveryStats(campaignId: string): Promise<{
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
}> {
  const statusCounts = await campaignRecipientStorage.countByStatus(campaignId);

  return {
    queued: statusCounts['queued'] || 0,
    sent: statusCounts['sent'] || 0,
    delivered: statusCounts['delivered'] || 0,
    failed: (statusCounts['failed'] || 0) + (statusCounts['bounced'] || 0),
    pending: statusCounts['pending'] || 0,
  };
}

export async function pauseCampaignDelivery(campaignId: string): Promise<void> {
  const campaign = await campaignStorage.getById(campaignId);
  if (!campaign || campaign.status !== 'sending') {
    throw new Error('Campaign is not currently sending');
  }

  await campaignStorage.update(campaignId, { status: 'paused' });
}

export async function resumeCampaignDelivery(campaignId: string): Promise<void> {
  const campaign = await campaignStorage.getById(campaignId);
  if (!campaign || campaign.status !== 'paused') {
    throw new Error('Campaign is not paused');
  }

  await campaignStorage.update(campaignId, { 
    status: 'sending',
    sendingStartedAt: new Date()
  });
}
