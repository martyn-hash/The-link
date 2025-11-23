import { storage } from "./storage/index";
import { db } from "./db";
import { clients, clientServices, projects, chChangeRequests } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { ChChangeRequest } from "../shared/schema";

/**
 * Types of CH update scenarios
 */
type UpdateScenario = 'accounts_filed' | 'extension_granted' | 'confirmation_statement' | 'single_field';

/**
 * Detect which scenario this approval represents based on ALL pending changes for the same client
 */
async function detectUpdateScenario(clientId: string, requestIdsBeingApproved: string[]): Promise<UpdateScenario> {
  // Get ALL pending requests for this client (not just the ones being approved)
  const allClientRequests = await storage.getChChangeRequestsByClientId(clientId);
  const allPendingRequests = allClientRequests.filter((req: any) => req.status === 'pending');

  const allPendingFieldNames = allPendingRequests.map((req: any) => req.fieldName);

  // Scenario 1: Both accounts fields are pending = accounts filed
  const hasAccountsPeriodEndChange = allPendingFieldNames.includes('nextAccountsPeriodEnd');
  const hasAccountsDueChange = allPendingFieldNames.includes('nextAccountsDue');
  
  if (hasAccountsPeriodEndChange && hasAccountsDueChange) {
    return 'accounts_filed';
  }

  // Scenario 2: Only due date is pending (no period end) = extension granted
  if (hasAccountsDueChange && !hasAccountsPeriodEndChange) {
    return 'extension_granted';
  }

  // Scenario 3: Confirmation statement changes
  const hasConfStatementChange = allPendingFieldNames.some(f => 
    f === 'confirmationStatementNextDue' || f === 'confirmationStatementNextMadeUpTo'
  );
  
  if (hasConfStatementChange) {
    return 'confirmation_statement';
  }

  // Default: single field update
  return 'single_field';
}

/**
 * Get all client services that are mapped to a specific CH field
 */
async function getAffectedClientServices(clientId: string, fieldName: string) {
  // Get all services for this client
  const allServices = await storage.getClientServicesByClientId(clientId);
  
  // Filter to only those that are CH-connected and map to this field
  return allServices.filter((cs: any) => {
    const service = cs.service;
    if (!service.isCompaniesHouseConnected) return false;
    
    // Check if this service maps to the changed field
    return service.chStartDateField === fieldName || service.chDueDateField === fieldName;
  });
}

/**
 * Get active projects for a client service
 */
async function getActiveProjectsByClientService(clientServiceId: string) {
  // Active projects have completionStatus = null and inactive = false
  const allProjects = await db
    .select()
    .from(projects)
    .where(
      and(
        sql`${projects.id} IN (
          SELECT project_id FROM project_scheduling_history 
          WHERE client_service_id = ${clientServiceId}
        )`,
        eq(projects.completionStatus, sql`NULL`),
        eq(projects.inactive, false)
      )
    );
  
  return allProjects;
}

/**
 * Apply CH changes based on the detected scenario
 */
