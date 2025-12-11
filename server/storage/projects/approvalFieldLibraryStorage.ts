import { db } from '../../db.js';
import { approvalFieldLibrary, stageApprovalFields, stageApprovals } from '@shared/schema';
import { eq, and, count } from 'drizzle-orm';
import type {
  ApprovalFieldLibrary,
  InsertApprovalFieldLibrary,
  UpdateApprovalFieldLibrary,
  StageApproval,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';

export class ApprovalFieldLibraryStorage extends BaseStorage {
  async getLibraryFieldsByProjectType(projectTypeId: string): Promise<ApprovalFieldLibrary[]> {
    return await db
      .select()
      .from(approvalFieldLibrary)
      .where(eq(approvalFieldLibrary.projectTypeId, projectTypeId));
  }

  async getLibraryFieldById(id: string): Promise<ApprovalFieldLibrary | undefined> {
    const [field] = await db
      .select()
      .from(approvalFieldLibrary)
      .where(eq(approvalFieldLibrary.id, id));
    return field;
  }

  async createLibraryField(field: InsertApprovalFieldLibrary): Promise<ApprovalFieldLibrary> {
    try {
      const [newField] = await db
        .insert(approvalFieldLibrary)
        .values(field)
        .returning();
      return newField;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique_library_field_name_per_type')) {
        throw new Error(`A library field with name '${field.fieldName}' already exists for this project type`);
      }
      throw error;
    }
  }

  async updateLibraryField(id: string, updates: UpdateApprovalFieldLibrary): Promise<ApprovalFieldLibrary> {
    try {
      const [updatedField] = await db
        .update(approvalFieldLibrary)
        .set(updates)
        .where(eq(approvalFieldLibrary.id, id))
        .returning();

      if (!updatedField) {
        throw new Error('Library field not found');
      }

      return updatedField;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique_library_field_name_per_type')) {
        throw new Error(`A library field with that name already exists for this project type`);
      }
      throw error;
    }
  }

  async deleteLibraryField(id: string): Promise<void> {
    const usageCount = await this.getLibraryFieldUsageCount(id);
    if (usageCount > 0) {
      throw new Error(`Cannot delete library field: it is used in ${usageCount} approval field(s)`);
    }

    const result = await db
      .delete(approvalFieldLibrary)
      .where(eq(approvalFieldLibrary.id, id));

    if (result.rowCount === 0) {
      throw new Error('Library field not found');
    }
  }

  async getLibraryFieldUsageCount(id: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(stageApprovalFields)
      .where(eq(stageApprovalFields.libraryFieldId, id));

    return result?.count ?? 0;
  }

  async getApprovalsUsingLibraryField(id: string): Promise<StageApproval[]> {
    const fieldsUsingLibrary = await db
      .select({ stageApprovalId: stageApprovalFields.stageApprovalId })
      .from(stageApprovalFields)
      .where(eq(stageApprovalFields.libraryFieldId, id));

    if (fieldsUsingLibrary.length === 0) {
      return [];
    }

    const approvalIds = Array.from(new Set(fieldsUsingLibrary.map(f => f.stageApprovalId)));
    
    const approvals: StageApproval[] = [];
    for (const approvalId of approvalIds) {
      const [approval] = await db
        .select()
        .from(stageApprovals)
        .where(eq(stageApprovals.id, approvalId));
      if (approval) {
        approvals.push(approval);
      }
    }

    return approvals;
  }

  async getLibraryFieldWithUsage(id: string): Promise<(ApprovalFieldLibrary & { usageCount: number }) | undefined> {
    const field = await this.getLibraryFieldById(id);
    if (!field) return undefined;

    const usageCount = await this.getLibraryFieldUsageCount(id);
    return { ...field, usageCount };
  }

  async getLibraryFieldsWithUsage(projectTypeId: string): Promise<(ApprovalFieldLibrary & { usageCount: number })[]> {
    const fields = await this.getLibraryFieldsByProjectType(projectTypeId);
    
    const fieldsWithUsage = await Promise.all(
      fields.map(async (field) => {
        const usageCount = await this.getLibraryFieldUsageCount(field.id);
        return { ...field, usageCount };
      })
    );

    return fieldsWithUsage;
  }
}
