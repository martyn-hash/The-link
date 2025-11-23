import type { Express } from "express";
import { storage } from "../storage/index";
import { z } from "zod";
import {
  validateParams,
  paramUuidSchema,
  paramClientIdSchema,
  paramPersonIdSchema,
  resolveEffectiveUser,
  requireAdmin,
  requireManager,
} from "./routeHelpers";
import {
  insertClientRequestTemplateCategorySchema,
  updateClientRequestTemplateCategorySchema,
  insertClientRequestTemplateSchema,
  updateClientRequestTemplateSchema,
  insertClientRequestTemplateSectionSchema,
  updateClientRequestTemplateSectionSchema,
  insertClientRequestTemplateQuestionSchema,
  updateClientRequestTemplateQuestionSchema,
  insertTaskInstanceSchema,
  updateTaskInstanceStatusSchema,
  insertClientCustomRequestSectionSchema,
  updateClientCustomRequestSectionSchema,
  insertClientCustomRequestQuestionSchema,
  updateClientCustomRequestQuestionSchema,
} from "@shared/schema";
import { sendTaskAssignmentEmail } from "../emailService";
import { sendPushNotification } from "../push-service";
import type { PushNotificationPayload } from "../push-service";
import { stopTaskInstanceReminders } from "../notification-scheduler";

