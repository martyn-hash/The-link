import cron from 'node-cron';
import { wrapCronHandler } from './cron-telemetry';
import { processDeliveryQueue } from './services/campaigns/campaignDeliveryService.js';
import { processScheduledCampaigns } from './services/campaigns/campaignWorkflowService.js';

let deliveryIsRunning = false;
let scheduledIsRunning = false;

async function runDeliveryQueueProcessor(): Promise<void> {
  if (deliveryIsRunning) {
    console.log('[CampaignCron] Delivery queue processor still running, skipping');
    return;
  }

  deliveryIsRunning = true;

  try {
    const result = await processDeliveryQueue(50);
    if (result.processed > 0) {
      console.log(`[CampaignCron] Delivery queue: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`);
    }
  } catch (error) {
    console.error('[CampaignCron] Delivery queue error:', error);
  } finally {
    deliveryIsRunning = false;
  }
}

async function runScheduledCampaignTrigger(): Promise<void> {
  if (scheduledIsRunning) {
    console.log('[CampaignCron] Scheduled campaign trigger still running, skipping');
    return;
  }

  scheduledIsRunning = true;

  try {
    const result = await processScheduledCampaigns();
    if (result.processed > 0) {
      console.log(`[CampaignCron] Scheduled campaigns: ${result.processed} checked, ${result.triggered} triggered`);
      if (result.errors.length > 0) {
        console.error('[CampaignCron] Scheduled campaign errors:', result.errors);
      }
    }
  } catch (error) {
    console.error('[CampaignCron] Scheduled campaign trigger error:', error);
  } finally {
    scheduledIsRunning = false;
  }
}

export function startCampaignCron(): void {
  cron.schedule('* * * * *', wrapCronHandler('CampaignDeliveryQueue', '* * * * *', async () => {
    await runDeliveryQueueProcessor();
  }, { useLock: true }));

  cron.schedule('* * * * *', wrapCronHandler('CampaignScheduledTrigger', '* * * * *', async () => {
    await runScheduledCampaignTrigger();
  }, { useLock: true }));

  console.log('[CampaignCron] Campaign delivery and scheduling crons initialized (every minute)');
}

export { runDeliveryQueueProcessor, runScheduledCampaignTrigger };
