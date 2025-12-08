import { TagStorage } from '../tags/index.js';
import { CommunicationStorage } from '../communications/index.js';
import { ProjectSchedulingStorage } from '../projects/index.js';

export interface TagsCommsFacadeDeps {
  tagStorage: TagStorage;
  communicationStorage: CommunicationStorage;
  projectSchedulingStorage: ProjectSchedulingStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyTagsCommsFacade<TBase extends Constructor<TagsCommsFacadeDeps>>(Base: TBase) {
  return class extends Base {
    // ============================================================================
    // TAGS DOMAIN - TagStorage (22 methods)
    // ============================================================================
    
    async getAllClientTags() {
      return this.tagStorage.getAllClientTags();
    }

    async getClientTagById(id: string) {
      const tags = await this.tagStorage.getAllClientTags();
      return tags.find(t => t.id === id);
    }

    async createClientTag(tag: any) {
      return this.tagStorage.createClientTag(tag);
    }

    async updateClientTag(id: string, tag: any) {
      return this.tagStorage.updateClientTag(id, tag);
    }

    async deleteClientTag(id: string) {
      return this.tagStorage.deleteClientTag(id);
    }

    async getAllPeopleTags() {
      return this.tagStorage.getAllPeopleTags();
    }

    async getPeopleTagById(id: string) {
      const tags = await this.tagStorage.getAllPeopleTags();
      return tags.find(t => t.id === id);
    }

    async createPeopleTag(tag: any) {
      return this.tagStorage.createPeopleTag(tag);
    }

    async updatePeopleTag(id: string, tag: any) {
      return this.tagStorage.updatePeopleTag(id, tag);
    }

    async deletePeopleTag(id: string) {
      return this.tagStorage.deletePeopleTag(id);
    }

    async getAllClientTagAssignments() {
      return this.tagStorage.getAllClientTagAssignments();
    }

    async getClientTags(clientId: string) {
      return this.tagStorage.getClientTags(clientId);
    }

    async getClientTagAssignmentsByClientId(clientId: string) {
      return this.tagStorage.getClientTags(clientId);
    }

    async assignClientTag(assignment: any) {
      return this.tagStorage.assignClientTag(assignment);
    }

    async createClientTagAssignment(assignment: any) {
      return this.tagStorage.assignClientTag(assignment);
    }

    async unassignClientTag(clientId: string, tagId: string) {
      return this.tagStorage.unassignClientTag(clientId, tagId);
    }

    async deleteClientTagAssignment(clientId: string, tagId: string) {
      return this.tagStorage.unassignClientTag(clientId, tagId);
    }

    async getPersonTags(personId: string) {
      return this.tagStorage.getPersonTags(personId);
    }

    async getPeopleTagAssignmentsByPersonId(personId: string) {
      return this.tagStorage.getPersonTags(personId);
    }

    async assignPersonTag(assignment: any) {
      return this.tagStorage.assignPersonTag(assignment);
    }

    async createPeopleTagAssignment(assignment: any) {
      return this.tagStorage.assignPersonTag(assignment);
    }

    async unassignPersonTag(personId: string, tagId: string) {
      return this.tagStorage.unassignPersonTag(personId, tagId);
    }

    async deletePeopleTagAssignment(personId: string, tagId: string) {
      return this.tagStorage.unassignPersonTag(personId, tagId);
    }

    // ============================================================================
    // COMMUNICATIONS DOMAIN - CommunicationStorage (8 methods)
    // ============================================================================
    
    async getAllCommunications() {
      return this.communicationStorage.getAllCommunications();
    }

    async getCommunicationsByClientId(clientId: string) {
      return this.communicationStorage.getCommunicationsByClientId(clientId);
    }

    async getCommunicationsByPersonId(personId: string) {
      return this.communicationStorage.getCommunicationsByPersonId(personId);
    }

    async getCommunicationsByProjectId(projectId: string) {
      return this.communicationStorage.getCommunicationsByProjectId(projectId);
    }

    async getCommunicationById(id: string) {
      return this.communicationStorage.getCommunicationById(id);
    }

    async createCommunication(communication: any) {
      return this.communicationStorage.createCommunication(communication);
    }

    async updateCommunication(id: string, communication: any) {
      return this.communicationStorage.updateCommunication(id, communication);
    }

    async deleteCommunication(id: string) {
      return this.communicationStorage.deleteCommunication(id);
    }

    async getCommunicationsWithPendingTranscription() {
      return this.communicationStorage.getCommunicationsWithPendingTranscription();
    }

    // ============================================================================
    // PROJECT SCHEDULING DOMAIN - ProjectSchedulingStorage (14 methods)
    // ============================================================================
    
    async createProjectSchedulingHistory(data: any) {
      return this.projectSchedulingStorage.createProjectSchedulingHistory(data);
    }

    async getProjectSchedulingHistoryByServiceId(serviceId: string, serviceType: 'client' | 'people') {
      return this.projectSchedulingStorage.getProjectSchedulingHistoryByServiceId(serviceId, serviceType);
    }

    async getProjectSchedulingHistoryByProjectId(projectId: string) {
      return this.projectSchedulingStorage.getProjectSchedulingHistoryByProjectId(projectId);
    }

    async getProjectSchedulingHistory(options?: { serviceId?: string; clientId?: string; personId?: string; limit?: number }) {
      return this.projectSchedulingStorage.getProjectSchedulingHistory(options);
    }

    async createSchedulingRunLog(data: any) {
      return this.projectSchedulingStorage.createSchedulingRunLog(data);
    }

    async getSchedulingRunLogs(limit?: number) {
      return this.projectSchedulingStorage.getSchedulingRunLogs(limit);
    }

    async getLatestSchedulingRuns(limit?: number) {
      return this.projectSchedulingStorage.getSchedulingRunLogs(limit);
    }

    async getLatestSchedulingRunLog() {
      return this.projectSchedulingStorage.getLatestSchedulingRunLog();
    }

    async createSchedulingException(data: any) {
      return this.projectSchedulingStorage.createSchedulingException(data);
    }

    async getSchedulingExceptions(filters?: { runLogId?: string; errorType?: string; resolved?: boolean; serviceType?: string; limit?: number }) {
      return this.projectSchedulingStorage.getSchedulingExceptions(filters);
    }

    async getUnresolvedSchedulingExceptions() {
      return this.projectSchedulingStorage.getUnresolvedSchedulingExceptions();
    }

    async resolveSchedulingException(exceptionId: string, resolvedByUserId: string, notes?: string) {
      return this.projectSchedulingStorage.resolveSchedulingException(exceptionId, resolvedByUserId, notes);
    }

    async resolveAllExceptionsForService(serviceId: string, serviceType: 'client' | 'people', resolvedByUserId: string, notes?: string) {
      return this.projectSchedulingStorage.resolveAllExceptionsForService(serviceId, serviceType, resolvedByUserId, notes);
    }

    async getSchedulingExceptionsByRunLog(runLogId: string) {
      return this.projectSchedulingStorage.getSchedulingExceptionsByRunLog(runLogId);
    }
  };
}
