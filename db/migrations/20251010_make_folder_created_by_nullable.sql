-- Migration: Make document_folders.created_by nullable
-- Date: 2025-10-10
-- Purpose: Allow system-generated folders (like "Message Attachments") to have NULL creator
--          This is more accurate than attributing system actions to a specific user

-- Make created_by nullable
ALTER TABLE document_folders
ALTER COLUMN created_by DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN document_folders.created_by IS 'User who created the folder. NULL for system-generated folders (e.g., "Message Attachments")';

-- Verify the change
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'document_folders'
AND column_name = 'created_by';

-- Example: Update existing "Message Attachments" folders to NULL if needed
-- UPDATE document_folders
-- SET created_by = NULL
-- WHERE name = 'Message Attachments'
-- AND source = 'message_attachment';
