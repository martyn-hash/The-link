import cron from 'node-cron';
import { processIgnoredCampaigns } from './services/campaigns/engagementScoreService.js';
import { wrapCronHandler } from './cron-telemetry';

let isRunning = false;

async function runIgnoredCampaignProcessing(): Promise<void> {
  if (isRunning) {
    console.log('[EngagementCron] Previous run still in progress, skipping');
    return;
  }

  isRunning = true;

  try {
    console.log('[EngagementCron] Starting ignored campaign processing...');
    const result = await processIgnoredCampaigns();
    console.log(`[EngagementCron] Completed: ${result.campaignsProcessed} campaigns processed, ${result.recipientsMarkedIgnored} recipients marked ignored`);
  } catch (error) {
    console.error('[EngagementCron] Fatal error:', error);
  } finally {
    isRunning = false;
  }
}

export function startEngagementCron(): void {
  // Run at 07:20 UK time on Sundays (staggered from :00)
  cron.schedule('20 7 * * 0', wrapCronHandler('EngagementCron', '20 7 * * 0', async () => {
    await runIgnoredCampaignProcessing();
  }), {
    timezone: "Europe/London"
  });

  console.log('[EngagementCron] Ignored campaign processor initialized (runs weekly at 07:20 UK time on Sundays)');
}

export { runIgnoredCampaignProcessing };
