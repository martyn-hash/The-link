import type { Express } from "express";
import { storage } from "../storage/index";
import { z } from "zod";
import {
  validateParams,
  paramUuidSchema,
} from "./routeHelpers";
import {
  insertClientProjectTaskTemplateSchema,
  updateClientProjectTaskTemplateSchema,
  insertClientProjectTaskSectionSchema,
  updateClientProjectTaskSectionSchema,
  insertClientProjectTaskQuestionSchema,
  updateClientProjectTaskQuestionSchema,
  insertClientProjectTaskOverrideSchema,
  updateClientProjectTaskOverrideSchema,
  insertClientProjectTaskOverrideQuestionSchema,
  updateClientProjectTaskOverrideQuestionSchema,
  insertClientProjectTaskInstanceSchema,
  updateClientProjectTaskInstanceSchema,
  insertClientProjectTaskResponseSchema,
  insertClientProjectTaskTokenSchema,
} from "@shared/schema";
import { nanoid } from "nanoid";

const paramProjectTypeIdSchema = z.object({
  projectTypeId: z.string().uuid("Invalid project type ID format")
});

const paramTemplateIdSchema = z.object({
  templateId: z.string().uuid("Invalid template ID format")
});

const paramClientIdSchema = z.object({
  clientId: z.string().uuid("Invalid client ID format")
});

const paramOverrideIdSchema = z.object({
  overrideId: z.string().uuid("Invalid override ID format")
});

const paramInstanceIdSchema = z.object({
  instanceId: z.string().uuid("Invalid instance ID format")
});

const paramProjectIdSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format")
});

const paramTokenSchema = z.object({
  token: z.string().min(32, "Invalid token format")
});

