import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { clients, people, clientPeople, projects, communications } from '@shared/schema';
import { eq, or, and, ilike, inArray, desc, sql } from 'drizzle-orm';
import type { SearchResult, SuperSearchResults } from '../base/types.js';

/**
 * Storage class for cross-domain search operations.
 * Provides super search functionality across multiple entities.
 */
export class SearchStorage extends BaseStorage {
  /**
   * Perform a super search across clients, people, projects, and communications.
   * Returns matched results from multiple domains with relevance scoring.
   */
  async superSearch(query: string, limit: number = 5): Promise<SuperSearchResults> {
    const searchTerm = `%${query}%`;
    
    // Search clients by name, email, company number, companies house name
    const clientResults = await db
      .select()
      .from(clients)
      .where(
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.email, searchTerm),
          ilike(clients.companyNumber, searchTerm),
          ilike(clients.companiesHouseName, searchTerm)
        )
      )
      .limit(limit);

    // Search people by name, email, phone - include their first related client
    const peopleResults = await db
      .select({
        id: people.id,
        fullName: people.fullName,
        firstName: people.firstName,
        lastName: people.lastName,
        email: people.email,
        primaryEmail: people.primaryEmail,
        primaryPhone: people.primaryPhone,
        occupation: people.occupation,
        clientId: clientPeople.clientId,
        clientName: clients.name,
        isPrimaryContact: clientPeople.isPrimaryContact,
      })
      .from(people)
      .leftJoin(clientPeople, eq(people.id, clientPeople.personId))
      .leftJoin(clients, eq(clientPeople.clientId, clients.id))
      .where(
        or(
          ilike(people.fullName, searchTerm),
          ilike(people.firstName, searchTerm),
          ilike(people.lastName, searchTerm),
          ilike(people.email, searchTerm),
          ilike(people.primaryEmail, searchTerm)
        )
      )
      .limit(limit);

    // Get related people for found clients (to show associated contacts)
    let relatedPeople: any[] = [];
    if (clientResults.length > 0) {
      const clientIds = clientResults.map(c => c.id);
      relatedPeople = await db
        .select({
          id: people.id,
          fullName: people.fullName,
          firstName: people.firstName,
          lastName: people.lastName,
          email: people.email,
          primaryEmail: people.primaryEmail,
          primaryPhone: people.primaryPhone,
          occupation: people.occupation,
          clientId: clientPeople.clientId,
          clientName: clients.name,
          isPrimaryContact: clientPeople.isPrimaryContact,
        })
        .from(people)
        .innerJoin(clientPeople, eq(people.id, clientPeople.personId))
        .innerJoin(clients, eq(clientPeople.clientId, clients.id))
        .where(inArray(clientPeople.clientId, clientIds))
        .limit(limit * 2); // Allow more related people
    }

    // Search projects by description, including client name via join
    // Only include active, non-archived projects
    const projectResults = await db
      .select({
        id: projects.id,
        description: projects.description,
        currentStatus: projects.currentStatus,
        clientName: clients.name,
        projectTypeId: projects.projectTypeId
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(
        and(
          or(
            ilike(projects.description, searchTerm),
            ilike(clients.name, searchTerm)
          ),
          eq(projects.archived, false),
          eq(projects.inactive, false)
        )
      )
      .limit(limit);

    // Search communications by subject and content
    const communicationResults = await db
      .select({
        id: communications.id,
        subject: communications.subject,
        content: communications.content,
        type: communications.type,
        actualContactTime: communications.actualContactTime,
        clientName: clients.name,
        personName: people.fullName
      })
      .from(communications)
      .leftJoin(clients, eq(communications.clientId, clients.id))
      .leftJoin(people, eq(communications.personId, people.id))
      .where(
        or(
          ilike(communications.subject, searchTerm),
          ilike(communications.content, searchTerm)
        )
      )
      .limit(limit);

    // Transform results into SearchResult format
    const clientSearchResults: SearchResult[] = clientResults.map(client => ({
      id: client.id,
      type: 'client' as const,
      title: client.name,
      subtitle: client.companiesHouseName || client.email || undefined,
      description: client.companyNumber ? `Company #${client.companyNumber}` : undefined,
      metadata: {
        clientType: client.clientType,
        companyNumber: client.companyNumber,
      }
    }));

    // Transform people results with related client info
    const allPeopleResults = [...peopleResults, ...relatedPeople];
    const uniquePeopleMap = new Map();
    
    allPeopleResults.forEach(person => {
      if (!uniquePeopleMap.has(person.id)) {
        uniquePeopleMap.set(person.id, {
          id: person.id,
          type: 'person' as const,
          title: person.fullName || `${person.firstName} ${person.lastName}`.trim(),
          subtitle: person.primaryEmail || person.email || undefined,
          description: person.occupation,
          metadata: {
            phone: person.primaryPhone,
            primaryPhone: person.primaryPhone,
            primaryEmail: person.primaryEmail || (person as any).email,
            clientId: (person as any).clientId,
            clientName: (person as any).clientName,
            isPrimaryContact: (person as any).isPrimaryContact,
          }
        });
      }
    });

    const peopleSearchResults: SearchResult[] = Array.from(uniquePeopleMap.values()).slice(0, limit);

    const projectSearchResults: SearchResult[] = projectResults.map(project => ({
      id: project.id,
      type: 'project' as const,
      title: project.description || 'Untitled Project',
      subtitle: project.clientName || undefined,
      description: `Status: ${project.currentStatus}`,
      metadata: {
        projectTypeId: project.projectTypeId,
        currentStatus: project.currentStatus,
      }
    }));

    const communicationSearchResults: SearchResult[] = communicationResults.map(comm => ({
      id: comm.id,
      type: 'communication' as const,
      title: comm.subject || 'No Subject',
      subtitle: comm.clientName || comm.personName || undefined,
      description: comm.type ? `Type: ${comm.type}` : undefined,
      metadata: {
        type: comm.type,
        actualContactTime: comm.actualContactTime,
        contentPreview: comm.content?.substring(0, 100),
      }
    }));

    return {
      clients: clientSearchResults,
      people: peopleSearchResults,
      projects: projectSearchResults,
      communications: communicationSearchResults,
      total: clientSearchResults.length + 
             peopleSearchResults.length + 
             projectSearchResults.length + 
             communicationSearchResults.length
    };
  }
}