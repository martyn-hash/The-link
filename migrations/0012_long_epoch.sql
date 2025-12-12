CREATE TYPE "public"."date_comparison_type" AS ENUM('before', 'after', 'between', 'exact');--> statement-breakpoint
CREATE TYPE "public"."answered_by_type" AS ENUM('staff', 'client');--> statement-breakpoint
CREATE TYPE "public"."ai_interaction_status" AS ENUM('success', 'failed', 'partial', 'clarification_needed');--> statement-breakpoint
ALTER TYPE "public"."stage_approval_field_type" ADD VALUE 'short_text' BEFORE 'long_text';--> statement-breakpoint
ALTER TYPE "public"."stage_approval_field_type" ADD VALUE 'single_select' BEFORE 'multi_select';--> statement-breakpoint
ALTER TYPE "public"."stage_approval_field_type" ADD VALUE 'date';--> statement-breakpoint
CREATE TABLE "client_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"project_id" varchar,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"attachments" jsonb,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "approval_field_library" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_type_id" varchar NOT NULL,
	"field_name" varchar NOT NULL,
	"field_type" "stage_approval_field_type" NOT NULL,
	"description" text,
	"placeholder" varchar,
	"expected_value_boolean" boolean,
	"comparison_type" "comparison_type",
	"expected_value_number" integer,
	"date_comparison_type" date_comparison_type,
	"expected_date" timestamp,
	"expected_date_end" timestamp,
	"options" text[],
	"is_commonly_required" boolean DEFAULT false,
	"usage_hint" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_library_field_name_per_type" UNIQUE("project_type_id","field_name")
);
--> statement-breakpoint
CREATE TABLE "client_stage_approval_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"project_type_id" varchar NOT NULL,
	"stage_id" varchar NOT NULL,
	"override_approval_id" varchar NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by_user_id" varchar,
	CONSTRAINT "unique_client_stage_override" UNIQUE("client_id","project_type_id","stage_id")
);
--> statement-breakpoint
CREATE TABLE "query_answer_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"project_id" varchar,
	"description_prefix" varchar(100) NOT NULL,
	"money_direction" varchar(10),
	"answer_text" text NOT NULL,
	"answered_by_type" "answered_by_type" NOT NULL,
	"answered_by_id" varchar,
	"answered_at" timestamp NOT NULL,
	"source_query_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "query_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"group_name" varchar(255) NOT NULL,
	"description" text,
	"created_by_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_function_invocations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interaction_id" varchar NOT NULL,
	"function_name" varchar NOT NULL,
	"function_arguments" jsonb,
	"succeeded" boolean DEFAULT false NOT NULL,
	"error_code" varchar,
	"error_message" text,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start_date" timestamp NOT NULL,
	"week_end_date" timestamp NOT NULL,
	"total_interactions" integer DEFAULT 0 NOT NULL,
	"successful_interactions" integer DEFAULT 0 NOT NULL,
	"failed_interactions" integer DEFAULT 0 NOT NULL,
	"top_failed_intents" jsonb,
	"aggregated_failures" jsonb,
	"openai_analysis" text,
	"recommendations" jsonb,
	"sent_to_email" varchar,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_interactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_id" varchar,
	"request_text" text NOT NULL,
	"intent_detected" varchar,
	"status" "ai_interaction_status" DEFAULT 'failed' NOT NULL,
	"resolved_entity_type" varchar,
	"resolved_entity_id" varchar,
	"resolved_entity_name" varchar,
	"response_message" text,
	"confidence_score" integer,
	"current_view_context" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "stage_approval_fields" DROP CONSTRAINT "check_long_text_field_validation";--> statement-breakpoint
