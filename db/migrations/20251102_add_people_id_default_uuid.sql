-- Migration: Add default UUID generation for people.id column
-- Date: 2025-11-02
-- Purpose: Fix CSV import bug where person records failed due to null ID values

-- Ensure pgcrypto extension is enabled (required for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add default UUID generation to people.id column
ALTER TABLE people ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verify the change
-- Any new INSERT INTO people without specifying an ID will now auto-generate one
