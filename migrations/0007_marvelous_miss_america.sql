ALTER TYPE "public"."notification_status" ADD VALUE 'suppressed';--> statement-breakpoint
CREATE TABLE "scheduling_exceptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_log_id" varchar,
	"service_type" varchar NOT NULL,
	"client_service_id" varchar,
	"people_service_id" varchar,
	"client_id" varchar,
	"service_name" varchar,
	"client_or_person_name" varchar,
	"error_type" varchar NOT NULL,
	"error_message" text NOT NULL,
	"frequency" varchar,
	"next_start_date" timestamp,
	"next_due_date" timestamp,
	"resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolved_by_user_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "funny_error_phrases" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "funny_error_phrases_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"phrase" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_seen_phrases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"phrase_id" integer NOT NULL,
	"seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_user_phrase" UNIQUE("user_id","phrase_id")
);
--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "ai_system_prompt_notes" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "ai_system_prompt_emails" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "ai_system_prompt_stage_notifications" text;--> statement-breakpoint
ALTER TABLE "project_type_notifications" ADD COLUMN "eligible_stage_ids" text[];--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD COLUMN "eligible_stage_ids_snapshot" text[];--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD COLUMN "suppressed_at" timestamp;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD COLUMN "reactivated_at" timestamp;--> statement-breakpoint
ALTER TABLE "scheduling_exceptions" ADD CONSTRAINT "scheduling_exceptions_run_log_id_scheduling_run_logs_id_fk" FOREIGN KEY ("run_log_id") REFERENCES "public"."scheduling_run_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_exceptions" ADD CONSTRAINT "scheduling_exceptions_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_exceptions" ADD CONSTRAINT "scheduling_exceptions_people_service_id_people_services_id_fk" FOREIGN KEY ("people_service_id") REFERENCES "public"."people_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_exceptions" ADD CONSTRAINT "scheduling_exceptions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduling_exceptions" ADD CONSTRAINT "scheduling_exceptions_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_seen_phrases" ADD CONSTRAINT "user_seen_phrases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_seen_phrases" ADD CONSTRAINT "user_seen_phrases_phrase_id_funny_error_phrases_id_fk" FOREIGN KEY ("phrase_id") REFERENCES "public"."funny_error_phrases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scheduling_exceptions_run_log_id" ON "scheduling_exceptions" USING btree ("run_log_id");--> statement-breakpoint
CREATE INDEX "idx_scheduling_exceptions_service_type" ON "scheduling_exceptions" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "idx_scheduling_exceptions_client_service_id" ON "scheduling_exceptions" USING btree ("client_service_id");--> statement-breakpoint
CREATE INDEX "idx_scheduling_exceptions_people_service_id" ON "scheduling_exceptions" USING btree ("people_service_id");--> statement-breakpoint
CREATE INDEX "idx_scheduling_exceptions_error_type" ON "scheduling_exceptions" USING btree ("error_type");--> statement-breakpoint
CREATE INDEX "idx_scheduling_exceptions_resolved" ON "scheduling_exceptions" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "idx_scheduling_exceptions_created_at" ON "scheduling_exceptions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_funny_error_phrases_category" ON "funny_error_phrases" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_user_seen_phrases_user_id" ON "user_seen_phrases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_seen_phrases_phrase_id" ON "user_seen_phrases" USING btree ("phrase_id");