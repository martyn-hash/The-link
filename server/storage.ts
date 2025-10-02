import {
  users,
  clients,
  people,
  clientPeople,
  projects,
  projectChronology,
  clientChronology,
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
  projectViews,
  userColumnPreferences,
  dashboards,
  services,
  workRoles,
  serviceRoles,
  clientServices,
  peopleServices,
  clientServiceRoleAssignments,
  chChangeRequests,
  clientTags,
  peopleTags,
  clientTagAssignments,
  peopleTagAssignments,
  projectSchedulingHistory,
  schedulingRunLogs,
  normalizeProjectMonth,
  communications,
  userIntegrations,
  userOauthAccounts,
  userActivityTracking,
  pushSubscriptions,
  documentFolders,
  documents,
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
  type SelectClientChronology,
  type InsertClientChronology,
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
  type ProjectView,
  type InsertProjectView,
  type UserColumnPreferences,
  type InsertUserColumnPreferences,
  type UpdateUserColumnPreferences,
  type Dashboard,
  type InsertDashboard,
  type UpdateDashboard,
  type Service,
  type InsertService,
  type WorkRole,
  type InsertWorkRole,
  type ServiceRole,
  type InsertServiceRole,
  type ClientService,
  type InsertClientService,
  type PeopleService,
  type InsertPeopleService,
  type ClientServiceRoleAssignment,
  type InsertClientServiceRoleAssignment,
  type ChChangeRequest,
  type InsertChChangeRequest,
  type UpdateChChangeRequest,
  type ClientTag,
  type InsertClientTag,
  type PeopleTag,
  type InsertPeopleTag,
  type ClientTagAssignment,
  type InsertClientTagAssignment,
  type PeopleTagAssignment,
  type InsertPeopleTagAssignment,
  type ProjectSchedulingHistory,
  type InsertProjectSchedulingHistory,
  type SchedulingRunLogs,
  type InsertSchedulingRunLogs,
  type ProjectWithRelations,
  type UpdateProjectStatus,
  type UpdateProjectType,
  type Communication,
  type InsertCommunication,
  type UserIntegration,
  type InsertUserIntegration,
  type UserActivityTracking,
  type InsertUserActivityTracking,
  type PushSubscription,
  type InsertPushSubscription,
  type DocumentFolder,
  type InsertDocumentFolder,
  type Document,
  type InsertDocument,
  insertUserOauthAccountSchema,
} from "@shared/schema";

// Add the OAuth account types
type UserOauthAccount = typeof userOauthAccounts.$inferSelect;
type InsertUserOauthAccount = typeof userOauthAccounts.$inferInsert;

// Type for scheduled services view that combines client and people services
export interface ScheduledServiceView {
  id: string;
  serviceId: string;
  serviceName: string;
  clientOrPersonName: string;
  clientOrPersonType: 'client' | 'person';
  nextStartDate: string | null;
  nextDueDate: string | null;
  currentProjectStartDate: string | null; // Current project start date (when hasActiveProject is true)
  currentProjectDueDate: string | null;   // Current project due date (when hasActiveProject is true)
  projectTypeName: string | null;
  hasActiveProject: boolean;
  frequency: string;
  isActive: boolean;
  serviceOwnerId?: string;
  serviceOwnerName?: string;
}

// Super search result types
export interface SearchResult {
  id: string;
  type: 'client' | 'person' | 'project' | 'communication' | 'service';
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface SuperSearchResults {
  clients: SearchResult[];
  people: SearchResult[];
  projects: SearchResult[];
  communications: SearchResult[];
  services: SearchResult[];
  total: number;
}
import bcrypt from "bcrypt";
import { calculateBusinessHours } from "@shared/businessTime";
import { db } from "./db";
import { sendStageChangeNotificationEmail, sendBulkProjectAssignmentSummaryEmail } from "./emailService";
import { eq, desc, and, inArray, sql, sum, lt, gte, lte, or, ilike, isNull, ne } from "drizzle-orm";

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
  
  // User activity tracking operations
  trackUserActivity(userId: string, entityType: string, entityId: string): Promise<void>;
  getRecentlyViewedByUser(userId: string, limit?: number): Promise<{ entityType: string; entityId: string; viewedAt: Date; entityData?: any }[]>;
  
