import type { Express } from "express";
import { storage } from "../storage/index";

export function registerSystemRoutes(
  app: Express,
  isAuthenticated: any
) {
  // ===== HEALTH CHECK ENDPOINT (Public - No Auth Required) =====
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  // ===== FEATURE FLAGS ENDPOINT (Authenticated - Any User) =====
  app.get('/api/feature-flags', isAuthenticated, async (req: any, res: any) => {
    try {
      const settings = await storage.getCompanySettings();
      
      res.json({
        ringCentralLive: settings?.ringCentralLive ?? false,
        appIsLive: settings?.appIsLive ?? false,
        aiButtonEnabled: settings?.aiButtonEnabled ?? false,
      });
    } catch (error) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ message: "Failed to fetch feature flags" });
    }
  });
}
