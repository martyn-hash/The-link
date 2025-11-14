import { sql, relations, SQL } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
  check,
  unique,
  uniqueIndex,
  alias,
  AnyPgColumn,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export function lower(column: AnyPgColumn): SQL {
  return sql`lower(${column})`;
}

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);


// Project status enum
export const projectStatusEnum = pgEnum("project_status", [
  "no_latest_action",
  "bookkeeping_work_required", 
  "in_review",
  "needs_client_input",
  "completed"
]);

// Note: Change reason enum removed - now using varchar for custom text input like kanban stages
// export const changeReasonEnum = pgEnum("change_reason", [
//   "errors_identified_from_bookkeeper",
//   "first_allocation_of_work", 
//   "queries_answered",
//   "work_completed_successfully",
//   "clarifications_needed"
// ]);

// Nationality enum with comprehensive country list
export const nationalityEnum = pgEnum("nationality", [
  "afghan", "albanian", "algerian", "american", "andorran", "angolan", "antiguans", "argentinean", "armenian", "australian",
  "austrian", "azerbaijani", "bahamian", "bahraini", "bangladeshi", "barbadian", "barbudans", "batswana", "belarusian", "belgian",
  "belizean", "beninese", "bhutanese", "bolivian", "bosnian", "brazilian", "british", "bruneian", "bulgarian", "burkinabe",
  "burmese", "burundian", "cambodian", "cameroonian", "canadian", "cape_verdean", "central_african", "chadian", "chilean", "chinese",
  "colombian", "comoran", "congolese", "costa_rican", "croatian", "cuban", "cypriot", "czech", "danish", "djibouti",
  "dominican", "dutch", "east_timorese", "ecuadorean", "egyptian", "emirian", "equatorial_guinean", "eritrean", "estonian", "ethiopian",
  "fijian", "filipino", "finnish", "french", "gabonese", "gambian", "georgian", "german", "ghanaian", "greek",
  "grenadian", "guatemalan", "guinea_bissauan", "guinean", "guyanese", "haitian", "herzegovinian", "honduran", "hungarian", "icelander",
  "indian", "indonesian", "iranian", "iraqi", "irish", "israeli", "italian", "ivorian", "jamaican", "japanese",
  "jordanian", "kazakhstani", "kenyan", "kittian_and_nevisian", "kuwaiti", "kyrgyz", "laotian", "latvian", "lebanese", "liberian",
  "libyan", "liechtensteiner", "lithuanian", "luxembourger", "macedonian", "malagasy", "malawian", "malaysian", "maldivan", "malian",
  "maltese", "marshallese", "mauritanian", "mauritian", "mexican", "micronesian", "moldovan", "monacan", "mongolian", "moroccan",
  "mosotho", "motswana", "mozambican", "namibian", "nauruan", "nepalese", "new_zealander", "ni_vanuatu", "nicaraguan", "nigerien",
  "north_korean", "northern_irish", "norwegian", "omani", "pakistani", "palauan", "panamanian", "papua_new_guinean", "paraguayan", "peruvian",
  "polish", "portuguese", "qatari", "romanian", "russian", "rwandan", "saint_lucian", "salvadoran", "samoan", "san_marinese",
  "sao_tomean", "saudi", "scottish", "senegalese", "serbian", "seychellois", "sierra_leonean", "singaporean", "slovakian", "slovenian",
  "solomon_islander", "somali", "south_african", "south_korean", "spanish", "sri_lankan", "sudanese", "surinamer", "swazi", "swedish",
  "swiss", "syrian", "taiwanese", "tajik", "tanzanian", "thai", "togolese", "tongan", "trinidadian_or_tobagonian", "tunisian",
  "turkish", "tuvaluan", "ugandan", "ukrainian", "uruguayan", "uzbekistani", "venezuelan", "vietnamese", "welsh", "yemenite",
  "zambian", "zimbabwean"
]);

// Custom field type enum
export const customFieldTypeEnum = pgEnum("custom_field_type", ["boolean", "number", "short_text", "long_text", "multi_select"]);

// Stage approval field type enum
export const stageApprovalFieldTypeEnum = pgEnum("stage_approval_field_type", ["boolean", "number", "long_text", "multi_select"]);

// Comparison type enum for number fields in stage approvals
export const comparisonTypeEnum = pgEnum("comparison_type", ["equal_to", "less_than", "greater_than"]);

// UDF type enum for services
export const udfTypeEnum = pgEnum("udf_type", ["number", "date", "boolean", "short_text"]);

// Internal task status enum
export const internalTaskStatusEnum = pgEnum("internal_task_status", ["open", "in_progress", "closed"]);

// Internal task priority enum
export const internalTaskPriorityEnum = pgEnum("internal_task_priority", ["low", "medium", "high", "urgent"]);

// Inactive reason enum for client services
export const inactiveReasonEnum = pgEnum("inactive_reason", ["created_in_error", "no_longer_required", "client_doing_work_themselves"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  emailSignature: text("email_signature"), // HTML email signature
  isAdmin: boolean("is_admin").default(false), // Simple admin flag
  canSeeAdminMenu: boolean("can_see_admin_menu").default(false), // Can see admin menu flag
  superAdmin: boolean("super_admin").default(false), // Super admin flag for elevated privileges
  passwordHash: varchar("password_hash"), // Hashed password, nullable for OAuth-only users
  isFallbackUser: boolean("is_fallback_user").default(false), // Only one user can be the fallback user
  pushNotificationsEnabled: boolean("push_notifications_enabled").default(true), // Push notifications enabled by default for staff
  notificationPreferences: jsonb("notification_preferences"), // Email, push, SMS preferences
  canMakeServicesInactive: boolean("can_make_services_inactive").default(false), // Permission to mark services as inactive
  canMakeProjectsInactive: boolean("can_make_projects_inactive").default(false), // Permission to mark projects as inactive
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"), // Track when user last logged in for first-login detection
});

// User sessions table - tracks login sessions and activity
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  loginTime: timestamp("login_time").notNull().defaultNow(),
  lastActivity: timestamp("last_activity").notNull().defaultNow(),
  logoutTime: timestamp("logout_time"), // Null if session is still active
  ipAddress: varchar("ip_address"),
  city: varchar("city"), // From IP geolocation
  country: varchar("country"), // From IP geolocation
  browser: varchar("browser"), // e.g., "Chrome 119"
  device: varchar("device"), // e.g., "Desktop", "Mobile", "Tablet"
  os: varchar("os"), // e.g., "Windows 10", "iOS 17.1"
  platformType: varchar("platform_type"), // desktop, mobile, tablet
  pushEnabled: boolean("push_enabled").default(false), // Push notification status at session start
  sessionDuration: integer("session_duration"), // Duration in minutes, calculated on logout
  isActive: boolean("is_active").default(true), // Whether session is currently active
}, (table) => [
  index("idx_user_sessions_user_id").on(table.userId),
  index("idx_user_sessions_login_time").on(table.loginTime),
  index("idx_user_sessions_is_active").on(table.isActive),
]);

// Login attempts table - tracks all login attempts for security monitoring
export const loginAttempts = pgTable("login_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  ipAddress: varchar("ip_address"),
  success: boolean("success").notNull(),
  failureReason: varchar("failure_reason"), // e.g., "invalid_password", "user_not_found"
  browser: varchar("browser"),
  os: varchar("os"),
}, (table) => [
  index("idx_login_attempts_email").on(table.email),
  index("idx_login_attempts_timestamp").on(table.timestamp),
  index("idx_login_attempts_success").on(table.success),
]);

// User notification preferences table
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  notifyStageChanges: boolean("notify_stage_changes").notNull().default(true),
  notifyNewProjects: boolean("notify_new_projects").notNull().default(true),
  notifySchedulingSummary: boolean("notify_scheduling_summary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Magic link tokens table
export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tokenHash: varchar("token_hash").notNull().unique(),
  codeHash: varchar("code_hash").notNull(),
  email: varchar("email").notNull(),
  expiresAt: timestamp("expires_at").notNull().default(sql`now() + interval '10 minutes'`),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// User OAuth accounts table - for storing individual user's OAuth tokens (Microsoft, etc.)
export const userOauthAccounts = pgTable("user_oauth_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider").notNull(), // 'microsoft', 'google', etc.
  providerAccountId: varchar("provider_account_id").notNull(), // The user's ID in the provider's system
  email: varchar("email").notNull(), // The email associated with this OAuth account
  accessTokenEncrypted: text("access_token_encrypted").notNull(), // Encrypted access token
  refreshTokenEncrypted: text("refresh_token_encrypted"), // Encrypted refresh token (optional for some flows)
  expiresAt: timestamp("expires_at").notNull(), // When the access token expires
  scope: varchar("scope"), // OAuth scopes granted
  tokenType: varchar("token_type").default("Bearer"), // Token type (usually Bearer)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_oauth_accounts_user_id").on(table.userId),
  index("idx_user_oauth_accounts_provider").on(table.provider),
  // Unique constraint to prevent multiple accounts of same provider per user
  unique("unique_user_provider").on(table.userId, table.provider),
]);

// Project views table - Saved filter configurations for projects page
export const projectViews = pgTable("project_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filters: text("filters").notNull(), // JSON string of filter state
  viewMode: varchar("view_mode").notNull(), // 'kanban' or 'list'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_project_views_user_id").on(table.userId),
]);

// Company views table - Saved filter configurations for companies page
export const companyViews = pgTable("company_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filters: text("filters").notNull(), // JSON string of filter state
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_company_views_user_id").on(table.userId),
]);

// User column preferences table - Stores column visibility, order, and width settings for project list view
export const userColumnPreferences = pgTable("user_column_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  viewType: varchar("view_type").notNull().default("projects"), // 'projects', 'my-projects', 'my-tasks'
  columnOrder: text("column_order").array().notNull(), // Array of column IDs in desired order
  visibleColumns: text("visible_columns").array().notNull(), // Array of visible column IDs
  columnWidths: jsonb("column_widths"), // JSON object mapping column ID to width in pixels
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_column_preferences_user_id").on(table.userId),
  unique("unique_user_view_type").on(table.userId, table.viewType),
]);

// Dashboards table - Stores saved dashboard configurations with visualizations
export const dashboards = pgTable("dashboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"), // Optional description of what the dashboard shows
  filters: text("filters").notNull(), // JSON string of filter state (same format as project views)
  widgets: jsonb("widgets").notNull(), // Array of widget configurations: [{id, type, metric, groupBy, options}]
  visibility: varchar("visibility").notNull().default("private"), // 'private' or 'shared'
  isHomescreenDashboard: boolean("is_homescreen_dashboard").default(false), // Mark as homescreen dashboard (one per user)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_dashboards_user_id").on(table.userId),
  index("idx_dashboards_visibility").on(table.visibility),
  index("idx_dashboards_homescreen").on(table.userId, table.isHomescreenDashboard),
]);

// Dashboard cache table - Stores pre-computed dashboard statistics for performance
export const dashboardCache = pgTable("dashboard_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  myTasksCount: integer("my_tasks_count").notNull().default(0),
  myProjectsCount: integer("my_projects_count").notNull().default(0),
  overdueTasksCount: integer("overdue_tasks_count").notNull().default(0),
  behindScheduleCount: integer("behind_schedule_count").notNull().default(0),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_dashboard_cache_user_id").on(table.userId),
  index("idx_dashboard_cache_last_updated").on(table.lastUpdated),
]);

// User project preferences table - Stores user preferences for the projects page
export const userProjectPreferences = pgTable("user_project_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  defaultViewId: varchar("default_view_id"), // ID of the default view (projectView or dashboard)
  defaultViewType: varchar("default_view_type"), // 'list', 'kanban', or 'dashboard'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_project_preferences_user_id").on(table.userId),
]);

// Clients table - Companies House integration (matches existing database schema)
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  email: varchar("email"),
  createdAt: timestamp("created_at").defaultNow(),
  // Companies House Basic Fields (existing in database)
  clientType: varchar("client_type"), // Existing field
  companyNumber: varchar("company_number"), // Existing field
  companiesHouseName: varchar("companies_house_name"), // Existing field
  companyStatus: varchar("company_status"), // Existing field
  companyStatusDetail: varchar("company_status_detail"), // CH status detail for strike-off detection
  companyType: varchar("company_type"), // Existing field
  dateOfCreation: timestamp("date_of_creation"), // Existing field
  jurisdiction: varchar("jurisdiction"), // Existing field
  sicCodes: text("sic_codes").array(), // Existing field
  // Registered Office Address (existing in database)
  registeredAddress1: varchar("registered_address_1"), // Existing field
  registeredAddress2: varchar("registered_address_2"), // Existing field
  registeredAddress3: varchar("registered_address_3"), // Existing field
  // registeredAddress4: varchar("registered_address_4"), // Temporarily commented - deployment blocker
  registeredCountry: varchar("registered_country"), // Existing field
  registeredPostcode: varchar("registered_postcode"), // Existing field
  // Accounts Filing Information (existing in database)
  accountingReferenceDay: integer("accounting_reference_day"), // Existing field
  accountingReferenceMonth: integer("accounting_reference_month"), // Existing field
  lastAccountsMadeUpTo: timestamp("last_accounts_made_up_to"), // Existing field
  lastAccountsType: varchar("last_accounts_type"), // Existing field
  nextAccountsDue: timestamp("next_accounts_due"), // Existing field
  nextAccountsPeriodEnd: timestamp("next_accounts_period_end"), // Existing field
  accountsOverdue: boolean("accounts_overdue").default(false), // Existing field
  // Confirmation Statement Information (existing in database)
  confirmationStatementLastMadeUpTo: timestamp("confirmation_statement_last_made_up_to"), // Existing field
  confirmationStatementNextDue: timestamp("confirmation_statement_next_due"), // Existing field
  confirmationStatementNextMadeUpTo: timestamp("confirmation_statement_next_made_up_to"), // Existing field
  confirmationStatementOverdue: boolean("confirmation_statement_overdue").default(false), // Existing field
  // Metadata - Full CH API response for audit trail (existing in database)
  companiesHouseData: jsonb("companies_house_data"), // Existing field
});

// People table - matches existing database structure
export const people = pgTable("people", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`), // Auto-generate UUID for new records
  personNumber: text("person_number"), // Existing field
  fullName: text("full_name").notNull(), // Existing field - is NOT NULL
  title: text("title"), // Existing field
  firstName: text("first_name"), // Existing field
  lastName: text("last_name"), // Existing field
  dateOfBirth: text("date_of_birth"), // Existing field - uses date type, not separate month/year
  nationality: nationalityEnum("nationality"), // Updated to use enum
  countryOfResidence: text("country_of_residence"), // Existing field
  occupation: text("occupation"), // Existing field
  // Address fields (existing in database with different naming)
  addressLine1: text("address_line_1"), // Existing field
  addressLine2: text("address_line_2"), // Existing field
  locality: text("locality"), // Existing field
  region: text("region"), // Existing field
  postalCode: text("postal_code"), // Existing field
  country: text("country"), // Existing field
  // Contact Information (existing fields)
  email: text("email"), // Existing field
  telephone: text("telephone"), // Existing field
  // Primary contact information (for SMS/Email integration)
  primaryPhone: text("primary_phone"), // UK mobile in international format (+447...)
  primaryEmail: text("primary_email"), // Primary email for communications
  // Extended contact information
  telephone2: text("telephone_2"),
  email2: text("email_2"),
  linkedinUrl: text("linkedin_url"),
  instagramUrl: text("instagram_url"),
  twitterUrl: text("twitter_url"),
  facebookUrl: text("facebook_url"),
  tiktokUrl: text("tiktok_url"),
  notes: text("notes"), // Existing field
  // New fields for enhanced person data
  isMainContact: boolean("is_main_contact").default(false),
  receiveNotifications: boolean("receive_notifications").default(true), // opt-in/opt-out flag for email/SMS notifications
  niNumber: text("ni_number"), // National Insurance Number
  personalUtrNumber: text("personal_utr_number"), // Personal UTR Number
  photoIdVerified: boolean("photo_id_verified").default(false),
  addressVerified: boolean("address_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(), // Existing field
});

// Client-People relationships - matches existing database structure
export const clientPeople = pgTable("client_people", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`), // Generate IDs for new records
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }), // Keep as text to match existing database
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }), // Match people.id type
  officerRole: text("officer_role"), // Existing field
  isPrimaryContact: boolean("is_primary_contact"), // Existing field
  createdAt: timestamp("created_at").defaultNow(), // Existing field
}, (table) => ({
  // Unique constraint for many-to-many relationship - prevent duplicate person-company links
  uniquePersonCompany: unique("unique_person_company").on(table.clientId, table.personId),
}));

// Projects table (individual client work items)
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id), // links to project type configuration
  bookkeeperId: varchar("bookkeeper_id").notNull().references(() => users.id),
  clientManagerId: varchar("client_manager_id").notNull().references(() => users.id),
  projectOwnerId: varchar("project_owner_id").references(() => users.id), // Service owner becomes project owner - temporarily nullable for migration
  description: text("description").notNull(),
  currentStatus: varchar("current_status").notNull().default("No Latest Action"),
  currentAssigneeId: varchar("current_assignee_id").references(() => users.id),
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  dueDate: timestamp("due_date"),
  archived: boolean("archived").default(false), // to hide completed monthly cycles
  inactive: boolean("inactive").default(false), // to mark projects as inactive
  inactiveReason: inactiveReasonEnum("inactive_reason"), // Reason for marking inactive
  inactiveAt: timestamp("inactive_at"), // When the project was marked inactive
  inactiveByUserId: varchar("inactive_by_user_id").references(() => users.id), // User who marked the project inactive
  completionStatus: varchar("completion_status"), // 'completed_successfully', 'completed_unsuccessfully', or null for active projects
  projectMonth: varchar("project_month"), // DD/MM/YYYY format to track which month each project belongs to
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_projects_project_owner_id").on(table.projectOwnerId),
  index("idx_projects_current_assignee_id").on(table.currentAssigneeId),
  index("idx_projects_project_type_id").on(table.projectTypeId),
  index("idx_projects_archived").on(table.archived),
  index("idx_projects_client_id").on(table.clientId),
]);

