import type { Express } from "express";
import { storage } from "../../storage/index";
import { benchProjectSchema, unbenchProjectSchema } from "@shared/schema";

export function registerProjectBenchRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  app.post("/api/projects/:id/bench", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!effectiveUser.canBenchProjects && !effectiveUser.superAdmin && !effectiveUser.isAdmin) {
        return res.status(403).json({ message: "You do not have permission to bench projects" });
      }

      const { benchReason, benchReasonOtherText } = benchProjectSchema.parse(req.body);

      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (project.isBenched) {
        return res.status(400).json({ message: "Project is already on the bench" });
      }

      if (project.completionStatus || project.inactive) {
        return res.status(400).json({ message: "Cannot bench a completed or inactive project" });
      }

      const preBenchStatus = project.currentStatus;

      const updatedProject = await storage.updateProject(req.params.id, {
        isBenched: true,
        benchedAt: new Date(),
        benchedByUserId: effectiveUserId,
        benchReason: benchReason as any,
        benchReasonOtherText: benchReasonOtherText || null,
        preBenchStatus: preBenchStatus,
        currentStatus: 'On The Bench',
      });

      const benchReasonLabel = benchReason === 'legacy_work' ? 'Legacy Work' 
        : benchReason === 'missing_data' ? 'Missing Data' 
        : 'Other';
      
      await storage.createChronologyEntry({
        projectId: req.params.id,
        entryType: 'benched',
        fromStatus: preBenchStatus,
        toStatus: 'On The Bench',
        assigneeId: project.currentAssigneeId,
        changedById: effectiveUserId,
        changeReason: `Moved to Bench - ${benchReasonLabel}`,
        notes: benchReasonOtherText || `Project moved to bench. Reason: ${benchReasonLabel}`,
      });

      res.json(updatedProject);
    } catch (error) {
      console.error("Error benching project:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message && error.message.includes("not found")) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to bench project" });
      }
    }
  });

  app.post("/api/projects/:id/unbench", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!effectiveUser.canBenchProjects && !effectiveUser.superAdmin && !effectiveUser.isAdmin) {
        return res.status(403).json({ message: "You do not have permission to unbench projects" });
      }

      const { notes } = unbenchProjectSchema.parse(req.body);

      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!project.isBenched) {
        return res.status(400).json({ message: "Project is not on the bench" });
      }

      const restoredStatus = project.preBenchStatus || 'No Latest Action';

      const updatedProject = await storage.updateProject(req.params.id, {
        isBenched: false,
        benchedAt: null,
        benchedByUserId: null,
        benchReason: null,
        benchReasonOtherText: null,
        preBenchStatus: null,
        currentStatus: restoredStatus,
      });

      await storage.createChronologyEntry({
        projectId: req.params.id,
        entryType: 'unbenched',
        fromStatus: 'On The Bench',
        toStatus: restoredStatus,
        assigneeId: project.currentAssigneeId,
        changedById: effectiveUserId,
        changeReason: 'Removed from Bench',
        notes: notes || `Project removed from bench. Returned to stage: ${restoredStatus}`,
      });

      res.json(updatedProject);
    } catch (error) {
      console.error("Error unbenching project:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message && error.message.includes("not found")) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to unbench project" });
      }
    }
  });
}
