import { db } from "../../db.js";
import {
  clientRequestTemplateCategories,
  clientRequestTemplates,
  clientRequestTemplateSections,
  clientRequestTemplateQuestions,
  type TaskTemplateCategory,
  type InsertTaskTemplateCategory,
  type UpdateTaskTemplateCategory,
  type TaskTemplate,
  type InsertTaskTemplate,
  type UpdateTaskTemplate,
  type TaskTemplateSection,
  type InsertTaskTemplateSection,
  type UpdateTaskTemplateSection,
  type TaskTemplateQuestion,
  type InsertTaskTemplateQuestion,
  type UpdateTaskTemplateQuestion
} from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

export class RequestTemplateStorage {
  // Template Category Operations (5 methods)
  async createClientRequestTemplateCategory(category: InsertTaskTemplateCategory): Promise<TaskTemplateCategory> {
    const [created] = await db
      .insert(clientRequestTemplateCategories)
      .values(category)
      .returning();
    return created;
  }

  async getClientRequestTemplateCategoryById(id: string): Promise<TaskTemplateCategory | undefined> {
    const [category] = await db
      .select()
      .from(clientRequestTemplateCategories)
      .where(eq(clientRequestTemplateCategories.id, id));
    return category;
  }

  async getAllClientRequestTemplateCategories(): Promise<TaskTemplateCategory[]> {
    return await db
      .select()
      .from(clientRequestTemplateCategories)
      .orderBy(clientRequestTemplateCategories.order);
  }

  async updateClientRequestTemplateCategory(id: string, category: UpdateTaskTemplateCategory): Promise<TaskTemplateCategory> {
    const [updated] = await db
      .update(clientRequestTemplateCategories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(clientRequestTemplateCategories.id, id))
      .returning();
    return updated;
  }

  async deleteClientRequestTemplateCategory(id: string): Promise<void> {
    await db
      .delete(clientRequestTemplateCategories)
      .where(eq(clientRequestTemplateCategories.id, id));
  }

  // Template Operations (7 methods)
  async createClientRequestTemplate(template: InsertTaskTemplate): Promise<TaskTemplate> {
    const [created] = await db
      .insert(clientRequestTemplates)
      .values(template)
      .returning();
    return created;
  }

  async getClientRequestTemplateById(id: string): Promise<TaskTemplate | undefined> {
    const [template] = await db
      .select()
      .from(clientRequestTemplates)
      .where(eq(clientRequestTemplates.id, id));
    return template;
  }

  async getAllClientRequestTemplates(includeInactive: boolean = false): Promise<TaskTemplate[]> {
    if (includeInactive) {
      return await db
        .select()
        .from(clientRequestTemplates)
        .orderBy(clientRequestTemplates.createdAt);
    }
    
    return await db
      .select()
      .from(clientRequestTemplates)
      .where(eq(clientRequestTemplates.status, "active"))
      .orderBy(clientRequestTemplates.createdAt);
  }

  async getClientRequestTemplatesByCategory(categoryId: string): Promise<TaskTemplate[]> {
    return await db
      .select()
      .from(clientRequestTemplates)
      .where(eq(clientRequestTemplates.categoryId, categoryId))
      .orderBy(clientRequestTemplates.createdAt);
  }

  async getActiveClientRequestTemplates(): Promise<TaskTemplate[]> {
    return await db
      .select()
      .from(clientRequestTemplates)
      .where(eq(clientRequestTemplates.status, "active"))
      .orderBy(clientRequestTemplates.createdAt);
  }

