/**
 * Project Scheduler Service
 * Core service that creates projects from due services
 */

import { storage } from "./storage";
import { 
  calculateNextServiceDates, 
  isServiceDueToday, 
  getOverdueServices,
  type ServiceFrequency 
} from "./frequency-calculator";
import type { 
  ClientService, 
  PeopleService, 
  Service,
  ProjectType,
  KanbanStage,
  InsertProject,
  InsertProjectSchedulingHistory,
  InsertSchedulingRunLogs 
} from "@shared/schema";

export interface SchedulingRunResult {
  status: 'success' | 'partial_failure' | 'failure';
  totalServicesChecked: number;
  servicesFoundDue: number;
  projectsCreated: number;
  servicesRescheduled: number;
  errorsEncountered: number;
  chServicesSkipped: number;
  executionTimeMs: number;
  errors: Array<{
    serviceId: string;
    serviceType: 'client' | 'people';
    error: string;
    timestamp: Date;
  }>;
  summary: string;
}

interface DueService {
  id: string;
  type: 'client' | 'people';
  service: Service & { projectType: ProjectType; };
  clientId?: string;
  personId?: string;
  serviceOwnerId: string | null;
  frequency: ServiceFrequency;
  nextStartDate: Date;
  nextDueDate: Date;
}

/**
 * Main function to run the project scheduling process
 */
