import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage/index";
import { updateRiskAssessmentSchema, insertRiskAssessmentResponseSchema } from "@shared/schema";

export function registerRiskAssessmentRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  app.get("/api/risk-assessments/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const assessment = await storage.getRiskAssessmentById(id);
      if (!assessment) {
        return res.status(404).json({ message: "Risk assessment not found" });
      }

      const responses = await storage.getRiskAssessmentResponses(id);
      res.json({ ...assessment, responses });
    } catch (error) {
      console.error("Error fetching risk assessment:", error);
      res.status(500).json({ message: "Failed to fetch risk assessment" });
    }
  });

  app.patch("/api/risk-assessments/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const existingAssessment = await storage.getRiskAssessmentById(id);
      if (!existingAssessment) {
        return res.status(404).json({ message: "Risk assessment not found" });
      }

      const bodyValidation = updateRiskAssessmentSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid risk assessment data",
          errors: bodyValidation.error.issues
        });
      }

      const updatedAssessment = await storage.updateRiskAssessment(id, bodyValidation.data);
      res.json(updatedAssessment);
    } catch (error) {
      console.error("Error updating risk assessment:", error);
      res.status(500).json({ message: "Failed to update risk assessment" });
    }
  });

  app.delete("/api/risk-assessments/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const existingAssessment = await storage.getRiskAssessmentById(id);
      if (!existingAssessment) {
        return res.status(404).json({ message: "Risk assessment not found" });
      }

      await storage.deleteRiskAssessment(id);
      res.json({ message: "Risk assessment deleted successfully" });
    } catch (error) {
      console.error("Error deleting risk assessment:", error);
      res.status(500).json({ message: "Failed to delete risk assessment" });
    }
  });

  app.post("/api/risk-assessments/:id/responses", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const existingAssessment = await storage.getRiskAssessmentById(id);
      if (!existingAssessment) {
        return res.status(404).json({ message: "Risk assessment not found" });
      }

      const responsesValidation = z.array(insertRiskAssessmentResponseSchema.omit({ riskAssessmentId: true })).safeParse(req.body.responses);
      if (!responsesValidation.success) {
        return res.status(400).json({
          message: "Invalid responses data",
          errors: responsesValidation.error.issues
        });
      }

      const responsesWithAssessmentId = responsesValidation.data.map(response => ({
        ...response,
        riskAssessmentId: id,
      }));

      await storage.saveRiskAssessmentResponses(id, responsesWithAssessmentId);
      res.json({ message: "Responses saved successfully" });
    } catch (error) {
      console.error("Error saving risk assessment responses:", error);
      res.status(500).json({ message: "Failed to save risk assessment responses" });
    }
  });
}
