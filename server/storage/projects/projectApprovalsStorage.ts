import { db } from '../../db.js';
import {
  stageApprovals,
  stageApprovalFields,
  stageApprovalResponses,
  kanbanStages,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import type {
  StageApproval,
  InsertStageApproval,
  StageApprovalField,
  InsertStageApprovalField,
  StageApprovalResponse,
  InsertStageApprovalResponse,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';

/**
 * Storage class for project stage approval operations.
 * 
 * Handles:
 * - Stage approval CRUD operations
 * - Stage approval field management
 * - Approval response tracking
 * - Approval validation
 */
export class ProjectApprovalsStorage extends BaseStorage {
  // ============================================
  // STAGE APPROVALS (6 methods)
  // ============================================

  /**
   * Get all stage approvals
   */
  async getAllStageApprovals(): Promise<StageApproval[]> {
    return await db.select().from(stageApprovals);
  }

  /**
   * Get stage approvals by project type ID
   */
  async getStageApprovalsByProjectTypeId(projectTypeId: string): Promise<StageApproval[]> {
    return await db
      .select()
      .from(stageApprovals)
      .where(eq(stageApprovals.projectTypeId, projectTypeId));
  }

  /**
   * Create a new stage approval
   */
  async createStageApproval(approval: InsertStageApproval): Promise<StageApproval> {
    try {
      const [newApproval] = await db.insert(stageApprovals).values(approval).returning();
      return newApproval;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error(`Stage approval with name '${approval.name}' already exists`);
      }
      throw error;
    }
  }

  /**
   * Update a stage approval
   */
  async updateStageApproval(id: string, approval: Partial<InsertStageApproval>): Promise<StageApproval> {
    const [updatedApproval] = await db
      .update(stageApprovals)
      .set(approval)
      .where(eq(stageApprovals.id, id))
      .returning();
      
    if (!updatedApproval) {
      throw new Error("Stage approval not found");
    }
    
    return updatedApproval;
  }

  /**
   * Delete a stage approval
   */
  async deleteStageApproval(id: string): Promise<void> {
    const result = await db.delete(stageApprovals).where(eq(stageApprovals.id, id));
    if (result.rowCount === 0) {
      throw new Error("Stage approval not found");
    }
  }

  /**
   * Get stage approval by ID
   */
  async getStageApprovalById(id: string): Promise<StageApproval | undefined> {
    const [approval] = await db.select().from(stageApprovals).where(eq(stageApprovals.id, id));
    return approval;
  }

  /**
   * Get stage approvals by stage ID
   * Stage approvals are linked via kanban_stages.stageApprovalId -> stage_approvals.id
   */
  async getStageApprovalsByStageId(stageId: string): Promise<StageApproval[]> {
    const stage = await db
      .select()
      .from(kanbanStages)
      .where(eq(kanbanStages.id, stageId))
      .limit(1);
    
    if (!stage[0] || !stage[0].stageApprovalId) {
      return [];
    }

    const approval = await db
      .select()
      .from(stageApprovals)
      .where(eq(stageApprovals.id, stage[0].stageApprovalId))
      .limit(1);
    
    return approval;
  }

  // ============================================
  // STAGE APPROVAL FIELDS (5 methods)
  // ============================================

  /**
   * Get all stage approval fields
   */
  async getAllStageApprovalFields(): Promise<StageApprovalField[]> {
    return await db.select().from(stageApprovalFields).orderBy(stageApprovalFields.stageApprovalId, stageApprovalFields.order);
  }

  /**
   * Get stage approval fields by approval ID
   */
  async getStageApprovalFieldsByApprovalId(approvalId: string): Promise<StageApprovalField[]> {
    return await db.query.stageApprovalFields.findMany({
      where: eq(stageApprovalFields.stageApprovalId, approvalId),
      orderBy: stageApprovalFields.order,
    });
  }

  /**
   * Create a new stage approval field
   */
  async createStageApprovalField(field: InsertStageApprovalField): Promise<StageApprovalField> {
    const [newField] = await db.insert(stageApprovalFields).values(field).returning();
    return newField;
  }

  /**
   * Update a stage approval field
   */
  async updateStageApprovalField(id: string, field: Partial<InsertStageApprovalField>): Promise<StageApprovalField> {
    const [updatedField] = await db
      .update(stageApprovalFields)
      .set(field)
      .where(eq(stageApprovalFields.id, id))
      .returning();
      
    if (!updatedField) {
      throw new Error("Stage approval field not found");
    }
    
    return updatedField;
  }

  /**
   * Delete a stage approval field
   */
  async deleteStageApprovalField(id: string): Promise<void> {
    const result = await db.delete(stageApprovalFields).where(eq(stageApprovalFields.id, id));
    if (result.rowCount === 0) {
      throw new Error("Stage approval field not found");
    }
  }

  // ============================================
  // STAGE APPROVAL RESPONSES (3 methods)
  // ============================================

  /**
   * Create a new stage approval response
   */
  async createStageApprovalResponse(response: InsertStageApprovalResponse): Promise<StageApprovalResponse> {
    try {
      const [newResponse] = await db.insert(stageApprovalResponses).values(response).returning();
      return newResponse;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error(`Stage approval response already exists for this field and project`);
      }
      if (error instanceof Error && error.message.includes('check_single_value_column')) {
        throw new Error(`Invalid field value: only one value column should be populated based on field type`);
      }
      throw error;
    }
  }

  /**
   * Upsert a stage approval response (create or update)
   */
  async upsertStageApprovalResponse(response: InsertStageApprovalResponse): Promise<StageApprovalResponse> {
    try {
      const [upsertedResponse] = await db
        .insert(stageApprovalResponses)
        .values(response)
        .onConflictDoUpdate({
          target: [stageApprovalResponses.projectId, stageApprovalResponses.fieldId],
          set: {
            valueBoolean: response.valueBoolean,
            valueNumber: response.valueNumber,
            valueLongText: response.valueLongText,
            valueMultiSelect: response.valueMultiSelect,
          }
        })
        .returning();
      return upsertedResponse;
    } catch (error) {
      if (error instanceof Error && error.message.includes('check_single_value_column')) {
        throw new Error(`Invalid field value: only one value column should be populated based on field type`);
      }
      throw error;
    }
  }

  /**
   * Get stage approval responses by project ID
   */
  async getStageApprovalResponsesByProjectId(projectId: string): Promise<StageApprovalResponse[]> {
    return await db.query.stageApprovalResponses.findMany({
      where: eq(stageApprovalResponses.projectId, projectId),
      with: {
        field: {
          with: {
            stageApproval: true,
          },
        },
      },
    });
  }

  // ============================================
  // VALIDATION (1 method)
  // ============================================

  /**
   * Validate stage approval responses against configured fields
   */
  async validateStageApprovalResponses(approvalId: string, responses: InsertStageApprovalResponse[]): Promise<{ isValid: boolean; reason?: string; failedFields?: string[] }> {
    // Load all fields for the approval
    const fields = await this.getStageApprovalFieldsByApprovalId(approvalId);
    
    if (fields.length === 0) {
      return { isValid: true }; // No fields to validate
    }

    // Get all required fields for the approval (where isRequired = true)
    const requiredFields = fields.filter(field => field.isRequired);
    
    // Create maps for easy lookup
    const responseMap = new Map<string, InsertStageApprovalResponse>();
    responses.forEach(response => {
      responseMap.set(response.fieldId, response);
    });

    const failedFields: string[] = [];

    // CRITICAL FIX 1: Check that each required field has a corresponding response
    for (const requiredField of requiredFields) {
      if (!responseMap.has(requiredField.id)) {
        failedFields.push(requiredField.fieldName);
      }
    }

    // Validate each provided response
    for (const response of responses) {
      const field = fields.find(f => f.id === response.fieldId);
      if (!field) {
        failedFields.push(`Field ID ${response.fieldId} not found`);
        continue;
      }

      // CRITICAL FIX 2: Ensure exactly one value field is populated based on fieldType
      const hasBoolean = response.valueBoolean !== undefined && response.valueBoolean !== null;
      const hasNumber = response.valueNumber !== undefined && response.valueNumber !== null;
      const hasLongText = response.valueLongText !== undefined && response.valueLongText !== null && response.valueLongText !== '';
      const hasMultiSelect = response.valueMultiSelect !== undefined && response.valueMultiSelect !== null && Array.isArray(response.valueMultiSelect);
      
      let validFieldMatch = false;
      if (field.fieldType === 'boolean') {
        validFieldMatch = hasBoolean && !hasNumber && !hasLongText && !hasMultiSelect;
      } else if (field.fieldType === 'number') {
        validFieldMatch = !hasBoolean && hasNumber && !hasLongText && !hasMultiSelect;
      } else if (field.fieldType === 'long_text') {
        validFieldMatch = !hasBoolean && !hasNumber && hasLongText && !hasMultiSelect;
      } else if (field.fieldType === 'multi_select') {
        validFieldMatch = !hasBoolean && !hasNumber && !hasLongText && hasMultiSelect;
      }
      
      if (!validFieldMatch) {
        failedFields.push(`${field.fieldName}: field type '${field.fieldType}' requires exactly one matching value field`);
        continue;
      }

      // Validate field values against expected criteria
      if (field.fieldType === 'boolean') {
        // For boolean fields: check response.valueBoolean matches field.expectedValueBoolean
        if (field.expectedValueBoolean !== null && response.valueBoolean !== field.expectedValueBoolean) {
          failedFields.push(field.fieldName);
        }
      } else if (field.fieldType === 'number') {
        // For number fields: check response.valueNumber against field.expectedValueNumber using field.comparisonType
        if (field.expectedValueNumber !== null && field.comparisonType && response.valueNumber !== null) {
          const responseValue = response.valueNumber;
          const expectedValue = field.expectedValueNumber;
          let isValid = false;

          switch (field.comparisonType) {
            case 'equal_to':
              isValid = responseValue === expectedValue;
              break;
            case 'less_than':
              isValid = responseValue !== undefined && responseValue < expectedValue;
              break;
            case 'greater_than':
              isValid = responseValue !== undefined && responseValue > expectedValue;
              break;
          }

          if (!isValid) {
            failedFields.push(field.fieldName);
          }
        } else if (field.isRequired && (response.valueNumber === null || response.valueNumber === undefined)) {
          failedFields.push(field.fieldName);
        }
      } else if (field.fieldType === 'long_text') {
        // For long_text fields: just check not empty if required
        if (field.isRequired && (!response.valueLongText || response.valueLongText.trim() === '')) {
          failedFields.push(field.fieldName);
        }
      } else if (field.fieldType === 'multi_select') {
        // For multi_select fields: validate against configured options if present
        if (field.isRequired && (!response.valueMultiSelect || response.valueMultiSelect.length === 0)) {
          failedFields.push(field.fieldName);
        } else if (field.options && field.options.length > 0 && response.valueMultiSelect) {
          // Validate that all selected values are in the configured options
          const invalidOptions = response.valueMultiSelect.filter(value => !field.options?.includes(value));
          if (invalidOptions.length > 0) {
            failedFields.push(`${field.fieldName}: invalid options selected`);
          }
        }
      }
    }

    if (failedFields.length > 0) {
      return {
        isValid: false,
        reason: `Validation failed for fields: ${failedFields.join(', ')}`,
        failedFields,
      };
    }

    return { isValid: true };
  }
}
