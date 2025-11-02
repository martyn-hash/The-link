import type { Express } from "express";
import multer from "multer";
import { storage } from "../storage";
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

// Configure multer for task document uploads (all file types allowed)
const taskDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Use Replit object storage client
const privateDir = process.env.PRIVATE_OBJECT_DIR || '';

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
}
