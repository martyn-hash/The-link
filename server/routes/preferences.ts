import type { Express } from "express";
import { storage } from "../storage/index";
import { insertUserColumnPreferencesSchema, insertUserProjectPreferencesSchema } from "@shared/schema";

export function registerPreferenceRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  app.get("/api/column-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const viewType = req.query.viewType as string || 'projects';
      const preferences = await storage.getUserColumnPreferences(effectiveUserId, viewType);

      res.json(preferences || null);
    } catch (error) {
      console.error("Error fetching column preferences:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch column preferences" });
    }
  });

  app.post("/api/column-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const validPreferencesData = insertUserColumnPreferencesSchema.parse({
        ...req.body,
        userId: effectiveUserId,
        viewType: req.body.viewType || 'projects',
      });

      const savedPreferences = await storage.upsertUserColumnPreferences(validPreferencesData);
      res.json(savedPreferences);
    } catch (error) {
      console.error("Error saving column preferences:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to save column preferences" });
    }
  });

  app.get("/api/companies-column-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const preferences = await storage.getUserColumnPreferences(effectiveUserId);

      res.json(preferences || null);
    } catch (error) {
      console.error("Error fetching companies column preferences:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch companies column preferences" });
    }
  });

  app.post("/api/companies-column-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const validPreferencesData = insertUserColumnPreferencesSchema.parse({
        ...req.body,
        userId: effectiveUserId,
      });

      const savedPreferences = await storage.upsertUserColumnPreferences(validPreferencesData);
      res.json(savedPreferences);
    } catch (error) {
      console.error("Error saving companies column preferences:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to save companies column preferences" });
    }
  });

  app.get("/api/project-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const preferences = await storage.getUserProjectPreferences(effectiveUserId);
      res.json(preferences || null);
    } catch (error) {
      console.error("Error fetching project preferences:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch project preferences" });
    }
  });

  app.post("/api/project-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const validPreferencesData = insertUserProjectPreferencesSchema.parse({
        ...req.body,
        userId: effectiveUserId,
      });

      const savedPreferences = await storage.upsertUserProjectPreferences(validPreferencesData);
      res.json(savedPreferences);
    } catch (error) {
      console.error("Error saving project preferences:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to save project preferences" });
    }
  });
}
