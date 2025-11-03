import type { Express } from "express";
import { storage } from "../storage";
import { z } from "zod";
import {
  validateParams,
  paramUuidSchema,
  paramClientIdSchema,
  paramCompanyNumberSchema,
  paramClientServiceIdSchema,
  paramServiceIdSchema,
  paramPersonIdSchema,
  paramPeopleServiceIdSchema,
  resolveEffectiveUser,
  requireAdmin,
  requireManager,
  userHasClientAccess,
  parseFullName,
} from "./routeHelpers";
import {
  insertClientSchema,
  insertPersonSchema,
  insertClientTagSchema,
  insertClientTagAssignmentSchema,
  insertDocumentSchema,
  insertDocumentFolderSchema,
  insertClientServiceSchema,
  insertClientServiceRoleAssignmentSchema,
  insertPeopleServiceSchema,
  insertRiskAssessmentSchema,
  updateRiskAssessmentSchema,
  insertRiskAssessmentResponseSchema,
  insertClientCustomRequestSectionSchema,
} from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";
import { ObjectPermission } from "../objectAcl";
import { companiesHouseService } from "../companies-house-service";
import { runChSync } from "../ch-sync-service";
import * as serviceMapper from "../core/service-mapper";
import type { AuthenticatedRequest } from "../auth";