// Project chronology table
export const projectChronology = pgTable("project_chronology", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status").notNull(),
  assigneeId: varchar("assignee_id").references(() => users.id),
  changedById: varchar("changed_by_id").references(() => users.id), // User who made the stage change
  changeReason: varchar("change_reason"),
  notes: text("notes"),
  timestamp: timestamp("timestamp").defaultNow(),
  timeInPreviousStage: integer("time_in_previous_stage"), // in minutes
  businessHoursInPreviousStage: integer("business_hours_in_previous_stage"), // in business minutes (for precision)
});

// Client chronology table - tracks client-level events like service activation/deactivation
export const clientChronology = pgTable("client_chronology", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  eventType: varchar("event_type").notNull(), // 'service_activated', 'service_deactivated', etc.
  entityType: varchar("entity_type").notNull(), // 'client_service', 'people_service'
  entityId: varchar("entity_id").notNull(), // ID of the affected service
  fromValue: varchar("from_value"), // Previous value (e.g., 'true' for isActive)
  toValue: varchar("to_value").notNull(), // New value (e.g., 'false' for isActive)
  userId: varchar("user_id").references(() => users.id), // User who made the change
  changeReason: varchar("change_reason"),
  notes: text("notes"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_client_chronology_client_id").on(table.clientId),
  index("idx_client_chronology_event_type").on(table.eventType),
  index("idx_client_chronology_timestamp").on(table.timestamp),
  index("idx_client_chronology_entity").on(table.entityType, table.entityId),
]);

// Stage approvals configuration table
export const stageApprovals = pgTable("stage_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }), // owned by project type
  name: varchar("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_approvals_project_type_id").on(table.projectTypeId),
  // Name must be unique within a project type
  unique("unique_approval_name_per_project_type").on(table.projectTypeId, table.name),
]);

// Stage approval fields table - questions/fields for each stage approval
export const stageApprovalFields = pgTable("stage_approval_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stageApprovalId: varchar("stage_approval_id").notNull().references(() => stageApprovals.id, { onDelete: "cascade" }),
  fieldName: varchar("field_name").notNull(),
  description: text("description"), // Optional description/help text for the field
  fieldType: stageApprovalFieldTypeEnum("field_type").notNull(),
  isRequired: boolean("is_required").default(false),
  order: integer("order").notNull(),
  placeholder: varchar("placeholder"), // For all field types
  // For boolean fields - what value is required for approval
  expectedValueBoolean: boolean("expected_value_boolean"),
  // For number fields - comparison type and expected value
  comparisonType: comparisonTypeEnum("comparison_type"),
  expectedValueNumber: integer("expected_value_number"),
  // For multi_select fields - available options
  options: text("options").array(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_approval_fields_stage_approval_id").on(table.stageApprovalId),
  // CHECK constraint to ensure proper fields are populated based on fieldType
  check("check_boolean_field_validation", sql`
    (field_type != 'boolean' OR expected_value_boolean IS NOT NULL)
  `),
  check("check_number_field_validation", sql`
    (field_type != 'number' OR (comparison_type IS NOT NULL AND expected_value_number IS NOT NULL))
  `),
  check("check_multi_select_field_validation", sql`
    (field_type != 'multi_select' OR (options IS NOT NULL AND array_length(options, 1) > 0 AND options <> ARRAY[]::text[]))
  `),
  check("check_long_text_field_validation", sql`
    (field_type != 'long_text' OR (expected_value_boolean IS NULL AND comparison_type IS NULL AND expected_value_number IS NULL AND options IS NULL))
  `),
]);

// Stage approval responses table - user responses when filling approval forms
export const stageApprovalResponses = pgTable("stage_approval_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  fieldId: varchar("field_id").notNull().references(() => stageApprovalFields.id, { onDelete: "cascade" }),
  valueBoolean: boolean("value_boolean"), // For boolean field types
  valueNumber: integer("value_number"), // For number field types
  valueLongText: text("value_long_text"), // For long_text field types
  valueMultiSelect: text("value_multi_select").array(), // For multi_select field types
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_approval_responses_project_id").on(table.projectId),
  index("idx_stage_approval_responses_field_id").on(table.fieldId),
  unique("unique_project_field_response").on(table.projectId, table.fieldId),
  // CHECK constraint to ensure only one value column is populated and matches field type requirements
  check("check_single_value_populated", sql`
    (value_boolean IS NOT NULL AND value_number IS NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NOT NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NULL AND value_long_text IS NOT NULL AND value_multi_select IS NULL) OR
    (value_boolean IS NULL AND value_number IS NULL AND value_long_text IS NULL AND value_multi_select IS NOT NULL)
  `),
]);

// Kanban stages configuration table
export const kanbanStages = pgTable("kanban_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }), // owned by project type
  name: varchar("name").notNull(),
  assignedWorkRoleId: varchar("assigned_work_role_id").references(() => workRoles.id, { onDelete: "set null" }), // For service-linked project types
  assignedUserId: varchar("assigned_user_id").references(() => users.id, { onDelete: "set null" }), // For non-service project types
  order: integer("order").notNull(),
  color: varchar("color").default("#6b7280"),
  maxInstanceTime: integer("max_instance_time"), // Maximum hours for a single visit to this stage (optional)
  maxTotalTime: integer("max_total_time"), // Maximum cumulative hours across all visits to this stage (optional)
  stageApprovalId: varchar("stage_approval_id").references(() => stageApprovals.id, { onDelete: "set null" }), // Optional stage approval
  canBeFinalStage: boolean("can_be_final_stage").default(false), // Whether projects can be marked as complete at this stage
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kanban_stages_project_type_id").on(table.projectTypeId),
  index("idx_kanban_stages_assigned_work_role_id").on(table.assignedWorkRoleId),
  index("idx_kanban_stages_assigned_user_id").on(table.assignedUserId),
  // Name must be unique within a project type
  // unique("unique_stage_name_per_project_type").on(table.projectTypeId, table.name), // Temporarily commented to unblock people table changes
]);

// Change reasons configuration table
export const changeReasons = pgTable("change_reasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }), // owned by project type
  reason: varchar("reason").notNull(),
  description: varchar("description"),
  showCountInProject: boolean("show_count_in_project").default(false),
  countLabel: varchar("count_label"),
  stageApprovalId: varchar("stage_approval_id").references(() => stageApprovals.id, { onDelete: "set null" }), // Optional stage approval for this reason
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_change_reasons_project_type_id").on(table.projectTypeId),
  index("idx_change_reasons_stage_approval_id").on(table.stageApprovalId),
  // Reason must be unique within a project type
  // unique("unique_reason_per_project_type").on(table.projectTypeId, table.reason), // Temporarily commented to unblock people table changes
]);

// Project types configuration table (renamed from project descriptions)
export const projectTypes: any = pgTable("project_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(), // project type name (e.g. "Monthly Bookkeeping", "Payroll")
  description: text("description"), // optional description of the project type
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }), // Optional reference to service for role inheritance
  active: boolean("active").default(true), // to enable/disable project types
  notificationsActive: boolean("notifications_active").default(true), // master switch for all notifications for this project type
  singleProjectPerClient: boolean("single_project_per_client").default(false), // if true, only one active project of this type can exist per client
  order: integer("order").notNull(), // for sorting in UI
  createdAt: timestamp("created_at").defaultNow(),
});

// Stage-Reason mapping table (many-to-many relationship)
export const stageReasonMaps = pgTable("stage_reason_maps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stageId: varchar("stage_id").notNull().references(() => kanbanStages.id, { onDelete: "cascade" }),
  reasonId: varchar("reason_id").notNull().references(() => changeReasons.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stage_reason_maps_stage_id").on(table.stageId),
  index("idx_stage_reason_maps_reason_id").on(table.reasonId),
  unique("unique_stage_reason").on(table.stageId, table.reasonId),
]);

// Custom fields per change reason
export const reasonCustomFields = pgTable("reason_custom_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reasonId: varchar("reason_id").notNull().references(() => changeReasons.id, { onDelete: "cascade" }),
  fieldName: varchar("field_name").notNull(),
  fieldType: customFieldTypeEnum("field_type").notNull(),
  isRequired: boolean("is_required").default(false),
  placeholder: varchar("placeholder"),
  description: text("description"),
  options: text("options").array(), // For multi-select field options
  order: integer("order").notNull(), // for sorting in UI
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reason_custom_fields_reason_id").on(table.reasonId),
  // CHECK constraint to ensure options is non-empty when field_type = 'multi_select'
  check("check_multi_select_options", sql`
    (field_type != 'multi_select' OR (options IS NOT NULL AND array_length(options, 1) > 0 AND options <> ARRAY[]::text[]))
  `),
]);

// Field responses tied to project chronology
export const reasonFieldResponses = pgTable("reason_field_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chronologyId: varchar("chronology_id").notNull().references(() => projectChronology.id, { onDelete: "cascade" }),
  customFieldId: varchar("custom_field_id").notNull().references(() => reasonCustomFields.id, { onDelete: "restrict" }),
  fieldType: customFieldTypeEnum("field_type").notNull(), // Store fieldType for validation
  valueNumber: integer("value_number"), // For number field types
  valueShortText: varchar("value_short_text", { length: 255 }), // For short_text field types
  valueLongText: text("value_long_text"), // For long_text field types
  valueMultiSelect: text("value_multi_select").array(), // For multi_select field types
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reason_field_responses_chronology_id").on(table.chronologyId),
  index("idx_reason_field_responses_custom_field_id").on(table.customFieldId),
  unique("unique_chronology_custom_field").on(table.chronologyId, table.customFieldId),
  // CHECK constraint to ensure only one value column is populated based on fieldType
  check("check_single_value_column", sql`
    (field_type = 'number' AND value_number IS NOT NULL AND value_short_text IS NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (field_type = 'short_text' AND value_number IS NULL AND value_short_text IS NOT NULL AND value_long_text IS NULL AND value_multi_select IS NULL) OR
    (field_type = 'long_text' AND value_number IS NULL AND value_short_text IS NULL AND value_long_text IS NOT NULL AND value_multi_select IS NULL) OR
    (field_type = 'multi_select' AND value_number IS NULL AND value_short_text IS NULL AND value_long_text IS NULL AND value_multi_select IS NOT NULL AND array_length(value_multi_select, 1) > 0)
  `),
]);

// Services table
export const services: any = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  projectTypeId: varchar("project_type_id").references(() => projectTypes.id),
  udfDefinitions: jsonb("udf_definitions").default(sql`'[]'::jsonb`), // Array of UDF definitions
  // Companies House connection fields
  isCompaniesHouseConnected: boolean("is_companies_house_connected").default(false),
  chStartDateField: varchar("ch_start_date_field"), // Maps to client field for start date (e.g., 'next_accounts_period_end')
  chDueDateField: varchar("ch_due_date_field"), // Maps to client field for due date (e.g., 'next_accounts_due')
  // Personal service flag - if true, this service is for individuals, not clients/companies
  isPersonalService: boolean("is_personal_service").default(false),
  // Static service flag - if true, this service is for display only and cannot be mapped to project types
  isStaticService: boolean("is_static_service").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Client services table - links clients to services
export const clientServices = pgTable("client_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  serviceOwnerId: varchar("service_owner_id").references(() => users.id, { onDelete: "set null" }), // Service owner assigned for this client-service mapping
  frequency: varchar("frequency"), // monthly, quarterly, annually, etc. - nullable for static services
  nextStartDate: timestamp("next_start_date"), // Next scheduled start date for the service
  nextDueDate: timestamp("next_due_date"), // Next due date for the service
  intendedStartDay: integer("intended_start_day"), // Intended day-of-month for start date (29-31) to preserve across short months
  intendedDueDay: integer("intended_due_day"), // Intended day-of-month for due date (29-31) to preserve across short months
  isActive: boolean("is_active").default(true), // Whether this service is active for scheduling
  inactiveReason: inactiveReasonEnum("inactive_reason"), // Reason why service was made inactive
  inactiveAt: timestamp("inactive_at"), // Timestamp when service was made inactive
  inactiveByUserId: varchar("inactive_by_user_id").references(() => users.id, { onDelete: "set null" }), // User who made service inactive
  udfValues: jsonb("udf_values").default(sql`'{}'::jsonb`), // User-defined field values as key-value pairs
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_client_services_client_id").on(table.clientId),
  index("idx_client_services_service_id").on(table.serviceId),
  index("idx_client_services_service_owner_id").on(table.serviceOwnerId),
  index("idx_client_services_next_due_date").on(table.nextDueDate), // Index for scheduling queries
  index("idx_client_services_inactive_by_user_id").on(table.inactiveByUserId),
  unique("unique_client_service").on(table.clientId, table.serviceId),
]);

// People services table - links people to personal services
export const peopleServices = pgTable("people_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  serviceOwnerId: varchar("service_owner_id").references(() => users.id, { onDelete: "set null" }), // Service owner assigned for this person-service mapping
  frequency: varchar("frequency").notNull().default("monthly"), // monthly, quarterly, annually, etc.
  nextStartDate: timestamp("next_start_date"), // Next scheduled start date for the service
  nextDueDate: timestamp("next_due_date"), // Next due date for the service
  intendedStartDay: integer("intended_start_day"), // Intended day-of-month for start date (29-31) to preserve across short months
  intendedDueDay: integer("intended_due_day"), // Intended day-of-month for due date (29-31) to preserve across short months
  notes: text("notes"), // Specific notes for this person's service
  isActive: boolean("is_active").default(true), // Whether this service is active for scheduling
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_people_services_person_id").on(table.personId),
  index("idx_people_services_service_id").on(table.serviceId),
  index("idx_people_services_service_owner_id").on(table.serviceOwnerId),
  index("idx_people_services_next_due_date").on(table.nextDueDate), // Index for scheduling queries
  unique("unique_person_service").on(table.personId, table.serviceId),
]);

// Client service role assignments table - maps users to roles for client services
export const clientServiceRoleAssignments = pgTable("client_service_role_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientServiceId: varchar("client_service_id").notNull().references(() => clientServices.id, { onDelete: "cascade" }),
  workRoleId: varchar("work_role_id").notNull().references(() => workRoles.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_client_service_role_assignments_client_service_id").on(table.clientServiceId),
  index("idx_client_service_role_assignments_work_role_id").on(table.workRoleId),
  index("idx_client_service_role_assignments_user_id").on(table.userId),
  index("idx_client_service_role_assignments_active").on(table.clientServiceId, table.workRoleId, table.isActive),
  // Note: Partial unique constraint will be created separately using raw SQL
  // Only one active user per role per client-service constraint enforced at database level
]);

// Work roles table
export const workRoles = pgTable("work_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Companies House change requests table - for tracking pending CH data changes
export const chChangeRequests = pgTable("ch_change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  changeType: varchar("change_type").notNull(), // 'accounts', 'confirmation_statement', 'company_profile'
  fieldName: varchar("field_name").notNull(), // Field that changed (e.g., 'next_accounts_due')
  oldValue: text("old_value"), // Previous value as string
  newValue: text("new_value").notNull(), // New value as string  
  status: varchar("status").default("pending"), // 'pending', 'approved', 'rejected'
  detectedAt: timestamp("detected_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"), // Optional notes from approver
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ch_change_requests_client_id").on(table.clientId),
  index("idx_ch_change_requests_status").on(table.status),
  index("idx_ch_change_requests_change_type").on(table.changeType),
]);

// Service-Role junction table (many-to-many)
export const serviceRoles = pgTable("service_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  roleId: varchar("role_id").notNull().references(() => workRoles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_service_roles_service_id").on(table.serviceId),
  index("idx_service_roles_role_id").on(table.roleId),
  unique("unique_service_role").on(table.serviceId, table.roleId),
]);

// Project scheduling history table - tracks all scheduling actions for audit trail
export const projectSchedulingHistory = pgTable("project_scheduling_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientServiceId: varchar("client_service_id").references(() => clientServices.id, { onDelete: "set null" }),
  peopleServiceId: varchar("people_service_id").references(() => peopleServices.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }), // The project that was created
  action: varchar("action").notNull(), // 'created', 'rescheduled', 'skipped', 'failed'
  scheduledDate: timestamp("scheduled_date").notNull(), // The date this service was scheduled for
  previousNextStartDate: timestamp("previous_next_start_date"), // Previous next start date before rescheduling
  previousNextDueDate: timestamp("previous_next_due_date"), // Previous next due date before rescheduling
  newNextStartDate: timestamp("new_next_start_date"), // New next start date after rescheduling
  newNextDueDate: timestamp("new_next_due_date"), // New next due date after rescheduling
  frequency: varchar("frequency"), // Frequency at time of scheduling
  notes: text("notes"), // Additional notes or error messages
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_project_scheduling_history_client_service_id").on(table.clientServiceId),
  index("idx_project_scheduling_history_people_service_id").on(table.peopleServiceId),
  index("idx_project_scheduling_history_project_id").on(table.projectId),
  index("idx_project_scheduling_history_action").on(table.action),
  index("idx_project_scheduling_history_scheduled_date").on(table.scheduledDate),
  index("idx_project_scheduling_history_created_at").on(table.createdAt),
]);

// Scheduling run logs table - tracks each nightly run for failure analysis and reporting
export const schedulingRunLogs = pgTable("scheduling_run_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runDate: timestamp("run_date").notNull(), // The date/time this run was executed
  runType: varchar("run_type").notNull().default("scheduled"), // 'scheduled', 'manual', 'test'
  status: varchar("status").notNull(), // 'success', 'partial_failure', 'failure'
  totalServicesChecked: integer("total_services_checked").notNull().default(0),
  servicesFoundDue: integer("services_found_due").notNull().default(0),
  projectsCreated: integer("projects_created").notNull().default(0),
  servicesRescheduled: integer("services_rescheduled").notNull().default(0),
  errorsEncountered: integer("errors_encountered").notNull().default(0),
  chServicesSkipped: integer("ch_services_skipped").notNull().default(0), // Companies House services awaiting API updates
  executionTimeMs: integer("execution_time_ms"), // Time taken to complete the run
  errorDetails: jsonb("error_details"), // Detailed error information
  summary: text("summary"), // Human-readable summary of the run
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_scheduling_run_logs_run_date").on(table.runDate),
  index("idx_scheduling_run_logs_status").on(table.status),
  index("idx_scheduling_run_logs_run_type").on(table.runType),
]);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  assignedProjects: many(projects, { relationName: "assignee" }),
  bookkeepingProjects: many(projects, { relationName: "bookkeeper" }),
  managedProjects: many(projects, { relationName: "clientManager" }),
  ownedProjects: many(projects, { relationName: "projectOwner" }),
  ownedServices: many(services, { relationName: "serviceOwner" }),
  ownedClientServices: many(clientServices, { relationName: "clientServiceOwner" }),
  inactivatedServices: many(clientServices, { relationName: "serviceInactivator" }),
  chronologyEntries: many(projectChronology),
  clientChronologyEntries: many(clientChronology),
  magicLinkTokens: many(magicLinkTokens),
  notificationPreferences: one(userNotificationPreferences),
  clientServiceRoleAssignments: many(clientServiceRoleAssignments),
  projectViews: many(projectViews),
}));

