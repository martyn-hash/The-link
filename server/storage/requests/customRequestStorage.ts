import { db } from "../../db.js";
import {
  clientCustomRequests,
  clientCustomRequestSections,
  clientCustomRequestQuestions,
  clients,
  clientRequestTemplates,
  projects,
  type ClientCustomRequest,
  type InsertClientCustomRequest,
  type UpdateClientCustomRequest,
  type ClientCustomRequestSection,
  type InsertClientCustomRequestSection,
  type UpdateClientCustomRequestSection,
  type ClientCustomRequestQuestion,
  type InsertClientCustomRequestQuestion,
  type UpdateClientCustomRequestQuestion,
  type Client,
  type ClientRequestTemplate,
  type Project
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export class CustomRequestStorage {
  // Custom Request Operations (5 methods)
  async createClientCustomRequest(request: InsertClientCustomRequest): Promise<ClientCustomRequest> {
    const [created] = await db
      .insert(clientCustomRequests)
      .values(request)
      .returning();
    return created;
  }

  async getClientCustomRequestById(id: string): Promise<ClientCustomRequest | undefined> {
    const [request] = await db
      .select()
      .from(clientCustomRequests)
      .where(eq(clientCustomRequests.id, id));
    return request;
  }

  async getClientCustomRequestsByClientId(clientId: string): Promise<ClientCustomRequest[]> {
    return await db
      .select()
      .from(clientCustomRequests)
      .where(eq(clientCustomRequests.clientId, clientId))
      .orderBy(desc(clientCustomRequests.createdAt));
  }

  async getAllClientCustomRequests(filters?: { clientId?: string }): Promise<(ClientCustomRequest & {
    client: Client;
    sections: (ClientCustomRequestSection & { questions: ClientCustomRequestQuestion[] })[];
  })[]> {
    const whereConditions = [];
    if (filters?.clientId) {
      whereConditions.push(eq(clientCustomRequests.clientId, filters.clientId));
    }

    const requests = await db
      .select()
      .from(clientCustomRequests)
      .innerJoin(clients, eq(clientCustomRequests.clientId, clients.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(clientCustomRequests.createdAt));

    const results: (ClientCustomRequest & {
      client: Client;
      sections: (ClientCustomRequestSection & { questions: ClientCustomRequestQuestion[] })[];
    })[] = [];

    for (const row of requests) {
      const sections = await db
        .select()
        .from(clientCustomRequestSections)
        .where(eq(clientCustomRequestSections.requestId, row.client_custom_requests.id))
        .orderBy(clientCustomRequestSections.order);

      const sectionsWithQuestions: (ClientCustomRequestSection & { questions: ClientCustomRequestQuestion[] })[] = [];
      for (const section of sections) {
        const questions = await db
          .select()
          .from(clientCustomRequestQuestions)
          .where(eq(clientCustomRequestQuestions.sectionId, section.id))
          .orderBy(clientCustomRequestQuestions.order);
        sectionsWithQuestions.push({
          ...section,
          questions,
        });
      }

      results.push({
        ...row.client_custom_requests,
        client: row.clients,
        sections: sectionsWithQuestions,
      });
    }

    return results;
  }

  async updateClientCustomRequest(id: string, request: UpdateClientCustomRequest): Promise<ClientCustomRequest> {
    const [updated] = await db
      .update(clientCustomRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(clientCustomRequests.id, id))
      .returning();
    return updated;
  }

  async deleteClientCustomRequest(id: string): Promise<void> {
    await db.delete(clientCustomRequests).where(eq(clientCustomRequests.id, id));
  }

  // Custom Request Section Operations (6 methods)
  async createClientCustomRequestSection(section: InsertClientCustomRequestSection): Promise<ClientCustomRequestSection> {
    const [created] = await db
      .insert(clientCustomRequestSections)
      .values(section)
      .returning();
    return created;
  }

  async getClientCustomRequestSectionById(id: string): Promise<ClientCustomRequestSection | undefined> {
    const [section] = await db
      .select()
      .from(clientCustomRequestSections)
      .where(eq(clientCustomRequestSections.id, id));
    return section;
  }

  async getClientCustomRequestSectionsByRequestId(requestId: string): Promise<ClientCustomRequestSection[]> {
    return await db
      .select()
      .from(clientCustomRequestSections)
      .where(eq(clientCustomRequestSections.requestId, requestId))
      .orderBy(clientCustomRequestSections.order);
  }

  async updateClientCustomRequestSection(id: string, section: UpdateClientCustomRequestSection): Promise<ClientCustomRequestSection> {
    const [updated] = await db
      .update(clientCustomRequestSections)
      .set({ ...section, updatedAt: new Date() })
      .where(eq(clientCustomRequestSections.id, id))
      .returning();
    return updated;
  }

  async deleteClientCustomRequestSection(id: string): Promise<void> {
    await db.delete(clientCustomRequestSections).where(eq(clientCustomRequestSections.id, id));
  }

  async updateCustomRequestSectionOrders(updates: { id: string; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(clientCustomRequestSections)
          .set({ order: update.order, updatedAt: new Date() })
          .where(eq(clientCustomRequestSections.id, update.id));
      }
    });
  }

  // Custom Request Question Operations (7 methods)
  async createClientCustomRequestQuestion(question: InsertClientCustomRequestQuestion): Promise<ClientCustomRequestQuestion> {
    const [created] = await db
      .insert(clientCustomRequestQuestions)
      .values(question)
      .returning();
    return created;
  }

  async getClientCustomRequestQuestionById(id: string): Promise<ClientCustomRequestQuestion | undefined> {
    const [question] = await db
      .select()
      .from(clientCustomRequestQuestions)
      .where(eq(clientCustomRequestQuestions.id, id));
    return question;
  }

  async getClientCustomRequestQuestionsBySectionId(sectionId: string): Promise<ClientCustomRequestQuestion[]> {
    return await db
      .select()
      .from(clientCustomRequestQuestions)
      .where(eq(clientCustomRequestQuestions.sectionId, sectionId))
      .orderBy(clientCustomRequestQuestions.order);
  }

  async getAllClientCustomRequestQuestionsByRequestId(requestId: string): Promise<ClientCustomRequestQuestion[]> {
    return await db
      .select({
        id: clientCustomRequestQuestions.id,
        sectionId: clientCustomRequestQuestions.sectionId,
        questionType: clientCustomRequestQuestions.questionType,
        label: clientCustomRequestQuestions.label,
        helpText: clientCustomRequestQuestions.helpText,
        isRequired: clientCustomRequestQuestions.isRequired,
        order: clientCustomRequestQuestions.order,
        validationRules: clientCustomRequestQuestions.validationRules,
        options: clientCustomRequestQuestions.options,
        conditionalLogic: clientCustomRequestQuestions.conditionalLogic,
        createdAt: clientCustomRequestQuestions.createdAt,
        updatedAt: clientCustomRequestQuestions.updatedAt,
      })
      .from(clientCustomRequestQuestions)
      .innerJoin(
        clientCustomRequestSections,
        eq(clientCustomRequestQuestions.sectionId, clientCustomRequestSections.id)
      )
      .where(eq(clientCustomRequestSections.requestId, requestId))
      .orderBy(clientCustomRequestSections.order, clientCustomRequestQuestions.order);
  }

  async updateClientCustomRequestQuestion(id: string, question: UpdateClientCustomRequestQuestion): Promise<ClientCustomRequestQuestion> {
    const [updated] = await db
      .update(clientCustomRequestQuestions)
      .set({ ...question, updatedAt: new Date() })
      .where(eq(clientCustomRequestQuestions.id, id))
      .returning();
    return updated;
  }

  async deleteClientCustomRequestQuestion(id: string): Promise<void> {
    await db.delete(clientCustomRequestQuestions).where(eq(clientCustomRequestQuestions.id, id));
  }

  async updateCustomRequestQuestionOrders(updates: { id: string; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(clientCustomRequestQuestions)
          .set({ order: update.order, updatedAt: new Date() })
          .where(eq(clientCustomRequestQuestions.id, update.id));
      }
    });
  }
}