export function registerClientRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // ==================================================
  // CLIENT MANAGEMENT API ROUTES
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

      // CRITICAL FIX: Check role completeness BEFORE updating client
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

  // ==================================================
  // COMPANIES HOUSE API ROUTES
  // ==================================================

  // GET /api/companies-house/search - Search for companies
  app.get("/api/companies-house/search", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { q: query, itemsPerPage = 20 } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ message: "Search query 'q' is required" });
      }

      const parsedItemsPerPage = typeof itemsPerPage === 'string' ? parseInt(itemsPerPage, 10) : itemsPerPage;
      if (isNaN(parsedItemsPerPage) || parsedItemsPerPage < 1 || parsedItemsPerPage > 100) {
        return res.status(400).json({ message: "itemsPerPage must be between 1 and 100" });
      }

      const companyData = await companiesHouseService.searchCompanies(query.trim(), parsedItemsPerPage);
      res.json({
        items: companyData,
        total_results: companyData.length,
        items_per_page: parsedItemsPerPage
      });
    } catch (error) {
      console.error("Error searching Companies House:", error instanceof Error ? error.message : error);

      if (error instanceof Error) {
        if (error.message.includes("404") || error.message.includes("not found")) {
          return res.status(404).json({ message: "No companies found" });
        }
        if (error.message.includes("API key")) {
          return res.status(500).json({ message: "Companies House service unavailable" });
        }
      }

      res.status(500).json({ message: "Failed to search companies" });
    }
  });

  // GET /api/companies-house/company/:companyNumber - Get full company profile
  app.get("/api/companies-house/company/:companyNumber", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramCompanyNumberSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { companyNumber } = paramValidation.data;
      const companyData = await companiesHouseService.getCompanyProfile(companyNumber);
      res.json(companyData);
    } catch (error) {
      console.error("Error fetching company profile:", error instanceof Error ? error.message : error);

      if (error instanceof Error) {
        if (error.message.includes("404") || error.message.includes("not found")) {
          return res.status(404).json({ message: "Company not found" });
        }
        if (error.message.includes("API key")) {
          return res.status(500).json({ message: "Companies House service unavailable" });
        }
      }

      res.status(500).json({ message: "Failed to fetch company profile" });
    }
  });

  // GET /api/companies-house/company/:companyNumber/officers - Get company officers
  app.get("/api/companies-house/company/:companyNumber/officers", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramCompanyNumberSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { companyNumber } = paramValidation.data;
      const allOfficersData = await companiesHouseService.getCompanyOfficers(companyNumber);

      // Filter for directors only (not resigned officers)
      const activeDirectors = (allOfficersData || []).filter((officer: any) =>
        officer.officer_role &&
        officer.officer_role.toLowerCase().includes('director') &&
        !officer.resigned_on
      );

      res.json({ officers: activeDirectors });
    } catch (error) {
      console.error("Error fetching company officers:", error instanceof Error ? error.message : error);

      if (error instanceof Error) {
        if (error.message.includes("404") || error.message.includes("not found")) {
          return res.status(404).json({ message: "Company officers not found" });
        }
        if (error.message.includes("API key")) {
          return res.status(500).json({ message: "Companies House service unavailable" });
        }
      }

      res.status(500).json({ message: "Failed to fetch company officers" });
    }
  });

  // POST /api/clients/from-companies-house - Create client from Companies House data
  app.post("/api/clients/from-companies-house", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const bodySchema = z.object({
        companyNumber: z.string().min(1, "Company number is required").regex(/^[A-Z0-9]{6,8}$/, "Invalid UK company number format"),
        selectedOfficers: z.array(z.number().int().min(0)).optional().default([]),
        officerDecisions: z.record(z.object({
          action: z.enum(['create', 'link']),
          personId: z.string().optional()
        })).optional()
      });

      const bodyValidation = bodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: bodyValidation.error.issues
        });
      }

      const { companyNumber, selectedOfficers, officerDecisions } = bodyValidation.data;

      const companyData = await companiesHouseService.getCompanyProfile(companyNumber);

      const allOfficersData = await companiesHouseService.getCompanyOfficers(companyNumber);
      console.log(`Fetched ${allOfficersData?.length || 0} officers for company ${companyNumber}`);

      const directors = (allOfficersData || []).filter((officer: any) =>
        officer.officer_role &&
        officer.officer_role.toLowerCase().includes('director') &&
        !officer.resigned_on
      );
      console.log(`Found ${directors.length} active directors to save`);

      const clientData = companiesHouseService.transformCompanyToClient(companyData);

      const client = await storage.upsertClientFromCH(clientData);

      const createdPeople = [];

      if (officerDecisions && Object.keys(officerDecisions).length > 0) {
        for (const [indexStr, decision] of Object.entries(officerDecisions)) {
          const index = parseInt(indexStr);
          const officer = directors[index];

          if (!officer) {
            console.warn(`Officer at index ${index} not found`);
            continue;
          }

          try {
            let person;

            if (decision.action === 'link' && decision.personId) {
              const existingPerson = await storage.getPersonById(decision.personId);
              if (!existingPerson) {
                console.warn(`Person ${decision.personId} not found, creating new person instead`);
                const personData = companiesHouseService.transformOfficerToPerson(officer, companyNumber);
                const validatedData = insertPersonSchema.parse(personData);
                person = await storage.createPerson(validatedData);
              } else {
                person = existingPerson;
              }
            } else {
              const personData = companiesHouseService.transformOfficerToPerson(officer, companyNumber);
              const validatedData = insertPersonSchema.parse(personData);
              person = await storage.createPerson(validatedData);
            }

            await storage.linkPersonToClient(
              client.id,
              person.id,
              officer.officer_role,
              false
            );

            createdPeople.push({
              ...person,
              officerRole: officer.officer_role
            });
          } catch (personError) {
            console.warn(`Failed to process officer ${officer.name}:`, personError);
          }
        }
      } else {
        for (const officer of directors) {
          try {
            const personData = companiesHouseService.transformOfficerToPerson(officer, companyNumber);
            const validatedData = insertPersonSchema.parse(personData);
            const person = await storage.upsertPersonFromCH(validatedData);

            await storage.linkPersonToClient(
              client.id,
              person.id,
              officer.officer_role,
              false
            );

            createdPeople.push({
              ...person,
              officerRole: officer.officer_role
            });
          } catch (personError) {
            console.warn(`Failed to create person for officer ${officer.name}:`, personError);
          }
        }
      }

      const clientWithPeople = await storage.getClientWithPeople(client.id);

      res.status(201).json({
        client: clientWithPeople,
        message: `Created client "${client.name}" with ${createdPeople.length} associated person(s)`
      });

    } catch (error) {
      console.error("Error creating client from Companies House:", error instanceof Error ? error.message : error);

      if (error instanceof Error) {
        if (error.message.includes("404") || error.message.includes("not found")) {
          return res.status(404).json({ message: "Company not found" });
        }
        if (error.message.includes("API key")) {
          return res.status(500).json({ message: "Companies House service unavailable" });
        }
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
          return res.status(409).json({ message: "Client with this company number already exists" });
        }
      }

      res.status(500).json({ message: "Failed to create client from Companies House data" });
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

      const personId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const personData = {
        id: personId,
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
  // CLIENT PEOPLE API ROUTES
  // ==================================================

  // GET /api/clients/:id/services - Get all services for a client
  app.get("/api/clients/:id/services", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = z.object({
        id: z.string().min(1, "Client ID is required")
      }).safeParse(req.params);

      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.error.errors
        });
      }

      const { id: clientId } = paramValidation.data;

      const clientServices = await storage.getClientServicesByClientId(clientId);
      res.json(clientServices);
    } catch (error) {
      console.error("Error fetching client services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client services" });
    }
  });

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
      // Validate client ID parameter with UUID format
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

      // Check if client exists
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Get chronology entries for this client
      const chronologyEntries = await storage.getClientChronology(clientId);

      // Sanitize user objects to remove sensitive fields
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

      const personId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const personWithId = { ...personData, id: personId };

      const newPerson = await storage.createPerson(personWithId);

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

  // ==================================================
  // CLIENT TAGS API ROUTES
  // ==================================================

  // GET /api/client-tags - Get all client tags (admin only)
  app.get("/api/client-tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const tags = await storage.getAllClientTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching client tags:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client tags" });
    }
  });

  // POST /api/client-tags - Create client tag (admin only)
  app.post("/api/client-tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validatedData = insertClientTagSchema.parse(req.body);
      const tag = await storage.createClientTag(validatedData);
      res.status(201).json(tag);
    } catch (error) {
      console.error("Error creating client tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to create client tag" });
    }
  });

  // DELETE /api/client-tags/:id - Delete client tag (admin only)
  app.delete("/api/client-tags/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      await storage.deleteClientTag(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete client tag" });
    }
  });

  // GET /api/client-tag-assignments - Get all client tag assignments
  app.get("/api/client-tag-assignments", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const assignments = await storage.getAllClientTagAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching client tag assignments:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client tag assignments" });
    }
  });

  // GET /api/clients/:clientId/tags - Get tags for a specific client
  app.get("/api/clients/:clientId/tags", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const tags = await storage.getClientTags(req.params.clientId);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching client tags:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client tags" });
    }
  });

  // POST /api/clients/:clientId/tags - Assign tag to client (admin only)
  app.post("/api/clients/:clientId/tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
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
        clientId: req.params.clientId,
        assignedBy: effectiveUserId,
      };

      const validatedData = insertClientTagAssignmentSchema.parse(assignmentData);
      const assignment = await storage.assignClientTag(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning client tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to assign client tag" });
    }
  });

  // DELETE /api/clients/:clientId/tags/:tagId - Remove tag from client (admin only)
  app.delete("/api/clients/:clientId/tags/:tagId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const clientValidation = validateParams(paramClientIdSchema, req.params);
      const tagValidation = validateParams(z.object({ tagId: z.string().uuid() }), req.params);

      if (!clientValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: clientValidation.errors
        });
      }

      if (!tagValidation.success) {
        return res.status(400).json({
          message: "Invalid tag ID",
          errors: tagValidation.errors
        });
      }

      await storage.unassignClientTag(req.params.clientId, req.params.tagId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unassigning client tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to unassign client tag" });
    }
  });

  // ==================================================
  // CLIENT DOCUMENTS API ROUTES
  // ==================================================

  // POST /api/clients/:clientId/documents - Create document metadata after upload
  app.post("/api/clients/:clientId/documents", isAuthenticated, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({ clientId: z.string() });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const userId = req.user?.id;

      const documentURL = req.body.documentURL || req.body.objectPath;
      if (!documentURL) {
        return res.status(400).json({ error: "documentURL or objectPath is required" });
      }

      if (req.body.folderId) {
        const folder = await storage.getDocumentFolderById(req.body.folderId);
        if (!folder) {
          return res.status(404).json({ message: "Folder not found" });
        }
        if (folder.clientId !== clientId) {
          return res.status(403).json({ message: "Folder does not belong to this client" });
        }
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        documentURL,
        {
          owner: userId,
          visibility: "private",
        },
      );

      const documentData = insertDocumentSchema.parse({
        clientId,
        folderId: req.body.folderId || null,
        uploadedBy: userId,
        uploadName: req.body.uploadName || 'Untitled Upload',
        source: req.body.source || 'direct upload',
        fileName: req.body.fileName,
        fileSize: req.body.fileSize,
        fileType: req.body.fileType,
        objectPath,
      });

      const document = await storage.createDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating document:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  // GET /api/clients/:clientId/documents - Get documents for a client
  app.get("/api/clients/:clientId/documents", isAuthenticated, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({ clientId: z.string() });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const documents = await storage.getDocumentsByClientId(clientId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // POST /api/clients/:clientId/folders - Create folder for client
  app.post("/api/clients/:clientId/folders", isAuthenticated, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({ clientId: z.string() });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const userId = req.user?.id;

      const folderData = insertDocumentFolderSchema.parse({
        clientId,
        name: req.body.name,
        createdBy: userId,
        source: req.body.source || 'manual',
      });

      const folder = await storage.createDocumentFolder(folderData);
      res.status(201).json(folder);
    } catch (error) {
      console.error("Error creating folder:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to create folder" });
    }
  });

  // GET /api/clients/:clientId/folders - Get folders for client
  app.get("/api/clients/:clientId/folders", isAuthenticated, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({ clientId: z.string() });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const folders = await storage.getDocumentFoldersByClientId(clientId);
      res.json(folders);
    } catch (error) {
      console.error("Error fetching folders:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  });

  // ==================================================
  // CLIENT SERVICES API ROUTES
  // ==================================================

  // GET /api/client-services - Get all client services (admin only)
  app.get("/api/client-services", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const clientServices = await storage.getAllClientServices();
      res.json(clientServices);
    } catch (error) {
      console.error("Error fetching client services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client services" });
    }
  });

  // GET /api/client-services/client/:clientId - Get services for a specific client
  app.get("/api/client-services/client/:clientId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({
        clientId: z.string().min(1, "Client ID is required")
      });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientId } = req.params;

      const clientServices = await storage.getClientServicesByClientId(clientId);
      res.json(clientServices);
    } catch (error) {
      console.error("Error fetching client services by client:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client services" });
    }
  });

  // GET /api/client-services/service/:serviceId - Get clients for a specific service
  app.get("/api/client-services/service/:serviceId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramServiceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { serviceId } = req.params;

      const clientServices = await storage.getClientServicesByServiceId(serviceId);
      res.json(clientServices);
    } catch (error) {
      console.error("Error fetching client services by service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client services" });
    }
  });

  // POST /api/client-services - Create new client-service mapping (admin only)
  app.post("/api/client-services", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validationResult = insertClientServiceSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid client service data",
          errors: validationResult.error.issues
        });
      }

      const clientServiceData = validationResult.data;

      try {
        const clientService = await serviceMapper.createClientServiceMapping(clientServiceData);

        console.log(`[Routes] Successfully created client service mapping: ${clientService.id}`);
        return res.status(201).json(clientService);
      } catch (mapperError: any) {
        console.error('[Routes] Service mapper error:', mapperError);

        if (mapperError.message?.includes('not found')) {
          return res.status(404).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('already exists')) {
          return res.status(409).json({
            message: mapperError.message,
            code: "DUPLICATE_CLIENT_SERVICE_MAPPING"
          });
        }
        if (mapperError.message?.includes('cannot be assigned') ||
            mapperError.message?.includes('Personal service')) {
          return res.status(400).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('CH') ||
            mapperError.message?.includes('Companies House')) {
          return res.status(400).json({ message: mapperError.message });
        }

        throw mapperError;
      }

    } catch (error: any) {
      console.error('[Routes] POST /api/client-services error:', error);

      if (error instanceof Error && (error as any).code === '23505') {
        return res.status(409).json({
          message: "Client service mapping already exists",
          code: "DUPLICATE_CLIENT_SERVICE_MAPPING"
        });
      }

      return res.status(500).json({
        message: "Failed to create client service",
        error: error.message || "An unexpected error occurred"
      });
    }
  });

  // GET /api/client-services/:id - Get single client service by ID
  app.get("/api/client-services/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = z.object({
        id: z.string().min(1, "Client service ID is required").uuid("Invalid client service ID format")
      }).safeParse(req.params);

      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client service ID format",
          errors: paramValidation.error.issues
        });
      }

      const { id } = paramValidation.data;

      const clientService = await storage.getClientServiceById(id);
      if (!clientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      res.status(200).json(clientService);

    } catch (error) {
      console.error("Error fetching client service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client service" });
    }
  });

  // PUT /api/client-services/:id - Update client service (admin only)
  app.put("/api/client-services/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      const existingClientService = await storage.getClientServiceById(id);
      if (!existingClientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      console.log('[DEBUG] PUT /api/client-services/:id - Request body:', JSON.stringify(req.body, null, 2));

      const validationResult = insertClientServiceSchema.partial().passthrough().safeParse(req.body);

      console.log('[DEBUG] Validation result:', validationResult.success ? 'SUCCESS' : 'FAILED');
      if (validationResult.success) {
        console.log('[DEBUG] Validated data:', JSON.stringify(validationResult.data, null, 2));
      }

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid client service data",
          errors: validationResult.error.issues
        });
      }

      try {
        const clientService = await serviceMapper.updateClientServiceMapping(id, validationResult.data);

        console.log(`[Routes] Successfully updated client service mapping: ${id}`);

        if (validationResult.data.isActive !== undefined && validationResult.data.isActive !== null &&
            validationResult.data.isActive !== existingClientService.isActive) {
          const service = await storage.getServiceById(clientService.serviceId);
          const eventType = validationResult.data.isActive ? 'service_activated' : 'service_deactivated';
          const fromValue = existingClientService.isActive?.toString() || 'true';
          const toValue = validationResult.data.isActive.toString();

          await storage.createClientChronologyEntry({
            clientId: clientService.clientId,
            eventType,
            entityType: 'client_service',
            entityId: clientService.id,
            fromValue,
            toValue,
            userId: req.user?.effectiveUserId || req.user?.id,
            changeReason: `Service "${service?.name || 'Unknown'}" ${validationResult.data.isActive ? 'activated' : 'deactivated'}`,
            notes: null,
          });
        }

        // Handle role assignment updates with cascading task reassignment
        if (req.body.roleAssignments && Array.isArray(req.body.roleAssignments)) {
          console.log(`[Routes] Processing ${req.body.roleAssignments.length} role assignment updates`);
          
          for (const roleUpdate of req.body.roleAssignments) {
            const { id: assignmentId, userId: newUserId } = roleUpdate;
            
            // SECURITY: Load the current role assignment from storage to get the authoritative oldUserId
            // Never trust client-provided oldUserId as it could be manipulated
            const currentAssignment = await storage.getClientServiceRoleAssignmentById(assignmentId);
            
            if (!currentAssignment) {
              console.error(`[Routes] Invalid role assignment ID: ${assignmentId}`);
              continue; // Skip invalid assignment IDs
            }
            
            const authoritativeOldUserId = currentAssignment.userId;
            
            // Only process if user has actually changed
            if (newUserId !== authoritativeOldUserId) {
              console.log(`[Routes] Updating role assignment ${assignmentId}: ${authoritativeOldUserId || 'null'} -> ${newUserId || 'null'}`);
              
              // Update the role assignment (explicitly handle null to clear assignment)
              await storage.updateClientServiceRoleAssignment(assignmentId, {
                userId: newUserId === null ? null : newUserId,
              });

              // Find all active projects for this client service
              const projects = await storage.getProjectsByClientServiceId(id);
              const activeProjects = projects.filter(p => !p.inactive && !p.archived);

              console.log(`[Routes] Found ${activeProjects.length} active projects for task reassignment`);

              // For each active project, reassign tasks from old user to new user (or unassign if new user is null)
              for (const project of activeProjects) {
                // Get all internal tasks connected to this project assigned to the old user
                if (authoritativeOldUserId) {
                  const tasks = await storage.getInternalTasksByAssignee(authoritativeOldUserId);
                  
                  // Get task connections for each task to filter by project
                  const projectTasks: any[] = [];
                  for (const task of tasks) {
                    const taskConnections = await storage.getTaskConnectionsByTaskId(task.id);
                    const hasProjectConnection = taskConnections.some(
                      conn => conn.entityType === 'project' && conn.entityId === project.id
                    );
                    if (hasProjectConnection) {
                      projectTasks.push(task);
                    }
                  }

                  console.log(`[Routes] Found ${projectTasks.length} tasks to reassign from ${authoritativeOldUserId} for project ${project.id}`);

                  // Reassign each task (or unassign if newUserId is null)
                  for (const task of projectTasks) {
                    await storage.updateInternalTask(task.id, {
                      assignedTo: newUserId || null,
                    });
                    console.log(`[Routes] ${newUserId ? `Reassigned task ${task.id} to ${newUserId}` : `Unassigned task ${task.id}`}`);
                  }
                }
              }
            }
          }
        }

        return res.json(clientService);
      } catch (mapperError: any) {
        console.error('[Routes] Service mapper error:', mapperError);

        if (mapperError.message?.includes('not found')) {
          return res.status(404).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('already exists')) {
          return res.status(409).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('cannot be assigned') ||
            mapperError.message?.includes('Personal service')) {
          return res.status(400).json({ message: mapperError.message });
        }

        throw mapperError;
      }
    } catch (error) {
      console.error("Error updating client service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to update client service" });
    }
  });

  // DELETE /api/client-services/:id - Delete client service (admin only)
  app.delete("/api/client-services/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      const existingClientService = await storage.getClientServiceById(id);
      if (!existingClientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      await storage.deleteClientService(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete client service" });
    }
  });

  // GET /api/client-services/:id/projects - Get all projects for a client service
  app.get("/api/client-services/:id/projects", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = z.object({
        id: z.string().min(1, "Client service ID is required").uuid("Invalid client service ID format")
      }).safeParse(req.params);

      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client service ID format",
          errors: paramValidation.error.issues
        });
      }

      const { id } = paramValidation.data;

      // Verify client service exists
      const clientService = await storage.getClientServiceById(id);
      if (!clientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      // Get projects via projectSchedulingHistory
      const projects = await storage.getProjectsByClientServiceId(id);

      res.status(200).json(projects);

    } catch (error) {
      console.error("Error fetching projects for client service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // GET /api/client-services/:clientServiceId/role-assignments - Get role assignments for client service
  app.get("/api/client-services/:clientServiceId/role-assignments", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientServiceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientServiceId } = req.params;

      const existingClientService = await storage.getClientServiceById(clientServiceId);
      if (!existingClientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      const roleAssignments = await storage.getClientServiceRoleAssignments(clientServiceId);
      res.json(roleAssignments);
    } catch (error) {
      console.error("Error fetching role assignments:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch role assignments" });
    }
  });

  // POST /api/client-services/:clientServiceId/role-assignments - Create role assignment
  app.post("/api/client-services/:clientServiceId/role-assignments", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientServiceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientServiceId } = req.params;

      const existingClientService = await storage.getClientServiceById(clientServiceId);
      if (!existingClientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      const validationResult = insertClientServiceRoleAssignmentSchema.safeParse({
        ...req.body,
        clientServiceId
      });

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid role assignment data",
          errors: validationResult.error.issues
        });
      }

      const roleAssignment = await storage.createClientServiceRoleAssignment(validationResult.data);
      res.status(201).json(roleAssignment);
    } catch (error) {
      console.error("Error creating role assignment:", error instanceof Error ? error.message : error);

      if (error instanceof Error && (error as any).code === '23505') {
        return res.status(409).json({
          message: "Role assignment already exists for this client service and work role",
          code: "DUPLICATE_ROLE_ASSIGNMENT"
        });
      }

      res.status(500).json({ message: "Failed to create role assignment" });
    }
  });

  // GET /api/clients/:clientId/service-role-completeness - Check if client has complete role assignments
  app.get("/api/clients/:clientId/service-role-completeness", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;

      if (!clientId || typeof clientId !== 'string') {
        return res.status(400).json({ message: "Valid client ID is required" });
      }

      const clientServices = await storage.getClientServicesByClientId(clientId);

      const completenessResults = [];

      for (const clientService of clientServices) {
        const completeness = await storage.validateClientServiceRoleCompleteness(
          clientId,
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

      const overallComplete = completenessResults.every(result => result.isComplete);

      res.json({
        clientId,
        overallComplete,
        services: completenessResults
      });
    } catch (error) {
      console.error("Error checking service role completeness:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to check service role completeness" });
    }
  });

  // POST /api/clients/:clientId/validate-service-roles - Validate client's service role assignments
  app.post("/api/clients/:clientId/validate-service-roles", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;

      if (!clientId || typeof clientId !== 'string') {
        return res.status(400).json({ message: "Valid client ID is required" });
      }

      const validationSchema = z.object({
        serviceId: z.string(),
        roleIds: z.array(z.string())
      });

      const validationResult = validationSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid validation request data",
          errors: validationResult.error.issues
        });
      }

      const { serviceId, roleIds } = validationResult.data;

      const mappingExists = await storage.checkClientServiceMappingExists(clientId, serviceId);
      if (!mappingExists) {
        return res.status(404).json({
          message: "Client service mapping not found",
          code: "CLIENT_SERVICE_NOT_MAPPED"
        });
      }

      const roleValidation = await storage.validateAssignedRolesAgainstService(serviceId, roleIds);

      res.json({
        clientId,
        serviceId,
        isValid: roleValidation.isValid,
        invalidRoles: roleValidation.invalidRoles,
        allowedRoles: roleValidation.allowedRoles
      });
    } catch (error) {
      console.error("Error validating service roles:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to validate service roles" });
    }
  });

  // ==================================================
  // COMPANIES HOUSE CHANGE REQUESTS API
  // ==================================================

  // GET /api/ch-change-requests - List all pending CH change requests (admin only)
  app.get("/api/ch-change-requests", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const changeRequests = await storage.getPendingChChangeRequests();
      res.json(changeRequests);
    } catch (error) {
      console.error("Error fetching CH change requests:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch CH change requests" });
    }
  });

  // GET /api/ch-change-requests/client/:clientId - Get CH change requests by client (admin only)
  app.get("/api/ch-change-requests/client/:clientId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientId } = req.params;

      const changeRequests = await storage.getChChangeRequestsByClientId(clientId);
      res.json(changeRequests);
    } catch (error) {
      console.error("Error fetching CH change requests by client:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch CH change requests" });
    }
  });

  // POST /api/ch-change-requests/:id/approve - Approve a CH change request (admin only)
  app.post("/api/ch-change-requests/:id/approve", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;
      const { notes } = req.body;

      const existingRequest = await storage.getChChangeRequestById(id);
      if (!existingRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }
      if (existingRequest.status !== 'pending') {
        return res.status(409).json({ message: "Change request has already been processed" });
      }

      const currentUser = req.user;
      if (!currentUser?.id) {
        return res.status(401).json({ message: "User identification required" });
      }

      const { applyChChanges } = await import('../ch-update-logic');
      const result = await applyChChanges(
        existingRequest.client.id,
        [id],
        currentUser.id,
        notes
      );

      console.log(`[CH Approve] Applied changes: ${result.updatedClients} clients, ${result.updatedServices} services, ${result.updatedProjects} projects`);

      res.json({
        message: "Change request approved and applied successfully",
        updatedClients: result.updatedClients,
        updatedServices: result.updatedServices,
        updatedProjects: result.updatedProjects,
      });
    } catch (error) {
      console.error("Error approving CH change request:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to approve CH change request" });
    }
  });

  // POST /api/ch-change-requests/:id/reject - Reject a CH change request (admin only)
  app.post("/api/ch-change-requests/:id/reject", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;
      const { notes } = req.body;

      const existingRequest = await storage.getChChangeRequestById(id);
      if (!existingRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }
      if (existingRequest.status !== 'pending') {
        return res.status(409).json({ message: "Change request has already been processed" });
      }

      const currentUser = req.user;
      if (!currentUser?.id) {
        return res.status(401).json({ message: "User identification required" });
      }

      const rejectedRequest = await storage.rejectChChangeRequest(id, currentUser.id, notes);
      res.json(rejectedRequest);
    } catch (error) {
      console.error("Error rejecting CH change request:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to reject CH change request" });
    }
  });

  // POST /api/ch-change-requests/client/:clientId/approve-all - Approve all pending CH change requests for a client (admin only)
  app.post("/api/ch-change-requests/client/:clientId/approve-all", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientId } = req.params;
      const { notes } = req.body;

      const clientRequests = await storage.getChChangeRequestsByClientId(clientId);
      const pendingRequests = clientRequests.filter(r => r.status === 'pending');

      if (pendingRequests.length === 0) {
        return res.status(404).json({ message: "No pending change requests found for this client" });
      }

      const currentUser = req.user;
      if (!currentUser?.id) {
        return res.status(401).json({ message: "User identification required" });
      }

      const { applyChChanges } = await import('../ch-update-logic');
      const requestIds = pendingRequests.map(r => r.id);

      const result = await applyChChanges(
        clientId,
        requestIds,
        currentUser.id,
        notes
      );

      console.log(`[CH Bulk Approve] Applied ${requestIds.length} changes for client ${clientId}: ${result.updatedClients} clients, ${result.updatedServices} services, ${result.updatedProjects} projects`);

      res.json({
        message: `Successfully approved ${requestIds.length} change requests`,
        approvedCount: requestIds.length,
        updatedClients: result.updatedClients,
        updatedServices: result.updatedServices,
        updatedProjects: result.updatedProjects,
      });
    } catch (error) {
      console.error("Error bulk approving CH change requests:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to bulk approve CH change requests" });
    }
  });

  // GET /api/ch-change-requests/grouped - Get pending CH change requests grouped by client (admin only)
  app.get("/api/ch-change-requests/grouped", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const changeRequests = await storage.getPendingChChangeRequests();

      const groupedByClient = new Map<string, {
        client: any;
        accountsChanges: any[];
        confirmationStatementChanges: any[];
        affectedServices: string[];
        affectedProjects: number;
      }>();

      for (const request of changeRequests) {
        const clientId = request.client.id;

        if (!groupedByClient.has(clientId)) {
          groupedByClient.set(clientId, {
            client: request.client,
            accountsChanges: [],
            confirmationStatementChanges: [],
            affectedServices: [],
            affectedProjects: 0,
          });
        }

        const group = groupedByClient.get(clientId)!;

        const fieldName = request.fieldName;
        if (fieldName === 'nextAccountsPeriodEnd' || fieldName === 'nextAccountsDue') {
          group.accountsChanges.push(request);
        } else if (fieldName === 'confirmationStatementNextDue' || fieldName === 'confirmationStatementNextMadeUpTo') {
          group.confirmationStatementChanges.push(request);
        }
      }

      for (const [clientId, group] of Array.from(groupedByClient.entries())) {
        const clientServices = await storage.getClientServicesByClientId(clientId);

        const affectedServiceNames = new Set<string>();
        let totalAffectedProjects = 0;

        for (const cs of clientServices) {
          const service = cs.service;
          if (!service.isCompaniesHouseConnected) continue;

          const hasAccountsChanges = group.accountsChanges.length > 0;
          const hasConfStatementChanges = group.confirmationStatementChanges.length > 0;

          const isAccountsService = service.chStartDateField === 'nextAccountsPeriodEnd' || service.chDueDateField === 'nextAccountsDue';
          const isConfStatementService = service.chStartDateField === 'confirmationStatementNextMadeUpTo' || service.chDueDateField === 'confirmationStatementNextDue';

          if ((hasAccountsChanges && isAccountsService) || (hasConfStatementChanges && isConfStatementService)) {
            affectedServiceNames.add(service.name);

            if (cs.hasActiveProject) {
              totalAffectedProjects++;
            }
          }
        }

        group.affectedServices = Array.from(affectedServiceNames);
        group.affectedProjects = totalAffectedProjects;
      }

      const groupedData = Array.from(groupedByClient.values());

      res.json(groupedData);
    } catch (error) {
      console.error("Error fetching grouped CH change requests:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch grouped CH change requests" });
    }
  });

  // POST /api/ch-sync - Trigger manual Companies House data synchronization (admin only)
  app.post("/api/ch-sync", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Manual CH sync triggered by admin: ${req.user?.email}`);

      const result = await runChSync();

      res.json({
        message: "Companies House synchronization completed",
        processedClients: result.processedClients,
        createdRequests: result.createdRequests,
        errors: result.errors,
      });
    } catch (error) {
      console.error("Error running CH sync:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to run Companies House synchronization",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/companies-house/sync/:clientId - Sync a single client's Companies House data (admin only)
  app.post("/api/companies-house/sync/:clientId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientId } = req.params;

      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (!client.companyNumber) {
        return res.status(400).json({ message: "Client does not have Companies House connection" });
      }

      console.log(`[API] Manual CH sync triggered for client ${client.name} (${client.companyNumber}) by admin: ${req.user?.email}`);

      const result = await runChSync([clientId]);

      res.json({
        message: `Companies House synchronization completed for ${client.name}`,
        processedClients: result.processedClients,
        createdRequests: result.createdRequests,
        errors: result.errors,
      });
    } catch (error) {
      console.error("Error syncing client CH data:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to sync client Companies House data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/companies-house/enrich/:clientId - Enrich client with full Companies House data (admin only)
  app.post("/api/companies-house/enrich/:clientId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientId } = req.params;

      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (!client.companyNumber) {
        return res.status(400).json({ message: "Client does not have a company number" });
      }

      console.log(`[API] CH enrichment triggered for client ${client.name} (${client.companyNumber}) by admin: ${req.user?.email}`);

      // Fetch full company profile from Companies House
      const companyProfile = await companiesHouseService.getCompanyProfile(client.companyNumber);
      
      // Transform CH data to client fields
      const enrichedData = companiesHouseService.transformCompanyToClient(companyProfile);

      // Update the client with enriched data
      const updatedClient = await storage.updateClient(clientId, enrichedData);

      console.log(`[API] Successfully enriched client ${client.name} with CH data`);

      res.json({
        message: `Client enriched successfully with Companies House data`,
        client: updatedClient
      });
    } catch (error) {
      console.error("Error enriching client with CH data:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to enrich client with Companies House data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/companies-house/enrich-bulk - Enrich multiple clients with Companies House data (admin only)
  app.post("/api/companies-house/enrich-bulk", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const bodySchema = z.object({
        clientIds: z.array(z.string()).min(1, "At least one client ID is required")
      });

      const bodyValidation = bodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: bodyValidation.error.issues
        });
      }

      const { clientIds } = bodyValidation.data;

      console.log(`[API] Bulk CH enrichment triggered for ${clientIds.length} clients by admin: ${req.user?.email}`);

      const results = {
        successful: [] as string[],
        failed: [] as { clientId: string; clientName: string; error: string }[],
        skipped: [] as { clientId: string; clientName: string; reason: string }[]
      };

      for (const clientId of clientIds) {
        try {
          const client = await storage.getClientById(clientId);
          
          if (!client) {
            results.failed.push({
              clientId,
              clientName: 'Unknown',
              error: 'Client not found'
            });
            continue;
          }

          if (!client.companyNumber) {
            results.skipped.push({
              clientId,
              clientName: client.name,
              reason: 'No company number'
            });
            continue;
          }

          // Fetch and enrich
          const companyProfile = await companiesHouseService.getCompanyProfile(client.companyNumber);
          const enrichedData = companiesHouseService.transformCompanyToClient(companyProfile);
          await storage.updateClient(clientId, enrichedData);

          results.successful.push(client.name);
          console.log(`[API] Successfully enriched client ${client.name}`);

        } catch (error) {
          const client = await storage.getClientById(clientId);
          results.failed.push({
            clientId,
            clientName: client?.name || 'Unknown',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.error(`[API] Failed to enrich client ${clientId}:`, error);
        }
      }

      res.json({
        message: `Enriched ${results.successful.length} of ${clientIds.length} clients`,
        successful: results.successful,
        failed: results.failed,
        skipped: results.skipped
      });
    } catch (error) {
      console.error("Error in bulk CH enrichment:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to process bulk enrichment",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ==================================================
  // PORTAL USER MANAGEMENT ROUTES (Staff Only)
  // ==================================================

  // GET /api/clients/:clientId/portal-users - Get portal users for a client
  app.get("/api/clients/:clientId/portal-users", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
      if (!hasAccess && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const portalUsers = await storage.getClientPortalUsersByClientId(clientId);
      res.json(portalUsers);
    } catch (error) {
      console.error("Error fetching portal users:", error);
      res.status(500).json({ message: "Failed to fetch portal users" });
    }
  });

  // POST /api/clients/:clientId/portal-users - Create portal user for a client
  app.post("/api/clients/:clientId/portal-users", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      const { email, name } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      if (!email || !name) {
        return res.status(400).json({ message: "Email and name are required" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
      if (!hasAccess && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const existing = await storage.getClientPortalUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already in use" });
      }

      const portalUser = await storage.createClientPortalUser({
        email,
        name,
        clientId
      });

      res.status(201).json(portalUser);
    } catch (error) {
      console.error("Error creating portal user:", error);
      res.status(500).json({ message: "Failed to create portal user" });
    }
  });

  // PUT /api/portal-users/:portalUserId - Update portal user
  app.put("/api/portal-users/:portalUserId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { portalUserId } = req.params;
      const { name } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const portalUser = await storage.getClientPortalUserById(portalUserId);
      if (!portalUser) {
        return res.status(404).json({ message: "Portal user not found" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, portalUser.clientId);
      if (!hasAccess && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updated = await storage.updateClientPortalUser(portalUserId, { name });
      res.json(updated);
    } catch (error) {
      console.error("Error updating portal user:", error);
      res.status(500).json({ message: "Failed to update portal user" });
    }
  });

  // DELETE /api/portal-users/:portalUserId - Delete portal user
  app.delete("/api/portal-users/:portalUserId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { portalUserId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const portalUser = await storage.getClientPortalUserById(portalUserId);
      if (!portalUser) {
        return res.status(404).json({ message: "Portal user not found" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, portalUser.clientId);
      if (!hasAccess && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Note: JWT sessions are automatically invalidated on next request when user doesn't exist
      // The requirePortalAuth middleware verifies the user exists for each authenticated request
      await storage.deleteClientPortalUser(portalUserId);
      res.json({ message: "Portal user deleted successfully" });
    } catch (error) {
      console.error("Error deleting portal user:", error);
      res.status(500).json({ message: "Failed to delete portal user" });
    }
  });

  // ==================================================
  // RISK ASSESSMENT ROUTES
  // ==================================================

  // GET /api/clients/:clientId/risk-assessments - Get all risk assessments for a client
  app.get("/api/clients/:clientId/risk-assessments", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
      if (!hasAccess && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied. You don't have permission to access this client's risk assessments." });
      }

      const assessments = await storage.getRiskAssessmentsByClientId(clientId);
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching risk assessments:", error);
      res.status(500).json({ message: "Failed to fetch risk assessments" });
    }
  });

  // POST /api/clients/:clientId/risk-assessments - Create a new risk assessment
  app.post("/api/clients/:clientId/risk-assessments", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
      if (!hasAccess && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied. You don't have permission to create risk assessments for this client." });
      }

      const bodyValidation = insertRiskAssessmentSchema.omit({ clientId: true }).safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid risk assessment data",
          errors: bodyValidation.error.issues
        });
      }

      const newAssessment = await storage.createRiskAssessment({
        ...bodyValidation.data,
        clientId,
      });

      res.status(201).json(newAssessment);
    } catch (error) {
      console.error("Error creating risk assessment:", error);
      res.status(500).json({ message: "Failed to create risk assessment" });
    }
  });

}
