import type { User } from '@shared/schema';

/**
 * Shared types and interfaces for project storage modules.
 */

/**
 * Helper functions injected for cross-domain dependencies.
 * All sub-storage classes share access to these helpers.
 */
export interface ProjectStorageHelpers {
  getDefaultStage?: () => Promise<any>;
  validateProjectStatus?: (status: string) => Promise<any>;
  getServiceByProjectTypeId?: (projectTypeId: string) => Promise<any>;
  getClientServiceByClientAndProjectType?: (clientId: string, projectTypeId: string) => Promise<any>;
  resolveProjectAssignments?: (clientId: string, projectTypeId: string) => Promise<any>;
  resolveServiceOwner?: (clientId: string, projectTypeId: string) => Promise<any>;
  resolveStageRoleAssignee?: (project: any) => Promise<User | undefined>;
  resolveStageRoleAssigneesBatch?: (projects: any[]) => Promise<Map<string, User | undefined>>;
  validateStageReasonMapping?: (stageId: string, reasonId: string) => Promise<any>;
  validateRequiredFields?: (reasonId: string, fieldResponses: any[]) => Promise<any>;
  getWorkRoleById?: (workRoleId: string) => Promise<any>;
  resolveRoleAssigneeForClient?: (clientId: string, projectTypeId: string, roleName: string) => Promise<any>;
  sendStageChangeNotifications?: (projectId: string, newStatus: string, oldStatus: string) => Promise<void>;
  createProjectMessageThread?: (data: any) => Promise<any>;
  createProjectMessageParticipant?: (data: any) => Promise<any>;
  createProjectMessage?: (data: any) => Promise<any>;
  cancelScheduledNotificationsForProject?: (projectId: string, reason: string) => Promise<void>;
  getProjectTypeByName?: (name: string) => Promise<any>;
  getClientByName?: (name: string) => Promise<any>;
  getUserByEmail?: (email: string) => Promise<any>;
  autoArchiveMessageThreadsByProjectId?: (projectId: string, archivedBy: string) => Promise<number>;
  autoArchiveProjectMessageThreadsByProjectId?: (projectId: string, archivedBy: string) => Promise<number>;
  unarchiveAutoArchivedMessageThreadsByProjectId?: (projectId: string) => Promise<number>;
  unarchiveAutoArchivedProjectMessageThreadsByProjectId?: (projectId: string) => Promise<number>;
}

/**
 * Filter options for project queries.
 */
export interface ProjectQueryFilters {
  month?: string;
  archived?: boolean;
  showArchived?: boolean;
  showCompletedRegardless?: boolean;
  inactive?: boolean;
  serviceId?: string;
  assigneeId?: string;
  serviceOwnerId?: string;
  userId?: string;
  dynamicDateFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  dueDate?: string;
}
