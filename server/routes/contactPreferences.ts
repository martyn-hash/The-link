import type { Express, Request, Response, NextFunction } from 'express';
import { contactPreferencesStorage } from '../storage/contacts';
import { optOutRequestSchema } from '@shared/schema';
import { db } from '../db';
import { people } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

export function registerContactPreferencesRoutes(
  app: Express,
  isAuthenticated: AuthMiddleware,
  resolveEffectiveUser: AuthMiddleware
): void {
  app.get('/api/contact-preferences/:token', async (req: any, res) => {
    try {
      const personId = await contactPreferencesStorage.validatePreferenceToken(req.params.token);
      if (!personId) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      const [person] = await db.select({
        id: people.id,
        fullName: people.fullName,
        email: people.email,
      }).from(people).where(eq(people.id, personId));
      
      if (!person) {
        return res.status(404).json({ error: 'Person not found' });
      }
      
      const preferences = await contactPreferencesStorage.getByPersonId(personId);
      
      res.json({
        person: {
          id: person.id,
          fullName: person.fullName,
          email: person.email,
        },
        preferences: preferences.map(p => ({
          id: p.id,
          channel: p.channel,
          category: p.category,
          optedOut: p.optedOut,
          optedOutAt: p.optedOutAt,
          optedOutReason: p.optedOutReason,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching contact preferences:', error);
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  app.post('/api/contact-preferences/:token/opt-out', async (req: any, res) => {
    try {
      const personId = await contactPreferencesStorage.validatePreferenceToken(req.params.token);
      if (!personId) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      const data = optOutRequestSchema.parse(req.body);
      
      if (data.category === 'all') {
        await contactPreferencesStorage.optOutAll(
          personId,
          data.channel,
          'preference_centre',
          data.reason
        );
      } else {
        await contactPreferencesStorage.optOut(
          personId,
          data.channel,
          data.category,
          'preference_centre',
          data.reason
        );
      }
      
      await contactPreferencesStorage.markTokenUsed(req.params.token);
      const preferences = await contactPreferencesStorage.getByPersonId(personId);
      res.json({ success: true, preferences });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Error processing opt-out:', error);
      res.status(500).json({ error: 'Failed to process opt-out' });
    }
  });

  app.post('/api/contact-preferences/:token/opt-in', async (req: any, res) => {
    try {
      const personId = await contactPreferencesStorage.validatePreferenceToken(req.params.token);
      if (!personId) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      const { channel, category } = req.body;
      if (!channel || !category) {
        return res.status(400).json({ error: 'Channel and category are required' });
      }
      
      await contactPreferencesStorage.optIn(personId, channel, category);
      await contactPreferencesStorage.markTokenUsed(req.params.token);
      
      const preferences = await contactPreferencesStorage.getByPersonId(personId);
      res.json({ success: true, preferences });
    } catch (error: any) {
      console.error('Error processing opt-in:', error);
      res.status(500).json({ error: 'Failed to process opt-in' });
    }
  });

  app.post('/api/contact-preferences/generate-token', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { personId } = req.body;
      if (!personId) {
        return res.status(400).json({ error: 'Person ID is required' });
      }
      
      const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, personId));
      if (!person) {
        return res.status(404).json({ error: 'Person not found' });
      }
      
      const token = await contactPreferencesStorage.createPreferenceToken(personId);
      res.json({ token, url: `/preferences/${token}` });
    } catch (error: any) {
      console.error('Error generating preference token:', error);
      res.status(500).json({ error: 'Failed to generate token' });
    }
  });

  app.get('/api/contact-preferences/check/:personId/:channel/:category', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { personId, channel, category } = req.params;
      const isOptedOut = await contactPreferencesStorage.isOptedOut(personId, channel, category);
      res.json({ optedOut: isOptedOut });
    } catch (error: any) {
      console.error('Error checking opt-out status:', error);
      res.status(500).json({ error: 'Failed to check opt-out status' });
    }
  });
}
