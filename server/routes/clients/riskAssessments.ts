import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertRiskAssessmentSchema } from "@shared/schema";
import { userHasClientAccess } from "../routeHelpers";

export function registerRiskAssessmentRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // GET /api/clients/:clientId/risk-assessments - Get all risk assessments for a client
  app.get("/api/clients/:clientId/risk-assessments", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
      if (!hasAccess && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied. You don't have permission to access this client's risk assessments." });
      }

      const assessments = await storage.getRiskAssessmentsByClientId(clientId);
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching risk assessments:", error);
      res.status(500).json({ message: "Failed to fetch risk assessments" });
    }
  });

  // POST /api/clients/:clientId/risk-assessments - Create a new risk assessment
  app.post("/api/clients/:clientId/risk-assessments", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
      if (!hasAccess && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied. You don't have permission to create risk assessments for this client." });
      }

      const bodyValidation = insertRiskAssessmentSchema.omit({ clientId: true }).safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid risk assessment data",
          errors: bodyValidation.error.issues
        });
      }

      const newAssessment = await storage.createRiskAssessment({
        ...bodyValidation.data,
        clientId,
      });

      res.status(201).json(newAssessment);
    } catch (error) {
      console.error("Error creating risk assessment:", error);
      res.status(500).json({ message: "Failed to create risk assessment" });
    }
  });
}
