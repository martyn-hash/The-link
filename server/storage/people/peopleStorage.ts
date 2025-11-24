import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import {
  people,
  clientPortalUsers,
  clientPeople,
  clients,
  peopleServices,
  services,
} from '@shared/schema';
import { eq, and, ilike } from 'drizzle-orm';
import type {
  Person,
  InsertPerson,
  ClientPortalUser,
  ClientPerson,
  Client,
  PeopleService,
  Service,
} from '@shared/schema';

/**
 * Storage class for people (individuals) CRUD operations.
 * 
 * Handles:
 * - Person creation, retrieval, update, and deletion
 * - Person details with portal status and relationships
 * - Companies House person synchronization
 * - Duplicate detection by name and birth date
 */
export class PeopleStorage extends BaseStorage {
  // ==================== People CRUD Operations ====================
  
  async createPerson(personData: InsertPerson): Promise<Person> {
    // Generate ID if not provided (for database compatibility)
    const personWithId = (personData as any).id 
      ? personData 
      : { 
          ...personData, 
          id: `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
        };
    
    const [person] = await db.insert(people).values(personWithId).returning();
    return person;
  }

  async getPersonById(id: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.id, id));
    return person;
  }

  async getPersonByPersonNumber(personNumber: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.personNumber, personNumber));
    return person;
  }

  async getAllPeople(): Promise<Person[]> {
    return await db.select().from(people);
  }

  async getAllPeopleWithPortalStatus(): Promise<(Person & { portalUser?: ClientPortalUser; relatedCompanies: Client[] })[]> {
    // Get all people
    const allPeople = await db.select().from(people);
    
    // Get all portal users
    const allPortalUsers = await db.select().from(clientPortalUsers);
    
    // Get all client-person relationships with client details
    const allClientPeople = await db
      .select({
        clientPerson: clientPeople,
        client: clients,
      })
      .from(clientPeople)
      .leftJoin(clients, eq(clientPeople.clientId, clients.id));
    
    // Map each person with their portal status and related companies
    return allPeople.map(person => {
      const portalUser = allPortalUsers.find(pu => pu.personId === person.id);
      const relatedCompanies = allClientPeople
        .filter(cp => cp.clientPerson.personId === person.id && cp.client)
        .map(cp => cp.client!);
      
      return {
        ...person,
        portalUser,
        relatedCompanies,
      };
    });
  }

  async getPersonWithDetails(id: string): Promise<(Person & { portalUser?: ClientPortalUser; relatedCompanies: (ClientPerson & { client: Client })[]; personalServices: (PeopleService & { service: Service })[] }) | undefined> {
    // Get the person
    const [person] = await db.select().from(people).where(eq(people.id, id));
    if (!person) return undefined;
    
    // Get portal user status
    const [portalUser] = await db.select().from(clientPortalUsers).where(eq(clientPortalUsers.personId, id));
    
    // Get related companies
    const relatedCompaniesData = await db
      .select({
        clientPerson: clientPeople,
        client: clients,
      })
      .from(clientPeople)
      .leftJoin(clients, eq(clientPeople.clientId, clients.id))
      .where(eq(clientPeople.personId, id));
    
    const relatedCompanies = relatedCompaniesData
      .filter(item => item.client)
      .map(item => ({
        ...item.clientPerson,
        client: item.client!,
      }));
    
    // Get personal services
    const personalServicesData = await db
      .select({
        peopleService: peopleServices,
        service: services,
      })
      .from(peopleServices)
      .leftJoin(services, eq(peopleServices.serviceId, services.id))
      .where(eq(peopleServices.personId, id));
    
    const personalServices = personalServicesData
      .filter(item => item.service)
      .map(item => ({
        ...item.peopleService,
        service: item.service!,
      }));
    
    return {
      ...person,
      portalUser,
      relatedCompanies,
      personalServices,
    };
  }

  async updatePerson(id: string, personData: Partial<InsertPerson>): Promise<Person> {
    const updateData: any = { ...personData };
    if (updateData.nationality === "") {
      updateData.nationality = null;
    }
    
    const [person] = await db
      .update(people)
      .set(updateData)
      .where(eq(people.id, id))
      .returning();
    
    if (!person) {
      throw new Error(`Person with ID '${id}' not found`);
    }
    
    return person;
  }

  async deletePerson(id: string): Promise<void> {
    const result = await db
      .delete(people)
      .where(eq(people.id, id))
      .returning();
    
    if (result.length === 0) {
      throw new Error(`Person with ID '${id}' not found`);
    }
  }

  // ==================== Companies House Operations ====================

  async upsertPersonFromCH(personData: Partial<InsertPerson>): Promise<Person> {
    // Check if person exists by person number (if available)
    if (personData.personNumber) {
      const existingPerson = await this.getPersonByPersonNumber(personData.personNumber);
      
      if (existingPerson) {
        // Update existing person (exclude id from update)
        const updateData = { ...personData };
        delete (updateData as any).id;
        return await this.updatePerson(existingPerson.id, updateData);
      }
    }
    
    // Create new person
    const personId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const personWithId = { ...personData, id: personId } as InsertPerson;
    
    return await this.createPerson(personWithId);
  }

  // ==================== Duplicate Detection ====================

  async findPeopleByNameAndBirthDate(firstName: string, lastName: string, year: number, month: number): Promise<Person[]> {
    // Create the birth date pattern YYYY-MM to match against
    const birthKey = `${year}-${month.toString().padStart(2, '0')}`;
    
    const matchingPeople = await db
      .select()
      .from(people)
      .where(
        and(
          ilike(people.firstName, firstName.trim()),
          ilike(people.lastName, lastName.trim()),
          ilike(people.dateOfBirth, `${birthKey}%`)
        )
      )
      .limit(10); // Limit results to prevent performance issues
    
    return matchingPeople;
  }
}
