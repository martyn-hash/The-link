-- Migration: Add notification and reminder system tables
-- Date: 2025-11-08
-- Description: Adds tables for project type notifications, client request reminders,
--              scheduled notifications, notification history, and company settings

-- Create enums
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('email', 'sms', 'push');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_category AS ENUM ('project', 'stage');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE date_reference AS ENUM ('start_date', 'due_date');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE date_offset_type AS ENUM ('before', 'on', 'after');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE stage_trigger AS ENUM ('entry', 'exit');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('scheduled', 'sent', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Company settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email_sender_name VARCHAR DEFAULT 'The Link Team',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Project type notifications table
CREATE TABLE IF NOT EXISTS project_type_notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type_id VARCHAR NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
  
  -- Notification metadata
  category notification_category NOT NULL,
  notification_type notification_type NOT NULL,
  
  -- For project notifications
  date_reference date_reference,
  offset_type date_offset_type,
  offset_days INTEGER,
  
  -- For stage notifications
  stage_id VARCHAR REFERENCES kanban_stages(id) ON DELETE CASCADE,
  stage_trigger stage_trigger,
  
  -- Notification content
  email_title VARCHAR,
  email_body TEXT,
  sms_content VARCHAR(160),
  push_content VARCHAR(200),
  
  -- Client Request Template linking
  client_request_template_id VARCHAR REFERENCES client_request_templates(id) ON DELETE SET NULL,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Check constraints
  CONSTRAINT check_project_notification_fields CHECK (
    category != 'project' OR (date_reference IS NOT NULL AND offset_type IS NOT NULL AND offset_days IS NOT NULL)
  ),
  CONSTRAINT check_stage_notification_fields CHECK (
    category != 'stage' OR (stage_id IS NOT NULL AND stage_trigger IS NOT NULL)
  ),
  CONSTRAINT check_email_notification_content CHECK (
    notification_type != 'email' OR (email_title IS NOT NULL AND email_body IS NOT NULL)
  ),
  CONSTRAINT check_sms_notification_content CHECK (
    notification_type != 'sms' OR sms_content IS NOT NULL
  ),
  CONSTRAINT check_push_notification_content CHECK (
    notification_type != 'push' OR push_content IS NOT NULL
  )
);

-- Create indexes for project_type_notifications
CREATE INDEX IF NOT EXISTS idx_project_type_notifications_project_type_id ON project_type_notifications(project_type_id);
CREATE INDEX IF NOT EXISTS idx_project_type_notifications_stage_id ON project_type_notifications(stage_id);
CREATE INDEX IF NOT EXISTS idx_project_type_notifications_category ON project_type_notifications(category);

-- Client request reminders table
CREATE TABLE IF NOT EXISTS client_request_reminders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type_notification_id VARCHAR NOT NULL REFERENCES project_type_notifications(id) ON DELETE CASCADE,
  
  notification_type notification_type NOT NULL,
  days_after_creation INTEGER NOT NULL,
  
  -- Notification content
  email_title VARCHAR,
  email_body TEXT,
  sms_content VARCHAR(160),
  push_content VARCHAR(200),
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Check constraints
  CONSTRAINT check_email_reminder_content CHECK (
    notification_type != 'email' OR (email_title IS NOT NULL AND email_body IS NOT NULL)
  ),
  CONSTRAINT check_sms_reminder_content CHECK (
    notification_type != 'sms' OR sms_content IS NOT NULL
  ),
  CONSTRAINT check_push_reminder_content CHECK (
    notification_type != 'push' OR push_content IS NOT NULL
  )
);

-- Create indexes for client_request_reminders
CREATE INDEX IF NOT EXISTS idx_client_request_reminders_notification_id ON client_request_reminders(project_type_notification_id);

-- Scheduled notifications table
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links to source configuration
  project_type_notification_id VARCHAR REFERENCES project_type_notifications(id) ON DELETE CASCADE,
  client_request_reminder_id VARCHAR REFERENCES client_request_reminders(id) ON DELETE CASCADE,
  
  -- Recipient information
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  person_id VARCHAR REFERENCES people(id) ON DELETE CASCADE,
  client_service_id VARCHAR REFERENCES client_services(id) ON DELETE CASCADE,
  project_id VARCHAR REFERENCES projects(id) ON DELETE CASCADE,
  task_instance_id VARCHAR REFERENCES task_instances(id) ON DELETE CASCADE,
  
  -- Notification details
  notification_type notification_type NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  
  -- Content (copied from template at scheduling time)
  email_title VARCHAR,
  email_body TEXT,
  sms_content VARCHAR(160),
  push_content VARCHAR(200),
  
  -- Status tracking
  status notification_status NOT NULL DEFAULT 'scheduled',
  sent_at TIMESTAMP,
  failure_reason TEXT,
  cancelled_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMP,
  cancel_reason TEXT,
  
  -- Reminder control
  stop_reminders BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Check constraint
  CONSTRAINT check_notification_source CHECK (
    (project_type_notification_id IS NOT NULL AND client_request_reminder_id IS NULL) OR
    (project_type_notification_id IS NULL AND client_request_reminder_id IS NOT NULL)
  )
);

-- Create indexes for scheduled_notifications
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_project_type_notification_id ON scheduled_notifications(project_type_notification_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_client_request_reminder_id ON scheduled_notifications(client_request_reminder_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_client_id ON scheduled_notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_person_id ON scheduled_notifications(person_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_client_service_id ON scheduled_notifications(client_service_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_project_id ON scheduled_notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_task_instance_id ON scheduled_notifications(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_status ON scheduled_notifications(status);

-- Notification history table
CREATE TABLE IF NOT EXISTS notification_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_notification_id VARCHAR REFERENCES scheduled_notifications(id) ON DELETE SET NULL,
  
  -- Recipient details (denormalized for audit trail)
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  recipient_email VARCHAR,
  recipient_phone VARCHAR,
  
  -- Notification details
  notification_type notification_type NOT NULL,
  content TEXT NOT NULL,
  
  -- Status
  status notification_status NOT NULL,
  sent_at TIMESTAMP,
  failure_reason TEXT,
  
  -- Metadata
  external_id VARCHAR,
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for notification_history
CREATE INDEX IF NOT EXISTS idx_notification_history_scheduled_notification_id ON notification_history(scheduled_notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_client_id ON notification_history(client_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_notification_type ON notification_history(notification_type);

-- Insert default company settings if not exists
INSERT INTO company_settings (email_sender_name)
SELECT 'The Link Team'
WHERE NOT EXISTS (SELECT 1 FROM company_settings LIMIT 1);
