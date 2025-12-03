-- Add bench_reason enum type
DO $$ BEGIN
  CREATE TYPE bench_reason AS ENUM ('legacy_work', 'missing_data', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add benched_at_deadline to inactive_reason enum
DO $$ BEGIN
  ALTER TYPE inactive_reason ADD VALUE IF NOT EXISTS 'benched_at_deadline';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add bench-related columns to projects table
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS is_benched BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS benched_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS benched_by_user_id VARCHAR REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS bench_reason bench_reason,
  ADD COLUMN IF NOT EXISTS bench_reason_other_text TEXT,
  ADD COLUMN IF NOT EXISTS pre_bench_status VARCHAR;

-- Add canBenchProjects permission to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_bench_projects BOOLEAN DEFAULT FALSE;

-- Create index for benched projects
CREATE INDEX IF NOT EXISTS idx_projects_is_benched ON projects(is_benched);

-- Grant bench permission to super admins and admins by default
UPDATE users SET can_bench_projects = TRUE WHERE super_admin = TRUE OR is_admin = TRUE;
