import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { communications, clients, people, users, projects, inboxEmails, inboxes } from '@shared/schema';
import { eq, desc, sql, and, inArray, lt, or } from 'drizzle-orm';
import type { Communication, InsertCommunication, Client, Person, User, Project, InboxEmail } from '@shared/schema';

export interface UnifiedTimelineItem {
  id: string;
  source: 'communication' | 'inbox_email';
  type: string;
  subject: string | null;
  content: string | null;
  direction: 'inbound' | 'outbound' | null;
  timestamp: Date;
  clientId: string | null;
  personId: string | null;
  projectId: string | null;
  userId: string | null;
  fromAddress?: string;
  fromName?: string;
  toRecipients?: { address: string; name: string }[];
  status?: string;
  slaDeadline?: Date | null;
  hasAttachments?: boolean;
  inboxName?: string;
  metadata?: unknown;
}

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

  // ============================================================================
  // COMMUNICATIONS - Transcription Recovery
  // ============================================================================

  async getCommunicationsWithPendingTranscription(): Promise<Communication[]> {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    const results = await db
      .select()
      .from(communications)
      .where(
        and(
          eq(communications.type, 'phone_call'),
          lt(communications.createdAt, twoMinutesAgo),
          sql`${communications.metadata}->>'transcriptionStatus' IN ('pending', 'requesting', 'processing')`
        )
      )
      .orderBy(desc(communications.createdAt))
      .limit(20);

    return results;
  }

  // ============================================================================
  // UNIFIED TIMELINE - Combined Communications + Inbox Emails
  // ============================================================================

  async getUnifiedTimelineByClientId(
    clientId: string,
    options: {
      direction?: 'inbound' | 'outbound' | 'all';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<UnifiedTimelineItem[]> {
    const { direction = 'all', limit = 100, offset = 0 } = options;
    
    // Get communications for this client
    const commsResults = await db
      .select({
        communication: communications,
        user: users,
      })
      .from(communications)
      .innerJoin(users, eq(communications.userId, users.id))
      .where(eq(communications.clientId, clientId))
      .orderBy(desc(communications.loggedAt));

    // Get inbox emails for this client
    const emailResults = await db
      .select({
        email: inboxEmails,
        inbox: inboxes,
      })
      .from(inboxEmails)
      .innerJoin(inboxes, eq(inboxEmails.inboxId, inboxes.id))
      .where(eq(inboxEmails.matchedClientId, clientId))
      .orderBy(desc(inboxEmails.receivedAt));

    // Transform communications to unified format
    const commsItems: UnifiedTimelineItem[] = commsResults.map(result => ({
      id: result.communication.id,
      source: 'communication' as const,
      type: result.communication.type,
      subject: result.communication.subject,
      content: result.communication.content,
      direction: result.communication.type === 'phone_call' || result.communication.type === 'sms_sent' 
        ? 'outbound' as const 
        : result.communication.type === 'sms_received' || result.communication.type === 'email_received'
          ? 'inbound' as const
          : result.communication.type === 'email_sent'
            ? 'outbound' as const
            : null,
      timestamp: result.communication.actualContactTime,
      clientId: result.communication.clientId,
      personId: result.communication.personId,
      projectId: result.communication.projectId,
      userId: result.communication.userId,
      metadata: result.communication.metadata,
    }));

    // Transform inbox emails to unified format
    const emailItems: UnifiedTimelineItem[] = emailResults.map(result => ({
      id: result.email.id,
      source: 'inbox_email' as const,
      type: 'email',
      subject: result.email.subject,
      content: result.email.bodyPreview,
      direction: result.email.direction as 'inbound' | 'outbound' | null,
      timestamp: result.email.receivedAt,
      clientId: result.email.matchedClientId,
      personId: result.email.matchedPersonId,
      projectId: result.email.projectId,
      userId: result.email.staffUserId,
      fromAddress: result.email.fromAddress,
      fromName: result.email.fromName || undefined,
      toRecipients: result.email.toRecipients as { address: string; name: string }[],
      status: result.email.status || undefined,
      slaDeadline: result.email.slaDeadline,
      hasAttachments: result.email.hasAttachments || false,
      inboxName: result.inbox.displayName || result.inbox.emailAddress,
    }));

    // Combine and sort by timestamp
    let allItems = [...commsItems, ...emailItems];

    // Apply direction filter if specified
    if (direction !== 'all') {
      allItems = allItems.filter(item => item.direction === direction);
    }

    // Sort by timestamp descending
    allItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    return allItems.slice(offset, offset + limit);
  }

  async getInboxEmailsByClientId(clientId: string): Promise<InboxEmail[]> {
    const results = await db
      .select()
      .from(inboxEmails)
      .where(eq(inboxEmails.matchedClientId, clientId))
      .orderBy(desc(inboxEmails.receivedAt));

    return results;
  }
}
