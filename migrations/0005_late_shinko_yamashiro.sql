CREATE TYPE "public"."communication_method" AS ENUM('phone', 'email', 'video_call', 'in_person', 'text_message');--> statement-breakpoint
CREATE TYPE "public"."communication_source" AS ENUM('staff_portal', 'client_portal', 'system');--> statement-breakpoint
CREATE TYPE "public"."signature_field_type" AS ENUM('signature', 'typed_name');--> statement-breakpoint
CREATE TYPE "public"."signature_request_status" AS ENUM('draft', 'pending', 'partially_signed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "signature_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signature_request_recipient_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"event_details" jsonb,
	"signer_name" varchar NOT NULL,
	"signer_email" varchar NOT NULL,
	"ip_address" varchar NOT NULL,
	"user_agent" text NOT NULL,
	"device_info" varchar,
	"browser_info" varchar,
	"os_info" varchar,
	"consent_accepted" boolean DEFAULT true NOT NULL,
	"consent_accepted_at" timestamp,
	"signed_at" timestamp,
	"document_hash" varchar NOT NULL,
	"document_version" varchar NOT NULL,
	"auth_method" varchar DEFAULT 'email_link' NOT NULL,
	"city" varchar,
	"country" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "signature_fields" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signature_request_id" varchar NOT NULL,
	"recipient_person_id" text NOT NULL,
	"field_type" "signature_field_type" NOT NULL,
	"page_number" integer NOT NULL,
	"x_position" real NOT NULL,
	"y_position" real NOT NULL,
	"width" real NOT NULL,
	"height" real NOT NULL,
	"label" varchar,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "signature_request_recipients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signature_request_id" varchar NOT NULL,
	"person_id" text NOT NULL,
	"email" varchar NOT NULL,
	"secure_token" varchar NOT NULL,
	"token_expires_at" timestamp DEFAULT now() + interval '30 days' NOT NULL,
	"sent_at" timestamp,
	"send_status" varchar DEFAULT 'pending',
	"send_error" text,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"reminder_sent_at" timestamp,
	"order_index" integer DEFAULT 0 NOT NULL,
	"active_session_token" varchar,
	"session_last_active" timestamp,
	"session_device_info" varchar,
	"session_browser_info" varchar,
	"session_os_info" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "signature_request_recipients_secure_token_unique" UNIQUE("secure_token"),
	CONSTRAINT "unique_request_recipient" UNIQUE("signature_request_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "signature_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"friendly_name" varchar DEFAULT 'Untitled Document' NOT NULL,
	"document_id" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"status" "signature_request_status" DEFAULT 'draft' NOT NULL,
	"email_subject" varchar,
	"email_message" text,
	"redirect_url" varchar,
	"reminder_enabled" boolean DEFAULT true NOT NULL,
	"reminder_interval_days" integer DEFAULT 3 NOT NULL,
	"reminders_sent_count" integer DEFAULT 0 NOT NULL,
	"last_reminder_sent_at" timestamp,
	"next_reminder_date" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"cancelled_by" varchar,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signature_field_id" varchar NOT NULL,
	"signature_request_recipient_id" varchar NOT NULL,
	"signature_type" varchar NOT NULL,
	"signature_data" text NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "signed_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signature_request_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"signed_pdf_path" text NOT NULL,
	"original_pdf_hash" varchar NOT NULL,
	"signed_pdf_hash" varchar NOT NULL,
	"audit_trail_pdf_path" text,
	"file_name" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "signed_documents_signature_request_id_unique" UNIQUE("signature_request_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"webhook_url" text NOT NULL,
	"update_webhook_url" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"required_client_fields" text[] DEFAULT '{}'::text[],
	"required_person_fields" text[] DEFAULT '{}'::text[],
	"included_client_fields" text[] DEFAULT '{}'::text[],
	"included_person_fields" text[] DEFAULT '{}'::text[],
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_config_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"triggered_by" varchar NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_status" DEFAULT 'pending' NOT NULL,
	"response_code" varchar,
	"response_body" text,
	"error_message" text,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "reason_field_responses" DROP CONSTRAINT "check_single_value_column";--> statement-breakpoint
ALTER TABLE "project_types" DROP CONSTRAINT "project_types_service_id_services_id_fk";
--> statement-breakpoint
ALTER TABLE "document_folders" ALTER COLUMN "source" SET DEFAULT 'direct_upload';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "manager_id" varchar;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "client_onboarded_date" timestamp;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "monthly_charge_quote" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "company_utr" varchar;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "companies_house_auth_code" varchar;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "company_telephone" varchar;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "postal_address_1" varchar;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "postal_address_2" varchar;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "postal_address_3" varchar;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "postal_address_postcode" varchar;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "postal_address_country" varchar;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "company_email_domain" varchar;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "trading_as" varchar;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "post_signature_redirect_urls" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "logo_object_path" varchar;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "maintenance_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "maintenance_message" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "initial_contact_date" timestamp;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "invoice_address_type" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "aml_complete" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "project_chronology" ADD COLUMN "notes_html" text;--> statement-breakpoint
ALTER TABLE "project_chronology" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "is_vat_service" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "signature_audit_logs" ADD CONSTRAINT "signature_audit_logs_signature_request_recipient_id_signature_request_recipients_id_fk" FOREIGN KEY ("signature_request_recipient_id") REFERENCES "public"."signature_request_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_fields" ADD CONSTRAINT "signature_fields_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_fields" ADD CONSTRAINT "signature_fields_recipient_person_id_people_id_fk" FOREIGN KEY ("recipient_person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_request_recipients" ADD CONSTRAINT "signature_request_recipients_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_request_recipients" ADD CONSTRAINT "signature_request_recipients_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_signature_field_id_signature_fields_id_fk" FOREIGN KEY ("signature_field_id") REFERENCES "public"."signature_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_signature_request_recipient_id_signature_request_recipients_id_fk" FOREIGN KEY ("signature_request_recipient_id") REFERENCES "public"."signature_request_recipients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_documents" ADD CONSTRAINT "signed_documents_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_documents" ADD CONSTRAINT "signed_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_configs" ADD CONSTRAINT "webhook_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_webhook_config_id_webhook_configs_id_fk" FOREIGN KEY ("webhook_config_id") REFERENCES "public"."webhook_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_signature_audit_logs_recipient_id" ON "signature_audit_logs" USING btree ("signature_request_recipient_id");--> statement-breakpoint
CREATE INDEX "idx_signature_audit_logs_signed_at" ON "signature_audit_logs" USING btree ("signed_at");--> statement-breakpoint
CREATE INDEX "idx_signature_fields_request_id" ON "signature_fields" USING btree ("signature_request_id");--> statement-breakpoint
CREATE INDEX "idx_signature_fields_recipient_id" ON "signature_fields" USING btree ("recipient_person_id");--> statement-breakpoint
CREATE INDEX "idx_signature_request_recipients_request_id" ON "signature_request_recipients" USING btree ("signature_request_id");--> statement-breakpoint
CREATE INDEX "idx_signature_request_recipients_person_id" ON "signature_request_recipients" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_signature_request_recipients_token" ON "signature_request_recipients" USING btree ("secure_token");--> statement-breakpoint
CREATE INDEX "idx_signature_requests_client_id" ON "signature_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_signature_requests_document_id" ON "signature_requests" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_signature_requests_status" ON "signature_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_signature_requests_created_by" ON "signature_requests" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_signatures_field_id" ON "signatures" USING btree ("signature_field_id");--> statement-breakpoint
CREATE INDEX "idx_signatures_recipient_id" ON "signatures" USING btree ("signature_request_recipient_id");--> statement-breakpoint
CREATE INDEX "idx_signed_documents_request_id" ON "signed_documents" USING btree ("signature_request_id");--> statement-breakpoint
CREATE INDEX "idx_signed_documents_client_id" ON "signed_documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_signed_documents_completed_at" ON "signed_documents" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_configs_is_enabled" ON "webhook_configs" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_webhook_configs_created_by" ON "webhook_configs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_webhook_config_id" ON "webhook_logs" USING btree ("webhook_config_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_client_id" ON "webhook_logs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_triggered_by" ON "webhook_logs" USING btree ("triggered_by");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_status" ON "webhook_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_sent_at" ON "webhook_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_client_sent_at" ON "webhook_logs" USING btree ("client_id","sent_at");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notification_history_client_created" ON "notification_history" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_project_type_notifications_client_request_template_id" ON "project_type_notifications" USING btree ("client_request_template_id");--> statement-breakpoint
CREATE INDEX "idx_projects_current_status" ON "projects" USING btree ("current_status");--> statement-breakpoint
CREATE INDEX "idx_projects_due_date" ON "projects" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_projects_inactive" ON "projects" USING btree ("inactive");--> statement-breakpoint
CREATE INDEX "idx_projects_project_month" ON "projects" USING btree ("project_month");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_status_scheduled_for" ON "scheduled_notifications" USING btree ("status","scheduled_for");--> statement-breakpoint
ALTER TABLE "reason_field_responses" ADD CONSTRAINT "check_single_value_column" CHECK (
    (field_type = 'number' AND value_number IS NOT NULL AND value_short_text IS NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (field_type = 'short_text' AND value_number IS NULL AND value_short_text IS NOT NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (field_type = 'long_text' AND value_number IS NULL AND value_short_text IS NULL AND value_long_text IS NOT NULL AND value_multi_select IS NULL) OR
    (field_type = 'multi_select' AND value_number IS NULL AND value_short_text IS NULL AND value_long_text IS NULL AND value_multi_select IS NOT NULL)
  );