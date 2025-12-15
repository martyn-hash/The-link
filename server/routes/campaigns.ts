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
import * as targetingService from '../services/campaigns/campaignTargetingService.js';
import * as recipientService from '../services/campaigns/campaignRecipientService.js';
import * as workflowService from '../services/campaigns/campaignWorkflowService.js';
import * as deliveryService from '../services/campaigns/campaignDeliveryService.js';
import * as mergeFieldService from '../services/campaigns/mergeFieldService.js';
import * as sequenceService from '../services/campaigns/campaignSequenceService.js';
import campaignWebhooks from './campaigns/webhooks.js';

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

  app.get('/api/campaigns/:id/workflow', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const workflowState = await workflowService.getCampaignWorkflowState(req.params.id);
      res.json(workflowState);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/workflow/transition', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { newStatus, comment } = req.body;
      if (!newStatus) {
        return res.status(400).json({ error: 'newStatus is required' });
      }

      const canTransition = await workflowService.canTransition(req.params.id, newStatus);
      if (!canTransition.allowed) {
        return res.status(400).json({ error: canTransition.reason });
      }

      const campaign = await workflowService.transitionCampaignStatus(
        req.params.id,
        newStatus,
        req.user?.id
      );
      res.json(campaign);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/workflow/preview-confirm', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const campaign = await workflowService.confirmPreview(req.params.id, req.user?.id);
      res.json(campaign);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/targeting/preview', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { limit = 100, offset = 0 } = req.body;
      
      const [matchedClients, totalCount] = await Promise.all([
        targetingService.getMatchingClients(req.params.id, Math.min(limit, 100), offset),
        targetingService.getMatchingClientCount(req.params.id),
      ]);
      
      res.json({
        totalMatched: totalCount,
        preview: matchedClients.map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
        })),
        limit,
        offset,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/recipients/resolve', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const campaign = await campaignStorage.getById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const storedRules = campaign.recipientRules as { strategy: string; channels?: { email?: boolean; sms?: boolean; voice?: boolean } | string[]; roles?: string[] } || {};
      
      let channels: { email: boolean; sms: boolean; voice: boolean };
      if (Array.isArray(storedRules.channels)) {
        channels = {
          email: storedRules.channels.includes('email'),
          sms: storedRules.channels.includes('sms'),
          voice: storedRules.channels.includes('voice'),
        };
      } else if (storedRules.channels) {
        channels = {
          email: storedRules.channels.email ?? false,
          sms: storedRules.channels.sms ?? false,
          voice: storedRules.channels.voice ?? false,
        };
      } else {
        channels = { email: true, sms: false, voice: false };
      }
      
      const result = await recipientService.resolveRecipients(
        req.params.id,
        {
          strategy: (storedRules.strategy || 'primary_only') as 'primary_only' | 'all_contacts' | 'role_based',
          channels,
          roles: storedRules.roles,
        },
        campaign.category || 'informational'
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/recipients/sample', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const sample = await campaignRecipientStorage.getSample(req.params.id, 5);
      res.json(sample);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/preview-message', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const { channel, clientId, personId } = req.body;
      
      const message = await campaignMessageStorage.getForChannel(req.params.id, channel);
      if (!message) {
        return res.status(404).json({ error: 'No message found for this channel' });
      }

      const mergeData = await mergeFieldService.resolveMergeData(
        clientId,
        personId,
        req.params.id
      );

      const rendered = await mergeFieldService.renderMessageForRecipient(message, mergeData, '{{token}}');
      res.json({ rendered, mergeData });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/send', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const campaign = await campaignStorage.getById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      if (campaign.status !== 'approved' && campaign.status !== 'scheduled') {
        return res.status(400).json({ error: 'Campaign must be approved or scheduled to send' });
      }

      await workflowService.transitionCampaignStatus(req.params.id, 'sending', req.user?.id);
      await deliveryService.queueCampaignForDelivery(req.params.id);

      res.json({ message: 'Campaign queued for delivery', campaignId: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/delivery-stats', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const stats = await deliveryService.getDeliveryStats(req.params.id);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/pause', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      await deliveryService.pauseCampaignDelivery(req.params.id);
      res.json({ message: 'Campaign paused' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/resume', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      await deliveryService.resumeCampaignDelivery(req.params.id);
      res.json({ message: 'Campaign resumed' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaign-targeting/available-filters', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const filters = targetingService.getAvailableFilters();
      res.json(filters);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaign-targeting/filter-options/:filterType', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const options = await targetingService.getFilterOptions(req.params.filterType);
      res.json(options);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/merge-fields', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const fields = mergeFieldService.getAvailableMergeFields();
      res.json(fields);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/sequence', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const campaign = await campaignStorage.getById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const sequenceCondition = campaign.sequenceCondition as any || null;
      const isSequenceCampaign = campaign.isSequence === true;

      res.json({
        isSequence: isSequenceCampaign,
        parentCampaignId: campaign.parentCampaignId,
        sequenceOrder: campaign.sequenceOrder,
        sequenceCondition,
        status: campaign.status,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/sequence/steps', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const campaign = await campaignStorage.getById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      if (campaign.isSequence !== true) {
        return res.status(400).json({ error: 'This campaign is not a sequence' });
      }

      const parentId = campaign.parentCampaignId || campaign.id;
      const steps = await campaignStorage.getSequenceSteps(parentId);
      
      res.json({
        parentCampaignId: parentId,
        steps: steps.map((step: any) => ({
          id: step.id,
          name: step.name,
          sequenceOrder: step.sequenceOrder,
          status: step.status,
          sequenceCondition: step.sequenceCondition,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/campaigns/:id/sequence/process', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const campaign = await campaignStorage.getById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      const parentId = campaign.parentCampaignId || campaign.id;
      const parentCampaign = campaign.parentCampaignId 
        ? await campaignStorage.getById(parentId)
        : campaign;
      
      if (!parentCampaign?.isSequence) {
        return res.status(400).json({ error: 'Campaign is not part of a sequence' });
      }
      
      const result = await sequenceService.processSingleSequence(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/analytics', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const analyticsService = await import('../services/campaigns/campaignAnalyticsService.js');
      const analytics = await analyticsService.getCampaignAnalytics(req.params.id);
      res.json(analytics);
    } catch (error: any) {
      if (error.message === 'Campaign not found') {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/:id/sequence/analytics', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const campaign = await campaignStorage.getById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      if (!campaign.isSequence) {
        return res.status(400).json({ error: 'Campaign is not a sequence' });
      }
      
      const parentId = campaign.parentCampaignId || campaign.id;
      const analyticsService = await import('../services/campaigns/campaignAnalyticsService.js');
      const analytics = await analyticsService.getSequenceAnalytics(parentId);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/campaigns/analytics/overview', isAuthenticated, resolveEffectiveUser, async (_req: any, res) => {
    try {
      const analyticsService = await import('../services/campaigns/campaignAnalyticsService.js');
      const stats = await analyticsService.getCampaignOverviewStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/client-engagement/:clientId', isAuthenticated, resolveEffectiveUser, async (req: any, res) => {
    try {
      const engagementService = await import('../services/campaigns/engagementScoreService.js');
      const score = await engagementService.getClientEngagementScore(req.params.clientId);
      res.json(score);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.use('/api/public/webhooks/campaigns', campaignWebhooks);
}
