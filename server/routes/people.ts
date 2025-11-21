import type { Express } from "express";
import { storage } from "../storage";
import { z } from "zod";
import {
  insertPersonSchema,
  insertClientSchema,
  insertPeopleTagSchema,
  insertPeopleTagAssignmentSchema,
  insertPeopleServiceSchema,
} from "@shared/schema";
import * as serviceMapper from "../core/service-mapper";
import {
  validateParams,
  parseFullName,
  paramPersonIdSchema,
  paramClientIdSchema,
  paramUuidSchema,
  paramPeopleServiceIdSchema,
  paramServiceIdSchema,
} from "./routeHelpers";

export function registerPeopleRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // ==================================================
  // PEOPLE API ROUTES
  // ==================================================

  // GET /api/people - List all people
  app.get("/api/people", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const people = await storage.getAllPeopleWithPortalStatus();
      res.json(people);
    } catch (error) {
      console.error("Error fetching people:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch people" });
    }
  });

  // GET /api/people/:id - Get single person by ID
  app.get("/api/people/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const personIdSchema = z.object({
        id: z.string().min(1, "Person ID is required")
      });
      const paramValidation = validateParams(personIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid parameters",
          errors: paramValidation.errors
        });
      }

      const person = await storage.getPersonWithDetails(paramValidation.data.id);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      res.json(person);
    } catch (error) {
      console.error("Error fetching person details:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch person details" });
    }
  });

  // PATCH /api/people/:id - Update person
  app.patch("/api/people/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = z.object({
        id: z.string().min(1, "Person ID is required")
      }).safeParse(req.params);

      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid person ID format",
          errors: paramValidation.error.issues
        });
      }

      const { id } = paramValidation.data;

      // Check if person exists
      const existingPerson = await storage.getPersonById(id);
      if (!existingPerson) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Validate request body using the insert schema as partial for updates
      const validationResult = insertPersonSchema.partial().safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid person data",
          errors: validationResult.error.issues
        });
      }

      // Update the person
      const updatedPerson = await storage.updatePerson(id, validationResult.data);

      res.status(200).json(updatedPerson);

    } catch (error) {
      console.error("Error updating person:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to update person" });
    }
  });

  // POST /api/people/match - Find potential duplicate people by name and birth date
  app.post("/api/people/match", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Define the schema for officer matching request
      const officerMatchSchema = z.object({
        officers: z.array(z.object({
          fullName: z.string().min(1, "Full name is required"),
          dateOfBirth: z.object({
            year: z.number().min(1900).max(new Date().getFullYear()),
            month: z.number().min(1).max(12)
          })
        }))
      });

      const validationResult = officerMatchSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid officer matching data",
          errors: validationResult.error.issues
        });
      }

      const { officers } = validationResult.data;

      // Process each officer and find potential matches
      const matches = await Promise.all(
        officers.map(async (officer, index) => {
          const parsedName = parseFullName(officer.fullName);

          // Only search if we have both first and last names
          if (!parsedName.firstName || !parsedName.lastName) {
            return {
              index,
              officer,
              matches: []
            };
          }

          const matchingPeople = await storage.findPeopleByNameAndBirthDate(
            parsedName.firstName,
            parsedName.lastName,
            officer.dateOfBirth.year,
            officer.dateOfBirth.month
          );

          // For each matched person, get their company connections
          const matchesWithCompanies = await Promise.all(
            matchingPeople.map(async (person) => {
              const clientConnections = await storage.getClientPeopleByPersonId(person.id);
              // Filter to company clients only and include useful identifiers for UI
              const companyConnections = clientConnections.filter(c => c.client.clientType === 'company');
              const companies = companyConnections.map(connection => ({
                id: connection.client.id,
                name: connection.client.name,
                number: connection.client.companyNumber,
                role: connection.officerRole
              }));

              return {
                ...person,
                companies
              };
            })
          );

          return {
            index,
            officer: {
              ...officer,
              parsedFirstName: parsedName.firstName,
              parsedLastName: parsedName.lastName
            },
            matches: matchesWithCompanies
          };
        })
      );

      res.status(200).json({ matches });

    } catch (error) {
      console.error("Error finding people matches:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to find people matches" });
    }
  });

  // ==================================================
  // PERSON-COMPANY RELATIONSHIP ROUTES
  // ==================================================

  // GET /api/people/:personId/companies - List all companies for a person
  app.get("/api/people/:personId/companies", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramPersonIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { personId } = paramValidation.data;

      // Verify person exists
      const person = await storage.getPersonById(personId);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Get all client relationships for the person
      const allClientRelationships = await storage.getClientPeopleByPersonId(personId);

      // Filter to only include company clients (not individuals)
      const companyRelationships = allClientRelationships.filter(
        relationship => relationship.client.clientType === 'company'
      );

      res.json(companyRelationships);
    } catch (error) {
      console.error("Error fetching person companies:", error instanceof Error ? error.message : error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message });
        }
      }

      res.status(500).json({ message: "Failed to fetch person companies" });
    }
  });

  // POST /api/people/:personId/companies - Link person to a company
  app.post("/api/people/:personId/companies", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramPersonIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const linkCompanySchema = z.object({
        clientId: z.string().min(1, "Client ID is required").uuid("Invalid client ID format"),
        officerRole: z.string().optional(),
        isPrimaryContact: z.boolean().optional()
      });
      const bodyValidation = linkCompanySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid request body",
          errors: bodyValidation.error.issues
        });
      }

      const { personId } = paramValidation.data;
      const { clientId, officerRole, isPrimaryContact } = bodyValidation.data;

      // Verify person exists
      const person = await storage.getPersonById(personId);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Verify client exists and is a company
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Company client not found" });
      }
      if (client.clientType !== 'company') {
        return res.status(400).json({ message: "Target client must be a company" });
      }

      const clientPerson = await storage.linkPersonToClient(clientId, personId, officerRole, isPrimaryContact);
      res.status(201).json(clientPerson);
    } catch (error) {
      console.error("Error linking person to company:", error instanceof Error ? error.message : error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes("duplicate key") || error.message.includes("already linked")) {
          return res.status(409).json({ message: "Person is already linked to this company" });
        }
        if (error.message.includes("not a company") || error.message.includes("must be")) {
          return res.status(400).json({ message: error.message });
        }
      }

      res.status(500).json({ message: "Failed to link person to company" });
    }
  });

  // DELETE /api/people/:personId/companies/:clientId - Unlink person from a company
  app.delete("/api/people/:personId/companies/:clientId", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(
        paramPersonIdSchema.merge(paramClientIdSchema),
        req.params
      );
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { personId, clientId } = paramValidation.data;

      // Verify person exists
      const person = await storage.getPersonById(personId);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Verify client exists
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Company client not found" });
      }

      await storage.unlinkPersonFromClient(clientId, personId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unlinking person from company:", error instanceof Error ? error.message : error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes("not linked") || error.message.includes("no relationship")) {
          return res.status(404).json({ message: "Person is not linked to this company" });
        }
      }

      res.status(500).json({ message: "Failed to unlink person from company" });
    }
  });

  // POST /api/people/:personId/convert-to-company-client - Convert individual client to company client
  app.post("/api/people/:personId/convert-to-company-client", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramPersonIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const conversionSchema = z.object({
        companyData: insertClientSchema.partial(),
        oldIndividualClientId: z.string().uuid().optional()
      });
      const bodyValidation = conversionSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid request body",
          errors: bodyValidation.error.issues
        });
      }

      const { personId } = paramValidation.data;
      const { companyData, oldIndividualClientId } = bodyValidation.data;

      const result = await storage.convertIndividualToCompanyClient(personId, companyData, oldIndividualClientId);
      res.json(result);
    } catch (error) {
      console.error("Error converting individual to company client:", error instanceof Error ? error.message : error);

      if (error instanceof Error) {
        if (error.message.includes("not found") || error.message.includes("required")) {
          return res.status(400).json({ message: error.message });
        }
        if (error.message.includes("duplicate") || error.message.includes("already exists") || error.message.includes("unique")) {
          return res.status(409).json({ message: "Company with this name or number already exists" });
        }
      }

      res.status(500).json({ message: "Failed to convert individual to company client" });
    }
  });

  // ==================================================
  // PEOPLE TAGS ROUTES
  // ==================================================

  // GET /api/people-tags - List all people tags (admin only)
  app.get("/api/people-tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const tags = await storage.getAllPeopleTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching people tags:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch people tags" });
    }
  });

  // POST /api/people-tags - Create new people tag (admin only)
  app.post("/api/people-tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validatedData = insertPeopleTagSchema.parse(req.body);
      const tag = await storage.createPeopleTag(validatedData);
      res.status(201).json(tag);
    } catch (error) {
      console.error("Error creating people tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to create people tag" });
    }
  });

  // DELETE /api/people-tags/:id - Delete people tag (admin only)
  app.delete("/api/people-tags/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      await storage.deletePeopleTag(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting people tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete people tag" });
    }
  });

  // ==================================================
  // PEOPLE TAG ASSIGNMENTS ROUTES
  // ==================================================

  // GET /api/people/:personId/tags - Get tags assigned to a person
  app.get("/api/people/:personId/tags", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(z.object({ personId: z.string().uuid() }), req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const tags = await storage.getPersonTags(req.params.personId);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching person tags:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch person tags" });
    }
  });

  // POST /api/people/:personId/tags - Assign tag to person (admin only)
  app.post("/api/people/:personId/tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(z.object({ personId: z.string().uuid() }), req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const assignmentData = {
        ...req.body,
        personId: req.params.personId,
        assignedBy: effectiveUserId,
      };

      const validatedData = insertPeopleTagAssignmentSchema.parse(assignmentData);
      const assignment = await storage.assignPersonTag(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning person tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to assign person tag" });
    }
  });

  // DELETE /api/people/:personId/tags/:tagId - Remove tag from person (admin only)
  app.delete("/api/people/:personId/tags/:tagId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const personValidation = validateParams(z.object({ personId: z.string().uuid() }), req.params);
      const tagValidation = validateParams(z.object({ tagId: z.string().uuid() }), req.params);

      if (!personValidation.success) {
        return res.status(400).json({
          message: "Invalid person ID",
          errors: personValidation.errors
        });
      }

      if (!tagValidation.success) {
        return res.status(400).json({
          message: "Invalid tag ID",
          errors: tagValidation.errors
        });
      }

      await storage.unassignPersonTag(req.params.personId, req.params.tagId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unassigning person tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to unassign person tag" });
    }
  });

  // ==================================================
  // PEOPLE SERVICES ROUTES
  // ==================================================

  // GET /api/people-services - List all people services (admin only)
  app.get("/api/people-services", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const peopleServices = await storage.getAllPeopleServices();
      res.json(peopleServices);
    } catch (error) {
      console.error("Error fetching people services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch people services" });
    }
  });

  // GET /api/people-services/person/:personId - Get services for a specific person
  app.get("/api/people-services/person/:personId", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const validation = validateParams(paramPersonIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid person ID", errors: validation.errors });
      }

      const { personId } = validation.data;
      const peopleServices = await storage.getPeopleServicesByPersonId(personId);
      res.json(peopleServices);
    } catch (error) {
      console.error("Error fetching people services by person:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch people services" });
    }
  });

  // GET /api/people-services/service/:serviceId - Get people for a specific service
  app.get("/api/people-services/service/:serviceId", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const validation = validateParams(paramServiceIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid service ID", errors: validation.errors });
      }

      const { serviceId } = validation.data;
      const peopleServices = await storage.getPeopleServicesByServiceId(serviceId);
      res.json(peopleServices);
    } catch (error) {
      console.error("Error fetching people services by service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch people services" });
    }
  });

  // GET /api/people-services/client/:clientId - Get all personal services for people related to a client
  app.get("/api/people-services/client/:clientId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const validation = validateParams(paramClientIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid client ID", errors: validation.errors });
      }

      const { clientId } = validation.data;

      // Check if client exists
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Get all personal services for people related to this client
      const allPeopleServices = await storage.getPeopleServicesByClientId(clientId);

      res.json(allPeopleServices);
    } catch (error) {
      console.error("Error fetching client people services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client people services" });
    }
  });

  // POST /api/people-services - Create a new people service
  // Uses protected service mapper module for all validation and business logic
  app.post("/api/people-services", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate request body using Zod schema
      const validation = insertPeopleServiceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid people service data",
          errors: validation.error.issues
        });
      }

      const peopleServiceData = validation.data;

      // Use protected service mapper module for creation
      try {
        const newPeopleService = await serviceMapper.createPeopleServiceMapping(peopleServiceData);

        // Fetch the complete people service with relations
        const completePeopleService = await storage.getPeopleServiceById(newPeopleService.id);

        console.log(`[Routes] Successfully created people service mapping: ${newPeopleService.id}`);
        return res.status(201).json(completePeopleService);
      } catch (mapperError: any) {
        console.error('[Routes] Service mapper error:', mapperError);

        // Handle specific error types with appropriate HTTP status codes
        if (mapperError.message?.includes('not found')) {
          return res.status(404).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('already exists')) {
          return res.status(409).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('not a personal service')) {
          return res.status(400).json({ message: mapperError.message });
        }

        throw mapperError; // Re-throw unexpected errors
      }

    } catch (error: any) {
      console.error('[Routes] POST /api/people-services error:', error);
      return res.status(500).json({
        message: "Failed to create people service",
        error: error.message || "An unexpected error occurred"
      });
    }
  });

  // GET /api/people-services/:peopleServiceId - Get single people service by ID
  app.get("/api/people-services/:peopleServiceId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate people service ID parameter
      const paramValidation = validateParams(paramPeopleServiceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid people service ID",
          errors: paramValidation.errors
        });
      }

      const { peopleServiceId } = paramValidation.data;

      // Get the people service
      const peopleService = await storage.getPeopleServiceById(peopleServiceId);
      if (!peopleService) {
        return res.status(404).json({ message: "People service not found" });
      }

      res.status(200).json(peopleService);

    } catch (error) {
      console.error("Error fetching people service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch people service" });
    }
  });

  // PUT /api/people-services/:peopleServiceId - Update a people service
  // Uses protected service mapper module for all validation and business logic
  app.put("/api/people-services/:peopleServiceId", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramPeopleServiceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ message: "Invalid people service ID", errors: paramValidation.errors });
      }

      // Validate request body - partial update
      const validation = insertPeopleServiceSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid people service data",
          errors: validation.error.issues
        });
      }

      const { peopleServiceId } = paramValidation.data;
      const peopleServiceData = validation.data;

      // Get existing people service for comparison
      const existingPeopleService = await storage.getPeopleServiceById(peopleServiceId);
      if (!existingPeopleService) {
        return res.status(404).json({ message: "People service not found" });
      }

      // Use protected service mapper module for update
      try {
        const updatedPeopleService = await serviceMapper.updatePeopleServiceMapping(peopleServiceId, peopleServiceData);

        console.log(`[Routes] Successfully updated people service mapping: ${peopleServiceId}`);

        // Handle chronology logging for isActive status changes (kept in routes as it's not core logic)
        if (peopleServiceData.isActive !== undefined && peopleServiceData.isActive !== null &&
            peopleServiceData.isActive !== existingPeopleService.isActive) {
          const service = await storage.getServiceById(updatedPeopleService.serviceId);
          const eventType = peopleServiceData.isActive ? 'service_activated' : 'service_deactivated';
          const fromValue = existingPeopleService.isActive?.toString() || 'true';
          const toValue = peopleServiceData.isActive.toString();

          // Get the client ID through the person relationship
          const person = await storage.getPersonById(updatedPeopleService.personId);
          if (person) {
            const clientPeople = await storage.getClientPeopleByPersonId(person.id);
            if (clientPeople.length > 0) {
              await storage.createClientChronologyEntry({
                clientId: clientPeople[0].clientId, // Use the first client relationship
                eventType,
                entityType: 'people_service',
                entityId: updatedPeopleService.id,
                fromValue,
                toValue,
                userId: req.user?.effectiveUserId || req.user?.id,
                changeReason: `People service "${service?.name || 'Unknown'}" for ${person.fullName} ${peopleServiceData.isActive ? 'activated' : 'deactivated'}`,
                notes: null,
              });
            }
          }
        }

        // Fetch the complete people service with relations
        const completePeopleService = await storage.getPeopleServiceById(updatedPeopleService.id);

        return res.json(completePeopleService);
      } catch (mapperError: any) {
        console.error('[Routes] Service mapper error:', mapperError);

        // Handle specific error types with appropriate HTTP status codes
        if (mapperError.message?.includes('not found')) {
          return res.status(404).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('already exists')) {
          return res.status(409).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('not a personal service')) {
          return res.status(400).json({ message: mapperError.message });
        }

        throw mapperError; // Re-throw unexpected errors
      }

    } catch (error: any) {
      console.error('[Routes] PUT /api/people-services error:', error);
      return res.status(500).json({
        message: "Failed to update people service",
        error: error.message || "An unexpected error occurred"
      });
    }
  });

  // DELETE /api/people-services/:peopleServiceId - Delete a people service
  app.delete("/api/people-services/:peopleServiceId", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const validation = validateParams(paramPeopleServiceIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid people service ID", errors: validation.errors });
      }

      const { peopleServiceId } = validation.data;

      // Delete the people service
      await storage.deletePeopleService(peopleServiceId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting people service:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }

      res.status(500).json({ message: "Failed to delete people service" });
    }
  });
}