export const magicLinkTokensRelations = relations(magicLinkTokens, ({ one }) => ({
  user: one(users, {
    fields: [magicLinkTokens.userId],
    references: [users.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
  clientServices: many(clientServices),
  clientPeople: many(clientPeople),
  chronologyEntries: many(clientChronology),
  // Many-to-many person-company relationships are now handled via clientPeople junction table
}));

export const peopleRelations = relations(people, ({ many }) => ({
  clientPeople: many(clientPeople),
  peopleServices: many(peopleServices),
}));

export const clientPeopleRelations = relations(clientPeople, ({ one }) => ({
  client: one(clients, {
    fields: [clientPeople.clientId],
    references: [clients.id],
  }),
  person: one(people, {
    fields: [clientPeople.personId],
    references: [people.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  projectType: one(projectTypes, {
    fields: [projects.projectTypeId],
    references: [projectTypes.id],
  }),
  bookkeeper: one(users, {
    fields: [projects.bookkeeperId],
    references: [users.id],
    relationName: "bookkeeper",
  }),
  clientManager: one(users, {
    fields: [projects.clientManagerId],
    references: [users.id],
    relationName: "clientManager",
  }),
  projectOwner: one(users, {
    fields: [projects.projectOwnerId],
    references: [users.id],
    relationName: "projectOwner",
  }),
  currentAssignee: one(users, {
    fields: [projects.currentAssigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  chronology: many(projectChronology),
  stageApprovalResponses: many(stageApprovalResponses),
}));

export const projectChronologyRelations = relations(projectChronology, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectChronology.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [projectChronology.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  changedBy: one(users, {
    fields: [projectChronology.changedById],
    references: [users.id],
    relationName: "changedBy",
  }),
  fieldResponses: many(reasonFieldResponses),
}));

export const clientChronologyRelations = relations(clientChronology, ({ one }) => ({
  client: one(clients, {
    fields: [clientChronology.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [clientChronology.userId],
    references: [users.id],
  }),
}));

export const kanbanStagesRelations = relations(kanbanStages, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [kanbanStages.projectTypeId],
    references: [projectTypes.id],
  }),
  stageReasonMaps: many(stageReasonMaps),
  stageApproval: one(stageApprovals, {
    fields: [kanbanStages.stageApprovalId],
    references: [stageApprovals.id],
  }),
}));

export const changeReasonsRelations = relations(changeReasons, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [changeReasons.projectTypeId],
    references: [projectTypes.id],
  }),
  stageApproval: one(stageApprovals, {
    fields: [changeReasons.stageApprovalId],
    references: [stageApprovals.id],
  }),
  stageReasonMaps: many(stageReasonMaps),
  customFields: many(reasonCustomFields),
}));

export const stageReasonMapsRelations = relations(stageReasonMaps, ({ one }) => ({
  stage: one(kanbanStages, {
    fields: [stageReasonMaps.stageId],
    references: [kanbanStages.id],
  }),
  reason: one(changeReasons, {
    fields: [stageReasonMaps.reasonId],
    references: [changeReasons.id],
  }),
}));

export const reasonCustomFieldsRelations = relations(reasonCustomFields, ({ one, many }) => ({
  reason: one(changeReasons, {
    fields: [reasonCustomFields.reasonId],
    references: [changeReasons.id],
  }),
  responses: many(reasonFieldResponses),
}));

export const reasonFieldResponsesRelations = relations(reasonFieldResponses, ({ one }) => ({
  chronology: one(projectChronology, {
    fields: [reasonFieldResponses.chronologyId],
    references: [projectChronology.id],
  }),
  customField: one(reasonCustomFields, {
    fields: [reasonFieldResponses.customFieldId],
    references: [reasonCustomFields.id],
  }),
}));

export const stageApprovalsRelations = relations(stageApprovals, ({ one, many }) => ({
  projectType: one(projectTypes, {
    fields: [stageApprovals.projectTypeId],
    references: [projectTypes.id],
  }),
  fields: many(stageApprovalFields),
  linkedStages: many(kanbanStages),
  linkedReasons: many(changeReasons),
}));

export const stageApprovalFieldsRelations = relations(stageApprovalFields, ({ one, many }) => ({
  stageApproval: one(stageApprovals, {
    fields: [stageApprovalFields.stageApprovalId],
    references: [stageApprovals.id],
  }),
  responses: many(stageApprovalResponses),
}));

export const stageApprovalResponsesRelations = relations(stageApprovalResponses, ({ one }) => ({
  project: one(projects, {
    fields: [stageApprovalResponses.projectId],
    references: [projects.id],
  }),
  field: one(stageApprovalFields, {
    fields: [stageApprovalResponses.fieldId],
    references: [stageApprovalFields.id],
  }),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
}));

export const projectViewsRelations = relations(projectViews, ({ one }) => ({
  user: one(users, {
    fields: [projectViews.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  loginTime: true,
  lastActivity: true,
});

export const insertLoginAttemptSchema = createInsertSchema(loginAttempts).omit({
  id: true,
  timestamp: true,
});

export const insertMagicLinkTokenSchema = createInsertSchema(magicLinkTokens).omit({
  id: true,
  createdAt: true,
});

export const insertUserOauthAccountSchema = createInsertSchema(userOauthAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const updateUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

// Zod validation schemas for NI, UTR, and phone numbers
const niNumberRegex = /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D]{1}$/;
const personalUtrRegex = /^[0-9]{10}$/;
const ukMobileRegex = /^(\+447[0-9]{9}|07[0-9]{9})$/; // UK mobile format: 07xxxxxxxxx or international +447xxxxxxxxx

export const insertPersonSchema = createInsertSchema(people).omit({
  id: true,
  createdAt: true,
}).extend({
  // Add validation for new fields
  niNumber: z.string().regex(niNumberRegex, "Invalid National Insurance number format").optional().or(z.literal("")),
  personalUtrNumber: z.string().regex(personalUtrRegex, "Personal UTR must be 10 digits").optional().or(z.literal("")),
  // Primary contact validation - no restrictions on format
  primaryPhone: z.string().optional().or(z.literal("")),
  primaryEmail: z.string().optional().or(z.literal("")),
  nationality: z.enum([
    "afghan", "albanian", "algerian", "american", "andorran", "angolan", "antiguans", "argentinean", "armenian", "australian",
    "austrian", "azerbaijani", "bahamian", "bahraini", "bangladeshi", "barbadian", "barbudans", "batswana", "belarusian", "belgian",
    "belizean", "beninese", "bhutanese", "bolivian", "bosnian", "brazilian", "british", "bruneian", "bulgarian", "burkinabe",
    "burmese", "burundian", "cambodian", "cameroonian", "canadian", "cape_verdean", "central_african", "chadian", "chilean", "chinese",
    "colombian", "comoran", "congolese", "costa_rican", "croatian", "cuban", "cypriot", "czech", "danish", "djibouti",
    "dominican", "dutch", "east_timorese", "ecuadorean", "egyptian", "emirian", "equatorial_guinean", "eritrean", "estonian", "ethiopian",
    "fijian", "filipino", "finnish", "french", "gabonese", "gambian", "georgian", "german", "ghanaian", "greek",
    "grenadian", "guatemalan", "guinea_bissauan", "guinean", "guyanese", "haitian", "herzegovinian", "honduran", "hungarian", "icelander",
    "indian", "indonesian", "iranian", "iraqi", "irish", "israeli", "italian", "ivorian", "jamaican", "japanese",
    "jordanian", "kazakhstani", "kenyan", "kittian_and_nevisian", "kuwaiti", "kyrgyz", "laotian", "latvian", "lebanese", "liberian",
    "libyan", "liechtensteiner", "lithuanian", "luxembourger", "macedonian", "malagasy", "malawian", "malaysian", "maldivan", "malian",
    "maltese", "marshallese", "mauritanian", "mauritian", "mexican", "micronesian", "moldovan", "monacan", "mongolian", "moroccan",
    "mosotho", "motswana", "mozambican", "namibian", "nauruan", "nepalese", "new_zealander", "ni_vanuatu", "nicaraguan", "nigerien",
    "north_korean", "northern_irish", "norwegian", "omani", "pakistani", "palauan", "panamanian", "papua_new_guinean", "paraguayan", "peruvian",
    "polish", "portuguese", "qatari", "romanian", "russian", "rwandan", "saint_lucian", "salvadoran", "samoan", "san_marinese",
    "sao_tomean", "saudi", "scottish", "senegalese", "serbian", "seychellois", "sierra_leonean", "singaporean", "slovakian", "slovenian",
    "solomon_islander", "somali", "south_african", "south_korean", "spanish", "sri_lankan", "sudanese", "surinamer", "swazi", "swedish",
    "swiss", "syrian", "taiwanese", "tajik", "tanzanian", "thai", "togolese", "tongan", "trinidadian_or_tobagonian", "tunisian",
    "turkish", "tuvaluan", "ugandan", "ukrainian", "uruguayan", "uzbekistani", "venezuelan", "vietnamese", "welsh", "yemenite",
    "zambian", "zimbabwean"
  ]).optional().or(z.literal("")),
});

export const insertClientPersonSchema = createInsertSchema(clientPeople).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProjectSchema = insertProjectSchema.partial();

export const insertProjectChronologySchema = createInsertSchema(projectChronology).omit({
  id: true,
  timestamp: true,
});

export const insertClientChronologySchema = createInsertSchema(clientChronology).omit({
  id: true,
  timestamp: true,
});

export type InsertClientChronology = z.infer<typeof insertClientChronologySchema>;
export type SelectClientChronology = typeof clientChronology.$inferSelect;

// Base schema without refinements (for use with .partial())
const baseKanbanStageSchema = createInsertSchema(kanbanStages).omit({
  id: true,
  createdAt: true,
});

export const insertKanbanStageSchema = baseKanbanStageSchema.refine((data) => {
  // Validate maxInstanceTime is positive if provided
  if (data.maxInstanceTime !== undefined && data.maxInstanceTime !== null && data.maxInstanceTime <= 0) {
    return false;
  }
  // Validate maxTotalTime is positive if provided  
  if (data.maxTotalTime !== undefined && data.maxTotalTime !== null && data.maxTotalTime <= 0) {
    return false;
  }
  
  // Validate assignment fields - only one assignment method should be used
  const assignmentFields = [
    data.assignedWorkRoleId,
    data.assignedUserId
  ].filter(field => field !== undefined && field !== null);
  
  if (assignmentFields.length > 1) {
    return false;
  }
  
  return true;
}, {
  message: "Time limits must be positive numbers when specified, and only one assignment method (work role or user) should be used",
});

export const updateKanbanStageSchema = baseKanbanStageSchema.partial().refine((data) => {
  // Validate maxInstanceTime is positive if provided
  if (data.maxInstanceTime !== undefined && data.maxInstanceTime !== null && data.maxInstanceTime <= 0) {
    return false;
  }
  // Validate maxTotalTime is positive if provided  
  if (data.maxTotalTime !== undefined && data.maxTotalTime !== null && data.maxTotalTime <= 0) {
    return false;
  }
  
  // Validate assignment fields - only one assignment method should be used
  const assignmentFields = [
    data.assignedWorkRoleId,
    data.assignedUserId
  ].filter(field => field !== undefined && field !== null);
  
  if (assignmentFields.length > 1) {
    return false;
  }
  
  return true;
}, {
  message: "Time limits must be positive numbers when specified, and only one assignment method (work role or user) should be used",
});

export const insertChangeReasonSchema = createInsertSchema(changeReasons).omit({
  id: true,
  createdAt: true,
});

export const updateChangeReasonSchema = insertChangeReasonSchema.partial();

export const insertProjectTypeSchema = createInsertSchema(projectTypes).omit({
  id: true,
  createdAt: true,
});

export const updateProjectTypeSchema = insertProjectTypeSchema.partial();

export const insertStageReasonMapSchema = createInsertSchema(stageReasonMaps).omit({
  id: true,
  createdAt: true,
});

// Base schema without refinements (for use with .partial())
const baseReasonCustomFieldSchema = createInsertSchema(reasonCustomFields).omit({
  id: true,
  createdAt: true,
});

export const insertReasonCustomFieldSchema = baseReasonCustomFieldSchema.refine((data) => {
  // When fieldType is 'multi_select', options must be present and non-empty
  if (data.fieldType === 'multi_select') {
    if (!data.options || !Array.isArray(data.options) || data.options.length === 0) {
      return false;
    }
    
    // All options must be non-empty trimmed strings
    const trimmedOptions = data.options.map(opt => opt?.trim()).filter(Boolean);
    if (trimmedOptions.length !== data.options.length) {
      return false;
    }
    
    // All options must be unique
    const uniqueOptions = new Set(trimmedOptions);
    if (uniqueOptions.size !== trimmedOptions.length) {
      return false;
    }
  }
  return true;
}, {
  message: "Multi-select fields must have at least one unique, non-empty option",
}).transform((data) => {
  // Trim options for multi-select fields
  if (data.fieldType === 'multi_select' && data.options) {
    return {
      ...data,
      options: data.options.map(opt => opt.trim()).filter(Boolean)
    };
  }
  return data;
});

// Update schema for patches (allows partial updates)
export const updateReasonCustomFieldSchema = baseReasonCustomFieldSchema.partial().refine((data) => {
  // If fieldType is being set to 'multi_select', options must be present and non-empty
  if (data.fieldType === 'multi_select') {
    if (!data.options || !Array.isArray(data.options) || data.options.length === 0) {
      return false;
    }
    
    // All options must be non-empty trimmed strings
    const trimmedOptions = data.options.map(opt => opt?.trim()).filter(Boolean);
    if (trimmedOptions.length !== data.options.length) {
      return false;
    }
    
    // All options must be unique
    const uniqueOptions = new Set(trimmedOptions);
    if (uniqueOptions.size !== trimmedOptions.length) {
      return false;
    }
  }
  return true;
}, {
  message: "Multi-select fields must have at least one unique, non-empty option",
}).transform((data) => {
  // Trim options for multi-select fields
  if (data.fieldType === 'multi_select' && data.options) {
    return {
      ...data,
      options: data.options.map(opt => opt.trim()).filter(Boolean)
    };
  }
  return data;
});

export const insertReasonFieldResponseSchema = createInsertSchema(reasonFieldResponses).omit({
  id: true,
  createdAt: true,
});

// Stage approval schemas
export const insertStageApprovalSchema = createInsertSchema(stageApprovals).omit({
  id: true,
  createdAt: true,
});

export const updateStageApprovalSchema = insertStageApprovalSchema.partial();

// Base schema for stage approval fields without refinements (for use with .partial())
const baseStageApprovalFieldSchema = createInsertSchema(stageApprovalFields).omit({
  id: true,
  createdAt: true,
});

export const insertStageApprovalFieldSchema = baseStageApprovalFieldSchema.refine((data) => {
  // Boolean fields must have expectedValueBoolean
  if (data.fieldType === 'boolean' && data.expectedValueBoolean == null) {
    return false;
  }
  // Number fields must have both comparisonType and expectedValueNumber  
  if (data.fieldType === 'number' && (data.comparisonType == null || data.expectedValueNumber == null)) {
    return false;
  }
  // Multi select fields must have options
  if (data.fieldType === 'multi_select' && (!data.options || data.options.length === 0)) {
    return false;
  }
  // Long text fields should not have validation fields
  if (data.fieldType === 'long_text' && (data.expectedValueBoolean != null || data.comparisonType != null || data.expectedValueNumber != null || data.options != null)) {
    return false;
  }
  return true;
}, {
  message: "Field validation requirements not met for the specified field type",
});

export const updateStageApprovalFieldSchema = baseStageApprovalFieldSchema.partial().refine((data) => {
  // If fieldType is being set, validate accordingly
  if (data.fieldType === 'boolean' && data.expectedValueBoolean == null) {
    return false;
  }
  if (data.fieldType === 'number' && (data.comparisonType == null || data.expectedValueNumber == null)) {
    return false;
  }
  if (data.fieldType === 'multi_select' && (!data.options || data.options.length === 0)) {
    return false;
  }
  if (data.fieldType === 'long_text' && (data.expectedValueBoolean != null || data.comparisonType != null || data.expectedValueNumber != null || data.options != null)) {
    return false;
  }
  return true;
}, {
  message: "Field validation requirements not met for the specified field type",
});

export const insertStageApprovalResponseSchema = createInsertSchema(stageApprovalResponses).omit({
  id: true,
  createdAt: true,
});

export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserNotificationPreferencesSchema = insertUserNotificationPreferencesSchema.partial();

export const insertProjectViewSchema = createInsertSchema(projectViews).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyViewSchema = createInsertSchema(companyViews).omit({
  id: true,
  createdAt: true,
});

export const insertUserColumnPreferencesSchema = createInsertSchema(userColumnPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserColumnPreferencesSchema = insertUserColumnPreferencesSchema.partial().omit({ userId: true });

export const insertDashboardSchema = createInsertSchema(dashboards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDashboardSchema = insertDashboardSchema.partial().omit({ userId: true });

export const insertDashboardCacheSchema = createInsertSchema(dashboardCache).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const updateDashboardCacheSchema = createInsertSchema(dashboardCache).omit({
  id: true,
  createdAt: true,
  userId: true,
}).partial();

export const insertUserProjectPreferencesSchema = createInsertSchema(userProjectPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  defaultViewType: z.enum(['list', 'kanban', 'dashboard']).nullable().optional(),
});

export const updateUserProjectPreferencesSchema = insertUserProjectPreferencesSchema.partial().omit({ userId: true });

// UDF definition schema
export const udfDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Field name is required"),
  type: z.enum(["number", "date", "boolean", "short_text"]),
  required: z.boolean(),
  placeholder: z.string().optional(),
});

// Services schema - base schema
export const baseInsertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
}).extend({
  udfDefinitions: z.array(udfDefinitionSchema).optional().default([]),
  isCompaniesHouseConnected: z.boolean().optional().default(false),
  chStartDateField: z.string().optional(),
  chDueDateField: z.string().optional(),
  isPersonalService: z.boolean().optional().default(false),
  isStaticService: z.boolean().optional().default(false),
});

// Services schema with validation
export const insertServiceSchema = baseInsertServiceSchema.refine((data) => {
  // If CH connected, both field mappings are required
  if (data.isCompaniesHouseConnected) {
    return data.chStartDateField && data.chDueDateField;
  }
  return true;
}, {
  message: "Companies House connected services must specify both start and due date field mappings",
});

// Update schema with conditional CH validation
export const updateServiceSchema = baseInsertServiceSchema.partial().refine((data) => {
  // If CH connected is being set to true, both field mappings are required
  if (data.isCompaniesHouseConnected === true) {
    return data.chStartDateField && data.chDueDateField;
  }
  return true;
}, {
  message: "Companies House connected services must specify both start and due date field mappings",
});

// CH change requests schema
export const insertChChangeRequestSchema = createInsertSchema(chChangeRequests).omit({
  id: true,
  createdAt: true,
  detectedAt: true,
});

export const updateChChangeRequestSchema = insertChChangeRequestSchema.partial();

// Work roles schema  
export const insertWorkRoleSchema = createInsertSchema(workRoles).omit({
  id: true,
  createdAt: true,
});

// Service roles schema
export const insertServiceRoleSchema = createInsertSchema(serviceRoles).omit({
  id: true,
  createdAt: true,
});

// Client services schema
export const insertClientServiceSchema = createInsertSchema(clientServices).omit({
  id: true,
  createdAt: true,
}).extend({
  frequency: z.enum(["monthly", "quarterly", "annually", "weekly", "daily"]).optional(),
  nextStartDate: z.union([z.date(), z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]).optional(),
  nextDueDate: z.union([z.date(), z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()]).optional(),
  udfValues: z.record(z.any()).optional(),
});

export const updateClientServiceSchema = insertClientServiceSchema.partial();

// People services schema
export const insertPeopleServiceSchema = createInsertSchema(peopleServices).omit({
  id: true,
  createdAt: true,
}).extend({
  frequency: z.enum(["monthly", "quarterly", "annually", "weekly", "daily"]).default("monthly"),
  nextStartDate: z.string().datetime().optional(),
  nextDueDate: z.string().datetime().optional(),
});

export const updatePeopleServiceSchema = insertPeopleServiceSchema.partial();

// Client service role assignments schema
export const insertClientServiceRoleAssignmentSchema = createInsertSchema(clientServiceRoleAssignments).omit({
  id: true,
  createdAt: true,
});

// Project completion schema
export const completeProjectSchema = z.object({
  completionStatus: z.enum(['completed_successfully', 'completed_unsuccessfully']),
  notes: z.string().optional(),
});

// Project update schema  
export const updateProjectStatusSchema = z.object({
  projectId: z.string(),
  newStatus: z.string(), // Now accepts any kanban stage name
  changeReason: z.string().min(1, "Change reason is required").max(255, "Change reason too long"),
  notes: z.string().optional(),
  fieldResponses: z.array(z.object({
    customFieldId: z.string(),
    // fieldType removed - will be derived server-side from the custom field definition
    valueNumber: z.number().int().optional(),
    valueShortText: z.string().max(255).optional(),
    valueLongText: z.string().optional(),
    valueMultiSelect: z.array(z.string()).optional(),
  })).optional(),
});

// Month normalization helper function for project storage (preserves exact day)
export function normalizeProjectMonth(input: string): string {
  // Handle various date formats and normalize to DD/MM/YYYY
  const cleaned = input.trim();
  
  // Check if already in DD/MM/YYYY format with leading zeros
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Handle D/M/YYYY or DD/M/YYYY or D/MM/YYYY formats
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');
    
    // Validate day and month ranges
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    
    if (dayNum < 1 || dayNum > 31) {
      throw new Error(`Invalid day: ${day}. Day must be between 01 and 31.`);
    }
    if (monthNum < 1 || monthNum > 12) {
      throw new Error(`Invalid month: ${month}. Month must be between 01 and 12.`);
    }
    
    return `${paddedDay}/${paddedMonth}/${year}`;
  }
  
  throw new Error(`Invalid project month format: ${cleaned}. Expected DD/MM/YYYY format.`);
}

// Month normalization for filtering (always uses first day of month)
export function normalizeMonthForFiltering(input?: string | Date): string {
  let date: Date;
  
  if (!input) {
    // Default to current month
    date = new Date();
  } else if (typeof input === 'string') {
    // Parse DD/MM/YYYY format
    const cleaned = input.trim();
    const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      throw new Error(`Invalid date format: ${cleaned}. Expected DD/MM/YYYY format.`);
    }
  } else {
    date = input;
  }
  
  // Always use the first day of the month for filtering
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const day = '01';
  const month = String(firstDay.getMonth() + 1).padStart(2, '0');
  const year = firstDay.getFullYear();
  
  return `${day}/${month}/${year}`;
}

