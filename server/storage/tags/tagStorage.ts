import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { 
  clientTags, 
  peopleTags, 
  clientTagAssignments, 
  peopleTagAssignments 
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { 
  ClientTag, 
  InsertClientTag, 
  PeopleTag, 
  InsertPeopleTag,
  ClientTagAssignment,
  InsertClientTagAssignment,
  PeopleTagAssignment,
  InsertPeopleTagAssignment
} from '@shared/schema';

/**
 * TagStorage handles all tag-related operations for clients and people
 * Includes tag CRUD and tag assignment operations
 */
export class TagStorage extends BaseStorage {
  // ============================================================================
  // CLIENT TAGS - CRUD Operations
  // ============================================================================

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

  async updateClientTag(id: string, tag: Partial<InsertClientTag>): Promise<ClientTag> {
    const [updated] = await db.update(clientTags).set(tag).where(eq(clientTags.id, id)).returning();
    if (!updated) {
      throw new Error('Client tag not found');
    }
    return updated;
  }

  async getClientTagById(id: string): Promise<ClientTag | undefined> {
    const [tag] = await db.select().from(clientTags).where(eq(clientTags.id, id));
    return tag;
  }

  // ============================================================================
  // PEOPLE TAGS - CRUD Operations
  // ============================================================================

  async getAllPeopleTags(): Promise<PeopleTag[]> {
    return await db.select().from(peopleTags).orderBy(peopleTags.name);
  }

  async createPeopleTag(tag: InsertPeopleTag): Promise<PeopleTag> {
    const [created] = await db.insert(peopleTags).values(tag).returning();
    return created;
  }

  async deletePeopleTag(id: string): Promise<void> {
    await db.delete(peopleTags).where(eq(peopleTags.id, id));
  }

  async updatePeopleTag(id: string, tag: Partial<InsertPeopleTag>): Promise<PeopleTag> {
    const [updated] = await db.update(peopleTags).set(tag).where(eq(peopleTags.id, id)).returning();
    if (!updated) {
      throw new Error('People tag not found');
    }
    return updated;
  }

  async getPeopleTagById(id: string): Promise<PeopleTag | undefined> {
    const [tag] = await db.select().from(peopleTags).where(eq(peopleTags.id, id));
    return tag;
  }

  // ============================================================================
  // CLIENT TAG ASSIGNMENTS
  // ============================================================================

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

  // ============================================================================
  // PEOPLE TAG ASSIGNMENTS
  // ============================================================================

  async getPersonTags(personId: string): Promise<(PeopleTagAssignment & { tag: PeopleTag })[]> {
    return await db
      .select({
        id: peopleTagAssignments.id,
        personId: peopleTagAssignments.personId,
        tagId: peopleTagAssignments.tagId,
        assignedAt: peopleTagAssignments.assignedAt,
        assignedBy: peopleTagAssignments.assignedBy,
        tag: peopleTags,
      })
      .from(peopleTagAssignments)
      .innerJoin(peopleTags, eq(peopleTagAssignments.tagId, peopleTags.id))
      .where(eq(peopleTagAssignments.personId, personId))
      .orderBy(peopleTags.name);
  }

  async assignPersonTag(assignment: InsertPeopleTagAssignment): Promise<PeopleTagAssignment> {
    const [created] = await db.insert(peopleTagAssignments).values(assignment).returning();
    return created;
  }

  async unassignPersonTag(personId: string, tagId: string): Promise<void> {
    await db
      .delete(peopleTagAssignments)
      .where(
        and(
          eq(peopleTagAssignments.personId, personId),
          eq(peopleTagAssignments.tagId, tagId)
        )
      );
  }
}
