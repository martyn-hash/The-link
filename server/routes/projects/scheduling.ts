import type { Express } from "express";
import { storage } from "../../storage/index";
import {
  runProjectSchedulingEnhanced,
  getOverdueServicesAnalysis,
  seedTestServices,
  resetTestData,
  buildSchedulingPreview,
} from "../../project-scheduler";

export function registerProjectSchedulingRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  app.get("/api/scheduled-services", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const scheduledServices = await storage.getScheduledServices();
      res.json(scheduledServices);
    } catch (error) {
      console.error("Error fetching scheduled services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch scheduled services" });
    }
  });

  app.post("/api/project-scheduling/run", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Enhanced project scheduling triggered by admin: ${req.user?.email}`);

      const {
        targetDate,
        serviceIds,
        clientIds,
        startDate,
        endDate
      } = req.body || {};

      let schedulingDate = new Date();
      if (targetDate) {
        schedulingDate = new Date(targetDate);
        console.log(`[API] Using custom target date: ${schedulingDate.toISOString()}`);
      }

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        console.log(`[API] Running scheduling for date range: ${start.toISOString()} to ${end.toISOString()}`);

        const results = [];
        const currentDate = new Date(start);

        while (currentDate <= end) {
          console.log(`[API] Processing date: ${currentDate.toISOString().split('T')[0]}`);
          const result = await runProjectSchedulingEnhanced('manual', new Date(currentDate), { serviceIds, clientIds });
          results.push({
            date: currentDate.toISOString().split('T')[0],
            ...result
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }

        const totalProjectsCreated = results.reduce((sum, r) => sum + r.projectsCreated, 0);
        const totalServicesRescheduled = results.reduce((sum, r) => sum + r.servicesRescheduled, 0);
        const totalErrors = results.reduce((sum, r) => sum + r.errorsEncountered, 0);

        res.json({
          message: "Date range project scheduling completed",
          status: totalErrors > 0 ? "partial_failure" : "success",
          dateRange: { startDate, endDate },
          totalProjectsCreated,
          totalServicesRescheduled,
          totalErrorsEncountered: totalErrors,
          dailyResults: results,
          summary: `Processed ${results.length} days from ${startDate} to ${endDate}`
        });
      } else {
        const result = await runProjectSchedulingEnhanced('manual', schedulingDate, { serviceIds, clientIds });

        res.json({
          message: "Project scheduling completed",
          status: result.status,
          projectsCreated: result.projectsCreated,
          servicesRescheduled: result.servicesRescheduled,
          errorsEncountered: result.errorsEncountered,
          errors: result.errors,
          summary: result.summary,
          executionTimeMs: result.executionTimeMs,
          filters: { serviceIds, clientIds, targetDate: targetDate || 'current' }
        });
      }
    } catch (error) {
      console.error("Error running project scheduling:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to run project scheduling",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/project-scheduling/preview", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Scheduling preview triggered by admin: ${req.user?.email}`);

      const {
        targetDate,
        serviceIds,
        clientIds
      } = req.body || {};

      let schedulingDate = new Date();
      if (targetDate) {
        schedulingDate = new Date(targetDate);
        console.log(`[API] Using custom target date for preview: ${schedulingDate.toISOString()}`);
      }

      const result = await buildSchedulingPreview(schedulingDate, { serviceIds, clientIds });

      res.json({
        message: "Scheduling preview completed",
        status: result.status,
        targetDate: result.targetDate,
        totalServicesChecked: result.totalServicesChecked,
        servicesFoundDue: result.servicesFoundDue,
        previewItems: result.previewItems,
        configurationErrors: result.configurationErrors,
        summary: result.summary,
        filters: { serviceIds, clientIds, targetDate: targetDate || 'current' }
      });
    } catch (error) {
      console.error("Error building scheduling preview:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to build scheduling preview",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/project-scheduling/analysis", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const analysis = await getOverdueServicesAnalysis();

      res.json({
        message: "Overdue services analysis completed",
        ...analysis
      });
    } catch (error) {
      console.error("Error getting overdue services analysis:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to get overdue services analysis",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/project-scheduling/monitoring", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const [runLogs, latestRun] = await Promise.all([
        storage.getSchedulingRunLogs(10),
        storage.getLatestSchedulingRunLog()
      ]);

      const stats = {
        totalRuns: runLogs.length,
        successfulRuns: runLogs.filter(run => run.status === 'success').length,
        failedRuns: runLogs.filter(run => run.status === 'failure').length,
        partialFailureRuns: runLogs.filter(run => run.status === 'partial_failure').length,
        totalProjectsCreated: runLogs.reduce((sum, run) => sum + (run.projectsCreated || 0), 0),
        totalServicesRescheduled: runLogs.reduce((sum, run) => sum + (run.servicesRescheduled || 0), 0),
        totalErrorsEncountered: runLogs.reduce((sum, run) => sum + (run.errorsEncountered || 0), 0),
        totalChServicesSkipped: runLogs.reduce((sum, run) => sum + (run.chServicesSkipped || 0), 0),
        averageExecutionTime: runLogs.length > 0
          ? Math.round(runLogs.reduce((sum, run) => sum + (run.executionTimeMs || 0), 0) / runLogs.length)
          : 0
      };

      res.json({
        message: "Scheduling monitoring data retrieved",
        latestRun,
        recentRuns: runLogs,
        statistics: stats,
        systemStatus: latestRun?.status || 'unknown'
      });
    } catch (error) {
      console.error("Error getting scheduling monitoring data:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to get scheduling monitoring data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/project-scheduling/test-dry-run", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Enhanced test dry-run project scheduling triggered by admin: ${req.user?.email}`);

      const {
        targetDate,
        serviceIds,
        clientIds
      } = req.body || {};

      let schedulingDate = new Date();
      if (targetDate) {
        schedulingDate = new Date(targetDate);
        console.log(`[API] Using custom target date for dry-run: ${schedulingDate.toISOString()}`);
      }

      const result = await runProjectSchedulingEnhanced('test', schedulingDate, { serviceIds, clientIds });

      res.json({
        message: "Test dry-run project scheduling completed",
        status: result.status,
        projectsCreated: result.projectsCreated,
        servicesRescheduled: result.servicesRescheduled,
        errorsEncountered: result.errorsEncountered,
        errors: result.errors,
        summary: result.summary,
        executionTimeMs: result.executionTimeMs,
        filters: { serviceIds, clientIds, targetDate: targetDate || 'current' },
        dryRun: true
      });
    } catch (error) {
      console.error("Error running test project scheduling:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to run test project scheduling",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/project-scheduling/seed-test-data", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Test data seeding triggered by admin: ${req.user?.email}`);

      const {
        clientIds,
        serviceIds,
        dryRun
      } = req.body || {};

      const result = await seedTestServices({
        clientIds,
        serviceIds,
        dryRun: dryRun || false
      });

      res.json({
        message: "Test data seeding completed",
        status: result.status,
        clientServicesUpdated: result.clientServicesUpdated,
        errors: result.errors,
        summary: result.summary,
        dryRun: result.dryRun || false,
        options: { clientIds, serviceIds, dryRun }
      });
    } catch (error) {
      console.error("Error seeding test data:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to seed test data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/project-scheduling/reset-test-data", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Test data reset triggered by admin: ${req.user?.email}`);

      const result = await resetTestData();

      res.json({
        message: "Test data reset completed",
        status: result.status,
        info: result.message
      });
    } catch (error) {
      console.error("Error resetting test data:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to reset test data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/project-scheduling/mock-time-progression", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Mock time progression triggered by admin: ${req.user?.email}`);

      const {
        startDate,
        endDate,
        stepSize,
        dryRun,
        serviceIds,
        clientIds
      } = req.body || {};

      if (!startDate || !endDate) {
        return res.status(400).json({
          message: "startDate and endDate are required"
        });
      }

      return res.status(501).json({
        message: "Mock time progression feature is not yet implemented",
        error: "NOT_IMPLEMENTED"
      });
    } catch (error) {
      console.error("Error running mock time progression:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to run mock time progression",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/project-scheduling/generate-test-scenario", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Test scenario generation triggered by admin: ${req.user?.email}`);

      const { name, type, dryRun } = req.body || {};

      if (!name || !type) {
        return res.status(400).json({
          message: "name and type are required"
        });
      }

      return res.status(501).json({
        message: "Test scenario generation feature is not yet implemented",
        error: "NOT_IMPLEMENTED"
      });
    } catch (error) {
      console.error("Error generating test scenario:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to generate test scenario",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}
