-- Migration: Add document source tracking fields
-- Description: Adds messageId, threadId, taskId fields to documents table
--              to track the source of document uploads and link them back to messages
-- Date: 2025-10-08

-- Step 1: Add new columns to documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS message_id VARCHAR REFERENCES messages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS thread_id VARCHAR REFERENCES message_threads(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS task_id VARCHAR;

-- Step 2: Create indexes for new columns (for query performance)
CREATE INDEX IF NOT EXISTS idx_documents_message_id ON documents(message_id);
CREATE INDEX IF NOT EXISTS idx_documents_thread_id ON documents(thread_id);
CREATE INDEX IF NOT EXISTS idx_documents_task_id ON documents(task_id);
CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);

-- Step 3: Update the source column to use proper enum values
-- First, update existing values to match new enum format
UPDATE documents
SET source = 'direct_upload'
WHERE source = 'direct upload' OR source IS NULL OR source = '';

UPDATE documents
SET source = 'portal_upload'
WHERE source = 'portal_upload' OR source LIKE '%portal%';

UPDATE documents
SET source = 'message_attachment'
WHERE source LIKE '%message%' OR source LIKE '%attachment%';

-- Step 4: Set source to NOT NULL with default
ALTER TABLE documents
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN source SET DEFAULT 'direct_upload';

-- Note: The enum constraint is enforced at the application level via drizzle-orm
-- PostgreSQL doesn't have a built-in CHECK constraint for the enum in this migration
-- but drizzle will handle it

-- Rollback script (if needed):
-- ALTER TABLE documents DROP COLUMN IF EXISTS message_id;
-- ALTER TABLE documents DROP COLUMN IF EXISTS thread_id;
-- ALTER TABLE documents DROP COLUMN IF EXISTS task_id;
-- DROP INDEX IF EXISTS idx_documents_message_id;
-- DROP INDEX IF EXISTS idx_documents_thread_id;
-- DROP INDEX IF EXISTS idx_documents_task_id;
-- DROP INDEX IF EXISTS idx_documents_source;
