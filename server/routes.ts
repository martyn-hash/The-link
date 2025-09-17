import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import Papa from "papaparse";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { sendTaskAssignmentEmail } from "./emailService";
import {
  insertUserSchema,
  insertKanbanStageSchema,
  insertChangeReasonSchema,
  updateProjectStatusSchema,
  csvProjectSchema,
  type User,
} from "@shared/schema";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Helper function to check admin role
  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      next();
    } catch (error) {
      return res.status(500).json({ message: "Authorization error" });
    }
  };

  // Helper function to check manager+ role
  const requireManager = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || !['admin', 'manager'].includes(user.role)) {
        return res.status(403).json({ message: "Manager access required" });
      }
      next();
    } catch (error) {
      return res.status(500).json({ message: "Authorization error" });
    }
  };

  // User management routes
  app.get("/api/users", isAuthenticated, requireManager, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(400).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(req.params.id, userData);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(400).json({ message: "Failed to delete user" });
    }
  });

  // Project routes
  app.get("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const projects = await storage.getProjectsByUser(userId, user.role);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.patch("/api/projects/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updateData = updateProjectStatusSchema.parse({
        projectId: req.params.id,
        ...req.body,
      });

      // Verify user has permission to update this project
      const project = await storage.getProject(updateData.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user is authorized to move this project
      const canUpdate = 
        user.role === 'admin' ||
        user.role === 'manager' ||
        project.currentAssigneeId === userId ||
        (user.role === 'client_manager' && project.clientManagerId === userId) ||
        (user.role === 'bookkeeper' && project.bookkeeperId === userId);

      if (!canUpdate) {
        return res.status(403).json({ message: "Not authorized to update this project" });
      }

      const updatedProject = await storage.updateProjectStatus(updateData, userId);

      // Send email notification to new assignee
      const newAssigneeId = updatedProject.currentAssigneeId;
      if (newAssigneeId && newAssigneeId !== userId) {
        const assignee = await storage.getUser(newAssigneeId);
        if (assignee?.email) {
          await sendTaskAssignmentEmail(
            assignee.email,
            `${assignee.firstName} ${assignee.lastName}`,
            project.description,
            project.client.name,
            updateData.newStatus
          );
        }
      }

      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project status:", error);
      res.status(400).json({ message: "Failed to update project status" });
    }
  });

  // CSV upload route
  app.post("/api/projects/upload", isAuthenticated, requireAdmin, upload.single('csvFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded" });
      }

      const csvText = req.file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });

      if (parseResult.errors.length > 0) {
        return res.status(400).json({ 
          message: "CSV parsing errors", 
          errors: parseResult.errors 
        });
      }

      // Validate and transform CSV data
      const validatedProjects = [];
      const errors = [];

      for (let i = 0; i < parseResult.data.length; i++) {
        try {
          const row = parseResult.data[i] as any;
          const projectData = csvProjectSchema.parse({
            clientName: row['Client Name'] || row.clientName,
            projectDescription: row['Project Description'] || row.projectDescription,
            bookkeeperEmail: row['Bookkeeper Email'] || row.bookkeeperEmail,
            clientManagerEmail: row['Client Manager Email'] || row.clientManagerEmail,
            priority: row['Priority'] || row.priority || 'medium',
            dueDate: row['Due Date'] || row.dueDate,
          });
          validatedProjects.push(projectData);
        } catch (error) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({ 
          message: "Validation errors in CSV", 
          errors 
        });
      }

      const createdProjects = await storage.createProjectsFromCSV(validatedProjects);
      
      res.json({ 
        message: `Successfully created ${createdProjects.length} projects`,
        projects: createdProjects 
      });
    } catch (error) {
      console.error("Error uploading CSV:", error);
      res.status(500).json({ message: "Failed to upload CSV" });
    }
  });

  // Configuration routes
  app.get("/api/config/stages", isAuthenticated, async (req, res) => {
    try {
      const stages = await storage.getAllKanbanStages();
      res.json(stages);
    } catch (error) {
      console.error("Error fetching stages:", error);
      res.status(500).json({ message: "Failed to fetch stages" });
    }
  });

  app.post("/api/config/stages", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const stageData = insertKanbanStageSchema.parse(req.body);
      const stage = await storage.createKanbanStage(stageData);
      res.json(stage);
    } catch (error) {
      console.error("Error creating stage:", error);
      res.status(400).json({ message: "Failed to create stage" });
    }
  });

  app.patch("/api/config/stages/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const stage = await storage.updateKanbanStage(req.params.id, req.body);
      res.json(stage);
    } catch (error) {
      console.error("Error updating stage:", error);
      res.status(400).json({ message: "Failed to update stage" });
    }
  });

  app.delete("/api/config/stages/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteKanbanStage(req.params.id);
      res.json({ message: "Stage deleted successfully" });
    } catch (error) {
      console.error("Error deleting stage:", error);
      res.status(400).json({ message: "Failed to delete stage" });
    }
  });

  app.get("/api/config/reasons", isAuthenticated, async (req, res) => {
    try {
      const reasons = await storage.getAllChangeReasons();
      res.json(reasons);
    } catch (error) {
      console.error("Error fetching change reasons:", error);
      res.status(500).json({ message: "Failed to fetch change reasons" });
    }
  });

  app.post("/api/config/reasons", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const reasonData = insertChangeReasonSchema.parse(req.body);
      const reason = await storage.createChangeReason(reasonData);
      res.json(reason);
    } catch (error) {
      console.error("Error creating change reason:", error);
      res.status(400).json({ message: "Failed to create change reason" });
    }
  });

  app.patch("/api/config/reasons/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const reason = await storage.updateChangeReason(req.params.id, req.body);
      res.json(reason);
    } catch (error) {
      console.error("Error updating change reason:", error);
      res.status(400).json({ message: "Failed to update change reason" });
    }
  });

  app.delete("/api/config/reasons/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteChangeReason(req.params.id);
      res.json({ message: "Change reason deleted successfully" });
    } catch (error) {
      console.error("Error deleting change reason:", error);
      res.status(400).json({ message: "Failed to delete change reason" });
    }
  });

  // Test email endpoint (development only)
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/test-email", isAuthenticated, requireAdmin, async (req: any, res) => {
      try {
        const { to, subject, message } = req.body;
        
        if (!to || !subject || !message) {
          return res.status(400).json({ message: "Missing required fields: to, subject, message" });
        }

        const success = await sendTaskAssignmentEmail(
          to,
          "Test User",
          message,
          "Test Client", 
          "bookkeeping_work_required"
        );

        if (success) {
          res.json({ message: "Test email sent successfully" });
        } else {
          res.status(500).json({ message: "Failed to send test email" });
        }
      } catch (error) {
        console.error("Error sending test email:", error);
        res.status(500).json({ message: "Failed to send test email" });
      }
    });
  }

  const httpServer = createServer(app);
  return httpServer;
}
