import type { Express } from "express";
import { db } from "../db";
import { projects, projectTypes, services, clients, users, internalTasks, kanbanStages } from "@shared/schema";
import { eq, and, gte, lte, or, isNull, isNotNull, ne, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { CalendarEvent, CalendarEventsResponse } from "@shared/schema";

function generateUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const hue = Math.abs(hash % 360);
  const saturation = 65 + (Math.abs(hash >> 8) % 20);
  const lightness = 45 + (Math.abs(hash >> 16) % 15);
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function getUserFullName(user: { firstName: string | null; lastName: string | null } | null | undefined): string | null {
  if (!user) return null;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

export function registerCalendarRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
): void {
  
  app.get("/api/calendar/events", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const {
        start,
        end,
        serviceFilter,
        taskAssigneeFilter,
        serviceOwnerFilter,
        userFilter,
        showArchived,
        includeProjectDues,
        includeTargetDates,
        includeStageDeadlines,
        includeTasks
      } = req.query;

      if (!start || !end) {
        return res.status(400).json({ message: "Start and end dates are required" });
      }

      const startDate = new Date(start as string);
      const endDate = new Date(end as string);
      
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const events: CalendarEvent[] = [];
      const userColors: Record<string, string> = {};
      const usersMap = new Map<string, any>();

      const allUsers = await db.select().from(users);
      allUsers.forEach(user => {
        usersMap.set(user.id, user);
        userColors[user.id] = generateUserColor(user.id);
      });

      const showArchivedBool = showArchived === 'true';
      const includeProjectDuesBool = includeProjectDues !== 'false';
      const includeTargetDatesBool = includeTargetDates !== 'false';
      const includeStageDeadlinesBool = includeStageDeadlines === 'true';
      const includeTasksBool = includeTasks !== 'false';

      const projectOwnerAlias = alias(users, 'projectOwner');
      const currentAssigneeAlias = alias(users, 'currentAssignee');
      const bookkeeperAlias = alias(users, 'bookkeeper');

      let projectWhereConditions: any[] = [];

      if (!showArchivedBool) {
        projectWhereConditions.push(
          or(
            eq(projects.archived, false),
            isNull(projects.archived)
          )!
        );
      }

      projectWhereConditions.push(
        or(
          eq(projects.inactive, false),
          isNull(projects.inactive)
        )!
      );

      projectWhereConditions.push(isNull(projects.completionStatus));

      if (serviceFilter && serviceFilter !== 'all') {
        projectWhereConditions.push(eq(services.id, serviceFilter as string));
      }

      if (taskAssigneeFilter && taskAssigneeFilter !== 'all') {
        projectWhereConditions.push(eq(projects.currentAssigneeId, taskAssigneeFilter as string));
      }

      if (serviceOwnerFilter && serviceOwnerFilter !== 'all') {
        projectWhereConditions.push(eq(projects.projectOwnerId, serviceOwnerFilter as string));
      }

      if (userFilter && userFilter !== 'all') {
        projectWhereConditions.push(eq(projects.bookkeeperId, userFilter as string));
      }

      if (includeProjectDuesBool) {
        const dueDateConditions = [
          ...projectWhereConditions,
          isNotNull(projects.dueDate),
          gte(projects.dueDate, startDate),
          lte(projects.dueDate, endDate)
        ];

        const projectsWithDueDates = await db
          .select({
            project: projects,
            projectType: projectTypes,
            service: services,
            client: clients,
            projectOwner: projectOwnerAlias,
            currentAssignee: currentAssigneeAlias,
            bookkeeper: bookkeeperAlias,
          })
          .from(projects)
          .leftJoin(projectTypes, eq(projects.projectTypeId, projectTypes.id))
          .leftJoin(services, eq(projectTypes.serviceId, services.id))
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .leftJoin(projectOwnerAlias, eq(projects.projectOwnerId, projectOwnerAlias.id))
          .leftJoin(currentAssigneeAlias, eq(projects.currentAssigneeId, currentAssigneeAlias.id))
          .leftJoin(bookkeeperAlias, eq(projects.bookkeeperId, bookkeeperAlias.id))
          .where(and(...dueDateConditions));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const row of projectsWithDueDates) {
          const dueDate = new Date(row.project.dueDate!);
          const isOverdue = dueDate < today;
          const assigneeId = row.project.currentAssigneeId || row.project.bookkeeperId;

          events.push({
            id: `project_due_${row.project.id}`,
            type: "project_due",
            title: row.projectType?.name || row.project.description,
            date: row.project.dueDate!.toISOString(),
            entityId: row.project.id,
            entityType: "project",
            assigneeId: assigneeId,
            assigneeName: assigneeId ? getUserFullName(usersMap.get(assigneeId)) : null,
            clientId: row.project.clientId,
            clientName: row.client?.name || null,
            status: row.project.currentStatus,
            color: assigneeId ? userColors[assigneeId] : '#6b7280',
            isOverdue,
            meta: {
              projectTypeName: row.projectType?.name,
              serviceName: row.service?.name,
              serviceId: row.service?.id,
              priority: row.project.priority || undefined,
              description: row.project.description,
            },
          });
        }
      }

      if (includeTargetDatesBool) {
        const targetDateConditions = [
          ...projectWhereConditions,
          isNotNull(projects.targetDeliveryDate),
          gte(projects.targetDeliveryDate, startDate),
          lte(projects.targetDeliveryDate, endDate)
        ];

        const projectsWithTargetDates = await db
          .select({
            project: projects,
            projectType: projectTypes,
            service: services,
            client: clients,
            projectOwner: projectOwnerAlias,
            currentAssignee: currentAssigneeAlias,
            bookkeeper: bookkeeperAlias,
          })
          .from(projects)
          .leftJoin(projectTypes, eq(projects.projectTypeId, projectTypes.id))
          .leftJoin(services, eq(projectTypes.serviceId, services.id))
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .leftJoin(projectOwnerAlias, eq(projects.projectOwnerId, projectOwnerAlias.id))
          .leftJoin(currentAssigneeAlias, eq(projects.currentAssigneeId, currentAssigneeAlias.id))
          .leftJoin(bookkeeperAlias, eq(projects.bookkeeperId, bookkeeperAlias.id))
          .where(and(...targetDateConditions));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const row of projectsWithTargetDates) {
          const targetDate = new Date(row.project.targetDeliveryDate!);
          const isOverdue = targetDate < today;
          const assigneeId = row.project.currentAssigneeId || row.project.bookkeeperId;

          events.push({
            id: `project_target_${row.project.id}`,
            type: "project_target",
            title: row.projectType?.name || row.project.description,
            date: row.project.targetDeliveryDate!.toISOString(),
            entityId: row.project.id,
            entityType: "project",
            assigneeId: assigneeId,
            assigneeName: assigneeId ? getUserFullName(usersMap.get(assigneeId)) : null,
            clientId: row.project.clientId,
            clientName: row.client?.name || null,
            status: row.project.currentStatus,
            color: assigneeId ? userColors[assigneeId] : '#6b7280',
            isOverdue,
            meta: {
              projectTypeName: row.projectType?.name,
              serviceName: row.service?.name,
              serviceId: row.service?.id,
              priority: row.project.priority || undefined,
              description: row.project.description,
            },
          });
        }
      }

      if (includeTasksBool) {
        let taskWhereConditions: any[] = [
          isNotNull(internalTasks.dueDate),
          gte(internalTasks.dueDate, startDate),
          lte(internalTasks.dueDate, endDate),
          ne(internalTasks.status, 'closed'),
        ];

        if (!showArchivedBool) {
          taskWhereConditions.push(
            or(
              eq(internalTasks.isArchived, false),
              isNull(internalTasks.isArchived)
            )!
          );
        }

        if (taskAssigneeFilter && taskAssigneeFilter !== 'all') {
          taskWhereConditions.push(eq(internalTasks.assignedTo, taskAssigneeFilter as string));
        }

        const assigneeAlias = alias(users, 'assignee');
        const creatorAlias = alias(users, 'creator');

        const tasksWithDueDates = await db
          .select({
            task: internalTasks,
            assignee: assigneeAlias,
            creator: creatorAlias,
          })
          .from(internalTasks)
          .leftJoin(assigneeAlias, eq(internalTasks.assignedTo, assigneeAlias.id))
          .leftJoin(creatorAlias, eq(internalTasks.createdBy, creatorAlias.id))
          .where(and(...taskWhereConditions));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const row of tasksWithDueDates) {
          const dueDate = new Date(row.task.dueDate!);
          const isOverdue = dueDate < today && row.task.status !== 'closed';
          const assigneeId = row.task.assignedTo;

          events.push({
            id: `task_due_${row.task.id}`,
            type: "task_due",
            title: row.task.title,
            date: row.task.dueDate!.toISOString(),
            entityId: row.task.id,
            entityType: "task",
            assigneeId: assigneeId,
            assigneeName: getUserFullName(row.assignee),
            clientId: null,
            clientName: null,
            status: row.task.status,
            color: assigneeId ? userColors[assigneeId] : '#6b7280',
            isOverdue,
            meta: {
              priority: row.task.priority,
              description: row.task.description || undefined,
            },
          });
        }
      }

      const response: CalendarEventsResponse = {
        events,
        userColors,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching calendar events:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch calendar events" });
    }
  });
}
