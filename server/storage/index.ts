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
import { ProjectStorage, ProjectChronologyStorage } from './projects/index.js';

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
    
    // Register cross-domain helpers
    this.registerClientHelpers();
    this.registerPeopleHelpers();
    this.registerProjectHelpers();
  }

  /**
   * Register helpers for cross-domain dependencies in people storage
   */
  private registerPeopleHelpers() {
    // No cross-domain helpers needed for Stage 3
    // People domain operations are self-contained
  }

  /**
   * Register helpers for cross-domain dependencies in project storage
   */
  private registerProjectHelpers() {
    // ProjectStorage needs helpers from configuration and services domains
    this.projectStorage.registerHelpers({
      getDefaultStage: () => this.oldStorage.getDefaultStage(),
      validateProjectStatus: (status: string) => this.oldStorage.validateProjectStatus(status),
      getServiceByProjectTypeId: (projectTypeId: string) => this.oldStorage.getServiceByProjectTypeId(projectTypeId),
      getClientServiceByClientAndProjectType: (clientId: string, projectTypeId: string) => 
        this.oldStorage.getClientServiceByClientAndProjectType(clientId, projectTypeId),
      resolveProjectAssignments: (clientId: string, projectTypeId: string) => 
        this.oldStorage.resolveProjectAssignments(clientId, projectTypeId),
      resolveServiceOwner: (clientId: string, projectTypeId: string) => 
        this.oldStorage.resolveServiceOwner(clientId, projectTypeId),
      resolveStageRoleAssignee: (project: any) => this.oldStorage.resolveStageRoleAssignee(project),
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
        const projects = await this.oldStorage.getProjectsByClientId(clientId);
        return projects && projects.length > 0;
      },
      // Delete client services and role assignments (for deletion cascade)
      deleteClientServices: async (clientId: string) => {
        const services = await this.oldStorage.getClientServicesByClientId(clientId);
        for (const service of services) {
          // Delete role assignments first
          const assignments = await this.oldStorage.getClientServiceRoleAssignmentsByServiceId(service.id);
          for (const assignment of assignments) {
            await this.oldStorage.deleteClientServiceRoleAssignment(assignment.id);
          }
          // Delete the service
          await this.oldStorage.deleteClientService(service.id);
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

  // TODO Stage 4 Part 2: Extract these complex methods (8 remaining)
  // - getAllProjects (200+ lines with complex filtering)
  // - getProjectsByUser (delegates to getAllProjects with role-based filtering)
  // - getProjectsByClient (similar filtering logic)
  // - getProjectsByClientServiceId (uses scheduling history)
  // - updateProjectStatus (300+ lines with validation, chronology, notifications)
  // - getProjectAnalytics (complex aggregation and grouping)
  // - createProjectsFromCSV (bulk import with validation)
  // - sendBulkProjectAssignmentNotifications (bulk notification sending)
  // These currently pass through to oldStorage via Proxy

  // Delegate all other methods to old storage
  // (This is a catch-all for the remaining ~214 methods)

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
// Stage 4: 🔄 Projects domain extracted (Part 1) - 9 methods delegated
//          - ProjectStorage: 5 methods (createProject, getProject, updateProject, getActiveProjectsByClientAndType, getUniqueDueDatesForService)
//          - ProjectChronologyStorage: 4 methods (createChronologyEntry, getProjectChronology, getMostRecentStageChange, getProjectProgressMetrics)
//          - Note: Client chronology methods (createClientChronologyEntry, getClientChronology) already in Stage 2 Clients domain
//          - 8 complex methods remain in oldStorage for Stage 4 Part 2 (getAllProjects, getProjectsByUser, getProjectsByClient, getProjectsByClientServiceId, updateProjectStatus, getProjectAnalytics, createProjectsFromCSV, sendBulkProjectAssignmentNotifications)
// Stage 5-14: [ ] Other domains - pending
// Stage 15: [ ] Final cleanup - remove old storage.ts
// ============================================================================