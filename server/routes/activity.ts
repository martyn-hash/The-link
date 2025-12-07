import type { Express } from "express";
import { storage } from "../storage/index";

export function registerActivityRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  app.post("/api/track-activity", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const { entityType, entityId } = req.body;

      if (!entityType || !entityId) {
        return res.status(400).json({ message: "entityType and entityId are required" });
      }

      const validEntityTypes = ['client', 'project', 'person', 'communication'];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({ message: "Invalid entityType. Must be one of: " + validEntityTypes.join(', ') });
      }

      await storage.trackUserActivity(effectiveUserId, entityType, entityId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking user activity:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to track activity" });
    }
  });
}
