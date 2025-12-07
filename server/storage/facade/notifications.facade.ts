import {
  ProjectTypeNotificationStorage,
  ClientReminderStorage,
  ScheduledNotificationStorage,
  NotificationHistoryStorage,
  StageChangeNotificationStorage
} from '../notifications/index.js';

export interface NotificationsFacadeDeps {
  projectTypeNotificationStorage: ProjectTypeNotificationStorage;
  clientReminderStorage: ClientReminderStorage;
  scheduledNotificationStorage: ScheduledNotificationStorage;
  notificationHistoryStorage: NotificationHistoryStorage;
  stageChangeNotificationStorage: StageChangeNotificationStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyNotificationsFacade<TBase extends Constructor<NotificationsFacadeDeps>>(Base: TBase) {
  return class extends Base {
    // ============================================================================
    // PROJECT TYPE NOTIFICATION OPERATIONS - ProjectTypeNotificationStorage (6 methods)
    // ============================================================================

    async getProjectTypeNotificationsByProjectTypeId(projectTypeId: string) {
      return this.projectTypeNotificationStorage.getProjectTypeNotificationsByProjectTypeId(projectTypeId);
    }

    async getProjectTypeNotificationById(id: string) {
      return this.projectTypeNotificationStorage.getProjectTypeNotificationById(id);
    }

    async createProjectTypeNotification(notification: any) {
      return this.projectTypeNotificationStorage.createProjectTypeNotification(notification);
    }

    async updateProjectTypeNotification(id: string, notification: any) {
      return this.projectTypeNotificationStorage.updateProjectTypeNotification(id, notification);
    }

    async deleteProjectTypeNotification(id: string) {
      return this.projectTypeNotificationStorage.deleteProjectTypeNotification(id);
    }

    async getPreviewCandidates(projectTypeId: string, notification: any) {
      return this.projectTypeNotificationStorage.getPreviewCandidates(projectTypeId, notification);
    }

    // ============================================================================
    // CLIENT REQUEST REMINDER OPERATIONS - ClientReminderStorage (5 methods)
    // ============================================================================

    async getClientRequestRemindersByNotificationId(notificationId: string) {
      return this.clientReminderStorage.getClientRequestRemindersByNotificationId(notificationId);
    }

    async getClientRequestReminderById(id: string) {
      return this.clientReminderStorage.getClientRequestReminderById(id);
    }

    async createClientRequestReminder(reminder: any) {
      return this.clientReminderStorage.createClientRequestReminder(reminder);
    }

    async updateClientRequestReminder(id: string, reminder: any) {
      return this.clientReminderStorage.updateClientRequestReminder(id, reminder);
    }

    async deleteClientRequestReminder(id: string) {
      return this.clientReminderStorage.deleteClientRequestReminder(id);
    }

    // ============================================================================
    // SCHEDULED NOTIFICATION OPERATIONS - ScheduledNotificationStorage (5 methods)
    // ============================================================================

    async getAllScheduledNotifications() {
      return this.scheduledNotificationStorage.getAllScheduledNotifications();
    }

    async getScheduledNotificationById(id: string) {
      return this.scheduledNotificationStorage.getScheduledNotificationById(id);
    }

    async getScheduledNotificationsForClient(clientId: string, filters?: any) {
      return this.scheduledNotificationStorage.getScheduledNotificationsForClient(clientId, filters);
    }

    async updateScheduledNotification(id: string, notification: any) {
      return this.scheduledNotificationStorage.updateScheduledNotification(id, notification);
    }

    async cancelScheduledNotificationsForProject(projectId: string, reason: string) {
      return this.scheduledNotificationStorage.cancelScheduledNotificationsForProject(projectId, reason);
    }

    // ============================================================================
    // NOTIFICATION HISTORY OPERATIONS - NotificationHistoryStorage (2 methods)
    // ============================================================================

    async getNotificationHistoryByClientId(clientId: string) {
      return this.notificationHistoryStorage.getNotificationHistoryByClientId(clientId);
    }

    async getNotificationHistoryByProjectId(projectId: string) {
      return this.notificationHistoryStorage.getNotificationHistoryByProjectId(projectId);
    }

    // ============================================================================
    // STAGE CHANGE NOTIFICATION OPERATIONS - StageChangeNotificationStorage (3 methods)
    // ============================================================================

    async prepareStageChangeNotification(projectId: string, newStageName: string, oldStageName?: string) {
      return this.stageChangeNotificationStorage.prepareStageChangeNotification(projectId, newStageName, oldStageName);
    }

    async sendStageChangeNotifications(projectId: string, newStageName: string, oldStageName?: string) {
      return this.stageChangeNotificationStorage.sendStageChangeNotifications(projectId, newStageName, oldStageName);
    }

    async prepareClientValueNotification(projectId: string, newStageName: string, sendingUserId: string, oldStageName?: string) {
      return this.stageChangeNotificationStorage.prepareClientValueNotification(projectId, newStageName, sendingUserId, oldStageName);
    }
  };
}
