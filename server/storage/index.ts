// ============================================================================
// STAGE 1: Users Domain Extracted - Delegation Pattern
// ============================================================================
// This facade maintains compatibility while delegating user-related methods
// to the new modular UserStorage and UserActivityStorage classes.
// It will continue evolving through stages 2-14 as more domains are extracted.

// Import the original storage module (temporarily)
import { 
  IStorage as OriginalIStorage,
  DatabaseStorage as OldDatabaseStorage,
  initializeDefaultNotificationTemplates as originalInitTemplates 
} from '../storage.js';

// Import new domain storage classes
import { UserStorage } from './users/userStorage.js';
import { UserActivityStorage } from './users/userActivityStorage.js';
import { ClientStorage, CompaniesHouseStorage, SearchStorage } from './clients/index.js';
import { PeopleStorage, ClientPeopleStorage } from './people/index.js';
import { 
  ProjectStorage, 
  ProjectChronologyStorage, 
  ProjectTypesStorage, 
  ProjectStagesStorage, 
  ProjectApprovalsStorage,
  getProjectTypeByName,
  validateStageReasonMapping,
  validateRequiredFields,
  getDefaultStage,
  validateProjectStatus,
} from './projects/index.js';
import { 
  ServiceStorage, 
  WorkRoleStorage, 
  ServiceAssignmentStorage 
} from './services/index.js';

// Export shared types (new modular architecture)
export * from './base/types.js';

// Re-export the IStorage interface (critical for backward compatibility)
export type IStorage = OriginalIStorage;

// Re-export initialization function
export const initializeDefaultNotificationTemplates = originalInitTemplates;

// Create composite DatabaseStorage class that delegates methods
export class DatabaseStorage implements IStorage {
  // Instance of old storage for unmigrated methods
  private oldStorage: OldDatabaseStorage;
  
  // New domain storage instances
  private userStorage: UserStorage;
  private userActivityStorage: UserActivityStorage;
  private clientStorage: ClientStorage;
  private companiesHouseStorage: CompaniesHouseStorage;
  private searchStorage: SearchStorage;
  private peopleStorage: PeopleStorage;
  private clientPeopleStorage: ClientPeopleStorage;
  private projectStorage: ProjectStorage;
  private projectChronologyStorage: ProjectChronologyStorage;
  private projectTypesStorage: ProjectTypesStorage;
  private projectStagesStorage: ProjectStagesStorage;
  private projectApprovalsStorage: ProjectApprovalsStorage;
  private serviceStorage: ServiceStorage;
  private workRoleStorage: WorkRoleStorage;
  private serviceAssignmentStorage: ServiceAssignmentStorage;

  constructor() {
    // Initialize all storage instances
    this.oldStorage = new OldDatabaseStorage();
    this.userStorage = new UserStorage();
    this.userActivityStorage = new UserActivityStorage(this.oldStorage);
    
    // Initialize client domain storages
    this.clientStorage = new ClientStorage();
    this.companiesHouseStorage = new CompaniesHouseStorage();
    this.searchStorage = new SearchStorage();
    
    // Initialize people domain storages
    this.peopleStorage = new PeopleStorage();
    this.clientPeopleStorage = new ClientPeopleStorage();
    
    // Initialize projects domain storages
    this.projectStorage = new ProjectStorage();
    this.projectChronologyStorage = new ProjectChronologyStorage();
    this.projectTypesStorage = new ProjectTypesStorage();
    this.projectStagesStorage = new ProjectStagesStorage();
    this.projectApprovalsStorage = new ProjectApprovalsStorage();
    
    // Initialize services domain storages
    this.serviceStorage = new ServiceStorage();
    this.workRoleStorage = new WorkRoleStorage();
    this.serviceAssignmentStorage = new ServiceAssignmentStorage();
    
    // Register cross-domain helpers
    this.registerClientHelpers();
    this.registerPeopleHelpers();
    this.registerProjectHelpers();
    this.registerServiceHelpers();
  }

  /**
   * Register helpers for cross-domain dependencies in people storage
   */
  private registerPeopleHelpers() {
    // No cross-domain helpers needed for Stage 3
    // People domain operations are self-contained
  }

  /**
   * Register helpers for cross-domain dependencies in service storage
   */
  private registerServiceHelpers() {
    // ServiceStorage needs helpers for validation
    this.serviceStorage.registerHelpers({
      getServiceById: (serviceId: string) => this.serviceStorage.getServiceById(serviceId),
      getWorkRoleById: (roleId: string) => this.workRoleStorage.getWorkRoleById(roleId),
    });
    
    // ServiceAssignmentStorage needs helpers for role validation and project assignments
    this.serviceAssignmentStorage.registerHelpers({
      getServiceById: (serviceId: string) => this.serviceStorage.getServiceById(serviceId),
      getWorkRoleById: (roleId: string) => this.workRoleStorage.getWorkRoleById(roleId),
      getWorkRolesByServiceId: (serviceId: string) => this.workRoleStorage.getWorkRolesByServiceId(serviceId),
      getServiceByProjectTypeId: (projectTypeId: string) => this.serviceStorage.getServiceByProjectTypeId(projectTypeId),
      getUser: (userId: string) => this.userStorage.getUser(userId),
      getFallbackUser: () => this.userStorage.getFallbackUser(),
      getDefaultStage: getDefaultStage(this.projectStagesStorage),
    });
  }

