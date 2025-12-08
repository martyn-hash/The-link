CREATE TYPE "public"."email_sla_status" AS ENUM('active', 'complete', 'snoozed');--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "sla_response_days" integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "sla_working_days_only" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "working_hours_start" varchar DEFAULT '09:00';--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "working_hours_end" varchar DEFAULT '17:30';--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "working_days" jsonb DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb;--> statement-breakpoint
ALTER TABLE "project_types" ADD COLUMN "use_voice_ai_for_queries" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "use_voice_ai_for_queries" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "email_threads" ADD COLUMN "sla_status" "email_sla_status" DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "email_threads" ADD COLUMN "sla_became_active_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_threads" ADD COLUMN "sla_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "email_threads" ADD COLUMN "sla_completed_by" varchar;--> statement-breakpoint
ALTER TABLE "email_threads" ADD COLUMN "sla_snooze_until" timestamp;--> statement-breakpoint
CREATE INDEX "sms_templates_name_idx" ON "sms_templates" USING btree ("name");--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_sla_completed_by_users_id_fk" FOREIGN KEY ("sla_completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_threads_sla_status" ON "email_threads" USING btree ("sla_status");--> statement-breakpoint
CREATE INDEX "idx_email_threads_sla_became_active_at" ON "email_threads" USING btree ("sla_became_active_at");