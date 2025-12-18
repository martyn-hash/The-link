import { db } from '../../db.js';
import {
  clientProjectTaskTemplates,
  clientProjectTaskSections,
  clientProjectTaskQuestions,
  clientProjectTaskOverrides,
  clientProjectTaskOverrideQuestions,
  clientProjectTaskInstances,
  clientProjectTaskResponses,
  clientProjectTaskTokens,
  kanbanStages,
  changeReasons,
  projects,
  clients,
  users,
} from '@shared/schema';
import { eq, and, desc, inArray, sql, isNull, or, asc } from 'drizzle-orm';
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
  UpdateClientProjectTaskResponse,
  ClientProjectTaskToken,
  InsertClientProjectTaskToken,
  ClientProjectTaskTemplateWithRelations,
  ClientProjectTaskOverrideWithRelations,
  ClientProjectTaskInstanceWithRelations,
  ClientProjectTaskTokenWithRelations,
  MergedTaskQuestion,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';
import { nanoid } from 'nanoid';

export class ClientProjectTaskStorage extends BaseStorage {
  async createTemplate(data: InsertClientProjectTaskTemplate): Promise<ClientProjectTaskTemplate> {
    const [template] = await db.insert(clientProjectTaskTemplates).values(data as any).returning();
    return template;
  }

  async getTemplateById(id: string): Promise<ClientProjectTaskTemplateWithRelations | undefined> {
    const [template] = await db
      .select()
      .from(clientProjectTaskTemplates)
      .where(eq(clientProjectTaskTemplates.id, id));

    if (!template) return undefined;

    const questions = await db
      .select()
      .from(clientProjectTaskQuestions)
      .where(eq(clientProjectTaskQuestions.templateId, id))
      .orderBy(clientProjectTaskQuestions.order);

    const sections = await db
      .select()
      .from(clientProjectTaskSections)
      .where(eq(clientProjectTaskSections.templateId, id))
      .orderBy(clientProjectTaskSections.order);

    let onCompletionStage = null;
    let onCompletionStageReason = null;

    if (template.onCompletionStageId) {
      const [stage] = await db.select().from(kanbanStages).where(eq(kanbanStages.id, template.onCompletionStageId));
      onCompletionStage = stage || null;
    }

    if (template.onCompletionStageReasonId) {
      const [reason] = await db.select().from(changeReasons).where(eq(changeReasons.id, template.onCompletionStageReasonId));
      onCompletionStageReason = reason || null;
    }

    return {
      ...template,
      sections,
      questions,
      onCompletionStage,
      onCompletionStageReason,
    };
  }

  async getTemplatesByProjectTypeId(projectTypeId: string): Promise<ClientProjectTaskTemplateWithRelations[]> {
    const templates = await db
      .select()
      .from(clientProjectTaskTemplates)
      .where(eq(clientProjectTaskTemplates.projectTypeId, projectTypeId))
      .orderBy(desc(clientProjectTaskTemplates.createdAt));

    const result: ClientProjectTaskTemplateWithRelations[] = [];
    for (const template of templates) {
      const questions = await db
        .select()
        .from(clientProjectTaskQuestions)
        .where(eq(clientProjectTaskQuestions.templateId, template.id))
        .orderBy(clientProjectTaskQuestions.order);
      
      const sections = await db
        .select()
        .from(clientProjectTaskSections)
        .where(eq(clientProjectTaskSections.templateId, template.id))
        .orderBy(clientProjectTaskSections.order);
      
      result.push({ ...template, sections, questions });
    }

    return result;
  }