  /**
   * Register helpers for cross-domain dependencies in project storage
   */
  private registerProjectHelpers() {
    // ProjectStorage needs helpers from configuration, services, notifications, and messaging domains
    this.projectStorage.registerHelpers({
      // Stage 5 helpers - now from modular ProjectStagesStorage
      getDefaultStage: getDefaultStage(this.projectStagesStorage),
      validateProjectStatus: validateProjectStatus(this.projectStagesStorage),
      validateStageReasonMapping: validateStageReasonMapping(this.projectStagesStorage),
      validateRequiredFields: validateRequiredFields(this.projectStagesStorage),
      getProjectTypeByName: getProjectTypeByName(this.projectTypesStorage),
      
      // Services domain - now delegated to ServiceStorage and ServiceAssignmentStorage (Stage 6)
      getServiceByProjectTypeId: (projectTypeId: string) => this.serviceStorage.getServiceByProjectTypeId(projectTypeId),
      getClientServiceByClientAndProjectType: (clientId: string, projectTypeId: string) => 
        this.serviceAssignmentStorage.getClientServiceByClientAndProjectType(clientId, projectTypeId),
      resolveProjectAssignments: (clientId: string, projectTypeId: string) => 
        this.serviceAssignmentStorage.resolveProjectAssignments(clientId, projectTypeId),
      resolveServiceOwner: (clientId: string, projectTypeId: string) => 
        this.serviceAssignmentStorage.resolveServiceOwner(clientId, projectTypeId),
      resolveStageRoleAssignee: (project: any) => this.oldStorage.resolveStageRoleAssignee(project),
      getWorkRoleById: (workRoleId: string) => this.workRoleStorage.getWorkRoleById(workRoleId),
      resolveRoleAssigneeForClient: (clientId: string, projectTypeId: string, roleName: string) => 
        this.serviceAssignmentStorage.resolveRoleAssigneeForClient(clientId, projectTypeId, roleName),
      
      // Notifications and messaging domains (still in oldStorage - will be extracted in future stage)
      sendStageChangeNotifications: (projectId: string, newStatus: string, oldStatus: string) => 
        this.oldStorage.sendStageChangeNotifications(projectId, newStatus, oldStatus),
      createProjectMessageThread: (data: any) => this.oldStorage.createProjectMessageThread(data),
      createProjectMessageParticipant: (data: any) => this.oldStorage.createProjectMessageParticipant(data),
      createProjectMessage: (data: any) => this.oldStorage.createProjectMessage(data),
      cancelScheduledNotificationsForProject: (projectId: string, reason: string) => 
        this.oldStorage.cancelScheduledNotificationsForProject(projectId, reason),
      
      // Client domain - delegate to ClientStorage
      getClientByName: (name: string) => this.clientStorage.getClientByName(name),
      // User domain - delegate to UserStorage
      getUserByEmail: (email: string) => this.userStorage.getUserByEmail(email),
    });
  }

  /**
   * Register helpers for cross-domain dependencies in client storage
   */
  private registerClientHelpers() {
    // ClientStorage needs helpers from projects and services domains
    this.clientStorage.registerHelpers({
      // Check if client has projects (for deletion)
      checkClientProjects: async (clientId: string) => {
        const projects = await this.projectStorage.getProjectsByClient(clientId);
        return projects && projects.length > 0;
      },
      // Delete client services and role assignments (for deletion cascade) - now delegated to ServiceAssignmentStorage
      deleteClientServices: async (clientId: string) => {
        const services = await this.serviceAssignmentStorage.getClientServicesByClientId(clientId);
        for (const service of services) {
          // Delete role assignments first
          const assignments = await this.serviceAssignmentStorage.getClientServiceRoleAssignments(service.id);
          for (const assignment of assignments) {
            await this.serviceAssignmentStorage.deleteClientServiceRoleAssignment(assignment.id);
          }
          // Delete the service
          await this.serviceAssignmentStorage.deleteClientService(service.id);
        }
      },
      // Get person by ID (for conversion operations) - now delegated to PeopleStorage
      getPersonById: (personId: string) => this.peopleStorage.getPersonById(personId),
    });
    
    // CompaniesHouseStorage needs helpers for client CRUD
    this.companiesHouseStorage.registerHelpers({
      createClient: (clientData: any) => this.clientStorage.createClient(clientData),
      updateClient: (id: string, clientData: any) => this.clientStorage.updateClient(id, clientData),
    });
  }

  // ============================================================================
  // USER DOMAIN - Delegated to UserStorage
  // ============================================================================
  
  // User CRUD methods
  async getUser(id: string) {
    return this.userStorage.getUser(id);
  }

  async upsertUser(userData: any) {
    return this.userStorage.upsertUser(userData);
  }

  async getUserByEmail(email: string) {
    return this.userStorage.getUserByEmail(email);
  }

  async createUser(userData: any) {
    return this.userStorage.createUser(userData);
  }

  async updateUser(id: string, userData: any) {
    return this.userStorage.updateUser(id, userData);
  }

  async deleteUser(id: string) {
    return this.userStorage.deleteUser(id);
  }

  async getAllUsers() {
    return this.userStorage.getAllUsers();
  }

  async getUsersByRole(role: string) {
    return this.userStorage.getUsersByRole(role);
  }

  // Admin operations
  async createAdminIfNone(userData: any) {
    return this.userStorage.createAdminIfNone(userData);
  }

  // Impersonation operations
  async startImpersonation(adminUserId: string, targetUserId: string) {
    return this.userStorage.startImpersonation(adminUserId, targetUserId);
  }

  async stopImpersonation(adminUserId: string) {
    return this.userStorage.stopImpersonation(adminUserId);
  }

  async getImpersonationState(adminUserId: string) {
    return this.userStorage.getImpersonationState(adminUserId);
  }

  async getEffectiveUser(adminUserId: string) {
    return this.userStorage.getEffectiveUser(adminUserId);
  }

  // Session operations
  async createUserSession(session: any) {
    return this.userStorage.createUserSession(session);
  }

  async updateUserSessionActivity(userId: string) {
    return this.userStorage.updateUserSessionActivity(userId);
  }

  async getUserSessions(userId?: string, options?: any) {
    return this.userStorage.getUserSessions(userId, options);
  }

  async markSessionAsLoggedOut(sessionId: string) {
    return this.userStorage.markSessionAsLoggedOut(sessionId);
  }

  async cleanupOldSessions(daysToKeep: number) {
    return this.userStorage.cleanupOldSessions(daysToKeep);
  }

  async markInactiveSessions() {
    return this.userStorage.markInactiveSessions();
  }

