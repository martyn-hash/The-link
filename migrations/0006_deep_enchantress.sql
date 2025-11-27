CREATE TYPE "public"."nlac_reason" AS ENUM('moving_to_new_accountant', 'ceasing_trading', 'no_longer_using_accountant', 'taking_accounts_in_house', 'other', 'reactivated');--> statement-breakpoint
CREATE TABLE "nlac_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"client_name" varchar NOT NULL,
	"reason" "nlac_reason" NOT NULL,
	"performed_by_user_id" varchar NOT NULL,
	"performed_by_user_name" varchar NOT NULL,
	"projects_deactivated" integer DEFAULT 0,
	"services_deactivated" integer DEFAULT 0,
	"portal_users_deactivated" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "client_portal_users" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "nlac_password" varchar;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "ring_central_live" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company_settings" ADD COLUMN "app_is_live" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nlac_audit_logs" ADD CONSTRAINT "nlac_audit_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nlac_audit_logs" ADD CONSTRAINT "nlac_audit_logs_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_nlac_audit_logs_client_id" ON "nlac_audit_logs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_nlac_audit_logs_performed_by" ON "nlac_audit_logs" USING btree ("performed_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_nlac_audit_logs_created_at" ON "nlac_audit_logs" USING btree ("created_at");