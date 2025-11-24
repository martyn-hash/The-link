import { db } from "../../db.js";
import {
  chChangeRequests,
  clients,
  users,
  type ChChangeRequest,
  type InsertChChangeRequest,
  type UpdateChChangeRequest,
  type Client,
  type User
} from "../../../shared/schema.js";
import { eq, desc, sql } from "drizzle-orm";

export class ChChangeRequestStorage {
  async getAllChChangeRequests(): Promise<(ChChangeRequest & { client: Client; approvedByUser?: User })[]> {
    const results = await db
      .select({
        id: chChangeRequests.id,
        clientId: chChangeRequests.clientId,
        changeType: chChangeRequests.changeType,
        fieldName: chChangeRequests.fieldName,
        oldValue: chChangeRequests.oldValue,
        newValue: chChangeRequests.newValue,
        status: chChangeRequests.status,
        detectedAt: chChangeRequests.detectedAt,
        approvedAt: chChangeRequests.approvedAt,
        approvedBy: chChangeRequests.approvedBy,
        notes: chChangeRequests.notes,
        createdAt: chChangeRequests.createdAt,
        client: {
          id: clients.id,
          name: clients.name,
          email: clients.email,
          createdAt: clients.createdAt,
          companyNumber: clients.companyNumber,
        },
        approvedByUser: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        }
      })
      .from(chChangeRequests)
      .innerJoin(clients, eq(chChangeRequests.clientId, clients.id))
      .leftJoin(users, eq(chChangeRequests.approvedBy, users.id))
      .orderBy(desc(chChangeRequests.detectedAt));

    return results.map((result) => ({
      id: result.id,
      clientId: result.clientId,
      changeType: result.changeType,
      fieldName: result.fieldName,
      oldValue: result.oldValue,
      newValue: result.newValue,
      status: result.status,
      detectedAt: result.detectedAt,
      approvedAt: result.approvedAt,
      approvedBy: result.approvedBy,
      notes: result.notes,
      createdAt: result.createdAt,
      client: result.client as Client,
      approvedByUser: result.approvedByUser && result.approvedByUser.id ? result.approvedByUser as User : undefined,
    }));
  }

  async getPendingChChangeRequests(): Promise<(ChChangeRequest & { client: Client })[]> {
    const results = await db
      .select({
        id: chChangeRequests.id,
        clientId: chChangeRequests.clientId,
        changeType: chChangeRequests.changeType,
        fieldName: chChangeRequests.fieldName,
        oldValue: chChangeRequests.oldValue,
        newValue: chChangeRequests.newValue,
        status: chChangeRequests.status,
        detectedAt: chChangeRequests.detectedAt,
        approvedAt: chChangeRequests.approvedAt,
        approvedBy: chChangeRequests.approvedBy,
        notes: chChangeRequests.notes,
        createdAt: chChangeRequests.createdAt,
        client: {
          id: clients.id,
          name: clients.name,
          email: clients.email,
          createdAt: clients.createdAt,
          companyNumber: clients.companyNumber,
        },
      })
      .from(chChangeRequests)
      .innerJoin(clients, eq(chChangeRequests.clientId, clients.id))
      .where(eq(chChangeRequests.status, "pending"))
      .orderBy(desc(chChangeRequests.detectedAt));

    return results.map((result) => ({
      id: result.id,
      clientId: result.clientId,
      changeType: result.changeType,
      fieldName: result.fieldName,
      oldValue: result.oldValue,
      newValue: result.newValue,
      status: result.status,
      detectedAt: result.detectedAt,
      approvedAt: result.approvedAt,
      approvedBy: result.approvedBy,
      notes: result.notes,
      createdAt: result.createdAt,
      client: result.client as Client,
    }));
  }

  async createChChangeRequest(request: InsertChChangeRequest): Promise<ChChangeRequest> {
    const [changeRequest] = await db
      .insert(chChangeRequests)
      .values(request)
      .returning();
    
    return changeRequest;
  }

  async getChChangeRequestById(id: string): Promise<(ChChangeRequest & { client: Client; approvedByUser?: User }) | undefined> {
    const result = await db
      .select()
      .from(chChangeRequests)
      .leftJoin(clients, eq(chChangeRequests.clientId, clients.id))
      .leftJoin(users, eq(chChangeRequests.approvedBy, users.id))
      .where(eq(chChangeRequests.id, id))
      .limit(1);

    if (result.length === 0) {
      return undefined;
    }

    const row = result[0];
    return {
      ...row.ch_change_requests,
      client: row.clients!,
      approvedByUser: row.users || undefined,
    };
  }

  async getChChangeRequestsByClientId(clientId: string): Promise<ChChangeRequest[]> {
    const results = await db
      .select()
      .from(chChangeRequests)
      .where(eq(chChangeRequests.clientId, clientId))
      .orderBy(chChangeRequests.detectedAt);
    
    return results;
  }

  async updateChChangeRequest(id: string, request: Partial<UpdateChChangeRequest>): Promise<ChChangeRequest> {
    const [updated] = await db
      .update(chChangeRequests)
      .set(request)
      .where(eq(chChangeRequests.id, id))
      .returning();
    return updated;
  }

  async deleteChChangeRequest(id: string): Promise<void> {
    await db.delete(chChangeRequests).where(eq(chChangeRequests.id, id));
  }
}