  // Login attempt operations
  async createLoginAttempt(attempt: any) {
    return this.userStorage.createLoginAttempt(attempt);
  }

  async getLoginAttempts(options?: any) {
    return this.userStorage.getLoginAttempts(options);
  }

  async cleanupOldLoginAttempts(daysToKeep: number) {
    return this.userStorage.cleanupOldLoginAttempts(daysToKeep);
  }

  // Magic link operations
  async createMagicLinkToken(tokenData: any) {
    return this.userStorage.createMagicLinkToken(tokenData);
  }

  async getMagicLinkTokenByToken(token: string) {
    return this.userStorage.getMagicLinkTokenByToken(token);
  }

  async getMagicLinkTokenByCodeAndEmail(code: string, email: string) {
    return this.userStorage.getMagicLinkTokenByCodeAndEmail(code, email);
  }

  async markMagicLinkTokenAsUsed(id: string) {
    return this.userStorage.markMagicLinkTokenAsUsed(id);
  }

  async cleanupExpiredMagicLinkTokens() {
    return this.userStorage.cleanupExpiredMagicLinkTokens();
  }

  async getValidMagicLinkTokensForUser(userId: string) {
    return this.userStorage.getValidMagicLinkTokensForUser(userId);
  }

  // ============================================================================
  // USER ACTIVITY DOMAIN - Delegated to UserActivityStorage
  // ============================================================================
  
  async trackUserActivity(userId: string, entityType: string, entityId: string) {
    return this.userActivityStorage.trackUserActivity(userId, entityType, entityId);
  }

  async getRecentlyViewedByUser(userId: string, limit?: number) {
    return this.userActivityStorage.getRecentlyViewedByUser(userId, limit);
  }

  async getUserActivityTracking(options?: any) {
    return this.userActivityStorage.getUserActivityTracking(options);
  }

  // ============================================================================
  // ALL OTHER METHODS - Delegated to OldDatabaseStorage
  // ============================================================================
  // This section delegates all remaining methods to the old storage implementation
  // These will be migrated in stages 2-14

  // User notification preferences (not migrated yet - stays in old storage)
  async getUserNotificationPreferences(userId: string) {
    return this.oldStorage.getUserNotificationPreferences(userId);
  }

  async createUserNotificationPreferences(preferences: any) {
    return this.oldStorage.createUserNotificationPreferences(preferences);
  }

  async updateUserNotificationPreferences(userId: string, preferences: any) {
    return this.oldStorage.updateUserNotificationPreferences(userId, preferences);
  }

  async getOrCreateDefaultNotificationPreferences(userId: string) {
    return this.oldStorage.getOrCreateDefaultNotificationPreferences(userId);
  }

  async getUsersWithSchedulingNotifications() {
    return this.oldStorage.getUsersWithSchedulingNotifications();
  }

  // Project views operations
  async createProjectView(view: any) {
    return this.oldStorage.createProjectView(view);
  }

  async getProjectViewsByUserId(userId: string) {
    return this.oldStorage.getProjectViewsByUserId(userId);
  }

  async deleteProjectView(id: string) {
    return this.oldStorage.deleteProjectView(id);
  }

  // Company views operations
  async createCompanyView(view: any) {
    return this.oldStorage.createCompanyView(view);
  }

  async getCompanyViewsByUserId(userId: string) {
    return this.oldStorage.getCompanyViewsByUserId(userId);
  }

  async deleteCompanyView(id: string) {
    return this.oldStorage.deleteCompanyView(id);
  }

  // User column preferences operations
  async getUserColumnPreferences(userId: string, viewType?: string) {
    return this.oldStorage.getUserColumnPreferences(userId, viewType);
  }

  async upsertUserColumnPreferences(preferences: any) {
    return this.oldStorage.upsertUserColumnPreferences(preferences);
  }

  async updateUserColumnPreferences(userId: string, viewType: string, preferences: any) {
    return this.oldStorage.updateUserColumnPreferences(userId, viewType, preferences);
  }

  // Dashboard operations
  async createDashboard(dashboard: any) {
    return this.oldStorage.createDashboard(dashboard);
  }

  async getDashboardsByUserId(userId: string) {
    return this.oldStorage.getDashboardsByUserId(userId);
  }

  async getSharedDashboards() {
    return this.oldStorage.getSharedDashboards();
  }

  async getDashboardById(id: string) {
    return this.oldStorage.getDashboardById(id);
  }

  async updateDashboard(id: string, dashboard: any) {
    return this.oldStorage.updateDashboard(id, dashboard);
  }

  async deleteDashboard(id: string) {
    return this.oldStorage.deleteDashboard(id);
  }

  async getHomescreenDashboard(userId: string) {
    return this.oldStorage.getHomescreenDashboard(userId);
  }

  async clearHomescreenDashboards(userId: string) {
    return this.oldStorage.clearHomescreenDashboards(userId);
  }

  // User project preferences operations
  async getUserProjectPreferences(userId: string, projectId: string) {
    return this.oldStorage.getUserProjectPreferences(userId, projectId);
  }

  async upsertUserProjectPreferences(preferences: any) {
    return this.oldStorage.upsertUserProjectPreferences(preferences);
  }

  async updateUserProjectPreferences(userId: string, projectId: string, preferences: any) {
    return this.oldStorage.updateUserProjectPreferences(userId, projectId, preferences);
  }

  // ============================================================================
  // CLIENT DOMAIN - Delegated to ClientStorage
  // ============================================================================
  
  // Client CRUD operations
  async createClient(clientData: any) {
    return this.clientStorage.createClient(clientData);
  }

  async getClientById(id: string) {
    return this.clientStorage.getClientById(id);
  }

  async getClientByName(name: string) {
    return this.clientStorage.getClientByName(name);
  }

  async getAllClients(search?: string) {
    return this.clientStorage.getAllClients(search);
  }

  async updateClient(id: string, clientData: any) {
    return this.clientStorage.updateClient(id, clientData);
  }

  async deleteClient(id: string) {
    return this.clientStorage.deleteClient(id);
  }