export function registerClientProjectTaskRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
) {
  // ============================================================================
  // TEMPLATE ROUTES
  // ============================================================================

  // GET /api/project-types/:projectTypeId/task-templates - Get all templates for a project type
  app.get("/api/project-types/:projectTypeId/task-templates", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectTypeIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectTypeId } = req.params;
      const templates = await storage.getClientProjectTaskTemplatesByProjectTypeId(projectTypeId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching task templates:", error);
      res.status(500).json({ message: "Failed to fetch task templates" });
    }
  });

  // GET /api/task-templates/:id - Get a single template by ID
  app.get("/api/task-templates/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const template = await storage.getClientProjectTaskTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching task template:", error);
      res.status(500).json({ message: "Failed to fetch task template" });
    }
  });

  // POST /api/task-templates - Create a new template
  app.post("/api/task-templates", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const validated = insertClientProjectTaskTemplateSchema.parse(req.body);
      const template = await storage.createClientProjectTaskTemplate({
        ...validated,
        createdById: req.user.id,
      });
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Error creating task template:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create task template" });
    }
  });

  // PATCH /api/task-templates/:id - Update a template
  app.patch("/api/task-templates/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const validated = updateClientProjectTaskTemplateSchema.parse(req.body);
      const template = await storage.updateClientProjectTaskTemplate(req.params.id, validated);
      res.json(template);
    } catch (error: any) {
      console.error("Error updating task template:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update task template" });
    }
  });

  // DELETE /api/task-templates/:id - Delete a template
  app.delete("/api/task-templates/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      await storage.deleteClientProjectTaskTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task template:", error);
      res.status(500).json({ message: "Failed to delete task template" });
    }
  });

  // ============================================================================
  // TEMPLATE QUESTION ROUTES
  // ============================================================================

  // GET /api/task-templates/:templateId/questions - Get all questions for a template
  app.get("/api/task-templates/:templateId/questions", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTemplateIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { templateId } = req.params;
      const questions = await storage.getClientProjectTaskQuestionsByTemplateId(templateId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching template questions:", error);
      res.status(500).json({ message: "Failed to fetch template questions" });
    }
  });

  // POST /api/task-templates/:templateId/questions - Create a question
  app.post("/api/task-templates/:templateId/questions", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTemplateIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { templateId } = req.params;
      const validated = insertClientProjectTaskQuestionSchema.parse({
        ...req.body,
        templateId,
      });
      const question = await storage.createClientProjectTaskQuestion(validated);
      res.status(201).json(question);
    } catch (error: any) {
      console.error("Error creating template question:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create template question" });
    }
  });

  // POST /api/task-templates/:templateId/questions/bulk - Create multiple questions
  app.post("/api/task-templates/:templateId/questions/bulk", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTemplateIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { templateId } = req.params;
      const questionsSchema = z.array(insertClientProjectTaskQuestionSchema);
      const questionsData = questionsSchema.parse(req.body.questions.map((q: any) => ({
        ...q,
        templateId,
      })));

      const questions = await storage.createClientProjectTaskQuestions(questionsData);
      res.status(201).json(questions);
    } catch (error: any) {
      console.error("Error creating template questions:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create template questions" });
    }
  });

  // POST /api/task-template-questions - Create a question (templateId in body)
  app.post("/api/task-template-questions", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const validated = insertClientProjectTaskQuestionSchema.parse(req.body);
      const question = await storage.createClientProjectTaskQuestion(validated);
      res.status(201).json(question);
    } catch (error: any) {
      console.error("Error creating template question:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create template question" });
    }
  });

  // PATCH /api/task-template-questions/:id - Update a question
  app.patch("/api/task-template-questions/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const validated = updateClientProjectTaskQuestionSchema.parse(req.body);
      const question = await storage.updateClientProjectTaskQuestion(req.params.id, validated);
      res.json(question);
    } catch (error: any) {
      console.error("Error updating template question:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update template question" });
    }
  });

  // DELETE /api/task-template-questions/:id - Delete a question
  app.delete("/api/task-template-questions/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      await storage.deleteClientProjectTaskQuestion(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting template question:", error);
      res.status(500).json({ message: "Failed to delete template question" });
    }
  });

  // ============================================================================
  // TEMPLATE SECTION ROUTES
  // ============================================================================

  // GET /api/task-templates/:templateId/sections - Get all sections for a template
  app.get("/api/task-templates/:templateId/sections", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTemplateIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { templateId } = req.params;
      const sections = await storage.getClientProjectTaskSectionsByTemplateId(templateId);
      res.json(sections);
    } catch (error) {
      console.error("Error fetching template sections:", error);
      res.status(500).json({ message: "Failed to fetch template sections" });
    }
  });

  // POST /api/task-template-sections - Create a section (templateId in body)
  app.post("/api/task-template-sections", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const validated = insertClientProjectTaskSectionSchema.parse(req.body);
      const section = await storage.createClientProjectTaskSection(validated);
      res.status(201).json(section);
    } catch (error: any) {
      console.error("Error creating template section:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create template section" });
    }
  });

  // GET /api/task-template-sections/:id - Get a section by ID
  app.get("/api/task-template-sections/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const section = await storage.getClientProjectTaskSectionById(req.params.id);
      if (!section) {
        return res.status(404).json({ message: "Section not found" });
      }
      res.json(section);
    } catch (error) {
      console.error("Error fetching template section:", error);
      res.status(500).json({ message: "Failed to fetch template section" });
    }
  });

  // PATCH /api/task-template-sections/:id - Update a section
  app.patch("/api/task-template-sections/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const validated = updateClientProjectTaskSectionSchema.parse(req.body);
      const section = await storage.updateClientProjectTaskSection(req.params.id, validated);
      res.json(section);
    } catch (error: any) {
      console.error("Error updating template section:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update template section" });
    }
  });

  // DELETE /api/task-template-sections/:id - Delete a section
  app.delete("/api/task-template-sections/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      await storage.deleteClientProjectTaskSection(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting template section:", error);
      res.status(500).json({ message: "Failed to delete template section" });
    }
  });

  // ============================================================================
  // CLIENT OVERRIDE ROUTES
  // ============================================================================

  // GET /api/clients/:clientId/task-overrides - Get all overrides for a client
  app.get("/api/clients/:clientId/task-overrides", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientId } = req.params;
      const overrides = await storage.getClientProjectTaskOverridesByClientId(clientId);
      res.json(overrides);
    } catch (error) {
      console.error("Error fetching client task overrides:", error);
      res.status(500).json({ message: "Failed to fetch client task overrides" });
    }
  });

  // GET /api/task-overrides/:id - Get a single override by ID
  app.get("/api/task-overrides/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const override = await storage.getClientProjectTaskOverrideById(req.params.id);
      if (!override) {
        return res.status(404).json({ message: "Override not found" });
      }
      res.json(override);
    } catch (error) {
      console.error("Error fetching task override:", error);
      res.status(500).json({ message: "Failed to fetch task override" });
    }
  });

  // POST /api/task-overrides - Create a new override
  app.post("/api/task-overrides", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const validated = insertClientProjectTaskOverrideSchema.parse(req.body);
      const override = await storage.createClientProjectTaskOverride({
        ...validated,
        createdById: req.user.id,
      });
      res.status(201).json(override);
    } catch (error: any) {
      console.error("Error creating task override:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create task override" });
    }
  });

  // PATCH /api/task-overrides/:id - Update an override
  app.patch("/api/task-overrides/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const validated = updateClientProjectTaskOverrideSchema.parse(req.body);
      const override = await storage.updateClientProjectTaskOverride(req.params.id, validated);
      res.json(override);
    } catch (error: any) {
      console.error("Error updating task override:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update task override" });
    }
  });

  // DELETE /api/task-overrides/:id - Delete an override
  app.delete("/api/task-overrides/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      await storage.deleteClientProjectTaskOverride(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task override:", error);
      res.status(500).json({ message: "Failed to delete task override" });
    }
  });

  // ============================================================================
  // OVERRIDE QUESTION ROUTES
  // ============================================================================

  // GET /api/task-overrides/:overrideId/questions - Get all questions for an override
  app.get("/api/task-overrides/:overrideId/questions", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramOverrideIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { overrideId } = req.params;
      const questions = await storage.getClientProjectTaskOverrideQuestionsByOverrideId(overrideId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching override questions:", error);
      res.status(500).json({ message: "Failed to fetch override questions" });
    }
  });

  // POST /api/task-override-questions - Create a new override question
  app.post("/api/task-override-questions", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const validated = insertClientProjectTaskOverrideQuestionSchema.parse(req.body);
      const question = await storage.createClientProjectTaskOverrideQuestion(validated);
      res.status(201).json(question);
    } catch (error: any) {
      console.error("Error creating override question:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create override question" });
    }
  });

  // PATCH /api/task-override-questions/:id - Update an override question
  app.patch("/api/task-override-questions/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const validated = updateClientProjectTaskOverrideQuestionSchema.parse(req.body);
      const question = await storage.updateClientProjectTaskOverrideQuestion(req.params.id, validated);
      res.json(question);
    } catch (error: any) {
      console.error("Error updating override question:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update override question" });
    }
  });

  // DELETE /api/task-override-questions/:id - Delete an override question
  app.delete("/api/task-override-questions/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      await storage.deleteClientProjectTaskOverrideQuestion(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting override question:", error);
      res.status(500).json({ message: "Failed to delete override question" });
    }
  });

  // ============================================================================
  // TASK INSTANCE ROUTES
  // ============================================================================

  // GET /api/projects/:projectId/task-instances - Get all instances for a project
  app.get("/api/projects/:projectId/task-instances", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectId } = req.params;
      const instances = await storage.getClientProjectTaskInstancesByProjectId(projectId);
      res.json(instances);
    } catch (error) {
      console.error("Error fetching task instances:", error);
      res.status(500).json({ message: "Failed to fetch task instances" });
    }
  });

  // GET /api/task-instances/:id - Get a single instance by ID
  app.get("/api/task-instances/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const instance = await storage.getClientProjectTaskInstanceById(req.params.id);
      if (!instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }
      res.json(instance);
    } catch (error) {
      console.error("Error fetching task instance:", error);
      res.status(500).json({ message: "Failed to fetch task instance" });
    }
  });

  // GET /api/task-instances/:instanceId/merged-questions - Get merged questions for an instance
  app.get("/api/task-instances/:instanceId/merged-questions", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramInstanceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { instanceId } = req.params;
      const questions = await storage.getMergedClientProjectTaskQuestions(instanceId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching merged questions:", error);
      res.status(500).json({ message: "Failed to fetch merged questions" });
    }
  });

  // POST /api/task-instances - Create a new instance
  app.post("/api/task-instances", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const validated = insertClientProjectTaskInstanceSchema.parse(req.body);
      const instance = await storage.createClientProjectTaskInstance({
        ...validated,
        createdById: req.user.id,
      });
      res.status(201).json(instance);
    } catch (error: any) {
      console.error("Error creating task instance:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create task instance" });
    }
  });

  // PATCH /api/task-instances/:id - Update an instance
  app.patch("/api/task-instances/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const validated = updateClientProjectTaskInstanceSchema.parse(req.body);
      const instance = await storage.updateClientProjectTaskInstance(req.params.id, validated);
      res.json(instance);
    } catch (error: any) {
      console.error("Error updating task instance:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update task instance" });
    }
  });

  // POST /api/task-instances/:instanceId/send - Send task to client with token
  app.post("/api/task-instances/:instanceId/send", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramInstanceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { instanceId } = req.params;
      const { expiresAt } = req.body;

      // Create a new token for the instance
      const token = await storage.createClientProjectTaskToken({
        instanceId,
        createdById: req.user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      // Update instance status to sent
      await storage.updateClientProjectTaskInstance(instanceId, {
        status: 'sent',
        sentAt: new Date(),
        sentById: req.user.id,
      });

      res.status(201).json({ token: token.token, expiresAt: token.expiresAt });
    } catch (error) {
      console.error("Error sending task:", error);
      res.status(500).json({ message: "Failed to send task" });
    }
  });

  // DELETE /api/task-instances/:id - Delete an instance
  app.delete("/api/task-instances/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      await storage.deleteClientProjectTaskInstance(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task instance:", error);
      res.status(500).json({ message: "Failed to delete task instance" });
    }
  });

  // ============================================================================
  // TOKEN-BASED CLIENT ACCESS ROUTES (Public)
  // ============================================================================

  // GET /api/client-task/:token - Get task form via token (public)
  app.get("/api/client-task/:token", async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTokenSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid token format",
          errors: paramValidation.errors
        });
      }

      const { token } = req.params;
      const tokenRecord = await storage.getClientProjectTaskTokenByValue(token);

      if (!tokenRecord) {
        return res.status(404).json({ message: "Invalid or expired token" });
      }

      // Check if token is expired
      if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
        return res.status(403).json({ message: "Token has expired" });
      }

      if (!tokenRecord.instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      // Check if already submitted
      if (tokenRecord.instance.status === 'submitted' || tokenRecord.instance.status === 'approved') {
        return res.status(403).json({ 
          message: "This task has already been submitted",
          status: tokenRecord.instance.status 
        });
      }

      // Mark token as accessed
      await storage.markClientProjectTaskTokenAccessed(tokenRecord.id);

      // Get merged questions
      const questions = await storage.getMergedClientProjectTaskQuestions(tokenRecord.instanceId);

      // Get sections for the template
      const sections = await storage.getClientProjectTaskSectionsForInstance(tokenRecord.instanceId);

      // Get existing responses
      const responses = await storage.getClientProjectTaskResponsesByInstanceId(tokenRecord.instanceId);

      res.json({
        instance: tokenRecord.instance,
        questions,
        sections,
        responses,
        token: {
          expiresAt: tokenRecord.expiresAt,
          accessedAt: tokenRecord.accessedAt,
        },
        recipientName: tokenRecord.recipientName,
        recipientEmail: tokenRecord.recipientEmail,
      });
    } catch (error) {
      console.error("Error fetching client task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // POST /api/client-task/:token/save - Save responses (partial save via token)
  app.post("/api/client-task/:token/save", async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTokenSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid token format",
          errors: paramValidation.errors
        });
      }

      const { token } = req.params;
      const tokenRecord = await storage.getClientProjectTaskTokenByValue(token);

      if (!tokenRecord) {
        return res.status(404).json({ message: "Invalid or expired token" });
      }

      // Check if token is expired
      if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
        return res.status(403).json({ message: "Token has expired" });
      }

      if (!tokenRecord.instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      if (tokenRecord.instance.status === 'submitted' || tokenRecord.instance.status === 'approved') {
        return res.status(403).json({ message: "This task has already been submitted" });
      }

      const { responses } = req.body;
      
      // Save each response
      for (const response of responses) {
        await storage.upsertClientProjectTaskResponse({
          instanceId: tokenRecord.instanceId,
          questionId: response.questionId,
          questionSource: response.questionSource || 'template',
          valueText: response.valueText,
          valueNumber: response.valueNumber,
          valueDate: response.valueDate,
          valueBoolean: response.valueBoolean,
          valueMultiSelect: response.valueMultiSelect,
          valueFile: response.valueFile,
        });
      }

      // Update instance status to in_progress if it was pending
      if (tokenRecord.instance.status === 'pending' || tokenRecord.instance.status === 'sent') {
        await storage.updateClientProjectTaskInstance(tokenRecord.instanceId, {
          status: 'in_progress',
          startedAt: tokenRecord.instance.startedAt || new Date(),
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving task responses:", error);
      res.status(500).json({ message: "Failed to save responses" });
    }
  });

  // POST /api/client-task/:token/submit - Submit the task (final submit via token)
  app.post("/api/client-task/:token/submit", async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramTokenSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid token format",
          errors: paramValidation.errors
        });
      }

      const { token } = req.params;
      const tokenRecord = await storage.getClientProjectTaskTokenByValue(token);

      if (!tokenRecord) {
        return res.status(404).json({ message: "Invalid or expired token" });
      }

      // Check if token is expired
      if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
        return res.status(403).json({ message: "Token has expired" });
      }

      if (!tokenRecord.instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      if (tokenRecord.instance.status === 'submitted' || tokenRecord.instance.status === 'approved') {
        return res.status(403).json({ message: "This task has already been submitted" });
      }

      const { responses, completedByName, completedByEmail } = req.body;
      
      // Save final responses
      for (const response of responses) {
        await storage.upsertClientProjectTaskResponse({
          instanceId: tokenRecord.instanceId,
          questionId: response.questionId,
          questionSource: response.questionSource || 'template',
          valueText: response.valueText,
          valueNumber: response.valueNumber,
          valueDate: response.valueDate,
          valueBoolean: response.valueBoolean,
          valueMultiSelect: response.valueMultiSelect,
          valueFile: response.valueFile,
        });
      }

      // Update instance status to submitted
      await storage.updateClientProjectTaskInstance(tokenRecord.instanceId, {
        status: 'submitted',
        submittedAt: new Date(),
        completedByName: completedByName || tokenRecord.recipientName,
        completedByEmail: completedByEmail || tokenRecord.recipientEmail,
      });

      // TODO: Phase 5 - Trigger stage change if configured on template

      res.json({ success: true, message: "Task submitted successfully" });
    } catch (error) {
      console.error("Error submitting task:", error);
      res.status(500).json({ message: "Failed to submit task" });
    }
  });

  // ============================================================================
  // STAFF ACTION ROUTES
  // ============================================================================

  // POST /api/task-instances/:instanceId/resend - Resend task link
  app.post("/api/task-instances/:instanceId/resend", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramInstanceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { instanceId } = req.params;
      const { recipientEmail, recipientName } = req.body;

      const instance = await storage.getClientProjectTaskInstanceById(instanceId);
      if (!instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      if (instance.status === 'submitted') {
        return res.status(400).json({ message: "Cannot resend link for submitted task" });
      }

      // Create a new token (marking as reissued)
      const newToken = await storage.createClientProjectTaskToken({
        instanceId,
        token: nanoid(32),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
        recipientEmail: recipientEmail || instance.currentToken?.recipientEmail,
        recipientName: recipientName || instance.currentToken?.recipientName,
        createdById: req.user.id,
        isReissued: true,
      });

      // Update instance status to sent if it was pending
      if (instance.status === 'pending' || instance.status === 'expired') {
        await storage.updateClientProjectTaskInstance(instanceId, {
          status: 'sent',
          sentAt: new Date(),
        });
      }

      // TODO: Send email notification to recipient

      res.json({ 
        success: true, 
        token: newToken.token,
        message: "New link created successfully" 
      });
    } catch (error) {
      console.error("Error resending task link:", error);
      res.status(500).json({ message: "Failed to resend task link" });
    }
  });

  // POST /api/task-tokens/:tokenId/extend - Extend token expiry
  app.post("/api/task-tokens/:tokenId/extend", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const tokenId = req.params.tokenId;
      const { additionalDays } = req.body;

      if (!additionalDays || additionalDays < 1 || additionalDays > 30) {
        return res.status(400).json({ message: "Invalid additional days (must be 1-30)" });
      }

      const token = await storage.getClientProjectTaskTokenById(tokenId);
      if (!token) {
        return res.status(404).json({ message: "Token not found" });
      }

      // Calculate new expiry date
      const currentExpiry = token.expiresAt ? new Date(token.expiresAt) : new Date();
      const newExpiry = new Date(currentExpiry.getTime() + additionalDays * 24 * 60 * 60 * 1000);

      await storage.updateClientProjectTaskToken(tokenId, {
        expiresAt: newExpiry,
      });

      res.json({ 
        success: true, 
        newExpiresAt: newExpiry.toISOString(),
        message: `Token extended by ${additionalDays} days` 
      });
    } catch (error) {
      console.error("Error extending token expiry:", error);
      res.status(500).json({ message: "Failed to extend token expiry" });
    }
  });

  // POST /api/projects/:projectId/task-instances - Create a new task instance with token
  app.post("/api/projects/:projectId/task-instances", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { projectId } = req.params;
      const { templateId, clientId, recipientEmail, recipientName, expiryDays = 7 } = req.body;

      if (!templateId || !clientId) {
        return res.status(400).json({ message: "templateId and clientId are required" });
      }

      // Create the instance
      const instance = await storage.createClientProjectTaskInstance({
        projectId,
        clientId,
        templateId,
        status: 'sent',
        sentAt: new Date(),
      });

      // Create a token for the instance
      const token = await storage.createClientProjectTaskToken({
        instanceId: instance.id,
        token: nanoid(32),
        expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
        recipientEmail,
        recipientName,
        createdById: req.user.id,
        isReissued: false,
      });

      // TODO: Send email notification to recipient

      res.status(201).json({ 
        ...instance, 
        currentToken: token,
        message: "Task created and sent successfully" 
      });
    } catch (error) {
      console.error("Error creating task instance:", error);
      res.status(500).json({ message: "Failed to create task instance" });
    }
  });
}
