import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { 
  clientServices,
  peopleServices,
  clientServiceRoleAssignments,
  clients,
  people,
  services,
  projectTypes,
  users,
  workRoles,
  serviceRoles,
  clientPeople,
  projects,
  kanbanStages,
} from '@shared/schema';
import { eq, and, or, desc, ilike, ne, inArray, sql } from 'drizzle-orm';
import type { 
  ClientService,
  InsertClientService,
  PeopleService,
  InsertPeopleService,
  ClientServiceRoleAssignment,
  InsertClientServiceRoleAssignment,
  Client,
  Person,
  Service,
  ProjectType,
  User,
  WorkRole,
} from '@shared/schema';

export class ServiceAssignmentStorage extends BaseStorage {
  // ==================== Client Services CRUD operations ====================

  async getAllClientServices(): Promise<(ClientService & { client: Client; service: Service & { projectType: ProjectType } })[]> {
    const results = await db
      .select({
        id: clientServices.id,
        clientId: clientServices.clientId,
        serviceId: clientServices.serviceId,
        serviceOwnerId: clientServices.serviceOwnerId,
        frequency: clientServices.frequency,
        nextStartDate: clientServices.nextStartDate,
        nextDueDate: clientServices.nextDueDate,
        intendedStartDay: clientServices.intendedStartDay,
        intendedDueDay: clientServices.intendedDueDay,
        isActive: clientServices.isActive,
        inactiveReason: clientServices.inactiveReason,
        inactiveAt: clientServices.inactiveAt,
        inactiveByUserId: clientServices.inactiveByUserId,
        udfValues: clientServices.udfValues,
        createdAt: clientServices.createdAt,
        clientId_data: clients.id,
        clientName: clients.name,
        clientEmail: clients.email,
        clientCreatedAt: clients.createdAt,
        serviceId_data: services.id,
        serviceName: services.name,
        serviceDescription: services.description,
        serviceUdfDefinitions: services.udfDefinitions,
        serviceCreatedAt: services.createdAt,
        projectTypeId: projectTypes.id,
        projectTypeName: projectTypes.name,
        projectTypeDescription: projectTypes.description,
        projectTypeActive: projectTypes.active,
        projectTypeOrder: projectTypes.order,
        projectTypeCreatedAt: projectTypes.createdAt,
      })
      .from(clientServices)
      .innerJoin(clients, eq(clientServices.clientId, clients.id))
      .innerJoin(services, eq(clientServices.serviceId, services.id))
      .leftJoin(projectTypes, eq(projectTypes.serviceId, services.id));
    
    return results.map(result => ({
      id: result.id,
      clientId: result.clientId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      intendedStartDay: result.intendedStartDay,
      intendedDueDay: result.intendedDueDay,
      isActive: result.isActive,
      inactiveReason: result.inactiveReason,
      inactiveAt: result.inactiveAt,
      inactiveByUserId: result.inactiveByUserId,
      udfValues: result.udfValues,
      createdAt: result.createdAt,
      client: {
        id: result.clientId_data,
        name: result.clientName,
        email: result.clientEmail,
        createdAt: result.clientCreatedAt,
      },
      service: {
        id: result.serviceId_data,
        name: result.serviceName,
        description: result.serviceDescription,
        projectTypeId: result.projectTypeId,
        udfDefinitions: result.serviceUdfDefinitions,
        createdAt: result.serviceCreatedAt,
        projectType: {
          id: result.projectTypeId,
          name: result.projectTypeName,
          description: result.projectTypeDescription,
          active: result.projectTypeActive,
          order: result.projectTypeOrder,
          createdAt: result.projectTypeCreatedAt,
        },
      },
    })) as any;
  }

  async getClientServiceById(id: string): Promise<(ClientService & { 
    client: Client; 
    service: Service & { projectType: ProjectType }; 
    serviceOwner?: User;
    roleAssignments: (ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[];
  }) | undefined> {
    try {
      console.log(`[DEBUG] Fetching client service by ID: ${id}`);
      
      // Get basic client service first
      const clientServicesList = await db
        .select()
        .from(clientServices)
        .where(eq(clientServices.id, id));
      
      if (!clientServicesList.length) {
        console.log(`[DEBUG] Client service not found for ID: ${id}`);
        return undefined;
      }
      
      const cs = clientServicesList[0];
      console.log(`[DEBUG] Found client service with serviceId: ${cs.serviceId}`);
      
      // Get client details
      const clientsList = await db
        .select()
        .from(clients)
        .where(eq(clients.id, cs.clientId));
      
      if (!clientsList.length) {
        console.warn(`[WARNING] Client not found for clientId: ${cs.clientId}`);
        return undefined;
      }
      
      const client = clientsList[0];
      console.log(`[DEBUG] Found client: ${client.name}`);
      
      // Get service details
      const servicesList = await db
        .select()
        .from(services)
        .where(eq(services.id, cs.serviceId));
      
      if (!servicesList.length) {
        console.warn(`[WARNING] Service not found for serviceId: ${cs.serviceId}`);
        return undefined;
      }
      
      const service = servicesList[0];
      console.log(`[DEBUG] Found service: ${service.name}`);
      
      // Get project type - try by ID first, then by name matching
      let projectType = undefined;
      if (service.projectTypeId) {
        const projectTypesList = await db
          .select()
          .from(projectTypes)
          .where(eq(projectTypes.id, service.projectTypeId));
        projectType = projectTypesList.length ? projectTypesList[0] : undefined;
        console.log(`[DEBUG] Project type found by ID: ${projectType?.name || 'None'}`);
      } else {
        // Try to match by name if no projectTypeId is set
        const projectTypesList = await db
          .select()
          .from(projectTypes)
          .where(or(
            eq(projectTypes.name, service.name),
            ilike(projectTypes.name, `%${service.name.replace(' Service', '')}%`),
            ilike(service.name, `%${projectTypes.name}%`)
          ));
        projectType = projectTypesList.length ? projectTypesList[0] : undefined;
        console.log(`[DEBUG] Project type found by name matching: ${projectType?.name || 'None'} for service: ${service.name}`);
      }
      
      // Get service owner if exists
      let serviceOwner = undefined;
      if (cs.serviceOwnerId) {
        const ownersList = await db
          .select()
          .from(users)
          .where(eq(users.id, cs.serviceOwnerId));
        serviceOwner = ownersList.length ? ownersList[0] : undefined;
        console.log(`[DEBUG] Service owner found: ${serviceOwner?.email || 'None'}`);
      }
      
      // Get role assignments
      const roleAssignments = await this.getActiveClientServiceRoleAssignments(cs.id);
      console.log(`[DEBUG] Found ${roleAssignments.length} role assignments`);
      
      return {
        id: cs.id,
        clientId: cs.clientId,
        serviceId: cs.serviceId,
        serviceOwnerId: cs.serviceOwnerId,
        frequency: cs.frequency,
        nextStartDate: cs.nextStartDate,
        nextDueDate: cs.nextDueDate,
        intendedStartDay: cs.intendedStartDay,
        intendedDueDay: cs.intendedDueDay,
        isActive: cs.isActive,
        inactiveReason: cs.inactiveReason,
        inactiveAt: cs.inactiveAt,
        inactiveByUserId: cs.inactiveByUserId,
        udfValues: cs.udfValues,
        createdAt: cs.createdAt,
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          createdAt: client.createdAt,
        },
        service: {
          id: service.id,
          name: service.name,
          description: service.description,
          projectTypeId: service.projectTypeId,
          udfDefinitions: service.udfDefinitions,
          isActive: service.isActive,
          isPersonalService: service.isPersonalService,
          isStaticService: service.isStaticService,
          isCompaniesHouseConnected: service.isCompaniesHouseConnected,
          chStartDateField: service.chStartDateField,
          chDueDateField: service.chDueDateField,
          createdAt: service.createdAt,
          projectType,
        },
        serviceOwner,
        roleAssignments,
      } as any;
    } catch (error) {
      console.error(`[ERROR] Error in getClientServiceById for id ${id}:`, error);
      console.error(`[ERROR] Stack trace:`, (error as any)?.stack || 'No stack trace');
      throw error;
    }
  }