  // Client-Person relationships
  async unlinkPersonFromClient(clientId: string, personId: string) {
    return this.clientStorage.unlinkPersonFromClient(clientId, personId);
  }

  async convertIndividualToCompanyClient(personId: string, companyData: any, oldIndividualClientId?: string) {
    return this.clientStorage.convertIndividualToCompanyClient(personId, companyData, oldIndividualClientId);
  }

  async linkPersonToClient(clientId: string, personId: string, officerRole?: string, isPrimaryContact?: boolean) {
    return this.clientStorage.linkPersonToClient(clientId, personId, officerRole, isPrimaryContact);
  }

  async getClientWithPeople(clientId: string) {
    return this.clientStorage.getClientWithPeople(clientId);
  }

  // Client Chronology
  async createClientChronologyEntry(entry: any) {
    return this.clientStorage.createClientChronologyEntry(entry);
  }

  async getClientChronology(clientId: string) {
    return this.clientStorage.getClientChronology(clientId);
  }

  // Client Tags
  async getAllClientTags() {
    return this.clientStorage.getAllClientTags();
  }

  async createClientTag(tag: any) {
    return this.clientStorage.createClientTag(tag);
  }

  async deleteClientTag(id: string) {
    return this.clientStorage.deleteClientTag(id);
  }

  async getAllClientTagAssignments() {
    return this.clientStorage.getAllClientTagAssignments();
  }

  async getClientTags(clientId: string) {
    return this.clientStorage.getClientTags(clientId);
  }

  async assignClientTag(assignment: any) {
    return this.clientStorage.assignClientTag(assignment);
  }

  async unassignClientTag(clientId: string, tagId: string) {
    return this.clientStorage.unassignClientTag(clientId, tagId);
  }

  // Client Email Aliases
  async getAllClientEmailAliases() {
    return this.clientStorage.getAllClientEmailAliases();
  }

  async createClientEmailAlias(alias: any) {
    return this.clientStorage.createClientEmailAlias(alias);
  }

  async getClientEmailAliasesByClientId(clientId: string) {
    return this.clientStorage.getClientEmailAliasesByClientId(clientId);
  }

  async getClientByEmailAlias(email: string) {
    return this.clientStorage.getClientByEmailAlias(email);
  }

  async deleteClientEmailAlias(id: string) {
    return this.clientStorage.deleteClientEmailAlias(id);
  }

  // Client Domain Allowlisting
  async createClientDomainAllowlist(domain: any) {
    return this.clientStorage.createClientDomainAllowlist(domain);
  }

  async getClientDomainAllowlist() {
    return this.clientStorage.getClientDomainAllowlist();
  }

  async getClientByDomain(domain: string) {
    return this.clientStorage.getClientByDomain(domain);
  }

  async deleteClientDomainAllowlist(id: string) {
    return this.clientStorage.deleteClientDomainAllowlist(id);
  }

  // ============================================================================
  // COMPANIES HOUSE DOMAIN - Delegated to CompaniesHouseStorage
  // ============================================================================
  
  async getClientByCompanyNumber(companyNumber: string) {
    return this.companiesHouseStorage.getClientByCompanyNumber(companyNumber);
  }

  async upsertClientFromCH(clientData: any) {
    return this.companiesHouseStorage.upsertClientFromCH(clientData);
  }

  // ============================================================================
  // SEARCH DOMAIN - Delegated to SearchStorage
  // ============================================================================
  
  async superSearch(query: string, limit?: number) {
    return this.searchStorage.superSearch(query, limit);
  }

  // ============================================================================
  // PEOPLE DOMAIN - Delegated to PeopleStorage & ClientPeopleStorage
  // ============================================================================
  
  // People CRUD operations
  async createPerson(personData: any) {
    console.log('[FACADE] createPerson called - delegating to peopleStorage');
    const result = await this.peopleStorage.createPerson(personData);
    console.log('[FACADE] createPerson result ID:', result.id);
    return result;
  }

  async getPersonById(id: string) {
    return this.peopleStorage.getPersonById(id);
  }

  async getPersonByPersonNumber(personNumber: string) {
    return this.peopleStorage.getPersonByPersonNumber(personNumber);
  }

  async getAllPeople() {
    return this.peopleStorage.getAllPeople();
  }

  async getAllPeopleWithPortalStatus() {
    return this.peopleStorage.getAllPeopleWithPortalStatus();
  }

  async getPersonWithDetails(id: string) {
    return this.peopleStorage.getPersonWithDetails(id);
  }

  async updatePerson(id: string, personData: any) {
    return this.peopleStorage.updatePerson(id, personData);
  }

  async deletePerson(id: string) {
    return this.peopleStorage.deletePerson(id);
  }

  async upsertPersonFromCH(personData: any) {
    return this.peopleStorage.upsertPersonFromCH(personData);
  }

  async findPeopleByNameAndBirthDate(firstName: string, lastName: string, year: number, month: number) {
    return this.peopleStorage.findPeopleByNameAndBirthDate(firstName, lastName, year, month);
  }

  // Client-People relationship operations
  async createClientPerson(relationship: any) {
    return this.clientPeopleStorage.createClientPerson(relationship);
  }

  async getClientPeopleByClientId(clientId: string) {
    return this.clientPeopleStorage.getClientPeopleByClientId(clientId);
  }

  async getClientPeopleByPersonId(personId: string) {
    return this.clientPeopleStorage.getClientPeopleByPersonId(personId);
  }

  async updateClientPerson(id: string, relationship: any) {
    return this.clientPeopleStorage.updateClientPerson(id, relationship);
  }

  async deleteClientPerson(id: string) {
    return this.clientPeopleStorage.deleteClientPerson(id);
  }

  // ============================================================================
  // PROJECTS DOMAIN - Partially Delegated to ProjectStorage & ProjectChronologyStorage
  // ============================================================================
  // Stage 4 Part 1: 9 methods extracted (5 ProjectStorage + 4 ProjectChronologyStorage)
  // Remaining complex methods (getAllProjects, getProjectsByUser, etc.) stay in oldStorage
  // Note: Client chronology (2 methods) was already in Stage 2 Clients domain
  