  async updateClientRequestTemplate(id: string, template: UpdateTaskTemplate): Promise<TaskTemplate> {
    const [updated] = await db
      .update(clientRequestTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(clientRequestTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteClientRequestTemplate(id: string): Promise<void> {
    await db
      .delete(clientRequestTemplates)
      .where(eq(clientRequestTemplates.id, id));
  }

  // Template Section Operations (5 methods)
  async createClientRequestTemplateSection(section: InsertTaskTemplateSection): Promise<TaskTemplateSection> {
    const [created] = await db
      .insert(clientRequestTemplateSections)
      .values(section)
      .returning();
    return created;
  }

  async getClientRequestTemplateSectionById(id: string): Promise<TaskTemplateSection | undefined> {
    const [section] = await db
      .select()
      .from(clientRequestTemplateSections)
      .where(eq(clientRequestTemplateSections.id, id));
    return section;
  }

  async getClientRequestTemplateSectionsByTemplateId(templateId: string): Promise<TaskTemplateSection[]> {
    return await db
      .select()
      .from(clientRequestTemplateSections)
      .where(eq(clientRequestTemplateSections.templateId, templateId))
      .orderBy(clientRequestTemplateSections.order);
  }

  async updateClientRequestTemplateSection(id: string, section: UpdateTaskTemplateSection): Promise<TaskTemplateSection> {
    const [updated] = await db
      .update(clientRequestTemplateSections)
      .set({ ...section, updatedAt: new Date() })
      .where(eq(clientRequestTemplateSections.id, id))
      .returning();
    return updated;
  }

  async deleteClientRequestTemplateSection(id: string): Promise<void> {
    await db
      .delete(clientRequestTemplateSections)
      .where(eq(clientRequestTemplateSections.id, id));
  }

  // Template Question Operations (7 methods)
  async createClientRequestTemplateQuestion(question: InsertTaskTemplateQuestion): Promise<TaskTemplateQuestion> {
    const [created] = await db
      .insert(clientRequestTemplateQuestions)
      .values(question)
      .returning();
    return created;
  }

  async getClientRequestTemplateQuestionById(id: string): Promise<TaskTemplateQuestion | undefined> {
    const [question] = await db
      .select()
      .from(clientRequestTemplateQuestions)
      .where(eq(clientRequestTemplateQuestions.id, id));
    return question;
  }

  async getClientRequestTemplateQuestionsBySectionId(sectionId: string): Promise<TaskTemplateQuestion[]> {
    return await db
      .select()
      .from(clientRequestTemplateQuestions)
      .where(eq(clientRequestTemplateQuestions.sectionId, sectionId))
      .orderBy(clientRequestTemplateQuestions.order);
  }

  async getAllClientRequestTemplateQuestionsByTemplateId(templateId: string): Promise<TaskTemplateQuestion[]> {
    return await db
      .select({
        id: clientRequestTemplateQuestions.id,
        sectionId: clientRequestTemplateQuestions.sectionId,
        questionType: clientRequestTemplateQuestions.questionType,
        label: clientRequestTemplateQuestions.label,
        helpText: clientRequestTemplateQuestions.helpText,
        isRequired: clientRequestTemplateQuestions.isRequired,
        order: clientRequestTemplateQuestions.order,
        validationRules: clientRequestTemplateQuestions.validationRules,
        options: clientRequestTemplateQuestions.options,
        conditionalLogic: clientRequestTemplateQuestions.conditionalLogic,
        createdAt: clientRequestTemplateQuestions.createdAt,
        updatedAt: clientRequestTemplateQuestions.updatedAt,
      })
      .from(clientRequestTemplateQuestions)
      .innerJoin(clientRequestTemplateSections, eq(clientRequestTemplateQuestions.sectionId, clientRequestTemplateSections.id))
      .where(eq(clientRequestTemplateSections.templateId, templateId))
      .orderBy(clientRequestTemplateSections.order, clientRequestTemplateQuestions.order);
  }

  async updateClientRequestTemplateQuestion(id: string, question: UpdateTaskTemplateQuestion): Promise<TaskTemplateQuestion> {
    const [updated] = await db
      .update(clientRequestTemplateQuestions)
      .set({ ...question, updatedAt: new Date() })
      .where(eq(clientRequestTemplateQuestions.id, id))
      .returning();
    return updated;
  }

  async deleteClientRequestTemplateQuestion(id: string): Promise<void> {
    await db
      .delete(clientRequestTemplateQuestions)
      .where(eq(clientRequestTemplateQuestions.id, id));
  }

  async updateQuestionOrders(updates: { id: string; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(clientRequestTemplateQuestions)
          .set({ order: update.order, updatedAt: new Date() })
          .where(eq(clientRequestTemplateQuestions.id, update.id));
      }
    });
  }

  async updateSectionOrders(updates: { id: string; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(clientRequestTemplateSections)
          .set({ order: update.order, updatedAt: new Date() })
          .where(eq(clientRequestTemplateSections.id, update.id));
      }
    });
  }
}
