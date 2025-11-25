import type { Express } from "express";
import { storage } from "../storage/index";
import { z } from "zod";
import {
  validateParams,
  resolveEffectiveUser,
  requireAdmin,
  requireManager,
} from "./routeHelpers";
import {
  insertClientSchema,
  insertPersonSchema,
} from "@shared/schema";
import { registerAllClientRoutes } from "./clients/index";

export function registerClientRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // ==================================================
  // CORE CLIENT CRUD OPERATIONS
  // ==================================================

  // GET /api/clients - Get all clients with optional search
  app.get("/api/clients", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const search = req.query.search as string | undefined;
      const clients = await storage.getAllClients(search);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  // GET /api/clients/:id - Get single client by ID
  app.get("/api/clients/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({
        id: z.string().min(1, "Client ID is required")
      });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = paramValidation.data;
      const client = await storage.getClientById(id);

      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  // POST /api/clients - Create new client (admin only)
  app.post("/api/clients", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validationResult = insertClientSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid client data",
          errors: validationResult.error.issues
        });
      }

      const clientData = validationResult.data;
      const client = await storage.createClient(clientData);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error instanceof Error ? error.message : error);

      if (error instanceof Error && (error.message.includes("duplicate") || error.message.includes("unique"))) {
        return res.status(409).json({
          message: "A client with this name already exists"
        });
      }

      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // PUT /api/clients/:id - Update client (admin only)
  app.put("/api/clients/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({
        id: z.string().min(1, "Client ID is required")
      });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const validationResult = insertClientSchema.partial().safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid client data",
          errors: validationResult.error.issues
        });
      }

      const { id } = req.params;
      const clientData = validationResult.data;

      try {
        const clientServices = await storage.getClientServicesByClientId(id);

        const completenessResults = [];
        for (const clientService of clientServices) {
          const completeness = await storage.validateClientServiceRoleCompleteness(
            id,
            clientService.service.id
          );

          completenessResults.push({
            clientServiceId: clientService.id,
            serviceName: clientService.service.name,
            serviceId: clientService.service.id,
            isComplete: completeness.isComplete,
            missingRoles: completeness.missingRoles,
            assignedRoles: completeness.assignedRoles
          });
        }

        const incompleteServices = completenessResults.filter(result => !result.isComplete);
        if (incompleteServices.length > 0) {
          return res.status(409).json({
            message: `Cannot update client: ${incompleteServices.length} service(s) have incomplete role assignments`,
            code: "INCOMPLETE_ROLE_ASSIGNMENTS",
            incompleteServices: incompleteServices.map(service => ({
              serviceName: service.serviceName,
              missingRoles: service.missingRoles.map((role: any) => role.name)
            }))
          });
        }
      } catch (completenessError) {
        console.error("Error checking role completeness:", completenessError instanceof Error ? completenessError.message : completenessError);
        return res.status(500).json({
          message: "Could not verify role completeness before update"
        });
      }

      const client = await storage.updateClient(id, clientData);
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (error instanceof Error && (error.message.includes("duplicate") || error.message.includes("unique"))) {
        return res.status(409).json({
          message: "A client with this name already exists"
        });
      }

      res.status(500).json({ message: "Failed to update client" });
    }
  });

  // DELETE /api/clients/:id - Delete client (admin only)
  app.delete("/api/clients/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({
        id: z.string().min(1, "Client ID is required")
      });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;
      await storage.deleteClient(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error instanceof Error ? error.message : error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: "Client not found" });
        }
        if (error.message.includes("has existing projects")) {
          return res.status(409).json({
            message: "Cannot delete client with existing projects",
            code: "CLIENT_HAS_PROJECTS"
          });
        }
      }

      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // POST /api/clients/individual - Create individual client with person
  app.post("/api/clients/individual", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const bodySchema = z.object({
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        email: z.string().email("Valid email address is required"),
        address: z.object({
          line1: z.string().min(1, "Address line 1 is required"),
          line2: z.string().optional(),
          city: z.string().min(1, "Town/City is required"),
          county: z.string().optional(),
          postcode: z.string().min(1, "Postcode is required"),
          country: z.string().default("United Kingdom"),
        }),
      });

      const bodyValidation = bodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: bodyValidation.error.issues
        });
      }

      const { firstName, lastName, email, address } = bodyValidation.data;

      const clientName = `${firstName} ${lastName} - Personal Tax Client`;
      const clientData = {
        name: clientName,
        email: email,
        clientType: 'individual' as const,
        registeredAddress1: address.line1,
        registeredAddress2: address.line2 || null,
        registeredPostcode: address.postcode,
      };

      const client = await storage.createClient(clientData);

      const personData = {
        fullName: `${firstName} ${lastName}`,
        firstName: firstName,
        lastName: lastName,
        email: email,
        addressLine1: address.line1,
        addressLine2: address.line2 || null,
        isMainContact: true,
      };

      const person = await storage.createPerson(personData);

      await storage.linkPersonToClient(
        client.id,
        person.id,
        'Personal Tax Client',
        true
      );

      res.status(201).json({
        client: client,
        person: person,
        message: `Created individual client "${clientName}" with associated person`
      });

    } catch (error) {
      console.error("Error creating individual client:", error instanceof Error ? error.message : error);

      if (error instanceof Error && (error.message.includes("duplicate") || error.message.includes("unique"))) {
        return res.status(409).json({
          message: "A client with this name already exists"
        });
      }

      res.status(500).json({ message: "Failed to create individual client" });
    }
  });

  // ==================================================
  // REGISTER ALL CLIENT DOMAIN ROUTES FROM MODULES
  // ==================================================
  registerAllClientRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
}
