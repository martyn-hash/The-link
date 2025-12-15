import { Router, type Request, type Response } from 'express';
import { renderPageForRecipient, getPagePreview, createVisitToken } from '../../services/pages/pageRenderingService.js';
import { executePageAction } from '../../services/pages/pageActionService.js';
import { sendPageOtp, verifyPageOtp } from '../../services/pages/pageOtpService.js';
import { pageStorage, pageVisitStorage } from '../../storage/pages/index.js';
import { z } from 'zod';

const router = Router();

router.get('/p/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { t } = req.query;

    const page = await pageStorage.getBySlug(slug);
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    if (!page.isPublished) {
      return res.status(404).json({ error: 'Page not available' });
    }

    if (page.expiresAt && new Date(page.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'This page has expired' });
    }

    if (!t || typeof t !== 'string') {
      return res.status(400).json({ error: 'Missing visit token' });
    }

    const visit = await pageVisitStorage.getByToken(t);
    if (!visit) {
      return res.status(400).json({ error: 'Invalid visit token' });
    }

    const renderedPage = await renderPageForRecipient(slug, t);
    if (!renderedPage) {
      return res.status(500).json({ error: 'Failed to render page' });
    }

    res.json(renderedPage);
  } catch (error: any) {
    console.error('[PublicPages] Error rendering page:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/p/:slug/preview', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { clientId, personId } = req.query;

    const page = await pageStorage.getBySlug(slug);
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const renderedPage = await getPagePreview(
      page.id,
      clientId as string | undefined,
      personId as string | undefined
    );

    if (!renderedPage) {
      return res.status(500).json({ error: 'Failed to render preview' });
    }

    res.json(renderedPage);
  } catch (error: any) {
    console.error('[PublicPages] Error rendering preview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const actionSchema = z.object({
  actionId: z.string().min(1),
  visitToken: z.string().min(1),
  actionData: z.any().optional(),
});

router.post('/p/:slug/action', async (req: Request, res: Response) => {
  try {
    const validation = actionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request', details: validation.error.errors });
    }

    const { actionId, visitToken, actionData } = validation.data;

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                      req.socket.remoteAddress || 
                      undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const result = await executePageAction(
      actionId,
      visitToken,
      actionData,
      ipAddress,
      userAgent
    );

    res.json(result);
  } catch (error: any) {
    console.error('[PublicPages] Error executing action:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/p/:slug/otp/send', async (req: Request, res: Response) => {
  try {
    const { visitToken } = req.body;

    if (!visitToken || typeof visitToken !== 'string') {
      return res.status(400).json({ sent: false, error: 'Missing visit token' });
    }

    const result = await sendPageOtp(visitToken);
    res.json(result);
  } catch (error: any) {
    console.error('[PublicPages] Error sending OTP:', error);
    res.status(500).json({ sent: false, error: 'Failed to send verification code' });
  }
});

router.post('/p/:slug/otp/verify', async (req: Request, res: Response) => {
  try {
    const { visitToken, code } = req.body;

    if (!visitToken || typeof visitToken !== 'string') {
      return res.status(400).json({ valid: false, error: 'Missing visit token' });
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, error: 'Missing verification code' });
    }

    const result = await verifyPageOtp(visitToken, code);
    res.json(result);
  } catch (error: any) {
    console.error('[PublicPages] Error verifying OTP:', error);
    res.status(500).json({ valid: false, error: 'Failed to verify code' });
  }
});

router.get('/p/:slug/info', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const page = await pageStorage.getBySlug(slug);
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({
      id: page.id,
      name: page.name,
      slug: page.slug,
      isPublished: page.isPublished,
      expiresAt: page.expiresAt,
      requiresOtp: page.requiresOtp,
      headerTitle: page.headerTitle,
      themeColor: page.themeColor,
    });
  } catch (error: any) {
    console.error('[PublicPages] Error getting page info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
