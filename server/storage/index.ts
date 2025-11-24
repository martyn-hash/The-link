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
import { UserStorage } from './users/userStorage';
import { UserActivityStorage } from './users/userActivityStorage';

// Export shared types (new modular architecture)
export * from './base/types';

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

  constructor() {
    // Initialize all storage instances
    this.oldStorage = new OldDatabaseStorage();
    this.userStorage = new UserStorage();
    this.userActivityStorage = new UserActivityStorage(this.oldStorage);
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

  // Delegate all other methods to old storage
  // (This is a catch-all for the remaining ~270 methods)
  
  // Client operations
  async createClient(clientData: any) {
    return this.oldStorage.createClient(clientData);
  }

  async getClientById(id: string) {
    return this.oldStorage.getClientById(id);
  }

  async getClientByName(name: string) {
    return this.oldStorage.getClientByName(name);
  }

  async getAllClients(search?: string) {
    return this.oldStorage.getAllClients(search);
  }

  async updateClient(id: string, clientData: any) {
    return this.oldStorage.updateClient(id, clientData);
  }

  async deleteClient(id: string) {
    return this.oldStorage.deleteClient(id);
  }

  async superSearch(query: string, limit?: number) {
    return this.oldStorage.superSearch(query, limit);
  }

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
// Stage 2: [ ] Clients domain - pending
// Stage 3-14: [ ] Other domains - pending
// Stage 15: [ ] Final cleanup - remove old storage.ts
// ============================================================================