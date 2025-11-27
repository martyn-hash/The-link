import type { Express } from "express";
import { storage } from "../../storage/index";
import { z } from "zod";
import { insertPersonSchema } from "@shared/schema";
import { db } from "../../db";
import { eq, or, and, sql } from "drizzle-orm";
import { people, clients } from "@shared/schema";

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
        console.error("Person validation failed:", JSON.stringify(validationResult.error.issues, null, 2));
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

  // POST /api/people/check-duplicates - Check for duplicate emails/phones across people and clients
  app.post("/api/people/check-duplicates", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const bodyValidation = z.object({
        emails: z.array(z.string()).optional(),
        phones: z.array(z.string()).optional(),
        excludePersonId: z.string().optional(),
      }).safeParse(req.body);

      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: bodyValidation.error.issues
        });
      }

      const { emails, phones, excludePersonId } = bodyValidation.data;
      const duplicates: {
        type: 'email' | 'phone';
        value: string;
        foundIn: 'person' | 'client';
        name: string;
        clientName?: string;
      }[] = [];

      // Clean and normalize values
      const normalizedEmails = (emails || [])
        .map(e => e.toLowerCase().trim())
        .filter(e => e.length > 0);
      const normalizedPhones = (phones || [])
        .map(p => p.replace(/[^\d+]/g, ''))
        .filter(p => p.length > 0);

      if (normalizedEmails.length === 0 && normalizedPhones.length === 0) {
        return res.status(200).json({ duplicates: [] });
      }

      // Check emails in people table
      if (normalizedEmails.length > 0) {
        for (const email of normalizedEmails) {
          const peopleWithEmail = await db.select({
            id: people.id,
            fullName: people.fullName,
            primaryEmail: people.primaryEmail,
            email2: people.email2,
          })
          .from(people)
          .where(
            and(
              or(
                sql`LOWER(${people.primaryEmail}) = ${email}`,
                sql`LOWER(${people.email2}) = ${email}`
              ),
              excludePersonId ? sql`${people.id} != ${excludePersonId}` : sql`true`
            )
          )
          .limit(5);

          for (const person of peopleWithEmail) {
            duplicates.push({
              type: 'email',
              value: email,
              foundIn: 'person',
              name: person.fullName,
            });
          }

          // Also check clients table for email
          const clientsWithEmail = await db.select({
            id: clients.id,
            name: clients.name,
            email: clients.email,
          })
          .from(clients)
          .where(sql`LOWER(${clients.email}) = ${email}`)
          .limit(5);

          for (const client of clientsWithEmail) {
            duplicates.push({
              type: 'email',
              value: email,
              foundIn: 'client',
              name: client.name,
            });
          }
        }
      }

      // Check phones in people table
      if (normalizedPhones.length > 0) {
        for (const phone of normalizedPhones) {
          // Use regex to strip all non-digit/non-plus characters for comparison
          // This handles formats like "+44 (0)20 7123 4567", "(020) 123-4567", etc.
          const peopleWithPhone = await db.select({
            id: people.id,
            fullName: people.fullName,
            primaryPhone: people.primaryPhone,
            telephone2: people.telephone2,
          })
          .from(people)
          .where(
            and(
              or(
                sql`REGEXP_REPLACE(${people.primaryPhone}, '[^0-9+]', '', 'g') = ${phone}`,
                sql`REGEXP_REPLACE(${people.telephone2}, '[^0-9+]', '', 'g') = ${phone}`
              ),
              excludePersonId ? sql`${people.id} != ${excludePersonId}` : sql`true`
            )
          )
          .limit(5);

          for (const person of peopleWithPhone) {
            duplicates.push({
              type: 'phone',
              value: phone,
              foundIn: 'person',
              name: person.fullName,
            });
          }

          // Also check clients table for phone (companyTelephone)
          const clientsWithPhone = await db.select({
            id: clients.id,
            name: clients.name,
            companyTelephone: clients.companyTelephone,
          })
          .from(clients)
          .where(sql`REGEXP_REPLACE(${clients.companyTelephone}, '[^0-9+]', '', 'g') = ${phone}`)
          .limit(5);

          for (const client of clientsWithPhone) {
            duplicates.push({
              type: 'phone',
              value: phone,
              foundIn: 'client',
              name: client.name,
            });
          }
        }
      }

      // Deduplicate results (same name might appear multiple times if both fields match)
      const uniqueDuplicates = duplicates.filter((dup, index, self) =>
        index === self.findIndex((d) => 
          d.type === dup.type && d.value === dup.value && d.foundIn === dup.foundIn && d.name === dup.name
        )
      );

      res.status(200).json({ duplicates: uniqueDuplicates });

    } catch (error) {
      console.error("Error checking duplicates:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to check duplicates" });
    }
  });
}
