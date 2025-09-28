import { Client } from '@microsoft/microsoft-graph-client';
import { storage } from '../storage';
import { decryptTokenFromStorage, encryptTokenForStorage } from './tokenEncryption';
import { nanoid } from 'nanoid';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUserOutlookClient(userId: string): Promise<Client> {
  try {
    const account = await storage.getUserOauthAccount(userId, 'outlook');
    
    if (!account) {
      throw new Error('Microsoft account not connected for user');
    }

    // Check if token is expired (with 5 minute buffer)
    const now = new Date();
    const tokenExpiry = new Date(account.expiresAt);
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    let accessToken = decryptTokenFromStorage(account.accessTokenEncrypted);
    
    // If token is expired or about to expire, refresh it
    if (tokenExpiry.getTime() - bufferTime <= now.getTime()) {
      console.log('Access token expired, refreshing...');
      
      if (!account.refreshTokenEncrypted) {
        throw new Error('No refresh token available, user needs to re-authenticate');
      }
      
      const refreshToken = decryptTokenFromStorage(account.refreshTokenEncrypted);
      const newTokens = await refreshAccessToken(refreshToken);
      
      // Update the stored tokens
      const newExpiresAt = new Date(now.getTime() + (newTokens.expires_in * 1000));
      
      await storage.updateUserOauthAccount(account.id, {
        accessTokenEncrypted: encryptTokenForStorage(newTokens.access_token),
        refreshTokenEncrypted: newTokens.refresh_token ? encryptTokenForStorage(newTokens.refresh_token) : account.refreshTokenEncrypted,
        expiresAt: newExpiresAt,
        updatedAt: now,
      });
      
      accessToken = newTokens.access_token;
    }

    return Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => accessToken
      }
    });
  } catch (error) {
    console.error('Error creating user Outlook client:', error);
    throw error;
  }
}

// Helper function to refresh access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  
  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID environment variable not set');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  // Add client secret if available (for confidential clients)
  if (clientSecret) {
    params.append('client_secret', clientSecret);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token refresh error:', errorText);
    throw new Error(`Failed to refresh access token: ${response.status} ${response.statusText}`);
  }

  const tokenData = await response.json() as RefreshTokenResponse;
  return tokenData;
}

// Helper function to send email via user's Microsoft Graph API
export async function sendEmailAsUser(userId: string, to: string, subject: string, content: string, isHtml: boolean = false) {
  try {
    const graphClient = await getUserOutlookClient(userId);
    
    const message = {
      subject,
      body: {
        contentType: isHtml ? 'HTML' : 'Text',
        content
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ]
    };

    const result = await graphClient.api('/me/sendMail').post({
      message,
      saveToSentItems: true
    });

    return { success: true, result };
  } catch (error) {
    console.error('Error sending email via user Outlook:', error);
    throw error;
  }
}

// Helper function to get user's profile information from Microsoft Graph
export async function getUserOutlookProfile(userId: string) {
  try {
    const graphClient = await getUserOutlookClient(userId);
    
    const profile = await graphClient.api('/me').get();
    
    return {
      id: profile.id,
      email: profile.mail || profile.userPrincipalName,
      displayName: profile.displayName,
      givenName: profile.givenName,
      surname: profile.surname,
    };
  } catch (error) {
    console.error('Error getting user Outlook profile:', error);
    throw error;
  }
}

// OAuth configuration
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || 'demo-client-id';
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || 'demo-client-secret';
const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:5000/api/oauth/outlook/callback';
const TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common';
const SCOPES = 'openid email profile offline_access Mail.Send User.Read';

// Check if OAuth is properly configured
const isOAuthConfigured = () => {
  return CLIENT_ID !== 'demo-client-id' && CLIENT_SECRET !== 'demo-client-secret';
};

// Store for OAuth state verification (in production, use Redis or database)
const oauthStates = new Map<string, { userId: string; timestamp: number }>();

// Clean up expired states (older than 10 minutes)
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [state, data] of oauthStates.entries()) {
    if (data.timestamp < tenMinutesAgo) {
      oauthStates.delete(state);
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

// Generate Microsoft OAuth authorization URL
export async function generateUserOutlookAuthUrl(userId: string): Promise<string> {
  if (!isOAuthConfigured()) {
    throw new Error('Microsoft OAuth not configured - please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables');
  }

  const state = nanoid(32);
  
  // Store the state with user ID for verification
  oauthStates.set(state, { userId, timestamp: Date.now() });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    response_mode: 'query',
    prompt: 'consent' // Force consent to ensure refresh token
  });

  return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
}

// Exchange authorization code for access tokens
export async function exchangeCodeForTokens(code: string, state: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify state
    const stateData = oauthStates.get(state);
    if (!stateData) {
      return { success: false, error: 'Invalid or expired state parameter' };
    }

    // Clean up the used state
    oauthStates.delete(state);

    const { userId } = stateData;

    if (!isOAuthConfigured()) {
      return { success: false, error: 'Microsoft OAuth not configured - please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables' };
    }

    // Exchange code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
    
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: SCOPES
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const tokenData = await response.json() as TokenResponse;

    if (!response.ok) {
      console.error('Token exchange failed:', tokenData);
      return { success: false, error: 'Failed to exchange authorization code for tokens' };
    }

    if (!tokenData.access_token) {
      return { success: false, error: 'No access token received' };
    }

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    // Check if user already has an account, update or create
    const existingAccount = await storage.getUserOauthAccount(userId, 'outlook');
    
    if (existingAccount) {
      // Update existing account
      await storage.updateUserOauthAccount(existingAccount.id, {
        accessTokenEncrypted: encryptTokenForStorage(tokenData.access_token),
        refreshTokenEncrypted: tokenData.refresh_token ? encryptTokenForStorage(tokenData.refresh_token) : existingAccount.refreshTokenEncrypted,
        expiresAt,
        updatedAt: new Date(),
      });
    } else {
      // Create new account
      await storage.createUserOauthAccount({
        userId,
        provider: 'outlook',
        accessTokenEncrypted: encryptTokenForStorage(tokenData.access_token),
        refreshTokenEncrypted: tokenData.refresh_token ? encryptTokenForStorage(tokenData.refresh_token) : null,
        expiresAt,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    return { success: false, error: 'Failed to process authorization' };
  }
}