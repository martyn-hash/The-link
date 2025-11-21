-- Add rich text notes and attachments columns to project_chronology table
ALTER TABLE "project_chronology" ADD COLUMN IF NOT EXISTS "notes_html" text;
ALTER TABLE "project_chronology" ADD COLUMN IF NOT EXISTS "attachments" jsonb;
