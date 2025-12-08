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
import OpenAI from 'openai';

interface TranscriptionJob {
  communicationId: string;
  userId: string;
  phoneNumber: string;
  callTime: Date;
  retryCount: number;
}

const pendingJobs: TranscriptionJob[] = [];
let isProcessing = false;
let recoveryCompleted = false;

// Recover pending transcription jobs on startup
export async function recoverPendingTranscriptions() {
  if (recoveryCompleted) return;
  recoveryCompleted = true;
  
  try {
    console.log('[Transcription] Checking for pending transcription jobs to recover...');
    
    // Find communications with pending/requesting/processing status that are more than 2 minutes old
    // (to avoid interfering with jobs that are currently being processed)
    const pendingCommunications = await storage.getCommunicationsWithPendingTranscription();
    
    if (!pendingCommunications || pendingCommunications.length === 0) {
      console.log('[Transcription] No pending transcription jobs to recover');
      return;
    }
    
    console.log(`[Transcription] Found ${pendingCommunications.length} pending transcription job(s) to recover`);
    
    for (const comm of pendingCommunications) {
      const metadata = comm.metadata as Record<string, any> | null;
      const phoneNumber = metadata?.phoneNumber || '';
      const duration = metadata?.duration || 0;
      
      // Only retry if call was long enough and we have a phone number
      if (duration >= 5 && phoneNumber) {
        console.log(`[Transcription] Recovering job for communication: ${comm.id}`);
        scheduleTranscription(
          comm.id,
          comm.userId,
          phoneNumber,
          comm.actualContactTime ? new Date(comm.actualContactTime) : new Date(comm.createdAt || Date.now())
        );
      } else {
        // Mark as not_available if not recoverable
        await updateCommunicationTranscription(comm.id, {
          transcriptionStatus: 'not_available'
        });
      }
    }
  } catch (error) {
    console.error('[Transcription] Error recovering pending jobs:', error);
  }
}

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
      
      if (job.retryCount < 10) {
        job.retryCount++;
        console.log('[Transcription] Retrying job, attempt:', job.retryCount + 1);
        pendingJobs.push(job);
      } else {
        console.log('[Transcription] Max retries exceeded for communication:', job.communicationId);
        await updateCommunicationTranscription(job.communicationId, {
          transcriptionStatus: 'failed',
          transcriptionError: 'Recording not available after 10 attempts'
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

  // Step 2: Try RingCentral Speech-to-Text API
  console.log('[Transcription] RingSense not available, trying Speech-to-Text API...');
  
  try {
    const recordingUrlWithAuth = await getCallRecordingUrl(job.userId, recording.recordingId);
    
    const transcriptionJob = await requestCallTranscription(job.userId, recordingUrlWithAuth);
    const jobId = transcriptionJob.jobId;

    console.log('[Transcription] Transcription job started:', jobId);

    await updateCommunicationTranscription(job.communicationId, {
      transcriptionJobId: jobId,
      transcriptionStatus: 'processing'
    });

    await pollForTranscriptionResult(job.communicationId, job.userId, jobId);
    return;
  } catch (error: any) {
    // Check if this is an AI permission error
    const errorMessage = error?.message || '';
    if (errorMessage.includes('[AI] permission') || errorMessage.includes('403')) {
      console.log('[Transcription] RingCentral AI permission not available, falling back to OpenAI Whisper...');
    } else {
      throw error; // Re-throw other errors for retry
    }
  }

  // Step 3: Fall back to OpenAI Whisper for transcription
  console.log('[Transcription] Using OpenAI Whisper for transcription...');
  await transcribeWithOpenAI(job.communicationId, job.userId, recording.recordingId);
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
  // First, try RingCentral's AI summarization
  try {
    console.log('[Transcription] Trying RingCentral AI summarization...');
    const summaryJob = await requestTextSummarization(userId, utterances);
    
    if (summaryJob?.jobId) {
      const summaryJobId = summaryJob.jobId;
      console.log('[Transcription] RingCentral summary job started:', summaryJobId);
      
      // Poll for summary result (shorter timeout since we have a fallback)
      const maxSummaryAttempts = 10;
      const summaryPollInterval = 5000;
      
      for (let attempt = 0; attempt < maxSummaryAttempts; attempt++) {
        console.log(`[Transcription] Polling summary attempt ${attempt + 1}/${maxSummaryAttempts}`);
        
        try {
          const summaryResult = await getSummarizationResult(userId, summaryJobId);
          
          if (summaryResult.status === 'Success' || summaryResult.status === 'Completed') {
            console.log('[Transcription] RingCentral summary completed successfully');
            
            const summary = extractAISummary(summaryResult);
            
            await updateCommunicationTranscription(communicationId, {
              transcriptionStatus: 'completed',
              summary,
              summarySource: 'ringcentral'
            });
            
            return;
          }
          
          if (summaryResult.status === 'Failed') {
            console.log('[Transcription] RingCentral summary failed, trying OpenAI fallback...');
            break; // Exit loop to try OpenAI fallback
          }
        } catch (error) {
          console.error('[Transcription] Error polling RingCentral summary:', error);
        }
        
        await new Promise(resolve => setTimeout(resolve, summaryPollInterval));
      }
    }
  } catch (error) {
    console.log('[Transcription] RingCentral AI summarization not available:', error);
  }

  // Fallback to OpenAI for summary generation
  console.log('[Transcription] Using OpenAI fallback for summary...');
  const transcript = utterances.map(u => `${u.speakerId === '0' ? 'Agent' : 'Caller'}: ${u.text}`).join('\n');
  const openAISummary = await generateOpenAISummary(transcript);
  
  if (openAISummary) {
    await updateCommunicationTranscription(communicationId, {
      transcriptionStatus: 'completed',
      summary: openAISummary,
      summarySource: 'openai'
    });
  } else {
    // No summary available, just mark as complete
    await updateCommunicationTranscription(communicationId, {
      transcriptionStatus: 'completed'
    });
  }
}

// Generate summary using OpenAI as fallback
async function generateOpenAISummary(transcript: string): Promise<string | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('[Transcription] OpenAI API key not configured, skipping summary');
      return null;
    }

    if (!transcript || transcript.trim().length < 50) {
      console.log('[Transcription] Transcript too short for summary');
      return null;
    }

    console.log('[Transcription] Generating summary with OpenAI...');
    
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional assistant that summarizes phone call transcripts for a CRM system.
          
Create a concise summary (2-4 sentences) that captures:
- The main purpose/topic of the call
- Key decisions or outcomes
- Any action items or next steps mentioned

Be professional and factual. Focus on business-relevant information.
Do not include greetings, small talk, or filler content in the summary.`
        },
        {
          role: 'user',
          content: `Please summarize this phone call transcript:\n\n${transcript}`
        }
      ],
      temperature: 0.3,
      max_tokens: 300
    });

    const summary = response.choices[0]?.message?.content?.trim();
    
    if (summary) {
      console.log('[Transcription] OpenAI summary generated successfully');
      return summary;
    }
    
    return null;
  } catch (error) {
    console.error('[Transcription] Error generating OpenAI summary:', error);
    return null;
  }
}

// Transcribe recording using OpenAI Whisper (fallback when RingCentral AI is not available)
async function transcribeWithOpenAI(communicationId: string, userId: string, recordingId: string) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('[Transcription] OpenAI API key not configured, marking as not available');
      await updateCommunicationTranscription(communicationId, {
        transcriptionStatus: 'not_available',
        transcriptionError: 'No transcription API available'
      });
      return;
    }

    await updateCommunicationTranscription(communicationId, {
      transcriptionStatus: 'processing'
    });

    // Download the recording from RingCentral
    console.log('[Transcription] Downloading recording from RingCentral...');
    const recordingBuffer = await downloadRecording(userId, recordingId);
    
    if (!recordingBuffer) {
      console.log('[Transcription] Failed to download recording');
      await updateCommunicationTranscription(communicationId, {
        transcriptionStatus: 'failed',
        transcriptionError: 'Failed to download recording'
      });
      return;
    }

    console.log(`[Transcription] Recording downloaded: ${recordingBuffer.length} bytes`);

    // Transcribe using OpenAI Whisper
    console.log('[Transcription] Transcribing with OpenAI Whisper...');
    const openai = new OpenAI({ apiKey });
    
    // Create a file-like object for the API
    const file = new File([recordingBuffer], 'recording.mp3', { type: 'audio/mpeg' });
    
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    });

    const transcript = transcription.toString().trim();
    
    if (!transcript || transcript.length < 10) {
      console.log('[Transcription] Transcript too short or empty');
      await updateCommunicationTranscription(communicationId, {
        transcriptionStatus: 'completed',
        transcript: transcript || '',
        transcriptionSource: 'openai_whisper'
      });
      return;
    }

    console.log('[Transcription] Transcript generated, generating summary...');

    // Generate summary using OpenAI
    const summary = await generateOpenAISummary(transcript);

    await updateCommunicationTranscription(communicationId, {
      transcriptionStatus: 'completed',
      transcript,
      summary: summary || '',
      transcriptionSource: 'openai_whisper',
      summarySource: 'openai'
    });

    console.log('[Transcription] OpenAI transcription and summary completed');
  } catch (error) {
    console.error('[Transcription] Error with OpenAI transcription:', error);
    await updateCommunicationTranscription(communicationId, {
      transcriptionStatus: 'failed',
      transcriptionError: error instanceof Error ? error.message : 'OpenAI transcription failed'
    });
  }
}

// Download recording from RingCentral
async function downloadRecording(userId: string, recordingId: string): Promise<Buffer | null> {
  try {
    const { getUserRingCentralSDK } = await import('./utils/userRingCentralClient.js');
    const sdk = await getUserRingCentralSDK(userId);
    if (!sdk) {
      console.log('[Transcription] RingCentral client not available');
      return null;
    }

    const platform = sdk.platform();
    const response = await platform.get(`/restapi/v1.0/account/~/recording/${recordingId}/content`);
    
    // Get the raw response as a buffer
    const buffer = await response.buffer();
    return buffer;
  } catch (error) {
    console.error('[Transcription] Error downloading recording:', error);
    return null;
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
