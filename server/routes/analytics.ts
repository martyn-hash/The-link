import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage/index";
import { analyticsQuerySchema } from "./routeHelpers";

export function registerAnalyticsRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  // ===== DASHBOARD DATA ROUTES =====

  // GET /api/dashboard - Get personalized dashboard data (homescreen - lightweight version for Recently Viewed only)
  app.get("/api/dashboard", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Get recent clients, people, and projects using actual recently viewed data
      const recentlyViewed = await storage.getRecentlyViewedByUser(effectiveUserId, 30);

      const recentClientViews = recentlyViewed.filter(item => item.entityType === 'client' && item.entityData);
      const recentClients = recentClientViews.slice(0, 10).map(item => ({
        ...item.entityData,
        activeProjects: 0,
        lastViewed: item.viewedAt
      }));

      const recentPeopleViews = recentlyViewed.filter(item => item.entityType === 'person' && item.entityData);
      const recentPeople = recentPeopleViews.slice(0, 10).map(item => ({
        ...item.entityData,
        lastViewed: item.viewedAt
      }));

      const recentProjectViews = recentlyViewed.filter(item => item.entityType === 'project' && item.entityData);
      const recentProjects = recentProjectViews.slice(0, 10).map(item => ({
        ...item.entityData,
        lastViewed: item.viewedAt
      }));

      const dashboardData = {
        myActiveTasks: [],
        myProjects: [],
        overdueProjects: [],
        behindScheduleProjects: [],
        recentClients: recentClients,
        recentPeople: recentPeople,
        recentProjects: recentProjects,
        projectsByType: {},
        deadlineAlerts: [],
        stuckProjects: [],
        upcomingRenewals: []
      };

      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // GET /api/dashboard/my-owned-projects - Projects where user is the service owner
  app.get("/api/dashboard/my-owned-projects", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Query projects where user is the project owner (service owner)
      const myProjects = await storage.getAllProjects({
        serviceOwnerId: effectiveUserId,
        archived: false
      });

      // Filter out inactive and completed projects
      const activeProjects = myProjects.filter(p => !p.inactive && p.currentStatus !== "completed");

      res.json(activeProjects);
    } catch (error) {
      console.error("Error fetching my owned projects:", error);
      res.status(500).json({ message: "Failed to fetch my owned projects" });
    }
  });

  // GET /api/dashboard/my-assigned-tasks - Projects where user is the current assignee
  app.get("/api/dashboard/my-assigned-tasks", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Query projects where user is the current assignee
      const myTasks = await storage.getAllProjects({
        assigneeId: effectiveUserId,
        archived: false
      });

      // Filter out inactive and completed projects
      const activeTasks = myTasks.filter(p => !p.inactive && p.currentStatus !== "completed");

      res.json(activeTasks);
    } catch (error) {
      console.error("Error fetching my assigned tasks:", error);
      res.status(500).json({ message: "Failed to fetch my assigned tasks" });
    }
  });

  // GET /api/dashboard/attention-needed - Overdue and behind schedule projects for user
  app.get("/api/dashboard/attention-needed", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Get all projects where user is involved (owner or assignee)
      const [ownedProjects, assignedProjects] = await Promise.all([
        storage.getAllProjects({ serviceOwnerId: effectiveUserId, archived: false }),
        storage.getAllProjects({ assigneeId: effectiveUserId, archived: false })
      ]);

      // Combine and deduplicate projects
      const allUserProjects = Array.from(
        new Map([...ownedProjects, ...assignedProjects].map(p => [p.id, p])).values()
      );

      // Filter for active projects only
      const activeProjects = allUserProjects.filter(p => !p.inactive && p.currentStatus !== "completed");

      const now = new Date();

      // Find overdue projects (due date in the past)
      const overdueProjects = activeProjects.filter(project => {
        if (!project.dueDate) return false;
        return new Date(project.dueDate) < now;
      });

      // Find behind schedule projects (stuck in current stage for >7 days)
      const behindScheduleProjects = activeProjects.filter(project => {
        const lastChronology = project.chronology?.[0];
        if (!lastChronology || !lastChronology.timestamp) return false;

        const timeInCurrentStageMs = Date.now() - new Date(lastChronology.timestamp).getTime();
        const timeInCurrentStageDays = timeInCurrentStageMs / (1000 * 60 * 60 * 24);

        return timeInCurrentStageDays > 7;
      });

      // Combine and deduplicate (a project can be both overdue AND behind schedule)
      const attentionNeeded = Array.from(
        new Map([...overdueProjects, ...behindScheduleProjects].map(p => [p.id, p])).values()
      );

      res.json({
        overdueProjects,
        behindScheduleProjects,
        attentionNeeded
      });
    } catch (error) {
      console.error("Error fetching attention needed projects:", error);
      res.status(500).json({ message: "Failed to fetch attention needed projects" });
    }
  });

  // ===== ANALYTICS ROUTES =====

  app.post("/api/analytics", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Validate request body
      const validatedQuery = analyticsQuerySchema.parse(req.body);
      const { filters, groupBy, metric } = validatedQuery;

      const analyticsData = await storage.getProjectAnalytics(filters || {}, groupBy, metric);

      res.json({
        series: analyticsData,
        meta: {
          groupBy,
          metric,
          filters,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid request parameters",
          errors: error.errors
        });
      }
      console.error("Error fetching analytics:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });
}
