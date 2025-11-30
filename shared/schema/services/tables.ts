import { pgTable, varchar, text, boolean, integer, timestamp, index, unique, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { inactiveReasonEnum } from "../enums";

import { users } from "../users/tables";
import { clients, people } from "../clients/tables";
import { projectTypes } from "../projects/base";

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  projectTypeId: varchar("project_type_id").references(() => projectTypes.id),
  udfDefinitions: jsonb("udf_definitions").default(sql`'[]'::jsonb`),
  isCompaniesHouseConnected: boolean("is_companies_house_connected").default(false),
  chStartDateField: varchar("ch_start_date_field"),
  chDueDateField: varchar("ch_due_date_field"),
  isPersonalService: boolean("is_personal_service").default(false),
  isStaticService: boolean("is_static_service").default(false),
  isVatService: boolean("is_vat_service").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientServices = pgTable("client_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  serviceOwnerId: varchar("service_owner_id").references(() => users.id, { onDelete: "set null" }),
  frequency: varchar("frequency"),
  nextStartDate: timestamp("next_start_date"),
  nextDueDate: timestamp("next_due_date"),
  intendedStartDay: integer("intended_start_day"),
  intendedDueDay: integer("intended_due_day"),
  isActive: boolean("is_active").default(true),
  inactiveReason: inactiveReasonEnum("inactive_reason"),
  inactiveAt: timestamp("inactive_at"),
  inactiveByUserId: varchar("inactive_by_user_id").references(() => users.id, { onDelete: "set null" }),
  udfValues: jsonb("udf_values").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_client_services_client_id").on(table.clientId),
  index("idx_client_services_service_id").on(table.serviceId),
  index("idx_client_services_service_owner_id").on(table.serviceOwnerId),
  index("idx_client_services_next_due_date").on(table.nextDueDate),
  index("idx_client_services_inactive_by_user_id").on(table.inactiveByUserId),
  unique("unique_client_service").on(table.clientId, table.serviceId),
]);

export const peopleServices = pgTable("people_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  serviceOwnerId: varchar("service_owner_id").references(() => users.id, { onDelete: "set null" }),
  frequency: varchar("frequency").notNull().default("monthly"),
  nextStartDate: timestamp("next_start_date"),
  nextDueDate: timestamp("next_due_date"),
  intendedStartDay: integer("intended_start_day"),
  intendedDueDay: integer("intended_due_day"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_people_services_person_id").on(table.personId),
  index("idx_people_services_service_id").on(table.serviceId),
  index("idx_people_services_service_owner_id").on(table.serviceOwnerId),
  index("idx_people_services_next_due_date").on(table.nextDueDate),
  unique("unique_person_service").on(table.personId, table.serviceId),
]);

export const workRoles = pgTable("work_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
]);

export const serviceAssignmentViews = pgTable("service_assignment_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  filters: jsonb("filters").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_service_assignment_views_user_id").on(table.userId),
]);

export const chChangeRequests = pgTable("ch_change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  changeType: varchar("change_type").notNull(),
  fieldName: varchar("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  status: varchar("status").default("pending"),
  detectedAt: timestamp("detected_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ch_change_requests_client_id").on(table.clientId),
  index("idx_ch_change_requests_status").on(table.status),
  index("idx_ch_change_requests_change_type").on(table.changeType),
]);
