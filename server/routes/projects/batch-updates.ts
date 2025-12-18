import type { Express } from "express";
import { storage } from "../../storage/index";
import { markAllViewsStale } from "../../view-cache-service";

export function registerProjectBatchUpdatesRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  app.get("/api/projects/batch-update/due-dates/:projectTypeId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { projectTypeId } = req.params;
      
      if (!projectTypeId) {
        return res.status(400).json({ message: "Project type ID is required" });
      }

      const projectType = await storage.getProjectTypeById(projectTypeId);
      if (!projectType) {
        return res.status(404).json({ message: "Project type not found" });
      }

      const allProjects = await storage.getAllProjects();
      const projectsOfType = allProjects.filter(p => 
        p.projectTypeId === projectTypeId && 
        !p.archived && 
        !p.inactive &&
        p.dueDate
      );

      const dueDateCounts = new Map<string, number>();
      for (const project of projectsOfType) {
        if (project.dueDate) {
          const dateKey = new Date(project.dueDate).toISOString().split('T')[0];
          dueDateCounts.set(dateKey, (dueDateCounts.get(dateKey) || 0) + 1);
        }
      }

      const distinctDueDates = Array.from(dueDateCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      res.json({
        projectTypeId,
        totalProjects: projectsOfType.length,
        distinctDueDates
      });
    } catch (error) {
      console.error("Error fetching distinct due dates:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch distinct due dates" });
    }
  });

  app.post("/api/projects/batch-update/due-dates", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { projectTypeId, currentDueDate, newDueDate } = req.body;

      if (!projectTypeId || !currentDueDate || !newDueDate) {
        return res.status(400).json({ 
          message: "projectTypeId, currentDueDate, and newDueDate are required" 
        });
      }

      const projectType = await storage.getProjectTypeById(projectTypeId);
      if (!projectType) {
        return res.status(404).json({ message: "Project type not found" });
      }

      const parsedCurrentDate = new Date(currentDueDate);
      const parsedNewDate = new Date(newDueDate);
      
      if (isNaN(parsedCurrentDate.getTime()) || isNaN(parsedNewDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const currentDateStart = new Date(currentDueDate);
      currentDateStart.setUTCHours(0, 0, 0, 0);
      const currentDateEnd = new Date(currentDueDate);
      currentDateEnd.setUTCHours(23, 59, 59, 999);

      const allProjects = await storage.getAllProjects();
      const matchingProjects = allProjects.filter(p => {
        if (p.projectTypeId !== projectTypeId || p.archived || p.inactive || !p.dueDate) {
          return false;
        }
        const projectDueDate = new Date(p.dueDate);
        return projectDueDate >= currentDateStart && projectDueDate <= currentDateEnd;
      });

      if (matchingProjects.length === 0) {
        return res.status(404).json({ 
          message: "No projects found matching the criteria" 
        });
      }

      let updatedCount = 0;
      const errors: string[] = [];

      for (const project of matchingProjects) {
        try {
          await storage.updateProject(project.id, { 
            dueDate: parsedNewDate 
          });
          updatedCount++;
        } catch (err) {
          errors.push(`Failed to update project ${project.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      console.log(`[API] Batch updated ${updatedCount} project due dates from ${currentDueDate} to ${newDueDate} for project type ${projectTypeId}`);

      if (updatedCount > 0) {
        setImmediate(async () => {
          try {
            await markAllViewsStale();
          } catch (cacheError) {
            console.error("[View Cache] Error invalidating caches:", cacheError);
          }
        });
      }

      res.json({
        success: true,
        updatedCount,
        totalMatched: matchingProjects.length,
        projectTypeId,
        currentDueDate,
        newDueDate,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Error batch updating due dates:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to batch update due dates" });
    }
  });
}
