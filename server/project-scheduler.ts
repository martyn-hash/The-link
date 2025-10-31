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
  intendedStartDay: number | null; // Intended day-of-month for start date (29-31)
  intendedDueDay: number | null; // Intended day-of-month for due date (29-31)
  isCompaniesHouseService: boolean; // Flag to indicate CH services
}

/**
 * Enhanced filtering options for scheduling
 */
interface SchedulingFilters {
  serviceIds?: string[];
  clientIds?: string[];
}

/**
 * Test data seeding interface
 */
interface TestServiceSeed {
  serviceName: string;
  description: string;
  frequency: ServiceFrequency;
  projectTypeRequired: boolean;
  isCompaniesHouseService?: boolean;
}

/**
 * Predefined test services for seeding
 */
const TEST_SERVICE_SEEDS: TestServiceSeed[] = [
  {
    serviceName: "Weekly Payroll Processing",
    description: "Process weekly payroll for employees",
    frequency: 'weekly',
    projectTypeRequired: true,
    isCompaniesHouseService: false
  },
  {
    serviceName: "Monthly Bookkeeping",
    description: "Monthly bookkeeping and reconciliation",
    frequency: 'monthly',
    projectTypeRequired: true,
    isCompaniesHouseService: false
  },
  {
    serviceName: "Quarterly VAT Return",
    description: "Quarterly VAT return preparation and submission",
    frequency: 'quarterly',
    projectTypeRequired: true,
    isCompaniesHouseService: false
  },
  {
    serviceName: "Annual Company Accounts",
    description: "Annual company accounts preparation",
    frequency: 'annually',
    projectTypeRequired: true,
    isCompaniesHouseService: false
  },
  {
    serviceName: "Companies House Confirmation Statement",
    description: "Annual confirmation statement filing",
    frequency: 'annually',
    projectTypeRequired: true,
    isCompaniesHouseService: true
  },
  {
    serviceName: "Daily Cash Flow Review",
    description: "Daily cash flow monitoring and reporting",
    frequency: 'daily',
    projectTypeRequired: true,
    isCompaniesHouseService: false
  }
];

/**
 * Simplified test data seeding using existing client services
 * Updates existing client services to have today's dates for immediate testing
 */
