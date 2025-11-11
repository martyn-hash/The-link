-- Migration: Drop unique constraint on people.primary_email
-- Created: 2025-11-11
-- Description: Remove unique constraint to allow duplicate emails temporarily while data cleanup is performed

DROP INDEX IF EXISTS "unique_people_primary_email";
