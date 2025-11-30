import type { Express } from "express";
import { storage } from "../../storage/index";
import { z } from "zod";
import { insertPersonSchema } from "@shared/schema";
import {
  validateParams,
  paramCompanyNumberSchema,
  paramClientIdSchema,
  paramUuidSchema,
} from "../routeHelpers";
import { companiesHouseService } from "../../companies-house-service";
import { runChSync } from "../../ch-sync-service";

export function registerCompaniesHouseRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
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
        primaryContactIndex: z.number().int().min(0).nullable().optional(),
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

      const { companyNumber, primaryContactIndex, officerDecisions } = bodyValidation.data;

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

            const isPrimary = primaryContactIndex === index;
            await storage.linkPersonToClient(
              client.id,
              person.id,
              officer.officer_role,
              isPrimary
            );

            createdPeople.push({
              ...person,
              officerRole: officer.officer_role,
              isPrimaryContact: isPrimary
            });
          } catch (personError) {
            console.warn(`Failed to process officer ${officer.name}:`, personError);
          }
        }
      } else {
        for (let index = 0; index < directors.length; index++) {
          const officer = directors[index];
          try {
            const personData = companiesHouseService.transformOfficerToPerson(officer, companyNumber);
            const validatedData = insertPersonSchema.parse(personData);
            const person = await storage.upsertPersonFromCH(validatedData);

            const isPrimary = primaryContactIndex === index;
            await storage.linkPersonToClient(
              client.id,
              person.id,
              officer.officer_role,
              isPrimary
            );

            createdPeople.push({
              ...person,
              officerRole: officer.officer_role,
              isPrimaryContact: isPrimary
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

      const { applyChChanges } = await import('../../ch-update-logic');
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

      const { applyChChanges } = await import('../../ch-update-logic');
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

  // POST /api/ch-change-requests/bulk-approve - Bulk approve CH change requests for multiple clients (admin only)
  app.post("/api/ch-change-requests/bulk-approve", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const bodySchema = z.object({
        clientIds: z.array(z.string().uuid()).min(1, "At least one client ID is required"),
        notes: z.string().optional(),
      });

      const bodyValidation = bodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: bodyValidation.error.issues
        });
      }

      const { clientIds, notes } = bodyValidation.data;

      const currentUser = req.user;
      if (!currentUser?.id) {
        return res.status(401).json({ message: "User identification required" });
      }

      const { applyChChanges } = await import('../../ch-update-logic');

      let totalApproved = 0;
      let clientsWithChanges = 0;
      let totalServices = 0;
      let totalProjects = 0;
      const errors: string[] = [];
      const skippedClients: string[] = [];

      for (const clientId of clientIds) {
        try {
          const clientRequests = await storage.getChChangeRequestsByClientId(clientId);
          const pendingRequests = clientRequests.filter(r => r.status === 'pending');

          if (pendingRequests.length === 0) {
            skippedClients.push(clientId);
            continue;
          }

          const requestIds = pendingRequests.map(r => r.id);
          const result = await applyChChanges(
            clientId,
            requestIds,
            currentUser.id,
            notes
          );

          totalApproved += requestIds.length;
          clientsWithChanges++;
          totalServices += result.updatedServices;
          totalProjects += result.updatedProjects;

          console.log(`[CH Bulk Approve] Approved ${requestIds.length} changes for client ${clientId}`);
        } catch (clientError) {
          const errorMsg = `Failed to approve changes for client ${clientId}: ${clientError instanceof Error ? clientError.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`[CH Bulk Approve] ${errorMsg}`);
        }
      }

      console.log(`[CH Bulk Approve] Completed: ${totalApproved} requests across ${clientsWithChanges} clients (${skippedClients.length} skipped with no pending changes)`);

      res.json({
        message: totalApproved > 0 
          ? `Successfully approved ${totalApproved} change requests for ${clientsWithChanges} clients`
          : `No pending changes found for the selected clients`,
        approvedCount: totalApproved,
        clientsProcessed: clientsWithChanges,
        clientsSkipped: skippedClients.length,
        updatedServices: totalServices,
        updatedProjects: totalProjects,
        errors: errors.length > 0 ? errors : undefined,
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
        addressChanges: any[];
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
            addressChanges: [],
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
        } else if (fieldName === 'registeredOfficeAddress') {
          // Parse the JSON address data for display
          try {
            const addressData = JSON.parse(request.newValue || '{}');
            group.addressChanges.push({
              ...request,
              newValueFormatted: addressData.formatted || request.newValue,
            });
          } catch {
            group.addressChanges.push({
              ...request,
              newValueFormatted: request.newValue,
            });
          }
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

  // ==================================================
  // COMPANIES HOUSE SYNC & ENRICHMENT API
  // ==================================================

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

      const companyProfile = await companiesHouseService.getCompanyProfile(client.companyNumber);
      
      const enrichedData = companiesHouseService.transformCompanyToClient(companyProfile);

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
}
