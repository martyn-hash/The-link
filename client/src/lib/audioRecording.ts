/**
 * Audio recording utilities with Safari compatibility
 *
 * Safari doesn't support WebM audio format. This module provides
 * browser-compatible audio recording functionality.
 */

export interface AudioRecordingConfig {
  mimeType: string;
  fileExtension: string;
  displayName: string;
}

/**
 * Get the best supported audio MIME type for the current browser
 */
export function getSupportedAudioMimeType(): AudioRecordingConfig {
  // Try formats in order of preference
  const formats: AudioRecordingConfig[] = [
    // WebM with Opus codec (best quality, smallest size) - Chrome, Firefox, Edge
    { mimeType: 'audio/webm;codecs=opus', fileExtension: 'webm', displayName: 'WebM' },
    { mimeType: 'audio/webm', fileExtension: 'webm', displayName: 'WebM' },

    // MP4 with AAC codec - Safari, iOS
    { mimeType: 'audio/mp4', fileExtension: 'mp4', displayName: 'MP4' },
    { mimeType: 'audio/aac', fileExtension: 'aac', displayName: 'AAC' },

    // MPEG (MP3) - fallback for older browsers
    { mimeType: 'audio/mpeg', fileExtension: 'mp3', displayName: 'MP3' },

    // WAV - universal fallback (large files)
    { mimeType: 'audio/wav', fileExtension: 'wav', displayName: 'WAV' },
  ];

  // Find first supported format
  for (const format of formats) {
    if (MediaRecorder.isTypeSupported(format.mimeType)) {
      console.log('[Audio Recording] Selected format:', format);
      return format;
    }
  }

  // Last resort: let browser choose (no mimeType specified)
  console.warn('[Audio Recording] No specific format supported, using browser default');
  return {
    mimeType: '',
    fileExtension: 'webm', // Most browsers default to WebM
    displayName: 'Audio'
  };
}

/**
 * Check if the current browser is Safari
 */
export function isSafari(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.indexOf('safari') !== -1 && ua.indexOf('chrome') === -1 && ua.indexOf('android') === -1;
}

/**
 * Get a user-friendly browser name
 */
export function getBrowserName(): string {
  const ua = navigator.userAgent.toLowerCase();

  if (ua.indexOf('firefox') !== -1) return 'Firefox';
  if (ua.indexOf('chrome') !== -1) return 'Chrome';
  if (ua.indexOf('safari') !== -1) return 'Safari';
  if (ua.indexOf('edge') !== -1 || ua.indexOf('edg/') !== -1) return 'Edge';
  if (ua.indexOf('opera') !== -1 || ua.indexOf('opr') !== -1) return 'Opera';

  return 'Unknown';
}

/**
 * Create MediaRecorder with best supported options
 */
export function createMediaRecorder(stream: MediaStream): {
  recorder: MediaRecorder;
  config: AudioRecordingConfig;
} {
  const config = getSupportedAudioMimeType();

  const options = config.mimeType ? { mimeType: config.mimeType } : undefined;
  const recorder = new MediaRecorder(stream, options);

  console.log('[Audio Recording] MediaRecorder created:', {
    browser: getBrowserName(),
    mimeType: config.mimeType || 'browser-default',
    state: recorder.state
  });

  return { recorder, config };
}

/**
 * Create a Blob from audio chunks with the correct MIME type
 */
export function createAudioBlob(chunks: Blob[], mimeType: string): Blob {
  // If no MIME type specified, try to detect from chunks
  if (!mimeType && chunks.length > 0) {
    mimeType = chunks[0].type || 'audio/webm';
  }

  return new Blob(chunks, { type: mimeType || 'audio/webm' });
}

/**
 * Generate a filename for a voice note
 */
export function generateVoiceNoteFilename(extension: string): string {
  const timestamp = Date.now();
  return `voice-note-${timestamp}.${extension}`;
}
