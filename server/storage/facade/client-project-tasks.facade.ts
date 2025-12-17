import type { ClientProjectTaskStorage } from '../client-project-tasks/index.js';
import type {
  ClientProjectTaskTemplate,
  InsertClientProjectTaskTemplate,
  UpdateClientProjectTaskTemplate,
  ClientProjectTaskSection,
  InsertClientProjectTaskSection,
  UpdateClientProjectTaskSection,
  ClientProjectTaskQuestion,
  InsertClientProjectTaskQuestion,
  UpdateClientProjectTaskQuestion,
  ClientProjectTaskOverride,
  InsertClientProjectTaskOverride,
  UpdateClientProjectTaskOverride,
  ClientProjectTaskOverrideQuestion,
  InsertClientProjectTaskOverrideQuestion,
  UpdateClientProjectTaskOverrideQuestion,
  ClientProjectTaskInstance,
  InsertClientProjectTaskInstance,
  UpdateClientProjectTaskInstance,
  ClientProjectTaskResponse,
  InsertClientProjectTaskResponse,
  ClientProjectTaskToken,
  InsertClientProjectTaskToken,
  ClientProjectTaskTemplateWithRelations,
  ClientProjectTaskOverrideWithRelations,
  ClientProjectTaskInstanceWithRelations,
  ClientProjectTaskTokenWithRelations,
  MergedTaskQuestion,
} from '@shared/schema';

export interface ClientProjectTasksFacadeDeps {
  clientProjectTaskStorage: ClientProjectTaskStorage;
}

