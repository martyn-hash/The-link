import { z } from 'zod';
import { funnyErrorPhrases, userSeenPhrases } from './tables';
import { insertFunnyErrorPhraseSchema, insertUserSeenPhraseSchema } from './schemas';

export type FunnyErrorPhrase = typeof funnyErrorPhrases.$inferSelect;
export type InsertFunnyErrorPhrase = z.infer<typeof insertFunnyErrorPhraseSchema>;

export type UserSeenPhrase = typeof userSeenPhrases.$inferSelect;
export type InsertUserSeenPhrase = z.infer<typeof insertUserSeenPhraseSchema>;
