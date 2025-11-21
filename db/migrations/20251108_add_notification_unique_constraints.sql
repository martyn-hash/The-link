-- Migration: Add unique constraints to prevent duplicate notifications
-- Date: 2025-11-08
-- Description: Adds unique constraints to scheduled_notifications table to prevent
--              duplicate notifications from being created

-- Add unique constraint for project notifications tied to client services
-- This prevents duplicate notifications for the same notification template, client service, and scheduled date
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_notifications_unique_project_notification
ON scheduled_notifications (project_type_notification_id, client_service_id, person_id, scheduled_for)
WHERE project_type_notification_id IS NOT NULL 
  AND client_service_id IS NOT NULL
  AND status = 'scheduled';

-- Add unique constraint for client request reminders tied to task instances
-- This prevents duplicate reminders for the same reminder template, task instance, and scheduled date
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_notifications_unique_task_reminder
ON scheduled_notifications (client_request_reminder_id, task_instance_id, person_id, scheduled_for)
WHERE client_request_reminder_id IS NOT NULL 
  AND task_instance_id IS NOT NULL
  AND status = 'scheduled';
