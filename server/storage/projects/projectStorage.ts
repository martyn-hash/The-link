import type {
  Project,
  InsertProject,
  ProjectWithRelations,
  UpdateProjectStatus,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';
import { ProjectCrudStorage } from './projectCrudStorage.js';
import { ProjectQueryStorage } from './projectQueryStorage.js';
import { ProjectStatusStorage } from './projectStatusStorage.js';
import { ProjectAnalyticsStorage } from './projectAnalyticsStorage.js';
import { ProjectBulkStorage } from './projectBulkStorage.js';
import type { ProjectStorageHelpers, ProjectQueryFilters } from './types.js';

/**
 * Storage class for core project operations.
 * 
 * Handles:
 * - Project CRUD operations
 * - Project filtering and querying
 * - Project status updates
 * - Project analytics
 * - Bulk operations (CSV import, notifications)
 */
export class ProjectStorage extends BaseStorage {
  // Helper references (will be injected by facade)
  private projectHelpers: ProjectStorageHelpers = {};
  
  // Delegated sub-storage instances
  private crudStorage: ProjectCrudStorage;
  private queryStorage: ProjectQueryStorage;
  private statusStorage: ProjectStatusStorage;
  private analyticsStorage: ProjectAnalyticsStorage;
  private bulkStorage: ProjectBulkStorage;
  
  // Cache for recent notifications to prevent duplicates (shared with bulkStorage)
  private recentNotifications = new Map<string, number>();

  constructor() {
    super();
    this.crudStorage = new ProjectCrudStorage(this.projectHelpers);
    this.queryStorage = new ProjectQueryStorage(this.projectHelpers);
    this.statusStorage = new ProjectStatusStorage(this.projectHelpers, this.getProject.bind(this));
    this.analyticsStorage = new ProjectAnalyticsStorage(this.projectHelpers);
    this.bulkStorage = new ProjectBulkStorage(this.projectHelpers, this.recentNotifications);
  }

  /**
   * Register helper methods for cross-domain dependencies
   */
  registerProjectHelpers(helpers: ProjectStorageHelpers) {
    this.projectHelpers = { ...this.projectHelpers, ...helpers };
    // Re-create sub-storage instances with updated helpers
    this.crudStorage = new ProjectCrudStorage(this.projectHelpers);
    this.queryStorage = new ProjectQueryStorage(this.projectHelpers);
    this.statusStorage = new ProjectStatusStorage(this.projectHelpers, this.getProject.bind(this));
    this.analyticsStorage = new ProjectAnalyticsStorage(this.projectHelpers);
    this.bulkStorage = new ProjectBulkStorage(this.projectHelpers, this.recentNotifications);
  }
  
  // ==================== Delegated CRUD Operations ====================
  
  createProject = (projectData: InsertProject): Promise<Project> => 
    this.crudStorage.createProject(projectData);
  
  getProject = (id: string): Promise<ProjectWithRelations | undefined> => 
    this.crudStorage.getProject(id);
  
  updateProject = (id: string, updateData: Partial<InsertProject>): Promise<Project> => 
    this.crudStorage.updateProject(id, updateData);
  
  deleteProject = (id: string): Promise<void> => 
    this.crudStorage.deleteProject(id);
  
  getActiveProjectsByClientAndType = (clientId: string, projectTypeId: string): Promise<Project[]> => 
    this.crudStorage.getActiveProjectsByClientAndType(clientId, projectTypeId);
  
  getUniqueDueDatesForService = (serviceId: string): Promise<string[]> => 
    this.crudStorage.getUniqueDueDatesForService(serviceId);

  // ==================== Delegated Query Operations ====================
  
  getAllProjects = (filters?: ProjectQueryFilters): Promise<ProjectWithRelations[]> => 
    this.queryStorage.getAllProjects(filters);
  
  getProjectsByUser = (userId: string, role: string, filters?: ProjectQueryFilters): Promise<ProjectWithRelations[]> => 
    this.queryStorage.getProjectsByUser(userId, role, filters);
  
  getProjectsByClient = (clientId: string, filters?: ProjectQueryFilters): Promise<ProjectWithRelations[]> => 
    this.queryStorage.getProjectsByClient(clientId, filters);
  
  getProjectsByClientServiceId = (clientServiceId: string): Promise<ProjectWithRelations[]> => 
    this.queryStorage.getProjectsByClientServiceId(clientServiceId);

  // ==================== Delegated Status Operations ====================
  
  updateProjectStatus = (update: UpdateProjectStatus, userId: string): Promise<Project> =>
    this.statusStorage.updateProjectStatus(update, userId);

  // ==================== Delegated Analytics Operations ====================
  
  getProjectAnalytics = (filters: any, groupBy: string, metric?: string): Promise<{ label: string; value: number }[]> =>
    this.analyticsStorage.getProjectAnalytics(filters, groupBy, metric);

  // ==================== Delegated Bulk Operations ====================
  
  sendBulkProjectAssignmentNotifications = (createdProjects: Project[]): Promise<void> =>
    this.bulkStorage.sendBulkProjectAssignmentNotifications(createdProjects);
  
  createProjectsFromCSV = (projectsData: any[]): Promise<{
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
  }> => this.bulkStorage.createProjectsFromCSV(projectsData);
}
