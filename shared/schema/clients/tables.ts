import { pgTable, varchar, text, timestamp, boolean, index, unique, jsonb, integer, decimal } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../users/tables';
import { nationalityEnum, nlacReasonEnum } from '../enums';
import { emailMatchConfidenceEnum } from '../email/tables';

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  email: varchar("email"),
  createdAt: timestamp("created_at").defaultNow(),
  clientType: varchar("client_type"),
  companyNumber: varchar("company_number"),
  companiesHouseName: varchar("companies_house_name"),
  companyStatus: varchar("company_status"),
  companyStatusDetail: varchar("company_status_detail"),
  companyType: varchar("company_type"),
  dateOfCreation: timestamp("date_of_creation"),
  jurisdiction: varchar("jurisdiction"),
  sicCodes: text("sic_codes").array(),
  registeredAddress1: varchar("registered_address_1"),
  registeredAddress2: varchar("registered_address_2"),
  registeredAddress3: varchar("registered_address_3"),
  registeredCountry: varchar("registered_country"),
  registeredPostcode: varchar("registered_postcode"),
  accountingReferenceDay: integer("accounting_reference_day"),
  accountingReferenceMonth: integer("accounting_reference_month"),
  lastAccountsMadeUpTo: timestamp("last_accounts_made_up_to"),
  lastAccountsType: varchar("last_accounts_type"),
  nextAccountsDue: timestamp("next_accounts_due"),
  nextAccountsPeriodEnd: timestamp("next_accounts_period_end"),
  accountsOverdue: boolean("accounts_overdue").default(false),
  confirmationStatementLastMadeUpTo: timestamp("confirmation_statement_last_made_up_to"),
  confirmationStatementNextDue: timestamp("confirmation_statement_next_due"),
  confirmationStatementNextMadeUpTo: timestamp("confirmation_statement_next_made_up_to"),
  confirmationStatementOverdue: boolean("confirmation_statement_overdue").default(false),
  companiesHouseData: jsonb("companies_house_data"),
  
  managerId: varchar("manager_id").references(() => users.id),
  clientOnboardedDate: timestamp("client_onboarded_date"),
  monthlyChargeQuote: decimal("monthly_charge_quote", { precision: 10, scale: 2 }),
  companyUtr: varchar("company_utr"),
  companiesHouseAuthCode: varchar("companies_house_auth_code"),
  companyTelephone: varchar("company_telephone"),
  postalAddress1: varchar("postal_address_1"),
  postalAddress2: varchar("postal_address_2"),
  postalAddress3: varchar("postal_address_3"),
  postalAddressPostcode: varchar("postal_address_postcode"),
  postalAddressCountry: varchar("postal_address_country"),
  companyEmailDomain: varchar("company_email_domain"),
  tradingAs: varchar("trading_as"),
  notes: text("notes"),
});

export const people = pgTable("people", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  personNumber: text("person_number"),
  fullName: text("full_name").notNull(),
  title: text("title"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  dateOfBirth: text("date_of_birth"),
  nationality: nationalityEnum("nationality"),
  countryOfResidence: text("country_of_residence"),
  occupation: text("occupation"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  locality: text("locality"),
  region: text("region"),
  postalCode: text("postal_code"),
  country: text("country"),
  email: text("email"),
  telephone: text("telephone"),
  primaryPhone: text("primary_phone"),
  primaryEmail: text("primary_email"),
  telephone2: text("telephone_2"),
  email2: text("email_2"),
  linkedinUrl: text("linkedin_url"),
  instagramUrl: text("instagram_url"),
  twitterUrl: text("twitter_url"),
  facebookUrl: text("facebook_url"),
  tiktokUrl: text("tiktok_url"),
  notes: text("notes"),
  isMainContact: boolean("is_main_contact").default(false),
  receiveNotifications: boolean("receive_notifications").default(true),
  niNumber: text("ni_number"),
  personalUtrNumber: text("personal_utr_number"),
  photoIdVerified: boolean("photo_id_verified").default(false),
  addressVerified: boolean("address_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  
  initialContactDate: timestamp("initial_contact_date"),
  invoiceAddressType: text("invoice_address_type"),
  amlComplete: boolean("aml_complete").default(false),
});

export const clientPeople = pgTable("client_people", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  officerRole: text("officer_role"),
  isPrimaryContact: boolean("is_primary_contact"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniquePersonCompany: unique("unique_person_company").on(table.clientId, table.personId),
}));

export const clientChronology = pgTable("client_chronology", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  eventType: varchar("event_type").notNull(),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  fromValue: varchar("from_value"),
  toValue: varchar("to_value").notNull(),
  userId: varchar("user_id").references(() => users.id),
  changeReason: varchar("change_reason"),
  notes: text("notes"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_client_chronology_client_id").on(table.clientId),
  index("idx_client_chronology_event_type").on(table.eventType),
  index("idx_client_chronology_timestamp").on(table.timestamp),
  index("idx_client_chronology_entity").on(table.entityType, table.entityId),
]);

export const clientTags = pgTable("client_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  color: varchar("color").notNull().default("#3b82f6"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const peopleTags = pgTable("people_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  color: varchar("color").notNull().default("#3b82f6"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientTagAssignments = pgTable("client_tag_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id").notNull().references(() => clientTags.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id),
}, (table) => ({
  uniqueClientTag: unique().on(table.clientId, table.tagId),
}));

