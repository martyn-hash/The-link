import {
  users,
  clients,
  people,
  clientPeople,
  projects,
  projectChronology,
  kanbanStages,
  changeReasons,
  projectTypes,
  stageReasonMaps,
  reasonCustomFields,
  reasonFieldResponses,
  stageApprovals,
  stageApprovalFields,
  stageApprovalResponses,
  magicLinkTokens,
  userNotificationPreferences,
  services,
  workRoles,
  serviceRoles,
  clientServices,
  clientServiceRoleAssignments,
  chChangeRequests,
  normalizeProjectMonth,
  type User,
  type UpsertUser,
  type InsertUser,
  type Client,
  type InsertClient,
  type Person,
  type InsertPerson,
  type ClientPerson,
  type InsertClientPerson,
  type Project,
  type InsertProject,
  type ProjectChronology,
  type InsertProjectChronology,
  type KanbanStage,
  type InsertKanbanStage,
  type ChangeReason,
  type InsertChangeReason,
  type ProjectType,
  type InsertProjectType,
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
  type MagicLinkToken,
  type InsertMagicLinkToken,
  type UserNotificationPreferences,
  type InsertUserNotificationPreferences,
  type UpdateUserNotificationPreferences,
  type Service,
  type InsertService,
  type WorkRole,
  type InsertWorkRole,
  type ServiceRole,
  type InsertServiceRole,
  type ClientService,
  type InsertClientService,
  type ClientServiceRoleAssignment,
  type InsertClientServiceRoleAssignment,
  type ChChangeRequest,
  type InsertChChangeRequest,
  type UpdateChChangeRequest,
  type ProjectWithRelations,
  type UpdateProjectStatus,
  type UpdateProjectType,
} from "@shared/schema";
import bcrypt from "bcrypt";
import { calculateBusinessHours } from "@shared/businessTime";
import { db } from "./db";
import { sendStageChangeNotificationEmail, sendBulkProjectAssignmentSummaryEmail } from "./emailService";
import { eq, desc, and, inArray, sql, sum, lt } from "drizzle-orm";

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
  getClientById(id: string): Promise<Client | undefined>;
  getClientByName(name: string): Promise<Client | undefined>;
  getAllClients(): Promise<Client[]>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: string): Promise<void>;
  
  // Companies House specific client operations
  getClientByCompanyNumber(companyNumber: string): Promise<Client | undefined>;
  upsertClientFromCH(clientData: Partial<InsertClient>): Promise<Client>;
  
  // People operations  
  createPerson(person: InsertPerson): Promise<Person>;
  getPersonById(id: string): Promise<Person | undefined>;
  getPersonByPersonNumber(personNumber: string): Promise<Person | undefined>;
  getAllPeople(): Promise<Person[]>;
  updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person>;
  deletePerson(id: string): Promise<void>;
  upsertPersonFromCH(personData: Partial<InsertPerson>): Promise<Person>;
  
  // Client-People relationship operations
  createClientPerson(relationship: InsertClientPerson): Promise<ClientPerson>;
  getClientPeopleByClientId(clientId: string): Promise<(ClientPerson & { person: Person })[]>;
  getClientPeopleByPersonId(personId: string): Promise<(ClientPerson & { client: Client })[]>;
  updateClientPerson(id: string, relationship: Partial<InsertClientPerson>): Promise<ClientPerson>;
  deleteClientPerson(id: string): Promise<void>;
  linkPersonToClient(clientId: string, personId: string, officerRole?: string, isPrimaryContact?: boolean): Promise<ClientPerson>;
  
  // Project operations
  createProject(project: InsertProject): Promise<Project>;
  getAllProjects(): Promise<ProjectWithRelations[]>;
  getProjectsByUser(userId: string, role: string): Promise<ProjectWithRelations[]>;
  getProject(id: string): Promise<ProjectWithRelations | undefined>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project>;
  updateProjectStatus(update: UpdateProjectStatus, userId: string): Promise<Project>;
  
  // Chronology operations
  createChronologyEntry(entry: InsertProjectChronology): Promise<ProjectChronology>;
  getProjectChronology(projectId: string): Promise<(ProjectChronology & { assignee?: User; fieldResponses: (ReasonFieldResponse & { customField: ReasonCustomField })[] })[]>;
  
  // Configuration operations
  getAllKanbanStages(): Promise<KanbanStage[]>;
  getKanbanStagesByProjectTypeId(projectTypeId: string): Promise<KanbanStage[]>;
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
  getChangeReasonsByProjectTypeId(projectTypeId: string): Promise<ChangeReason[]>;
  createChangeReason(reason: InsertChangeReason): Promise<ChangeReason>;
  updateChangeReason(id: string, reason: Partial<InsertChangeReason>): Promise<ChangeReason>;
  deleteChangeReason(id: string): Promise<void>;
  
  // Project type operations
  getAllProjectTypes(): Promise<ProjectType[]>;
  getProjectTypeById(id: string): Promise<ProjectType | undefined>;
  createProjectType(projectType: InsertProjectType): Promise<ProjectType>;
  updateProjectType(id: string, projectType: Partial<InsertProjectType>): Promise<ProjectType>;
  deleteProjectType(id: string): Promise<void>;
  getProjectTypeByName(name: string): Promise<ProjectType | undefined>;
  countActiveProjectsUsingProjectType(projectTypeId: string): Promise<number>;
  
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
  getStageApprovalsByProjectTypeId(projectTypeId: string): Promise<StageApproval[]>;
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
  
  // Magic link operations
  createMagicLinkToken(token: InsertMagicLinkToken): Promise<MagicLinkToken>;
  getMagicLinkTokenByToken(token: string): Promise<MagicLinkToken | undefined>;
  getMagicLinkTokenByCodeAndEmail(code: string, email: string): Promise<MagicLinkToken | undefined>;
  markMagicLinkTokenAsUsed(id: string): Promise<void>;
  cleanupExpiredMagicLinkTokens(): Promise<void>;
  getValidMagicLinkTokensForUser(userId: string): Promise<MagicLinkToken[]>;
  
  // User notification preferences operations
  getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | undefined>;
  createUserNotificationPreferences(preferences: InsertUserNotificationPreferences): Promise<UserNotificationPreferences>;
  updateUserNotificationPreferences(userId: string, preferences: UpdateUserNotificationPreferences): Promise<UserNotificationPreferences>;
  getOrCreateDefaultNotificationPreferences(userId: string): Promise<UserNotificationPreferences>;
  
  // Bulk project notification handling
  sendBulkProjectAssignmentNotifications(createdProjects: Project[]): Promise<void>;
  
  // User role operations
  getUsersByRole(role: string): Promise<User[]>;
  
  // Stage change notification operations
  sendStageChangeNotifications(projectId: string, newStageName: string, oldStageName?: string): Promise<void>;
  
  // Services CRUD
  getAllServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]>;
  getActiveServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]>;
  getServiceById(id: string): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: string): Promise<void>;
  getServiceByProjectTypeId(projectTypeId: string): Promise<Service | undefined>;

  // Work Roles CRUD  
  getAllWorkRoles(): Promise<WorkRole[]>;
  getWorkRoleById(id: string): Promise<WorkRole | undefined>;
  createWorkRole(role: InsertWorkRole): Promise<WorkRole>;
  updateWorkRole(id: string, role: Partial<InsertWorkRole>): Promise<WorkRole>;
  deleteWorkRole(id: string): Promise<void>;

  // Service-Role Mappings
  getServiceRolesByServiceId(serviceId: string): Promise<ServiceRole[]>;
  getServiceByProjectTypeId(projectTypeId: string): Promise<Service | undefined>;
  getWorkRolesByServiceId(serviceId: string): Promise<WorkRole[]>;
  addRoleToService(serviceId: string, roleId: string): Promise<ServiceRole>;
  removeRoleFromService(serviceId: string, roleId: string): Promise<void>;

  // Client Services CRUD
  getAllClientServices(): Promise<(ClientService & { client: Client; service: Service & { projectType: ProjectType } })[]>;
  getClientServiceById(id: string): Promise<(ClientService & { client: Client; service: Service & { projectType: ProjectType } }) | undefined>;
  getClientServicesByClientId(clientId: string): Promise<(ClientService & { service: Service & { projectType: ProjectType } })[]>;
  getClientServicesByServiceId(serviceId: string): Promise<(ClientService & { client: Client })[]>;
  createClientService(clientService: InsertClientService): Promise<ClientService>;
  updateClientService(id: string, clientService: Partial<InsertClientService>): Promise<ClientService>;
  deleteClientService(id: string): Promise<void>;
  getClientServiceByClientAndProjectType(clientId: string, projectTypeId: string): Promise<ClientService | undefined>;

  // Client Service Role Assignments CRUD
  getClientServiceRoleAssignments(clientServiceId: string): Promise<(ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[]>;
  getActiveClientServiceRoleAssignments(clientServiceId: string): Promise<(ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[]>;
  createClientServiceRoleAssignment(assignment: InsertClientServiceRoleAssignment): Promise<ClientServiceRoleAssignment>;
  updateClientServiceRoleAssignment(id: string, assignment: Partial<InsertClientServiceRoleAssignment>): Promise<ClientServiceRoleAssignment>;
  deactivateClientServiceRoleAssignment(id: string): Promise<ClientServiceRoleAssignment>;
  deleteClientServiceRoleAssignment(id: string): Promise<void>;

  // Role Resolution for Project Creation
  resolveRoleAssigneeForClient(clientId: string, projectTypeId: string, roleName: string): Promise<User | undefined>;
  getFallbackUser(): Promise<User | undefined>;
  setFallbackUser(userId: string): Promise<User>;
  resolveProjectAssignments(clientId: string, projectTypeId: string): Promise<{
    bookkeeperId: string;
    clientManagerId: string;
    currentAssigneeId: string;
    usedFallback: boolean;
    fallbackRoles: string[];
  }>;

  // Validation Methods
  validateClientServiceRoleCompleteness(clientId: string, serviceId: string): Promise<{ isComplete: boolean; missingRoles: string[]; assignedRoles: { roleName: string; userName: string }[] }>;
  checkClientServiceMappingExists(clientId: string, serviceId: string): Promise<boolean>;
  validateAssignedRolesAgainstService(serviceId: string, roleIds: string[]): Promise<{ isValid: boolean; invalidRoles: string[]; allowedRoles: string[] }>;
  
  // Service Owner Resolution
  resolveServiceOwner(clientId: string, projectTypeId: string): Promise<User | undefined>;

  // Companies House Change Requests CRUD
  getAllChChangeRequests(): Promise<(ChChangeRequest & { client: Client; approvedByUser?: User })[]>;
  getChChangeRequestById(id: string): Promise<(ChChangeRequest & { client: Client; approvedByUser?: User }) | undefined>;
  getChChangeRequestsByClientId(clientId: string): Promise<ChChangeRequest[]>;
  getPendingChChangeRequests(): Promise<(ChChangeRequest & { client: Client })[]>;
  createChChangeRequest(request: InsertChChangeRequest): Promise<ChChangeRequest>;
  updateChChangeRequest(id: string, request: Partial<UpdateChChangeRequest>): Promise<ChChangeRequest>;
  approveChChangeRequest(id: string, approvedBy: string, notes?: string): Promise<ChChangeRequest>;
  rejectChChangeRequest(id: string, approvedBy: string, notes?: string): Promise<ChChangeRequest>;
  deleteChChangeRequest(id: string): Promise<void>;
  
  // Companies House Data Synchronization
  detectChDataChanges(clientId: string, newChData: any): Promise<ChChangeRequest[]>;
  applyChChangeRequests(requestIds: string[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // In-memory storage for impersonation state (dev/testing only)
  private impersonationStates = new Map<string, { originalUserId: string; impersonatedUserId: string }>();
  // In-memory storage for verification attempts (basic DoS protection)
  private verificationAttempts = new Map<string, { count: number; resetTime: number }>();
  // PERFORMANCE FIX: In-memory deduplication cache for notifications
  private recentNotifications = new Map<string, number>();

  // Helper method to check verification rate limiting
  private checkVerificationRateLimit(key: string): boolean {
    const MAX_ATTEMPTS = 10; // Max 10 attempts per key per hour
    const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
    const now = Date.now();
    const existing = this.verificationAttempts.get(key);
    
    if (!existing || now > existing.resetTime) {
      // First attempt or window expired
      this.verificationAttempts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return true;
    }
    
    if (existing.count >= MAX_ATTEMPTS) {
      return false; // Rate limited
    }
    
    // Increment count
    existing.count += 1;
    return true;
  }

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

  async getUsersByRole(role: string): Promise<User[]> {
    // TYPE FIX: Use proper TypeScript typing instead of 'as any'
    // Validate role against defined enum values to prevent runtime errors
    const validRoles = ['admin', 'manager', 'client_manager', 'bookkeeper'] as const;
    if (!validRoles.includes(role as any)) {
      console.warn(`Invalid role provided to getUsersByRole: ${role}`);
      return [];
    }
    return await db.select().from(users).where(eq(users.role, role as typeof validRoles[number]));
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

  // User notification preferences operations
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId));
    return preferences;
  }

  async createUserNotificationPreferences(preferences: InsertUserNotificationPreferences): Promise<UserNotificationPreferences> {
    const [newPreferences] = await db
      .insert(userNotificationPreferences)
      .values(preferences)
      .returning();
    return newPreferences;
  }

  async updateUserNotificationPreferences(userId: string, preferences: UpdateUserNotificationPreferences): Promise<UserNotificationPreferences> {
    const [updatedPreferences] = await db
      .update(userNotificationPreferences)
      .set({
        ...preferences,
        updatedAt: new Date(),
      })
      .where(eq(userNotificationPreferences.userId, userId))
      .returning();
    
    if (!updatedPreferences) {
      throw new Error("User notification preferences not found");
    }
    
    return updatedPreferences;
  }

  async getOrCreateDefaultNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
    // First, try to get existing preferences
    const existing = await this.getUserNotificationPreferences(userId);
    if (existing) {
      return existing;
    }

    // If no preferences exist, create default ones
    const defaultPreferences: InsertUserNotificationPreferences = {
      userId,
      notifyStageChanges: true,
      notifyNewProjects: true,
    };

    return await this.createUserNotificationPreferences(defaultPreferences);
  }

  async sendBulkProjectAssignmentNotifications(createdProjects: Project[]): Promise<void> {
    if (!createdProjects || createdProjects.length === 0) {
      return;
    }

    // DEDUPLICATION CACHE: Check if we've already sent notifications for this batch recently
    const batchKey = createdProjects.map(p => p.id).sort().join(',');
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    if (this.recentNotifications.has(batchKey)) {
      const lastSent = this.recentNotifications.get(batchKey)!;
      if (now - lastSent < CACHE_DURATION) {
        console.log('Bulk notifications already sent recently for this batch, skipping to prevent duplicates');
        return;
      }
    }
    
    // CRITICAL FIX: Group projects by ALL assignee types (not just clientManagerId)
    const assigneeProjectCounts = new Map<string, number>();
    
    for (const project of createdProjects) {
      // Include all three assignee types: bookkeeperId, clientManagerId, currentAssigneeId
      const assigneeIds = [
        project.bookkeeperId,
        project.clientManagerId,
        project.currentAssigneeId
      ].filter((id): id is string => Boolean(id)); // Remove null/undefined values
      
      for (const assigneeId of assigneeIds) {
        const currentCount = assigneeProjectCounts.get(assigneeId) || 0;
        assigneeProjectCounts.set(assigneeId, currentCount + 1);
      }
    }

    if (assigneeProjectCounts.size === 0) {
      console.log('No valid assignees found for bulk project notifications');
      return;
    }

    // PERFORMANCE FIX: Batch-load users and preferences using inArray
    const allAssigneeIds = Array.from(assigneeProjectCounts.keys());
    console.log(`Queuing bulk project notifications for ${allAssigneeIds.length} assignees (${createdProjects.length} projects total)`);
    
    // Batch load users
    const assignees = await db.select().from(users).where(inArray(users.id, allAssigneeIds));
    const assigneeMap = new Map(assignees.map(user => [user.id, user]));
    
    // Batch load notification preferences
    const existingPreferences = await db
      .select()
      .from(userNotificationPreferences)
      .where(inArray(userNotificationPreferences.userId, allAssigneeIds));
    const preferencesMap = new Map(existingPreferences.map(pref => [pref.userId, pref]));

    // Create default preferences for users who don't have them
    const usersNeedingDefaults = allAssigneeIds.filter(id => !preferencesMap.has(id));
    if (usersNeedingDefaults.length > 0) {
      const defaultPreferences = usersNeedingDefaults.map(userId => ({
        userId,
        notifyStageChanges: true,
        notifyNewProjects: true,
      }));
      
      const createdDefaults = await db
        .insert(userNotificationPreferences)
        .values(defaultPreferences)
        .returning();
      
      // Add to preferences map
      createdDefaults.forEach(pref => preferencesMap.set(pref.userId, pref));
    }

    // Send summary emails to each assignee
    const emailPromises: { promise: Promise<boolean>; userEmail: string; projectCount: number }[] = [];
    let skippedCount = 0;
    
    for (const [assigneeId, projectCount] of Array.from(assigneeProjectCounts.entries())) {
      try {
        const assignee = assigneeMap.get(assigneeId);
        if (!assignee) {
          console.warn(`Assignee with ID ${assigneeId} not found for bulk notification`);
          continue;
        }

        // EMAIL VALIDATION: Check that email exists before sending
        if (!assignee.email || assignee.email.trim() === '') {
          console.warn(`Assignee ${assignee.firstName} ${assignee.lastName} (ID: ${assigneeId}) has no email address, skipping notification`);
          continue;
        }

        // Check notification preferences
        const preferences = preferencesMap.get(assigneeId);
        if (!preferences?.notifyNewProjects) {
          console.log(`User ${assignee.email} has disabled new project notifications, skipping bulk notification`);
          skippedCount++;
          continue;
        }

        // Send bulk summary email
        const emailPromise = sendBulkProjectAssignmentSummaryEmail(
          assignee.email,
          `${assignee.firstName} ${assignee.lastName}`.trim() || assignee.email,
          projectCount
        );

        emailPromises.push({
          promise: emailPromise,
          userEmail: assignee.email,
          projectCount
        });
        
        console.log(`Queued bulk project assignment notification for ${assignee.email}: ${projectCount} projects`);
      } catch (error) {
        console.error(`Failed to queue bulk notification for assignee ${assigneeId}:`, error);
      }
    }

    // LOGGING FIX: Wait for all emails and report actual delivery status
    if (emailPromises.length > 0) {
      console.log(`Processing ${emailPromises.length} bulk notification emails...`);
      
      const results = await Promise.allSettled(emailPromises.map(ep => ep.promise));
      
      // Count successes and failures
      let successCount = 0;
      let failureCount = 0;
      
      results.forEach((result, index) => {
        const emailInfo = emailPromises[index];
        if (result.status === 'fulfilled') {
          successCount++;
          console.log(`✓ Successfully delivered bulk notification to ${emailInfo.userEmail} (${emailInfo.projectCount} projects)`);
        } else {
          failureCount++;
          console.error(`✗ Failed to deliver bulk notification to ${emailInfo.userEmail}:`, result.reason);
        }
      });
      
      console.log(`Bulk project notifications completed: ${successCount} delivered, ${failureCount} failed, ${skippedCount} skipped (preferences disabled)`);
      
      // Mark this batch as processed to prevent duplicates
      this.recentNotifications.set(batchKey, now);
      
      // Clean up old cache entries (keep only last 100 entries)
      if (this.recentNotifications.size > 100) {
        const entries = Array.from(this.recentNotifications.entries());
        entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp descending
        this.recentNotifications.clear();
        entries.slice(0, 50).forEach(([key, timestamp]) => {
          this.recentNotifications.set(key, timestamp);
        });
      }
    } else {
      console.log('No bulk project notifications to send after filtering');
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

  async getClientById(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByName(name: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.name, name));
    return client;
  }

  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients);
  }

  async updateClient(id: string, clientData: Partial<InsertClient>): Promise<Client> {
    const [client] = await db
      .update(clients)
      .set(clientData)
      .where(eq(clients.id, id))
      .returning();
    
    if (!client) {
      throw new Error(`Client with ID '${id}' not found`);
    }
    
    return client;
  }

  async deleteClient(id: string): Promise<void> {
    // Check if client exists first
    const existingClient = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    
    if (existingClient.length === 0) {
      throw new Error(`Client with ID '${id}' not found`);
    }
    
    // Check if client has any projects (should prevent deletion if there are projects)
    const clientProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.clientId, id))
      .limit(1);
    
    if (clientProjects.length > 0) {
      throw new Error(`Cannot delete client: client has existing projects`);
    }
    
    // Delete client services and role assignments first (cascade cleanup)
    const clientServicesResult = await db
      .select()
      .from(clientServices)
      .where(eq(clientServices.clientId, id));
    
    for (const clientService of clientServicesResult) {
      // Delete role assignments for this client service
      await db
        .delete(clientServiceRoleAssignments)
        .where(eq(clientServiceRoleAssignments.clientServiceId, clientService.id));
    }
    
    // Delete client services
    await db
      .delete(clientServices)
      .where(eq(clientServices.clientId, id));
    
    // Finally delete the client
    const result = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new Error(`Failed to delete client with ID '${id}'`);
    }
  }

  // People operations
  async createPerson(personData: InsertPerson): Promise<Person> {
    const [person] = await db.insert(people).values(personData).returning();
    return person;
  }

  async getPersonById(id: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.id, id));
    return person;
  }

  async getPersonByPersonNumber(personNumber: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.personNumber, personNumber));
    return person;
  }

  async getAllPeople(): Promise<Person[]> {
    return await db.select().from(people);
  }

  async updatePerson(id: string, personData: Partial<InsertPerson>): Promise<Person> {
    const [person] = await db
      .update(people)
      .set(personData)
      .where(eq(people.id, id))
      .returning();
    
    if (!person) {
      throw new Error(`Person with ID '${id}' not found`);
    }
    
    return person;
  }

  async deletePerson(id: string): Promise<void> {
    const result = await db
      .delete(people)
      .where(eq(people.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new Error(`Person with ID '${id}' not found`);
    }
  }

  // Client-People relationship operations
  async createClientPerson(relationship: InsertClientPerson): Promise<ClientPerson> {
    const [clientPerson] = await db.insert(clientPeople).values(relationship).returning();
    return clientPerson;
  }

  async getClientPeopleByClientId(clientId: string): Promise<(ClientPerson & { person: Person })[]> {
    const result = await db
      .select({
        clientPerson: clientPeople,
        person: people
      })
      .from(clientPeople)
      .innerJoin(people, eq(clientPeople.personId, people.id))
      .where(eq(clientPeople.clientId, clientId));
    
    return result.map(row => ({
      ...row.clientPerson,
      person: row.person
    }));
  }

  async getClientPeopleByPersonId(personId: string): Promise<(ClientPerson & { client: Client })[]> {
    const result = await db
      .select({
        clientPerson: clientPeople,
        client: clients
      })
      .from(clientPeople)
      .innerJoin(clients, eq(clientPeople.clientId, clients.id))
      .where(eq(clientPeople.personId, personId));
    
    return result.map(row => ({
      ...row.clientPerson,
      client: row.client
    }));
  }

  async updateClientPerson(id: string, relationship: Partial<InsertClientPerson>): Promise<ClientPerson> {
    const [clientPerson] = await db
      .update(clientPeople)
      .set(relationship)
      .where(eq(clientPeople.id, id))
      .returning();
    
    if (!clientPerson) {
      throw new Error(`Client-person relationship with ID '${id}' not found`);
    }
    
    return clientPerson;
  }

  async deleteClientPerson(id: string): Promise<void> {
    const result = await db
      .delete(clientPeople)
      .where(eq(clientPeople.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new Error(`Client-person relationship with ID '${id}' not found`);
    }
  }

  // Companies House specific operations
  async upsertClientFromCH(clientData: Partial<InsertClient>): Promise<Client> {
    // Check if client with this company number already exists
    if (clientData.companyNumber) {
      const existingClient = await this.getClientByCompanyNumber(clientData.companyNumber);
      if (existingClient) {
        // Update existing client with CH data (exclude id from update)
        const { id, ...updateData } = clientData;
        return await this.updateClient(existingClient.id, updateData);
      }
    }
    
    // Create new client
    return await this.createClient(clientData as InsertClient);
  }

  async upsertPersonFromCH(personData: Partial<InsertPerson>): Promise<Person> {
    // Check if person exists by person number (if available)
    if (personData.personNumber) {
      const existingPerson = await this.getPersonByPersonNumber(personData.personNumber);
      
      if (existingPerson) {
        // Update existing person (exclude id from update)
        const { id, ...updateData } = personData;
        return await this.updatePerson(existingPerson.id, updateData);
      }
    }
    
    // Create new person
    const personId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const personWithId = { ...personData, id: personId } as InsertPerson;
    
    return await this.createPerson(personWithId);
  }

  async linkPersonToClient(clientId: string, personId: string, officerRole?: string, isPrimaryContact?: boolean): Promise<ClientPerson> {
    // Check if relationship already exists
    const [existingLink] = await db
      .select()
      .from(clientPeople)
      .where(
        and(
          eq(clientPeople.clientId, clientId),
          eq(clientPeople.personId, personId)
        )
      )
      .limit(1);
    
    if (existingLink) {
      // Update existing relationship
      const [updatedLink] = await db
        .update(clientPeople)
        .set({
          officerRole,
          isPrimaryContact: isPrimaryContact ?? false
        })
        .where(eq(clientPeople.id, existingLink.id))
        .returning();
      return updatedLink;
    }
    
    // Create new relationship
    const relationshipId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const linkData: InsertClientPerson = {
      id: relationshipId,
      clientId,
      personId,
      officerRole,
      isPrimaryContact: isPrimaryContact ?? false
    };
    
    const [clientPerson] = await db.insert(clientPeople).values(linkData).returning();
    return clientPerson;
  }

  async getClientWithPeople(clientId: string): Promise<(Client & { people: (Person & { officerRole?: string })[] }) | undefined> {
    // Get client
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return undefined;
    
    // Get related people with their officer roles
    const clientPeopleData = await db
      .select({
        person: people,
        officerRole: clientPeople.officerRole
      })
      .from(clientPeople)
      .innerJoin(people, eq(clientPeople.personId, people.id))
      .where(eq(clientPeople.clientId, clientId));
    
    const peopleWithRoles = clientPeopleData.map(row => ({
      ...row.person,
      officerRole: row.officerRole
    }));
    
    return {
      ...client,
      people: peopleWithRoles
    };
  }

  async getClientByCompanyNumber(companyNumber: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.companyNumber, companyNumber))
      .limit(1);
    return client;
  }

  async unlinkPersonFromClient(clientId: string, personId: string): Promise<void> {
    await db
      .delete(clientPeople)
      .where(
        and(
          eq(clientPeople.clientId, clientId),
          eq(clientPeople.personId, personId)
        )
      );
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

    // Check if project type is mapped to a service for role-based assignments
    const service = await this.getServiceByProjectTypeId(finalProjectData.projectTypeId);
    
    if (service) {
      // Project type is mapped to a service - use role-based assignments
      try {
        const clientService = await this.getClientServiceByClientAndProjectType(
          finalProjectData.clientId, 
          finalProjectData.projectTypeId
        );
        
        if (clientService) {
          // Use role-based assignment logic
          const roleAssignments = await this.resolveProjectAssignments(
            finalProjectData.clientId, 
            finalProjectData.projectTypeId
          );
          
          // Override the user assignments with role-based assignments
          finalProjectData.bookkeeperId = roleAssignments.bookkeeperId;
          finalProjectData.clientManagerId = roleAssignments.clientManagerId;
          finalProjectData.currentAssigneeId = roleAssignments.currentAssigneeId;
          
          if (roleAssignments.usedFallback) {
            console.warn(
              `Project creation used fallback user for roles: ${roleAssignments.fallbackRoles.join(', ')}`
            );
          }
        } else {
          // Service exists but client doesn't have service mapping
          console.warn(
            `Project type ${finalProjectData.projectTypeId} is service-mapped but client ${finalProjectData.clientId} has no service assignment. Using direct user assignments.`
          );
          
          // Validate that required fields are present for direct assignment
          if (!finalProjectData.bookkeeperId || !finalProjectData.clientManagerId) {
            throw new Error("Project type is service-mapped but client has no service assignment. Direct user assignments (bookkeeperId, clientManagerId) are required.");
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('cannot use role-based assignments')) {
          // Role-based assignment failed, fallback to direct assignment
          console.warn(
            `Role-based assignment failed for project type ${finalProjectData.projectTypeId}: ${error.message}. Using direct user assignments.`
          );
          
          // Validate that required fields are present for direct assignment
          if (!finalProjectData.bookkeeperId || !finalProjectData.clientManagerId) {
            throw new Error("Role-based assignment failed and direct user assignments (bookkeeperId, clientManagerId) are missing.");
          }
        } else {
          throw error; // Re-throw other errors
        }
      }
    } else {
      // Project type is NOT mapped to a service - use direct user assignments (existing logic)
      if (!finalProjectData.bookkeeperId || !finalProjectData.clientManagerId) {
        throw new Error("Project type is not service-mapped. Direct user assignments (bookkeeperId, clientManagerId) are required.");
      }
    }

    // Set project owner based on service owner resolution
    if (service) {
      // For service-mapped projects, resolve the effective service owner
      const serviceOwner = await this.resolveServiceOwner(finalProjectData.clientId, finalProjectData.projectTypeId);
      if (serviceOwner) {
        finalProjectData.projectOwnerId = serviceOwner.id;
        console.log(`Project owner set to service owner: ${serviceOwner.email} (${serviceOwner.id})`);
      } else {
        console.warn(`No service owner found for client ${finalProjectData.clientId} and project type ${finalProjectData.projectTypeId}`);
      }
    }
    // For non-service-mapped projects, projectOwnerId remains null (which is fine since it's nullable)

    // Ensure currentAssigneeId is set if not already assigned
    if (!finalProjectData.currentAssigneeId) {
      finalProjectData.currentAssigneeId = finalProjectData.clientManagerId;
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

  async getAllProjects(filters?: { month?: string; archived?: boolean; inactive?: boolean }): Promise<ProjectWithRelations[]> {
    let whereConditions = [];
    
    if (filters?.month) {
      whereConditions.push(eq(projects.projectMonth, filters.month));
    }
    
    if (filters?.archived !== undefined) {
      whereConditions.push(eq(projects.archived, filters.archived));
    }
    
    if (filters?.inactive !== undefined) {
      whereConditions.push(eq(projects.inactive, filters.inactive));
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

  async getProjectsByUser(userId: string, role: string, filters?: { month?: string; archived?: boolean; inactive?: boolean }): Promise<ProjectWithRelations[]> {
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
    
    if (filters?.inactive !== undefined) {
      whereConditions.push(eq(projects.inactive, filters.inactive));
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

  async updateProject(id: string, updateData: Partial<InsertProject>): Promise<Project> {
    const [updatedProject] = await db
      .update(projects)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (!updatedProject) {
      throw new Error("Project not found");
    }

    return updatedProject;
  }

  async updateProjectStatus(update: UpdateProjectStatus, userId: string): Promise<Project> {
    const project = await this.getProject(update.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // CRITICAL FIX: Capture the old status before any transaction to ensure reliable scope
    const oldStatus = project.currentStatus;

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
    const updatedProject = await db.transaction(async (tx) => {
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

    // Send stage change notifications after successful project update
    // This is done outside the transaction to avoid affecting the project update if notifications fail
    // CRITICAL FIX: Use captured oldStatus instead of project.currentStatus to avoid scope issues
    await this.sendStageChangeNotifications(update.projectId, update.newStatus, oldStatus);

    return updatedProject;
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

  async getKanbanStagesByProjectTypeId(projectTypeId: string): Promise<KanbanStage[]> {
    return await db
      .select()
      .from(kanbanStages)
      .where(eq(kanbanStages.projectTypeId, projectTypeId))
      .orderBy(kanbanStages.order);
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

  async getChangeReasonsByProjectTypeId(projectTypeId: string): Promise<ChangeReason[]> {
    return await db
      .select()
      .from(changeReasons)
      .where(eq(changeReasons.projectTypeId, projectTypeId));
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
  async getAllProjectTypes(): Promise<ProjectType[]> {
    return await db.select().from(projectTypes).orderBy(projectTypes.name);
  }

  async getProjectTypeById(id: string): Promise<ProjectType | undefined> {
    const [projectType] = await db.select().from(projectTypes).where(eq(projectTypes.id, id));
    return projectType;
  }

  async createProjectType(projectType: InsertProjectType): Promise<ProjectType> {
    const [newProjectType] = await db.insert(projectTypes).values(projectType).returning();
    return newProjectType;
  }

  async updateProjectType(id: string, projectType: Partial<InsertProjectType>): Promise<ProjectType> {
    const [updatedDescription] = await db
      .update(projectTypes)
      .set(projectType)
      .where(eq(projectTypes.id, id))
      .returning();
      
    if (!updatedDescription) {
      throw new Error("Project description not found");
    }
    
    return updatedDescription;
  }

  async deleteProjectType(id: string): Promise<void> {
    const result = await db.delete(projectTypes).where(eq(projectTypes.id, id));
    if (result.rowCount === 0) {
      throw new Error("Project description not found");
    }
  }

  async getProjectTypeByName(name: string): Promise<ProjectType | undefined> {
    const [projectType] = await db.select().from(projectTypes).where(eq(projectTypes.name, name));
    return projectType;
  }

  async countActiveProjectsUsingProjectType(projectTypeId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(
        and(
          eq(projects.projectTypeId, projectTypeId),
          eq(projects.archived, false),
          eq(projects.inactive, false)
        )
      );
    return result[0]?.count || 0;
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

        // We'll create "Not Completed in Time" stage per project type as needed in the loop

        // Process each CSV row
        for (const data of projectsData) {
          try {
            // Find project type for this description
            const projectType = await this.getProjectTypeByName(data.projectDescription);
            if (!projectType) {
              throw new Error(`Project type '${data.projectDescription}' not found. Please configure this project type in the admin area before importing.`);
            }

            // Find or create client
            let client = await this.getClientByName(data.clientName);
            if (!client) {
              const [newClient] = await tx.insert(clients).values({
                name: data.clientName,
                email: data.clientEmail,
              }).returning();
              client = newClient;
            }

            // Determine user assignments - check if project type is service-mapped
            let finalBookkeeperId: string;
            let finalClientManagerId: string;
            let finalCurrentAssigneeId: string;
            let usedRoleBasedAssignment = false;

            const service = await this.getServiceByProjectTypeId(projectType.id);
            
            if (service) {
              // Project type is mapped to a service - try role-based assignments
              try {
                const clientService = await this.getClientServiceByClientAndProjectType(client.id, projectType.id);
                
                if (clientService) {
                  // Use role-based assignment logic
                  const roleAssignments = await this.resolveProjectAssignments(client.id, projectType.id);
                  
                  finalBookkeeperId = roleAssignments.bookkeeperId;
                  finalClientManagerId = roleAssignments.clientManagerId;
                  finalCurrentAssigneeId = roleAssignments.currentAssigneeId;
                  usedRoleBasedAssignment = true;
                  
                  if (roleAssignments.usedFallback) {
                    console.warn(
                      `CSV import used fallback user for roles: ${roleAssignments.fallbackRoles.join(', ')} for client ${data.clientName}`
                    );
                  }
                } else {
                  // Service exists but client doesn't have service mapping - fallback to CSV user emails
                  console.warn(
                    `Project type '${data.projectDescription}' is service-mapped but client '${data.clientName}' has no service assignment. Using CSV email assignments.`
                  );
                  
                  const bookkeeper = await this.getUserByEmail(data.bookkeeperEmail);
                  const clientManager = await this.getUserByEmail(data.clientManagerEmail);
                  
                  if (!bookkeeper || !clientManager) {
                    throw new Error(`Bookkeeper (${data.bookkeeperEmail}) or client manager (${data.clientManagerEmail}) not found`);
                  }
                  
                  finalBookkeeperId = bookkeeper.id;
                  finalClientManagerId = clientManager.id;
                  finalCurrentAssigneeId = clientManager.id;
                }
              } catch (error) {
                if (error instanceof Error && error.message.includes('cannot use role-based assignments')) {
                  // Role-based assignment failed, fallback to CSV user emails
                  console.warn(
                    `Role-based assignment failed for project type '${data.projectDescription}': ${error.message}. Using CSV email assignments.`
                  );
                  
                  const bookkeeper = await this.getUserByEmail(data.bookkeeperEmail);
                  const clientManager = await this.getUserByEmail(data.clientManagerEmail);
                  
                  if (!bookkeeper || !clientManager) {
                    throw new Error(`Bookkeeper (${data.bookkeeperEmail}) or client manager (${data.clientManagerEmail}) not found`);
                  }
                  
                  finalBookkeeperId = bookkeeper.id;
                  finalClientManagerId = clientManager.id;
                  finalCurrentAssigneeId = clientManager.id;
                } else {
                  throw error; // Re-throw other errors
                }
              }
            } else {
              // Project type is NOT mapped to a service - use CSV email assignments (existing logic)
              const bookkeeper = await this.getUserByEmail(data.bookkeeperEmail);
              const clientManager = await this.getUserByEmail(data.clientManagerEmail);
              
              if (!bookkeeper || !clientManager) {
                throw new Error(`Bookkeeper (${data.bookkeeperEmail}) or client manager (${data.clientManagerEmail}) not found`);
              }
              
              finalBookkeeperId = bookkeeper.id;
              finalClientManagerId = clientManager.id;
              finalCurrentAssigneeId = clientManager.id;
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
                  assigneeId: existingProject.currentAssigneeId || finalClientManagerId,
                  changeReason: "clarifications_needed",
                  notes: `Project moved to 'Not Completed in Time' due to new monthly cycle. Previous status: ${existingProject.currentStatus}`,
                  timeInPreviousStage,
                });

                // Update project status and archive it
                const [updatedProject] = await tx.update(projects)
                  .set({
                    currentStatus: "Not Completed in Time",
                    currentAssigneeId: existingProject.currentAssigneeId || finalClientManagerId,
                    archived: true,
                    updatedAt: new Date(),
                  })
                  .where(eq(projects.id, existingProject.id))
                  .returning();

                archivedProjects.push(updatedProject);
              }
            }

            // Find "Not Completed in Time" stage for this project type or create it if needed
            let notCompletedStage = await tx.select().from(kanbanStages).where(and(
              eq(kanbanStages.name, "Not Completed in Time"),
              eq(kanbanStages.projectTypeId, projectType.id)
            ));
            if (notCompletedStage.length === 0) {
              // Create the stage if it doesn't exist for this project type
              const maxOrder = await tx.select({ maxOrder: sql<number>`COALESCE(MAX(${kanbanStages.order}), 0)` }).from(kanbanStages).where(eq(kanbanStages.projectTypeId, projectType.id));
              const [newStage] = await tx.insert(kanbanStages).values({
                name: "Not Completed in Time",
                projectTypeId: projectType.id,
                assignedRole: "admin",
                order: (maxOrder[0]?.maxOrder || 0) + 1,
                color: "#ef4444", // Red color for overdue items
              }).returning();
              notCompletedStage = [newStage];
            }

            // Create new project for this month using resolved user assignments
            const [newProject] = await tx.insert(projects).values({
              clientId: client.id,
              projectTypeId: projectType.id,
              bookkeeperId: finalBookkeeperId,
              clientManagerId: finalClientManagerId,
              currentAssigneeId: finalCurrentAssigneeId,
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
              assigneeId: finalCurrentAssigneeId,
              changeReason: `${newProject.description} Created → ${defaultStage.name}`,
              notes: `New project created for month ${normalizedProjectMonth}${usedRoleBasedAssignment ? ' using role-based assignments' : ' using CSV email assignments'}`,
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
    const activeDescriptions = await db.select().from(projectTypes).where(eq(projectTypes.active, true));
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

  async getStageApprovalsByProjectTypeId(projectTypeId: string): Promise<StageApproval[]> {
    return await db
      .select()
      .from(stageApprovals)
      .where(eq(stageApprovals.projectTypeId, projectTypeId));
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

  // Magic link operations
  async createMagicLinkToken(tokenData: InsertMagicLinkToken): Promise<MagicLinkToken> {
    const [token] = await db.insert(magicLinkTokens).values(tokenData).returning();
    return token;
  }

  async getMagicLinkTokenByToken(token: string): Promise<MagicLinkToken | undefined> {
    // Rate limit verification attempts per token to prevent DoS
    const rateLimitKey = `token_verify_${token.substring(0, 8)}`; // Use first 8 chars as key
    if (!this.checkVerificationRateLimit(rateLimitKey)) {
      return undefined; // Rate limited
    }

    // Get valid, unused, non-expired tokens, but limit to most recent 50 to prevent DoS
    // Order by creation time descending so we check newest tokens first
    const validTokens = await db
      .select()
      .from(magicLinkTokens)
      .where(and(
        eq(magicLinkTokens.used, false),
        sql`${magicLinkTokens.expiresAt} > now()`
      ))
      .orderBy(desc(magicLinkTokens.createdAt))
      .limit(50);
    
    // Compare provided token hash with stored hashes (limited set)
    for (const storedToken of validTokens) {
      const isValid = await bcrypt.compare(token, storedToken.tokenHash);
      if (isValid) {
        return storedToken;
      }
    }
    
    return undefined;
  }

  async getMagicLinkTokenByCodeAndEmail(code: string, email: string): Promise<MagicLinkToken | undefined> {
    // Rate limit verification attempts per email+code to prevent DoS
    const rateLimitKey = `code_verify_${email}_${code}`;
    if (!this.checkVerificationRateLimit(rateLimitKey)) {
      return undefined; // Rate limited
    }

    // Get valid, unused, non-expired tokens for this email, limited to most recent 10
    // Since code+email should be more specific, we can limit to fewer tokens
    const validTokens = await db
      .select()
      .from(magicLinkTokens)
      .where(and(
        eq(magicLinkTokens.email, email),
        eq(magicLinkTokens.used, false),
        sql`${magicLinkTokens.expiresAt} > now()`
      ))
      .orderBy(desc(magicLinkTokens.createdAt))
      .limit(10);
    
    // Compare provided code hash with stored hashes (limited set)
    for (const storedToken of validTokens) {
      const isValid = await bcrypt.compare(code, storedToken.codeHash);
      if (isValid) {
        return storedToken;
      }
    }
    
    return undefined;
  }

  async markMagicLinkTokenAsUsed(id: string): Promise<void> {
    // Use atomic conditional update to prevent race conditions
    const result = await db
      .update(magicLinkTokens)
      .set({ used: true })
      .where(and(
        eq(magicLinkTokens.id, id),
        eq(magicLinkTokens.used, false) // Only update if not already used
      ));
    
    // Verify that exactly one row was affected
    if (result.rowCount === 0) {
      throw new Error("Magic link token has already been used or does not exist");
    }
  }

  async cleanupExpiredMagicLinkTokens(): Promise<void> {
    await db
      .delete(magicLinkTokens)
      .where(sql`${magicLinkTokens.expiresAt} < now()`);
  }

  async getValidMagicLinkTokensForUser(userId: string): Promise<MagicLinkToken[]> {
    return await db
      .select()
      .from(magicLinkTokens)
      .where(and(
        eq(magicLinkTokens.userId, userId),
        eq(magicLinkTokens.used, false),
        sql`${magicLinkTokens.expiresAt} > now()`
      ));
  }

  async sendStageChangeNotifications(projectId: string, newStageName: string, oldStageName?: string): Promise<void> {
    try {
      // Only send notifications if the stage actually changed
      if (oldStageName && oldStageName === newStageName) {
        return;
      }

      // PERFORMANCE FIX: Basic deduplication per (projectId, newStageName)
      const deduplicationKey = `${projectId}:${newStageName}`;
      const now = Date.now();
      const lastNotification = this.recentNotifications.get(deduplicationKey);
      
      // Skip if same notification was sent within the last 30 seconds
      if (lastNotification && (now - lastNotification) < 30000) {
        console.log(`Skipping duplicate notification for project ${projectId} to stage ${newStageName}`);
        return;
      }
      
      // Record this notification
      this.recentNotifications.set(deduplicationKey, now);
      
      // Clean up old entries periodically (keep only last 1000 entries)
      if (this.recentNotifications.size > 1000) {
        const entries = Array.from(this.recentNotifications.entries());
        entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp, newest first
        this.recentNotifications.clear();
        // Keep only the 500 most recent entries
        entries.slice(0, 500).forEach(([key, timestamp]) => {
          this.recentNotifications.set(key, timestamp);
        });
      }

      // Get the project with all related data
      const project = await this.getProject(projectId);
      if (!project) {
        console.warn(`Project ${projectId} not found for stage change notifications`);
        return;
      }

      // Get the new kanban stage to find the assigned role
      const [newStage] = await db
        .select()
        .from(kanbanStages)
        .where(eq(kanbanStages.name, newStageName));

      if (!newStage) {
        console.warn(`Kanban stage '${newStageName}' not found for notifications`);
        return;
      }

      // If no role is assigned to this stage, no notifications to send
      if (!newStage.assignedRole) {
        console.log(`No role assigned to stage '${newStageName}', skipping notifications`);
        return;
      }

      // Get users with the assigned role
      const usersWithRole = await this.getUsersByRole(newStage.assignedRole);
      if (usersWithRole.length === 0) {
        console.log(`No users found with role '${newStage.assignedRole}' for stage '${newStageName}'`);
        return;
      }

      // Get project with client information for email
      const projectWithClient = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: {
          client: true,
        },
      });

      if (!projectWithClient) {
        console.warn(`Project with client data not found for ${projectId}`);
        return;
      }

      // PERFORMANCE FIX: Batch-load notification preferences for all users at once
      const userIds = usersWithRole.map(user => user.id);
      const allPreferences = await db
        .select()
        .from(userNotificationPreferences)
        .where(inArray(userNotificationPreferences.userId, userIds));
      
      // Create a map for quick preference lookup
      const preferencesMap = new Map<string, UserNotificationPreferences>();
      allPreferences.forEach(pref => {
        preferencesMap.set(pref.userId, pref);
      });

      // Filter users who need notifications and validate their data
      const usersToNotify = usersWithRole.filter(user => {
        // Get preferences or use defaults
        const preferences = preferencesMap.get(user.id);
        const notifyStageChanges = preferences?.notifyStageChanges ?? true; // Default to true
        
        if (!notifyStageChanges) {
          console.log(`User ${user.email} has stage change notifications disabled, skipping`);
          return false;
        }

        // Validate user has required fields for email
        if (!user.email || !user.firstName) {
          console.warn(`User ${user.id} missing email or name, skipping notification`);
          return false;
        }

        return true;
      });

      if (usersToNotify.length === 0) {
        console.log(`No users to notify for project ${projectId} stage change to ${newStageName}`);
        return;
      }

      // PERFORMANCE FIX: Send emails concurrently using Promise.allSettled for better error handling
      const emailPromises = usersToNotify.map(async (user) => {
        try {
          // TypeScript doesn't know we've filtered out null emails, so we use non-null assertion
          const emailSent = await sendStageChangeNotificationEmail(
            user.email!,
            `${user.firstName} ${user.lastName || ''}`.trim(),
            projectWithClient.description,
            projectWithClient.client.name,
            newStageName,
            oldStageName,
            projectId  // URL FIX: Pass projectId for deep linking
          );

          if (emailSent) {
            console.log(`Stage change notification sent to ${user.email} for project ${projectId}`);
            return { success: true, email: user.email };
          } else {
            console.warn(`Failed to send stage change notification to ${user.email} for project ${projectId}`);
            return { success: false, email: user.email, error: 'Email sending failed' };
          }
        } catch (error) {
          console.error(`Error sending stage change notification to user ${user.id}:`, error);
          return { success: false, email: user.email, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      // Use Promise.allSettled to handle failures gracefully without stopping other emails
      const results = await Promise.allSettled(emailPromises);
      
      // Log summary of notification results
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;
      console.log(`Stage change notifications for project ${projectId}: ${successful} successful, ${failed} failed`);
      
    } catch (error) {
      console.error(`Error in sendStageChangeNotifications for project ${projectId}:`, error);
      // Don't throw error to avoid breaking the main project update flow
    }
  }

  // Services CRUD operations  
  async getAllServices(): Promise<(Service & { roles: WorkRole[] })[]> {
    // Services no longer have direct project type references
    const servicesData = await db
      .select()
      .from(services);

    // Get all service roles in one query
    const allServiceRoles = await db
      .select({
        serviceId: serviceRoles.serviceId,
        role: workRoles,
      })
      .from(serviceRoles)
      .leftJoin(workRoles, eq(serviceRoles.roleId, workRoles.id));

    // Group roles by service ID
    const rolesByServiceId = allServiceRoles.reduce((acc, item) => {
      if (!acc[item.serviceId]) {
        acc[item.serviceId] = [];
      }
      if (item.role) {
        acc[item.serviceId].push(item.role);
      }
      return acc;
    }, {} as Record<string, WorkRole[]>);

    // Combine services with their roles
    return servicesData.map((service) => ({
      ...service,
      roles: rolesByServiceId[service.id] || [],
    }));
  }

  async getActiveServices(): Promise<(Service & { roles: WorkRole[] })[]> {
    // Services no longer have project type references - just return all services
    const servicesData = await db
      .select()
      .from(services);

    // Get all service roles in one query
    const allServiceRoles = await db
      .select({
        serviceId: serviceRoles.serviceId,
        role: workRoles,
      })
      .from(serviceRoles)
      .leftJoin(workRoles, eq(serviceRoles.roleId, workRoles.id));

    // Group roles by service ID
    const rolesByServiceId = allServiceRoles.reduce((acc, item) => {
      if (!acc[item.serviceId]) {
        acc[item.serviceId] = [];
      }
      if (item.role) {
        acc[item.serviceId].push(item.role);
      }
      return acc;
    }, {} as Record<string, WorkRole[]>);

    // Combine services with their roles
    return servicesData.map((service) => ({
      ...service,
      roles: rolesByServiceId[service.id] || [],
    }));
  }

  async getServiceById(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: string, service: Partial<InsertService>): Promise<Service> {
    const [updatedService] = await db
      .update(services)
      .set(service)
      .where(eq(services.id, id))
      .returning();
    
    if (!updatedService) {
      throw new Error("Service not found");
    }
    
    return updatedService;
  }

  async deleteService(id: string): Promise<void> {
    const result = await db.delete(services).where(eq(services.id, id));
    if (result.rowCount === 0) {
      throw new Error("Service not found");
    }
  }

  async getServiceByProjectTypeId(projectTypeId: string): Promise<Service | undefined> {
    // With inverted relationship: get project type first, then its associated service
    const [projectType] = await db
      .select()
      .from(projectTypes)
      .where(eq(projectTypes.id, projectTypeId));
    
    if (!projectType || !projectType.serviceId) {
      return undefined;
    }
    
    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.id, projectType.serviceId));
    return service;
  }

  // Service Owner Resolution - resolve service owner from client-service mapping only
  async resolveServiceOwner(clientId: string, projectTypeId: string): Promise<User | undefined> {
    // Get service owner from client-service mapping
    const clientService = await this.getClientServiceByClientAndProjectType(clientId, projectTypeId);
    if (clientService && clientService.serviceOwnerId) {
      return await this.getUser(clientService.serviceOwnerId);
    }
    
    return undefined;
  }

  // Work Roles CRUD operations
  async getAllWorkRoles(): Promise<WorkRole[]> {
    return await db.select().from(workRoles);
  }

  async getWorkRoleById(id: string): Promise<WorkRole | undefined> {
    const [workRole] = await db.select().from(workRoles).where(eq(workRoles.id, id));
    return workRole;
  }

  async createWorkRole(role: InsertWorkRole): Promise<WorkRole> {
    const [newWorkRole] = await db.insert(workRoles).values(role).returning();
    return newWorkRole;
  }

  async updateWorkRole(id: string, role: Partial<InsertWorkRole>): Promise<WorkRole> {
    const [updatedWorkRole] = await db
      .update(workRoles)
      .set(role)
      .where(eq(workRoles.id, id))
      .returning();
    
    if (!updatedWorkRole) {
      throw new Error("Work role not found");
    }
    
    return updatedWorkRole;
  }

  async deleteWorkRole(id: string): Promise<void> {
    const result = await db.delete(workRoles).where(eq(workRoles.id, id));
    if (result.rowCount === 0) {
      throw new Error("Work role not found");
    }
  }

  // Service-Role Mappings operations
  async getServiceRolesByServiceId(serviceId: string): Promise<ServiceRole[]> {
    return await db
      .select()
      .from(serviceRoles)
      .where(eq(serviceRoles.serviceId, serviceId));
  }

  async getWorkRolesByServiceId(serviceId: string): Promise<WorkRole[]> {
    return await db
      .select({
        id: workRoles.id,
        name: workRoles.name,
        description: workRoles.description,
        createdAt: workRoles.createdAt,
      })
      .from(serviceRoles)
      .innerJoin(workRoles, eq(serviceRoles.roleId, workRoles.id))
      .where(eq(serviceRoles.serviceId, serviceId));
  }

  async addRoleToService(serviceId: string, roleId: string): Promise<ServiceRole> {
    // Pre-check that both serviceId and roleId exist for clearer error messages
    const service = await this.getServiceById(serviceId);
    if (!service) {
      throw new Error(`Service with id '${serviceId}' not found`);
    }
    
    const workRole = await this.getWorkRoleById(roleId);
    if (!workRole) {
      throw new Error(`Work role with id '${roleId}' not found`);
    }
    
    // Insert with conflict handling to gracefully handle duplicate insertions
    const [serviceRole] = await db
      .insert(serviceRoles)
      .values({ serviceId, roleId })
      .onConflictDoNothing()
      .returning();
    
    // If no rows were returned, the mapping already exists
    if (!serviceRole) {
      // Fetch the existing mapping to return it
      const [existingMapping] = await db
        .select()
        .from(serviceRoles)
        .where(and(
          eq(serviceRoles.serviceId, serviceId),
          eq(serviceRoles.roleId, roleId)
        ));
      
      if (!existingMapping) {
        throw new Error("Failed to create or retrieve service-role mapping");
      }
      
      return existingMapping;
    }
    
    return serviceRole;
  }

  async removeRoleFromService(serviceId: string, roleId: string): Promise<void> {
    const result = await db
      .delete(serviceRoles)
      .where(and(
        eq(serviceRoles.serviceId, serviceId),
        eq(serviceRoles.roleId, roleId)
      ));
    
    if (result.rowCount === 0) {
      throw new Error("Service-role mapping not found");
    }
  }

  // Client Services CRUD operations
  async getAllClientServices(): Promise<(ClientService & { client: Client; service: Service & { projectType: ProjectType } })[]> {
    const results = await db
      .select({
        id: clientServices.id,
        clientId: clientServices.clientId,
        serviceId: clientServices.serviceId,
        serviceOwnerId: clientServices.serviceOwnerId,
        frequency: clientServices.frequency,
        nextStartDate: clientServices.nextStartDate,
        nextDueDate: clientServices.nextDueDate,
        createdAt: clientServices.createdAt,
        clientId_data: clients.id,
        clientName: clients.name,
        clientEmail: clients.email,
        clientCreatedAt: clients.createdAt,
        serviceId_data: services.id,
        serviceName: services.name,
        serviceDescription: services.description,


        serviceUdfDefinitions: services.udfDefinitions,
        serviceCreatedAt: services.createdAt,
        projectTypeId: projectTypes.id,
        projectTypeName: projectTypes.name,
        projectTypeDescription: projectTypes.description,
        projectTypeActive: projectTypes.active,
        projectTypeOrder: projectTypes.order,
        projectTypeCreatedAt: projectTypes.createdAt,
      })
      .from(clientServices)
      .innerJoin(clients, eq(clientServices.clientId, clients.id))
      .innerJoin(services, eq(clientServices.serviceId, services.id))
      .leftJoin(projectTypes, eq(projectTypes.serviceId, services.id));
    
    return results.map(result => ({
      id: result.id,
      clientId: result.clientId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      createdAt: result.createdAt,
      client: {
        id: result.clientId_data,
        name: result.clientName,
        email: result.clientEmail,
        createdAt: result.clientCreatedAt,
      },
      service: {
        id: result.serviceId_data,
        name: result.serviceName,
        description: result.serviceDescription,
        projectTypeId: result.projectTypeId,

        udfDefinitions: result.serviceUdfDefinitions,
        createdAt: result.serviceCreatedAt,
        projectType: {
          id: result.projectTypeId,
          name: result.projectTypeName,
          description: result.projectTypeDescription,
          active: result.projectTypeActive,
          order: result.projectTypeOrder,
          createdAt: result.projectTypeCreatedAt,
        },
      },
    }));
  }

  async getClientServiceById(id: string): Promise<(ClientService & { client: Client; service: Service & { projectType: ProjectType } }) | undefined> {
    const [result] = await db
      .select({
        id: clientServices.id,
        clientId: clientServices.clientId,
        serviceId: clientServices.serviceId,
        serviceOwnerId: clientServices.serviceOwnerId,
        frequency: clientServices.frequency,
        nextStartDate: clientServices.nextStartDate,
        nextDueDate: clientServices.nextDueDate,
        createdAt: clientServices.createdAt,
        clientId_data: clients.id,
        clientName: clients.name,
        clientEmail: clients.email,
        clientCreatedAt: clients.createdAt,
        serviceId_data: services.id,
        serviceName: services.name,
        serviceDescription: services.description,


        serviceUdfDefinitions: services.udfDefinitions,
        serviceCreatedAt: services.createdAt,
        projectTypeId: projectTypes.id,
        projectTypeName: projectTypes.name,
        projectTypeDescription: projectTypes.description,
        projectTypeActive: projectTypes.active,
        projectTypeOrder: projectTypes.order,
        projectTypeCreatedAt: projectTypes.createdAt,
      })
      .from(clientServices)
      .innerJoin(clients, eq(clientServices.clientId, clients.id))
      .innerJoin(services, eq(clientServices.serviceId, services.id))
      .leftJoin(projectTypes, eq(projectTypes.serviceId, services.id))
      .where(eq(clientServices.id, id));
    
    if (!result) {
      return undefined;
    }
    
    return {
      id: result.id,
      clientId: result.clientId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      createdAt: result.createdAt,
      client: {
        id: result.clientId_data,
        name: result.clientName,
        email: result.clientEmail,
        createdAt: result.clientCreatedAt,
      },
      service: {
        id: result.serviceId_data,
        name: result.serviceName,
        description: result.serviceDescription,
        projectTypeId: result.projectTypeId,

        udfDefinitions: result.serviceUdfDefinitions,
        createdAt: result.serviceCreatedAt,
        projectType: {
          id: result.projectTypeId,
          name: result.projectTypeName,
          description: result.projectTypeDescription,
          active: result.projectTypeActive,
          order: result.projectTypeOrder,
          createdAt: result.projectTypeCreatedAt,
        },
      },
    };
  }

  async getClientServicesByClientId(clientId: string): Promise<(ClientService & { service: Service & { projectType: ProjectType } })[]> {
    const results = await db
      .select({
        id: clientServices.id,
        clientId: clientServices.clientId,
        serviceId: clientServices.serviceId,
        serviceOwnerId: clientServices.serviceOwnerId,
        frequency: clientServices.frequency,
        nextStartDate: clientServices.nextStartDate,
        nextDueDate: clientServices.nextDueDate,
        createdAt: clientServices.createdAt,
        serviceId_data: services.id,
        serviceName: services.name,
        serviceDescription: services.description,


        serviceUdfDefinitions: services.udfDefinitions,
        serviceCreatedAt: services.createdAt,
        projectTypeId: projectTypes.id,
        projectTypeName: projectTypes.name,
        projectTypeDescription: projectTypes.description,
        projectTypeActive: projectTypes.active,
        projectTypeOrder: projectTypes.order,
        projectTypeCreatedAt: projectTypes.createdAt,
      })
      .from(clientServices)
      .innerJoin(services, eq(clientServices.serviceId, services.id))
      .leftJoin(projectTypes, eq(projectTypes.serviceId, services.id))
      .where(eq(clientServices.clientId, clientId));
    
    return results.map(result => ({
      id: result.id,
      clientId: result.clientId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      createdAt: result.createdAt,
      service: {
        id: result.serviceId_data,
        name: result.serviceName,
        description: result.serviceDescription,
        projectTypeId: result.projectTypeId,

        udfDefinitions: result.serviceUdfDefinitions,
        createdAt: result.serviceCreatedAt,
        projectType: {
          id: result.projectTypeId,
          name: result.projectTypeName,
          description: result.projectTypeDescription,
          active: result.projectTypeActive,
          order: result.projectTypeOrder,
          createdAt: result.projectTypeCreatedAt,
        },
      },
    }));
  }

  async getClientServicesByServiceId(serviceId: string): Promise<(ClientService & { client: Client })[]> {
    return await db
      .select({
        id: clientServices.id,
        clientId: clientServices.clientId,
        serviceId: clientServices.serviceId,
        serviceOwnerId: clientServices.serviceOwnerId,
        frequency: clientServices.frequency,
        nextStartDate: clientServices.nextStartDate,
        nextDueDate: clientServices.nextDueDate,
        createdAt: clientServices.createdAt,
        client: {
          id: clients.id,
          name: clients.name,
          email: clients.email,
          createdAt: clients.createdAt,
        },
      })
      .from(clientServices)
      .innerJoin(clients, eq(clientServices.clientId, clients.id))
      .where(eq(clientServices.serviceId, serviceId));
  }

  async createClientService(clientServiceData: InsertClientService): Promise<ClientService> {
    // Validate that client exists
    const client = await this.getClientById(clientServiceData.clientId);
    if (!client) {
      throw new Error(`Client with ID '${clientServiceData.clientId}' not found`);
    }

    // Validate that service exists
    const service = await this.getServiceById(clientServiceData.serviceId);
    if (!service) {
      throw new Error(`Service with ID '${clientServiceData.serviceId}' not found`);
    }

    // Check if mapping already exists
    const mappingExists = await this.checkClientServiceMappingExists(clientServiceData.clientId, clientServiceData.serviceId);
    if (mappingExists) {
      const clientName = client.name || client.email || `ID: ${client.id}`;
      throw new Error(`Client-service mapping already exists between client '${clientName}' and service '${service.name}'. Each client can only be mapped to a service once.`);
    }

    const [clientService] = await db
      .insert(clientServices)
      .values(clientServiceData)
      .returning();
    
    return clientService;
  }

  async updateClientService(id: string, clientServiceData: Partial<InsertClientService>): Promise<ClientService> {
    // Validate that the client service exists
    const existing = await this.getClientServiceById(id);
    if (!existing) {
      throw new Error(`Client service with ID '${id}' not found`);
    }

    // If updating clientId or serviceId, validate the new values and check for conflicts
    if (clientServiceData.clientId || clientServiceData.serviceId) {
      const newClientId = clientServiceData.clientId || existing.clientId;
      const newServiceId = clientServiceData.serviceId || existing.serviceId;

      // Validate new client exists (if changing)
      if (clientServiceData.clientId && clientServiceData.clientId !== existing.clientId) {
        const client = await this.getUser(clientServiceData.clientId);
        if (!client) {
          throw new Error(`Client with ID '${clientServiceData.clientId}' not found`);
        }
      }

      // Validate new service exists (if changing)
      if (clientServiceData.serviceId && clientServiceData.serviceId !== existing.serviceId) {
        const service = await this.getServiceById(clientServiceData.serviceId);
        if (!service) {
          throw new Error(`Service with ID '${clientServiceData.serviceId}' not found`);
        }
      }

      // Check for conflicts if the client-service combination is changing
      if ((clientServiceData.clientId && clientServiceData.clientId !== existing.clientId) ||
          (clientServiceData.serviceId && clientServiceData.serviceId !== existing.serviceId)) {
        const mappingExists = await this.checkClientServiceMappingExists(newClientId, newServiceId);
        if (mappingExists) {
          throw new Error(`Client-service mapping already exists for the new client-service combination. Each client can only be mapped to a service once.`);
        }
      }
    }

    const [updatedClientService] = await db
      .update(clientServices)
      .set(clientServiceData)
      .where(eq(clientServices.id, id))
      .returning();
    
    if (!updatedClientService) {
      throw new Error("Failed to update client service");
    }
    
    return updatedClientService;
  }

  async getClientServiceByClientAndProjectType(clientId: string, projectTypeId: string): Promise<ClientService | undefined> {
    // Find the service for this project type
    const service = await this.getServiceByProjectTypeId(projectTypeId);
    if (!service) {
      return undefined;
    }

    // Find the client-service mapping
    const [clientService] = await db
      .select()
      .from(clientServices)
      .where(and(
        eq(clientServices.clientId, clientId),
        eq(clientServices.serviceId, service.id)
      ));
    
    return clientService;
  }

  async deleteClientService(id: string): Promise<void> {
    // Use transaction to ensure cascade delete is atomic
    await db.transaction(async (tx) => {
      // First check if the client service exists
      const [clientService] = await tx
        .select()
        .from(clientServices)
        .where(eq(clientServices.id, id));
      
      if (!clientService) {
        throw new Error("Client service not found");
      }

      // Delete all role assignments for this client service (cascade delete)
      await tx
        .delete(clientServiceRoleAssignments)
        .where(eq(clientServiceRoleAssignments.clientServiceId, id));

      // Delete the client service
      await tx.delete(clientServices).where(eq(clientServices.id, id));
    });
  }

  // Client Service Role Assignments CRUD operations
  async getClientServiceRoleAssignments(clientServiceId: string): Promise<(ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[]> {
    return await db
      .select({
        id: clientServiceRoleAssignments.id,
        clientServiceId: clientServiceRoleAssignments.clientServiceId,
        workRoleId: clientServiceRoleAssignments.workRoleId,
        userId: clientServiceRoleAssignments.userId,
        isActive: clientServiceRoleAssignments.isActive,
        createdAt: clientServiceRoleAssignments.createdAt,
        workRole: {
          id: workRoles.id,
          name: workRoles.name,
          description: workRoles.description,
          createdAt: workRoles.createdAt,
        },
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          passwordHash: users.passwordHash,
          isFallbackUser: users.isFallbackUser,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(clientServiceRoleAssignments)
      .innerJoin(workRoles, eq(clientServiceRoleAssignments.workRoleId, workRoles.id))
      .innerJoin(users, eq(clientServiceRoleAssignments.userId, users.id))
      .where(eq(clientServiceRoleAssignments.clientServiceId, clientServiceId));
  }

  async getActiveClientServiceRoleAssignments(clientServiceId: string): Promise<(ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[]> {
    return await db
      .select({
        id: clientServiceRoleAssignments.id,
        clientServiceId: clientServiceRoleAssignments.clientServiceId,
        workRoleId: clientServiceRoleAssignments.workRoleId,
        userId: clientServiceRoleAssignments.userId,
        isActive: clientServiceRoleAssignments.isActive,
        createdAt: clientServiceRoleAssignments.createdAt,
        workRole: {
          id: workRoles.id,
          name: workRoles.name,
          description: workRoles.description,
          createdAt: workRoles.createdAt,
        },
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          passwordHash: users.passwordHash,
          isFallbackUser: users.isFallbackUser,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(clientServiceRoleAssignments)
      .innerJoin(workRoles, eq(clientServiceRoleAssignments.workRoleId, workRoles.id))
      .innerJoin(users, eq(clientServiceRoleAssignments.userId, users.id))
      .where(and(
        eq(clientServiceRoleAssignments.clientServiceId, clientServiceId),
        eq(clientServiceRoleAssignments.isActive, true)
      ));
  }

  async createClientServiceRoleAssignment(assignmentData: InsertClientServiceRoleAssignment): Promise<ClientServiceRoleAssignment> {
    // Use transaction to ensure only one active user per role per client-service
    return await db.transaction(async (tx) => {
      if (assignmentData.isActive !== false) {
        // Deactivate any existing active assignments for this role and client-service
        await tx
          .update(clientServiceRoleAssignments)
          .set({ isActive: false })
          .where(and(
            eq(clientServiceRoleAssignments.clientServiceId, assignmentData.clientServiceId),
            eq(clientServiceRoleAssignments.workRoleId, assignmentData.workRoleId),
            eq(clientServiceRoleAssignments.isActive, true)
          ));
      }

      const [assignment] = await tx
        .insert(clientServiceRoleAssignments)
        .values(assignmentData)
        .returning();
      
      return assignment;
    });
  }

  async updateClientServiceRoleAssignment(id: string, assignmentData: Partial<InsertClientServiceRoleAssignment>): Promise<ClientServiceRoleAssignment> {
    return await db.transaction(async (tx) => {
      // If setting to active, deactivate other assignments for same role/client-service
      if (assignmentData.isActive === true) {
        const [existing] = await tx
          .select()
          .from(clientServiceRoleAssignments)
          .where(eq(clientServiceRoleAssignments.id, id));
        
        if (existing) {
          await tx
            .update(clientServiceRoleAssignments)
            .set({ isActive: false })
            .where(and(
              eq(clientServiceRoleAssignments.clientServiceId, existing.clientServiceId),
              eq(clientServiceRoleAssignments.workRoleId, existing.workRoleId),
              eq(clientServiceRoleAssignments.isActive, true)
            ));
        }
      }

      const [assignment] = await tx
        .update(clientServiceRoleAssignments)
        .set(assignmentData)
        .where(eq(clientServiceRoleAssignments.id, id))
        .returning();
      
      if (!assignment) {
        throw new Error("Client service role assignment not found");
      }
      
      return assignment;
    });
  }

  async deactivateClientServiceRoleAssignment(id: string): Promise<ClientServiceRoleAssignment> {
    const [assignment] = await db
      .update(clientServiceRoleAssignments)
      .set({ isActive: false })
      .where(eq(clientServiceRoleAssignments.id, id))
      .returning();
    
    if (!assignment) {
      throw new Error("Client service role assignment not found");
    }
    
    return assignment;
  }

  async deleteClientServiceRoleAssignment(id: string): Promise<void> {
    const result = await db.delete(clientServiceRoleAssignments).where(eq(clientServiceRoleAssignments.id, id));
    if (result.rowCount === 0) {
      throw new Error("Client service role assignment not found");
    }
  }

  // Role Resolution for Project Creation
  async resolveRoleAssigneeForClient(clientId: string, projectTypeId: string, roleName: string): Promise<User | undefined> {
    try {
      // Find the service for this project type
      const [service] = await db
        .select()
        .from(services)
        .where(eq(projectTypes.id, projectTypeId));
      
      if (!service) {
        console.warn(`No service found for project type ID: ${projectTypeId}`);
        return undefined;
      }

      // Find the client-service mapping
      const [clientService] = await db
        .select()
        .from(clientServices)
        .where(and(
          eq(clientServices.clientId, clientId),
          eq(clientServices.serviceId, service.id)
        ));
      
      if (!clientService) {
        console.warn(`No client-service mapping found for client ID: ${clientId} and service ID: ${service.id}`);
        return undefined;
      }

      // Find the work role by name
      const [workRole] = await db
        .select()
        .from(workRoles)
        .where(eq(workRoles.name, roleName));
      
      if (!workRole) {
        console.warn(`No work role found with name: ${roleName}`);
        return undefined;
      }

      // Find ALL active role assignments and pick most recent (deterministic selection)
      const assignments = await db
        .select({
          user: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            passwordHash: users.passwordHash,
            isFallbackUser: users.isFallbackUser,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          },
          assignmentCreatedAt: clientServiceRoleAssignments.createdAt,
        })
        .from(clientServiceRoleAssignments)
        .innerJoin(users, eq(clientServiceRoleAssignments.userId, users.id))
        .where(and(
          eq(clientServiceRoleAssignments.clientServiceId, clientService.id),
          eq(clientServiceRoleAssignments.workRoleId, workRole.id),
          eq(clientServiceRoleAssignments.isActive, true)
        ))
        .orderBy(desc(clientServiceRoleAssignments.createdAt));
      
      if (assignments.length === 0) {
        console.warn(`No active role assignment found for client ${clientId}, role ${roleName}`);
        return undefined;
      }

      if (assignments.length > 1) {
        console.warn(`Multiple active assignments found for client ${clientId}, role ${roleName}. Selecting most recent assignment.`);
      }
      
      // Return the most recent assignment (deterministic selection)
      return assignments[0].user;
    } catch (error) {
      console.error(`Error resolving role assignee for client ${clientId}, project type ${projectTypeId}, role ${roleName}:`, error);
      return undefined;
    }
  }

  async getFallbackUser(): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.isFallbackUser, true));
    
    return user;
  }

  async setFallbackUser(userId: string): Promise<User> {
    return await db.transaction(async (tx) => {
      // Remove fallback flag from all users
      await tx
        .update(users)
        .set({ isFallbackUser: false })
        .where(eq(users.isFallbackUser, true));

      // Set the new fallback user
      const [user] = await tx
        .update(users)
        .set({ isFallbackUser: true })
        .where(eq(users.id, userId))
        .returning();
      
      if (!user) {
        throw new Error("User not found");
      }
      
      return user;
    });
  }

  async resolveProjectAssignments(clientId: string, projectTypeId: string): Promise<{
    bookkeeperId: string;
    clientManagerId: string;
    currentAssigneeId: string;
    usedFallback: boolean;
    fallbackRoles: string[];
  }> {
    let usedFallback = false;
    const fallbackRoles: string[] = [];

    // Check if project type is mapped to a service
    const service = await this.getServiceByProjectTypeId(projectTypeId);
    if (!service) {
      throw new Error('Project type is not mapped to a service - cannot use role-based assignments');
    }

    // Get client service mapping
    const clientService = await this.getClientServiceByClientAndProjectType(clientId, projectTypeId);
    if (!clientService) {
      throw new Error(`Client does not have service mapping for this project type`);
    }

    // Get fallback user for when role assignments are missing
    const fallbackUser = await this.getFallbackUser();
    if (!fallbackUser) {
      throw new Error('No fallback user configured - please set a fallback user for role-based assignments');
    }

    // Resolve bookkeeper role
    let bookkeeper = await this.resolveRoleAssigneeForClient(clientId, projectTypeId, 'bookkeeper');
    if (!bookkeeper) {
      console.warn(`No bookkeeper assignment found for client ${clientId}, using fallback user`);
      bookkeeper = fallbackUser;
      usedFallback = true;
      fallbackRoles.push('bookkeeper');
    }

    // Resolve client manager role
    let clientManager = await this.resolveRoleAssigneeForClient(clientId, projectTypeId, 'client_manager');
    if (!clientManager) {
      console.warn(`No client_manager assignment found for client ${clientId}, using fallback user`);
      clientManager = fallbackUser;
      usedFallback = true;
      fallbackRoles.push('client_manager');
    }

    // Get the default stage to determine initial current assignee
    const defaultStage = await this.getDefaultStage();
    let currentAssignee = clientManager; // Default to client manager

    if (defaultStage?.assignedRole) {
      switch (defaultStage.assignedRole) {
        case "bookkeeper":
          currentAssignee = bookkeeper;
          break;
        case "client_manager":
          currentAssignee = clientManager;
          break;
        case "admin":
        case "manager":
          // Try to find admin/manager role assignment, fallback to client manager
          const adminManager = await this.resolveRoleAssigneeForClient(clientId, projectTypeId, defaultStage.assignedRole);
          if (adminManager) {
            currentAssignee = adminManager;
          } else {
            console.warn(`No ${defaultStage.assignedRole} assignment found for client ${clientId}, using client manager`);
            currentAssignee = clientManager;
          }
          break;
        default:
          // For any other role, try to resolve it, fallback to client manager
          const roleAssignee = await this.resolveRoleAssigneeForClient(clientId, projectTypeId, defaultStage.assignedRole);
          if (roleAssignee) {
            currentAssignee = roleAssignee;
          } else {
            console.warn(`No ${defaultStage.assignedRole} assignment found for client ${clientId}, using client manager`);
            currentAssignee = clientManager;
          }
      }
    }

    if (usedFallback) {
      console.log(`Used fallback user for roles: ${fallbackRoles.join(', ')} when creating project for client ${clientId}`);
    }

    return {
      bookkeeperId: bookkeeper.id,
      clientManagerId: clientManager.id,
      currentAssigneeId: currentAssignee.id,
      usedFallback,
      fallbackRoles,
    };
  }

  // Validation Methods
  async validateClientServiceRoleCompleteness(clientId: string, serviceId: string): Promise<{ isComplete: boolean; missingRoles: string[]; assignedRoles: { roleName: string; userName: string }[] }> {
    // Find the client-service mapping
    const [clientService] = await db
      .select()
      .from(clientServices)
      .where(and(
        eq(clientServices.clientId, clientId),
        eq(clientServices.serviceId, serviceId)
      ));
    
    if (!clientService) {
      throw new Error("Client-service mapping not found");
    }

    // Get all required roles for this service
    const requiredRoles = await db
      .select({
        roleId: workRoles.id,
        roleName: workRoles.name,
      })
      .from(serviceRoles)
      .innerJoin(workRoles, eq(serviceRoles.roleId, workRoles.id))
      .where(eq(serviceRoles.serviceId, serviceId));

    // Get all active role assignments for this client-service
    const activeAssignments = await db
      .select({
        roleId: clientServiceRoleAssignments.workRoleId,
        roleName: workRoles.name,
        userName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
      })
      .from(clientServiceRoleAssignments)
      .innerJoin(workRoles, eq(clientServiceRoleAssignments.workRoleId, workRoles.id))
      .innerJoin(users, eq(clientServiceRoleAssignments.userId, users.id))
      .where(and(
        eq(clientServiceRoleAssignments.clientServiceId, clientService.id),
        eq(clientServiceRoleAssignments.isActive, true)
      ));

    // Find missing roles
    const assignedRoleIds = new Set(activeAssignments.map(a => a.roleId));
    const missingRoles = requiredRoles
      .filter(role => !assignedRoleIds.has(role.roleId))
      .map(role => role.roleName);

    // Format assigned roles
    const assignedRoles = activeAssignments.map(assignment => ({
      roleName: assignment.roleName,
      userName: assignment.userName,
    }));

    return {
      isComplete: missingRoles.length === 0,
      missingRoles,
      assignedRoles,
    };
  }

  // Additional validation helper methods
  async checkClientServiceMappingExists(clientId: string, serviceId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(clientServices)
      .where(and(
        eq(clientServices.clientId, clientId),
        eq(clientServices.serviceId, serviceId)
      ))
      .limit(1);
    
    return !!existing;
  }

  async validateAssignedRolesAgainstService(serviceId: string, roleIds: string[]): Promise<{ isValid: boolean; invalidRoles: string[]; allowedRoles: string[] }> {
    if (!roleIds || roleIds.length === 0) {
      return { isValid: true, invalidRoles: [], allowedRoles: [] };
    }

    // Get all allowed roles for this service
    const allowedRoles = await db
      .select({
        roleId: workRoles.id,
        roleName: workRoles.name,
      })
      .from(serviceRoles)
      .innerJoin(workRoles, eq(serviceRoles.roleId, workRoles.id))
      .where(eq(serviceRoles.serviceId, serviceId));

    const allowedRoleIds = new Set(allowedRoles.map(r => r.roleId));
    const allowedRoleNames = allowedRoles.map(r => r.roleName);

    // Find invalid role IDs
    const invalidRoleIds = roleIds.filter(roleId => !allowedRoleIds.has(roleId));
    
    // Get names for invalid roles for better error messages
    let invalidRoleNames: string[] = [];
    if (invalidRoleIds.length > 0) {
      const invalidRoles = await db
        .select({
          roleId: workRoles.id,
          roleName: workRoles.name,
        })
        .from(workRoles)
        .where(inArray(workRoles.id, invalidRoleIds));
      
      invalidRoleNames = invalidRoles.map(r => r.roleName);
    }

    return {
      isValid: invalidRoleIds.length === 0,
      invalidRoles: invalidRoleNames,
      allowedRoles: allowedRoleNames,
    };
  }

  // Companies House Change Requests CRUD implementations
  async getAllChChangeRequests(): Promise<(ChChangeRequest & { client: Client; approvedByUser?: User })[]> {
    const results = await db
      .select({
        id: chChangeRequests.id,
        clientId: chChangeRequests.clientId,
        changeType: chChangeRequests.changeType,
        fieldName: chChangeRequests.fieldName,
        oldValue: chChangeRequests.oldValue,
        newValue: chChangeRequests.newValue,
        status: chChangeRequests.status,
        detectedAt: chChangeRequests.detectedAt,
        approvedAt: chChangeRequests.approvedAt,
        approvedBy: chChangeRequests.approvedBy,
        notes: chChangeRequests.notes,
        createdAt: chChangeRequests.createdAt,
        client: {
          id: clients.id,
          name: clients.name,
          email: clients.email,
          createdAt: clients.createdAt,
          companyNumber: clients.companyNumber,
        },
        approvedByUser: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        }
      })
      .from(chChangeRequests)
      .innerJoin(clients, eq(chChangeRequests.clientId, clients.id))
      .leftJoin(users, eq(chChangeRequests.approvedBy, users.id))
      .orderBy(desc(chChangeRequests.detectedAt));

    return results.map((result) => ({
      id: result.id,
      clientId: result.clientId,
      changeType: result.changeType,
      fieldName: result.fieldName,
      oldValue: result.oldValue,
      newValue: result.newValue,
      status: result.status,
      detectedAt: result.detectedAt,
      approvedAt: result.approvedAt,
      approvedBy: result.approvedBy,
      notes: result.notes,
      createdAt: result.createdAt,
      client: result.client as Client,
      approvedByUser: result.approvedByUser && result.approvedByUser.id ? result.approvedByUser as User : undefined,
    }));
  }

  async getPendingChChangeRequests(): Promise<(ChChangeRequest & { client: Client })[]> {
    const results = await db
      .select({
        id: chChangeRequests.id,
        clientId: chChangeRequests.clientId,
        changeType: chChangeRequests.changeType,
        fieldName: chChangeRequests.fieldName,
        oldValue: chChangeRequests.oldValue,
        newValue: chChangeRequests.newValue,
        status: chChangeRequests.status,
        detectedAt: chChangeRequests.detectedAt,
        approvedAt: chChangeRequests.approvedAt,
        approvedBy: chChangeRequests.approvedBy,
        notes: chChangeRequests.notes,
        createdAt: chChangeRequests.createdAt,
        client: {
          id: clients.id,
          name: clients.name,
          email: clients.email,
          createdAt: clients.createdAt,
          companyNumber: clients.companyNumber,
        },
      })
      .from(chChangeRequests)
      .innerJoin(clients, eq(chChangeRequests.clientId, clients.id))
      .where(eq(chChangeRequests.status, "pending"))
      .orderBy(desc(chChangeRequests.detectedAt));

    return results.map((result) => ({
      id: result.id,
      clientId: result.clientId,
      changeType: result.changeType,
      fieldName: result.fieldName,
      oldValue: result.oldValue,
      newValue: result.newValue,
      status: result.status,
      detectedAt: result.detectedAt,
      approvedAt: result.approvedAt,
      approvedBy: result.approvedBy,
      notes: result.notes,
      createdAt: result.createdAt,
      client: result.client as Client,
    }));
  }

  async createChChangeRequest(request: InsertChChangeRequest): Promise<ChChangeRequest> {
    const [changeRequest] = await db
      .insert(chChangeRequests)
      .values(request)
      .returning();
    
    return changeRequest;
  }

  async approveChChangeRequest(id: string, approvedBy: string, notes?: string): Promise<ChChangeRequest> {
    const [changeRequest] = await db
      .update(chChangeRequests)
      .set({
        status: "approved",
        approvedBy,
        approvedAt: sql`now()`,
        notes,
      })
      .where(eq(chChangeRequests.id, id))
      .returning();
    
    return changeRequest;
  }

  async rejectChChangeRequest(id: string, approvedBy: string, notes?: string): Promise<ChChangeRequest> {
    const [changeRequest] = await db
      .update(chChangeRequests)
      .set({
        status: "rejected",
        approvedBy,
        approvedAt: sql`now()`,
        notes,
      })
      .where(eq(chChangeRequests.id, id))
      .returning();
    
    return changeRequest;
  }

  // Placeholder implementations for remaining methods
  async getChChangeRequestById(id: string): Promise<(ChChangeRequest & { client: Client; approvedByUser?: User }) | undefined> {
    const result = await db
      .select()
      .from(chChangeRequests)
      .leftJoin(clients, eq(chChangeRequests.clientId, clients.id))
      .leftJoin(users, eq(chChangeRequests.approvedBy, users.id))
      .where(eq(chChangeRequests.id, id))
      .limit(1);

    if (result.length === 0) {
      return undefined;
    }

    const row = result[0];
    return {
      ...row.ch_change_requests,
      client: row.clients!,
      approvedByUser: row.users || undefined,
    };
  }

  async getChChangeRequestsByClientId(clientId: string): Promise<ChChangeRequest[]> {
    // TODO: Implement
    throw new Error("Method not implemented.");
  }

  async updateChChangeRequest(id: string, request: Partial<UpdateChChangeRequest>): Promise<ChChangeRequest> {
    // TODO: Implement
    throw new Error("Method not implemented.");
  }

  async deleteChChangeRequest(id: string): Promise<void> {
    // TODO: Implement
    throw new Error("Method not implemented.");
  }

  async detectChDataChanges(clientId: string, newChData: any): Promise<ChChangeRequest[]> {
    // TODO: Implement
    throw new Error("Method not implemented.");
  }

  async applyChChangeRequests(requestIds: string[]): Promise<void> {
    // TODO: Implement
    throw new Error("Method not implemented.");
  }
}

export const storage = new DatabaseStorage();
