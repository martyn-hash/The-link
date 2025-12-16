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
  // Run at 06:15 UK time (staggered from :00)
  cron.schedule('15 6 * * *', wrapCronHandler('SequenceCron', '15 6 * * *', async () => {
    await runSequenceProgression();
  }), {
    timezone: "Europe/London"
  });

  console.log('[SequenceCron] Sequence progression scheduler initialized (runs daily at 06:15 UK time)');
}

export { runSequenceProgression };
