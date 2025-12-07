import {
  UserNotificationPreferencesStorage,
  ViewsStorage,
  ColumnPreferencesStorage,
  DashboardStorage,
  UserPreferencesStorage,
  CompanySettingsStorage
} from '../settings/index.js';
import { ServiceAssignmentStorage } from '../services/index.js';

export interface SettingsFacadeDeps {
  userNotificationPreferencesStorage: UserNotificationPreferencesStorage;
  viewsStorage: ViewsStorage;
  columnPreferencesStorage: ColumnPreferencesStorage;
  dashboardStorage: DashboardStorage;
  userPreferencesStorage: UserPreferencesStorage;
  companySettingsStorage: CompanySettingsStorage;
  serviceAssignmentStorage: ServiceAssignmentStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applySettingsFacade<TBase extends Constructor<SettingsFacadeDeps>>(Base: TBase) {
  return class extends Base {
    // ============================================================================
    // USER NOTIFICATION PREFERENCES OPERATIONS - UserNotificationPreferencesStorage (5 methods)
    // ============================================================================

    async getUserNotificationPreferences(userId: string) {
      return this.userNotificationPreferencesStorage.getUserNotificationPreferences(userId);
    }

    async createUserNotificationPreferences(preferences: any) {
      return this.userNotificationPreferencesStorage.createUserNotificationPreferences(preferences);
    }

    async updateUserNotificationPreferences(userId: string, preferences: any) {
      return this.userNotificationPreferencesStorage.updateUserNotificationPreferences(userId, preferences);
    }

    async getOrCreateDefaultNotificationPreferences(userId: string) {
      return this.userNotificationPreferencesStorage.getOrCreateDefaultNotificationPreferences(userId);
    }

    async getUsersWithSchedulingNotifications() {
      return this.userNotificationPreferencesStorage.getUsersWithSchedulingNotifications();
    }

    // ============================================================================
    // PROJECT/COMPANY VIEWS OPERATIONS - ViewsStorage (7 methods)
    // ============================================================================

    async createProjectView(view: any) {
      return this.viewsStorage.createProjectView(view);
    }

    async getProjectViewsByUserId(userId: string) {
      return this.viewsStorage.getProjectViewsByUserId(userId);
    }

    async updateProjectView(id: string, updates: any) {
      return this.viewsStorage.updateProjectView(id, updates);
    }

    async deleteProjectView(id: string) {
      return this.viewsStorage.deleteProjectView(id);
    }

    async createCompanyView(view: any) {
      return this.viewsStorage.createCompanyView(view);
    }

    async getCompanyViewsByUserId(userId: string) {
      return this.viewsStorage.getCompanyViewsByUserId(userId);
    }

    async deleteCompanyView(id: string) {
      return this.viewsStorage.deleteCompanyView(id);
    }

    // ============================================================================
    // SERVICE ASSIGNMENT VIEWS OPERATIONS - ServiceAssignmentStorage (8 methods)
    // ============================================================================

    async createServiceAssignmentView(view: any) {
      return this.serviceAssignmentStorage.createServiceAssignmentView(view);
    }

    async getServiceAssignmentViewsByUserId(userId: string) {
      return this.serviceAssignmentStorage.getServiceAssignmentViewsByUserId(userId);
    }

    async getServiceAssignmentViewById(id: string) {
      return this.serviceAssignmentStorage.getServiceAssignmentViewById(id);
    }

    async deleteServiceAssignmentView(id: string) {
      return this.serviceAssignmentStorage.deleteServiceAssignmentView(id);
    }

    async getServiceAssignmentsWithFilters(filters: any) {
      return this.serviceAssignmentStorage.getServiceAssignmentsWithFilters(filters);
    }

    async getPersonalServiceAssignmentsWithFilters(filters: any) {
      return this.serviceAssignmentStorage.getPersonalServiceAssignmentsWithFilters(filters);
    }

    async bulkReassignRole(params: any) {
      return this.serviceAssignmentStorage.bulkReassignRole(params);
    }

    async bulkUpdateServiceDates(params: any) {
      return this.serviceAssignmentStorage.bulkUpdateServiceDates(params);
    }

    // ============================================================================
    // COLUMN PREFERENCES OPERATIONS - ColumnPreferencesStorage (3 methods)
    // ============================================================================

    async getUserColumnPreferences(userId: string, viewType?: string) {
      return this.columnPreferencesStorage.getUserColumnPreferences(userId, viewType);
    }

    async upsertUserColumnPreferences(preferences: any) {
      return this.columnPreferencesStorage.upsertUserColumnPreferences(preferences);
    }

    async updateUserColumnPreferences(userId: string, viewType: string, preferences: any) {
      return this.columnPreferencesStorage.updateUserColumnPreferences(userId, viewType, preferences);
    }

    // ============================================================================
    // DASHBOARD OPERATIONS - DashboardStorage (8 methods)
    // ============================================================================

    async createDashboard(dashboard: any) {
      return this.dashboardStorage.createDashboard(dashboard);
    }

    async getDashboardsByUserId(userId: string) {
      return this.dashboardStorage.getDashboardsByUserId(userId);
    }

    async getSharedDashboards() {
      return this.dashboardStorage.getSharedDashboards();
    }

    async getDashboardById(id: string) {
      return this.dashboardStorage.getDashboardById(id);
    }

    async updateDashboard(id: string, dashboard: any) {
      return this.dashboardStorage.updateDashboard(id, dashboard);
    }

    async deleteDashboard(id: string) {
      return this.dashboardStorage.deleteDashboard(id);
    }

    async getHomescreenDashboard(userId: string) {
      return this.dashboardStorage.getHomescreenDashboard(userId);
    }

    async clearHomescreenDashboards(userId: string) {
      return this.dashboardStorage.clearHomescreenDashboards(userId);
    }

    // ============================================================================
    // USER PROJECT PREFERENCES OPERATIONS - UserPreferencesStorage (2 methods)
    // ============================================================================

    async getUserProjectPreferences(userId: string) {
      return this.userPreferencesStorage.getUserProjectPreferences(userId);
    }

    async upsertUserProjectPreferences(preferences: any) {
      return this.userPreferencesStorage.upsertUserProjectPreferences(preferences);
    }

    // ============================================================================
    // COMPANY SETTINGS OPERATIONS - CompanySettingsStorage (2 methods)
    // ============================================================================

    async getCompanySettings() {
      return this.companySettingsStorage.getCompanySettings();
    }

    async updateCompanySettings(settings: any) {
      return this.companySettingsStorage.updateCompanySettings(settings);
    }
  };
}
