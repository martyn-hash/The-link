import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import {
  clients,
  clientPeople,
  people,
  clientChronology,
  clientTags,
  clientTagAssignments,
  clientEmailAliases,
  clientDomainAllowlist,
} from '@shared/schema';
import { eq, and, or, ilike, desc } from 'drizzle-orm';
import type {
  Client,
  ClientPerson,
  Person,
  InsertClient,
  InsertClientPerson,
  InsertClientChronology,
  SelectClientChronology,
  ClientTag,
  InsertClientTag,
  ClientTagAssignment,
  InsertClientTagAssignment,
  ClientEmailAlias,
  InsertClientEmailAlias,
  ClientDomainAllowlist,
  InsertClientDomainAllowlist,
  User,
} from '@shared/schema';

/**
 * Storage class for client CRUD operations, relationships, chronology, tags, 
 * email aliases, and domain allowlisting.
 * 
 * Cross-domain dependencies:
 * - Projects: Deletion checks for existing projects
 * - ClientServices: Cascade deletion of services and role assignments
 */
export class ClientStorage extends BaseStorage {
  // ==================== Client CRUD Operations ====================
  
  async createClient(clientData: InsertClient, tx?: any): Promise<Client> {
    const dbConn = tx || db;
    const [client] = await dbConn.insert(clients).values(clientData).returning();
    return client;
  }

