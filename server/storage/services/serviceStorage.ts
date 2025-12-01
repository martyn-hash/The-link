import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { 
  services, 
  projectTypes, 
  serviceRoles, 
  workRoles, 
  clientServices, 
  peopleServices,
  people,
  users,
  clients,
  clientPeople,
  projects,
} from '@shared/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';
import type { Service, InsertService, ProjectType, WorkRole } from '@shared/schema';
import type { ScheduledServiceView } from '../base/types.js';

export class ServiceStorage extends BaseStorage {
  // ==================== Service Query Operations ====================

  async getAllServices(): Promise<(Service & { projectType: ProjectType; roles: WorkRole[] })[]> {
    // Get services with their optional project types
    const servicesData = await db
      .select({
        service: services,
        projectType: projectTypes,
      })
      .from(services)
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId));

    // Get all service roles in one query
    const allServiceRoles = await db
      .select({
        serviceId: serviceRoles.serviceId,
        role: workRoles,
      })
      .from(serviceRoles)
      .leftJoin(workRoles, eq(serviceRoles.roleId, workRoles.id));

    // Group roles by service ID
    const rolesByServiceId = allServiceRoles.reduce((acc, item) => {
      if (!acc[item.serviceId]) {
        acc[item.serviceId] = [];
      }
      if (item.role) {
        acc[item.serviceId].push(item.role);
      }
      return acc;
    }, {} as Record<string, WorkRole[]>);

    // Deduplicate services using a Map (services can have multiple project types)
    const servicesMap = new Map<string, Service & { projectType: ProjectType | null; roles: WorkRole[] }>();
    
    servicesData.forEach((row) => {
      if (!servicesMap.has(row.service.id)) {
        servicesMap.set(row.service.id, {
          ...row.service,
          projectType: row.projectType?.id ? row.projectType : null,
          roles: rolesByServiceId[row.service.id] || [],
        });
      }
    });

    return Array.from(servicesMap.values());
  }

  async getActiveServices(): Promise<(Service & { projectType: ProjectType | null; roles: WorkRole[] })[]> {
    // Get services with their optional project types
    const servicesData = await db
      .select({
        service: services,
        projectType: projectTypes,
      })
      .from(services)
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId));

    // Get all service roles in one query
    const allServiceRoles = await db
      .select({
        serviceId: serviceRoles.serviceId,
        role: workRoles,
      })
      .from(serviceRoles)
      .leftJoin(workRoles, eq(serviceRoles.roleId, workRoles.id));

    // Group roles by service ID
    const rolesByServiceId = allServiceRoles.reduce((acc, item) => {
      if (!acc[item.serviceId]) {
        acc[item.serviceId] = [];
      }
      if (item.role) {
        acc[item.serviceId].push(item.role);
      }
      return acc;
    }, {} as Record<string, WorkRole[]>);

    // Deduplicate services using a Map (services can have multiple project types)
    const servicesMap = new Map<string, Service & { projectType: ProjectType | null; roles: WorkRole[] }>();
    
    servicesData.forEach((row) => {
      if (!servicesMap.has(row.service.id)) {
        servicesMap.set(row.service.id, {
          ...row.service,
          projectType: row.projectType?.id ? row.projectType : null,
          roles: rolesByServiceId[row.service.id] || [],
        });
      }
    });

    return Array.from(servicesMap.values());
  }

  async getServicesWithActiveClients(): Promise<Service[]> {
    // Get distinct services that have at least one active client service
    const servicesWithActiveClients = await db
      .selectDistinct({ service: services })
      .from(services)
      .innerJoin(clientServices, eq(services.id, clientServices.serviceId))
      .where(eq(clientServices.isActive, true));

    return servicesWithActiveClients.map(row => row.service);
  }

  async getClientAssignableServices(): Promise<(Service & { projectType: ProjectType | null; roles: WorkRole[] })[]> {
    // Get services that are NOT personal services (for client assignment)
    const servicesData = await db
      .select({
        service: services,
        projectType: projectTypes,
      })
      .from(services)
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId))
      .where(or(eq(services.isPersonalService, false), isNull(services.isPersonalService)));

    // Get all service roles in one query
    const allServiceRoles = await db
      .select({
        serviceId: serviceRoles.serviceId,
        role: workRoles,
      })
      .from(serviceRoles)
      .leftJoin(workRoles, eq(serviceRoles.roleId, workRoles.id));

    // Group roles by service ID
    const rolesByServiceId = allServiceRoles.reduce((acc, item) => {
      if (!acc[item.serviceId]) {
        acc[item.serviceId] = [];
      }
      if (item.role) {
        acc[item.serviceId].push(item.role);
      }
      return acc;
    }, {} as Record<string, WorkRole[]>);

    // Deduplicate services using a Map (services can have multiple project types)
    const servicesMap = new Map<string, Service & { projectType: ProjectType | null; roles: WorkRole[] }>();
    
    servicesData.forEach((row) => {
      if (!servicesMap.has(row.service.id)) {
        servicesMap.set(row.service.id, {
          ...row.service,
          projectType: row.projectType?.id ? row.projectType : null,
          roles: rolesByServiceId[row.service.id] || [],
        });
      }
    });

    return Array.from(servicesMap.values());
  }

  async getProjectTypeAssignableServices(): Promise<(Service & { projectType: ProjectType | null; roles: WorkRole[] })[]> {
    // Get services that are NOT personal services AND NOT static services (for project type mapping)
    const servicesData = await db
      .select({
        service: services,
        projectType: projectTypes,
      })
      .from(services)
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId))
      .where(
        and(
          or(eq(services.isPersonalService, false), isNull(services.isPersonalService)),
          or(eq(services.isStaticService, false), isNull(services.isStaticService))
        )
      );

    // Get all service roles in one query
    const allServiceRoles = await db
      .select({
        serviceId: serviceRoles.serviceId,
        role: workRoles,
      })
      .from(serviceRoles)
      .leftJoin(workRoles, eq(serviceRoles.roleId, workRoles.id));

    // Group roles by service ID
    const rolesByServiceId = allServiceRoles.reduce((acc, item) => {
      if (!acc[item.serviceId]) {
        acc[item.serviceId] = [];
      }
      if (item.role) {
        acc[item.serviceId].push(item.role);
      }
      return acc;
    }, {} as Record<string, WorkRole[]>);

    // Deduplicate services using a Map (services can have multiple project types)
    const servicesMap = new Map<string, Service & { projectType: ProjectType | null; roles: WorkRole[] }>();
    
    servicesData.forEach((row) => {
      if (!servicesMap.has(row.service.id)) {
        servicesMap.set(row.service.id, {
          ...row.service,
          projectType: row.projectType?.id ? row.projectType : null,
          roles: rolesByServiceId[row.service.id] || [],
        });
      }
    });

    return Array.from(servicesMap.values());
  }

  async getServiceById(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async getServiceByName(name: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.name, name));
    return service;
  }

  async getServiceByProjectTypeId(projectTypeId: string): Promise<Service | undefined> {
    // Validate projectTypeId to prevent undefined/null being passed to query builder
    if (!projectTypeId || projectTypeId.trim() === '') {
      console.warn(`[Storage] getServiceByProjectTypeId called with invalid projectTypeId: "${projectTypeId}"`);
      return undefined;
    }
    
    // With inverted relationship: get project type first, then its associated service
    const [projectType] = await db
      .select()
      .from(projectTypes)
      .where(eq(projectTypes.id, projectTypeId));
    
    if (!projectType || !projectType.serviceId) {
      return undefined;
    }
    
    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.id, projectType.serviceId));
    return service;
  }

  async getScheduledServices(): Promise<ScheduledServiceView[]> {
    // Get client services data
    const clientServicesData = await db
      .select({
        id: clientServices.id,
        serviceId: clientServices.serviceId,
        serviceName: services.name,
        clientOrPersonName: clients.name,
        nextStartDate: clientServices.nextStartDate,
        nextDueDate: clientServices.nextDueDate,
        targetDeliveryDate: clientServices.targetDeliveryDate,
        frequency: clientServices.frequency,
        isActive: clientServices.isActive,
        serviceOwnerId: clientServices.serviceOwnerId,
        serviceOwnerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        projectTypeName: projectTypes.name,
        clientId: clientServices.clientId,
        projectTypeId: projectTypes.id,
      })
      .from(clientServices)
      .leftJoin(services, eq(clientServices.serviceId, services.id))
      .leftJoin(clients, eq(clientServices.clientId, clients.id))
      .leftJoin(users, eq(clientServices.serviceOwnerId, users.id))
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId))
      .where(eq(clientServices.isActive, true));

    // Get people services data with client context
    const peopleServicesData = await db
      .select({
        id: peopleServices.id,
        serviceId: peopleServices.serviceId,
        serviceName: services.name,
        clientOrPersonName: people.fullName,
        nextStartDate: peopleServices.nextStartDate,
        nextDueDate: peopleServices.nextDueDate,
        targetDeliveryDate: peopleServices.targetDeliveryDate,
        frequency: peopleServices.frequency,
        isActive: peopleServices.isActive,
        serviceOwnerId: peopleServices.serviceOwnerId,
        serviceOwnerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        projectTypeName: projectTypes.name,
        clientId: clientPeople.clientId,
        projectTypeId: projectTypes.id,
      })
      .from(peopleServices)
      .leftJoin(services, eq(peopleServices.serviceId, services.id))
      .leftJoin(people, eq(peopleServices.personId, people.id))
      .leftJoin(users, eq(peopleServices.serviceOwnerId, users.id))
      .leftJoin(projectTypes, eq(services.id, projectTypes.serviceId))
      .leftJoin(clientPeople, eq(peopleServices.personId, clientPeople.personId))
      .where(eq(peopleServices.isActive, true));

    // Get active projects to check which services have active projects and fetch their dates
    const activeProjects = await db
      .select({
        projectTypeId: projects.projectTypeId,
        clientId: projects.clientId,
        projectMonth: projects.projectMonth,
        dueDate: projects.dueDate,
        targetDeliveryDate: projects.targetDeliveryDate,
      })
      .from(projects)
      .where(and(
        eq(projects.archived, false),
        eq(projects.inactive, false),
        sql`${projects.currentStatus} != 'completed'`
      ));

    // Create a set of client-projectType combinations that have active projects
    const activeProjectKeys = new Set(
      activeProjects.map(p => `${p.clientId}-${p.projectTypeId}`)
    );

    // Create a map of client-projectType combinations to their project dates
    const activeProjectDates = new Map<string, { startDate: Date | null; dueDate: Date | null; targetDeliveryDate: Date | null }>();
    activeProjects.forEach(p => {
      const key = `${p.clientId}-${p.projectTypeId}`;
      activeProjectDates.set(key, {
        startDate: p.projectMonth as any,
        dueDate: p.dueDate,
        targetDeliveryDate: p.targetDeliveryDate
      });
    });

    // Combine and transform the data, filtering out duplicates and calculating hasActiveProject
    const seenServices = new Set<string>();
    const scheduledServices: ScheduledServiceView[] = [];

    // Process client services
    for (const cs of clientServicesData) {
      const uniqueKey = `client-${cs.id}`;
      if (!seenServices.has(uniqueKey)) {
        seenServices.add(uniqueKey);
        
        // Calculate hasActiveProject for client services
        const projectKey = `${cs.clientId}-${cs.projectTypeId}`;
        const hasActiveProject = cs.clientId && cs.projectTypeId 
          ? activeProjectKeys.has(projectKey)
          : false;

        // Get current project dates if there's an active project
        const currentProjectDates = hasActiveProject && cs.clientId && cs.projectTypeId
          ? activeProjectDates.get(projectKey)
          : null;

        scheduledServices.push({
          id: cs.id || '',
          serviceId: cs.serviceId || '',
          serviceName: cs.serviceName || '',
          clientOrPersonName: cs.clientOrPersonName || '',
          clientOrPersonType: 'client' as const,
          nextStartDate: cs.nextStartDate ? cs.nextStartDate.toISOString() : null,
          nextDueDate: cs.nextDueDate ? cs.nextDueDate.toISOString() : null,
          targetDeliveryDate: cs.targetDeliveryDate ? cs.targetDeliveryDate.toISOString() : null,
          currentProjectStartDate: currentProjectDates?.startDate ? 
            (currentProjectDates.startDate instanceof Date ? currentProjectDates.startDate.toISOString() : 
             typeof currentProjectDates.startDate === 'string' ? currentProjectDates.startDate : 
             new Date(currentProjectDates.startDate).toISOString()) : null,
          currentProjectDueDate: currentProjectDates?.dueDate ? 
            (currentProjectDates.dueDate instanceof Date ? currentProjectDates.dueDate.toISOString() : 
             typeof currentProjectDates.dueDate === 'string' ? currentProjectDates.dueDate : 
             new Date(currentProjectDates.dueDate).toISOString()) : null,
          currentProjectTargetDeliveryDate: currentProjectDates?.targetDeliveryDate ? 
            (currentProjectDates.targetDeliveryDate instanceof Date ? currentProjectDates.targetDeliveryDate.toISOString() : 
             typeof currentProjectDates.targetDeliveryDate === 'string' ? currentProjectDates.targetDeliveryDate : 
             new Date(currentProjectDates.targetDeliveryDate).toISOString()) : null,
          projectTypeName: cs.projectTypeName || null,
          hasActiveProject,
          frequency: cs.frequency || 'monthly',
          isActive: cs.isActive || false,
          serviceOwnerId: cs.serviceOwnerId || undefined,
          serviceOwnerName: cs.serviceOwnerName || undefined,
        });
      }
    }

    // Process people services
    for (const ps of peopleServicesData) {
      const uniqueKey = `person-${ps.id}`;
      if (!seenServices.has(uniqueKey)) {
        seenServices.add(uniqueKey);
        
        // Calculate hasActiveProject for people services (requires client context)
        const projectKey = `${ps.clientId}-${ps.projectTypeId}`;
        const hasActiveProject = ps.clientId && ps.projectTypeId 
          ? activeProjectKeys.has(projectKey)
          : false;

        // Get current project dates if there's an active project
        const currentProjectDates = hasActiveProject && ps.clientId && ps.projectTypeId
          ? activeProjectDates.get(projectKey)
          : null;

        scheduledServices.push({
          id: ps.id || '',
          serviceId: ps.serviceId || '',
          serviceName: ps.serviceName || '',
          clientOrPersonName: ps.clientOrPersonName || '',
          clientOrPersonType: 'person' as const,
          nextStartDate: ps.nextStartDate ? ps.nextStartDate.toISOString() : null,
          nextDueDate: ps.nextDueDate ? ps.nextDueDate.toISOString() : null,
          targetDeliveryDate: ps.targetDeliveryDate ? ps.targetDeliveryDate.toISOString() : null,
          currentProjectStartDate: currentProjectDates?.startDate ? 
            (currentProjectDates.startDate instanceof Date ? currentProjectDates.startDate.toISOString() : 
             typeof currentProjectDates.startDate === 'string' ? currentProjectDates.startDate : 
             new Date(currentProjectDates.startDate).toISOString()) : null,
          currentProjectDueDate: currentProjectDates?.dueDate ? 
            (currentProjectDates.dueDate instanceof Date ? currentProjectDates.dueDate.toISOString() : 
             typeof currentProjectDates.dueDate === 'string' ? currentProjectDates.dueDate : 
             new Date(currentProjectDates.dueDate).toISOString()) : null,
          currentProjectTargetDeliveryDate: currentProjectDates?.targetDeliveryDate ? 
            (currentProjectDates.targetDeliveryDate instanceof Date ? currentProjectDates.targetDeliveryDate.toISOString() : 
             typeof currentProjectDates.targetDeliveryDate === 'string' ? currentProjectDates.targetDeliveryDate : 
             new Date(currentProjectDates.targetDeliveryDate).toISOString()) : null,
          projectTypeName: ps.projectTypeName || null,
          hasActiveProject,
          frequency: ps.frequency || 'monthly',
          isActive: ps.isActive || false,
          serviceOwnerId: ps.serviceOwnerId || undefined,
          serviceOwnerName: ps.serviceOwnerName || undefined,
        });
      }
    }

    return scheduledServices;
  }

  // ==================== Service CRUD Operations ====================

  private ensureVatUdf(udfDefinitions: any[] = [], isVatService: boolean): any[] {
    const VAT_UDF_FIELD_ID = 'vat_number_auto';
    const VAT_UDF_FIELD_NAME = 'VAT Number';
    const VAT_NUMBER_REGEX = '^(GB)?\\s?\\d{3}\\s?\\d{4}\\s?\\d{2}(\\s?\\d{3})?$';
    const VAT_NUMBER_REGEX_ERROR = 'Please enter a valid UK VAT number (e.g., 123456789 or GB123456789)';
    const VAT_ADDRESS_UDF_FIELD_ID = 'vat_address_auto';
    const VAT_ADDRESS_UDF_FIELD_NAME = 'VAT Address';

    const udfs = Array.isArray(udfDefinitions) ? [...udfDefinitions] : [];
    const existingVatUdfIndex = udfs.findIndex(udf => udf.id === VAT_UDF_FIELD_ID);
    const existingVatAddressUdfIndex = udfs.findIndex(udf => udf.id === VAT_ADDRESS_UDF_FIELD_ID);

    if (isVatService) {
      if (existingVatUdfIndex === -1) {
        udfs.unshift({
          id: VAT_UDF_FIELD_ID,
          name: VAT_UDF_FIELD_NAME,
          type: 'short_text',
          required: true,
          placeholder: 'e.g., GB123456789',
          regex: VAT_NUMBER_REGEX,
          regexError: VAT_NUMBER_REGEX_ERROR,
        });
      }
      if (existingVatAddressUdfIndex === -1) {
        const insertIndex = udfs.findIndex(udf => udf.id === VAT_UDF_FIELD_ID);
        udfs.splice(insertIndex + 1, 0, {
          id: VAT_ADDRESS_UDF_FIELD_ID,
          name: VAT_ADDRESS_UDF_FIELD_NAME,
          type: 'long_text',
          required: false,
          placeholder: 'Auto-populated from HMRC validation',
          readOnly: true,
        });
      }
    }
    return udfs;
  }

  async createService(service: InsertService): Promise<Service> {
    const isVatService = (service as any).isVatService === true;
    const processedService = {
      ...service,
      udfDefinitions: this.ensureVatUdf(service.udfDefinitions as any[], isVatService),
    };
    
    const result = await db.insert(services).values(processedService).returning();
    const [newService] = result as any[];
    return newService;
  }

  async updateService(id: string, service: Partial<InsertService>): Promise<Service> {
    let processedService = { ...service };
    
    if ('isVatService' in service) {
      const isVatService = (service as any).isVatService === true;
      const existingService = await this.getServiceById(id);
      const currentUdfs = existingService?.udfDefinitions || [];
      const newUdfs = service.udfDefinitions ?? currentUdfs;
      
      processedService = {
        ...service,
        udfDefinitions: this.ensureVatUdf(newUdfs as any[], isVatService),
      };
    }
    
    const [updatedService] = await db
      .update(services)
      .set(processedService)
      .where(eq(services.id, id))
      .returning();
    
    if (!updatedService) {
      throw new Error("Service not found");
    }
    
    return updatedService;
  }

  async deleteService(id: string): Promise<void> {
    const result = await db.delete(services).where(eq(services.id, id));
    if (result.rowCount === 0) {
      throw new Error("Service not found");
    }
  }
}
