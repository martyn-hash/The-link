import type { Express } from "express";
import { storage } from "../../storage/index";
import { z } from "zod";
import { insertPersonSchema } from "@shared/schema";

export function registerClientPeopleRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // GET /api/clients/:id/people - Get people related to a specific client
  app.get("/api/clients/:id/people", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = z.object({
        id: z.string().min(1, "Client ID is required")
      }).safeParse(req.params);

      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID format",
          errors: paramValidation.error.issues
        });
      }

      const { id } = paramValidation.data;

      const client = await storage.getClientById(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const clientPeople = await storage.getClientPeopleByClientId(id);

      const sortedPeople = clientPeople.sort((a, b) => {
        if (a.isPrimaryContact !== b.isPrimaryContact) {
          return b.isPrimaryContact ? 1 : -1;
        }
        return a.person.fullName.localeCompare(b.person.fullName);
      });

      res.status(200).json(sortedPeople);

    } catch (error) {
      console.error("Error fetching client people:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client people" });
    }
  });

  // GET /api/clients/:id/chronology - Get client chronology
  app.get("/api/clients/:id/chronology", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const paramValidation = z.object({
        id: z.string().min(1, "Client ID is required").uuid("Invalid client ID format")
      }).safeParse(req.params);

      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID format",
          errors: paramValidation.error.issues
        });
      }

      const { id: clientId } = paramValidation.data;

      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const chronologyEntries = await storage.getClientChronology(clientId);

      const sanitizedEntries = chronologyEntries.map(entry => ({
        ...entry,
        user: entry.user ? {
          id: entry.user.id,
          firstName: entry.user.firstName,
          lastName: entry.user.lastName,
          email: entry.user.email,
          isAdmin: entry.user.isAdmin,
          canSeeAdminMenu: entry.user.canSeeAdminMenu
        } : undefined
      }));

      res.status(200).json(sanitizedEntries);

    } catch (error) {
      console.error("Error fetching client chronology:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client chronology" });
    }
  });

  // POST /api/clients/:id/people - Add a new person to a client
  app.post("/api/clients/:id/people", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = z.object({
        id: z.string().min(1, "Client ID is required")
      }).safeParse(req.params);

      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID format",
          errors: paramValidation.error.issues
        });
      }

      const { id: clientId } = paramValidation.data;

      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const validationResult = insertPersonSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid person data",
          errors: validationResult.error.issues
        });
      }

      const personData = validationResult.data;

      const newPerson = await storage.createPerson(personData);

      const relationshipId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const clientPersonData = {
        id: relationshipId,
        clientId: clientId,
        personId: newPerson.id,
        isPrimaryContact: false,
        officerRole: null,
      };

      const clientPerson = await storage.createClientPerson(clientPersonData);

      const result = {
        ...clientPerson,
        person: newPerson
      };

      res.status(201).json(result);

    } catch (error) {
      console.error("Error creating person for client:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to create person" });
    }
  });
}
