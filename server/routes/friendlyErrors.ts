import { Express, RequestHandler } from 'express';
import { ErrorPhraseStorage } from '../storage/errors/errorPhraseStorage.js';
import type { FunnyErrorPhrase } from '@shared/schema';

const errorPhraseStorage = new ErrorPhraseStorage();

export function registerFriendlyErrorRoutes(
  app: Express,
  isAuthenticated: RequestHandler
) {
  app.get('/api/friendly-error/phrase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const phrase = await errorPhraseStorage.getRandomUnseenPhrase(userId);
      
      if (!phrase) {
        return res.json({ 
          phrase: "Oops! Something went wrong 😅", 
          category: "fallback" 
        });
      }

      await errorPhraseStorage.markPhraseAsSeen(userId, phrase.id);

      return res.json(phrase);
    } catch (error) {
      console.error('Error fetching friendly error phrase:', error);
      return res.json({ 
        phrase: "Well, that didn't go as planned 🤔", 
        category: "fallback" 
      });
    }
  });

  app.get('/api/friendly-error/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const [totalPhrases, seenCount] = await Promise.all([
        errorPhraseStorage.getPhraseCount(),
        errorPhraseStorage.getUserSeenCount(userId)
      ]);

      return res.json({
        totalPhrases,
        seenCount,
        remainingUnseen: totalPhrases - seenCount
      });
    } catch (error) {
      console.error('Error fetching friendly error stats:', error);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });
}
