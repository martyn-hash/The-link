-- Migration: Update WebM voice note filenames to MP4
-- Date: 2025-10-15
-- Purpose: Update database filenames for Safari compatibility
--
-- NOTE: This only updates the filename metadata. The actual audio files
-- remain in WebM format but will work fine with the generic audio player.
-- For true MP4 conversion, use the Node.js migration script instead.

-- Update filenames in documents table (for voice notes stored as documents)
UPDATE documents
SET file_name = REPLACE(file_name, '.webm', '.mp4')
WHERE file_name LIKE '%.webm'
  AND file_type = 'audio/webm'
  AND (file_name LIKE 'voice-note-%' OR file_name LIKE 'Voice Note%');

-- Update file type to audio/mp4
UPDATE documents
SET file_type = 'audio/mp4'
WHERE file_type = 'audio/webm'
  AND (file_name LIKE 'voice-note-%' OR file_name LIKE 'Voice Note%');

-- Count affected records
SELECT COUNT(*) as updated_voice_notes
FROM documents
WHERE file_name LIKE 'voice-note-%.mp4'
  AND file_type = 'audio/mp4';

-- Rollback script (if needed):
-- UPDATE documents
-- SET file_name = REPLACE(file_name, '.mp4', '.webm'),
--     file_type = 'audio/webm'
-- WHERE file_name LIKE 'voice-note-%.mp4'
--   AND file_type = 'audio/mp4';
