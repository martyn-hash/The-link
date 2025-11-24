import { db } from "../../db";
import { 
  clientPortalUsers,
  type ClientPortalUser,
  type InsertClientPortalUser
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export class PortalStorage {
  // Client Portal User operations
  async createClientPortalUser(user: InsertClientPortalUser): Promise<ClientPortalUser> {
    const [newUser] = await db
      .insert(clientPortalUsers)
      .values(user)
      .returning();
    return newUser;
  }

  async getClientPortalUserById(id: string): Promise<ClientPortalUser | undefined> {
    const [user] = await db
      .select()
      .from(clientPortalUsers)
      .where(eq(clientPortalUsers.id, id));
    return user;
  }

  async getClientPortalUserByEmail(email: string): Promise<ClientPortalUser | undefined> {
    const [user] = await db
      .select()
      .from(clientPortalUsers)
      .where(eq(clientPortalUsers.email, email));
    return user;
  }

  async getClientPortalUserByMagicLinkToken(token: string): Promise<ClientPortalUser | undefined> {
    const [user] = await db
      .select()
      .from(clientPortalUsers)
      .where(eq(clientPortalUsers.magicLinkToken, token));
    return user;
  }

  async getClientPortalUsersByClientId(clientId: string): Promise<ClientPortalUser[]> {
    return await db
      .select()
      .from(clientPortalUsers)
      .where(eq(clientPortalUsers.clientId, clientId));
  }

  async getClientPortalUserByPersonId(personId: string): Promise<ClientPortalUser | undefined> {
    const [user] = await db
      .select()
      .from(clientPortalUsers)
      .where(eq(clientPortalUsers.personId, personId));
    return user;
  }

  async updateClientPortalUser(id: string, user: Partial<InsertClientPortalUser>): Promise<ClientPortalUser> {
    const [updated] = await db
      .update(clientPortalUsers)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(clientPortalUsers.id, id))
      .returning();
    return updated;
  }

  async deleteClientPortalUser(id: string): Promise<void> {
    await db.delete(clientPortalUsers).where(eq(clientPortalUsers.id, id));
  }

  // Client Portal Session operations
  async createClientPortalSession(data: { clientPortalUserId: string; token: string; expiresAt: Date }): Promise<{ id: string; clientPortalUserId: string; token: string; expiresAt: Date }> {
    const [updated] = await db
      .update(clientPortalUsers)
      .set({
        magicLinkToken: data.token,
        tokenExpiry: data.expiresAt,
        updatedAt: new Date()
      })
      .where(eq(clientPortalUsers.id, data.clientPortalUserId))
      .returning();
    
    return {
      id: updated.id,
      clientPortalUserId: updated.id,
      token: data.token,
      expiresAt: data.expiresAt
    };
  }

  async getClientPortalSessionByToken(token: string): Promise<{ id: string; clientPortalUserId: string; token: string; expiresAt: Date } | undefined> {
    const [user] = await db
      .select()
      .from(clientPortalUsers)
      .where(eq(clientPortalUsers.magicLinkToken, token));
    
    if (!user || !user.magicLinkToken || !user.tokenExpiry) {
      return undefined;
    }
    
    return {
      id: user.id,
      clientPortalUserId: user.id,
      token: user.magicLinkToken,
      expiresAt: user.tokenExpiry
    };
  }

  async deleteClientPortalSession(id: string): Promise<void> {
    await db
      .update(clientPortalUsers)
      .set({
        magicLinkToken: null,
        tokenExpiry: null,
        updatedAt: new Date()
      })
      .where(eq(clientPortalUsers.id, id));
  }

  async cleanupExpiredSessions(): Promise<void> {
    await db
      .update(clientPortalUsers)
      .set({
        magicLinkToken: null,
        tokenExpiry: null,
        updatedAt: new Date()
      })
      .where(sql`${clientPortalUsers.tokenExpiry} < NOW() AND ${clientPortalUsers.tokenExpiry} IS NOT NULL`);
  }
}
