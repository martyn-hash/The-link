CREATE TYPE "public"."communication_type" AS ENUM('phone_call', 'note', 'sms_sent', 'sms_received', 'email_sent', 'email_received');--> statement-breakpoint
CREATE TYPE "public"."comparison_type" AS ENUM('equal_to', 'less_than', 'greater_than');--> statement-breakpoint
CREATE TYPE "public"."custom_field_type" AS ENUM('boolean', 'number', 'short_text', 'long_text', 'multi_select');--> statement-breakpoint
CREATE TYPE "public"."date_offset_type" AS ENUM('before', 'on', 'after');--> statement-breakpoint
CREATE TYPE "public"."date_reference" AS ENUM('start_date', 'due_date');--> statement-breakpoint
CREATE TYPE "public"."email_direction" AS ENUM('inbound', 'outbound', 'internal', 'external');--> statement-breakpoint
CREATE TYPE "public"."email_match_confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."inactive_reason" AS ENUM('created_in_error', 'no_longer_required', 'client_doing_work_themselves');--> statement-breakpoint
CREATE TYPE "public"."integration_type" AS ENUM('office365', 'voodoo_sms', 'ringcentral');--> statement-breakpoint
CREATE TYPE "public"."internal_task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."internal_task_status" AS ENUM('open', 'in_progress', 'closed');--> statement-breakpoint
CREATE TYPE "public"."nationality" AS ENUM('afghan', 'albanian', 'algerian', 'american', 'andorran', 'angolan', 'antiguans', 'argentinean', 'armenian', 'australian', 'austrian', 'azerbaijani', 'bahamian', 'bahraini', 'bangladeshi', 'barbadian', 'barbudans', 'batswana', 'belarusian', 'belgian', 'belizean', 'beninese', 'bhutanese', 'bolivian', 'bosnian', 'brazilian', 'british', 'bruneian', 'bulgarian', 'burkinabe', 'burmese', 'burundian', 'cambodian', 'cameroonian', 'canadian', 'cape_verdean', 'central_african', 'chadian', 'chilean', 'chinese', 'colombian', 'comoran', 'congolese', 'costa_rican', 'croatian', 'cuban', 'cypriot', 'czech', 'danish', 'djibouti', 'dominican', 'dutch', 'east_timorese', 'ecuadorean', 'egyptian', 'emirian', 'equatorial_guinean', 'eritrean', 'estonian', 'ethiopian', 'fijian', 'filipino', 'finnish', 'french', 'gabonese', 'gambian', 'georgian', 'german', 'ghanaian', 'greek', 'grenadian', 'guatemalan', 'guinea_bissauan', 'guinean', 'guyanese', 'haitian', 'herzegovinian', 'honduran', 'hungarian', 'icelander', 'indian', 'indonesian', 'iranian', 'iraqi', 'irish', 'israeli', 'italian', 'ivorian', 'jamaican', 'japanese', 'jordanian', 'kazakhstani', 'kenyan', 'kittian_and_nevisian', 'kuwaiti', 'kyrgyz', 'laotian', 'latvian', 'lebanese', 'liberian', 'libyan', 'liechtensteiner', 'lithuanian', 'luxembourger', 'macedonian', 'malagasy', 'malawian', 'malaysian', 'maldivan', 'malian', 'maltese', 'marshallese', 'mauritanian', 'mauritian', 'mexican', 'micronesian', 'moldovan', 'monacan', 'mongolian', 'moroccan', 'mosotho', 'motswana', 'mozambican', 'namibian', 'nauruan', 'nepalese', 'new_zealander', 'ni_vanuatu', 'nicaraguan', 'nigerien', 'north_korean', 'northern_irish', 'norwegian', 'omani', 'pakistani', 'palauan', 'panamanian', 'papua_new_guinean', 'paraguayan', 'peruvian', 'polish', 'portuguese', 'qatari', 'romanian', 'russian', 'rwandan', 'saint_lucian', 'salvadoran', 'samoan', 'san_marinese', 'sao_tomean', 'saudi', 'scottish', 'senegalese', 'serbian', 'seychellois', 'sierra_leonean', 'singaporean', 'slovakian', 'slovenian', 'solomon_islander', 'somali', 'south_african', 'south_korean', 'spanish', 'sri_lankan', 'sudanese', 'surinamer', 'swazi', 'swedish', 'swiss', 'syrian', 'taiwanese', 'tajik', 'tanzanian', 'thai', 'togolese', 'tongan', 'trinidadian_or_tobagonian', 'tunisian', 'turkish', 'tuvaluan', 'ugandan', 'ukrainian', 'uruguayan', 'uzbekistani', 'venezuelan', 'vietnamese', 'welsh', 'yemenite', 'zambian', 'zimbabwean');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('project', 'stage');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('scheduled', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('email', 'sms', 'push');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('no_latest_action', 'bookkeeping_work_required', 'in_review', 'needs_client_input', 'completed');--> statement-breakpoint
CREATE TYPE "public"."push_template_type" AS ENUM('new_message_staff', 'new_message_client', 'document_request', 'task_assigned', 'project_stage_change', 'status_update', 'reminder');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('short_text', 'long_text', 'email', 'number', 'date', 'single_choice', 'multi_choice', 'dropdown', 'yes_no', 'file_upload');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."risk_response" AS ENUM('no', 'yes', 'na');--> statement-breakpoint
CREATE TYPE "public"."stage_approval_field_type" AS ENUM('boolean', 'number', 'long_text', 'multi_select');--> statement-breakpoint
CREATE TYPE "public"."stage_trigger" AS ENUM('entry', 'exit');--> statement-breakpoint
CREATE TYPE "public"."task_instance_status" AS ENUM('not_started', 'in_progress', 'submitted', 'approved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."thread_status" AS ENUM('open', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."udf_type" AS ENUM('number', 'date', 'boolean', 'short_text');--> statement-breakpoint
CREATE TYPE "public"."viewed_entity_type" AS ENUM('client', 'project', 'person', 'communication');--> statement-breakpoint
CREATE TABLE "ch_change_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"change_type" varchar NOT NULL,
	"field_name" varchar NOT NULL,
	"old_value" text,
	"new_value" text NOT NULL,
	"status" varchar DEFAULT 'pending',
	"detected_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"approved_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "change_reasons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_type_id" varchar NOT NULL,
	"reason" varchar NOT NULL,
	"description" varchar,
	"show_count_in_project" boolean DEFAULT false,
	"count_label" varchar,
	"stage_approval_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_chronology" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"from_value" varchar,
	"to_value" varchar NOT NULL,
	"user_id" varchar,
	"change_reason" varchar,
	"notes" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_custom_request_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" varchar NOT NULL,
	"question_type" "question_type" NOT NULL,
	"label" text NOT NULL,
	"help_text" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"validation_rules" jsonb,
	"options" text[],
	"conditional_logic" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_custom_request_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_custom_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_domain_allowlist" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"domain" varchar NOT NULL,
	"match_confidence" "email_match_confidence" DEFAULT 'medium',
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_client_domain" UNIQUE("client_id","domain")
);
--> statement-breakpoint
CREATE TABLE "client_email_aliases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"email_lowercase" varchar NOT NULL,
	"is_primary" boolean DEFAULT false,
	"source" varchar DEFAULT 'manual',
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_client_email" UNIQUE("email_lowercase")
);
--> statement-breakpoint
CREATE TABLE "client_people" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"person_id" text NOT NULL,
	"officer_role" text,
	"is_primary_contact" boolean,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_person_company" UNIQUE("client_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "client_portal_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_portal_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"person_id" text,
	"email" varchar NOT NULL,
	"name" varchar,
	"magic_link_token" text,
	"token_expiry" timestamp,
	"verification_code" varchar(6),
	"code_expiry" timestamp,
	"last_login" timestamp,
	"push_notifications_enabled" boolean DEFAULT false,
	"notification_preferences" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_client_portal_email" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "client_request_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_type_notification_id" varchar NOT NULL,
	"notification_type" "notification_type" NOT NULL,
	"days_after_creation" integer NOT NULL,
	"email_title" varchar,
	"email_body" text,
	"sms_content" varchar(160),
	"push_title" varchar(50),
	"push_body" varchar(120),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "check_email_reminder_content" CHECK (
    (notification_type != 'email' OR (email_title IS NOT NULL AND email_body IS NOT NULL))
  ),
	CONSTRAINT "check_sms_reminder_content" CHECK (
    (notification_type != 'sms' OR sms_content IS NOT NULL)
  ),
	CONSTRAINT "check_push_reminder_content" CHECK (
    (notification_type != 'push' OR (push_title IS NOT NULL AND push_body IS NOT NULL))
  )
);
--> statement-breakpoint
CREATE TABLE "client_request_template_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_request_template_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" varchar NOT NULL,
	"question_type" "question_type" NOT NULL,
	"label" text NOT NULL,
	"help_text" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"validation_rules" jsonb,
	"options" text[],
	"conditional_logic" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_request_template_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_request_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" varchar,
	"name" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_service_role_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_service_id" varchar NOT NULL,
	"work_role_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"service_id" varchar NOT NULL,
	"service_owner_id" varchar,
	"frequency" varchar,
	"next_start_date" timestamp,
	"next_due_date" timestamp,
	"intended_start_day" integer,
	"intended_due_day" integer,
	"is_active" boolean DEFAULT true,
	"inactive_reason" "inactive_reason",
	"inactive_at" timestamp,
	"inactive_by_user_id" varchar,
	"udf_values" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_client_service" UNIQUE("client_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "client_tag_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"tag_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"assigned_by" varchar NOT NULL,
	CONSTRAINT "client_tag_assignments_client_id_tag_id_unique" UNIQUE("client_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "client_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"color" varchar DEFAULT '#3b82f6' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "client_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar,
	"created_at" timestamp DEFAULT now(),
	"client_type" varchar,
	"company_number" varchar,
	"companies_house_name" varchar,
	"company_status" varchar,
	"company_status_detail" varchar,
	"company_type" varchar,
	"date_of_creation" timestamp,
	"jurisdiction" varchar,
	"sic_codes" text[],
	"registered_address_1" varchar,
	"registered_address_2" varchar,
	"registered_address_3" varchar,
	"registered_country" varchar,
	"registered_postcode" varchar,
	"accounting_reference_day" integer,
	"accounting_reference_month" integer,
	"last_accounts_made_up_to" timestamp,
	"last_accounts_type" varchar,
	"next_accounts_due" timestamp,
	"next_accounts_period_end" timestamp,
	"accounts_overdue" boolean DEFAULT false,
	"confirmation_statement_last_made_up_to" timestamp,
	"confirmation_statement_next_due" timestamp,
	"confirmation_statement_next_made_up_to" timestamp,
	"confirmation_statement_overdue" boolean DEFAULT false,
	"companies_house_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "communications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"person_id" varchar,
	"project_id" varchar,
	"user_id" varchar NOT NULL,
	"type" "communication_type" NOT NULL,
	"subject" varchar,
	"content" text NOT NULL,
	"actual_contact_time" timestamp NOT NULL,
	"logged_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	"is_read" boolean DEFAULT true,
	"thread_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_sender_name" varchar DEFAULT 'The Link Team',
	"firm_name" varchar DEFAULT 'The Link',
	"firm_phone" varchar,
	"firm_email" varchar,
	"portal_url" varchar,
	"push_notifications_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"filters" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dashboard_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"my_tasks_count" integer DEFAULT 0 NOT NULL,
	"my_projects_count" integer DEFAULT 0 NOT NULL,
	"overdue_tasks_count" integer DEFAULT 0 NOT NULL,
	"behind_schedule_count" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "dashboard_cache_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"filters" text NOT NULL,
	"widgets" jsonb NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL,
	"is_homescreen_dashboard" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"created_by" varchar,
	"source" varchar DEFAULT 'direct upload' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"folder_id" varchar,
	"uploaded_by" varchar,
	"client_portal_user_id" varchar,
	"upload_name" varchar,
	"source" varchar DEFAULT 'direct_upload' NOT NULL,
	"message_id" varchar,
	"thread_id" varchar,
	"task_instance_id" varchar,
	"file_name" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" varchar NOT NULL,
	"object_path" text NOT NULL,
	"is_portal_visible" boolean DEFAULT true,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_hash" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"content_type" varchar NOT NULL,
	"object_path" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_attachments_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "email_message_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"internet_message_id" varchar NOT NULL,
	"attachment_id" varchar NOT NULL,
	"attachment_index" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_message_attachment" UNIQUE("internet_message_id","attachment_id")
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"internet_message_id" varchar PRIMARY KEY NOT NULL,
	"canonical_conversation_id" varchar NOT NULL,
	"conversation_id_seen" varchar NOT NULL,
	"thread_key" varchar,
	"thread_position" integer,
	"from" varchar NOT NULL,
	"to" text[],
	"cc" text[],
	"bcc" text[],
	"subject" text,
	"subject_stem" text,
	"body" text,
	"body_preview" text,
	"received_datetime" timestamp NOT NULL,
	"sent_datetime" timestamp,
	"in_reply_to" varchar,
	"references" text[],
	"direction" "email_direction" NOT NULL,
	"is_internal_only" boolean DEFAULT false,
	"participant_count" integer,
	"has_attachments" boolean DEFAULT false,
	"client_id" varchar,
	"client_match_confidence" "email_match_confidence",
	"mailbox_owner_user_id" varchar,
	"graph_message_id" varchar,
	"conversation_index" text,
	"internet_message_headers" jsonb,
	"processed_at" timestamp DEFAULT now(),
	"error_count" integer DEFAULT 0,
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"canonical_conversation_id" varchar PRIMARY KEY NOT NULL,
	"thread_key" varchar,
	"subject" text,
	"participants" text[],
	"client_id" varchar,
	"first_message_at" timestamp NOT NULL,
	"last_message_at" timestamp NOT NULL,
	"message_count" integer DEFAULT 1,
	"latest_preview" text,
	"latest_direction" "email_direction",
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "email_threads_thread_key_unique" UNIQUE("thread_key")
);
--> statement-breakpoint
CREATE TABLE "graph_sync_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"folder_path" varchar NOT NULL,
	"delta_link" text,
	"last_sync_at" timestamp,
	"last_message_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_folder_sync" UNIQUE("user_id","folder_path")
);
--> statement-breakpoint
CREATE TABLE "graph_webhook_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_id" varchar NOT NULL,
	"resource" varchar NOT NULL,
	"change_type" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"client_state" varchar,
	"is_active" boolean DEFAULT true,
	"last_renewed_at" timestamp,
	"last_notification_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "graph_webhook_subscriptions_subscription_id_unique" UNIQUE("subscription_id")
);
--> statement-breakpoint
CREATE TABLE "internal_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"status" "internal_task_status" DEFAULT 'open' NOT NULL,
	"priority" "internal_task_priority" DEFAULT 'low' NOT NULL,
	"task_type_id" varchar,
	"created_by" varchar NOT NULL,
	"assigned_to" varchar NOT NULL,
	"due_date" timestamp NOT NULL,
	"closed_at" timestamp,
	"closed_by" varchar,
	"closure_note" text,
	"total_time_spent_minutes" integer DEFAULT 0,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"archived_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kanban_stages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_type_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"assigned_work_role_id" varchar,
	"assigned_user_id" varchar,
	"order" integer NOT NULL,
	"color" varchar DEFAULT '#6b7280',
	"max_instance_time" integer,
	"max_total_time" integer,
	"stage_approval_id" varchar,
	"can_be_final_stage" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar,
	"success" boolean NOT NULL,
	"failure_reason" varchar,
	"browser" varchar,
	"os" varchar
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token_hash" varchar NOT NULL,
	"code_hash" varchar NOT NULL,
	"email" varchar NOT NULL,
	"expires_at" timestamp DEFAULT now() + interval '10 minutes' NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "magic_link_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "mailbox_message_map" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mailbox_user_id" varchar NOT NULL,
	"mailbox_message_id" varchar NOT NULL,
	"internet_message_id" varchar NOT NULL,
	"folder_path" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_mailbox_graph_message" UNIQUE("mailbox_user_id","mailbox_message_id"),
	CONSTRAINT "unique_mailbox_internet_message" UNIQUE("mailbox_user_id","internet_message_id")
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"status" "thread_status" DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"last_message_by_staff" boolean DEFAULT false,
	"created_by_user_id" varchar,
	"created_by_client_portal_user_id" varchar,
	"project_id" varchar,
	"service_id" varchar,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"archived_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"content" text NOT NULL,
	"user_id" varchar,
	"client_portal_user_id" varchar,
	"attachments" jsonb,
	"is_read_by_staff" boolean DEFAULT false,
	"is_read_by_client" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_notification_id" varchar,
	"client_id" varchar NOT NULL,
	"recipient_email" varchar,
	"recipient_phone" varchar,
	"notification_type" "notification_type" NOT NULL,
	"content" text NOT NULL,
	"status" "notification_status" NOT NULL,
	"sent_at" timestamp,
	"failure_reason" text,
	"external_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_icons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar NOT NULL,
	"storage_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar NOT NULL,
	"width" integer,
	"height" integer,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_number" text,
	"full_name" text NOT NULL,
	"title" text,
	"first_name" text,
	"last_name" text,
	"date_of_birth" text,
	"nationality" "nationality",
	"country_of_residence" text,
	"occupation" text,
	"address_line_1" text,
	"address_line_2" text,
	"locality" text,
	"region" text,
	"postal_code" text,
	"country" text,
	"email" text,
	"telephone" text,
	"primary_phone" text,
	"primary_email" text,
	"telephone_2" text,
	"email_2" text,
	"linkedin_url" text,
	"instagram_url" text,
	"twitter_url" text,
	"facebook_url" text,
	"tiktok_url" text,
	"notes" text,
	"is_main_contact" boolean DEFAULT false,
	"receive_notifications" boolean DEFAULT true,
	"ni_number" text,
	"personal_utr_number" text,
	"photo_id_verified" boolean DEFAULT false,
	"address_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "people_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" text NOT NULL,
	"service_id" varchar NOT NULL,
	"service_owner_id" varchar,
	"frequency" varchar DEFAULT 'monthly' NOT NULL,
	"next_start_date" timestamp,
	"next_due_date" timestamp,
	"intended_start_day" integer,
	"intended_due_day" integer,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_person_service" UNIQUE("person_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "people_tag_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" varchar NOT NULL,
	"tag_id" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"assigned_by" varchar NOT NULL,
	CONSTRAINT "people_tag_assignments_person_id_tag_id_unique" UNIQUE("person_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "people_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"color" varchar DEFAULT '#3b82f6' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "people_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "project_chronology" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"from_status" varchar,
	"to_status" varchar NOT NULL,
	"assignee_id" varchar,
	"changed_by_id" varchar,
	"change_reason" varchar,
	"notes" text,
	"timestamp" timestamp DEFAULT now(),
	"time_in_previous_stage" integer,
	"business_hours_in_previous_stage" integer
);
--> statement-breakpoint
CREATE TABLE "project_message_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"last_read_at" timestamp,
	"last_read_message_id" varchar,
	"last_reminder_email_sent_at" timestamp,
	"joined_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_project_thread_user" UNIQUE("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "project_message_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"topic" varchar NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"last_message_by_user_id" varchar,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"archived_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"content" text NOT NULL,
	"user_id" varchar NOT NULL,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_scheduling_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_service_id" varchar,
	"people_service_id" varchar,
	"project_id" varchar,
	"action" varchar NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"previous_next_start_date" timestamp,
	"previous_next_due_date" timestamp,
	"new_next_start_date" timestamp,
	"new_next_due_date" timestamp,
	"frequency" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_type_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_type_id" varchar NOT NULL,
	"category" "notification_category" NOT NULL,
	"notification_type" "notification_type" NOT NULL,
	"date_reference" date_reference,
	"offset_type" date_offset_type,
	"offset_days" integer,
	"stage_id" varchar,
	"stage_trigger" "stage_trigger",
	"email_title" varchar,
	"email_body" text,
	"sms_content" varchar(160),
	"push_title" varchar(50),
	"push_body" varchar(120),
	"client_request_template_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "check_project_notification_fields" CHECK (
    (category != 'project' OR (date_reference IS NOT NULL AND offset_type IS NOT NULL AND offset_days IS NOT NULL))
  ),
	CONSTRAINT "check_stage_notification_fields" CHECK (
    (category != 'stage' OR (stage_id IS NOT NULL AND stage_trigger IS NOT NULL))
  ),
	CONSTRAINT "check_email_notification_content" CHECK (
    (notification_type != 'email' OR (email_title IS NOT NULL AND email_body IS NOT NULL))
  ),
	CONSTRAINT "check_sms_notification_content" CHECK (
    (notification_type != 'sms' OR sms_content IS NOT NULL)
  ),
	CONSTRAINT "check_push_notification_content" CHECK (
    (notification_type != 'push' OR (push_title IS NOT NULL AND push_body IS NOT NULL))
  )
);
--> statement-breakpoint
CREATE TABLE "project_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"service_id" varchar,
	"active" boolean DEFAULT true,
	"notifications_active" boolean DEFAULT true,
	"single_project_per_client" boolean DEFAULT false,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "project_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "project_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"filters" text NOT NULL,
	"view_mode" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"project_type_id" varchar NOT NULL,
	"bookkeeper_id" varchar NOT NULL,
	"client_manager_id" varchar NOT NULL,
	"project_owner_id" varchar,
	"description" text NOT NULL,
	"current_status" varchar DEFAULT 'No Latest Action' NOT NULL,
	"current_assignee_id" varchar,
	"priority" varchar DEFAULT 'medium',
	"due_date" timestamp,
	"archived" boolean DEFAULT false,
	"inactive" boolean DEFAULT false,
	"inactive_reason" "inactive_reason",
	"inactive_at" timestamp,
	"inactive_by_user_id" varchar,
	"completion_status" varchar,
	"project_month" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_notification_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_type" "push_template_type" NOT NULL,
	"name" varchar NOT NULL,
	"title_template" varchar NOT NULL,
	"body_template" text NOT NULL,
	"icon_url" varchar,
	"badge_url" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"client_portal_user_id" varchar,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_push_subscription_endpoint" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reason_custom_fields" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reason_id" varchar NOT NULL,
	"field_name" varchar NOT NULL,
	"field_type" "custom_field_type" NOT NULL,
	"is_required" boolean DEFAULT false,
	"placeholder" varchar,
	"description" text,
	"options" text[],
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "check_multi_select_options" CHECK (
    (field_type != 'multi_select' OR (options IS NOT NULL AND array_length(options, 1) > 0 AND options <> ARRAY[]::text[]))
  )
);
--> statement-breakpoint
CREATE TABLE "reason_field_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chronology_id" varchar NOT NULL,
	"custom_field_id" varchar NOT NULL,
	"field_type" "custom_field_type" NOT NULL,
	"value_number" integer,
	"value_short_text" varchar(255),
	"value_long_text" text,
	"value_multi_select" text[],
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_chronology_custom_field" UNIQUE("chronology_id","custom_field_id"),
	CONSTRAINT "check_single_value_column" CHECK (
    (field_type = 'number' AND value_number IS NOT NULL AND value_short_text IS NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (field_type = 'short_text' AND value_number IS NULL AND value_short_text IS NOT NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (field_type = 'long_text' AND value_number IS NULL AND value_short_text IS NULL AND value_long_text IS NOT NULL AND value_multi_select IS NULL) OR
    (field_type = 'multi_select' AND value_number IS NULL AND value_short_text IS NULL AND value_long_text IS NULL AND value_multi_select IS NOT NULL AND array_length(value_multi_select, 1) > 0)
  )
);
--> statement-breakpoint
CREATE TABLE "risk_assessment_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"risk_assessment_id" varchar NOT NULL,
	"question_key" varchar NOT NULL,
	"response" "risk_response" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_assessment_question" UNIQUE("risk_assessment_id","question_key")
);
--> statement-breakpoint
CREATE TABLE "risk_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"version" varchar NOT NULL,
	"aml_prepared_by" varchar,
	"preparation_started" timestamp,
	"preparation_completed" timestamp,
	"enhanced_due_diligence_required" boolean DEFAULT false,
	"aml_reviewed_by" varchar,
	"review_started" timestamp,
	"review_completed" timestamp,
	"general_information" text,
	"risk_level" "risk_level",
	"initial_date" timestamp,
	"review_date" timestamp,
	"further_risks_initial_date" timestamp,
	"further_risks_review_date" timestamp,
	"money_laundering_officer" varchar,
	"mlo_review_date" timestamp,
	"electronic_search_reference" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheduled_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_type_notification_id" varchar,
	"client_request_reminder_id" varchar,
	"client_id" varchar NOT NULL,
	"person_id" varchar,
	"client_service_id" varchar,
	"project_id" varchar,
	"task_instance_id" varchar,
	"notification_type" "notification_type" NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"date_reference" date_reference,
	"email_title" varchar,
	"email_body" text,
	"sms_content" varchar(160),
	"push_title" varchar(50),
	"push_body" varchar(120),
	"status" "notification_status" DEFAULT 'scheduled' NOT NULL,
	"sent_at" timestamp,
	"failure_reason" text,
	"cancelled_by" varchar,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"stop_reminders" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "check_notification_source" CHECK (
    (project_type_notification_id IS NOT NULL AND client_request_reminder_id IS NULL) OR
    (project_type_notification_id IS NULL AND client_request_reminder_id IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "scheduling_run_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_date" timestamp NOT NULL,
	"run_type" varchar DEFAULT 'scheduled' NOT NULL,
	"status" varchar NOT NULL,
	"total_services_checked" integer DEFAULT 0 NOT NULL,
	"services_found_due" integer DEFAULT 0 NOT NULL,
	"projects_created" integer DEFAULT 0 NOT NULL,
	"services_rescheduled" integer DEFAULT 0 NOT NULL,
	"errors_encountered" integer DEFAULT 0 NOT NULL,
	"ch_services_skipped" integer DEFAULT 0 NOT NULL,
	"execution_time_ms" integer,
	"error_details" jsonb,
	"summary" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_service_role" UNIQUE("service_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"project_type_id" varchar,
	"udf_definitions" jsonb DEFAULT '[]'::jsonb,
	"is_companies_house_connected" boolean DEFAULT false,
	"ch_start_date_field" varchar,
	"ch_due_date_field" varchar,
	"is_personal_service" boolean DEFAULT false,
	"is_static_service" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "services_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_message_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"last_read_at" timestamp,
	"last_read_message_id" varchar,
	"joined_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_staff_thread_user" UNIQUE("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "staff_message_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"last_message_by_user_id" varchar,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"archived_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staff_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"content" text NOT NULL,
	"user_id" varchar NOT NULL,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stage_approval_fields" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_approval_id" varchar NOT NULL,
	"field_name" varchar NOT NULL,
	"description" text,
	"field_type" "stage_approval_field_type" NOT NULL,
	"is_required" boolean DEFAULT false,
	"order" integer NOT NULL,
	"placeholder" varchar,
	"expected_value_boolean" boolean,
	"comparison_type" "comparison_type",
	"expected_value_number" integer,
	"options" text[],
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "check_boolean_field_validation" CHECK (
    (field_type != 'boolean' OR expected_value_boolean IS NOT NULL)
  ),
	CONSTRAINT "check_number_field_validation" CHECK (
    (field_type != 'number' OR (comparison_type IS NOT NULL AND expected_value_number IS NOT NULL))
  ),
	CONSTRAINT "check_multi_select_field_validation" CHECK (
    (field_type != 'multi_select' OR (options IS NOT NULL AND array_length(options, 1) > 0 AND options <> ARRAY[]::text[]))
  ),
	CONSTRAINT "check_long_text_field_validation" CHECK (
    (field_type != 'long_text' OR (expected_value_boolean IS NULL AND comparison_type IS NULL AND expected_value_number IS NULL AND options IS NULL))
  )
);
--> statement-breakpoint
CREATE TABLE "stage_approval_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"field_id" varchar NOT NULL,
	"value_boolean" boolean,
	"value_number" integer,
	"value_long_text" text,
	"value_multi_select" text[],
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_project_field_response" UNIQUE("project_id","field_id"),
	CONSTRAINT "check_single_value_populated" CHECK (
    (value_boolean IS NOT NULL AND value_number IS NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NOT NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NULL AND value_long_text IS NOT NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NULL AND value_long_text IS NULL AND value_multi_select IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "stage_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_type_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_approval_name_per_project_type" UNIQUE("project_type_id","name")
);
--> statement-breakpoint
CREATE TABLE "stage_reason_maps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" varchar NOT NULL,
	"reason_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_stage_reason" UNIQUE("stage_id","reason_id")
);
--> statement-breakpoint
CREATE TABLE "task_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar NOT NULL,
	"storage_path" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_instance_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_instance_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"response_value" text,
	"file_urls" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_task_instance_question" UNIQUE("task_instance_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "task_instances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"custom_request_id" varchar,
	"client_id" varchar NOT NULL,
	"person_id" varchar,
	"client_portal_user_id" varchar,
	"status" "task_instance_status" DEFAULT 'not_started' NOT NULL,
	"assigned_by" varchar,
	"due_date" timestamp,
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_progress_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_time_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration_minutes" integer,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_types" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "task_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "unmatched_emails" (
	"internet_message_id" varchar PRIMARY KEY NOT NULL,
	"from" varchar NOT NULL,
	"to" text[],
	"cc" text[],
	"subject_stem" text,
	"in_reply_to" varchar,
	"references" text[],
	"received_datetime" timestamp NOT NULL,
	"mailbox_owner_user_id" varchar,
	"direction" "email_direction" NOT NULL,
	"retry_count" integer DEFAULT 0,
	"last_attempt_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_activity_tracking" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"entity_type" "viewed_entity_type" NOT NULL,
	"entity_id" varchar NOT NULL,
	"viewed_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_entity_view" UNIQUE("user_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "user_column_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"view_type" varchar DEFAULT 'projects' NOT NULL,
	"column_order" text[] NOT NULL,
	"visible_columns" text[] NOT NULL,
	"column_widths" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_view_type" UNIQUE("user_id","view_type")
);
--> statement-breakpoint
CREATE TABLE "user_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"integration_type" "integration_type" NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expiry" timestamp,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_integration_type" UNIQUE("user_id","integration_type")
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"notify_stage_changes" boolean DEFAULT true NOT NULL,
	"notify_new_projects" boolean DEFAULT true NOT NULL,
	"notify_scheduling_summary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_oauth_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"provider_account_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"expires_at" timestamp NOT NULL,
	"scope" varchar,
	"token_type" varchar DEFAULT 'Bearer',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_provider" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "user_project_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"default_view_id" varchar,
	"default_view_type" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_project_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"login_time" timestamp DEFAULT now() NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"logout_time" timestamp,
	"ip_address" varchar,
	"city" varchar,
	"country" varchar,
	"browser" varchar,
	"device" varchar,
	"os" varchar,
	"platform_type" varchar,
	"push_enabled" boolean DEFAULT false,
	"session_duration" integer,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"email_signature" text,
	"is_admin" boolean DEFAULT false,
	"can_see_admin_menu" boolean DEFAULT false,
	"super_admin" boolean DEFAULT false,
	"password_hash" varchar,
	"is_fallback_user" boolean DEFAULT false,
	"push_notifications_enabled" boolean DEFAULT true,
	"notification_preferences" jsonb,
	"can_make_services_inactive" boolean DEFAULT false,
	"can_make_projects_inactive" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_login_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "work_roles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "work_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "ch_change_requests" ADD CONSTRAINT "ch_change_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ch_change_requests" ADD CONSTRAINT "ch_change_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_reasons" ADD CONSTRAINT "change_reasons_project_type_id_project_types_id_fk" FOREIGN KEY ("project_type_id") REFERENCES "public"."project_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_reasons" ADD CONSTRAINT "change_reasons_stage_approval_id_stage_approvals_id_fk" FOREIGN KEY ("stage_approval_id") REFERENCES "public"."stage_approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_chronology" ADD CONSTRAINT "client_chronology_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_chronology" ADD CONSTRAINT "client_chronology_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_custom_request_questions" ADD CONSTRAINT "client_custom_request_questions_section_id_client_custom_request_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."client_custom_request_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_custom_request_sections" ADD CONSTRAINT "client_custom_request_sections_request_id_client_custom_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."client_custom_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_custom_requests" ADD CONSTRAINT "client_custom_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_custom_requests" ADD CONSTRAINT "client_custom_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_domain_allowlist" ADD CONSTRAINT "client_domain_allowlist_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_domain_allowlist" ADD CONSTRAINT "client_domain_allowlist_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_email_aliases" ADD CONSTRAINT "client_email_aliases_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_people" ADD CONSTRAINT "client_people_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_people" ADD CONSTRAINT "client_people_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_users" ADD CONSTRAINT "client_portal_users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_portal_users" ADD CONSTRAINT "client_portal_users_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_request_reminders" ADD CONSTRAINT "client_request_reminders_project_type_notification_id_project_type_notifications_id_fk" FOREIGN KEY ("project_type_notification_id") REFERENCES "public"."project_type_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_request_template_questions" ADD CONSTRAINT "client_request_template_questions_section_id_client_request_template_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."client_request_template_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_request_template_sections" ADD CONSTRAINT "client_request_template_sections_template_id_client_request_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."client_request_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_request_templates" ADD CONSTRAINT "client_request_templates_category_id_client_request_template_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."client_request_template_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_request_templates" ADD CONSTRAINT "client_request_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_role_assignments" ADD CONSTRAINT "client_service_role_assignments_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_role_assignments" ADD CONSTRAINT "client_service_role_assignments_work_role_id_work_roles_id_fk" FOREIGN KEY ("work_role_id") REFERENCES "public"."work_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_service_role_assignments" ADD CONSTRAINT "client_service_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_service_owner_id_users_id_fk" FOREIGN KEY ("service_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_inactive_by_user_id_users_id_fk" FOREIGN KEY ("inactive_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tag_assignments" ADD CONSTRAINT "client_tag_assignments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tag_assignments" ADD CONSTRAINT "client_tag_assignments_tag_id_client_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."client_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tag_assignments" ADD CONSTRAINT "client_tag_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications" ADD CONSTRAINT "communications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_views" ADD CONSTRAINT "company_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_cache" ADD CONSTRAINT "dashboard_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_document_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."document_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_portal_user_id_client_portal_users_id_fk" FOREIGN KEY ("client_portal_user_id") REFERENCES "public"."client_portal_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_message_attachments" ADD CONSTRAINT "email_message_attachments_internet_message_id_email_messages_internet_message_id_fk" FOREIGN KEY ("internet_message_id") REFERENCES "public"."email_messages"("internet_message_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_message_attachments" ADD CONSTRAINT "email_message_attachments_attachment_id_email_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."email_attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_canonical_conversation_id_email_threads_canonical_conversation_id_fk" FOREIGN KEY ("canonical_conversation_id") REFERENCES "public"."email_threads"("canonical_conversation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_mailbox_owner_user_id_users_id_fk" FOREIGN KEY ("mailbox_owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_sync_state" ADD CONSTRAINT "graph_sync_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_webhook_subscriptions" ADD CONSTRAINT "graph_webhook_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_task_type_id_task_types_id_fk" FOREIGN KEY ("task_type_id") REFERENCES "public"."task_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_tasks" ADD CONSTRAINT "internal_tasks_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_stages" ADD CONSTRAINT "kanban_stages_project_type_id_project_types_id_fk" FOREIGN KEY ("project_type_id") REFERENCES "public"."project_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_stages" ADD CONSTRAINT "kanban_stages_assigned_work_role_id_work_roles_id_fk" FOREIGN KEY ("assigned_work_role_id") REFERENCES "public"."work_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_stages" ADD CONSTRAINT "kanban_stages_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kanban_stages" ADD CONSTRAINT "kanban_stages_stage_approval_id_stage_approvals_id_fk" FOREIGN KEY ("stage_approval_id") REFERENCES "public"."stage_approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailbox_message_map" ADD CONSTRAINT "mailbox_message_map_mailbox_user_id_users_id_fk" FOREIGN KEY ("mailbox_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailbox_message_map" ADD CONSTRAINT "mailbox_message_map_internet_message_id_email_messages_internet_message_id_fk" FOREIGN KEY ("internet_message_id") REFERENCES "public"."email_messages"("internet_message_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_created_by_client_portal_user_id_client_portal_users_id_fk" FOREIGN KEY ("created_by_client_portal_user_id") REFERENCES "public"."client_portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_client_portal_user_id_client_portal_users_id_fk" FOREIGN KEY ("client_portal_user_id") REFERENCES "public"."client_portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_scheduled_notification_id_scheduled_notifications_id_fk" FOREIGN KEY ("scheduled_notification_id") REFERENCES "public"."scheduled_notifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_icons" ADD CONSTRAINT "notification_icons_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_services" ADD CONSTRAINT "people_services_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_services" ADD CONSTRAINT "people_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_services" ADD CONSTRAINT "people_services_service_owner_id_users_id_fk" FOREIGN KEY ("service_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_tag_assignments" ADD CONSTRAINT "people_tag_assignments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_tag_assignments" ADD CONSTRAINT "people_tag_assignments_tag_id_people_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."people_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people_tag_assignments" ADD CONSTRAINT "people_tag_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_chronology" ADD CONSTRAINT "project_chronology_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_chronology" ADD CONSTRAINT "project_chronology_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_chronology" ADD CONSTRAINT "project_chronology_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_message_participants" ADD CONSTRAINT "project_message_participants_thread_id_project_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."project_message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_message_participants" ADD CONSTRAINT "project_message_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_message_participants" ADD CONSTRAINT "project_message_participants_last_read_message_id_project_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."project_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_message_threads" ADD CONSTRAINT "project_message_threads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_message_threads" ADD CONSTRAINT "project_message_threads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_message_threads" ADD CONSTRAINT "project_message_threads_last_message_by_user_id_users_id_fk" FOREIGN KEY ("last_message_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_message_threads" ADD CONSTRAINT "project_message_threads_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_messages" ADD CONSTRAINT "project_messages_thread_id_project_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."project_message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_messages" ADD CONSTRAINT "project_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_scheduling_history" ADD CONSTRAINT "project_scheduling_history_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_scheduling_history" ADD CONSTRAINT "project_scheduling_history_people_service_id_people_services_id_fk" FOREIGN KEY ("people_service_id") REFERENCES "public"."people_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_scheduling_history" ADD CONSTRAINT "project_scheduling_history_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_type_notifications" ADD CONSTRAINT "project_type_notifications_project_type_id_project_types_id_fk" FOREIGN KEY ("project_type_id") REFERENCES "public"."project_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_type_notifications" ADD CONSTRAINT "project_type_notifications_stage_id_kanban_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."kanban_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_type_notifications" ADD CONSTRAINT "project_type_notifications_client_request_template_id_client_request_templates_id_fk" FOREIGN KEY ("client_request_template_id") REFERENCES "public"."client_request_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_types" ADD CONSTRAINT "project_types_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_views" ADD CONSTRAINT "project_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_type_id_project_types_id_fk" FOREIGN KEY ("project_type_id") REFERENCES "public"."project_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_bookkeeper_id_users_id_fk" FOREIGN KEY ("bookkeeper_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_manager_id_users_id_fk" FOREIGN KEY ("client_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_owner_id_users_id_fk" FOREIGN KEY ("project_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_current_assignee_id_users_id_fk" FOREIGN KEY ("current_assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_inactive_by_user_id_users_id_fk" FOREIGN KEY ("inactive_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_client_portal_user_id_client_portal_users_id_fk" FOREIGN KEY ("client_portal_user_id") REFERENCES "public"."client_portal_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reason_custom_fields" ADD CONSTRAINT "reason_custom_fields_reason_id_change_reasons_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."change_reasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reason_field_responses" ADD CONSTRAINT "reason_field_responses_chronology_id_project_chronology_id_fk" FOREIGN KEY ("chronology_id") REFERENCES "public"."project_chronology"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reason_field_responses" ADD CONSTRAINT "reason_field_responses_custom_field_id_reason_custom_fields_id_fk" FOREIGN KEY ("custom_field_id") REFERENCES "public"."reason_custom_fields"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessment_responses" ADD CONSTRAINT "risk_assessment_responses_risk_assessment_id_risk_assessments_id_fk" FOREIGN KEY ("risk_assessment_id") REFERENCES "public"."risk_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_aml_prepared_by_users_id_fk" FOREIGN KEY ("aml_prepared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_aml_reviewed_by_users_id_fk" FOREIGN KEY ("aml_reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_money_laundering_officer_users_id_fk" FOREIGN KEY ("money_laundering_officer") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_project_type_notification_id_project_type_notifications_id_fk" FOREIGN KEY ("project_type_notification_id") REFERENCES "public"."project_type_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_client_request_reminder_id_client_request_reminders_id_fk" FOREIGN KEY ("client_request_reminder_id") REFERENCES "public"."client_request_reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_client_service_id_client_services_id_fk" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_task_instance_id_task_instances_id_fk" FOREIGN KEY ("task_instance_id") REFERENCES "public"."task_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_roles" ADD CONSTRAINT "service_roles_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_roles" ADD CONSTRAINT "service_roles_role_id_work_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."work_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_project_type_id_project_types_id_fk" FOREIGN KEY ("project_type_id") REFERENCES "public"."project_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_message_participants" ADD CONSTRAINT "staff_message_participants_thread_id_staff_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."staff_message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_message_participants" ADD CONSTRAINT "staff_message_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_message_participants" ADD CONSTRAINT "staff_message_participants_last_read_message_id_staff_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."staff_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_message_threads" ADD CONSTRAINT "staff_message_threads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_message_threads" ADD CONSTRAINT "staff_message_threads_last_message_by_user_id_users_id_fk" FOREIGN KEY ("last_message_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_message_threads" ADD CONSTRAINT "staff_message_threads_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_messages" ADD CONSTRAINT "staff_messages_thread_id_staff_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."staff_message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_messages" ADD CONSTRAINT "staff_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_approval_fields" ADD CONSTRAINT "stage_approval_fields_stage_approval_id_stage_approvals_id_fk" FOREIGN KEY ("stage_approval_id") REFERENCES "public"."stage_approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_approval_responses" ADD CONSTRAINT "stage_approval_responses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_approval_responses" ADD CONSTRAINT "stage_approval_responses_field_id_stage_approval_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."stage_approval_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_approvals" ADD CONSTRAINT "stage_approvals_project_type_id_project_types_id_fk" FOREIGN KEY ("project_type_id") REFERENCES "public"."project_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_reason_maps" ADD CONSTRAINT "stage_reason_maps_stage_id_kanban_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."kanban_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_reason_maps" ADD CONSTRAINT "stage_reason_maps_reason_id_change_reasons_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."change_reasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_connections" ADD CONSTRAINT "task_connections_task_id_internal_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."internal_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_task_id_internal_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."internal_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_instance_responses" ADD CONSTRAINT "task_instance_responses_task_instance_id_task_instances_id_fk" FOREIGN KEY ("task_instance_id") REFERENCES "public"."task_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_template_id_client_request_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."client_request_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_custom_request_id_client_custom_requests_id_fk" FOREIGN KEY ("custom_request_id") REFERENCES "public"."client_custom_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_client_portal_user_id_client_portal_users_id_fk" FOREIGN KEY ("client_portal_user_id") REFERENCES "public"."client_portal_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_instances" ADD CONSTRAINT "task_instances_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_progress_notes" ADD CONSTRAINT "task_progress_notes_task_id_internal_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."internal_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_progress_notes" ADD CONSTRAINT "task_progress_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_task_id_internal_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."internal_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unmatched_emails" ADD CONSTRAINT "unmatched_emails_internet_message_id_email_messages_internet_message_id_fk" FOREIGN KEY ("internet_message_id") REFERENCES "public"."email_messages"("internet_message_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unmatched_emails" ADD CONSTRAINT "unmatched_emails_mailbox_owner_user_id_users_id_fk" FOREIGN KEY ("mailbox_owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_tracking" ADD CONSTRAINT "user_activity_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_column_preferences" ADD CONSTRAINT "user_column_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_oauth_accounts" ADD CONSTRAINT "user_oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_project_preferences" ADD CONSTRAINT "user_project_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ch_change_requests_client_id" ON "ch_change_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_ch_change_requests_status" ON "ch_change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ch_change_requests_change_type" ON "ch_change_requests" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "idx_change_reasons_project_type_id" ON "change_reasons" USING btree ("project_type_id");--> statement-breakpoint
CREATE INDEX "idx_change_reasons_stage_approval_id" ON "change_reasons" USING btree ("stage_approval_id");--> statement-breakpoint
CREATE INDEX "idx_client_chronology_client_id" ON "client_chronology" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_chronology_event_type" ON "client_chronology" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_client_chronology_timestamp" ON "client_chronology" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_client_chronology_entity" ON "client_chronology" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_client_custom_request_questions_section_id" ON "client_custom_request_questions" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_client_custom_request_questions_order" ON "client_custom_request_questions" USING btree ("section_id","order");--> statement-breakpoint
CREATE INDEX "idx_client_custom_request_sections_request_id" ON "client_custom_request_sections" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_client_custom_request_sections_order" ON "client_custom_request_sections" USING btree ("request_id","order");--> statement-breakpoint
CREATE INDEX "idx_client_custom_requests_client_id" ON "client_custom_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_domain_allowlist_client_id" ON "client_domain_allowlist" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_domain_allowlist_domain" ON "client_domain_allowlist" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_client_email_aliases_client_id" ON "client_email_aliases" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_email_aliases_email" ON "client_email_aliases" USING btree ("email_lowercase");--> statement-breakpoint
CREATE INDEX "client_portal_sessions_expire_idx" ON "client_portal_sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "client_portal_users_client_id_idx" ON "client_portal_users" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_portal_users_person_id_idx" ON "client_portal_users" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_client_request_reminders_notification_id" ON "client_request_reminders" USING btree ("project_type_notification_id");--> statement-breakpoint
CREATE INDEX "idx_task_template_categories_order" ON "client_request_template_categories" USING btree ("order");--> statement-breakpoint
CREATE INDEX "idx_task_template_questions_section_id" ON "client_request_template_questions" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_task_template_questions_order" ON "client_request_template_questions" USING btree ("section_id","order");--> statement-breakpoint
CREATE INDEX "idx_task_template_sections_template_id" ON "client_request_template_sections" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_task_template_sections_order" ON "client_request_template_sections" USING btree ("template_id","order");--> statement-breakpoint
CREATE INDEX "idx_task_templates_category_id" ON "client_request_templates" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_task_templates_status" ON "client_request_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_client_service_role_assignments_client_service_id" ON "client_service_role_assignments" USING btree ("client_service_id");--> statement-breakpoint
CREATE INDEX "idx_client_service_role_assignments_work_role_id" ON "client_service_role_assignments" USING btree ("work_role_id");--> statement-breakpoint
CREATE INDEX "idx_client_service_role_assignments_user_id" ON "client_service_role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_service_role_assignments_active" ON "client_service_role_assignments" USING btree ("client_service_id","work_role_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_client_services_client_id" ON "client_services" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_services_service_id" ON "client_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "idx_client_services_service_owner_id" ON "client_services" USING btree ("service_owner_id");--> statement-breakpoint
CREATE INDEX "idx_client_services_next_due_date" ON "client_services" USING btree ("next_due_date");--> statement-breakpoint
CREATE INDEX "idx_client_services_inactive_by_user_id" ON "client_services" USING btree ("inactive_by_user_id");--> statement-breakpoint
CREATE INDEX "communications_client_id_logged_at_idx" ON "communications" USING btree ("client_id","logged_at");--> statement-breakpoint
CREATE INDEX "communications_person_id_logged_at_idx" ON "communications" USING btree ("person_id","logged_at");--> statement-breakpoint
CREATE INDEX "communications_project_id_logged_at_idx" ON "communications" USING btree ("project_id","logged_at");--> statement-breakpoint
CREATE INDEX "communications_thread_id_idx" ON "communications" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_company_views_user_id" ON "company_views" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dashboard_cache_user_id" ON "dashboard_cache" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dashboard_cache_last_updated" ON "dashboard_cache" USING btree ("last_updated");--> statement-breakpoint
CREATE INDEX "idx_dashboards_user_id" ON "dashboards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dashboards_visibility" ON "dashboards" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "idx_dashboards_homescreen" ON "dashboards" USING btree ("user_id","is_homescreen_dashboard");--> statement-breakpoint
CREATE INDEX "idx_document_folders_client_id" ON "document_folders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_document_folders_created_at" ON "document_folders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_documents_client_id" ON "documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_documents_folder_id" ON "documents" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "idx_documents_uploaded_at" ON "documents" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "idx_documents_client_portal_user_id" ON "documents" USING btree ("client_portal_user_id");--> statement-breakpoint
CREATE INDEX "idx_documents_message_id" ON "documents" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_documents_thread_id" ON "documents" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_documents_task_instance_id" ON "documents" USING btree ("task_instance_id");--> statement-breakpoint
CREATE INDEX "idx_documents_source" ON "documents" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_email_attachments_content_hash" ON "email_attachments" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_email_message_attachments_message_id" ON "email_message_attachments" USING btree ("internet_message_id");--> statement-breakpoint
CREATE INDEX "idx_email_message_attachments_attachment_id" ON "email_message_attachments" USING btree ("attachment_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_canonical_conversation_id" ON "email_messages" USING btree ("canonical_conversation_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_thread_key" ON "email_messages" USING btree ("thread_key");--> statement-breakpoint
CREATE INDEX "idx_email_messages_in_reply_to" ON "email_messages" USING btree ("in_reply_to");--> statement-breakpoint
CREATE INDEX "idx_email_messages_client_id" ON "email_messages" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_client_id_received" ON "email_messages" USING btree ("client_id","received_datetime");--> statement-breakpoint
CREATE INDEX "idx_email_messages_from" ON "email_messages" USING btree ("from");--> statement-breakpoint
CREATE INDEX "idx_email_messages_mailbox_owner" ON "email_messages" USING btree ("mailbox_owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_direction" ON "email_messages" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "idx_email_messages_is_internal_only" ON "email_messages" USING btree ("is_internal_only");--> statement-breakpoint
CREATE INDEX "idx_email_messages_received_datetime" ON "email_messages" USING btree ("received_datetime");--> statement-breakpoint
CREATE INDEX "idx_email_threads_client_id" ON "email_threads" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_email_threads_last_message_at" ON "email_threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "idx_email_threads_thread_key" ON "email_threads" USING btree ("thread_key");--> statement-breakpoint
CREATE INDEX "idx_graph_sync_state_user_id" ON "graph_sync_state" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_graph_sync_state_last_sync" ON "graph_sync_state" USING btree ("last_sync_at");--> statement-breakpoint
CREATE INDEX "idx_graph_subscriptions_user_id" ON "graph_webhook_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_graph_subscriptions_expires_at" ON "graph_webhook_subscriptions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_graph_subscriptions_is_active" ON "graph_webhook_subscriptions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_internal_tasks_status" ON "internal_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_internal_tasks_priority" ON "internal_tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_internal_tasks_created_by" ON "internal_tasks" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_internal_tasks_assigned_to" ON "internal_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_internal_tasks_task_type_id" ON "internal_tasks" USING btree ("task_type_id");--> statement-breakpoint
CREATE INDEX "idx_internal_tasks_due_date" ON "internal_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_internal_tasks_is_archived" ON "internal_tasks" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "idx_kanban_stages_project_type_id" ON "kanban_stages" USING btree ("project_type_id");--> statement-breakpoint
CREATE INDEX "idx_kanban_stages_assigned_work_role_id" ON "kanban_stages" USING btree ("assigned_work_role_id");--> statement-breakpoint
CREATE INDEX "idx_kanban_stages_assigned_user_id" ON "kanban_stages" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_email" ON "login_attempts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_timestamp" ON "login_attempts" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_success" ON "login_attempts" USING btree ("success");--> statement-breakpoint
CREATE INDEX "idx_mailbox_message_map_internet_message_id" ON "mailbox_message_map" USING btree ("internet_message_id");--> statement-breakpoint
CREATE INDEX "idx_mailbox_message_map_mailbox_user" ON "mailbox_message_map" USING btree ("mailbox_user_id");--> statement-breakpoint
CREATE INDEX "message_threads_client_id_last_message_idx" ON "message_threads" USING btree ("client_id","last_message_at");--> statement-breakpoint
CREATE INDEX "message_threads_status_idx" ON "message_threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "message_threads_is_archived_idx" ON "message_threads" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "message_threads_last_message_by_staff_idx" ON "message_threads" USING btree ("last_message_by_staff");--> statement-breakpoint
CREATE INDEX "messages_thread_id_created_at_idx" ON "messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_is_read_by_staff_idx" ON "messages" USING btree ("is_read_by_staff");--> statement-breakpoint
CREATE INDEX "messages_is_read_by_client_idx" ON "messages" USING btree ("is_read_by_client");--> statement-breakpoint
CREATE INDEX "idx_notification_history_scheduled_notification_id" ON "notification_history" USING btree ("scheduled_notification_id");--> statement-breakpoint
CREATE INDEX "idx_notification_history_client_id" ON "notification_history" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_notification_history_sent_at" ON "notification_history" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_notification_history_status" ON "notification_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notification_history_notification_type" ON "notification_history" USING btree ("notification_type");--> statement-breakpoint
CREATE INDEX "notification_icons_uploaded_by_idx" ON "notification_icons" USING btree ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_people_primary_phone" ON "people" USING btree ("primary_phone");--> statement-breakpoint
CREATE INDEX "idx_people_services_person_id" ON "people_services" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_people_services_service_id" ON "people_services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "idx_people_services_service_owner_id" ON "people_services" USING btree ("service_owner_id");--> statement-breakpoint
CREATE INDEX "idx_people_services_next_due_date" ON "people_services" USING btree ("next_due_date");--> statement-breakpoint
CREATE INDEX "project_message_participants_thread_id_idx" ON "project_message_participants" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "project_message_participants_user_id_idx" ON "project_message_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_message_threads_project_id_last_message_idx" ON "project_message_threads" USING btree ("project_id","last_message_at");--> statement-breakpoint
CREATE INDEX "project_message_threads_is_archived_idx" ON "project_message_threads" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "project_messages_thread_id_created_at_idx" ON "project_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "project_messages_user_id_idx" ON "project_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_project_scheduling_history_client_service_id" ON "project_scheduling_history" USING btree ("client_service_id");--> statement-breakpoint
CREATE INDEX "idx_project_scheduling_history_people_service_id" ON "project_scheduling_history" USING btree ("people_service_id");--> statement-breakpoint
CREATE INDEX "idx_project_scheduling_history_project_id" ON "project_scheduling_history" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_scheduling_history_action" ON "project_scheduling_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_project_scheduling_history_scheduled_date" ON "project_scheduling_history" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_project_scheduling_history_created_at" ON "project_scheduling_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_project_type_notifications_project_type_id" ON "project_type_notifications" USING btree ("project_type_id");--> statement-breakpoint
CREATE INDEX "idx_project_type_notifications_stage_id" ON "project_type_notifications" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "idx_project_type_notifications_category" ON "project_type_notifications" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_project_views_user_id" ON "project_views" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_projects_project_owner_id" ON "projects" USING btree ("project_owner_id");--> statement-breakpoint
CREATE INDEX "idx_projects_current_assignee_id" ON "projects" USING btree ("current_assignee_id");--> statement-breakpoint
CREATE INDEX "idx_projects_project_type_id" ON "projects" USING btree ("project_type_id");--> statement-breakpoint
CREATE INDEX "idx_projects_archived" ON "projects" USING btree ("archived");--> statement-breakpoint
CREATE INDEX "idx_projects_client_id" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "push_templates_type_idx" ON "push_notification_templates" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_client_portal_user_id_idx" ON "push_subscriptions" USING btree ("client_portal_user_id");--> statement-breakpoint
CREATE INDEX "idx_reason_custom_fields_reason_id" ON "reason_custom_fields" USING btree ("reason_id");--> statement-breakpoint
CREATE INDEX "idx_reason_field_responses_chronology_id" ON "reason_field_responses" USING btree ("chronology_id");--> statement-breakpoint
CREATE INDEX "idx_reason_field_responses_custom_field_id" ON "reason_field_responses" USING btree ("custom_field_id");--> statement-breakpoint
CREATE INDEX "idx_risk_responses_assessment_id" ON "risk_assessment_responses" USING btree ("risk_assessment_id");--> statement-breakpoint
CREATE INDEX "idx_risk_assessments_client_id" ON "risk_assessments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_risk_assessments_version" ON "risk_assessments" USING btree ("version");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_project_type_notification_id" ON "scheduled_notifications" USING btree ("project_type_notification_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_client_request_reminder_id" ON "scheduled_notifications" USING btree ("client_request_reminder_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_client_id" ON "scheduled_notifications" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_person_id" ON "scheduled_notifications" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_client_service_id" ON "scheduled_notifications" USING btree ("client_service_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_project_id" ON "scheduled_notifications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_task_instance_id" ON "scheduled_notifications" USING btree ("task_instance_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_scheduled_for" ON "scheduled_notifications" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_status" ON "scheduled_notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_client_status_scheduled" ON "scheduled_notifications" USING btree ("client_id","status","scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_scheduled_notifications_client_status_sent" ON "scheduled_notifications" USING btree ("client_id","status","sent_at");--> statement-breakpoint
CREATE INDEX "idx_scheduling_run_logs_run_date" ON "scheduling_run_logs" USING btree ("run_date");--> statement-breakpoint
CREATE INDEX "idx_scheduling_run_logs_status" ON "scheduling_run_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scheduling_run_logs_run_type" ON "scheduling_run_logs" USING btree ("run_type");--> statement-breakpoint
CREATE INDEX "idx_service_roles_service_id" ON "service_roles" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "idx_service_roles_role_id" ON "service_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "staff_message_participants_thread_id_idx" ON "staff_message_participants" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "staff_message_participants_user_id_idx" ON "staff_message_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "staff_message_threads_last_message_idx" ON "staff_message_threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "staff_message_threads_is_archived_idx" ON "staff_message_threads" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "staff_messages_thread_id_created_at_idx" ON "staff_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "staff_messages_user_id_idx" ON "staff_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stage_approval_fields_stage_approval_id" ON "stage_approval_fields" USING btree ("stage_approval_id");--> statement-breakpoint
CREATE INDEX "idx_stage_approval_responses_project_id" ON "stage_approval_responses" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_stage_approval_responses_field_id" ON "stage_approval_responses" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "idx_stage_approvals_project_type_id" ON "stage_approvals" USING btree ("project_type_id");--> statement-breakpoint
CREATE INDEX "idx_stage_reason_maps_stage_id" ON "stage_reason_maps" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "idx_stage_reason_maps_reason_id" ON "stage_reason_maps" USING btree ("reason_id");--> statement-breakpoint
CREATE INDEX "idx_task_connections_task_id" ON "task_connections" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_connections_entity" ON "task_connections" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_task_documents_task_id" ON "task_documents" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_documents_uploaded_by" ON "task_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_task_instance_responses_task_instance_id" ON "task_instance_responses" USING btree ("task_instance_id");--> statement-breakpoint
CREATE INDEX "idx_task_instance_responses_question_id" ON "task_instance_responses" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_task_instances_template_id" ON "task_instances" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "idx_task_instances_custom_request_id" ON "task_instances" USING btree ("custom_request_id");--> statement-breakpoint
CREATE INDEX "idx_task_instances_client_id" ON "task_instances" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_task_instances_person_id" ON "task_instances" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_task_instances_client_portal_user_id" ON "task_instances" USING btree ("client_portal_user_id");--> statement-breakpoint
CREATE INDEX "idx_task_instances_status" ON "task_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_task_progress_notes_task_id" ON "task_progress_notes" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_progress_notes_user_id" ON "task_progress_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_task_progress_notes_created_at" ON "task_progress_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_task_time_entries_task_id" ON "task_time_entries" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_time_entries_user_id" ON "task_time_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_task_time_entries_start_time" ON "task_time_entries" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_unmatched_emails_from" ON "unmatched_emails" USING btree ("from");--> statement-breakpoint
CREATE INDEX "idx_unmatched_emails_received_datetime" ON "unmatched_emails" USING btree ("received_datetime");--> statement-breakpoint
CREATE INDEX "idx_unmatched_emails_in_reply_to" ON "unmatched_emails" USING btree ("in_reply_to");--> statement-breakpoint
CREATE INDEX "idx_unmatched_emails_retry_count" ON "unmatched_emails" USING btree ("retry_count");--> statement-breakpoint
CREATE INDEX "user_activity_tracking_user_viewed_at_idx" ON "user_activity_tracking" USING btree ("user_id","viewed_at");--> statement-breakpoint
CREATE INDEX "idx_user_column_preferences_user_id" ON "user_column_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_oauth_accounts_user_id" ON "user_oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_oauth_accounts_provider" ON "user_oauth_accounts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_user_project_preferences_user_id" ON "user_project_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_login_time" ON "user_sessions" USING btree ("login_time");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_is_active" ON "user_sessions" USING btree ("is_active");