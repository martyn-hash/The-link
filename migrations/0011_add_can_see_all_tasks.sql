CREATE TABLE "inboxes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_address" varchar NOT NULL,
	"display_name" varchar,
	"inbox_type" varchar DEFAULT 'user' NOT NULL,
	"linked_user_id" varchar,
	"azure_user_id" varchar,
	"is_active" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "inboxes_email_address_unique" UNIQUE("email_address")
);
--> statement-breakpoint
CREATE TABLE "user_inbox_access" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"inbox_id" varchar NOT NULL,
	"access_level" varchar DEFAULT 'read' NOT NULL,
	"granted_by" varchar,
	"granted_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_inbox_access" UNIQUE("user_id","inbox_id")
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_see_all_tasks" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "email_module_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_types" ADD COLUMN "use_voice_ai_for_queries" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "use_voice_ai_for_queries" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "inboxes" ADD CONSTRAINT "inboxes_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inbox_access" ADD CONSTRAINT "user_inbox_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inbox_access" ADD CONSTRAINT "user_inbox_access_inbox_id_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_inbox_access" ADD CONSTRAINT "user_inbox_access_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inboxes_email_address" ON "inboxes" USING btree ("email_address");--> statement-breakpoint
CREATE INDEX "idx_inboxes_linked_user_id" ON "inboxes" USING btree ("linked_user_id");--> statement-breakpoint
CREATE INDEX "idx_inboxes_inbox_type" ON "inboxes" USING btree ("inbox_type");--> statement-breakpoint
CREATE INDEX "idx_inboxes_is_active" ON "inboxes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_user_inbox_access_user_id" ON "user_inbox_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_inbox_access_inbox_id" ON "user_inbox_access" USING btree ("inbox_id");--> statement-breakpoint
CREATE INDEX "sms_templates_name_idx" ON "sms_templates" USING btree ("name");