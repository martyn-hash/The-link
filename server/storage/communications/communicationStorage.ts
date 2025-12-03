import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { communications, clients, people, users, projects } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import type { Communication, InsertCommunication, Client, Person, User, Project } from '@shared/schema';

/**
 * CommunicationStorage handles all communication tracking operations
 * Tracks client/person/project communications logged by staff
 */
export class CommunicationStorage extends BaseStorage {
  // ============================================================================
  // COMMUNICATIONS - Query Operations
  // ============================================================================

  async getAllCommunications(): Promise<(Communication & { client: Client; person?: Person; user: User })[]> {
    const results = await db
      .select({
        communication: communications,
        client: clients,
        person: people,
        user: users,
      })
      .from(communications)
      .innerJoin(clients, eq(communications.clientId, clients.id))
      .leftJoin(people, eq(communications.personId, people.id))
      .innerJoin(users, eq(communications.userId, users.id))
      .orderBy(desc(communications.loggedAt));

    return results.map(result => ({
      ...result.communication,
      client: result.client,
      person: result.person || undefined,
      user: result.user,
    }));
  }

  async getCommunicationsByClientId(clientId: string): Promise<(Communication & { person?: Person; user: User; project?: Pick<Project, 'id' | 'description'> })[]> {
    const results = await db
      .select({
        communication: communications,
        person: people,
        user: users,
        project: {
          id: projects.id,
          description: projects.description,
        },
      })
      .from(communications)
      .leftJoin(people, eq(communications.personId, people.id))
      .innerJoin(users, eq(communications.userId, users.id))
      .leftJoin(projects, eq(communications.projectId, projects.id))
      .where(eq(communications.clientId, clientId))
      .orderBy(desc(communications.loggedAt));

    return results.map(result => ({
      ...result.communication,
      person: result.person || undefined,
      user: result.user,
      project: result.project?.id ? result.project : undefined,
    }));
  }

  async getCommunicationsByPersonId(personId: string): Promise<(Communication & { client: Client; user: User })[]> {
    const results = await db
      .select({
        communication: communications,
        client: clients,
        user: users,
      })
      .from(communications)
      .innerJoin(clients, eq(communications.clientId, clients.id))
      .innerJoin(users, eq(communications.userId, users.id))
      .where(eq(communications.personId, personId))
      .orderBy(desc(communications.loggedAt));

    return results.map(result => ({
      ...result.communication,
      client: result.client,
      user: result.user,
    }));
  }

  async getCommunicationsByProjectId(projectId: string): Promise<(Communication & { person?: Person; user: User })[]> {
    const results = await db
      .select({
        communication: communications,
        person: people,
        user: users,
      })
      .from(communications)
      .leftJoin(people, eq(communications.personId, people.id))
      .innerJoin(users, eq(communications.userId, users.id))
      .where(eq(communications.projectId, projectId))
      .orderBy(desc(communications.loggedAt));

    return results.map(result => ({
      ...result.communication,
      person: result.person || undefined,
      user: result.user,
    }));
  }

  async getCommunicationById(id: string): Promise<(Communication & { client: Client; person?: Person; user: User }) | undefined> {
    const [result] = await db
      .select({
        communication: communications,
        client: clients,
        person: people,
        user: users,
      })
      .from(communications)
      .innerJoin(clients, eq(communications.clientId, clients.id))
      .leftJoin(people, eq(communications.personId, people.id))
      .innerJoin(users, eq(communications.userId, users.id))
      .where(eq(communications.id, id))
      .limit(1);

    if (!result) return undefined;

    return {
      ...result.communication,
      client: result.client,
      person: result.person || undefined,
      user: result.user,
    };
  }

  // ============================================================================
  // COMMUNICATIONS - CRUD Operations
  // ============================================================================

  async createCommunication(communication: InsertCommunication): Promise<Communication> {
    const [newCommunication] = await db
      .insert(communications)
      .values({
        ...communication,
        loggedAt: new Date(),
      })
      .returning();
    return newCommunication;
  }

  async updateCommunication(id: string, communication: Partial<InsertCommunication>): Promise<Communication> {
    const [updated] = await db
      .update(communications)
      .set({
        ...communication,
        updatedAt: new Date(),
      })
      .where(eq(communications.id, id))
      .returning();
    return updated;
  }

  async deleteCommunication(id: string): Promise<void> {
    await db.delete(communications).where(eq(communications.id, id));
  }
}
