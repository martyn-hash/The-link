/**
 * Unit Tests for UserStorage Magic Links and Login Attempts
 * 
 * Testing approach for magic links:
 * - Since we cannot access emails during testing, we verify magic links by:
 *   1. Checking database for magic link token creation
 *   2. Extracting the token/code directly from the database
 *   3. Verifying token expiry and usage tracking
 */

import { UserStorage } from './userStorage';
import { db } from '../../db';
import { 
  users, 
  userSessions, 
  loginAttempts, 
  magicLinkTokens,
  type InsertMagicLinkToken,
  type InsertLoginAttempt,
  type MagicLinkToken,
  type LoginAttempt
} from '../../../shared/schema';
import { eq, and, desc, lt, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';

describe('UserStorage Tests', () => {
  let userStorage: UserStorage;
  let testUserId: string;
  let testEmail: string;

  beforeEach(async () => {
    userStorage = new UserStorage(db);
    testEmail = `test-${nanoid(6)}@example.com`;
    testUserId = nanoid();
    
    // Create a test user for magic link tests
    const hashedPassword = await bcrypt.hash('testpass123', 10);
    await db.insert(users).values({
      id: testUserId,
      email: testEmail,
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'admin',
      superAdmin: false,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  describe('Magic Link Flow', () => {
    it('should create a magic link token in the database', async () => {
      // Create a magic link token
      const token = nanoid();
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      const tokenData: InsertMagicLinkToken = {
        userId: testUserId,
        email: testEmail,
        token: token,
        code: code,
        expiresAt: expiresAt,
        used: false
      };
      
      const createdToken = await userStorage.createMagicLinkToken(tokenData);
      
      // Verify token was created
      expect(createdToken).toBeDefined();
      expect(createdToken.token).toBe(token);
      expect(createdToken.code).toBe(code);
      expect(createdToken.userId).toBe(testUserId);
      expect(createdToken.email).toBe(testEmail);
      expect(createdToken.used).toBe(false);
      
      // Check database for the token
      const dbToken = await userStorage.getMagicLinkTokenByToken(token);
      expect(dbToken).toBeDefined();
      expect(dbToken?.userId).toBe(testUserId);
      expect(dbToken?.used).toBe(false);
      expect(dbToken?.expiresAt).toBeInstanceOf(Date);
      
      // Verify expiry is correct
      const expiry = new Date(dbToken!.expiresAt);
      expect(expiry.getTime()).toBeGreaterThan(Date.now());
    });

    it('should get magic link by code and email', async () => {
      // Create a magic link token
      const token = nanoid();
      const code = 'TEST123';
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      const tokenData: InsertMagicLinkToken = {
        userId: testUserId,
        email: testEmail,
        token: token,
        code: code,
        expiresAt: expiresAt,
        used: false
      };
      
      await userStorage.createMagicLinkToken(tokenData);
      
      // Get the token by code and email
      const foundToken = await userStorage.getMagicLinkTokenByCodeAndEmail(code, testEmail);
      expect(foundToken).toBeDefined();
      expect(foundToken?.code).toBe(code);
      expect(foundToken?.email).toBe(testEmail);
      expect(foundToken?.token).toBe(token);
    });

    it('should mark magic link token as used', async () => {
      // Create a magic link token
      const token = nanoid();
      const code = 'USE123';
      
      const tokenData: InsertMagicLinkToken = {
        userId: testUserId,
        email: testEmail,
        token: token,
        code: code,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        used: false
      };
      
      const createdToken = await userStorage.createMagicLinkToken(tokenData);
      
      // Mark as used
      await userStorage.markMagicLinkTokenAsUsed(createdToken.id);
      
      // Verify it's marked as used
      const usedToken = await userStorage.getMagicLinkTokenByToken(token);
      expect(usedToken?.used).toBe(true);
    });

    it('should cleanup expired magic link tokens', async () => {
      // Create an expired token
      const expiredToken = nanoid();
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      
      await userStorage.createMagicLinkToken({
        userId: testUserId,
        email: testEmail,
        token: expiredToken,
        code: 'EXPIRED',
        expiresAt: expiredDate,
        used: false
      });
      
      // Cleanup expired tokens
      await userStorage.cleanupExpiredMagicLinkTokens();
      
      // Expired token should be gone
      const expiredCheck = await userStorage.getMagicLinkTokenByToken(expiredToken);
      expect(expiredCheck).toBeUndefined();
    });

    it('should get valid magic link tokens for user', async () => {
      // Create multiple tokens
      const validToken = nanoid();
      const usedToken = nanoid();
      const futureExpiry = new Date(Date.now() + 15 * 60 * 1000);
      
      await userStorage.createMagicLinkToken({
        userId: testUserId,
        email: testEmail,
        token: validToken,
        code: 'VALID1',
        expiresAt: futureExpiry,
        used: false
      });
      
      const usedTokenData = await userStorage.createMagicLinkToken({
        userId: testUserId,
        email: testEmail,
        token: usedToken,
        code: 'USED1',
        expiresAt: futureExpiry,
        used: false
      });
      
      // Mark one as used
      await userStorage.markMagicLinkTokenAsUsed(usedTokenData.id);
      
      // Get valid tokens
      const validTokens = await userStorage.getValidMagicLinkTokensForUser(testUserId);
      
      // Should only return non-used, non-expired tokens
      expect(validTokens.length).toBe(1);
      expect(validTokens[0].token).toBe(validToken);
      expect(validTokens[0].used).toBe(false);
    });
  });

  describe('Login Attempts Tracking', () => {
    it('should create a login attempt record', async () => {
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';
      
      // Create a login attempt
      const attemptData: InsertLoginAttempt = {
        email: testEmail,
        ipAddress: ipAddress,
        successful: true,
        userAgent: userAgent
      };
      
      await userStorage.createLoginAttempt(attemptData);
      
      // Get login attempts
      const attempts = await userStorage.getLoginAttempts({ email: testEmail, limit: 5 });
      expect(attempts).toBeDefined();
      expect(attempts.length).toBeGreaterThan(0);
      
      const lastAttempt = attempts[0];
      expect(lastAttempt.email).toBe(testEmail);
      expect(lastAttempt.ipAddress).toBe(ipAddress);
      expect(lastAttempt.successful).toBe(true);
      expect(lastAttempt.userAgent).toBe(userAgent);
    });

    it('should track failed login attempts', async () => {
      const ipAddress = '192.168.1.1';
      
      // Create multiple failed attempts
      for (let i = 0; i < 3; i++) {
        await userStorage.createLoginAttempt({
          email: testEmail,
          ipAddress: ipAddress,
          successful: false
        });
      }
      
      // Get login attempts
      const attempts = await userStorage.getLoginAttempts({ email: testEmail, limit: 10 });
      const failedAttempts = attempts.filter(a => !a.successful);
      
      expect(failedAttempts.length).toBe(3);
      failedAttempts.forEach(attempt => {
        expect(attempt.successful).toBe(false);
        expect(attempt.ipAddress).toBe(ipAddress);
      });
    });

    it('should limit returned login attempts', async () => {
      const ipAddress = '192.168.1.1';
      
      // Create 10 attempts
      for (let i = 0; i < 10; i++) {
        await userStorage.createLoginAttempt({
          email: testEmail,
          ipAddress: ipAddress,
          successful: i % 2 === 0
        });
      }
      
      // Get only 5 attempts
      const attempts = await userStorage.getLoginAttempts({ email: testEmail, limit: 5 });
      expect(attempts.length).toBe(5);
      
      // Should be ordered by most recent first
      for (let i = 1; i < attempts.length; i++) {
        const prevTime = new Date(attempts[i - 1].timestamp).getTime();
        const currTime = new Date(attempts[i].timestamp).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    });

    it('should cleanup old login attempts', async () => {
      const ipAddress = '192.168.1.1';
      
      // Manually insert old attempts
      const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000); // 91 days ago
      const recentDate = new Date(Date.now() - 1000); // 1 second ago
      
      await db.insert(loginAttempts).values([
        {
          id: nanoid(),
          email: testEmail,
          ipAddress: ipAddress,
          successful: false,
          timestamp: oldDate
        },
        {
          id: nanoid(),
          email: testEmail,
          ipAddress: ipAddress,
          successful: true,
          timestamp: recentDate
        }
      ]);
      
      // Cleanup old attempts (older than 90 days)
      const deletedCount = await userStorage.cleanupOldLoginAttempts(90);
      expect(deletedCount).toBe(1);
      
      // Check remaining attempts
      const attempts = await userStorage.getLoginAttempts({ email: testEmail, limit: 10 });
      expect(attempts.length).toBe(1);
      expect(new Date(attempts[0].timestamp).getTime()).toBeGreaterThan(
        Date.now() - 90 * 24 * 60 * 60 * 1000
      );
    });
  });

  // Clean up after each test
  afterEach(async () => {
    // Clean up test data
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
      await db.delete(magicLinkTokens).where(eq(magicLinkTokens.userId, testUserId));
      await db.delete(userSessions).where(eq(userSessions.userId, testUserId));
    }
    if (testEmail) {
      await db.delete(loginAttempts).where(eq(loginAttempts.email, testEmail));
    }
  });
});