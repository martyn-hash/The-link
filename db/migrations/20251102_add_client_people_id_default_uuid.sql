-- Migration: Add default UUID generation for client_people.id column
-- Date: 2025-11-02
-- Purpose: Fix CSV import bug where client_people records failed due to null ID values

-- pgcrypto extension should already be enabled from previous migration, but ensure it exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add default UUID generation to client_people.id column
ALTER TABLE client_people ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verify the change
-- Any new INSERT INTO client_people without specifying an ID will now auto-generate one