ALTER TABLE "stage_approval_responses" DROP CONSTRAINT "check_single_value_populated";--> statement-breakpoint
ALTER TABLE "project_views" ADD COLUMN "pivot_config" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_access_magic_ai_button" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "stage_approval_fields" ADD COLUMN "library_field_id" varchar;--> statement-breakpoint
ALTER TABLE "stage_approval_fields" ADD COLUMN "date_comparison_type" date_comparison_type;--> statement-breakpoint
ALTER TABLE "stage_approval_fields" ADD COLUMN "expected_date" timestamp;--> statement-breakpoint
ALTER TABLE "stage_approval_fields" ADD COLUMN "expected_date_end" timestamp;--> statement-breakpoint
ALTER TABLE "stage_approval_responses" ADD COLUMN "value_short_text" varchar(255);--> statement-breakpoint
ALTER TABLE "stage_approval_responses" ADD COLUMN "value_single_select" varchar;--> statement-breakpoint
ALTER TABLE "stage_approval_responses" ADD COLUMN "value_date" timestamp;--> statement-breakpoint
ALTER TABLE "bookkeeping_queries" ADD COLUMN "group_id" varchar;--> statement-breakpoint
ALTER TABLE "bookkeeping_queries" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookkeeping_queries" ADD COLUMN "deleted_by_id" varchar;--> statement-breakpoint
ALTER TABLE "bookkeeping_queries" ADD COLUMN "has_suggestion_match" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "query_response_tokens" ADD COLUMN "open_notification_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "query_response_tokens" ADD COLUMN "submit_notification_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "query_response_tokens" ADD COLUMN "notify_on_response_user_ids" text[];--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_field_library" ADD CONSTRAINT "approval_field_library_project_type_id_project_types_id_fk" FOREIGN KEY ("project_type_id") REFERENCES "public"."project_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_stage_approval_overrides" ADD CONSTRAINT "client_stage_approval_overrides_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_stage_approval_overrides" ADD CONSTRAINT "client_stage_approval_overrides_project_type_id_project_types_id_fk" FOREIGN KEY ("project_type_id") REFERENCES "public"."project_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_stage_approval_overrides" ADD CONSTRAINT "client_stage_approval_overrides_stage_id_kanban_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."kanban_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_stage_approval_overrides" ADD CONSTRAINT "client_stage_approval_overrides_override_approval_id_stage_approvals_id_fk" FOREIGN KEY ("override_approval_id") REFERENCES "public"."stage_approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_stage_approval_overrides" ADD CONSTRAINT "client_stage_approval_overrides_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_answer_history" ADD CONSTRAINT "query_answer_history_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_answer_history" ADD CONSTRAINT "query_answer_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_answer_history" ADD CONSTRAINT "query_answer_history_answered_by_id_users_id_fk" FOREIGN KEY ("answered_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_answer_history" ADD CONSTRAINT "query_answer_history_source_query_id_bookkeeping_queries_id_fk" FOREIGN KEY ("source_query_id") REFERENCES "public"."bookkeeping_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_groups" ADD CONSTRAINT "query_groups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_groups" ADD CONSTRAINT "query_groups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_function_invocations" ADD CONSTRAINT "ai_function_invocations_interaction_id_ai_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."ai_interactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_notes_client_id" ON "client_notes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_notes_project_id" ON "client_notes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_client_notes_created_at" ON "client_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_approval_field_library_project_type_id" ON "approval_field_library" USING btree ("project_type_id");--> statement-breakpoint
CREATE INDEX "idx_approval_field_library_field_type" ON "approval_field_library" USING btree ("field_type");--> statement-breakpoint
CREATE INDEX "idx_client_overrides_client_id" ON "client_stage_approval_overrides" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_overrides_project_type_id" ON "client_stage_approval_overrides" USING btree ("project_type_id");--> statement-breakpoint
CREATE INDEX "idx_client_overrides_stage_id" ON "client_stage_approval_overrides" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "idx_query_answer_history_client_prefix" ON "query_answer_history" USING btree ("client_id","description_prefix");--> statement-breakpoint
CREATE INDEX "idx_query_answer_history_prefix" ON "query_answer_history" USING btree ("description_prefix");--> statement-breakpoint
CREATE INDEX "idx_query_answer_history_source_query" ON "query_answer_history" USING btree ("source_query_id");--> statement-breakpoint
CREATE INDEX "idx_query_groups_project_id" ON "query_groups" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_ai_function_invocations_interaction_id" ON "ai_function_invocations" USING btree ("interaction_id");--> statement-breakpoint
CREATE INDEX "idx_ai_function_invocations_function_name" ON "ai_function_invocations" USING btree ("function_name");--> statement-breakpoint
CREATE INDEX "idx_ai_function_invocations_succeeded" ON "ai_function_invocations" USING btree ("succeeded");--> statement-breakpoint
CREATE INDEX "idx_ai_insights_week_start" ON "ai_insights" USING btree ("week_start_date");--> statement-breakpoint
CREATE INDEX "idx_ai_insights_created_at" ON "ai_insights" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_user_id" ON "ai_interactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_status" ON "ai_interactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_intent" ON "ai_interactions" USING btree ("intent_detected");--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_created_at" ON "ai_interactions" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "bookkeeping_queries" ADD CONSTRAINT "bookkeeping_queries_group_id_query_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."query_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookkeeping_queries" ADD CONSTRAINT "bookkeeping_queries_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stage_approval_fields_library_field_id" ON "stage_approval_fields" USING btree ("library_field_id");--> statement-breakpoint
CREATE INDEX "idx_bookkeeping_queries_group_id" ON "bookkeeping_queries" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_bookkeeping_queries_deleted_at" ON "bookkeeping_queries" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "stage_approval_fields" ADD CONSTRAINT "check_single_select_field_validation" CHECK (
    (field_type != 'single_select' OR (options IS NOT NULL AND array_length(options, 1) > 0 AND options <> ARRAY[]::text[]))
  );