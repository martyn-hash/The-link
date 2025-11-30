DO $$ BEGIN
    CREATE TYPE "public"."service_client_type" AS ENUM('company', 'individual', 'both');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "applicable_client_types" "service_client_type" DEFAULT 'company';
--> statement-breakpoint
UPDATE "services" SET "applicable_client_types" = CASE 
    WHEN "is_personal_service" = true THEN 'individual'::service_client_type
    ELSE 'company'::service_client_type
END WHERE "applicable_client_types" IS NULL OR "applicable_client_types" = 'company';
