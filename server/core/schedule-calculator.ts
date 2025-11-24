/**
 * ==========================================
 * PROTECTED CORE MODULE: SCHEDULE CALCULATOR
 * ==========================================
 * 
 * DO NOT MODIFY WITHOUT THOROUGH REVIEW
 * 
 * This module contains critical date calculation logic.
 * Any changes could break service scheduling and rescheduling.
 * 
 * Last validated: October 2025
 * ==========================================
 */

import { storage } from "../storage/index";
import type {
  ClientService,
  PeopleService,
  Service,
  ProjectType
} from "@shared/schema";

export type ServiceFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annually';

export interface NextDateResult {
  nextStartDate: Date;
  nextDueDate: Date;
}

export interface DueService {
  id: string;
  type: 'client' | 'people';
  service: Service & { projectType: ProjectType };
  clientId?: string;
  personId?: string;
  serviceOwnerId: string | null;
  frequency: ServiceFrequency;
  nextStartDate: Date;
  nextDueDate: Date;
  isCompaniesHouseService: boolean;
}

/**
 * Calculate next service dates based on frequency
 * This is the core scheduling calculation
 */
export function calculateNextServiceDates(
  currentStartDate: Date,
  currentDueDate: Date,
  frequency: ServiceFrequency
): NextDateResult {
  const nextStartDate = new Date(currentStartDate);
  const nextDueDate = new Date(currentDueDate);
  
  // Ensure we're working with UTC times to avoid timezone issues
  nextStartDate.setUTCHours(0, 0, 0, 0);
  nextDueDate.setUTCHours(0, 0, 0, 0);

  switch (frequency) {
    case "daily":
      nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 1);
      nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 1);
      break;

    case "weekly":
      nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 7);
      nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 7);
      break;

    case "fortnightly":
      nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 14);
      nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 14);
      break;

    case "monthly":
      nextStartDate.setUTCMonth(nextStartDate.getUTCMonth() + 1);
      nextDueDate.setUTCMonth(nextDueDate.getUTCMonth() + 1);
      // Handle end-of-month edge cases
      handleEndOfMonthEdgeCases(nextStartDate, currentStartDate);
      handleEndOfMonthEdgeCases(nextDueDate, currentDueDate);
      break;

    case "quarterly":
      nextStartDate.setUTCMonth(nextStartDate.getUTCMonth() + 3);
      nextDueDate.setUTCMonth(nextDueDate.getUTCMonth() + 3);
      // Handle end-of-month edge cases
      handleEndOfMonthEdgeCases(nextStartDate, currentStartDate);
      handleEndOfMonthEdgeCases(nextDueDate, currentDueDate);
      break;

    case "annually":
      nextStartDate.setUTCFullYear(nextStartDate.getUTCFullYear() + 1);
      nextDueDate.setUTCFullYear(nextDueDate.getUTCFullYear() + 1);
      // Handle leap year edge cases for Feb 29
      handleLeapYearEdgeCases(nextStartDate, currentStartDate);
      handleLeapYearEdgeCases(nextDueDate, currentDueDate);
      break;

    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }

  return { nextStartDate, nextDueDate };
}

/**
 * Handle end-of-month edge cases
 * If the original date was the last day of its month,
 * ensure the new date is the last day of the new month
 */
function handleEndOfMonthEdgeCases(dateToAdjust: Date, originalDate: Date): void {
  const originalDay = originalDate.getUTCDate();
  const originalMonth = originalDate.getUTCMonth();
  const originalYear = originalDate.getUTCFullYear();
  
  // Check if original date was the last day of its month
  const lastDayOfOriginalMonth = new Date(originalYear, originalMonth + 1, 0).getUTCDate();
  
  if (originalDay === lastDayOfOriginalMonth) {
    // Set to last day of the new month
    const newMonth = dateToAdjust.getUTCMonth();
    const newYear = dateToAdjust.getUTCFullYear();
    const lastDayOfNewMonth = new Date(newYear, newMonth + 1, 0).getUTCDate();
    dateToAdjust.setUTCDate(lastDayOfNewMonth);
  }
}

/**
 * Handle leap year edge cases for annual frequencies
 * If the original date was Feb 29, and the next year isn't a leap year, use Feb 28
 */
function handleLeapYearEdgeCases(dateToAdjust: Date, originalDate: Date): void {
  const originalMonth = originalDate.getUTCMonth();
  const originalDay = originalDate.getUTCDate();
  
  // Only handle Feb 29 case
  if (originalMonth === 1 && originalDay === 29) {
    const newYear = dateToAdjust.getUTCFullYear();
    if (!isLeapYear(newYear)) {
      dateToAdjust.setUTCDate(28); // Use Feb 28 in non-leap years
    }
  }
}