  // ProjectStorage methods
  async createProject(projectData: any) {
    return this.projectStorage.createProject(projectData);
  }

  async getProject(id: string) {
    return this.projectStorage.getProject(id);
  }

  async updateProject(id: string, updateData: any) {
    return this.projectStorage.updateProject(id, updateData);
  }

  async getActiveProjectsByClientAndType(clientId: string, projectTypeId: string) {
    return this.projectStorage.getActiveProjectsByClientAndType(clientId, projectTypeId);
  }

  async getUniqueDueDatesForService(serviceId: string) {
    return this.projectStorage.getUniqueDueDatesForService(serviceId);
  }

  // Stage 4 Part 2: Complex project methods (8 methods)
  async getAllProjects(filters?: any) {
    return this.projectStorage.getAllProjects(filters);
  }

  async getProjectsByUser(userId: string, roleFilter?: string, statusFilter?: string) {
    return this.projectStorage.getProjectsByUser(userId, roleFilter, statusFilter);
  }

  async getProjectsByClient(clientId: string) {
    return this.projectStorage.getProjectsByClient(clientId);
  }

  async getProjectsByClientServiceId(clientServiceId: string) {
    return this.projectStorage.getProjectsByClientServiceId(clientServiceId);
  }

  async updateProjectStatus(update: any, userId: string) {
    return this.projectStorage.updateProjectStatus(update, userId);
  }

  async getProjectAnalytics(filters: any, groupBy: string, metric?: string) {
    return this.projectStorage.getProjectAnalytics(filters, groupBy, metric);
  }

  async sendBulkProjectAssignmentNotifications(createdProjects: any[]) {
    return this.projectStorage.sendBulkProjectAssignmentNotifications(createdProjects);
  }

  async createProjectsFromCSV(projectsData: any[]) {
    return this.projectStorage.createProjectsFromCSV(projectsData);
  }

  // ProjectChronologyStorage methods
  async createChronologyEntry(entry: any) {
    return this.projectChronologyStorage.createChronologyEntry(entry);
  }

  async getProjectChronology(projectId: string) {
    return this.projectChronologyStorage.getProjectChronology(projectId);
  }

  async getMostRecentStageChange(projectId: string) {
    return this.projectChronologyStorage.getMostRecentStageChange(projectId);
  }

  async getProjectProgressMetrics(projectId: string) {
    return this.projectChronologyStorage.getProjectProgressMetrics(projectId);
  }

  // NOTE: createClientChronologyEntry and getClientChronology are part of Stage 2 (Clients domain)
  // and are already delegated to clientStorage above (lines 431-436)

  // ============================================
  // STAGE 5: PROJECT CONFIGURATION (51 methods)
  // ============================================

  // ProjectTypesStorage methods (9 methods)
  async getAllProjectTypes() {
    return this.projectTypesStorage.getAllProjectTypes();
  }

  async getProjectTypeById(id: string) {
    return this.projectTypesStorage.getProjectTypeById(id);
  }

  async createProjectType(projectType: any) {
    return this.projectTypesStorage.createProjectType(projectType);
  }

  async updateProjectType(id: string, projectType: any) {
    return this.projectTypesStorage.updateProjectType(id, projectType);
  }

  async deleteProjectType(id: string) {
    return this.projectTypesStorage.deleteProjectType(id);
  }

  async getProjectTypeByName(name: string) {
    return this.projectTypesStorage.getProjectTypeByName(name);
  }

  async countActiveProjectsUsingProjectType(projectTypeId: string) {
    return this.projectTypesStorage.countActiveProjectsUsingProjectType(projectTypeId);
  }

  async getProjectTypeDependencySummary(projectTypeId: string) {
    return this.projectTypesStorage.getProjectTypeDependencySummary(projectTypeId);
  }

  async forceDeleteProjectType(projectTypeId: string, confirmName: string) {
    return this.projectTypesStorage.forceDeleteProjectType(projectTypeId, confirmName);
  }

  // ProjectStagesStorage methods (28 methods)
  // Kanban stages (6 methods)
  async getAllKanbanStages() {
    return this.projectStagesStorage.getAllKanbanStages();
  }

  async getKanbanStagesByProjectTypeId(projectTypeId: string) {
    return this.projectStagesStorage.getKanbanStagesByProjectTypeId(projectTypeId);
  }

  async getKanbanStagesByServiceId(serviceId: string) {
    return this.projectStagesStorage.getKanbanStagesByServiceId(serviceId);
  }

  async createKanbanStage(stage: any) {
    return this.projectStagesStorage.createKanbanStage(stage);
  }

  async updateKanbanStage(id: string, stage: any) {
    return this.projectStagesStorage.updateKanbanStage(id, stage);
  }

  async deleteKanbanStage(id: string) {
    return this.projectStagesStorage.deleteKanbanStage(id);
  }

  // Stage validation (7 methods)
  async isStageNameInUse(stageName: string) {
    return this.projectStagesStorage.isStageNameInUse(stageName);
  }

  async validateProjectStatus(status: string) {
    return this.projectStagesStorage.validateProjectStatus(status);
  }

  async getStageById(id: string) {
    return this.projectStagesStorage.getStageById(id);
  }

  async validateStageCanBeDeleted(id: string) {
    return this.projectStagesStorage.validateStageCanBeDeleted(id);
  }

  async validateStageCanBeRenamed(id: string, newName: string) {
    return this.projectStagesStorage.validateStageCanBeRenamed(id, newName);
  }

  async getDefaultStage() {
    return this.projectStagesStorage.getDefaultStage();
  }

  // Change reasons (5 methods)
  async getAllChangeReasons() {
    return this.projectStagesStorage.getAllChangeReasons();
  }

  async getChangeReasonsByProjectTypeId(projectTypeId: string) {
    return this.projectStagesStorage.getChangeReasonsByProjectTypeId(projectTypeId);
  }

  async createChangeReason(reason: any) {
    return this.projectStagesStorage.createChangeReason(reason);
  }