// Get current month normalized for filtering (first day of current month)
export function getCurrentMonthForFiltering(): string {
  return normalizeMonthForFiltering();
}

// CSV upload schema
export const csvProjectSchema = z.object({
  clientName: z.string().min(1),
  projectDescription: z.string().min(1),
  bookkeeperEmail: z.string().email(),
  clientManagerEmail: z.string().email(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  dueDate: z.string().optional(),
  projectMonth: z.string().min(1, "Project month is required").refine(
    (val) => {
      try {
        normalizeProjectMonth(val);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: "Project month must be in DD/MM/YYYY format (e.g., 01/12/2024)"
    }
  ),
});

// Project scheduling types and schemas
export const insertProjectSchedulingHistorySchema = createInsertSchema(projectSchedulingHistory).omit({
  id: true,
  createdAt: true,
});

export const insertSchedulingRunLogsSchema = createInsertSchema(schedulingRunLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect & {
  hasPassword?: boolean; // Added for API responses to indicate password-based auth availability
};
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type InsertMagicLinkToken = z.infer<typeof insertMagicLinkTokenSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = z.infer<typeof insertLoginAttemptSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectChronology = typeof projectChronology.$inferSelect;
export type InsertProjectChronology = z.infer<typeof insertProjectChronologySchema>;
export type ProjectSchedulingHistory = typeof projectSchedulingHistory.$inferSelect;
export type InsertProjectSchedulingHistory = z.infer<typeof insertProjectSchedulingHistorySchema>;
export type SchedulingRunLogs = typeof schedulingRunLogs.$inferSelect;
export type InsertSchedulingRunLogs = z.infer<typeof insertSchedulingRunLogsSchema>;
export type KanbanStage = typeof kanbanStages.$inferSelect;
export type InsertKanbanStage = z.infer<typeof insertKanbanStageSchema>;
export type ChangeReason = typeof changeReasons.$inferSelect;
export type InsertChangeReason = z.infer<typeof insertChangeReasonSchema>;
// Project type definitions
export const projectTypesRelations = relations(projectTypes, ({ many, one }) => ({
  projects: many(projects),
  kanbanStages: many(kanbanStages),
  changeReasons: many(changeReasons),
  stageApprovals: many(stageApprovals),
  service: one(services, {
    fields: [projectTypes.serviceId],
    references: [services.id],
  }), // Optional relationship with services
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  serviceRoles: many(serviceRoles),
  clientServices: many(clientServices),
  peopleServices: many(peopleServices),
}));

export const projectSchedulingHistoryRelations = relations(projectSchedulingHistory, ({ one }) => ({
  clientService: one(clientServices, {
    fields: [projectSchedulingHistory.clientServiceId],
    references: [clientServices.id],
  }),
  peopleService: one(peopleServices, {
    fields: [projectSchedulingHistory.peopleServiceId],
    references: [peopleServices.id],
  }),
  project: one(projects, {
    fields: [projectSchedulingHistory.projectId],
    references: [projects.id],
  }),
}));

export const clientServicesRelations = relations(clientServices, ({ one, many }) => ({
  client: one(clients, {
    fields: [clientServices.clientId],
    references: [clients.id],
  }),
  service: one(services, {
    fields: [clientServices.serviceId],
    references: [services.id],
  }),
  serviceOwner: one(users, {
    fields: [clientServices.serviceOwnerId],
    references: [users.id],
    relationName: "clientServiceOwner",
  }),
  inactiveByUser: one(users, {
    fields: [clientServices.inactiveByUserId],
    references: [users.id],
    relationName: "serviceInactivator",
  }),
  roleAssignments: many(clientServiceRoleAssignments),
  schedulingHistory: many(projectSchedulingHistory, { relationName: "clientServiceHistory" }),
}));

export const peopleServicesRelations = relations(peopleServices, ({ one, many }) => ({
  person: one(people, {
    fields: [peopleServices.personId],
    references: [people.id],
  }),
  service: one(services, {
    fields: [peopleServices.serviceId],
    references: [services.id],
  }),
  serviceOwner: one(users, {
    fields: [peopleServices.serviceOwnerId],
    references: [users.id],
    relationName: "peopleServiceOwner",
  }),
  schedulingHistory: many(projectSchedulingHistory, { relationName: "peopleServiceHistory" }),
}));

export const workRolesRelations = relations(workRoles, ({ many }) => ({
  serviceRoles: many(serviceRoles),
  clientServiceRoleAssignments: many(clientServiceRoleAssignments),
}));

export const clientServiceRoleAssignmentsRelations = relations(clientServiceRoleAssignments, ({ one }) => ({
  clientService: one(clientServices, {
    fields: [clientServiceRoleAssignments.clientServiceId],
    references: [clientServices.id],
  }),
  workRole: one(workRoles, {
    fields: [clientServiceRoleAssignments.workRoleId],
    references: [workRoles.id],
  }),
  user: one(users, {
    fields: [clientServiceRoleAssignments.userId],
    references: [users.id],
  }),
}));

export const serviceRolesRelations = relations(serviceRoles, ({ one }) => ({
  service: one(services, {
    fields: [serviceRoles.serviceId],
    references: [services.id],
  }),
  role: one(workRoles, {
    fields: [serviceRoles.roleId],
    references: [workRoles.id],
  }),
}));

// Type definitions
export type ProjectType = typeof projectTypes.$inferSelect;
export type InsertProjectType = z.infer<typeof insertProjectTypeSchema>;
export type UpdateProjectType = z.infer<typeof updateProjectTypeSchema>;
export type StageReasonMap = typeof stageReasonMaps.$inferSelect;
export type InsertStageReasonMap = z.infer<typeof insertStageReasonMapSchema>;
export type ReasonCustomField = typeof reasonCustomFields.$inferSelect;
export type InsertReasonCustomField = z.infer<typeof insertReasonCustomFieldSchema>;
export type ReasonFieldResponse = typeof reasonFieldResponses.$inferSelect;
export type InsertReasonFieldResponse = z.infer<typeof insertReasonFieldResponseSchema>;
export type StageApproval = typeof stageApprovals.$inferSelect;
export type InsertStageApproval = z.infer<typeof insertStageApprovalSchema>;
export type UpdateStageApproval = z.infer<typeof updateStageApprovalSchema>;
export type StageApprovalField = typeof stageApprovalFields.$inferSelect;
export type InsertStageApprovalField = z.infer<typeof insertStageApprovalFieldSchema>;
export type UpdateStageApprovalField = z.infer<typeof updateStageApprovalFieldSchema>;
export type StageApprovalResponse = typeof stageApprovalResponses.$inferSelect;
export type InsertStageApprovalResponse = z.infer<typeof insertStageApprovalResponseSchema>;
export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;

export type ProjectView = typeof projectViews.$inferSelect;
export type InsertProjectView = z.infer<typeof insertProjectViewSchema>;
export type CompanyView = typeof companyViews.$inferSelect;
export type InsertCompanyView = z.infer<typeof insertCompanyViewSchema>;
export type UserColumnPreferences = typeof userColumnPreferences.$inferSelect;
export type InsertUserColumnPreferences = z.infer<typeof insertUserColumnPreferencesSchema>;
export type UpdateUserColumnPreferences = z.infer<typeof updateUserColumnPreferencesSchema>;
export type Dashboard = typeof dashboards.$inferSelect;
export type InsertDashboard = z.infer<typeof insertDashboardSchema>;
export type UpdateDashboard = z.infer<typeof updateDashboardSchema>;
export type DashboardCache = typeof dashboardCache.$inferSelect;
export type InsertDashboardCache = z.infer<typeof insertDashboardCacheSchema>;
export type UpdateDashboardCache = z.infer<typeof updateDashboardCacheSchema>;
export type UserProjectPreferences = typeof userProjectPreferences.$inferSelect;
export type InsertUserProjectPreferences = z.infer<typeof insertUserProjectPreferencesSchema>;
export type UpdateUserProjectPreferences = z.infer<typeof updateUserProjectPreferencesSchema>;
export type InsertUserNotificationPreferences = z.infer<typeof insertUserNotificationPreferencesSchema>;
export type UpdateUserNotificationPreferences = z.infer<typeof updateUserNotificationPreferencesSchema>;
export type UDFDefinition = z.infer<typeof udfDefinitionSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type UpdateService = z.infer<typeof updateServiceSchema>;
export type WorkRole = typeof workRoles.$inferSelect;
export type InsertWorkRole = z.infer<typeof insertWorkRoleSchema>;
export type ServiceRole = typeof serviceRoles.$inferSelect;
export type InsertServiceRole = z.infer<typeof insertServiceRoleSchema>;
export type UpdateProjectStatus = z.infer<typeof updateProjectStatusSchema>;
export type CSVProject = z.infer<typeof csvProjectSchema>;
export type ClientService = typeof clientServices.$inferSelect;
export type InsertClientService = z.infer<typeof insertClientServiceSchema>;
export type PeopleService = typeof peopleServices.$inferSelect;
export type InsertPeopleService = z.infer<typeof insertPeopleServiceSchema>;
export type ClientServiceRoleAssignment = typeof clientServiceRoleAssignments.$inferSelect;
export type InsertClientServiceRoleAssignment = z.infer<typeof insertClientServiceRoleAssignmentSchema>;
export type ChChangeRequest = typeof chChangeRequests.$inferSelect;
export type InsertChChangeRequest = z.infer<typeof insertChChangeRequestSchema>;
export type UpdateChChangeRequest = z.infer<typeof updateChChangeRequestSchema>;
export type Person = typeof people.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type ClientPerson = typeof clientPeople.$inferSelect;
export type InsertClientPerson = z.infer<typeof insertClientPersonSchema>;

// Tags tables for client and people categorization
export const clientTags = pgTable("client_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  color: varchar("color").notNull().default("#3b82f6"), // Default blue color
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const peopleTags = pgTable("people_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  color: varchar("color").notNull().default("#3b82f6"), // Default blue color  
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Junction tables for many-to-many relationships
export const clientTagAssignments = pgTable("client_tag_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id").notNull().references(() => clientTags.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id),
}, (table) => ({
  // Prevent duplicate tag assignments
  uniqueClientTag: unique().on(table.clientId, table.tagId),
}));

export const peopleTagAssignments = pgTable("people_tag_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id").notNull().references(() => peopleTags.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id),
}, (table) => ({
  // Prevent duplicate tag assignments
  uniquePersonTag: unique().on(table.personId, table.tagId),
}));

// Zod schemas for tags
export const insertClientTagSchema = createInsertSchema(clientTags).omit({
  id: true,
  createdAt: true,
});

export const insertPeopleTagSchema = createInsertSchema(peopleTags).omit({
  id: true,
  createdAt: true,
});

export const insertClientTagAssignmentSchema = createInsertSchema(clientTagAssignments).omit({
  id: true,
  assignedAt: true,
});

export const insertPeopleTagAssignmentSchema = createInsertSchema(peopleTagAssignments).omit({
  id: true,
  assignedAt: true,
});

// Type exports
export type ClientTag = typeof clientTags.$inferSelect;
export type InsertClientTag = z.infer<typeof insertClientTagSchema>;
export type PeopleTag = typeof peopleTags.$inferSelect;
export type InsertPeopleTag = z.infer<typeof insertPeopleTagSchema>;
export type ClientTagAssignment = typeof clientTagAssignments.$inferSelect;
export type InsertClientTagAssignment = z.infer<typeof insertClientTagAssignmentSchema>;
export type PeopleTagAssignment = typeof peopleTagAssignments.$inferSelect;
export type InsertPeopleTagAssignment = z.infer<typeof insertPeopleTagAssignmentSchema>;

// Communication type enum
export const communicationTypeEnum = pgEnum("communication_type", [
  "phone_call",
  "note",
  "sms_sent", 
  "sms_received",
  "email_sent",
  "email_received"
]);

// Integration type enum
export const integrationTypeEnum = pgEnum("integration_type", [
  "office365",
  "voodoo_sms",
  "ringcentral"
]);

// Thread status enum for message threads
export const threadStatusEnum = pgEnum("thread_status", [
  "open",
  "closed", 
  "archived"
]);

// Communications table - central log of all communications
export const communications = pgTable("communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  personId: varchar("person_id").references(() => people.id, { onDelete: "set null" }), // Optional - for person-specific comms
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }), // Optional - for project-specific comms (progress notes)
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // Who logged/sent this
  type: communicationTypeEnum("type").notNull(),
  subject: varchar("subject"), // For emails primarily
  content: text("content").notNull(), // Message content or notes
  actualContactTime: timestamp("actual_contact_time").notNull(), // When the contact actually happened
  loggedAt: timestamp("logged_at").defaultNow(), // When it was logged in system
  metadata: jsonb("metadata"), // Store integration-specific data (SMS IDs, email IDs, etc.)
  isRead: boolean("is_read").default(true), // For tracking inbound messages
  threadId: varchar("thread_id"), // Optional - link to message thread for unified staff visibility
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for efficient client communication lookups
  clientIdLoggedAtIdx: index("communications_client_id_logged_at_idx").on(table.clientId, table.loggedAt),
  // Index for efficient person communication lookups  
  personIdLoggedAtIdx: index("communications_person_id_logged_at_idx").on(table.personId, table.loggedAt),
  // Index for efficient project communication lookups
  projectIdLoggedAtIdx: index("communications_project_id_logged_at_idx").on(table.projectId, table.loggedAt),
  // Index for thread lookups
  threadIdIdx: index("communications_thread_id_idx").on(table.threadId),
}));

