import { db } from '../../db.js';
import {
  projectChronology,
  projects,
  users,
  internalTasks,
  taskConnections,
  reasonFieldResponses,
  reasonCustomFields,
  changeReasons,
} from '@shared/schema';
import { eq, and, desc, sql, sum, isNotNull } from 'drizzle-orm';
import type {
  ProjectChronology,
  InsertProjectChronology,
  User,
  ReasonFieldResponse,
  ReasonCustomField,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';

/**
 * Storage class for project chronology operations.
 * 
 * Handles:
 * - Project chronology tracking
 * - Stage change history
 * - Progress metrics
 * - Task activity logging
 * 
 * Note: Client chronology was extracted in Stage 2 (Clients domain)
 */
export class ProjectChronologyStorage extends BaseStorage {
  // ==================== Project Chronology Operations ====================

  async createChronologyEntry(entry: InsertProjectChronology): Promise<ProjectChronology> {
    const [chronology] = await db.insert(projectChronology).values(entry).returning();
    return chronology;
  }

  async getProjectChronology(projectId: string): Promise<(ProjectChronology & { assignee?: User; changedBy?: User; fieldResponses: (ReasonFieldResponse & { customField: ReasonCustomField })[] })[]> {
    const results = await db.query.projectChronology.findMany({
      where: eq(projectChronology.projectId, projectId),
      with: {
        assignee: true,
        changedBy: true,
        fieldResponses: {
          with: {
            customField: true,
          },
        },
      },
      orderBy: desc(projectChronology.timestamp),
    });
    
    // Convert null relations to undefined to match TypeScript expectations
    return results.map(c => ({
      ...c,
      assignee: c.assignee || undefined,
      changedBy: c.changedBy || undefined,
      fieldResponses: c.fieldResponses || [],
    }));
  }

  async getMostRecentStageChange(projectId: string): Promise<{
    entry: any;
    stageApprovalResponses: any[];
    projectTypeId: string;
  } | undefined> {
    // Fetch the most recent chronology entry that is a stage change
    // Stage changes have both fromStatus and toStatus populated
    const result = await db.query.projectChronology.findFirst({
      where: and(
        eq(projectChronology.projectId, projectId),
        isNotNull(projectChronology.fromStatus),
        isNotNull(projectChronology.toStatus)
      ),
      with: {
        assignee: true,
        changedBy: true,
        fieldResponses: {
          with: {
            customField: true,
          },
        },
      },
      orderBy: desc(projectChronology.timestamp),
    });

    if (!result) return undefined;

    // Fetch the project's stage approval responses and projectTypeId
    // The client-side modal will filter these based on the stage change's approval requirements
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        stageApprovalResponses: {
          with: {
            field: true,
          },
        },
      },
    });

    if (!project) return undefined;

    // Return the chronology entry, stage approval responses, and projectTypeId
    // This allows the client-side filtering logic to work unchanged
    return {
      entry: {
        ...result,
        assignee: result.assignee || undefined,
        changedBy: result.changedBy || undefined,
        fieldResponses: result.fieldResponses || [],
      },
      stageApprovalResponses: project.stageApprovalResponses || [],
      projectTypeId: project.projectTypeId,
    };
  }

  async getProjectProgressMetrics(projectId: string): Promise<{ reasonId: string; label: string; total: number }[]> {
    // Query to aggregate numeric field responses by change reason for a specific project
    // We need to join: reasonFieldResponses -> reasonCustomFields -> changeReasons
    // and also join through projectChronology to filter by projectId
    const results = await db
      .select({
        reasonId: changeReasons.id,
        label: changeReasons.countLabel,
        reason: changeReasons.reason,
        total: sum(reasonFieldResponses.valueNumber).as('total'),
      })
      .from(reasonFieldResponses)
      .innerJoin(reasonCustomFields, eq(reasonFieldResponses.customFieldId, reasonCustomFields.id))
      .innerJoin(changeReasons, eq(reasonCustomFields.reasonId, changeReasons.id))
      .innerJoin(projectChronology, eq(reasonFieldResponses.chronologyId, projectChronology.id))
      .where(
        and(
          eq(projectChronology.projectId, projectId),
          eq(changeReasons.showCountInProject, true),
          eq(reasonFieldResponses.fieldType, 'number'),
          sql`${reasonFieldResponses.valueNumber} IS NOT NULL`
        )
      )
      .groupBy(changeReasons.id, changeReasons.countLabel, changeReasons.reason);

    // Convert the results to the expected format, using countLabel if available, otherwise reason
    return results.map(result => ({
      reasonId: result.reasonId,
      label: result.label || result.reason,
      total: Number(result.total) || 0,
    }));
  }

  // NOTE: createClientChronologyEntry and getClientChronology were already extracted
  // in Stage 2 (Clients domain) and are part of ClientStorage, not ProjectChronologyStorage

  // ==================== Helper Methods ====================

  /**
   * Helper function to log task activities to project chronology
   */
  async logTaskActivityToProject(
    taskId: string,
    activity: 'created' | 'updated' | 'note_added' | 'completed',
    details: string,
    userId: string
  ): Promise<void> {
    // Get project connection for this task
    const [connection] = await db
      .select()
      .from(taskConnections)
      .where(
        and(
          eq(taskConnections.taskId, taskId),
          eq(taskConnections.entityType, 'project')
        )
      );

    if (!connection) {
      // Task is not connected to a project, skip logging
      return;
    }

    // Get task details
    const [task] = await db
      .select()
      .from(internalTasks)
      .where(eq(internalTasks.id, taskId));

    if (!task) return;

    // Create appropriate chronology message based on activity
    let message = '';
    switch (activity) {
      case 'created':
        message = `Task created: ${task.title}`;
        break;
      case 'updated':
        message = `Task updated: ${task.title} - ${details}`;
        break;
      case 'note_added':
        message = `Progress note added to task "${task.title}": ${details}`;
        break;
      case 'completed':
        message = `Task completed: ${task.title} - ${details}`;
        break;
    }

    // Create chronology entry
    await db.insert(projectChronology).values({
      projectId: connection.entityId,
      fromStatus: null,
      toStatus: 'no_change',
      assigneeId: task.assignedTo,
      changedById: userId,
      notes: message,
      timestamp: new Date(),
    });
  }
}