  async updateChangeReason(id: string, reason: any) {
    return this.projectStagesStorage.updateChangeReason(id, reason);
  }

  async deleteChangeReason(id: string) {
    return this.projectStagesStorage.deleteChangeReason(id);
  }

  // Stage-reason mappings (6 methods)
  async getAllStageReasonMaps() {
    return this.projectStagesStorage.getAllStageReasonMaps();
  }

  async createStageReasonMap(mapping: any) {
    return this.projectStagesStorage.createStageReasonMap(mapping);
  }

  async getStageReasonMapsByStageId(stageId: string) {
    return this.projectStagesStorage.getStageReasonMapsByStageId(stageId);
  }

  async deleteStageReasonMap(id: string) {
    return this.projectStagesStorage.deleteStageReasonMap(id);
  }

  async validateStageReasonMapping(stageId: string, reasonId: string) {
    return this.projectStagesStorage.validateStageReasonMapping(stageId, reasonId);
  }

  async getValidChangeReasonsForStage(stageId: string) {
    return this.projectStagesStorage.getValidChangeReasonsForStage(stageId);
  }

  // Custom fields (6 methods)
  async getAllReasonCustomFields() {
    return this.projectStagesStorage.getAllReasonCustomFields();
  }

  async getReasonCustomFieldsByReasonId(reasonId: string) {
    return this.projectStagesStorage.getReasonCustomFieldsByReasonId(reasonId);
  }

  async createReasonCustomField(field: any) {
    return this.projectStagesStorage.createReasonCustomField(field);
  }

  async updateReasonCustomField(id: string, field: any) {
    return this.projectStagesStorage.updateReasonCustomField(id, field);
  }

  async deleteReasonCustomField(id: string) {
    return this.projectStagesStorage.deleteReasonCustomField(id);
  }

  async validateRequiredFields(reasonId: string, fieldResponses?: any[]) {
    return this.projectStagesStorage.validateRequiredFields(reasonId, fieldResponses);
  }

  // Field responses (2 methods)
  async createReasonFieldResponse(response: any) {
    return this.projectStagesStorage.createReasonFieldResponse(response);
  }

  async getReasonFieldResponsesByChronologyId(chronologyId: string) {
    return this.projectStagesStorage.getReasonFieldResponsesByChronologyId(chronologyId);
  }

  // ProjectApprovalsStorage methods (14 methods)
  // Stage approvals (6 methods)
  async getAllStageApprovals() {
    return this.projectApprovalsStorage.getAllStageApprovals();
  }

  async getStageApprovalsByProjectTypeId(projectTypeId: string) {
    return this.projectApprovalsStorage.getStageApprovalsByProjectTypeId(projectTypeId);
  }

  async createStageApproval(approval: any) {
    return this.projectApprovalsStorage.createStageApproval(approval);
  }

  async updateStageApproval(id: string, approval: any) {
    return this.projectApprovalsStorage.updateStageApproval(id, approval);
  }

  async deleteStageApproval(id: string) {
    return this.projectApprovalsStorage.deleteStageApproval(id);
  }

  async getStageApprovalById(id: string) {
    return this.projectApprovalsStorage.getStageApprovalById(id);
  }

  // Stage approval fields (5 methods)
  async getAllStageApprovalFields() {
    return this.projectApprovalsStorage.getAllStageApprovalFields();
  }

  async getStageApprovalFieldsByApprovalId(approvalId: string) {
    return this.projectApprovalsStorage.getStageApprovalFieldsByApprovalId(approvalId);
  }

  async createStageApprovalField(field: any) {
    return this.projectApprovalsStorage.createStageApprovalField(field);
  }

  async updateStageApprovalField(id: string, field: any) {
    return this.projectApprovalsStorage.updateStageApprovalField(id, field);
  }

  async deleteStageApprovalField(id: string) {
    return this.projectApprovalsStorage.deleteStageApprovalField(id);
  }

  // Stage approval responses (3 methods)
  async createStageApprovalResponse(response: any) {
    return this.projectApprovalsStorage.createStageApprovalResponse(response);
  }

  async upsertStageApprovalResponse(response: any) {
    return this.projectApprovalsStorage.upsertStageApprovalResponse(response);
  }

  async getStageApprovalResponsesByProjectId(projectId: string) {
    return this.projectApprovalsStorage.getStageApprovalResponsesByProjectId(projectId);
  }

  async validateStageApprovalResponses(approvalId: string, responses: any[]) {
    return this.projectApprovalsStorage.validateStageApprovalResponses(approvalId, responses);
  }

  // ✅ Stage 5 COMPLETE: All 51 project configuration methods extracted and delegated:
  // - ProjectTypesStorage: 9 methods (project type CRUD, dependencies, force delete)
  // - ProjectStagesStorage: 28 methods (kanban stages, validation, change reasons, mappings, custom fields)
  // - ProjectApprovalsStorage: 14 methods (stage approvals, fields, responses, validation)

  // ✅ Stage 4 Part 2 COMPLETE: All 8 complex project methods extracted and delegated:
  // - getAllProjects (~200 lines with complex filtering)
  // - getProjectsByUser (~200 lines, delegates to getAllProjects with role-based filtering)
  // - getProjectsByClient (~160 lines, similar filtering logic)
  // - getProjectsByClientServiceId (~70 lines, uses scheduling history)
  // - updateProjectStatus (~300 lines with validation, chronology, notifications)
  // - getProjectAnalytics (~230 lines, complex aggregation and grouping)
  // - sendBulkProjectAssignmentNotifications (~160 lines, bulk notification sending)
  // - createProjectsFromCSV (~300 lines, bulk import with validation)
  // Total: ~1620 lines extracted from oldStorage to ProjectStorage

  // ============================================================================
  // SERVICES DOMAIN - Delegated to ServiceStorage, WorkRoleStorage, ServiceAssignmentStorage
  // ============================================================================
  
  // ServiceStorage methods (13 methods)
  // Services CRUD
  async getAllServices() {
    return this.serviceStorage.getAllServices();
  }

