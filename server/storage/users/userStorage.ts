import { db } from "../../db";
import { eq, desc, and, or, lt, isNull, not } from "drizzle-orm";
import bcrypt from "bcrypt";
import {
  users,
  userSessions,
  loginAttempts,
  magicLinkTokens,
  type User,
  type UpsertUser,
  type InsertUser,
  type UserSession,
  type InsertUserSession,
  type LoginAttempt,
  type InsertLoginAttempt,
  type MagicLinkToken,
  type InsertMagicLinkToken,
} from "@shared/schema";
import { sql } from "drizzle-orm";

export class UserStorage {
  // Helper method to check verification rate limiting
  private verificationAttempts = new Map<string, { count: number; resetTime: number }>();

  private checkVerificationRateLimit(key: string): boolean {
    const MAX_ATTEMPTS = 10; // Max 10 attempts per key per hour
    const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
    const now = Date.now();
    const existing = this.verificationAttempts.get(key);
    
    if (!existing || now > existing.resetTime) {
      // First attempt or window expired
      this.verificationAttempts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return true;
    }
    
    if (existing.count >= MAX_ATTEMPTS) {
      return false; // Rate limited
    }
    
    // Increment count
    existing.count += 1;
    return true;
  }

  // User CRUD methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Try to create new user, if conflict exists then update by ID only
    try {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            // Never update the ID - only update other fields
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (error) {
      // Handle unique constraint violation on email
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new Error(`User with email ${userData.email} already exists with different ID`);
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const result = await db.delete(users).where(eq(users.id, id));
    if (result.rowCount === 0) {
      throw new Error("User not found");
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    // Only support admin role since other roles are deprecated
    if (role === 'admin') {
      return await db.select().from(users).where(eq(users.isAdmin, true));
    }
    // Return empty array for deprecated roles
    console.warn(`Deprecated role requested: ${role}. Only admin role is supported.`);
    return [];
  }

  // Admin operations
  async createAdminIfNone(userData: InsertUser): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      // Use a transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Check if any admin users exist within the transaction
        const adminUsers = await tx.select().from(users).where(eq(users.isAdmin, true));
        
        if (adminUsers.length > 0) {
          return { success: false, error: "Admin user already exists. This operation can only be performed once." };
        }

        // Check if user with this email already exists
        const existingUser = await tx.select().from(users).where(eq(users.email, userData.email || ''));
        if (existingUser.length > 0) {
          return { success: false, error: "User with this email already exists" };
        }

        // Create the admin user within the transaction
        const [newUser] = await tx.insert(users).values({
          ...userData,
          isAdmin: true, // Ensure user is admin
          canSeeAdminMenu: true
        }).returning();

        return { success: true, user: newUser };
      });

