import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertProjectViewSchema } from "@shared/schema";
import {
  validateParams,
  paramUuidSchema,
} from "../routeHelpers";

export function registerProjectViewsRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  // ==================================================
  // PROJECT VIEWS API ROUTES
  // ==================================================

  app.get("/api/project-views", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const views = await storage.getProjectViewsByUserId(effectiveUserId);
      res.json(views);
    } catch (error) {
      console.error("Error fetching project views:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch project views" });
    }
  });

  app.post("/api/project-views", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const viewData = req.body;

      const validViewData = insertProjectViewSchema.parse({
        ...viewData,
        userId: effectiveUserId,
      });

      const newView = await storage.createProjectView(validViewData);
      res.json(newView);
    } catch (error) {
      console.error("Error creating project view:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to create project view" });
    }
  });

  app.patch("/api/project-views/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
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

      const views = await storage.getProjectViewsByUserId(effectiveUserId);
      const viewToUpdate = views.find(v => v.id === req.params.id);

      if (!viewToUpdate) {
        return res.status(404).json({ message: "Project view not found or access denied" });
      }

      const { name, filters, viewMode } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (filters !== undefined) updates.filters = filters;
      if (viewMode !== undefined) updates.viewMode = viewMode;

      const updatedView = await storage.updateProjectView(req.params.id, updates);
      res.json(updatedView);
    } catch (error) {
      console.error("Error updating project view:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to update project view" });
    }
  });

  app.delete("/api/project-views/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
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

      const views = await storage.getProjectViewsByUserId(effectiveUserId);
      const viewToDelete = views.find(v => v.id === req.params.id);

      if (!viewToDelete) {
        return res.status(404).json({ message: "Project view not found or access denied" });
      }

      await storage.deleteProjectView(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project view:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete project view" });
    }
  });
}
