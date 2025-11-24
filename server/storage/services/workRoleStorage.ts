import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import {
  workRoles,
  serviceRoles,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { WorkRole, InsertWorkRole, ServiceRole } from '@shared/schema';

export class WorkRoleStorage extends BaseStorage {
  // ==================== Work Role CRUD Operations ====================

  async getAllWorkRoles(): Promise<WorkRole[]> {
    return await db.select().from(workRoles);
  }

  async getWorkRoleById(id: string): Promise<WorkRole | undefined> {
    const [workRole] = await db.select().from(workRoles).where(eq(workRoles.id, id));
    return workRole;
  }

  async getWorkRoleByName(name: string): Promise<WorkRole | undefined> {
    const [workRole] = await db.select().from(workRoles).where(eq(workRoles.name, name));
    return workRole;
  }

  async createWorkRole(role: InsertWorkRole): Promise<WorkRole> {
    const [newWorkRole] = await db.insert(workRoles).values(role).returning();
    return newWorkRole;
  }

  async updateWorkRole(id: string, role: Partial<InsertWorkRole>): Promise<WorkRole> {
    const [updatedWorkRole] = await db
      .update(workRoles)
      .set(role)
      .where(eq(workRoles.id, id))
      .returning();
    
    if (!updatedWorkRole) {
      throw new Error("Work role not found");
    }
    
    return updatedWorkRole;
  }

  async deleteWorkRole(id: string): Promise<void> {
    const result = await db.delete(workRoles).where(eq(workRoles.id, id));
    if (result.rowCount === 0) {
      throw new Error("Work role not found");
    }
  }

  // ==================== Service-Role Mapping Operations ====================

  async getServiceRolesByServiceId(serviceId: string): Promise<ServiceRole[]> {
    return await db
      .select()
      .from(serviceRoles)
      .where(eq(serviceRoles.serviceId, serviceId));
  }

  async getWorkRolesByServiceId(serviceId: string): Promise<WorkRole[]> {
    return await db
      .select({
        id: workRoles.id,
        name: workRoles.name,
        description: workRoles.description,
        createdAt: workRoles.createdAt,
      })
      .from(serviceRoles)
      .innerJoin(workRoles, eq(serviceRoles.roleId, workRoles.id))
      .where(eq(serviceRoles.serviceId, serviceId));
  }

  async addRoleToService(serviceId: string, roleId: string): Promise<ServiceRole> {
    // Insert with conflict handling to gracefully handle duplicate insertions
    const [serviceRole] = await db
      .insert(serviceRoles)
      .values({ serviceId, roleId })
      .onConflictDoNothing()
      .returning();
    
    // If no rows were returned, the mapping already exists
    if (!serviceRole) {
      // Fetch the existing mapping to return it
      const [existingMapping] = await db
        .select()
        .from(serviceRoles)
        .where(and(
          eq(serviceRoles.serviceId, serviceId),
          eq(serviceRoles.roleId, roleId)
        ));
      
      if (!existingMapping) {
        throw new Error("Failed to create or retrieve service-role mapping");
      }
      
      return existingMapping;
    }
    
    return serviceRole;
  }

  async removeRoleFromService(serviceId: string, roleId: string): Promise<void> {
    const result = await db
      .delete(serviceRoles)
      .where(and(
        eq(serviceRoles.serviceId, serviceId),
        eq(serviceRoles.roleId, roleId)
      ));
    
    if (result.rowCount === 0) {
      throw new Error("Service-role mapping not found");
    }
  }
}