      return result;
    } catch (error) {
      console.error("Error in atomic admin creation:", error);
      return { success: false, error: "Failed to create admin user" };
    }
  }

  // Impersonation operations (using in-memory state)
  private impersonationStates = new Map<string, { originalUserId: string; impersonatedUserId: string }>();

  async startImpersonation(adminUserId: string, targetUserId: string): Promise<void> {
    // Verify admin user exists and has admin role
    const adminUser = await this.getUser(adminUserId);
    if (!adminUser || !adminUser.isAdmin) {
      throw new Error("Only admin users can impersonate others");
    }

    // Verify target user exists
    const targetUser = await this.getUser(targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    // Store impersonation state
    this.impersonationStates.set(adminUserId, {
      originalUserId: adminUserId,
      impersonatedUserId: targetUserId
    });
  }

  async stopImpersonation(adminUserId: string): Promise<void> {
    this.impersonationStates.delete(adminUserId);
  }

  async getImpersonationState(adminUserId: string): Promise<{ isImpersonating: boolean; originalUserId?: string; impersonatedUserId?: string }> {
    const state = this.impersonationStates.get(adminUserId);
    if (state) {
      return {
        isImpersonating: true,
        originalUserId: state.originalUserId,
        impersonatedUserId: state.impersonatedUserId
      };
    }
    return { isImpersonating: false };
  }

  async getEffectiveUser(adminUserId: string): Promise<User | undefined> {
    const state = this.impersonationStates.get(adminUserId);
    if (state) {
      // Return the impersonated user
      return await this.getUser(state.impersonatedUserId);
    }
    // Return the original user
    return await this.getUser(adminUserId);
  }

  // Session operations
  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    const [newSession] = await db
      .insert(userSessions)
      .values(session)
      .returning();
    return newSession;
  }

  private lastActivityUpdateCache: Map<string, number> = new Map();
  private readonly ACTIVITY_UPDATE_INTERVAL_MS = 30000; // 30 seconds

  async updateUserSessionActivity(userId: string, _expressSessionId?: string): Promise<void> {
    // Rate-limit activity updates to prevent database deadlocks from concurrent requests
    // Use userId as cache key since we update the most recent session for the user
    const cacheKey = userId;
    const lastUpdate = this.lastActivityUpdateCache.get(cacheKey);
    const now = Date.now();
    
    if (lastUpdate && (now - lastUpdate) < this.ACTIVITY_UPDATE_INTERVAL_MS) {
      // Skip update if less than 30 seconds since last update
      return;
    }
    
    // Update cache immediately to prevent concurrent updates
    this.lastActivityUpdateCache.set(cacheKey, now);
    
    try {
      // Clean up old cache entries periodically (every 100 entries)
      if (this.lastActivityUpdateCache.size > 100) {
        const cutoff = now - this.ACTIVITY_UPDATE_INTERVAL_MS * 2;
        const entries = Array.from(this.lastActivityUpdateCache.entries());
        for (const [key, timestamp] of entries) {
          if (timestamp < cutoff) {
            this.lastActivityUpdateCache.delete(key);
          }
        }
      }
      
      // Update only the most recent active session for this user
      // Use SELECT then UPDATE to target a single row, preventing deadlocks
      const activeSession = await db
        .select({ id: userSessions.id })
        .from(userSessions)
        .where(
          and(
            eq(userSessions.userId, userId),
            eq(userSessions.isActive, true)
          )
        )
        .orderBy(desc(userSessions.lastActivity))
        .limit(1);
      
      if (activeSession.length > 0) {
        await db
          .update(userSessions)
          .set({ lastActivity: new Date() })
          .where(eq(userSessions.id, activeSession[0].id));
      }
    } catch (error) {
      // Clear cache on failure so next attempt can retry
      this.lastActivityUpdateCache.delete(cacheKey);
      throw error;
    }
  }

  async getUserSessions(userId?: string, options?: { limit?: number; onlyActive?: boolean }): Promise<(UserSession & { user: User })[]> {
    let query = db
      .select({
        id: userSessions.id,
        userId: userSessions.userId,
        loginTime: userSessions.loginTime,
        lastActivity: userSessions.lastActivity,
        logoutTime: userSessions.logoutTime,
        ipAddress: userSessions.ipAddress,
        city: userSessions.city,
        country: userSessions.country,
        browser: userSessions.browser,
        device: userSessions.device,
        os: userSessions.os,
        platformType: userSessions.platformType,
        pushEnabled: userSessions.pushEnabled,
        sessionDuration: userSessions.sessionDuration,
        isActive: userSessions.isActive,
        user: users,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .orderBy(desc(userSessions.loginTime));

    const conditions = [];
    if (userId) {
      conditions.push(eq(userSessions.userId, userId));
    }
    if (options?.onlyActive) {
      conditions.push(eq(userSessions.isActive, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    const sessions = await query;
    return sessions as (UserSession & { user: User })[];
  }

  async markSessionAsLoggedOut(sessionId: string): Promise<void> {
    const [session] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.id, sessionId));

    if (!session) {
      throw new Error("Session not found");
    }

    const now = new Date();
    const sessionDuration = Math.floor(
      (now.getTime() - session.loginTime.getTime()) / (1000 * 60)
    );

    await db
      .update(userSessions)
      .set({
        logoutTime: now,
        isActive: false,
        sessionDuration,
      })
      .where(eq(userSessions.id, sessionId));
  }

  async cleanupOldSessions(daysToKeep: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db
      .delete(userSessions)
      .where(lt(userSessions.loginTime, cutoffDate));

    return result.rowCount || 0;
  }

  async markInactiveSessions(): Promise<number> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const sessionsToUpdate = await db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.isActive, true),
          isNull(userSessions.logoutTime),
          lt(userSessions.lastActivity, cutoff)
        )
      );

    if (sessionsToUpdate.length === 0) {
      return 0;
    }

    for (const session of sessionsToUpdate) {
      const sessionDuration = Math.floor(
        (session.lastActivity.getTime() - session.loginTime.getTime()) / (1000 * 60)
      );

      await db
        .update(userSessions)
        .set({
          isActive: false,
          sessionDuration,
        })
        .where(eq(userSessions.id, session.id));
    }

    return sessionsToUpdate.length;
  }

  // Login attempt operations
  async createLoginAttempt(attempt: InsertLoginAttempt): Promise<LoginAttempt> {
    const [newAttempt] = await db
      .insert(loginAttempts)
      .values(attempt)
      .returning();
    return newAttempt;
  }

  async getLoginAttempts(options?: { email?: string; limit?: number }): Promise<LoginAttempt[]> {
    let query = db
      .select()
      .from(loginAttempts)
      .orderBy(desc(loginAttempts.timestamp));

    if (options?.email) {
      query = query.where(eq(loginAttempts.email, options.email)) as any;
    }

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    return await query;
  }

  async cleanupOldLoginAttempts(daysToKeep: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db
      .delete(loginAttempts)
      .where(lt(loginAttempts.timestamp, cutoffDate));

    return result.rowCount || 0;
  }

  // Magic link operations
  async createMagicLinkToken(tokenData: InsertMagicLinkToken): Promise<MagicLinkToken> {
    const [token] = await db.insert(magicLinkTokens).values(tokenData).returning();
    return token;
  }

  async getMagicLinkTokenByToken(token: string): Promise<MagicLinkToken | undefined> {
    // Rate limit verification attempts per token to prevent DoS
    const rateLimitKey = `token_verify_${token.substring(0, 8)}`; // Use first 8 chars as key
    if (!this.checkVerificationRateLimit(rateLimitKey)) {
      return undefined; // Rate limited
    }

    // Get valid, unused, non-expired tokens, but limit to most recent 50 to prevent DoS
    // Order by creation time descending so we check newest tokens first
    const validTokens = await db
      .select()
      .from(magicLinkTokens)
      .where(and(
        eq(magicLinkTokens.used, false),
        sql`${magicLinkTokens.expiresAt} > now()`
      ))
      .orderBy(desc(magicLinkTokens.createdAt))
      .limit(50);
    
    // Compare provided token hash with stored hashes (limited set)
    for (const storedToken of validTokens) {
      const isValid = await bcrypt.compare(token, storedToken.tokenHash);
      if (isValid) {
        return storedToken;
      }
    }
    
    return undefined;
  }

  async getMagicLinkTokenByCodeAndEmail(code: string, email: string): Promise<MagicLinkToken | undefined> {
    // Rate limit verification attempts per email+code to prevent DoS
    const rateLimitKey = `code_verify_${email}_${code}`;
    if (!this.checkVerificationRateLimit(rateLimitKey)) {
      return undefined; // Rate limited
    }

    // Get valid, unused, non-expired tokens for this email, limited to most recent 10
    // Since code+email should be more specific, we can limit to fewer tokens
    const validTokens = await db
      .select()
      .from(magicLinkTokens)
      .where(and(
        eq(magicLinkTokens.email, email),
        eq(magicLinkTokens.used, false),
        sql`${magicLinkTokens.expiresAt} > now()`
      ))
      .orderBy(desc(magicLinkTokens.createdAt))
      .limit(10);
    
    // Compare provided code hash with stored hashes (limited set)
    for (const storedToken of validTokens) {
      const isValid = await bcrypt.compare(code, storedToken.codeHash);
      if (isValid) {
        return storedToken;
      }
    }
    
    return undefined;
  }

  async markMagicLinkTokenAsUsed(id: string): Promise<void> {
    // Use atomic conditional update to prevent race conditions
    const result = await db
      .update(magicLinkTokens)
      .set({ used: true })
      .where(and(
        eq(magicLinkTokens.id, id),
        eq(magicLinkTokens.used, false) // Only update if not already used
      ));
    
    // Verify that exactly one row was affected
    if (result.rowCount === 0) {
      throw new Error("Magic link token has already been used or does not exist");
    }
  }

  async cleanupExpiredMagicLinkTokens(): Promise<void> {
    await db
      .delete(magicLinkTokens)
      .where(sql`${magicLinkTokens.expiresAt} < now()`);
  }

  async getValidMagicLinkTokensForUser(userId: string): Promise<MagicLinkToken[]> {
    return await db
      .select()
      .from(magicLinkTokens)
      .where(and(
        eq(magicLinkTokens.userId, userId),
        eq(magicLinkTokens.used, false),
        sql`${magicLinkTokens.expiresAt} > now()`
      ));
  }

  // Get fallback user for role assignments
  async getFallbackUser(): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.isFallbackUser, true));
    return user;
  }

  // Set fallback user (removes flag from all other users first)
  async setFallbackUser(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Remove fallback flag from all users
      await tx
        .update(users)
        .set({ isFallbackUser: false })
        .where(eq(users.isFallbackUser, true));

      // Set the new fallback user
      const [user] = await tx
        .update(users)
        .set({ isFallbackUser: true })
        .where(eq(users.id, userId))
        .returning();
      
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
    });
  }
}