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
  getAllUsers(): Promise<User[]>;
  
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
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
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

    // Determine new assignee based on status
    let newAssigneeId: string;
    switch (update.newStatus) {
      case "no_latest_action":
      case "in_review":
      case "needs_client_input":
        newAssigneeId = project.clientManagerId;
        break;
      case "bookkeeping_work_required":
        newAssigneeId = project.bookkeeperId;
        break;
      case "completed":
        newAssigneeId = project.clientManagerId; // Completed projects stay with client manager
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
