import type { Express } from "express";
import { storage } from "../storage";
import {
  insertTaskTypeSchema,
  updateTaskTypeSchema,
  insertInternalTaskSchema,
  updateInternalTaskSchema,
  closeInternalTaskSchema,
  insertTaskConnectionSchema,
  insertTaskCommentSchema,
  updateTaskCommentSchema,
  insertTaskNoteSchema,
  updateTaskNoteSchema,
  insertTaskTimeEntrySchema,
  stopTaskTimeEntrySchema,
  bulkReassignTasksSchema,
  bulkUpdateTaskStatusSchema,
} from "@shared/schema";

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
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching internal tasks:", error);
      res.status(500).json({ message: "Failed to fetch internal tasks" });
    }
  });

  app.get("/api/internal-tasks/assigned/:userId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const requestedUserId = req.params.userId;
      const actualUserId = req.user?.effectiveUserId || req.user?.id;
      
      // Only allow users to view their own assigned tasks
      if (requestedUserId !== actualUserId) {
        return res.status(403).json({ message: "Not authorized to view other users' tasks" });
      }

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.priority) filters.priority = req.query.priority as string;

      const tasks = await storage.getInternalTasksByAssignee(actualUserId, filters);
      res.json(tasks);
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

      const tasks = await storage.getInternalTasksByCreator(actualUserId, filters);
      res.json(tasks);
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
        comments,
        notes,
        timeEntries,
        client,
        project,
        person,
        service,
        message
      ] = await Promise.all([
        task.taskTypeId ? storage.getInternalTaskTypeById(task.taskTypeId) : null,
        task.assignedTo ? storage.getUserById(task.assignedTo) : null,
        storage.getUserById(task.createdBy),
        storage.getTaskCommentsByTaskId(task.id),
        storage.getTaskNotesByTaskId(task.id),
        storage.getTaskTimeEntriesByTaskId(task.id),
        task.clientId ? storage.getClientById(task.clientId) : null,
        task.projectId ? storage.getProjectById(task.projectId) : null,
        task.personId ? storage.getPersonById(task.personId) : null,
        task.serviceId ? storage.getServiceById(task.serviceId) : null,
        task.messageId ? storage.getMessageById(task.messageId) : null,
      ]);

      const taskWithRelations = {
        ...task,
        taskType,
        assignee,
        creator,
        comments: comments.map(c => ({
          ...c,
          author: c.user
        })),
        notes: notes.map(n => ({
          ...n,
          author: n.user
        })),
        timeEntries: timeEntries.map(te => ({
          ...te,
          user: te.user
        })),
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
      res.json(created);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(400).json({ message: "Failed to create task" });
    }
  });

  app.patch("/api/internal-tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const taskData = updateInternalTaskSchema.parse(req.body);
      const updated = await storage.updateInternalTask(req.params.id, taskData);
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
      res.json(closed);
    } catch (error) {
      console.error("Error closing task:", error);
      res.status(400).json({ message: "Failed to close task" });
    }
  });

  app.delete("/api/internal-tasks/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteInternalTask(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(400).json({ message: "Failed to delete task" });
    }
  });

  // Bulk operations
  app.post("/api/internal-tasks/bulk/reassign", isAuthenticated, async (req, res) => {
    try {
      const { taskIds, assignedTo } = bulkReassignTasksSchema.parse(req.body);
      await storage.bulkReassignTasks(taskIds, assignedTo);
      res.json({ message: "Tasks reassigned successfully" });
    } catch (error) {
      console.error("Error bulk reassigning tasks:", error);
      res.status(400).json({ message: "Failed to reassign tasks" });
    }
  });

  app.post("/api/internal-tasks/bulk/update-status", isAuthenticated, async (req, res) => {
    try {
      const { taskIds, status } = bulkUpdateTaskStatusSchema.parse(req.body);
      await storage.bulkUpdateTaskStatus(taskIds, status);
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
      res.json(connections);
    } catch (error) {
      console.error("Error fetching task connections:", error);
      res.status(500).json({ message: "Failed to fetch task connections" });
    }
  });

  app.post("/api/internal-tasks/:taskId/connections", isAuthenticated, async (req, res) => {
    try {
      const connectionData = insertTaskConnectionSchema.parse({
        ...req.body,
        taskId: req.params.taskId,
      });
      const created = await storage.createTaskConnection(connectionData);
      res.json(created);
    } catch (error) {
      console.error("Error creating task connection:", error);
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
  // TASK COMMENTS ROUTES
  // ============================================

  app.get("/api/internal-tasks/:taskId/comments", isAuthenticated, async (req, res) => {
    try {
      const comments = await storage.getTaskCommentsByTaskId(req.params.taskId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching task comments:", error);
      res.status(500).json({ message: "Failed to fetch task comments" });
    }
  });

  app.post("/api/internal-tasks/:taskId/comments", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      const commentData = insertTaskCommentSchema.parse({
        ...req.body,
        taskId: req.params.taskId,
        userId,
      });
      const created = await storage.createTaskComment(commentData);
      res.json(created);
    } catch (error) {
      console.error("Error creating task comment:", error);
      res.status(400).json({ message: "Failed to create task comment" });
    }
  });

  app.patch("/api/task-comments/:id", isAuthenticated, async (req, res) => {
    try {
      const commentData = updateTaskCommentSchema.parse(req.body);
      const updated = await storage.updateTaskComment(req.params.id, commentData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating task comment:", error);
      res.status(400).json({ message: "Failed to update task comment" });
    }
  });

  app.delete("/api/task-comments/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTaskComment(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task comment:", error);
      res.status(400).json({ message: "Failed to delete task comment" });
    }
  });

  // ============================================
  // TASK NOTES ROUTES
  // ============================================

  app.get("/api/internal-tasks/:taskId/notes", isAuthenticated, async (req, res) => {
    try {
      const notes = await storage.getTaskNotesByTaskId(req.params.taskId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching task notes:", error);
      res.status(500).json({ message: "Failed to fetch task notes" });
    }
  });

  app.post("/api/internal-tasks/:taskId/notes", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      const noteData = insertTaskNoteSchema.parse({
        ...req.body,
        taskId: req.params.taskId,
        userId,
      });
      const created = await storage.createTaskNote(noteData);
      res.json(created);
    } catch (error) {
      console.error("Error creating task note:", error);
      res.status(400).json({ message: "Failed to create task note" });
    }
  });

  app.patch("/api/task-notes/:id", isAuthenticated, async (req, res) => {
    try {
      const noteData = updateTaskNoteSchema.parse(req.body);
      const updated = await storage.updateTaskNote(req.params.id, noteData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating task note:", error);
      res.status(400).json({ message: "Failed to update task note" });
    }
  });

  app.delete("/api/task-notes/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTaskNote(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task note:", error);
      res.status(400).json({ message: "Failed to delete task note" });
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
}
