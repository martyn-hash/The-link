import { storage } from "./storage/index";
import { db } from "./db";
import { dashboardCache, users, type Project } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface DashboardCacheUpdateResult {
  status: 'success' | 'partial' | 'error';
  usersProcessed: number;
  usersUpdated: number;
  errors: string[];
  executionTimeMs: number;
}

/**
 * Yield to event loop if we've been running for too long
 * This prevents blocking other cron jobs and keeps the process responsive
 */
async function yieldToEventLoop(): Promise<void> {
  await new Promise(resolve => setImmediate(resolve));
}

/**
 * Update dashboard cache for all users
 * This function calculates My Tasks, My Projects, Overdue Tasks, and Behind Schedule counts
 * for each user and stores them in the dashboard_cache table.
 * 
 * Uses event loop yields between users to prevent blocking the Node.js event loop.
 */
export async function updateDashboardCache(userIdFilter?: string): Promise<DashboardCacheUpdateResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let usersProcessed = 0;
  let usersUpdated = 0;

  try {
    // Get all users or specific user if filtered
    const allUsers = userIdFilter 
      ? await db.select().from(users).where(eq(users.id, userIdFilter))
      : await db.select().from(users);

    console.log(`[Dashboard Cache] Processing ${allUsers.length} user(s)...`);

    // Pre-fetch all stages by project type to avoid N+1 queries
    // This is a significant performance optimization for the behind schedule calculation
    const stagesByProjectType = new Map<string, Awaited<ReturnType<typeof storage.getKanbanStagesByProjectTypeId>>>();
    
    const getStagesForProjectType = async (projectTypeId: string) => {
      if (!stagesByProjectType.has(projectTypeId)) {
        const stages = await storage.getKanbanStagesByProjectTypeId(projectTypeId);
        stagesByProjectType.set(projectTypeId, stages);
      }
      return stagesByProjectType.get(projectTypeId)!;
    };

    // Pre-import businessHours calculation once
    const { calculateBusinessHours } = await import("@shared/businessTime");

    for (const user of allUsers) {
      try {
        usersProcessed++;

        // Get all active projects (not archived)
        const allProjects = (await storage.getProjectsByUser(
          user.id, 
          user.isAdmin ? 'admin' : 'user'
        )).filter((p: Project) => !p.archived);

        // Filter projects where user is the current assignee (My Tasks)
        const myTasks = allProjects.filter((p: Project) => p.currentAssigneeId === user.id);
        const myTasksCount = myTasks.length;

        // Filter projects where user is the service owner (My Projects)
        const myProjects = allProjects.filter((p: Project) => p.projectOwnerId === user.id);
        const myProjectsCount = myProjects.length;

        // Create union of user's relevant projects (owned OR assigned)
        const myRelevantProjects = allProjects.filter((p: Project) => 
          p.projectOwnerId === user.id || p.currentAssigneeId === user.id
        );

        // Calculate overdue tasks (due date in the past)
        // Exclude benched and completed projects from overdue calculations
        const now = new Date();
        const overdueProjects = myRelevantProjects.filter((p: Project) => {
          if (!p.dueDate || p.completionStatus || p.isBenched) return false;
          return new Date(p.dueDate) < now;
        });
        const overdueTasksCount = overdueProjects.length;

        // Calculate behind schedule count (time in current stage > maxInstanceTime)
        // Exclude benched and completed projects from behind schedule calculations
        let behindScheduleCount = 0;
        for (const project of myRelevantProjects) {
          // Skip completed and benched projects
          if (project.completionStatus || project.isBenched) continue;

          // Get stage config from pre-fetched cache (fixes N+1 query problem)
          const stages = await getStagesForProjectType(project.projectTypeId);
          const currentStageConfig = stages.find((s: { name: string }) => s.name === project.currentStatus);
          
          if (currentStageConfig?.maxInstanceTime && currentStageConfig.maxInstanceTime > 0) {
            // Calculate current business hours in stage
            const chronology = project.chronology || [];
            const sortedChronology = [...chronology].sort((a, b) => 
              new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
            );
            
            const lastEntry = sortedChronology.find(entry => entry.toStatus === project.currentStatus);
            const startTimeForStage = lastEntry?.timestamp || project.createdAt;
            
            if (startTimeForStage) {
              const currentHours = calculateBusinessHours(
                new Date(startTimeForStage).toISOString(),
                new Date().toISOString()
              );

              if (currentHours > currentStageConfig.maxInstanceTime) {
                behindScheduleCount++;
              }
            }
          }
        }

        // Upsert the cache record
        const existing = await db.select().from(dashboardCache).where(eq(dashboardCache.userId, user.id));
        
        if (existing.length > 0) {
          await db
            .update(dashboardCache)
            .set({
              myTasksCount,
              myProjectsCount,
              overdueTasksCount,
              behindScheduleCount,
              lastUpdated: new Date(),
            })
            .where(eq(dashboardCache.userId, user.id));
        } else {
          await db.insert(dashboardCache).values({
            userId: user.id,
            myTasksCount,
            myProjectsCount,
            overdueTasksCount,
            behindScheduleCount,
            lastUpdated: new Date(),
          });
        }

        usersUpdated++;
        
        // Yield to event loop every 5 users to prevent blocking
        // This allows other cron jobs and async operations to proceed
        if (usersProcessed % 5 === 0) {
          await yieldToEventLoop();
          
          if (usersProcessed % 10 === 0) {
            console.log(`[Dashboard Cache] Processed ${usersProcessed}/${allUsers.length} users...`);
          }
        }
      } catch (userError) {
        const errorMsg = `Error updating cache for user ${user.email || user.id}: ${userError instanceof Error ? userError.message : String(userError)}`;
        console.error(`[Dashboard Cache] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    const executionTimeMs = Date.now() - startTime;
    const status = errors.length === 0 ? 'success' : errors.length < allUsers.length ? 'partial' : 'error';

    return {
      status,
      usersProcessed,
      usersUpdated,
      errors,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMsg = `Fatal error in dashboard cache update: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[Dashboard Cache] ${errorMsg}`);
    errors.push(errorMsg);

    return {
      status: 'error',
      usersProcessed,
      usersUpdated,
      errors,
      executionTimeMs,
    };
  }
}
