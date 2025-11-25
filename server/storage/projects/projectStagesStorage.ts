import { db } from '../../db.js';
import {
  kanbanStages,
  changeReasons,
  stageReasonMaps,
  reasonCustomFields,
  reasonFieldResponses,
  projects,
  projectTypes,
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import type {
  KanbanStage,
  InsertKanbanStage,
  ChangeReason,
  InsertChangeReason,
  StageReasonMap,
  InsertStageReasonMap,
  ReasonCustomField,
  InsertReasonCustomField,
  ReasonFieldResponse,
  InsertReasonFieldResponse,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';

/**
 * Storage class for project stage configuration operations.
 * 
 * Handles:
 * - Kanban stage CRUD and validation
 * - Change reason management
 * - Stage-reason mappings
 * - Custom fields and field responses
 */
export class ProjectStagesStorage extends BaseStorage {
  // ============================================
  // KANBAN STAGES (6 methods)
  // ============================================
  
  /**
   * Get all kanban stages
   */
  async getAllKanbanStages(): Promise<KanbanStage[]> {
    return await db.select().from(kanbanStages).orderBy(kanbanStages.order);
  }

  /**
   * Get kanban stages by project type ID
   */
  async getKanbanStagesByProjectTypeId(projectTypeId: string): Promise<KanbanStage[]> {
    // Validate projectTypeId to prevent undefined/null being passed to query builder
    if (!projectTypeId || projectTypeId.trim() === '') {
      console.warn(`[Storage] getKanbanStagesByProjectTypeId called with invalid projectTypeId: "${projectTypeId}"`);
      return [];
    }
    
    return await db
      .select()
      .from(kanbanStages)
      .where(eq(kanbanStages.projectTypeId, projectTypeId))
      .orderBy(kanbanStages.order);
  }

  /**
   * Get kanban stages by service ID
   */
  async getKanbanStagesByServiceId(serviceId: string): Promise<KanbanStage[]> {
    if (!serviceId || serviceId.trim() === '') {
      console.warn(`[Storage] getKanbanStagesByServiceId called with invalid serviceId: "${serviceId}"`);
      return [];
    }

    // Get kanban stages via project_types.service_id relationship
    const stages = await db
      .select({ stage: kanbanStages })
      .from(kanbanStages)
      .innerJoin(projectTypes, eq(kanbanStages.projectTypeId, projectTypes.id))
      .where(eq(projectTypes.serviceId, serviceId))
      .orderBy(kanbanStages.order);

    return stages.map(s => s.stage);
  }

  /**
   * Create a new kanban stage
   */
  async createKanbanStage(stage: InsertKanbanStage): Promise<KanbanStage> {
    const [newStage] = await db.insert(kanbanStages).values(stage).returning();
    return newStage;
  }

  /**
   * Update a kanban stage
   */
  async updateKanbanStage(id: string, stage: Partial<InsertKanbanStage>): Promise<KanbanStage> {
    // If name is being changed, validate that the stage can be renamed
    if (stage.name) {
      const validation = await this.validateStageCanBeRenamed(id, stage.name);
      if (!validation.canRename) {
        throw new Error(validation.reason || "Stage cannot be renamed");
      }
    }
    
    const [updatedStage] = await db
      .update(kanbanStages)
      .set(stage)
      .where(eq(kanbanStages.id, id))
      .returning();
      
    if (!updatedStage) {
      throw new Error("Stage not found");
    }
    
    return updatedStage;
  }

  /**
   * Delete a kanban stage
   */
  async deleteKanbanStage(id: string): Promise<void> {
    // Validate that the stage can be deleted
    const validation = await this.validateStageCanBeDeleted(id);
    if (!validation.canDelete) {
      throw new Error(validation.reason || "Stage cannot be deleted");
    }
    
    await db.delete(kanbanStages).where(eq(kanbanStages.id, id));
  }
  
  // ============================================
  // STAGE VALIDATION (7 methods)
  // ============================================
  
  /**
   * Check if a stage name is currently in use by any project
   */
  async isStageNameInUse(stageName: string): Promise<boolean> {
    const [project] = await db.select().from(projects).where(eq(projects.currentStatus, stageName)).limit(1);
    return !!project;
  }
  
  /**
   * Validate a project status against existing stages
   */
  async validateProjectStatus(status: string): Promise<{ isValid: boolean; reason?: string }> {
    // Check if the status matches an existing stage
    const [stage] = await db.select().from(kanbanStages).where(eq(kanbanStages.name, status));
    if (!stage) {
      return { isValid: false, reason: `Invalid project status '${status}'. Status must match an existing kanban stage.` };
    }
    return { isValid: true };
  }
  
  /**
   * Get stage by ID
   */
  async getStageById(id: string): Promise<KanbanStage | undefined> {
    const [stage] = await db.select().from(kanbanStages).where(eq(kanbanStages.id, id));
    return stage;
  }
  
  /**
   * Validate if a stage can be deleted
   */
  async validateStageCanBeDeleted(id: string): Promise<{ canDelete: boolean; reason?: string; projectCount?: number }> {
    // First check if the stage exists
    const stage = await this.getStageById(id);
    if (!stage) {
      return { canDelete: false, reason: "Stage not found" };
    }
    
    // Check if any projects are using this stage
    const projectsUsingStage = await db.select().from(projects).where(eq(projects.currentStatus, stage.name));
    const projectCount = projectsUsingStage.length;
    
    if (projectCount > 0) {
      return { 
        canDelete: false, 
        reason: `Cannot delete stage '${stage.name}' because ${projectCount} project${projectCount > 1 ? 's' : ''} ${projectCount > 1 ? 'are' : 'is'} currently assigned to this stage`, 
        projectCount 
      };
    }
    
    return { canDelete: true };
  }
  
  /**
   * Validate if a stage can be renamed
   */
  async validateStageCanBeRenamed(id: string, newName: string): Promise<{ canRename: boolean; reason?: string; projectCount?: number }> {
    // First check if the stage exists
    const stage = await this.getStageById(id);
    if (!stage) {
      return { canRename: false, reason: "Stage not found" };
    }
    
    // If the name isn't actually changing, allow it
    if (stage.name === newName) {
      return { canRename: true };
    }
    
    // Check if any projects are using this stage
    const projectsUsingStage = await db.select().from(projects).where(eq(projects.currentStatus, stage.name));
    const projectCount = projectsUsingStage.length;
    
    if (projectCount > 0) {
      return { 
        canRename: false, 
        reason: `Cannot rename stage '${stage.name}' because ${projectCount} project${projectCount > 1 ? 's' : ''} ${projectCount > 1 ? 'are' : 'is'} currently assigned to this stage. Renaming would orphan these projects.`, 
        projectCount 
      };
    }
    
    return { canRename: true };
  }
  
  /**
   * Get the default stage (first stage by order)
   */
  async getDefaultStage(): Promise<KanbanStage | undefined> {
    // Get the first stage by order (lowest order number)
    const [defaultStage] = await db.select().from(kanbanStages).orderBy(kanbanStages.order).limit(1);
    return defaultStage;
  }

  // ============================================
  // CHANGE REASONS (5 methods)
  // ============================================

  /**
   * Get all change reasons
   */
  async getAllChangeReasons(): Promise<ChangeReason[]> {
    return await db.select().from(changeReasons);
  }

  /**
   * Get change reasons by project type ID
   */
  async getChangeReasonsByProjectTypeId(projectTypeId: string): Promise<ChangeReason[]> {
    return await db
      .select()
      .from(changeReasons)
      .where(eq(changeReasons.projectTypeId, projectTypeId));
  }

  /**
   * Create a new change reason
   */
  async createChangeReason(reason: InsertChangeReason): Promise<ChangeReason> {
    const [newReason] = await db.insert(changeReasons).values(reason).returning();
    return newReason;
  }

  /**
   * Update a change reason
   */
  async updateChangeReason(id: string, reason: Partial<InsertChangeReason>): Promise<ChangeReason> {
    const [updatedReason] = await db
      .update(changeReasons)
      .set(reason)
      .where(eq(changeReasons.id, id))
      .returning();
    return updatedReason;
  }

  /**
   * Delete a change reason
   */
  async deleteChangeReason(id: string): Promise<void> {
    await db.delete(changeReasons).where(eq(changeReasons.id, id));
  }

  // ============================================
  // STAGE-REASON MAPPINGS (6 methods)
  // ============================================

  /**
   * Get all stage-reason mappings
   */
  async getAllStageReasonMaps(): Promise<StageReasonMap[]> {
    return await db.query.stageReasonMaps.findMany({
      with: {
        stage: true,
        reason: true,
      },
    });
  }

  /**
   * Create a new stage-reason mapping
   */
  async createStageReasonMap(mapping: InsertStageReasonMap): Promise<StageReasonMap> {
    const [newMapping] = await db.insert(stageReasonMaps).values(mapping).returning();
    return newMapping;
  }

  /**
   * Get stage-reason mappings by stage ID
   */
  async getStageReasonMapsByStageId(stageId: string): Promise<StageReasonMap[]> {
    return await db.query.stageReasonMaps.findMany({
      where: eq(stageReasonMaps.stageId, stageId),
      with: {
        reason: true,
      },
    });
  }

  /**
   * Delete a stage-reason mapping
   */
  async deleteStageReasonMap(id: string): Promise<void> {
    const result = await db.delete(stageReasonMaps).where(eq(stageReasonMaps.id, id));
    if (result.rowCount === 0) {
      throw new Error("Stage-reason mapping not found");
    }
  }

  /**
   * Validate a stage-reason mapping (helper method)
   */
  async validateStageReasonMapping(stageId: string, reasonId: string): Promise<{ isValid: boolean; reason?: string }> {
    // Check if the stage exists
    const stage = await this.getStageById(stageId);
    if (!stage) {
      return { isValid: false, reason: "Stage not found" };
    }

    // Check if the reason exists
    const [reason] = await db.select().from(changeReasons).where(eq(changeReasons.id, reasonId));
    if (!reason) {
      return { isValid: false, reason: "Change reason not found" };
    }

    // Check if the mapping exists
    const mapping = await db.query.stageReasonMaps.findFirst({
      where: and(
        eq(stageReasonMaps.stageId, stageId),
        eq(stageReasonMaps.reasonId, reasonId)
      ),
    });

    if (!mapping) {
      return { 
        isValid: false, 
        reason: `Change reason '${reason.reason}' is not valid for stage '${stage.name}'. Please check the stage-reason mappings.` 
      };
    }

    return { isValid: true };
  }

  /**
   * Get valid change reasons for a specific stage
   */
  async getValidChangeReasonsForStage(stageId: string): Promise<ChangeReason[]> {
    const mappings = await db.query.stageReasonMaps.findMany({
      where: eq(stageReasonMaps.stageId, stageId),
      with: {
        reason: true,
      },
    });

    return mappings.map(mapping => mapping.reason) as any;
  }

  // ============================================
  // CUSTOM FIELDS (6 methods)
  // ============================================

  /**
   * Get all reason custom fields
   */
  async getAllReasonCustomFields(): Promise<ReasonCustomField[]> {
    return await db.query.reasonCustomFields.findMany({
      with: {
        reason: true,
      },
      orderBy: [reasonCustomFields.reasonId, reasonCustomFields.order],
    });
  }

  /**
   * Get reason custom fields by reason ID
   */
  async getReasonCustomFieldsByReasonId(reasonId: string): Promise<ReasonCustomField[]> {
    return await db.query.reasonCustomFields.findMany({
      where: eq(reasonCustomFields.reasonId, reasonId),
      orderBy: reasonCustomFields.order,
    });
  }

  /**
   * Create a new reason custom field
   */
  async createReasonCustomField(field: InsertReasonCustomField): Promise<ReasonCustomField> {
    const [newField] = await db.insert(reasonCustomFields).values(field).returning();
    return newField;
  }

  /**
   * Update a reason custom field
   */
  async updateReasonCustomField(id: string, field: Partial<InsertReasonCustomField>): Promise<ReasonCustomField> {
    const [updatedField] = await db
      .update(reasonCustomFields)
      .set(field)
      .where(eq(reasonCustomFields.id, id))
      .returning();
      
    if (!updatedField) {
      throw new Error("Custom field not found");
    }
    
    return updatedField;
  }

  /**
   * Delete a reason custom field
   */
  async deleteReasonCustomField(id: string): Promise<void> {
    const result = await db.delete(reasonCustomFields).where(eq(reasonCustomFields.id, id));
    if (result.rowCount === 0) {
      throw new Error("Custom field not found");
    }
  }

  /**
   * Validate required fields for a change reason (helper method)
   */
  async validateRequiredFields(
    reasonId: string, 
    fieldResponses?: { customFieldId: string; valueNumber?: number; valueShortText?: string; valueLongText?: string; valueMultiSelect?: string[] }[]
  ): Promise<{ isValid: boolean; reason?: string; missingFields?: string[] }> {
    // Get all required custom fields for this reason
    const requiredFields = await db.query.reasonCustomFields.findMany({
      where: and(
        eq(reasonCustomFields.reasonId, reasonId),
        eq(reasonCustomFields.isRequired, true)
      ),
    });

    if (requiredFields.length === 0) {
      return { isValid: true }; // No required fields, validation passes
    }

    if (!fieldResponses) {
      return {
        isValid: false,
        reason: "Required fields are missing",
        missingFields: requiredFields.map(f => f.fieldName),
      };
    }

    // Check if all required fields have responses
    const providedFieldIds = new Set(fieldResponses.map(fr => fr.customFieldId));
    const missingFields: string[] = [];

    for (const requiredField of requiredFields) {
      if (!providedFieldIds.has(requiredField.id)) {
        missingFields.push(requiredField.fieldName);
        continue;
      }

      // Check if the required field has a value (server-side validation using actual field type)
      const response = fieldResponses.find(fr => fr.customFieldId === requiredField.id);
      if (response) {
        const hasValue = (
          (requiredField.fieldType === 'number' && response.valueNumber !== undefined && response.valueNumber !== null) ||
          (requiredField.fieldType === 'short_text' && response.valueShortText !== undefined && response.valueShortText !== null && response.valueShortText !== '') ||
          (requiredField.fieldType === 'long_text' && response.valueLongText !== undefined && response.valueLongText !== null && response.valueLongText !== '') ||
          (requiredField.fieldType === 'multi_select' && response.valueMultiSelect !== undefined && response.valueMultiSelect !== null && response.valueMultiSelect.length > 0)
        );

        if (!hasValue) {
          missingFields.push(requiredField.fieldName);
        }
      }
    }

    if (missingFields.length > 0) {
      return {
        isValid: false,
        reason: `Required fields are missing values: ${missingFields.join(', ')}`,
        missingFields,
      };
    }

    return { isValid: true };
  }

  // ============================================
  // FIELD RESPONSES (2 methods)
  // ============================================

  /**
   * Create a new reason field response
   */
  async createReasonFieldResponse(response: InsertReasonFieldResponse): Promise<ReasonFieldResponse> {
    try {
      const [newResponse] = await db.insert(reasonFieldResponses).values(response).returning();
      return newResponse;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error(`Field response already exists for this chronology and custom field`);
      }
      if (error instanceof Error && error.message.includes('check_single_value_column')) {
        throw new Error(`Invalid field value: only one value column should be populated based on field type`);
      }
      throw error;
    }
  }

  /**
   * Get reason field responses by chronology ID
   */
  async getReasonFieldResponsesByChronologyId(chronologyId: string): Promise<ReasonFieldResponse[]> {
    return await db.query.reasonFieldResponses.findMany({
      where: eq(reasonFieldResponses.chronologyId, chronologyId),
      with: {
        customField: true,
      },
    });
  }
}

// Export helper functions for use by other modules
export function validateStageReasonMapping(storage: ProjectStagesStorage) {
  return (stageId: string, reasonId: string) => storage.validateStageReasonMapping(stageId, reasonId);
}

export function validateRequiredFields(storage: ProjectStagesStorage) {
  return (reasonId: string, fieldResponses?: any[]) => storage.validateRequiredFields(reasonId, fieldResponses);
}

export function getDefaultStage(storage: ProjectStagesStorage) {
  return () => storage.getDefaultStage();
}

export function validateProjectStatus(storage: ProjectStagesStorage) {
  return (status: string) => storage.validateProjectStatus(status);
}
