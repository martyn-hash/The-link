CREATE TABLE "service_assignment_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"filters" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "calendly_link" varchar;--> statement-breakpoint
ALTER TABLE "project_chronology" ADD COLUMN "entry_type" varchar DEFAULT 'stage_change';--> statement-breakpoint
ALTER TABLE "service_assignment_views" ADD CONSTRAINT "service_assignment_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_service_assignment_views_user_id" ON "service_assignment_views" USING btree ("user_id");