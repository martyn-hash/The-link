import type { Express } from "express";
import { storage } from "../../storage/index";
import { db } from "../../db";
import { dashboardCache } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerProjectDashboardRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  app.get("/api/dashboard/metrics", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const allProjects = (await storage.getProjectsByUser(effectiveUserId, effectiveUser.isAdmin ? 'admin' : 'user')).filter(p => !p.archived);

      const myProjects = allProjects.filter(p => p.projectOwnerId === effectiveUserId);

      const myTasks = allProjects.filter(p => p.currentAssigneeId === effectiveUserId);

      const myRelevantProjects = allProjects.filter(p => 
        p.projectOwnerId === effectiveUserId || p.currentAssigneeId === effectiveUserId
      );

      const uniqueProjectTypeIds = Array.from(new Set(myRelevantProjects.map(p => p.projectTypeId)));
      const stagesByProjectType = new Map<string, any[]>();
      
      await Promise.all(
        uniqueProjectTypeIds.map(async (projectTypeId) => {
          const stages = await storage.getKanbanStagesByProjectTypeId(projectTypeId);
          stagesByProjectType.set(projectTypeId, stages);
        })
      );

      let behindScheduleCount = 0;
      for (const project of myRelevantProjects) {
        const stages = stagesByProjectType.get(project.projectTypeId) || [];
        const currentStageConfig = stages.find(s => s.name === project.currentStatus);
        
        if (currentStageConfig?.maxInstanceTime && currentStageConfig.maxInstanceTime > 0) {
          const chronology = project.chronology || [];
          const sortedChronology = [...chronology].sort((a, b) => 
            new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          );
          
          const lastEntry = sortedChronology.find(entry => entry.toStatus === project.currentStatus);
          const startTime = lastEntry?.timestamp || project.createdAt;
          
          if (startTime) {
            const { calculateBusinessHours } = await import("@shared/businessTime");
            const currentHours = calculateBusinessHours(
              typeof startTime === 'string' ? startTime : new Date(startTime).toISOString(),
              new Date().toISOString()
            );
            
            if (currentHours >= currentStageConfig.maxInstanceTime) {
              behindScheduleCount++;
            }
          }
        }
      }

      const now = new Date();
      const lateCount = myRelevantProjects.filter(p => {
        if (!p.dueDate) return false;
        const dueDate = new Date(p.dueDate);
        return now > dueDate;
      }).length;

      res.json({
        myProjectsCount: myProjects.length,
        myTasksCount: myTasks.length,
        behindScheduleCount,
        lateCount
      });
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get("/api/dashboard/my-projects", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const allProjects = (await storage.getProjectsByUser(effectiveUserId, effectiveUser.isAdmin ? 'admin' : 'user')).filter(p => !p.archived);
      const myProjects = allProjects.filter(p => p.projectOwnerId === effectiveUserId);

      res.json(myProjects);
    } catch (error) {
      console.error("Error fetching my projects:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch my projects" });
    }
  });

  app.get("/api/dashboard/my-tasks", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const allProjects = (await storage.getProjectsByUser(effectiveUserId, effectiveUser.isAdmin ? 'admin' : 'user')).filter(p => !p.archived);
      const myTasks = allProjects.filter(p => p.currentAssigneeId === effectiveUserId);

      res.json(myTasks);
    } catch (error) {
      console.error("Error fetching my tasks:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch my tasks" });
    }
  });

  app.get("/api/dashboard/cache", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;

      if (!effectiveUserId) {
        return res.status(404).json({ message: "User not found" });
      }

      const cacheData = await db.select().from(dashboardCache).where(eq(dashboardCache.userId, effectiveUserId));

      if (cacheData.length === 0) {
        const { updateDashboardCache } = await import("../../dashboard-cache-service");
        await updateDashboardCache(effectiveUserId);
        
        const newCacheData = await db.select().from(dashboardCache).where(eq(dashboardCache.userId, effectiveUserId));
        return res.json(newCacheData[0] || {
          myTasksCount: 0,
          myProjectsCount: 0,
          overdueTasksCount: 0,
          behindScheduleCount: 0,
          lastUpdated: new Date(),
        });
      }

      res.json(cacheData[0]);
    } catch (error) {
      console.error("Error fetching dashboard cache:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch dashboard cache" });
    }
  });

  app.post("/api/dashboard/cache/refresh", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;

      if (!effectiveUserId) {
        return res.status(404).json({ message: "User not found" });
      }

      const { updateDashboardCache } = await import("../../dashboard-cache-service");
      const result = await updateDashboardCache(effectiveUserId);

      if (result.status === 'error') {
        return res.status(500).json({ 
          message: "Failed to refresh dashboard cache",
          errors: result.errors 
        });
      }

      const cacheData = await db.select().from(dashboardCache).where(eq(dashboardCache.userId, effectiveUserId));

      res.json({
        success: true,
        cache: cacheData[0],
        message: "Dashboard cache refreshed successfully"
      });
    } catch (error) {
      console.error("Error refreshing dashboard cache:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to refresh dashboard cache" });
    }
  });
}
