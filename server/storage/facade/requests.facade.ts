import {
  ChChangeRequestStorage,
  RequestTemplateStorage,
  CustomRequestStorage
} from '../requests/index.js';

export interface RequestsFacadeDeps {
  chChangeRequestStorage: ChChangeRequestStorage;
  requestTemplateStorage: RequestTemplateStorage;
  customRequestStorage: CustomRequestStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyRequestsFacade<TBase extends Constructor<RequestsFacadeDeps>>(Base: TBase) {
  return class extends Base {
    // ============================================================================
    // CH CHANGE REQUESTS - ChChangeRequestStorage (11 methods)
    // ============================================================================

    async getAllChChangeRequests() {
      return this.chChangeRequestStorage.getAllChChangeRequests();
    }

    async getPendingChChangeRequests() {
      return this.chChangeRequestStorage.getPendingChChangeRequests();
    }

    async createChChangeRequest(request: any) {
      return this.chChangeRequestStorage.createChChangeRequest(request);
    }

    async getChChangeRequestById(id: string) {
      return this.chChangeRequestStorage.getChChangeRequestById(id);
    }

    async getChChangeRequestsByClientId(clientId: string) {
      return this.chChangeRequestStorage.getChChangeRequestsByClientId(clientId);
    }

    async updateChChangeRequest(id: string, request: any) {
      return this.chChangeRequestStorage.updateChChangeRequest(id, request);
    }

    async deleteChChangeRequest(id: string) {
      return this.chChangeRequestStorage.deleteChChangeRequest(id);
    }

    async approveChChangeRequest(id: string, approvedBy: string, notes?: string) {
      return this.chChangeRequestStorage.approveChChangeRequest(id, approvedBy, notes);
    }

    async rejectChChangeRequest(id: string, approvedBy: string, notes?: string) {
      return this.chChangeRequestStorage.rejectChChangeRequest(id, approvedBy, notes);
    }

    async detectChDataChanges(clientId: string, newChData: any) {
      return this.chChangeRequestStorage.detectChDataChanges(clientId, newChData);
    }

    async applyChChangeRequests(requestIds: string[]) {
      return this.chChangeRequestStorage.applyChChangeRequests(requestIds);
    }

    // ============================================================================
    // REQUEST TEMPLATE CATEGORIES - RequestTemplateStorage (5 methods)
    // ============================================================================

    async createClientRequestTemplateCategory(category: any) {
      return this.requestTemplateStorage.createClientRequestTemplateCategory(category);
    }

    async getClientRequestTemplateCategoryById(id: string) {
      return this.requestTemplateStorage.getClientRequestTemplateCategoryById(id);
    }

    async getAllClientRequestTemplateCategories() {
      return this.requestTemplateStorage.getAllClientRequestTemplateCategories();
    }

    async updateClientRequestTemplateCategory(id: string, category: any) {
      return this.requestTemplateStorage.updateClientRequestTemplateCategory(id, category);
    }

    async deleteClientRequestTemplateCategory(id: string) {
      return this.requestTemplateStorage.deleteClientRequestTemplateCategory(id);
    }

    // ============================================================================
    // REQUEST TEMPLATES - RequestTemplateStorage (8 methods)
    // ============================================================================

    async createClientRequestTemplate(template: any) {
      return this.requestTemplateStorage.createClientRequestTemplate(template);
    }

    async getClientRequestTemplateById(id: string) {
      return this.requestTemplateStorage.getClientRequestTemplateById(id);
    }

    async getAllClientRequestTemplates(includeInactive?: boolean) {
      return this.requestTemplateStorage.getAllClientRequestTemplates(includeInactive);
    }

    async getClientRequestTemplatesByCategory(categoryId: string) {
      return this.requestTemplateStorage.getClientRequestTemplatesByCategory(categoryId);
    }

    async getClientRequestTemplatesByCategoryId(categoryId: string) {
      return this.requestTemplateStorage.getClientRequestTemplatesByCategory(categoryId);
    }

    async getActiveClientRequestTemplates() {
      return this.requestTemplateStorage.getActiveClientRequestTemplates();
    }

    async updateClientRequestTemplate(id: string, template: any) {
      return this.requestTemplateStorage.updateClientRequestTemplate(id, template);
    }

    async deleteClientRequestTemplate(id: string) {
      return this.requestTemplateStorage.deleteClientRequestTemplate(id);
    }

    // ============================================================================
    // REQUEST TEMPLATE SECTIONS - RequestTemplateStorage (5 methods)
    // ============================================================================

    async createClientRequestTemplateSection(section: any) {
      return this.requestTemplateStorage.createClientRequestTemplateSection(section);
    }

    async getClientRequestTemplateSectionById(id: string) {
      return this.requestTemplateStorage.getClientRequestTemplateSectionById(id);
    }

    async getClientRequestTemplateSectionsByTemplateId(templateId: string) {
      return this.requestTemplateStorage.getClientRequestTemplateSectionsByTemplateId(templateId);
    }

    async updateClientRequestTemplateSection(id: string, section: any) {
      return this.requestTemplateStorage.updateClientRequestTemplateSection(id, section);
    }

    async deleteClientRequestTemplateSection(id: string) {
      return this.requestTemplateStorage.deleteClientRequestTemplateSection(id);
    }

    // ============================================================================
    // REQUEST TEMPLATE QUESTIONS - RequestTemplateStorage (8 methods)
    // ============================================================================

    async createClientRequestTemplateQuestion(question: any) {
      return this.requestTemplateStorage.createClientRequestTemplateQuestion(question);
    }

    async getClientRequestTemplateQuestionById(id: string) {
      return this.requestTemplateStorage.getClientRequestTemplateQuestionById(id);
    }

    async getClientRequestTemplateQuestionsBySectionId(sectionId: string) {
      return this.requestTemplateStorage.getClientRequestTemplateQuestionsBySectionId(sectionId);
    }

    async getAllClientRequestTemplateQuestionsByTemplateId(templateId: string) {
      return this.requestTemplateStorage.getAllClientRequestTemplateQuestionsByTemplateId(templateId);
    }

    async updateClientRequestTemplateQuestion(id: string, question: any) {
      return this.requestTemplateStorage.updateClientRequestTemplateQuestion(id, question);
    }

    async deleteClientRequestTemplateQuestion(id: string) {
      return this.requestTemplateStorage.deleteClientRequestTemplateQuestion(id);
    }

    async updateQuestionOrders(updates: { id: string; order: number }[]) {
      return this.requestTemplateStorage.updateQuestionOrders(updates);
    }

    async updateSectionOrders(updates: { id: string; order: number }[]) {
      return this.requestTemplateStorage.updateSectionOrders(updates);
    }

    // ============================================================================
    // CUSTOM REQUESTS - CustomRequestStorage (6 methods)
    // ============================================================================

    async createClientCustomRequest(request: any) {
      return this.customRequestStorage.createClientCustomRequest(request);
    }

    async getClientCustomRequestById(id: string) {
      return this.customRequestStorage.getClientCustomRequestById(id);
    }

    async getClientCustomRequestsByClientId(clientId: string) {
      return this.customRequestStorage.getClientCustomRequestsByClientId(clientId);
    }

    async getAllClientCustomRequests(filters?: { clientId?: string; status?: string }) {
      return this.customRequestStorage.getAllClientCustomRequests(filters);
    }

    async updateClientCustomRequest(id: string, request: any) {
      return this.customRequestStorage.updateClientCustomRequest(id, request);
    }

    async deleteClientCustomRequest(id: string) {
      return this.customRequestStorage.deleteClientCustomRequest(id);
    }

    // ============================================================================
    // CUSTOM REQUEST SECTIONS - CustomRequestStorage (6 methods)
    // ============================================================================

    async createClientCustomRequestSection(section: any) {
      return this.customRequestStorage.createClientCustomRequestSection(section);
    }

    async getClientCustomRequestSectionById(id: string) {
      return this.customRequestStorage.getClientCustomRequestSectionById(id);
    }

    async getClientCustomRequestSectionsByRequestId(requestId: string) {
      return this.customRequestStorage.getClientCustomRequestSectionsByRequestId(requestId);
    }

    async updateClientCustomRequestSection(id: string, section: any) {
      return this.customRequestStorage.updateClientCustomRequestSection(id, section);
    }

    async deleteClientCustomRequestSection(id: string) {
      return this.customRequestStorage.deleteClientCustomRequestSection(id);
    }

    async updateCustomRequestSectionOrders(updates: { id: string; order: number }[]) {
      return this.customRequestStorage.updateCustomRequestSectionOrders(updates);
    }

    // ============================================================================
    // CUSTOM REQUEST QUESTIONS - CustomRequestStorage (7 methods)
    // ============================================================================

    async createClientCustomRequestQuestion(question: any) {
      return this.customRequestStorage.createClientCustomRequestQuestion(question);
    }

    async getClientCustomRequestQuestionById(id: string) {
      return this.customRequestStorage.getClientCustomRequestQuestionById(id);
    }

    async getClientCustomRequestQuestionsBySectionId(sectionId: string) {
      return this.customRequestStorage.getClientCustomRequestQuestionsBySectionId(sectionId);
    }

    async getAllClientCustomRequestQuestionsByRequestId(requestId: string) {
      return this.customRequestStorage.getAllClientCustomRequestQuestionsByRequestId(requestId);
    }

    async updateClientCustomRequestQuestion(id: string, question: any) {
      return this.customRequestStorage.updateClientCustomRequestQuestion(id, question);
    }

    async deleteClientCustomRequestQuestion(id: string) {
      return this.customRequestStorage.deleteClientCustomRequestQuestion(id);
    }

    async updateCustomRequestQuestionOrders(updates: { id: string; order: number }[]) {
      return this.customRequestStorage.updateCustomRequestQuestionOrders(updates);
    }
  };
}
