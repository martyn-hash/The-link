import {
  users,
  clients,
  projects,
  projectChronology,
  kanbanStages,
  changeReasons,
  type User,
  type UpsertUser,
  type InsertUser,
  type Client,
  type InsertClient,
  type Project,
  type InsertProject,
  type ProjectChronology,
  type InsertProjectChronology,
  type KanbanStage,
  type InsertKanbanStage,
  type ChangeReason,
  type InsertChangeReason,
  type ProjectWithRelations,
  type UpdateProjectStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, userData: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // Atomic admin creation (for bootstrap)
  createAdminIfNone(user: InsertUser): Promise<{ success: boolean; user?: User; error?: string }>;
  
  // User impersonation operations (for admin testing)
  startImpersonation(adminUserId: string, targetUserId: string): Promise<void>;
  stopImpersonation(adminUserId: string): Promise<void>;
  getImpersonationState(adminUserId: string): Promise<{ isImpersonating: boolean; originalUserId?: string; impersonatedUserId?: string }>;
  getEffectiveUser(adminUserId: string): Promise<User | undefined>;
  
  // Client operations
  createClient(client: InsertClient): Promise<Client>;
  getClientByName(name: string): Promise<Client | undefined>;
  getAllClients(): Promise<Client[]>;
  
  // Project operations
  createProject(project: InsertProject): Promise<Project>;
  getAllProjects(): Promise<ProjectWithRelations[]>;
  getProjectsByUser(userId: string, role: string): Promise<ProjectWithRelations[]>;
  getProject(id: string): Promise<ProjectWithRelations | undefined>;
  updateProjectStatus(update: UpdateProjectStatus, userId: string): Promise<Project>;
  
  // Chronology operations
  createChronologyEntry(entry: InsertProjectChronology): Promise<ProjectChronology>;
  getProjectChronology(projectId: string): Promise<(ProjectChronology & { assignee?: User })[]>;
  
  // Configuration operations
  getAllKanbanStages(): Promise<KanbanStage[]>;
  createKanbanStage(stage: InsertKanbanStage): Promise<KanbanStage>;
  updateKanbanStage(id: string, stage: Partial<InsertKanbanStage>): Promise<KanbanStage>;
  deleteKanbanStage(id: string): Promise<void>;
  
  getAllChangeReasons(): Promise<ChangeReason[]>;
  createChangeReason(reason: InsertChangeReason): Promise<ChangeReason>;
  updateChangeReason(id: string, reason: Partial<InsertChangeReason>): Promise<ChangeReason>;
  deleteChangeReason(id: string): Promise<void>;
  
  // Bulk operations
  createProjectsFromCSV(projectsData: any[]): Promise<Project[]>;
}

