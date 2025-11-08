-- Rename task template tables to client request template tables
-- This migration renames the database tables to align with the new terminology

-- Rename the tables
ALTER TABLE IF EXISTS task_template_categories RENAME TO client_request_template_categories;
ALTER TABLE IF EXISTS task_templates RENAME TO client_request_templates;
ALTER TABLE IF EXISTS task_template_sections RENAME TO client_request_template_sections;
ALTER TABLE IF EXISTS task_template_questions RENAME TO client_request_template_questions;

-- Note: Indexes and constraints are automatically renamed by PostgreSQL when the table is renamed
-- Foreign key constraints in task_instances table still reference the correct tables
