CREATE TYPE "public"."bench_reason" AS ENUM('legacy_work', 'missing_data', 'other');--> statement-breakpoint
CREATE TYPE "public"."query_status" AS ENUM('open', 'answered_by_staff', 'sent_to_client', 'answered_by_client', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."reminder_channel" AS ENUM('email', 'sms', 'voice');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('pending', 'sent', 'failed', 'cancelled', 'skipped');--> statement-breakpoint
ALTER TYPE "public"."inactive_reason" ADD VALUE 'benched_at_deadline';--> statement-breakpoint
CREATE TABLE "qbo_qc_approval_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"previous_status" varchar,
	"new_status" varchar,
	"note" text,
	"performed_by" varchar NOT NULL,
	"performed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qbo_qc_result_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" varchar NOT NULL,
	"external_id" varchar,
	"external_type" varchar,
	"label" varchar NOT NULL,
	"description" text,
	"amount" numeric(15, 2),
	"txn_date" date,
	"approval_status" varchar DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"resolution_note" text,
	"resolved_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qbo_qc_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" varchar NOT NULL,
	"check_code" varchar NOT NULL,
	"check_name" varchar NOT NULL,
	"section" varchar NOT NULL,
	"status" varchar NOT NULL,
	"value" text,
	"expected" text,
	"summary" text,
	"metadata" jsonb,
	"item_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qbo_qc_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"connection_id" varchar NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"total_checks" integer DEFAULT 0,
	"passed_checks" integer DEFAULT 0,
	"warning_checks" integer DEFAULT 0,
	"failed_checks" integer DEFAULT 0,
	"blocked_checks" integer DEFAULT 0,
	"score" numeric(5, 2),
	"api_call_count" integer DEFAULT 0,
	"triggered_by" varchar,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error_log" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bookkeeping_queries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"date" timestamp,
	"description" text,
	"money_in" numeric(12, 2),
	"money_out" numeric(12, 2),
	"has_vat" boolean,
	"our_query" text,
	"comment" text,
	"client_response" text,
	"client_attachments" jsonb,
	"status" "query_status" DEFAULT 'open' NOT NULL,
	"created_by_id" varchar NOT NULL,
	"answered_by_id" varchar,
	"resolved_by_id" varchar,
	"sent_to_client_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"answered_at" timestamp,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "query_response_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accessed_at" timestamp,
	"completed_at" timestamp,
	"created_by_id" varchar NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"recipient_name" varchar(255),
	"query_count" integer NOT NULL,
	"query_ids" text[],
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "query_response_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "scheduled_query_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"channel" "reminder_channel" NOT NULL,
	"status" "reminder_status" DEFAULT 'pending' NOT NULL,
	"recipient_phone" varchar(50),
	"recipient_email" varchar(255),
	"recipient_name" varchar(255),
	"message" text,
	"message_intro" text,
	"message_signoff" text,
	"queries_remaining" integer,
	"queries_total" integer,
	"sent_at" timestamp,
	"error_message" text,
	"dialora_call_id" varchar(255),
	"cancelled_by_id" varchar,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_bench_projects" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_email" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_calendar" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "ai_button_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "scheduling_emails_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "client_services" ADD COLUMN "target_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "client_services" ADD COLUMN "intended_target_delivery_day" integer;--> statement-breakpoint
ALTER TABLE "people_services" ADD COLUMN "target_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "people_services" ADD COLUMN "intended_target_delivery_day" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "ch_target_delivery_days_offset" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "show_in_project_service_id" varchar;--> statement-breakpoint
ALTER TABLE "project_types" ADD COLUMN "dialora_settings" jsonb;--> statement-breakpoint
ALTER TABLE "project_scheduling_history" ADD COLUMN "previous_target_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "project_scheduling_history" ADD COLUMN "new_target_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "target_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_benched" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "benched_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "benched_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "bench_reason" "bench_reason";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "bench_reason_other_text" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "pre_bench_status" varchar;--> statement-breakpoint
ALTER TABLE "scheduling_exceptions" ADD COLUMN "target_delivery_date" timestamp;--> statement-breakpoint
ALTER TABLE "message_threads" ADD COLUMN "auto_archived_by_project" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "project_message_threads" ADD COLUMN "auto_archived_by_project" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "internal_tasks" ADD COLUMN "is_quick_reminder" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "internal_tasks" ADD COLUMN "reminder_notification_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "qbo_qc_approval_history" ADD CONSTRAINT "qbo_qc_approval_history_item_id_qbo_qc_result_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."qbo_qc_result_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_qc_approval_history" ADD CONSTRAINT "qbo_qc_approval_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_qc_result_items" ADD CONSTRAINT "qbo_qc_result_items_result_id_qbo_qc_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."qbo_qc_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_qc_result_items" ADD CONSTRAINT "qbo_qc_result_items_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_qc_results" ADD CONSTRAINT "qbo_qc_results_run_id_qbo_qc_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."qbo_qc_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_qc_runs" ADD CONSTRAINT "qbo_qc_runs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_qc_runs" ADD CONSTRAINT "qbo_qc_runs_connection_id_qbo_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."qbo_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_qc_runs" ADD CONSTRAINT "qbo_qc_runs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookkeeping_queries" ADD CONSTRAINT "bookkeeping_queries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookkeeping_queries" ADD CONSTRAINT "bookkeeping_queries_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookkeeping_queries" ADD CONSTRAINT "bookkeeping_queries_answered_by_id_users_id_fk" FOREIGN KEY ("answered_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookkeeping_queries" ADD CONSTRAINT "bookkeeping_queries_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_response_tokens" ADD CONSTRAINT "query_response_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_response_tokens" ADD CONSTRAINT "query_response_tokens_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_query_reminders" ADD CONSTRAINT "scheduled_query_reminders_token_id_query_response_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."query_response_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_query_reminders" ADD CONSTRAINT "scheduled_query_reminders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_query_reminders" ADD CONSTRAINT "scheduled_query_reminders_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_approval_history_item_id" ON "qbo_qc_approval_history" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_approval_history_performed_at" ON "qbo_qc_approval_history" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_result_items_result_id" ON "qbo_qc_result_items" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_result_items_approval_status" ON "qbo_qc_result_items" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_result_items_external_id" ON "qbo_qc_result_items" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_results_run_id" ON "qbo_qc_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_results_check_code" ON "qbo_qc_results" USING btree ("check_code");--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_results_status" ON "qbo_qc_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_runs_client_id" ON "qbo_qc_runs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_runs_connection_id" ON "qbo_qc_runs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_runs_status" ON "qbo_qc_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_qbo_qc_runs_created_at" ON "qbo_qc_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bookkeeping_queries_project_id" ON "bookkeeping_queries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_bookkeeping_queries_status" ON "bookkeeping_queries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bookkeeping_queries_created_by_id" ON "bookkeeping_queries" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_bookkeeping_queries_sent_to_client_at" ON "bookkeeping_queries" USING btree ("sent_to_client_at");--> statement-breakpoint
CREATE INDEX "idx_query_response_tokens_token" ON "query_response_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_query_response_tokens_project_id" ON "query_response_tokens" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_query_response_tokens_expires_at" ON "query_response_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_scheduled_query_reminders_token_id" ON "scheduled_query_reminders" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_query_reminders_project_id" ON "scheduled_query_reminders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_query_reminders_scheduled_at" ON "scheduled_query_reminders" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_scheduled_query_reminders_status" ON "scheduled_query_reminders" USING btree ("status");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_benched_by_user_id_users_id_fk" FOREIGN KEY ("benched_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_services_target_delivery_date" ON "client_services" USING btree ("target_delivery_date");--> statement-breakpoint
CREATE INDEX "idx_people_services_target_delivery_date" ON "people_services" USING btree ("target_delivery_date");--> statement-breakpoint
CREATE INDEX "idx_projects_target_delivery_date" ON "projects" USING btree ("target_delivery_date");--> statement-breakpoint
CREATE INDEX "idx_projects_is_benched" ON "projects" USING btree ("is_benched");--> statement-breakpoint
CREATE INDEX "message_threads_project_id_idx" ON "message_threads" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_internal_tasks_is_quick_reminder" ON "internal_tasks" USING btree ("is_quick_reminder");