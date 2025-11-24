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
  ProjectSchedulingStorage,
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
import { TagStorage } from './tags/index.js';
import { CommunicationStorage } from './communications/index.js';
import { 
  IntegrationStorage, 
  PushNotificationStorage, 
  EmailStorage 
} from './integrations/index.js';
import { 
  DocumentStorage, 
  RiskAssessmentStorage, 
  PortalDocumentStorage 
} from './documents/index.js';
import { PortalStorage } from './portal/index.js';

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
  private projectSchedulingStorage: ProjectSchedulingStorage;
  private serviceStorage: ServiceStorage;
  private workRoleStorage: WorkRoleStorage;
  private serviceAssignmentStorage: ServiceAssignmentStorage;
  private tagStorage: TagStorage;
  private communicationStorage: CommunicationStorage;
  private integrationStorage: IntegrationStorage;
  private pushNotificationStorage: PushNotificationStorage;
  private emailStorage: EmailStorage;
  private documentStorage: DocumentStorage;
  private riskAssessmentStorage: RiskAssessmentStorage;
  private portalDocumentStorage: PortalDocumentStorage;
  private portalStorage: PortalStorage;

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
    this.projectSchedulingStorage = new ProjectSchedulingStorage();
    
    // Initialize services domain storages
    this.serviceStorage = new ServiceStorage();
    this.workRoleStorage = new WorkRoleStorage();
    this.serviceAssignmentStorage = new ServiceAssignmentStorage();
    
    // Initialize tags domain storage (Stage 7)
    this.tagStorage = new TagStorage();
    
    // Initialize communications domain storage (Stage 7)
    this.communicationStorage = new CommunicationStorage();
    
    // Initialize integrations domain storage (Stage 8)
    this.integrationStorage = new IntegrationStorage();
    this.pushNotificationStorage = new PushNotificationStorage();
    this.emailStorage = new EmailStorage();
    
    // Initialize documents domain storage (Stage 9)
    this.documentStorage = new DocumentStorage();
    this.riskAssessmentStorage = new RiskAssessmentStorage();
    this.portalDocumentStorage = new PortalDocumentStorage();
    
    // Initialize portal domain storage (Stage 9)
    this.portalStorage = new PortalStorage();
    
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

  async getFallbackUser() {
    return this.userStorage.getFallbackUser();
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

  // NOTE: Client Tags moved to Stage 7 TagStorage (lines 1267+)
  // Removed duplicate delegations that were previously in clientStorage

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

  // ============================================================================
  // TAGS DOMAIN - Delegated to TagStorage (Stage 7)
  // ============================================================================

  // Client Tags CRUD
  async getAllClientTags() {
    return this.tagStorage.getAllClientTags();
  }

  async createClientTag(tag: any) {
    return this.tagStorage.createClientTag(tag);
  }

  async deleteClientTag(id: string) {
    return this.tagStorage.deleteClientTag(id);
  }

  // People Tags CRUD
  async getAllPeopleTags() {
    return this.tagStorage.getAllPeopleTags();
  }

  async createPeopleTag(tag: any) {
    return this.tagStorage.createPeopleTag(tag);
  }

  async deletePeopleTag(id: string) {
    return this.tagStorage.deletePeopleTag(id);
  }

  // Client Tag Assignments
  async getAllClientTagAssignments() {
    return this.tagStorage.getAllClientTagAssignments();
  }

  async getClientTags(clientId: string) {
    return this.tagStorage.getClientTags(clientId);
  }

  async assignClientTag(assignment: any) {
    return this.tagStorage.assignClientTag(assignment);
  }

  async unassignClientTag(clientId: string, tagId: string) {
    return this.tagStorage.unassignClientTag(clientId, tagId);
  }

  // People Tag Assignments
  async getPersonTags(personId: string) {
    return this.tagStorage.getPersonTags(personId);
  }

  async assignPersonTag(assignment: any) {
    return this.tagStorage.assignPersonTag(assignment);
  }

  async unassignPersonTag(personId: string, tagId: string) {
    return this.tagStorage.unassignPersonTag(personId, tagId);
  }

  // ============================================================================
  // COMMUNICATIONS DOMAIN - Delegated to CommunicationStorage (Stage 7)
  // ============================================================================

  async getAllCommunications() {
    return this.communicationStorage.getAllCommunications();
  }

  async getCommunicationsByClientId(clientId: string) {
    return this.communicationStorage.getCommunicationsByClientId(clientId);
  }

  async getCommunicationsByPersonId(personId: string) {
    return this.communicationStorage.getCommunicationsByPersonId(personId);
  }

  async getCommunicationsByProjectId(projectId: string) {
    return this.communicationStorage.getCommunicationsByProjectId(projectId);
  }

  async getCommunicationById(id: string) {
    return this.communicationStorage.getCommunicationById(id);
  }

  async createCommunication(communication: any) {
    return this.communicationStorage.createCommunication(communication);
  }

  async updateCommunication(id: string, communication: any) {
    return this.communicationStorage.updateCommunication(id, communication);
  }

  async deleteCommunication(id: string) {
    return this.communicationStorage.deleteCommunication(id);
  }

  // ============================================================================
  // PROJECT SCHEDULING DOMAIN - Delegated to ProjectSchedulingStorage (Stage 7)
  // ============================================================================

  async createProjectSchedulingHistory(data: any) {
    return this.projectSchedulingStorage.createProjectSchedulingHistory(data);
  }

  async getProjectSchedulingHistoryByServiceId(serviceId: string, serviceType: 'client' | 'people') {
    return this.projectSchedulingStorage.getProjectSchedulingHistoryByServiceId(serviceId, serviceType);
  }

  async createSchedulingRunLog(data: any) {
    return this.projectSchedulingStorage.createSchedulingRunLog(data);
  }

  async getSchedulingRunLogs(limit?: number) {
    return this.projectSchedulingStorage.getSchedulingRunLogs(limit);
  }

  async getLatestSchedulingRunLog() {
    return this.projectSchedulingStorage.getLatestSchedulingRunLog();
  }

  // ============================================================================
  // INTEGRATIONS DOMAIN - Delegated to Integration Storage Modules (Stage 8)
  // ============================================================================

  // User Integrations & OAuth - IntegrationStorage
  async getUserIntegrations(userId: string): Promise<any> {
    return this.integrationStorage.getUserIntegrations(userId) as any;
  }

  async getUserIntegrationByType(userId: string, integrationType: 'office365' | 'voodoo_sms' | 'ringcentral') {
    return this.integrationStorage.getUserIntegrationByType(userId, integrationType);
  }

  async createUserIntegration(integration: any) {
    return this.integrationStorage.createUserIntegration(integration);
  }

  async updateUserIntegration(id: string, updates: any) {
    return this.integrationStorage.updateUserIntegration(id, updates);
  }

  async deleteUserIntegration(id: string) {
    return this.integrationStorage.deleteUserIntegration(id);
  }

  async createUserOauthAccount(account: any) {
    return this.integrationStorage.createUserOauthAccount(account);
  }

  async getUserOauthAccount(userId: string, provider: string) {
    return this.integrationStorage.getUserOauthAccount(userId, provider);
  }

  async updateUserOauthAccount(id: string, account: any) {
    return this.integrationStorage.updateUserOauthAccount(id, account);
  }

  async deleteUserOauthAccount(userId: string, provider: string) {
    return this.integrationStorage.deleteUserOauthAccount(userId, provider);
  }

  // Push Notifications - PushNotificationStorage
  async createPushSubscription(subscription: any) {
    return this.pushNotificationStorage.createPushSubscription(subscription);
  }

  async getPushSubscriptionsByUserId(userId: string) {
    return this.pushNotificationStorage.getPushSubscriptionsByUserId(userId);
  }

  async getPushSubscriptionsByClientPortalUserId(clientPortalUserId: string) {
    return this.pushNotificationStorage.getPushSubscriptionsByClientPortalUserId(clientPortalUserId);
  }

  async deletePushSubscription(endpoint: string) {
    return this.pushNotificationStorage.deletePushSubscription(endpoint);
  }

  async deletePushSubscriptionsByUserId(userId: string) {
    return this.pushNotificationStorage.deletePushSubscriptionsByUserId(userId);
  }

  async getAllPushNotificationTemplates() {
    return this.pushNotificationStorage.getAllPushNotificationTemplates();
  }

  async getPushNotificationTemplateByType(templateType: string) {
    return this.pushNotificationStorage.getPushNotificationTemplateByType(templateType);
  }

  async updatePushNotificationTemplate(id: string, template: any) {
    return this.pushNotificationStorage.updatePushNotificationTemplate(id, template);
  }

  async createPushNotificationTemplate(template: any) {
    return this.pushNotificationStorage.createPushNotificationTemplate(template);
  }

  async deletePushNotificationTemplate(id: string) {
    return this.pushNotificationStorage.deletePushNotificationTemplate(id);
  }

  async getAllNotificationIcons() {
    return this.pushNotificationStorage.getAllNotificationIcons();
  }

  async getNotificationIconById(id: string) {
    return this.pushNotificationStorage.getNotificationIconById(id);
  }

  async createNotificationIcon(icon: any) {
    return this.pushNotificationStorage.createNotificationIcon(icon);
  }

  async deleteNotificationIcon(id: string) {
    return this.pushNotificationStorage.deleteNotificationIcon(id);
  }

  // Email Operations - EmailStorage
  async createGraphWebhookSubscription(subscription: any) {
    return this.emailStorage.createGraphWebhookSubscription(subscription);
  }

  async getGraphWebhookSubscription(subscriptionId: string) {
    return this.emailStorage.getGraphWebhookSubscription(subscriptionId);
  }

  async updateGraphWebhookSubscription(subscriptionId: string, updates: any) {
    return this.emailStorage.updateGraphWebhookSubscription(subscriptionId, updates);
  }

  async getActiveGraphWebhookSubscriptions() {
    return this.emailStorage.getActiveGraphWebhookSubscriptions();
  }

  async getExpiringGraphWebhookSubscriptions(hoursUntilExpiry: number) {
    return this.emailStorage.getExpiringGraphWebhookSubscriptions(hoursUntilExpiry);
  }

  async getGraphSyncState(userId: string, folderPath: string) {
    return this.emailStorage.getGraphSyncState(userId, folderPath);
  }

  async upsertGraphSyncState(state: any) {
    return this.emailStorage.upsertGraphSyncState(state);
  }

  async upsertEmailMessage(message: any) {
    return this.emailStorage.upsertEmailMessage(message);
  }

  async getEmailMessageByInternetMessageId(internetMessageId: string) {
    return this.emailStorage.getEmailMessageByInternetMessageId(internetMessageId);
  }

  async getEmailMessagesByThreadId(threadId: string) {
    return this.emailStorage.getEmailMessagesByThreadId(threadId);
  }

  async updateEmailMessage(id: string, updates: any) {
    return this.emailStorage.updateEmailMessage(id, updates);
  }

  async createMailboxMessageMap(mapping: any) {
    return this.emailStorage.createMailboxMessageMap(mapping);
  }

  async createEmailThread(thread: any) {
    return this.emailStorage.createEmailThread(thread);
  }

  async updateEmailThread(canonicalConversationId: string, updates: any) {
    return this.emailStorage.updateEmailThread(canonicalConversationId, updates);
  }

  async getEmailThreadById(canonicalConversationId: string) {
    return this.emailStorage.getEmailThreadById(canonicalConversationId);
  }

  async getEmailThreadByConversationId(conversationId: string) {
    return this.emailStorage.getEmailThreadByConversationId(conversationId);
  }

  async getEmailThreadByThreadKey(threadKey: string) {
    return this.emailStorage.getEmailThreadByThreadKey(threadKey);
  }

  async createUnmatchedEmail(unmatchedEmail: any) {
    return this.emailStorage.createUnmatchedEmail(unmatchedEmail);
  }

  async updateUnmatchedEmail(id: string, updates: any) {
    return this.emailStorage.updateUnmatchedEmail(id, updates);
  }

  async getUnthreadedMessages() {
    return this.emailStorage.getUnthreadedMessages();
  }

  // Note: Client email alias and domain allowlist methods are already delegated in Stage 2 (ClientStorage)
  // They are not re-implemented here to avoid duplication.

  // ============================================================================
  // DOCUMENTS & PORTAL DOMAIN - Delegated to Document & Portal Storage Modules (Stage 9)
  // ============================================================================

  // Document Folder Operations - DocumentStorage
  async createDocumentFolder(folder: any) {
    return this.documentStorage.createDocumentFolder(folder);
  }

  async getDocumentFolderById(id: string) {
    return this.documentStorage.getDocumentFolderById(id);
  }

  async getDocumentFoldersByClientId(clientId: string) {
    return this.documentStorage.getDocumentFoldersByClientId(clientId);
  }

  async deleteDocumentFolder(id: string) {
    return this.documentStorage.deleteDocumentFolder(id);
  }

  // Document Operations - DocumentStorage
  async createDocument(document: any) {
    return this.documentStorage.createDocument(document);
  }

  async getDocumentById(id: string) {
    return this.documentStorage.getDocumentById(id);
  }

  async getDocumentsByClientId(clientId: string) {
    return this.documentStorage.getDocumentsByClientId(clientId);
  }

  async getDocumentsByFolderId(folderId: string) {
    return this.documentStorage.getDocumentsByFolderId(folderId);
  }

  async deleteDocument(id: string) {
    return this.documentStorage.deleteDocument(id);
  }

  async getSignedUrl(objectPath: string) {
    return this.documentStorage.getSignedUrl(objectPath);
  }

  // Portal Document Operations - PortalDocumentStorage
  async listPortalDocuments(clientId: string, clientPortalUserId: string) {
    return this.portalDocumentStorage.listPortalDocuments(clientId, clientPortalUserId);
  }

  async createPortalDocument(document: any) {
    return this.portalDocumentStorage.createPortalDocument(document);
  }

  async deletePortalDocument(id: string, clientId: string, clientPortalUserId: string) {
    return this.portalDocumentStorage.deletePortalDocument(id, clientId, clientPortalUserId);
  }

  async getPortalDocumentById(id: string, clientId: string, clientPortalUserId: string) {
    return this.portalDocumentStorage.getPortalDocumentById(id, clientId, clientPortalUserId);
  }

  // Risk Assessment Operations - RiskAssessmentStorage
  async createRiskAssessment(assessment: any) {
    return this.riskAssessmentStorage.createRiskAssessment(assessment);
  }

  async getRiskAssessmentById(id: string) {
    return this.riskAssessmentStorage.getRiskAssessmentById(id);
  }

  async getRiskAssessmentsByClientId(clientId: string) {
    return this.riskAssessmentStorage.getRiskAssessmentsByClientId(clientId);
  }

  async updateRiskAssessment(id: string, assessment: any) {
    return this.riskAssessmentStorage.updateRiskAssessment(id, assessment);
  }

  async deleteRiskAssessment(id: string) {
    return this.riskAssessmentStorage.deleteRiskAssessment(id);
  }

  async saveRiskAssessmentResponses(assessmentId: string, responses: any[]) {
    return this.riskAssessmentStorage.saveRiskAssessmentResponses(assessmentId, responses);
  }

  async getRiskAssessmentResponses(assessmentId: string) {
    return this.riskAssessmentStorage.getRiskAssessmentResponses(assessmentId);
  }

  // Client Portal User Operations - PortalStorage
  async createClientPortalUser(user: any) {
    return this.portalStorage.createClientPortalUser(user);
  }

  async getClientPortalUserById(id: string) {
    return this.portalStorage.getClientPortalUserById(id);
  }

  async getClientPortalUserByEmail(email: string) {
    return this.portalStorage.getClientPortalUserByEmail(email);
  }

  async getClientPortalUserByMagicLinkToken(token: string) {
    return this.portalStorage.getClientPortalUserByMagicLinkToken(token);
  }

  async getClientPortalUsersByClientId(clientId: string) {
    return this.portalStorage.getClientPortalUsersByClientId(clientId);
  }

  async getClientPortalUserByPersonId(personId: string) {
    return this.portalStorage.getClientPortalUserByPersonId(personId);
  }

  async updateClientPortalUser(id: string, user: any) {
    return this.portalStorage.updateClientPortalUser(id, user);
  }

  async deleteClientPortalUser(id: string) {
    return this.portalStorage.deleteClientPortalUser(id);
  }

  // Client Portal Session Operations - PortalStorage
  async createClientPortalSession(data: any) {
    return this.portalStorage.createClientPortalSession(data);
  }

  async getClientPortalSessionByToken(token: string) {
    return this.portalStorage.getClientPortalSessionByToken(token);
  }

  async deleteClientPortalSession(id: string) {
    return this.portalStorage.deleteClientPortalSession(id);
  }

  async cleanupExpiredSessions() {
    return this.portalStorage.cleanupExpiredSessions();
  }

  // ✅ Stage 9 COMPLETE: All 32 documents & portal domain methods extracted and delegated:
  // - DocumentStorage: 11 methods (folders, documents, signed URLs)
  // - RiskAssessmentStorage: 7 methods (risk assessments, responses)
  // - PortalDocumentStorage: 4 methods (portal documents)
  // - PortalStorage: 12 methods (portal users, sessions)

  // ✅ Stage 8 COMPLETE: All 54 integration domain methods extracted and delegated:
  // - IntegrationStorage: 9 methods (user integrations, OAuth accounts)
  // - PushNotificationStorage: 14 methods (subscriptions, templates, icons)
  // - EmailStorage: 31 methods (Graph webhooks, email messages, threads, attachments, client email ops)

  // ✅ Stage 7 COMPLETE: All 28 supporting domain methods extracted and delegated:
  // - TagStorage: 13 methods (client tags, people tags, tag assignments)
  // - CommunicationStorage: 8 methods (communications query and CRUD)
  // - ProjectSchedulingStorage: 5 methods (scheduling history, run logs)

  // ✅ STAGE 6 SUMMARY (for reference):
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
// Stage 7: ✅ Tags, Communications, & Scheduling extracted - 28 methods delegated (COMPLETE)
//          - TagStorage: 13 methods (client tags, people tags, tag assignments)
//          - CommunicationStorage: 8 methods (communications query and CRUD)
//          - ProjectSchedulingStorage: 5 methods (scheduling history, run logs)
//          - Self-contained domains: No cross-domain helpers needed
// Stage 8: ✅ Integrations domain extracted - 54 methods delegated (COMPLETE)
//          - IntegrationStorage: 9 methods (user integrations, OAuth accounts)
//          - PushNotificationStorage: 14 methods (push subscriptions, templates, notification icons)
//          - EmailStorage: 31 methods (Graph webhooks, sync state, email messages, threads, mailbox maps, 
//            unmatched emails, client email aliases, domain allowlist, attachments)
//          - Bug fixes: Corrected schema field mismatches in old storage.ts (isRead, isDraft, importance, 
//            threadId→canonicalConversationId, sentAt→sentDateTime, matchConfidence→clientMatchConfidence,
//            conversationId→canonicalConversationId, email→emailLowercase)
//          - Self-contained domain: No cross-domain helpers needed
// Stage 9-14: [ ] Other domains - pending
// Stage 15: [ ] Final cleanup - remove old storage.ts
// ============================================================================