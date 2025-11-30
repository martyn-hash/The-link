CREATE TYPE "public"."service_client_type" AS ENUM('company', 'individual', 'both');--> statement-breakpoint
CREATE TABLE "qbo_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"realm_id" varchar NOT NULL,
	"company_name" varchar,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"refresh_token_expires_at" timestamp NOT NULL,
	"scope" varchar,
	"is_active" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"last_error_message" text,
	"connected_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qbo_oauth_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "qbo_oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "applicable_client_types" "service_client_type" DEFAULT 'company';--> statement-breakpoint
ALTER TABLE "qbo_connections" ADD CONSTRAINT "qbo_connections_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_connections" ADD CONSTRAINT "qbo_connections_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_oauth_states" ADD CONSTRAINT "qbo_oauth_states_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_oauth_states" ADD CONSTRAINT "qbo_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_qbo_connections_client_id" ON "qbo_connections" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_qbo_connections_realm_id" ON "qbo_connections" USING btree ("realm_id");--> statement-breakpoint
CREATE INDEX "idx_qbo_connections_is_active" ON "qbo_connections" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_qbo_oauth_states_state" ON "qbo_oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_qbo_oauth_states_expires_at" ON "qbo_oauth_states" USING btree ("expires_at");