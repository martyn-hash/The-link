import { storage } from './storage/index';
import {
  findCallRecording,
  requestCallTranscription,
  getTranscriptionResult,
  getCallRecordingUrl,
  getRingSenseInsights,
  requestTextSummarization,
  getSummarizationResult
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

  // Wait for RingCentral to process the recording
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

  // Step 1: Try RingSense API first (provides transcript + summary + insights in one call)
  console.log('[Transcription] Trying RingSense API for insights...');
  const ringSenseResult = await getRingSenseInsights(job.userId, recording.recordingId);
  
  if (ringSenseResult) {
    console.log('[Transcription] Got RingSense insights!');
    
    // Extract transcript and summary from RingSense response
    const transcript = extractRingSenseTranscript(ringSenseResult);
    const summary = extractRingSenseSummary(ringSenseResult);
    const nextSteps = extractRingSenseNextSteps(ringSenseResult);
    
    await updateCommunicationTranscription(job.communicationId, {
      transcriptionStatus: 'completed',
      transcript,
      summary,
      nextSteps,
      source: 'ringsense'
    });
    
    return;
  }

  // Step 2: Fall back to Speech-to-Text API
  console.log('[Transcription] RingSense not available, using Speech-to-Text API...');
  
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

// Extract transcript from RingSense insights
function extractRingSenseTranscript(insights: any): string {
  try {
    if (insights.transcript?.utterances) {
      return insights.transcript.utterances
        .map((u: any) => `${u.speakerName || u.speakerId || 'Speaker'}: ${u.text}`)
        .join('\n');
    }
    if (insights.transcript?.text) {
      return insights.transcript.text;
    }
    return '';
  } catch (error) {
    console.error('[Transcription] Error extracting RingSense transcript:', error);
    return '';
  }
}

// Extract summary from RingSense insights
function extractRingSenseSummary(insights: any): string {
  try {
    if (insights.summary?.paragraphs) {
      return insights.summary.paragraphs
        .map((p: any) => p.text || p)
        .join('\n\n');
    }
    if (insights.summary?.text) {
      return insights.summary.text;
    }
    if (typeof insights.summary === 'string') {
      return insights.summary;
    }
    return '';
  } catch (error) {
    console.error('[Transcription] Error extracting RingSense summary:', error);
    return '';
  }
}

// Extract next steps/action items from RingSense insights
function extractRingSenseNextSteps(insights: any): string[] {
  try {
    if (insights.nextSteps?.items) {
      return insights.nextSteps.items.map((item: any) => item.text || item);
    }
    if (Array.isArray(insights.nextSteps)) {
      return insights.nextSteps.map((item: any) => item.text || item);
    }
    return [];
  } catch (error) {
    console.error('[Transcription] Error extracting RingSense next steps:', error);
    return [];
  }
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
        const utterances = extractUtterances(result);
        
        // Save transcript first
        await updateCommunicationTranscription(communicationId, {
          transcript,
          source: 'speech-to-text'
        });
        
        // Step 3: Request AI summary if we have utterances
        if (utterances.length > 0) {
          console.log('[Transcription] Requesting AI summary...');
          await requestAndPollSummary(communicationId, userId, utterances);
        } else {
          // No utterances for summarization, use truncated transcript as fallback
          const fallbackSummary = transcript.length > 200 ? transcript.substring(0, 200) + '...' : transcript;
          await updateCommunicationTranscription(communicationId, {
            transcriptionStatus: 'completed',
            summary: fallbackSummary
          });
        }

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

// Request and poll for AI-generated summary
async function requestAndPollSummary(communicationId: string, userId: string, utterances: Array<{ start: number; end: number; speakerId: string; text: string }>) {
  try {
    const summaryJob = await requestTextSummarization(userId, utterances);
    
    if (!summaryJob?.jobId) {
      console.log('[Transcription] No summary job ID returned, marking as complete without summary');
      await updateCommunicationTranscription(communicationId, {
        transcriptionStatus: 'completed'
      });
      return;
    }
    
    const summaryJobId = summaryJob.jobId;
    console.log('[Transcription] Summary job started:', summaryJobId);
    
    // Poll for summary result
    const maxSummaryAttempts = 20;
    const summaryPollInterval = 5000;
    
    for (let attempt = 0; attempt < maxSummaryAttempts; attempt++) {
      console.log(`[Transcription] Polling summary attempt ${attempt + 1}/${maxSummaryAttempts}`);
      
      try {
        const summaryResult = await getSummarizationResult(userId, summaryJobId);
        
        if (summaryResult.status === 'Success' || summaryResult.status === 'Completed') {
          console.log('[Transcription] Summary completed successfully');
          
          const summary = extractAISummary(summaryResult);
          
          await updateCommunicationTranscription(communicationId, {
            transcriptionStatus: 'completed',
            summary
          });
          
          return;
        }
        
        if (summaryResult.status === 'Failed') {
          console.log('[Transcription] Summary failed, completing without summary');
          await updateCommunicationTranscription(communicationId, {
            transcriptionStatus: 'completed'
          });
          return;
        }
      } catch (error) {
        console.error('[Transcription] Error polling for summary:', error);
      }
      
      await new Promise(resolve => setTimeout(resolve, summaryPollInterval));
    }
    
    // Timed out waiting for summary, complete without it
    console.log('[Transcription] Summary polling timed out, completing without summary');
    await updateCommunicationTranscription(communicationId, {
      transcriptionStatus: 'completed'
    });
  } catch (error) {
    console.error('[Transcription] Error requesting summary:', error);
    await updateCommunicationTranscription(communicationId, {
      transcriptionStatus: 'completed'
    });
  }
}

// Extract utterances in the format needed for summarization
function extractUtterances(result: any): Array<{ start: number; end: number; speakerId: string; text: string }> {
  try {
    const utterances = result.response?.utterances || result.utterances || [];
    return utterances.map((u: any) => ({
      start: u.start || 0,
      end: u.end || 0,
      speakerId: String(u.speakerId || u.speaker || '0'),
      text: u.text || ''
    })).filter((u: any) => u.text.trim().length > 0);
  } catch (error) {
    console.error('[Transcription] Error extracting utterances:', error);
    return [];
  }
}

// Extract AI-generated summary from summarization result
function extractAISummary(result: any): string {
  try {
    // Prefer abstractive summary (AI-generated unique text)
    if (result.response?.abstractiveSummary?.length > 0) {
      return result.response.abstractiveSummary.map((s: any) => s.text || s).join('\n\n');
    }
    
    // Fall back to extractive summary (key excerpts)
    if (result.response?.extractiveSummary?.length > 0) {
      return result.response.extractiveSummary.map((s: any) => s.text || s).join('\n\n');
    }
    
    // Try direct summary fields
    if (result.response?.summary) {
      return result.response.summary;
    }
    
    if (result.summary) {
      return result.summary;
    }
    
    return '';
  } catch (error) {
    console.error('[Transcription] Error extracting AI summary:', error);
    return '';
  }
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
