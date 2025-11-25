import type { Express } from "express";
import { storage } from "../../storage/index";
import { userHasClientAccess } from "../routeHelpers";

export function registerPortalUserRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // GET /api/clients/:clientId/portal-users - Get portal users for a client
  app.get("/api/clients/:clientId/portal-users", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
      if (!hasAccess && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const portalUsers = await storage.getClientPortalUsersByClientId(clientId);
      res.json(portalUsers);
    } catch (error) {
      console.error("Error fetching portal users:", error);
      res.status(500).json({ message: "Failed to fetch portal users" });
    }
  });

  // POST /api/clients/:clientId/portal-users - Create portal user for a client
  app.post("/api/clients/:clientId/portal-users", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      const { email, name } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      if (!email || !name) {
        return res.status(400).json({ message: "Email and name are required" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
      if (!hasAccess && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const existing = await storage.getClientPortalUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already in use" });
      }

      const portalUser = await storage.createClientPortalUser({
        email,
        name,
        clientId
      });

      res.status(201).json(portalUser);
    } catch (error) {
      console.error("Error creating portal user:", error);
      res.status(500).json({ message: "Failed to create portal user" });
    }
  });

  // PUT /api/portal-users/:portalUserId - Update portal user
  app.put("/api/portal-users/:portalUserId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { portalUserId } = req.params;
      const { name } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const portalUser = await storage.getClientPortalUserById(portalUserId);
      if (!portalUser) {
        return res.status(404).json({ message: "Portal user not found" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, portalUser.clientId);
      if (!hasAccess && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updated = await storage.updateClientPortalUser(portalUserId, { name });
      res.json(updated);
    } catch (error) {
      console.error("Error updating portal user:", error);
      res.status(500).json({ message: "Failed to update portal user" });
    }
  });

  // DELETE /api/portal-users/:portalUserId - Delete portal user
  app.delete("/api/portal-users/:portalUserId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { portalUserId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const portalUser = await storage.getClientPortalUserById(portalUserId);
      if (!portalUser) {
        return res.status(404).json({ message: "Portal user not found" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, portalUser.clientId);
      if (!hasAccess && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteClientPortalUser(portalUserId);
      res.json({ message: "Portal user deleted successfully" });
    } catch (error) {
      console.error("Error deleting portal user:", error);
      res.status(500).json({ message: "Failed to delete portal user" });
    }
  });
}
