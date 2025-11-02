-- Migration: Add last login tracking to users table
-- Description: Adds lastLoginAt field to users table for first-login detection
-- Date: 2025-11-02

-- Add lastLoginAt column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Rollback script (if needed):
-- ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
