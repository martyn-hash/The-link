import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { clientNotes, users, projects, projectTypes } from '@shared/schema';
import { eq, and, desc, or, isNull } from 'drizzle-orm';
import type {
  ClientNote,
  InsertClientNote,
  UpdateClientNote,
  User,
} from '@shared/schema';

export interface ClientNoteWithRelations extends ClientNote {
  createdByUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  project?: {
    id: string;
    description: string | null;
    projectTypeId: string;
    projectTypeName: string | null;
  } | null;
}

export class ClientNotesStorage extends BaseStorage {
  async createClientNote(noteData: InsertClientNote): Promise<ClientNote> {
    const [note] = await db.insert(clientNotes).values(noteData).returning();
    return note;
  }

  async getClientNoteById(id: string): Promise<ClientNoteWithRelations | undefined> {
    const result = await db
      .select({
        note: clientNotes,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        project: {
          id: projects.id,
          description: projects.description,
          projectTypeId: projects.projectTypeId,
        },
        projectTypeName: projectTypes.name,
      })
      .from(clientNotes)
      .leftJoin(users, eq(clientNotes.createdByUserId, users.id))
      .leftJoin(projects, eq(clientNotes.projectId, projects.id))
      .leftJoin(projectTypes, eq(projects.projectTypeId, projectTypes.id))
      .where(eq(clientNotes.id, id))
      .limit(1);

    if (result.length === 0) return undefined;

    const row = result[0];
    return {
      ...row.note,
      createdByUser: row.user,
      project: row.project ? {
        ...row.project,
        projectTypeName: row.projectTypeName,
      } : null,
    };
  }

  async getClientNotesByClientId(
    clientId: string,
    filter?: 'all' | 'client-only' | string,
    filterType?: 'project' | 'projectType'
  ): Promise<ClientNoteWithRelations[]> {
    let whereCondition;

    if (filter === 'client-only') {
      whereCondition = and(
        eq(clientNotes.clientId, clientId),
        isNull(clientNotes.projectId)
      );
    } else if (filter && filter !== 'all') {
      if (filterType === 'projectType') {
        // Filter by project type ID - need inner join to filter
        whereCondition = and(
          eq(clientNotes.clientId, clientId),
          eq(projects.projectTypeId, filter)
        );
      } else {
        // Filter by specific project ID (legacy behavior)
        whereCondition = and(
          eq(clientNotes.clientId, clientId),
          eq(clientNotes.projectId, filter)
        );
      }
    } else {
      whereCondition = eq(clientNotes.clientId, clientId);
    }

    const result = await db
      .select({
        note: clientNotes,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        project: {
          id: projects.id,
          description: projects.description,
          projectTypeId: projects.projectTypeId,
        },
        projectTypeName: projectTypes.name,
      })
      .from(clientNotes)
      .leftJoin(users, eq(clientNotes.createdByUserId, users.id))
      .leftJoin(projects, eq(clientNotes.projectId, projects.id))
      .leftJoin(projectTypes, eq(projects.projectTypeId, projectTypes.id))
      .where(whereCondition)
      .orderBy(desc(clientNotes.createdAt));

    return result.map((row) => ({
      ...row.note,
      createdByUser: row.user,
      project: row.project ? {
        ...row.project,
        projectTypeName: row.projectTypeName,
      } : null,
    }));
  }

  async getClientNotesByProjectId(projectId: string): Promise<ClientNoteWithRelations[]> {
    const result = await db
      .select({
        note: clientNotes,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
        project: {
          id: projects.id,
          description: projects.description,
          projectTypeId: projects.projectTypeId,
        },
        projectTypeName: projectTypes.name,
      })
      .from(clientNotes)
      .leftJoin(users, eq(clientNotes.createdByUserId, users.id))
      .leftJoin(projects, eq(clientNotes.projectId, projects.id))
      .leftJoin(projectTypes, eq(projects.projectTypeId, projectTypes.id))
      .where(eq(clientNotes.projectId, projectId))
      .orderBy(desc(clientNotes.createdAt));

    return result.map((row) => ({
      ...row.note,
      createdByUser: row.user,
      project: row.project ? {
        ...row.project,
        projectTypeName: row.projectTypeName,
      } : null,
    }));
  }

  async updateClientNote(id: string, noteData: UpdateClientNote): Promise<ClientNote> {
    const [note] = await db
      .update(clientNotes)
      .set({ ...noteData, updatedAt: new Date() })
      .where(eq(clientNotes.id, id))
      .returning();

    if (!note) {
      throw new Error(`Client note with ID '${id}' not found`);
    }

    return note;
  }

  async deleteClientNote(id: string): Promise<void> {
    const result = await db
      .delete(clientNotes)
      .where(eq(clientNotes.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error(`Client note with ID '${id}' not found`);
    }
  }
}