// User integrations table for storing integration credentials
export const userIntegrations = pgTable("user_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  integrationType: integrationTypeEnum("integration_type").notNull(),
  accessToken: text("access_token"), // Encrypted token
  refreshToken: text("refresh_token"), // Encrypted refresh token
  tokenExpiry: timestamp("token_expiry"),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"), // Store integration-specific config
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent multiple integrations of same type per user
  uniqueUserIntegrationType: unique("unique_user_integration_type").on(table.userId, table.integrationType),
}));

// Client Portal Users - for client authentication and access
export const clientPortalUsers = pgTable("client_portal_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  personId: text("person_id").references(() => people.id, { onDelete: "cascade" }), // Optional link to person
  email: varchar("email").notNull(),
  name: varchar("name"),
  magicLinkToken: text("magic_link_token"), // Deprecated - keeping for backwards compatibility
  tokenExpiry: timestamp("token_expiry"), // Deprecated - keeping for backwards compatibility
  verificationCode: varchar("verification_code", { length: 6 }), // 6-digit code for login
  codeExpiry: timestamp("code_expiry"), // Expiry time for verification code
  lastLogin: timestamp("last_login"),
  pushNotificationsEnabled: boolean("push_notifications_enabled").default(false),
  notificationPreferences: jsonb("notification_preferences"), // Email, SMS preferences
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique email per client portal user
  uniqueEmail: unique("unique_client_portal_email").on(table.email),
  // Index for client lookups
  clientIdIdx: index("client_portal_users_client_id_idx").on(table.clientId),
  // Index for person lookups
  personIdIdx: index("client_portal_users_person_id_idx").on(table.personId),
}));

// Message Threads - conversation threads between clients and staff
export const messageThreads = pgTable("message_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  subject: varchar("subject").notNull(),
  status: threadStatusEnum("status").notNull().default('open'),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  lastMessageByStaff: boolean("last_message_by_staff").default(false), // Track if last message was from staff
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdByClientPortalUserId: varchar("created_by_client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }), // Optional link to project
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }), // Optional link to service
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for client thread lookups
  clientIdLastMessageIdx: index("message_threads_client_id_last_message_idx").on(table.clientId, table.lastMessageAt),
  // Index for status filtering
  statusIdx: index("message_threads_status_idx").on(table.status),
  // Index for archived status
  isArchivedIdx: index("message_threads_is_archived_idx").on(table.isArchived),
  // Index for filtering by who replied last
  lastMessageByStaffIdx: index("message_threads_last_message_by_staff_idx").on(table.lastMessageByStaff),
}));

// Messages - individual messages within threads
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => messageThreads.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }), // If sent by staff
  clientPortalUserId: varchar("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "set null" }), // If sent by client
  attachments: jsonb("attachments"), // Array of attachment metadata {fileName, fileSize, objectPath}
  isReadByStaff: boolean("is_read_by_staff").default(false), // Read receipt for staff
  isReadByClient: boolean("is_read_by_client").default(false), // Read receipt for client
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for thread message lookups
  threadIdCreatedAtIdx: index("messages_thread_id_created_at_idx").on(table.threadId, table.createdAt),
  // Index for unread messages
  isReadByStaffIdx: index("messages_is_read_by_staff_idx").on(table.isReadByStaff),
  isReadByClientIdx: index("messages_is_read_by_client_idx").on(table.isReadByClient),
}));

// Client Portal Sessions - for session management
export const clientPortalSessions = pgTable("client_portal_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
}, (table) => ({
  expireIdx: index("client_portal_sessions_expire_idx").on(table.expire),
}));

// Entity type enum for tracking what type of entity was viewed
export const viewedEntityTypeEnum = pgEnum("viewed_entity_type", [
  "client", 
  "project", 
  "person", 
  "communication"
]);

// User activity tracking table - tracks when users view different entities
export const userActivityTracking = pgTable("user_activity_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entityType: viewedEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(), // ID of the viewed entity
  viewedAt: timestamp("viewed_at").defaultNow(),
}, (table) => ({
  // Index for efficient user activity lookups ordered by most recent
  userViewedAtIdx: index("user_activity_tracking_user_viewed_at_idx").on(table.userId, table.viewedAt),
  // Unique constraint to prevent duplicate tracking of same entity view within short timeframe
  uniqueUserEntityView: unique("unique_user_entity_view").on(table.userId, table.entityType, table.entityId),
}));

// Push subscriptions table - stores browser push notification subscriptions (for staff and portal users)
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  clientPortalUserId: varchar("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  keys: jsonb("keys").notNull(), // {p256dh: string, auth: string}
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for efficient user subscription lookups
  userIdIdx: index("push_subscriptions_user_id_idx").on(table.userId),
  clientPortalUserIdIdx: index("push_subscriptions_client_portal_user_id_idx").on(table.clientPortalUserId),
  // Unique constraint to prevent duplicate subscriptions for same endpoint
  uniqueEndpoint: unique("unique_push_subscription_endpoint").on(table.endpoint),
}));

// Push notification template type enum
export const pushTemplateTypeEnum = pgEnum("push_template_type", [
  "new_message_staff",
  "new_message_client",
  "document_request", 
  "task_assigned",
  "project_stage_change",
  "status_update",
  "reminder"
]);

// Push notification templates table - admin configurable notification templates
export const pushNotificationTemplates = pgTable("push_notification_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateType: pushTemplateTypeEnum("template_type").notNull(),
  name: varchar("name").notNull(), // Display name for admin
  titleTemplate: varchar("title_template").notNull(), // Template with placeholders like {staffName}, {clientName}
  bodyTemplate: text("body_template").notNull(), // Template with placeholders
  iconUrl: varchar("icon_url"), // Optional custom icon URL
  badgeUrl: varchar("badge_url"), // Optional custom badge URL
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  templateTypeIdx: index("push_templates_type_idx").on(table.templateType),
}));

// Notification icons table - stores uploaded icon/badge images for push notifications
export const notificationIcons = pgTable("notification_icons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: varchar("file_name").notNull(), // Original filename
  storagePath: text("storage_path").notNull(), // Path in GCS (.private/notification-icons/{id}/{filename})
  fileSize: integer("file_size").notNull(), // Size in bytes
  mimeType: varchar("mime_type").notNull(), // image/png, image/jpeg, etc.
  width: integer("width"), // Image width in pixels
  height: integer("height"), // Image height in pixels
  uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uploadedByIdx: index("notification_icons_uploaded_by_idx").on(table.uploadedBy),
}));

// Project Message Threads - staff-to-staff messaging for project discussions
export const projectMessageThreads = pgTable("project_message_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  topic: varchar("topic").notNull(), // Thread topic/subject
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  lastMessageByUserId: varchar("last_message_by_user_id").references(() => users.id, { onDelete: "set null" }),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for project thread lookups
  projectIdLastMessageIdx: index("project_message_threads_project_id_last_message_idx").on(table.projectId, table.lastMessageAt),
  // Index for archived status
  isArchivedIdx: index("project_message_threads_is_archived_idx").on(table.isArchived),
}));

// Project Messages - individual messages within project threads
export const projectMessages = pgTable("project_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => projectMessageThreads.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "set null" }), // Staff member who sent message
  attachments: jsonb("attachments"), // Array of attachment metadata {fileName, fileSize, fileType, objectPath}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for thread message lookups
  threadIdCreatedAtIdx: index("project_messages_thread_id_created_at_idx").on(table.threadId, table.createdAt),
  // Index for user messages
  userIdIdx: index("project_messages_user_id_idx").on(table.userId),
}));

// Project Message Participants - tracks which staff members are in each thread
export const projectMessageParticipants = pgTable("project_message_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => projectMessageThreads.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at"), // When participant last read messages
  lastReadMessageId: varchar("last_read_message_id").references(() => projectMessages.id, { onDelete: "set null" }), // Last message they read
  lastReminderEmailSentAt: timestamp("last_reminder_email_sent_at"), // When we last sent a reminder email about unread messages
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for thread participants
  threadIdIdx: index("project_message_participants_thread_id_idx").on(table.threadId),
  // Index for user participation lookups
  userIdIdx: index("project_message_participants_user_id_idx").on(table.userId),
  // Unique constraint to prevent duplicate participants
  uniqueThreadUser: unique("unique_project_thread_user").on(table.threadId, table.userId),
}));

// Standalone Staff Message Threads - staff-to-staff messaging NOT tied to projects
export const staffMessageThreads = pgTable("staff_message_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topic: varchar("topic").notNull(), // Thread topic/subject
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  lastMessageByUserId: varchar("last_message_by_user_id").references(() => users.id, { onDelete: "set null" }),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for last message sorting
  lastMessageIdx: index("staff_message_threads_last_message_idx").on(table.lastMessageAt),
  // Index for archived status
  isArchivedIdx: index("staff_message_threads_is_archived_idx").on(table.isArchived),
}));

// Standalone Staff Messages - individual messages within standalone staff threads
export const staffMessages = pgTable("staff_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => staffMessageThreads.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "set null" }), // Staff member who sent message
  attachments: jsonb("attachments"), // Array of attachment metadata {fileName, fileSize, fileType, objectPath}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for thread message lookups
  threadIdCreatedAtIdx: index("staff_messages_thread_id_created_at_idx").on(table.threadId, table.createdAt),
  // Index for user messages
  userIdIdx: index("staff_messages_user_id_idx").on(table.userId),
}));

// Standalone Staff Message Participants - tracks which staff members are in each standalone thread
export const staffMessageParticipants = pgTable("staff_message_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => staffMessageThreads.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at"), // When participant last read messages
  lastReadMessageId: varchar("last_read_message_id").references(() => staffMessages.id, { onDelete: "set null" }), // Last message they read
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for thread participants
  threadIdIdx: index("staff_message_participants_thread_id_idx").on(table.threadId),
  // Index for user participation lookups
  userIdIdx: index("staff_message_participants_user_id_idx").on(table.userId),
  // Unique constraint to prevent duplicate participants
  uniqueThreadUser: unique("unique_staff_thread_user").on(table.threadId, table.userId),
}));

// Document folders table - organizes documents into folders (batches)
export const documentFolders = pgTable("document_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(), // folder name (e.g., "ID Documents", "Bank Statements")
  createdBy: varchar("created_by").references(() => users.id), // nullable for system-generated folders
  source: varchar("source").notNull().default('direct upload'), // where the upload came from
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_document_folders_client_id").on(table.clientId),
  index("idx_document_folders_created_at").on(table.createdAt),
]);

// Documents table - stores metadata for files uploaded to object storage
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  folderId: varchar("folder_id").references(() => documentFolders.id, { onDelete: "cascade" }), // nullable for migration
  uploadedBy: varchar("uploaded_by").references(() => users.id), // nullable - portal users use clientPortalUserId
  clientPortalUserId: varchar("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "cascade" }), // for portal uploads
  uploadName: varchar("upload_name"), // kept temporarily for migration
  source: varchar("source", {
    enum: ['direct_upload', 'message_attachment', 'task_upload', 'portal_upload', 'signature_request']
  }).notNull().default('direct_upload'), // source of the document
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }), // link to source message if from message attachment
  threadId: varchar("thread_id").references(() => messageThreads.id, { onDelete: "cascade" }), // link to thread if from message attachment
  taskInstanceId: varchar("task_instance_id"), // link to task instance if uploaded via task template
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  fileType: varchar("file_type").notNull(), // MIME type
  objectPath: text("object_path").notNull(), // path in object storage (/objects/...)
  isPortalVisible: boolean("is_portal_visible").default(true), // whether visible to portal users
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => [
  index("idx_documents_client_id").on(table.clientId),
  index("idx_documents_folder_id").on(table.folderId),
  index("idx_documents_uploaded_at").on(table.uploadedAt),
  index("idx_documents_client_portal_user_id").on(table.clientPortalUserId),
  index("idx_documents_message_id").on(table.messageId),
  index("idx_documents_thread_id").on(table.threadId),
  index("idx_documents_task_instance_id").on(table.taskInstanceId),
  index("idx_documents_source").on(table.source),
]);

// ============================================================
// E-SIGNATURE SYSTEM TABLES
// ============================================================

// Signature request status enum
export const signatureRequestStatusEnum = pgEnum("signature_request_status", [
  "draft",
  "pending", // sent to recipients, waiting for signatures
  "partially_signed", // some recipients have signed
  "completed", // all recipients have signed
  "cancelled"
]);

// Signature field type enum
export const signatureFieldTypeEnum = pgEnum("signature_field_type", [
  "signature", // drawn or uploaded signature
  "typed_name" // typed name field
]);

// Signature requests - main table for document signing workflows
export const signatureRequests = pgTable("signature_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }), // PDF to be signed
  createdBy: varchar("created_by").notNull().references(() => users.id), // Staff user who created request
  status: signatureRequestStatusEnum("status").notNull().default("draft"),
  emailSubject: varchar("email_subject"), // Subject line for signature request email
  emailMessage: text("email_message"), // Custom message from staff to recipients
  completedAt: timestamp("completed_at"), // When all signatures collected
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_signature_requests_client_id").on(table.clientId),
  index("idx_signature_requests_document_id").on(table.documentId),
  index("idx_signature_requests_status").on(table.status),
  index("idx_signature_requests_created_by").on(table.createdBy),
]);

// Signature fields - defines where signature fields are placed on PDF
export const signatureFields = pgTable("signature_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureRequestId: varchar("signature_request_id").notNull().references(() => signatureRequests.id, { onDelete: "cascade" }),
  recipientPersonId: text("recipient_person_id").notNull().references(() => people.id, { onDelete: "cascade" }), // Who should sign this field
  fieldType: signatureFieldTypeEnum("field_type").notNull(),
  pageNumber: integer("page_number").notNull(), // PDF page (0-indexed)
  xPosition: real("x_position").notNull(), // X coordinate as percentage (0-100) with decimals
  yPosition: real("y_position").notNull(), // Y coordinate as percentage (0-100) with decimals
  width: real("width").notNull(), // Field width as percentage (0-100) with decimals
  height: real("height").notNull(), // Field height as percentage (0-100) with decimals
  label: varchar("label"), // Optional label (e.g., "Sign here", "Type your name")
  orderIndex: integer("order_index").notNull().default(0), // Order for signing flow
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signature_fields_request_id").on(table.signatureRequestId),
  index("idx_signature_fields_recipient_id").on(table.recipientPersonId),
]);

// Signature request recipients - tracks who needs to sign
export const signatureRequestRecipients = pgTable("signature_request_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureRequestId: varchar("signature_request_id").notNull().references(() => signatureRequests.id, { onDelete: "cascade" }),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  email: varchar("email").notNull(), // Email where request was sent
  secureToken: varchar("secure_token").notNull().unique(), // Unique token for signing link
  tokenExpiresAt: timestamp("token_expires_at").notNull().default(sql`now() + interval '30 days'`), // Token valid for 30 days
  sentAt: timestamp("sent_at"), // When email was sent
  sendStatus: varchar("send_status").default('pending'), // 'pending', 'sent', 'failed'
  sendError: text("send_error"), // Error message if send failed
  viewedAt: timestamp("viewed_at"), // When recipient first opened the link
  signedAt: timestamp("signed_at"), // When recipient completed signing
  reminderSentAt: timestamp("reminder_sent_at"), // Last reminder sent
  orderIndex: integer("order_index").notNull().default(0), // Order for sequential signing
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signature_request_recipients_request_id").on(table.signatureRequestId),
  index("idx_signature_request_recipients_person_id").on(table.personId),
  index("idx_signature_request_recipients_token").on(table.secureToken),
  unique("unique_request_recipient").on(table.signatureRequestId, table.personId),
]);

// Signatures - stores actual signature data for each field
export const signatures = pgTable("signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureFieldId: varchar("signature_field_id").notNull().references(() => signatureFields.id, { onDelete: "cascade" }),
  signatureRequestRecipientId: varchar("signature_request_recipient_id").notNull().references(() => signatureRequestRecipients.id, { onDelete: "cascade" }),
  signatureType: varchar("signature_type").notNull(), // 'drawn', 'typed'
  signatureData: text("signature_data").notNull(), // Base64 image data for drawn, text for typed
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signatures_field_id").on(table.signatureFieldId),
  index("idx_signatures_recipient_id").on(table.signatureRequestRecipientId),
]);

// Signature audit logs - UK eIDAS compliance audit trail
export const signatureAuditLogs = pgTable("signature_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureRequestRecipientId: varchar("signature_request_recipient_id").notNull().references(() => signatureRequestRecipients.id, { onDelete: "cascade" }),
  // Event tracking
  eventType: varchar("event_type").notNull(), // 'signature_completed', 'consent_accepted', etc.
  eventDetails: text("event_details"), // Additional event context
  // Signer identity
  signerName: varchar("signer_name").notNull(),
  signerEmail: varchar("signer_email").notNull(),
  // Session information
  ipAddress: varchar("ip_address").notNull(),
  userAgent: text("user_agent").notNull(), // Full user agent string
  deviceInfo: varchar("device_info"), // Parsed device type (Desktop, Mobile, Tablet)
  browserInfo: varchar("browser_info"), // Parsed browser (Chrome 119, Safari 17, etc.)
  osInfo: varchar("os_info"), // Parsed OS (Windows 10, iOS 17, etc.)
  // Consent tracking
  consentAccepted: boolean("consent_accepted").notNull().default(true), // UK eIDAS consent accepted
  consentAcceptedAt: timestamp("consent_accepted_at").notNull(), // When consent was accepted
  // Timestamps (UTC)
  signedAt: timestamp("signed_at").notNull(), // When signing completed
  // Document integrity
  documentHash: varchar("document_hash").notNull(), // SHA-256 hash of original PDF
  documentVersion: varchar("document_version").notNull(), // Version identifier
  // Authentication method
  authMethod: varchar("auth_method").notNull().default("email_link"), // email_link, sms_code, etc.
  // Geolocation (optional)
  city: varchar("city"),
  country: varchar("country"),
  // Additional metadata
  metadata: jsonb("metadata"), // Store any additional audit data
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signature_audit_logs_recipient_id").on(table.signatureRequestRecipientId),
  index("idx_signature_audit_logs_signed_at").on(table.signedAt),
]);

