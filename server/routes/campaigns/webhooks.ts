import { Router } from 'express';
import crypto from 'crypto';
import { campaignRecipientStorage, campaignAnalyticsStorage } from '../../storage/campaigns/index.js';

const router = Router();

function verifySendGridSignature(req: any): boolean {
  const verificationKey = process.env.SENDGRID_WEBHOOK_KEY;
  if (!verificationKey) return true;
  
  const signature = req.headers['x-twilio-email-event-webhook-signature'];
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'];
  
  if (!signature || !timestamp) return false;
  
  const payload = timestamp + JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', verificationKey)
    .update(payload)
    .digest('base64');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function verifyVoodooSignature(req: any): boolean {
  const secret = process.env.VOODOOSMS_WEBHOOK_SECRET;
  if (!secret) return true;
  
  const signature = req.headers['x-voodoo-signature'];
  if (!signature) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

router.post('/sendgrid', async (req, res) => {
  if (!verifySendGridSignature(req)) {
    console.warn('[Webhook] SendGrid signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      const recipientId = event.recipientId || event.custom_args?.recipientId;
      const messageId = event.sg_message_id;

      if (!recipientId && !messageId) continue;

      let recipient;
      if (recipientId) {
        recipient = await campaignRecipientStorage.getById(recipientId);
      } else if (messageId) {
        recipient = await campaignRecipientStorage.findByMessageId(messageId.split('.')[0]);
      }

      if (!recipient) continue;

      const eventType = event.event?.toLowerCase();
      const eventData = {
        timestamp: event.timestamp,
        email: event.email,
        category: event.category,
        url: event.url,
        ip: event.ip,
        userAgent: event.useragent,
        reason: event.reason,
        status: event.status,
        response: event.response,
        bounce_classification: event.bounce_classification,
      };

      switch (eventType) {
        case 'delivered':
          await campaignRecipientStorage.update(recipient.id, {
            status: 'delivered',
            deliveredAt: new Date(),
          });
          break;

        case 'open':
          if (!recipient.openedAt) {
            await campaignRecipientStorage.update(recipient.id, {
              openedAt: new Date(),
              openCount: 1,
            });
          } else {
            await campaignRecipientStorage.update(recipient.id, {
              openCount: (recipient.openCount || 0) + 1,
            });
          }
          break;

        case 'click':
          if (!recipient.clickedAt) {
            await campaignRecipientStorage.update(recipient.id, {
              clickedAt: new Date(),
              clickCount: 1,
            });
          } else {
            await campaignRecipientStorage.update(recipient.id, {
              clickCount: (recipient.clickCount || 0) + 1,
            });
          }
          break;

        case 'bounce':
        case 'dropped':
          await campaignRecipientStorage.update(recipient.id, {
            status: 'bounced',
            failureReason: event.reason || event.response || 'Email bounced',
          });
          break;

        case 'spamreport':
          await campaignRecipientStorage.update(recipient.id, {
            status: 'failed' as any,
            failureReason: 'Marked as spam',
          });
          break;

        case 'unsubscribe':
          await campaignRecipientStorage.update(recipient.id, {
            status: 'opted_out',
          });
          break;
      }

      await campaignAnalyticsStorage.createEngagementEvent({
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        eventType: eventType as any,
        channel: 'email',
        eventData,
        ipAddress: event.ip || null,
        userAgent: event.useragent || null,
      });
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] SendGrid error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/voodoosms', async (req, res) => {
  if (!verifyVoodooSignature(req)) {
    console.warn('[Webhook] VoodooSMS signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  try {
    const { reference_id, status, timestamp, dlr_status, recipient } = req.body;

    if (!reference_id) {
      return res.status(200).json({ received: true });
    }

    const recipientRecord = await campaignRecipientStorage.getById(reference_id);
    if (!recipientRecord) {
      return res.status(200).json({ received: true });
    }

    const normalizedStatus = (dlr_status || status || '').toLowerCase();
    const eventData = {
      timestamp,
      recipient,
      dlr_status,
      status,
      raw: req.body,
    };

    switch (normalizedStatus) {
      case 'delivered':
      case 'success':
        await campaignRecipientStorage.update(recipientRecord.id, {
          status: 'delivered',
          deliveredAt: new Date(),
        });
        break;

      case 'failed':
      case 'expired':
      case 'undeliverable':
        await campaignRecipientStorage.update(recipientRecord.id, {
          status: 'failed',
          failureReason: `SMS delivery failed: ${normalizedStatus}`,
        });
        break;

      case 'rejected':
        await campaignRecipientStorage.update(recipientRecord.id, {
          status: 'failed',
          failureReason: 'SMS rejected',
        });
        break;
    }

    await campaignAnalyticsStorage.createEngagementEvent({
      campaignId: recipientRecord.campaignId,
      recipientId: recipientRecord.id,
      eventType: normalizedStatus === 'delivered' || normalizedStatus === 'success' ? 'delivered' : 'failed' as any,
      channel: 'sms',
      eventData,
      ipAddress: null,
      userAgent: null,
    });

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] VoodooSMS error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/dialora', async (req, res) => {
  const dialoraSecret = process.env.DIALORA_WEBHOOK_SECRET;
  if (dialoraSecret) {
    const signatureHeader = req.headers['x-dialora-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    const expectedSignature = crypto
      .createHmac('sha256', dialoraSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.warn('[Webhook] Dialora signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }
  
  try {
    const { call_id, status, duration, recipient_id, transcript } = req.body;

    if (!recipient_id) {
      return res.status(200).json({ received: true });
    }

    const recipientRecord = await campaignRecipientStorage.getById(recipient_id);
    if (!recipientRecord) {
      return res.status(200).json({ received: true });
    }

    const eventData = {
      call_id,
      duration,
      transcript,
      raw: req.body,
    };

    switch (status) {
      case 'completed':
      case 'answered':
        await campaignRecipientStorage.update(recipientRecord.id, {
          status: 'delivered',
          deliveredAt: new Date(),
        });
        break;

      case 'no_answer':
      case 'busy':
      case 'failed':
        await campaignRecipientStorage.update(recipientRecord.id, {
          status: 'failed',
          failureReason: `Voice call failed: ${status}`,
        });
        break;
    }

    await campaignAnalyticsStorage.createEngagementEvent({
      campaignId: recipientRecord.campaignId,
      recipientId: recipientRecord.id,
      eventType: status === 'completed' || status === 'answered' ? 'delivered' : 'failed' as any,
      channel: 'voice',
      eventData,
      ipAddress: null,
      userAgent: null,
    });

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Webhook] Dialora error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