/**
 * Check if a year is a leap year
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Check if a service is due today or overdue
 * Normalizes dates to compare only the date portion
 * Returns true if service date is on or before target date
 */
export function isServiceDueOrOverdue(serviceDate: Date, targetDate: Date): boolean {
  // Normalize both dates to midnight UTC for comparison
  const normalizedServiceDate = new Date(serviceDate);
  normalizedServiceDate.setUTCHours(0, 0, 0, 0);
  
  const normalizedTargetDate = new Date(targetDate);
  normalizedTargetDate.setUTCHours(0, 0, 0, 0);
  
  return normalizedServiceDate.getTime() <= normalizedTargetDate.getTime();
}

/**
 * Find all services that are due on or before the target date
 * This includes both on-time and overdue services
 */
export async function findServicesDue(
  clientServices: (ClientService & { service: Service & { projectType: ProjectType } })[],
  peopleServices: (PeopleService & { service: Service & { projectType: ProjectType } })[],
  targetDate: Date
): Promise<DueService[]> {
  const dueServices: DueService[] = [];
  
  console.log(`[Schedule Calculator] findServicesDue called with ${clientServices.length} client services and ${peopleServices.length} people services`);
  console.log(`[Schedule Calculator] Target date: ${formatDate(targetDate)}`);
  
  // Process client services
  for (const clientService of clientServices) {
    console.log(`[Schedule Calculator] Checking client service ${clientService.id}, nextStartDate: ${clientService.nextStartDate ? formatDate(clientService.nextStartDate) : 'NULL'}, isActive: ${clientService.isActive}`);
    
    // Skip inactive services
    if (clientService.isActive === false) {
      console.log(`[Schedule Calculator] Skipping inactive service ${clientService.id}`);
      continue;
    }
    
    // Check if service is due or overdue
    if (clientService.nextStartDate && isServiceDueOrOverdue(clientService.nextStartDate, targetDate)) {
      // Validate configuration
      if (!clientService.service.projectType || clientService.service.projectType.id === '') {
        console.error(`[Schedule Calculator] Service '${clientService.service.name}' has no project type`);
        continue;
      }
      
      // Calculate if overdue and log appropriately
      const daysOverdue = daysBetween(clientService.nextStartDate, targetDate);
      const isOverdue = clientService.nextStartDate < targetDate;
      if (isOverdue) {
        console.log(`[Schedule Calculator] ⚠️ OVERDUE: Client service '${clientService.service.name}' is ${daysOverdue} day(s) overdue (scheduled: ${formatDate(clientService.nextStartDate)})`);
      } else {
        console.log(`[Schedule Calculator] ✓ ON-TIME: Client service '${clientService.service.name}' is due today (scheduled: ${formatDate(clientService.nextStartDate)})`);
      }
      
      const isChService = !!clientService.service.isCompaniesHouseConnected;
      
      dueServices.push({
        id: clientService.id,
        type: 'client',
        service: clientService.service,
        clientId: clientService.clientId,
        serviceOwnerId: clientService.serviceOwnerId,
        frequency: (clientService.frequency || 'monthly') as ServiceFrequency,
        nextStartDate: clientService.nextStartDate,
        nextDueDate: clientService.nextDueDate || clientService.nextStartDate,
        isCompaniesHouseService: isChService
      });
    }
  }
  
  // Process people services
  for (const peopleService of peopleServices) {
    // Skip inactive services
    if (peopleService.isActive === false) {
      continue;
    }
    
    // Check if service is due or overdue
    if (peopleService.nextStartDate && isServiceDueOrOverdue(peopleService.nextStartDate, targetDate)) {
      // Validate configuration
      if (!peopleService.service.projectType || peopleService.service.projectType.id === '') {
        console.error(`[Schedule Calculator] Service '${peopleService.service.name}' has no project type`);
        continue;
      }
      
      // Calculate if overdue and log appropriately
      const daysOverdue = daysBetween(peopleService.nextStartDate, targetDate);
      const isOverdue = peopleService.nextStartDate < targetDate;
      if (isOverdue) {
        console.log(`[Schedule Calculator] ⚠️ OVERDUE: People service '${peopleService.service.name}' is ${daysOverdue} day(s) overdue (scheduled: ${formatDate(peopleService.nextStartDate)})`);
      } else {
        console.log(`[Schedule Calculator] ✓ ON-TIME: People service '${peopleService.service.name}' is due today (scheduled: ${formatDate(peopleService.nextStartDate)})`);
      }
      
      dueServices.push({
        id: peopleService.id,
        type: 'people',
        service: peopleService.service,
        personId: peopleService.personId,
        serviceOwnerId: peopleService.serviceOwnerId,
        frequency: (peopleService.frequency || 'monthly') as ServiceFrequency,
        nextStartDate: peopleService.nextStartDate,
        nextDueDate: peopleService.nextDueDate || peopleService.nextStartDate,
        isCompaniesHouseService: false // People services are never CH services
      });
    }
  }
  
  return dueServices;
}

