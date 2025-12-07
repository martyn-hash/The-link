import type { Express } from "express";
import { storage } from "../storage/index";
import { insertCompanyViewSchema } from "@shared/schema";
import { paramUuidSchema, validateParams } from "./routeHelpers";

export function registerViewRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  app.get("/api/company-views", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const views = await storage.getCompanyViewsByUserId(effectiveUserId);
      res.json(views);
    } catch (error) {
      console.error("Error fetching company views:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch company views" });
    }
  });

  app.post("/api/company-views", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const viewData = req.body;

      const validViewData = insertCompanyViewSchema.parse({
        ...viewData,
        userId: effectiveUserId,
      });

      const newView = await storage.createCompanyView(validViewData);
      res.json(newView);
    } catch (error) {
      console.error("Error creating company view:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to create company view" });
    }
  });

  app.delete("/api/company-views/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const views = await storage.getCompanyViewsByUserId(effectiveUserId);
      const viewToDelete = views.find(v => v.id === req.params.id);

      if (!viewToDelete) {
        return res.status(404).json({ message: "Company view not found or access denied" });
      }

      await storage.deleteCompanyView(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting company view:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete company view" });
    }
  });
}
