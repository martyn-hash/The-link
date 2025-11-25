import { storage } from "./storage/index";
import { db } from "./db";
import { dashboardCache, users } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface DashboardCacheUpdateResult {
  status: 'success' | 'partial' | 'error';
  usersProcessed: number;
  usersUpdated: number;
  errors: string[];
  executionTimeMs: number;
}

/**
 * Update dashboard cache for all users
 * This function calculates My Tasks, My Projects, Overdue Tasks, and Behind Schedule counts
 * for each user and stores them in the dashboard_cache table
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

    for (const user of allUsers) {
      try {
        usersProcessed++;

        // Get all active projects (not archived)
        const allProjects = (await storage.getProjectsByUser(
          user.id, 
          user.isAdmin ? 'admin' : 'user'
        )).filter(p => !p.archived);

        // Filter projects where user is the current assignee (My Tasks)
        const myTasks = allProjects.filter(p => p.currentAssigneeId === user.id);
        const myTasksCount = myTasks.length;

        // Filter projects where user is the service owner (My Projects)
        const myProjects = allProjects.filter(p => p.projectOwnerId === user.id);
        const myProjectsCount = myProjects.length;

        // Create union of user's relevant projects (owned OR assigned)
        const myRelevantProjects = allProjects.filter(p => 
          p.projectOwnerId === user.id || p.currentAssigneeId === user.id
        );

        // Calculate overdue tasks (due date in the past)
        const now = new Date();
        const overdueProjects = myRelevantProjects.filter(p => {
          if (!p.dueDate || p.completionStatus) return false;
          return new Date(p.dueDate) < now;
        });
        const overdueTasksCount = overdueProjects.length;

        // Calculate behind schedule count (time in current stage > maxInstanceTime)
        let behindScheduleCount = 0;
        for (const project of myRelevantProjects) {
          // Skip completed projects
          if (project.completionStatus) continue;

          // Get stage config for this project
          const stages = await storage.getKanbanStagesByProjectTypeId(project.projectTypeId);
          const currentStageConfig = stages.find(s => s.name === project.currentStatus);
          
          if (currentStageConfig?.maxInstanceTime && currentStageConfig.maxInstanceTime > 0) {
            // Calculate current business hours in stage
            const chronology = project.chronology || [];
            const sortedChronology = [...chronology].sort((a, b) => 
              new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
            );
            
            const lastEntry = sortedChronology.find(entry => entry.toStatus === project.currentStatus);
            const startTime = lastEntry?.timestamp || project.createdAt;
            
            if (startTime) {
              const { calculateBusinessHours } = await import("@shared/businessTime");
              const currentHours = calculateBusinessHours(
                new Date(startTime).toISOString(),
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
        
        if (usersProcessed % 10 === 0) {
          console.log(`[Dashboard Cache] Processed ${usersProcessed}/${allUsers.length} users...`);
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
