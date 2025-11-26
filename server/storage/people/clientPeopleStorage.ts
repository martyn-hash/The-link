import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import {
  clientPeople,
  people,
  clients,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type {
  ClientPerson,
  InsertClientPerson,
  Person,
  Client,
} from '@shared/schema';

/**
 * Storage class for client-people relationship operations.
 * 
 * Handles:
 * - Creating, reading, updating, and deleting client-person relationships
 * 
 * Note: linkPersonToClient, unlinkPersonFromClient, convertIndividualToCompanyClient,
 * and getClientWithPeople were already extracted to ClientStorage in Stage 2.
 */
export class ClientPeopleStorage extends BaseStorage {
  // ==================== Client-People Relationship CRUD ====================
  
  async createClientPerson(relationship: InsertClientPerson): Promise<ClientPerson> {
    const [clientPerson] = await db.insert(clientPeople).values(relationship).returning();
    return clientPerson;
  }

  async getClientPerson(clientId: string, personId: string): Promise<ClientPerson | undefined> {
    const [clientPerson] = await db
      .select()
      .from(clientPeople)
      .where(and(eq(clientPeople.clientId, clientId), eq(clientPeople.personId, personId)));
    return clientPerson;
  }

  async getClientPeopleByClientId(clientId: string): Promise<(ClientPerson & { person: Person })[]> {
    const result = await db
      .select({
        clientPerson: clientPeople,
        person: people
      })
      .from(clientPeople)
      .innerJoin(people, eq(clientPeople.personId, people.id))
      .where(eq(clientPeople.clientId, clientId));
    
    return result.map(row => ({
      ...row.clientPerson,
      person: row.person
    }));
  }

  async getClientPeopleByPersonId(personId: string): Promise<(ClientPerson & { client: Client })[]> {
    const result = await db
      .select({
        clientPerson: clientPeople,
        client: clients
      })
      .from(clientPeople)
      .innerJoin(clients, eq(clientPeople.clientId, clients.id))
      .where(eq(clientPeople.personId, personId));
    
    return result.map(row => ({
      ...row.clientPerson,
      client: row.client
    }));
  }

  async updateClientPerson(id: string, relationship: Partial<InsertClientPerson>): Promise<ClientPerson> {
    const [clientPerson] = await db
      .update(clientPeople)
      .set(relationship)
      .where(eq(clientPeople.id, id))
      .returning();
    
    if (!clientPerson) {
      throw new Error(`Client-person relationship with ID '${id}' not found`);
    }
    
    return clientPerson;
  }

  async deleteClientPerson(id: string): Promise<void> {
    const result = await db
      .delete(clientPeople)
      .where(eq(clientPeople.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new Error(`Client-person relationship with ID '${id}' not found`);
    }
  }
}