  // Client operations
  createClient(client: InsertClient): Promise<Client>;
  getClientById(id: string): Promise<Client | undefined>;
  getClientByName(name: string): Promise<Client | undefined>;
  getAllClients(search?: string): Promise<Client[]>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: string): Promise<void>;
  
  // Super search operations
  superSearch(query: string, limit?: number): Promise<SuperSearchResults>;
  
  // Person-Company many-to-many relationship operations
  unlinkPersonFromClient(clientId: string, personId: string): Promise<void>;
  convertIndividualToCompanyClient(personId: string, companyData: Partial<InsertClient>, oldIndividualClientId?: string): Promise<{ newCompanyClient: Client; clientPerson: ClientPerson }>;
  
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
  findPeopleByNameAndBirthDate(firstName: string, lastName: string, year: number, month: number): Promise<Person[]>;
  
  // Client-People relationship operations
  createClientPerson(relationship: InsertClientPerson): Promise<ClientPerson>;
  getClientPeopleByClientId(clientId: string): Promise<(ClientPerson & { person: Person })[]>;
  getClientPeopleByPersonId(personId: string): Promise<(ClientPerson & { client: Client })[]>;
  updateClientPerson(id: string, relationship: Partial<InsertClientPerson>): Promise<ClientPerson>;
  deleteClientPerson(id: string): Promise<void>;
  linkPersonToClient(clientId: string, personId: string, officerRole?: string, isPrimaryContact?: boolean): Promise<ClientPerson>;
  
  // Project operations
  createProject(project: InsertProject): Promise<Project>;
  getAllProjects(filters?: { month?: string; archived?: boolean; showArchived?: boolean; inactive?: boolean; serviceId?: string; assigneeId?: string; serviceOwnerId?: string; userId?: string; dynamicDateFilter?: string; dateFrom?: string; dateTo?: string }): Promise<ProjectWithRelations[]>;
  getProjectsByUser(userId: string, role: string, filters?: { month?: string; archived?: boolean; showArchived?: boolean; inactive?: boolean; serviceId?: string; assigneeId?: string; serviceOwnerId?: string; userId?: string; dynamicDateFilter?: string; dateFrom?: string; dateTo?: string }): Promise<ProjectWithRelations[]>;
  getProjectsByClient(clientId: string, filters?: { month?: string; archived?: boolean; showArchived?: boolean; inactive?: boolean; serviceId?: string; assigneeId?: string; serviceOwnerId?: string; userId?: string; dynamicDateFilter?: string; dateFrom?: string; dateTo?: string }): Promise<ProjectWithRelations[]>;
  getProject(id: string): Promise<ProjectWithRelations | undefined>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project>;
  updateProjectStatus(update: UpdateProjectStatus, userId: string): Promise<Project>;
  getActiveProjectsByClientAndType(clientId: string, projectTypeId: string): Promise<Project[]>;
  
  // Chronology operations
  createChronologyEntry(entry: InsertProjectChronology): Promise<ProjectChronology>;
  getProjectChronology(projectId: string): Promise<(ProjectChronology & { assignee?: User; fieldResponses: (ReasonFieldResponse & { customField: ReasonCustomField })[] })[]>;
  
  // Client chronology operations
  createClientChronologyEntry(entry: InsertClientChronology): Promise<SelectClientChronology>;
  getClientChronology(clientId: string): Promise<(SelectClientChronology & { user?: User })[]>;
  
  // Configuration operations
  getAllKanbanStages(): Promise<KanbanStage[]>;
  getKanbanStagesByProjectTypeId(projectTypeId: string): Promise<KanbanStage[]>;
  getKanbanStagesByServiceId(serviceId: string): Promise<KanbanStage[]>;
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
  getProjectTypeDependencySummary(projectTypeId: string): Promise<{
    projects: number;
    chronologyEntries: number;
    kanbanStages: number;
    changeReasons: number;
    stageReasonMaps: number;
    stageApprovals: number;
    stageApprovalFields: number;
    reasonCustomFields: number;
    reasonFieldResponses: number;
    stageApprovalResponses: number;
  }>;
  forceDeleteProjectType(projectTypeId: string, confirmName: string): Promise<{
    projects: number;
    chronologyEntries: number;
    kanbanStages: number;
    changeReasons: number;
    stageReasonMaps: number;
    stageApprovals: number;
    stageApprovalFields: number;
    reasonCustomFields: number;
    reasonFieldResponses: number;
    stageApprovalResponses: number;
    message: string;
  }>;
  
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
  getUsersWithSchedulingNotifications(): Promise<User[]>;
  
  // Project views operations (saved filter configurations)
  createProjectView(view: InsertProjectView): Promise<ProjectView>;
  getProjectViewsByUserId(userId: string): Promise<ProjectView[]>;
  deleteProjectView(id: string): Promise<void>;
  
  // User column preferences operations
  getUserColumnPreferences(userId: string): Promise<UserColumnPreferences | undefined>;
  upsertUserColumnPreferences(preferences: InsertUserColumnPreferences): Promise<UserColumnPreferences>;
  updateUserColumnPreferences(userId: string, preferences: UpdateUserColumnPreferences): Promise<UserColumnPreferences>;
  
  // Dashboard operations
  createDashboard(dashboard: InsertDashboard): Promise<Dashboard>;
  getDashboardsByUserId(userId: string): Promise<Dashboard[]>;
  getSharedDashboards(): Promise<Dashboard[]>;
  getDashboardById(id: string): Promise<Dashboard | undefined>;
  updateDashboard(id: string, dashboard: UpdateDashboard): Promise<Dashboard>;
  deleteDashboard(id: string): Promise<void>;
  getHomescreenDashboard(userId: string): Promise<Dashboard | undefined>;
  clearHomescreenDashboards(userId: string): Promise<void>;
  
  // Analytics operations
  getProjectAnalytics(filters: any, groupBy: string, metric?: string): Promise<{ label: string; value: number }[]>;
  
  // Bulk project notification handling
  sendBulkProjectAssignmentNotifications(createdProjects: Project[]): Promise<void>;
  
  // User role operations
  getUsersByRole(role: string): Promise<User[]>;
  
  // Stage change notification operations
  sendStageChangeNotifications(projectId: string, newStageName: string, oldStageName?: string): Promise<void>;
  
  // Services CRUD
  getAllServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]>;
  getActiveServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]>;
  getServicesWithActiveClients(): Promise<Service[]>;
  getClientAssignableServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]>;
  getProjectTypeAssignableServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]>;
  getServiceById(id: string): Promise<Service | undefined>;
  getScheduledServices(): Promise<ScheduledServiceView[]>;
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
  getClientServicesByClientId(clientId: string): Promise<(ClientService & { 
    service: Service & { projectType: ProjectType }; 
    serviceOwner?: User; 
    roleAssignments: (ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[];
  })[]>;
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
  
  // People Services CRUD
  getAllPeopleServices(): Promise<(PeopleService & { person: Person; service: Service })[]>;
  getPeopleServiceById(id: string): Promise<(PeopleService & { person: Person; service: Service }) | undefined>;
  getPeopleServicesByPersonId(personId: string): Promise<(PeopleService & { service: Service })[]>;
  getPeopleServicesByServiceId(serviceId: string): Promise<(PeopleService & { person: Person })[]>;
  getPeopleServicesByClientId(clientId: string): Promise<(PeopleService & { person: Person; service: Service; serviceOwner?: User })[]>;
  createPeopleService(peopleService: InsertPeopleService): Promise<PeopleService>;
  updatePeopleService(id: string, peopleService: Partial<InsertPeopleService>): Promise<PeopleService>;
  deletePeopleService(id: string): Promise<void>;
  checkPeopleServiceMappingExists(personId: string, serviceId: string): Promise<boolean>;
  
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
  
  // Tag operations
  getAllClientTags(): Promise<ClientTag[]>;
  createClientTag(tag: InsertClientTag): Promise<ClientTag>;
  deleteClientTag(id: string): Promise<void>;
  getAllPeopleTags(): Promise<PeopleTag[]>;
  createPeopleTag(tag: InsertPeopleTag): Promise<PeopleTag>;
  deletePeopleTag(id: string): Promise<void>;
  
  // Tag assignment operations
  getClientTags(clientId: string): Promise<(ClientTagAssignment & { tag: ClientTag })[]>;
  assignClientTag(assignment: InsertClientTagAssignment): Promise<ClientTagAssignment>;
  unassignClientTag(clientId: string, tagId: string): Promise<void>;
  getPersonTags(personId: string): Promise<(PeopleTagAssignment & { tag: PeopleTag })[]>;
  assignPersonTag(assignment: InsertPeopleTagAssignment): Promise<PeopleTagAssignment>;
  unassignPersonTag(personId: string, tagId: string): Promise<void>;
  
  // Development operations
  clearTestData(): Promise<{ [tableName: string]: number }>;
  
  // Project Scheduling operations
  getAllClientServicesWithDetails(): Promise<(ClientService & { service: Service & { projectType: ProjectType } })[]>;
  getAllPeopleServicesWithDetails(): Promise<(PeopleService & { service: Service & { projectType: ProjectType } })[]>;
  createProjectSchedulingHistory(data: InsertProjectSchedulingHistory): Promise<ProjectSchedulingHistory>;
  getProjectSchedulingHistoryByServiceId(serviceId: string, serviceType: 'client' | 'people'): Promise<ProjectSchedulingHistory[]>;
  createSchedulingRunLog(data: InsertSchedulingRunLogs): Promise<SchedulingRunLogs>;
  getSchedulingRunLogs(limit?: number): Promise<SchedulingRunLogs[]>;
  getLatestSchedulingRunLog(): Promise<SchedulingRunLogs | undefined>;
  
  // Communications operations
  getAllCommunications(): Promise<(Communication & { client: Client; person?: Person; user: User })[]>;
  getCommunicationsByClientId(clientId: string): Promise<(Communication & { person?: Person; user: User })[]>;
  getCommunicationsByPersonId(personId: string): Promise<(Communication & { client: Client; user: User })[]>;
  getCommunicationById(id: string): Promise<(Communication & { client: Client; person?: Person; user: User }) | undefined>;
  createCommunication(communication: InsertCommunication): Promise<Communication>;
  updateCommunication(id: string, communication: Partial<InsertCommunication>): Promise<Communication>;
  deleteCommunication(id: string): Promise<void>;
  
  // User integrations operations  
  getUserIntegrations(userId: string): Promise<UserIntegration[]>;
  getUserIntegrationByType(userId: string, integrationType: 'office365' | 'voodoo_sms'): Promise<UserIntegration | undefined>;
  createUserIntegration(integration: InsertUserIntegration): Promise<UserIntegration>;
  updateUserIntegration(id: string, integration: Partial<InsertUserIntegration>): Promise<UserIntegration>;
  deleteUserIntegration(id: string): Promise<void>;
  
  // OAuth account operations
  getUserOauthAccount(userId: string, provider: string): Promise<UserOauthAccount | undefined>;
  createUserOauthAccount(account: InsertUserOauthAccount): Promise<UserOauthAccount>;
  updateUserOauthAccount(id: string, account: Partial<InsertUserOauthAccount>): Promise<UserOauthAccount>;
  deleteUserOauthAccount(userId: string, provider: string): Promise<void>;
  
  // Push subscription operations
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  getPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]>;
  deletePushSubscription(endpoint: string): Promise<void>;
  deletePushSubscriptionsByUserId(userId: string): Promise<void>;

  // Document folder operations
  createDocumentFolder(folder: InsertDocumentFolder): Promise<DocumentFolder>;
  getDocumentFolderById(id: string): Promise<DocumentFolder | undefined>;
  getDocumentFoldersByClientId(clientId: string): Promise<any[]>;
  deleteDocumentFolder(id: string): Promise<void>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentById(id: string): Promise<Document | undefined>;
  getDocumentsByClientId(clientId: string): Promise<Document[]>;
  getDocumentsByFolderId(folderId: string): Promise<any[]>;
  deleteDocument(id: string): Promise<void>;
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
    // Only support admin role since other roles are deprecated
    if (role === 'admin') {
      return await db.select().from(users).where(eq(users.isAdmin, true));
    }
    // Return empty array for deprecated roles
    console.warn(`Deprecated role requested: ${role}. Only admin role is supported.`);
    return [];
  }

  // Atomic admin creation to prevent race conditions
  async createAdminIfNone(userData: InsertUser): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // Use a transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Check if any admin users exist within the transaction
        const adminUsers = await tx.select().from(users).where(eq(users.isAdmin, true));
        
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
          isAdmin: true, // Ensure user is admin
          canSeeAdminMenu: true
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

  async getUsersWithSchedulingNotifications(): Promise<User[]> {
    const usersWithNotifications = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        isAdmin: users.isAdmin,
        canSeeAdminMenu: users.canSeeAdminMenu,
        passwordHash: users.passwordHash,
        isFallbackUser: users.isFallbackUser,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(userNotificationPreferences, eq(users.id, userNotificationPreferences.userId))
      .where(
        and(
          eq(userNotificationPreferences.notifySchedulingSummary, true),
          eq(users.isAdmin, true), // SECURITY: Only allow admin users to receive scheduling summaries
          isNull(users.email).not() // Ensure users have valid email addresses
        )
      );
    
    return usersWithNotifications as User[];
  }

  // Project views operations (saved filter configurations)
  async createProjectView(view: InsertProjectView): Promise<ProjectView> {
    const [newView] = await db
      .insert(projectViews)
      .values(view)
      .returning();
    return newView;
  }

  async getProjectViewsByUserId(userId: string): Promise<ProjectView[]> {
    const views = await db
      .select()
      .from(projectViews)
      .where(eq(projectViews.userId, userId))
      .orderBy(desc(projectViews.createdAt));
    return views;
  }

  async deleteProjectView(id: string): Promise<void> {
    await db
      .delete(projectViews)
      .where(eq(projectViews.id, id));
  }

  // User column preferences operations
  async getUserColumnPreferences(userId: string): Promise<UserColumnPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userColumnPreferences)
      .where(eq(userColumnPreferences.userId, userId));
    return preferences;
  }

  async upsertUserColumnPreferences(preferences: InsertUserColumnPreferences): Promise<UserColumnPreferences> {
    const [result] = await db
      .insert(userColumnPreferences)
      .values(preferences)
      .onConflictDoUpdate({
        target: userColumnPreferences.userId,
        set: {
          columnOrder: preferences.columnOrder,
          visibleColumns: preferences.visibleColumns,
          columnWidths: preferences.columnWidths,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateUserColumnPreferences(userId: string, preferences: UpdateUserColumnPreferences): Promise<UserColumnPreferences> {
    // Security: Explicitly omit userId from updates to prevent cross-user preference takeover
    const { userId: _omit, ...safePreferences } = preferences;
    
    const [updated] = await db
      .update(userColumnPreferences)
      .set({
        ...safePreferences,
        updatedAt: new Date(),
      })
      .where(eq(userColumnPreferences.userId, userId))
      .returning();
    
    if (!updated) {
      throw new Error(`Column preferences not found for user ${userId}`);
    }
    
    return updated;
  }

  // Dashboard operations
  async createDashboard(dashboard: InsertDashboard): Promise<Dashboard> {
    const [newDashboard] = await db
      .insert(dashboards)
      .values(dashboard)
      .returning();
    return newDashboard;
  }

  async getDashboardsByUserId(userId: string): Promise<Dashboard[]> {
    const userDashboards = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.userId, userId))
      .orderBy(desc(dashboards.createdAt));
    return userDashboards;
  }

  async getSharedDashboards(): Promise<Dashboard[]> {
    const shared = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.visibility, 'shared'))
      .orderBy(desc(dashboards.createdAt));
    return shared;
  }

  async getDashboardById(id: string): Promise<Dashboard | undefined> {
    const [dashboard] = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.id, id));
    return dashboard;
  }

  async updateDashboard(id: string, dashboard: UpdateDashboard): Promise<Dashboard> {
    const [updated] = await db
      .update(dashboards)
      .set({
        ...dashboard,
        updatedAt: new Date(),
      })
      .where(eq(dashboards.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Dashboard not found with id ${id}`);
    }
    
    return updated;
  }

  async deleteDashboard(id: string): Promise<void> {
    await db
      .delete(dashboards)
      .where(eq(dashboards.id, id));
  }

  async getHomescreenDashboard(userId: string): Promise<Dashboard | undefined> {
    const [dashboard] = await db
      .select()
      .from(dashboards)
      .where(and(
        eq(dashboards.userId, userId),
        eq(dashboards.isHomescreenDashboard, true)
      ));
    return dashboard;
  }

  async clearHomescreenDashboards(userId: string): Promise<void> {
    await db
      .update(dashboards)
      .set({ isHomescreenDashboard: false })
      .where(eq(dashboards.userId, userId));
  }

  // Analytics operations
  async getProjectAnalytics(filters: any, groupBy: string, metric?: string): Promise<{ label: string; value: number }[]> {
    const conditions: any[] = [];
    
    // Apply service filter (projects are linked to services through projectTypes)
    if (filters.serviceFilter && filters.serviceFilter !== 'all') {
      // Get project types for the selected service
      const projectTypesForService = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceFilter));
      
      if (projectTypesForService.length > 0) {
        const projectTypeIds = projectTypesForService.map(pt => pt.id);
        conditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        // No project types for this service, return empty results
        return [];
      }
    }
    
    // Apply archived filter
    if (filters.showArchived === false) {
      conditions.push(eq(projects.archived, false));
    }
    
    // Apply task assignee filter
    if (filters.taskAssigneeFilter && filters.taskAssigneeFilter !== 'all') {
      conditions.push(eq(projects.currentAssigneeId, filters.taskAssigneeFilter));
    }
    
    // Apply service owner filter
    if (filters.serviceOwnerFilter && filters.serviceOwnerFilter !== 'all') {
      conditions.push(eq(projects.projectOwnerId, filters.serviceOwnerFilter));
    }
    
    // Apply user filter
    if (filters.userFilter && filters.userFilter !== 'all') {
      conditions.push(
        or(
          eq(projects.bookkeeperId, filters.userFilter),
          eq(projects.clientManagerId, filters.userFilter),
          eq(projects.currentAssigneeId, filters.userFilter)
        )
      );
    }
    
    // Apply date filters
    if (filters.dynamicDateFilter && filters.dynamicDateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (filters.dynamicDateFilter === 'overdue') {
        conditions.push(sql`${projects.dueDate} < ${today}`);
      } else if (filters.dynamicDateFilter === 'today') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        conditions.push(sql`${projects.dueDate} >= ${today} AND ${projects.dueDate} < ${tomorrow}`);
      } else if (filters.dynamicDateFilter === 'next7days') {
        const next7 = new Date(today);
        next7.setDate(next7.getDate() + 7);
        conditions.push(sql`${projects.dueDate} >= ${today} AND ${projects.dueDate} < ${next7}`);
      } else if (filters.dynamicDateFilter === 'next14days') {
        const next14 = new Date(today);
        next14.setDate(next14.getDate() + 14);
        conditions.push(sql`${projects.dueDate} >= ${today} AND ${projects.dueDate} < ${next14}`);
      } else if (filters.dynamicDateFilter === 'next30days') {
        const next30 = new Date(today);
        next30.setDate(next30.getDate() + 30);
        conditions.push(sql`${projects.dueDate} >= ${today} AND ${projects.dueDate} < ${next30}`);
      } else if (filters.dynamicDateFilter === 'custom' && filters.customDateRange) {
        const { from, to } = filters.customDateRange;
        if (from) {
          const fromDate = new Date(from);
          conditions.push(sql`${projects.dueDate} >= ${fromDate}`);
        }
        if (to) {
          const toDate = new Date(to);
          conditions.push(sql`${projects.dueDate} <= ${toDate}`);
        }
      }
    }
    
    // Group by logic
    let results: { label: string; value: number }[] = [];
    
    if (groupBy === 'projectType') {
      const grouped = await db
        .select({
          projectTypeId: projects.projectTypeId,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(projects.projectTypeId);
      
      // Get project type names
      const projectTypeIds = grouped.map(g => g.projectTypeId).filter(Boolean) as string[];
      if (projectTypeIds.length > 0) {
        const types = await db
          .select()
          .from(projectTypes)
          .where(inArray(projectTypes.id, projectTypeIds));
        
        const typeMap = new Map(types.map(t => [t.id, t.name]));
        
        results = grouped.map(g => ({
          label: g.projectTypeId ? (typeMap.get(g.projectTypeId) || 'Unknown') : 'Unknown',
          value: g.count,
        }));
      }
    } else if (groupBy === 'status') {
      const grouped = await db
        .select({
          status: projects.currentStatus,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(projects.currentStatus);
      
      results = grouped.map(g => ({
        label: g.status || 'Unknown',
        value: g.count,
      }));
    } else if (groupBy === 'assignee') {
      const grouped = await db
        .select({
          assigneeId: projects.currentAssigneeId,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(projects.currentAssigneeId);
      
      // Get user names
      const assigneeIds = grouped.map(g => g.assigneeId).filter(Boolean) as string[];
      if (assigneeIds.length > 0) {
        const assignees = await db
          .select()
          .from(users)
          .where(inArray(users.id, assigneeIds));
        
        const userMap = new Map(assignees.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
        
        results = grouped.map(g => ({
          label: g.assigneeId ? (userMap.get(g.assigneeId) || 'Unknown') : 'Unassigned',
          value: g.count,
        }));
      }
    } else if (groupBy === 'serviceOwner') {
      // Group by project owner (which is the service owner)
      const grouped = await db
        .select({
          projectOwnerId: projects.projectOwnerId,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(projects.projectOwnerId);
      
      // Get user names for service owners
      const ownerIds = grouped.map(g => g.projectOwnerId).filter(Boolean) as string[];
      let ownerMap = new Map<string, string>();
      
      if (ownerIds.length > 0) {
        const owners = await db
          .select()
          .from(users)
          .where(inArray(users.id, ownerIds));
        
        ownerMap = new Map(owners.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
      }
      
      // Always construct results from grouped, even when ownerIds is empty
      results = grouped.map(g => ({
        label: g.projectOwnerId ? (ownerMap.get(g.projectOwnerId) || 'Unknown') : 'No Owner',
        value: g.count,
      }));
    } else if (groupBy === 'daysOverdue') {
      // Calculate days overdue buckets
      const allProjects = await db
        .select({
          id: projects.id,
          dueDate: projects.dueDate,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      const now = new Date();
      const buckets = {
        '1-9 days': 0,
        '10-31 days': 0,
        '32-60 days': 0,
        '60+ days': 0,
        'Not Overdue': 0,
      };
      
      for (const project of allProjects) {
        if (!project.dueDate) {
          buckets['Not Overdue']++;
        } else {
          const dueDate = new Date(project.dueDate);
          const diffTime = now.getTime() - dueDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            buckets['Not Overdue']++;
          } else if (diffDays >= 1 && diffDays <= 9) {
            buckets['1-9 days']++;
          } else if (diffDays >= 10 && diffDays <= 31) {
            buckets['10-31 days']++;
          } else if (diffDays >= 32 && diffDays <= 60) {
            buckets['32-60 days']++;
          } else {
            buckets['60+ days']++;
          }
        }
      }
      
      results = Object.entries(buckets).map(([label, value]) => ({
        label,
        value,
      })).filter(item => item.value > 0); // Only show non-empty buckets
    }
    
    return results;
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
    if (!adminUser || !adminUser.isAdmin) {
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

  // User activity tracking operations
  async trackUserActivity(userId: string, entityType: string, entityId: string): Promise<void> {
    try {
      // Insert or update activity tracking (upsert to handle duplicate views)
      await db
        .insert(userActivityTracking)
        .values({
          userId,
          entityType: entityType as any,
          entityId,
        })
        .onConflictDoUpdate({
          target: [userActivityTracking.userId, userActivityTracking.entityType, userActivityTracking.entityId],
          set: {
            viewedAt: sql`now()`,
          },
        });
    } catch (error) {
      console.error('Error tracking user activity:', error);
      // Don't throw error - activity tracking is non-critical
    }
  }

  async getRecentlyViewedByUser(userId: string, limit: number = 10): Promise<{ entityType: string; entityId: string; viewedAt: Date; entityData?: any }[]> {
    try {
      const recentActivities = await db
        .select()
        .from(userActivityTracking)
        .where(eq(userActivityTracking.userId, userId))
        .orderBy(desc(userActivityTracking.viewedAt))
        .limit(limit);


      // Enrich with entity data
      const enrichedActivities = await Promise.all(
        recentActivities.map(async (activity) => {
          let entityData = null;
          try {
            switch (activity.entityType) {
              case 'client':
                entityData = await this.getClientById(activity.entityId);
                break;
              case 'project':
                entityData = await this.getProject(activity.entityId);
                break;
              case 'person':
                entityData = await this.getPersonById(activity.entityId);
                break;
              case 'communication':
                // For now, we'll skip enriching communications
                break;
            }
          } catch (error) {
            console.warn(`Error enriching entity data for ${activity.entityType}:${activity.entityId}:`, error);
          }

          return {
            entityType: activity.entityType,
            entityId: activity.entityId,
            viewedAt: activity.viewedAt!,
            entityData,
          };
        })
      );

      return enrichedActivities;
    } catch (error) {
      console.error('Error getting recently viewed by user:', error);
      return [];
    }
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

  async getAllClients(search?: string): Promise<Client[]> {
    if (!search) {
      return await db.select().from(clients);
    }
    
    // Server-side search filtering by name or email
    const searchTerm = `%${search}%`;
    return await db
      .select()
      .from(clients)
      .where(
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.email, searchTerm)
        )
      );
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

  // Super search implementation
  async superSearch(query: string, limit: number = 5): Promise<SuperSearchResults> {
    const searchTerm = `%${query}%`;
    
    // Search clients by name, email, company number, companies house name
    const clientResults = await db
      .select()
      .from(clients)
      .where(
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.email, searchTerm),
          ilike(clients.companyNumber, searchTerm),
          ilike(clients.companiesHouseName, searchTerm)
        )
      )
      .limit(limit);

    // Search people by name, email
    const peopleResults = await db
      .select()
      .from(people)
      .where(
        or(
          ilike(people.fullName, searchTerm),
          ilike(people.firstName, searchTerm),
          ilike(people.lastName, searchTerm),
          ilike(people.email, searchTerm),
          ilike(people.primaryEmail, searchTerm)
        )
      )
      .limit(limit);

    // Get related people for found clients (to show associated contacts)
    let relatedPeople: any[] = [];
    if (clientResults.length > 0) {
      const clientIds = clientResults.map(c => c.id);
      relatedPeople = await db
        .select({
          id: people.id,
          fullName: people.fullName,
          firstName: people.firstName,
          lastName: people.lastName,
          email: people.email,
          primaryEmail: people.primaryEmail,
          occupation: people.occupation,
          clientId: clientPeople.clientId,
          clientName: clients.name,
          isPrimaryContact: clientPeople.isPrimaryContact,
        })
        .from(people)
        .innerJoin(clientPeople, eq(people.id, clientPeople.personId))
        .innerJoin(clients, eq(clientPeople.clientId, clients.id))
        .where(inArray(clientPeople.clientId, clientIds))
        .limit(limit * 2); // Allow more related people
    }

    // Search projects by description, including client name via join
    const projectResults = await db
      .select({
        id: projects.id,
        description: projects.description,
        currentStatus: projects.currentStatus,
        clientName: clients.name,
        projectTypeId: projects.projectTypeId
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(
        or(
          ilike(projects.description, searchTerm),
          ilike(clients.name, searchTerm)
        )
      )
      .limit(limit);

    // Search communications by subject and content
    const communicationResults = await db
      .select({
        id: communications.id,
        subject: communications.subject,
        content: communications.content,
        type: communications.type,
        actualContactTime: communications.actualContactTime,
        clientName: clients.name,
        personName: people.fullName
      })
      .from(communications)
      .leftJoin(clients, eq(communications.clientId, clients.id))
      .leftJoin(people, eq(communications.personId, people.id))
      .where(
        or(
          ilike(communications.subject, searchTerm),
          ilike(communications.content, searchTerm)
        )
      )
      .limit(limit);

    // Search services by name and description
    const serviceResults = await db
      .select()
      .from(services)
      .where(
        or(
          ilike(services.name, searchTerm),
          ilike(services.description, searchTerm)
        )
      )
      .limit(limit);

    // Transform results into SearchResult format
    const clientSearchResults: SearchResult[] = clientResults.map(client => ({
      id: client.id,
      type: 'client' as const,
      title: client.name,
      subtitle: client.companiesHouseName || client.email || undefined,
      description: client.companyNumber ? `Company #${client.companyNumber}` : undefined,
      metadata: {
        email: client.email,
        companyNumber: client.companyNumber,
        companyStatus: client.companyStatus
      }
    }));

    // Combine direct people search results with related people from clients
    const directPeopleResults: SearchResult[] = peopleResults.map(person => ({
      id: person.id,
      type: 'person' as const,
      title: person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim(),
      subtitle: person.email || person.primaryEmail || undefined,
      description: person.occupation || undefined,
      metadata: {
        email: person.email,
        primaryEmail: person.primaryEmail,
        occupation: person.occupation
      }
    }));

    const relatedPeopleResults: SearchResult[] = relatedPeople.map(person => ({
      id: person.id,
      type: 'person' as const,
      title: person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim(),
      subtitle: person.email || person.primaryEmail || undefined,
      description: person.clientName ? `Contact at ${person.clientName}` : person.occupation || undefined,
      metadata: {
        email: person.email,
        primaryEmail: person.primaryEmail,
        occupation: person.occupation,
        clientName: person.clientName,
        isPrimaryContact: person.isPrimaryContact
      }
    }));

    // Combine and deduplicate people results
    const allPeopleIds = new Set();
    const combinedPeopleResults: SearchResult[] = [];
    
    // Add direct people search results first
    for (const person of directPeopleResults) {
      if (!allPeopleIds.has(person.id)) {
        allPeopleIds.add(person.id);
        combinedPeopleResults.push(person);
      }
    }
    
    // Add related people results (avoiding duplicates)
    for (const person of relatedPeopleResults) {
      if (!allPeopleIds.has(person.id) && combinedPeopleResults.length < limit * 2) {
        allPeopleIds.add(person.id);
        combinedPeopleResults.push(person);
      }
    }

    const peopleSearchResults = combinedPeopleResults;

    const projectSearchResults: SearchResult[] = projectResults.map(project => ({
      id: project.id,
      type: 'project' as const,
      title: project.description,
      subtitle: project.clientName || undefined,
      description: project.currentStatus,
      metadata: {
        clientName: project.clientName,
        currentStatus: project.currentStatus,
        projectTypeId: project.projectTypeId
      }
    }));

    const communicationSearchResults: SearchResult[] = communicationResults.map(comm => ({
      id: comm.id,
      type: 'communication' as const,
      title: comm.subject || `${comm.type.replace('_', ' ')} communication`,
      subtitle: comm.clientName || comm.personName || undefined,
      description: comm.content?.substring(0, 100) + (comm.content && comm.content.length > 100 ? '...' : ''),
      metadata: {
        type: comm.type,
        actualContactTime: comm.actualContactTime,
        clientName: comm.clientName,
        personName: comm.personName
      }
    }));

    const serviceSearchResults: SearchResult[] = serviceResults.map(service => ({
      id: service.id,
      type: 'service' as const,
      title: service.name,
      subtitle: service.description || undefined,
      description: service.isPersonalService ? 'Personal Service' : 'Business Service',
      metadata: {
        isPersonalService: service.isPersonalService,
        isActive: service.isActive
      }
    }));

    const totalResults = clientSearchResults.length + peopleSearchResults.length + 
                        projectSearchResults.length + communicationSearchResults.length + 
                        serviceSearchResults.length;

    return {
      clients: clientSearchResults,
      people: peopleSearchResults,
      projects: projectSearchResults,
      communications: communicationSearchResults,
      services: serviceSearchResults,
      total: totalResults
    };
  }

  // People operations
  async createPerson(personData: InsertPerson): Promise<Person> {
    // Generate ID if not provided (for database compatibility)
    const personWithId = personData.id 
      ? personData 
      : { 
          ...personData, 
          id: `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
        };
    
    const [person] = await db.insert(people).values(personWithId).returning();
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

  // Find people by name and birth date for duplicate detection
  async findPeopleByNameAndBirthDate(firstName: string, lastName: string, year: number, month: number): Promise<Person[]> {
    // Create the birth date pattern YYYY-MM to match against
    const birthKey = `${year}-${month.toString().padStart(2, '0')}`;
    
    const matchingPeople = await db
      .select()
      .from(people)
      .where(
        and(
          ilike(people.firstName, firstName.trim()),
          ilike(people.lastName, lastName.trim()),
          ilike(people.dateOfBirth, `${birthKey}%`)
        )
      )
      .limit(10); // Limit results to prevent performance issues
    
    return matchingPeople;
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

  // Person-Company many-to-many relationship operations
  async convertIndividualToCompanyClient(
    personId: string, 
    companyData: Partial<InsertClient>, 
    oldIndividualClientId?: string
  ): Promise<{ newCompanyClient: Client; clientPerson: ClientPerson }> {
    // Validate inputs
    const person = await this.getPersonById(personId);
    if (!person) {
      throw new Error(`Person with ID '${personId}' not found`);
    }

    if (!companyData.name) {
      throw new Error('Company name is required');
    }

    // If oldIndividualClientId provided, validate it
    if (oldIndividualClientId) {
      const oldClient = await this.getClientById(oldIndividualClientId);
      if (!oldClient) {
        throw new Error(`Individual client with ID '${oldIndividualClientId}' not found`);
      }
      if (oldClient.clientType !== 'individual') {
        throw new Error(`Client '${oldClient.name}' is not an individual client`);
      }
    }

    // Use transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Create the new company client
      const newCompanyClient = await this.createClient({
        ...companyData,
        clientType: 'company'
      });

      // Link the person to the new company with sensible default role
      const clientPerson = await this.linkPersonToClient(
        newCompanyClient.id,
        personId,
        'Director', // Standard default role for company conversion
        true // Set as primary contact
      );

      // If oldIndividualClientId provided, we could handle the migration here
      // For now, we leave the old individual client as-is per user's requirement
      // that they'll handle data cleanup with delete functions later

      return { newCompanyClient, clientPerson };
    });
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

  // Helper function to resolve the stage role assignee for a project
  private async resolveStageRoleAssignee(project: any): Promise<User | undefined> {
    try {
      // If no current status, project type, or service, we can't resolve the assignee
      if (!project.currentStatus || !project.projectType?.id || !project.projectType?.serviceId) {
        return undefined;
      }

      // Find the kanban stage that matches the project's current status
      const stage = await db.query.kanbanStages.findFirst({
        where: and(
          eq(kanbanStages.projectTypeId, project.projectType.id),
          eq(kanbanStages.name, project.currentStatus)
        ),
      });

      // If no stage found or no role assigned to the stage, return undefined
      if (!stage || !stage.assignedWorkRoleId) {
        return undefined;
      }

      // Find the client service for this project's client and service
      const clientService = await db.query.clientServices.findFirst({
        where: and(
          eq(clientServices.clientId, project.clientId),
          eq(clientServices.serviceId, project.projectType.serviceId)
        ),
      });

      if (!clientService) {
        return undefined;
      }

      // Find the role assignment for this client service and work role
      const roleAssignment = await db.query.clientServiceRoleAssignments.findFirst({
        where: and(
          eq(clientServiceRoleAssignments.clientServiceId, clientService.id),
          eq(clientServiceRoleAssignments.workRoleId, stage.assignedWorkRoleId),
          eq(clientServiceRoleAssignments.isActive, true)
        ),
        with: {
          user: true,
        },
      });

      return roleAssignment?.user || undefined;
    } catch (error) {
      console.error('[Storage] Error resolving stage role assignee:', error);
      return undefined;
    }
  }

  async getAllProjects(filters?: { month?: string; archived?: boolean; showArchived?: boolean; inactive?: boolean; serviceId?: string; assigneeId?: string; serviceOwnerId?: string; userId?: string; dynamicDateFilter?: string; dateFrom?: string; dateTo?: string }): Promise<ProjectWithRelations[]> {
    let whereConditions = [];
    
    if (filters?.month) {
      whereConditions.push(eq(projects.projectMonth, filters.month));
    }
    
    // Handle archived filtering: only apply one or the other, not both
    if (filters?.archived !== undefined) {
      whereConditions.push(eq(projects.archived, filters.archived));
    } else if (filters?.showArchived === false) {
      // When showArchived is false, exclude archived projects
      whereConditions.push(eq(projects.archived, false));
    }
    // When showArchived is true or undefined, don't filter by archived status (include all)
    
    if (filters?.inactive !== undefined) {
      whereConditions.push(eq(projects.inactive, filters.inactive));
    }
    
    if (filters?.assigneeId) {
      whereConditions.push(eq(projects.currentAssigneeId, filters.assigneeId));
    }
    
    if (filters?.serviceOwnerId) {
      whereConditions.push(eq(projects.projectOwnerId, filters.serviceOwnerId));
    }
    
    if (filters?.userId) {
      whereConditions.push(eq(projects.clientManagerId, filters.userId));
    }

    // Filter by service if provided - need to join with projectTypes
    if (filters?.serviceId) {
      // Use a subquery to find project types linked to the service
      const serviceProjectTypes = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceId));
      
      const projectTypeIds = serviceProjectTypes.map(pt => pt.id);
      
      if (projectTypeIds.length > 0) {
        whereConditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        // No project types found for this service, return empty result
        return [];
      }
    }
    
    // Dynamic date filtering
    if (filters?.dynamicDateFilter && filters.dynamicDateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (filters.dynamicDateFilter) {
        case 'overdue':
          whereConditions.push(lt(projects.dueDate, today.toISOString()));
          break;
        case 'today':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lt(projects.dueDate, tomorrow.toISOString())
            )!
          );
          break;
        case 'next7days':
          const next7 = new Date(today);
          next7.setDate(next7.getDate() + 7);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lte(projects.dueDate, next7.toISOString())
            )!
          );
          break;
        case 'next14days':
          const next14 = new Date(today);
          next14.setDate(next14.getDate() + 14);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lte(projects.dueDate, next14.toISOString())
            )!
          );
          break;
        case 'next30days':
          const next30 = new Date(today);
          next30.setDate(next30.getDate() + 30);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lte(projects.dueDate, next30.toISOString())
            )!
          );
          break;
        case 'custom':
          if (filters.dateFrom && filters.dateTo) {
            whereConditions.push(
              and(
                gte(projects.dueDate, filters.dateFrom),
                lte(projects.dueDate, filters.dateTo)
              )!
            );
          } else if (filters.dateFrom) {
            whereConditions.push(gte(projects.dueDate, filters.dateFrom));
          } else if (filters.dateTo) {
            whereConditions.push(lte(projects.dueDate, filters.dateTo));
          }
          break;
      }
    }
    
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    const results = await db.query.projects.findMany({
      where: whereClause,
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        projectOwner: true,
        projectType: {
          with: {
            service: true,
          },
        },
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
    
    // Convert null relations to undefined and populate stage role assignee
    const projectsWithAssignees = await Promise.all(results.map(async (project) => {
      const stageRoleAssignee = await this.resolveStageRoleAssignee(project);
      return {
        ...project,
        currentAssignee: project.currentAssignee || undefined,
        projectOwner: project.projectOwner || undefined,
        stageRoleAssignee,
        chronology: project.chronology.map(c => ({
          ...c,
          assignee: c.assignee || undefined,
          fieldResponses: c.fieldResponses || [],
        })),
      };
    }));
    
    return projectsWithAssignees;
  }

  async getProjectsByUser(userId: string, role: string, filters?: { month?: string; archived?: boolean; showArchived?: boolean; inactive?: boolean; serviceId?: string; assigneeId?: string; serviceOwnerId?: string; userId?: string; dynamicDateFilter?: string; dateFrom?: string; dateTo?: string }): Promise<ProjectWithRelations[]> {
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
    
    // Handle archived filtering: only apply one or the other, not both
    if (filters?.archived !== undefined) {
      whereConditions.push(eq(projects.archived, filters.archived));
    } else if (filters?.showArchived === false) {
      whereConditions.push(eq(projects.archived, false));
    }
    
    if (filters?.inactive !== undefined) {
      whereConditions.push(eq(projects.inactive, filters.inactive));
    }
    
    if (filters?.assigneeId) {
      whereConditions.push(eq(projects.currentAssigneeId, filters.assigneeId));
    }
    
    if (filters?.serviceOwnerId) {
      whereConditions.push(eq(projects.projectOwnerId, filters.serviceOwnerId));
    }
    
    if (filters?.userId) {
      whereConditions.push(eq(projects.clientManagerId, filters.userId));
    }

    // Filter by service if provided - need to join with projectTypes
    if (filters?.serviceId) {
      // Use a subquery to find project types linked to the service
      const serviceProjectTypes = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceId));
      
      const projectTypeIds = serviceProjectTypes.map(pt => pt.id);
      
      if (projectTypeIds.length > 0) {
        whereConditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        // No project types found for this service, return empty result
        return [];
      }
    }
    
    // Dynamic date filtering
    if (filters?.dynamicDateFilter && filters.dynamicDateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (filters.dynamicDateFilter) {
        case 'overdue':
          whereConditions.push(lt(projects.dueDate, today.toISOString()));
          break;
        case 'today':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lt(projects.dueDate, tomorrow.toISOString())
            )!
          );
          break;
        case 'next7days':
          const next7 = new Date(today);
          next7.setDate(next7.getDate() + 7);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lte(projects.dueDate, next7.toISOString())
            )!
          );
          break;
        case 'next14days':
          const next14 = new Date(today);
          next14.setDate(next14.getDate() + 14);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lte(projects.dueDate, next14.toISOString())
            )!
          );
          break;
        case 'next30days':
          const next30 = new Date(today);
          next30.setDate(next30.getDate() + 30);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lte(projects.dueDate, next30.toISOString())
            )!
          );
          break;
        case 'custom':
          if (filters.dateFrom && filters.dateTo) {
            whereConditions.push(
              and(
                gte(projects.dueDate, filters.dateFrom),
                lte(projects.dueDate, filters.dateTo)
              )!
            );
          } else if (filters.dateFrom) {
            whereConditions.push(gte(projects.dueDate, filters.dateFrom));
          } else if (filters.dateTo) {
            whereConditions.push(lte(projects.dueDate, filters.dateTo));
          }
          break;
      }
    }
    
    const whereClause = and(...whereConditions);

    const results = await db.query.projects.findMany({
      where: whereClause,
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        projectOwner: true,
        projectType: {
          with: {
            service: true,
          },
        },
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
    
    // Convert null relations to undefined and populate stage role assignee
    const projectsWithAssignees = await Promise.all(results.map(async (project) => {
      const stageRoleAssignee = await this.resolveStageRoleAssignee(project);
      return {
        ...project,
        currentAssignee: project.currentAssignee || undefined,
        projectOwner: project.projectOwner || undefined,
        stageRoleAssignee,
        chronology: project.chronology.map(c => ({
          ...c,
          assignee: c.assignee || undefined,
          fieldResponses: c.fieldResponses || [],
        })),
      };
    }));
    
    return projectsWithAssignees;
  }

  async getProjectsByClient(clientId: string, filters?: { month?: string; archived?: boolean; showArchived?: boolean; inactive?: boolean; serviceId?: string; assigneeId?: string; serviceOwnerId?: string; userId?: string; dynamicDateFilter?: string; dateFrom?: string; dateTo?: string }): Promise<ProjectWithRelations[]> {
    let whereConditions = [eq(projects.clientId, clientId)];
    
    if (filters?.month) {
      whereConditions.push(eq(projects.projectMonth, filters.month));
    }
    
    // Handle archived filtering: only apply one or the other, not both
    if (filters?.archived !== undefined) {
      whereConditions.push(eq(projects.archived, filters.archived));
    } else if (filters?.showArchived === false) {
      whereConditions.push(eq(projects.archived, false));
    }
    
    if (filters?.inactive !== undefined) {
      whereConditions.push(eq(projects.inactive, filters.inactive));
    }
    
    if (filters?.assigneeId) {
      whereConditions.push(eq(projects.currentAssigneeId, filters.assigneeId));
    }
    
    if (filters?.serviceOwnerId) {
      whereConditions.push(eq(projects.projectOwnerId, filters.serviceOwnerId));
    }
    
    if (filters?.userId) {
      whereConditions.push(eq(projects.clientManagerId, filters.userId));
    }

    // Filter by service if provided - need to join with projectTypes
    if (filters?.serviceId) {
      // Use a subquery to find project types linked to the service
      const serviceProjectTypes = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceId));
      
      const projectTypeIds = serviceProjectTypes.map(pt => pt.id);
      
      if (projectTypeIds.length > 0) {
        whereConditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        // No project types found for this service, return empty result
        return [];
      }
    }
    
    // Dynamic date filtering
    if (filters?.dynamicDateFilter && filters.dynamicDateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (filters.dynamicDateFilter) {
        case 'overdue':
          whereConditions.push(lt(projects.dueDate, today.toISOString()));
          break;
        case 'today':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lt(projects.dueDate, tomorrow.toISOString())
            )!
          );
          break;
        case 'next7days':
          const next7 = new Date(today);
          next7.setDate(next7.getDate() + 7);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lte(projects.dueDate, next7.toISOString())
            )!
          );
          break;
        case 'next14days':
          const next14 = new Date(today);
          next14.setDate(next14.getDate() + 14);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lte(projects.dueDate, next14.toISOString())
            )!
          );
          break;
        case 'next30days':
          const next30 = new Date(today);
          next30.setDate(next30.getDate() + 30);
          whereConditions.push(
            and(
              gte(projects.dueDate, today.toISOString()),
              lte(projects.dueDate, next30.toISOString())
            )!
          );
          break;
        case 'custom':
          if (filters.dateFrom && filters.dateTo) {
            whereConditions.push(
              and(
                gte(projects.dueDate, filters.dateFrom),
                lte(projects.dueDate, filters.dateTo)
              )!
            );
          } else if (filters.dateFrom) {
            whereConditions.push(gte(projects.dueDate, filters.dateFrom));
          } else if (filters.dateTo) {
            whereConditions.push(lte(projects.dueDate, filters.dateTo));
          }
          break;
      }
    }
    
    const whereClause = and(...whereConditions);

    const results = await db.query.projects.findMany({
      where: whereClause,
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        projectOwner: true,
        projectType: {
          with: {
            service: true,
          },
        },
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
    
    // Convert null relations to undefined and populate stage role assignee
    const projectsWithAssignees = await Promise.all(results.map(async (project) => {
      const stageRoleAssignee = await this.resolveStageRoleAssignee(project);
      return {
        ...project,
        currentAssignee: project.currentAssignee || undefined,
        projectOwner: project.projectOwner || undefined,
        stageRoleAssignee,
        chronology: project.chronology.map(c => ({
          ...c,
          assignee: c.assignee || undefined,
          fieldResponses: c.fieldResponses || [],
        })),
      };
    }));
    
    return projectsWithAssignees;
  }

  async getProject(id: string): Promise<ProjectWithRelations | undefined> {
    const result = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        projectOwner: true,
        projectType: {
          with: {
            service: true,
          },
        },
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
    
    // Resolve stage role assignee
    const stageRoleAssignee = await this.resolveStageRoleAssignee(result);
    
    // Convert null relations to undefined to match TypeScript expectations
    return {
      ...result,
      currentAssignee: result.currentAssignee || undefined,
      projectOwner: result.projectOwner || undefined,
      stageRoleAssignee,
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

  async getActiveProjectsByClientAndType(clientId: string, projectTypeId: string): Promise<Project[]> {
    const activeProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.clientId, clientId),
          eq(projects.projectTypeId, projectTypeId),
          eq(projects.archived, false),
          eq(projects.inactive, false),
          isNull(projects.completionStatus) // Only include projects that are truly active (not completed)
        )
      );

    return activeProjects;
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

    // Determine new assignee based on the stage's assignment
    let newAssigneeId: string;
    if (stage.assignedUserId) {
      // Direct user assignment
      newAssigneeId = stage.assignedUserId;
    } else if (stage.assignedWorkRoleId) {
      // Work role assignment - get the work role name and resolve through client service role assignments
      const workRole = await this.getWorkRoleById(stage.assignedWorkRoleId);
      if (workRole) {
        const roleAssignment = await this.resolveRoleAssigneeForClient(project.clientId, project.projectTypeId, workRole.name);
        newAssigneeId = roleAssignment?.id || project.clientManagerId;
      } else {
        console.warn(`Work role ${stage.assignedWorkRoleId} not found, using client manager`);
        newAssigneeId = project.clientManagerId;
      }
    } else {
      // Fallback to current assignee or client manager
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

  // Client chronology operations
  async createClientChronologyEntry(entry: InsertClientChronology): Promise<SelectClientChronology> {
    const [chronology] = await db.insert(clientChronology).values(entry).returning();
    return chronology;
  }

  async getClientChronology(clientId: string): Promise<(SelectClientChronology & { user?: User })[]> {
    const results = await db.query.clientChronology.findMany({
      where: eq(clientChronology.clientId, clientId),
      with: {
        user: true,
      },
      orderBy: desc(clientChronology.timestamp),
    });
    
    // Convert null relations to undefined to match TypeScript expectations
    return results.map(c => ({
      ...c,
      user: c.user || undefined,
    }));
  }

  // Configuration operations
  async getAllKanbanStages(): Promise<KanbanStage[]> {
    return await db.select().from(kanbanStages).orderBy(kanbanStages.order);
  }

  async getKanbanStagesByProjectTypeId(projectTypeId: string): Promise<KanbanStage[]> {
    // Validate projectTypeId to prevent undefined/null being passed to query builder
    if (!projectTypeId || projectTypeId.trim() === '') {
      console.warn(`[Storage] getKanbanStagesByProjectTypeId called with invalid projectTypeId: "${projectTypeId}"`);
      return [];
    }
    
    return await db
      .select()
      .from(kanbanStages)
      .where(eq(kanbanStages.projectTypeId, projectTypeId))
      .orderBy(kanbanStages.order);
  }

  async getKanbanStagesByServiceId(serviceId: string): Promise<KanbanStage[]> {
    if (!serviceId || serviceId.trim() === '') {
      console.warn(`[Storage] getKanbanStagesByServiceId called with invalid serviceId: "${serviceId}"`);
      return [];
    }

    // Get kanban stages via project_types.service_id relationship
    const stages = await db
      .select({ stage: kanbanStages })
      .from(kanbanStages)
      .innerJoin(projectTypes, eq(kanbanStages.projectTypeId, projectTypes.id))
      .where(eq(projectTypes.serviceId, serviceId))
      .orderBy(kanbanStages.order);

    return stages.map(s => s.stage);
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
    // Check if the project type exists
    const projectType = await this.getProjectTypeById(id);
    if (!projectType) {
      throw new Error("Project type not found");
    }

    // Check for active projects using this project type
    const activeProjectCount = await this.countActiveProjectsUsingProjectType(id);
    if (activeProjectCount > 0) {
      throw new Error(`Cannot delete project type '${projectType.name}' because ${activeProjectCount} active project${activeProjectCount > 1 ? 's are' : ' is'} currently using this project type. Please archive or reassign these projects first.`);
    }

    // Check for archived/inactive projects using this project type
    const allProjectCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.projectTypeId, id));
    const totalProjects = allProjectCount[0]?.count || 0;
    
    if (totalProjects > 0) {
      throw new Error(`Cannot delete project type '${projectType.name}' because ${totalProjects} project${totalProjects > 1 ? 's are' : ' is'} still linked to this project type (including archived/inactive projects). Please reassign or delete these projects first.`);
    }

    // Check for kanban stages using this project type
    const stagesCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(kanbanStages)
      .where(eq(kanbanStages.projectTypeId, id));
    const totalStages = stagesCount[0]?.count || 0;
    
    if (totalStages > 0) {
      throw new Error(`Cannot delete project type '${projectType.name}' because ${totalStages} kanban stage${totalStages > 1 ? 's are' : ' is'} linked to this project type. Please delete or reassign these stages first.`);
    }

    // Check for change reasons using this project type
    const reasonsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(changeReasons)
      .where(eq(changeReasons.projectTypeId, id));
    const totalReasons = reasonsCount[0]?.count || 0;
    
    if (totalReasons > 0) {
      throw new Error(`Cannot delete project type '${projectType.name}' because ${totalReasons} change reason${totalReasons > 1 ? 's are' : ' is'} linked to this project type. Please delete or reassign these change reasons first.`);
    }

    // All checks passed, safe to delete
    const result = await db.delete(projectTypes).where(eq(projectTypes.id, id));
    if (result.rowCount === 0) {
      throw new Error("Project type not found");
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

  async getProjectTypeDependencySummary(projectTypeId: string): Promise<{
    projects: number;
    chronologyEntries: number;
    kanbanStages: number;
    changeReasons: number;
    stageReasonMaps: number;
    stageApprovals: number;
    stageApprovalFields: number;
    reasonCustomFields: number;
    reasonFieldResponses: number;
    stageApprovalResponses: number;
  }> {
    // Get all related projects
    const projectsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.projectTypeId, projectTypeId));
    const projectsCount = projectsResult[0]?.count || 0;

    // Get project IDs for further queries
    const projectIds = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.projectTypeId, projectTypeId));
    const projectIdList = projectIds.map(p => p.id);

    // Get chronology entries for these projects
    let chronologyCount = 0;
    if (projectIdList.length > 0) {
      const chronologyResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(projectChronology)
        .where(inArray(projectChronology.projectId, projectIdList));
      chronologyCount = chronologyResult[0]?.count || 0;
    }

    // Get kanban stages for this project type
    const stagesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(kanbanStages)
      .where(eq(kanbanStages.projectTypeId, projectTypeId));
    const stagesCount = stagesResult[0]?.count || 0;

    // Get stage IDs for further queries
    const stageIds = await db
      .select({ id: kanbanStages.id })
      .from(kanbanStages)
      .where(eq(kanbanStages.projectTypeId, projectTypeId));
    const stageIdList = stageIds.map(s => s.id);

    // Get change reasons for this project type
    const reasonsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(changeReasons)
      .where(eq(changeReasons.projectTypeId, projectTypeId));
    const reasonsCount = reasonsResult[0]?.count || 0;

    // Get reason IDs for further queries
    const reasonIds = await db
      .select({ id: changeReasons.id })
      .from(changeReasons)
      .where(eq(changeReasons.projectTypeId, projectTypeId));
    const reasonIdList = reasonIds.map(r => r.id);

    // Get stage-reason mappings
    let stageMapsCount = 0;
    if (stageIdList.length > 0 || reasonIdList.length > 0) {
      const conditions = [];
      if (stageIdList.length > 0) {
        conditions.push(inArray(stageReasonMaps.stageId, stageIdList));
      }
      if (reasonIdList.length > 0) {
        conditions.push(inArray(stageReasonMaps.reasonId, reasonIdList));
      }
      
      if (conditions.length > 0) {
        const stageMapsResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(stageReasonMaps)
          .where(or(...conditions));
        stageMapsCount = stageMapsResult[0]?.count || 0;
      }
    }

    // Get stage approvals for this project type
    const approvalsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(stageApprovals)
      .where(eq(stageApprovals.projectTypeId, projectTypeId));
    const approvalsCount = approvalsResult[0]?.count || 0;

    // Get approval IDs for further queries
    const approvalIds = await db
      .select({ id: stageApprovals.id })
      .from(stageApprovals)
      .where(eq(stageApprovals.projectTypeId, projectTypeId));
    const approvalIdList = approvalIds.map(a => a.id);

    // Get stage approval fields
    let approvalFieldsCount = 0;
    if (approvalIdList.length > 0) {
      const fieldsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(stageApprovalFields)
        .where(inArray(stageApprovalFields.stageApprovalId, approvalIdList));
      approvalFieldsCount = fieldsResult[0]?.count || 0;
    }

    // Get reason custom fields
    let customFieldsCount = 0;
    if (reasonIdList.length > 0) {
      const customFieldsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(reasonCustomFields)
        .where(inArray(reasonCustomFields.reasonId, reasonIdList));
      customFieldsCount = customFieldsResult[0]?.count || 0;
    }

    // Get custom field IDs for field responses
    let customFieldIds: string[] = [];
    if (reasonIdList.length > 0) {
      const fieldIds = await db
        .select({ id: reasonCustomFields.id })
        .from(reasonCustomFields)
        .where(inArray(reasonCustomFields.reasonId, reasonIdList));
      customFieldIds = fieldIds.map(f => f.id);
    }

    // Get chronology IDs for field responses
    let chronologyIds: string[] = [];
    if (projectIdList.length > 0) {
      const chronIds = await db
        .select({ id: projectChronology.id })
        .from(projectChronology)
        .where(inArray(projectChronology.projectId, projectIdList));
      chronologyIds = chronIds.map(c => c.id);
    }

    // Get reason field responses
    let fieldResponsesCount = 0;
    if (customFieldIds.length > 0 || chronologyIds.length > 0) {
      const conditions = [];
      if (customFieldIds.length > 0) {
        conditions.push(inArray(reasonFieldResponses.customFieldId, customFieldIds));
      }
      if (chronologyIds.length > 0) {
        conditions.push(inArray(reasonFieldResponses.chronologyId, chronologyIds));
      }
      
      if (conditions.length > 0) {
        const responsesResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(reasonFieldResponses)
          .where(or(...conditions));
        fieldResponsesCount = responsesResult[0]?.count || 0;
      }
    }

    // Get stage approval responses
    let approvalResponsesCount = 0;
    if (projectIdList.length > 0) {
      const responsesResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(stageApprovalResponses)
        .where(inArray(stageApprovalResponses.projectId, projectIdList));
      approvalResponsesCount = responsesResult[0]?.count || 0;
    }

    return {
      projects: projectsCount,
      chronologyEntries: chronologyCount,
      kanbanStages: stagesCount,
      changeReasons: reasonsCount,
      stageReasonMaps: stageMapsCount,
      stageApprovals: approvalsCount,
      stageApprovalFields: approvalFieldsCount,
      reasonCustomFields: customFieldsCount,
      reasonFieldResponses: fieldResponsesCount,
      stageApprovalResponses: approvalResponsesCount,
    };
  }

  async forceDeleteProjectType(projectTypeId: string, confirmName: string): Promise<{
    projects: number;
    chronologyEntries: number;
    kanbanStages: number;
    changeReasons: number;
    stageReasonMaps: number;
    stageApprovals: number;
    stageApprovalFields: number;
    reasonCustomFields: number;
    reasonFieldResponses: number;
    stageApprovalResponses: number;
    message: string;
  }> {
    // Verify project type exists and name matches
    const projectType = await this.getProjectTypeById(projectTypeId);
    if (!projectType) {
      throw new Error("Project type not found");
    }

    if (projectType.name !== confirmName) {
      throw new Error("Project type name confirmation does not match");
    }

    // Get counts before deletion for reporting
    const summary = await this.getProjectTypeDependencySummary(projectTypeId);

    // Perform cascade deletion in a transaction
    return await db.transaction(async (tx) => {
      // Get all related IDs we'll need for deletion
      const projectIds = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.projectTypeId, projectTypeId));
      const projectIdList = projectIds.map(p => p.id);

      const stageIds = await tx
        .select({ id: kanbanStages.id })
        .from(kanbanStages)
        .where(eq(kanbanStages.projectTypeId, projectTypeId));
      const stageIdList = stageIds.map(s => s.id);

      const reasonIds = await tx
        .select({ id: changeReasons.id })
        .from(changeReasons)
        .where(eq(changeReasons.projectTypeId, projectTypeId));
      const reasonIdList = reasonIds.map(r => r.id);

      const approvalIds = await tx
        .select({ id: stageApprovals.id })
        .from(stageApprovals)
        .where(eq(stageApprovals.projectTypeId, projectTypeId));
      const approvalIdList = approvalIds.map(a => a.id);

      const customFieldIds = reasonIdList.length > 0 ? await tx
        .select({ id: reasonCustomFields.id })
        .from(reasonCustomFields)
        .where(inArray(reasonCustomFields.reasonId, reasonIdList)) : [];
      const customFieldIdList = customFieldIds.map(f => f.id);

      const chronologyIds = projectIdList.length > 0 ? await tx
        .select({ id: projectChronology.id })
        .from(projectChronology)
        .where(inArray(projectChronology.projectId, projectIdList)) : [];
      const chronologyIdList = chronologyIds.map(c => c.id);

      // Delete in the correct order to avoid FK violations

      // 1. Delete reason field responses (depends on custom fields and chronology)
      if (customFieldIdList.length > 0) {
        await tx.delete(reasonFieldResponses)
          .where(inArray(reasonFieldResponses.customFieldId, customFieldIdList));
      }
      if (chronologyIdList.length > 0) {
        await tx.delete(reasonFieldResponses)
          .where(inArray(reasonFieldResponses.chronologyId, chronologyIdList));
      }

      // 2. Delete stage approval responses (depends on projects)
      if (projectIdList.length > 0) {
        await tx.delete(stageApprovalResponses)
          .where(inArray(stageApprovalResponses.projectId, projectIdList));
      }

      // 3. Delete project chronology (depends on projects)
      if (projectIdList.length > 0) {
        await tx.delete(projectChronology)
          .where(inArray(projectChronology.projectId, projectIdList));
      }

      // 4. Delete projects
      if (projectIdList.length > 0) {
        await tx.delete(projects)
          .where(inArray(projects.id, projectIdList));
      }

      // 5. Delete stage-reason mappings (depends on stages and reasons)
      if (stageIdList.length > 0) {
        await tx.delete(stageReasonMaps)
          .where(inArray(stageReasonMaps.stageId, stageIdList));
      }
      if (reasonIdList.length > 0) {
        await tx.delete(stageReasonMaps)
          .where(inArray(stageReasonMaps.reasonId, reasonIdList));
      }

      // 6. Delete stage approval fields (depends on stage approvals)
      if (approvalIdList.length > 0) {
        await tx.delete(stageApprovalFields)
          .where(inArray(stageApprovalFields.stageApprovalId, approvalIdList));
      }

      // 7. Delete stage approvals (depends on project type)
      await tx.delete(stageApprovals)
        .where(eq(stageApprovals.projectTypeId, projectTypeId));

      // 8. Delete reason custom fields (depends on reasons)
      if (reasonIdList.length > 0) {
        await tx.delete(reasonCustomFields)
          .where(inArray(reasonCustomFields.reasonId, reasonIdList));
      }

      // 9. Delete change reasons (depends on project type)
      await tx.delete(changeReasons)
        .where(eq(changeReasons.projectTypeId, projectTypeId));

      // 10. Delete kanban stages (depends on project type)
      await tx.delete(kanbanStages)
        .where(eq(kanbanStages.projectTypeId, projectTypeId));

      // 11. Finally, delete the project type itself
      await tx.delete(projectTypes)
        .where(eq(projectTypes.id, projectTypeId));

      return {
        ...summary,
        message: `Successfully deleted project type '${projectType.name}' and all ${summary.projects + summary.chronologyEntries + summary.kanbanStages + summary.changeReasons + summary.stageReasonMaps + summary.stageApprovals + summary.stageApprovalFields + summary.reasonCustomFields + summary.reasonFieldResponses + summary.stageApprovalResponses} related records.`
      };
    });
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
                assignedUserId: null, // Will use fallback logic
                assignedWorkRoleId: null,
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

      // Determine which users to notify based on the stage assignment
      let usersToNotify: User[] = [];
      
      if (newStage.assignedUserId) {
        // Direct user assignment - notify specific user
        const assignedUser = await this.getUser(newStage.assignedUserId);
        if (assignedUser) {
          usersToNotify = [assignedUser];
        }
      } else if (newStage.assignedWorkRoleId) {
        // Work role assignment - notify users assigned to this role for the client
        const workRole = await this.getWorkRoleById(newStage.assignedWorkRoleId);
        if (workRole) {
          const roleAssignment = await this.resolveRoleAssigneeForClient(project.clientId, project.projectTypeId, workRole.name);
          if (roleAssignment) {
            usersToNotify = [roleAssignment];
          }
        }
      }

      if (usersToNotify.length === 0) {
        console.log(`No users to notify for stage '${newStageName}', skipping notifications`);
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
      const userIds = usersToNotify.map(user => user.id);
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
      const finalUsersToNotify = usersToNotify.filter(user => {
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
  async getAllServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]> {
    // Get services with their optional project types
    const servicesData = await db
      .select({
        service: services,
        projectType: projectTypes,
      })
      .from(services)
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId));

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

    // Deduplicate services using a Map (services can have multiple project types)
    const servicesMap = new Map<string, Service & { projectType: ProjectType; roles: WorkRole[] }>();
    
    servicesData.forEach((row) => {
      if (!servicesMap.has(row.service.id)) {
        servicesMap.set(row.service.id, {
          ...row.service,
          projectType: row.projectType || {
            id: '',
            name: '',
            description: null,
            serviceId: null,
            active: true,
            order: 0,
            createdAt: null,
          },
          roles: rolesByServiceId[row.service.id] || [],
        });
      }
    });

    return Array.from(servicesMap.values());
  }

  async getActiveServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]> {
    // Get services with their optional project types
    const servicesData = await db
      .select({
        service: services,
        projectType: projectTypes,
      })
      .from(services)
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId));

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

    // Deduplicate services using a Map (services can have multiple project types)
    const servicesMap = new Map<string, Service & { projectType: ProjectType; roles: WorkRole[] }>();
    
    servicesData.forEach((row) => {
      if (!servicesMap.has(row.service.id)) {
        servicesMap.set(row.service.id, {
          ...row.service,
          projectType: row.projectType || {
            id: '',
            name: '',
            description: null,
            serviceId: null,
            active: true,
            order: 0,
            createdAt: null,
          },
          roles: rolesByServiceId[row.service.id] || [],
        });
      }
    });

    return Array.from(servicesMap.values());
  }

  async getServicesWithActiveClients(): Promise<Service[]> {
    // Get distinct services that have at least one active client service
    const servicesWithActiveClients = await db
      .selectDistinct({ service: services })
      .from(services)
      .innerJoin(clientServices, eq(services.id, clientServices.serviceId))
      .where(eq(clientServices.isActive, true));

    return servicesWithActiveClients.map(row => row.service);
  }

  async getClientAssignableServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]> {
    // Get services that are NOT personal services (for client assignment)
    const servicesData = await db
      .select({
        service: services,
        projectType: projectTypes,
      })
      .from(services)
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId))
      .where(or(eq(services.isPersonalService, false), isNull(services.isPersonalService)));

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

    // Deduplicate services using a Map (services can have multiple project types)
    const servicesMap = new Map<string, Service & { projectType: ProjectType; roles: WorkRole[] }>();
    
    servicesData.forEach((row) => {
      if (!servicesMap.has(row.service.id)) {
        servicesMap.set(row.service.id, {
          ...row.service,
          projectType: row.projectType || {
            id: '',
            name: '',
            description: null,
            serviceId: null,
            active: true,
            order: 0,
            createdAt: null,
          },
          roles: rolesByServiceId[row.service.id] || [],
        });
      }
    });

    return Array.from(servicesMap.values());
  }

  async getProjectTypeAssignableServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]> {
    // Get services that are NOT personal services AND NOT static services (for project type mapping)
    const servicesData = await db
      .select({
        service: services,
        projectType: projectTypes,
      })
      .from(services)
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId))
      .where(
        and(
          or(eq(services.isPersonalService, false), isNull(services.isPersonalService)),
          or(eq(services.isStaticService, false), isNull(services.isStaticService))
        )
      );

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

    // Deduplicate services using a Map (services can have multiple project types)
    const servicesMap = new Map<string, Service & { projectType: ProjectType; roles: WorkRole[] }>();
    
    servicesData.forEach((row) => {
      if (!servicesMap.has(row.service.id)) {
        servicesMap.set(row.service.id, {
          ...row.service,
          projectType: row.projectType || {
            id: '',
            name: '',
            description: null,
            serviceId: null,
            active: true,
            order: 0,
            createdAt: null,
          },
          roles: rolesByServiceId[row.service.id] || [],
        });
      }
    });

    return Array.from(servicesMap.values());
  }

  async getServiceById(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async getScheduledServices(): Promise<ScheduledServiceView[]> {
    // Get client services data
    const clientServicesData = await db
      .select({
        id: clientServices.id,
        serviceId: clientServices.serviceId,
        serviceName: services.name,
        clientOrPersonName: clients.name,
        nextStartDate: clientServices.nextStartDate,
        nextDueDate: clientServices.nextDueDate,
        frequency: clientServices.frequency,
        isActive: clientServices.isActive,
        serviceOwnerId: clientServices.serviceOwnerId,
        serviceOwnerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        projectTypeName: projectTypes.name,
        clientId: clientServices.clientId,
        projectTypeId: projectTypes.id,
      })
      .from(clientServices)
      .leftJoin(services, eq(clientServices.serviceId, services.id))
      .leftJoin(clients, eq(clientServices.clientId, clients.id))
      .leftJoin(users, eq(clientServices.serviceOwnerId, users.id))
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId))
      .where(eq(clientServices.isActive, true));

    // Get people services data with client context
    const peopleServicesData = await db
      .select({
        id: peopleServices.id,
        serviceId: peopleServices.serviceId,
        serviceName: services.name,
        clientOrPersonName: people.fullName,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        frequency: peopleServices.frequency,
        isActive: peopleServices.isActive,
        serviceOwnerId: peopleServices.serviceOwnerId,
        serviceOwnerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        projectTypeName: projectTypes.name,
        clientId: clientPeople.clientId, // Include client context for project detection
        projectTypeId: projectTypes.id,
      })
      .from(peopleServices)
      .leftJoin(services, eq(peopleServices.serviceId, services.id))
      .leftJoin(people, eq(peopleServices.personId, people.id))
      .leftJoin(users, eq(peopleServices.serviceOwnerId, users.id))
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId))
      .leftJoin(clientPeople, eq(peopleServices.personId, clientPeople.personId))
      .where(eq(peopleServices.isActive, true));

    // Get active projects to check which services have active projects and fetch their dates
    const activeProjects = await db
      .select({
        projectTypeId: projects.projectTypeId,
        clientId: projects.clientId,
        projectMonth: projects.projectMonth,
        dueDate: projects.dueDate,
      })
      .from(projects)
      .where(and(
        eq(projects.archived, false),
        eq(projects.inactive, false),
        sql`${projects.currentStatus} != 'completed'` // Exclude completed projects
      ));

    // Create a set of client-projectType combinations that have active projects
    const activeProjectKeys = new Set(
      activeProjects.map(p => `${p.clientId}-${p.projectTypeId}`)
    );

    // Create a map of client-projectType combinations to their project dates
    const activeProjectDates = new Map<string, { startDate: Date | null; dueDate: Date | null }>();
    activeProjects.forEach(p => {
      const key = `${p.clientId}-${p.projectTypeId}`;
      activeProjectDates.set(key, {
        startDate: p.projectMonth,
        dueDate: p.dueDate
      });
    });

    // Combine and transform the data, filtering out duplicates and calculating hasActiveProject
    const seenServices = new Set<string>();
    const scheduledServices: ScheduledServiceView[] = [];

    // Process client services
    for (const cs of clientServicesData) {
      const uniqueKey = `client-${cs.id}`;
      if (!seenServices.has(uniqueKey)) {
        seenServices.add(uniqueKey);
        
        // Calculate hasActiveProject for client services
        const projectKey = `${cs.clientId}-${cs.projectTypeId}`;
        const hasActiveProject = cs.clientId && cs.projectTypeId 
          ? activeProjectKeys.has(projectKey)
          : false;

        // Get current project dates if there's an active project
        const currentProjectDates = hasActiveProject && cs.clientId && cs.projectTypeId
          ? activeProjectDates.get(projectKey)
          : null;

        scheduledServices.push({
          id: cs.id || '',
          serviceId: cs.serviceId || '',
          serviceName: cs.serviceName || '',
          clientOrPersonName: cs.clientOrPersonName || '',
          clientOrPersonType: 'client' as const,
          nextStartDate: cs.nextStartDate ? cs.nextStartDate.toISOString() : null,
          nextDueDate: cs.nextDueDate ? cs.nextDueDate.toISOString() : null,
          currentProjectStartDate: currentProjectDates?.startDate ? 
            (currentProjectDates.startDate instanceof Date ? currentProjectDates.startDate.toISOString() : 
             typeof currentProjectDates.startDate === 'string' ? currentProjectDates.startDate : 
             new Date(currentProjectDates.startDate).toISOString()) : null,
          currentProjectDueDate: currentProjectDates?.dueDate ? 
            (currentProjectDates.dueDate instanceof Date ? currentProjectDates.dueDate.toISOString() : 
             typeof currentProjectDates.dueDate === 'string' ? currentProjectDates.dueDate : 
             new Date(currentProjectDates.dueDate).toISOString()) : null,
          projectTypeName: cs.projectTypeName || null,
          hasActiveProject,
          frequency: cs.frequency || 'monthly', // Default to monthly if undefined
          isActive: cs.isActive || false,
          serviceOwnerId: cs.serviceOwnerId || undefined,
          serviceOwnerName: cs.serviceOwnerName || undefined,
        });
      }
    }

    // Process people services
    for (const ps of peopleServicesData) {
      const uniqueKey = `person-${ps.id}`;
      if (!seenServices.has(uniqueKey)) {
        seenServices.add(uniqueKey);
        
        // Calculate hasActiveProject for people services (requires client context)
        const projectKey = `${ps.clientId}-${ps.projectTypeId}`;
        const hasActiveProject = ps.clientId && ps.projectTypeId 
          ? activeProjectKeys.has(projectKey)
          : false;

        // Get current project dates if there's an active project
        const currentProjectDates = hasActiveProject && ps.clientId && ps.projectTypeId
          ? activeProjectDates.get(projectKey)
          : null;

        scheduledServices.push({
          id: ps.id || '',
          serviceId: ps.serviceId || '',
          serviceName: ps.serviceName || '',
          clientOrPersonName: ps.clientOrPersonName || '',
          clientOrPersonType: 'person' as const,
          nextStartDate: ps.nextStartDate ? ps.nextStartDate.toISOString() : null,
          nextDueDate: ps.nextDueDate ? ps.nextDueDate.toISOString() : null,
          currentProjectStartDate: currentProjectDates?.startDate ? 
            (currentProjectDates.startDate instanceof Date ? currentProjectDates.startDate.toISOString() : 
             typeof currentProjectDates.startDate === 'string' ? currentProjectDates.startDate : 
             new Date(currentProjectDates.startDate).toISOString()) : null,
          currentProjectDueDate: currentProjectDates?.dueDate ? 
            (currentProjectDates.dueDate instanceof Date ? currentProjectDates.dueDate.toISOString() : 
             typeof currentProjectDates.dueDate === 'string' ? currentProjectDates.dueDate : 
             new Date(currentProjectDates.dueDate).toISOString()) : null,
          projectTypeName: ps.projectTypeName || null,
          hasActiveProject,
          frequency: ps.frequency || 'monthly', // Default to monthly if undefined
          isActive: ps.isActive || false,
          serviceOwnerId: ps.serviceOwnerId || undefined,
          serviceOwnerName: ps.serviceOwnerName || undefined,
        });
      }
    }

    return scheduledServices;
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
    // Validate projectTypeId to prevent undefined/null being passed to query builder
    if (!projectTypeId || projectTypeId.trim() === '') {
      console.warn(`[Storage] getServiceByProjectTypeId called with invalid projectTypeId: "${projectTypeId}"`);
      return undefined;
    }
    
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
      isActive: result.isActive,
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
        isActive: clientServices.isActive,
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
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      isActive: result.isActive,
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

  async getClientServicesByClientId(clientId: string): Promise<(ClientService & { 
    service: Service & { projectType: ProjectType }; 
    serviceOwner?: User; 
    roleAssignments: (ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[];
    hasActiveProject?: boolean;
    currentProjectStartDate?: string | null;
    currentProjectDueDate?: string | null;
  })[]> {
    try {
      console.log(`[DEBUG] Fetching client services for clientId: ${clientId}`);
      
      // Get basic client services first with simple query
      const clientServicesList = await db
        .select()
        .from(clientServices)
        .where(eq(clientServices.clientId, clientId));
      
      console.log(`[DEBUG] Found ${clientServicesList.length} client services for clientId: ${clientId}`);
      
      // For each client service, get the full data with separate simple queries
      const clientServicesWithDetails = await Promise.all(
        clientServicesList.map(async (cs) => {
          console.log(`[DEBUG] Processing client service with ID: ${cs.id}, serviceId: ${cs.serviceId}`);
          
          // Get service details with simple query
          const servicesList = await db
            .select()
            .from(services)
            .where(eq(services.id, cs.serviceId));
          
          if (!servicesList.length) {
            console.warn(`[WARNING] Service not found for serviceId: ${cs.serviceId}`);
            return null;
          }
          
          const service = servicesList[0];
          console.log(`[DEBUG] Found service: ${service.name}`);
          
          // Get project type - try by ID first, then by name matching
          let projectType = undefined;
          if (service.projectTypeId) {
            const projectTypesList = await db
              .select()
              .from(projectTypes)
              .where(eq(projectTypes.id, service.projectTypeId));
            projectType = projectTypesList.length ? projectTypesList[0] : undefined;
            console.log(`[DEBUG] Project type found by ID: ${projectType?.name || 'None'}`);
          } else {
            // Try to match by name if no projectTypeId is set
            const projectTypesList = await db
              .select()
              .from(projectTypes)
              .where(or(
                eq(projectTypes.name, service.name),
                ilike(projectTypes.name, `%${service.name.replace(' Service', '')}%`),
                ilike(service.name, `%${projectTypes.name}%`)
              ));
            projectType = projectTypesList.length ? projectTypesList[0] : undefined;
            console.log(`[DEBUG] Project type found by name matching: ${projectType?.name || 'None'} for service: ${service.name}`);
          }
          
          // Get service owner if exists
          let serviceOwner = undefined;
          if (cs.serviceOwnerId) {
            const ownersList = await db
              .select()
              .from(users)
              .where(eq(users.id, cs.serviceOwnerId));
            serviceOwner = ownersList.length ? ownersList[0] : undefined;
            console.log(`[DEBUG] Service owner found: ${serviceOwner?.email || 'None'}`);
          }
          
          // Get role assignments
          const roleAssignments = await this.getActiveClientServiceRoleAssignments(cs.id);
          console.log(`[DEBUG] Found ${roleAssignments.length} role assignments`);
          
          // Get current active project information if project type exists
          let hasActiveProject = false;
          let currentProjectStartDate: string | null = null;
          let currentProjectDueDate: string | null = null;
          
          if (projectType?.id) {
            const activeProjectsList = await db
              .select({
                projectMonth: projects.projectMonth,
                dueDate: projects.dueDate,
              })
              .from(projects)
              .where(and(
                eq(projects.clientId, cs.clientId),
                eq(projects.projectTypeId, projectType.id),
                ne(projects.currentStatus, 'Completed')
              ))
              .limit(1);
            
            if (activeProjectsList.length > 0) {
              hasActiveProject = true;
              const activeProject = activeProjectsList[0];
              
              // Safe date conversion with type checking
              if (activeProject.projectMonth) {
                try {
                  if (activeProject.projectMonth instanceof Date) {
                    currentProjectStartDate = activeProject.projectMonth.toISOString();
                  } else if (typeof activeProject.projectMonth === 'string') {
                    // Convert DD/MM/YYYY format to ISO format
                    const parts = activeProject.projectMonth.split('/');
                    if (parts.length === 3) {
                      const [day, month, year] = parts;
                      const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
                      if (!isNaN(date.getTime())) {
                        currentProjectStartDate = date.toISOString();
                      } else {
                        currentProjectStartDate = activeProject.projectMonth; // fallback
                      }
                    } else {
                      currentProjectStartDate = activeProject.projectMonth; // fallback
                    }
                  }
                } catch (error) {
                  console.warn(`[WARNING] Error processing project start date for client service ${cs.id}:`, error);
                }
              }
              
              if (activeProject.dueDate) {
                try {
                  if (activeProject.dueDate instanceof Date) {
                    currentProjectDueDate = activeProject.dueDate.toISOString();
                  } else if (typeof activeProject.dueDate === 'string') {
                    currentProjectDueDate = activeProject.dueDate;
                  }
                } catch (error) {
                  console.warn(`[WARNING] Error processing project due date for client service ${cs.id}:`, error);
                }
              }
              
              console.log(`[DEBUG] Found active project for client service ${cs.id}: start=${currentProjectStartDate}, due=${currentProjectDueDate}`);
            }
          }
          
          return {
            id: cs.id,
            clientId: cs.clientId,
            serviceId: cs.serviceId,
            serviceOwnerId: cs.serviceOwnerId,
            frequency: cs.frequency,
            nextStartDate: cs.nextStartDate,
            nextDueDate: cs.nextDueDate,
            isActive: cs.isActive,
            createdAt: cs.createdAt,
            service: {
              id: service.id,
              name: service.name,
              description: service.description,
              projectTypeId: service.projectTypeId,
              udfDefinitions: service.udfDefinitions,
              isActive: service.isActive,
              isPersonalService: service.isPersonalService,
              isStaticService: service.isStaticService,
              isCompaniesHouseConnected: service.isCompaniesHouseConnected,
              chStartDateField: service.chStartDateField,
              chDueDateField: service.chDueDateField,
              createdAt: service.createdAt,
              projectType,
            },
            serviceOwner,
            roleAssignments,
            hasActiveProject,
            currentProjectStartDate,
            currentProjectDueDate,
          };
        })
      );
      
      // Filter out any null results (from missing services)
      const validClientServices = clientServicesWithDetails.filter(cs => cs !== null);
      
      console.log(`[DEBUG] Successfully processed ${validClientServices.length} valid client services`);
      return validClientServices;
    } catch (error) {
      console.error(`[ERROR] Error in getClientServicesByClientId for clientId ${clientId}:`, error);
      console.error(`[ERROR] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
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

    // Convert ISO string dates to Date objects for timestamp fields
    const processedData = { ...clientServiceData };
    if (processedData.nextStartDate && typeof processedData.nextStartDate === 'string') {
      processedData.nextStartDate = new Date(processedData.nextStartDate);
    }
    if (processedData.nextDueDate && typeof processedData.nextDueDate === 'string') {
      processedData.nextDueDate = new Date(processedData.nextDueDate);
    }

    const [updatedClientService] = await db
      .update(clientServices)
      .set(processedData)
      .where(eq(clientServices.id, id))
      .returning();
    
    if (!updatedClientService) {
      throw new Error("Failed to update client service");
    }
    
    return updatedClientService;
  }

  async getClientServiceByClientAndProjectType(clientId: string, projectTypeId: string): Promise<ClientService | undefined> {
    // Validate input parameters to prevent undefined/null being passed to query builder
    if (!clientId || clientId.trim() === '') {
      console.warn(`[Storage] getClientServiceByClientAndProjectType called with invalid clientId: "${clientId}"`);
      return undefined;
    }
    if (!projectTypeId || projectTypeId.trim() === '') {
      console.warn(`[Storage] getClientServiceByClientAndProjectType called with invalid projectTypeId: "${projectTypeId}"`);
      return undefined;
    }
    
    // Find the service for this project type
    const service = await this.getServiceByProjectTypeId(projectTypeId);
    if (!service) {
      return undefined;
    }
    
    // Validate service.id to prevent undefined/null being passed to query builder
    if (!service.id || service.id.trim() === '') {
      console.warn(`[Storage] getClientServiceByClientAndProjectType: service has invalid id: "${service.id}" for projectTypeId: "${projectTypeId}"`);
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
    // Validate clientServiceId to prevent undefined/null being passed to query builder
    if (!clientServiceId || clientServiceId.trim() === '') {
      console.warn(`[Storage] getClientServiceRoleAssignments called with invalid clientServiceId: "${clientServiceId}"`);
      return [];
    }
    
    try {
      // Use a simpler approach to avoid complex join issues that could cause TypeError
      // First get basic role assignments
      console.log(`[Storage] Getting basic role assignments for clientServiceId: ${clientServiceId}`);
      const assignments = await db
        .select()
        .from(clientServiceRoleAssignments)
        .where(eq(clientServiceRoleAssignments.clientServiceId, clientServiceId));
      
      console.log(`[Storage] Found ${assignments.length} role assignments`);
      
      // For each assignment, get the work role and user details separately
      const assignmentsWithDetails = await Promise.all(
        assignments.map(async (assignment) => {
          try {
            // Validate assignment has required IDs
            if (!assignment.workRoleId || !assignment.userId) {
              console.warn(`[Storage] Assignment ${assignment.id} has invalid workRoleId (${assignment.workRoleId}) or userId (${assignment.userId})`);
              return null;
            }
            
            console.log(`[Storage] Getting details for assignment ${assignment.id} - workRoleId: ${assignment.workRoleId}, userId: ${assignment.userId}`);
            
            // Get work role details
            const [workRole] = await db
              .select()
              .from(workRoles)
              .where(eq(workRoles.id, assignment.workRoleId));
            
            // Get user details
            const [user] = await db
              .select()
              .from(users)
              .where(eq(users.id, assignment.userId));
            
            if (!workRole || !user) {
              console.warn(`[Storage] Missing workRole (${!!workRole}) or user (${!!user}) for assignment ${assignment.id}`);
              return null;
            }
            
            return {
              id: assignment.id,
              clientServiceId: assignment.clientServiceId,
              workRoleId: assignment.workRoleId,
              userId: assignment.userId,
              isActive: assignment.isActive,
              createdAt: assignment.createdAt,
              workRole,
              user,
            };
          } catch (error) {
            console.error(`[Storage] Error processing assignment ${assignment.id}:`, error);
            return null;
          }
        })
      );
      
      // Filter out null results
      const validAssignments = assignmentsWithDetails.filter(assignment => assignment !== null);
      console.log(`[Storage] Returning ${validAssignments.length} valid assignments with details`);
      
      return validAssignments;
    } catch (error) {
      console.error(`[Storage] Error in getClientServiceRoleAssignments for clientServiceId ${clientServiceId}:`, error);
      return [];
    }
  }

  async getActiveClientServiceRoleAssignments(clientServiceId: string): Promise<(ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[]> {
    console.log(`[DEBUG] Getting role assignments for clientServiceId: ${clientServiceId}`);
    
    // Get basic role assignments first
    const roleAssignmentsList = await db
      .select()
      .from(clientServiceRoleAssignments)
      .where(and(
        eq(clientServiceRoleAssignments.clientServiceId, clientServiceId),
        eq(clientServiceRoleAssignments.isActive, true)
      ));
    
    console.log(`[DEBUG] Found ${roleAssignmentsList.length} active role assignments`);
    
    // For each assignment, get the work role and user details
    const roleAssignmentsWithDetails = await Promise.all(
      roleAssignmentsList.map(async (assignment) => {
        // Get work role details
        const workRolesList = await db
          .select()
          .from(workRoles)
          .where(eq(workRoles.id, assignment.workRoleId));
        
        // Get user details
        const usersList = await db
          .select()
          .from(users)
          .where(eq(users.id, assignment.userId));
        
        if (!workRolesList.length || !usersList.length) {
          console.warn(`[WARNING] Missing workRole or user for assignment ${assignment.id}`);
          return null;
        }
        
        return {
          id: assignment.id,
          clientServiceId: assignment.clientServiceId,
          workRoleId: assignment.workRoleId,
          userId: assignment.userId,
          isActive: assignment.isActive,
          createdAt: assignment.createdAt,
          workRole: workRolesList[0],
          user: usersList[0],
        };
      })
    );
    
    // Filter out any null results
    const validRoleAssignments = roleAssignmentsWithDetails.filter(ra => ra !== null);
    console.log(`[DEBUG] Successfully processed ${validRoleAssignments.length} valid role assignments`);
    
    return validRoleAssignments;
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

  // Role Resolution by Role ID (NEW - more efficient)
  async resolveRoleAssigneeForClientByRoleId(clientId: string, projectTypeId: string, workRoleId: string): Promise<User | undefined> {
    try {
      // Find the service for this project type
      const [projectType] = await db
        .select()
        .from(projectTypes)
        .where(eq(projectTypes.id, projectTypeId));
      
      if (!projectType?.serviceId) {
        console.warn(`No project type or service found for project type ID: ${projectTypeId}`);
        return undefined;
      }

      const [service] = await db
        .select()
        .from(services)
        .where(eq(services.id, projectType.serviceId));
      
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

      // Find ALL active role assignments and pick most recent (deterministic selection)
      const assignments = await db
        .select()
        .from(clientServiceRoleAssignments)
        .innerJoin(users, eq(clientServiceRoleAssignments.userId, users.id))
        .where(and(
          eq(clientServiceRoleAssignments.clientServiceId, clientService.id),
          eq(clientServiceRoleAssignments.workRoleId, workRoleId),
          eq(clientServiceRoleAssignments.isActive, true)
        ))
        .orderBy(desc(clientServiceRoleAssignments.createdAt));
      
      if (assignments.length === 0) {
        console.warn(`No active role assignment found for client ${clientId}, work role ID ${workRoleId}`);
        return undefined;
      }

      if (assignments.length > 1) {
        console.warn(`Multiple active assignments found for client ${clientId}, work role ID ${workRoleId}. Selecting most recent assignment.`);
      }
      
      // Return the most recent assignment (deterministic selection)
      return assignments[0].users;
    } catch (error) {
      console.error(`Error resolving role assignee for client ${clientId}, project type ${projectTypeId}, work role ID ${workRoleId}:`, error);
      return undefined;
    }
  }

  // Role Resolution for Project Creation (by role name - kept for backwards compatibility)
  async resolveRoleAssigneeForClient(clientId: string, projectTypeId: string, roleName: string): Promise<User | undefined> {
    try {
      // Find the service for this project type
      const [projectType] = await db
        .select()
        .from(projectTypes)
        .where(eq(projectTypes.id, projectTypeId));
      
      if (!projectType?.serviceId) {
        console.warn(`No project type or service found for project type ID: ${projectTypeId}`);
        return undefined;
      }

      const [service] = await db
        .select()
        .from(services)
        .where(eq(services.id, projectType.serviceId));
      
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
        .select()
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
      return assignments[0].users;
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

    if (defaultStage?.assignedUserId) {
      // Direct user assignment
      const assignedUser = await this.getUser(defaultStage.assignedUserId);
      if (assignedUser) {
        currentAssignee = assignedUser;
      } else {
        console.warn(`Assigned user ${defaultStage.assignedUserId} not found, using client manager`);
        currentAssignee = clientManager;
      }
    } else if (defaultStage?.assignedWorkRoleId) {
      // Work role assignment - resolve through client service role assignments
      const workRole = await this.getWorkRoleById(defaultStage.assignedWorkRoleId);
      if (workRole) {
        const roleAssignment = await this.resolveRoleAssigneeForClient(clientId, projectTypeId, workRole.name);
        if (roleAssignment) {
          currentAssignee = roleAssignment;
        } else {
          console.warn(`No ${workRole.name} assignment found for client ${clientId}, using client manager`);
          currentAssignee = clientManager;
        }
      } else {
        console.warn(`Work role ${defaultStage.assignedWorkRoleId} not found, using client manager`);
        currentAssignee = clientManager;
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

  // People Services CRUD operations
  async getAllPeopleServices(): Promise<(PeopleService & { person: Person; service: Service })[]> {
    const results = await db
      .select({
        id: peopleServices.id,
        personId: peopleServices.personId,
        serviceId: peopleServices.serviceId,
        serviceOwnerId: peopleServices.serviceOwnerId,
        frequency: peopleServices.frequency,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        notes: peopleServices.notes,
        isActive: peopleServices.isActive,
        createdAt: peopleServices.createdAt,
        // Person details
        person: people,
        // Service details  
        service: services,
      })
      .from(peopleServices)
      .leftJoin(people, eq(peopleServices.personId, people.id))
      .leftJoin(services, eq(peopleServices.serviceId, services.id));

    return results.map(result => ({
      id: result.id,
      personId: result.personId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      notes: result.notes,
      isActive: result.isActive,
      createdAt: result.createdAt,
      person: result.person!,
      service: result.service!,
    }));
  }

  async getPeopleServiceById(id: string): Promise<(PeopleService & { person: Person; service: Service }) | undefined> {
    const [result] = await db
      .select({
        id: peopleServices.id,
        personId: peopleServices.personId,
        serviceId: peopleServices.serviceId,
        serviceOwnerId: peopleServices.serviceOwnerId,
        frequency: peopleServices.frequency,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        notes: peopleServices.notes,
        isActive: peopleServices.isActive,
        createdAt: peopleServices.createdAt,
        // Person details
        person: people,
        // Service details
        service: services,
      })
      .from(peopleServices)
      .leftJoin(people, eq(peopleServices.personId, people.id))
      .leftJoin(services, eq(peopleServices.serviceId, services.id))
      .where(eq(peopleServices.id, id));

    if (!result) return undefined;

    return {
      id: result.id,
      personId: result.personId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      notes: result.notes,
      isActive: result.isActive,
      createdAt: result.createdAt,
      person: result.person!,
      service: result.service!,
    };
  }

  async getPeopleServicesByPersonId(personId: string): Promise<(PeopleService & { service: Service })[]> {
    const results = await db
      .select({
        id: peopleServices.id,
        personId: peopleServices.personId,
        serviceId: peopleServices.serviceId,
        serviceOwnerId: peopleServices.serviceOwnerId,
        frequency: peopleServices.frequency,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        notes: peopleServices.notes,
        isActive: peopleServices.isActive,
        createdAt: peopleServices.createdAt,
        // Service details
        service: services,
      })
      .from(peopleServices)
      .leftJoin(services, eq(peopleServices.serviceId, services.id))
      .where(eq(peopleServices.personId, personId));

    return results.map(result => ({
      id: result.id,
      personId: result.personId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      notes: result.notes,
      isActive: result.isActive,
      createdAt: result.createdAt,
      service: result.service!,
    }));
  }

  async getPeopleServicesByServiceId(serviceId: string): Promise<(PeopleService & { person: Person })[]> {
    const results = await db
      .select({
        id: peopleServices.id,
        personId: peopleServices.personId,
        serviceId: peopleServices.serviceId,
        serviceOwnerId: peopleServices.serviceOwnerId,
        frequency: peopleServices.frequency,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        notes: peopleServices.notes,
        isActive: peopleServices.isActive,
        createdAt: peopleServices.createdAt,
        // Person details
        person: people,
      })
      .from(peopleServices)
      .leftJoin(people, eq(peopleServices.personId, people.id))
      .where(eq(peopleServices.serviceId, serviceId));

    return results.map(result => ({
      id: result.id,
      personId: result.personId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      notes: result.notes,
      isActive: result.isActive,
      createdAt: result.createdAt,
      person: result.person!,
    }));
  }

  async getPeopleServicesByClientId(clientId: string): Promise<(PeopleService & { person: Person; service: Service; serviceOwner?: User })[]> {
    const results = await db
      .select({
        id: peopleServices.id,
        personId: peopleServices.personId,
        serviceId: peopleServices.serviceId,
        serviceOwnerId: peopleServices.serviceOwnerId,
        frequency: peopleServices.frequency,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        notes: peopleServices.notes,
        isActive: peopleServices.isActive,
        createdAt: peopleServices.createdAt,
        // Person details
        person: people,
        // Service details
        service: services,
        // Service owner details (optional)
        serviceOwner: users,
      })
      .from(peopleServices)
      .leftJoin(people, eq(peopleServices.personId, people.id))
      .leftJoin(services, eq(peopleServices.serviceId, services.id))
      .leftJoin(users, eq(peopleServices.serviceOwnerId, users.id))
      .leftJoin(clientPeople, eq(people.id, clientPeople.personId))
      .where(eq(clientPeople.clientId, clientId));

    return results.map(result => ({
      id: result.id,
      personId: result.personId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      notes: result.notes,
      isActive: result.isActive,
      createdAt: result.createdAt,
      person: result.person!,
      service: result.service!,
      serviceOwner: result.serviceOwner || undefined,
    }));
  }

  async createPeopleService(peopleServiceData: InsertPeopleService): Promise<PeopleService> {
    // Validate that person exists
    const person = await this.getPersonById(peopleServiceData.personId);
    if (!person) {
      throw new Error(`Person with ID '${peopleServiceData.personId}' not found`);
    }

    // Validate that service exists and is a personal service
    const service = await this.getServiceById(peopleServiceData.serviceId);
    if (!service) {
      throw new Error(`Service with ID '${peopleServiceData.serviceId}' not found`);
    }

    if (!service.isPersonalService) {
      throw new Error(`Service '${service.name}' is not a personal service and cannot be assigned to people`);
    }

    // Check if mapping already exists
    const mappingExists = await this.checkPeopleServiceMappingExists(peopleServiceData.personId, peopleServiceData.serviceId);
    if (mappingExists) {
      const personName = person.fullName || `ID: ${person.id}`;
      throw new Error(`Person-service mapping already exists between person '${personName}' and service '${service.name}'. Each person can only be mapped to a service once.`);
    }

    // Validate service owner if provided
    if (peopleServiceData.serviceOwnerId) {
      const serviceOwner = await this.getUser(peopleServiceData.serviceOwnerId);
      if (!serviceOwner) {
        throw new Error(`Service owner with ID '${peopleServiceData.serviceOwnerId}' not found`);
      }
    }

    const [newPeopleService] = await db.insert(peopleServices).values(peopleServiceData).returning();
    return newPeopleService;
  }

  async updatePeopleService(id: string, peopleServiceData: Partial<InsertPeopleService>): Promise<PeopleService> {
    // Validate that the people service exists
    const existing = await this.getPeopleServiceById(id);
    if (!existing) {
      throw new Error(`People service with ID '${id}' not found`);
    }

    // Validate service if serviceId is being changed
    if (peopleServiceData.serviceId) {
      const service = await this.getServiceById(peopleServiceData.serviceId);
      if (!service) {
        throw new Error(`Service with ID '${peopleServiceData.serviceId}' not found`);
      }

      if (!service.isPersonalService) {
        throw new Error(`Service '${service.name}' is not a personal service and cannot be assigned to people`);
      }

      // Check for conflicts if the person-service combination is changing
      const newPersonId = peopleServiceData.personId || existing.personId;
      const newServiceId = peopleServiceData.serviceId;

      if (newServiceId !== existing.serviceId || newPersonId !== existing.personId) {
        const mappingExists = await this.checkPeopleServiceMappingExists(newPersonId, newServiceId);
        if (mappingExists) {
          throw new Error(`Person-service mapping already exists for the new person-service combination. Each person can only be mapped to a service once.`);
        }
      }
    }

    // Validate person if personId is being changed
    if (peopleServiceData.personId) {
      const person = await this.getPersonById(peopleServiceData.personId);
      if (!person) {
        throw new Error(`Person with ID '${peopleServiceData.personId}' not found`);
      }
    }

    // Validate service owner if provided
    if (peopleServiceData.serviceOwnerId) {
      const serviceOwner = await this.getUser(peopleServiceData.serviceOwnerId);
      if (!serviceOwner) {
        throw new Error(`Service owner with ID '${peopleServiceData.serviceOwnerId}' not found`);
      }
    }

    const [updatedPeopleService] = await db
      .update(peopleServices)
      .set(peopleServiceData)
      .where(eq(peopleServices.id, id))
      .returning();

    if (!updatedPeopleService) {
      throw new Error("People service not found");
    }

    return updatedPeopleService;
  }

  async deletePeopleService(id: string): Promise<void> {
    const result = await db.delete(peopleServices).where(eq(peopleServices.id, id));
    if (result.rowCount === 0) {
      throw new Error("People service not found");
    }
  }

  async checkPeopleServiceMappingExists(personId: string, serviceId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(peopleServices)
      .where(and(
        eq(peopleServices.personId, personId),
        eq(peopleServices.serviceId, serviceId)
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

  // Tag operations implementation
  async getAllClientTags(): Promise<ClientTag[]> {
    return await db.select().from(clientTags).orderBy(clientTags.name);
  }

  async createClientTag(tag: InsertClientTag): Promise<ClientTag> {
    const [created] = await db.insert(clientTags).values(tag).returning();
    return created;
  }

  async deleteClientTag(id: string): Promise<void> {
    await db.delete(clientTags).where(eq(clientTags.id, id));
  }

  async getAllPeopleTags(): Promise<PeopleTag[]> {
    return await db.select().from(peopleTags).orderBy(peopleTags.name);
  }

  async createPeopleTag(tag: InsertPeopleTag): Promise<PeopleTag> {
    const [created] = await db.insert(peopleTags).values(tag).returning();
    return created;
  }

  async deletePeopleTag(id: string): Promise<void> {
    await db.delete(peopleTags).where(eq(peopleTags.id, id));
  }

  // Tag assignment operations implementation
  async getClientTags(clientId: string): Promise<(ClientTagAssignment & { tag: ClientTag })[]> {
    return await db
      .select({
        id: clientTagAssignments.id,
        clientId: clientTagAssignments.clientId,
        tagId: clientTagAssignments.tagId,
        assignedAt: clientTagAssignments.assignedAt,
        assignedBy: clientTagAssignments.assignedBy,
        tag: clientTags,
      })
      .from(clientTagAssignments)
      .innerJoin(clientTags, eq(clientTagAssignments.tagId, clientTags.id))
      .where(eq(clientTagAssignments.clientId, clientId))
      .orderBy(clientTags.name);
  }

  async assignClientTag(assignment: InsertClientTagAssignment): Promise<ClientTagAssignment> {
    const [created] = await db.insert(clientTagAssignments).values(assignment).returning();
    return created;
  }

  async unassignClientTag(clientId: string, tagId: string): Promise<void> {
    await db
      .delete(clientTagAssignments)
      .where(
        and(
          eq(clientTagAssignments.clientId, clientId),
          eq(clientTagAssignments.tagId, tagId)
        )
      );
  }

  async getPersonTags(personId: string): Promise<(PeopleTagAssignment & { tag: PeopleTag })[]> {
    return await db
      .select({
        id: peopleTagAssignments.id,
        personId: peopleTagAssignments.personId,
        tagId: peopleTagAssignments.tagId,
        assignedAt: peopleTagAssignments.assignedAt,
        assignedBy: peopleTagAssignments.assignedBy,
        tag: peopleTags,
      })
      .from(peopleTagAssignments)
      .innerJoin(peopleTags, eq(peopleTagAssignments.tagId, peopleTags.id))
      .where(eq(peopleTagAssignments.personId, personId))
      .orderBy(peopleTags.name);
  }

  async assignPersonTag(assignment: InsertPeopleTagAssignment): Promise<PeopleTagAssignment> {
    const [created] = await db.insert(peopleTagAssignments).values(assignment).returning();
    return created;
  }

  async unassignPersonTag(personId: string, tagId: string): Promise<void> {
    await db
      .delete(peopleTagAssignments)
      .where(
        and(
          eq(peopleTagAssignments.personId, personId),
          eq(peopleTagAssignments.tagId, tagId)
        )
      );
  }

  async clearTestData(): Promise<{ [tableName: string]: number }> {
    // Delete all non-user data in proper order to avoid FK constraint violations
    // Users table and sessions are preserved
    const deletionCounts: { [tableName: string]: number } = {};
    
    return await db.transaction(async (tx) => {
      // Phase 1: Delete child records that reference other tables
      const reasonFieldResponsesResult = await tx.delete(reasonFieldResponses).returning({ id: reasonFieldResponses.id });
      deletionCounts.reasonFieldResponses = reasonFieldResponsesResult.length;

      const stageApprovalResponsesResult = await tx.delete(stageApprovalResponses).returning({ id: stageApprovalResponses.id });
      deletionCounts.stageApprovalResponses = stageApprovalResponsesResult.length;

      // Phase 2: Project chronology
      const projectChronologyResult = await tx.delete(projectChronology).returning({ id: projectChronology.id });
      deletionCounts.projectChronology = projectChronologyResult.length;

      // Phase 3: Service assignments and relationships
      const clientServiceRoleAssignmentsResult = await tx.delete(clientServiceRoleAssignments).returning({ id: clientServiceRoleAssignments.id });
      deletionCounts.clientServiceRoleAssignments = clientServiceRoleAssignmentsResult.length;

      const peopleServicesResult = await tx.delete(peopleServices).returning({ id: peopleServices.id });
      deletionCounts.peopleServices = peopleServicesResult.length;

      const clientServicesResult = await tx.delete(clientServices).returning({ id: clientServices.id });
      deletionCounts.clientServices = clientServicesResult.length;

      // Phase 4: Tag assignments
      const clientTagAssignmentsResult = await tx.delete(clientTagAssignments).returning({ id: clientTagAssignments.id });
      deletionCounts.clientTagAssignments = clientTagAssignmentsResult.length;

      const peopleTagAssignmentsResult = await tx.delete(peopleTagAssignments).returning({ id: peopleTagAssignments.id });
      deletionCounts.peopleTagAssignments = peopleTagAssignmentsResult.length;

      // Phase 5: Client-People relationships
      const clientPeopleResult = await tx.delete(clientPeople).returning({ id: clientPeople.id });
      deletionCounts.clientPeople = clientPeopleResult.length;

      // Phase 6: Companies House change requests
      const chChangeRequestsResult = await tx.delete(chChangeRequests).returning({ id: chChangeRequests.id });
      deletionCounts.chChangeRequests = chChangeRequestsResult.length;

      // Phase 7: Projects
      const projectsResult = await tx.delete(projects).returning({ id: projects.id });
      deletionCounts.projects = projectsResult.length;

      // Phase 8: Stage approval fields
      const stageApprovalFieldsResult = await tx.delete(stageApprovalFields).returning({ id: stageApprovalFields.id });
      deletionCounts.stageApprovalFields = stageApprovalFieldsResult.length;

      // Phase 9: Stage-reason mappings
      const stageReasonMapsResult = await tx.delete(stageReasonMaps).returning({ id: stageReasonMaps.id });
      deletionCounts.stageReasonMaps = stageReasonMapsResult.length;

      // Phase 10: Custom fields
      const reasonCustomFieldsResult = await tx.delete(reasonCustomFields).returning({ id: reasonCustomFields.id });
      deletionCounts.reasonCustomFields = reasonCustomFieldsResult.length;

      // Phase 11: Kanban stages
      const kanbanStagesResult = await tx.delete(kanbanStages).returning({ id: kanbanStages.id });
      deletionCounts.kanbanStages = kanbanStagesResult.length;

      // Phase 12: Change reasons
      const changeReasonsResult = await tx.delete(changeReasons).returning({ id: changeReasons.id });
      deletionCounts.changeReasons = changeReasonsResult.length;

      // Phase 13: Stage approvals
      const stageApprovalsResult = await tx.delete(stageApprovals).returning({ id: stageApprovals.id });
      deletionCounts.stageApprovals = stageApprovalsResult.length;

      // Phase 14: Service roles
      const serviceRolesResult = await tx.delete(serviceRoles).returning({ id: serviceRoles.id });
      deletionCounts.serviceRoles = serviceRolesResult.length;

      // Phase 15: Project types
      const projectTypesResult = await tx.delete(projectTypes).returning({ id: projectTypes.id });
      deletionCounts.projectTypes = projectTypesResult.length;

      // Phase 16: Services
      const servicesResult = await tx.delete(services).returning({ id: services.id });
      deletionCounts.services = servicesResult.length;

      // Phase 17: Work roles
      const workRolesResult = await tx.delete(workRoles).returning({ id: workRoles.id });
      deletionCounts.workRoles = workRolesResult.length;

      // Phase 18: Client tags
      const clientTagsResult = await tx.delete(clientTags).returning({ id: clientTags.id });
      deletionCounts.clientTags = clientTagsResult.length;

      // Phase 19: People tags
      const peopleTagsResult = await tx.delete(peopleTags).returning({ id: peopleTags.id });
      deletionCounts.peopleTags = peopleTagsResult.length;

      // Phase 20: People
      const peopleResult = await tx.delete(people).returning({ id: people.id });
      deletionCounts.people = peopleResult.length;

      // Phase 21: Clients
      const clientsResult = await tx.delete(clients).returning({ id: clients.id });
      deletionCounts.clients = clientsResult.length;

      // Phase 22: Magic link tokens (optional - development-related)
      const magicLinkTokensResult = await tx.delete(magicLinkTokens).returning({ id: magicLinkTokens.id });
      deletionCounts.magicLinkTokens = magicLinkTokensResult.length;

      return deletionCounts;
    });
  }

  // Project Scheduling operations
  async getAllClientServicesWithDetails(): Promise<(ClientService & { service: Service & { projectType: ProjectType } })[]> {
    const results = await db
      .select({
        clientService: clientServices,
        service: services,
        projectType: projectTypes,
      })
      .from(clientServices)
      .innerJoin(services, eq(clientServices.serviceId, services.id))
      .leftJoin(projectTypes, eq(projectTypes.serviceId, services.id))
      .where(eq(clientServices.isActive, true))
      .orderBy(clientServices.clientId, services.name);

    return results.map(result => ({
      ...result.clientService,
      service: {
        ...result.service,
        projectType: result.projectType
      }
    })); // Return all services, including those with null project types for error detection
  }

  async getAllPeopleServicesWithDetails(): Promise<(PeopleService & { service: Service & { projectType: ProjectType } })[]> {
    const results = await db
      .select({
        peopleService: peopleServices,
        service: services,
        projectType: projectTypes,
      })
      .from(peopleServices)
      .innerJoin(services, eq(peopleServices.serviceId, services.id))
      .leftJoin(projectTypes, eq(projectTypes.serviceId, services.id))
      .where(eq(peopleServices.isActive, true))
      .orderBy(peopleServices.personId, services.name);

    return results.map(result => ({
      ...result.peopleService,
      service: {
        ...result.service,
        projectType: result.projectType
      }
    })); // Return all services, including those with null project types for error detection
  }

  async createProjectSchedulingHistory(data: InsertProjectSchedulingHistory): Promise<ProjectSchedulingHistory> {
    const [history] = await db
      .insert(projectSchedulingHistory)
      .values(data)
      .returning();
    return history;
  }

  async getProjectSchedulingHistoryByServiceId(
    serviceId: string, 
    serviceType: 'client' | 'people'
  ): Promise<ProjectSchedulingHistory[]> {
    const whereCondition = serviceType === 'client' 
      ? eq(projectSchedulingHistory.clientServiceId, serviceId)
      : eq(projectSchedulingHistory.peopleServiceId, serviceId);

    return await db
      .select()
      .from(projectSchedulingHistory)
      .where(whereCondition)
      .orderBy(desc(projectSchedulingHistory.createdAt))
      .limit(50); // Limit to last 50 entries for performance
  }

  async createSchedulingRunLog(data: InsertSchedulingRunLogs): Promise<SchedulingRunLogs> {
    const [log] = await db
      .insert(schedulingRunLogs)
      .values(data)
      .returning();
    return log;
  }

  async getSchedulingRunLogs(limit: number = 20): Promise<SchedulingRunLogs[]> {
    return await db
      .select()
      .from(schedulingRunLogs)
      .orderBy(desc(schedulingRunLogs.runDate))
      .limit(limit);
  }

  async getLatestSchedulingRunLog(): Promise<SchedulingRunLogs | undefined> {
    const [log] = await db
      .select()
      .from(schedulingRunLogs)
      .orderBy(desc(schedulingRunLogs.runDate))
      .limit(1);
    return log;
  }

  // Communications operations
  async getAllCommunications(): Promise<(Communication & { client: Client; person?: Person; user: User })[]> {
    const results = await db
      .select({
        communication: communications,
        client: clients,
        person: people,
        user: users,
      })
      .from(communications)
      .innerJoin(clients, eq(communications.clientId, clients.id))
      .leftJoin(people, eq(communications.personId, people.id))
      .innerJoin(users, eq(communications.userId, users.id))
      .orderBy(desc(communications.loggedAt));

    return results.map(result => ({
      ...result.communication,
      client: result.client,
      person: result.person || undefined,
      user: result.user,
    }));
  }

  async getCommunicationsByClientId(clientId: string): Promise<(Communication & { person?: Person; user: User })[]> {
    const results = await db
      .select({
        communication: communications,
        person: people,
        user: users,
      })
      .from(communications)
      .leftJoin(people, eq(communications.personId, people.id))
      .innerJoin(users, eq(communications.userId, users.id))
      .where(eq(communications.clientId, clientId))
      .orderBy(desc(communications.loggedAt));

    return results.map(result => ({
      ...result.communication,
      person: result.person || undefined,
      user: result.user,
    }));
  }

  async getCommunicationsByPersonId(personId: string): Promise<(Communication & { client: Client; user: User })[]> {
    const results = await db
      .select({
        communication: communications,
        client: clients,
        user: users,
      })
      .from(communications)
      .innerJoin(clients, eq(communications.clientId, clients.id))
      .innerJoin(users, eq(communications.userId, users.id))
      .where(eq(communications.personId, personId))
      .orderBy(desc(communications.loggedAt));

    return results.map(result => ({
      ...result.communication,
      client: result.client,
      user: result.user,
    }));
  }

  async getCommunicationById(id: string): Promise<(Communication & { client: Client; person?: Person; user: User }) | undefined> {
    const [result] = await db
      .select({
        communication: communications,
        client: clients,
        person: people,
        user: users,
      })
      .from(communications)
      .innerJoin(clients, eq(communications.clientId, clients.id))
      .leftJoin(people, eq(communications.personId, people.id))
      .innerJoin(users, eq(communications.userId, users.id))
      .where(eq(communications.id, id))
      .limit(1);

    if (!result) return undefined;

    return {
      ...result.communication,
      client: result.client,
      person: result.person || undefined,
      user: result.user,
    };
  }

  async createCommunication(communication: InsertCommunication): Promise<Communication> {
    const [newCommunication] = await db
      .insert(communications)
      .values({
        ...communication,
        loggedAt: new Date(),
      })
      .returning();
    return newCommunication;
  }

  async updateCommunication(id: string, communication: Partial<InsertCommunication>): Promise<Communication> {
    const [updated] = await db
      .update(communications)
      .set({
        ...communication,
        updatedAt: new Date(),
      })
      .where(eq(communications.id, id))
      .returning();
    return updated;
  }

  async deleteCommunication(id: string): Promise<void> {
    await db.delete(communications).where(eq(communications.id, id));
  }

  // User integrations operations
  async getUserIntegrations(userId: string): Promise<UserIntegration[]> {
    return await db
      .select({
        id: userIntegrations.id,
        userId: userIntegrations.userId,
        integrationType: userIntegrations.integrationType,
        tokenExpiry: userIntegrations.tokenExpiry,
        isActive: userIntegrations.isActive,
        metadata: userIntegrations.metadata,
        createdAt: userIntegrations.createdAt,
        updatedAt: userIntegrations.updatedAt,
        // Explicitly exclude accessToken and refreshToken
      })
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, userId))
      .orderBy(userIntegrations.createdAt);
  }

  async getUserIntegrationByType(userId: string, integrationType: 'office365' | 'voodoo_sms'): Promise<UserIntegration | undefined> {
    const [integration] = await db
      .select()
      .from(userIntegrations)
      .where(and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.integrationType, integrationType)
      ))
      .limit(1);
    return integration;
  }

  async createUserIntegration(integration: InsertUserIntegration): Promise<UserIntegration> {
    const [newIntegration] = await db
      .insert(userIntegrations)
      .values(integration)
      .returning();
    return newIntegration;
  }

  async updateUserIntegration(id: string, integration: Partial<InsertUserIntegration>): Promise<UserIntegration> {
    const [updated] = await db
      .update(userIntegrations)
      .set({
        ...integration,
        updatedAt: new Date(),
      })
      .where(eq(userIntegrations.id, id))
      .returning();
    return updated;
  }

  async deleteUserIntegration(id: string): Promise<void> {
    await db.delete(userIntegrations).where(eq(userIntegrations.id, id));
  }

  // OAuth account operations
  async getUserOauthAccount(userId: string, provider: string): Promise<UserOauthAccount | undefined> {
    const [account] = await db
      .select()
      .from(userOauthAccounts)
      .where(and(
        eq(userOauthAccounts.userId, userId),
        eq(userOauthAccounts.provider, provider)
      ))
      .limit(1);
    return account;
  }

  async createUserOauthAccount(account: InsertUserOauthAccount): Promise<UserOauthAccount> {
    const [newAccount] = await db
      .insert(userOauthAccounts)
      .values(account)
      .returning();
    return newAccount;
  }

  async updateUserOauthAccount(id: string, account: Partial<InsertUserOauthAccount>): Promise<UserOauthAccount> {
    const [updated] = await db
      .update(userOauthAccounts)
      .set({
        ...account,
        updatedAt: new Date(),
      })
      .where(eq(userOauthAccounts.id, id))
      .returning();
    return updated;
  }

  async deleteUserOauthAccount(userId: string, provider: string): Promise<void> {
    await db.delete(userOauthAccounts).where(and(
      eq(userOauthAccounts.userId, userId),
      eq(userOauthAccounts.provider, provider)
    ));
  }

  // Push subscription operations
  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const [newSubscription] = await db
      .insert(pushSubscriptions)
      .values(subscription)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: subscription.userId,
          keys: subscription.keys,
          userAgent: subscription.userAgent,
          updatedAt: new Date(),
        }
      })
      .returning();
    return newSubscription;
  }

  async getPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async deletePushSubscriptionsByUserId(userId: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  // Document folder operations
  async createDocumentFolder(folder: InsertDocumentFolder): Promise<DocumentFolder> {
    const [newFolder] = await db
      .insert(documentFolders)
      .values(folder)
      .returning();
    return newFolder;
  }

  async getDocumentFolderById(id: string): Promise<DocumentFolder | undefined> {
    const result = await db
      .select()
      .from(documentFolders)
      .where(eq(documentFolders.id, id))
      .limit(1);
    return result[0];
  }

  async getDocumentFoldersByClientId(clientId: string): Promise<any[]> {
    const results = await db
      .select({
        id: documentFolders.id,
        clientId: documentFolders.clientId,
        name: documentFolders.name,
        createdBy: documentFolders.createdBy,
        source: documentFolders.source,
        createdAt: documentFolders.createdAt,
        updatedAt: documentFolders.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        documentCount: sql<number>`cast(count(${documents.id}) as int)`,
      })
      .from(documentFolders)
      .leftJoin(users, eq(documentFolders.createdBy, users.id))
      .leftJoin(documents, eq(documents.folderId, documentFolders.id))
      .where(eq(documentFolders.clientId, clientId))
      .groupBy(documentFolders.id, users.id)
      .orderBy(desc(documentFolders.createdAt));
    return results;
  }

  async deleteDocumentFolder(id: string): Promise<void> {
    await db.delete(documentFolders).where(eq(documentFolders.id, id));
  }

  // Document operations
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return newDocument;
  }

  async getDocumentById(id: string): Promise<Document | undefined> {
    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return result[0];
  }

  async getDocumentsByClientId(clientId: string): Promise<any[]> {
    const results = await db
      .select({
        id: documents.id,
        clientId: documents.clientId,
        folderId: documents.folderId,
        uploadedBy: documents.uploadedBy,
        uploadName: documents.uploadName,
        source: documents.source,
        fileName: documents.fileName,
        fileSize: documents.fileSize,
        fileType: documents.fileType,
        objectPath: documents.objectPath,
        uploadedAt: documents.uploadedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(eq(documents.clientId, clientId))
      .orderBy(desc(documents.uploadedAt));
    return results;
  }

  async getDocumentsByFolderId(folderId: string): Promise<any[]> {
    const results = await db
      .select({
        id: documents.id,
        clientId: documents.clientId,
        folderId: documents.folderId,
        uploadedBy: documents.uploadedBy,
        fileName: documents.fileName,
        fileSize: documents.fileSize,
        fileType: documents.fileType,
        objectPath: documents.objectPath,
        uploadedAt: documents.uploadedAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(documents)
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .where(eq(documents.folderId, folderId))
      .orderBy(desc(documents.uploadedAt));
    return results;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }
}

export const storage = new DatabaseStorage();
