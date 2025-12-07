import { UserStorage } from '../users/userStorage.js';
import { UserActivityStorage } from '../users/userActivityStorage.js';

export interface UsersFacadeDeps {
  userStorage: UserStorage;
  userActivityStorage: UserActivityStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyUsersFacade<TBase extends Constructor<UsersFacadeDeps>>(Base: TBase) {
  return class extends Base {
    async getUser(id: string) {
      return this.userStorage.getUser(id);
    }

    async getFallbackUser() {
      return this.userStorage.getFallbackUser();
    }

    async setFallbackUser(userId: string) {
      return this.userStorage.setFallbackUser(userId);
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

    async createAdminIfNone(userData: any) {
      return this.userStorage.createAdminIfNone(userData);
    }

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

    async createLoginAttempt(attempt: any) {
      return this.userStorage.createLoginAttempt(attempt);
    }

    async getLoginAttempts(options?: any) {
      return this.userStorage.getLoginAttempts(options);
    }

    async cleanupOldLoginAttempts(daysToKeep: number) {
      return this.userStorage.cleanupOldLoginAttempts(daysToKeep);
    }

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

    async trackUserActivity(userId: string, entityType: string, entityId: string) {
      return this.userActivityStorage.trackUserActivity(userId, entityType, entityId);
    }

    async getRecentlyViewedByUser(userId: string, limit?: number) {
      return this.userActivityStorage.getRecentlyViewedByUser(userId, limit);
    }

    async getUserActivityTracking(options?: any) {
      return this.userActivityStorage.getUserActivityTracking(options);
    }
  };
}