export function applyClientProjectTasksFacade<T extends ClientProjectTasksFacadeDeps>(Base: new () => T) {
  return class extends (Base as any) {
    createClientProjectTaskTemplate(data: InsertClientProjectTaskTemplate): Promise<ClientProjectTaskTemplate> {
      return (this as any).clientProjectTaskStorage.createTemplate(data);
    }

    getClientProjectTaskTemplateById(id: string): Promise<ClientProjectTaskTemplateWithRelations | undefined> {
      return (this as any).clientProjectTaskStorage.getTemplateById(id);
    }

    getClientProjectTaskTemplatesByProjectTypeId(projectTypeId: string): Promise<ClientProjectTaskTemplateWithRelations[]> {
      return (this as any).clientProjectTaskStorage.getTemplatesByProjectTypeId(projectTypeId);
    }

    updateClientProjectTaskTemplate(id: string, data: UpdateClientProjectTaskTemplate): Promise<ClientProjectTaskTemplate> {
      return (this as any).clientProjectTaskStorage.updateTemplate(id, data);
    }

    deleteClientProjectTaskTemplate(id: string): Promise<void> {
      return (this as any).clientProjectTaskStorage.deleteTemplate(id);
    }

    createClientProjectTaskQuestion(data: InsertClientProjectTaskQuestion): Promise<ClientProjectTaskQuestion> {
      return (this as any).clientProjectTaskStorage.createQuestion(data);
    }

    createClientProjectTaskQuestions(dataArray: InsertClientProjectTaskQuestion[]): Promise<ClientProjectTaskQuestion[]> {
      return (this as any).clientProjectTaskStorage.createQuestions(dataArray);
    }

    getClientProjectTaskQuestionsByTemplateId(templateId: string): Promise<ClientProjectTaskQuestion[]> {
      return (this as any).clientProjectTaskStorage.getQuestionsByTemplateId(templateId);
    }

    updateClientProjectTaskQuestion(id: string, data: UpdateClientProjectTaskQuestion): Promise<ClientProjectTaskQuestion> {
      return (this as any).clientProjectTaskStorage.updateQuestion(id, data);
    }

    deleteClientProjectTaskQuestion(id: string): Promise<void> {
      return (this as any).clientProjectTaskStorage.deleteQuestion(id);
    }

    deleteClientProjectTaskQuestionsByTemplateId(templateId: string): Promise<void> {
      return (this as any).clientProjectTaskStorage.deleteQuestionsByTemplateId(templateId);
    }

    createClientProjectTaskSection(data: InsertClientProjectTaskSection): Promise<ClientProjectTaskSection> {
      return (this as any).clientProjectTaskStorage.createSection(data);
    }

    getClientProjectTaskSectionById(id: string): Promise<ClientProjectTaskSection | undefined> {
      return (this as any).clientProjectTaskStorage.getSectionById(id);
    }

    getClientProjectTaskSectionsByTemplateId(templateId: string): Promise<ClientProjectTaskSection[]> {
      return (this as any).clientProjectTaskStorage.getSectionsByTemplateId(templateId);
    }

    updateClientProjectTaskSection(id: string, data: UpdateClientProjectTaskSection): Promise<ClientProjectTaskSection> {
      return (this as any).clientProjectTaskStorage.updateSection(id, data);
    }

    deleteClientProjectTaskSection(id: string): Promise<void> {
      return (this as any).clientProjectTaskStorage.deleteSection(id);
    }

    deleteClientProjectTaskSectionsByTemplateId(templateId: string): Promise<void> {
      return (this as any).clientProjectTaskStorage.deleteSectionsByTemplateId(templateId);
    }

    createClientProjectTaskOverride(data: InsertClientProjectTaskOverride): Promise<ClientProjectTaskOverride> {
      return (this as any).clientProjectTaskStorage.createOverride(data);
    }

    getClientProjectTaskOverrideById(id: string): Promise<ClientProjectTaskOverrideWithRelations | undefined> {
      return (this as any).clientProjectTaskStorage.getOverrideById(id);
    }

    getClientProjectTaskOverridesByClientId(clientId: string): Promise<ClientProjectTaskOverrideWithRelations[]> {
      return (this as any).clientProjectTaskStorage.getOverridesByClientId(clientId);
    }

    getClientProjectTaskOverrideForClientAndTemplate(clientId: string, templateId: string): Promise<ClientProjectTaskOverride | undefined> {
      return (this as any).clientProjectTaskStorage.getOverrideForClientAndTemplate(clientId, templateId);
    }

    updateClientProjectTaskOverride(id: string, data: UpdateClientProjectTaskOverride): Promise<ClientProjectTaskOverride> {
      return (this as any).clientProjectTaskStorage.updateOverride(id, data);
    }

    deleteClientProjectTaskOverride(id: string): Promise<void> {
      return (this as any).clientProjectTaskStorage.deleteOverride(id);
    }

    createClientProjectTaskOverrideQuestion(data: InsertClientProjectTaskOverrideQuestion): Promise<ClientProjectTaskOverrideQuestion> {
      return (this as any).clientProjectTaskStorage.createOverrideQuestion(data);
    }

    getClientProjectTaskOverrideQuestionsByOverrideId(overrideId: string): Promise<ClientProjectTaskOverrideQuestion[]> {
      return (this as any).clientProjectTaskStorage.getOverrideQuestionsByOverrideId(overrideId);
    }

    updateClientProjectTaskOverrideQuestion(id: string, data: UpdateClientProjectTaskOverrideQuestion): Promise<ClientProjectTaskOverrideQuestion> {
      return (this as any).clientProjectTaskStorage.updateOverrideQuestion(id, data);
    }

    deleteClientProjectTaskOverrideQuestion(id: string): Promise<void> {
      return (this as any).clientProjectTaskStorage.deleteOverrideQuestion(id);
    }

    createClientProjectTaskInstance(data: InsertClientProjectTaskInstance): Promise<ClientProjectTaskInstance> {
      return (this as any).clientProjectTaskStorage.createInstance(data);
    }

    getClientProjectTaskInstanceById(id: string): Promise<ClientProjectTaskInstanceWithRelations | undefined> {
      return (this as any).clientProjectTaskStorage.getInstanceById(id);
    }

    getClientProjectTaskInstancesByProjectId(projectId: string): Promise<ClientProjectTaskInstanceWithRelations[]> {
      return (this as any).clientProjectTaskStorage.getInstancesByProjectId(projectId);
    }

    getClientProjectTaskInstancesByClientId(clientId: string): Promise<ClientProjectTaskInstance[]> {
      return (this as any).clientProjectTaskStorage.getInstancesByClientId(clientId);
    }

    getPendingClientProjectTaskInstanceForClientAndTemplate(clientId: string, templateId: string): Promise<ClientProjectTaskInstance | undefined> {
      return (this as any).clientProjectTaskStorage.getPendingInstanceForClientAndTemplate(clientId, templateId);
    }

    updateClientProjectTaskInstance(id: string, data: UpdateClientProjectTaskInstance): Promise<ClientProjectTaskInstance> {
      return (this as any).clientProjectTaskStorage.updateInstance(id, data);
    }

    deleteClientProjectTaskInstance(id: string): Promise<void> {
      return (this as any).clientProjectTaskStorage.deleteInstance(id);
    }

    createClientProjectTaskResponse(data: InsertClientProjectTaskResponse): Promise<ClientProjectTaskResponse> {
      return (this as any).clientProjectTaskStorage.createResponse(data);
    }

    upsertClientProjectTaskResponse(data: InsertClientProjectTaskResponse): Promise<ClientProjectTaskResponse> {
      return (this as any).clientProjectTaskStorage.upsertResponse(data);
    }

    getClientProjectTaskResponsesByInstanceId(instanceId: string): Promise<ClientProjectTaskResponse[]> {
      return (this as any).clientProjectTaskStorage.getResponsesByInstanceId(instanceId);
    }

    deleteClientProjectTaskResponsesByInstanceId(instanceId: string): Promise<void> {
      return (this as any).clientProjectTaskStorage.deleteResponsesByInstanceId(instanceId);
    }

    createClientProjectTaskToken(data: InsertClientProjectTaskToken): Promise<ClientProjectTaskToken> {
      return (this as any).clientProjectTaskStorage.createToken(data);
    }

    getClientProjectTaskTokenByValue(token: string): Promise<ClientProjectTaskTokenWithRelations | undefined> {
      return (this as any).clientProjectTaskStorage.getTokenByValue(token);
    }

    getClientProjectTaskTokensByInstanceId(instanceId: string): Promise<ClientProjectTaskToken[]> {
      return (this as any).clientProjectTaskStorage.getTokensByInstanceId(instanceId);
    }

    markClientProjectTaskTokenAccessed(tokenId: string): Promise<void> {
      return (this as any).clientProjectTaskStorage.markTokenAccessed(tokenId);
    }

    getClientProjectTaskTokenById(id: string): Promise<ClientProjectTaskToken | undefined> {
      return (this as any).clientProjectTaskStorage.getTokenById(id);
    }

    updateClientProjectTaskToken(id: string, data: { expiresAt?: Date }): Promise<ClientProjectTaskToken> {
      return (this as any).clientProjectTaskStorage.updateToken(id, data);
    }

    getMergedClientProjectTaskQuestions(instanceId: string): Promise<MergedTaskQuestion[]> {
      return (this as any).clientProjectTaskStorage.getMergedQuestionsForInstance(instanceId);
    }

    getClientProjectTaskSectionsForInstance(instanceId: string): Promise<{ id: string; name: string; description: string | null; order: number }[]> {
      return (this as any).clientProjectTaskStorage.getSectionsForInstance(instanceId);
    }
  } as any;
}
