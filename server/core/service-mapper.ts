/**
 * ==========================================
 * PROTECTED CORE MODULE: SERVICE MAPPER
 * ==========================================
 * 
 * DO NOT MODIFY WITHOUT THOROUGH REVIEW
 * 
 * This module contains critical service mapping logic.
 * Any changes could break project creation and scheduling.
 * 
 * Last validated: October 2025
 * ==========================================
 */

import { storage } from "../storage/index";
import type { 
  InsertClientService, 
  InsertPeopleService,
  Service,
  Client,
  Person
} from "@shared/schema";

/**
 * Core date conversion utility for service dates
 * CRITICAL: Always convert string dates to Date objects before database operations
 */
export function convertServiceDates(data: any): any {
  const processedData = { ...data };
  
  if (processedData.nextStartDate && typeof processedData.nextStartDate === 'string') {
    processedData.nextStartDate = new Date(processedData.nextStartDate);
  }
  
  if (processedData.nextDueDate && typeof processedData.nextDueDate === 'string') {
    processedData.nextDueDate = new Date(processedData.nextDueDate);
  }
  
  return processedData;
}

/**
 * Validate and prepare Companies House service data
 * CH services have special date field mappings from client data
 */
export async function prepareCompaniesHouseServiceData(
  service: Service,
  client: Client,
  baseData: InsertClientService
): Promise<InsertClientService> {
  const allowedDateFields = [
    'nextAccountsPeriodEnd',
    'nextAccountsDue',
    'confirmationStatementNextDue',
    'confirmationStatementNextMadeUpTo'
  ];

  if (!service.chStartDateField || !service.chDueDateField) {
    throw new Error('Companies House service must specify both start and due date field mappings');
  }

  if (!allowedDateFields.includes(service.chStartDateField) || 
      !allowedDateFields.includes(service.chDueDateField)) {
    throw new Error(`Invalid CH date field mapping. Allowed fields: ${allowedDateFields.join(', ')}`);
  }

  const startDateField = service.chStartDateField as keyof typeof client;
  const dueDateField = service.chDueDateField as keyof typeof client;
  
  const startDateValue = client[startDateField];
  const dueDateValue = client[dueDateField];
  
  const startDate = startDateValue ? new Date(startDateValue as any) : null;
  const dueDate = dueDateValue ? new Date(dueDateValue as any) : null;
  
  if (!startDate || !dueDate || isNaN(startDate.getTime()) || isNaN(dueDate.getTime())) {
    throw new Error('Companies House service requires client to have valid CH date fields');
  }

  return {
    ...baseData,
    frequency: 'annually' as const, // CH services always annual
    nextStartDate: startDate.toISOString(),
    nextDueDate: dueDate.toISOString()
  };
}

/**
 * Validate service mapping constraints
 * Ensures business rules are enforced
 */
export async function validateServiceMapping(
  service: Service,
  targetType: 'client' | 'person'
): Promise<void> {
  if (targetType === 'client' && service.isPersonalService) {
    throw new Error(`Personal service '${service.name}' cannot be assigned to clients`);
  }
  
  if (targetType === 'person' && !service.isPersonalService) {
    throw new Error(`Service '${service.name}' is not a personal service and cannot be assigned to people`);
  }
}

/**
 * Create client service mapping with all validations
 * This is the core function for mapping services to clients
 */
export async function createClientServiceMapping(
  clientServiceData: InsertClientService
): Promise<any> {
  // Get service details
  const service = await storage.getServiceById(clientServiceData.serviceId);
  if (!service) {
    throw new Error(`Service with ID '${clientServiceData.serviceId}' not found`);
  }

  // Validate service type
  await validateServiceMapping(service, 'client');

  // Get client details
  const client = await storage.getClientById(clientServiceData.clientId);
  if (!client) {
    throw new Error(`Client with ID '${clientServiceData.clientId}' not found`);
  }

  // Check for existing mapping and update if it exists (idempotent)
  const existingServices = await storage.getClientServicesByClientId(clientServiceData.clientId);
  const existingService = existingServices.find(s => s.serviceId === clientServiceData.serviceId);
  
  if (existingService) {
    console.log(`[ServiceMapper] Updating existing client service mapping ${existingService.id}`);
    
    let finalData = { ...clientServiceData };

    // Handle different service types
    if (service.isStaticService) {
      // Static services don't need frequency or dates
      // Leave them as provided (can be null)
    } else if (service.isCompaniesHouseConnected) {
      // CH services get dates from client's CH data
      finalData = await prepareCompaniesHouseServiceData(service, client, finalData);
    } else {
      // Regular services need a frequency
      if (!finalData.frequency) {
        finalData.frequency = (existingService.frequency || 'monthly') as any;
      }
    }

    // Convert dates and update mapping
    const processedData = convertServiceDates(finalData);
    return await storage.updateClientService(existingService.id, processedData);
  }

  console.log(`[ServiceMapper] Creating new client service mapping`);
  let finalData = { ...clientServiceData };

  // Handle different service types
  if (service.isStaticService) {
    // Static services don't need frequency or dates
    // Leave them as provided (can be null)
  } else if (service.isCompaniesHouseConnected) {
    // CH services get dates from client's CH data
    finalData = await prepareCompaniesHouseServiceData(service, client, finalData);
  } else {
    // Regular services need a frequency
    if (!finalData.frequency) {
      finalData.frequency = 'monthly' as const;
    }
  }

  // Convert dates and create mapping
  const processedData = convertServiceDates(finalData);
  return await storage.createClientService(processedData);
}

