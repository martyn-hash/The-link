import { db } from "../../db.js";
import {
  taskInstances,
  clientRequestTemplates,
  clientRequestTemplateSections,
  clientRequestTemplateQuestions,
  clientCustomRequests,
  clientCustomRequestSections,
  clientCustomRequestQuestions,
  taskInstanceResponses,
  clients,
  people,
  clientPortalUsers,
  type TaskInstance,
  type InsertTaskInstance,
  type UpdateTaskInstance,
  type ClientRequestTemplate as TaskTemplate,
  type ClientCustomRequest,
  type Person,
  type ClientPortalUser,
  type Client
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export class TaskInstanceStorage {
  async createTaskInstance(instance: InsertTaskInstance): Promise<TaskInstance> {
    const [created] = await db
      .insert(taskInstances)
      .values(instance)
      .returning();
    return created;
  }

  async getTaskInstanceById(id: string): Promise<TaskInstance | undefined> {
    const [instance] = await db
      .select()
      .from(taskInstances)
      .where(eq(taskInstances.id, id));
    return instance;
  }

  async getTaskInstancesByProjectId(projectId: string): Promise<TaskInstance[]> {
    const results = await db
      .select({
        taskInstance: taskInstances,
      })
      .from(taskInstances)
      .leftJoin(clientCustomRequests, eq(taskInstances.customRequestId, clientCustomRequests.id))
      .where(eq((clientCustomRequests as any).projectId, projectId))
      .orderBy(desc(taskInstances.createdAt));
    
    return results.map(row => row.taskInstance);
  }

  async getTaskInstancesByClientId(clientId: string): Promise<(TaskInstance & { template?: TaskTemplate; customRequest?: ClientCustomRequest; person?: Person; portalUser?: ClientPortalUser })[]> {
    const instances = await db
      .select({
        id: taskInstances.id,
        templateId: taskInstances.templateId,
        customRequestId: taskInstances.customRequestId,
        clientId: taskInstances.clientId,
        personId: taskInstances.personId,
        clientPortalUserId: taskInstances.clientPortalUserId,
        status: taskInstances.status,
        assignedBy: taskInstances.assignedBy,
        dueDate: taskInstances.dueDate,
        submittedAt: taskInstances.submittedAt,
        approvedAt: taskInstances.approvedAt,
        approvedBy: taskInstances.approvedBy,
        createdAt: taskInstances.createdAt,
        updatedAt: taskInstances.updatedAt,
        template: clientRequestTemplates,
        customRequest: clientCustomRequests,
        person: people,
        portalUser: clientPortalUsers,
      })
      .from(taskInstances)
      .leftJoin(clientRequestTemplates, eq(taskInstances.templateId, clientRequestTemplates.id))
      .leftJoin(clientCustomRequests, eq(taskInstances.customRequestId, clientCustomRequests.id))
      .leftJoin(people, eq(taskInstances.personId, people.id))
      .leftJoin(clientPortalUsers, eq(taskInstances.clientPortalUserId, clientPortalUsers.id))
      .where(eq(taskInstances.clientId, clientId))
      .orderBy(desc(taskInstances.createdAt));

    return instances.map(row => ({
      id: row.id,
      templateId: row.templateId,
      customRequestId: row.customRequestId,
      clientId: row.clientId,
      personId: row.personId,
      clientPortalUserId: row.clientPortalUserId,
      status: row.status,
      assignedBy: row.assignedBy,
      dueDate: row.dueDate,
      submittedAt: row.submittedAt,
      approvedAt: row.approvedAt,
      approvedBy: row.approvedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      template: row.template || undefined,
      customRequest: row.customRequest || undefined,
      person: row.person || undefined,
      portalUser: row.portalUser || undefined,
    }));
  }

  async getTaskInstancesByClientPortalUserId(clientPortalUserId: string): Promise<(TaskInstance & { template: TaskTemplate; client: Client })[]> {
    const instances = await db
      .select({
        id: taskInstances.id,
        templateId: taskInstances.templateId,
        clientId: taskInstances.clientId,
        personId: taskInstances.personId,
        clientPortalUserId: taskInstances.clientPortalUserId,
        status: taskInstances.status,
        assignedBy: taskInstances.assignedBy,
        dueDate: taskInstances.dueDate,
        submittedAt: taskInstances.submittedAt,
        approvedAt: taskInstances.approvedAt,
        approvedBy: taskInstances.approvedBy,
        createdAt: taskInstances.createdAt,
        updatedAt: taskInstances.updatedAt,
        template: clientRequestTemplates,
        client: clients,
      })
      .from(taskInstances)
      .innerJoin(clientRequestTemplates, eq(taskInstances.templateId, clientRequestTemplates.id))
      .innerJoin(clients, eq(taskInstances.clientId, clients.id))
      .where(eq(taskInstances.clientPortalUserId, clientPortalUserId))
      .orderBy(desc(taskInstances.createdAt));

    return instances.map(row => ({
      id: row.id,
      templateId: row.templateId,
      clientId: row.clientId,
      personId: row.personId,
      clientPortalUserId: row.clientPortalUserId,
      status: row.status,
      assignedBy: row.assignedBy,
      dueDate: row.dueDate,
      submittedAt: row.submittedAt,
      approvedAt: row.approvedAt,
      approvedBy: row.approvedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      template: row.template,
      client: row.client,
    })) as any;
  }

  async getTaskInstancesByPersonId(personId: string): Promise<(TaskInstance & { template?: TaskTemplate; customRequest?: ClientCustomRequest; client: Client })[]> {
    const instances = await db
      .select({
        id: taskInstances.id,
        templateId: taskInstances.templateId,
        customRequestId: taskInstances.customRequestId,
        clientId: taskInstances.clientId,
        personId: taskInstances.personId,
        clientPortalUserId: taskInstances.clientPortalUserId,
        status: taskInstances.status,
        assignedBy: taskInstances.assignedBy,
        dueDate: taskInstances.dueDate,
        submittedAt: taskInstances.submittedAt,
        approvedAt: taskInstances.approvedAt,
        approvedBy: taskInstances.approvedBy,
        createdAt: taskInstances.createdAt,
        updatedAt: taskInstances.updatedAt,
        template: clientRequestTemplates,
        customRequest: clientCustomRequests,
        client: clients,
      })
      .from(taskInstances)
      .leftJoin(clientRequestTemplates, eq(taskInstances.templateId, clientRequestTemplates.id))
      .leftJoin(clientCustomRequests, eq(taskInstances.customRequestId, clientCustomRequests.id))
      .innerJoin(clients, eq(taskInstances.clientId, clients.id))
      .where(eq(taskInstances.personId, personId))
      .orderBy(desc(taskInstances.createdAt));

    return instances.map(row => ({
      id: row.id,
      templateId: row.templateId,
      customRequestId: row.customRequestId,
      clientId: row.clientId,
      personId: row.personId,
      clientPortalUserId: row.clientPortalUserId,
      status: row.status,
      assignedBy: row.assignedBy,
      dueDate: row.dueDate,
      submittedAt: row.submittedAt,
      approvedAt: row.approvedAt,
      approvedBy: row.approvedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      template: row.template || undefined,
      customRequest: row.customRequest || undefined,
      client: row.client,
    }));
  }

  async getTaskInstancesByPersonIdAndClientId(personId: string, clientId: string): Promise<(TaskInstance & { template?: TaskTemplate; customRequest?: ClientCustomRequest; client: Client })[]> {
    const instances = await db
      .select({
        id: taskInstances.id,
        templateId: taskInstances.templateId,
        customRequestId: taskInstances.customRequestId,
        clientId: taskInstances.clientId,
        personId: taskInstances.personId,
        clientPortalUserId: taskInstances.clientPortalUserId,
        status: taskInstances.status,
        assignedBy: taskInstances.assignedBy,
        dueDate: taskInstances.dueDate,
        submittedAt: taskInstances.submittedAt,
        approvedAt: taskInstances.approvedAt,
        approvedBy: taskInstances.approvedBy,
        createdAt: taskInstances.createdAt,
        updatedAt: taskInstances.updatedAt,
        template: clientRequestTemplates,
        customRequest: clientCustomRequests,
        client: clients,
      })
      .from(taskInstances)
      .leftJoin(clientRequestTemplates, eq(taskInstances.templateId, clientRequestTemplates.id))
      .leftJoin(clientCustomRequests, eq(taskInstances.customRequestId, clientCustomRequests.id))
      .innerJoin(clients, eq(taskInstances.clientId, clients.id))
      .where(and(
        eq(taskInstances.personId, personId),
        eq(taskInstances.clientId, clientId)
      ))
      .orderBy(desc(taskInstances.createdAt));

    return instances.map(row => ({
      id: row.id,
      templateId: row.templateId,
      customRequestId: row.customRequestId,
      clientId: row.clientId,
      personId: row.personId,
      clientPortalUserId: row.clientPortalUserId,
      status: row.status,
      assignedBy: row.assignedBy,
      dueDate: row.dueDate,
      submittedAt: row.submittedAt,
      approvedAt: row.approvedAt,
      approvedBy: row.approvedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      template: row.template || undefined,
      customRequest: row.customRequest || undefined,
      client: row.client,
    }));
  }

  async getTaskInstancesByStatus(status: string): Promise<(TaskInstance & { template: TaskTemplate; client: Client; person?: Person })[]> {
    const instances = await db
      .select({
        id: taskInstances.id,
        templateId: taskInstances.templateId,
        clientId: taskInstances.clientId,
        personId: taskInstances.personId,
        clientPortalUserId: taskInstances.clientPortalUserId,
        status: taskInstances.status,
        assignedBy: taskInstances.assignedBy,
        dueDate: taskInstances.dueDate,
        submittedAt: taskInstances.submittedAt,
        approvedAt: taskInstances.approvedAt,
        approvedBy: taskInstances.approvedBy,
        createdAt: taskInstances.createdAt,
        updatedAt: taskInstances.updatedAt,
        template: clientRequestTemplates,
        client: clients,
        person: people,
      })
      .from(taskInstances)
      .innerJoin(clientRequestTemplates, eq(taskInstances.templateId, clientRequestTemplates.id))
      .innerJoin(clients, eq(taskInstances.clientId, clients.id))
      .leftJoin(people, eq(taskInstances.personId, people.id))
      .where(eq(taskInstances.status, status as any))
      .orderBy(desc(taskInstances.createdAt));

    return instances.map(row => ({
      id: row.id,
      templateId: row.templateId,
      clientId: row.clientId,
      personId: row.personId,
      clientPortalUserId: row.clientPortalUserId,
      status: row.status,
      assignedBy: row.assignedBy,
      dueDate: row.dueDate,
      submittedAt: row.submittedAt,
      approvedAt: row.approvedAt,
      approvedBy: row.approvedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      template: row.template,
      client: row.client,
      person: row.person || undefined,
    })) as any;
  }

  async getAllTaskInstances(filters?: { status?: string; clientId?: string }): Promise<(TaskInstance & { template: TaskTemplate; client: Client; person?: Person })[]> {
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(taskInstances.status, filters.status as any));
    }
    
    if (filters?.clientId) {
      conditions.push(eq(taskInstances.clientId, filters.clientId));
    }

    const instances = await db
      .select({
        id: taskInstances.id,
        templateId: taskInstances.templateId,
        customRequestId: taskInstances.customRequestId,
        clientId: taskInstances.clientId,
        personId: taskInstances.personId,
        clientPortalUserId: taskInstances.clientPortalUserId,
        status: taskInstances.status,
        assignedBy: taskInstances.assignedBy,
        dueDate: taskInstances.dueDate,
        submittedAt: taskInstances.submittedAt,
        approvedAt: taskInstances.approvedAt,
        approvedBy: taskInstances.approvedBy,
        createdAt: taskInstances.createdAt,
        updatedAt: taskInstances.updatedAt,
        template: clientRequestTemplates,
        customRequest: clientCustomRequests,
        client: clients,
        person: people,
      })
      .from(taskInstances)
      .leftJoin(clientRequestTemplates, eq(taskInstances.templateId, clientRequestTemplates.id))
      .leftJoin(clientCustomRequests, eq(taskInstances.customRequestId, clientCustomRequests.id))
      .innerJoin(clients, eq(taskInstances.clientId, clients.id))
      .leftJoin(people, eq(taskInstances.personId, people.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(taskInstances.createdAt));

    return instances.map(row => ({
      id: row.id,
      templateId: row.templateId,
      customRequestId: row.customRequestId,
      clientId: row.clientId,
      personId: row.personId,
      clientPortalUserId: row.clientPortalUserId,
      status: row.status,
      assignedBy: row.assignedBy,
      dueDate: row.dueDate,
      submittedAt: row.submittedAt,
      approvedAt: row.approvedAt,
      approvedBy: row.approvedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      template: row.template,
      client: row.client,
      person: row.person || undefined,
    } as any));
  }

  async updateTaskInstance(id: string, instance: UpdateTaskInstance): Promise<TaskInstance> {
    const [updated] = await db
      .update(taskInstances)
      .set({ ...instance, updatedAt: new Date() })
      .where(eq(taskInstances.id, id))
      .returning();
    return updated;
  }

  async deleteTaskInstance(id: string): Promise<void> {
    await db
      .delete(taskInstances)
      .where(eq(taskInstances.id, id));
  }

  async getTaskInstanceWithFullData(id: string): Promise<any> {
    const [instanceData] = await db
      .select({
        id: taskInstances.id,
        templateId: taskInstances.templateId,
        customRequestId: taskInstances.customRequestId,
        clientId: taskInstances.clientId,
        personId: taskInstances.personId,
        clientPortalUserId: taskInstances.clientPortalUserId,
        status: taskInstances.status,
        assignedBy: taskInstances.assignedBy,
        dueDate: taskInstances.dueDate,
        submittedAt: taskInstances.submittedAt,
        approvedAt: taskInstances.approvedAt,
        approvedBy: taskInstances.approvedBy,
        createdAt: taskInstances.createdAt,
        updatedAt: taskInstances.updatedAt,
        template: clientRequestTemplates,
        customRequest: clientCustomRequests,
        client: clients,
        person: people,
      })
      .from(taskInstances)
      .leftJoin(clientRequestTemplates, eq(taskInstances.templateId, clientRequestTemplates.id))
      .leftJoin(clientCustomRequests, eq(taskInstances.customRequestId, clientCustomRequests.id))
      .innerJoin(clients, eq(taskInstances.clientId, clients.id))
      .leftJoin(people, eq(taskInstances.personId, people.id))
      .where(eq(taskInstances.id, id));

    if (!instanceData) {
      return undefined;
    }

    let sections: any[] = [];
    let allQuestions: any[] = [];

    if (instanceData.templateId) {
      sections = await db
        .select()
        .from(clientRequestTemplateSections)
        .where(eq(clientRequestTemplateSections.templateId, instanceData.templateId))
        .orderBy(clientRequestTemplateSections.order);

      allQuestions = await db
        .select({
          question: clientRequestTemplateQuestions,
          section: clientRequestTemplateSections,
        })
        .from(clientRequestTemplateQuestions)
        .innerJoin(clientRequestTemplateSections, eq(clientRequestTemplateQuestions.sectionId, clientRequestTemplateSections.id))
        .where(eq(clientRequestTemplateSections.templateId, instanceData.templateId))
        .orderBy(clientRequestTemplateSections.order, clientRequestTemplateQuestions.order);
    }
    else if (instanceData.customRequestId) {
      sections = await db
        .select()
        .from(clientCustomRequestSections)
        .where(eq(clientCustomRequestSections.requestId, instanceData.customRequestId))
        .orderBy(clientCustomRequestSections.order);

      allQuestions = await db
        .select({
          question: clientCustomRequestQuestions,
          section: clientCustomRequestSections,
        })
        .from(clientCustomRequestQuestions)
        .innerJoin(clientCustomRequestSections, eq(clientCustomRequestQuestions.sectionId, clientCustomRequestSections.id))
        .where(eq(clientCustomRequestSections.requestId, instanceData.customRequestId))
        .orderBy(clientCustomRequestSections.order, clientCustomRequestQuestions.order);
    }

    const responses = await db
      .select()
      .from(taskInstanceResponses)
      .where(eq(taskInstanceResponses.taskInstanceId, id));

    const sectionsWithQuestions = sections.map(section => {
      const questionsForSection = allQuestions
        .filter(q => q.section.id === section.id)
        .map(q => {
          const response = responses.find(r => r.questionId === q.question.id);
          return {
            ...q.question,
            response: response || null,
          };
        });

      return {
        ...section,
        questions: questionsForSection,
      };
    });

    const responsesMap: Record<string, any> = {};
    responses.forEach(r => {
      responsesMap[r.questionId] = r.responseValue;
    });

    return {
      id: instanceData.id,
      templateId: instanceData.templateId,
      customRequestId: instanceData.customRequestId,
      clientId: instanceData.clientId,
      personId: instanceData.personId,
      clientPortalUserId: instanceData.clientPortalUserId,
      status: instanceData.status,
      assignedBy: instanceData.assignedBy,
      dueDate: instanceData.dueDate,
      submittedAt: instanceData.submittedAt,
      approvedAt: instanceData.approvedAt,
      approvedBy: instanceData.approvedBy,
      createdAt: instanceData.createdAt,
      updatedAt: instanceData.updatedAt,
      template: instanceData.template || undefined,
      customRequest: instanceData.customRequest || undefined,
      client: instanceData.client,
      person: instanceData.person || undefined,
      sections: sectionsWithQuestions,
      responses: responsesMap,
    };
  }
}