export async function applyChChanges(
  clientId: string,
  requestIds: string[],
  approvedBy: string,
  notes?: string
): Promise<{ updatedClients: number; updatedServices: number; updatedProjects: number }> {
  
  const result = {
    updatedClients: 0,
    updatedServices: 0,
    updatedProjects: 0,
  };

  // Get all pending requests being approved
  const allClientRequests = await storage.getChChangeRequestsByClientId(clientId);
  const requestsToApprove = allClientRequests.filter((req: any) => 
    req.status === 'pending' && requestIds.includes(req.id)
  );

  if (requestsToApprove.length === 0) {
    console.log('[CH Update] No pending requests to approve');
    return result;
  }

  // Detect scenario
  const scenario = await detectUpdateScenario(clientId, requestIds);
  console.log(`[CH Update] Detected scenario: ${scenario}`);

  // Start transaction
  await db.transaction(async (tx) => {
    // Step 1: Update client record with all new values
    const clientUpdates: any = {};
    for (const request of requestsToApprove) {
      const fieldName = request.fieldName as string;
      const newValue = request.newValue ? new Date(request.newValue) : null;
      clientUpdates[fieldName] = newValue;
    }

    if (Object.keys(clientUpdates).length > 0) {
      await tx
        .update(clients)
        .set(clientUpdates)
        .where(eq(clients.id, clientId));
      
      result.updatedClients = 1;
      console.log(`[CH Update] Updated client ${clientId} with ${Object.keys(clientUpdates).length} fields`);
    }

    // Step 2: Update all affected client services
    for (const request of requestsToApprove) {
      const fieldName = request.fieldName as string;
      const newValue = request.newValue ? new Date(request.newValue) : null;
      
      const affectedServices = await getAffectedClientServices(clientId, fieldName);
      
      for (const clientService of affectedServices) {
        const service = clientService.service;
        const serviceUpdates: any = {};
        
        // Map CH field to service field
        if (service.chStartDateField === fieldName) {
          serviceUpdates.nextStartDate = newValue;
        }
        if (service.chDueDateField === fieldName) {
          serviceUpdates.nextDueDate = newValue;
        }
        
        if (Object.keys(serviceUpdates).length > 0) {
          await tx
            .update(clientServices)
            .set(serviceUpdates)
            .where(eq(clientServices.id, clientService.id));
          
          result.updatedServices++;
          console.log(`[CH Update] Updated service ${clientService.id} (${service.name})`);
        }
      }
    }

    // Step 3: Update active projects (only for extension scenario)
    if (scenario === 'extension_granted') {
      // Only update due dates for active projects
      const accountsDueRequest = requestsToApprove.find((req: any) => req.fieldName === 'nextAccountsDue');
      if (accountsDueRequest) {
        const newDueDate = accountsDueRequest.newValue ? new Date(accountsDueRequest.newValue) : null;
        
        // Get all affected services
        const affectedServices = await getAffectedClientServices(clientId, 'nextAccountsDue');
        
        for (const clientService of affectedServices) {
          const activeProjects = await getActiveProjectsByClientService(clientService.id);
          
          for (const project of activeProjects) {
            await tx
              .update(projects)
              .set({ dueDate: newDueDate })
              .where(eq(projects.id, project.id));
            
            result.updatedProjects++;
            console.log(`[CH Update] Updated project ${project.id} due date`);
          }
        }
      }
    }

    // Step 4: Mark all requests as approved (using transaction context)
    for (const request of requestsToApprove) {
      await tx
        .update(chChangeRequests)
        .set({
          status: "approved",
          approvedBy,
          approvedAt: sql`now()`,
          notes,
        })
        .where(eq(chChangeRequests.id, request.id));
    }
  });

  return result;
}

/**
 * Get impact analysis for pending changes (for UI display)
 */
export async function getChangeImpact(clientId: string, requestIds: string[]): Promise<{
  scenario: UpdateScenario;
  affectedServices: Array<{ id: string; name: string }>;
  affectedProjects: Array<{ id: string; description: string }>;
}> {
  const allClientRequests = await storage.getChChangeRequestsByClientId(clientId);
  const pendingRequests = allClientRequests.filter((req: any) => 
    req.status === 'pending' && requestIds.includes(req.id)
  );

  const scenario = await detectUpdateScenario(clientId, requestIds);
  
  // Collect affected services
  const servicesMap = new Map<string, { id: string; name: string }>();
  for (const request of pendingRequests) {
    const fieldName = request.fieldName as string;
    const affectedServices = await getAffectedClientServices(clientId, fieldName);
    
    for (const cs of affectedServices) {
      servicesMap.set(cs.id, {
        id: cs.id,
        name: cs.service.name,
      });
    }
  }
  
  // Collect affected projects (only for extension scenario)
  const projectsList: Array<{ id: string; description: string }> = [];
  if (scenario === 'extension_granted') {
    for (const serviceId of Array.from(servicesMap.keys())) {
      const activeProjects = await getActiveProjectsByClientService(serviceId);
      for (const project of activeProjects) {
        projectsList.push({
          id: project.id,
          description: project.description,
        });
      }
    }
  }

  return {
    scenario,
    affectedServices: Array.from(servicesMap.values()),
    affectedProjects: projectsList,
  };
}