  async getClientServicesByClientId(clientId: string): Promise<(ClientService & { 
    service: Service & { projectType: ProjectType }; 
    serviceOwner?: User; 
    roleAssignments: (ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[];
    hasActiveProject?: boolean;
    currentProjectStartDate?: string | null;
    currentProjectDueDate?: string | null;
  })[]> {
    try {
      console.log(`[DEBUG] Fetching client services for clientId: ${clientId}`);
      
      // Get basic client services first with simple query
      const clientServicesList = await db
        .select()
        .from(clientServices)
        .where(eq(clientServices.clientId, clientId));
      
      console.log(`[DEBUG] Found ${clientServicesList.length} client services for clientId: ${clientId}`);
      
      // For each client service, get the full data with separate simple queries
      const clientServicesWithDetails = await Promise.all(
        clientServicesList.map(async (cs) => {
          console.log(`[DEBUG] Processing client service with ID: ${cs.id}, serviceId: ${cs.serviceId}`);
          
          // Get service details with simple query
          const servicesList = await db
            .select()
            .from(services)
            .where(eq(services.id, cs.serviceId));
          
          if (!servicesList.length) {
            console.warn(`[WARNING] Service not found for serviceId: ${cs.serviceId}`);
            return null;
          }
          
          const service = servicesList[0];
          console.log(`[DEBUG] Found service: ${service.name}`);
          
          // Get project type - try by ID first, then by name matching
          let projectType = undefined;
          if (service.projectTypeId) {
            const projectTypesList = await db
              .select()
              .from(projectTypes)
              .where(eq(projectTypes.id, service.projectTypeId));
            projectType = projectTypesList.length ? projectTypesList[0] : undefined;
            console.log(`[DEBUG] Project type found by ID: ${projectType?.name || 'None'}`);
          } else {
            // Try to match by name if no projectTypeId is set
            const projectTypesList = await db
              .select()
              .from(projectTypes)
              .where(or(
                eq(projectTypes.name, service.name),
                ilike(projectTypes.name, `%${service.name.replace(' Service', '')}%`),
                ilike(service.name, `%${projectTypes.name}%`)
              ));
            projectType = projectTypesList.length ? projectTypesList[0] : undefined;
            console.log(`[DEBUG] Project type found by name matching: ${projectType?.name || 'None'} for service: ${service.name}`);
          }
          
          // Get service owner if exists
          let serviceOwner = undefined;
          if (cs.serviceOwnerId) {
            const ownersList = await db
              .select()
              .from(users)
              .where(eq(users.id, cs.serviceOwnerId));
            serviceOwner = ownersList.length ? ownersList[0] : undefined;
            console.log(`[DEBUG] Service owner found: ${serviceOwner?.email || 'None'}`);
          }
          
          // Get role assignments
          const roleAssignments = await this.getActiveClientServiceRoleAssignments(cs.id);
          console.log(`[DEBUG] Found ${roleAssignments.length} role assignments`);
          
          // Get current active project information if project type exists
          let hasActiveProject = false;
          let currentProjectStartDate: string | null = null;
          let currentProjectDueDate: string | null = null;
          
          if (projectType?.id) {
            const activeProjectsList = await db
              .select({
                projectMonth: projects.projectMonth,
                dueDate: projects.dueDate,
              })
              .from(projects)
              .where(and(
                eq(projects.clientId, cs.clientId),
                eq(projects.projectTypeId, projectType.id),
                ne(projects.currentStatus, 'Completed')
              ))
              .limit(1);
            
            if (activeProjectsList.length > 0) {
              hasActiveProject = true;
              const activeProject = activeProjectsList[0];
              
              // Safe date conversion with type checking
              if (activeProject.projectMonth) {
                try {
                  if ((activeProject.projectMonth as unknown) instanceof Date) {
                    currentProjectStartDate = (activeProject.projectMonth as unknown as Date).toISOString();
                  } else if (typeof activeProject.projectMonth === 'string') {
                    // Convert DD/MM/YYYY format to ISO format
                    const parts = activeProject.projectMonth.split('/');
                    if (parts.length === 3) {
                      const [day, month, year] = parts;
                      const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
                      if (!isNaN(date.getTime())) {
                        currentProjectStartDate = date.toISOString();
                      } else {
                        currentProjectStartDate = activeProject.projectMonth; // fallback
                      }
                    } else {
                      currentProjectStartDate = activeProject.projectMonth; // fallback
                    }
                  }
                } catch (error) {
                  console.warn(`[WARNING] Error processing project start date for client service ${cs.id}:`, error);
                }
              }
              
              if (activeProject.dueDate) {
                try {
                  if (activeProject.dueDate instanceof Date) {
                    currentProjectDueDate = activeProject.dueDate.toISOString();
                  } else if (typeof activeProject.dueDate === 'string') {
                    currentProjectDueDate = activeProject.dueDate;
                  }
                } catch (error) {
                  console.warn(`[WARNING] Error processing project due date for client service ${cs.id}:`, error);
                }
              }
              
              console.log(`[DEBUG] Found active project for client service ${cs.id}: start=${currentProjectStartDate}, due=${currentProjectDueDate}`);
            }
          }
          
          return {
            id: cs.id,
            clientId: cs.clientId,
            serviceId: cs.serviceId,
            serviceOwnerId: cs.serviceOwnerId,
            frequency: cs.frequency,
            nextStartDate: cs.nextStartDate,
            nextDueDate: cs.nextDueDate,
            intendedStartDay: cs.intendedStartDay,
            intendedDueDay: cs.intendedDueDay,
            isActive: cs.isActive,
            inactiveReason: cs.inactiveReason,
            inactiveAt: cs.inactiveAt,
            inactiveByUserId: cs.inactiveByUserId,
            udfValues: cs.udfValues,
            createdAt: cs.createdAt,
            service: {
              id: service.id,
              name: service.name,
              description: service.description,
              projectTypeId: service.projectTypeId,
              udfDefinitions: service.udfDefinitions,
              isActive: service.isActive,
              isPersonalService: service.isPersonalService,
              isStaticService: service.isStaticService,
              isCompaniesHouseConnected: service.isCompaniesHouseConnected,
              chStartDateField: service.chStartDateField,
              chDueDateField: service.chDueDateField,
              createdAt: service.createdAt,
              projectType,
            },
            serviceOwner,
            roleAssignments,
            hasActiveProject,
            currentProjectStartDate,
            currentProjectDueDate,
          };
        })
      );
      
      // Filter out any null results (from missing services)
      const validClientServices = clientServicesWithDetails.filter(cs => cs !== null);
      
      console.log(`[DEBUG] Successfully processed ${validClientServices.length} valid client services`);
      return validClientServices as any;
    } catch (error) {
      console.error(`[ERROR] Error in getClientServicesByClientId for clientId ${clientId}:`, error);
      console.error(`[ERROR] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  async getClientServicesByServiceId(serviceId: string): Promise<(ClientService & { client: Client })[]> {
    const results = await db
      .select({
        id: clientServices.id,
        clientId: clientServices.clientId,
        serviceId: clientServices.serviceId,
        serviceOwnerId: clientServices.serviceOwnerId,
        frequency: clientServices.frequency,
        nextStartDate: clientServices.nextStartDate,
        nextDueDate: clientServices.nextDueDate,
        intendedStartDay: clientServices.intendedStartDay,
        intendedDueDay: clientServices.intendedDueDay,
        isActive: clientServices.isActive,
        inactiveReason: clientServices.inactiveReason,
        inactiveAt: clientServices.inactiveAt,
        inactiveByUserId: clientServices.inactiveByUserId,
        udfValues: clientServices.udfValues,
        createdAt: clientServices.createdAt,
        client: {
          id: clients.id,
          name: clients.name,
          email: clients.email,
          createdAt: clients.createdAt,
        },
      })
      .from(clientServices)
      .innerJoin(clients, eq(clientServices.clientId, clients.id))
      .where(eq(clientServices.serviceId, serviceId));
    return results as any;
  }

  async createClientService(clientServiceData: InsertClientService): Promise<ClientService> {
    // Note: This implementation requires access to storage methods.
    // In the full implementation, these would need to be injected or accessed differently.
    // For now, we'll implement the core logic without external dependencies.
    
    // Convert ISO string dates to Date objects for timestamp fields
    const processedData = { ...clientServiceData };
    if (processedData.nextStartDate && typeof processedData.nextStartDate === 'string') {
      processedData.nextStartDate = new Date(processedData.nextStartDate);
    }
    if (processedData.nextDueDate && typeof processedData.nextDueDate === 'string') {
      processedData.nextDueDate = new Date(processedData.nextDueDate);
    }

    const [clientService] = await db
      .insert(clientServices)
      .values(processedData as any)
      .returning();
    
    return clientService;
  }

  async updateClientService(id: string, clientServiceData: Partial<InsertClientService>): Promise<ClientService> {
    // Convert ISO string dates to Date objects for timestamp fields
    const processedData = { ...clientServiceData };
    if (processedData.nextStartDate && typeof processedData.nextStartDate === 'string') {
      processedData.nextStartDate = new Date(processedData.nextStartDate);
    }
    if (processedData.nextDueDate && typeof processedData.nextDueDate === 'string') {
      processedData.nextDueDate = new Date(processedData.nextDueDate);
    }

    const [updatedClientService] = await db
      .update(clientServices)
      .set(processedData as any)
      .where(eq(clientServices.id, id))
      .returning();
    
    if (!updatedClientService) {
      throw new Error("Failed to update client service");
    }
    
    return updatedClientService;
  }

  async getClientServiceByClientAndProjectType(clientId: string, projectTypeId: string): Promise<ClientService | undefined> {
    // Validate input parameters to prevent undefined/null being passed to query builder
    if (!clientId || clientId.trim() === '') {
      console.warn(`[Storage] getClientServiceByClientAndProjectType called with invalid clientId: "${clientId}"`);
      return undefined;
    }
    if (!projectTypeId || projectTypeId.trim() === '') {
      console.warn(`[Storage] getClientServiceByClientAndProjectType called with invalid projectTypeId: "${projectTypeId}"`);
      return undefined;
    }
    
    // Find the service for this project type
    const [projectType] = await db
      .select()
      .from(projectTypes)
      .where(eq(projectTypes.id, projectTypeId));
    
    if (!projectType?.serviceId) {
      return undefined;
    }
    
    // Validate service.id to prevent undefined/null being passed to query builder
    if (!projectType.serviceId || projectType.serviceId.trim() === '') {
      console.warn(`[Storage] getClientServiceByClientAndProjectType: service has invalid id: "${projectType.serviceId}" for projectTypeId: "${projectTypeId}"`);
      return undefined;
    }

    // Find the client-service mapping
    const [clientService] = await db
      .select()
      .from(clientServices)
      .where(and(
        eq(clientServices.clientId, clientId),
        eq(clientServices.serviceId, projectType.serviceId)
      ));
    
    return clientService;
  }

  async deleteClientService(id: string): Promise<void> {
    // Use transaction to ensure cascade delete is atomic
    await db.transaction(async (tx) => {
      // First check if the client service exists
      const [clientService] = await tx
        .select()
        .from(clientServices)
        .where(eq(clientServices.id, id));
      
      if (!clientService) {
        throw new Error("Client service not found");
      }

      // Delete all role assignments for this client service (cascade delete)
      await tx
        .delete(clientServiceRoleAssignments)
        .where(eq(clientServiceRoleAssignments.clientServiceId, id));

      // Delete the client service
      await tx.delete(clientServices).where(eq(clientServices.id, id));
    });
  }

  async checkClientServiceMappingExists(clientId: string, serviceId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(clientServices)
      .where(and(
        eq(clientServices.clientId, clientId),
        eq(clientServices.serviceId, serviceId)
      ))
      .limit(1);
    
    return !!existing;
  }

  async getAllClientServicesWithDetails(): Promise<(ClientService & { service: Service & { projectType: ProjectType } })[]> {
    const results = await db
      .select({
        clientService: clientServices,
        service: services,
        projectType: projectTypes,
      })
      .from(clientServices)
      .innerJoin(services, eq(clientServices.serviceId, services.id))
      .leftJoin(projectTypes, eq(projectTypes.serviceId, services.id))
      .where(eq(clientServices.isActive, true))
      .orderBy(clientServices.clientId, services.name);

    return results.map(result => ({
      ...result.clientService,
      service: {
        ...result.service,
        projectType: result.projectType
      }
    })); // Return all services, including those with null project types for error detection
  }

  // ==================== Client Service Role Assignments CRUD operations ====================

  async getClientServiceRoleAssignments(clientServiceId: string): Promise<(ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[]> {
    // Validate clientServiceId to prevent undefined/null being passed to query builder
    if (!clientServiceId || clientServiceId.trim() === '') {
      console.warn(`[Storage] getClientServiceRoleAssignments called with invalid clientServiceId: "${clientServiceId}"`);
      return [];
    }
    
    try {
      // Use a simpler approach to avoid complex join issues that could cause TypeError
      // First get basic role assignments
      console.log(`[Storage] Getting basic role assignments for clientServiceId: ${clientServiceId}`);
      const assignments = await db
        .select()
        .from(clientServiceRoleAssignments)
        .where(eq(clientServiceRoleAssignments.clientServiceId, clientServiceId));
      
      console.log(`[Storage] Found ${assignments.length} role assignments`);
      
      // For each assignment, get the work role and user details separately
      const assignmentsWithDetails = await Promise.all(
        assignments.map(async (assignment) => {
          try {
            // Validate assignment has required IDs
            if (!assignment.workRoleId || !assignment.userId) {
              console.warn(`[Storage] Assignment ${assignment.id} has invalid workRoleId (${assignment.workRoleId}) or userId (${assignment.userId})`);
              return null;
            }
            
            console.log(`[Storage] Getting details for assignment ${assignment.id} - workRoleId: ${assignment.workRoleId}, userId: ${assignment.userId}`);
            
            // Get work role details
            const [workRole] = await db
              .select()
              .from(workRoles)
              .where(eq(workRoles.id, assignment.workRoleId));
            
            // Get user details
            const [user] = await db
              .select()
              .from(users)
              .where(eq(users.id, assignment.userId));
            
            if (!workRole || !user) {
              console.warn(`[Storage] Missing workRole (${!!workRole}) or user (${!!user}) for assignment ${assignment.id}`);
              return null;
            }
            
            return {
              id: assignment.id,
              clientServiceId: assignment.clientServiceId,
              workRoleId: assignment.workRoleId,
              userId: assignment.userId,
              isActive: assignment.isActive,
              createdAt: assignment.createdAt,
              workRole,
              user,
            };
          } catch (error) {
            console.error(`[Storage] Error processing assignment ${assignment.id}:`, error);
            return null;
          }
        })
      );
      
      // Filter out null results
      const validAssignments = assignmentsWithDetails.filter(assignment => assignment !== null);
      console.log(`[Storage] Returning ${validAssignments.length} valid assignments with details`);
      
      return validAssignments;
    } catch (error) {
      console.error(`[Storage] Error in getClientServiceRoleAssignments for clientServiceId ${clientServiceId}:`, error);
      return [];
    }
  }

  async getActiveClientServiceRoleAssignments(clientServiceId: string): Promise<(ClientServiceRoleAssignment & { workRole: WorkRole; user: User })[]> {
    console.log(`[DEBUG] Getting role assignments for clientServiceId: ${clientServiceId}`);
    
    // Get basic role assignments first
    const roleAssignmentsList = await db
      .select()
      .from(clientServiceRoleAssignments)
      .where(and(
        eq(clientServiceRoleAssignments.clientServiceId, clientServiceId),
        eq(clientServiceRoleAssignments.isActive, true)
      ));
    
    console.log(`[DEBUG] Found ${roleAssignmentsList.length} active role assignments`);
    
    // For each assignment, get the work role and user details
    const roleAssignmentsWithDetails = await Promise.all(
      roleAssignmentsList.map(async (assignment) => {
        // Get work role details
        const workRolesList = await db
          .select()
          .from(workRoles)
          .where(eq(workRoles.id, assignment.workRoleId));
        
        // Get user details
        const usersList = await db
          .select()
          .from(users)
          .where(eq(users.id, assignment.userId));
        
        if (!workRolesList.length || !usersList.length) {
          console.warn(`[WARNING] Missing workRole or user for assignment ${assignment.id}`);
          return null;
        }
        
        return {
          id: assignment.id,
          clientServiceId: assignment.clientServiceId,
          workRoleId: assignment.workRoleId,
          userId: assignment.userId,
          isActive: assignment.isActive,
          createdAt: assignment.createdAt,
          workRole: workRolesList[0],
          user: usersList[0],
        };
      })
    );
    
    // Filter out any null results
    const validRoleAssignments = roleAssignmentsWithDetails.filter(ra => ra !== null);
    console.log(`[DEBUG] Successfully processed ${validRoleAssignments.length} valid role assignments`);
    
    return validRoleAssignments;
  }

  async getClientServiceRoleAssignmentById(id: string): Promise<ClientServiceRoleAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(clientServiceRoleAssignments)
      .where(eq(clientServiceRoleAssignments.id, id));
    
    return assignment;
  }

  async createClientServiceRoleAssignment(assignmentData: InsertClientServiceRoleAssignment): Promise<ClientServiceRoleAssignment> {
    // Use transaction to ensure only one active user per role per client-service
    return await db.transaction(async (tx) => {
      if (assignmentData.isActive !== false) {
        // Deactivate any existing active assignments for this role and client-service
        await tx
          .update(clientServiceRoleAssignments)
          .set({ isActive: false })
          .where(and(
            eq(clientServiceRoleAssignments.clientServiceId, assignmentData.clientServiceId),
            eq(clientServiceRoleAssignments.workRoleId, assignmentData.workRoleId),
            eq(clientServiceRoleAssignments.isActive, true)
          ));
      }

      const [assignment] = await tx
        .insert(clientServiceRoleAssignments)
        .values(assignmentData)
        .returning();
      
      return assignment;
    });
  }

  async updateClientServiceRoleAssignment(id: string, assignmentData: Partial<InsertClientServiceRoleAssignment>): Promise<ClientServiceRoleAssignment> {
    return await db.transaction(async (tx) => {
      // If setting to active, deactivate other assignments for same role/client-service
      if (assignmentData.isActive === true) {
        const [existing] = await tx
          .select()
          .from(clientServiceRoleAssignments)
          .where(eq(clientServiceRoleAssignments.id, id));
        
        if (existing) {
          await tx
            .update(clientServiceRoleAssignments)
            .set({ isActive: false })
            .where(and(
              eq(clientServiceRoleAssignments.clientServiceId, existing.clientServiceId),
              eq(clientServiceRoleAssignments.workRoleId, existing.workRoleId),
              eq(clientServiceRoleAssignments.isActive, true)
            ));
        }
      }

      const [assignment] = await tx
        .update(clientServiceRoleAssignments)
        .set(assignmentData)
        .where(eq(clientServiceRoleAssignments.id, id))
        .returning();
      
      if (!assignment) {
        throw new Error("Client service role assignment not found");
      }
      
      return assignment;
    });
  }

  async deactivateClientServiceRoleAssignment(id: string): Promise<ClientServiceRoleAssignment> {
    const [assignment] = await db
      .update(clientServiceRoleAssignments)
      .set({ isActive: false })
      .where(eq(clientServiceRoleAssignments.id, id))
      .returning();
    
    if (!assignment) {
      throw new Error("Client service role assignment not found");
    }
    
    return assignment;
  }

  async deleteClientServiceRoleAssignment(id: string): Promise<void> {
    const result = await db.delete(clientServiceRoleAssignments).where(eq(clientServiceRoleAssignments.id, id));
    if (result.rowCount === 0) {
      throw new Error("Client service role assignment not found");
    }
  }

  // ==================== Role Resolution Methods (CRITICAL for project operations) ====================

  async resolveRoleAssigneeForClientByRoleId(clientId: string, projectTypeId: string, workRoleId: string): Promise<User | undefined> {
    try {
      // Find the service for this project type
      const [projectType] = await db
        .select()
        .from(projectTypes)
        .where(eq(projectTypes.id, projectTypeId));
      
      if (!projectType?.serviceId) {
        console.warn(`No project type or service found for project type ID: ${projectTypeId}`);
        return undefined;
      }

      const [service] = await db
        .select()
        .from(services)
        .where(eq(services.id, projectType.serviceId));
      
      if (!service) {
        console.warn(`No service found for project type ID: ${projectTypeId}`);
        return undefined;
      }

      // Find the client-service mapping
      const [clientService] = await db
        .select()
        .from(clientServices)
        .where(and(
          eq(clientServices.clientId, clientId),
          eq(clientServices.serviceId, service.id)
        ));
      
      if (!clientService) {
        console.warn(`No client-service mapping found for client ID: ${clientId} and service ID: ${service.id}`);
        return undefined;
      }

      // Find ALL active role assignments and pick most recent (deterministic selection)
      const assignments = await db
        .select()
        .from(clientServiceRoleAssignments)
        .innerJoin(users, eq(clientServiceRoleAssignments.userId, users.id))
        .where(and(
          eq(clientServiceRoleAssignments.clientServiceId, clientService.id),
          eq(clientServiceRoleAssignments.workRoleId, workRoleId),
          eq(clientServiceRoleAssignments.isActive, true)
        ))
        .orderBy(desc(clientServiceRoleAssignments.createdAt));
      
      if (assignments.length === 0) {
        console.warn(`No active role assignment found for client ${clientId}, work role ID ${workRoleId}`);
        return undefined;
      }

      if (assignments.length > 1) {
        console.warn(`Multiple active assignments found for client ${clientId}, work role ID ${workRoleId}. Selecting most recent assignment.`);
      }
      
      // Return the most recent assignment (deterministic selection)
      return assignments[0].users;
    } catch (error) {
      console.error(`Error resolving role assignee for client ${clientId}, project type ${projectTypeId}, work role ID ${workRoleId}:`, error);
      return undefined;
    }
  }

  async resolveRoleAssigneeForClient(clientId: string, projectTypeId: string, roleName: string): Promise<User | undefined> {
    try {
      // Find the service for this project type
      const [projectType] = await db
        .select()
        .from(projectTypes)
        .where(eq(projectTypes.id, projectTypeId));
      
      if (!projectType?.serviceId) {
        console.warn(`No project type or service found for project type ID: ${projectTypeId}`);
        return undefined;
      }

      const [service] = await db
        .select()
        .from(services)
        .where(eq(services.id, projectType.serviceId));
      
      if (!service) {
        console.warn(`No service found for project type ID: ${projectTypeId}`);
        return undefined;
      }

      // Find the client-service mapping
      const [clientService] = await db
        .select()
        .from(clientServices)
        .where(and(
          eq(clientServices.clientId, clientId),
          eq(clientServices.serviceId, service.id)
        ));
      
      if (!clientService) {
        console.warn(`No client-service mapping found for client ID: ${clientId} and service ID: ${service.id}`);
        return undefined;
      }

      // Find the work role by name
      const [workRole] = await db
        .select()
        .from(workRoles)
        .where(eq(workRoles.name, roleName));
      
      if (!workRole) {
        console.warn(`No work role found with name: ${roleName}`);
        return undefined;
      }

      // Find ALL active role assignments and pick most recent (deterministic selection)
      const assignments = await db
        .select()
        .from(clientServiceRoleAssignments)
        .innerJoin(users, eq(clientServiceRoleAssignments.userId, users.id))
        .where(and(
          eq(clientServiceRoleAssignments.clientServiceId, clientService.id),
          eq(clientServiceRoleAssignments.workRoleId, workRole.id),
          eq(clientServiceRoleAssignments.isActive, true)
        ))
        .orderBy(desc(clientServiceRoleAssignments.createdAt));
      
      if (assignments.length === 0) {
        console.warn(`No active role assignment found for client ${clientId}, role ${roleName}`);
        return undefined;
      }

      if (assignments.length > 1) {
        console.warn(`Multiple active assignments found for client ${clientId}, role ${roleName}. Selecting most recent assignment.`);
      }
      
      // Return the most recent assignment (deterministic selection)
      return assignments[0].users;
    } catch (error) {
      console.error(`Error resolving role assignee for client ${clientId}, project type ${projectTypeId}, role ${roleName}:`, error);
      return undefined;
    }
  }

  async validateClientServiceRoleCompleteness(clientId: string, serviceId: string): Promise<{ isComplete: boolean; missingRoles: string[]; assignedRoles: { roleName: string; userName: string }[] }> {
    // Find the client-service mapping
    const [clientService] = await db
      .select()
      .from(clientServices)
      .where(and(
        eq(clientServices.clientId, clientId),
        eq(clientServices.serviceId, serviceId)
      ));
    
    if (!clientService) {
      throw new Error("Client-service mapping not found");
    }

    // Get all required roles for this service
    const requiredRoles = await db
      .select({
        roleId: workRoles.id,
        roleName: workRoles.name,
      })
      .from(serviceRoles)
      .innerJoin(workRoles, eq(serviceRoles.roleId, workRoles.id))
      .where(eq(serviceRoles.serviceId, serviceId));

    // Get all active role assignments for this client-service
    const activeAssignments = await db
      .select({
        roleId: clientServiceRoleAssignments.workRoleId,
        roleName: workRoles.name,
        userName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
      })
      .from(clientServiceRoleAssignments)
      .innerJoin(workRoles, eq(clientServiceRoleAssignments.workRoleId, workRoles.id))
      .innerJoin(users, eq(clientServiceRoleAssignments.userId, users.id))
      .where(and(
        eq(clientServiceRoleAssignments.clientServiceId, clientService.id),
        eq(clientServiceRoleAssignments.isActive, true)
      ));

    // Find missing roles
    const assignedRoleIds = new Set(activeAssignments.map(a => a.roleId));
    const missingRoles = requiredRoles
      .filter(role => !assignedRoleIds.has(role.roleId))
      .map(role => role.roleName);

    // Format assigned roles
    const assignedRoles = activeAssignments.map(assignment => ({
      roleName: assignment.roleName,
      userName: assignment.userName,
    }));

    return {
      isComplete: missingRoles.length === 0,
      missingRoles,
      assignedRoles,
    };
  }

  // ==================== People Services CRUD operations ====================

  async getAllPeopleServices(): Promise<(PeopleService & { person: Person; service: Service })[]> {
    const results = await db
      .select({
        id: peopleServices.id,
        personId: peopleServices.personId,
        serviceId: peopleServices.serviceId,
        serviceOwnerId: peopleServices.serviceOwnerId,
        frequency: peopleServices.frequency,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        intendedStartDay: peopleServices.intendedStartDay,
        intendedDueDay: peopleServices.intendedDueDay,
        notes: peopleServices.notes,
        isActive: peopleServices.isActive,
        createdAt: peopleServices.createdAt,
        // Person details
        person: people,
        // Service details  
        service: services,
      })
      .from(peopleServices)
      .leftJoin(people, eq(peopleServices.personId, people.id))
      .leftJoin(services, eq(peopleServices.serviceId, services.id));

    return results.map(result => ({
      id: result.id,
      personId: result.personId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      intendedStartDay: result.intendedStartDay,
      intendedDueDay: result.intendedDueDay,
      notes: result.notes,
      isActive: result.isActive,
      createdAt: result.createdAt,
      person: result.person!,
      service: result.service!,
    }));
  }

  async getPeopleServiceById(id: string): Promise<(PeopleService & { person: Person; service: Service }) | undefined> {
    const [result] = await db
      .select({
        id: peopleServices.id,
        personId: peopleServices.personId,
        serviceId: peopleServices.serviceId,
        serviceOwnerId: peopleServices.serviceOwnerId,
        frequency: peopleServices.frequency,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        intendedStartDay: peopleServices.intendedStartDay,
        intendedDueDay: peopleServices.intendedDueDay,
        notes: peopleServices.notes,
        isActive: peopleServices.isActive,
        createdAt: peopleServices.createdAt,
        // Person details
        person: people,
        // Service details
        service: services,
      })
      .from(peopleServices)
      .leftJoin(people, eq(peopleServices.personId, people.id))
      .leftJoin(services, eq(peopleServices.serviceId, services.id))
      .where(eq(peopleServices.id, id));

    if (!result) return undefined;

    return {
      id: result.id,
      personId: result.personId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      intendedStartDay: result.intendedStartDay,
      intendedDueDay: result.intendedDueDay,
      notes: result.notes,
      isActive: result.isActive,
      createdAt: result.createdAt,
      person: result.person!,
      service: result.service!,
    };
  }

  async getPeopleServicesByPersonId(personId: string): Promise<(PeopleService & { service: Service })[]> {
    const results = await db
      .select({
        id: peopleServices.id,
        personId: peopleServices.personId,
        serviceId: peopleServices.serviceId,
        serviceOwnerId: peopleServices.serviceOwnerId,
        frequency: peopleServices.frequency,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        intendedStartDay: peopleServices.intendedStartDay,
        intendedDueDay: peopleServices.intendedDueDay,
        notes: peopleServices.notes,
        isActive: peopleServices.isActive,
        createdAt: peopleServices.createdAt,
        // Service details
        service: services,
      })
      .from(peopleServices)
      .leftJoin(services, eq(peopleServices.serviceId, services.id))
      .where(eq(peopleServices.personId, personId));

    return results.map(result => ({
      id: result.id,
      personId: result.personId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      intendedStartDay: result.intendedStartDay,
      intendedDueDay: result.intendedDueDay,
      notes: result.notes,
      isActive: result.isActive,
      createdAt: result.createdAt,
      service: result.service!,
    }));
  }

  async getPeopleServicesByServiceId(serviceId: string): Promise<(PeopleService & { person: Person })[]> {
    const results = await db
      .select({
        id: peopleServices.id,
        personId: peopleServices.personId,
        serviceId: peopleServices.serviceId,
        serviceOwnerId: peopleServices.serviceOwnerId,
        frequency: peopleServices.frequency,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        intendedStartDay: peopleServices.intendedStartDay,
        intendedDueDay: peopleServices.intendedDueDay,
        notes: peopleServices.notes,
        isActive: peopleServices.isActive,
        createdAt: peopleServices.createdAt,
        // Person details
        person: people,
      })
      .from(peopleServices)
      .leftJoin(people, eq(peopleServices.personId, people.id))
      .where(eq(peopleServices.serviceId, serviceId));

    return results.map(result => ({
      id: result.id,
      personId: result.personId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      intendedStartDay: result.intendedStartDay,
      intendedDueDay: result.intendedDueDay,
      notes: result.notes,
      isActive: result.isActive,
      createdAt: result.createdAt,
      person: result.person!,
    }));
  }

  async getPeopleServicesByClientId(clientId: string): Promise<(PeopleService & { person: Person; service: Service; serviceOwner?: User })[]> {
    const results = await db
      .select({
        id: peopleServices.id,
        personId: peopleServices.personId,
        serviceId: peopleServices.serviceId,
        serviceOwnerId: peopleServices.serviceOwnerId,
        frequency: peopleServices.frequency,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        intendedStartDay: peopleServices.intendedStartDay,
        intendedDueDay: peopleServices.intendedDueDay,
        notes: peopleServices.notes,
        isActive: peopleServices.isActive,
        createdAt: peopleServices.createdAt,
        // Person details
        person: people,
        // Service details
        service: services,
        // Service owner details (optional)
        serviceOwner: users,
      })
      .from(peopleServices)
      .leftJoin(people, eq(peopleServices.personId, people.id))
      .leftJoin(services, eq(peopleServices.serviceId, services.id))
      .leftJoin(users, eq(peopleServices.serviceOwnerId, users.id))
      .leftJoin(clientPeople, eq(people.id, clientPeople.personId))
      .where(eq(clientPeople.clientId, clientId));

    return results.map(result => ({
      id: result.id,
      personId: result.personId,
      serviceId: result.serviceId,
      serviceOwnerId: result.serviceOwnerId,
      frequency: result.frequency,
      nextStartDate: result.nextStartDate,
      nextDueDate: result.nextDueDate,
      intendedStartDay: result.intendedStartDay,
      intendedDueDay: result.intendedDueDay,
      notes: result.notes,
      isActive: result.isActive,
      createdAt: result.createdAt,
      person: result.person!,
      service: result.service!,
      serviceOwner: result.serviceOwner || undefined,
    }));
  }

  async createPeopleService(peopleServiceData: InsertPeopleService): Promise<PeopleService> {
    // Convert ISO string dates to Date objects for timestamp fields
    const processedData = { ...peopleServiceData } as any;
    if (processedData.nextStartDate && typeof processedData.nextStartDate === 'string') {
      processedData.nextStartDate = new Date(processedData.nextStartDate);
    }
    if (processedData.nextDueDate && typeof processedData.nextDueDate === 'string') {
      processedData.nextDueDate = new Date(processedData.nextDueDate);
    }

    const [newPeopleService] = await db.insert(peopleServices).values(processedData).returning();
    return newPeopleService;
  }

  async updatePeopleService(id: string, peopleServiceData: Partial<InsertPeopleService>): Promise<PeopleService> {
    // Convert ISO string dates to Date objects for timestamp fields
    const processedData = { ...peopleServiceData } as any;
    if (processedData.nextStartDate && typeof processedData.nextStartDate === 'string') {
      processedData.nextStartDate = new Date(processedData.nextStartDate);
    }
    if (processedData.nextDueDate && typeof processedData.nextDueDate === 'string') {
      processedData.nextDueDate = new Date(processedData.nextDueDate);
    }

    const [updatedPeopleService] = await db
      .update(peopleServices)
      .set(processedData)
      .where(eq(peopleServices.id, id))
      .returning();

    if (!updatedPeopleService) {
      throw new Error("People service not found");
    }

    return updatedPeopleService;
  }

  async deletePeopleService(id: string): Promise<void> {
    const result = await db.delete(peopleServices).where(eq(peopleServices.id, id));
    if (result.rowCount === 0) {
      throw new Error("People service not found");
    }
  }

  async checkPeopleServiceMappingExists(personId: string, serviceId: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(peopleServices)
      .where(and(
        eq(peopleServices.personId, personId),
        eq(peopleServices.serviceId, serviceId)
      ))
      .limit(1);
    
    return !!existing;
  }

  async getAllPeopleServicesWithDetails(): Promise<(PeopleService & { service: Service & { projectType: ProjectType } })[]> {
    const results = await db
      .select({
        peopleService: peopleServices,
        service: services,
        projectType: projectTypes,
      })
      .from(peopleServices)
      .innerJoin(services, eq(peopleServices.serviceId, services.id))
      .leftJoin(projectTypes, eq(projectTypes.serviceId, services.id))
      .where(eq(peopleServices.isActive, true))
      .orderBy(peopleServices.personId, services.name);

    return results.map(result => ({
      ...result.peopleService,
      service: {
        ...result.service,
        projectType: result.projectType
      }
    })); // Return all services, including those with null project types for error detection
  }

  // ==================== Additional Helper Methods ====================

  async validateAssignedRolesAgainstService(serviceId: string, roleIds: string[]): Promise<{ isValid: boolean; invalidRoles: string[]; allowedRoles: string[] }> {
    if (!roleIds || roleIds.length === 0) {
      return { isValid: true, invalidRoles: [], allowedRoles: [] };
    }

    // Get all allowed roles for this service
    const allowedRoles = await db
      .select({
        roleId: workRoles.id,
        roleName: workRoles.name,
      })
      .from(serviceRoles)
      .innerJoin(workRoles, eq(serviceRoles.roleId, workRoles.id))
      .where(eq(serviceRoles.serviceId, serviceId));

    const allowedRoleIds = new Set(allowedRoles.map(r => r.roleId));
    const allowedRoleNames = allowedRoles.map(r => r.roleName);

    // Find invalid role IDs
    const invalidRoleIds = roleIds.filter(roleId => !allowedRoleIds.has(roleId));
    
    // Get names for invalid roles for better error messages
    let invalidRoleNames: string[] = [];
    if (invalidRoleIds.length > 0) {
      const invalidRoles = await db
        .select({
          roleId: workRoles.id,
          roleName: workRoles.name,
        })
        .from(workRoles)
        .where(inArray(workRoles.id, invalidRoleIds));
      
      invalidRoleNames = invalidRoles.map(r => r.roleName);
    }

    return {
      isValid: invalidRoleIds.length === 0,
      invalidRoles: invalidRoleNames,
      allowedRoles: allowedRoleNames,
    };
  }

  // ==================== Service Owner & Assignment Resolution ====================

  /**
   * Resolve service owner from client-service mapping
   */
  async resolveServiceOwner(clientId: string, projectTypeId: string): Promise<User | undefined> {
    // Get service owner from client-service mapping
    const clientService = await this.getClientServiceByClientAndProjectType(clientId, projectTypeId);
    if (clientService && clientService.serviceOwnerId) {
      // Use helper to get user
      const getUser = this.getHelper('getUser') as ((userId: string) => Promise<User | undefined>) | undefined;
      if (getUser) {
        return await getUser(clientService.serviceOwnerId);
      }
    }
    
    return undefined;
  }

  /**
   * Resolve all project role assignments for a client-service combination
   * Returns bookkeeper, client manager, and current assignee IDs
   */
  async resolveProjectAssignments(clientId: string, projectTypeId: string): Promise<{
    bookkeeperId: string;
    clientManagerId: string;
    currentAssigneeId: string;
    usedFallback: boolean;
    fallbackRoles: string[];
  }> {
    let usedFallback = false;
    const fallbackRoles: string[] = [];

    // Get helpers
    const getServiceByProjectTypeId = this.getHelper('getServiceByProjectTypeId') as ((projectTypeId: string) => Promise<any>) | undefined;
    const getFallbackUser = this.getHelper('getFallbackUser') as (() => Promise<User | undefined>) | undefined;
    const getDefaultStage = this.getHelper('getDefaultStage') as (() => Promise<any>) | undefined;
    const getUser = this.getHelper('getUser') as ((userId: string) => Promise<User | undefined>) | undefined;
    const getWorkRoleById = this.getHelper('getWorkRoleById') as ((roleId: string) => Promise<any>) | undefined;

    // Check if project type is mapped to a service
    const service = getServiceByProjectTypeId ? await getServiceByProjectTypeId(projectTypeId) : undefined;
    if (!service) {
      throw new Error('Project type is not mapped to a service - cannot use role-based assignments');
    }

    // Get client service mapping
    const clientService = await this.getClientServiceByClientAndProjectType(clientId, projectTypeId);
    if (!clientService) {
      throw new Error(`Client does not have service mapping for this project type`);
    }

    // Get fallback user for when role assignments are missing
    const fallbackUser = getFallbackUser ? await getFallbackUser() : undefined;
    if (!fallbackUser) {
      throw new Error('No fallback user configured - please set a fallback user for role-based assignments');
    }

    // Resolve bookkeeper role
    let bookkeeper = await this.resolveRoleAssigneeForClient(clientId, projectTypeId, 'bookkeeper');
    if (!bookkeeper) {
      console.warn(`No bookkeeper assignment found for client ${clientId}, using fallback user`);
      bookkeeper = fallbackUser;
      usedFallback = true;
      fallbackRoles.push('bookkeeper');
    }

    // Resolve client manager role
    let clientManager = await this.resolveRoleAssigneeForClient(clientId, projectTypeId, 'client_manager');
    if (!clientManager) {
      console.warn(`No client_manager assignment found for client ${clientId}, using fallback user`);
      clientManager = fallbackUser;
      usedFallback = true;
      fallbackRoles.push('client_manager');
    }

    // Get the default stage to determine initial current assignee
    const defaultStage = getDefaultStage ? await getDefaultStage() : undefined;
    let currentAssignee = clientManager; // Default to client manager

    if (defaultStage?.assignedUserId && getUser) {
      // Direct user assignment
      const assignedUser = await getUser(defaultStage.assignedUserId);
      if (assignedUser) {
        currentAssignee = assignedUser;
      } else {
        console.warn(`Assigned user ${defaultStage.assignedUserId} not found, using client manager`);
        currentAssignee = clientManager;
      }
    } else if (defaultStage?.assignedWorkRoleId && getWorkRoleById) {
      // Work role assignment - resolve through client service role assignments
      const workRole = await getWorkRoleById(defaultStage.assignedWorkRoleId);
      if (workRole) {
        const roleAssignment = await this.resolveRoleAssigneeForClient(clientId, projectTypeId, workRole.name);
        if (roleAssignment) {
          currentAssignee = roleAssignment;
        } else {
          console.warn(`No ${workRole.name} assignment found for client ${clientId}, using client manager`);
          currentAssignee = clientManager;
        }
      } else {
        console.warn(`Work role ${defaultStage.assignedWorkRoleId} not found, using client manager`);
        currentAssignee = clientManager;
      }
    }

    if (usedFallback) {
      console.log(`Used fallback user for roles: ${fallbackRoles.join(', ')} when creating project for client ${clientId}`);
    }

    return {
      bookkeeperId: bookkeeper.id,
      clientManagerId: clientManager.id,
      currentAssigneeId: currentAssignee.id,
      usedFallback,
      fallbackRoles,
    };
  }

  /**
   * Resolve the stage role assignee for a project based on kanban stage and client service role assignments
   */
  async resolveStageRoleAssignee(project: any): Promise<User | undefined> {
    try {
      // If no current status, project type, or service, we can't resolve the assignee
      if (!project.currentStatus || !project.projectType?.id || !project.projectType?.serviceId) {
        return undefined;
      }

      // Find the kanban stage that matches the project's current status
      const stage = await db.query.kanbanStages.findFirst({
        where: and(
          eq(kanbanStages.projectTypeId, project.projectType.id),
          eq(kanbanStages.name, project.currentStatus)
        ),
      });

      // If no stage found or no role assigned to the stage, return undefined
      if (!stage || !stage.assignedWorkRoleId) {
        return undefined;
      }

      // Find the client service for this project's client and service
      const clientService = await db.query.clientServices.findFirst({
        where: and(
          eq(clientServices.clientId, project.clientId),
          eq(clientServices.serviceId, project.projectType.serviceId)
        ),
      });

      if (!clientService) {
        return undefined;
      }

      // Find the role assignment for this client service and work role
      const roleAssignment = await db.query.clientServiceRoleAssignments.findFirst({
        where: and(
          eq(clientServiceRoleAssignments.clientServiceId, clientService.id),
          eq(clientServiceRoleAssignments.workRoleId, stage.assignedWorkRoleId),
          eq(clientServiceRoleAssignments.isActive, true)
        ),
        with: {
          user: true,
        },
      });

      return (roleAssignment?.user as User) || undefined;
    } catch (error) {
      console.error('[Storage] Error resolving stage role assignee:', error);
      return undefined;
    }
  }

  /**
   * Batch resolve stage role assignees for multiple projects.
   * OPTIMIZED: Reduces N+1 queries (3 per project) to just 3 batch queries total.
   * Used by getAllProjects and similar bulk project fetching methods.
   */
  async resolveStageRoleAssigneesBatch(projects: any[]): Promise<Map<string, User | undefined>> {
    const result = new Map<string, User | undefined>();

    try {
      // Filter projects that have the required data for resolution
      const validProjects = projects.filter(
        p => p.currentStatus && p.projectType?.id && p.projectType?.serviceId
      );

      if (validProjects.length === 0) {
        return result;
      }

      // Extract unique project type IDs and get all relevant kanban stages in one query
      const uniqueProjectTypeIds = Array.from(new Set(validProjects.map(p => p.projectType.id)));
      const allStages = await db.query.kanbanStages.findMany({
        where: inArray(kanbanStages.projectTypeId, uniqueProjectTypeIds),
      });

      // Build a map of projectTypeId:stageName -> stage
      const stageMap = new Map<string, typeof allStages[0]>();
      for (const stage of allStages) {
        stageMap.set(`${stage.projectTypeId}:${stage.name}`, stage);
      }

      // Build unique client+service combinations and fetch all client services in one query
      const clientServiceKeys = Array.from(new Set(validProjects.map(p => `${p.clientId}:${p.projectType.serviceId}`)));
      const clientServiceConditions = clientServiceKeys.map(key => {
        const [clientId, serviceId] = key.split(':');
        return and(eq(clientServices.clientId, clientId), eq(clientServices.serviceId, serviceId));
      });

      let allClientServices: typeof clientServices.$inferSelect[] = [];
      if (clientServiceConditions.length > 0) {
        allClientServices = await db.query.clientServices.findMany({
          where: or(...clientServiceConditions),
        });
      }

      // Build a map of clientId:serviceId -> clientService
      const clientServiceMap = new Map<string, typeof allClientServices[0]>();
      for (const cs of allClientServices) {
        clientServiceMap.set(`${cs.clientId}:${cs.serviceId}`, cs);
      }

      // Collect all unique client service IDs that we need role assignments for
      const clientServiceIds = allClientServices.map(cs => cs.id);

      // Fetch all role assignments for these client services in one query
      let allRoleAssignments: Array<{
        clientServiceId: string;
        workRoleId: string;
        user: User | null;
      }> = [];

      if (clientServiceIds.length > 0) {
        const assignments = await db.query.clientServiceRoleAssignments.findMany({
          where: and(
            inArray(clientServiceRoleAssignments.clientServiceId, clientServiceIds),
            eq(clientServiceRoleAssignments.isActive, true)
          ),
          with: {
            user: true,
          },
        });
        allRoleAssignments = assignments.map(a => ({
          clientServiceId: a.clientServiceId,
          workRoleId: a.workRoleId,
          user: a.user as User | null,
        }));
      }

      // Build a map of clientServiceId:workRoleId -> user
      const roleAssignmentMap = new Map<string, User | null>();
      for (const ra of allRoleAssignments) {
        roleAssignmentMap.set(`${ra.clientServiceId}:${ra.workRoleId}`, ra.user);
      }

      // Resolve for each project using the cached data
      for (const project of validProjects) {
        // Find the stage
        const stage = stageMap.get(`${project.projectType.id}:${project.currentStatus}`);
        if (!stage || !stage.assignedWorkRoleId) {
          result.set(project.id, undefined);
          continue;
        }

        // Find the client service
        const clientService = clientServiceMap.get(`${project.clientId}:${project.projectType.serviceId}`);
        if (!clientService) {
          result.set(project.id, undefined);
          continue;
        }

        // Find the role assignment
        const user = roleAssignmentMap.get(`${clientService.id}:${stage.assignedWorkRoleId}`);
        result.set(project.id, user || undefined);
      }

      return result;
    } catch (error) {
      console.error('[Storage] Error in batch resolve stage role assignees:', error);
      return result;
    }
  }
}