  async updateTemplate(id: string, data: UpdateClientProjectTaskTemplate): Promise<ClientProjectTaskTemplate> {
    const [template] = await db
      .update(clientProjectTaskTemplates)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(clientProjectTaskTemplates.id, id))
      .returning();
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(clientProjectTaskTemplates).where(eq(clientProjectTaskTemplates.id, id));
  }

  async createQuestion(data: InsertClientProjectTaskQuestion): Promise<ClientProjectTaskQuestion> {
    const [question] = await db.insert(clientProjectTaskQuestions).values(data as any).returning();
    return question;
  }

  async createQuestions(dataArray: InsertClientProjectTaskQuestion[]): Promise<ClientProjectTaskQuestion[]> {
    if (dataArray.length === 0) return [];
    const questions = await db.insert(clientProjectTaskQuestions).values(dataArray as any).returning();
    return questions;
  }

  async getQuestionsByTemplateId(templateId: string): Promise<ClientProjectTaskQuestion[]> {
    return db
      .select()
      .from(clientProjectTaskQuestions)
      .where(eq(clientProjectTaskQuestions.templateId, templateId))
      .orderBy(clientProjectTaskQuestions.order);
  }

  async updateQuestion(id: string, data: UpdateClientProjectTaskQuestion): Promise<ClientProjectTaskQuestion> {
    const [question] = await db
      .update(clientProjectTaskQuestions)
      .set(data as any)
      .where(eq(clientProjectTaskQuestions.id, id))
      .returning();
    return question;
  }

  async deleteQuestion(id: string): Promise<void> {
    await db.delete(clientProjectTaskQuestions).where(eq(clientProjectTaskQuestions.id, id));
  }

  async deleteQuestionsByTemplateId(templateId: string): Promise<void> {
    await db.delete(clientProjectTaskQuestions).where(eq(clientProjectTaskQuestions.templateId, templateId));
  }

  // ============================================================================
  // SECTION METHODS
  // ============================================================================

  async createSection(data: InsertClientProjectTaskSection): Promise<ClientProjectTaskSection> {
    const [section] = await db.insert(clientProjectTaskSections).values(data as any).returning();
    return section;
  }

  async getSectionById(id: string): Promise<ClientProjectTaskSection | undefined> {
    const [section] = await db
      .select()
      .from(clientProjectTaskSections)
      .where(eq(clientProjectTaskSections.id, id));
    return section;
  }

  async getSectionsByTemplateId(templateId: string): Promise<ClientProjectTaskSection[]> {
    return db
      .select()
      .from(clientProjectTaskSections)
      .where(eq(clientProjectTaskSections.templateId, templateId))
      .orderBy(asc(clientProjectTaskSections.order));
  }

  async updateSection(id: string, data: UpdateClientProjectTaskSection): Promise<ClientProjectTaskSection> {
    const [section] = await db
      .update(clientProjectTaskSections)
      .set(data as any)
      .where(eq(clientProjectTaskSections.id, id))
      .returning();
    return section;
  }

  async deleteSection(id: string): Promise<void> {
    await db.update(clientProjectTaskQuestions)
      .set({ sectionId: null } as any)
      .where(eq(clientProjectTaskQuestions.sectionId, id));
    await db.delete(clientProjectTaskSections).where(eq(clientProjectTaskSections.id, id));
  }

  async deleteSectionsByTemplateId(templateId: string): Promise<void> {
    await db.delete(clientProjectTaskSections).where(eq(clientProjectTaskSections.templateId, templateId));
  }

  async createOverride(data: InsertClientProjectTaskOverride): Promise<ClientProjectTaskOverride> {
    const [override] = await db.insert(clientProjectTaskOverrides).values(data as any).returning();
    return override;
  }

  async getOverrideById(id: string): Promise<ClientProjectTaskOverrideWithRelations | undefined> {
    const [override] = await db
      .select()
      .from(clientProjectTaskOverrides)
      .where(eq(clientProjectTaskOverrides.id, id));

    if (!override) return undefined;

    const questions = await db
      .select()
      .from(clientProjectTaskOverrideQuestions)
      .where(eq(clientProjectTaskOverrideQuestions.overrideId, id))
      .orderBy(clientProjectTaskOverrideQuestions.order);

    const [baseTemplate] = await db
      .select()
      .from(clientProjectTaskTemplates)
      .where(eq(clientProjectTaskTemplates.id, override.baseTemplateId));

    return {
      ...override,
      questions,
      baseTemplate: baseTemplate || undefined,
    };
  }

  async getOverridesByClientId(clientId: string): Promise<ClientProjectTaskOverrideWithRelations[]> {
    const overrides = await db
      .select()
      .from(clientProjectTaskOverrides)
      .where(eq(clientProjectTaskOverrides.clientId, clientId));

    const result: ClientProjectTaskOverrideWithRelations[] = [];
    for (const override of overrides) {
      const questions = await db
        .select()
        .from(clientProjectTaskOverrideQuestions)
        .where(eq(clientProjectTaskOverrideQuestions.overrideId, override.id))
        .orderBy(clientProjectTaskOverrideQuestions.order);

      const [baseTemplate] = await db
        .select()
        .from(clientProjectTaskTemplates)
        .where(eq(clientProjectTaskTemplates.id, override.baseTemplateId));

      result.push({ ...override, questions, baseTemplate: baseTemplate || undefined });
    }

    return result;
  }

  async getOverrideForClientAndTemplate(clientId: string, templateId: string): Promise<ClientProjectTaskOverride | undefined> {
    const [override] = await db
      .select()
      .from(clientProjectTaskOverrides)
      .where(and(
        eq(clientProjectTaskOverrides.clientId, clientId),
        eq(clientProjectTaskOverrides.baseTemplateId, templateId)
      ));
    return override;
  }

  async updateOverride(id: string, data: UpdateClientProjectTaskOverride): Promise<ClientProjectTaskOverride> {
    const [override] = await db
      .update(clientProjectTaskOverrides)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(clientProjectTaskOverrides.id, id))
      .returning();
    return override;
  }

  async deleteOverride(id: string): Promise<void> {
    await db.delete(clientProjectTaskOverrides).where(eq(clientProjectTaskOverrides.id, id));
  }

  async createOverrideQuestion(data: InsertClientProjectTaskOverrideQuestion): Promise<ClientProjectTaskOverrideQuestion> {
    const [question] = await db.insert(clientProjectTaskOverrideQuestions).values(data as any).returning();
    return question;
  }

  async getOverrideQuestionsByOverrideId(overrideId: string): Promise<ClientProjectTaskOverrideQuestion[]> {
    return db
      .select()
      .from(clientProjectTaskOverrideQuestions)
      .where(eq(clientProjectTaskOverrideQuestions.overrideId, overrideId))
      .orderBy(clientProjectTaskOverrideQuestions.order);
  }

  async updateOverrideQuestion(id: string, data: UpdateClientProjectTaskOverrideQuestion): Promise<ClientProjectTaskOverrideQuestion> {
    const [question] = await db
      .update(clientProjectTaskOverrideQuestions)
      .set(data as any)
      .where(eq(clientProjectTaskOverrideQuestions.id, id))
      .returning();
    return question;
  }

  async deleteOverrideQuestion(id: string): Promise<void> {
    await db.delete(clientProjectTaskOverrideQuestions).where(eq(clientProjectTaskOverrideQuestions.id, id));
  }

  async createInstance(data: InsertClientProjectTaskInstance): Promise<ClientProjectTaskInstance> {
    // Enforce "one active task per project" invariant
    if (data.projectId) {
      const activeStatuses = ['pending', 'sent', 'in_progress', 'submitted'];
      const existing = await db
        .select({ id: clientProjectTaskInstances.id })
        .from(clientProjectTaskInstances)
        .where(and(
          eq(clientProjectTaskInstances.projectId, data.projectId),
          inArray(clientProjectTaskInstances.status, activeStatuses as any)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        throw new Error(`Project already has an active task instance. Only one active task per project is allowed.`);
      }
    }
    
    const [instance] = await db.insert(clientProjectTaskInstances).values(data as any).returning();
    return instance;
  }

  async getInstanceById(id: string): Promise<ClientProjectTaskInstanceWithRelations | undefined> {
    const [instance] = await db
      .select()
      .from(clientProjectTaskInstances)
      .where(eq(clientProjectTaskInstances.id, id));

    if (!instance) return undefined;

    const responses = await db
      .select()
      .from(clientProjectTaskResponses)
      .where(eq(clientProjectTaskResponses.instanceId, id));

    const [template] = await db
      .select()
      .from(clientProjectTaskTemplates)
      .where(eq(clientProjectTaskTemplates.id, instance.templateId));

    const [latestToken] = await db
      .select()
      .from(clientProjectTaskTokens)
      .where(eq(clientProjectTaskTokens.instanceId, id))
      .orderBy(desc(clientProjectTaskTokens.createdAt))
      .limit(1);

    return {
      ...instance,
      responses,
      template: template || undefined,
      currentToken: latestToken || null,
    };
  }

  async getInstancesByProjectId(projectId: string): Promise<ClientProjectTaskInstanceWithRelations[]> {
    const instances = await db
      .select()
      .from(clientProjectTaskInstances)
      .where(eq(clientProjectTaskInstances.projectId, projectId))
      .orderBy(desc(clientProjectTaskInstances.createdAt));

    const result: ClientProjectTaskInstanceWithRelations[] = [];
    for (const instance of instances) {
      const responses = await db
        .select()
        .from(clientProjectTaskResponses)
        .where(eq(clientProjectTaskResponses.instanceId, instance.id));

      const [template] = await db
        .select()
        .from(clientProjectTaskTemplates)
        .where(eq(clientProjectTaskTemplates.id, instance.templateId));

      const [latestToken] = await db
        .select()
        .from(clientProjectTaskTokens)
        .where(eq(clientProjectTaskTokens.instanceId, instance.id))
        .orderBy(desc(clientProjectTaskTokens.createdAt))
        .limit(1);

      result.push({
        ...instance,
        responses,
        template: template || undefined,
        currentToken: latestToken || null,
      });
    }

    return result;
  }

  async getInstancesByClientId(clientId: string): Promise<ClientProjectTaskInstance[]> {
    return db
      .select()
      .from(clientProjectTaskInstances)
      .where(eq(clientProjectTaskInstances.clientId, clientId))
      .orderBy(desc(clientProjectTaskInstances.createdAt));
  }

  async getPendingInstanceForClientAndTemplate(clientId: string, templateId: string): Promise<ClientProjectTaskInstance | undefined> {
    const [instance] = await db
      .select()
      .from(clientProjectTaskInstances)
      .where(and(
        eq(clientProjectTaskInstances.clientId, clientId),
        eq(clientProjectTaskInstances.templateId, templateId),
        eq(clientProjectTaskInstances.status, 'submitted'),
        isNull(clientProjectTaskInstances.projectId)
      ))
      .orderBy(desc(clientProjectTaskInstances.submittedAt))
      .limit(1);
    return instance;
  }

  async updateInstance(id: string, data: UpdateClientProjectTaskInstance): Promise<ClientProjectTaskInstance> {
    const [instance] = await db
      .update(clientProjectTaskInstances)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(clientProjectTaskInstances.id, id))
      .returning();
    return instance;
  }

  async deleteInstance(id: string): Promise<void> {
    await db.delete(clientProjectTaskInstances).where(eq(clientProjectTaskInstances.id, id));
  }

  async createResponse(data: InsertClientProjectTaskResponse): Promise<ClientProjectTaskResponse> {
    const [response] = await db.insert(clientProjectTaskResponses).values(data as any).returning();
    return response;
  }

  async upsertResponse(data: InsertClientProjectTaskResponse): Promise<ClientProjectTaskResponse> {
    const existing = await db
      .select()
      .from(clientProjectTaskResponses)
      .where(and(
        eq(clientProjectTaskResponses.instanceId, data.instanceId),
        eq(clientProjectTaskResponses.questionId, data.questionId)
      ));

    if (existing.length > 0) {
      const [response] = await db
        .update(clientProjectTaskResponses)
        .set({ ...data, updatedAt: new Date(), answeredAt: new Date() } as any)
        .where(eq(clientProjectTaskResponses.id, existing[0].id))
        .returning();
      return response;
    }

    const [response] = await db.insert(clientProjectTaskResponses).values({
      ...data,
      answeredAt: new Date(),
    } as any).returning();
    return response;
  }

  async getResponsesByInstanceId(instanceId: string): Promise<ClientProjectTaskResponse[]> {
    return db
      .select()
      .from(clientProjectTaskResponses)
      .where(eq(clientProjectTaskResponses.instanceId, instanceId));
  }

  async deleteResponsesByInstanceId(instanceId: string): Promise<void> {
    await db.delete(clientProjectTaskResponses).where(eq(clientProjectTaskResponses.instanceId, instanceId));
  }

  async createToken(data: InsertClientProjectTaskToken): Promise<ClientProjectTaskToken> {
    const tokenValue = nanoid(32);
    const [token] = await db.insert(clientProjectTaskTokens).values({
      ...data,
      token: tokenValue,
    } as any).returning();
    return token;
  }

  async getTokenByValue(token: string): Promise<ClientProjectTaskTokenWithRelations | undefined> {
    const [tokenRecord] = await db
      .select()
      .from(clientProjectTaskTokens)
      .where(eq(clientProjectTaskTokens.token, token));

    if (!tokenRecord) return undefined;

    const [instance] = await db
      .select()
      .from(clientProjectTaskInstances)
      .where(eq(clientProjectTaskInstances.id, tokenRecord.instanceId));

    const [createdBy] = await db
      .select()
      .from(users)
      .where(eq(users.id, tokenRecord.createdById));

    return {
      ...tokenRecord,
      instance: instance || undefined,
      createdBy: createdBy || undefined,
    };
  }

  async getTokensByInstanceId(instanceId: string): Promise<ClientProjectTaskToken[]> {
    return db
      .select()
      .from(clientProjectTaskTokens)
      .where(eq(clientProjectTaskTokens.instanceId, instanceId))
      .orderBy(desc(clientProjectTaskTokens.createdAt));
  }

  async markTokenAccessed(tokenId: string): Promise<void> {
    await db
      .update(clientProjectTaskTokens)
      .set({ accessedAt: new Date() })
      .where(eq(clientProjectTaskTokens.id, tokenId));
  }

  async getTokenById(id: string): Promise<ClientProjectTaskToken | undefined> {
    const [token] = await db
      .select()
      .from(clientProjectTaskTokens)
      .where(eq(clientProjectTaskTokens.id, id));
    return token;
  }

  async updateToken(id: string, data: { expiresAt?: Date }): Promise<ClientProjectTaskToken> {
    const [token] = await db
      .update(clientProjectTaskTokens)
      .set(data as any)
      .where(eq(clientProjectTaskTokens.id, id))
      .returning();
    return token;
  }

  async getMergedQuestionsForInstance(instanceId: string): Promise<MergedTaskQuestion[]> {
    const [instance] = await db
      .select()
      .from(clientProjectTaskInstances)
      .where(eq(clientProjectTaskInstances.id, instanceId));

    if (!instance) return [];

    const templateQuestions = await db
      .select()
      .from(clientProjectTaskQuestions)
      .where(eq(clientProjectTaskQuestions.templateId, instance.templateId))
      .orderBy(clientProjectTaskQuestions.order);

    const sections = await db
      .select()
      .from(clientProjectTaskSections)
      .where(eq(clientProjectTaskSections.templateId, instance.templateId))
      .orderBy(clientProjectTaskSections.order);

    const sectionMap = new Map(sections.map(s => [s.id, { name: s.name, order: s.order }]));

    let removedQuestionIds: string[] = [];
    let overrideQuestions: ClientProjectTaskOverrideQuestion[] = [];

    if (instance.overrideId) {
      const [override] = await db
        .select()
        .from(clientProjectTaskOverrides)
        .where(eq(clientProjectTaskOverrides.id, instance.overrideId));

      if (override) {
        removedQuestionIds = override.removedQuestionIds || [];

        overrideQuestions = await db
          .select()
          .from(clientProjectTaskOverrideQuestions)
          .where(eq(clientProjectTaskOverrideQuestions.overrideId, instance.overrideId))
          .orderBy(clientProjectTaskOverrideQuestions.order);
      }
    }

    const filteredTemplateQuestions = templateQuestions.filter(q => !removedQuestionIds.includes(q.id));

    const merged: MergedTaskQuestion[] = [
      ...filteredTemplateQuestions.map(q => {
        const sectionInfo = q.sectionId ? sectionMap.get(q.sectionId) : null;
        return {
          id: q.id,
          source: 'template' as const,
          questionType: q.questionType,
          label: q.label,
          helpText: q.helpText,
          isRequired: q.isRequired,
          order: q.order,
          options: q.options,
          placeholder: q.placeholder,
          conditionalLogic: q.conditionalLogic,
          sectionId: q.sectionId,
          sectionName: sectionInfo?.name || null,
          sectionOrder: sectionInfo?.order ?? null,
        };
      }),
      ...overrideQuestions.map(q => ({
        id: q.id,
        source: 'override' as const,
        questionType: q.questionType,
        label: q.label,
        helpText: q.helpText,
        isRequired: q.isRequired,
        order: q.order + 1000,
        options: q.options,
        placeholder: q.placeholder,
        conditionalLogic: q.conditionalLogic,
        sectionId: null,
        sectionName: null,
        sectionOrder: null,
      })),
    ];

    return merged.sort((a, b) => a.order - b.order);
  }

  async getSectionsForInstance(instanceId: string): Promise<{ id: string; name: string; description: string | null; order: number }[]> {
    const [instance] = await db
      .select()
      .from(clientProjectTaskInstances)
      .where(eq(clientProjectTaskInstances.id, instanceId));

    if (!instance) return [];

    return db
      .select({
        id: clientProjectTaskSections.id,
        name: clientProjectTaskSections.name,
        description: clientProjectTaskSections.description,
        order: clientProjectTaskSections.order,
      })
      .from(clientProjectTaskSections)
      .where(eq(clientProjectTaskSections.templateId, instance.templateId))
      .orderBy(clientProjectTaskSections.order);
  }

  async getPendingTaskCountsBatch(projectIds: string[]): Promise<Map<string, { pending: number; awaitingClient: number }>> {
    const result = new Map<string, { pending: number; awaitingClient: number }>();
    
    if (projectIds.length === 0) {
      return result;
    }

    const counts = await db
      .select({
        projectId: clientProjectTaskInstances.projectId,
        status: clientProjectTaskInstances.status,
        count: sql<number>`count(*)::int`,
      })
      .from(clientProjectTaskInstances)
      .where(
        and(
          inArray(clientProjectTaskInstances.projectId, projectIds),
          inArray(clientProjectTaskInstances.status, ['pending', 'sent', 'in_progress'])
        )
      )
      .groupBy(clientProjectTaskInstances.projectId, clientProjectTaskInstances.status);

    for (const row of counts) {
      if (!row.projectId) continue;
      
      const existing = result.get(row.projectId) || { pending: 0, awaitingClient: 0 };
      
      if (row.status === 'pending') {
        existing.pending += row.count;
      } else if (row.status === 'sent' || row.status === 'in_progress') {
        existing.awaitingClient += row.count;
      }
      
      result.set(row.projectId, existing);
    }

    return result;
  }
}
