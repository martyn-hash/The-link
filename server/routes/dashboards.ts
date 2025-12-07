import type { Express } from "express";
import { storage } from "../storage/index";
import {
  insertDashboardSchema,
  updateDashboardSchema,
} from "@shared/schema";

export function registerDashboardsRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  // ===== DASHBOARD ROUTES =====

  app.get("/api/dashboards", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const userDashboards = await storage.getDashboardsByUserId(effectiveUserId);
      const sharedDashboards = await storage.getSharedDashboards();

      // Combine user dashboards and shared dashboards
      const allDashboards = [...userDashboards, ...sharedDashboards.filter(d => d.userId !== effectiveUserId)];

      res.json(allDashboards);
    } catch (error) {
      console.error("Error fetching dashboards:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch dashboards" });
    }
  });

  app.get("/api/dashboards/homescreen", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const dashboard = await storage.getHomescreenDashboard(effectiveUserId);

      if (!dashboard) {
        return res.status(404).json({ message: "No homescreen dashboard found" });
      }

      res.json(dashboard);
    } catch (error) {
      console.error("Error fetching homescreen dashboard:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch homescreen dashboard" });
    }
  });

  app.get("/api/dashboards/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const dashboard = await storage.getDashboardById(req.params.id);

      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      // Check authorization - user can access their own dashboards or shared ones
      if (dashboard.userId !== effectiveUserId && dashboard.visibility !== 'shared') {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(dashboard);
    } catch (error) {
      console.error("Error fetching dashboard:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  app.post("/api/dashboards", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Validate and sanitize input - ensure userId comes from auth, not body
      const validDashboardData = insertDashboardSchema.parse({
        ...req.body,
        userId: effectiveUserId,
      });

      // If setting this as homescreen dashboard, clear other homescreen dashboards first
      if (validDashboardData.isHomescreenDashboard) {
        await storage.clearHomescreenDashboards(effectiveUserId);
      }

      const newDashboard = await storage.createDashboard(validDashboardData);
      res.status(201).json(newDashboard);
    } catch (error) {
      console.error("Error creating dashboard:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to create dashboard" });
    }
  });

  app.patch("/api/dashboards/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const dashboard = await storage.getDashboardById(req.params.id);

      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      // Only dashboard owner can edit (or admins for shared dashboards)
      const isAdmin = req.user?.isAdmin || req.user?.canSeeAdminMenu;
      if (dashboard.userId !== effectiveUserId && !(isAdmin && dashboard.visibility === 'shared')) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validDashboardData = updateDashboardSchema.parse(req.body);

      // If setting this as homescreen dashboard, clear other homescreen dashboards first
      if (validDashboardData.isHomescreenDashboard) {
        await storage.clearHomescreenDashboards(effectiveUserId);
      }

      const updated = await storage.updateDashboard(req.params.id, validDashboardData);

      res.json(updated);
    } catch (error) {
      console.error("Error updating dashboard:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to update dashboard" });
    }
  });

  app.delete("/api/dashboards/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const dashboard = await storage.getDashboardById(req.params.id);

      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      // Only dashboard owner can delete
      if (dashboard.userId !== effectiveUserId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteDashboard(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting dashboard:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete dashboard" });
    }
  });
}
