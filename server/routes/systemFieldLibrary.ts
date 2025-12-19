import type { Express, Request, Response, NextFunction } from 'express';
import { systemFieldLibraryStorage } from '../storage/system-field-library';
import {
  insertSystemFieldLibrarySchema,
  updateSystemFieldLibrarySchema,
  insertSystemFieldUsageSchema,
  copyFieldToContextSchema,
} from '@shared/schema';
import { z } from 'zod';

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

export function registerSystemFieldLibraryRoutes(
  app: Express,
  isAuthenticated: AuthMiddleware,
  resolveEffectiveUser: AuthMiddleware
): void {
  app.get('/api/system-field-library', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { category, fieldType, isArchived, search, limit, offset } = req.query;
      const fields = await systemFieldLibraryStorage.getAll({
        category: category as string,
        fieldType: fieldType as string,
        isArchived: isArchived === 'true' ? true : isArchived === 'false' ? false : undefined,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(fields);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/system-field-library/with-usage', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const fields = await systemFieldLibraryStorage.getFieldsWithUsageStats();
      res.json(fields);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/system-field-library/category/:category', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const fields = await systemFieldLibraryStorage.getByCategory(req.params.category);
      res.json(fields);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/system-field-library/type/:fieldType', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const fields = await systemFieldLibraryStorage.getByFieldType(req.params.fieldType);
      res.json(fields);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/system-field-library/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const field = await systemFieldLibraryStorage.getById(req.params.id);
      if (!field) {
        return res.status(404).json({ error: 'Field not found' });
      }
      
      const usages = await systemFieldLibraryStorage.getUsageByLibraryFieldId(field.id);
      
      res.json({
        ...field,
        usages,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/system-field-library', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = insertSystemFieldLibrarySchema.parse({
        ...req.body,
        createdBy: req.user?.id,
      });
      const field = await systemFieldLibraryStorage.create(data);
      res.status(201).json(field);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/system-field-library/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = updateSystemFieldLibrarySchema.parse(req.body);
      const field = await systemFieldLibraryStorage.update(req.params.id, data);
      res.json(field);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/system-field-library/:id/archive', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const field = await systemFieldLibraryStorage.archive(req.params.id);
      res.json(field);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/system-field-library/:id/restore', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const field = await systemFieldLibraryStorage.restore(req.params.id);
      res.json(field);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/system-field-library/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const usages = await systemFieldLibraryStorage.getUsageByLibraryFieldId(req.params.id);
      if (usages.length > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete field that is in use. Archive it instead or remove all usages first.',
          usageCount: usages.length
        });
      }
      await systemFieldLibraryStorage.delete(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/system-field-library/:id/usage', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const usages = await systemFieldLibraryStorage.getUsageByLibraryFieldId(req.params.id);
      res.json(usages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/system-field-library/:id/usage', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = insertSystemFieldUsageSchema.parse({
        ...req.body,
        libraryFieldId: req.params.id,
      });
      const usage = await systemFieldLibraryStorage.recordUsage(data);
      res.status(201).json(usage);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/system-field-library/usage/:usageId', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      await systemFieldLibraryStorage.deleteUsage(req.params.usageId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/system-field-library/copy', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = copyFieldToContextSchema.parse(req.body);
      
      const field = await systemFieldLibraryStorage.getById(data.libraryFieldId);
      if (!field) {
        return res.status(404).json({ error: 'Library field not found' });
      }
      
      const usage = await systemFieldLibraryStorage.recordUsage({
        libraryFieldId: data.libraryFieldId,
        context: data.context,
        contextEntityId: data.contextEntityId,
        contextEntityType: data.contextEntityType,
        fieldNameOverride: data.overrides?.fieldName,
        isRequiredOverride: data.overrides?.isRequired,
        optionsOverride: data.overrides?.options,
      });
      
      res.status(201).json({
        usage,
        field: {
          ...field,
          fieldName: data.overrides?.fieldName || field.fieldName,
          isRequired: data.overrides?.isRequired ?? field.isRequired,
          options: data.overrides?.options || field.options,
          placeholder: data.overrides?.placeholder || field.placeholder,
          description: data.overrides?.description || field.description,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
}