// Signed documents - stores final signed PDFs and audit reports
export const signedDocuments = pgTable("signed_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signatureRequestId: varchar("signature_request_id").notNull().references(() => signatureRequests.id, { onDelete: "cascade" }).unique(),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  signedPdfPath: text("signed_pdf_path").notNull(), // Path in object storage to signed PDF
  originalPdfHash: varchar("original_pdf_hash").notNull(), // SHA-256 hash of original PDF (pre-signature)
  signedPdfHash: varchar("signed_pdf_hash").notNull(), // SHA-256 hash of final signed PDF (post-signature)
  auditTrailPdfPath: text("audit_trail_pdf_path"), // Path to audit trail PDF (certificate)
  fileName: varchar("file_name").notNull(), // Original filename
  fileSize: integer("file_size").notNull(), // Size in bytes
  completedAt: timestamp("completed_at").notNull().defaultNow(),
  emailSentAt: timestamp("email_sent_at"), // When signed doc was emailed to recipients
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_signed_documents_request_id").on(table.signatureRequestId),
  index("idx_signed_documents_client_id").on(table.clientId),
  index("idx_signed_documents_completed_at").on(table.completedAt),
]);

// ============================================================
// EMAIL THREADING & DEDUPLICATION TABLES
// ============================================================

// Email direction enum
export const emailDirectionEnum = pgEnum("email_direction", ["inbound", "outbound", "internal", "external"]);

// Email client match confidence enum
export const emailMatchConfidenceEnum = pgEnum("email_match_confidence", ["high", "medium", "low"]);

// Email messages table - stores deduplicated emails with threading info
export const emailMessages = pgTable("email_messages", {
  // Primary deduplication key - global unique identifier from Microsoft Graph
  internetMessageId: varchar("internet_message_id").primaryKey(), // Global unique ID from Graph
  
  // Thread grouping fields
  canonicalConversationId: varchar("canonical_conversation_id").notNull().references(() => emailThreads.canonicalConversationId, { onDelete: "cascade" }), // First seen conversationId for this thread
  conversationIdSeen: varchar("conversation_id_seen").notNull(), // Original conversationId from this copy
  threadKey: varchar("thread_key"), // Fallback hash: hash(rootInternetMessageId + normalizedSubjectStem + participantsSet)
  threadPosition: integer("thread_position"), // Ordinal position within thread
  
  // Email metadata
  from: varchar("from").notNull(), // Normalized to lowercase
  to: text("to").array(), // Array of normalized lowercase emails
  cc: text("cc").array(), // Array of normalized lowercase emails
  bcc: text("bcc").array(), // Array of normalized lowercase emails
  subject: text("subject"),
  subjectStem: text("subject_stem"), // Normalized subject without Re:/Fwd: for matching
  body: text("body"), // Email body content
  bodyPreview: text("body_preview"), // Short preview (first 150 chars)
  
  // Timestamps
  receivedDateTime: timestamp("received_datetime").notNull(),
  sentDateTime: timestamp("sent_datetime"),
  
  // Threading ancestry
  inReplyTo: varchar("in_reply_to"), // internetMessageId of parent message
  references: text("references").array(), // Array of ancestral internetMessageIds
  
  // Email direction and classification
  direction: emailDirectionEnum("direction").notNull(),
  isInternalOnly: boolean("is_internal_only").default(false), // Computed: all participants are staff
  participantCount: integer("participant_count"), // Total unique participants (for noise detection)
  hasAttachments: boolean("has_attachments").default(false), // Quick filter flag
  
  // Client association
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  clientMatchConfidence: emailMatchConfidenceEnum("client_match_confidence"), // How confident we are in the client match
  
  // Mailbox owner tracking
  mailboxOwnerUserId: varchar("mailbox_owner_user_id").references(() => users.id, { onDelete: "set null" }), // Which staff mailbox this came from
  
  // Graph API metadata
  graphMessageId: varchar("graph_message_id"), // The id from Graph (changes per mailbox)
  conversationIndex: text("conversation_index"), // Graph's conversation index for ordering
  internetMessageHeaders: jsonb("internet_message_headers"), // Store full headers if needed for debugging
  
  // Processing metadata
  processedAt: timestamp("processed_at").defaultNow(),
  errorCount: integer("error_count").default(0), // Retry tracking
  lastError: text("last_error"), // Last processing error
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Threading indexes
  index("idx_email_messages_canonical_conversation_id").on(table.canonicalConversationId),
  index("idx_email_messages_thread_key").on(table.threadKey),
  index("idx_email_messages_in_reply_to").on(table.inReplyTo),
  
  // Client association indexes
  index("idx_email_messages_client_id").on(table.clientId),
  index("idx_email_messages_client_id_received").on(table.clientId, table.receivedDateTime),
  
  // Participant search indexes
  index("idx_email_messages_from").on(table.from),
  
  // Mailbox owner index
  index("idx_email_messages_mailbox_owner").on(table.mailboxOwnerUserId),
  
  // Direction and classification indexes
  index("idx_email_messages_direction").on(table.direction),
  index("idx_email_messages_is_internal_only").on(table.isInternalOnly),
  
  // Date-based queries
  index("idx_email_messages_received_datetime").on(table.receivedDateTime),
]);

// Mailbox message map - tracks which mailboxes have copies of each message
export const mailboxMessageMap = pgTable("mailbox_message_map", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mailboxUserId: varchar("mailbox_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mailboxMessageId: varchar("mailbox_message_id").notNull(), // The id from Graph API for this mailbox
  internetMessageId: varchar("internet_message_id").notNull().references(() => emailMessages.internetMessageId, { onDelete: "cascade" }),
  folderPath: varchar("folder_path"), // e.g., "Inbox", "Sent Items", "Archive/2024"
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Unique constraint: one Graph message ID per mailbox
  unique("unique_mailbox_graph_message").on(table.mailboxUserId, table.mailboxMessageId),
  // Unique constraint: one global message per mailbox (prevent duplicate mapping)
  unique("unique_mailbox_internet_message").on(table.mailboxUserId, table.internetMessageId),
  
  // Lookup indexes
  index("idx_mailbox_message_map_internet_message_id").on(table.internetMessageId),
  index("idx_mailbox_message_map_mailbox_user").on(table.mailboxUserId),
]);

// Email threads - summary information for each conversation thread
// Note: canonicalConversationId is the primary key to ensure referential integrity
export const emailThreads = pgTable("email_threads", {
  canonicalConversationId: varchar("canonical_conversation_id").primaryKey(), // Canonical thread identifier
  threadKey: varchar("thread_key").unique(), // Fallback computed hash if conversationId breaks
  
  // Thread summary
  subject: text("subject"), // Subject of first message
  participants: text("participants").array(), // All unique email addresses in thread
  
  // Client association
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  
  // Timeline
  firstMessageAt: timestamp("first_message_at").notNull(),
  lastMessageAt: timestamp("last_message_at").notNull(),
  messageCount: integer("message_count").default(1),
  
  // Latest preview for UI
  latestPreview: text("latest_preview"), // Preview of most recent message
  latestDirection: emailDirectionEnum("latest_direction"), // Direction of most recent message
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_threads_client_id").on(table.clientId),
  index("idx_email_threads_last_message_at").on(table.lastMessageAt),
  index("idx_email_threads_thread_key").on(table.threadKey),
]);

// Unmatched emails - quarantine for emails that don't match any client
export const unmatchedEmails = pgTable("unmatched_emails", {
  internetMessageId: varchar("internet_message_id").primaryKey().references(() => emailMessages.internetMessageId, { onDelete: "cascade" }),
  
  // Minimal fields for matching attempts
  from: varchar("from").notNull(),
  to: text("to").array(),
  cc: text("cc").array(),
  subjectStem: text("subject_stem"),
  
  // Ancestry for retroactive matching
  inReplyTo: varchar("in_reply_to"),
  references: text("references").array(),
  
  // Timestamps
  receivedDateTime: timestamp("received_datetime").notNull(),
  
  // Processing
  mailboxOwnerUserId: varchar("mailbox_owner_user_id").references(() => users.id, { onDelete: "set null" }),
  direction: emailDirectionEnum("direction").notNull(),
  retryCount: integer("retry_count").default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_unmatched_emails_from").on(table.from),
  index("idx_unmatched_emails_received_datetime").on(table.receivedDateTime),
  index("idx_unmatched_emails_in_reply_to").on(table.inReplyTo),
  index("idx_unmatched_emails_retry_count").on(table.retryCount),
]);

// Client email aliases - known email addresses for each client
export const clientEmailAliases = pgTable("client_email_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  emailLowercase: varchar("email_lowercase").notNull(), // Always stored in lowercase
  isPrimary: boolean("is_primary").default(false), // Mark primary contact email
  source: varchar("source").default('manual'), // 'manual', 'auto_discovered', 'companies_house'
  verifiedAt: timestamp("verified_at"), // When this alias was verified (optional)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Unique constraint: one email can only belong to one client
  unique("unique_client_email").on(table.emailLowercase),
  
  index("idx_client_email_aliases_client_id").on(table.clientId),
  index("idx_client_email_aliases_email").on(table.emailLowercase),
]);

// Client domain allowlist - auto-match emails from specific domains to clients
export const clientDomainAllowlist = pgTable("client_domain_allowlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  domain: varchar("domain").notNull(), // e.g., 'acmecorp.com' (always lowercase)
  matchConfidence: emailMatchConfidenceEnum("match_confidence").default('medium'), // Domain matches are medium confidence
  notes: text("notes"), // Why this domain is allowed
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Unique constraint: one domain per client
  unique("unique_client_domain").on(table.clientId, table.domain),
  
  index("idx_client_domain_allowlist_client_id").on(table.clientId),
  index("idx_client_domain_allowlist_domain").on(table.domain),
]);

// Email attachments - deduplicated attachment storage
export const emailAttachments = pgTable("email_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentHash: varchar("content_hash").notNull().unique(), // SHA-256 hash for deduplication
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  contentType: varchar("content_type").notNull(), // MIME type
  objectPath: text("object_path").notNull(), // Path in object storage
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_email_attachments_content_hash").on(table.contentHash),
]);

// Email message attachments - junction table linking messages to attachments
export const emailMessageAttachments = pgTable("email_message_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  internetMessageId: varchar("internet_message_id").notNull().references(() => emailMessages.internetMessageId, { onDelete: "cascade" }),
  attachmentId: varchar("attachment_id").notNull().references(() => emailAttachments.id, { onDelete: "cascade" }),
  attachmentIndex: integer("attachment_index"), // Order in original email
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Unique constraint: prevent duplicate links between same message and attachment
  unique("unique_message_attachment").on(table.internetMessageId, table.attachmentId),
  
  index("idx_email_message_attachments_message_id").on(table.internetMessageId),
  index("idx_email_message_attachments_attachment_id").on(table.attachmentId),
]);

// Graph webhook subscriptions - track active webhook subscriptions
export const graphWebhookSubscriptions = pgTable("graph_webhook_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").notNull().unique(), // ID from Microsoft Graph
  resource: varchar("resource").notNull(), // e.g., "me/mailFolders('Inbox')/messages"
  changeType: varchar("change_type").notNull(), // "created,updated"
  expiresAt: timestamp("expires_at").notNull(),
  clientState: varchar("client_state"), // For validation
  isActive: boolean("is_active").default(true),
  lastRenewedAt: timestamp("last_renewed_at"),
  lastNotificationAt: timestamp("last_notification_at"), // Track webhook activity
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_graph_subscriptions_user_id").on(table.userId),
  index("idx_graph_subscriptions_expires_at").on(table.expiresAt),
  index("idx_graph_subscriptions_is_active").on(table.isActive),
]);

// Graph sync state - track delta sync tokens per mailbox
export const graphSyncState = pgTable("graph_sync_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  folderPath: varchar("folder_path").notNull(), // "Inbox" or "SentItems"
  deltaLink: text("delta_link"), // Full delta link from Graph API
  lastSyncAt: timestamp("last_sync_at"),
  lastMessageCount: integer("last_message_count").default(0), // Messages processed in last sync
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Unique constraint: one sync state per user+folder
  unique("unique_user_folder_sync").on(table.userId, table.folderPath),
  
  index("idx_graph_sync_state_user_id").on(table.userId),
  index("idx_graph_sync_state_last_sync").on(table.lastSyncAt),
]);

// Zod schemas for communications
export const insertCommunicationSchema = createInsertSchema(communications).omit({
  id: true,
  loggedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  actualContactTime: z.coerce.date(),
});

