import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage/index";
import type { KanbanStage } from "@shared/schema";

const leagueQuerySchema = z.object({
  serviceId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  minProjects: z.string().optional().default("5"),
});

interface LatenessEvent {
  projectId: string;
  assigneeId: string;
  stageName: string;
  lateAt: Date;
  exitedAt: Date | null;
  lateDays: number;
}

interface AssigneeMetrics {
  assigneeId: string;
  assigneeName: string;
  projectCount: number;
  projectDays: number;
  lateEvents: number;
  totalLateDays: number;
  stageBreakdown: Map<string, { lateEvents: number; lateDays: number }>;
  lateProjects: Array<{
    projectId: string;
    projectDescription: string;
    clientName: string;
    stageName: string;
    daysLate: number;
  }>;
}

function countBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function registerPerformanceLeagueRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  app.get("/api/analytics/performance-league", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const parsed = leagueQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid query parameters", errors: parsed.error.errors });
      }

      const { serviceId, startDate, endDate, minProjects } = parsed.data;
      const minProjectsNum = parseInt(minProjects, 10);
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      rangeEnd.setHours(23, 59, 59, 999);

      const service = await storage.getServiceById(serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      const projectTypeId = service.projectTypeId;
      if (!projectTypeId) {
        return res.json({
          entries: [],
          dateRange: { start: startDate, end: endDate },
          serviceName: service.name,
          generatedAt: new Date().toISOString(),
        });
      }

      const stages = await storage.getKanbanStagesByProjectTypeId(projectTypeId);
      const stageTimeMap = new Map<string, number>();
      stages.forEach((stage: KanbanStage) => {
        if (stage.maxInstanceTime) {
          stageTimeMap.set(stage.name, stage.maxInstanceTime);
        }
      });

      const allProjects = await storage.getAllProjects({ projectTypeId });
      const users = await storage.getAllUsers();
      const userMap = new Map(users.map(u => [u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email]));

      const assigneeMetrics = new Map<string, AssigneeMetrics>();

      for (const project of allProjects) {
        if (!project.chronology || project.chronology.length === 0) continue;

        const client = await storage.getClientById(project.clientId);
        const clientName = client?.name || 'Unknown';

        const validChronology = project.chronology.filter(entry => entry.timestamp !== null);
        const chronologyInRange = validChronology.filter(entry => {
          const ts = new Date(entry.timestamp!);
          return ts >= rangeStart && ts <= rangeEnd;
        });

        const sortedChronology = [...validChronology].sort(
          (a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
        );

        const assigneesInRange = new Set<string>();
        for (const entry of chronologyInRange) {
          if (entry.assigneeId) {
            assigneesInRange.add(entry.assigneeId);
          }
        }

        if (assigneesInRange.size === 0 && project.currentAssigneeId) {
          const lastEntryBeforeRange = sortedChronology
            .filter(e => new Date(e.timestamp!) < rangeStart)
            .pop();
          if (lastEntryBeforeRange?.assigneeId) {
            assigneesInRange.add(lastEntryBeforeRange.assigneeId);
          } else if (project.currentAssigneeId) {
            assigneesInRange.add(project.currentAssigneeId);
          }
        }

        for (const assigneeId of Array.from(assigneesInRange)) {
          if (!assigneeMetrics.has(assigneeId)) {
            assigneeMetrics.set(assigneeId, {
              assigneeId,
              assigneeName: userMap.get(assigneeId) || 'Unknown',
              projectCount: 0,
              projectDays: 0,
              lateEvents: 0,
              totalLateDays: 0,
              stageBreakdown: new Map(),
              lateProjects: [],
            });
          }
          const metrics = assigneeMetrics.get(assigneeId)!;
          metrics.projectCount++;

          // Calculate project days for this assignee on this project
          for (let i = 0; i < sortedChronology.length; i++) {
            const entry = sortedChronology[i];
            if (entry.assigneeId !== assigneeId) continue;

            const entryTime = new Date(entry.timestamp!);
            const nextEntry = sortedChronology[i + 1];
            const exitTime = nextEntry ? new Date(nextEntry.timestamp!) : new Date();

            // Clamp to the date range
            const periodStart = entryTime < rangeStart ? rangeStart : entryTime;
            const periodEnd = exitTime > rangeEnd ? rangeEnd : exitTime;

            if (periodStart < periodEnd) {
              metrics.projectDays += countBusinessDays(periodStart, periodEnd);
            }
          }
        }

        for (let i = 0; i < sortedChronology.length; i++) {
          const entry = sortedChronology[i];
          const entryTime = new Date(entry.timestamp!);
          const nextEntry = sortedChronology[i + 1];
          const exitTime = nextEntry ? new Date(nextEntry.timestamp!) : new Date();

          const stageName = entry.toStatus;
          const maxHours = stageTimeMap.get(stageName);

          if (!maxHours) continue;

          const lateAt = new Date(entryTime.getTime() + maxHours * 60 * 60 * 1000);

          if (lateAt < exitTime) {
            const lateStartInRange = lateAt < rangeStart ? rangeStart : lateAt;
            const lateEndInRange = exitTime > rangeEnd ? rangeEnd : exitTime;

            if (lateStartInRange < lateEndInRange) {
              const lateDays = countBusinessDays(lateStartInRange, lateEndInRange);

              const assigneeAtLate = entry.assigneeId;
              if (!assigneeAtLate) continue;

              if (!assigneeMetrics.has(assigneeAtLate)) {
                assigneeMetrics.set(assigneeAtLate, {
                  assigneeId: assigneeAtLate,
                  assigneeName: userMap.get(assigneeAtLate) || 'Unknown',
                  projectCount: 0,
                  projectDays: 0,
                  lateEvents: 0,
                  totalLateDays: 0,
                  stageBreakdown: new Map(),
                  lateProjects: [],
                });
              }

              const metrics = assigneeMetrics.get(assigneeAtLate)!;

              if (lateAt >= rangeStart && lateAt <= rangeEnd) {
                metrics.lateEvents++;
              }

              metrics.totalLateDays += lateDays;

              const stageStats = metrics.stageBreakdown.get(stageName) || { lateEvents: 0, lateDays: 0 };
              if (lateAt >= rangeStart && lateAt <= rangeEnd) {
                stageStats.lateEvents++;
              }
              stageStats.lateDays += lateDays;
              metrics.stageBreakdown.set(stageName, stageStats);

              const existingProject = metrics.lateProjects.find(p => p.projectId === project.id && p.stageName === stageName);
              if (existingProject) {
                existingProject.daysLate += lateDays;
              } else {
                metrics.lateProjects.push({
                  projectId: project.id,
                  projectDescription: project.description,
                  clientName,
                  stageName,
                  daysLate: lateDays,
                });
              }
            }
          }
        }
      }

      const entries: any[] = [];
      let maxRawScore = 0;

      for (const [assigneeId, metrics] of Array.from(assigneeMetrics)) {
        if (metrics.projectCount === 0) continue;

        const lir = metrics.lateEvents / metrics.projectCount;
        const ldr = metrics.totalLateDays / metrics.projectCount;
        const rawScore = (0.6 * lir) + (0.4 * ldr);

        if (rawScore > maxRawScore) {
          maxRawScore = rawScore;
        }

        entries.push({
          assigneeId,
          assigneeName: metrics.assigneeName,
          serviceName: service.name,
          projectCount: metrics.projectCount,
          projectDays: metrics.projectDays,
          lateEvents: metrics.lateEvents,
          totalLateDays: metrics.totalLateDays,
          lir,
          ldr,
          rawScore,
          smallSample: metrics.projectCount < minProjectsNum,
          stageBreakdown: metrics.stageBreakdown,
          lateProjects: metrics.lateProjects,
        });
      }

      for (const entry of entries) {
        if (maxRawScore === 0) {
          entry.performanceScore = 100;
        } else {
          entry.performanceScore = 100 * (1 - (entry.rawScore / maxRawScore));
        }
        entry.performanceScore = Math.max(0, Math.min(100, entry.performanceScore));
        entry.trend = "new";
      }

      entries.sort((a, b) => b.performanceScore - a.performanceScore);
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      // Return all entries with smallSample flag rather than filtering them out
      res.json({
        entries: entries.map(e => ({
          rank: e.rank,
          assigneeId: e.assigneeId,
          assigneeName: e.assigneeName,
          serviceName: e.serviceName,
          projectCount: e.projectCount,
          projectDays: e.projectDays,
          lateEvents: e.lateEvents,
          totalLateDays: e.totalLateDays,
          lir: e.lir,
          ldr: e.ldr,
          performanceScore: e.performanceScore,
          trend: e.trend,
          smallSample: e.smallSample,
        })),
        dateRange: { start: startDate, end: endDate },
        serviceName: service.name,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching performance league:", error);
      res.status(500).json({ message: "Failed to fetch performance league data" });
    }
  });

  app.get("/api/analytics/performance-league/:assigneeId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { assigneeId } = req.params;
      const parsed = leagueQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid query parameters" });
      }

      const { serviceId, startDate, endDate } = parsed.data;
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      rangeEnd.setHours(23, 59, 59, 999);

      const service = await storage.getServiceById(serviceId);
      if (!service || !service.projectTypeId) {
        return res.status(404).json({ message: "Service not found" });
      }

      const stages = await storage.getKanbanStagesByProjectTypeId(service.projectTypeId);
      const stageTimeMap = new Map<string, number>();
      stages.forEach((stage: KanbanStage) => {
        if (stage.maxInstanceTime) {
          stageTimeMap.set(stage.name, stage.maxInstanceTime);
        }
      });

      const allProjects = await storage.getAllProjects({ projectTypeId: service.projectTypeId });
      const users = await storage.getAllUsers();
      const userMap = new Map(users.map(u => [u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email]));

      let projectCount = 0;
      let projectDays = 0;
      let lateEvents = 0;
      let totalLateDays = 0;
      const stageBreakdown = new Map<string, { lateEvents: number; lateDays: number }>();
      const lateProjects: any[] = [];

      for (const project of allProjects) {
        if (!project.chronology || project.chronology.length === 0) continue;

        const client = await storage.getClientById(project.clientId);
        const clientName = client?.name || 'Unknown';

        const validChronology = project.chronology.filter(entry => entry.timestamp !== null);
        const sortedChronology = [...validChronology].sort(
          (a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
        );

        // Check if this assignee was involved in the project during the date range
        // This includes: entries within range OR ongoing assignment spanning the range
        let assigneeInvolved = false;
        
        for (let i = 0; i < sortedChronology.length; i++) {
          const entry = sortedChronology[i];
          if (entry.assigneeId === assigneeId) {
            const entryTime = new Date(entry.timestamp!);
            const nextEntry = sortedChronology[i + 1];
            const exitTime = nextEntry ? new Date(nextEntry.timestamp!) : new Date();
            
            // Check if assignment period overlaps with date range
            if (entryTime <= rangeEnd && exitTime >= rangeStart) {
              assigneeInvolved = true;
              break;
            }
          }
        }

        if (!assigneeInvolved) continue;
        projectCount++;
        
        // Calculate project days for this assignee on this project
        for (let i = 0; i < sortedChronology.length; i++) {
          const entry = sortedChronology[i];
          if (entry.assigneeId !== assigneeId) continue;

          const entryTime = new Date(entry.timestamp!);
          const nextEntry = sortedChronology[i + 1];
          const exitTime = nextEntry ? new Date(nextEntry.timestamp!) : new Date();

          // Clamp to the date range
          const periodStart = entryTime < rangeStart ? rangeStart : entryTime;
          const periodEnd = exitTime > rangeEnd ? rangeEnd : exitTime;

          if (periodStart < periodEnd) {
            projectDays += countBusinessDays(periodStart, periodEnd);
          }
        }

        for (let i = 0; i < sortedChronology.length; i++) {
          const entry = sortedChronology[i];
          if (entry.assigneeId !== assigneeId) continue;

          const entryTime = new Date(entry.timestamp!);
          const nextEntry = sortedChronology[i + 1];
          const exitTime = nextEntry ? new Date(nextEntry.timestamp!) : new Date();

          const stageName = entry.toStatus;
          const maxHours = stageTimeMap.get(stageName);
          if (!maxHours) continue;

          const lateAt = new Date(entryTime.getTime() + maxHours * 60 * 60 * 1000);

          if (lateAt < exitTime) {
            const lateStartInRange = lateAt < rangeStart ? rangeStart : lateAt;
            const lateEndInRange = exitTime > rangeEnd ? rangeEnd : exitTime;

            if (lateStartInRange < lateEndInRange) {
              const lateDays = countBusinessDays(lateStartInRange, lateEndInRange);

              if (lateAt >= rangeStart && lateAt <= rangeEnd) {
                lateEvents++;
              }
              totalLateDays += lateDays;

              const stageStats = stageBreakdown.get(stageName) || { lateEvents: 0, lateDays: 0 };
              if (lateAt >= rangeStart && lateAt <= rangeEnd) {
                stageStats.lateEvents++;
              }
              stageStats.lateDays += lateDays;
              stageBreakdown.set(stageName, stageStats);

              const existingProject = lateProjects.find(p => p.projectId === project.id && p.stageName === stageName);
              if (existingProject) {
                existingProject.daysLate += lateDays;
              } else {
                lateProjects.push({
                  projectId: project.id,
                  projectDescription: project.description,
                  clientName,
                  stageName,
                  daysLate: lateDays,
                });
              }
            }
          }
        }
      }

      const lir = projectCount > 0 ? lateEvents / projectCount : 0;
      const ldr = projectCount > 0 ? totalLateDays / projectCount : 0;
      const rawScore = (0.6 * lir) + (0.4 * ldr);
      const performanceScore = rawScore === 0 ? 100 : Math.max(0, Math.min(100, 100 * (1 - rawScore)));

      const stageBreakdownArray = Array.from(stageBreakdown.entries()).map(([stageName, stats]) => ({
        stageName,
        lateEvents: stats.lateEvents,
        lateDays: stats.lateDays,
        percentOfLateness: totalLateDays > 0 ? Math.round((stats.lateDays / totalLateDays) * 100) : 0,
        teamAverage: 25,
      }));

      stageBreakdownArray.sort((a, b) => b.percentOfLateness - a.percentOfLateness);

      const coachingInsights: string[] = [];

      if (stageBreakdownArray.length > 0) {
        const topStage = stageBreakdownArray[0];
        if (topStage.percentOfLateness >= 50) {
          coachingInsights.push(`📊 KEY FINDING: ${topStage.percentOfLateness}% of your late days occurred in "${topStage.stageName}" stage.`);
          coachingInsights.push(`💡 Consider reviewing your workflow in "${topStage.stageName}" to identify bottlenecks.`);
        }
      }

      const perfectStages = stages.filter((s: KanbanStage) => !stageBreakdown.has(s.name) && s.maxInstanceTime);
      if (perfectStages.length > 0) {
        coachingInsights.push(`📈 POSITIVE: You had zero late events in ${perfectStages.length} stage(s) - great work!`);
      }

      if (lateEvents === 0) {
        coachingInsights.push(`🏆 EXCELLENT: No late events during this period. Keep up the great work!`);
      } else if (lateEvents <= 2) {
        coachingInsights.push(`✨ GOOD: Only ${lateEvents} late event(s) - you're managing workflow effectively.`);
      }

      res.json({
        summary: {
          rank: 0,
          assigneeId,
          assigneeName: userMap.get(assigneeId) || 'Unknown',
          serviceName: service.name,
          projectCount,
          projectDays,
          lateEvents,
          totalLateDays,
          lir,
          ldr,
          performanceScore,
          trend: "new",
          smallSample: projectCount < 5,
        },
        stageBreakdown: stageBreakdownArray,
        projectDetails: lateProjects.slice(0, 10),
        coachingInsights,
      });
    } catch (error) {
      console.error("Error fetching assignee detail:", error);
      res.status(500).json({ message: "Failed to fetch assignee detail" });
    }
  });
}