/**
 * Create people service mapping with all validations
 * This is the core function for mapping services to people
 */
export async function createPeopleServiceMapping(
  peopleServiceData: InsertPeopleService
): Promise<any> {
  // Get service details
  const service = await storage.getServiceById(peopleServiceData.serviceId);
  if (!service) {
    throw new Error(`Service with ID '${peopleServiceData.serviceId}' not found`);
  }

  // Validate service type
  await validateServiceMapping(service, 'person');

  // Get person details
  const person = await storage.getPersonById(peopleServiceData.personId);
  if (!person) {
    throw new Error(`Person with ID '${peopleServiceData.personId}' not found`);
  }

  // Check for existing mapping and update if it exists (idempotent)
  const existingServices = await storage.getPeopleServicesByPersonId(peopleServiceData.personId);
  const existingService = existingServices.find(s => s.serviceId === peopleServiceData.serviceId);
  
  if (existingService) {
    console.log(`[ServiceMapper] Updating existing people service mapping ${existingService.id}`);
    
    // Convert dates and update mapping
    const processedData = convertServiceDates(peopleServiceData);
    return await storage.updatePeopleService(existingService.id, processedData);
  }

  console.log(`[ServiceMapper] Creating new people service mapping`);
  // Convert dates and create mapping
  const processedData = convertServiceDates(peopleServiceData);
  return await storage.createPeopleService(processedData);
}

/**
 * Update client service mapping with validations
 */
export async function updateClientServiceMapping(
  id: string,
  updateData: Partial<InsertClientService>
): Promise<any> {
  // Check existence
  const existing = await storage.getClientServiceById(id);
  if (!existing) {
    throw new Error(`Client service with ID '${id}' not found`);
  }

  // If changing service, validate the new service
  if (updateData.serviceId) {
    const service = await storage.getServiceById(updateData.serviceId);
    if (!service) {
      throw new Error(`Service with ID '${updateData.serviceId}' not found`);
    }
    await validateServiceMapping(service, 'client');
  }

  // Check for conflicts if changing client or service
  if (updateData.clientId || updateData.serviceId) {
    const newClientId = updateData.clientId || existing.clientId;
    const newServiceId = updateData.serviceId || existing.serviceId;
    
    if (newClientId !== existing.clientId || newServiceId !== existing.serviceId) {
      const mappingExists = await storage.checkClientServiceMappingExists(newClientId, newServiceId);
      if (mappingExists) {
        throw new Error('Client-service mapping already exists for the new combination');
      }
    }
  }

  // Convert dates and update
  const processedData = convertServiceDates(updateData);
  return await storage.updateClientService(id, processedData);
}

/**
 * Update people service mapping with validations
 */
export async function updatePeopleServiceMapping(
  id: string,
  updateData: Partial<InsertPeopleService>
): Promise<any> {
  // Check existence
  const existing = await storage.getPeopleServiceById(id);
  if (!existing) {
    throw new Error(`People service with ID '${id}' not found`);
  }

  // If changing service, validate the new service
  if (updateData.serviceId) {
    const service = await storage.getServiceById(updateData.serviceId);
    if (!service) {
      throw new Error(`Service with ID '${updateData.serviceId}' not found`);
    }
    await validateServiceMapping(service, 'person');
  }

  // Check for conflicts if changing person or service
  if (updateData.personId || updateData.serviceId) {
    const newPersonId = updateData.personId || existing.personId;
    const newServiceId = updateData.serviceId || existing.serviceId;
    
    if (newPersonId !== existing.personId || newServiceId !== existing.serviceId) {
      const mappingExists = await storage.checkPeopleServiceMappingExists(newPersonId, newServiceId);
      if (mappingExists) {
        throw new Error('Person-service mapping already exists for the new combination');
      }
    }
  }

  // Convert dates and update
  const processedData = convertServiceDates(updateData);
  return await storage.updatePeopleService(id, processedData);
}

/**
 * Resolve role assignee for a client service
 * Returns the user assigned to a specific role for a client service
 */
export async function resolveRoleAssignee(
  clientServiceId: string,
  roleId: string
): Promise<string | null> {
  const assignments = await storage.getClientServiceRoleAssignments(clientServiceId);
  const assignment = assignments.find(a => a.workRoleId === roleId && a.isActive);
  return assignment?.userId || null;
}

// Export validation utilities for testing
export const validationUtils = {
  isValidFrequency: (frequency: string) => {
    const valid = ['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'];
    return valid.includes(frequency);
  },
  
  isValidDate: (date: any) => {
    if (!date) return false;
    const d = new Date(date);
    return !isNaN(d.getTime());
  }
};