// Zod schemas for client portal and messaging
export const insertClientPortalUserSchema = createInsertSchema(clientPortalUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageThreadSchema = createInsertSchema(messageThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Zod schemas for project messaging
export const insertProjectMessageThreadSchema = createInsertSchema(projectMessageThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectMessageSchema = createInsertSchema(projectMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectMessageParticipantSchema = createInsertSchema(projectMessageParticipants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Zod schemas for standalone staff messaging
export const insertStaffMessageThreadSchema = createInsertSchema(staffMessageThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffMessageSchema = createInsertSchema(staffMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffMessageParticipantSchema = createInsertSchema(staffMessageParticipants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserIntegrationSchema = createInsertSchema(userIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserActivityTrackingSchema = createInsertSchema(userActivityTracking).omit({
  id: true,
  viewedAt: true,
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPushNotificationTemplateSchema = createInsertSchema(pushNotificationTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationIconSchema = createInsertSchema(notificationIcons).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentFolderSchema = createInsertSchema(documentFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

// Zod schemas for e-signature system
export const insertSignatureRequestSchema = createInsertSchema(signatureRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
});

export const insertSignatureFieldSchema = createInsertSchema(signatureFields).omit({
  id: true,
  createdAt: true,
});

export const insertSignatureRequestRecipientSchema = createInsertSchema(signatureRequestRecipients).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  viewedAt: true,
  signedAt: true,
  reminderSentAt: true,
});

export const insertSignatureSchema = createInsertSchema(signatures).omit({
  id: true,
  createdAt: true,
  signedAt: true,
});

export const insertSignatureAuditLogSchema = createInsertSchema(signatureAuditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertSignedDocumentSchema = createInsertSchema(signedDocuments).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Zod schemas for email threading
export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({
  processedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMailboxMessageMapSchema = createInsertSchema(mailboxMessageMap).omit({
  id: true,
  createdAt: true,
});

export const insertEmailThreadSchema = createInsertSchema(emailThreads).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertUnmatchedEmailSchema = createInsertSchema(unmatchedEmails).omit({
  createdAt: true,
});

export const insertClientEmailAliasSchema = createInsertSchema(clientEmailAliases).omit({
  id: true,
  createdAt: true,
});

export const insertClientDomainAllowlistSchema = createInsertSchema(clientDomainAllowlist).omit({
  id: true,
  createdAt: true,
});

export const insertEmailAttachmentSchema = createInsertSchema(emailAttachments).omit({
  id: true,
  createdAt: true,
});

export const insertEmailMessageAttachmentSchema = createInsertSchema(emailMessageAttachments).omit({
  id: true,
  createdAt: true,
});

export const insertGraphWebhookSubscriptionSchema = createInsertSchema(graphWebhookSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertGraphSyncStateSchema = createInsertSchema(graphSyncState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Risk assessment enums
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);
export const riskResponseEnum = pgEnum("risk_response", ["no", "yes", "na"]);

// Risk assessments table - one-to-many with clients
export const riskAssessments = pgTable("risk_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  version: varchar("version").notNull(), // e.g., "2024/25"
  
  // AML Preparation
  amlPreparedBy: varchar("aml_prepared_by").references(() => users.id),
  preparationStarted: timestamp("preparation_started"),
  preparationCompleted: timestamp("preparation_completed"),
  enhancedDueDiligenceRequired: boolean("enhanced_due_diligence_required").default(false),
  
  // AML Review
  amlReviewedBy: varchar("aml_reviewed_by").references(() => users.id),
  reviewStarted: timestamp("review_started"),
  reviewCompleted: timestamp("review_completed"),
  
  // General Information
  generalInformation: text("general_information"),
  
  // Risk Assessment
  riskLevel: riskLevelEnum("risk_level"),
  initialDate: timestamp("initial_date"),
  reviewDate: timestamp("review_date"),
  furtherRisksInitialDate: timestamp("further_risks_initial_date"),
  furtherRisksReviewDate: timestamp("further_risks_review_date"),
  
  // Money Laundering Officer
  moneyLaunderingOfficer: varchar("money_laundering_officer").references(() => users.id),
  mloReviewDate: timestamp("mlo_review_date"),
  
  // Electronic Search
  electronicSearchReference: text("electronic_search_reference"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_risk_assessments_client_id").on(table.clientId),
  index("idx_risk_assessments_version").on(table.version),
]);

// Risk assessment responses table - stores answers to checklist questions
export const riskAssessmentResponses = pgTable("risk_assessment_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  riskAssessmentId: varchar("risk_assessment_id").notNull().references(() => riskAssessments.id, { onDelete: "cascade" }),
  questionKey: varchar("question_key").notNull(), // e.g., 'individuals_confirm_identity', 'business_certificate_incorporation'
  response: riskResponseEnum("response").notNull(), // 'no', 'yes', or 'na'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_risk_responses_assessment_id").on(table.riskAssessmentId),
  unique("unique_assessment_question").on(table.riskAssessmentId, table.questionKey),
]);

// Client Request Templates - Question type enum
export const questionTypeEnum = pgEnum("question_type", [
  "short_text",
  "long_text", 
  "email",
  "number",
  "date",
  "single_choice",
  "multi_choice",
  "dropdown",
  "yes_no",
  "file_upload"
]);

// Client Request Templates - Instance status enum
export const taskInstanceStatusEnum = pgEnum("task_instance_status", [
  "not_started",
  "in_progress",
  "submitted",
  "approved",
  "cancelled"
]);

// Client request template categories table
export const clientRequestTemplateCategories = pgTable("client_request_template_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_template_categories_order").on(table.order),
]);

// Client request templates table
export const clientRequestTemplates = pgTable("client_request_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => clientRequestTemplateCategories.id, { onDelete: "set null" }),
  name: varchar("name").notNull(),
  description: text("description"),
  status: varchar("status", { enum: ["draft", "active"] }).notNull().default("draft"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_templates_category_id").on(table.categoryId),
  index("idx_task_templates_status").on(table.status),
]);

// Client request template sections table
export const clientRequestTemplateSections = pgTable("client_request_template_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => clientRequestTemplates.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_template_sections_template_id").on(table.templateId),
  index("idx_task_template_sections_order").on(table.templateId, table.order),
]);

// Client request template questions table
export const clientRequestTemplateQuestions = pgTable("client_request_template_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull().references(() => clientRequestTemplateSections.id, { onDelete: "cascade" }),
  questionType: questionTypeEnum("question_type").notNull(),
  label: text("label").notNull(),
  helpText: text("help_text"),
  isRequired: boolean("is_required").notNull().default(false),
  order: integer("order").notNull().default(0),
  validationRules: jsonb("validation_rules"), // min, max, pattern, etc. in JSON
  options: text("options").array(), // for single_choice, multi_choice, dropdown
  conditionalLogic: jsonb("conditional_logic"), // {showIf: {questionId: "xyz", operator: "equals", value: "yes"}}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_template_questions_section_id").on(table.sectionId),
  index("idx_task_template_questions_order").on(table.sectionId, table.order),
]);

// Task instances table - created when client request template is applied to a client OR from custom request
export const taskInstances = pgTable("task_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => clientRequestTemplates.id), // nullable - either templateId OR customRequestId must be set
  customRequestId: varchar("custom_request_id").references(() => clientCustomRequests.id, { onDelete: "cascade" }), // nullable - either templateId OR customRequestId must be set
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  personId: varchar("person_id").references(() => people.id, { onDelete: "cascade" }), // related person assigned to complete the task
  clientPortalUserId: varchar("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "cascade" }), // portal user who will complete it
  status: taskInstanceStatusEnum("status").notNull().default("not_started"),
  assignedBy: varchar("assigned_by").references(() => users.id), // staff member who assigned the task
  dueDate: timestamp("due_date"), // optional due date
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_instances_template_id").on(table.templateId),
  index("idx_task_instances_custom_request_id").on(table.customRequestId),
  index("idx_task_instances_client_id").on(table.clientId),
  index("idx_task_instances_person_id").on(table.personId),
  index("idx_task_instances_client_portal_user_id").on(table.clientPortalUserId),
  index("idx_task_instances_status").on(table.status),
]);

// Task instance responses table - stores answers to questions (from either client request templates or custom requests)
export const taskInstanceResponses = pgTable("task_instance_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskInstanceId: varchar("task_instance_id").notNull().references(() => taskInstances.id, { onDelete: "cascade" }),
  questionId: varchar("question_id").notNull(), // references either clientRequestTemplateQuestions.id or clientCustomRequestQuestions.id
  responseValue: text("response_value"), // text response or JSON for complex types
  fileUrls: text("file_urls").array(), // for file_upload questions - array of object paths
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_task_instance_responses_task_instance_id").on(table.taskInstanceId),
  index("idx_task_instance_responses_question_id").on(table.questionId),
  unique("unique_task_instance_question").on(table.taskInstanceId, table.questionId),
]);

// Client custom requests - one-off forms created by staff for specific clients
export const clientCustomRequests = pgTable("client_custom_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  description: text("description"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_custom_requests_client_id").on(table.clientId),
]);

// Client custom request sections
export const clientCustomRequestSections = pgTable("client_custom_request_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => clientCustomRequests.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_custom_request_sections_request_id").on(table.requestId),
  index("idx_client_custom_request_sections_order").on(table.requestId, table.order),
]);

// Client custom request questions
export const clientCustomRequestQuestions = pgTable("client_custom_request_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull().references(() => clientCustomRequestSections.id, { onDelete: "cascade" }),
  questionType: questionTypeEnum("question_type").notNull(),
  label: text("label").notNull(),
  helpText: text("help_text"),
  isRequired: boolean("is_required").notNull().default(false),
  order: integer("order").notNull().default(0),
  validationRules: jsonb("validation_rules"),
  options: text("options").array(),
  conditionalLogic: jsonb("conditional_logic"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_custom_request_questions_section_id").on(table.sectionId),
  index("idx_client_custom_request_questions_order").on(table.sectionId, table.order),
]);

// ============================================
// INTERNAL TASKS SYSTEM
// ============================================

// Task types table - admin-defined list of task types
export const taskTypes = pgTable("task_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Internal tasks table - staff task management
export const internalTasks = pgTable("internal_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  status: internalTaskStatusEnum("status").notNull().default("open"),
  priority: internalTaskPriorityEnum("priority").notNull().default("low"),
  taskTypeId: varchar("task_type_id").references(() => taskTypes.id, { onDelete: "set null" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  assignedTo: varchar("assigned_to").notNull().references(() => users.id),
  dueDate: timestamp("due_date").notNull(),
  closedAt: timestamp("closed_at"),
  closedBy: varchar("closed_by").references(() => users.id),
  closureNote: text("closure_note"),
  totalTimeSpentMinutes: integer("total_time_spent_minutes").default(0),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_internal_tasks_status").on(table.status),
  index("idx_internal_tasks_priority").on(table.priority),
  index("idx_internal_tasks_created_by").on(table.createdBy),
  index("idx_internal_tasks_assigned_to").on(table.assignedTo),
  index("idx_internal_tasks_task_type_id").on(table.taskTypeId),
  index("idx_internal_tasks_due_date").on(table.dueDate),
  index("idx_internal_tasks_is_archived").on(table.isArchived),
]);

// Task connections table - links tasks to other entities
export const taskConnections = pgTable("task_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => internalTasks.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type").notNull(), // 'client', 'project', 'person', 'message', 'service'
  entityId: varchar("entity_id").notNull(), // ID of the connected entity
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_task_connections_task_id").on(table.taskId),
  index("idx_task_connections_entity").on(table.entityType, table.entityId),
]);

// Task progress notes table - for tracking progress with timestamp and user
export const taskProgressNotes = pgTable("task_progress_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => internalTasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_task_progress_notes_task_id").on(table.taskId),
  index("idx_task_progress_notes_user_id").on(table.userId),
  index("idx_task_progress_notes_created_at").on(table.createdAt),
]);

// Task time entries table - for time tracking
export const taskTimeEntries = pgTable("task_time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => internalTasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_task_time_entries_task_id").on(table.taskId),
  index("idx_task_time_entries_user_id").on(table.userId),
  index("idx_task_time_entries_start_time").on(table.startTime),
]);

// Task documents table - for document attachments
export const taskDocuments = pgTable("task_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => internalTasks.id, { onDelete: "cascade" }),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size").notNull(), // Size in bytes
  mimeType: varchar("mime_type").notNull(),
  storagePath: varchar("storage_path").notNull(), // Path in object storage
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_task_documents_task_id").on(table.taskId),
  index("idx_task_documents_uploaded_by").on(table.uploadedBy),
]);

// ============================================================
// NOTIFICATION & REMINDER SYSTEM TABLES
// ============================================================

// Notification type enum - channels through which notifications can be sent
export const notificationTypeEnum = pgEnum("notification_type", ["email", "sms", "push"]);

// Notification category enum - differentiates project vs stage notifications
export const notificationCategoryEnum = pgEnum("notification_category", ["project", "stage"]);

// Date reference enum - for project notifications (start_date or due_date)
export const dateReferenceEnum = pgEnum("date_reference", ["start_date", "due_date"]);

// Date offset type enum - before, on, or after the reference date
export const dateOffsetTypeEnum = pgEnum("date_offset_type", ["before", "on", "after"]);

// Stage trigger enum - whether notification fires on entering or exiting a stage
export const stageTriggerEnum = pgEnum("stage_trigger", ["entry", "exit"]);

// Notification status enum - tracks the lifecycle of a scheduled notification
export const notificationStatusEnum = pgEnum("notification_status", [
  "scheduled", 
  "sent", 
  "failed", 
  "cancelled"
]);

// Company settings table - global configuration for the system
export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailSenderName: varchar("email_sender_name").default("The Link Team"), // Sender name for SendGrid emails
  firmName: varchar("firm_name").default("The Link"), // Firm name for notification templates
  firmPhone: varchar("firm_phone"), // Firm phone number for notification templates
  firmEmail: varchar("firm_email"), // Firm email for notification templates
  portalUrl: varchar("portal_url"), // Base URL for client portal links (e.g., https://example.replit.app)
  pushNotificationsEnabled: boolean("push_notifications_enabled").default(false).notNull(), // Global toggle for push notifications
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project type notifications table - notification configurations for project types
export const projectTypeNotifications = pgTable("project_type_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeId: varchar("project_type_id").notNull().references(() => projectTypes.id, { onDelete: "cascade" }),
  
  // Notification metadata
  category: notificationCategoryEnum("category").notNull(), // 'project' or 'stage'
  notificationType: notificationTypeEnum("notification_type").notNull(), // 'email', 'sms', or 'push'
  
  // For project notifications (category = 'project')
  dateReference: dateReferenceEnum("date_reference"), // 'start_date' or 'due_date' (nullable for stage notifications)
  offsetType: dateOffsetTypeEnum("offset_type"), // 'before', 'on', 'after' (nullable for stage notifications)
  offsetDays: integer("offset_days"), // Number of days offset (nullable for stage notifications, 0 for 'on')
  
  // For stage notifications (category = 'stage')
  stageId: varchar("stage_id").references(() => kanbanStages.id, { onDelete: "cascade" }), // Stage that triggers notification (nullable for project notifications)
  stageTrigger: stageTriggerEnum("stage_trigger"), // 'entry' or 'exit' (nullable for project notifications)
  
  // Notification content
  emailTitle: varchar("email_title"), // Email subject (for email type only)
  emailBody: text("email_body"), // Email body - rich text HTML (for email type only)
  smsContent: varchar("sms_content", { length: 160 }), // SMS message - 160 char limit (for sms type only)
  pushTitle: varchar("push_title", { length: 50 }), // Push notification title - 50 char limit (for push type only)
  pushBody: varchar("push_body", { length: 120 }), // Push notification body - 120 char limit (for push type only)
  
  // Client Request Template linking (for email and push only)
  clientRequestTemplateId: varchar("client_request_template_id").references(() => clientRequestTemplates.id, { onDelete: "set null" }), // Links to a client request template
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_project_type_notifications_project_type_id").on(table.projectTypeId),
  index("idx_project_type_notifications_stage_id").on(table.stageId),
  index("idx_project_type_notifications_category").on(table.category),
  // Check constraint: project notifications must have dateReference, offsetType, offsetDays
  check("check_project_notification_fields", sql`
    (category != 'project' OR (date_reference IS NOT NULL AND offset_type IS NOT NULL AND offset_days IS NOT NULL))
  `),
  // Check constraint: stage notifications must have stageId and stageTrigger
  check("check_stage_notification_fields", sql`
    (category != 'stage' OR (stage_id IS NOT NULL AND stage_trigger IS NOT NULL))
  `),
  // Check constraint: email notifications must have emailTitle and emailBody
  check("check_email_notification_content", sql`
    (notification_type != 'email' OR (email_title IS NOT NULL AND email_body IS NOT NULL))
  `),
  // Check constraint: sms notifications must have smsContent
  check("check_sms_notification_content", sql`
    (notification_type != 'sms' OR sms_content IS NOT NULL)
  `),
  // Check constraint: push notifications must have pushTitle and pushBody
  check("check_push_notification_content", sql`
    (notification_type != 'push' OR (push_title IS NOT NULL AND push_body IS NOT NULL))
  `),
]);

// Client request reminders table - reminder configurations for client request templates
export const clientRequestReminders = pgTable("client_request_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectTypeNotificationId: varchar("project_type_notification_id").notNull().references(() => projectTypeNotifications.id, { onDelete: "cascade" }), // Parent notification that created the client request
  
  notificationType: notificationTypeEnum("notification_type").notNull(), // 'email', 'sms', or 'push'
  daysAfterCreation: integer("days_after_creation").notNull(), // Days after client request was created
  
  // Notification content
  emailTitle: varchar("email_title"), // Email subject (for email type only)
  emailBody: text("email_body"), // Email body - rich text HTML (for email type only)
  smsContent: varchar("sms_content", { length: 160 }), // SMS message - 160 char limit (for sms type only)
  pushTitle: varchar("push_title", { length: 50 }), // Push notification title - 50 char limit (for push type only)
  pushBody: varchar("push_body", { length: 120 }), // Push notification body - 120 char limit (for push type only)
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_request_reminders_notification_id").on(table.projectTypeNotificationId),
  // Check constraint: email reminders must have emailTitle and emailBody
  check("check_email_reminder_content", sql`
    (notification_type != 'email' OR (email_title IS NOT NULL AND email_body IS NOT NULL))
  `),
  // Check constraint: sms reminders must have smsContent
  check("check_sms_reminder_content", sql`
    (notification_type != 'sms' OR sms_content IS NOT NULL)
  `),
  // Check constraint: push reminders must have pushTitle and pushBody
  check("check_push_reminder_content", sql`
    (notification_type != 'push' OR (push_title IS NOT NULL AND push_body IS NOT NULL))
  `),
]);

// Scheduled notifications table - actual notification instances ready to be sent
export const scheduledNotifications = pgTable("scheduled_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links to source configuration
  projectTypeNotificationId: varchar("project_type_notification_id").references(() => projectTypeNotifications.id, { onDelete: "cascade" }), // For project/stage notifications
  clientRequestReminderId: varchar("client_request_reminder_id").references(() => clientRequestReminders.id, { onDelete: "cascade" }), // For client request reminders
  
  // Recipient information
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  personId: varchar("person_id").references(() => people.id, { onDelete: "cascade" }), // Specific person to notify (if applicable)
  clientServiceId: varchar("client_service_id").references(() => clientServices.id, { onDelete: "cascade" }), // Related client service
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }), // Related project (for stage notifications)
  taskInstanceId: varchar("task_instance_id").references(() => taskInstances.id, { onDelete: "cascade" }), // Related task instance (for client request reminders)
  
  // Notification details
  notificationType: notificationTypeEnum("notification_type").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(), // When to send the notification
  dateReference: dateReferenceEnum("date_reference"), // 'start_date' or 'due_date' (nullable - only for project notifications)
  
  // Content (copied from template at scheduling time for immutability)
  emailTitle: varchar("email_title"),
  emailBody: text("email_body"),
  smsContent: varchar("sms_content", { length: 160 }),
  pushTitle: varchar("push_title", { length: 50 }),
  pushBody: varchar("push_body", { length: 120 }),
  
  // Status tracking
  status: notificationStatusEnum("status").notNull().default("scheduled"),
  sentAt: timestamp("sent_at"),
  failureReason: text("failure_reason"),
  cancelledBy: varchar("cancelled_by").references(() => users.id, { onDelete: "set null" }), // Staff user who cancelled it
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  
  // Reminder control for client request reminders
  stopReminders: boolean("stop_reminders").default(false), // Staff can flag to stop further reminders
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_scheduled_notifications_project_type_notification_id").on(table.projectTypeNotificationId),
  index("idx_scheduled_notifications_client_request_reminder_id").on(table.clientRequestReminderId),
  index("idx_scheduled_notifications_client_id").on(table.clientId),
  index("idx_scheduled_notifications_person_id").on(table.personId),
  index("idx_scheduled_notifications_client_service_id").on(table.clientServiceId),
  index("idx_scheduled_notifications_project_id").on(table.projectId),
  index("idx_scheduled_notifications_task_instance_id").on(table.taskInstanceId),
  index("idx_scheduled_notifications_scheduled_for").on(table.scheduledFor),
  index("idx_scheduled_notifications_status").on(table.status),
  // Composite indexes for notification tabs performance
  // Active/Do Not Send tabs: client + status + scheduledFor DESC (covers WHERE client_id=X AND status=Y ORDER BY scheduled_for DESC)
  index("idx_scheduled_notifications_client_status_scheduled").on(table.clientId, table.status, table.scheduledFor),
  // Sent Notifications tab: client + status + sentAt DESC (covers WHERE client_id=X AND status='sent' ORDER BY sent_at DESC)
  index("idx_scheduled_notifications_client_status_sent").on(table.clientId, table.status, table.sentAt),
  // Check constraint: must have either projectTypeNotificationId OR clientRequestReminderId
  check("check_notification_source", sql`
    (project_type_notification_id IS NOT NULL AND client_request_reminder_id IS NULL) OR
    (project_type_notification_id IS NULL AND client_request_reminder_id IS NOT NULL)
  `),
]);

// Notification history table - audit log of all sent notifications
export const notificationHistory = pgTable("notification_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduledNotificationId: varchar("scheduled_notification_id").references(() => scheduledNotifications.id, { onDelete: "set null" }),
  
  // Recipient details (denormalized for audit trail)
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  recipientEmail: varchar("recipient_email"),
  recipientPhone: varchar("recipient_phone"),
  
  // Notification details
  notificationType: notificationTypeEnum("notification_type").notNull(),
  content: text("content").notNull(), // The actual content that was sent
  
  // Status
  status: notificationStatusEnum("status").notNull(), // 'sent' or 'failed'
  sentAt: timestamp("sent_at"),
  failureReason: text("failure_reason"),
  
  // Metadata
  externalId: varchar("external_id"), // ID from external service (SendGrid message ID, VoodooSMS ID, etc.)
  metadata: jsonb("metadata"), // Additional tracking data
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notification_history_scheduled_notification_id").on(table.scheduledNotificationId),
  index("idx_notification_history_client_id").on(table.clientId),
  index("idx_notification_history_sent_at").on(table.sentAt),
  index("idx_notification_history_status").on(table.status),
  index("idx_notification_history_notification_type").on(table.notificationType),
]);

// Zod schemas for risk assessments
export const insertRiskAssessmentSchema = createInsertSchema(riskAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Allow both Date objects and ISO strings for timestamp fields
  initialDate: z.union([z.date(), z.string().transform((val) => new Date(val))]),
  reviewDate: z.union([z.date(), z.string().transform((val) => new Date(val))]).optional().nullable(),
  furtherRisksInitialDate: z.union([z.date(), z.string().transform((val) => new Date(val))]).optional().nullable(),
  mloReviewDate: z.union([z.date(), z.string().transform((val) => new Date(val))]).optional().nullable(),
});

