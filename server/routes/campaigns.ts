import type { Express, Request, Response, NextFunction } from 'express';
import { campaignStorage, campaignTemplateStorage, campaignTargetStorage, campaignRecipientStorage, campaignMessageStorage } from '../storage/campaigns';
import {
  insertCampaignSchema,
  updateCampaignSchema,
  insertCampaignTemplateSchema,
  updateCampaignTemplateSchema,
  insertCampaignMessageSchema,
  targetCriteriaFilterSchema,
} from '@shared/schema';
import { z } from 'zod';

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

export function registerCampaignRoutes(
  app: Express,
  isAuthenticated: AuthMiddleware,
  resolveEffectiveUser: AuthMiddleware
): void {
  app.get('/api/campaigns', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { status, category, limit, offset } = req.query;
      const campaigns = await campaignStorage.getAll({
        status: status as string,
        category: category as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(campaigns);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/stats/by-status', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const stats = await campaignStorage.countByStatus();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const campaign = await campaignStorage.getById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      const [targetCriteria, messages, recipientCount] = await Promise.all([
        campaignTargetStorage.getByCampaignId(campaign.id),
        campaignMessageStorage.getByCampaignId(campaign.id),
        campaignRecipientStorage.countByCampaignId(campaign.id),
      ]);
      
      res.json({
        ...campaign,
        targetCriteria,
        messages,
        recipientCount,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = insertCampaignSchema.parse({
        ...req.body,
        createdByUserId: req.user?.id,
      });
      const campaign = await campaignStorage.create(data);
      res.status(201).json(campaign);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/campaigns/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = updateCampaignSchema.parse(req.body);
      const campaign = await campaignStorage.update(req.params.id, data);
      res.json(campaign);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/campaigns/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      await campaignStorage.delete(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/recipients', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { status, channel, limit, offset } = req.query;
      const recipients = await campaignRecipientStorage.getByCampaignId(req.params.id, {
        status: status as string,
        channel: channel as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(recipients);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/recipient-stats', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const [statusCounts, totalCount, optedOutCount] = await Promise.all([
        campaignRecipientStorage.countByStatus(req.params.id),
        campaignRecipientStorage.countByCampaignId(req.params.id),
        campaignRecipientStorage.countOptedOut(req.params.id),
      ]);
      res.json({
        total: totalCount,
        optedOut: optedOutCount,
        byStatus: statusCounts,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/target-criteria', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const criteria = z.array(targetCriteriaFilterSchema).parse(req.body);
      const result = await campaignTargetStorage.replaceAll(req.params.id, criteria);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/messages', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = insertCampaignMessageSchema.parse({
        ...req.body,
        campaignId: req.params.id,
      });
      const message = await campaignMessageStorage.create(data);
      res.status(201).json(message);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaign-templates', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { category, isActive } = req.query;
      const templates = await campaignTemplateStorage.getAll({
        category: category as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaign-templates/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const template = await campaignTemplateStorage.getById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: 'Campaign template not found' });
      }
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaign-templates', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = insertCampaignTemplateSchema.parse({
        ...req.body,
        createdByUserId: req.user?.id,
      });
      const template = await campaignTemplateStorage.create(data);
      res.status(201).json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/campaign-templates/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const data = updateCampaignTemplateSchema.parse(req.body);
      const template = await campaignTemplateStorage.update(req.params.id, data);
      res.json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/campaign-templates/:id', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      await campaignTemplateStorage.delete(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaign-templates/:id/clone', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      
      const campaignData = await campaignTemplateStorage.cloneToCampaign(req.params.id, {
        name,
        createdByUserId: req.user?.id,
      });
      
      const campaign = await campaignStorage.create(campaignData);
      res.status(201).json(campaign);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
