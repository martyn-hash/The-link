import type { Express } from "express";
import { storage } from "../../storage/index";
import { insertStageApprovalResponseSchema } from "@shared/schema";

export function registerProjectApprovalsRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  app.post("/api/projects/:id/stage-approval-responses", isAuthenticated, async (req, res) => {
    try {
      const projectId = req.params.id;
      const { responses } = req.body;

      if (!responses || !Array.isArray(responses)) {
        return res.status(400).json({ message: "Invalid request: responses array required" });
      }

      const validatedResponses = responses.map(response =>
        insertStageApprovalResponseSchema.parse({
          ...response,
          projectId
        })
      );

      const savedResponses = [];
      for (const response of validatedResponses) {
        const saved = await storage.upsertStageApprovalResponse(response);
        savedResponses.push(saved);
      }

      res.status(200).json({
        message: "Stage approval responses saved successfully",
        responses: savedResponses
      });
    } catch (error) {
      console.error("Error saving stage approval responses:", error);

      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({
          message: "Validation failed",
          errors: (error as any).issues
        });
      }

      res.status(500).json({ message: "Failed to save stage approval responses" });
    }
  });

  app.get("/api/projects/:projectId/field-responses", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const canView =
        effectiveUser.isAdmin ||
        project.currentAssigneeId === effectiveUserId ||
        project.clientManagerId === effectiveUserId ||
        project.bookkeeperId === effectiveUserId;

      if (!canView) {
        return res.status(403).json({ message: "Not authorized to view this project" });
      }

      const chronology = await storage.getProjectChronology(req.params.projectId);

      const chronologyWithResponses = await Promise.all(
        chronology.map(async (entry) => {
          const fieldResponses = await storage.getReasonFieldResponsesByChronologyId(entry.id);
          return {
            ...entry,
            fieldResponses
          };
        })
      );

      res.json(chronologyWithResponses);
    } catch (error) {
      console.error("Error fetching field responses for project:", error);
      res.status(500).json({ message: "Failed to fetch field responses for project" });
    }
  });
}