/**
 * Reschedule a service to its next occurrence
 * Companies House services are NOT rescheduled (dates from API)
 */
export async function rescheduleService(
  dueService: DueService,
  targetDate: Date = new Date()
): Promise<void> {
  // Companies House services don't get rescheduled
  if (dueService.isCompaniesHouseService) {
    console.log(`[Schedule Calculator] Skipping rescheduling for CH service ${dueService.service.name}`);
    return;
  }
  
  // Calculate next dates
  const frequency = dueService.frequency || 'monthly';
  const { nextStartDate, nextDueDate } = calculateNextServiceDates(
    dueService.nextStartDate,
    dueService.nextDueDate,
    frequency
  );
  
  // Update the service
  if (dueService.type === 'client') {
    await storage.updateClientService(dueService.id, {
      nextStartDate: nextStartDate.toISOString(),
      nextDueDate: nextDueDate.toISOString()
    });
    console.log(`[Schedule Calculator] Rescheduled client service ${dueService.id} to ${nextStartDate.toISOString()}`);
  } else if (dueService.type === 'people') {
    await storage.updatePeopleService(dueService.id, {
      nextStartDate: nextStartDate.toISOString(),
      nextDueDate: nextDueDate.toISOString()
    });
    console.log(`[Schedule Calculator] Rescheduled people service ${dueService.id} to ${nextStartDate.toISOString()}`);
  }
}

/**
 * Get overdue services analysis
 */
export async function getOverdueServices(
  targetDate: Date = new Date()
): Promise<DueService[]> {
  const [clientServices, peopleServices] = await Promise.all([
    storage.getAllClientServicesWithDetails(),
    storage.getAllPeopleServicesWithDetails()
  ]);
  
  const overdueServices: DueService[] = [];
  const normalizedTarget = new Date(targetDate);
  normalizedTarget.setUTCHours(0, 0, 0, 0);
  
  // Check client services
  for (const service of clientServices) {
    if (service.isActive === false) continue;
    if (!service.nextStartDate) continue;
    
    const serviceDate = new Date(service.nextStartDate);
    serviceDate.setUTCHours(0, 0, 0, 0);
    
    if (serviceDate < normalizedTarget) {
      overdueServices.push({
        id: service.id,
        type: 'client',
        service: service.service,
        clientId: service.clientId,
        serviceOwnerId: service.serviceOwnerId,
        frequency: (service.frequency || 'monthly') as ServiceFrequency,
        nextStartDate: service.nextStartDate,
        nextDueDate: service.nextDueDate || service.nextStartDate,
        isCompaniesHouseService: !!service.service.isCompaniesHouseConnected
      });
    }
  }
  
  // Check people services
  for (const service of peopleServices) {
    if (service.isActive === false) continue;
    if (!service.nextStartDate) continue;
    
    const serviceDate = new Date(service.nextStartDate);
    serviceDate.setUTCHours(0, 0, 0, 0);
    
    if (serviceDate < normalizedTarget) {
      overdueServices.push({
        id: service.id,
        type: 'people',
        service: service.service,
        personId: service.personId,
        serviceOwnerId: service.serviceOwnerId,
        frequency: (service.frequency || 'monthly') as ServiceFrequency,
        nextStartDate: service.nextStartDate,
        nextDueDate: service.nextDueDate || service.nextStartDate,
        isCompaniesHouseService: false
      });
    }
  }
  
  return overdueServices;
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
  const diff = Math.abs(date1.getTime() - date2.getTime());
  return Math.round(diff / oneDay);
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

// Export validation utilities
export const schedulingUtils = {
  isValidFrequency: (frequency: string): frequency is ServiceFrequency => {
    const valid: ServiceFrequency[] = ['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'];
    return valid.includes(frequency as ServiceFrequency);
  },
  
  getDefaultFrequency: (): ServiceFrequency => 'monthly',
  
  getFrequencyDays: (frequency: ServiceFrequency): number => {
    switch (frequency) {
      case 'daily': return 1;
      case 'weekly': return 7;
      case 'fortnightly': return 14;
      case 'monthly': return 30;
      case 'quarterly': return 90;
      case 'annually': return 365;
      default: return 30;
    }
  }
};