export function registerTaskRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // ==================================================
  // CLIENT REQUEST TEMPLATE CATEGORY ROUTES
  // ==================================================

  // GET /api/client-request-template-categories - Get all categories (isAuthenticated)
  app.get("/api/client-request-template-categories", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const categories = await storage.getAllClientRequestTemplateCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching client request template categories:", error);
      res.status(500).json({ message: "Failed to fetch client request template categories" });
    }
  });

  // POST /api/client-request-template-categories - Create category (requireAdmin)
  app.post("/api/client-request-template-categories", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validationResult = insertClientRequestTemplateCategorySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid category data",
          errors: validationResult.error.issues
        });
      }

      const category = await storage.createClientRequestTemplateCategory(validationResult.data);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating client request template category:", error);
      res.status(500).json({ message: "Failed to create client request template category" });
    }
  });

  // PATCH /api/client-request-template-categories/:id - Update category (requireAdmin)
  app.patch("/api/client-request-template-categories/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      const validationResult = updateClientRequestTemplateCategorySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid category data",
          errors: validationResult.error.issues
        });
      }

      const category = await storage.updateClientRequestTemplateCategory(id, validationResult.data);
      if (!category) {
        return res.status(404).json({ message: "Client request template category not found" });
      }

      res.json(category);
    } catch (error) {
      console.error("Error updating client request template category:", error);
      res.status(500).json({ message: "Failed to update client request template category" });
    }
  });

  // DELETE /api/client-request-template-categories/:id - Delete category (requireAdmin)
  app.delete("/api/client-request-template-categories/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      await storage.deleteClientRequestTemplateCategory(id);
      res.json({ message: "Client request template category deleted successfully" });
    } catch (error) {
      console.error("Error deleting client request template category:", error);
      res.status(500).json({ message: "Failed to delete client request template category" });
    }
  });

  // ==================================================
  // CLIENT REQUEST TEMPLATE ROUTES
  // ==================================================

  // GET /api/client-request-templates/active - Get only active templates (must be before /:id route)
  app.get("/api/client-request-templates/active", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const templates = await storage.getActiveClientRequestTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching active client request templates:", error);
      res.status(500).json({ message: "Failed to fetch active client request templates" });
    }
  });

  // GET /api/client-request-templates - Get all templates (defaults to all, use ?activeOnly=true for active only, ?categoryId=uuid for category filter)
  app.get("/api/client-request-templates", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const categoryId = req.query.categoryId as string | undefined;

      let templates = activeOnly
        ? await storage.getActiveClientRequestTemplates()
        : await storage.getAllClientRequestTemplates(true);

      // Filter by category if provided
      if (categoryId) {
        templates = templates.filter(t => t.categoryId === categoryId);
      }

      res.json(templates);
    } catch (error) {
      console.error("Error fetching client request templates:", error);
      res.status(500).json({ message: "Failed to fetch client request templates" });
    }
  });

  // GET /api/client-request-templates/:id - Get specific template by ID
  app.get("/api/client-request-templates/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      const template = await storage.getClientRequestTemplateById(id);
      if (!template) {
        return res.status(404).json({ message: "Client request template not found" });
      }

      res.json(template);
    } catch (error) {
      console.error("Error fetching client request template:", error);
      res.status(500).json({ message: "Failed to fetch client request template" });
    }
  });

  // POST /api/client-request-templates - Create template (requireAdmin)
  app.post("/api/client-request-templates", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validationResult = insertClientRequestTemplateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid template data",
          errors: validationResult.error.issues
        });
      }

      const template = await storage.createClientRequestTemplate(validationResult.data);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating client request template:", error);
      res.status(500).json({ message: "Failed to create client request template" });
    }
  });

  // PATCH /api/client-request-templates/:id - Update template (requireAdmin)
  app.patch("/api/client-request-templates/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      const validationResult = updateClientRequestTemplateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid template data",
          errors: validationResult.error.issues
        });
      }

      const template = await storage.updateClientRequestTemplate(id, validationResult.data);
      if (!template) {
        return res.status(404).json({ message: "Client request template not found" });
      }

      res.json(template);
    } catch (error) {
      console.error("Error updating client request template:", error);
      res.status(500).json({ message: "Failed to update client request template" });
    }
  });

  // DELETE /api/client-request-templates/:id - Delete template (requireAdmin)
  app.delete("/api/client-request-templates/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      await storage.deleteClientRequestTemplate(id);
      res.json({ message: "Client request template deleted successfully" });
    } catch (error) {
      console.error("Error deleting client request template:", error);
      res.status(500).json({ message: "Failed to delete client request template" });
    }
  });

  // ==================================================
  // CLIENT REQUEST TEMPLATE SECTION ROUTES
  // ==================================================

  // GET /api/client-request-templates/:templateId/sections - Get sections for a template
  app.get("/api/client-request-templates/:templateId/sections", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, { id: req.params.templateId });
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid template ID",
          errors: paramValidation.errors
        });
      }

      const { templateId } = req.params;

      const sections = await storage.getClientRequestTemplateSectionsByTemplateId(templateId);
      res.json(sections);
    } catch (error) {
      console.error("Error fetching client request template sections:", error);
      res.status(500).json({ message: "Failed to fetch client request template sections" });
    }
  });

  // POST /api/client-request-templates/:templateId/sections - Create section (requireAdmin)
  app.post("/api/client-request-templates/:templateId/sections", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, { id: req.params.templateId });
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid template ID",
          errors: paramValidation.errors
        });
      }

      const { templateId } = req.params;

      const validationResult = insertClientRequestTemplateSectionSchema.safeParse({
        ...req.body,
        templateId
      });
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid section data",
          errors: validationResult.error.issues
        });
      }

      const section = await storage.createClientRequestTemplateSection(validationResult.data);
      res.status(201).json(section);
    } catch (error) {
      console.error("Error creating client request template section:", error);
      res.status(500).json({ message: "Failed to create client request template section" });
    }
  });

  // PATCH /api/task-template-sections/:id - Update section (requireAdmin)
  app.patch("/api/task-template-sections/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      const validationResult = updateClientRequestTemplateSectionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid section data",
          errors: validationResult.error.issues
        });
      }

      const section = await storage.updateClientRequestTemplateSection(id, validationResult.data);
      if (!section) {
        return res.status(404).json({ message: "Client request template section not found" });
      }

      res.json(section);
    } catch (error) {
      console.error("Error updating client request template section:", error);
      res.status(500).json({ message: "Failed to update client request template section" });
    }
  });

  // DELETE /api/task-template-sections/:id - Delete section (requireAdmin)
  app.delete("/api/task-template-sections/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      await storage.deleteClientRequestTemplateSection(id);
      res.json({ message: "Client request template section deleted successfully" });
    } catch (error) {
      console.error("Error deleting client request template section:", error);
      res.status(500).json({ message: "Failed to delete client request template section" });
    }
  });

  // POST /api/task-template-sections/reorder - Update section orders in bulk (requireAdmin)
  app.post("/api/task-template-sections/reorder", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const reorderSchema = z.object({
        sections: z.array(z.object({
          id: z.string().uuid("Invalid section ID format"),
          sortOrder: z.number().int().nonnegative("Sort order must be non-negative")
        })).min(1, "At least one section is required")
      });

      const validationResult = reorderSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid reorder data",
          errors: validationResult.error.issues
        });
      }

      const updates = validationResult.data.sections.map(s => ({ id: s.id, order: s.sortOrder }));
      await storage.updateSectionOrders(updates);
      res.json({ message: "Sections reordered successfully" });
    } catch (error) {
      console.error("Error reordering client request template sections:", error);
      res.status(500).json({ message: "Failed to reorder client request template sections" });
    }
  });

  // ==================================================
  // CLIENT REQUEST TEMPLATE QUESTION ROUTES
  // ==================================================

  // GET /api/client-request-templates/:templateId/questions - Get all questions for a template
  app.get("/api/client-request-templates/:templateId/questions", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, { id: req.params.templateId });
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid template ID",
          errors: paramValidation.errors
        });
      }

      const { templateId } = req.params;

      const questions = await storage.getAllClientRequestTemplateQuestionsByTemplateId(templateId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching client request template questions:", error);
      res.status(500).json({ message: "Failed to fetch client request template questions" });
    }
  });

  // GET /api/task-template-sections/:sectionId/questions - Get questions for a section
  app.get("/api/task-template-sections/:sectionId/questions", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, { id: req.params.sectionId });
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid section ID",
          errors: paramValidation.errors
        });
      }

      const { sectionId } = req.params;

      const questions = await storage.getClientRequestTemplateQuestionsBySectionId(sectionId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching section questions:", error);
      res.status(500).json({ message: "Failed to fetch section questions" });
    }
  });

  // POST /api/task-template-sections/:sectionId/questions - Create question (requireAdmin)
  app.post("/api/task-template-sections/:sectionId/questions", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, { id: req.params.sectionId });
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid section ID",
          errors: paramValidation.errors
        });
      }

      const { sectionId } = req.params;

      const validationResult = insertClientRequestTemplateQuestionSchema.safeParse({
        ...req.body,
        sectionId
      });
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid question data",
          errors: validationResult.error.issues
        });
      }

      const question = await storage.createClientRequestTemplateQuestion(validationResult.data);
      res.status(201).json(question);
    } catch (error) {
      console.error("Error creating client request template question:", error);
      res.status(500).json({ message: "Failed to create client request template question" });
    }
  });

  // PATCH /api/task-template-questions/:id - Update question (requireAdmin)
  app.patch("/api/task-template-questions/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      const validationResult = updateClientRequestTemplateQuestionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid question data",
          errors: validationResult.error.issues
        });
      }

      const question = await storage.updateClientRequestTemplateQuestion(id, validationResult.data);
      if (!question) {
        return res.status(404).json({ message: "Client request template question not found" });
      }

      res.json(question);
    } catch (error) {
      console.error("Error updating client request template question:", error);
      res.status(500).json({ message: "Failed to update client request template question" });
    }
  });

  // DELETE /api/task-template-questions/:id - Delete question (requireAdmin)
  app.delete("/api/task-template-questions/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      await storage.deleteClientRequestTemplateQuestion(id);
      res.json({ message: "Client request template question deleted successfully" });
    } catch (error) {
      console.error("Error deleting client request template question:", error);
      res.status(500).json({ message: "Failed to delete client request template question" });
    }
  });

  // POST /api/task-template-questions/reorder - Update question orders in bulk (requireAdmin)
  app.post("/api/task-template-questions/reorder", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const reorderSchema = z.object({
        questions: z.array(z.object({
          id: z.string().uuid("Invalid question ID format"),
          sortOrder: z.number().int().nonnegative("Sort order must be non-negative")
        })).min(1, "At least one question is required")
      });

      const validationResult = reorderSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid reorder data",
          errors: validationResult.error.issues
        });
      }

      const updates = validationResult.data.questions.map(q => ({ id: q.id, order: q.sortOrder }));
      await storage.updateQuestionOrders(updates);
      res.json({ message: "Questions reordered successfully" });
    } catch (error) {
      console.error("Error reordering client request template questions:", error);
      res.status(500).json({ message: "Failed to reorder client request template questions" });
    }
  });

  // ==================================================
  // CUSTOM CLIENT REQUEST ROUTES
  // ==================================================

  // POST /api/clients/:clientId/custom-requests - Create custom request for a client (requireAdmin)
  app.post("/api/clients/:clientId/custom-requests", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      const { name, description, sections } = req.body;

      const requestData = {
        clientId,
        name,
        description,
        createdBy: req.user.effectiveUserId
      };

      const request = await storage.createClientCustomRequest(requestData);

      if (sections && Array.isArray(sections)) {
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          const createdSection = await storage.createClientCustomRequestSection({
            requestId: request.id,
            title: section.title,
            description: section.description,
            order: i
          });

          if (section.questions && Array.isArray(section.questions)) {
            for (let j = 0; j < section.questions.length; j++) {
              const question = section.questions[j];
              await storage.createClientCustomRequestQuestion({
                sectionId: createdSection.id,
                questionType: question.questionType,
                label: question.label,
                helpText: question.helpText,
                isRequired: question.isRequired || false,
                order: j,
                options: question.options,
                validationRules: question.validationRules,
                conditionalLogic: question.conditionalLogic
              });
            }
          }
        }
      }

      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating custom request:", error);
      res.status(500).json({ message: "Failed to create custom request" });
    }
  });

  // GET /api/clients/:clientId/custom-requests - Get all custom requests for a client (isAuthenticated)
  app.get("/api/clients/:clientId/custom-requests", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      const requests = await storage.getClientCustomRequestsByClientId(clientId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching custom requests:", error);
      res.status(500).json({ message: "Failed to fetch custom requests" });
    }
  });

  // GET /api/custom-requests/:id/full - Get custom request with sections and questions (isAuthenticated)
  app.get("/api/custom-requests/:id/full", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const request = await storage.getClientCustomRequestById(id);
      if (!request) {
        return res.status(404).json({ message: "Custom request not found" });
      }

      const sections = await storage.getClientCustomRequestSectionsByRequestId(id);

      const sectionsWithQuestions = await Promise.all(
        sections.map(async (section) => {
          const questions = await storage.getClientCustomRequestQuestionsBySectionId(section.id);
          return { ...section, questions };
        })
      );

      res.json({
        ...request,
        sections: sectionsWithQuestions
      });
    } catch (error) {
      console.error("Error fetching custom request details:", error);
      res.status(500).json({ message: "Failed to fetch custom request details" });
    }
  });

  // PATCH /api/custom-requests/:id - Update custom request (requireAdmin)
  app.patch("/api/custom-requests/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const updated = await storage.updateClientCustomRequest(id, { name, description });
      res.json(updated);
    } catch (error) {
      console.error("Error updating custom request:", error);
      res.status(500).json({ message: "Failed to update custom request" });
    }
  });

  // DELETE /api/custom-requests/:id - Delete custom request (requireAdmin)
  app.delete("/api/custom-requests/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deleteClientCustomRequest(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom request:", error);
      res.status(500).json({ message: "Failed to delete custom request" });
    }
  });

  // POST /api/custom-requests/:requestId/sections - Create section (requireAdmin)
  app.post("/api/custom-requests/:requestId/sections", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { requestId } = req.params;

      const validationResult = insertClientCustomRequestSectionSchema.safeParse({
        ...req.body,
        requestId
      });
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid section data",
          errors: validationResult.error.issues
        });
      }

      const section = await storage.createClientCustomRequestSection(validationResult.data);
      res.status(201).json(section);
    } catch (error) {
      console.error("Error creating custom request section:", error);
      res.status(500).json({ message: "Failed to create custom request section" });
    }
  });

  // GET /api/custom-requests/:requestId/sections - Get all sections (isAuthenticated)
  app.get("/api/custom-requests/:requestId/sections", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { requestId } = req.params;
      const sections = await storage.getClientCustomRequestSectionsByRequestId(requestId);
      res.json(sections);
    } catch (error) {
      console.error("Error fetching custom request sections:", error);
      res.status(500).json({ message: "Failed to fetch custom request sections" });
    }
  });

  // PATCH /api/custom-request-sections/:id - Update section (requireAdmin)
  app.patch("/api/custom-request-sections/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const validationResult = updateClientCustomRequestSectionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid section data",
          errors: validationResult.error.issues
        });
      }

      const section = await storage.updateClientCustomRequestSection(id, validationResult.data);
      res.json(section);
    } catch (error) {
      console.error("Error updating custom request section:", error);
      res.status(500).json({ message: "Failed to update custom request section" });
    }
  });

  // DELETE /api/custom-request-sections/:id - Delete section (requireAdmin)
  app.delete("/api/custom-request-sections/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deleteClientCustomRequestSection(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom request section:", error);
      res.status(500).json({ message: "Failed to delete custom request section" });
    }
  });

  // PATCH /api/custom-request-sections/reorder - Reorder sections (requireAdmin)
  app.patch("/api/custom-request-sections/reorder", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { updates } = req.body;
      await storage.updateCustomRequestSectionOrders(updates);
      res.status(204).send();
    } catch (error) {
      console.error("Error reordering custom request sections:", error);
      res.status(500).json({ message: "Failed to reorder custom request sections" });
    }
  });

  // POST /api/custom-request-sections/:sectionId/questions - Create question (requireAdmin)
  app.post("/api/custom-request-sections/:sectionId/questions", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { sectionId } = req.params;

      const validationResult = insertClientCustomRequestQuestionSchema.safeParse({
        ...req.body,
        sectionId
      });
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid question data",
          errors: validationResult.error.issues
        });
      }

      const question = await storage.createClientCustomRequestQuestion(validationResult.data);
      res.status(201).json(question);
    } catch (error) {
      console.error("Error creating custom request question:", error);
      res.status(500).json({ message: "Failed to create custom request question" });
    }
  });

  // GET /api/custom-request-sections/:sectionId/questions - Get all questions for section (isAuthenticated)
  app.get("/api/custom-request-sections/:sectionId/questions", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { sectionId } = req.params;
      const questions = await storage.getClientCustomRequestQuestionsBySectionId(sectionId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching custom request questions:", error);
      res.status(500).json({ message: "Failed to fetch custom request questions" });
    }
  });

  // PATCH /api/custom-request-questions/:id - Update question (requireAdmin)
  app.patch("/api/custom-request-questions/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const validationResult = updateClientCustomRequestQuestionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid question data",
          errors: validationResult.error.issues
        });
      }

      const question = await storage.updateClientCustomRequestQuestion(id, validationResult.data);
      res.json(question);
    } catch (error) {
      console.error("Error updating custom request question:", error);
      res.status(500).json({ message: "Failed to update custom request question" });
    }
  });

  // DELETE /api/custom-request-questions/:id - Delete question (requireAdmin)
  app.delete("/api/custom-request-questions/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deleteClientCustomRequestQuestion(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom request question:", error);
      res.status(500).json({ message: "Failed to delete custom request question" });
    }
  });

  // PATCH /api/custom-request-questions/reorder - Reorder questions (requireAdmin)
  app.patch("/api/custom-request-questions/reorder", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { updates } = req.body;
      await storage.updateCustomRequestQuestionOrders(updates);
      res.status(204).send();
    } catch (error) {
      console.error("Error reordering custom request questions:", error);
      res.status(500).json({ message: "Failed to reorder custom request questions" });
    }
  });

  // ==================================================
  // TASK INSTANCE ROUTES
  // ==================================================

  // GET /api/task-instances - Get all task instances with enriched data (isAuthenticated)
  app.get("/api/task-instances", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { status, clientId, personId, categoryId, search, page = '1', limit = '50' } = req.query;

      // Parse status filter - can be comma-separated list
      const statusFilters = status ? (status as string).split(',').map(s => s.trim()) : undefined;

      // Get all task instances - we'll need to fetch without status filter first, then filter
      const allInstances = await storage.getAllTaskInstances({
        clientId: clientId as string | undefined
      });

      // Filter by status if provided (supports multiple statuses)
      let filteredInstances = allInstances;
      if (statusFilters && statusFilters.length > 0) {
        filteredInstances = allInstances.filter(instance => statusFilters.includes(instance.status));
      }

      // Filter by personId if provided
      if (personId) {
        filteredInstances = filteredInstances.filter(instance => instance.personId === personId);
      }

      // Enrich instances with related data
      const enrichedInstances = await Promise.all(
        filteredInstances.map(async (instance) => {
          const [client, person, assignedByUser, template, customRequest] = await Promise.all([
            instance.clientId ? storage.getClientById(instance.clientId) : null,
            instance.personId ? storage.getPersonById(instance.personId) : null,
            instance.assignedBy ? storage.getUser(instance.assignedBy) : null,
            instance.templateId ? storage.getClientRequestTemplateById(instance.templateId) : null,
            instance.customRequestId ? storage.getClientCustomRequestById(instance.customRequestId) : null,
          ]);

          // Get category from template
          let category = null;
          if (template?.categoryId) {
            category = await storage.getTaskTemplateCategoryById(template.categoryId);
          }

          // Calculate progress if in_progress
          let progressData = null;
          if (instance.status === 'in_progress') {
            const responses = await storage.getTaskInstanceResponsesByTaskInstanceId(instance.id);
            const fullData = await storage.getTaskInstanceWithFullData(instance.id);
            // Count total questions from all sections
            const totalQuestions = fullData?.sections?.reduce((total: number, section: any) => {
              return total + (section.questions?.length || 0);
            }, 0) || 0;
            const answeredQuestions = responses.length;
            const percentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
            progressData = {
              total: totalQuestions,
              completed: answeredQuestions,
              percentage: percentage
            };
          }

          return {
            ...instance,
            clientName: client?.name || 'Unknown Client',
            personName: person?.fullName || null,
            assignedByName: assignedByUser ? `${assignedByUser.firstName || ''} ${assignedByUser.lastName || ''}`.trim() : null,
            requestName: template?.name || customRequest?.name || 'Unnamed Request',
            categoryName: category?.name || null,
            categoryId: category?.id || null,
            progress: progressData
          };
        })
      );

      // Filter by category if provided
      let finalInstances = enrichedInstances;
      if (categoryId) {
        finalInstances = enrichedInstances.filter(instance => instance.categoryId === categoryId);
      }

      // Filter by search term if provided
      if (search) {
        const searchLower = (search as string).toLowerCase();
        finalInstances = finalInstances.filter(instance =>
          instance.requestName?.toLowerCase().includes(searchLower) ||
          instance.clientName?.toLowerCase().includes(searchLower) ||
          instance.personName?.toLowerCase().includes(searchLower)
        );
      }

      // Sort by created date, newest first
      finalInstances.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      // Apply pagination
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedInstances = finalInstances.slice(startIndex, endIndex);

      // Extract unique filter options from ALL instances (before pagination)
      const uniqueClients = new Map<string, string>();
      const uniquePeople = new Map<string, string>();
      const uniqueCategories = new Map<string, string>();

      finalInstances.forEach(instance => {
        if (instance.clientId && instance.clientName) {
          uniqueClients.set(instance.clientId, instance.clientName);
        }
        if (instance.personId && instance.personName) {
          uniquePeople.set(instance.personId, instance.personName);
        }
        if (instance.categoryId && instance.categoryName) {
          uniqueCategories.set(instance.categoryId, instance.categoryName);
        }
      });

      res.json({
        data: paginatedInstances,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: finalInstances.length,
          totalPages: Math.ceil(finalInstances.length / limitNum)
        },
        filterOptions: {
          clients: Array.from(uniqueClients.entries()).map(([id, name]) => ({ id, name })),
          people: Array.from(uniquePeople.entries()).map(([id, name]) => ({ id, name })),
          categories: Array.from(uniqueCategories.entries()).map(([id, name]) => ({ id, name }))
        }
      });
    } catch (error) {
      console.error("Error fetching task instances:", error);
      res.status(500).json({ message: "Failed to fetch task instances" });
    }
  });

  // POST /api/task-instances - Create a new task instance (requireAdmin)
  app.post("/api/task-instances", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validationResult = insertTaskInstanceSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid task instance data",
          errors: validationResult.error.issues
        });
      }

      const { templateId, customRequestId, clientId, personId, dueDate } = validationResult.data;

      // Verify template or custom request exists
      if (templateId) {
        const template = await storage.getClientRequestTemplateById(templateId);
        if (!template) {
          return res.status(404).json({ message: "Client request template not found" });
        }
      } else if (customRequestId) {
        const customRequest = await storage.getClientCustomRequestById(customRequestId);
        if (!customRequest) {
          return res.status(404).json({ message: "Custom request not found" });
        }
      }

      // Verify client exists
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Verify person exists if provided and get their portal user if they have one
      const taskData: any = {
        ...validationResult.data,
        assignedBy: req.user.id,
      };

      if (personId) {
        const person = await storage.getPersonById(personId);
        if (!person) {
          return res.status(404).json({ message: "Person not found" });
        }

        // Check for duplicate incomplete task instances (same template OR same custom request)
        // Note: Schema validation ensures either templateId OR customRequestId is set (not both, not neither)
        const existingInstances = await storage.getTaskInstancesByPersonId(personId);
        const duplicateInstance = existingInstances.find(instance => {
          const isIncomplete = instance.status !== 'submitted' &&
                               instance.status !== 'approved' &&
                               instance.status !== 'cancelled';

          if (!isIncomplete) return false;

          // Check if it's the same template (for template-based tasks)
          if (templateId && instance.templateId === templateId) return true;

          // Check if it's the same custom request (for custom request-based tasks)
          if (customRequestId && instance.customRequestId === customRequestId) return true;

          return false;
        });

        if (duplicateInstance) {
          // Determine appropriate message based on which ID is set
          let message = "This person already has an incomplete task. Please complete or cancel the existing task before creating a new one.";
          if (templateId) {
            message = "This person already has an incomplete task for this template. Please complete or cancel the existing task before creating a new one.";
          } else if (customRequestId) {
            message = "This person already has an incomplete task for this custom request. Please complete or cancel the existing task before creating a new one.";
          }

          return res.status(400).json({
            message,
            existingInstanceId: duplicateInstance.id
          });
        }

        // Check if this person has a portal user account
        const portalUser = await storage.getClientPortalUserByPersonId(personId);
        if (portalUser) {
          taskData.clientPortalUserId = portalUser.id;
        }
      }

      const instance = await storage.createTaskInstance(taskData);

      // Send notifications to the assigned person
      if (personId) {
        try {
          const person = await storage.getPersonById(personId);
          if (person) {
            // Get task description from template or custom request
            let taskDescription = "New task assigned";
            if (templateId) {
              const template = await storage.getClientRequestTemplateById(templateId);
              if (template) {
                taskDescription = template.name;
              }
            } else if (customRequestId) {
              const customRequest = await storage.getClientCustomRequestById(customRequestId);
              if (customRequest) {
                taskDescription = customRequest.name;
              }
            }

            // Send email notification if person has an email
            if (person.email && person.fullName) {
              try {
                await sendTaskAssignmentEmail(
                  person.email,
                  person.fullName,
                  taskDescription,
                  client.name || client.companyNumber || "Unknown Client",
                  "not_started"
                );
                console.log(`Task assignment email sent to ${person.email}`);
              } catch (emailError) {
                console.error("Failed to send task assignment email:", emailError);
                // Don't fail the task creation if email fails
              }
            }

            // Send push notification if portal user exists and has subscriptions
            if (taskData.clientPortalUserId) {
              try {
                const portalUser = await storage.getClientPortalUserById(taskData.clientPortalUserId);
                if (portalUser?.pushNotificationsEnabled) {
                  const subscriptions = await storage.getPushSubscriptionsByClientPortalUserId(taskData.clientPortalUserId);
                  
                  if (subscriptions.length > 0) {
                    const payload: PushNotificationPayload = {
                      title: "New Task Assigned",
                      body: taskDescription,
                      icon: "/pwa-icon-192.png",
                      badge: "/pwa-icon-192.png",
                      tag: `task-${instance.id}`,
                      url: `/portal/tasks/${instance.id}`
                    };

                    for (const subscription of subscriptions) {
                      try {
                        await sendPushNotification(
                          {
                            endpoint: subscription.endpoint,
                            keys: subscription.keys as { p256dh: string; auth: string }
                          },
                          payload
                        );
                      } catch (pushError: any) {
                        console.error("Failed to send push notification:", pushError);
                        // Clean up expired subscriptions
                        if (pushError.message === 'SUBSCRIPTION_EXPIRED') {
                          await storage.deletePushSubscription(subscription.endpoint);
                        }
                      }
                    }
                    console.log(`Push notifications sent for task ${instance.id}`);
                  }
                }
              } catch (pushError) {
                console.error("Failed to send push notifications:", pushError);
                // Don't fail the task creation if push fails
              }
            }
          }
        } catch (notificationError) {
          console.error("Error sending notifications:", notificationError);
          // Don't fail the task creation if notifications fail
        }
      }

      res.status(201).json(instance);
    } catch (error) {
      console.error("Error creating task instance:", error);
      res.status(500).json({ message: "Failed to create task instance" });
    }
  });

  // GET /api/task-instances/client/:clientId - Get all instances for a specific client (requireAdmin)
  app.get("/api/task-instances/client/:clientId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientId } = req.params;

      const instances = await storage.getTaskInstancesByClientId(clientId);

      // Enrich instances with category and progress data
      const enrichedInstances = await Promise.all(
        instances.map(async (instance) => {
          const [person, template, customRequest] = await Promise.all([
            instance.personId ? storage.getPersonById(instance.personId) : null,
            instance.templateId ? storage.getClientRequestTemplateById(instance.templateId) : null,
            instance.customRequestId ? storage.getClientCustomRequestById(instance.customRequestId) : null,
          ]);

          // Get category from template
          let category = null;
          if (template?.categoryId) {
            category = await storage.getTaskTemplateCategoryById(template.categoryId);
          }

          // Calculate progress if in_progress
          let progressData = null;
          if (instance.status === 'in_progress') {
            const responses = await storage.getTaskInstanceResponsesByTaskInstanceId(instance.id);
            const fullData = await storage.getTaskInstanceWithFullData(instance.id);
            // Count total questions from all sections
            const totalQuestions = fullData?.sections?.reduce((total: number, section: any) => {
              return total + (section.questions?.length || 0);
            }, 0) || 0;
            const answeredQuestions = responses.length;
            const percentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
            progressData = {
              total: totalQuestions,
              completed: answeredQuestions,
              percentage: percentage
            };
          }

          return {
            ...instance,
            relatedPerson: person,
            template,
            customRequest,
            categoryName: category?.name || null,
            categoryId: category?.id || null,
            progress: progressData
          };
        })
      );

      res.json(enrichedInstances);
    } catch (error) {
      console.error("Error fetching task instances by client:", error);
      res.status(500).json({ message: "Failed to fetch task instances" });
    }
  });

  // GET /api/task-instances/person/:personId - Get all instances assigned to a person (isAuthenticated)
  app.get("/api/task-instances/person/:personId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramPersonIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { personId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const originalUser = await storage.getUser(req.user.id);

      // Authorization: Admins can access all, non-admins can only access their own
      if (!originalUser?.isAdmin) {
        // For non-admins, we would need to verify they have access to this person
        // This would require additional logic to check if the user is associated with the person
        // For now, we'll allow all authenticated users to access person instances
        // In a production system, you'd add more granular checks here
      }

      const instances = await storage.getTaskInstancesByPersonId(personId);
      res.json(instances);
    } catch (error) {
      console.error("Error fetching task instances by person:", error);
      res.status(500).json({ message: "Failed to fetch task instances" });
    }
  });

  // GET /api/task-instances/:id - Get specific instance with template details (isAuthenticated)
  app.get("/api/task-instances/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;
      const originalUser = await storage.getUser(req.user.id);

      const instance = await storage.getTaskInstanceById(id);
      if (!instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      // Authorization check: Admins can access all, others need to be assigned
      if (!originalUser?.isAdmin) {
        // Check if the user has access to this instance
        // For portal users, check clientPortalUserId
        // For regular users, we'd need additional checks
        // For now, allowing authenticated users to access
      }

      // Get full instance data with template details
      const fullInstance = await storage.getTaskInstanceWithFullData(id);
      res.json(fullInstance || instance);
    } catch (error) {
      console.error("Error fetching task instance:", error);
      res.status(500).json({ message: "Failed to fetch task instance" });
    }
  });

  // PATCH /api/task-instances/:id/status - Update instance status (isAuthenticated)
  app.patch("/api/task-instances/:id/status", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      const validationResult = updateTaskInstanceStatusSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid status data",
          errors: validationResult.error.issues
        });
      }

      const originalUser = await storage.getUser(req.user.id);
      const instance = await storage.getTaskInstanceById(id);

      if (!instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      // Authorization check
      if (!originalUser?.isAdmin) {
        // Non-admins can only update instances assigned to them
        // Additional checks would be needed here for production
      }

      const { status } = validationResult.data;
      const updateData: any = { status };

      // Update timestamps based on status
      if (status === "submitted" && !instance.submittedAt) {
        updateData.submittedAt = new Date();
      } else if (status === "approved" && !instance.approvedAt) {
        updateData.approvedAt = new Date();
        updateData.approvedBy = req.user.id;
      }

      const updated = await storage.updateTaskInstance(id, updateData);

      // Stop reminders if task is cancelled or if stopReminders flag is set
      if (status === 'cancelled' || req.body.stopReminders === true) {
        try {
          await stopTaskInstanceReminders(id, req.user?.id || 'staff', 'staff_cancelled');
        } catch (reminderError) {
          console.error('[Notifications] Error stopping reminders:', reminderError);
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating task instance status:", error);
      res.status(500).json({ message: "Failed to update task instance status" });
    }
  });

  // DELETE /api/task-instances/:id - Delete instance (requireAdmin)
  app.delete("/api/task-instances/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      const instance = await storage.getTaskInstanceById(id);
      if (!instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      await storage.deleteTaskInstance(id);
      res.json({ message: "Task instance deleted successfully" });
    } catch (error) {
      console.error("Error deleting task instance:", error);
      res.status(500).json({ message: "Failed to delete task instance" });
    }
  });

  // ==================================================
  // TASK INSTANCE RESPONSE ROUTES
  // ==================================================

  // POST /api/task-instances/:instanceId/responses - Save or update responses (isAuthenticated)
  app.post("/api/task-instances/:instanceId/responses", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(z.object({ instanceId: z.string().uuid() }), req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { instanceId } = req.params;
      const originalUser = await storage.getUser(req.user.id);

      // Verify instance exists
      const instance = await storage.getTaskInstanceById(instanceId);
      if (!instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      // Authorization check
      if (!originalUser?.isAdmin) {
        // Non-admins can only update responses for instances assigned to them
      }

      // Validate responses array
      const responsesSchema = z.array(z.object({
        questionId: z.string().uuid("Invalid question ID"),
        value: z.string().optional(),
        fileUrls: z.array(z.string()).optional(),
      }));

      const validationResult = responsesSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid responses data",
          errors: validationResult.error.issues
        });
      }

      const responses = validationResult.data;

      // Save responses using bulk save
      const responsesToSave = responses.map(r => ({
        taskInstanceId: instanceId,
        questionId: r.questionId,
        responseValue: r.value || null,
        fileUrls: r.fileUrls || null,
      }));

      await storage.bulkSaveTaskInstanceResponses(instanceId, responsesToSave);

      // Fetch and return all responses
      const savedResponses = await storage.getTaskInstanceResponsesByTaskInstanceId(instanceId);
      res.json(savedResponses);
    } catch (error) {
      console.error("Error saving task instance responses:", error);
      res.status(500).json({ message: "Failed to save task instance responses" });
    }
  });

  // GET /api/task-instances/:instanceId/responses - Get all responses for an instance (isAuthenticated)
  app.get("/api/task-instances/:instanceId/responses", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(z.object({ instanceId: z.string().uuid() }), req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { instanceId } = req.params;
      const originalUser = await storage.getUser(req.user.id);

      // Verify instance exists
      const instance = await storage.getTaskInstanceById(instanceId);
      if (!instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      // Authorization check
      if (!originalUser?.isAdmin) {
        // Non-admins can only view responses for instances assigned to them
      }

      const responses = await storage.getTaskInstanceResponsesByTaskInstanceId(instanceId);
      res.json(responses);
    } catch (error) {
      console.error("Error fetching task instance responses:", error);
      res.status(500).json({ message: "Failed to fetch task instance responses" });
    }
  });

  // GET /api/task-instances/:instanceId/full - Get instance with all template data, sections, questions, and responses (isAuthenticated)
  app.get("/api/task-instances/:instanceId/full", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(z.object({ instanceId: z.string().uuid() }), req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { instanceId } = req.params;
      const originalUser = await storage.getUser(req.user.id);

      // Verify instance exists
      const instance = await storage.getTaskInstanceById(instanceId);
      if (!instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      // Authorization check
      if (!originalUser?.isAdmin) {
        // Non-admins can only view full data for instances assigned to them
      }

      const fullInstance = await storage.getTaskInstanceWithFullData(instanceId);
      if (!fullInstance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      res.json(fullInstance);
    } catch (error) {
      console.error("Error fetching full task instance:", error);
      res.status(500).json({ message: "Failed to fetch full task instance" });
    }
  });
}
