import {
  users,
  clients,
  projects,
  projectChronology,
  kanbanStages,
  changeReasons,
  projectDescriptions,
  stageReasonMaps,
  reasonCustomFields,
  reasonFieldResponses,
  stageApprovals,
  stageApprovalFields,
  stageApprovalResponses,
  normalizeProjectMonth,
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
  type ProjectDescription,
  type InsertProjectDescription,
  type StageReasonMap,
  type InsertStageReasonMap,
  type ReasonCustomField,
  type InsertReasonCustomField,
  type ReasonFieldResponse,
  type InsertReasonFieldResponse,
  type StageApproval,
  type InsertStageApproval,
  type StageApprovalField,
  type InsertStageApprovalField,
  type StageApprovalResponse,
  type InsertStageApprovalResponse,
  type ProjectWithRelations,
  type UpdateProjectStatus,
} from "@shared/schema";
import { calculateBusinessHours } from "@shared/businessTime";
import { db } from "./db";
import { eq, desc, and, inArray, sql, sum } from "drizzle-orm";

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
  getProjectChronology(projectId: string): Promise<(ProjectChronology & { assignee?: User; fieldResponses: (ReasonFieldResponse & { customField: ReasonCustomField })[] })[]>;
  
  // Configuration operations
  getAllKanbanStages(): Promise<KanbanStage[]>;
  createKanbanStage(stage: InsertKanbanStage): Promise<KanbanStage>;
  updateKanbanStage(id: string, stage: Partial<InsertKanbanStage>): Promise<KanbanStage>;
  deleteKanbanStage(id: string): Promise<void>;
  
  // Stage validation operations
  isStageNameInUse(stageName: string): Promise<boolean>;
  getStageById(id: string): Promise<KanbanStage | undefined>;
  validateStageCanBeDeleted(id: string): Promise<{ canDelete: boolean; reason?: string; projectCount?: number }>;
  validateStageCanBeRenamed(id: string, newName: string): Promise<{ canRename: boolean; reason?: string; projectCount?: number }>;
  validateProjectStatus(status: string): Promise<{ isValid: boolean; reason?: string }>;
  getDefaultStage(): Promise<KanbanStage | undefined>;
  
  getAllChangeReasons(): Promise<ChangeReason[]>;
  createChangeReason(reason: InsertChangeReason): Promise<ChangeReason>;
  updateChangeReason(id: string, reason: Partial<InsertChangeReason>): Promise<ChangeReason>;
  deleteChangeReason(id: string): Promise<void>;
  
  // Project description operations
  getAllProjectDescriptions(): Promise<ProjectDescription[]>;
  createProjectDescription(description: InsertProjectDescription): Promise<ProjectDescription>;
  updateProjectDescription(id: string, description: Partial<InsertProjectDescription>): Promise<ProjectDescription>;
  deleteProjectDescription(id: string): Promise<void>;
  getProjectDescriptionByName(name: string): Promise<ProjectDescription | undefined>;
  
  // Bulk operations
  createProjectsFromCSV(projectsData: any[]): Promise<{
    success: boolean;
    createdProjects: Project[];
    archivedProjects: Project[];
    errors: string[];
    summary: {
      totalRows: number;
      newProjectsCreated: number;
      existingProjectsArchived: number;
      clientsProcessed: string[];
    };
  }>;

  // Stage-reason mapping CRUD operations
  getAllStageReasonMaps(): Promise<StageReasonMap[]>;
  createStageReasonMap(mapping: InsertStageReasonMap): Promise<StageReasonMap>;
  getStageReasonMapsByStageId(stageId: string): Promise<StageReasonMap[]>;
  deleteStageReasonMap(id: string): Promise<void>;

  // Custom fields CRUD operations
  getAllReasonCustomFields(): Promise<ReasonCustomField[]>;
  getReasonCustomFieldsByReasonId(reasonId: string): Promise<ReasonCustomField[]>;
  createReasonCustomField(field: InsertReasonCustomField): Promise<ReasonCustomField>;
  updateReasonCustomField(id: string, field: Partial<InsertReasonCustomField>): Promise<ReasonCustomField>;
  deleteReasonCustomField(id: string): Promise<void>;

  // Field responses operations
  createReasonFieldResponse(response: InsertReasonFieldResponse): Promise<ReasonFieldResponse>;
  getReasonFieldResponsesByChronologyId(chronologyId: string): Promise<ReasonFieldResponse[]>;

  // Helper validation methods
  validateStageReasonMapping(stageId: string, reasonId: string): Promise<{ isValid: boolean; reason?: string }>;
  validateRequiredFields(reasonId: string, fieldResponses?: { customFieldId: string; fieldType: string; valueNumber?: number; valueShortText?: string; valueLongText?: string }[]): Promise<{ isValid: boolean; reason?: string; missingFields?: string[] }>;
  getValidChangeReasonsForStage(stageId: string): Promise<ChangeReason[]>;

  // Project progress metrics
  getProjectProgressMetrics(projectId: string): Promise<{ reasonId: string; label: string; total: number }[]>;
  
  // Stage approval operations
  getAllStageApprovals(): Promise<StageApproval[]>;
  createStageApproval(approval: InsertStageApproval): Promise<StageApproval>;
  updateStageApproval(id: string, approval: Partial<InsertStageApproval>): Promise<StageApproval>;
  deleteStageApproval(id: string): Promise<void>;
  getStageApprovalById(id: string): Promise<StageApproval | undefined>;
  
  // Stage approval fields operations
  getAllStageApprovalFields(): Promise<StageApprovalField[]>;
  getStageApprovalFieldsByApprovalId(approvalId: string): Promise<StageApprovalField[]>;
  createStageApprovalField(field: InsertStageApprovalField): Promise<StageApprovalField>;
  updateStageApprovalField(id: string, field: Partial<InsertStageApprovalField>): Promise<StageApprovalField>;
  deleteStageApprovalField(id: string): Promise<void>;
  
  // Stage approval responses operations  
  createStageApprovalResponse(response: InsertStageApprovalResponse): Promise<StageApprovalResponse>;
  getStageApprovalResponsesByProjectId(projectId: string): Promise<StageApprovalResponse[]>;
  
  // Stage approval validation
  validateStageApprovalResponses(approvalId: string, responses: InsertStageApprovalResponse[]): Promise<{ isValid: boolean; reason?: string; failedFields?: string[] }>;
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
    // Ensure we have a valid status
    let finalProjectData = { ...projectData };
    
    if (!finalProjectData.currentStatus) {
      // Use default stage when no status is provided
      const defaultStage = await this.getDefaultStage();
      if (!defaultStage) {
        throw new Error("No kanban stages found. Please create at least one stage before creating projects.");
      }
      finalProjectData.currentStatus = defaultStage.name;
    }
    
    // Validate that the currentStatus matches an existing stage
    const validation = await this.validateProjectStatus(finalProjectData.currentStatus);
    if (!validation.isValid) {
      throw new Error(validation.reason || "Invalid project status");
    }
    
    // Use a database transaction to ensure both project and chronology entry are created atomically
    return await db.transaction(async (tx) => {
      // Create the project
      const [project] = await tx.insert(projects).values(finalProjectData).returning();
      
      // Create initial chronology entry
      await tx.insert(projectChronology).values({
        projectId: project.id,
        fromStatus: null, // Initial entry has no previous status
        toStatus: project.currentStatus,
        assigneeId: project.currentAssigneeId,
        changeReason: `${project.description} Created → ${project.currentStatus}`,
        timeInPreviousStage: null, // No previous stage for initial entry
        businessHoursInPreviousStage: null, // No previous stage for initial entry
      });
      
      return project;
    });
  }

  async getAllProjects(filters?: { month?: string; archived?: boolean }): Promise<ProjectWithRelations[]> {
    let whereConditions = [];
    
    if (filters?.month) {
      whereConditions.push(eq(projects.projectMonth, filters.month));
    }
    
    if (filters?.archived !== undefined) {
      whereConditions.push(eq(projects.archived, filters.archived));
    }
    
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    const results = await db.query.projects.findMany({
      where: whereClause,
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        chronology: {
          with: {
            assignee: true,
            fieldResponses: {
              with: {
                customField: true,
              },
            },
          },
          orderBy: desc(projectChronology.timestamp),
        },
      },
    });
    
    // Convert null relations to undefined to match TypeScript expectations
    return results.map(project => ({
      ...project,
      currentAssignee: project.currentAssignee || undefined,
      chronology: project.chronology.map(c => ({
        ...c,
        assignee: c.assignee || undefined,
        fieldResponses: c.fieldResponses || [],
      })),
    }));
  }

  async getProjectsByUser(userId: string, role: string, filters?: { month?: string; archived?: boolean }): Promise<ProjectWithRelations[]> {
    let userWhereCondition;
    
    switch (role) {
      case "admin":
      case "manager":
        // Admin and Manager can see all projects
        return this.getAllProjects(filters);
      case "client_manager":
        userWhereCondition = eq(projects.clientManagerId, userId);
        break;
      case "bookkeeper":
        userWhereCondition = eq(projects.bookkeeperId, userId);
        break;
      default:
        userWhereCondition = eq(projects.currentAssigneeId, userId);
    }

    // Build combined where conditions
    let whereConditions = [userWhereCondition];
    
    if (filters?.month) {
      whereConditions.push(eq(projects.projectMonth, filters.month));
    }
    
    if (filters?.archived !== undefined) {
      whereConditions.push(eq(projects.archived, filters.archived));
    }
    
    const whereClause = and(...whereConditions);

    const results = await db.query.projects.findMany({
      where: whereClause,
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        chronology: {
          with: {
            assignee: true,
            fieldResponses: {
              with: {
                customField: true,
              },
            },
          },
          orderBy: desc(projectChronology.timestamp),
        },
      },
    });
    
    // Convert null relations to undefined to match TypeScript expectations
    return results.map(project => ({
      ...project,
      currentAssignee: project.currentAssignee || undefined,
      chronology: project.chronology.map(c => ({
        ...c,
        assignee: c.assignee || undefined,
        fieldResponses: c.fieldResponses || [],
      })),
    }));
  }

  async getProject(id: string): Promise<ProjectWithRelations | undefined> {
    const result = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        chronology: {
          with: {
            assignee: true,
            fieldResponses: {
              with: {
                customField: true,
              },
            },
          },
          orderBy: desc(projectChronology.timestamp),
        },
      },
    });
    
    if (!result) return undefined;
    
    // Convert null relations to undefined to match TypeScript expectations
    return {
      ...result,
      currentAssignee: result.currentAssignee || undefined,
      chronology: result.chronology.map(c => ({
        ...c,
        assignee: c.assignee || undefined,
        fieldResponses: c.fieldResponses || [],
      })),
    };
  }

  async updateProjectStatus(update: UpdateProjectStatus, userId: string): Promise<Project> {
    const project = await this.getProject(update.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Validate the new status using the centralized validation method
    const validation = await this.validateProjectStatus(update.newStatus);
    if (!validation.isValid) {
      throw new Error(validation.reason || "Invalid project status");
    }

    // Look up the kanban stage to get the assigned role
    const [stage] = await db.select().from(kanbanStages).where(eq(kanbanStages.name, update.newStatus));
    if (!stage) {
      throw new Error(`Kanban stage '${update.newStatus}' not found`);
    }

    // Look up the change reason to get the reason ID for validation
    const [reason] = await db.select().from(changeReasons).where(eq(changeReasons.reason, update.changeReason));
    if (!reason) {
      throw new Error(`Change reason '${update.changeReason}' not found`);
    }

    // Validate that the submitted reason is mapped to the target stage
    const stageReasonValidation = await this.validateStageReasonMapping(stage.id, reason.id);
    if (!stageReasonValidation.isValid) {
      throw new Error(stageReasonValidation.reason || "Invalid stage-reason mapping");
    }

    // Validate field responses if provided
    if (update.fieldResponses && update.fieldResponses.length > 0) {
      // Server-side field validation - load custom fields and validate against actual field configuration
      for (const fieldResponse of update.fieldResponses) {
        const [customField] = await db.select().from(reasonCustomFields).where(eq(reasonCustomFields.id, fieldResponse.customFieldId));
        if (!customField) {
          throw new Error(`Custom field with ID '${fieldResponse.customFieldId}' not found`);
        }

        // Validate that field response matches the server-side field type and constraints
        const { fieldType, options } = customField;
        
        // Check that exactly one value field is populated based on server field type
        const hasNumber = fieldResponse.valueNumber !== undefined && fieldResponse.valueNumber !== null;
        const hasShortText = fieldResponse.valueShortText !== undefined && fieldResponse.valueShortText !== null && fieldResponse.valueShortText !== '';
        const hasLongText = fieldResponse.valueLongText !== undefined && fieldResponse.valueLongText !== null && fieldResponse.valueLongText !== '';
        const hasMultiSelect = fieldResponse.valueMultiSelect !== undefined && fieldResponse.valueMultiSelect !== null && fieldResponse.valueMultiSelect.length > 0;
        
        let validFieldMatch = false;
        if (fieldType === 'number') {
          validFieldMatch = hasNumber && !hasShortText && !hasLongText && !hasMultiSelect;
        } else if (fieldType === 'short_text') {
          validFieldMatch = !hasNumber && hasShortText && !hasLongText && !hasMultiSelect;
        } else if (fieldType === 'long_text') {
          validFieldMatch = !hasNumber && !hasShortText && hasLongText && !hasMultiSelect;
        } else if (fieldType === 'multi_select') {
          validFieldMatch = !hasNumber && !hasShortText && !hasLongText && hasMultiSelect;
          
          // Additional validation for multi_select: check that all values exist in options
          if (validFieldMatch && fieldResponse.valueMultiSelect) {
            if (!options || options.length === 0) {
              throw new Error(`Multi-select field '${customField.fieldName}' has no configured options`);
            }
            
            const invalidOptions = fieldResponse.valueMultiSelect.filter(value => !options.includes(value));
            if (invalidOptions.length > 0) {
              throw new Error(`Invalid options for multi-select field '${customField.fieldName}': ${invalidOptions.join(', ')}. Valid options are: ${options.join(', ')}`);
            }
          }
        }
        
        if (!validFieldMatch) {
          throw new Error(`Invalid field data for '${customField.fieldName}': field type '${fieldType}' requires exactly one matching value field`);
        }
      }
    }

    // Validate required fields for this reason
    const requiredFieldsValidation = await this.validateRequiredFields(reason.id, update.fieldResponses);
    if (!requiredFieldsValidation.isValid) {
      throw new Error(requiredFieldsValidation.reason || "Required fields validation failed");
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
    let timeInPreviousStage: number;
    let businessHoursInPreviousStage: number;
    
    if (lastChronology && lastChronology.timestamp) {
      // If there's a previous chronology entry, calculate from its timestamp
      timeInPreviousStage = Math.floor((Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60));
      
      // Calculate business hours using the same timestamps
      try {
        const businessHours = calculateBusinessHours(
          new Date(lastChronology.timestamp).toISOString(), 
          new Date().toISOString()
        );
        // Store in minutes for precision (multiply by 60 and round)
        businessHoursInPreviousStage = Math.round(businessHours * 60);
      } catch (error) {
        console.error("Error calculating business hours:", error);
        businessHoursInPreviousStage = 0;
      }
    } else {
      // If no previous chronology entry exists, calculate from project.createdAt
      // Handle case where project.createdAt could be null
      if (project.createdAt) {
        timeInPreviousStage = Math.floor((Date.now() - new Date(project.createdAt).getTime()) / (1000 * 60));
        
        // Calculate business hours from project creation
        try {
          const businessHours = calculateBusinessHours(
            new Date(project.createdAt).toISOString(), 
            new Date().toISOString()
          );
          // Store in minutes for precision (multiply by 60 and round)
          businessHoursInPreviousStage = Math.round(businessHours * 60);
        } catch (error) {
          console.error("Error calculating business hours from project creation:", error);
          businessHoursInPreviousStage = 0;
        }
      } else {
        // Fallback to 0 minutes and 0 business hours if createdAt is null
        timeInPreviousStage = 0;
        businessHoursInPreviousStage = 0;
      }
    }

    // Use a transaction to ensure chronology and field responses are created atomically
    return await db.transaction(async (tx) => {
      // Create chronology entry
      const [chronologyEntry] = await tx.insert(projectChronology).values({
        projectId: update.projectId,
        fromStatus: project.currentStatus,
        toStatus: update.newStatus,
        assigneeId: newAssigneeId,
        changeReason: update.changeReason,
        notes: update.notes,
        timeInPreviousStage,
        businessHoursInPreviousStage,
      }).returning();

      // Create field responses if provided
      if (update.fieldResponses && update.fieldResponses.length > 0) {
        for (const fieldResponse of update.fieldResponses) {
          // Get the custom field to obtain the server-side fieldType
          const [customField] = await tx.select().from(reasonCustomFields).where(eq(reasonCustomFields.id, fieldResponse.customFieldId));
          if (!customField) {
            throw new Error(`Custom field with ID '${fieldResponse.customFieldId}' not found`);
          }
          
          await tx.insert(reasonFieldResponses).values({
            chronologyId: chronologyEntry.id,
            customFieldId: fieldResponse.customFieldId,
            fieldType: customField.fieldType, // Use server-side fieldType
            valueNumber: fieldResponse.valueNumber,
            valueShortText: fieldResponse.valueShortText,
            valueLongText: fieldResponse.valueLongText,
            valueMultiSelect: fieldResponse.valueMultiSelect,
          });
        }
      }

      // Update project
      const [updatedProject] = await tx
        .update(projects)
        .set({
          currentStatus: update.newStatus,
          currentAssigneeId: newAssigneeId,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, update.projectId))
        .returning();

      return updatedProject;
    });
  }

  // Chronology operations
  async createChronologyEntry(entry: InsertProjectChronology): Promise<ProjectChronology> {
    const [chronology] = await db.insert(projectChronology).values(entry).returning();
    return chronology;
  }

  async getProjectChronology(projectId: string): Promise<(ProjectChronology & { assignee?: User; fieldResponses: (ReasonFieldResponse & { customField: ReasonCustomField })[] })[]> {
    const results = await db.query.projectChronology.findMany({
      where: eq(projectChronology.projectId, projectId),
      with: {
        assignee: true,
        fieldResponses: {
          with: {
            customField: true,
          },
        },
      },
      orderBy: desc(projectChronology.timestamp),
    });
    
    // Convert null relations to undefined to match TypeScript expectations
    return results.map(c => ({
      ...c,
      assignee: c.assignee || undefined,
      fieldResponses: c.fieldResponses || [],
    }));
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
    // If name is being changed, validate that the stage can be renamed
    if (stage.name) {
      const validation = await this.validateStageCanBeRenamed(id, stage.name);
      if (!validation.canRename) {
        throw new Error(validation.reason || "Stage cannot be renamed");
      }
    }
    
    const [updatedStage] = await db
      .update(kanbanStages)
      .set(stage)
      .where(eq(kanbanStages.id, id))
      .returning();
      
    if (!updatedStage) {
      throw new Error("Stage not found");
    }
    
    return updatedStage;
  }

  async deleteKanbanStage(id: string): Promise<void> {
    // Validate that the stage can be deleted
    const validation = await this.validateStageCanBeDeleted(id);
    if (!validation.canDelete) {
      throw new Error(validation.reason || "Stage cannot be deleted");
    }
    
    await db.delete(kanbanStages).where(eq(kanbanStages.id, id));
  }
  
  // Stage validation operations
  async isStageNameInUse(stageName: string): Promise<boolean> {
    const [project] = await db.select().from(projects).where(eq(projects.currentStatus, stageName)).limit(1);
    return !!project;
  }
  
  async validateProjectStatus(status: string): Promise<{ isValid: boolean; reason?: string }> {
    // Check if the status matches an existing stage
    const [stage] = await db.select().from(kanbanStages).where(eq(kanbanStages.name, status));
    if (!stage) {
      return { isValid: false, reason: `Invalid project status '${status}'. Status must match an existing kanban stage.` };
    }
    return { isValid: true };
  }
  
  async getStageById(id: string): Promise<KanbanStage | undefined> {
    const [stage] = await db.select().from(kanbanStages).where(eq(kanbanStages.id, id));
    return stage;
  }
  
  async validateStageCanBeDeleted(id: string): Promise<{ canDelete: boolean; reason?: string; projectCount?: number }> {
    // First check if the stage exists
    const stage = await this.getStageById(id);
    if (!stage) {
      return { canDelete: false, reason: "Stage not found" };
    }
    
    // Check if any projects are using this stage
    const projectsUsingStage = await db.select().from(projects).where(eq(projects.currentStatus, stage.name));
    const projectCount = projectsUsingStage.length;
    
    if (projectCount > 0) {
      return { 
        canDelete: false, 
        reason: `Cannot delete stage '${stage.name}' because ${projectCount} project${projectCount > 1 ? 's' : ''} ${projectCount > 1 ? 'are' : 'is'} currently assigned to this stage`, 
        projectCount 
      };
    }
    
    return { canDelete: true };
  }
  
  async validateStageCanBeRenamed(id: string, newName: string): Promise<{ canRename: boolean; reason?: string; projectCount?: number }> {
    // First check if the stage exists
    const stage = await this.getStageById(id);
    if (!stage) {
      return { canRename: false, reason: "Stage not found" };
    }
    
    // If the name isn't actually changing, allow it
    if (stage.name === newName) {
      return { canRename: true };
    }
    
    // Check if any projects are using this stage
    const projectsUsingStage = await db.select().from(projects).where(eq(projects.currentStatus, stage.name));
    const projectCount = projectsUsingStage.length;
    
    if (projectCount > 0) {
      return { 
        canRename: false, 
        reason: `Cannot rename stage '${stage.name}' because ${projectCount} project${projectCount > 1 ? 's' : ''} ${projectCount > 1 ? 'are' : 'is'} currently assigned to this stage. Renaming would orphan these projects.`, 
        projectCount 
      };
    }
    
    return { canRename: true };
  }
  
  async getDefaultStage(): Promise<KanbanStage | undefined> {
    // Get the first stage by order (lowest order number)
    const [defaultStage] = await db.select().from(kanbanStages).orderBy(kanbanStages.order).limit(1);
    return defaultStage;
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

  // Project description operations
  async getAllProjectDescriptions(): Promise<ProjectDescription[]> {
    return await db.select().from(projectDescriptions).orderBy(projectDescriptions.order);
  }

  async createProjectDescription(description: InsertProjectDescription): Promise<ProjectDescription> {
    const [newDescription] = await db.insert(projectDescriptions).values(description).returning();
    return newDescription;
  }

  async updateProjectDescription(id: string, description: Partial<InsertProjectDescription>): Promise<ProjectDescription> {
    const [updatedDescription] = await db
      .update(projectDescriptions)
      .set(description)
      .where(eq(projectDescriptions.id, id))
      .returning();
      
    if (!updatedDescription) {
      throw new Error("Project description not found");
    }
    
    return updatedDescription;
  }

  async deleteProjectDescription(id: string): Promise<void> {
    const result = await db.delete(projectDescriptions).where(eq(projectDescriptions.id, id));
    if (result.rowCount === 0) {
      throw new Error("Project description not found");
    }
  }

  async getProjectDescriptionByName(name: string): Promise<ProjectDescription | undefined> {
    const [description] = await db.select().from(projectDescriptions).where(eq(projectDescriptions.name, name));
    return description;
  }

  // Bulk operations
  async createProjectsFromCSV(projectsData: any[]): Promise<{
    success: boolean;
    createdProjects: Project[];
    archivedProjects: Project[];
    errors: string[];
    summary: {
      totalRows: number;
      newProjectsCreated: number;
      existingProjectsArchived: number;
      alreadyExistsCount: number;
      clientsProcessed: string[];
    };
  }> {
    const result = {
      success: false,
      createdProjects: [] as Project[],
      archivedProjects: [] as Project[],
      errors: [] as string[],
      summary: {
        totalRows: projectsData.length,
        newProjectsCreated: 0,
        existingProjectsArchived: 0,
        alreadyExistsCount: 0,
        clientsProcessed: [] as string[],
      },
    };

    try {
      // Validate CSV data format and duplicates first
      const validationResult = await this.validateCSVData(projectsData);
      if (!validationResult.isValid) {
        result.errors = validationResult.errors;
        return result;
      }

      // Use transaction for atomic monthly workflow
      const transactionResult = await db.transaction(async (tx) => {
        const createdProjects: Project[] = [];
        const archivedProjects: Project[] = [];
        const processedClients = new Set<string>();
        let alreadyExistsCount = 0;

        // Get required configuration data
        const defaultStage = await this.getDefaultStage();
        if (!defaultStage) {
          throw new Error("No kanban stages found. Please create at least one stage before importing projects.");
        }

        // Find "Not Completed in Time" stage or create it if needed
        let notCompletedStage = await tx.select().from(kanbanStages).where(eq(kanbanStages.name, "Not Completed in Time"));
        if (notCompletedStage.length === 0) {
          // Create the stage if it doesn't exist
          const maxOrder = await tx.select({ maxOrder: sql<number>`COALESCE(MAX(${kanbanStages.order}), 0)` }).from(kanbanStages);
          const [newStage] = await tx.insert(kanbanStages).values({
            name: "Not Completed in Time",
            assignedRole: "admin",
            order: (maxOrder[0]?.maxOrder || 0) + 1,
            color: "#ef4444", // Red color for overdue items
          }).returning();
          notCompletedStage = [newStage];
        }

        // Process each CSV row
        for (const data of projectsData) {
          try {
            // Find or create client
            let client = await this.getClientByName(data.clientName);
            if (!client) {
              const [newClient] = await tx.insert(clients).values({
                name: data.clientName,
                email: data.clientEmail,
              }).returning();
              client = newClient;
            }

            // Find bookkeeper and client manager
            const bookkeeper = await this.getUserByEmail(data.bookkeeperEmail);
            const clientManager = await this.getUserByEmail(data.clientManagerEmail);

            if (!bookkeeper || !clientManager) {
              throw new Error(`Bookkeeper (${data.bookkeeperEmail}) or client manager (${data.clientManagerEmail}) not found`);
            }

            // CRITICAL: Check for existing project with same (client, description, projectMonth) triplet
            const normalizedProjectMonth = normalizeProjectMonth(data.projectMonth);
            const existingProjectForMonth = await tx.query.projects.findFirst({
              where: and(
                eq(projects.clientId, client.id),
                eq(projects.description, data.projectDescription),
                eq(projects.projectMonth, normalizedProjectMonth),
                eq(projects.archived, false)
              ),
            });

            // Skip if project already exists for this month (IDEMPOTENCY)
            if (existingProjectForMonth) {
              console.log(`Skipping duplicate project for ${data.clientName} - ${data.projectDescription} - ${normalizedProjectMonth}`);
              alreadyExistsCount++;
              processedClients.add(data.clientName);
              continue;
            }

            // Handle monthly workflow for existing projects (different months only)
            const existingProjects = await tx.query.projects.findMany({
              where: and(
                eq(projects.clientId, client.id),
                eq(projects.description, data.projectDescription),
                eq(projects.archived, false) // ARCHIVAL SAFETY: only get non-archived projects
              ),
              with: {
                chronology: {
                  orderBy: desc(projectChronology.timestamp),
                  limit: 1,
                },
              },
            });

            // Process existing active projects
            for (const existingProject of existingProjects) {
              if (existingProject.currentStatus !== "Completed") {
                // Calculate time in current stage
                const lastChronology = existingProject.chronology[0];
                const timeInPreviousStage = lastChronology && lastChronology.timestamp
                  ? Math.floor((Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60))
                  : 0;

                // Create chronology entry for status change
                await tx.insert(projectChronology).values({
                  projectId: existingProject.id,
                  fromStatus: existingProject.currentStatus,
                  toStatus: "Not Completed in Time",
                  assigneeId: existingProject.currentAssigneeId || clientManager.id,
                  changeReason: "clarifications_needed",
                  notes: `Project moved to 'Not Completed in Time' due to new monthly cycle. Previous status: ${existingProject.currentStatus}`,
                  timeInPreviousStage,
                });

                // Update project status and archive it
                const [updatedProject] = await tx.update(projects)
                  .set({
                    currentStatus: "Not Completed in Time",
                    currentAssigneeId: existingProject.currentAssigneeId || clientManager.id,
                    archived: true,
                    updatedAt: new Date(),
                  })
                  .where(eq(projects.id, existingProject.id))
                  .returning();

                archivedProjects.push(updatedProject);
              }
            }

            // Create new project for this month
            const [newProject] = await tx.insert(projects).values({
              clientId: client.id,
              bookkeeperId: bookkeeper.id,
              clientManagerId: clientManager.id,
              currentAssigneeId: clientManager.id,
              description: data.projectDescription,
              currentStatus: defaultStage.name,
              priority: data.priority || "medium",
              dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
              projectMonth: normalizedProjectMonth, // Use normalized format
              archived: false,
            }).returning();

            // Create initial chronology entry for new project
            await tx.insert(projectChronology).values({
              projectId: newProject.id,
              fromStatus: null,
              toStatus: defaultStage.name,
              assigneeId: clientManager.id,
              changeReason: `${newProject.description} Created → ${defaultStage.name}`,
              notes: `New project created for month ${normalizedProjectMonth} and assigned to client manager`,
              timeInPreviousStage: 0,
            });

            createdProjects.push(newProject);
            processedClients.add(data.clientName);

          } catch (error) {
            console.error(`Error processing project for ${data.clientName}:`, error);
            throw new Error(`Failed to process project for ${data.clientName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        return {
          createdProjects,
          archivedProjects,
          processedClients: Array.from(processedClients),
          alreadyExistsCount,
        };
      });

      // Update result with transaction outcome
      result.success = true;
      result.createdProjects = transactionResult.createdProjects;
      result.archivedProjects = transactionResult.archivedProjects;
      result.summary.newProjectsCreated = transactionResult.createdProjects.length;
      result.summary.existingProjectsArchived = transactionResult.archivedProjects.length;
      result.summary.alreadyExistsCount = transactionResult.alreadyExistsCount;
      result.summary.clientsProcessed = transactionResult.processedClients;

      return result;

    } catch (error) {
      console.error("Error in createProjectsFromCSV:", error);
      result.errors.push(error instanceof Error ? error.message : "Unknown error occurred");
      return result;
    }
  }

  private async validateCSVData(projectsData: any[]): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!projectsData || projectsData.length === 0) {
      errors.push("CSV data is empty or invalid");
      return { isValid: false, errors };
    }

    // Check for duplicate client names in CSV
    const clientNames = projectsData.map(data => data.clientName).filter(Boolean);
    const duplicateClients = clientNames.filter((name, index) => clientNames.indexOf(name) !== index);
    if (duplicateClients.length > 0) {
      errors.push(`Duplicate client names found in CSV: ${Array.from(new Set(duplicateClients)).join(', ')}. Each client can only appear once per upload.`);
    }

    // Validate project descriptions against configured ones
    const activeDescriptions = await db.select().from(projectDescriptions).where(eq(projectDescriptions.active, true));
    if (activeDescriptions.length === 0) {
      errors.push("No active project descriptions found. Please configure project descriptions in the admin area before importing projects.");
      return { isValid: false, errors };
    }

    const validDescriptionNames = new Set(activeDescriptions.map(desc => desc.name));
    const invalidDescriptions = projectsData
      .map(data => data.projectDescription)
      .filter(desc => desc && !validDescriptionNames.has(desc));

    if (invalidDescriptions.length > 0) {
      const uniqueInvalid = Array.from(new Set(invalidDescriptions));
      errors.push(`Invalid project descriptions found: ${uniqueInvalid.join(', ')}. All project descriptions must be configured in the admin area before use.`);
      errors.push(`Valid descriptions are: ${Array.from(validDescriptionNames).join(', ')}`);
    }

    // Validate required fields and normalize project months
    for (let i = 0; i < projectsData.length; i++) {
      const data = projectsData[i];
      const rowNumber = i + 1;

      if (!data.clientName) {
        errors.push(`Row ${rowNumber}: Client name is required`);
      }
      if (!data.projectDescription) {
        errors.push(`Row ${rowNumber}: Project description is required`);
      }
      if (!data.bookkeeperEmail) {
        errors.push(`Row ${rowNumber}: Bookkeeper email is required`);
      }
      if (!data.clientManagerEmail) {
        errors.push(`Row ${rowNumber}: Client manager email is required`);
      }

      // Validate and normalize projectMonth (now required)
      if (!data.projectMonth) {
        errors.push(`Row ${rowNumber}: Project month is required`);
      } else {
        try {
          // Normalize the project month format
          data.projectMonth = normalizeProjectMonth(data.projectMonth);
        } catch (error) {
          errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Invalid project month format'}`);
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  // Stage-reason mapping CRUD operations
  async getAllStageReasonMaps(): Promise<StageReasonMap[]> {
    return await db.query.stageReasonMaps.findMany({
      with: {
        stage: true,
        reason: true,
      },
    });
  }

  async createStageReasonMap(mapping: InsertStageReasonMap): Promise<StageReasonMap> {
    try {
      const [newMapping] = await db.insert(stageReasonMaps).values(mapping).returning();
      return newMapping;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error(`Stage-reason mapping already exists for this stage and reason`);
      }
      throw error;
    }
  }

  async getStageReasonMapsByStageId(stageId: string): Promise<StageReasonMap[]> {
    return await db.query.stageReasonMaps.findMany({
      where: eq(stageReasonMaps.stageId, stageId),
      with: {
        reason: true,
      },
    });
  }

  async deleteStageReasonMap(id: string): Promise<void> {
    const result = await db.delete(stageReasonMaps).where(eq(stageReasonMaps.id, id));
    if (result.rowCount === 0) {
      throw new Error("Stage-reason mapping not found");
    }
  }

  // Custom fields CRUD operations
  async getAllReasonCustomFields(): Promise<ReasonCustomField[]> {
    return await db.query.reasonCustomFields.findMany({
      with: {
        reason: true,
      },
      orderBy: [reasonCustomFields.reasonId, reasonCustomFields.order],
    });
  }

  async getReasonCustomFieldsByReasonId(reasonId: string): Promise<ReasonCustomField[]> {
    return await db.query.reasonCustomFields.findMany({
      where: eq(reasonCustomFields.reasonId, reasonId),
      orderBy: reasonCustomFields.order,
    });
  }

  async createReasonCustomField(field: InsertReasonCustomField): Promise<ReasonCustomField> {
    const [newField] = await db.insert(reasonCustomFields).values(field).returning();
    return newField;
  }

  async updateReasonCustomField(id: string, field: Partial<InsertReasonCustomField>): Promise<ReasonCustomField> {
    const [updatedField] = await db
      .update(reasonCustomFields)
      .set(field)
      .where(eq(reasonCustomFields.id, id))
      .returning();
      
    if (!updatedField) {
      throw new Error("Custom field not found");
    }
    
    return updatedField;
  }

  async deleteReasonCustomField(id: string): Promise<void> {
    const result = await db.delete(reasonCustomFields).where(eq(reasonCustomFields.id, id));
    if (result.rowCount === 0) {
      throw new Error("Custom field not found");
    }
  }

  // Field responses operations
  async createReasonFieldResponse(response: InsertReasonFieldResponse): Promise<ReasonFieldResponse> {
    try {
      const [newResponse] = await db.insert(reasonFieldResponses).values(response).returning();
      return newResponse;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error(`Field response already exists for this chronology and custom field`);
      }
      if (error instanceof Error && error.message.includes('check_single_value_column')) {
        throw new Error(`Invalid field value: only one value column should be populated based on field type`);
      }
      throw error;
    }
  }

  async getReasonFieldResponsesByChronologyId(chronologyId: string): Promise<ReasonFieldResponse[]> {
    return await db.query.reasonFieldResponses.findMany({
      where: eq(reasonFieldResponses.chronologyId, chronologyId),
      with: {
        customField: true,
      },
    });
  }

  // Helper validation methods
  async validateStageReasonMapping(stageId: string, reasonId: string): Promise<{ isValid: boolean; reason?: string }> {
    // Check if the stage exists
    const stage = await this.getStageById(stageId);
    if (!stage) {
      return { isValid: false, reason: "Stage not found" };
    }

    // Check if the reason exists
    const [reason] = await db.select().from(changeReasons).where(eq(changeReasons.id, reasonId));
    if (!reason) {
      return { isValid: false, reason: "Change reason not found" };
    }

    // Check if the mapping exists
    const mapping = await db.query.stageReasonMaps.findFirst({
      where: and(
        eq(stageReasonMaps.stageId, stageId),
        eq(stageReasonMaps.reasonId, reasonId)
      ),
    });

    if (!mapping) {
      return { 
        isValid: false, 
        reason: `Change reason '${reason.reason}' is not valid for stage '${stage.name}'. Please check the stage-reason mappings.` 
      };
    }

    return { isValid: true };
  }

  async validateRequiredFields(
    reasonId: string, 
    fieldResponses?: { customFieldId: string; valueNumber?: number; valueShortText?: string; valueLongText?: string; valueMultiSelect?: string[] }[]
  ): Promise<{ isValid: boolean; reason?: string; missingFields?: string[] }> {
    // Get all required custom fields for this reason
    const requiredFields = await db.query.reasonCustomFields.findMany({
      where: and(
        eq(reasonCustomFields.reasonId, reasonId),
        eq(reasonCustomFields.isRequired, true)
      ),
    });

    if (requiredFields.length === 0) {
      return { isValid: true }; // No required fields, validation passes
    }

    if (!fieldResponses) {
      return {
        isValid: false,
        reason: "Required fields are missing",
        missingFields: requiredFields.map(f => f.fieldName),
      };
    }

    // Check if all required fields have responses
    const providedFieldIds = new Set(fieldResponses.map(fr => fr.customFieldId));
    const missingFields: string[] = [];

    for (const requiredField of requiredFields) {
      if (!providedFieldIds.has(requiredField.id)) {
        missingFields.push(requiredField.fieldName);
        continue;
      }

      // Check if the required field has a value (server-side validation using actual field type)
      const response = fieldResponses.find(fr => fr.customFieldId === requiredField.id);
      if (response) {
        const hasValue = (
          (requiredField.fieldType === 'number' && response.valueNumber !== undefined && response.valueNumber !== null) ||
          (requiredField.fieldType === 'short_text' && response.valueShortText !== undefined && response.valueShortText !== null && response.valueShortText !== '') ||
          (requiredField.fieldType === 'long_text' && response.valueLongText !== undefined && response.valueLongText !== null && response.valueLongText !== '') ||
          (requiredField.fieldType === 'multi_select' && response.valueMultiSelect !== undefined && response.valueMultiSelect !== null && response.valueMultiSelect.length > 0)
        );

        if (!hasValue) {
          missingFields.push(requiredField.fieldName);
        }
      }
    }

    if (missingFields.length > 0) {
      return {
        isValid: false,
        reason: `Required fields are missing values: ${missingFields.join(', ')}`,
        missingFields,
      };
    }

    return { isValid: true };
  }

  async getValidChangeReasonsForStage(stageId: string): Promise<ChangeReason[]> {
    const mappings = await db.query.stageReasonMaps.findMany({
      where: eq(stageReasonMaps.stageId, stageId),
      with: {
        reason: true,
      },
    });

    return mappings.map(mapping => mapping.reason);
  }

  async getProjectProgressMetrics(projectId: string): Promise<{ reasonId: string; label: string; total: number }[]> {
    // Query to aggregate numeric field responses by change reason for a specific project
    // We need to join: reasonFieldResponses -> reasonCustomFields -> changeReasons
    // and also join through projectChronology to filter by projectId
    const results = await db
      .select({
        reasonId: changeReasons.id,
        label: changeReasons.countLabel,
        reason: changeReasons.reason,
        total: sum(reasonFieldResponses.valueNumber).as('total'),
      })
      .from(reasonFieldResponses)
      .innerJoin(reasonCustomFields, eq(reasonFieldResponses.customFieldId, reasonCustomFields.id))
      .innerJoin(changeReasons, eq(reasonCustomFields.reasonId, changeReasons.id))
      .innerJoin(projectChronology, eq(reasonFieldResponses.chronologyId, projectChronology.id))
      .where(
        and(
          eq(projectChronology.projectId, projectId),
          eq(changeReasons.showCountInProject, true),
          eq(reasonFieldResponses.fieldType, 'number'),
          sql`${reasonFieldResponses.valueNumber} IS NOT NULL`
        )
      )
      .groupBy(changeReasons.id, changeReasons.countLabel, changeReasons.reason);

    // Convert the results to the expected format, using countLabel if available, otherwise reason
    return results.map(result => ({
      reasonId: result.reasonId,
      label: result.label || result.reason,
      total: Number(result.total) || 0,
    }));
  }

  // Stage approval operations
  async getAllStageApprovals(): Promise<StageApproval[]> {
    return await db.select().from(stageApprovals);
  }

  async createStageApproval(approval: InsertStageApproval): Promise<StageApproval> {
    try {
      const [newApproval] = await db.insert(stageApprovals).values(approval).returning();
      return newApproval;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error(`Stage approval with name '${approval.name}' already exists`);
      }
      throw error;
    }
  }

  async updateStageApproval(id: string, approval: Partial<InsertStageApproval>): Promise<StageApproval> {
    const [updatedApproval] = await db
      .update(stageApprovals)
      .set(approval)
      .where(eq(stageApprovals.id, id))
      .returning();
      
    if (!updatedApproval) {
      throw new Error("Stage approval not found");
    }
    
    return updatedApproval;
  }

  async deleteStageApproval(id: string): Promise<void> {
    const result = await db.delete(stageApprovals).where(eq(stageApprovals.id, id));
    if (result.rowCount === 0) {
      throw new Error("Stage approval not found");
    }
  }

  async getStageApprovalById(id: string): Promise<StageApproval | undefined> {
    const [approval] = await db.select().from(stageApprovals).where(eq(stageApprovals.id, id));
    return approval;
  }

  // Stage approval fields operations
  async getAllStageApprovalFields(): Promise<StageApprovalField[]> {
    return await db.select().from(stageApprovalFields).orderBy(stageApprovalFields.stageApprovalId, stageApprovalFields.order);
  }

  async getStageApprovalFieldsByApprovalId(approvalId: string): Promise<StageApprovalField[]> {
    return await db.query.stageApprovalFields.findMany({
      where: eq(stageApprovalFields.stageApprovalId, approvalId),
      orderBy: stageApprovalFields.order,
    });
  }

  async createStageApprovalField(field: InsertStageApprovalField): Promise<StageApprovalField> {
    const [newField] = await db.insert(stageApprovalFields).values(field).returning();
    return newField;
  }

  async updateStageApprovalField(id: string, field: Partial<InsertStageApprovalField>): Promise<StageApprovalField> {
    const [updatedField] = await db
      .update(stageApprovalFields)
      .set(field)
      .where(eq(stageApprovalFields.id, id))
      .returning();
      
    if (!updatedField) {
      throw new Error("Stage approval field not found");
    }
    
    return updatedField;
  }

  async deleteStageApprovalField(id: string): Promise<void> {
    const result = await db.delete(stageApprovalFields).where(eq(stageApprovalFields.id, id));
    if (result.rowCount === 0) {
      throw new Error("Stage approval field not found");
    }
  }

  // Stage approval responses operations  
  async createStageApprovalResponse(response: InsertStageApprovalResponse): Promise<StageApprovalResponse> {
    try {
      const [newResponse] = await db.insert(stageApprovalResponses).values(response).returning();
      return newResponse;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error(`Stage approval response already exists for this field and project`);
      }
      if (error instanceof Error && error.message.includes('check_single_value_column')) {
        throw new Error(`Invalid field value: only one value column should be populated based on field type`);
      }
      throw error;
    }
  }

  async getStageApprovalResponsesByProjectId(projectId: string): Promise<StageApprovalResponse[]> {
    return await db.query.stageApprovalResponses.findMany({
      where: eq(stageApprovalResponses.projectId, projectId),
      with: {
        field: {
          with: {
            stageApproval: true,
          },
        },
      },
    });
  }

  // Stage approval validation
  async validateStageApprovalResponses(approvalId: string, responses: InsertStageApprovalResponse[]): Promise<{ isValid: boolean; reason?: string; failedFields?: string[] }> {
    // Load all fields for the approval
    const fields = await this.getStageApprovalFieldsByApprovalId(approvalId);
    
    if (fields.length === 0) {
      return { isValid: true }; // No fields to validate
    }

    // Get all required fields for the approval (where isRequired = true)
    const requiredFields = fields.filter(field => field.isRequired);
    
    // Create maps for easy lookup
    const responseMap = new Map<string, InsertStageApprovalResponse>();
    responses.forEach(response => {
      responseMap.set(response.fieldId, response);
    });

    const failedFields: string[] = [];

    // CRITICAL FIX 1: Check that each required field has a corresponding response
    for (const requiredField of requiredFields) {
      if (!responseMap.has(requiredField.id)) {
        failedFields.push(requiredField.fieldName);
      }
    }

    // Validate each provided response
    for (const response of responses) {
      const field = fields.find(f => f.id === response.fieldId);
      if (!field) {
        failedFields.push(`Field ID ${response.fieldId} not found`);
        continue;
      }

      // CRITICAL FIX 2: Ensure exactly one value field is populated based on fieldType
      const hasBoolean = response.valueBoolean !== undefined && response.valueBoolean !== null;
      const hasNumber = response.valueNumber !== undefined && response.valueNumber !== null;
      const hasLongText = response.valueLongText !== undefined && response.valueLongText !== null && response.valueLongText !== '';
      
      let validFieldMatch = false;
      if (field.fieldType === 'boolean') {
        validFieldMatch = hasBoolean && !hasNumber && !hasLongText;
      } else if (field.fieldType === 'number') {
        validFieldMatch = !hasBoolean && hasNumber && !hasLongText;
      } else if (field.fieldType === 'long_text') {
        validFieldMatch = !hasBoolean && !hasNumber && hasLongText;
      }
      
      if (!validFieldMatch) {
        failedFields.push(`${field.fieldName}: field type '${field.fieldType}' requires exactly one matching value field`);
        continue;
      }

      // Validate field values against expected criteria
      if (field.fieldType === 'boolean') {
        // For boolean fields: check response.valueBoolean matches field.expectedValueBoolean
        if (field.expectedValueBoolean !== null && response.valueBoolean !== field.expectedValueBoolean) {
          failedFields.push(field.fieldName);
        }
      } else if (field.fieldType === 'number') {
        // For number fields: check response.valueNumber against field.expectedValueNumber using field.comparisonType
        if (field.expectedValueNumber !== null && field.comparisonType && response.valueNumber !== null) {
          const responseValue = response.valueNumber;
          const expectedValue = field.expectedValueNumber;
          let isValid = false;

          switch (field.comparisonType) {
            case 'equal_to':
              isValid = responseValue === expectedValue;
              break;
            case 'less_than':
              isValid = responseValue !== undefined && responseValue < expectedValue;
              break;
            case 'greater_than':
              isValid = responseValue !== undefined && responseValue > expectedValue;
              break;
          }

          if (!isValid) {
            failedFields.push(field.fieldName);
          }
        } else if (field.isRequired && (response.valueNumber === null || response.valueNumber === undefined)) {
          failedFields.push(field.fieldName);
        }
      } else if (field.fieldType === 'long_text') {
        // For long_text fields: just check not empty if required
        if (field.isRequired && (!response.valueLongText || response.valueLongText.trim() === '')) {
          failedFields.push(field.fieldName);
        }
      }
    }

    if (failedFields.length > 0) {
      return {
        isValid: false,
        reason: `Validation failed for fields: ${failedFields.join(', ')}`,
        failedFields,
      };
    }

    return { isValid: true };
  }
}

export const storage = new DatabaseStorage();