  async getActiveServices() {
    return this.serviceStorage.getActiveServices();
  }

  async getServicesWithActiveClients() {
    return this.serviceStorage.getServicesWithActiveClients();
  }

  async getClientAssignableServices() {
    return this.serviceStorage.getClientAssignableServices();
  }

  async getProjectTypeAssignableServices() {
    return this.serviceStorage.getProjectTypeAssignableServices();
  }

  async getServiceById(id: string) {
    return this.serviceStorage.getServiceById(id);
  }

  async getServiceByName(name: string) {
    return this.serviceStorage.getServiceByName(name);
  }

  async getServiceByProjectTypeId(projectTypeId: string) {
    return this.serviceStorage.getServiceByProjectTypeId(projectTypeId);
  }

  async getScheduledServices() {
    return this.serviceStorage.getScheduledServices();
  }

  async createService(service: any) {
    return this.serviceStorage.createService(service);
  }

  async updateService(id: string, service: any) {
    return this.serviceStorage.updateService(id, service);
  }

  async deleteService(id: string) {
    return this.serviceStorage.deleteService(id);
  }

  // Service Owner Resolution (cross-domain method using serviceAssignmentStorage and userStorage)
  async resolveServiceOwner(clientId: string, projectTypeId: string) {
    return this.serviceAssignmentStorage.resolveServiceOwner(clientId, projectTypeId);
  }

  // Project Assignments Resolution (delegates to serviceAssignmentStorage)
  async resolveProjectAssignments(clientId: string, projectTypeId: string) {
    return this.serviceAssignmentStorage.resolveProjectAssignments(clientId, projectTypeId);
  }

  // WorkRoleStorage methods (10 methods)
  // Work Roles CRUD
  async getAllWorkRoles() {
    return this.workRoleStorage.getAllWorkRoles();
  }

  async getWorkRoleById(id: string) {
    return this.workRoleStorage.getWorkRoleById(id);
  }

  async getWorkRoleByName(name: string) {
    return this.workRoleStorage.getWorkRoleByName(name);
  }

  async createWorkRole(role: any) {
    return this.workRoleStorage.createWorkRole(role);
  }

  async updateWorkRole(id: string, role: any) {
    return this.workRoleStorage.updateWorkRole(id, role);
  }

  async deleteWorkRole(id: string) {
    return this.workRoleStorage.deleteWorkRole(id);
  }

  // Service-Role Mappings
  async getServiceRolesByServiceId(serviceId: string) {
    return this.workRoleStorage.getServiceRolesByServiceId(serviceId);
  }

  async getWorkRolesByServiceId(serviceId: string) {
    return this.workRoleStorage.getWorkRolesByServiceId(serviceId);
  }

  async addRoleToService(serviceId: string, roleId: string) {
    return this.workRoleStorage.addRoleToService(serviceId, roleId);
  }

  async removeRoleFromService(serviceId: string, roleId: string) {
    return this.workRoleStorage.removeRoleFromService(serviceId, roleId);
  }

  // ServiceAssignmentStorage methods (30 methods)
  // Client Services CRUD
  async getAllClientServices() {
    return this.serviceAssignmentStorage.getAllClientServices();
  }

  async getClientServiceById(id: string) {
    return this.serviceAssignmentStorage.getClientServiceById(id);
  }

  async getClientServicesByClientId(clientId: string) {
    return this.serviceAssignmentStorage.getClientServicesByClientId(clientId);
  }

  async getClientServicesByServiceId(serviceId: string) {
    return this.serviceAssignmentStorage.getClientServicesByServiceId(serviceId);
  }

  async createClientService(service: any) {
    return this.serviceAssignmentStorage.createClientService(service);
  }

  async updateClientService(id: string, service: any) {
    return this.serviceAssignmentStorage.updateClientService(id, service);
  }

  async deleteClientService(id: string) {
    return this.serviceAssignmentStorage.deleteClientService(id);
  }

  async getClientServiceByClientAndProjectType(clientId: string, projectTypeId: string) {
    return this.serviceAssignmentStorage.getClientServiceByClientAndProjectType(clientId, projectTypeId);
  }

  async checkClientServiceMappingExists(clientId: string, serviceId: string) {
    return this.serviceAssignmentStorage.checkClientServiceMappingExists(clientId, serviceId);
  }

  async getAllClientServicesWithDetails() {
    return this.serviceAssignmentStorage.getAllClientServicesWithDetails();
  }

  // Client Service Role Assignments CRUD
  async getClientServiceRoleAssignments(clientServiceId: string) {
    return this.serviceAssignmentStorage.getClientServiceRoleAssignments(clientServiceId);
  }

  async getActiveClientServiceRoleAssignments(clientServiceId: string) {
    return this.serviceAssignmentStorage.getActiveClientServiceRoleAssignments(clientServiceId);
  }

  async getClientServiceRoleAssignmentById(id: string) {
    return this.serviceAssignmentStorage.getClientServiceRoleAssignmentById(id);
  }

  async createClientServiceRoleAssignment(assignment: any) {
    return this.serviceAssignmentStorage.createClientServiceRoleAssignment(assignment);
  }

  async updateClientServiceRoleAssignment(id: string, assignment: any) {
    return this.serviceAssignmentStorage.updateClientServiceRoleAssignment(id, assignment);
  }

  async deactivateClientServiceRoleAssignment(id: string) {
    return this.serviceAssignmentStorage.deactivateClientServiceRoleAssignment(id);
  }

  async deleteClientServiceRoleAssignment(id: string) {
    return this.serviceAssignmentStorage.deleteClientServiceRoleAssignment(id);
  }

  // Role Resolution for Project Creation
  async resolveRoleAssigneeForClientByRoleId(clientId: string, projectTypeId: string, workRoleId: string) {
    return this.serviceAssignmentStorage.resolveRoleAssigneeForClientByRoleId(clientId, projectTypeId, workRoleId);
  }