export class DatabaseStorage implements IStorage {
  // In-memory storage for impersonation state (dev/testing only)
  private impersonationStates = new Map<string, { originalUserId: string; impersonatedUserId: string }>();
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Try to create new user, if conflict exists then update by ID only
    try {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            // Never update the ID - only update other fields
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            role: userData.role,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (error) {
      // Handle unique constraint violation on email
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error(`User with email ${userData.email} already exists with different ID`);
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const result = await db.delete(users).where(eq(users.id, id));
    if (result.rowCount === 0) {
      throw new Error("User not found");
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Atomic admin creation to prevent race conditions
  async createAdminIfNone(userData: InsertUser): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // Use a transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Check if any admin users exist within the transaction
        const adminUsers = await tx.select().from(users).where(eq(users.role, 'admin'));
        
        if (adminUsers.length > 0) {
          return { success: false, error: "Admin user already exists. This operation can only be performed once." };
        }

        // Check if user with this email already exists
        const existingUser = await tx.select().from(users).where(eq(users.email, userData.email || ''));
        if (existingUser.length > 0) {
          return { success: false, error: "User with this email already exists" };
        }

        // Create the admin user within the transaction
        const [newUser] = await tx.insert(users).values({
          ...userData,
          role: 'admin' // Ensure role is admin
        }).returning();

        return { success: true, user: newUser };
      });

      return result;
    } catch (error) {
      console.error("Error in atomic admin creation:", error);
      return { success: false, error: "Failed to create admin user" };
    }
  }

  // User impersonation operations (for admin testing)
  async startImpersonation(adminUserId: string, targetUserId: string): Promise<void> {
    // Verify admin user exists and has admin role
    const adminUser = await this.getUser(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      throw new Error("Only admin users can impersonate others");
    }

    // Verify target user exists
    const targetUser = await this.getUser(targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    // Store impersonation state
    this.impersonationStates.set(adminUserId, {
      originalUserId: adminUserId,
      impersonatedUserId: targetUserId
    });
  }

  async stopImpersonation(adminUserId: string): Promise<void> {
    this.impersonationStates.delete(adminUserId);
  }

  async getImpersonationState(adminUserId: string): Promise<{ isImpersonating: boolean; originalUserId?: string; impersonatedUserId?: string }> {
    const state = this.impersonationStates.get(adminUserId);
    if (state) {
      return {
        isImpersonating: true,
        originalUserId: state.originalUserId,
        impersonatedUserId: state.impersonatedUserId
      };
    }
    return { isImpersonating: false };
  }

  async getEffectiveUser(adminUserId: string): Promise<User | undefined> {
    const state = this.impersonationStates.get(adminUserId);
    if (state) {
      // Return the impersonated user
      return await this.getUser(state.impersonatedUserId);
    }
    // Return the original user
    return await this.getUser(adminUserId);
  }

  // Client operations
  async createClient(clientData: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(clientData).returning();
    return client;
  }

  async getClientByName(name: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.name, name));
    return client;
  }

  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }

  // Project operations
  async createProject(projectData: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(projectData).returning();
    return project;
  }

  async getAllProjects(): Promise<ProjectWithRelations[]> {
    return await db.query.projects.findMany({
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        chronology: {
          with: {
            assignee: true,
          },
          orderBy: desc(projectChronology.timestamp),
        },
      },
    });
  }

  async getProjectsByUser(userId: string, role: string): Promise<ProjectWithRelations[]> {
    let whereCondition;
    
    switch (role) {
      case "admin":
      case "manager":
        // Admin and Manager can see all projects
        return this.getAllProjects();
      case "client_manager":
        whereCondition = eq(projects.clientManagerId, userId);
        break;
      case "bookkeeper":
        whereCondition = eq(projects.bookkeeperId, userId);
        break;
      default:
        whereCondition = eq(projects.currentAssigneeId, userId);
    }

    return await db.query.projects.findMany({
      where: whereCondition,
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        chronology: {
          with: {
            assignee: true,
          },
          orderBy: desc(projectChronology.timestamp),
        },
      },
    });
  }

  async getProject(id: string): Promise<ProjectWithRelations | undefined> {
    return await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        chronology: {
          with: {
            assignee: true,
          },
          orderBy: desc(projectChronology.timestamp),
        },
      },
    });
  }

  async updateProjectStatus(update: UpdateProjectStatus, userId: string): Promise<Project> {
    const project = await this.getProject(update.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Look up the kanban stage to get the assigned role
    const [stage] = await db.select().from(kanbanStages).where(eq(kanbanStages.name, update.newStatus));
    if (!stage) {
      throw new Error(`Kanban stage '${update.newStatus}' not found`);
    }

    // Determine new assignee based on the stage's assigned role
    let newAssigneeId: string;
    switch (stage.assignedRole) {
      case "bookkeeper":
        newAssigneeId = project.bookkeeperId;
        break;
      case "client_manager":
        newAssigneeId = project.clientManagerId;
        break;
      case "admin":
      case "manager":
        // For admin/manager roles, keep current assignee or default to client manager
        newAssigneeId = project.currentAssigneeId || project.clientManagerId;
        break;
      default:
        newAssigneeId = project.currentAssigneeId || project.clientManagerId;
    }

    // Calculate time in previous stage
    const lastChronology = project.chronology[0];
    const timeInPreviousStage = lastChronology && lastChronology.timestamp
      ? Math.floor((Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60))
      : 0;

    // Create chronology entry
    await this.createChronologyEntry({
      projectId: update.projectId,
      fromStatus: project.currentStatus,
      toStatus: update.newStatus,
      assigneeId: newAssigneeId,
      changeReason: update.changeReason,
      notes: update.notes,
      timeInPreviousStage,
    });

    // Update project
    const [updatedProject] = await db
      .update(projects)
      .set({
        currentStatus: update.newStatus,
        currentAssigneeId: newAssigneeId,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, update.projectId))
      .returning();

    return updatedProject;
  }

  // Chronology operations
  async createChronologyEntry(entry: InsertProjectChronology): Promise<ProjectChronology> {
    const [chronology] = await db.insert(projectChronology).values(entry).returning();
    return chronology;
  }

  async getProjectChronology(projectId: string): Promise<(ProjectChronology & { assignee?: User })[]> {
    return await db.query.projectChronology.findMany({
      where: eq(projectChronology.projectId, projectId),
      with: {
        assignee: true,
      },
      orderBy: desc(projectChronology.timestamp),
    });
  }

  // Configuration operations
  async getAllKanbanStages(): Promise<KanbanStage[]> {
    return await db.select().from(kanbanStages).orderBy(kanbanStages.order);
  }

  async createKanbanStage(stage: InsertKanbanStage): Promise<KanbanStage> {
    const [newStage] = await db.insert(kanbanStages).values(stage).returning();
    return newStage;
  }

  async updateKanbanStage(id: string, stage: Partial<InsertKanbanStage>): Promise<KanbanStage> {
    const [updatedStage] = await db
      .update(kanbanStages)
      .set(stage)
      .where(eq(kanbanStages.id, id))
      .returning();
    return updatedStage;
  }

  async deleteKanbanStage(id: string): Promise<void> {
    await db.delete(kanbanStages).where(eq(kanbanStages.id, id));
  }

  async getAllChangeReasons(): Promise<ChangeReason[]> {
    return await db.select().from(changeReasons);
  }

  async createChangeReason(reason: InsertChangeReason): Promise<ChangeReason> {
    const [newReason] = await db.insert(changeReasons).values(reason).returning();
    return newReason;
  }

  async updateChangeReason(id: string, reason: Partial<InsertChangeReason>): Promise<ChangeReason> {
    const [updatedReason] = await db
      .update(changeReasons)
      .set(reason)
      .where(eq(changeReasons.id, id))
      .returning();
    return updatedReason;
  }

  async deleteChangeReason(id: string): Promise<void> {
    await db.delete(changeReasons).where(eq(changeReasons.id, id));
  }

  // Bulk operations
  async createProjectsFromCSV(projectsData: any[]): Promise<Project[]> {
    const createdProjects: Project[] = [];

    for (const data of projectsData) {
      // Find or create client
      let client = await this.getClientByName(data.clientName);
      if (!client) {
        client = await this.createClient({
          name: data.clientName,
          email: data.clientEmail,
        });
      }

      // Find bookkeeper and client manager
      const bookkeeper = await this.getUserByEmail(data.bookkeeperEmail);
      const clientManager = await this.getUserByEmail(data.clientManagerEmail);

      if (!bookkeeper || !clientManager) {
        console.error(`Skipping project for ${data.clientName}: bookkeeper or client manager not found`);
        continue;
      }

      // Create project
      const project = await this.createProject({
        clientId: client.id,
        bookkeeperId: bookkeeper.id,
        clientManagerId: clientManager.id,
        currentAssigneeId: clientManager.id,
        description: data.projectDescription,
        currentStatus: "no_latest_action",
        priority: data.priority || "medium",
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      });

      // Create initial chronology entry
      await this.createChronologyEntry({
        projectId: project.id,
        fromStatus: null,
        toStatus: "no_latest_action",
        assigneeId: clientManager.id,
        changeReason: "first_allocation_of_work",
        notes: "Project created and assigned to client manager",
        timeInPreviousStage: 0,
      });

      createdProjects.push(project);
    }

    return createdProjects;
  }
}

export const storage = new DatabaseStorage();
