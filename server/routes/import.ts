import type { Express } from "express";
import { storage } from "../storage/index";
import { db } from "../db";
import {
  clients as clientsTable,
  people as peopleTable,
  clientPeople as clientPeopleTable,
  clientServices as clientServicesTable,
  clientServiceRoleAssignments as clientServiceRoleAssignmentsTable,
} from "@shared/schema";
import { companiesHouseService } from "../companies-house-service";

export function registerImportRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  app.post("/api/import/validate", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clients, clientServices, roleAssignments } = req.body;

      console.log("=== Import Validation Request ===");
      console.log("Clients count:", clients?.length || 0);
      console.log("Client Services count:", clientServices?.length || 0);
      console.log("Role Assignments count:", roleAssignments?.length || 0);

      const errors: string[] = [];
      const warnings: string[] = [];

      const clientRefs = new Set<string>();
      const personRefs = new Set<string>();

      for (const row of clients || []) {
        if (!row.client_ref) errors.push("Missing client_ref in clients data");
        if (!row.client_name) errors.push(`Missing client_name for ${row.client_ref || 'unknown'}`);
        if (!row.client_type) errors.push(`Missing client_type for ${row.client_ref || 'unknown'}`);
        if (row.client_type && !['company', 'individual'].includes(row.client_type)) {
          errors.push(`Invalid client_type for ${row.client_ref}. Must be 'company' or 'individual'`);
        }

        if (row.client_ref) clientRefs.add(row.client_ref);
        if (row.person_ref) personRefs.add(row.person_ref);

        if (!row.person_full_name && row.person_ref) {
          errors.push(`Missing person_full_name for ${row.person_ref}`);
        }
      }

      for (const row of clientServices || []) {
        if (!row.client_ref) errors.push("Missing client_ref in services data");
        if (row.client_ref && !clientRefs.has(row.client_ref)) {
          errors.push(`Client ref ${row.client_ref} in services not found in clients data`);
        }
        if (!row.service_name) errors.push(`Missing service_name for ${row.client_ref}`);
        if (!row.frequency) errors.push(`Missing frequency for ${row.client_ref} - ${row.service_name}`);
        if (row.frequency && !['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'].includes(row.frequency)) {
          errors.push(`Invalid frequency for ${row.client_ref}. Must be one of: daily, weekly, fortnightly, monthly, quarterly, annually`);
        }

        if (row.service_name) {
          const service = await storage.getServiceByName(row.service_name);
          if (!service) {
            const allServices = await storage.getAllServices();
            const serviceNames = allServices.map(s => s.name).join(', ');
            errors.push(`Service "${row.service_name}" not found in system. Available services: ${serviceNames || '(none)'}`);
          }
        }

        if (row.service_owner_email) {
          const user = await storage.getUserByEmail(row.service_owner_email);
          if (!user) {
            errors.push(`User with email "${row.service_owner_email}" not found in system`);
          }
        }
      }

      for (const row of roleAssignments || []) {
        if (!row.client_ref) errors.push("Missing client_ref in role assignments");
        if (row.client_ref && !clientRefs.has(row.client_ref)) {
          errors.push(`Client ref ${row.client_ref} in role assignments not found in clients data`);
        }
        if (!row.service_name) errors.push(`Missing service_name for ${row.client_ref}`);
        if (!row.work_role_name) errors.push(`Missing work_role_name for ${row.client_ref} - ${row.service_name}`);
        if (!row.assigned_user_email) errors.push(`Missing assigned_user_email for ${row.client_ref} - ${row.service_name} - ${row.work_role_name}`);

        if (row.work_role_name) {
          const workRole = await storage.getWorkRoleByName(row.work_role_name);
          if (!workRole) {
            const allWorkRoles = await storage.getAllWorkRoles();
            const roleNames = allWorkRoles.map(r => r.name).join(', ');
            errors.push(`Work role "${row.work_role_name}" not found in system. Available roles: ${roleNames || '(none)'}`);
          }
        }

        if (row.assigned_user_email) {
          const user = await storage.getUserByEmail(row.assigned_user_email);
          if (!user) {
            errors.push(`User with email "${row.assigned_user_email}" not found in system`);
          }
        }
      }

      res.json({
        isValid: errors.length === 0,
        errors,
        warnings,
      });
    } catch (error) {
      console.error("Validation error:", error);
      res.status(500).json({ message: "Validation failed" });
    }
  });

  app.post("/api/import/execute", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clients, clientServices, roleAssignments } = req.body;

      console.log("=== Import Execution Request ===");
      console.log("Clients count:", clients?.length || 0);
      console.log("Client Services count:", clientServices?.length || 0);
      console.log("Role Assignments count:", roleAssignments?.length || 0);

      const validationErrors: string[] = [];
      const clientRefs = new Set<string>();
      const personRefs = new Set<string>();

      for (const row of clients || []) {
        if (!row.client_ref) validationErrors.push("Missing client_ref in clients data");
        if (!row.client_name) validationErrors.push(`Missing client_name for ${row.client_ref || 'unknown'}`);
        if (!row.client_type) validationErrors.push(`Missing client_type for ${row.client_ref || 'unknown'}`);
        if (row.client_type && !['company', 'individual'].includes(row.client_type)) {
          validationErrors.push(`Invalid client_type for ${row.client_ref}. Must be 'company' or 'individual'`);
        }

        if (row.client_ref) clientRefs.add(row.client_ref);
        if (row.person_ref) personRefs.add(row.person_ref);

        if (!row.person_full_name && row.person_ref) {
          validationErrors.push(`Missing person_full_name for ${row.person_ref}`);
        }
      }

      const serviceLookup = new Map<string, any>();
      const userLookup = new Map<string, any>();

      for (const row of clientServices || []) {
        if (!row.client_ref) {
          validationErrors.push("Missing client_ref in services data");
        } else if (!clientRefs.has(row.client_ref)) {
          validationErrors.push(`Client ref ${row.client_ref} in services not found in clients data`);
        }

        if (!row.service_name) {
          validationErrors.push(`Missing service_name for ${row.client_ref}`);
        } else {
          if (!serviceLookup.has(row.service_name)) {
            const service = await storage.getServiceByName(row.service_name);
            if (!service) {
              const allServices = await storage.getAllServices();
              const serviceNames = allServices.map(s => s.name).join(', ');
              validationErrors.push(`Service "${row.service_name}" not found in system. Available services: ${serviceNames || '(none)'}`);
            } else {
              serviceLookup.set(row.service_name, service);
            }
          }
        }

        if (!row.frequency) {
          validationErrors.push(`Missing frequency for ${row.client_ref} - ${row.service_name}`);
        } else if (!['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'].includes(row.frequency)) {
          validationErrors.push(`Invalid frequency for ${row.client_ref}. Must be one of: daily, weekly, fortnightly, monthly, quarterly, annually`);
        }

        if (row.service_owner_email) {
          if (!userLookup.has(row.service_owner_email)) {
            const user = await storage.getUserByEmail(row.service_owner_email);
            if (!user) {
              validationErrors.push(`User with email "${row.service_owner_email}" not found in system`);
            } else {
              userLookup.set(row.service_owner_email, user);
            }
          }
        }
      }

      const workRoleLookup = new Map<string, any>();

      for (const row of roleAssignments || []) {
        if (!row.client_ref) {
          validationErrors.push("Missing client_ref in role assignments");
        } else if (!clientRefs.has(row.client_ref)) {
          validationErrors.push(`Client ref ${row.client_ref} in role assignments not found in clients data`);
        }

        if (!row.service_name) validationErrors.push(`Missing service_name for ${row.client_ref}`);
        if (!row.work_role_name) validationErrors.push(`Missing work_role_name for ${row.client_ref} - ${row.service_name}`);
        if (!row.assigned_user_email) validationErrors.push(`Missing assigned_user_email for ${row.client_ref} - ${row.service_name} - ${row.work_role_name}`);

        if (row.work_role_name) {
          if (!workRoleLookup.has(row.work_role_name)) {
            const workRole = await storage.getWorkRoleByName(row.work_role_name);
            if (!workRole) {
              const allWorkRoles = await storage.getAllWorkRoles();
              const roleNames = allWorkRoles.map(r => r.name).join(', ');
              validationErrors.push(`Work role "${row.work_role_name}" not found in system. Available roles: ${roleNames || '(none)'}`);
            } else {
              workRoleLookup.set(row.work_role_name, workRole);
            }
          }
        }

        if (row.assigned_user_email) {
          if (!userLookup.has(row.assigned_user_email)) {
            const user = await storage.getUserByEmail(row.assigned_user_email);
            if (!user) {
              validationErrors.push(`User with email "${row.assigned_user_email}" not found in system`);
            } else {
              userLookup.set(row.assigned_user_email, user);
            }
          }
        }
      }

      if (validationErrors.length > 0) {
        console.log("Validation failed with errors:", validationErrors);
        return res.status(400).json({
          success: false,
          message: "Import validation failed. No data has been imported.",
          errors: validationErrors,
          clientsCreated: 0,
          peopleCreated: 0,
          relationshipsCreated: 0,
          servicesCreated: 0,
          rolesAssigned: 0,
        });
      }

      console.log("Pre-validation passed. Starting transactional import...");

      const result = await db.transaction(async (tx) => {
        const stats = {
          success: true,
          clientsCreated: 0,
          peopleCreated: 0,
          relationshipsCreated: 0,
          servicesCreated: 0,
          rolesAssigned: 0,
          errors: [] as string[],
        };

        const clientMap = new Map<string, string>();
        const personMap = new Map<string, string>();
        const clientServiceMap = new Map<string, string>();

        for (const row of clients || []) {
          let clientId = clientMap.get(row.client_ref);

          if (!clientId) {
            const clientData = {
              name: row.client_name,
              email: row.client_email || null,
              clientType: row.client_type,
              companyNumber: row.company_number || null,
            };

            const [client] = await tx.insert(clientsTable).values(clientData).returning();
            clientId = client.id;
            clientMap.set(row.client_ref, clientId);
            stats.clientsCreated++;
          }

          if (row.person_ref && row.person_full_name) {
            let personId = personMap.get(row.person_ref);

            if (!personId) {
              const [person] = await tx.insert(peopleTable).values({
                fullName: row.person_full_name,
                email: row.person_email || null,
                telephone: row.person_telephone || null,
                primaryPhone: row.person_primary_phone || null,
                primaryEmail: row.person_primary_email || null,
              }).returning();
              personId = person.id;
              personMap.set(row.person_ref, personId);
              stats.peopleCreated++;
            }

            await tx.insert(clientPeopleTable).values({
              clientId,
              personId,
              officerRole: row.officer_role || null,
              isPrimaryContact: row.is_primary_contact?.toLowerCase() === 'yes',
            });
            stats.relationshipsCreated++;
          }
        }

        for (const row of clientServices || []) {
          const clientId = clientMap.get(row.client_ref);
          if (!clientId) {
            throw new Error(`Client ref ${row.client_ref} not found - this should have been caught in validation`);
          }

          const service = serviceLookup.get(row.service_name);
          if (!service) {
            throw new Error(`Service "${row.service_name}" not found - this should have been caught in validation`);
          }

          let serviceOwnerId = null;
          if (row.service_owner_email) {
            const user = userLookup.get(row.service_owner_email);
            if (user) {
              serviceOwnerId = user.id;
            }
          }

          const parseDate = (dateStr: string) => {
            if (!dateStr) return null;
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const [day, month, year] = parts;
              return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
            return null;
          };

          const nextStartDate = parseDate(row.next_start_date);
          const nextDueDate = parseDate(row.next_due_date);

          const [clientService] = await tx.insert(clientServicesTable).values({
            clientId,
            serviceId: service.id,
            serviceOwnerId,
            frequency: row.frequency,
            nextStartDate: nextStartDate,
            nextDueDate: nextDueDate,
            isActive: row.is_active?.toLowerCase() !== 'no',
          }).returning();
          const serviceKey = `${row.client_ref}|${row.service_name}`;
          clientServiceMap.set(serviceKey, clientService.id);
          stats.servicesCreated++;
        }

        for (const row of roleAssignments || []) {
          const serviceKey = `${row.client_ref}|${row.service_name}`;
          const clientServiceId = clientServiceMap.get(serviceKey);
          
          if (!clientServiceId) {
            throw new Error(`Client service not found for ${serviceKey} - this should have been caught earlier`);
          }

          const workRole = workRoleLookup.get(row.work_role_name);
          const user = userLookup.get(row.assigned_user_email);

          if (!workRole || !user) {
            throw new Error(`Work role or user not found - this should have been caught in validation`);
          }

          await tx.insert(clientServiceRoleAssignmentsTable).values({
            clientServiceId,
            workRoleId: workRole.id,
            userId: user.id,
            isActive: row.is_active?.toLowerCase() !== 'no',
          });
          stats.rolesAssigned++;
        }

        return { stats, clientMap };
      });

      console.log("Transactional import completed successfully:", result.stats);

      const clientsToEnrich: string[] = [];
      
      for (const [clientRef, clientId] of Array.from(result.clientMap.entries())) {
        const clientRow = clients.find((r: any) => r.client_ref === clientRef);
        if (clientRow?.company_number) {
          clientsToEnrich.push(clientId);
        }
      }

      console.log(`Auto-enriching ${clientsToEnrich.length} clients with Companies House data...`);

      const enrichmentResults = {
        successful: [] as string[],
        failed: [] as string[],
      };

      for (const clientId of clientsToEnrich) {
        try {
          const client = await storage.getClientById(clientId);
          if (client && client.companyNumber) {
            const companyProfile = await companiesHouseService.getCompanyProfile(client.companyNumber);
            const enrichedData = companiesHouseService.transformCompanyToClient(companyProfile);
            await storage.updateClient(clientId, enrichedData);
            enrichmentResults.successful.push(client.name);
            console.log(`Enriched client: ${client.name}`);
          }
        } catch (error) {
          const client = await storage.getClientById(clientId);
          enrichmentResults.failed.push(client?.name || 'Unknown');
          console.error(`Failed to enrich client ${clientId}:`, error);
        }
      }

      console.log(`Enrichment complete: ${enrichmentResults.successful.length} successful, ${enrichmentResults.failed.length} failed`);

      res.json({
        ...result.stats,
        enriched: enrichmentResults.successful.length,
        enrichmentFailed: enrichmentResults.failed.length,
      });

    } catch (error) {
      console.error("Import transaction failed and was rolled back:", error);
      res.status(500).json({ 
        success: false,
        message: "Import failed. No data has been imported due to an error.",
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        clientsCreated: 0,
        peopleCreated: 0,
        relationshipsCreated: 0,
        servicesCreated: 0,
        rolesAssigned: 0,
      });
    }
  });
}
