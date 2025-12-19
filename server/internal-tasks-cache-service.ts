import { storage } from './storage/index';
import { InternalTasksCacheStorage, CachedInternalTasksData } from './storage/internal-tasks-cache/internalTasksCacheStorage';

const internalTasksCacheStorage = new InternalTasksCacheStorage();

export interface InternalTasksCacheResult {
  status: 'success' | 'partial' | 'error';
  usersProcessed: number;
  errors: string[];
  executionTimeMs: number;
}

async function addConnectionsToTasks(tasks: any[]) {
  return Promise.all(tasks.map(async (task) => {
    const connections = await storage.getTaskConnectionsByTaskId(task.id);
    const connectionsWithEntities = await Promise.all(
      connections.map(async (conn: any) => {
        let client = null;
        let project = null;
        let person = null;
        
        if (conn.entityType === 'client') {
          client = await storage.getClientById(conn.entityId);
        } else if (conn.entityType === 'project') {
          project = await storage.getProject(conn.entityId);
        } else if (conn.entityType === 'person') {
          person = await storage.getPersonById(conn.entityId);
        }
        
        return { ...conn, client, project, person };
      })
    );
    return { ...task, connections: connectionsWithEntities };
  }));
}

async function fetchTasksForUser(userId: string): Promise<{tasks: unknown[], reminders: unknown[]}> {
  const allTasks = await storage.getInternalTasksByAssignee(userId, { status: 'open' });
  const tasksWithConnections = await addConnectionsToTasks(allTasks);
  
  const tasks = tasksWithConnections.filter(t => !t.isQuickReminder);
  const reminders = tasksWithConnections.filter(t => t.isQuickReminder === true);
  
  return { tasks, reminders };
}

export async function warmInternalTasksCacheForUser(userId: string): Promise<{ tasks: number; reminders: number }> {
  const { tasks, reminders } = await fetchTasksForUser(userId);
  await internalTasksCacheStorage.setCachedData(userId, tasks, reminders);
  return { tasks: tasks.length, reminders: reminders.length };
}

export async function warmInternalTasksCacheForAllUsers(): Promise<InternalTasksCacheResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let usersProcessed = 0;

  try {
    const users = await storage.getAllUsers();
    const activeUsers = users.filter((u: any) => u.isActive !== false);

    for (const user of activeUsers) {
      try {
        await warmInternalTasksCacheForUser(user.id);
        usersProcessed++;
      } catch (error) {
        errors.push(`User ${user.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const executionTimeMs = Date.now() - startTime;
    
    return {
      status: errors.length === 0 ? 'success' : 'partial',
      usersProcessed,
      errors,
      executionTimeMs,
    };
  } catch (error) {
    return {
      status: 'error',
      usersProcessed,
      errors: [error instanceof Error ? error.message : String(error), ...errors],
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export async function getCachedInternalTasksForUser(userId: string): Promise<CachedInternalTasksData | null> {
  return internalTasksCacheStorage.getCachedDataForUser(userId);
}

export async function hasCachedInternalTasksForUser(userId: string): Promise<boolean> {
  return internalTasksCacheStorage.hasCachedDataForUser(userId);
}

export async function markInternalTasksCacheStaleForUser(userId: string): Promise<void> {
  return internalTasksCacheStorage.markUserStale(userId);
}

export async function markInternalTasksCacheStaleForUsers(userIds: string[]): Promise<number> {
  return internalTasksCacheStorage.markUsersStale(userIds);
}

export async function markAllInternalTasksCacheStale(): Promise<number> {
  return internalTasksCacheStorage.markAllStale();
}

export async function invalidateInternalTasksCacheForUser(userId: string): Promise<void> {
  return internalTasksCacheStorage.invalidateUser(userId);
}

export async function invalidateInternalTasksCacheForUsers(userIds: string[]): Promise<number> {
  return internalTasksCacheStorage.invalidateUsers(userIds);
}
