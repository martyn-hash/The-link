/**
 * ==========================================
 * PROTECTED CORE MODULE: PROJECT CREATOR
 * ==========================================
 * 
 * DO NOT MODIFY WITHOUT THOROUGH REVIEW
 * 
 * This module contains critical project creation logic.
 * Any changes could break the automated scheduling system.
 * 
 * Last validated: October 2025
 * ==========================================
 */

import { storage } from "../storage";
import { normalizeProjectMonth } from "@shared/schema";
import type {
  ClientService,
  PeopleService,
  Service,
  ProjectType,
  InsertProject,
  Project,
  InsertProjectSchedulingHistory
} from "@shared/schema";

export interface DueService {
  id: string;
  type: 'client' | 'people';
  service: Service & { projectType: ProjectType };
  clientId?: string;
  personId?: string;
  serviceOwnerId: string | null;
  frequency: string;
  nextStartDate: Date;
  nextDueDate: Date;
  isCompaniesHouseService: boolean;
}

/**
 * Check if a project already exists for the given parameters
 * This ensures idempotency - prevents duplicate projects
 */
export async function checkForDuplicateProject(
  clientId: string,
  projectTypeId: string,
  scheduledDate: Date
): Promise<Project | null> {
  const dateString = scheduledDate.toISOString().split('T')[0];
  const allProjects = await storage.getAllProjects();
  
  const duplicateProject = allProjects.find((project: any) => {
    if (project.clientId !== clientId || project.projectTypeId !== projectTypeId) {
      return false;
    }
    const projectDate = project.createdAt ? project.createdAt.toISOString().split('T')[0] : null;
    return projectDate === dateString;
  });
  
  return duplicateProject || null;
}

/**
 * Check scheduling history to prevent duplicate projects
 * This is a second layer of protection against duplicates
 */
export async function checkSchedulingHistory(
  serviceId: string,
  serviceType: 'client' | 'people',
  scheduledDate: Date
): Promise<boolean> {
  const dateString = scheduledDate.toISOString().split('T')[0];
  const schedulingHistory = await storage.getProjectSchedulingHistoryByServiceId(serviceId, serviceType);
  
  return schedulingHistory.some((history: any) => {
    const historyDate = history.scheduledDate ? history.scheduledDate.toISOString().split('T')[0] : null;
    return historyDate === dateString && history.action === 'project_created';
  });
}

/**
 * Handle single-project-per-client constraint
 * Some project types only allow one active project per client
 */
export async function handleSingleProjectConstraint(
  clientId: string,
  projectType: ProjectType,
  nextStartDate: Date
): Promise<void> {
  if (!projectType.singleProjectPerClient) {
    return; // No constraint to enforce
  }

  const activeProjects = await storage.getActiveProjectsByClientAndType(clientId, projectType.id);
  
  for (const oldProject of activeProjects) {
    // Mark as completed unsuccessfully and archive
    await storage.updateProject(oldProject.id, {
      completionStatus: 'completed_unsuccessfully',
      archived: true,
      inactive: true
    });
    
    // Log the action in chronology
    await storage.createChronologyEntry({
      projectId: oldProject.id,
      fromStatus: oldProject.currentStatus,
      toStatus: 'Archived (Auto-closed)',
      assigneeId: oldProject.currentAssigneeId || undefined,
      changeReason: 'Automatic closure - new project scheduled',
      notes: `Automatically archived because new ${projectType.name} project was scheduled for ${nextStartDate.toISOString().split('T')[0]}`
    });
    
    console.log(`[Project Creator] Auto-archived project ${oldProject.id} due to single-project-per-client constraint`);
  }
}

/**
 * Resolve assignee for a new project
 * Uses hierarchy: service owner > role assignment > stage default > fallback
 */
export async function resolveProjectAssignee(
  dueService: DueService,
  projectType: ProjectType
): Promise<string> {
  // 1. Try service owner
  if (dueService.serviceOwnerId) {
    const serviceOwner = await storage.getUser(dueService.serviceOwnerId);
    if (serviceOwner) {
      return dueService.serviceOwnerId;
    }
  }

  // 2. Try role assignments
  if (dueService.type === 'client' && dueService.clientId) {
    const clientService = await storage.getClientServiceByClientAndProjectType(
      dueService.clientId,
      projectType.id
    );
    
    if (clientService) {
      const roleAssignments = await storage.getClientServiceRoleAssignments(clientService.id);
      if (roleAssignments.length > 0) {
        // Get first active assignment
        const activeAssignment = roleAssignments.find(a => a.isActive);
        if (activeAssignment) {
          return activeAssignment.userId;
        }
      }
    }
  }

  // 3. Try first kanban stage default assignee
  const stages = await storage.getKanbanStagesByProjectTypeId(projectType.id);
  const firstStage = stages.sort((a, b) => a.order - b.order)[0];
  if (firstStage?.assignedUserId) {
    return firstStage.assignedUserId;
  }

  // 4. Fallback to admin
  const adminUser = await storage.getUserByEmail('admin@example.com');
  if (adminUser) {
    return adminUser.id;
  }

  // 5. Ultimate fallback - first user in system
  const allUsers = await storage.getAllUsers();
  if (allUsers.length > 0) {
    return allUsers[0].id;
  }

  throw new Error('No valid assignee could be determined for project');
}

/**
 * Build project data from a due service
 */
