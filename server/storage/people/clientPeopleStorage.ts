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
 * - Linking and unlinking people to/from clients
 * - Managing officer roles and primary contact flags
 */
export class ClientPeopleStorage extends BaseStorage {
  // ==================== Client-People Relationship Operations ====================
  
  async createClientPerson(relationship: InsertClientPerson): Promise<ClientPerson> {
    const [clientPerson] = await db.insert(clientPeople).values(relationship).returning();
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

  // ==================== Link/Unlink Operations ====================

  async linkPersonToClient(clientId: string, personId: string, officerRole?: string, isPrimaryContact?: boolean): Promise<ClientPerson> {
    // Check if relationship already exists
    const [existingLink] = await db
      .select()
      .from(clientPeople)
      .where(
        and(
          eq(clientPeople.clientId, clientId),
          eq(clientPeople.personId, personId)
        )
      )
      .limit(1);
    
    if (existingLink) {
      // Update existing relationship
      const [updatedLink] = await db
        .update(clientPeople)
        .set({
          officerRole,
          isPrimaryContact: isPrimaryContact ?? false
        })
        .where(eq(clientPeople.id, existingLink.id))
        .returning();
      return updatedLink;
    }
    
    // Create new relationship
    const relationshipId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const linkData = {
      id: relationshipId,
      clientId,
      personId,
      officerRole,
      isPrimaryContact: isPrimaryContact ?? false
    };
    
    const [clientPerson] = await db.insert(clientPeople).values(linkData).returning();
    return clientPerson;
  }

  async unlinkPersonFromClient(clientId: string, personId: string): Promise<void> {
    await db
      .delete(clientPeople)
      .where(
        and(
          eq(clientPeople.clientId, clientId),
          eq(clientPeople.personId, personId)
        )
      );
  }
}
