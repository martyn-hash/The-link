import { pgTable, varchar, text, timestamp, boolean, integer, PgColumn, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export interface DialoraVariableMapping {
  key: string;
  field: string;
}

export interface DialoraOutboundWebhook {
  id: string;
  name: string;
  url: string;
  messageTemplate: string;
  active: boolean;
  variables?: string;
  variableMappings?: DialoraVariableMapping[];
}

export const DIALORA_AVAILABLE_FIELDS = [
  { value: 'recipient.firstName', label: 'Recipient First Name', description: 'First name of the person being called' },
  { value: 'recipient.lastName', label: 'Recipient Last Name', description: 'Last name of the person being called' },
  { value: 'recipient.fullName', label: 'Recipient Full Name', description: 'Full name of the person being called' },
  { value: 'recipient.email', label: 'Recipient Email', description: 'Email of the person being called' },
  { value: 'recipient.phone', label: 'Recipient Phone', description: 'Phone number of the person being called' },
  { value: 'client.name', label: 'Company Name', description: 'The client/company name' },
  { value: 'client.tradingAs', label: 'Trading As', description: 'Trading name if different from company name' },
  { value: 'client.companyNumber', label: 'Company Number', description: 'Companies House number' },
  { value: 'client.companyUtr', label: 'Company UTR', description: 'Company Unique Taxpayer Reference' },
  { value: 'client.telephone', label: 'Client Telephone', description: 'Main telephone for the client' },
  { value: 'client.email', label: 'Client Email', description: 'Primary email for the client' },
  { value: 'project.name', label: 'Project Name', description: 'Name of the project' },
  { value: 'project.reference', label: 'Project Reference', description: 'Reference number for the project' },
  { value: 'project.dueDate', label: 'Project Due Date', description: 'Due date for the project (formatted)' },
  { value: 'project.status', label: 'Project Status', description: 'Current status of the project' },
  { value: 'queries.pending', label: 'Pending Queries', description: 'Number of unanswered queries' },
  { value: 'queries.total', label: 'Total Queries', description: 'Total number of queries' },
  { value: 'queries.answered', label: 'Answered Queries', description: 'Number of answered queries' },
] as const;

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
  enableClientProjectTasks: boolean("enable_client_project_tasks").default(true),
  singleProjectPerClient: boolean("single_project_per_client").default(false),
  order: integer("order").notNull(),
  dialoraSettings: jsonb("dialora_settings").$type<DialoraSettings>(),
  useVoiceAiForQueries: boolean("use_voice_ai_for_queries").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
