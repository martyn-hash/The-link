import cron from 'node-cron';
import { processSequenceProgression } from './services/campaigns/campaignSequenceService.js';
import { wrapCronHandler } from './cron-telemetry';

let isRunning = false;

async function runSequenceProgression(): Promise<void> {
  if (isRunning) {
    console.log('[SequenceCron] Previous run still in progress, skipping');
    return;
  }

  isRunning = true;

  try {
    console.log('[SequenceCron] Starting sequence progression check...');
    const result = await processSequenceProgression();
    console.log(`[SequenceCron] Completed: ${result.sequencesProcessed} sequences, ${result.recipientsProgressed} recipients progressed`);
    
    if (result.errors.length > 0) {
      console.error('[SequenceCron] Errors encountered:', result.errors);
    }
  } catch (error) {
    console.error('[SequenceCron] Fatal error:', error);
  } finally {
    isRunning = false;
  }
}

export function startSequenceCron(): void {
  cron.schedule('*/15 8-19 * * 1-5', wrapCronHandler('SequenceProgressionFrequent', '*/15 8-19 * * 1-5', async () => {
    await runSequenceProgression();
  }, { useLock: true, timezone: 'Europe/London' }), {
    timezone: "Europe/London"
  });

  cron.schedule('15 6 * * *', wrapCronHandler('SequenceProgressionDaily', '15 6 * * *', async () => {
    await runSequenceProgression();
  }, { useLock: true, timezone: 'Europe/London' }), {
    timezone: "Europe/London"
  });

  console.log('[SequenceCron] Sequence progression initialized (every 15min 08:00-19:00 UK Mon-Fri + daily 06:15 UK)');
}

export { runSequenceProgression };