  async resolveRoleAssigneeForClient(clientId: string, projectTypeId: string, roleName: string) {
    return this.serviceAssignmentStorage.resolveRoleAssigneeForClient(clientId, projectTypeId, roleName);
  }

  // Validation Methods
  async validateClientServiceRoleCompleteness(clientServiceId: string) {
    return this.serviceAssignmentStorage.validateClientServiceRoleCompleteness(clientServiceId);
  }

  async validateAssignedRolesAgainstService(serviceId: string, roleIds: string[]) {
    return this.serviceAssignmentStorage.validateAssignedRolesAgainstService(serviceId, roleIds);
  }

  // People Services CRUD
  async getAllPeopleServices() {
    return this.serviceAssignmentStorage.getAllPeopleServices();
  }

  async getPeopleServiceById(id: string) {
    return this.serviceAssignmentStorage.getPeopleServiceById(id);
  }

  async getPeopleServicesByPersonId(personId: string) {
    return this.serviceAssignmentStorage.getPeopleServicesByPersonId(personId);
  }

  async getPeopleServicesByServiceId(serviceId: string) {
    return this.serviceAssignmentStorage.getPeopleServicesByServiceId(serviceId);
  }

  async getPeopleServicesByClientId(clientId: string) {
    return this.serviceAssignmentStorage.getPeopleServicesByClientId(clientId);
  }

  async createPeopleService(service: any) {
    return this.serviceAssignmentStorage.createPeopleService(service);
  }

  async updatePeopleService(id: string, service: any) {
    return this.serviceAssignmentStorage.updatePeopleService(id, service);
  }

  async deletePeopleService(id: string) {
    return this.serviceAssignmentStorage.deletePeopleService(id);
  }

  async checkPeopleServiceMappingExists(personId: string, serviceId: string) {
    return this.serviceAssignmentStorage.checkPeopleServiceMappingExists(personId, serviceId);
  }

  async getAllPeopleServicesWithDetails() {
    return this.serviceAssignmentStorage.getAllPeopleServicesWithDetails();
  }

  // ✅ Stage 6 COMPLETE: All 53 service-related methods extracted and delegated:
  // - ServiceStorage: 13 methods (services CRUD, scheduled services, service owner resolution)
  // - WorkRoleStorage: 10 methods (work roles CRUD, service-role mappings)
  // - ServiceAssignmentStorage: 30 methods (client services, role assignments, people services, validation)

  // Delegate all other methods to old storage
  // (This is a catch-all for the remaining methods)

  // Add proxy for all other methods using Proxy pattern for complete coverage
  // This ensures any method not explicitly delegated above goes to oldStorage
  [key: string]: any;
}

// Use a Proxy to catch any methods we haven't explicitly delegated
const createDatabaseStorageProxy = () => {
  const instance = new DatabaseStorage();
  
  return new Proxy(instance, {
    get(target: any, prop: string) {
      // If the property exists on the new composite class, use it
      if (prop in target) {
        const value = target[prop];
        if (typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      }
      
      // Otherwise, delegate to old storage
      const oldStorageValue = (target as any).oldStorage[prop];
      if (typeof oldStorageValue === 'function') {
        return oldStorageValue.bind((target as any).oldStorage);
      }
      return oldStorageValue;
    }
  });
};

// Export storage instance for backward compatibility
export const storage = createDatabaseStorageProxy();

// ============================================================================
// EVOLUTION TRACKING:
// ============================================================================
// Stage 0: ✅ Foundation complete - facade with wildcard re-export
// Stage 1: ✅ Users domain extracted - 31 methods delegated  
// Stage 2: ✅ Clients domain extracted - 31 methods delegated
//          - ClientStorage: 27 methods (CRUD, relationships, chronology, tags, aliases, domains)
//          - CompaniesHouseStorage: 2 methods (CH integration)
//          - SearchStorage: 1 method (super search)
// Stage 3: ✅ People domain extracted - 15 methods delegated
//          - PeopleStorage: 10 methods (CRUD, portal status, CH sync, duplicate detection)
//          - ClientPeopleStorage: 5 methods (relationship CRUD)
//          Note: linkPersonToClient, unlinkPersonFromClient already in ClientStorage from Stage 2
// Stage 4: ✅ Projects domain extracted - 17 methods delegated (Part 1 + Part 2 COMPLETE)
//          - ProjectStorage: 13 methods total
//            * Part 1 (5 methods): createProject, getProject, updateProject, getActiveProjectsByClientAndType, getUniqueDueDatesForService
//            * Part 2 (8 methods): getAllProjects, getProjectsByUser, getProjectsByClient, getProjectsByClientServiceId, updateProjectStatus, getProjectAnalytics, sendBulkProjectAssignmentNotifications, createProjectsFromCSV
//          - ProjectChronologyStorage: 4 methods (createChronologyEntry, getProjectChronology, getMostRecentStageChange, getProjectProgressMetrics)
//          - Note: Client chronology methods (createClientChronologyEntry, getClientChronology) already in Stage 2 Clients domain
//          - Helper injection: 18 cross-domain helpers registered for configuration, services, notifications, and messaging dependencies
// Stage 5: ✅ Project configuration domain extracted - 51 methods delegated (COMPLETE)
//          - ProjectTypesStorage: 9 methods (project type CRUD, dependencies, force delete)
//          - ProjectStagesStorage: 28 methods (kanban stages, validation, change reasons, mappings, custom fields)
//          - ProjectApprovalsStorage: 14 methods (stage approvals, fields, responses, validation)
// Stage 6: ✅ Services domain extracted - 53 methods delegated (COMPLETE)
//          - ServiceStorage: 13 methods (services CRUD, scheduled services, service owner resolution)
//          - WorkRoleStorage: 10 methods (work roles CRUD, service-role mappings)
//          - ServiceAssignmentStorage: 30 methods (client services, role assignments, people services, validation)
//          - Helper updates: registerClientHelpers updated to use serviceAssignmentStorage instead of oldStorage
// Stage 7-14: [ ] Other domains - pending
// Stage 15: [ ] Final cleanup - remove old storage.ts
// ============================================================================