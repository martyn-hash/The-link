-- Add show_in_project_service_id column to services table
-- This allows mapping a service to show as a priority indicator on another service's project cards
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "show_in_project_service_id" varchar;
