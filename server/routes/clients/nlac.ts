import type { Express } from "express";
import { storage } from "../../storage/index";
import { db } from "../../db";
import { z } from "zod";
import { validateParams } from "../routeHelpers";
import {
  projects,
  clientServices,
  nlacAuditLogs,
  clients,
  companySettings,
  clientPortalUsers,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";

const nlacReasonSchema = z.enum([
  "moving_to_new_accountant",
  "ceasing_trading",
  "no_longer_using_accountant",
  "taking_accounts_in_house",
  "other",
  "reactivated",
]);

const nlacRequestSchema = z.object({
  reason: nlacReasonSchema,
  password: z.string().min(1, "Password is required"),
});

export function registerNlacRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  const clientIdSchema = z.object({
    id: z.string().min(1, "Client ID is required"),
  });

  app.post(
    "/api/clients/:id/nlac",
    isAuthenticated,
    resolveEffectiveUser,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        const paramValidation = validateParams(clientIdSchema, req.params);
        if (!paramValidation.success) {
          return res.status(400).json({
            message: "Invalid path parameters",
            errors: paramValidation.errors,
          });
        }

        const bodyValidation = nlacRequestSchema.safeParse(req.body);
        if (!bodyValidation.success) {
          return res.status(400).json({
            message: "Invalid request body",
            errors: bodyValidation.error.issues,
          });
        }

        const { id: clientId } = paramValidation.data;
        const { reason, password } = bodyValidation.data;
        const user = req.user;

        const client = await storage.getClientById(clientId);
        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }

        if (client.companyStatus === "inactive") {
          return res
            .status(400)
            .json({ message: "Client is already marked as inactive" });
        }

        const settings = await db.select().from(companySettings).limit(1);
        const nlacPasswordHash = settings[0]?.nlacPassword;

        if (!nlacPasswordHash) {
          return res.status(400).json({
            message:
              "NLAC password has not been configured. Please contact a Super Admin to set up the NLAC password in Company Settings.",
          });
        }

        const passwordValid = await bcrypt.compare(password, nlacPasswordHash);
        if (!passwordValid) {
          return res.status(401).json({ message: "Incorrect NLAC password" });
        }

        const projectsResult = await db
          .update(projects)
          .set({
            inactive: true,
            archived: true,
            inactiveReason: "no_longer_required",
            inactiveAt: new Date(),
            inactiveByUserId: user.id,
          })
          .where(
            and(eq(projects.clientId, clientId), eq(projects.inactive, false))
          )
          .returning({ id: projects.id });

        const projectsDeactivated = projectsResult.length;

        const servicesResult = await db
          .update(clientServices)
          .set({
            isActive: false,
            inactiveReason: "no_longer_required",
            inactiveAt: new Date(),
            inactiveByUserId: user.id,
          })
          .where(
            and(
              eq(clientServices.clientId, clientId),
              eq(clientServices.isActive, true)
            )
          )
          .returning({ id: clientServices.id });

        const servicesDeactivated = servicesResult.length;

        await db
          .update(clients)
          .set({ companyStatus: "inactive" })
          .where(eq(clients.id, clientId));

        const portalUsersResult = await db
          .update(clientPortalUsers)
          .set({ isActive: false })
          .where(
            and(
              eq(clientPortalUsers.clientId, clientId),
              eq(clientPortalUsers.isActive, true)
            )
          )
          .returning({ id: clientPortalUsers.id });

        const portalUsersDeactivated = portalUsersResult.length;

        await db.insert(nlacAuditLogs).values({
          clientId,
          clientName: client.name,
          reason,
          performedByUserId: user.id,
          performedByUserName: user.fullName || user.email,
          projectsDeactivated,
          servicesDeactivated,
          portalUsersDeactivated,
        });

        res.json({
          success: true,
          message: `Client ${client.name} has been marked as inactive`,
          projectsDeactivated,
          servicesDeactivated,
          portalUsersDeactivated,
        });
      } catch (error) {
        console.error("Error processing NLAC:", error);
        res.status(500).json({ message: "Failed to process NLAC request" });
      }
    }
  );

  app.get(
    "/api/clients/:id/nlac-logs",
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

        const { id: clientId } = paramValidation.data;

        const logs = await db
          .select()
          .from(nlacAuditLogs)
          .where(eq(nlacAuditLogs.clientId, clientId))
          .orderBy(nlacAuditLogs.createdAt);

        res.json(logs);
      } catch (error) {
        console.error("Error fetching NLAC logs:", error);
        res.status(500).json({ message: "Failed to fetch NLAC logs" });
      }
    }
  );

  app.post(
    "/api/clients/:id/reactivate",
    isAuthenticated,
    resolveEffectiveUser,
    requireAdmin,
    async (req: any, res: any) => {
      try {
        const paramValidation = validateParams(clientIdSchema, req.params);
        if (!paramValidation.success) {
          return res.status(400).json({
            message: "Invalid path parameters",
            errors: paramValidation.errors,
          });
        }

        const { id: clientId } = paramValidation.data;
        const user = req.user;

        const client = await storage.getClientById(clientId);
        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }

        if (client.companyStatus !== "inactive") {
          return res
            .status(400)
            .json({ message: "Client is not currently inactive" });
        }

        await db
          .update(clients)
          .set({ companyStatus: "active" })
          .where(eq(clients.id, clientId));

        const portalUsersResult = await db
          .update(clientPortalUsers)
          .set({ isActive: true })
          .where(
            and(
              eq(clientPortalUsers.clientId, clientId),
              eq(clientPortalUsers.isActive, false)
            )
          )
          .returning({ id: clientPortalUsers.id });

        const portalUsersReactivated = portalUsersResult.length;

        await db.insert(nlacAuditLogs).values({
          clientId,
          clientName: client.name,
          reason: "reactivated",
          performedByUserId: user.id,
          performedByUserName: user.fullName || user.email,
          projectsDeactivated: 0,
          servicesDeactivated: 0,
          portalUsersDeactivated: -portalUsersReactivated,
        });

        res.json({
          success: true,
          message: `Client ${client.name} has been reactivated`,
          portalUsersReactivated,
        });
      } catch (error) {
        console.error("Error reactivating client:", error);
        res.status(500).json({ message: "Failed to reactivate client" });
      }
    }
  );
}