export async function buildProjectData(
  dueService: DueService,
  assigneeId: string
): Promise<InsertProject> {
  const projectType = dueService.service.projectType;
  
  // Get kanban stages
  const stages = await storage.getKanbanStagesByProjectTypeId(projectType.id);
  const firstStage = stages.sort((a, b) => a.order - b.order)[0];
  
  // Build description
  const projectMonth = formatProjectMonth(dueService.nextStartDate);
  const description = `${projectType.name} - ${projectMonth}`;
  
  // Get client details
  let clientName = '';
  let clientManagerId = assigneeId;
  let bookkeeperId = assigneeId;
  
  if (dueService.clientId) {
    const client = await storage.getClientById(dueService.clientId);
    if (client) {
      clientName = client.name || client.email || '';
      
      // Try to get specific role assignments
      if (dueService.type === 'client') {
        const clientService = await storage.getClientServiceById(dueService.id);
        if (clientService) {
          const roleAssignments = await storage.getClientServiceRoleAssignments(dueService.id);
          
          // Find bookkeeper assignment
          const bookKeeperRole = await storage.getWorkRoleByName('Bookkeeper');
          if (bookKeeperRole) {
            const bookKeeperAssignment = roleAssignments.find(
              a => a.workRoleId === bookKeeperRole.id && a.isActive
            );
            if (bookKeeperAssignment) {
              bookkeeperId = bookKeeperAssignment.userId;
            }
          }
          
          // Find client manager assignment
          const clientManagerRole = await storage.getWorkRoleByName('Client Manager');
          if (clientManagerRole) {
            const clientManagerAssignment = roleAssignments.find(
              a => a.workRoleId === clientManagerRole.id && a.isActive
            );
            if (clientManagerAssignment) {
              clientManagerId = clientManagerAssignment.userId;
            }
          }
        }
      }
    }
  }

  const projectData: InsertProject = {
    clientId: dueService.clientId || '',
    projectTypeId: projectType.id,
    projectOwnerId: dueService.serviceOwnerId || assigneeId,
    bookkeeperId,
    clientManagerId,
    description,
    currentStatus: firstStage?.name || 'Pending',
    currentAssigneeId: assigneeId,
    priority: 'medium',
    dueDate: dueService.nextDueDate.toISOString(),
    projectMonth,
    archived: false,
    inactive: false
  };

  return projectData;
}

/**
 * Create a project from a due service
 * This is the main function called by the scheduler
 */
export async function createProjectFromDueService(
  dueService: DueService
): Promise<Project> {
  const scheduledDate = dueService.nextStartDate;
  
  // 1. Check for duplicate project
  if (dueService.clientId) {
    const duplicate = await checkForDuplicateProject(
      dueService.clientId,
      dueService.service.projectType.id,
      scheduledDate
    );
    if (duplicate) {
      console.log(`[Project Creator] Skipping duplicate project for ${dueService.service.name}`);
      return duplicate;
    }
  }
  
  // 2. Check scheduling history
  const hasHistory = await checkSchedulingHistory(
    dueService.id,
    dueService.type,
    scheduledDate
  );
  if (hasHistory) {
    console.log(`[Project Creator] Project already created for this service and date`);
    throw new Error('Project already created for this service and date');
  }
  
  // 3. Handle single-project constraint
  if (dueService.clientId) {
    await handleSingleProjectConstraint(
      dueService.clientId,
      dueService.service.projectType,
      scheduledDate
    );
  }
  
  // 4. Resolve assignee
  const assigneeId = await resolveProjectAssignee(dueService, dueService.service.projectType);
  
  // 5. Build project data
  const projectData = await buildProjectData(dueService, assigneeId);
  
  // 6. Create the project
  const project = await storage.createProject(projectData);
  
  // 7. Log in scheduling history
  await logSchedulingAction(dueService, project.id, 'project_created', scheduledDate);
  
  console.log(`[Project Creator] Created project ${project.id} for service ${dueService.service.name}`);
  
  return project;
}

/**
 * Log scheduling action for audit trail
 */
export async function logSchedulingAction(
  dueService: DueService,
  projectId: string,
  action: string,
  scheduledDate: Date
): Promise<void> {
  const historyData: InsertProjectSchedulingHistory = {
    clientServiceId: dueService.type === 'client' ? dueService.id : null,
    peopleServiceId: dueService.type === 'people' ? dueService.id : null,
    projectId,
    action,
    scheduledDate,
    previousNextStartDate: dueService.nextStartDate,
    previousNextDueDate: dueService.nextDueDate,
    frequency: dueService.frequency,
    notes: `Project created for ${dueService.service.name}`
  };

  try {
    await storage.createProjectSchedulingHistory(historyData);
  } catch (error) {
    console.error('[Project Creator] Failed to log scheduling history:', error);
    throw error; // Re-throw to fail the transaction
  }
}

/**
 * Format date for project month field
 */
function formatProjectMonth(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  const dateString = `${day}/${month}/${year}`;
  return normalizeProjectMonth(dateString);
}

/**
 * Send notifications for newly created project
 */
export async function sendProjectNotifications(
  project: Project,
  dueService: DueService
): Promise<void> {
  try {
    // Implementation would go here for email/push notifications
    console.log(`[Project Creator] Would send notifications for project ${project.id}`);
  } catch (error) {
    console.error('[Project Creator] Failed to send notifications:', error);
    // Don't fail project creation if notifications fail
  }
}