-- Migration: Update WebM voice note attachments to MP4 in messages table
-- Date: 2025-10-15
-- Purpose: Update JSONB attachments for Safari compatibility

-- Update fileName from .webm to .mp4 in messages.attachments JSONB array
UPDATE messages
SET attachments = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'fileName' LIKE '%.webm' AND elem->>'fileType' = 'audio/webm'
      THEN jsonb_set(
        jsonb_set(elem, '{fileName}', to_jsonb(REPLACE(elem->>'fileName', '.webm', '.mp4'))),
        '{fileType}', to_jsonb('audio/mp4'::text)
      )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(attachments) AS elem
)
WHERE attachments IS NOT NULL
  AND attachments::text LIKE '%audio/webm%';

-- Verify the update
SELECT
  id,
  attachments
FROM messages
WHERE attachments IS NOT NULL
  AND attachments::text LIKE '%voice-note%'
LIMIT 5;

-- Count affected records
SELECT COUNT(*) as updated_messages
FROM messages
WHERE attachments IS NOT NULL
  AND attachments::text LIKE '%audio/mp4%'
  AND attachments::text LIKE '%voice-note%';
