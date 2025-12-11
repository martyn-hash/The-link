import { db } from '../../db.js';
import { clientStageApprovalOverrides, stageApprovals, kanbanStages, clients, projectTypes } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type {
  ClientStageApprovalOverride,
  InsertClientStageApprovalOverride,
  StageApproval,
  KanbanStage,
  Client,
  ProjectType,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';

export type ClientStageApprovalOverrideWithDetails = ClientStageApprovalOverride & {
  overrideApproval: StageApproval;
  stage: KanbanStage;
  client?: Client;
  projectType?: ProjectType;
};

export class ClientApprovalOverrideStorage extends BaseStorage {
  async getClientOverride(
    clientId: string,
    projectTypeId: string,
    stageId: string
  ): Promise<ClientStageApprovalOverride | undefined> {
    const [override] = await db
      .select()
      .from(clientStageApprovalOverrides)
      .where(
        and(
          eq(clientStageApprovalOverrides.clientId, clientId),
          eq(clientStageApprovalOverrides.projectTypeId, projectTypeId),
          eq(clientStageApprovalOverrides.stageId, stageId)
        )
      );
    return override;
  }

  async getOverridesByClient(clientId: string): Promise<ClientStageApprovalOverrideWithDetails[]> {
    const overrides = await db
      .select()
      .from(clientStageApprovalOverrides)
      .where(eq(clientStageApprovalOverrides.clientId, clientId));

    return Promise.all(
      overrides.map(async (override) => {
        const [approval] = await db
          .select()
          .from(stageApprovals)
          .where(eq(stageApprovals.id, override.overrideApprovalId));

        const [stage] = await db
          .select()
          .from(kanbanStages)
          .where(eq(kanbanStages.id, override.stageId));

        const [projectType] = await db
          .select()
          .from(projectTypes)
          .where(eq(projectTypes.id, override.projectTypeId));

        return {
          ...override,
          overrideApproval: approval,
          stage: stage,
          projectType: projectType,
        };
      })
    );
  }

  async getOverridesByProjectType(projectTypeId: string): Promise<ClientStageApprovalOverrideWithDetails[]> {
    const overrides = await db
      .select()
      .from(clientStageApprovalOverrides)
      .where(eq(clientStageApprovalOverrides.projectTypeId, projectTypeId));

    return Promise.all(
      overrides.map(async (override) => {
        const [approval] = await db
          .select()
          .from(stageApprovals)
          .where(eq(stageApprovals.id, override.overrideApprovalId));

        const [stage] = await db
          .select()
          .from(kanbanStages)
          .where(eq(kanbanStages.id, override.stageId));

        const [client] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, override.clientId));

        return {
          ...override,
          overrideApproval: approval,
          stage: stage,
          client: client,
        };
      })
    );
  }

  async createOverride(override: InsertClientStageApprovalOverride): Promise<ClientStageApprovalOverride> {
    try {
      const [newOverride] = await db
        .insert(clientStageApprovalOverrides)
        .values(override)
        .returning();
      return newOverride;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique_client_stage_override')) {
        throw new Error('An override already exists for this client, project type, and stage combination');
      }
      throw error;
    }
  }

  async updateOverride(
    id: string,
    updates: Partial<InsertClientStageApprovalOverride>
  ): Promise<ClientStageApprovalOverride> {
    const [updatedOverride] = await db
      .update(clientStageApprovalOverrides)
      .set(updates)
      .where(eq(clientStageApprovalOverrides.id, id))
      .returning();

    if (!updatedOverride) {
      throw new Error('Override not found');
    }

    return updatedOverride;
  }

  async deleteOverride(id: string): Promise<void> {
    const result = await db
      .delete(clientStageApprovalOverrides)
      .where(eq(clientStageApprovalOverrides.id, id));

    if (result.rowCount === 0) {
      throw new Error('Override not found');
    }
  }

  async getClientOverridesForProject(
    clientId: string,
    projectTypeId: string
  ): Promise<Map<string, string>> {
    const overrides = await db
      .select()
      .from(clientStageApprovalOverrides)
      .where(
        and(
          eq(clientStageApprovalOverrides.clientId, clientId),
          eq(clientStageApprovalOverrides.projectTypeId, projectTypeId)
        )
      );

    const overrideMap = new Map<string, string>();
    for (const override of overrides) {
      overrideMap.set(override.stageId, override.overrideApprovalId);
    }

    return overrideMap;
  }

  async getOverrideById(id: string): Promise<ClientStageApprovalOverride | undefined> {
    const [override] = await db
      .select()
      .from(clientStageApprovalOverrides)
      .where(eq(clientStageApprovalOverrides.id, id));
    return override;
  }
}
