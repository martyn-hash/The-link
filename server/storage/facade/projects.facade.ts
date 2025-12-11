import { db } from '../../db.js';
import { eq } from 'drizzle-orm';
import { projects } from '@shared/schema';
import { 
  ProjectStorage, 
  ProjectChronologyStorage, 
  ProjectTypesStorage, 
  ProjectStagesStorage, 
  ProjectApprovalsStorage,
  ProjectSchedulingStorage,
  ApprovalFieldLibraryStorage,
  ClientApprovalOverrideStorage
} from '../projects/index.js';
import { StageChangeNotificationStorage } from '../notifications/index.js';

export interface ProjectsFacadeDeps {
  projectStorage: ProjectStorage;
  projectChronologyStorage: ProjectChronologyStorage;
  projectTypesStorage: ProjectTypesStorage;
  projectStagesStorage: ProjectStagesStorage;
  projectApprovalsStorage: ProjectApprovalsStorage;
  projectSchedulingStorage: ProjectSchedulingStorage;
  approvalFieldLibraryStorage: ApprovalFieldLibraryStorage;
  clientApprovalOverrideStorage: ClientApprovalOverrideStorage;
  stageChangeNotificationStorage: StageChangeNotificationStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyProjectsFacade<TBase extends Constructor<ProjectsFacadeDeps>>(Base: TBase) {
  return class extends Base {
    // ============================================================================
    // ProjectStorage methods (17 methods)
    // ============================================================================
    
    async createProject(projectData: any) {
      return this.projectStorage.createProject(projectData);
    }

    async getProject(id: string) {
      return this.projectStorage.getProject(id);
    }

    async getProjectById(id: string) {
      return this.projectStorage.getProject(id);
    }

    async getProjectByIdLean(id: string) {
      const [project] = await db.select().from(projects).where(eq(projects.id, id));
      return project;
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

    async getAllProjects(filters?: any) {
      return this.projectStorage.getAllProjects(filters);
    }

    async getProjectsByUser(userId: string, roleFilter?: string, statusFilter?: string) {
      return this.projectStorage.getProjectsByUser(userId, roleFilter || 'all', statusFilter ? { archived: false } : undefined);
    }

    async getProjectsByClient(clientId: string) {
      return this.projectStorage.getProjectsByClient(clientId);
    }

    async getProjectsByClientId(clientId: string) {
      return this.projectStorage.getProjectsByClient(clientId);
    }

    async deleteProject(id: string) {
      return this.projectStorage.deleteProject(id);
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
      return this.stageChangeNotificationStorage.sendBulkProjectAssignmentNotifications(createdProjects);
    }

    async createProjectsFromCSV(projectsData: any[]) {
      return this.projectStorage.createProjectsFromCSV(projectsData);
    }

    // ============================================================================
    // ProjectChronologyStorage methods (7 methods)
    // ============================================================================
    
    async createChronologyEntry(entry: any) {
      return this.projectChronologyStorage.createChronologyEntry(entry);
    }

    async createProjectChronologyEntry(entry: any) {
      return this.projectChronologyStorage.createChronologyEntry(entry);
    }

    async getProjectChronology(projectId: string) {
      return this.projectChronologyStorage.getProjectChronology(projectId);
    }

    async getProjectChronologyByProjectId(projectId: string) {
      return this.projectChronologyStorage.getProjectChronology(projectId);
    }

    async getMostRecentStageChange(projectId: string) {
      return this.projectChronologyStorage.getMostRecentStageChange(projectId);
    }

    async getProjectProgressMetrics(projectId: string) {
      return this.projectChronologyStorage.getProjectProgressMetrics(projectId);
    }

    async logTaskActivityToProject(projectId: string, taskType: string, taskDescription: string, userId?: string) {
      return this.projectChronologyStorage.logTaskActivityToProject(projectId, taskType as 'created' | 'updated' | 'note_added' | 'completed', taskDescription, userId || '');
    }

    // ============================================================================
    // ProjectTypesStorage methods (9 methods)
    // ============================================================================
    
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

    // ============================================================================
    // ProjectStagesStorage methods (28 methods)
    // ============================================================================
    
    // Kanban stages (7 methods)
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

    async reorderKanbanStages(stages: { id: string; order: number }[]) {
      for (const { id, order } of stages) {
        await this.projectStagesStorage.updateKanbanStage(id, { order });
      }
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

    async getStageChangeValidationData(stageId: string, reasonId: string, projectTypeId: string) {
      return this.projectStagesStorage.getStageChangeValidationData(stageId, reasonId, projectTypeId);
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

    // Change reasons (6 methods)
    async getAllChangeReasons() {
      return this.projectStagesStorage.getAllChangeReasons();
    }

    async getChangeReasonById(id: string) {
      const reasons = await this.projectStagesStorage.getAllChangeReasons();
      return reasons.find(r => r.id === id);
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

    // Stage-reason mappings (7 methods)
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

    async deleteStageReasonMapsByStageId(stageId: string) {
      const maps = await this.projectStagesStorage.getStageReasonMapsByStageId(stageId);
      for (const map of maps) {
        await this.projectStagesStorage.deleteStageReasonMap(map.id);
      }
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

    // ============================================================================
    // ProjectApprovalsStorage methods (14 methods)
    // ============================================================================
    
    // Stage approvals (7 methods)
    async getAllStageApprovals() {
      return this.projectApprovalsStorage.getAllStageApprovals();
    }

    async getStageApprovalsByProjectTypeId(projectTypeId: string) {
      return this.projectApprovalsStorage.getStageApprovalsByProjectTypeId(projectTypeId);
    }

    async getStageApprovalsByStageId(stageId: string) {
      return this.projectApprovalsStorage.getStageApprovalsByStageId(stageId);
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

    async getResolvedApprovalFields(approvalId: string) {
      return this.projectApprovalsStorage.getResolvedApprovalFields(approvalId);
    }

    // Stage approval responses (4 methods)
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

    // ============================================================================
    // ApprovalFieldLibraryStorage methods (8 methods)
    // ============================================================================

    async getLibraryFieldsByProjectType(projectTypeId: string) {
      return this.approvalFieldLibraryStorage.getLibraryFieldsByProjectType(projectTypeId);
    }

    async getLibraryFieldById(id: string) {
      return this.approvalFieldLibraryStorage.getLibraryFieldById(id);
    }

    async createLibraryField(field: any) {
      return this.approvalFieldLibraryStorage.createLibraryField(field);
    }

    async updateLibraryField(id: string, updates: any) {
      return this.approvalFieldLibraryStorage.updateLibraryField(id, updates);
    }

    async deleteLibraryField(id: string) {
      return this.approvalFieldLibraryStorage.deleteLibraryField(id);
    }

    async getLibraryFieldUsageCount(id: string) {
      return this.approvalFieldLibraryStorage.getLibraryFieldUsageCount(id);
    }

    async getApprovalsUsingLibraryField(id: string) {
      return this.approvalFieldLibraryStorage.getApprovalsUsingLibraryField(id);
    }

    async getLibraryFieldsWithUsage(projectTypeId: string) {
      return this.approvalFieldLibraryStorage.getLibraryFieldsWithUsage(projectTypeId);
    }

    // ============================================================================
    // ClientApprovalOverrideStorage methods (8 methods)
    // ============================================================================

    async getClientOverride(clientId: string, projectTypeId: string, stageId: string) {
      return this.clientApprovalOverrideStorage.getClientOverride(clientId, projectTypeId, stageId);
    }

    async getOverridesByClient(clientId: string) {
      return this.clientApprovalOverrideStorage.getOverridesByClient(clientId);
    }

    async getOverridesByProjectType(projectTypeId: string) {
      return this.clientApprovalOverrideStorage.getOverridesByProjectType(projectTypeId);
    }

    async createClientApprovalOverride(override: any) {
      return this.clientApprovalOverrideStorage.createOverride(override);
    }

    async updateClientApprovalOverride(id: string, updates: any) {
      return this.clientApprovalOverrideStorage.updateOverride(id, updates);
    }

    async deleteClientApprovalOverride(id: string) {
      return this.clientApprovalOverrideStorage.deleteOverride(id);
    }

    async getClientOverridesForProject(clientId: string, projectTypeId: string) {
      return this.clientApprovalOverrideStorage.getClientOverridesForProject(clientId, projectTypeId);
    }

    async getClientApprovalOverrideById(id: string) {
      return this.clientApprovalOverrideStorage.getOverrideById(id);
    }
  };
}