export const peopleTagAssignments = pgTable("people_tag_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id").notNull().references(() => peopleTags.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id),
}, (table) => ({
  uniquePersonTag: unique().on(table.personId, table.tagId),
}));

export const clientPortalUsers = pgTable("client_portal_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  personId: text("person_id").references(() => people.id, { onDelete: "cascade" }),
  email: varchar("email").notNull(),
  name: varchar("name"),
  magicLinkToken: text("magic_link_token"),
  tokenExpiry: timestamp("token_expiry"),
  verificationCode: varchar("verification_code", { length: 6 }),
  codeExpiry: timestamp("code_expiry"),
  lastLogin: timestamp("last_login"),
  pushNotificationsEnabled: boolean("push_notifications_enabled").default(false),
  notificationPreferences: jsonb("notification_preferences"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueEmail: unique("unique_client_portal_email").on(table.email),
  clientIdIdx: index("client_portal_users_client_id_idx").on(table.clientId),
  personIdIdx: index("client_portal_users_person_id_idx").on(table.personId),
}));

export const clientPortalSessions = pgTable("client_portal_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
}, (table) => ({
  expireIdx: index("client_portal_sessions_expire_idx").on(table.expire),
}));

export const clientEmailAliases = pgTable("client_email_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  emailLowercase: varchar("email_lowercase").notNull(),
  isPrimary: boolean("is_primary").default(false),
  source: varchar("source").default('manual'),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_client_email").on(table.emailLowercase),
  index("idx_client_email_aliases_client_id").on(table.clientId),
  index("idx_client_email_aliases_email").on(table.emailLowercase),
]);

export const clientDomainAllowlist = pgTable("client_domain_allowlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  domain: varchar("domain").notNull(),
  matchConfidence: emailMatchConfidenceEnum("match_confidence").default('medium'),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("unique_client_domain").on(table.clientId, table.domain),
  index("idx_client_domain_allowlist_client_id").on(table.clientId),
  index("idx_client_domain_allowlist_domain").on(table.domain),
]);

export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailSenderName: varchar("email_sender_name").default("The Link Team"),
  firmName: varchar("firm_name").default("The Link"),
  firmPhone: varchar("firm_phone"),
  firmEmail: varchar("firm_email"),
  portalUrl: varchar("portal_url"),
  pushNotificationsEnabled: boolean("push_notifications_enabled").default(false).notNull(),
  postSignatureRedirectUrls: jsonb("post_signature_redirect_urls").default(sql`'[]'::jsonb`),
  logoObjectPath: varchar("logo_object_path"),
  maintenanceMode: boolean("maintenance_mode").default(false).notNull(),
  maintenanceMessage: text("maintenance_message"),
  nlacPassword: varchar("nlac_password"),
  ringCentralLive: boolean("ring_central_live").default(false).notNull(),
  appIsLive: boolean("app_is_live").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const nlacAuditLogs = pgTable("nlac_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  clientName: varchar("client_name").notNull(),
  reason: nlacReasonEnum("reason").notNull(),
  performedByUserId: varchar("performed_by_user_id").notNull().references(() => users.id),
  performedByUserName: varchar("performed_by_user_name").notNull(),
  projectsDeactivated: integer("projects_deactivated").default(0),
  servicesDeactivated: integer("services_deactivated").default(0),
  portalUsersDeactivated: integer("portal_users_deactivated").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_nlac_audit_logs_client_id").on(table.clientId),
  index("idx_nlac_audit_logs_performed_by").on(table.performedByUserId),
  index("idx_nlac_audit_logs_created_at").on(table.createdAt),
]);