  async getClientById(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByName(name: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.name, name));
    return client;
  }

  async getAllClients(search?: string): Promise<Client[]> {
    if (!search) {
      return await db.select().from(clients);
    }
    
    // Server-side search filtering by name or email
    const searchTerm = `%${search}%`;
    return await db
      .select()
      .from(clients)
      .where(
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.email, searchTerm)
        )
      );
  }

  async updateClient(id: string, clientData: Partial<InsertClient>): Promise<Client> {
    const [client] = await db
      .update(clients)
      .set(clientData)
      .where(eq(clients.id, id))
      .returning();
    
    if (!client) {
      throw new Error(`Client with ID '${id}' not found`);
    }
    
    return client;
  }

  /**
   * Delete a client and its associated data.
   * Requires cross-domain helpers for project and service checks.
   */
  async deleteClient(id: string): Promise<void> {
    // Check if client exists first
    const existingClient = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    
    if (existingClient.length === 0) {
      throw new Error(`Client with ID '${id}' not found`);
    }
    
    // Check if client has any projects (delegated to helper)
    const projectsHelper = this.getHelper('checkClientProjects');
    if (projectsHelper) {
      const hasProjects = await projectsHelper(id);
      if (hasProjects) {
        throw new Error(`Cannot delete client: client has existing projects`);
      }
    }
    
    // Delete client services and role assignments (delegated to helper)
    const servicesHelper = this.getHelper('deleteClientServices');
    if (servicesHelper) {
      await servicesHelper(id);
    }
    
    // Finally delete the client
    const result = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new Error(`Failed to delete client with ID '${id}'`);
    }
  }

  // ==================== Client-Person Relationships ====================

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

  /**
   * Convert an individual to a company client.
   * Uses transaction to ensure atomicity while preserving helper method side effects.
   */
  async convertIndividualToCompanyClient(
    personId: string, 
    companyData: Partial<InsertClient>, 
    oldIndividualClientId?: string
  ): Promise<{ newCompanyClient: Client; clientPerson: ClientPerson }> {
    // Basic input validation (no DB operations)
    if (!companyData.name) {
      throw new Error('Company name is required');
    }

    // For now, we must use direct queries in the transaction since helpers 
    // don't support transaction propagation. This is a known limitation
    // that will be addressed in a future refactoring phase.
    return await db.transaction(async (tx) => {
      // Validate person exists - use helper if it supports tx, otherwise direct query
      const personHelper = this.getHelper('getPersonById');
      let person;
      
      if (personHelper) {
        // Try to use helper, but it doesn't support tx yet
        person = await personHelper(personId);
      } else {
        // Fallback to direct query in transaction
        const [p] = await tx
          .select()
          .from(people)
          .where(eq(people.id, personId))
          .limit(1);
        person = p;
      }
      
      if (!person) {
        throw new Error(`Person with ID '${personId}' not found`);
      }

      // If oldIndividualClientId provided, validate it
      if (oldIndividualClientId) {
        // Use getClientById if available, but it doesn't support tx yet
        const [oldClient] = await tx
          .select()
          .from(clients)
          .where(eq(clients.id, oldIndividualClientId))
          .limit(1);
        
        if (!oldClient) {
          throw new Error(`Individual client with ID '${oldIndividualClientId}' not found`);
        }
        if (oldClient.clientType !== 'individual') {
          throw new Error(`Client '${oldClient.name}' is not an individual client`);
        }
      }

      // Create the new company client using transaction-aware helper
      // This preserves UUID generation and other side effects
      const newCompanyClient = await this.createClient({
        name: companyData.name!,
        ...companyData,
        clientType: 'company'
      } as InsertClient, tx);

      // Link the person to the new company using transaction-aware helper
      // This preserves relationship handling and any side effects
      const clientPerson = await this.linkPersonToClient(
        newCompanyClient.id,
        personId,
        'Director', // Standard default role for company conversion
        true,       // Set as primary contact
        tx          // Pass transaction handle
      );

      return { newCompanyClient, clientPerson };
    });
  }

  async linkPersonToClient(
    clientId: string, 
    personId: string, 
    officerRole?: string, 
    isPrimaryContact?: boolean,
    tx?: any
  ): Promise<ClientPerson> {
    const dbConn = tx || db;
    
    // Check if relationship already exists
    const [existingLink] = await dbConn
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
      const [updatedLink] = await dbConn
        .update(clientPeople)
        .set({
          officerRole,
          isPrimaryContact: isPrimaryContact ?? false,
          updatedAt: new Date()
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
    
    const [clientPerson] = await dbConn.insert(clientPeople).values(linkData).returning();
    return clientPerson;
  }

  async getClientWithPeople(clientId: string): Promise<(Client & { people: (Person & { officerRole?: string })[] }) | undefined> {
    // Get client
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return undefined;
    
    // Get related people with their officer roles
    const clientPeopleData = await db
      .select({
        person: people,
        officerRole: clientPeople.officerRole
      })
      .from(clientPeople)
      .innerJoin(people, eq(clientPeople.personId, people.id))
      .where(eq(clientPeople.clientId, clientId));
    
    const peopleWithRoles = clientPeopleData.map(row => ({
      ...row.person,
      officerRole: row.officerRole ?? undefined
    }));
    
    return {
      ...client,
      people: peopleWithRoles
    };
  }

  // ==================== Client Chronology ====================

  async createClientChronologyEntry(entry: InsertClientChronology): Promise<SelectClientChronology> {
    const [chronology] = await db.insert(clientChronology).values(entry).returning();
    return chronology;
  }

  async getClientChronology(clientId: string): Promise<(SelectClientChronology & { user?: User })[]> {
    const results = await db.query.clientChronology.findMany({
      where: eq(clientChronology.clientId, clientId),
      with: {
        user: true,
      },
      orderBy: desc(clientChronology.timestamp),
    });
    
    // Convert null relations to undefined to match TypeScript expectations
    return results.map(c => ({
      ...c,
      user: c.user || undefined,
    }));
  }

  // ==================== Client Tags ====================

  async getAllClientTags(): Promise<ClientTag[]> {
    return await db.select().from(clientTags).orderBy(clientTags.name);
  }

  async createClientTag(tag: InsertClientTag): Promise<ClientTag> {
    const [created] = await db.insert(clientTags).values(tag).returning();
    return created;
  }

  async deleteClientTag(id: string): Promise<void> {
    await db.delete(clientTags).where(eq(clientTags.id, id));
  }

  async getAllClientTagAssignments(): Promise<ClientTagAssignment[]> {
    return await db.select().from(clientTagAssignments);
  }

  async getClientTags(clientId: string): Promise<(ClientTagAssignment & { tag: ClientTag })[]> {
    return await db
      .select({
        id: clientTagAssignments.id,
        clientId: clientTagAssignments.clientId,
        tagId: clientTagAssignments.tagId,
        assignedAt: clientTagAssignments.assignedAt,
        assignedBy: clientTagAssignments.assignedBy,
        tag: clientTags,
      })
      .from(clientTagAssignments)
      .innerJoin(clientTags, eq(clientTagAssignments.tagId, clientTags.id))
      .where(eq(clientTagAssignments.clientId, clientId))
      .orderBy(clientTags.name);
  }

  async assignClientTag(assignment: InsertClientTagAssignment): Promise<ClientTagAssignment> {
    const [created] = await db.insert(clientTagAssignments).values(assignment).returning();
    return created;
  }

  async unassignClientTag(clientId: string, tagId: string): Promise<void> {
    await db
      .delete(clientTagAssignments)
      .where(
        and(
          eq(clientTagAssignments.clientId, clientId),
          eq(clientTagAssignments.tagId, tagId)
        )
      );
  }

  // ==================== Client Email Aliases ====================

  async getAllClientEmailAliases(): Promise<ClientEmailAlias[]> {
    return await db
      .select()
      .from(clientEmailAliases)
      .orderBy(clientEmailAliases.createdAt);
  }

  async createClientEmailAlias(alias: InsertClientEmailAlias): Promise<ClientEmailAlias> {
    const [created] = await db
      .insert(clientEmailAliases)
      .values(alias)
      .returning();
    return created;
  }

  async getClientEmailAliasesByClientId(clientId: string): Promise<ClientEmailAlias[]> {
    return await db
      .select()
      .from(clientEmailAliases)
      .where(eq(clientEmailAliases.clientId, clientId))
      .orderBy(clientEmailAliases.createdAt);
  }

  async getClientByEmailAlias(email: string): Promise<{ clientId: string } | undefined> {
    const result = await db
      .select({ clientId: clientEmailAliases.clientId })
      .from(clientEmailAliases)
      .where(eq(clientEmailAliases.email, email.toLowerCase()))
      .limit(1);
    return result[0];
  }

  async deleteClientEmailAlias(id: string): Promise<void> {
    await db.delete(clientEmailAliases).where(eq(clientEmailAliases.id, id));
  }

  // ==================== Client Domain Allowlisting ====================

  async createClientDomainAllowlist(domain: InsertClientDomainAllowlist): Promise<ClientDomainAllowlist> {
    const [created] = await db
      .insert(clientDomainAllowlist)
      .values(domain)
      .returning();
    return created;
  }

  async getClientDomainAllowlist(): Promise<ClientDomainAllowlist[]> {
    return await db
      .select()
      .from(clientDomainAllowlist)
      .orderBy(clientDomainAllowlist.domain);
  }

  async getClientByDomain(domain: string): Promise<{ clientId: string } | undefined> {
    const result = await db
      .select({ clientId: clientDomainAllowlist.clientId })
      .from(clientDomainAllowlist)
      .where(eq(clientDomainAllowlist.domain, domain.toLowerCase()))
      .limit(1);
    return result[0];
  }

  async deleteClientDomainAllowlist(id: string): Promise<void> {
    await db.delete(clientDomainAllowlist).where(eq(clientDomainAllowlist.id, id));
  }
}