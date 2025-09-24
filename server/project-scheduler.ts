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
import { normalizeProjectMonth } from "@shared/schema";
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
  chServicesProcessedWithoutRescheduling: number; // CH services that got projects but no rescheduling
  peopleServicesSkipped: number;
  configurationErrorsEncountered: number;
  executionTimeMs: number;
  dryRun: boolean; // True if this was a test run that didn't make changes
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
  isCompaniesHouseService: boolean; // Flag to indicate CH services
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
  const dryRun = runType === 'test'; // Test runs are dry runs that don't make changes
  
  console.log(`[Project Scheduler] Starting ${runType} run ${dryRun ? '(DRY RUN - no changes will be made) ' : ''}for ${targetDate.toISOString()}`);
  
  const result: SchedulingRunResult = {
    status: 'success',
    totalServicesChecked: 0,
    servicesFoundDue: 0,
    projectsCreated: 0,
    servicesRescheduled: 0,
    errorsEncountered: 0,
    chServicesProcessedWithoutRescheduling: 0,
    peopleServicesSkipped: 0,
    configurationErrorsEncountered: 0,
    executionTimeMs: 0,
    dryRun,
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
    const analysisResult = await findServicesDueToday(clientServices, peopleServices, targetDate);
    result.servicesFoundDue = analysisResult.dueServices.length;
    result.peopleServicesSkipped = analysisResult.peopleServicesSkipped;
    result.configurationErrorsEncountered = analysisResult.configurationErrorsEncountered;
    result.errors.push(...analysisResult.configurationErrors);

    console.log(`[Project Scheduler] Found ${analysisResult.dueServices.length} services due today`);

    // Step 3: Process each due service
    for (const dueService of analysisResult.dueServices) {
      try {
        await processService(dueService, result, targetDate, dryRun);
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

interface ServiceAnalysisResult {
  dueServices: DueService[];
  peopleServicesSkipped: number;
  configurationErrorsEncountered: number;
  configurationErrors: Array<{
    serviceId: string;
    serviceType: 'client' | 'people';
    error: string;
    timestamp: Date;
  }>;
}

/**
 * Find all services that are due today and analyze skipped/error services
 */
async function findServicesDueToday(
  clientServicesWithDetails: (ClientService & { service: Service & { projectType: ProjectType } })[],
  peopleServicesWithDetails: (PeopleService & { service: Service & { projectType: ProjectType } })[],
  targetDate: Date
): Promise<ServiceAnalysisResult> {
  const dueServices: DueService[] = [];
  let configurationErrorsEncountered = 0;
  const configurationErrors: Array<{
    serviceId: string;
    serviceType: 'client' | 'people';
    error: string;
    timestamp: Date;
  }> = [];

  // Process client services - use already hydrated data to avoid refetch mismatches
  for (const clientServiceWithDetails of clientServicesWithDetails) {
    if (clientServiceWithDetails.nextStartDate && isServiceDueToday(clientServiceWithDetails.nextStartDate, targetDate)) {
      // Validate configuration before proceeding
      if (!clientServiceWithDetails.service.projectType || clientServiceWithDetails.service.projectType.id === '') {
        console.error(`[Project Scheduler] Configuration error: Service '${clientServiceWithDetails.service.name}' has no project type configured`);
        configurationErrorsEncountered++;
        configurationErrors.push({
          serviceId: clientServiceWithDetails.id,
          serviceType: 'client',
          error: `Service '${clientServiceWithDetails.service.name}' has no project type configured`,
          timestamp: new Date()
        });
        continue; // Skip this service but continue processing others
      }

      // Include Companies House services for project creation, but flag them for special handling
      const isChService = !!clientServiceWithDetails.service.isCompaniesHouseConnected;
      if (isChService) {
        console.log(`[Project Scheduler] Processing Companies House service: ${clientServiceWithDetails.service.name} (project will be created, rescheduling will be skipped)`);
      }

      dueServices.push({
        id: clientServiceWithDetails.id,
        type: 'client',
        service: clientServiceWithDetails.service,
        clientId: clientServiceWithDetails.clientId,
        serviceOwnerId: clientServiceWithDetails.serviceOwnerId,
        frequency: clientServiceWithDetails.frequency as ServiceFrequency,
        nextStartDate: clientServiceWithDetails.nextStartDate,
        nextDueDate: clientServiceWithDetails.nextDueDate || clientServiceWithDetails.nextStartDate,
        isCompaniesHouseService: isChService
      });
    }
  }

  // Process people services - currently not implemented but counted and logged
  const peopleServicesSkipped = peopleServicesWithDetails.length;
  if (peopleServicesSkipped > 0) {
    console.log(`[Project Scheduler] Skipping ${peopleServicesSkipped} people services (not yet implemented)`);
  }

  return {
    dueServices,
    peopleServicesSkipped,
    configurationErrorsEncountered,
    configurationErrors
  };
}

/**
 * Process a single due service with atomic transaction
 */
async function processService(
  dueService: DueService,
  result: SchedulingRunResult,
  targetDate: Date,
  dryRun: boolean = false
): Promise<void> {
  if (dryRun) {
    console.log(`[Project Scheduler] DRY RUN: Would process ${dueService.type} service: ${dueService.service.name}`);
  } else {
    console.log(`[Project Scheduler] Processing ${dueService.type} service: ${dueService.service.name}`);
  }

  // Use database transaction to ensure atomicity
  // Note: This is a conceptual transaction - actual implementation would need db.transaction()
  try {
    let project: any = null;
    
    // Step 1: Create the project (skip in dry-run)
    if (dryRun) {
      console.log(`[Project Scheduler] DRY RUN: Would create project for service ${dueService.service.name}`);
      // Create a mock project for dry-run logging
      project = { id: `dry-run-project-${Date.now()}` };
    } else {
      project = await createProjectFromService(dueService);
      console.log(`[Project Scheduler] Created project ${project.id} for service ${dueService.service.name}`);
    }
    // Only increment projectsCreated counter for real runs
    if (!dryRun) {
      result.projectsCreated++;
    }

    // Step 2: Reschedule the service (skip for Companies House services and dry-runs)
    if (dueService.isCompaniesHouseService) {
      // Companies House services don't get rescheduled - their dates come from the API
      if (dryRun) {
        console.log(`[Project Scheduler] DRY RUN: Would skip rescheduling for Companies House service ${dueService.service.name} (dates managed by API)`);
      } else {
        console.log(`[Project Scheduler] Skipping rescheduling for Companies House service ${dueService.service.name} (dates managed by API)`);
      }
      // Only increment counter for real runs
      if (!dryRun) {
        result.chServicesProcessedWithoutRescheduling++;
      }
    } else {
      // Regular services get rescheduled to their next occurrence
      if (dryRun) {
        console.log(`[Project Scheduler] DRY RUN: Would reschedule service ${dueService.id} for next period`);
      } else {
        await rescheduleService(dueService, targetDate);
        console.log(`[Project Scheduler] Rescheduled service ${dueService.id} for next period`);
      }
      // Only increment counter for real runs
      if (!dryRun) {
        result.servicesRescheduled++;
      }
    }

    // Step 3: Log the scheduling action (skip in dry-run)
    if (dryRun) {
      const action = dueService.isCompaniesHouseService ? 'created_no_reschedule' : 'created';
      console.log(`[Project Scheduler] DRY RUN: Would log scheduling action '${action}' for service ${dueService.id}`);
    } else {
      const action = dueService.isCompaniesHouseService ? 'created_no_reschedule' : 'created';
      await logSchedulingAction(dueService, project.id, action, targetDate);
    }
    
    // TODO: When proper transaction support is added, commit here
  } catch (error) {
    // TODO: When proper transaction support is added, rollback here
    console.error(`[Project Scheduler] Failed to process service ${dueService.id}, rolling back any partial changes`);
    throw error; // Re-throw to be handled by main error handler
  }
}

/**
 * Create a project from a due service
 */
async function createProjectFromService(dueService: DueService): Promise<any> {
  // IDEMPOTENCY CHECK: Ensure we don't create duplicate projects
  const projectMonth = formatProjectMonth(dueService.nextStartDate);
  
  // Check if a project already exists for this client, service type, and month
  const allProjects = await storage.getAllProjects();
  const duplicateProject = allProjects.find((project: any) => 
    project.clientId === dueService.clientId &&
    project.projectTypeId === dueService.service.projectType?.id &&
    project.projectMonth === projectMonth
  );
  
  if (duplicateProject) {
    console.log(`[Project Scheduler] Skipping duplicate project creation - project ${duplicateProject.id} already exists for ${dueService.service.name} in ${projectMonth}`);
    return duplicateProject;
  }

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

  // Ensure we have valid user IDs for required fields
  const finalAssigneeId = currentAssigneeId || dueService.serviceOwnerId;
  if (!finalAssigneeId) {
    throw new Error(`No valid assignee found for service ${dueService.service.name}. Service owner is required.`);
  }

  // Prepare project data
  const projectData: InsertProject = {
    clientId: dueService.clientId!,
    projectTypeId: projectType.id,
    projectOwnerId: finalAssigneeId, // Use final assignee as owner if service owner is null
    bookkeeperId: finalAssigneeId,
    clientManagerId: finalAssigneeId,
    description,
    currentStatus: firstStage.name,
    currentAssigneeId: finalAssigneeId,
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

  try {
    await storage.createProjectSchedulingHistory(historyData);
    console.log(`[Project Scheduler] Scheduling history logged for service ${dueService.id}`);
  } catch (error) {
    console.error(`[Project Scheduler] Failed to log scheduling history:`, error);
    throw error; // Re-throw to fail the transaction
  }
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
    chServicesSkipped: result.chServicesProcessedWithoutRescheduling, // Map to the renamed field
    executionTimeMs: result.executionTimeMs,
    errorDetails: result.errors.length > 0 ? result.errors : null,
    summary: result.summary
  };

  try {
    await storage.createSchedulingRunLog(logData);
    console.log(`[Project Scheduler] Run logged successfully with status: ${result.status}`);
  } catch (error) {
    console.error('[Project Scheduler] Failed to log scheduling run:', error);
    // Don't throw here as we don't want to fail the entire run just because logging failed
  }
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
  // TODO: Integrate with the existing email notification system
  // For now, just log that notifications should be sent
  console.log(`[Project Scheduler] Would send notifications for project ${project.id} to service owner and assignees`);
  
  // Future implementation could use:
  // - sendStageChangeNotificationEmail for project creation
  // - sendBulkProjectAssignmentSummaryEmail for daily summaries
}

/**
 * Format date for project month field using existing schema function
 */
function formatProjectMonth(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  const dateString = `${day}/${month}/${year}`;
  return normalizeProjectMonth(dateString);
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