export async function seedTestServices(options: {
  clientIds?: string[];
  serviceIds?: string[];
  dryRun?: boolean;
} = {}): Promise<{
  status: 'success' | 'partial_failure' | 'failure';
  clientServicesUpdated: number;
  errors: string[];
  summary: string;
  dryRun?: boolean;
}> {
  console.log('[Test Seeding] Starting simplified test data seeding...');
  
  // Production safety guard
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test data seeding is disabled in production environment');
  }
  
  const result = {
    status: 'success' as 'success' | 'partial_failure' | 'failure',
    clientServicesUpdated: 0,
    errors: [] as string[],
    summary: '',
    dryRun: options.dryRun || false
  };

  try {
    // Get all existing client services
    let allClientServices = await storage.getAllClientServicesWithDetails();
    
    // Apply filters if specified
    if (options.clientIds?.length) {
      allClientServices = allClientServices.filter(cs => options.clientIds!.includes(cs.clientId));
      console.log(`[Test Seeding] Filtered to ${options.clientIds.length} specific clients`);
    }
    
    if (options.serviceIds?.length) {
      allClientServices = allClientServices.filter(cs => options.serviceIds!.includes(cs.serviceId));
      console.log(`[Test Seeding] Filtered to ${options.serviceIds.length} specific services`);
    }
    
    if (allClientServices.length === 0) {
      result.errors.push('No existing client services found - please create some client service assignments first');
      result.status = 'failure';
      result.summary = 'Failed: No client services available for seeding';
      return result;
    }

    console.log(`[Test Seeding] Found ${allClientServices.length} existing client services to update with today's dates${options.dryRun ? ' (DRY RUN)' : ''}`);

    // Create today's date for immediate testing (avoid UTC conversion issues)
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Update existing client services to have today's date
    for (const clientService of allClientServices) {
      try {
        // Calculate next due date based on frequency
        const nextDueDate = new Date(today);
        switch (clientService.frequency) {
          case 'weekly':
            nextDueDate.setDate(today.getDate() + 7);
            break;
          case 'monthly':
            nextDueDate.setMonth(today.getMonth() + 1);
            break;
          case 'quarterly':
            nextDueDate.setMonth(today.getMonth() + 3);
            break;
          case 'annually':
            nextDueDate.setFullYear(today.getFullYear() + 1);
            break;
          case 'daily':
            nextDueDate.setDate(today.getDate() + 1);
            break;
          case 'fortnightly':
            nextDueDate.setDate(today.getDate() + 14);
            break;
        }

        const nextDueDateString = `${nextDueDate.getFullYear()}-${String(nextDueDate.getMonth() + 1).padStart(2, '0')}-${String(nextDueDate.getDate()).padStart(2, '0')}`;

        if (options.dryRun) {
          console.log(`[Test Seeding] DRY RUN: Would update ${clientService.service.name} for client (${clientService.frequency}) - start: ${todayString}, due: ${nextDueDateString}`);
          result.clientServicesUpdated++; // Count would-be updates in dry run
        } else {
          // Update client service with today's dates
          await storage.updateClientService(clientService.id, {
            nextStartDate: todayString,
            nextDueDate: nextDueDateString
          });
          console.log(`[Test Seeding] Updated ${clientService.service.name} for client (${clientService.frequency}) - start: ${todayString}, due: ${nextDueDateString}`);
          result.clientServicesUpdated++; // Count actual updates
        }

      } catch (error) {
        const errorMsg = `Failed to update client service ${clientService.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`[Test Seeding] ${errorMsg}`);
      }
    }

    // Generate summary with improved status logic
    if (result.errors.length > 0 && result.clientServicesUpdated > 0) {
      result.status = 'partial_failure';
      result.summary = `Seeding completed with partial success: updated ${result.clientServicesUpdated} client services, encountered ${result.errors.length} errors.${options.dryRun ? ' (DRY RUN)' : ''}`;
    } else if (result.errors.length > 0) {
      result.status = 'failure';
      result.summary = `Seeding failed: ${result.errors.length} errors, no services updated.${options.dryRun ? ' (DRY RUN)' : ''}`;
    } else {
      result.summary = `Successfully ${options.dryRun ? 'previewed' : 'updated'} ${result.clientServicesUpdated} existing client services with today's dates for immediate testing.`;
    }

    console.log(`[Test Seeding] ${result.summary}`);
    return result;

  } catch (error) {
    result.status = 'failure';
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.summary = `Test seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('[Test Seeding] Fatal error:', error);
    return result;
  }
}

/**
 * Reset client service dates back to their original schedule
 * This is a placeholder - in practice, we'd need to store original dates
 */
export async function resetTestData(): Promise<{
  status: 'success' | 'failure';
  message: string;
}> {
  console.log('[Test Reset] Test data reset not implemented - this would restore original service dates');
  
  // Production safety guard
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test data reset is disabled in production environment');
  }
  
  return {
    status: 'failure',
    message: 'Reset functionality not yet implemented - manual database restore required for rollback'
  };
}

/**
 * Mock time progression tools for testing scheduling workflows over time
 * Simulates multiple days/weeks of scheduling runs to test comprehensive workflows
 */
export async function runMockTimeProgression(options: {
  startDate: Date;
  endDate: Date;
  filters?: SchedulingFilters;
  dryRun?: boolean;
  stepSize?: 'daily' | 'weekly';
}): Promise<{
  status: 'success' | 'partial_failure' | 'failure';
  totalDaysSimulated: number;
  schedulingRuns: Array<{
    date: string;
    result: SchedulingRunResult;
  }>;
  summary: string;
  errors: string[];
}> {
  console.log('[Mock Time] Starting time progression simulation...');
  
  // Production safety guard
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Mock time progression is disabled in production environment');
  }
  
  const result = {
    status: 'success' as 'success' | 'partial_failure' | 'failure',
    totalDaysSimulated: 0,
    schedulingRuns: [] as Array<{
      date: string;
      result: SchedulingRunResult;
    }>,
    summary: '',
    errors: [] as string[]
  };

  try {
    const startDate = new Date(options.startDate);
    const endDate = new Date(options.endDate);
    const stepDays = options.stepSize === 'weekly' ? 7 : 1;
    
    console.log(`[Mock Time] Simulating from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (${options.stepSize || 'daily'} steps)${options.dryRun ? ' - DRY RUN' : ''}`);
    
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      try {
        const dateString = currentDate.toISOString().split('T')[0];
        console.log(`[Mock Time] Simulating scheduling run for ${dateString}...`);
        
        // Run enhanced scheduling for this date
        const schedulingResult = await runProjectSchedulingEnhanced(
          options.dryRun ? 'test' : 'manual',
          new Date(currentDate),
          options.filters || {}
        );
        
        result.schedulingRuns.push({
          date: dateString,
          result: schedulingResult
        });
        
        result.totalDaysSimulated++;
        
        // Track errors from individual runs
        if (schedulingResult.status === 'failure') {
          result.errors.push(`Scheduling failed on ${dateString}: ${schedulingResult.summary}`);
        }
        
        console.log(`[Mock Time] ${dateString}: ${schedulingResult.servicesFoundDue} services due, ${schedulingResult.projectsCreated} projects created${schedulingResult.errorsEncountered > 0 ? `, ${schedulingResult.errorsEncountered} errors` : ''}`);
        
      } catch (error) {
        const dateString = currentDate.toISOString().split('T')[0];
        const errorMsg = `Failed to run scheduling for ${dateString}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`[Mock Time] ${errorMsg}`);
      }
      
      // Advance to next date
      currentDate.setDate(currentDate.getDate() + stepDays);
    }
    
    // Generate summary
    const totalServicesDue = result.schedulingRuns.reduce((sum, run) => sum + run.result.servicesFoundDue, 0);
    const totalProjectsCreated = result.schedulingRuns.reduce((sum, run) => sum + run.result.projectsCreated, 0);
    const totalErrors = result.errors.length;
    
    if (totalErrors > 0 && result.schedulingRuns.length > 0) {
      result.status = 'partial_failure';
      result.summary = `Time progression completed with partial success: ${result.totalDaysSimulated} days simulated, ${totalServicesDue} services found due, ${totalProjectsCreated} projects created, ${totalErrors} errors encountered.${options.dryRun ? ' (DRY RUN)' : ''}`;
    } else if (totalErrors > 0) {
      result.status = 'failure';
      result.summary = `Time progression failed: ${totalErrors} errors, no successful runs.${options.dryRun ? ' (DRY RUN)' : ''}`;
    } else {
      result.summary = `Successfully ${options.dryRun ? 'simulated' : 'executed'} ${result.totalDaysSimulated} days of scheduling: ${totalServicesDue} services found due, ${totalProjectsCreated} projects created.`;
    }
    
    console.log(`[Mock Time] ${result.summary}`);
    return result;

  } catch (error) {
    result.status = 'failure';
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    result.summary = `Mock time progression failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('[Mock Time] Fatal error:', error);
    return result;
  }
}

/**
 * Test scenario generators for common scheduling edge cases
 * Creates specific scenarios to validate scheduling logic
 */
export async function generateTestScenario(scenario: {
  name: string;
  type: 'weekly_payroll' | 'monthly_books' | 'quarterly_vat' | 'annual_accounts' | 'mixed_frequencies' | 'edge_cases';
  dryRun?: boolean;
}): Promise<{
  status: 'success' | 'failure';
  scenarioName: string;
  description: string;
  servicesAffected: number;
  recommendedTests: string[];
  summary: string;
}> {
  console.log(`[Test Scenario] Generating test scenario: ${scenario.name}`);
  
  // Production safety guard
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test scenario generation is disabled in production environment');
  }
  
  const result = {
    status: 'success' as 'success' | 'failure',
    scenarioName: scenario.name,
    description: '',
    servicesAffected: 0,
    recommendedTests: [] as string[],
    summary: ''
  };

  try {
    // Get existing client services to work with
    const allClientServices = await storage.getAllClientServicesWithDetails();
    
    switch (scenario.type) {
      case 'weekly_payroll':
        result.description = 'Weekly payroll services that should create multiple projects per month without being blocked by duplicate prevention';
        result.recommendedTests = [
          'Seed weekly payroll services with today\'s date',
          'Run scheduling daily for 4 weeks',
          'Verify 4 separate projects are created',
          'Confirm no duplicate prevention issues'
        ];
        // Filter to weekly services
        const weeklyServices = allClientServices.filter(cs => cs.frequency === 'weekly');
        result.servicesAffected = weeklyServices.length;
        break;
        
      case 'monthly_books':
        result.description = 'Monthly bookkeeping services with month-end timing and due date calculations';
        result.recommendedTests = [
          'Seed monthly services for month-end',
          'Test scheduling across month boundaries',
          'Verify correct next due date calculations',
          'Check weekend/holiday handling'
        ];
        const monthlyServices = allClientServices.filter(cs => cs.frequency === 'monthly');
        result.servicesAffected = monthlyServices.length;
        break;
        
      case 'quarterly_vat':
        result.description = 'Quarterly VAT services that must align with calendar quarters';
        result.recommendedTests = [
          'Seed quarterly services for quarter-end',
          'Test progression through multiple quarters',
          'Verify quarter alignment (Mar/Jun/Sep/Dec)',
          'Check long-term scheduling accuracy'
        ];
        const quarterlyServices = allClientServices.filter(cs => cs.frequency === 'quarterly');
        result.servicesAffected = quarterlyServices.length;
        break;
        
      case 'annual_accounts':
        result.description = 'Annual accounting services with year-end timing and long scheduling cycles';
        result.recommendedTests = [
          'Seed annual services for year-end',
          'Test multi-year progression',
          'Verify leap year handling',
          'Check long-term date accuracy'
        ];
        const annualServices = allClientServices.filter(cs => cs.frequency === 'annually');
        result.servicesAffected = annualServices.length;
        break;
        
      case 'mixed_frequencies':
        result.description = 'Mixed service frequencies to test complex scheduling interactions';
        result.recommendedTests = [
          'Seed all service types with overlapping dates',
          'Run time progression over 6 months',
          'Verify no interference between frequencies',
          'Check resource allocation and prioritization'
        ];
        result.servicesAffected = allClientServices.length;
        break;
        
      case 'edge_cases':
        result.description = 'Edge cases including leap years, weekends, holidays, and boundary conditions';
        result.recommendedTests = [
          'Test February 29th handling in leap years',
          'Test weekend due date adjustments',
          'Test month-end edge cases (Jan 31 -> Feb 28/29)',
          'Test Companies House service integration'
        ];
        result.servicesAffected = allClientServices.length;
        break;
        
      default:
        throw new Error(`Unknown scenario type: ${scenario.type}`);
    }
    
    result.summary = `Generated "${scenario.name}" scenario affecting ${result.servicesAffected} services with ${result.recommendedTests.length} recommended tests.`;
    console.log(`[Test Scenario] ${result.summary}`);
    
    return result;

  } catch (error) {
    result.status = 'failure';
    result.summary = `Failed to generate test scenario: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('[Test Scenario] Error:', error);
    return result;
  }
}

