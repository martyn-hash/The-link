import { db } from '../../db';
import { eq, and, desc, lt } from 'drizzle-orm';
import { qboConnections, qboOAuthStates } from '@shared/schema';
import type { 
  QboConnection, 
  InsertQboConnection, 
  UpdateQboConnection,
  QboOAuthState, 
  InsertQboOAuthState,
  QboConnectionWithClient 
} from '@shared/schema';

export class QboStorage {
  async createQboConnection(data: InsertQboConnection): Promise<QboConnection> {
    const [connection] = await db.insert(qboConnections).values(data).returning();
    return connection;
  }

  async getQboConnectionById(id: string): Promise<QboConnection | null> {
    const [connection] = await db.select().from(qboConnections).where(eq(qboConnections.id, id));
    return connection || null;
  }

  async getQboConnectionByClientId(clientId: string): Promise<QboConnection | null> {
    const [connection] = await db
      .select()
      .from(qboConnections)
      .where(and(
        eq(qboConnections.clientId, clientId),
        eq(qboConnections.isActive, true)
      ));
    return connection || null;
  }

  async getQboConnectionByRealmId(realmId: string): Promise<QboConnection | null> {
    const [connection] = await db
      .select()
      .from(qboConnections)
      .where(and(
        eq(qboConnections.realmId, realmId),
        eq(qboConnections.isActive, true)
      ));
    return connection || null;
  }

  async getAllQboConnections(): Promise<QboConnection[]> {
    return db.select().from(qboConnections).orderBy(desc(qboConnections.createdAt));
  }

  async getActiveQboConnections(): Promise<QboConnection[]> {
    return db
      .select()
      .from(qboConnections)
      .where(eq(qboConnections.isActive, true))
      .orderBy(desc(qboConnections.createdAt));
  }

  async updateQboConnection(id: string, data: UpdateQboConnection): Promise<QboConnection> {
    const [updated] = await db
      .update(qboConnections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(qboConnections.id, id))
      .returning();
    return updated;
  }

  async deactivateQboConnection(id: string): Promise<QboConnection> {
    return this.updateQboConnection(id, { isActive: false });
  }

  async deleteQboConnection(id: string): Promise<void> {
    await db.delete(qboConnections).where(eq(qboConnections.id, id));
  }

  async updateQboConnectionTokens(
    id: string,
    accessTokenEncrypted: string,
    refreshTokenEncrypted: string,
    accessTokenExpiresAt: Date,
    refreshTokenExpiresAt: Date
  ): Promise<QboConnection> {
    return this.updateQboConnection(id, {
      accessTokenEncrypted,
      refreshTokenEncrypted,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      lastErrorMessage: null,
    });
  }

  async updateQboConnectionError(id: string, errorMessage: string): Promise<QboConnection> {
    return this.updateQboConnection(id, { lastErrorMessage: errorMessage });
  }

  async updateQboConnectionLastSync(id: string): Promise<QboConnection> {
    return this.updateQboConnection(id, { lastSyncAt: new Date() });
  }

  async createQboOAuthState(data: InsertQboOAuthState): Promise<QboOAuthState> {
    const [state] = await db.insert(qboOAuthStates).values(data).returning();
    return state;
  }

  async getQboOAuthStateByState(state: string): Promise<QboOAuthState | null> {
    const [oauthState] = await db
      .select()
      .from(qboOAuthStates)
      .where(eq(qboOAuthStates.state, state));
    return oauthState || null;
  }

  async markQboOAuthStateAsUsed(id: string): Promise<void> {
    await db.update(qboOAuthStates).set({ used: true }).where(eq(qboOAuthStates.id, id));
  }

  async cleanupExpiredQboOAuthStates(): Promise<void> {
    await db.delete(qboOAuthStates).where(lt(qboOAuthStates.expiresAt, new Date()));
  }

  async getQboConnectionsWithClients(): Promise<QboConnectionWithClient[]> {
    const { clients, users } = await import('@shared/schema');
    
    const connections = await db
      .select({
        connection: qboConnections,
        clientId: clients.id,
        clientName: clients.name,
        clientCompanyNumber: clients.companyNumber,
        connectedById: users.id,
        connectedByFirstName: users.firstName,
        connectedByLastName: users.lastName,
        connectedByEmail: users.email,
      })
      .from(qboConnections)
      .leftJoin(clients, eq(qboConnections.clientId, clients.id))
      .leftJoin(users, eq(qboConnections.connectedBy, users.id))
      .orderBy(desc(qboConnections.createdAt));

    return connections.map(row => ({
      ...row.connection,
      client: row.clientId ? {
        id: row.clientId,
        name: row.clientName!,
        companyNumber: row.clientCompanyNumber,
      } : undefined,
      connectedByUser: row.connectedById ? {
        id: row.connectedById,
        firstName: row.connectedByFirstName,
        lastName: row.connectedByLastName,
        email: row.connectedByEmail,
      } : undefined,
    }));
  }
}
