import { relations } from 'drizzle-orm';
import { funnyErrorPhrases, userSeenPhrases } from './tables';
import { users } from '../users/tables';

export const funnyErrorPhrasesRelations = relations(funnyErrorPhrases, ({ many }) => ({
  userSeenPhrases: many(userSeenPhrases),
}));

export const userSeenPhrasesRelations = relations(userSeenPhrases, ({ one }) => ({
  user: one(users, {
    fields: [userSeenPhrases.userId],
    references: [users.id],
  }),
  phrase: one(funnyErrorPhrases, {
    fields: [userSeenPhrases.phraseId],
    references: [funnyErrorPhrases.id],
  }),
}));
