import { pgTable, varchar, text, timestamp, boolean, integer, PgColumn, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export interface DialoraOutboundWebhook {
  id: string;
  name: string;
  url: string;
  messageTemplate: string;
  active: boolean;
  variables?: string;
}

export interface DialoraSettings {
  inboundWebhookUrl?: string;
  outboundWebhooks?: DialoraOutboundWebhook[];
}

export const projectTypes = pgTable("project_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  serviceId: varchar("service_id"),
  active: boolean("active").default(true),
  notificationsActive: boolean("notifications_active").default(true),
  singleProjectPerClient: boolean("single_project_per_client").default(false),
  order: integer("order").notNull(),
  dialoraSettings: jsonb("dialora_settings").$type<DialoraSettings>(),
  useVoiceAiForQueries: boolean("use_voice_ai_for_queries").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
