CREATE TYPE "public"."inbox_email_status" AS ENUM('pending_reply', 'replied', 'no_action_needed', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."opportunity_type" AS ENUM('upsell', 'cross_sell', 'referral', 'expansion', 'retention_risk', 'testimonial');--> statement-breakpoint
CREATE TYPE "public"."quarantine_reason" AS ENUM('no_client_match', 'no_contact_match', 'dev_override_disabled');--> statement-breakpoint
CREATE TYPE "public"."sentiment_label" AS ENUM('very_negative', 'negative', 'neutral', 'positive', 'very_positive');--> statement-breakpoint
CREATE TYPE "public"."urgency_level" AS ENUM('critical', 'high', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."workflow_state" AS ENUM('pending', 'working', 'blocked', 'complete');--> statement-breakpoint
CREATE TABLE "email_classification_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"override_at" timestamp DEFAULT now(),
	"field_name" varchar NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"reason" text NOT NULL,
	"previous_classification_snapshot" jsonb,
	"new_classification_snapshot" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_classifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" varchar NOT NULL,
	"requires_task" boolean DEFAULT false NOT NULL,
	"requires_reply" boolean DEFAULT false NOT NULL,
	"sentiment_score" text,
	"sentiment_label" "sentiment_label",
	"opportunity" "opportunity_type",
	"urgency" "urgency_level" DEFAULT 'normal',
	"information_only" boolean DEFAULT false,
	"deterministic_task_floor" boolean,
	"deterministic_reply_floor" boolean,
	"triggered_rules" jsonb DEFAULT '[]'::jsonb,
	"ai_task" boolean,
	"ai_reply" boolean,
	"ai_confidence" text,
	"ai_reasoning" text,
	"ai_raw_response" jsonb,
	"override_by" varchar,
	"override_at" timestamp,
	"override_reason" text,
	"override_changes" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_classifications_email_id_unique" UNIQUE("email_id")
);
--> statement-breakpoint
CREATE TABLE "email_quarantine" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inbox_id" varchar NOT NULL,
	"microsoft_id" varchar NOT NULL,
	"from_address" varchar NOT NULL,
	"from_name" varchar,
	"to_recipients" jsonb DEFAULT '[]'::jsonb,
	"cc_recipients" jsonb DEFAULT '[]'::jsonb,
	"subject" text,
	"body_preview" text,
	"received_at" timestamp NOT NULL,
	"has_attachments" boolean DEFAULT false,
	"quarantine_reason" "quarantine_reason" NOT NULL,
	"restored_at" timestamp,
	"restored_by" varchar,
	"restored_to_client_id" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_quarantine_inbox_microsoft_id" UNIQUE("inbox_id","microsoft_id")
);
--> statement-breakpoint
CREATE TABLE "email_workflow_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" varchar NOT NULL,
	"state" "workflow_state" DEFAULT 'pending' NOT NULL,
	"requires_task" boolean DEFAULT false,
	"linked_task_id" varchar,
	"task_requirement_met" boolean DEFAULT false,
	"requires_reply" boolean DEFAULT false,
	"reply_sent" boolean DEFAULT false,
	"reply_message_id" varchar,
	"reply_sent_at" timestamp,
	"completed_at" timestamp,
	"completed_by" varchar,
	"completion_note" text,
	"sla_deadline" timestamp,
	"sla_breach" boolean DEFAULT false,
	"sla_breached_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_workflow_state_email_id_unique" UNIQUE("email_id")
);
--> statement-breakpoint
CREATE TABLE "inbox_emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inbox_id" varchar NOT NULL,
	"microsoft_id" varchar NOT NULL,
	"conversation_id" varchar,
	"from_address" varchar NOT NULL,
	"from_name" varchar,
	"to_recipients" jsonb DEFAULT '[]'::jsonb,
	"cc_recipients" jsonb DEFAULT '[]'::jsonb,
	"subject" text,
	"body_preview" text,
	"body_html" text,
	"received_at" timestamp NOT NULL,
	"has_attachments" boolean DEFAULT false,
	"importance" varchar DEFAULT 'normal',
	"matched_client_id" varchar,
	"matched_person_id" varchar,
	"project_id" varchar,
	"direction" "email_direction" DEFAULT 'inbound',
	"staff_user_id" varchar,
	"sla_deadline" timestamp,
	"replied_at" timestamp,
	"status" "inbox_email_status" DEFAULT 'pending_reply',
	"is_read" boolean DEFAULT false,
	"is_archived" boolean DEFAULT false,
	"synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_inbox_microsoft_id" UNIQUE("inbox_id","microsoft_id")
);
--> statement-breakpoint
CREATE TABLE "audit_changelog" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"change_type" varchar NOT NULL,
	"changed_by_user_id" varchar NOT NULL,
	"before_value" jsonb,
	"after_value" jsonb,
	"change_description" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "company_settings" ALTER COLUMN "app_is_live" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "sla_response_days" integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "working_hours_start" varchar DEFAULT '09:00';--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "working_hours_end" varchar DEFAULT '17:00';--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "working_days" jsonb DEFAULT '[1,2,3,4,5]'::jsonb;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "email_dev_override" jsonb DEFAULT '{"enabled": false, "bypassGate": false, "logOverrides": true}'::jsonb;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "startup_catch_up" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_classification_overrides" ADD CONSTRAINT "email_classification_overrides_email_id_inbox_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."inbox_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_classification_overrides" ADD CONSTRAINT "email_classification_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_classifications" ADD CONSTRAINT "email_classifications_email_id_inbox_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."inbox_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_classifications" ADD CONSTRAINT "email_classifications_override_by_users_id_fk" FOREIGN KEY ("override_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_quarantine" ADD CONSTRAINT "email_quarantine_inbox_id_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_quarantine" ADD CONSTRAINT "email_quarantine_restored_by_users_id_fk" FOREIGN KEY ("restored_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_quarantine" ADD CONSTRAINT "email_quarantine_restored_to_client_id_clients_id_fk" FOREIGN KEY ("restored_to_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_workflow_state" ADD CONSTRAINT "email_workflow_state_email_id_inbox_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."inbox_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_workflow_state" ADD CONSTRAINT "email_workflow_state_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_emails" ADD CONSTRAINT "inbox_emails_inbox_id_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_emails" ADD CONSTRAINT "inbox_emails_matched_client_id_clients_id_fk" FOREIGN KEY ("matched_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_emails" ADD CONSTRAINT "inbox_emails_matched_person_id_people_id_fk" FOREIGN KEY ("matched_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_emails" ADD CONSTRAINT "inbox_emails_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_emails" ADD CONSTRAINT "inbox_emails_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_changelog" ADD CONSTRAINT "audit_changelog_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_classification_overrides_email_id" ON "email_classification_overrides" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "idx_email_classification_overrides_user_id" ON "email_classification_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_classification_overrides_override_at" ON "email_classification_overrides" USING btree ("override_at");--> statement-breakpoint
CREATE INDEX "idx_email_classifications_email_id" ON "email_classifications" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "idx_email_classifications_requires_task" ON "email_classifications" USING btree ("requires_task");--> statement-breakpoint
CREATE INDEX "idx_email_classifications_requires_reply" ON "email_classifications" USING btree ("requires_reply");--> statement-breakpoint
CREATE INDEX "idx_email_classifications_urgency" ON "email_classifications" USING btree ("urgency");--> statement-breakpoint
CREATE INDEX "idx_email_classifications_opportunity" ON "email_classifications" USING btree ("opportunity");--> statement-breakpoint
CREATE INDEX "idx_email_classifications_information_only" ON "email_classifications" USING btree ("information_only");--> statement-breakpoint
CREATE INDEX "idx_email_quarantine_inbox_id" ON "email_quarantine" USING btree ("inbox_id");--> statement-breakpoint
CREATE INDEX "idx_email_quarantine_from_address" ON "email_quarantine" USING btree ("from_address");--> statement-breakpoint
CREATE INDEX "idx_email_quarantine_received_at" ON "email_quarantine" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_email_quarantine_restored_at" ON "email_quarantine" USING btree ("restored_at");--> statement-breakpoint
CREATE INDEX "idx_email_workflow_state_email_id" ON "email_workflow_state" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "idx_email_workflow_state_state" ON "email_workflow_state" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_email_workflow_state_requires_task" ON "email_workflow_state" USING btree ("requires_task");--> statement-breakpoint
CREATE INDEX "idx_email_workflow_state_requires_reply" ON "email_workflow_state" USING btree ("requires_reply");--> statement-breakpoint
CREATE INDEX "idx_email_workflow_state_sla_deadline" ON "email_workflow_state" USING btree ("sla_deadline");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_inbox_id" ON "inbox_emails" USING btree ("inbox_id");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_matched_client_id" ON "inbox_emails" USING btree ("matched_client_id");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_matched_person_id" ON "inbox_emails" USING btree ("matched_person_id");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_project_id" ON "inbox_emails" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_direction" ON "inbox_emails" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_staff_user_id" ON "inbox_emails" USING btree ("staff_user_id");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_status" ON "inbox_emails" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_sla_deadline" ON "inbox_emails" USING btree ("sla_deadline");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_received_at" ON "inbox_emails" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_inbox_emails_from_address" ON "inbox_emails" USING btree ("from_address");--> statement-breakpoint
CREATE INDEX "idx_audit_changelog_entity" ON "audit_changelog" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_changelog_changed_by" ON "audit_changelog" USING btree ("changed_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_changelog_timestamp" ON "audit_changelog" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_changelog_change_type" ON "audit_changelog" USING btree ("change_type");