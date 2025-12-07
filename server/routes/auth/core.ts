import type { Express } from "express";
import { storage } from "../../storage/index";
import { validateParams, paramUserIdSchema } from "../routeHelpers";

export function registerAuthCoreRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any
) {
  // ===== AUTH ROUTES =====

  // Get current user (with impersonation support)
  app.get('/api/auth/user', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const originalUserId = req.user!.id;
      const effectiveUser = req.user!.effectiveUser;

      if (!effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Strip password hash from response for security, but indicate if user has password authentication
      const { passwordHash, ...sanitizedUser } = effectiveUser;
      const userWithPasswordStatus = {
        ...sanitizedUser,
        hasPassword: !!passwordHash
      };

      // Include impersonation metadata if admin is impersonating
      if (req.user!.isImpersonating) {
        const impersonationState = await storage.getImpersonationState(originalUserId);
        return res.json({
          ...userWithPasswordStatus,
          _impersonationState: impersonationState
        });
      }

      res.json(userWithPasswordStatus);
    } catch (error) {
      console.error("Error fetching user:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User impersonation routes (admin only)
  app.post("/api/auth/impersonate/:userId", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUserIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const adminUserId = req.user!.id;
      const targetUserId = req.params.userId;

      await storage.startImpersonation(adminUserId, targetUserId);
      res.json({ message: "Impersonation started successfully" });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      res.status(400).json({ message: (error instanceof Error ? error.message : String(error)) || "Failed to start impersonation" });
    }
  });

  app.delete("/api/auth/impersonate", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const adminUserId = req.user!.id;
      await storage.stopImpersonation(adminUserId);
      res.status(204).send();
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(400).json({ message: "Failed to stop impersonation" });
    }
  });

  app.get("/api/auth/impersonation-state", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const adminUserId = req.user!.id;
      const state = await storage.getImpersonationState(adminUserId);
      res.json(state);
    } catch (error) {
      console.error("Error getting impersonation state:", error);
      res.status(500).json({ message: "Failed to get impersonation state" });
    }
  });
}
