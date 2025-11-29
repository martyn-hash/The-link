import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { funnyErrorPhrases, userSeenPhrases } from '@shared/schema';
import { eq, and, notInArray, sql } from 'drizzle-orm';
import type { FunnyErrorPhrase, UserSeenPhrase } from '@shared/schema';

export class ErrorPhraseStorage extends BaseStorage {
  async getRandomUnseenPhrase(userId: string): Promise<FunnyErrorPhrase | null> {
    const seenPhraseIds = db
      .select({ phraseId: userSeenPhrases.phraseId })
      .from(userSeenPhrases)
      .where(eq(userSeenPhrases.userId, userId));

    const [phrase] = await db
      .select()
      .from(funnyErrorPhrases)
      .where(notInArray(funnyErrorPhrases.id, seenPhraseIds))
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (phrase) {
      return phrase;
    }

    await db.delete(userSeenPhrases).where(eq(userSeenPhrases.userId, userId));

    const [randomPhrase] = await db
      .select()
      .from(funnyErrorPhrases)
      .orderBy(sql`RANDOM()`)
      .limit(1);

    return randomPhrase || null;
  }

  async markPhraseAsSeen(userId: string, phraseId: number): Promise<UserSeenPhrase> {
    const [existing] = await db
      .select()
      .from(userSeenPhrases)
      .where(
        and(
          eq(userSeenPhrases.userId, userId),
          eq(userSeenPhrases.phraseId, phraseId)
        )
      );

    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(userSeenPhrases)
      .values({ userId, phraseId })
      .returning();

    return created;
  }

  async getAllPhrases(): Promise<FunnyErrorPhrase[]> {
    return await db.select().from(funnyErrorPhrases).orderBy(funnyErrorPhrases.id);
  }

  async getPhraseCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(funnyErrorPhrases);
    return result[0]?.count || 0;
  }

  async getUserSeenCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSeenPhrases)
      .where(eq(userSeenPhrases.userId, userId));
    return result[0]?.count || 0;
  }
}
