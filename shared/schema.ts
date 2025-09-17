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

// User roles enum
export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "client_manager", "bookkeeper"]);

// Project status enum
export const projectStatusEnum = pgEnum("project_status", [
  "no_latest_action",
  "bookkeeping_work_required", 
  "in_review",
  "needs_client_input",
  "completed"
]);

// Change reason enum
export const changeReasonEnum = pgEnum("change_reason", [
  "errors_identified_from_bookkeeper",
  "first_allocation_of_work",
  "queries_answered", 
  "work_completed_successfully",
  "clarifications_needed"
]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").notNull().default("bookkeeper"),
  passwordHash: varchar("password_hash"), // Hashed password, nullable for OAuth-only users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Clients table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  email: varchar("email"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Projects table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  bookkeeperId: varchar("bookkeeper_id").notNull().references(() => users.id),
  clientManagerId: varchar("client_manager_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  currentStatus: varchar("current_status").notNull().default("No Latest Action"),
  currentAssigneeId: varchar("current_assignee_id").references(() => users.id),
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project chronology table
export const projectChronology = pgTable("project_chronology", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status").notNull(),
  assigneeId: varchar("assignee_id").references(() => users.id),
  changeReason: changeReasonEnum("change_reason"),
  notes: text("notes"),
  timestamp: timestamp("timestamp").defaultNow(),
  timeInPreviousStage: integer("time_in_previous_stage"), // in minutes
});

// Kanban stages configuration table
export const kanbanStages = pgTable("kanban_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  assignedRole: userRoleEnum("assigned_role"),
  order: integer("order").notNull(),
  color: varchar("color").default("#6b7280"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Change reasons configuration table
export const changeReasons = pgTable("change_reasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reason: changeReasonEnum("reason").notNull().unique(),
  description: varchar("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  assignedProjects: many(projects, { relationName: "assignee" }),
  bookkeepingProjects: many(projects, { relationName: "bookkeeper" }),
  managedProjects: many(projects, { relationName: "clientManager" }),
  chronologyEntries: many(projectChronology),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
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
  currentAssignee: one(users, {
    fields: [projects.currentAssigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  chronology: many(projectChronology),
}));

export const projectChronologyRelations = relations(projectChronology, ({ one }) => ({
  project: one(projects, {
    fields: [projectChronology.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [projectChronology.assigneeId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectChronologySchema = createInsertSchema(projectChronology).omit({
  id: true,
  timestamp: true,
});

export const insertKanbanStageSchema = createInsertSchema(kanbanStages).omit({
  id: true,
  createdAt: true,
});

export const insertChangeReasonSchema = createInsertSchema(changeReasons).omit({
  id: true,
  createdAt: true,
});

// Project update schema  
export const updateProjectStatusSchema = z.object({
  projectId: z.string(),
  newStatus: z.string(), // Now accepts any kanban stage name
  changeReason: z.enum(["errors_identified_from_bookkeeper", "first_allocation_of_work", "queries_answered", "work_completed_successfully", "clarifications_needed"]),
  notes: z.string().optional(),
});

// CSV upload schema
export const csvProjectSchema = z.object({
  clientName: z.string().min(1),
  projectDescription: z.string().min(1),
  bookkeeperEmail: z.string().email(),
  clientManagerEmail: z.string().email(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  dueDate: z.string().optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectChronology = typeof projectChronology.$inferSelect;
export type InsertProjectChronology = z.infer<typeof insertProjectChronologySchema>;
export type KanbanStage = typeof kanbanStages.$inferSelect;
export type InsertKanbanStage = z.infer<typeof insertKanbanStageSchema>;
export type ChangeReason = typeof changeReasons.$inferSelect;
export type InsertChangeReason = z.infer<typeof insertChangeReasonSchema>;
export type UpdateProjectStatus = z.infer<typeof updateProjectStatusSchema>;
export type CSVProject = z.infer<typeof csvProjectSchema>;

// Extended types with relations
export type ProjectWithRelations = Project & {
  client: Client;
  bookkeeper: User;
  clientManager: User;
  currentAssignee?: User;
  chronology: (ProjectChronology & { assignee?: User })[];
};
