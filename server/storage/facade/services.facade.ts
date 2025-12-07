import { 
  ServiceStorage, 
  WorkRoleStorage, 
  ServiceAssignmentStorage 
} from '../services/index.js';

export interface ServicesFacadeDeps {
  serviceStorage: ServiceStorage;
  workRoleStorage: WorkRoleStorage;
  serviceAssignmentStorage: ServiceAssignmentStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyServicesFacade<TBase extends Constructor<ServicesFacadeDeps>>(Base: TBase) {
  return class extends Base {
    // ============================================================================
    // ServiceStorage methods (13 methods)
    // ============================================================================
    
    async getAllServices() {
      return this.serviceStorage.getAllServices();
    }

    async getActiveServices() {
      return this.serviceStorage.getActiveServices();
    }

    async getServicesWithActiveClients() {
      return this.serviceStorage.getServicesWithActiveClients();
    }

    async getClientAssignableServices() {
      return this.serviceStorage.getClientAssignableServices();
    }

    async getProjectTypeAssignableServices() {
      return this.serviceStorage.getProjectTypeAssignableServices();
    }

    async getServiceById(id: string) {
      return this.serviceStorage.getServiceById(id);
    }

    async getServiceByName(name: string) {
      return this.serviceStorage.getServiceByName(name);
    }

    async getServiceByProjectTypeId(projectTypeId: string) {
      return this.serviceStorage.getServiceByProjectTypeId(projectTypeId);
    }

    async getScheduledServices() {
      return this.serviceStorage.getScheduledServices();
    }

    async createService(service: any) {
      return this.serviceStorage.createService(service);
    }

    async updateService(id: string, service: any) {
      return this.serviceStorage.updateService(id, service);
    }

    async deleteService(id: string) {
      return this.serviceStorage.deleteService(id);
    }

    async resolveServiceOwner(clientId: string, projectTypeId: string) {
      return this.serviceAssignmentStorage.resolveServiceOwner(clientId, projectTypeId);
    }

    async resolveProjectAssignments(clientId: string, projectTypeId: string) {
      return this.serviceAssignmentStorage.resolveProjectAssignments(clientId, projectTypeId);
    }

    // ============================================================================
    // WorkRoleStorage methods (10 methods)
    // ============================================================================
    
    async getAllWorkRoles() {
      return this.workRoleStorage.getAllWorkRoles();
    }

    async getWorkRoleById(id: string) {
      return this.workRoleStorage.getWorkRoleById(id);
    }

    async getWorkRoleByName(name: string) {
      return this.workRoleStorage.getWorkRoleByName(name);
    }

    async createWorkRole(role: any) {
      return this.workRoleStorage.createWorkRole(role);
    }

    async updateWorkRole(id: string, role: any) {
      return this.workRoleStorage.updateWorkRole(id, role);
    }

    async deleteWorkRole(id: string) {
      return this.workRoleStorage.deleteWorkRole(id);
    }

    async getServiceRolesByServiceId(serviceId: string) {
      return this.workRoleStorage.getServiceRolesByServiceId(serviceId);
    }

    async getWorkRolesByServiceId(serviceId: string) {
      return this.workRoleStorage.getWorkRolesByServiceId(serviceId);
    }

    async addRoleToService(serviceId: string, roleId: string) {
      return this.workRoleStorage.addRoleToService(serviceId, roleId);
    }

    async removeRoleFromService(serviceId: string, roleId: string) {
      return this.workRoleStorage.removeRoleFromService(serviceId, roleId);
    }

    // ============================================================================
    // ServiceAssignmentStorage methods (30 methods)
    // ============================================================================
    
    async getAllClientServices() {
      return this.serviceAssignmentStorage.getAllClientServices();
    }

    async getClientServiceById(id: string) {
      return this.serviceAssignmentStorage.getClientServiceById(id);
    }

    async getClientServicesByClientId(clientId: string) {
      return this.serviceAssignmentStorage.getClientServicesByClientId(clientId);
    }

    async getClientServicesByServiceId(serviceId: string) {
      return this.serviceAssignmentStorage.getClientServicesByServiceId(serviceId);
    }

    async createClientService(service: any) {
      return this.serviceAssignmentStorage.createClientService(service);
    }

    async updateClientService(id: string, service: any) {
      return this.serviceAssignmentStorage.updateClientService(id, service);
    }

    async deleteClientService(id: string) {
      return this.serviceAssignmentStorage.deleteClientService(id);
    }

    async getClientServiceByClientAndProjectType(clientId: string, projectTypeId: string) {
      return this.serviceAssignmentStorage.getClientServiceByClientAndProjectType(clientId, projectTypeId);
    }

    async checkClientServiceMappingExists(clientId: string, serviceId: string) {
      return this.serviceAssignmentStorage.checkClientServiceMappingExists(clientId, serviceId);
    }

    async getAllClientServicesWithDetails() {
      return this.serviceAssignmentStorage.getAllClientServicesWithDetails();
    }

    async getAllClientServiceRoleAssignments() {
      return this.serviceAssignmentStorage.getAllClientServiceRoleAssignments();
    }

    async getClientServiceRoleAssignments(clientServiceId: string) {
      return this.serviceAssignmentStorage.getClientServiceRoleAssignments(clientServiceId);
    }

    async getActiveClientServiceRoleAssignments(clientServiceId: string) {
      return this.serviceAssignmentStorage.getActiveClientServiceRoleAssignments(clientServiceId);
    }

    async getClientServiceRoleAssignmentById(id: string) {
      return this.serviceAssignmentStorage.getClientServiceRoleAssignmentById(id);
    }

    async createClientServiceRoleAssignment(assignment: any) {
      return this.serviceAssignmentStorage.createClientServiceRoleAssignment(assignment);
    }

    async updateClientServiceRoleAssignment(id: string, assignment: any) {
      return this.serviceAssignmentStorage.updateClientServiceRoleAssignment(id, assignment);
    }

    async deactivateClientServiceRoleAssignment(id: string) {
      return this.serviceAssignmentStorage.deactivateClientServiceRoleAssignment(id);
    }

    async deleteClientServiceRoleAssignment(id: string) {
      return this.serviceAssignmentStorage.deleteClientServiceRoleAssignment(id);
    }

    async resolveRoleAssigneeForClientByRoleId(clientId: string, projectTypeId: string, workRoleId: string) {
      return this.serviceAssignmentStorage.resolveRoleAssigneeForClientByRoleId(clientId, projectTypeId, workRoleId);
    }

    async resolveRoleAssigneeForClient(clientId: string, projectTypeId: string, roleName: string) {
      return this.serviceAssignmentStorage.resolveRoleAssigneeForClient(clientId, projectTypeId, roleName);
    }

    async validateClientServiceRoleCompleteness(clientId: string, serviceId: string) {
      return this.serviceAssignmentStorage.validateClientServiceRoleCompleteness(clientId, serviceId);
    }

    async validateAssignedRolesAgainstService(serviceId: string, roleIds: string[]) {
      return this.serviceAssignmentStorage.validateAssignedRolesAgainstService(serviceId, roleIds);
    }

    async getAllPeopleServices() {
      return this.serviceAssignmentStorage.getAllPeopleServices();
    }

    async getPeopleServiceById(id: string) {
      return this.serviceAssignmentStorage.getPeopleServiceById(id);
    }

    async getPeopleServicesByPersonId(personId: string) {
      return this.serviceAssignmentStorage.getPeopleServicesByPersonId(personId);
    }

    async getPeopleServicesByServiceId(serviceId: string) {
      return this.serviceAssignmentStorage.getPeopleServicesByServiceId(serviceId);
    }

    async getPeopleServicesByClientId(clientId: string) {
      return this.serviceAssignmentStorage.getPeopleServicesByClientId(clientId);
    }

    async createPeopleService(service: any) {
      return this.serviceAssignmentStorage.createPeopleService(service);
    }

    async updatePeopleService(id: string, service: any) {
      return this.serviceAssignmentStorage.updatePeopleService(id, service);
    }

    async deletePeopleService(id: string) {
      return this.serviceAssignmentStorage.deletePeopleService(id);
    }

    async checkPeopleServiceMappingExists(personId: string, serviceId: string) {
      return this.serviceAssignmentStorage.checkPeopleServiceMappingExists(personId, serviceId);
    }

    async getAllPeopleServicesWithDetails() {
      return this.serviceAssignmentStorage.getAllPeopleServicesWithDetails();
    }
  };
}