/**
 * Preview interface for detailed scheduling information
 */
export interface SchedulingPreviewItem {
  serviceId: string;
  serviceType: 'client' | 'people';
  clientName?: string;
  personName?: string;
  serviceName: string;
  frequency: ServiceFrequency;
  currentNextStartDate: Date;
  currentNextDueDate: Date;
  projectPlannedStart: Date;
  projectPlannedDue: Date;
  newNextStartDate: Date;
  newNextDueDate: Date;
  isCompaniesHouseService: boolean;
  projectTypeName: string;
  willCreateProject: boolean;
  willReschedule: boolean;
  configurationError?: string;
}

export interface SchedulingPreviewResult {
  status: 'success' | 'failure';
  targetDate: Date;
  totalServicesChecked: number;
  servicesFoundDue: number;
  previewItems: SchedulingPreviewItem[];
  configurationErrors: Array<{
    serviceId: string;
    serviceType: 'client' | 'people';
    error: string;
  }>;
  summary: string;
}

/**
 * Build a detailed preview of what would happen during scheduling without making changes
 */
export async function buildSchedulingPreview(
  targetDate: Date = new Date(),
  filters: SchedulingFilters = {}
): Promise<SchedulingPreviewResult> {
  console.log(`[Scheduling Preview] Building preview for ${targetDate.toISOString()}`);
  
  const result: SchedulingPreviewResult = {
    status: 'success',
    targetDate,
    totalServicesChecked: 0,
    servicesFoundDue: 0,
    previewItems: [],
    configurationErrors: [],
    summary: ''
  };

  try {
    // Step 1: Get all client services and people services
    let [clientServices, peopleServices] = await Promise.all([
      storage.getAllClientServicesWithDetails(),
      storage.getAllPeopleServicesWithDetails()
    ]);

    // Apply filters if specified
    if (filters.serviceIds?.length) {
      clientServices = clientServices.filter(cs => filters.serviceIds!.includes(cs.serviceId));
      peopleServices = peopleServices.filter(ps => filters.serviceIds!.includes(ps.serviceId));
    }
    
    if (filters.clientIds?.length) {
      clientServices = clientServices.filter(cs => filters.clientIds!.includes(cs.clientId));
    }

    result.totalServicesChecked = clientServices.length + peopleServices.length;

    // Step 2: Process client services that are due
    for (const clientService of clientServices) {
      if (clientService.nextStartDate && isServiceDueToday(clientService.nextStartDate, targetDate)) {
        result.servicesFoundDue++;

        // Check for configuration errors
        if (!clientService.service.projectType || clientService.service.projectType.id === '') {
          result.configurationErrors.push({
            serviceId: clientService.id,
            serviceType: 'client',
            error: `Service '${clientService.service.name}' has no project type configured`
          });
          continue;
        }

        // Get client name
        const client = await storage.getClientById(clientService.clientId);
        const clientName = client?.name || 'Unknown Client';

        const isChService = !!clientService.service.isCompaniesHouseConnected;
        
        // Calculate next dates using the same logic as the actual scheduler
        const { nextStartDate, nextDueDate } = calculateNextServiceDates(
          clientService.nextStartDate,
          clientService.nextDueDate || clientService.nextStartDate,
          clientService.frequency as ServiceFrequency
        );

        result.previewItems.push({
          serviceId: clientService.id,
          serviceType: 'client',
          clientName,
          serviceName: clientService.service.name,
          frequency: clientService.frequency as ServiceFrequency,
          currentNextStartDate: clientService.nextStartDate,
          currentNextDueDate: clientService.nextDueDate || clientService.nextStartDate,
          projectPlannedStart: clientService.nextStartDate,
          projectPlannedDue: clientService.nextDueDate || clientService.nextStartDate,
          newNextStartDate: nextStartDate,
          newNextDueDate: nextDueDate,
          isCompaniesHouseService: isChService,
          projectTypeName: clientService.service.projectType.name,
          willCreateProject: true,
          willReschedule: !isChService, // CH services don't get rescheduled
        });
      }
    }

    // Step 3: Process people services (currently not implemented in scheduling, just show they exist)
    // Note: People services don't have scheduling fields (frequency, nextStartDate, nextDueDate) yet
    if (peopleServices.length > 0) {
      console.log(`[Scheduling Preview] Found ${peopleServices.length} people services (scheduling not yet implemented)`);
      
      for (const peopleService of peopleServices) {
        // Get person name
        const person = await storage.getPersonById(peopleService.personId);
        const personName = person ? `${person.firstName} ${person.lastName}`.trim() : 'Unknown Person';

        // Add as preview item showing they're not scheduled yet
        result.previewItems.push({
          serviceId: peopleService.id,
          serviceType: 'people',
          personName,
          serviceName: peopleService.service.name,
          frequency: 'monthly' as ServiceFrequency, // Default placeholder
          currentNextStartDate: new Date(), // Placeholder
          currentNextDueDate: new Date(), // Placeholder
          projectPlannedStart: new Date(), // Placeholder
          projectPlannedDue: new Date(), // Placeholder
          newNextStartDate: new Date(), // Placeholder
          newNextDueDate: new Date(), // Placeholder
          isCompaniesHouseService: false,
          projectTypeName: peopleService.service.projectType?.name || 'No Project Type',
          willCreateProject: false, // People services not implemented yet
          willReschedule: false,
          configurationError: 'People services scheduling is not yet implemented'
        });
      }
    }

    result.summary = `Preview for ${targetDate.toISOString().split('T')[0]}: Found ${result.servicesFoundDue} due services out of ${result.totalServicesChecked} total. ${result.previewItems.filter(i => i.willCreateProject).length} projects would be created, ${result.previewItems.filter(i => i.willReschedule).length} services would be rescheduled.`;
    
    console.log(`[Scheduling Preview] ${result.summary}`);
    
  } catch (error) {
    result.status = 'failure';
    result.summary = `Failed to build scheduling preview: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('[Scheduling Preview] Error:', error);
  }

  return result;
}

/**
 * Enhanced function to run project scheduling with filtering capabilities
 */
export async function runProjectSchedulingEnhanced(
  runType: 'scheduled' | 'manual' | 'test' = 'scheduled',
  targetDate: Date = new Date(),
  filters: SchedulingFilters = {}
): Promise<SchedulingRunResult> {
  const startTime = Date.now();
  const runDate = new Date();
  const dryRun = runType === 'test'; // Test runs are dry runs that don't make changes
  
  const filterDescription = [];
  if (filters.serviceIds?.length) filterDescription.push(`${filters.serviceIds.length} specific services`);
  if (filters.clientIds?.length) filterDescription.push(`${filters.clientIds.length} specific clients`);
  const filterText = filterDescription.length > 0 ? ` (filtered: ${filterDescription.join(', ')})` : '';
  
  console.log(`[Project Scheduler] Starting enhanced ${runType} run ${dryRun ? '(DRY RUN - no changes will be made) ' : ''}for ${targetDate.toISOString()}${filterText}`);
  
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
    let [clientServices, peopleServices] = await Promise.all([
      storage.getAllClientServicesWithDetails(),
      storage.getAllPeopleServicesWithDetails()
    ]);

    // Apply filters if specified
    if (filters.serviceIds?.length) {
      clientServices = clientServices.filter(cs => filters.serviceIds!.includes(cs.serviceId));
      peopleServices = peopleServices.filter(ps => filters.serviceIds!.includes(ps.serviceId));
      console.log(`[Project Scheduler] Filtered to ${filters.serviceIds.length} specific services`);
    }
    
    if (filters.clientIds?.length) {
      clientServices = clientServices.filter(cs => filters.clientIds!.includes(cs.clientId));
      // Note: peopleServices don't have clientId, they have personId
      console.log(`[Project Scheduler] Filtered to ${filters.clientIds.length} specific clients`);
    }

    console.log(`[Project Scheduler] Found ${clientServices.length} client services and ${peopleServices.length} people services${filterText}`);
    
    result.totalServicesChecked = clientServices.length + peopleServices.length;

    // Step 2: Find services that are due today
    const analysisResult = await findServicesDueToday(clientServices, peopleServices, targetDate);
    result.servicesFoundDue = analysisResult.dueServices.length;
    result.peopleServicesSkipped = analysisResult.peopleServicesSkipped;
    result.configurationErrorsEncountered = analysisResult.configurationErrorsEncountered;
    result.errors.push(...analysisResult.configurationErrors);

    console.log(`[Project Scheduler] Found ${analysisResult.dueServices.length} services due today${filterText}`);

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
    
    const statusIndicators = [];
    if (result.errorsEncountered > 0) statusIndicators.push(`${result.errorsEncountered} errors`);
    if (result.configurationErrorsEncountered > 0) statusIndicators.push(`${result.configurationErrorsEncountered} config errors`);
    
    result.status = result.errorsEncountered > 0 ? (result.projectsCreated > 0 ? 'partial_failure' : 'failure') : 'success';
    
    result.summary = dryRun 
      ? `DRY RUN: Would have processed ${result.servicesFoundDue} services${filterText}, creating ${result.projectsCreated} projects and rescheduling ${result.servicesRescheduled} services. ${statusIndicators.join(', ')}`
      : `Processed ${result.servicesFoundDue} services${filterText}, created ${result.projectsCreated} projects and rescheduled ${result.servicesRescheduled} services. ${statusIndicators.join(', ')}`;

    console.log(`[Project Scheduler] Enhanced run completed in ${result.executionTimeMs}ms: ${result.summary}`);
  } catch (error) {
    result.errorsEncountered++;
    result.status = 'failure';
    result.executionTimeMs = Date.now() - startTime;
    result.summary = `Failed to run enhanced project scheduling: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push({
      serviceId: 'system',
      serviceType: 'client',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    });
    console.error('[Project Scheduler] Enhanced run failed:', error);
  }

  // Log the run result (skip in test mode to avoid cluttering logs)
  if (!dryRun) {
    try {
      await storage.createSchedulingRunLog({
        runDate,
        runType,
        status: result.status,
        totalServicesChecked: result.totalServicesChecked,
        servicesFoundDue: result.servicesFoundDue,
        projectsCreated: result.projectsCreated,
        servicesRescheduled: result.servicesRescheduled,
        errorsEncountered: result.errorsEncountered,
        chServicesSkipped: result.chServicesProcessedWithoutRescheduling,
        executionTimeMs: result.executionTimeMs,
        summary: result.summary,
        errorDetails: result.errors.length > 0 ? result.errors : null
      });
    } catch (error) {
      console.error('[Project Scheduler] Failed to log enhanced scheduling run:', error);
    }
  }

  return result;
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
    // Skip inactive services
    if (clientServiceWithDetails.isActive === false) {
      continue;
    }
    
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
        intendedStartDay: clientServiceWithDetails.intendedStartDay,
        intendedDueDay: clientServiceWithDetails.intendedDueDay,
        isCompaniesHouseService: isChService
      });
    }
  }

  // Process people services - currently not implemented but counted and logged
  // Only count active people services
  const activePeopleServices = peopleServicesWithDetails.filter(ps => ps.isActive !== false);
  const peopleServicesSkipped = activePeopleServices.length;
  if (peopleServicesSkipped > 0) {
    console.log(`[Project Scheduler] Skipping ${peopleServicesSkipped} active people services (not yet implemented)`);
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
    let wasExistingProject = false; // Track if we returned an existing project
    
    // Step 1: Create the project (skip in dry-run)
    if (dryRun) {
      console.log(`[Project Scheduler] DRY RUN: Would create project for service ${dueService.service.name}`);
      // Create a mock project for dry-run logging
      project = { id: `dry-run-project-${Date.now()}` };
    } else {
      const beforeCount = await storage.getAllProjects().then(p => p.length);
      project = await createProjectFromService(dueService);
      const afterCount = await storage.getAllProjects().then(p => p.length);
      wasExistingProject = (afterCount === beforeCount); // No new project was created
      
      if (wasExistingProject) {
        console.log(`[Project Scheduler] Returned existing project ${project.id} for service ${dueService.service.name} (duplicate prevented)`);
      } else {
        console.log(`[Project Scheduler] Created NEW project ${project.id} for service ${dueService.service.name}`);
      }
    }
    
    // Only increment projectsCreated counter for NEWLY created projects (not duplicates)
    if (!dryRun && !wasExistingProject) {
      result.projectsCreated++;
    }

    // Step 2: Log the scheduling action IMMEDIATELY (skip in dry-run OR if duplicate)
    // CRITICAL: Only log history for NEWLY created projects, not for duplicates
    // If we log history for duplicates, we create duplicate history entries
    if (dryRun) {
      const action = dueService.isCompaniesHouseService ? 'created_no_reschedule' : 'created';
      console.log(`[Project Scheduler] DRY RUN: Would log scheduling action '${action}' for service ${dueService.id}`);
    } else if (wasExistingProject) {
      console.log(`[Project Scheduler] ✓ Skipping history log for service ${dueService.id} (duplicate - history already exists)`);
    } else {
      const action = dueService.isCompaniesHouseService ? 'created_no_reschedule' : 'created';
      await logSchedulingAction(dueService, project.id, action, dueService.nextStartDate);
      console.log(`[Project Scheduler] ✓ Logged scheduling history for service ${dueService.id} (action: ${action})`);
    }

    // Step 3: Reschedule the service (skip for Companies House services and dry-runs)
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
        console.log(`[Project Scheduler] ✓ Rescheduled service ${dueService.id} for next period`);
      }
      // Only increment counter for real runs
      if (!dryRun) {
        result.servicesRescheduled++;
      }
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
  console.log(`[Project Scheduler] createProjectFromService ENTRY - Service: ${dueService.service.name} (${dueService.id})`);
  console.log(`[Project Scheduler] - DueService data:`, {
    serviceId: dueService.id,
    serviceName: dueService.service.name,
    clientId: dueService.clientId,
    projectTypeId: dueService.service.projectType?.id,
    serviceOwnerId: dueService.serviceOwnerId,
    frequency: dueService.frequency,
    nextStartDate: dueService.nextStartDate,
    nextDueDate: dueService.nextDueDate
  });
  
  // DUPLICATE PREVENTION: Check scheduling history for this service on this specific date
  // This is the primary and authoritative duplicate prevention mechanism
  // Uses exact date comparison to allow weekly services to create multiple projects per month
  const scheduledDate = dueService.nextStartDate.toISOString().split('T')[0];
  console.log(`[Project Scheduler] Checking for duplicates - Scheduled date: ${scheduledDate}`);

  // PRIMARY DUPLICATE CHECK: Scheduling history is the source of truth
  // This prevents multiple projects if multiple project types reference the same service for the same scheduled date
  // Critical: Uses exact date comparison, not month, to allow weekly services to create multiple projects per month
  if (dueService.type === 'client') {
    console.log(`[Project Scheduler] Querying scheduling history for service ${dueService.id}...`);
    const schedulingHistory = await storage.getProjectSchedulingHistoryByServiceId(dueService.id, dueService.type);
    console.log(`[Project Scheduler] Found ${schedulingHistory.length} scheduling history entries`);
    
    const existingProjectOnDate = schedulingHistory.find(entry => {
      if (!entry.projectId) return false;
      // Compare exact scheduled dates - critical for weekly services that run multiple times per month
      const entryDate = entry.scheduledDate.toISOString().split('T')[0];
      const targetDate = dueService.nextStartDate.toISOString().split('T')[0];
      const isMatch = entryDate === targetDate && (entry.action === 'created' || entry.action === 'created_no_reschedule');
      
      if (isMatch) {
        console.log(`[Project Scheduler] ✓ DUPLICATE DETECTED - History entry: date=${entryDate}, action=${entry.action}, projectId=${entry.projectId}`);
      }
      
      return isMatch;
    });

    if (existingProjectOnDate) {
      console.log(`[Project Scheduler] ⚠️ DUPLICATE PREVENTION - Service ${dueService.id} (${dueService.service.name}) already has project ${existingProjectOnDate.projectId} for ${scheduledDate}`);
      console.log(`[Project Scheduler] Returning existing project instead of creating duplicate`);
      
      // Retrieve and return the existing project (only if projectId exists)
      if (existingProjectOnDate.projectId) {
        const existingProject = await storage.getProject(existingProjectOnDate.projectId);
        if (existingProject) {
          return existingProject;
        } else {
          // Project was deleted but history remains - this is unusual but not an error
          console.warn(`[Project Scheduler] ⚠️ WARNING - History references project ${existingProjectOnDate.projectId} which no longer exists. Will create new project.`);
        }
      }
    }
    
    console.log(`[Project Scheduler] ✓ No duplicate found - proceeding with project creation`);
  }

  // Get the project type associated with this service
  let projectType: ProjectType;
  
  if (dueService.service.projectType && dueService.service.projectType.id) {
    projectType = dueService.service.projectType;
    
    // Double-check that the project type ID is valid
    if (!projectType.id || projectType.id.trim() === '') {
      throw new Error(`Invalid project type ID for service: ${dueService.service.name}`);
    }
  } else {
    // If no project type is linked to the service, we need to create or find a default one
    throw new Error(`No project type configured for service: ${dueService.service.name}`);
  }

  // NEW: SINGLE PROJECT PER CLIENT CONSTRAINT (opt-in via projectType.singleProjectPerClient flag)
  // This runs AFTER projectType validation but BEFORE the rest of project creation
  // If enabled, auto-archives any active projects of this type for this client before creating a new one
  if (projectType.singleProjectPerClient && dueService.clientId) {
    console.log(`[Project Scheduler] Checking single-project-per-client constraint for ${projectType.name}`);
    
    const activeProjects = await storage.getActiveProjectsByClientAndType(
      dueService.clientId,
      projectType.id
    );
    
    if (activeProjects.length > 0) {
      console.log(`[Project Scheduler] Found ${activeProjects.length} active project(s) for client ${dueService.clientId} and type ${projectType.name} - auto-marking as unsuccessful`);
      
      for (const oldProject of activeProjects) {
        // Mark the old project as completed unsuccessfully and archive it
        await storage.updateProject(oldProject.id, {
          completionStatus: 'completed_unsuccessfully',
          archived: true,
          inactive: true
        });
        
        // Log this action in project chronology
        await storage.createChronologyEntry({
          projectId: oldProject.id,
          fromStatus: oldProject.currentStatus,
          toStatus: 'Archived (Auto-closed)',
          assigneeId: oldProject.currentAssigneeId || undefined,
          changeReason: 'Automatic closure - new project scheduled',
          notes: `Automatically archived because new ${projectType.name} project was scheduled for ${dueService.nextStartDate.toISOString().split('T')[0]}`
        });
        
        console.log(`[Project Scheduler] Auto-archived project ${oldProject.id} as unsuccessful due to single-project-per-client constraint`);
      }
    } else {
      console.log(`[Project Scheduler] No active projects found - proceeding with new project creation`);
    }
  }

  // Get the first kanban stage for this project type
  console.log(`[Project Scheduler] DEBUG: Getting stages for projectType.id="${projectType.id}", projectType.name="${projectType.name}"`);
  console.log(`[Project Scheduler] DEBUG: projectType object:`, JSON.stringify(projectType, null, 2));
  
  console.log(`[Project Scheduler] About to call storage.getKanbanStagesByProjectTypeId("${projectType.id}")...`);
  const stages = await storage.getKanbanStagesByProjectTypeId(projectType.id);
  console.log(`[Project Scheduler] getKanbanStagesByProjectTypeId() returned ${stages.length} stages for project type ${projectType.name}`);
  
  if (stages.length === 0) {
    throw new Error(`No kanban stages configured for project type: ${projectType.name}`);
  }

  const firstStage = stages.sort((a, b) => a.order - b.order)[0];
  console.log(`[Project Scheduler] First stage: ${firstStage.name} (order: ${firstStage.order})`);

  // Determine assignees based on stage configuration
  let currentAssigneeId = dueService.serviceOwnerId;
  console.log(`[Project Scheduler] Initial assignee from service owner: ${currentAssigneeId}`);
  
  if (firstStage.assignedUserId) {
    currentAssigneeId = firstStage.assignedUserId;
    console.log(`[Project Scheduler] Assignee updated from stage assigned user: ${currentAssigneeId}`);
  } else if (firstStage.assignedWorkRoleId) {
    // Get user assigned to this role for this service
    if (dueService.type === 'client' && dueService.clientId) {
      console.log(`[Project Scheduler] About to call storage.getClientServiceRoleAssignments("${dueService.id}")...`);
      const roleAssignments = await storage.getClientServiceRoleAssignments(dueService.id);
      console.log(`[Project Scheduler] getClientServiceRoleAssignments() returned ${roleAssignments.length} role assignments`);
      
      const roleAssignment = roleAssignments.find(ra => ra.workRoleId === firstStage.assignedWorkRoleId && ra.isActive);
      if (roleAssignment) {
        currentAssigneeId = roleAssignment.userId;
        console.log(`[Project Scheduler] Assignee updated from role assignment: ${currentAssigneeId}`);
      }
    }
  }

  // Create project description
  console.log(`[Project Scheduler] About to call storage.getClientById("${dueService.clientId}")...`);
  const clientName = dueService.clientId ? (await storage.getClientById(dueService.clientId))?.name : 'Unknown Client';
  console.log(`[Project Scheduler] getClientById() returned client name: ${clientName}`);
  
  const description = `${dueService.service.name} - ${clientName}`;
  console.log(`[Project Scheduler] Project description: ${description}`);

  // Ensure we have valid user IDs for required fields
  const finalAssigneeId = currentAssigneeId || dueService.serviceOwnerId;
  if (!finalAssigneeId) {
    throw new Error(`No valid assignee found for service ${dueService.service.name}. Service owner is required.`);
  }

  // Validate required data before creating project
  if (!dueService.clientId) {
    throw new Error(`Client ID is required for service ${dueService.service.name}`);
  }
  
  if (!projectType.id) {
    throw new Error(`Project type ID is required for service ${dueService.service.name}`);
  }
  
  if (!firstStage.name) {
    throw new Error(`First stage name is required for project type ${projectType.name}`);
  }

  // Prepare project data
  const projectData: InsertProject = {
    clientId: dueService.clientId,
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
  // Calculate next dates with fallback frequency
  const frequency = dueService.service.frequency || dueService.frequency || 'monthly';
  
  // Detect and set intended days if not already set (for backwards compatibility)
  // For dates on 29, 30, or 31, remember the intended day for future scheduling
  let intendedStartDay = dueService.intendedStartDay;
  let intendedDueDay = dueService.intendedDueDay;
  
  // Auto-detect intended days if not already set and current day is 29-31
  if (intendedStartDay === null && dueService.nextStartDate.getUTCDate() >= 29) {
    intendedStartDay = dueService.nextStartDate.getUTCDate();
  }
  if (intendedDueDay === null && dueService.nextDueDate.getUTCDate() >= 29) {
    intendedDueDay = dueService.nextDueDate.getUTCDate();
  }
  
  const { nextStartDate, nextDueDate } = calculateNextServiceDates(
    dueService.nextStartDate,
    dueService.nextDueDate,
    frequency,
    intendedStartDay,
    intendedDueDay
  );

  // Update the service
  if (dueService.type === 'client') {
    await storage.updateClientService(dueService.id, {
      nextStartDate: nextStartDate.toISOString(),
      nextDueDate: nextDueDate.toISOString(),
      intendedStartDay,
      intendedDueDay
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
    frequency: dueService.service.frequency || dueService.frequency || 'monthly',
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

  // Get client service details for better display
  const allClientServicesWithDetails = await Promise.all(
    clientServices.map(async (cs) => {
      const client = await storage.getClientById(cs.clientId);
      const projectType = cs.service?.projectType;
      return {
        id: cs.id,
        nextStartDate: cs.nextStartDate,
        frequency: cs.frequency as ServiceFrequency,
        type: 'client' as const,
        serviceName: projectType?.name || 'Unknown Service',
        clientName: client?.name || 'Unknown Client',
        clientId: cs.clientId,
        projectTypeId: cs.service?.projectType?.id || null
      };
    })
  );

  const allServices = [
    ...allClientServicesWithDetails,
    // Add people services when supported
  ];

  const overdueServices = getOverdueServices(allServices, targetDate);
  
  // Calculate configuration errors
  const configurationErrors = [];
  for (const service of allClientServicesWithDetails) {
    if (!service.projectTypeId) {
      configurationErrors.push({
        serviceId: service.id,
        serviceName: service.serviceName,
        clientName: service.clientName,
        error: 'No project type configured',
        timestamp: new Date()
      });
    }
  }

  return {
    totalServices: allServices.length,
    overdueServices: overdueServices.length,
    servicesDetails: overdueServices.map(service => ({
      id: service.id,
      serviceName: (service as any).serviceName,
      clientName: (service as any).clientName,
      nextStartDate: service.nextStartDate,
      frequency: service.frequency,
      daysPastDue: service.daysPastDue
    })),
    configurationErrors
  };
}