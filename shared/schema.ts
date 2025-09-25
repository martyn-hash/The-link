import { sql, relations } from 'drizzle-orm';
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
  alias,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
export const customFieldTypeEnum = pgEnum("custom_field_type", ["number", "short_text", "long_text", "multi_select"]);

// Stage approval field type enum
export const stageApprovalFieldTypeEnum = pgEnum("stage_approval_field_type", ["boolean", "number", "long_text", "multi_select"]);

// Comparison type enum for number fields in stage approvals
export const comparisonTypeEnum = pgEnum("comparison_type", ["equal_to", "less_than", "greater_than"]);

// UDF type enum for services
export const udfTypeEnum = pgEnum("udf_type", ["number", "date", "boolean", "short_text"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false), // Simple admin flag
  canSeeAdminMenu: boolean("can_see_admin_menu").default(false), // Can see admin menu flag
  passwordHash: varchar("password_hash"), // Hashed password, nullable for OAuth-only users
  isFallbackUser: boolean("is_fallback_user").default(false), // Only one user can be the fallback user
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  id: text("id").primaryKey(), // Existing field - uses text, not varchar
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
  projectMonth: varchar("project_month"), // DD/MM/YYYY format to track which month each project belongs to
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_projects_project_owner_id").on(table.projectOwnerId),
]);

// Project chronology table
export const projectChronology = pgTable("project_chronology", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status").notNull(),
  assigneeId: varchar("assignee_id").references(() => users.id),
  changeReason: varchar("change_reason"),
  notes: text("notes"),
  timestamp: timestamp("timestamp").defaultNow(),
  timeInPreviousStage: integer("time_in_previous_stage"), // in minutes
  businessHoursInPreviousStage: integer("business_hours_in_previous_stage"), // in business minutes (for precision)
});

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
  fieldId: varchar("field_id").notNull().references(() => stageApprovalFields.id, { onDelete: "restrict" }),
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
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_change_reasons_project_type_id").on(table.projectTypeId),
  // Reason must be unique within a project type
  // unique("unique_reason_per_project_type").on(table.projectTypeId, table.reason), // Temporarily commented to unblock people table changes
]);

// Project types configuration table (renamed from project descriptions)
export const projectTypes = pgTable("project_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(), // project type name (e.g. "Monthly Bookkeeping", "Payroll")
  description: text("description"), // optional description of the project type
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }), // Optional reference to service for role inheritance
  active: boolean("active").default(true), // to enable/disable project types
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
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  udfDefinitions: jsonb("udf_definitions").default(sql`'[]'::jsonb`), // Array of UDF definitions
  // Companies House connection fields
  isCompaniesHouseConnected: boolean("is_companies_house_connected").default(false),
  chStartDateField: varchar("ch_start_date_field"), // Maps to client field for start date (e.g., 'next_accounts_period_end')
  chDueDateField: varchar("ch_due_date_field"), // Maps to client field for due date (e.g., 'next_accounts_due')
  // Personal service flag - if true, this service is for individuals, not clients/companies
  isPersonalService: boolean("is_personal_service").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Client services table - links clients to services
export const clientServices = pgTable("client_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  serviceOwnerId: varchar("service_owner_id").references(() => users.id, { onDelete: "set null" }), // Service owner assigned for this client-service mapping
  frequency: varchar("frequency").notNull().default("monthly"), // monthly, quarterly, annually, etc.
  nextStartDate: timestamp("next_start_date"), // Next scheduled start date for the service
  nextDueDate: timestamp("next_due_date"), // Next due date for the service
  isActive: boolean("is_active").default(true), // Whether this service is active for scheduling
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_client_services_client_id").on(table.clientId),
  index("idx_client_services_service_id").on(table.serviceId),
  index("idx_client_services_service_owner_id").on(table.serviceOwnerId),
  index("idx_client_services_next_due_date").on(table.nextDueDate), // Index for scheduling queries
  unique("unique_client_service").on(table.clientId, table.serviceId),
]);

// People services table - links people to personal services
export const peopleServices = pgTable("people_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  serviceOwnerId: varchar("service_owner_id").references(() => users.id, { onDelete: "set null" }), // Service owner assigned for this person-service mapping
  notes: text("notes"), // Specific notes for this person's service
  isActive: boolean("is_active").default(true), // Whether this service is active for scheduling
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_people_services_person_id").on(table.personId),
  index("idx_people_services_service_id").on(table.serviceId),
  index("idx_people_services_service_owner_id").on(table.serviceOwnerId),
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
  chronologyEntries: many(projectChronology),
  magicLinkTokens: many(magicLinkTokens),
  notificationPreferences: one(userNotificationPreferences),
  clientServiceRoleAssignments: many(clientServiceRoleAssignments),
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
}));

export const projectChronologyRelations = relations(projectChronology, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectChronology.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [projectChronology.assigneeId],
    references: [users.id],
  }),
  fieldResponses: many(reasonFieldResponses),
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMagicLinkTokenSchema = createInsertSchema(magicLinkTokens).omit({
  id: true,
  createdAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

// Zod validation schemas for NI and UTR numbers
const niNumberRegex = /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D]{1}$/;
const personalUtrRegex = /^[0-9]{10}$/;

export const insertPersonSchema = createInsertSchema(people).omit({
  id: true,
  createdAt: true,
}).extend({
  // Add validation for new fields
  niNumber: z.string().regex(niNumberRegex, "Invalid National Insurance number format").optional().or(z.literal("")),
  personalUtrNumber: z.string().regex(personalUtrRegex, "Personal UTR must be 10 digits").optional().or(z.literal("")),
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
  frequency: z.enum(["monthly", "quarterly", "annually", "weekly", "daily"]).default("monthly"),
  nextStartDate: z.string().datetime().optional(),
  nextDueDate: z.string().datetime().optional(),
});

export const updateClientServiceSchema = insertClientServiceSchema.partial();

// People services schema
export const insertPeopleServiceSchema = createInsertSchema(peopleServices).omit({
  id: true,
  createdAt: true,
});

export const updatePeopleServiceSchema = insertPeopleServiceSchema.partial();

// Client service role assignments schema
export const insertClientServiceRoleAssignmentSchema = createInsertSchema(clientServiceRoleAssignments).omit({
  id: true,
  createdAt: true,
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
export type User = typeof users.$inferSelect;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type InsertMagicLinkToken = z.infer<typeof insertMagicLinkTokenSchema>;
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

// Extended types with relations
export type ProjectWithRelations = Project & {
  client: Client;
  bookkeeper: User;
  clientManager: User;
  currentAssignee?: User;
  chronology: (ProjectChronology & { 
    assignee?: User; 
    fieldResponses: (ReasonFieldResponse & { customField: ReasonCustomField })[];
  })[];
  progressMetrics?: {
    reasonId: string;
    label: string;
    total: number;
  }[];
};
