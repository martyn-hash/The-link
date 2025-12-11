import { db } from '../../db.js';
import {
  stageApprovals,
  stageApprovalFields,
  stageApprovalResponses,
  kanbanStages,
  approvalFieldLibrary,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import type {
  StageApproval,
  InsertStageApproval,
  StageApprovalField,
  InsertStageApprovalField,
  StageApprovalResponse,
  InsertStageApprovalResponse,
  ApprovalFieldLibrary,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';

export type ResolvedStageApprovalField = StageApprovalField & {
  resolvedFromLibrary: boolean;
  libraryField?: ApprovalFieldLibrary;
};

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

  /**
   * Get resolved approval fields with library inheritance
   * For fields with libraryFieldId, merge the library definition
   * is_required and order are ALWAYS per-approval (not inherited)
   */
  async getResolvedApprovalFields(approvalId: string): Promise<ResolvedStageApprovalField[]> {
    const fields = await this.getStageApprovalFieldsByApprovalId(approvalId);
    
    if (fields.length === 0) {
      return [];
    }

    const resolvedFields: ResolvedStageApprovalField[] = [];

    for (const field of fields) {
      if (field.libraryFieldId) {
        const [libraryField] = await db
          .select()
          .from(approvalFieldLibrary)
          .where(eq(approvalFieldLibrary.id, field.libraryFieldId));

        if (libraryField) {
          resolvedFields.push({
            ...field,
            fieldName: libraryField.fieldName,
            fieldType: libraryField.fieldType,
            description: libraryField.description,
            placeholder: libraryField.placeholder,
            expectedValueBoolean: libraryField.expectedValueBoolean,
            comparisonType: libraryField.comparisonType,
            expectedValueNumber: libraryField.expectedValueNumber,
            dateComparisonType: libraryField.dateComparisonType,
            expectedDate: libraryField.expectedDate,
            expectedDateEnd: libraryField.expectedDateEnd,
            options: libraryField.options,
            resolvedFromLibrary: true,
            libraryField,
          });
        } else {
          resolvedFields.push({
            ...field,
            resolvedFromLibrary: false,
          });
        }
      } else {
        resolvedFields.push({
          ...field,
          resolvedFromLibrary: false,
        });
      }
    }

    return resolvedFields;
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
   * Supports all 7 field types: boolean, number, short_text, long_text, single_select, multi_select, date
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
            valueShortText: response.valueShortText,
            valueLongText: response.valueLongText,
            valueSingleSelect: response.valueSingleSelect,
            valueMultiSelect: response.valueMultiSelect,
            valueDate: response.valueDate,
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
   * Supports all 7 field types: boolean, number, short_text, long_text, single_select, multi_select, date
   */
  async validateStageApprovalResponses(approvalId: string, responses: InsertStageApprovalResponse[]): Promise<{ isValid: boolean; reason?: string; failedFields?: string[] }> {
    const fields = await this.getStageApprovalFieldsByApprovalId(approvalId);
    
    if (fields.length === 0) {
      return { isValid: true };
    }

    const requiredFields = fields.filter(field => field.isRequired);
    
    const responseMap = new Map<string, InsertStageApprovalResponse>();
    responses.forEach(response => {
      responseMap.set(response.fieldId, response);
    });

    const failedFields: string[] = [];

    for (const requiredField of requiredFields) {
      if (!responseMap.has(requiredField.id)) {
        failedFields.push(requiredField.fieldName);
      }
    }

    for (const response of responses) {
      const field = fields.find(f => f.id === response.fieldId);
      if (!field) {
        failedFields.push(`Field ID ${response.fieldId} not found`);
        continue;
      }

      const hasBoolean = response.valueBoolean !== undefined && response.valueBoolean !== null;
      const hasNumber = response.valueNumber !== undefined && response.valueNumber !== null;
      const hasShortText = response.valueShortText !== undefined && response.valueShortText !== null && response.valueShortText !== '';
      const hasLongText = response.valueLongText !== undefined && response.valueLongText !== null && response.valueLongText !== '';
      const hasSingleSelect = response.valueSingleSelect !== undefined && response.valueSingleSelect !== null && response.valueSingleSelect !== '';
      const hasMultiSelect = response.valueMultiSelect !== undefined && response.valueMultiSelect !== null && Array.isArray(response.valueMultiSelect);
      const hasDate = response.valueDate !== undefined && response.valueDate !== null;
      
      let validFieldMatch = false;
      const valueCount = [hasBoolean, hasNumber, hasShortText, hasLongText, hasSingleSelect, hasMultiSelect, hasDate].filter(Boolean).length;
      
      if (valueCount !== 1) {
        failedFields.push(`${field.fieldName}: exactly one value field must be populated`);
        continue;
      }
      
      switch (field.fieldType) {
        case 'boolean':
          validFieldMatch = hasBoolean;
          break;
        case 'number':
          validFieldMatch = hasNumber;
          break;
        case 'short_text':
          validFieldMatch = hasShortText;
          break;
        case 'long_text':
          validFieldMatch = hasLongText;
          break;
        case 'single_select':
          validFieldMatch = hasSingleSelect;
          break;
        case 'multi_select':
          validFieldMatch = hasMultiSelect;
          break;
        case 'date':
          validFieldMatch = hasDate;
          break;
      }
      
      if (!validFieldMatch) {
        failedFields.push(`${field.fieldName}: field type '${field.fieldType}' requires matching value field`);
        continue;
      }

      if (field.fieldType === 'boolean') {
        if (field.expectedValueBoolean !== null && response.valueBoolean !== field.expectedValueBoolean) {
          failedFields.push(field.fieldName);
        }
      } else if (field.fieldType === 'number') {
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
      } else if (field.fieldType === 'short_text') {
        if (field.isRequired && (!response.valueShortText || response.valueShortText.trim() === '')) {
          failedFields.push(field.fieldName);
        }
        if (response.valueShortText && response.valueShortText.length > 255) {
          failedFields.push(`${field.fieldName}: exceeds 255 character limit`);
        }
      } else if (field.fieldType === 'long_text') {
        if (field.isRequired && (!response.valueLongText || response.valueLongText.trim() === '')) {
          failedFields.push(field.fieldName);
        }
      } else if (field.fieldType === 'single_select') {
        if (field.isRequired && !response.valueSingleSelect) {
          failedFields.push(field.fieldName);
        }
        if (response.valueSingleSelect && field.options && !field.options.includes(response.valueSingleSelect)) {
          failedFields.push(`${field.fieldName}: invalid option selected`);
        }
      } else if (field.fieldType === 'multi_select') {
        if (field.isRequired && (!response.valueMultiSelect || response.valueMultiSelect.length === 0)) {
          failedFields.push(field.fieldName);
        } else if (field.options && field.options.length > 0 && response.valueMultiSelect) {
          const invalidOptions = response.valueMultiSelect.filter(value => !field.options?.includes(value));
          if (invalidOptions.length > 0) {
            failedFields.push(`${field.fieldName}: invalid options selected`);
          }
        }
      } else if (field.fieldType === 'date') {
        if (field.isRequired && !response.valueDate) {
          failedFields.push(field.fieldName);
        }
        if (response.valueDate && field.dateComparisonType && field.expectedDate) {
          const responseDate = new Date(response.valueDate);
          const expectedDate = new Date(field.expectedDate);
          let isValid = true;
          
          switch (field.dateComparisonType) {
            case 'before':
              isValid = responseDate < expectedDate;
              break;
            case 'after':
              isValid = responseDate > expectedDate;
              break;
            case 'exact':
              isValid = responseDate.toDateString() === expectedDate.toDateString();
              break;
            case 'between':
              if (field.expectedDateEnd) {
                const endDate = new Date(field.expectedDateEnd);
                isValid = responseDate >= expectedDate && responseDate <= endDate;
              }
              break;
          }
          
          if (!isValid) {
            failedFields.push(field.fieldName);
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
