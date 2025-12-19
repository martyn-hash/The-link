import type { Express } from "express";
import multer from "multer";
import { storage } from "../storage/index";
import { objectStorageClient } from "../objectStorage";
import {
  insertTaskTypeSchema,
  updateTaskTypeSchema,
  insertInternalTaskSchema,
  updateInternalTaskSchema,
  closeInternalTaskSchema,
  insertTaskConnectionSchema,
  insertTaskProgressNoteSchema,
  insertTaskTimeEntrySchema,
  stopTaskTimeEntrySchema,
  bulkReassignTasksSchema,
  bulkUpdateTaskStatusSchema,
  insertTaskDocumentSchema,
} from "@shared/schema";
import { sendInternalTaskAssignmentEmail } from "../emailService";
import { sendTemplateNotification } from "../notification-template-service";
import {
  getCachedInternalTasksForUser,
  hasCachedInternalTasksForUser,
  warmInternalTasksCacheForUser,
  markInternalTasksCacheStaleForUser,
  markInternalTasksCacheStaleForUsers,
} from "../internal-tasks-cache-service";

// Configure multer for task document uploads (all file types allowed)
const taskDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Use Replit object storage client
const privateDir = process.env.PRIVATE_OBJECT_DIR || '';

// Helper function to add connections with entity data to tasks
async function addConnectionsToTasks(tasks: any[]) {
  return Promise.all(tasks.map(async (task) => {
    const connections = await storage.getTaskConnectionsByTaskId(task.id);
    const connectionsWithEntities = await Promise.all(
      connections.map(async (conn) => {
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

export function registerInternalTaskRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any
): void {
  
  // ============================================
  // TASK TYPES ROUTES (Admin Only)
  // ============================================

  app.get("/api/internal-task-types", isAuthenticated, async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const taskTypes = await storage.getAllTaskTypes(includeInactive);
      res.json(taskTypes);
    } catch (error) {
      console.error("Error fetching task types:", error);
      res.status(500).json({ message: "Failed to fetch task types" });
    }
  });

  app.get("/api/internal-task-types/active", isAuthenticated, async (req, res) => {
    try {
      const taskTypes = await storage.getActiveTaskTypes();
      res.json(taskTypes);
    } catch (error) {
      console.error("Error fetching active task types:", error);
      res.status(500).json({ message: "Failed to fetch active task types" });
    }
  });

  app.post("/api/internal-task-types", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const taskType = insertTaskTypeSchema.parse(req.body);
      const created = await storage.createTaskType(taskType);
      res.json(created);
    } catch (error) {
      console.error("Error creating task type:", error);
      res.status(400).json({ message: "Failed to create task type" });
    }
  });

  app.patch("/api/internal-task-types/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const taskType = updateTaskTypeSchema.parse(req.body);
      const updated = await storage.updateTaskType(req.params.id, taskType);
      res.json(updated);
    } catch (error) {
      console.error("Error updating task type:", error);
      res.status(400).json({ message: "Failed to update task type" });
    }
  });

  app.delete("/api/internal-task-types/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteTaskType(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task type:", error);
      res.status(400).json({ message: "Failed to delete task type" });
    }
  });

  // ============================================
  // INTERNAL TASKS ROUTES
  // ============================================

  app.get("/api/internal-tasks", isAuthenticated, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.priority) filters.priority = req.query.priority as string;
      if (req.query.assigneeId) filters.assigneeId = req.query.assigneeId as string;
      if (req.query.creatorId) filters.creatorId = req.query.creatorId as string;

      const tasks = await storage.getAllInternalTasks(filters);
      const tasksWithConnections = await addConnectionsToTasks(tasks);
      res.json(tasksWithConnections);
    } catch (error) {
      console.error("Error fetching internal tasks:", error);
      res.status(500).json({ message: "Failed to fetch internal tasks" });
    }
  });

  app.get("/api/internal-tasks/assigned/:userId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const requestedUserId = req.params.userId;
      const actualUserId = req.user?.effectiveUserId || req.user?.id;
      const currentUser = await storage.getUser(actualUserId);
      
      // Allow users to view their own tasks, or managers/admins to view any user's tasks
      const isManager = currentUser?.isAdmin || currentUser?.canSeeAdminMenu || currentUser?.superAdmin;
      if (requestedUserId !== actualUserId && !isManager) {
        return res.status(403).json({ message: "Not authorized to view other users' tasks" });
      }

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.priority) filters.priority = req.query.priority as string;
      if (req.query.assigneeId) filters.assigneeId = req.query.assigneeId as string;
      
      const refresh = req.query.refresh === 'true';
      
      // Check if we can serve from cache:
      // - User is viewing their own tasks
      // - Filtering by status=open (or no status filter, defaulting to all)
      // - No priority or assignee filters (cache only stores open tasks)
      const canUseCache = requestedUserId === actualUserId && 
        (filters.status === 'open' || !filters.status) &&
        !filters.priority &&
        !filters.assigneeId;
      
      if (canUseCache && !refresh) {
        const hasCached = await hasCachedInternalTasksForUser(requestedUserId);
        
        if (hasCached) {
          const cachedData = await getCachedInternalTasksForUser(requestedUserId);
          if (cachedData) {
            // Combine tasks and reminders for response (frontend filters them)
            const allItems = [...cachedData.tasks, ...cachedData.reminders];
            
            // If stale, warm cache in background
            if (cachedData.isStale) {
              warmInternalTasksCacheForUser(requestedUserId).catch(err => {
                console.error('[Internal Tasks Cache] Background warming failed:', err);
              });
            }
            
            // Return with cache metadata
            return res.json({
              data: allItems,
              fromCache: true,
              cachedAt: cachedData.lastRefreshed,
              isStale: cachedData.isStale,
              staleAt: cachedData.staleAt,
            });
          }
        }
        
        // Cold cache - warm in background and serve fresh data
        warmInternalTasksCacheForUser(requestedUserId).catch(err => {
          console.error('[Internal Tasks Cache] Background warming failed:', err);
        });
      }
      
      // If explicit refresh, warm cache first
      if (refresh && requestedUserId === actualUserId) {
        await warmInternalTasksCacheForUser(requestedUserId);
      }

      // Use the requested user ID to fetch their tasks (not the current user's)
      const tasks = await storage.getInternalTasksByAssignee(requestedUserId, filters);
      const tasksWithConnections = await addConnectionsToTasks(tasks);
      
      // Return legacy format for backwards compatibility with existing frontend
      // or when cache conditions aren't met
      res.json(tasksWithConnections);
    } catch (error) {
      console.error("Error fetching assigned tasks:", error);
      res.status(500).json({ message: "Failed to fetch assigned tasks" });
    }
  });

  app.get("/api/internal-tasks/created/:userId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const requestedUserId = req.params.userId;
      const actualUserId = req.user?.effectiveUserId || req.user?.id;
      
      // Only allow users to view their own created tasks
      if (requestedUserId !== actualUserId) {
        return res.status(403).json({ message: "Not authorized to view other users' tasks" });
      }

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.priority) filters.priority = req.query.priority as string;
      if (req.query.assigneeId) filters.assigneeId = req.query.assigneeId as string;

      const tasks = await storage.getInternalTasksByCreator(actualUserId, filters);
      const tasksWithConnections = await addConnectionsToTasks(tasks);
      res.json(tasksWithConnections);
    } catch (error) {
      console.error("Error fetching created tasks:", error);
      res.status(500).json({ message: "Failed to fetch created tasks" });
    }
  });

  app.get("/api/internal-tasks/client/:clientId", isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getInternalTasksByClient(req.params.clientId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching client tasks:", error);
      res.status(500).json({ message: "Failed to fetch client tasks" });
    }
  });

  app.get("/api/internal-tasks/project/:projectId", isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getInternalTasksByProject(req.params.projectId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching project tasks:", error);
      res.status(500).json({ message: "Failed to fetch project tasks" });
    }
  });

  app.get("/api/internal-tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const task = await storage.getInternalTaskById(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Fetch related data
      const [
        taskType,
        assignee,
        creator,
        progressNotes,
        timeEntries,
        connections
      ] = await Promise.all([
        task.taskTypeId ? storage.getTaskTypeById(task.taskTypeId) : null,
        task.assignedTo ? storage.getUser(task.assignedTo) : null,
        storage.getUser(task.createdBy),
        storage.getTaskProgressNotesByTaskId(task.id),
        storage.getTaskTimeEntriesByTaskId(task.id),
        storage.getTaskConnectionsByTaskId(task.id),
      ]);

      // Fetch connected entities based on connections
      let client = null, project = null, person = null, service = null, message = null;
      
      for (const conn of connections) {
        if (conn.entityType === 'client' && !client) {
          client = await storage.getClientById(conn.entityId);
        } else if (conn.entityType === 'project' && !project) {
          project = await storage.getProject(conn.entityId);
        } else if (conn.entityType === 'person' && !person) {
          person = await storage.getPersonById(conn.entityId);
        } else if (conn.entityType === 'service' && !service) {
          service = await storage.getServiceById(conn.entityId);
        } else if (conn.entityType === 'message' && !message) {
          message = await storage.getMessageById(conn.entityId);
        }
      }

      const taskWithRelations = {
        ...task,
        taskType,
        assignee,
        creator,
        progressNotes,
        timeEntries,
        client,
        project,
        person,
        service,
        message,
      };

      res.json(taskWithRelations);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.post("/api/internal-tasks", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      
      // Add createdBy from authenticated user
      const taskData = insertInternalTaskSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      
      const created = await storage.createInternalTask(taskData);
      
      // Send notifications if assignee is different from creator
      if (created.assignedTo !== userId) {
        try {
          // Get assignee and creator details
          const assignee = await storage.getUser(created.assignedTo);
          const creator = await storage.getUser(userId);
          
          // Get task type name if available
          let taskTypeName = null;
          if (created.taskTypeId) {
            const taskType = await storage.getTaskTypeById(created.taskTypeId);
            taskTypeName = taskType?.name || null;
          }
          
          const assigneeName = `${assignee?.firstName || ''} ${assignee?.lastName || ''}`.trim() || 'Unknown';
          const creatorName = `${creator?.firstName || ''} ${creator?.lastName || ''}`.trim() || 'Unknown';
          
          if (assignee?.email && creator) {
            // Send email notification
            await sendInternalTaskAssignmentEmail(
              assignee.email,
              assigneeName,
              created.title,
              created.description,
              created.priority,
              created.dueDate,
              creatorName,
              taskTypeName
            );
            
            // Send push notification
            await sendTemplateNotification(
              'task_assigned',
              [assignee.id],
              {
                taskTitle: created.title,
                assigneeName: assigneeName,
                creatorName: creatorName,
                priority: created.priority,
                dueDate: created.dueDate ? created.dueDate.toLocaleDateString('en-GB') : 'No due date'
              },
              '/internal-tasks'
            );
            
            console.log(`Notifications sent for internal task assignment to ${assignee.email}`);
          }
        } catch (notificationError) {
          console.error("Error sending notifications:", notificationError);
          // Don't fail the request if notifications fail
        }
      }
      
      // Invalidate cache for the assignee (task assigned to them)
      markInternalTasksCacheStaleForUser(created.assignedTo).catch(err => {
        console.error('[Internal Tasks Cache] Failed to mark cache stale:', err);
      });
      // Also invalidate creator's cache if different
      if (created.assignedTo !== userId) {
        markInternalTasksCacheStaleForUser(userId).catch(err => {
          console.error('[Internal Tasks Cache] Failed to mark cache stale:', err);
        });
      }
      
      res.json(created);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(400).json({ message: "Failed to create task" });
    }
  });

  // Add connections to a task
  app.post("/api/internal-tasks/:id/connections", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const taskId = req.params.id;
      const userId = req.user?.effectiveUserId || req.user?.id;
      const { connections } = req.body;
      
      if (!Array.isArray(connections) || connections.length === 0) {
        return res.status(400).json({ message: "Connections array is required" });
      }

      // Create each connection
      const created = [];
      for (const conn of connections) {
        const connectionData = insertTaskConnectionSchema.parse({
          taskId,
          entityType: conn.entityType,
          entityId: conn.entityId,
        });
        const result = await storage.createTaskConnection(connectionData);
        created.push(result);
      }

      res.json(created);
    } catch (error) {
      console.error("Error creating task connections:", error);
      res.status(400).json({ message: "Failed to create task connections" });
    }
  });

  app.patch("/api/internal-tasks/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      const taskData = updateInternalTaskSchema.parse(req.body);
      
      // Get original task to check if assignee changed
      const originalTask = await storage.getInternalTaskById(req.params.id);
      
      const updated = await storage.updateInternalTask(req.params.id, taskData);
      
      // Send notifications if assignee changed and is different from current user
      if (taskData.assignedTo && originalTask && taskData.assignedTo !== originalTask.assignedTo && taskData.assignedTo !== userId) {
        try {
          // Get assignee and reassigner details
          const assignee = await storage.getUser(taskData.assignedTo);
          const reassigner = await storage.getUser(userId);
          
          // Get task type name if available
          let taskTypeName = null;
          if (updated.taskTypeId) {
            const taskType = await storage.getTaskTypeById(updated.taskTypeId);
            taskTypeName = taskType?.name || null;
          }
          
          const assigneeName = `${assignee?.firstName || ''} ${assignee?.lastName || ''}`.trim() || 'Unknown';
          const reassignerName = `${reassigner?.firstName || ''} ${reassigner?.lastName || ''}`.trim() || 'Unknown';
          
          if (assignee?.email && reassigner) {
            // Send email notification
            await sendInternalTaskAssignmentEmail(
              assignee.email,
              assigneeName,
              updated.title,
              updated.description,
              updated.priority,
              updated.dueDate,
              reassignerName,
              taskTypeName
            );
            
            // Send push notification
            await sendTemplateNotification(
              'task_assigned',
              [assignee.id],
              {
                taskTitle: updated.title,
                assigneeName: assigneeName,
                creatorName: reassignerName,
                priority: updated.priority,
                dueDate: updated.dueDate ? updated.dueDate.toLocaleDateString('en-GB') : 'No due date'
              },
              '/internal-tasks'
            );
            
            console.log(`Notifications sent for internal task reassignment to ${assignee.email}`);
          }
        } catch (notificationError) {
          console.error("Error sending reassignment notifications:", notificationError);
          // Don't fail the request if notifications fail
        }
      }
      
      // Invalidate cache for affected users
      const usersToInvalidate = new Set<string>();
      usersToInvalidate.add(updated.assignedTo);
      if (originalTask && originalTask.assignedTo !== updated.assignedTo) {
        usersToInvalidate.add(originalTask.assignedTo);
      }
      usersToInvalidate.add(updated.createdBy);
      
      markInternalTasksCacheStaleForUsers(Array.from(usersToInvalidate)).catch(err => {
        console.error('[Internal Tasks Cache] Failed to mark cache stale:', err);
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(400).json({ message: "Failed to update task" });
    }
  });

  app.post("/api/internal-tasks/:id/close", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const closeData = closeInternalTaskSchema.parse(req.body);
      const userId = req.user?.effectiveUserId || req.user?.id;
      const closed = await storage.closeInternalTask(req.params.id, closeData, userId);
      
      // Invalidate cache for the assignee
      markInternalTasksCacheStaleForUser(closed.assignedTo).catch(err => {
        console.error('[Internal Tasks Cache] Failed to mark cache stale:', err);
      });
      
      res.json(closed);
    } catch (error) {
      console.error("Error closing task:", error);
      res.status(400).json({ message: "Failed to close task" });
    }
  });

  app.delete("/api/internal-tasks/:id", isAuthenticated, async (req, res) => {
    try {
      // Get task before deletion to know which user's cache to invalidate
      const task = await storage.getInternalTaskById(req.params.id);
      
      await storage.deleteInternalTask(req.params.id);
      
      // Invalidate cache for the assignee
      if (task) {
        markInternalTasksCacheStaleForUser(task.assignedTo).catch(err => {
          console.error('[Internal Tasks Cache] Failed to mark cache stale:', err);
        });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(400).json({ message: "Failed to delete task" });
    }
  });

  app.post("/api/internal-tasks/:id/archive", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      const archived = await storage.archiveInternalTask(req.params.id, userId);
      
      // Invalidate cache for the assignee
      markInternalTasksCacheStaleForUser(archived.assignedTo).catch(err => {
        console.error('[Internal Tasks Cache] Failed to mark cache stale:', err);
      });
      
      res.json(archived);
    } catch (error) {
      console.error("Error archiving task:", error);
      res.status(400).json({ message: "Failed to archive task" });
    }
  });

  app.post("/api/internal-tasks/:id/unarchive", isAuthenticated, async (req, res) => {
    try {
      const unarchived = await storage.unarchiveInternalTask(req.params.id);
      res.json(unarchived);
    } catch (error) {
      console.error("Error unarchiving task:", error);
      res.status(400).json({ message: "Failed to unarchive task" });
    }
  });

  // Bulk operations
  app.post("/api/internal-tasks/bulk/reassign", isAuthenticated, async (req, res) => {
    try {
      const { taskIds, assignedTo } = bulkReassignTasksSchema.parse(req.body);
      
      // Get old assignees before reassigning to invalidate their caches
      const usersToInvalidate = new Set<string>();
      usersToInvalidate.add(assignedTo);
      for (const taskId of taskIds) {
        const task = await storage.getInternalTaskById(taskId);
        if (task) {
          usersToInvalidate.add(task.assignedTo);
        }
      }
      
      await storage.bulkReassignTasks(taskIds, assignedTo);
      
      // Invalidate caches for all affected users
      markInternalTasksCacheStaleForUsers(Array.from(usersToInvalidate)).catch(err => {
        console.error('[Internal Tasks Cache] Failed to mark cache stale:', err);
      });
      
      res.json({ message: "Tasks reassigned successfully" });
    } catch (error) {
      console.error("Error bulk reassigning tasks:", error);
      res.status(400).json({ message: "Failed to reassign tasks" });
    }
  });

  app.post("/api/internal-tasks/bulk/update-status", isAuthenticated, async (req, res) => {
    try {
      const { taskIds, status } = bulkUpdateTaskStatusSchema.parse(req.body);
      
      // Get assignees to invalidate their caches
      const usersToInvalidate = new Set<string>();
      for (const taskId of taskIds) {
        const task = await storage.getInternalTaskById(taskId);
        if (task) {
          usersToInvalidate.add(task.assignedTo);
        }
      }
      
      await storage.bulkUpdateTaskStatus(taskIds, status);
      
      // Invalidate caches for all affected users
      markInternalTasksCacheStaleForUsers(Array.from(usersToInvalidate)).catch(err => {
        console.error('[Internal Tasks Cache] Failed to mark cache stale:', err);
      });
      
      res.json({ message: "Task statuses updated successfully" });
    } catch (error) {
      console.error("Error bulk updating task status:", error);
      res.status(400).json({ message: "Failed to update task statuses" });
    }
  });

  // ============================================
  // TASK CONNECTIONS ROUTES
  // ============================================

  app.get("/api/internal-tasks/:taskId/connections", isAuthenticated, async (req, res) => {
    try {
      const connections = await storage.getTaskConnectionsByTaskId(req.params.taskId);
      
      // Fetch related entities for each connection
      const connectionsWithEntities = await Promise.all(
        connections.map(async (conn) => {
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
          
          return {
            ...conn,
            client,
            project,
            person,
          };
        })
      );
      
      res.json(connectionsWithEntities);
    } catch (error) {
      console.error("Error fetching task connections:", error);
      res.status(500).json({ message: "Failed to fetch task connections" });
    }
  });

  app.post("/api/internal-tasks/:taskId/connections", isAuthenticated, async (req, res) => {
    try {
      console.log("Creating connection with body:", req.body, "taskId:", req.params.taskId);
      const connectionData = insertTaskConnectionSchema.parse({
        ...req.body,
        taskId: req.params.taskId,
      });
      console.log("Parsed connection data:", connectionData);
      const created = await storage.createTaskConnection(connectionData);
      res.json(created);
    } catch (error) {
      console.error("Error creating task connection:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      res.status(400).json({ message: "Failed to create task connection" });
    }
  });

  app.delete("/api/task-connections/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTaskConnection(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task connection:", error);
      res.status(400).json({ message: "Failed to delete task connection" });
    }
  });

  // ============================================
  // TASK PROGRESS NOTES ROUTES
  // ============================================

  app.get("/api/internal-tasks/:taskId/progress-notes", isAuthenticated, async (req, res) => {
    try {
      const notes = await storage.getTaskProgressNotesByTaskId(req.params.taskId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching task progress notes:", error);
      res.status(500).json({ message: "Failed to fetch task progress notes" });
    }
  });

  app.post("/api/internal-tasks/:taskId/progress-notes", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      const noteData = insertTaskProgressNoteSchema.parse({
        ...req.body,
        taskId: req.params.taskId,
        userId,
      });
      const created = await storage.createTaskProgressNote(noteData);
      
      res.json(created);
    } catch (error) {
      console.error("Error creating task progress note:", error);
      res.status(400).json({ message: "Failed to create task progress note" });
    }
  });

  app.delete("/api/task-progress-notes/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTaskProgressNote(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task progress note:", error);
      res.status(400).json({ message: "Failed to delete task progress note" });
    }
  });

  // ============================================
  // TASK TIME ENTRIES ROUTES
  // ============================================

  app.get("/api/internal-tasks/:taskId/time-entries", isAuthenticated, async (req, res) => {
    try {
      const timeEntries = await storage.getTaskTimeEntriesByTaskId(req.params.taskId);
      res.json(timeEntries);
    } catch (error) {
      console.error("Error fetching task time entries:", error);
      res.status(500).json({ message: "Failed to fetch task time entries" });
    }
  });

  app.get("/api/internal-tasks/:taskId/active-time-entry", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      const activeEntry = await storage.getActiveTaskTimeEntry(req.params.taskId, userId);
      res.json(activeEntry || null);
    } catch (error) {
      console.error("Error fetching active time entry:", error);
      res.status(500).json({ message: "Failed to fetch active time entry" });
    }
  });

  app.post("/api/internal-tasks/:taskId/time-entries/start", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      
      const activeEntry = await storage.getActiveTaskTimeEntry(req.params.taskId, userId);
      if (activeEntry) {
        return res.status(400).json({ message: "Time entry already running for this task" });
      }

      const timeEntryData = insertTaskTimeEntrySchema.parse({
        taskId: req.params.taskId,
        userId,
        startTime: new Date(),
      });
      const created = await storage.createTaskTimeEntry(timeEntryData);
      res.json(created);
    } catch (error) {
      console.error("Error starting time entry:", error);
      res.status(400).json({ message: "Failed to start time entry" });
    }
  });

  app.post("/api/task-time-entries/:id/stop", isAuthenticated, async (req, res) => {
    try {
      const stopData = stopTaskTimeEntrySchema.parse(req.body);
      const stopped = await storage.stopTaskTimeEntry(req.params.id, stopData);
      res.json(stopped);
    } catch (error) {
      console.error("Error stopping time entry:", error);
      res.status(400).json({ message: "Failed to stop time entry" });
    }
  });

  app.delete("/api/task-time-entries/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTaskTimeEntry(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting time entry:", error);
      res.status(400).json({ message: "Failed to delete time entry" });
    }
  });

  // ============================================
  // TASK DOCUMENTS ROUTES
  // ============================================

  app.get("/api/internal-tasks/:taskId/documents", isAuthenticated, async (req, res) => {
    try {
      const documents = await storage.getTaskDocuments(req.params.taskId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching task documents:", error);
      res.status(500).json({ message: "Failed to fetch task documents" });
    }
  });

  app.post("/api/internal-tasks/:taskId/documents", isAuthenticated, resolveEffectiveUser, taskDocumentUpload.single('file'), async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Generate unique filename to prevent collisions
      const timestamp = Date.now();
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${privateDir}/task-documents/${req.params.taskId}/${timestamp}-${sanitizedFilename}`;
      
      // Upload to GCS
      const bucketName = privateDir.split('/')[1];
      const filePath = storagePath.replace(`/${bucketName}/`, '');
      const bucket = objectStorageClient.bucket(bucketName);
      const blob = bucket.file(filePath);
      
      await blob.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
      });

      // Save document metadata to database
      const documentData = insertTaskDocumentSchema.parse({
        taskId: req.params.taskId,
        uploadedBy: userId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storagePath,
      });
      
      const created = await storage.createTaskDocument(documentData);
      res.json(created);
    } catch (error) {
      console.error("Error uploading task document:", error);
      res.status(400).json({ message: "Failed to upload document" });
    }
  });

  app.get("/api/task-documents/:id/download", isAuthenticated, async (req, res) => {
    try {
      const document = await storage.getTaskDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Download from GCS
      const bucketName = document.storagePath.split('/')[1];
      const filePath = document.storagePath.replace(`/${bucketName}/`, '');
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(filePath);
      
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ message: "File not found in storage" });
      }

      const [fileContents] = await file.download();
      
      res.set({
        'Content-Type': document.mimeType,
        'Content-Disposition': `attachment; filename="${document.fileName}"`,
        'Content-Length': document.fileSize,
      });
      
      res.send(fileContents);
    } catch (error) {
      console.error("Error downloading task document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.delete("/api/task-documents/:id", isAuthenticated, async (req, res) => {
    try {
      const document = await storage.getTaskDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete from GCS
      const bucketName = document.storagePath.split('/')[1];
      const filePath = document.storagePath.replace(`/${bucketName}/`, '');
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(filePath);
      
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
      }

      // Delete from database
      await storage.deleteTaskDocument(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task document:", error);
      res.status(400).json({ message: "Failed to delete document" });
    }
  });

  app.post("/api/admin/trigger-reminder-notifications", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { triggerReminderProcessing } = await import("../reminder-notification-cron");
      await triggerReminderProcessing();
      res.json({ message: "Reminder notification processing triggered" });
    } catch (error) {
      console.error("Error triggering reminder notifications:", error);
      res.status(500).json({ message: "Failed to trigger reminder notifications" });
    }
  });

  // Test endpoint to send a sample reminder email
  app.post("/api/admin/test-reminder-email", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { email, reminderTitle, reminderDescription } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }

      const { sendEmail } = await import("../emailService");
      
      const baseUrl = 'https://flow.growth.accountants';
      const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;
      const subject = `Reminder: ${reminderTitle || 'Test Reminder'} - The Link`;
      const formattedDueDate = new Date().toLocaleString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 120px; height: auto; margin-bottom: 10px;" />
              <h1 style="color: #1e293b; margin: 0; font-size: 20px;">The Link</h1>
            </div>
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin-top: 0;">⏰ Reminder Due</h2>
              <p style="color: #475569; font-size: 16px;">Hello,</p>
              <p style="color: #475569; font-size: 16px;">Your reminder is now due:</p>
              
              <div style="background-color: #fef3c7; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #fcd34d;">
                <h3 style="margin-top: 0; color: #92400e; font-size: 18px;">🔔 ${reminderTitle || 'Test Reminder'}</h3>
                ${reminderDescription ? `<p style="margin-bottom: 12px; color: #374151;">${reminderDescription}</p>` : '<p style="margin-bottom: 12px; color: #374151;">This is a test reminder email to verify the notification system is working correctly.</p>'}
                <p style="margin-bottom: 0; color: #374151;"><strong>Due:</strong> ${formattedDueDate}</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/internal-tasks" 
                   style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                  View Reminders
                </a>
              </div>
              
              <p style="color: #475569; font-size: 16px;">Log into The Link to view or complete this reminder.</p>
            </div>
            <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
              <p style="margin: 0 0 10px 0;">
                <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
              </p>
              <p style="margin: 0; font-size: 13px;">
                Your workflow management partner
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
Hello,

Your reminder is now due:

REMINDER: ${reminderTitle || 'Test Reminder'}
${reminderDescription ? `Details: ${reminderDescription}` : 'Details: This is a test reminder email to verify the notification system is working correctly.'}
Due: ${formattedDueDate}

Log into The Link to view or complete this reminder.

View Reminders: ${baseUrl}/internal-tasks

Best regards,
The Link Team
      `;

      const emailSent = await sendEmail({
        to: email,
        subject,
        text,
        html,
      });

      if (emailSent) {
        res.json({ message: `Test reminder email sent to ${email}`, success: true });
      } else {
        res.status(500).json({ message: "Failed to send test email", success: false });
      }
    } catch (error) {
      console.error("Error sending test reminder email:", error);
      res.status(500).json({ message: "Failed to send test reminder email" });
    }
  });
}
