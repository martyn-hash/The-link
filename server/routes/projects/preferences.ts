import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertUserProjectPreferencesSchema } from "@shared/schema";

export function registerProjectPreferencesRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  // ==================================================
  // USER PROJECT PREFERENCES API ROUTES
  // ==================================================

  app.get("/api/user-project-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const preferences = await storage.getUserProjectPreferences(effectiveUserId);
      res.json(preferences || {});
    } catch (error) {
      console.error("Error fetching user project preferences:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch user project preferences" });
    }
  });

  app.post("/api/user-project-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const preferencesData = insertUserProjectPreferencesSchema.parse({
        ...req.body,
        userId: effectiveUserId,
      });

      const preferences = await storage.upsertUserProjectPreferences(preferencesData);
      res.json(preferences);
    } catch (error) {
      console.error("Error saving user project preferences:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to save user project preferences" });
    }
  });
}
