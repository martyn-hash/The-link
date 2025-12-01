import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage/index";
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  getCompanyInfo,
  encryptTokens,
  decryptTokens,
  calculateTokenExpiry,
  isAccessTokenExpired,
  isRefreshTokenExpired,
  generateOAuthState,
  isQuickBooksConfigured,
} from "../services/quickbooks";
import {
  runQcChecks,
  qcChecks,
  getSectionLabel,
  getStatusLabel,
  getStatusColor,
} from "../services/qboQcService";

const dateStringSchema = z.string().refine((val) => {
  const date = new Date(val);
  return !isNaN(date.getTime());
}, { message: "Invalid date format" });

const qcRunSchema = z.object({
  periodStart: dateStringSchema,
  periodEnd: dateStringSchema,
}).refine((data) => {
  const start = new Date(data.periodStart);
  const end = new Date(data.periodEnd);
  return start <= end;
}, { message: "Period start must be before or equal to period end" }).refine((data) => {
  const start = new Date(data.periodStart);
  const end = new Date(data.periodEnd);
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff <= 366;
}, { message: "Period cannot exceed 366 days" });

const itemActionSchema = z.object({
  note: z.string().max(1000).optional().nullable(),
});

export function registerQuickBooksRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireSuperAdmin: any
) {
  app.get(
    "/api/quickbooks/status",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        res.json({
          configured: isQuickBooksConfigured(),
        });
      } catch (error) {
        console.error("Error checking QuickBooks status:", error);
        res.status(500).json({ message: "Failed to check QuickBooks status" });
      }
    }
  );

  app.get(
    "/api/quickbooks/connect/:clientId",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { clientId } = req.params;
        
        if (!isQuickBooksConfigured()) {
          return res.status(400).json({ 
            message: "QuickBooks is not configured. Please add QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET." 
          });
        }

        const client = await storage.getClientById(clientId);
        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }

        const existingConnection = await storage.getQboConnectionByClientId(clientId);
        if (existingConnection) {
          return res.status(400).json({ 
            message: "This client already has a QuickBooks connection. Disconnect it first." 
          });
        }

        const state = generateOAuthState();
        
        await storage.createQboOAuthState({
          state,
          clientId,
          userId: req.user?.effectiveUserId,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        const authUrl = generateAuthUrl(state);
        
        res.json({ authUrl });
      } catch (error) {
        console.error("Error initiating QuickBooks connection:", error);
        res.status(500).json({ message: "Failed to initiate QuickBooks connection" });
      }
    }
  );

  app.get("/api/oauth/callback", async (req: any, res: any) => {
    try {
      const { code, realmId, state, error } = req.query;

      if (error) {
        console.error("QuickBooks OAuth error:", error);
        return res.redirect("/super-admin/qbo-connections?error=" + encodeURIComponent(error as string));
      }

      if (!code || !realmId || !state) {
        return res.redirect("/super-admin/qbo-connections?error=missing_params");
      }

      const oauthState = await storage.getQboOAuthStateByState(state as string);
      
      if (!oauthState) {
        return res.redirect("/super-admin/qbo-connections?error=invalid_state");
      }

      if (oauthState.used) {
        return res.redirect("/super-admin/qbo-connections?error=state_already_used");
      }

      if (new Date() > oauthState.expiresAt) {
        return res.redirect("/super-admin/qbo-connections?error=state_expired");
      }

      await storage.markQboOAuthStateAsUsed(oauthState.id);

      const existingRealmConnection = await storage.getQboConnectionByRealmId(realmId as string);
      if (existingRealmConnection) {
        return res.redirect("/super-admin/qbo-connections?error=realm_already_connected");
      }

      const tokenResponse = await exchangeCodeForTokens(code as string);
      
      const { accessTokenEncrypted, refreshTokenEncrypted } = encryptTokens(
        tokenResponse.access_token,
        tokenResponse.refresh_token
      );
      
      const { accessTokenExpiresAt, refreshTokenExpiresAt } = calculateTokenExpiry(
        tokenResponse.expires_in,
        tokenResponse.x_refresh_token_expires_in
      );

      let companyName = null;
      try {
        const companyInfo = await getCompanyInfo(tokenResponse.access_token, realmId as string);
        companyName = companyInfo.CompanyInfo?.CompanyName || companyInfo.CompanyInfo?.LegalName || null;
      } catch (err) {
        console.error("Failed to fetch company name:", err);
      }

      await storage.createQboConnection({
        clientId: oauthState.clientId,
        realmId: realmId as string,
        companyName,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        scope: "com.intuit.quickbooks.accounting",
        connectedBy: oauthState.userId,
        isActive: true,
      });

      res.redirect("/super-admin/qbo-connections?success=connected");
    } catch (error) {
      console.error("Error handling QuickBooks OAuth callback:", error);
      res.redirect("/super-admin/qbo-connections?error=callback_failed");
    }
  });

  app.post(
    "/api/quickbooks/disconnect/:clientId",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { clientId } = req.params;
        
        const connection = await storage.getQboConnectionByClientId(clientId);
        if (!connection) {
          return res.status(404).json({ message: "No QuickBooks connection found for this client" });
        }

        try {
          const { accessToken } = decryptTokens(
            connection.accessTokenEncrypted,
            connection.refreshTokenEncrypted
          );
          await revokeToken(accessToken);
        } catch (err) {
          console.error("Failed to revoke QuickBooks token:", err);
        }

        await storage.deactivateQboConnection(connection.id);

        res.json({ message: "QuickBooks disconnected successfully" });
      } catch (error) {
        console.error("Error disconnecting QuickBooks:", error);
        res.status(500).json({ message: "Failed to disconnect QuickBooks" });
      }
    }
  );

  app.get(
    "/api/quickbooks/connection/:clientId",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { clientId } = req.params;
        
        const connection = await storage.getQboConnectionByClientId(clientId);
        if (!connection) {
          return res.json({ connected: false });
        }

        const accessTokenExpired = isAccessTokenExpired(connection.accessTokenExpiresAt);
        const refreshTokenExpired = isRefreshTokenExpired(connection.refreshTokenExpiresAt);

        res.json({
          connected: true,
          id: connection.id,
          realmId: connection.realmId,
          companyName: connection.companyName,
          accessTokenExpired,
          refreshTokenExpired,
          lastSyncAt: connection.lastSyncAt,
          lastErrorMessage: connection.lastErrorMessage,
          createdAt: connection.createdAt,
        });
      } catch (error) {
        console.error("Error getting QuickBooks connection status:", error);
        res.status(500).json({ message: "Failed to get QuickBooks connection status" });
      }
    }
  );

  app.get(
    "/api/super-admin/qbo-connections",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const connections = await storage.getQboConnectionsWithClients();
        
        const connectionsWithStatus = connections.map(conn => ({
          ...conn,
          accessTokenExpired: isAccessTokenExpired(conn.accessTokenExpiresAt),
          refreshTokenExpired: isRefreshTokenExpired(conn.refreshTokenExpiresAt),
          accessTokenEncrypted: undefined,
          refreshTokenEncrypted: undefined,
        }));

        res.json(connectionsWithStatus);
      } catch (error) {
        console.error("Error fetching QBO connections:", error);
        res.status(500).json({ message: "Failed to fetch QBO connections" });
      }
    }
  );

  app.post(
    "/api/quickbooks/refresh/:connectionId",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { connectionId } = req.params;
        
        const connection = await storage.getQboConnectionById(connectionId);
        if (!connection) {
          return res.status(404).json({ message: "Connection not found" });
        }

        if (isRefreshTokenExpired(connection.refreshTokenExpiresAt)) {
          return res.status(400).json({ 
            message: "Refresh token has expired. Please reconnect the QuickBooks account." 
          });
        }

        const { refreshToken } = decryptTokens(
          connection.accessTokenEncrypted,
          connection.refreshTokenEncrypted
        );

        const tokenResponse = await refreshAccessToken(refreshToken);
        
        const { accessTokenEncrypted, refreshTokenEncrypted } = encryptTokens(
          tokenResponse.access_token,
          tokenResponse.refresh_token
        );
        
        const { accessTokenExpiresAt, refreshTokenExpiresAt } = calculateTokenExpiry(
          tokenResponse.expires_in,
          tokenResponse.x_refresh_token_expires_in
        );

        await storage.updateQboConnectionTokens(
          connection.id,
          accessTokenEncrypted,
          refreshTokenEncrypted,
          accessTokenExpiresAt,
          refreshTokenExpiresAt
        );

        res.json({ message: "Tokens refreshed successfully" });
      } catch (error) {
        console.error("Error refreshing QuickBooks tokens:", error);
        res.status(500).json({ message: "Failed to refresh QuickBooks tokens" });
      }
    }
  );

  app.post(
    "/api/quickbooks/test/:connectionId",
    isAuthenticated,
    resolveEffectiveUser,
    requireSuperAdmin,
    async (req: any, res: any) => {
      try {
        const { connectionId } = req.params;
        
        const connection = await storage.getQboConnectionById(connectionId);
        if (!connection) {
          return res.status(404).json({ message: "Connection not found" });
        }

        let { accessToken, refreshToken } = decryptTokens(
          connection.accessTokenEncrypted,
          connection.refreshTokenEncrypted
        );

        if (isAccessTokenExpired(connection.accessTokenExpiresAt)) {
          if (isRefreshTokenExpired(connection.refreshTokenExpiresAt)) {
            return res.status(400).json({ 
              message: "Both tokens have expired. Please reconnect the QuickBooks account." 
            });
          }

          const tokenResponse = await refreshAccessToken(refreshToken);
          
          const encrypted = encryptTokens(
            tokenResponse.access_token,
            tokenResponse.refresh_token
          );
          
          const expiry = calculateTokenExpiry(
            tokenResponse.expires_in,
            tokenResponse.x_refresh_token_expires_in
          );

          await storage.updateQboConnectionTokens(
            connection.id,
            encrypted.accessTokenEncrypted,
            encrypted.refreshTokenEncrypted,
            expiry.accessTokenExpiresAt,
            expiry.refreshTokenExpiresAt
          );

          accessToken = tokenResponse.access_token;
        }

        const companyInfo = await getCompanyInfo(accessToken, connection.realmId);
        
        await storage.updateQboConnectionLastSync(connection.id);

        res.json({
          success: true,
          companyName: companyInfo.CompanyInfo?.CompanyName,
          legalName: companyInfo.CompanyInfo?.LegalName,
        });
      } catch (error: any) {
        console.error("Error testing QuickBooks connection:", error);
        await storage.updateQboConnectionError(req.params.connectionId, error.message);
        res.status(500).json({ message: "Failed to test QuickBooks connection", error: error.message });
      }
    }
  );

  app.get(
    "/api/qc/checks",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const checks = qcChecks.map(check => ({
          code: check.code,
          name: check.name,
          section: check.section,
          sectionLabel: getSectionLabel(check.section),
          description: check.description,
        }));
        
        res.json(checks);
      } catch (error) {
        console.error("Error fetching QC checks:", error);
        res.status(500).json({ message: "Failed to fetch QC checks" });
      }
    }
  );

  app.post(
    "/api/qc/run/:clientId",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { clientId } = req.params;
        
        const validationResult = qcRunSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({ 
            message: "Invalid request", 
            errors: validationResult.error.errors.map(e => e.message) 
          });
        }
        
        const { periodStart, periodEnd } = validationResult.data;
        
        const connection = await storage.getQboConnectionByClientId(clientId);
        if (!connection) {
          return res.status(400).json({ 
            message: "No QuickBooks connection found for this client. Please connect QuickBooks first." 
          });
        }
        
        if (!connection.isActive) {
          return res.status(400).json({ message: "QuickBooks connection is inactive" });
        }
        
        const run = await runQcChecks(
          clientId,
          connection.id,
          new Date(periodStart),
          new Date(periodEnd),
          req.user?.effectiveUserId
        );
        
        res.json(run);
      } catch (error: any) {
        console.error("Error running QC checks:", error);
        res.status(500).json({ message: "Failed to run QC checks", error: error.message });
      }
    }
  );

  app.get(
    "/api/qc/summary/:clientId",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { clientId } = req.params;
        
        const summary = await storage.getLatestQcRunSummary(clientId);
        
        if (!summary) {
          return res.json({ hasRun: false });
        }
        
        res.json({
          hasRun: true,
          ...summary,
        });
      } catch (error) {
        console.error("Error fetching QC summary:", error);
        res.status(500).json({ message: "Failed to fetch QC summary" });
      }
    }
  );

  app.get(
    "/api/qc/runs/:clientId",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { clientId } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;
        
        const runs = await storage.getQcRunsByClientId(clientId, limit);
        
        res.json(runs);
      } catch (error) {
        console.error("Error fetching QC runs:", error);
        res.status(500).json({ message: "Failed to fetch QC runs" });
      }
    }
  );

  app.get(
    "/api/qc/run/:runId",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { runId } = req.params;
        
        const runWithDetails = await storage.getQcRunWithDetails(runId);
        
        if (!runWithDetails) {
          return res.status(404).json({ message: "QC run not found" });
        }
        
        const resultsWithLabels = runWithDetails.results.map(result => ({
          ...result,
          sectionLabel: getSectionLabel(result.section as any),
          statusLabel: getStatusLabel(result.status as any),
          statusColor: getStatusColor(result.status as any),
        }));
        
        res.json({
          ...runWithDetails,
          results: resultsWithLabels,
        });
      } catch (error) {
        console.error("Error fetching QC run details:", error);
        res.status(500).json({ message: "Failed to fetch QC run details" });
      }
    }
  );

  app.get(
    "/api/qc/pending/:clientId",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { clientId } = req.params;
        
        const pendingItems = await storage.getPendingApprovalsByClientId(clientId);
        
        res.json(pendingItems);
      } catch (error) {
        console.error("Error fetching pending approvals:", error);
        res.status(500).json({ message: "Failed to fetch pending approvals" });
      }
    }
  );

  app.post(
    "/api/qc/item/:itemId/approve",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { itemId } = req.params;
        const userId = req.user?.effectiveUserId;
        
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }
        
        const validationResult = itemActionSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({ 
            message: "Invalid request", 
            errors: validationResult.error.errors.map(e => e.message) 
          });
        }
        
        const { note } = validationResult.data;
        const item = await storage.approveQcResultItem(itemId, userId, note || null);
        
        res.json(item);
      } catch (error: any) {
        console.error("Error approving QC item:", error);
        res.status(500).json({ message: "Failed to approve item", error: error.message });
      }
    }
  );

  app.post(
    "/api/qc/item/:itemId/escalate",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { itemId } = req.params;
        const userId = req.user?.effectiveUserId;
        
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }
        
        const validationResult = itemActionSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({ 
            message: "Invalid request", 
            errors: validationResult.error.errors.map(e => e.message) 
          });
        }
        
        const { note } = validationResult.data;
        const item = await storage.escalateQcResultItem(itemId, userId, note || null);
        
        res.json(item);
      } catch (error: any) {
        console.error("Error escalating QC item:", error);
        res.status(500).json({ message: "Failed to escalate item", error: error.message });
      }
    }
  );

  app.post(
    "/api/qc/item/:itemId/resolve",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { itemId } = req.params;
        const userId = req.user?.effectiveUserId;
        
        if (!userId) {
          return res.status(401).json({ message: "User not authenticated" });
        }
        
        const validationResult = itemActionSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({ 
            message: "Invalid request", 
            errors: validationResult.error.errors.map(e => e.message) 
          });
        }
        
        const { note } = validationResult.data;
        const item = await storage.resolveQcResultItem(itemId, userId, note || null);
        
        res.json(item);
      } catch (error: any) {
        console.error("Error resolving QC item:", error);
        res.status(500).json({ message: "Failed to resolve item", error: error.message });
      }
    }
  );

  app.get(
    "/api/qc/item/:itemId/history",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { itemId } = req.params;
        
        const history = await storage.getApprovalHistoryByItemId(itemId);
        
        res.json(history);
      } catch (error) {
        console.error("Error fetching approval history:", error);
        res.status(500).json({ message: "Failed to fetch approval history" });
      }
    }
  );
}
