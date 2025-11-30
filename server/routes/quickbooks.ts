import type { Express } from "express";
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
          userId: req.effectiveUserId,
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
}
