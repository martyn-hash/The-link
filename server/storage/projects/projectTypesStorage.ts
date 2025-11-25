import { db } from '../../db.js';
import {
  projectTypes,
  projects,
  kanbanStages,
  changeReasons,
  stageReasonMaps,
  stageApprovals,
  stageApprovalFields,
  reasonCustomFields,
  reasonFieldResponses,
  stageApprovalResponses,
  projectChronology,
} from '@shared/schema';
import { eq, sql, inArray, or, and } from 'drizzle-orm';
import type {
  ProjectType,
  InsertProjectType,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';

/**
 * Storage class for project type operations.
 * 
 * Handles:
 * - Project type CRUD operations
 * - Project type dependencies and validation
 * - Force delete with cascade
 */
export class ProjectTypesStorage extends BaseStorage {
  /**
   * Get all project types
   */
  async getAllProjectTypes(): Promise<ProjectType[]> {
    return await db.select().from(projectTypes).orderBy(projectTypes.name);
  }

  /**
   * Get project type by ID
   */
  async getProjectTypeById(id: string): Promise<ProjectType | undefined> {
    const [projectType] = await db.select().from(projectTypes).where(eq(projectTypes.id, id));
    return projectType;
  }

  /**
   * Create a new project type
   */
  async createProjectType(projectType: InsertProjectType): Promise<ProjectType> {
    const result = await db.insert(projectTypes).values(projectType).returning();
    const [newProjectType] = result as any[];
    return newProjectType;
  }

  /**
   * Update a project type
   */
  async updateProjectType(id: string, projectType: Partial<InsertProjectType>): Promise<ProjectType> {
    const [updatedDescription] = await db
      .update(projectTypes)
      .set(projectType)
      .where(eq(projectTypes.id, id))
      .returning();
      
    if (!updatedDescription) {
      throw new Error("Project description not found");
    }
    
    return updatedDescription;
  }

  /**
   * Delete a project type (with validation)
   */
  async deleteProjectType(id: string): Promise<void> {
    // Check if the project type exists
    const projectType = await this.getProjectTypeById(id);
    if (!projectType) {
      throw new Error("Project type not found");
    }

    // Check for active projects using this project type
    const activeProjectCount = await this.countActiveProjectsUsingProjectType(id);
    if (activeProjectCount > 0) {
      throw new Error(`Cannot delete project type '${projectType.name}' because ${activeProjectCount} active project${activeProjectCount > 1 ? 's are' : ' is'} currently using this project type. Please archive or reassign these projects first.`);
    }

    // Check for archived/inactive projects using this project type
    const allProjectCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.projectTypeId, id));
    const totalProjects = allProjectCount[0]?.count || 0;
    
    if (totalProjects > 0) {
      throw new Error(`Cannot delete project type '${projectType.name}' because ${totalProjects} project${totalProjects > 1 ? 's are' : ' is'} still linked to this project type (including archived/inactive projects). Please reassign or delete these projects first.`);
    }

    // Check for kanban stages using this project type
    const stagesCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(kanbanStages)
      .where(eq(kanbanStages.projectTypeId, id));
    const totalStages = stagesCount[0]?.count || 0;
    
    if (totalStages > 0) {
      throw new Error(`Cannot delete project type '${projectType.name}' because ${totalStages} kanban stage${totalStages > 1 ? 's are' : ' is'} linked to this project type. Please delete or reassign these stages first.`);
    }

    // Check for change reasons using this project type
    const reasonsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(changeReasons)
      .where(eq(changeReasons.projectTypeId, id));
    const totalReasons = reasonsCount[0]?.count || 0;
    
    if (totalReasons > 0) {
      throw new Error(`Cannot delete project type '${projectType.name}' because ${totalReasons} change reason${totalReasons > 1 ? 's are' : ' is'} linked to this project type. Please delete or reassign these change reasons first.`);
    }

    // All checks passed, safe to delete
    const result = await db.delete(projectTypes).where(eq(projectTypes.id, id));
    if (result.rowCount === 0) {
      throw new Error("Project type not found");
    }
  }

  /**
   * Get project type by name (helper method)
   */
  async getProjectTypeByName(name: string): Promise<ProjectType | undefined> {
    const [projectType] = await db.select().from(projectTypes).where(eq(projectTypes.name, name));
    return projectType;
  }

  /**
   * Count active projects using a specific project type
   */
  async countActiveProjectsUsingProjectType(projectTypeId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(
        and(
          eq(projects.projectTypeId, projectTypeId),
          eq(projects.archived, false),
          eq(projects.inactive, false)
        )
      );
    return result[0]?.count || 0;
  }

  /**
   * Get comprehensive dependency summary for a project type
   */
  async getProjectTypeDependencySummary(projectTypeId: string): Promise<{
    projects: number;
    chronologyEntries: number;
    kanbanStages: number;
    changeReasons: number;
    stageReasonMaps: number;
    stageApprovals: number;
    stageApprovalFields: number;
    reasonCustomFields: number;
    reasonFieldResponses: number;
    stageApprovalResponses: number;
  }> {
    // Get all related projects
    const projectsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.projectTypeId, projectTypeId));
    const projectsCount = projectsResult[0]?.count || 0;

    // Get project IDs for further queries
    const projectIds = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.projectTypeId, projectTypeId));
    const projectIdList = projectIds.map(p => p.id);

    // Get chronology entries for these projects
    let chronologyCount = 0;
    if (projectIdList.length > 0) {
      const chronologyResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(projectChronology)
        .where(inArray(projectChronology.projectId, projectIdList));
      chronologyCount = chronologyResult[0]?.count || 0;
    }

    // Get kanban stages for this project type
    const stagesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(kanbanStages)
      .where(eq(kanbanStages.projectTypeId, projectTypeId));
    const stagesCount = stagesResult[0]?.count || 0;

    // Get stage IDs for further queries
    const stageIds = await db
      .select({ id: kanbanStages.id })
      .from(kanbanStages)
      .where(eq(kanbanStages.projectTypeId, projectTypeId));
    const stageIdList = stageIds.map(s => s.id);

    // Get change reasons for this project type
    const reasonsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(changeReasons)
      .where(eq(changeReasons.projectTypeId, projectTypeId));
    const reasonsCount = reasonsResult[0]?.count || 0;

    // Get reason IDs for further queries
    const reasonIds = await db
      .select({ id: changeReasons.id })
      .from(changeReasons)
      .where(eq(changeReasons.projectTypeId, projectTypeId));
    const reasonIdList = reasonIds.map(r => r.id);

    // Get stage-reason mappings
    let stageMapsCount = 0;
    if (stageIdList.length > 0 || reasonIdList.length > 0) {
      const conditions = [];
      if (stageIdList.length > 0) {
        conditions.push(inArray(stageReasonMaps.stageId, stageIdList));
      }
      if (reasonIdList.length > 0) {
        conditions.push(inArray(stageReasonMaps.reasonId, reasonIdList));
      }
      
      if (conditions.length > 0) {
        const stageMapsResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(stageReasonMaps)
          .where(or(...conditions));
        stageMapsCount = stageMapsResult[0]?.count || 0;
      }
    }

    // Get stage approvals for this project type
    const approvalsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(stageApprovals)
      .where(eq(stageApprovals.projectTypeId, projectTypeId));
    const approvalsCount = approvalsResult[0]?.count || 0;

    // Get approval IDs for further queries
    const approvalIds = await db
      .select({ id: stageApprovals.id })
      .from(stageApprovals)
      .where(eq(stageApprovals.projectTypeId, projectTypeId));
    const approvalIdList = approvalIds.map(a => a.id);

    // Get stage approval fields
    let approvalFieldsCount = 0;
    if (approvalIdList.length > 0) {
      const fieldsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(stageApprovalFields)
        .where(inArray(stageApprovalFields.stageApprovalId, approvalIdList));
      approvalFieldsCount = fieldsResult[0]?.count || 0;
    }

    // Get reason custom fields
    let customFieldsCount = 0;
    if (reasonIdList.length > 0) {
      const customFieldsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(reasonCustomFields)
        .where(inArray(reasonCustomFields.reasonId, reasonIdList));
      customFieldsCount = customFieldsResult[0]?.count || 0;
    }

    // Get custom field IDs for field responses
    let customFieldIds: string[] = [];
    if (reasonIdList.length > 0) {
      const fieldIds = await db
        .select({ id: reasonCustomFields.id })
        .from(reasonCustomFields)
        .where(inArray(reasonCustomFields.reasonId, reasonIdList));
      customFieldIds = fieldIds.map(f => f.id);
    }

    // Get chronology IDs for field responses
    let chronologyIds: string[] = [];
    if (projectIdList.length > 0) {
      const chronIds = await db
        .select({ id: projectChronology.id })
        .from(projectChronology)
        .where(inArray(projectChronology.projectId, projectIdList));
      chronologyIds = chronIds.map(c => c.id);
    }

    // Get reason field responses
    let fieldResponsesCount = 0;
    if (customFieldIds.length > 0 || chronologyIds.length > 0) {
      const conditions = [];
      if (customFieldIds.length > 0) {
        conditions.push(inArray(reasonFieldResponses.customFieldId, customFieldIds));
      }
      if (chronologyIds.length > 0) {
        conditions.push(inArray(reasonFieldResponses.chronologyId, chronologyIds));
      }
      
      if (conditions.length > 0) {
        const responsesResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(reasonFieldResponses)
          .where(or(...conditions));
        fieldResponsesCount = responsesResult[0]?.count || 0;
      }
    }

    // Get stage approval responses
    let approvalResponsesCount = 0;
    if (projectIdList.length > 0) {
      const responsesResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(stageApprovalResponses)
        .where(inArray(stageApprovalResponses.projectId, projectIdList));
      approvalResponsesCount = responsesResult[0]?.count || 0;
    }

    return {
      projects: projectsCount,
      chronologyEntries: chronologyCount,
      kanbanStages: stagesCount,
      changeReasons: reasonsCount,
      stageReasonMaps: stageMapsCount,
      stageApprovals: approvalsCount,
      stageApprovalFields: approvalFieldsCount,
      reasonCustomFields: customFieldsCount,
      reasonFieldResponses: fieldResponsesCount,
      stageApprovalResponses: approvalResponsesCount,
    };
  }

  /**
   * Force delete a project type with all cascading dependencies
   */
  async forceDeleteProjectType(projectTypeId: string, confirmName: string): Promise<{
    projects: number;
    chronologyEntries: number;
    kanbanStages: number;
    changeReasons: number;
    stageReasonMaps: number;
    stageApprovals: number;
    stageApprovalFields: number;
    reasonCustomFields: number;
    reasonFieldResponses: number;
    stageApprovalResponses: number;
    message: string;
  }> {
    // Verify project type exists and name matches
    const projectType = await this.getProjectTypeById(projectTypeId);
    if (!projectType) {
      throw new Error("Project type not found");
    }

    if (projectType.name !== confirmName) {
      throw new Error("Project type name confirmation does not match");
    }

    // Get counts before deletion for reporting
    const summary = await this.getProjectTypeDependencySummary(projectTypeId);

    // Perform cascade deletion in a transaction
    return await db.transaction(async (tx) => {
      // Get all related IDs we'll need for deletion
      const projectIds = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.projectTypeId, projectTypeId));
      const projectIdList = projectIds.map(p => p.id);

      const stageIds = await tx
        .select({ id: kanbanStages.id })
        .from(kanbanStages)
        .where(eq(kanbanStages.projectTypeId, projectTypeId));
      const stageIdList = stageIds.map(s => s.id);

      const reasonIds = await tx
        .select({ id: changeReasons.id })
        .from(changeReasons)
        .where(eq(changeReasons.projectTypeId, projectTypeId));
      const reasonIdList = reasonIds.map(r => r.id);

      const approvalIds = await tx
        .select({ id: stageApprovals.id })
        .from(stageApprovals)
        .where(eq(stageApprovals.projectTypeId, projectTypeId));
      const approvalIdList = approvalIds.map(a => a.id);

      const customFieldIds = reasonIdList.length > 0 ? await tx
        .select({ id: reasonCustomFields.id })
        .from(reasonCustomFields)
        .where(inArray(reasonCustomFields.reasonId, reasonIdList)) : [];
      const customFieldIdList = customFieldIds.map(f => f.id);

      const chronologyIds = projectIdList.length > 0 ? await tx
        .select({ id: projectChronology.id })
        .from(projectChronology)
        .where(inArray(projectChronology.projectId, projectIdList)) : [];
      const chronologyIdList = chronologyIds.map(c => c.id);

      // Delete in the correct order to avoid FK violations

      // 1. Delete reason field responses (depends on custom fields and chronology)
      if (customFieldIdList.length > 0) {
        await tx.delete(reasonFieldResponses)
          .where(inArray(reasonFieldResponses.customFieldId, customFieldIdList));
      }
      if (chronologyIdList.length > 0) {
        await tx.delete(reasonFieldResponses)
          .where(inArray(reasonFieldResponses.chronologyId, chronologyIdList));
      }

      // 2. Delete stage approval responses (depends on projects)
      if (projectIdList.length > 0) {
        await tx.delete(stageApprovalResponses)
          .where(inArray(stageApprovalResponses.projectId, projectIdList));
      }

      // 3. Delete project chronology (depends on projects)
      if (projectIdList.length > 0) {
        await tx.delete(projectChronology)
          .where(inArray(projectChronology.projectId, projectIdList));
      }

      // 4. Delete projects
      if (projectIdList.length > 0) {
        await tx.delete(projects)
          .where(inArray(projects.id, projectIdList));
      }

      // 5. Delete stage-reason mappings (depends on stages and reasons)
      if (stageIdList.length > 0) {
        await tx.delete(stageReasonMaps)
          .where(inArray(stageReasonMaps.stageId, stageIdList));
      }
      if (reasonIdList.length > 0) {
        await tx.delete(stageReasonMaps)
          .where(inArray(stageReasonMaps.reasonId, reasonIdList));
      }

      // 6. Delete stage approval fields (depends on stage approvals)
      if (approvalIdList.length > 0) {
        await tx.delete(stageApprovalFields)
          .where(inArray(stageApprovalFields.stageApprovalId, approvalIdList));
      }

      // 7. Delete stage approvals (depends on project type)
      await tx.delete(stageApprovals)
        .where(eq(stageApprovals.projectTypeId, projectTypeId));

      // 8. Delete reason custom fields (depends on reasons)
      if (reasonIdList.length > 0) {
        await tx.delete(reasonCustomFields)
          .where(inArray(reasonCustomFields.reasonId, reasonIdList));
      }

      // 9. Delete change reasons (depends on project type)
      await tx.delete(changeReasons)
        .where(eq(changeReasons.projectTypeId, projectTypeId));

      // 10. Delete kanban stages (depends on project type)
      await tx.delete(kanbanStages)
        .where(eq(kanbanStages.projectTypeId, projectTypeId));

      // 11. Finally, delete the project type itself
      await tx.delete(projectTypes)
        .where(eq(projectTypes.id, projectTypeId));

      return {
        ...summary,
        message: `Successfully deleted project type '${projectType.name}' and all ${summary.projects + summary.chronologyEntries + summary.kanbanStages + summary.changeReasons + summary.stageReasonMaps + summary.stageApprovals + summary.stageApprovalFields + summary.reasonCustomFields + summary.reasonFieldResponses + summary.stageApprovalResponses} related records.`
      };
    });
  }
}

// Export helper function for use by other modules
export function getProjectTypeByName(storage: ProjectTypesStorage) {
  return (name: string) => storage.getProjectTypeByName(name);
}