export async function runProjectScheduling(
  runType: 'scheduled' | 'manual' | 'test' = 'scheduled',
  targetDate: Date = new Date()
): Promise<SchedulingRunResult> {
  const startTime = Date.now();
  const runDate = new Date();
  
  console.log(`[Project Scheduler] Starting ${runType} run for ${targetDate.toISOString()}`);
  
  const result: SchedulingRunResult = {
    status: 'success',
    totalServicesChecked: 0,
    servicesFoundDue: 0,
    projectsCreated: 0,
    servicesRescheduled: 0,
    errorsEncountered: 0,
    chServicesSkipped: 0,
    executionTimeMs: 0,
    errors: [],
    summary: ''
  };

  try {
    // Step 1: Get all client services and people services
    const [clientServices, peopleServices] = await Promise.all([
      storage.getAllClientServicesWithDetails(),
      storage.getAllPeopleServicesWithDetails()
    ]);

    console.log(`[Project Scheduler] Found ${clientServices.length} client services and ${peopleServices.length} people services`);
    
    result.totalServicesChecked = clientServices.length + peopleServices.length;

    // Step 2: Find services that are due today
    const dueServices = await findServicesDueToday(clientServices, peopleServices, targetDate);
    result.servicesFoundDue = dueServices.length;

    console.log(`[Project Scheduler] Found ${dueServices.length} services due today`);

    // Step 3: Process each due service
    for (const dueService of dueServices) {
      try {
        await processService(dueService, result, targetDate);
      } catch (error) {
        result.errorsEncountered++;
        result.errors.push({
          serviceId: dueService.id,
          serviceType: dueService.type,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
        console.error(`[Project Scheduler] Error processing service ${dueService.id}:`, error);
      }
    }

    // Step 4: Generate summary
    result.executionTimeMs = Date.now() - startTime;
    result.summary = generateRunSummary(result);
    
    // Determine overall status
    if (result.errorsEncountered === 0) {
      result.status = 'success';
    } else if (result.projectsCreated > 0) {
      result.status = 'partial_failure';
    } else {
      result.status = 'failure';
    }

    console.log(`[Project Scheduler] ${runType} run completed in ${result.executionTimeMs}ms with status: ${result.status}`);

  } catch (error) {
    result.status = 'failure';
    result.executionTimeMs = Date.now() - startTime;
    result.summary = `Critical error during scheduling run: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('[Project Scheduler] Critical error during scheduling run:', error);
  }

  // Step 5: Log the run results
  try {
    await logSchedulingRun(runDate, runType, result);
  } catch (error) {
    console.error('[Project Scheduler] Failed to log scheduling run:', error);
  }

  return result;
}

/**
 * Find all services that are due today
 */
async function findServicesDueToday(
  clientServices: ClientService[],
  peopleServices: PeopleService[],
  targetDate: Date
): Promise<DueService[]> {
  const dueServices: DueService[] = [];

  // Process client services
  for (const clientService of clientServices) {
    if (clientService.nextStartDate && isServiceDueToday(clientService.nextStartDate, targetDate)) {
      try {
        const service = await storage.getServiceById(clientService.serviceId);
        if (service) {
          // Check if this is a Companies House service
          if (service.isCompaniesHouseConnected) {
            // Skip CH services - they get updated from API, not scheduled
            console.log(`[Project Scheduler] Skipping Companies House service: ${service.name}`);
            continue;
          }

          dueServices.push({
            id: clientService.id,
            type: 'client',
            service: service as Service & { projectType: ProjectType; },
            clientId: clientService.clientId,
            serviceOwnerId: clientService.serviceOwnerId,
            frequency: clientService.frequency as ServiceFrequency,
            nextStartDate: clientService.nextStartDate,
            nextDueDate: clientService.nextDueDate || clientService.nextStartDate
          });
        }
      } catch (error) {
        console.error(`[Project Scheduler] Error loading service ${clientService.serviceId}:`, error);
      }
    }
  }

  // Process people services (if they have scheduling dates)
  for (const peopleService of peopleServices) {
    // People services might not have nextStartDate/nextDueDate yet
    // This could be extended in the future for personal services
    // For now, we'll skip people services
  }

  return dueServices;
}

/**
 * Process a single due service
 */
async function processService(
  dueService: DueService,
  result: SchedulingRunResult,
  targetDate: Date
): Promise<void> {
  console.log(`[Project Scheduler] Processing ${dueService.type} service: ${dueService.service.name}`);

  // Step 1: Create the project
  const project = await createProjectFromService(dueService);
  result.projectsCreated++;

  console.log(`[Project Scheduler] Created project ${project.id} for service ${dueService.service.name}`);

  // Step 2: Reschedule the service
  await rescheduleService(dueService, targetDate);
  result.servicesRescheduled++;

  console.log(`[Project Scheduler] Rescheduled service ${dueService.id} for next period`);

  // Step 3: Log the scheduling action
  await logSchedulingAction(dueService, project.id, 'created', targetDate);
}

/**
 * Create a project from a due service
 */
async function createProjectFromService(dueService: DueService): Promise<any> {
  // Get the project type associated with this service
  let projectType: ProjectType;
  
  if (dueService.service.projectType && dueService.service.projectType.id) {
    projectType = dueService.service.projectType;
  } else {
    // If no project type is linked to the service, we need to create or find a default one
    throw new Error(`No project type configured for service: ${dueService.service.name}`);
  }

  // Get the first kanban stage for this project type
  const stages = await storage.getKanbanStagesByProjectTypeId(projectType.id);
  if (stages.length === 0) {
    throw new Error(`No kanban stages configured for project type: ${projectType.name}`);
  }

  const firstStage = stages.sort((a, b) => a.order - b.order)[0];

  // Determine assignees based on stage configuration
  let currentAssigneeId = dueService.serviceOwnerId;
  
  if (firstStage.assignedUserId) {
    currentAssigneeId = firstStage.assignedUserId;
  } else if (firstStage.assignedWorkRoleId) {
    // Get user assigned to this role for this service
    if (dueService.type === 'client' && dueService.clientId) {
      const roleAssignments = await storage.getClientServiceRoleAssignments(dueService.id);
      const roleAssignment = roleAssignments.find(ra => ra.workRoleId === firstStage.assignedWorkRoleId && ra.isActive);
      if (roleAssignment) {
        currentAssigneeId = roleAssignment.userId;
      }
    }
  }

  // Create project description
  const clientName = dueService.clientId ? (await storage.getClientById(dueService.clientId))?.name : 'Unknown Client';
  const description = `${dueService.service.name} - ${clientName}`;

  // Prepare project data
  const projectData: InsertProject = {
    clientId: dueService.clientId!,
    projectTypeId: projectType.id,
    projectOwnerId: dueService.serviceOwnerId,
    bookkeeperId: currentAssigneeId || dueService.serviceOwnerId, // Fallback to service owner
    clientManagerId: currentAssigneeId || dueService.serviceOwnerId, // Fallback to service owner
    description,
    currentStatus: firstStage.name,
    currentAssigneeId,
    priority: 'medium',
    dueDate: dueService.nextDueDate,
    projectMonth: formatProjectMonth(dueService.nextStartDate)
  };

  // Create the project
  const project = await storage.createProject(projectData);

  // Send notifications to relevant users
  await sendProjectCreatedNotifications(project, dueService);

  return project;
}

/**
 * Reschedule a service to its next occurrence
 */
async function rescheduleService(dueService: DueService, targetDate: Date): Promise<void> {
  // Calculate next dates
  const { nextStartDate, nextDueDate } = calculateNextServiceDates(
    dueService.nextStartDate,
    dueService.nextDueDate,
    dueService.frequency
  );

  // Update the service
  if (dueService.type === 'client') {
    await storage.updateClientService(dueService.id, {
      nextStartDate: nextStartDate.toISOString(),
      nextDueDate: nextDueDate.toISOString()
    });
  } else if (dueService.type === 'people') {
    // Update people service when support is added
    console.log('[Project Scheduler] People service rescheduling not yet implemented');
  }
}

/**
 * Log a scheduling action for audit trail
 */
async function logSchedulingAction(
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

  // Note: This assumes the storage method exists - will need to implement it
  // await storage.createProjectSchedulingHistory(historyData);
  console.log('[Project Scheduler] Scheduling history logged:', historyData);
}

/**
 * Log the overall scheduling run
 */
async function logSchedulingRun(
  runDate: Date,
  runType: string,
  result: SchedulingRunResult
): Promise<void> {
  const logData: InsertSchedulingRunLogs = {
    runDate,
    runType,
    status: result.status,
    totalServicesChecked: result.totalServicesChecked,
    servicesFoundDue: result.servicesFoundDue,
    projectsCreated: result.projectsCreated,
    servicesRescheduled: result.servicesRescheduled,
    errorsEncountered: result.errorsEncountered,
    chServicesSkipped: result.chServicesSkipped,
    executionTimeMs: result.executionTimeMs,
    errorDetails: result.errors.length > 0 ? result.errors : null,
    summary: result.summary
  };

  // Note: This assumes the storage method exists - will need to implement it
  // await storage.createSchedulingRunLog(logData);
  console.log('[Project Scheduler] Run logged:', logData);
}

/**
 * Generate a human-readable summary of the run
 */
function generateRunSummary(result: SchedulingRunResult): string {
  const { totalServicesChecked, servicesFoundDue, projectsCreated, errorsEncountered } = result;
  
  let summary = `Checked ${totalServicesChecked} services, found ${servicesFoundDue} due. `;
  summary += `Created ${projectsCreated} projects`;
  
  if (errorsEncountered > 0) {
    summary += `, encountered ${errorsEncountered} errors`;
  }
  
  summary += `.`;
  
  return summary;
}

/**
 * Send notifications about newly created projects
 */
async function sendProjectCreatedNotifications(project: any, dueService: DueService): Promise<void> {
  // This would integrate with the existing email notification system
  // For now, just log that notifications should be sent
  console.log(`[Project Scheduler] Would send notifications for project ${project.id} to service owner and assignees`);
}

/**
 * Format date for project month field
 */
function formatProjectMonth(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Get analysis of overdue services (for reporting)
 */
export async function getOverdueServicesAnalysis(targetDate: Date = new Date()) {
  const [clientServices, peopleServices] = await Promise.all([
    storage.getAllClientServicesWithDetails(),
    storage.getAllPeopleServicesWithDetails()
  ]);

  const allServices = [
    ...clientServices.map(cs => ({
      id: cs.id,
      nextStartDate: cs.nextStartDate,
      frequency: cs.frequency as ServiceFrequency,
      type: 'client' as const,
      serviceName: 'Unknown', // Would need to join with service
      clientName: 'Unknown'   // Would need to join with client
    })),
    // Add people services when supported
  ];

  return getOverdueServices(allServices, targetDate);
}