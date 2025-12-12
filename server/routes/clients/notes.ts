import type { Express } from "express";
import { storage } from "../../storage/index";
import { z } from "zod";
import { validateParams } from "../routeHelpers";
import { insertClientNoteSchema, updateClientNoteSchema } from "@shared/schema";

export function registerClientNotesRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  const clientIdSchema = z.object({
    clientId: z.string().min(1, "Client ID is required"),
  });

  const noteIdSchema = z.object({
    noteId: z.string().min(1, "Note ID is required"),
  });

  const projectIdSchema = z.object({
    projectId: z.string().min(1, "Project ID is required"),
  });

  app.get(
    "/api/clients/:clientId/notes",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const paramValidation = validateParams(clientIdSchema, req.params);
        if (!paramValidation.success) {
          return res.status(400).json({
            message: "Invalid path parameters",
            errors: paramValidation.errors,
          });
        }

        const { clientId } = paramValidation.data;
        const filter = req.query.filter as string | undefined;
        const filterType = req.query.filterType as 'project' | 'projectType' | undefined;
        const notes = await storage.getClientNotesByClientId(clientId, filter, filterType);
        res.json(notes);
      } catch (error) {
        console.error(
          "Error fetching client notes:",
          error instanceof Error ? error.message : error
        );
        res.status(500).json({ message: "Failed to fetch client notes" });
      }
    }
  );

  app.get(
    "/api/projects/:projectId/notes",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const paramValidation = validateParams(projectIdSchema, req.params);
        if (!paramValidation.success) {
          return res.status(400).json({
            message: "Invalid path parameters",
            errors: paramValidation.errors,
          });
        }

        const { projectId } = paramValidation.data;
        const notes = await storage.getClientNotesByProjectId(projectId);
        res.json(notes);
      } catch (error) {
        console.error(
          "Error fetching project notes:",
          error instanceof Error ? error.message : error
        );
        res.status(500).json({ message: "Failed to fetch project notes" });
      }
    }
  );

  app.get(
    "/api/notes/:noteId",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const paramValidation = validateParams(noteIdSchema, req.params);
        if (!paramValidation.success) {
          return res.status(400).json({
            message: "Invalid path parameters",
            errors: paramValidation.errors,
          });
        }

        const { noteId } = paramValidation.data;
        const note = await storage.getClientNoteById(noteId);

        if (!note) {
          return res.status(404).json({ message: "Note not found" });
        }

        res.json(note);
      } catch (error) {
        console.error(
          "Error fetching note:",
          error instanceof Error ? error.message : error
        );
        res.status(500).json({ message: "Failed to fetch note" });
      }
    }
  );

  app.get(
    "/api/notes/:noteId/changelog",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const paramValidation = validateParams(noteIdSchema, req.params);
        if (!paramValidation.success) {
          return res.status(400).json({
            message: "Invalid path parameters",
            errors: paramValidation.errors,
          });
        }

        const { noteId } = paramValidation.data;
        const changelog = await (storage as any).auditChangelogStorage.getChangelogByEntity('client_note', noteId);
        res.json(changelog);
      } catch (error) {
        console.error(
          "Error fetching note changelog:",
          error instanceof Error ? error.message : error
        );
        res.status(500).json({ message: "Failed to fetch note changelog" });
      }
    }
  );

  app.post(
    "/api/clients/:clientId/notes",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const paramValidation = validateParams(clientIdSchema, req.params);
        if (!paramValidation.success) {
          return res.status(400).json({
            message: "Invalid path parameters",
            errors: paramValidation.errors,
          });
        }

        const { clientId } = paramValidation.data;
        const userId = req.user?.effectiveUserId || req.user?.id;

        if (!userId) {
          return res.status(401).json({ message: "User ID not found" });
        }

        const noteData = {
          ...req.body,
          clientId,
          createdByUserId: userId,
        };

        const validationResult = insertClientNoteSchema.safeParse(noteData);
        if (!validationResult.success) {
          return res.status(400).json({
            message: "Invalid note data",
            errors: validationResult.error.issues,
          });
        }

        const note = await storage.createClientNote(validationResult.data);

        if (note.projectId) {
          try {
            await storage.projectChronologyStorage.createChronologyEntry({
              projectId: note.projectId,
              entryType: 'note',
              fromStatus: null,
              toStatus: 'no_change',
              changedById: userId,
              notes: `Note added: ${note.title}`,
            });
          } catch (chronologyError) {
            console.error("Error creating chronology entry for note:", chronologyError);
          }
        }

        res.status(201).json(note);
      } catch (error) {
        console.error(
          "Error creating note:",
          error instanceof Error ? error.message : error
        );
        res.status(500).json({ message: "Failed to create note" });
      }
    }
  );

  app.patch(
    "/api/notes/:noteId",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const paramValidation = validateParams(noteIdSchema, req.params);
        if (!paramValidation.success) {
          return res.status(400).json({
            message: "Invalid path parameters",
            errors: paramValidation.errors,
          });
        }

        const { noteId } = paramValidation.data;
        const userId = req.user?.effectiveUserId || req.user?.id;

        if (!userId) {
          return res.status(401).json({ message: "User ID not found" });
        }

        const existingNote = await storage.getClientNoteById(noteId);
        if (!existingNote) {
          return res.status(404).json({ message: "Note not found" });
        }

        const validationResult = updateClientNoteSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            message: "Invalid note data",
            errors: validationResult.error.issues,
          });
        }

        const beforeValue = {
          title: existingNote.title,
          content: existingNote.content,
          attachments: existingNote.attachments,
        };

        const note = await storage.updateClientNote(
          noteId,
          validationResult.data
        );

        const afterValue = {
          title: note.title,
          content: note.content,
          attachments: note.attachments,
        };

        try {
          await (storage as any).auditChangelogStorage.createChangelogEntry({
            entityType: 'client_note',
            entityId: noteId,
            changeType: 'edit',
            changedByUserId: userId,
            beforeValue,
            afterValue,
            changeDescription: `Note "${existingNote.title}" was edited`,
          });
        } catch (changelogError) {
          console.error("Error creating changelog entry:", changelogError);
        }

        res.json(note);
      } catch (error) {
        console.error(
          "Error updating note:",
          error instanceof Error ? error.message : error
        );
        if (
          error instanceof Error &&
          error.message.includes("not found")
        ) {
          return res.status(404).json({ message: "Note not found" });
        }
        res.status(500).json({ message: "Failed to update note" });
      }
    }
  );

  app.delete(
    "/api/notes/:noteId",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const paramValidation = validateParams(noteIdSchema, req.params);
        if (!paramValidation.success) {
          return res.status(400).json({
            message: "Invalid path parameters",
            errors: paramValidation.errors,
          });
        }

        const { noteId } = paramValidation.data;
        await storage.deleteClientNote(noteId);
        res.status(204).send();
      } catch (error) {
        console.error(
          "Error deleting note:",
          error instanceof Error ? error.message : error
        );
        if (
          error instanceof Error &&
          error.message.includes("not found")
        ) {
          return res.status(404).json({ message: "Note not found" });
        }
        res.status(500).json({ message: "Failed to delete note" });
      }
    }
  );
}
