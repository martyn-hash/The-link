import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { auditChangelog, users } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { AuditChangelog, InsertAuditChangelog } from '@shared/schema';

export interface AuditChangelogWithUser extends AuditChangelog {
  changedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export class AuditChangelogStorage extends BaseStorage {
  async createChangelogEntry(entry: InsertAuditChangelog): Promise<AuditChangelog> {
    const [changelog] = await db.insert(auditChangelog).values(entry).returning();
    return changelog;
  }

  async getChangelogByEntity(
    entityType: string,
    entityId: string
  ): Promise<AuditChangelogWithUser[]> {
    const result = await db
      .select({
        changelog: auditChangelog,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(auditChangelog)
      .leftJoin(users, eq(auditChangelog.changedByUserId, users.id))
      .where(
        and(
          eq(auditChangelog.entityType, entityType),
          eq(auditChangelog.entityId, entityId)
        )
      )
      .orderBy(desc(auditChangelog.timestamp));

    return result.map((row) => ({
      ...row.changelog,
      changedBy: row.user,
    }));
  }

  async getChangelogById(id: string): Promise<AuditChangelogWithUser | undefined> {
    const result = await db
      .select({
        changelog: auditChangelog,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(auditChangelog)
      .leftJoin(users, eq(auditChangelog.changedByUserId, users.id))
      .where(eq(auditChangelog.id, id))
      .limit(1);

    if (result.length === 0) return undefined;

    return {
      ...result[0].changelog,
      changedBy: result[0].user,
    };
  }
}
