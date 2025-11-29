import { z } from 'zod';

export const insertFunnyErrorPhraseSchema = z.object({
  phrase: z.string().min(1),
  category: z.string().min(1).max(50),
});

export const insertUserSeenPhraseSchema = z.object({
  userId: z.string(),
  phraseId: z.number(),
});
