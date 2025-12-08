import { storage } from './storage/index';
import {
  findCallRecording,
  requestCallTranscription,
  getTranscriptionResult,
  getCallRecordingUrl
} from './utils/userRingCentralClient';

interface TranscriptionJob {
  communicationId: string;
  userId: string;
  phoneNumber: string;
  callTime: Date;
  retryCount: number;
}

const pendingJobs: TranscriptionJob[] = [];
let isProcessing = false;

export function scheduleTranscription(
  communicationId: string,
  userId: string,
  phoneNumber: string,
  callTime: Date
) {
  console.log('[Transcription] Scheduling transcription for communication:', communicationId);
  
  pendingJobs.push({
    communicationId,
    userId,
    phoneNumber,
    callTime,
    retryCount: 0
  });

  if (!isProcessing) {
    startProcessing();
  }
}

async function startProcessing() {
  if (isProcessing) return;
  isProcessing = true;

  while (pendingJobs.length > 0) {
    const job = pendingJobs.shift();
    if (!job) continue;

    try {
      await processTranscriptionJob(job);
    } catch (error) {
      console.error('[Transcription] Error processing job:', error);
      
      if (job.retryCount < 3) {
        job.retryCount++;
        console.log('[Transcription] Retrying job, attempt:', job.retryCount + 1);
        pendingJobs.push(job);
      } else {
        console.log('[Transcription] Max retries exceeded for communication:', job.communicationId);
        await updateCommunicationTranscription(job.communicationId, {
          transcriptionStatus: 'failed',
          transcriptionError: 'Max retries exceeded'
        });
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  isProcessing = false;
}

async function processTranscriptionJob(job: TranscriptionJob) {
  console.log('[Transcription] Processing job for communication:', job.communicationId);

  await new Promise(resolve => setTimeout(resolve, 30000));

  const recording = await findCallRecording(job.userId, job.phoneNumber, job.callTime);

  if (!recording) {
    console.log('[Transcription] No recording found yet, will retry');
    throw new Error('Recording not yet available');
  }

  console.log('[Transcription] Found recording:', recording.recordingId);

  await updateCommunicationTranscription(job.communicationId, {
    recordingId: recording.recordingId,
    recordingUrl: recording.recordingUrl,
    transcriptionStatus: 'requesting'
  });

  const recordingUrlWithAuth = await getCallRecordingUrl(job.userId, recording.recordingId);
  
  const transcriptionJob = await requestCallTranscription(job.userId, recordingUrlWithAuth);
  const jobId = transcriptionJob.jobId;

  console.log('[Transcription] Transcription job started:', jobId);

  await updateCommunicationTranscription(job.communicationId, {
    transcriptionJobId: jobId,
    transcriptionStatus: 'processing'
  });

  await pollForTranscriptionResult(job.communicationId, job.userId, jobId);
}

async function pollForTranscriptionResult(communicationId: string, userId: string, jobId: string) {
  const maxAttempts = 30;
  const pollInterval = 10000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`[Transcription] Polling attempt ${attempt + 1}/${maxAttempts} for job:`, jobId);

    try {
      const result = await getTranscriptionResult(userId, jobId);

      if (result.status === 'Success' || result.status === 'Completed') {
        console.log('[Transcription] Transcription completed successfully');
        
        const transcript = extractTranscript(result);
        const summary = extractSummary(result);

        await updateCommunicationTranscription(communicationId, {
          transcriptionStatus: 'completed',
          transcript,
          summary
        });

        return;
      }

      if (result.status === 'Failed') {
        console.log('[Transcription] Transcription failed:', result.error);
        await updateCommunicationTranscription(communicationId, {
          transcriptionStatus: 'failed',
          transcriptionError: result.error || 'Transcription failed'
        });
        return;
      }

      console.log('[Transcription] Job status:', result.status);
    } catch (error) {
      console.error('[Transcription] Error polling for result:', error);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  console.log('[Transcription] Max polling attempts exceeded');
  await updateCommunicationTranscription(communicationId, {
    transcriptionStatus: 'failed',
    transcriptionError: 'Transcription timed out'
  });
}

function extractTranscript(result: any): string {
  try {
    if (result.response?.text) {
      return result.response.text;
    }
    
    if (result.response?.utterances) {
      return result.response.utterances
        .map((u: any) => `${u.speaker || 'Speaker'}: ${u.text}`)
        .join('\n');
    }

    if (result.utterances) {
      return result.utterances
        .map((u: any) => `${u.speaker || 'Speaker'}: ${u.text}`)
        .join('\n');
    }

    return JSON.stringify(result.response || result, null, 2);
  } catch (error) {
    console.error('[Transcription] Error extracting transcript:', error);
    return '';
  }
}

function extractSummary(result: any): string {
  try {
    if (result.response?.summary) {
      return result.response.summary;
    }
    
    if (result.summary) {
      return result.summary;
    }

    const transcript = extractTranscript(result);
    if (transcript.length > 200) {
      return transcript.substring(0, 200) + '...';
    }

    return transcript;
  } catch (error) {
    console.error('[Transcription] Error extracting summary:', error);
    return '';
  }
}

async function updateCommunicationTranscription(communicationId: string, updates: Record<string, any>) {
  try {
    const communication = await storage.getCommunicationById(communicationId);
    if (!communication) {
      console.error('[Transcription] Communication not found:', communicationId);
      return;
    }

    const currentMetadata = (communication.metadata || {}) as Record<string, any>;
    const newMetadata = { ...currentMetadata, ...updates };

    await storage.updateCommunication(communicationId, {
      metadata: newMetadata
    });

    console.log('[Transcription] Updated communication metadata:', communicationId);
  } catch (error) {
    console.error('[Transcription] Error updating communication:', error);
  }
}
