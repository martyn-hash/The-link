-- Migration: Add time governance fields to kanban_stages
-- Created: 2025-09-18
-- Description: Add maxInstanceTime and maxTotalTime fields for time governance

ALTER TABLE "kanban_stages" ADD COLUMN "max_instance_time" integer;
ALTER TABLE "kanban_stages" ADD COLUMN "max_total_time" integer;