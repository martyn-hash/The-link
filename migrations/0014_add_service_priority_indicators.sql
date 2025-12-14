-- Create the service_priority_indicators junction table for multiple service-to-service indicator mappings
CREATE TABLE IF NOT EXISTS "service_priority_indicators" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "indicator_service_id" varchar NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "target_service_id" varchar NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "idx_service_priority_indicators_indicator" ON "service_priority_indicators" ("indicator_service_id");
CREATE INDEX IF NOT EXISTS "idx_service_priority_indicators_target" ON "service_priority_indicators" ("target_service_id");

-- Unique constraint to prevent duplicate mappings
CREATE UNIQUE INDEX IF NOT EXISTS "unique_indicator_target" ON "service_priority_indicators" ("indicator_service_id", "target_service_id");

-- Migrate existing data from the legacy showInProjectServiceId column
INSERT INTO "service_priority_indicators" ("indicator_service_id", "target_service_id")
SELECT "id", "show_in_project_service_id"
FROM "services"
WHERE "show_in_project_service_id" IS NOT NULL
ON CONFLICT ON CONSTRAINT "unique_indicator_target" DO NOTHING;
