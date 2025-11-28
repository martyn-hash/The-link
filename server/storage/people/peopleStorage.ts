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
  // ==================== Contact Normalization ====================
  
  /**
   * Normalizes contact fields by copying fallback values to primary fields.
   * This ensures email/telephone data is always in primary_email/primary_phone
   * regardless of which field the user fills in.
   */
  private normalizeContactFields(data: any): any {
    const normalized = { ...data };
    
    // If primary_email is empty but email has a value, copy to primary_email
    if ((!normalized.primaryEmail || normalized.primaryEmail.trim() === '') && 
        normalized.email && normalized.email.trim() !== '') {
      normalized.primaryEmail = normalized.email.trim();
    }
    
    // If primary_phone is empty but telephone has a value, copy to primary_phone
    if ((!normalized.primaryPhone || normalized.primaryPhone.trim() === '') && 
        normalized.telephone && normalized.telephone.trim() !== '') {
      normalized.primaryPhone = normalized.telephone.trim();
    }
    
    return normalized;
  }

  // ==================== People CRUD Operations ====================
  
  async createPerson(personData: InsertPerson): Promise<Person> {
    // Strip any inbound id field to ensure database generates UUID
    const { id, ...dataWithoutId } = personData as any;
    
    // Normalize contact fields (copy email→primaryEmail, telephone→primaryPhone if primary is empty)
    const normalizedData = this.normalizeContactFields(dataWithoutId);
    
    console.log('[PeopleStorage.createPerson] Stripped id field, delegating to DB UUID generation');
    const [person] = await db.insert(people).values(normalizedData).returning();
    console.log('[PeopleStorage.createPerson] DB generated UUID:', person.id);
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

  async getPersonByEmail(email: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.email, email));
    return person;
  }

  async getPersonByFullName(fullName: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.fullName, fullName));
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
    
    // Fetch current person data to merge with update for proper normalization
    const currentPerson = await this.getPersonById(id);
    if (!currentPerson) {
      throw new Error(`Person with ID '${id}' not found`);
    }
    
    // Merge current contact fields with update data, then normalize
    const mergedContactData = {
      primaryEmail: updateData.primaryEmail ?? currentPerson.primaryEmail,
      email: updateData.email ?? currentPerson.email,
      primaryPhone: updateData.primaryPhone ?? currentPerson.primaryPhone,
      telephone: updateData.telephone ?? currentPerson.telephone,
    };
    
    // Normalize contact fields (copy email→primaryEmail, telephone→primaryPhone if primary is empty)
    const normalizedContact = this.normalizeContactFields(mergedContactData);
    
    // Apply normalized contact fields to update data (sync all contact fields)
    updateData.primaryEmail = normalizedContact.primaryEmail;
    updateData.primaryPhone = normalizedContact.primaryPhone;
    updateData.email = normalizedContact.email;
    updateData.telephone = normalizedContact.telephone;
    
    const [person] = await db
      .update(people)
      .set(updateData)
      .where(eq(people.id, id))
      .returning();
    
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
        // Update existing person (strip id to avoid overwriting)
        const { id, ...updateData } = personData as any;
        return await this.updatePerson(existingPerson.id, updateData);
      }
    }
    
    // Create new person - strip id and let database generate UUID
    const { id, ...dataWithoutId } = personData as any;
    return await this.createPerson(dataWithoutId as InsertPerson);
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
