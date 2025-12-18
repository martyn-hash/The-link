import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import {
  userIntegrations,
  userOauthAccounts,
  type UserIntegration,
  type InsertUserIntegration,
  type InsertUserOauthAccount,
} from "@shared/schema";

type UserOauthAccount = typeof userOauthAccounts.$inferSelect;

export class IntegrationStorage {
  async getUserIntegrations(userId: string): Promise<Omit<UserIntegration, 'accessToken' | 'refreshToken'>[]> {
    return await db
      .select({
        id: userIntegrations.id,
        userId: userIntegrations.userId,
        integrationType: userIntegrations.integrationType,
        tokenExpiry: userIntegrations.tokenExpiry,
        isActive: userIntegrations.isActive,
        metadata: userIntegrations.metadata,
        createdAt: userIntegrations.createdAt,
        updatedAt: userIntegrations.updatedAt,
      })
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, userId))
      .orderBy(userIntegrations.createdAt);
  }

  async getUserIntegrationByType(userId: string, integrationType: 'office365' | 'voodoo_sms' | 'ringcentral'): Promise<UserIntegration | undefined> {
    const [integration] = await db
      .select()
      .from(userIntegrations)
      .where(and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.integrationType, integrationType)
      ))
      .limit(1);
    return integration;
  }

  async getActiveIntegrationsByType(integrationType: 'office365' | 'voodoo_sms' | 'ringcentral'): Promise<UserIntegration[]> {
    return await db
      .select()
      .from(userIntegrations)
      .where(and(
        eq(userIntegrations.integrationType, integrationType),
        eq(userIntegrations.isActive, true)
      ));
  }

  async createUserIntegration(integration: InsertUserIntegration): Promise<UserIntegration> {
    const [newIntegration] = await db
      .insert(userIntegrations)
      .values(integration)
      .returning();
    return newIntegration;
  }

  async updateUserIntegration(id: string, integration: Partial<InsertUserIntegration>): Promise<UserIntegration> {
    const [updated] = await db
      .update(userIntegrations)
      .set({
        ...integration,
        updatedAt: new Date(),
      })
      .where(eq(userIntegrations.id, id))
      .returning();
    return updated;
  }

  async deleteUserIntegration(id: string): Promise<void> {
    await db.delete(userIntegrations).where(eq(userIntegrations.id, id));
  }

  async getUserOauthAccount(userId: string, provider: string): Promise<UserOauthAccount | undefined> {
    const [account] = await db
      .select()
      .from(userOauthAccounts)
      .where(and(
        eq(userOauthAccounts.userId, userId),
        eq(userOauthAccounts.provider, provider)
      ))
      .limit(1);
    return account;
  }

  async createUserOauthAccount(account: InsertUserOauthAccount): Promise<UserOauthAccount> {
    const [newAccount] = await db
      .insert(userOauthAccounts)
      .values(account)
      .returning();
    return newAccount;
  }

  async updateUserOauthAccount(id: string, account: Partial<InsertUserOauthAccount>): Promise<UserOauthAccount> {
    const [updated] = await db
      .update(userOauthAccounts)
      .set({
        ...account,
        updatedAt: new Date(),
      })
      .where(eq(userOauthAccounts.id, id))
      .returning();
    return updated;
  }

  async deleteUserOauthAccount(userId: string, provider: string): Promise<void> {
    await db.delete(userOauthAccounts).where(and(
      eq(userOauthAccounts.userId, userId),
      eq(userOauthAccounts.provider, provider)
    ));
  }
}
