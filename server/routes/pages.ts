import type { Express, Request, Response, NextFunction } from 'express';
import { pageStorage, pageComponentStorage, pageActionStorage, pageVisitStorage } from '../storage/pages';
import {
  insertPageSchema,
  updatePageSchema,
  insertPageTemplateSchema,
  updatePageTemplateSchema,
  insertPageComponentSchema,
  insertPageActionSchema,
} from '@shared/schema';
import { z } from 'zod';

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

export function registerPageRoutes(
  app: Express,
  isAuthenticated: AuthMiddleware,
  resolveEffectiveUser: AuthMiddleware
): void {
  app.get('/api/pages', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { isPublished, limit, offset } = req.query;
      const pages = await pageStorage.getAll({
        isPublished: isPublished === 'true' ? true : isPublished === 'false' ? false : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(pages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/pages/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const page = await pageStorage.getById(req.params.id);
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }
      
      const [components, actions] = await Promise.all([
        pageComponentStorage.getByPageId(page.id),
        pageActionStorage.getByPageId(page.id),
      ]);
      
      res.json({
        ...page,
        components,
        actions,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/pages', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      let slug = req.body.slug;
      if (!slug && req.body.name) {
        slug = await pageStorage.generateUniqueSlug(req.body.name);
      }
      
      const data = insertPageSchema.parse({
        ...req.body,
        slug,
        createdByUserId: req.user?.id,
      });
      const page = await pageStorage.create(data);
      res.status(201).json(page);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/pages/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = updatePageSchema.parse(req.body);
      const page = await pageStorage.update(req.params.id, data);
      res.json(page);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/pages/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      await pageStorage.delete(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/pages/:id/publish', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const page = await pageStorage.publish(req.params.id);
      res.json(page);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/pages/:id/unpublish', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const page = await pageStorage.unpublish(req.params.id);
      res.json(page);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/pages/:id/components', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = insertPageComponentSchema.parse({
        ...req.body,
        pageId: req.params.id,
      });
      const component = await pageComponentStorage.create(data);
      res.status(201).json(component);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/pages/:id/components', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const components = z.array(insertPageComponentSchema.omit({ pageId: true })).parse(req.body);
      const result = await pageComponentStorage.replaceAll(req.params.id, components);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/pages/:id/actions', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = insertPageActionSchema.parse({
        ...req.body,
        pageId: req.params.id,
      });
      const action = await pageActionStorage.create(data);
      res.status(201).json(action);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/pages/:id/visits', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const visits = await pageVisitStorage.getByPageId(req.params.id);
      res.json(visits);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/pages/:id/stats', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const [visitCount, actionCounts] = await Promise.all([
        pageVisitStorage.countByPageId(req.params.id),
        pageVisitStorage.countActionsByPageId(req.params.id),
      ]);
      res.json({
        visits: visitCount,
        actions: actionCounts,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/page-templates', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { category } = req.query;
      const templates = await pageStorage.getActiveTemplates(category as string);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/page-templates/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const template = await pageStorage.getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: 'Page template not found' });
      }
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/page-templates', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = insertPageTemplateSchema.parse({
        ...req.body,
        createdByUserId: req.user?.id,
      });
      const template = await pageStorage.createTemplate(data);
      res.status(201).json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/page-templates/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = updatePageTemplateSchema.parse(req.body);
      const template = await pageStorage.updateTemplate(req.params.id, data);
      res.json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/page-templates/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      await pageStorage.deleteTemplate(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