export const updateRiskAssessmentSchema = insertRiskAssessmentSchema.partial();

export const insertRiskAssessmentResponseSchema = createInsertSchema(riskAssessmentResponses).omit({
  id: true,
  createdAt: true,
});

// Zod schemas for client request templates
export const insertClientRequestTemplateCategorySchema = createInsertSchema(clientRequestTemplateCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientRequestTemplateCategorySchema = insertClientRequestTemplateCategorySchema.partial();

export const insertClientRequestTemplateSchema = createInsertSchema(clientRequestTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientRequestTemplateSchema = insertClientRequestTemplateSchema.partial();

export const insertClientRequestTemplateSectionSchema = createInsertSchema(clientRequestTemplateSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientRequestTemplateSectionSchema = insertClientRequestTemplateSectionSchema.partial();

export const insertClientRequestTemplateQuestionSchema = createInsertSchema(clientRequestTemplateQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientRequestTemplateQuestionSchema = insertClientRequestTemplateQuestionSchema.partial();

const baseTaskInstanceSchema = createInsertSchema(taskInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  approvedAt: true,
}).extend({
  dueDate: z.union([z.string(), z.date()]).optional().nullable().transform(val => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
});

export const insertTaskInstanceSchema = baseTaskInstanceSchema.refine(
  (data) => (data.templateId !== null && data.customRequestId === null) || (data.templateId === null && data.customRequestId !== null),
  { message: "Either templateId or customRequestId must be provided, but not both" }
);

export const updateTaskInstanceSchema = baseTaskInstanceSchema.partial();

export const updateTaskInstanceStatusSchema = z.object({
  status: z.enum(["not_started", "in_progress", "submitted", "approved", "cancelled"]),
});

export const insertTaskInstanceResponseSchema = createInsertSchema(taskInstanceResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Zod schemas for client custom requests
export const insertClientCustomRequestSchema = createInsertSchema(clientCustomRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientCustomRequestSchema = insertClientCustomRequestSchema.partial();

export const insertClientCustomRequestSectionSchema = createInsertSchema(clientCustomRequestSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientCustomRequestSectionSchema = insertClientCustomRequestSectionSchema.partial();

export const insertClientCustomRequestQuestionSchema = createInsertSchema(clientCustomRequestQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientCustomRequestQuestionSchema = insertClientCustomRequestQuestionSchema.partial();

// Zod schemas for internal tasks
export const insertTaskTypeSchema = createInsertSchema(taskTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTaskTypeSchema = insertTaskTypeSchema.partial();

export const insertInternalTaskSchema = createInsertSchema(internalTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
  closedBy: true,
  totalTimeSpentMinutes: true,
}).extend({
  dueDate: z.union([z.string(), z.date()]).optional().nullable().transform(val => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
});

export const updateInternalTaskSchema = insertInternalTaskSchema.partial();

export const closeInternalTaskSchema = z.object({
  closureNote: z.string().min(1, "Closure note is required"),
  totalTimeSpentMinutes: z.number().int().min(0, "Time spent must be a positive number"),
});

export const insertTaskConnectionSchema = createInsertSchema(taskConnections).omit({
  id: true,
  createdAt: true,
});

export const insertTaskProgressNoteSchema = createInsertSchema(taskProgressNotes).omit({
  id: true,
  createdAt: true,
});

export const insertTaskTimeEntrySchema = createInsertSchema(taskTimeEntries).omit({
  id: true,
  createdAt: true,
  durationMinutes: true,
}).extend({
  startTime: z.union([z.string(), z.date()]).transform(val => {
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
  endTime: z.union([z.string(), z.date()]).optional().nullable().transform(val => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    return val;
  }),
});

export const stopTaskTimeEntrySchema = z.object({
  note: z.string().optional(),
});

export const insertTaskDocumentSchema = createInsertSchema(taskDocuments).omit({
  id: true,
  createdAt: true,
});

// Zod schemas for notification system
export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCompanySettingsSchema = insertCompanySettingsSchema.partial();

export const insertProjectTypeNotificationSchema = createInsertSchema(projectTypeNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProjectTypeNotificationSchema = insertProjectTypeNotificationSchema.partial();

export const insertClientRequestReminderSchema = createInsertSchema(clientRequestReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateClientRequestReminderSchema = insertClientRequestReminderSchema.partial();

export const insertScheduledNotificationSchema = createInsertSchema(scheduledNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
});

export const updateScheduledNotificationSchema = insertScheduledNotificationSchema.partial();

export const insertNotificationHistorySchema = createInsertSchema(notificationHistory).omit({
  id: true,
  createdAt: true,
});

export const bulkReassignTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()),
  assignedTo: z.string().uuid(),
});

export const bulkUpdateTaskStatusSchema = z.object({
  taskIds: z.array(z.string().uuid()),
  status: z.enum(["open", "in_progress", "closed"]),
});

// Type exports
export type Communication = typeof communications.$inferSelect;
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;
export type ClientPortalUser = typeof clientPortalUsers.$inferSelect;
export type InsertClientPortalUser = z.infer<typeof insertClientPortalUserSchema>;
export type MessageThread = typeof messageThreads.$inferSelect;
export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ProjectMessageThread = typeof projectMessageThreads.$inferSelect;
export type InsertProjectMessageThread = z.infer<typeof insertProjectMessageThreadSchema>;
export type ProjectMessage = typeof projectMessages.$inferSelect;
export type InsertProjectMessage = z.infer<typeof insertProjectMessageSchema>;
export type ProjectMessageParticipant = typeof projectMessageParticipants.$inferSelect;
export type InsertProjectMessageParticipant = z.infer<typeof insertProjectMessageParticipantSchema>;
export type StaffMessageThread = typeof staffMessageThreads.$inferSelect;
export type InsertStaffMessageThread = z.infer<typeof insertStaffMessageThreadSchema>;
export type StaffMessage = typeof staffMessages.$inferSelect;
export type InsertStaffMessage = z.infer<typeof insertStaffMessageSchema>;
export type StaffMessageParticipant = typeof staffMessageParticipants.$inferSelect;
export type InsertStaffMessageParticipant = z.infer<typeof insertStaffMessageParticipantSchema>;
export type UserIntegration = typeof userIntegrations.$inferSelect;
export type InsertUserIntegration = z.infer<typeof insertUserIntegrationSchema>;
export type UserActivityTracking = typeof userActivityTracking.$inferSelect;
export type InsertUserActivityTracking = z.infer<typeof insertUserActivityTrackingSchema>;
export type UserOauthAccount = typeof userOauthAccounts.$inferSelect;
export type InsertUserOauthAccount = z.infer<typeof insertUserOauthAccountSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushNotificationTemplate = typeof pushNotificationTemplates.$inferSelect;
export type InsertPushNotificationTemplate = z.infer<typeof insertPushNotificationTemplateSchema>;
export type NotificationIcon = typeof notificationIcons.$inferSelect;
export type InsertNotificationIcon = z.infer<typeof insertNotificationIconSchema>;
export type DocumentFolder = typeof documentFolders.$inferSelect;
export type InsertDocumentFolder = z.infer<typeof insertDocumentFolderSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type SignatureRequest = typeof signatureRequests.$inferSelect;
export type InsertSignatureRequest = z.infer<typeof insertSignatureRequestSchema>;
export type SignatureField = typeof signatureFields.$inferSelect;
export type InsertSignatureField = z.infer<typeof insertSignatureFieldSchema>;
export type SignatureRequestRecipient = typeof signatureRequestRecipients.$inferSelect;
export type InsertSignatureRequestRecipient = z.infer<typeof insertSignatureRequestRecipientSchema>;
export type Signature = typeof signatures.$inferSelect;
export type InsertSignature = z.infer<typeof insertSignatureSchema>;
export type SignatureAuditLog = typeof signatureAuditLogs.$inferSelect;
export type InsertSignatureAuditLog = z.infer<typeof insertSignatureAuditLogSchema>;
export type SignedDocument = typeof signedDocuments.$inferSelect;
export type InsertSignedDocument = z.infer<typeof insertSignedDocumentSchema>;
export type RiskAssessment = typeof riskAssessments.$inferSelect;
export type InsertRiskAssessment = z.infer<typeof insertRiskAssessmentSchema>;
export type UpdateRiskAssessment = z.infer<typeof updateRiskAssessmentSchema>;
export type RiskAssessmentResponse = typeof riskAssessmentResponses.$inferSelect;
export type InsertRiskAssessmentResponse = z.infer<typeof insertRiskAssessmentResponseSchema>;
export type ClientRequestTemplateCategory = typeof clientRequestTemplateCategories.$inferSelect;
export type InsertClientRequestTemplateCategory = z.infer<typeof insertClientRequestTemplateCategorySchema>;
export type UpdateClientRequestTemplateCategory = z.infer<typeof updateClientRequestTemplateCategorySchema>;
export type ClientRequestTemplate = typeof clientRequestTemplates.$inferSelect;
export type InsertClientRequestTemplate = z.infer<typeof insertClientRequestTemplateSchema>;
export type UpdateClientRequestTemplate = z.infer<typeof updateClientRequestTemplateSchema>;
export type ClientRequestTemplateSection = typeof clientRequestTemplateSections.$inferSelect;
export type InsertClientRequestTemplateSection = z.infer<typeof insertClientRequestTemplateSectionSchema>;
export type UpdateClientRequestTemplateSection = z.infer<typeof updateClientRequestTemplateSectionSchema>;
export type ClientRequestTemplateQuestion = typeof clientRequestTemplateQuestions.$inferSelect;
export type InsertClientRequestTemplateQuestion = z.infer<typeof insertClientRequestTemplateQuestionSchema>;
export type UpdateClientRequestTemplateQuestion = z.infer<typeof updateClientRequestTemplateQuestionSchema>;
export type TaskInstance = typeof taskInstances.$inferSelect;
export type InsertTaskInstance = z.infer<typeof insertTaskInstanceSchema>;
export type UpdateTaskInstance = z.infer<typeof updateTaskInstanceSchema>;
export type TaskInstanceResponse = typeof taskInstanceResponses.$inferSelect;
export type InsertTaskInstanceResponse = z.infer<typeof insertTaskInstanceResponseSchema>;
export type ClientCustomRequest = typeof clientCustomRequests.$inferSelect;
export type InsertClientCustomRequest = z.infer<typeof insertClientCustomRequestSchema>;
export type UpdateClientCustomRequest = z.infer<typeof updateClientCustomRequestSchema>;
export type ClientCustomRequestSection = typeof clientCustomRequestSections.$inferSelect;
export type InsertClientCustomRequestSection = z.infer<typeof insertClientCustomRequestSectionSchema>;
export type UpdateClientCustomRequestSection = z.infer<typeof updateClientCustomRequestSectionSchema>;
export type ClientCustomRequestQuestion = typeof clientCustomRequestQuestions.$inferSelect;
export type InsertClientCustomRequestQuestion = z.infer<typeof insertClientCustomRequestQuestionSchema>;
export type UpdateClientCustomRequestQuestion = z.infer<typeof updateClientCustomRequestQuestionSchema>;
export type TaskType = typeof taskTypes.$inferSelect;
export type InsertTaskType = z.infer<typeof insertTaskTypeSchema>;
export type UpdateTaskType = z.infer<typeof updateTaskTypeSchema>;
export type InternalTask = typeof internalTasks.$inferSelect;
export type InsertInternalTask = z.infer<typeof insertInternalTaskSchema>;
export type UpdateInternalTask = z.infer<typeof updateInternalTaskSchema>;
export type CloseInternalTask = z.infer<typeof closeInternalTaskSchema>;
export type TaskConnection = typeof taskConnections.$inferSelect;
export type InsertTaskConnection = z.infer<typeof insertTaskConnectionSchema>;
export type TaskProgressNote = typeof taskProgressNotes.$inferSelect;
export type InsertTaskProgressNote = z.infer<typeof insertTaskProgressNoteSchema>;
export type TaskTimeEntry = typeof taskTimeEntries.$inferSelect;
export type InsertTaskTimeEntry = z.infer<typeof insertTaskTimeEntrySchema>;
export type StopTaskTimeEntry = z.infer<typeof stopTaskTimeEntrySchema>;
export type TaskDocument = typeof taskDocuments.$inferSelect;
export type InsertTaskDocument = z.infer<typeof insertTaskDocumentSchema>;
export type BulkReassignTasks = z.infer<typeof bulkReassignTasksSchema>;
export type BulkUpdateTaskStatus = z.infer<typeof bulkUpdateTaskStatusSchema>;

// Notification system type exports
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type UpdateCompanySettings = z.infer<typeof updateCompanySettingsSchema>;
export type ProjectTypeNotification = typeof projectTypeNotifications.$inferSelect;
export type InsertProjectTypeNotification = z.infer<typeof insertProjectTypeNotificationSchema>;
export type UpdateProjectTypeNotification = z.infer<typeof updateProjectTypeNotificationSchema>;
export type ClientRequestReminder = typeof clientRequestReminders.$inferSelect;
export type InsertClientRequestReminder = z.infer<typeof insertClientRequestReminderSchema>;
export type UpdateClientRequestReminder = z.infer<typeof updateClientRequestReminderSchema>;
export type ScheduledNotification = typeof scheduledNotifications.$inferSelect;
export type InsertScheduledNotification = z.infer<typeof insertScheduledNotificationSchema>;
export type UpdateScheduledNotification = z.infer<typeof updateScheduledNotificationSchema>;
export type NotificationHistory = typeof notificationHistory.$inferSelect;
export type InsertNotificationHistory = z.infer<typeof insertNotificationHistorySchema>;

// Email threading type exports
export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type MailboxMessageMap = typeof mailboxMessageMap.$inferSelect;
export type InsertMailboxMessageMap = z.infer<typeof insertMailboxMessageMapSchema>;
export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;
export type UnmatchedEmail = typeof unmatchedEmails.$inferSelect;
export type InsertUnmatchedEmail = z.infer<typeof insertUnmatchedEmailSchema>;
export type ClientEmailAlias = typeof clientEmailAliases.$inferSelect;
export type InsertClientEmailAlias = z.infer<typeof insertClientEmailAliasSchema>;
export type ClientDomainAllowlist = typeof clientDomainAllowlist.$inferSelect;
export type InsertClientDomainAllowlist = z.infer<typeof insertClientDomainAllowlistSchema>;
export type EmailAttachment = typeof emailAttachments.$inferSelect;
export type InsertEmailAttachment = z.infer<typeof insertEmailAttachmentSchema>;
export type EmailMessageAttachment = typeof emailMessageAttachments.$inferSelect;
export type InsertEmailMessageAttachment = z.infer<typeof insertEmailMessageAttachmentSchema>;
export type GraphWebhookSubscription = typeof graphWebhookSubscriptions.$inferSelect;
export type InsertGraphWebhookSubscription = z.infer<typeof insertGraphWebhookSubscriptionSchema>;
export type GraphSyncState = typeof graphSyncState.$inferSelect;
export type InsertGraphSyncState = z.infer<typeof insertGraphSyncStateSchema>;

// Extended types with relations
export type ProjectWithRelations = Project & {
  client: Client;
  bookkeeper: User;
  clientManager: User;
  currentAssignee?: User;
  projectOwner?: User;
  projectType: ProjectType & {
    service?: Service;
  };
  chronology: (ProjectChronology & { 
    assignee?: User;
    changedBy?: User;
    fieldResponses: (ReasonFieldResponse & { customField: ReasonCustomField })[];
  })[];
  stageApprovalResponses?: (StageApprovalResponse & { 
    field: StageApprovalField;
  })[];
  progressMetrics?: {
    reasonId: string;
    label: string;
    total: number;
  }[];
  stageRoleAssignee?: User; // The user assigned to the role for the current stage
};

// Notification preview candidate schemas
export const previewCandidateRecipientSchema = z.object({
  personId: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  canPreview: z.boolean(),
  ineligibleReason: z.string().optional(),
});

export const previewCandidateSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  projectId: z.string(),
  projectName: z.string().nullable(),
  projectDescription: z.string().nullable(),
  stageId: z.string().nullable(),
  stageName: z.string().nullable(),
  dueDate: z.date().nullable(),
  clientServiceId: z.string(),
  clientServiceName: z.string(),
  frequency: z.string().nullable(),
  recipients: z.array(previewCandidateRecipientSchema),
});

export const previewCandidatesResponseSchema = z.object({
  candidates: z.array(previewCandidateSchema),
  hasEligibleCandidates: z.boolean(),
  message: z.string().optional(),
});

export type PreviewCandidateRecipient = z.infer<typeof previewCandidateRecipientSchema>;
export type PreviewCandidate = z.infer<typeof previewCandidateSchema>;
export type PreviewCandidatesResponse = z.infer<typeof previewCandidatesResponseSchema>;

// Stage change notification preview schemas
export const stageChangeNotificationRecipientSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
});

export const stageChangeNotificationPreviewSchema = z.object({
  projectId: z.string(),
  newStageName: z.string(),
  oldStageName: z.string().optional(),
  dedupeKey: z.string(),  // Composite key for preventing duplicate sends
  recipients: z.array(stageChangeNotificationRecipientSchema),
  emailSubject: z.string(),  // Pre-rendered email subject
  emailBody: z.string(),     // Pre-rendered email body (HTML)
  pushTitle: z.string().nullable(),  // Pre-rendered push title
  pushBody: z.string().nullable(),   // Pre-rendered push body
  metadata: z.object({
    projectName: z.string(),
    clientName: z.string(),
    dueDate: z.string().optional(),
    changeReason: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const sendStageChangeNotificationSchema = z.object({
  projectId: z.string(),
  dedupeKey: z.string(),
  emailSubject: z.string(),
  emailBody: z.string(),
  pushTitle: z.string().nullable(),
  pushBody: z.string().nullable(),
  suppress: z.boolean().default(false),  // If true, don't send but mark as suppressed
});

export type StageChangeNotificationRecipient = z.infer<typeof stageChangeNotificationRecipientSchema>;
export type StageChangeNotificationPreview = z.infer<typeof stageChangeNotificationPreviewSchema>;
export type SendStageChangeNotification = z.infer<typeof sendStageChangeNotificationSchema>;
