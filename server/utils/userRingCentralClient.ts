import { SDK } from '@ringcentral/sdk';
import { storage } from '../storage/index';
import { decryptTokenFromStorage, encryptTokenForStorage } from './tokenEncryption';
import { nanoid } from 'nanoid';

interface RingCentralTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export class RingCentralReauthRequiredError extends Error {
  constructor(message: string = 'RingCentral re-authentication required') {
    super(message);
    this.name = 'RingCentralReauthRequiredError';
  }
}

// RingCentral OAuth configuration
const CLIENT_ID = process.env.RINGCENTRAL_CLIENT_ID;
const CLIENT_SECRET = process.env.RINGCENTRAL_CLIENT_SECRET;
const SERVER_URL = process.env.RINGCENTRAL_SERVER_URL || SDK.server.production;

// Auto-detect the correct redirect URI based on environment
const getRedirectUri = () => {
  if (process.env.RINGCENTRAL_REDIRECT_URI) {
    return process.env.RINGCENTRAL_REDIRECT_URI;
  }
  
  // Replit environment - use REPLIT_DEV_DOMAIN
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/oauth/ringcentral/callback`;
  }
  
  // Default fallback for local development
  return 'http://localhost:5000/api/oauth/ringcentral/callback';
};

const REDIRECT_URI = getRedirectUri();

// Check if OAuth is properly configured
const isOAuthConfigured = () => {
  return !!CLIENT_ID && !!CLIENT_SECRET;
};

// Store for OAuth state verification (in production, use Redis or database)
const oauthStates = new Map<string, { userId: string; timestamp: number }>();

// Clean up expired states (older than 10 minutes)
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [state, data] of Array.from(oauthStates.entries())) {
    if (data.timestamp < tenMinutesAgo) {
      oauthStates.delete(state);
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

interface SIPProvision {
  sipInfo: Array<{
    domain: string;
    username: string;
    password: string;
    authorizationId: string;
    transport: string;
  }>;
}

// Get or create RingCentral SDK instance for a user
export async function getUserRingCentralSDK(userId: string): Promise<SDK> {
  try {
    const integration = await storage.getUserIntegrationByType(userId, 'ringcentral');
    
    if (!integration || !integration.accessToken) {
      throw new Error('RingCentral account not connected for user');
    }

    // Check if token is expired (with 5 minute buffer)
    const now = new Date();
    let tokenExpiry = integration.tokenExpiry ? new Date(integration.tokenExpiry) : new Date(0);
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    let accessToken = decryptTokenFromStorage(integration.accessToken);
    let refreshToken = integration.refreshToken ? decryptTokenFromStorage(integration.refreshToken) : undefined;
    
    // If token is expired or about to expire, refresh it
    if (tokenExpiry.getTime() - bufferTime <= now.getTime()) {
      console.log('RingCentral access token expired, refreshing...');
      
      if (!refreshToken) {
        // No refresh token - auto-disconnect and require re-auth
        console.log('[RingCentral] No refresh token available, disconnecting integration...');
        await storage.updateUserIntegration(integration.id, {
          isActive: false,
          accessToken: null,
          refreshToken: null,
          tokenExpiry: null,
        });
        throw new RingCentralReauthRequiredError('No refresh token available. Please reconnect your RingCentral account.');
      }
      
      const newTokens = await refreshAccessToken(refreshToken, integration.id);
      
      // Update the stored tokens and recalculate expiry
      const newExpiresAt = new Date(now.getTime() + (newTokens.expires_in * 1000));
      tokenExpiry = newExpiresAt; // Use the new expiry for SDK setup
      
      await storage.updateUserIntegration(integration.id, {
        accessToken: encryptTokenForStorage(newTokens.access_token),
        refreshToken: newTokens.refresh_token ? encryptTokenForStorage(newTokens.refresh_token) : integration.refreshToken,
        tokenExpiry: newExpiresAt,
        metadata: {
          ...(integration.metadata as object || {}),
          lastUsedAt: new Date().toISOString()
        }
      });
      
      accessToken = newTokens.access_token;
      refreshToken = newTokens.refresh_token || refreshToken;
    }

    // Create RingCentral SDK instance
    const clientId = process.env.RINGCENTRAL_CLIENT_ID;
    const clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET;
    const serverUrl = process.env.RINGCENTRAL_SERVER_URL || SDK.server.production;

    if (!clientId || !clientSecret) {
      throw new Error('RingCentral credentials not configured');
    }

    const rcsdk = new SDK({
      server: serverUrl,
      clientId: clientId,
      clientSecret: clientSecret
    });

    const platform = rcsdk.platform();
    
    // Set the access token directly with current expiry
    const expiresIn = Math.max(0, Math.floor((tokenExpiry.getTime() - now.getTime()) / 1000));
    await platform.auth().setData({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: String(expiresIn),
      token_type: 'Bearer'
    });

    return rcsdk;
  } catch (error) {
    console.error('Error creating RingCentral SDK:', error);
    throw error;
  }
}

// Refresh access token using refresh token
async function refreshAccessToken(refreshToken: string, integrationId?: string): Promise<RingCentralTokens> {
  const clientId = process.env.RINGCENTRAL_CLIENT_ID;
  const clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET;
  const serverUrl = process.env.RINGCENTRAL_SERVER_URL || SDK.server.production;

  if (!clientId || !clientSecret) {
    throw new Error('RingCentral credentials not configured');
  }

  const tokenUrl = `${serverUrl}/restapi/oauth/token`;
  
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('RingCentral token refresh error:', errorText);
    
    // Check if this is a token expiration error (refresh token expired after 7 days of inactivity)
    const isTokenExpired = errorText.includes('Token is expired') || 
                           errorText.includes('token_invalid') ||
                           errorText.includes('invalid_grant') ||
                           response.status === 400;
    
    if (isTokenExpired && integrationId) {
      console.log('[RingCentral] Refresh token expired, auto-disconnecting integration...');
      // Auto-disconnect the integration since tokens are no longer valid
      await storage.updateUserIntegration(integrationId, {
        isActive: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
      });
    }
    
    if (isTokenExpired) {
      throw new RingCentralReauthRequiredError('RingCentral session expired. Please reconnect your RingCentral account.');
    }
    
    throw new Error(`Failed to refresh RingCentral token: ${response.status} ${response.statusText}`);
  }

  const tokenData = await response.json() as RingCentralTokens;
  return tokenData;
}

// Get SIP provisioning credentials for WebRTC
export async function getSIPProvisionCredentials(userId: string): Promise<SIPProvision> {
  try {
    const rcsdk = await getUserRingCentralSDK(userId);
    const platform = rcsdk.platform();

    const response = await platform.post('/restapi/v1.0/client-info/sip-provision', {
      sipInfo: [{ transport: 'WSS' }]
    });

    const data = await response.json();
    return data as SIPProvision;
  } catch (error) {
    console.error('Error getting SIP provision:', error);
    throw error;
  }
}

// Get call log details
export async function getCallLog(userId: string, sessionId: string) {
  try {
    const rcsdk = await getUserRingCentralSDK(userId);
    const platform = rcsdk.platform();

    const response = await platform.get(`/restapi/v1.0/account/~/call-log/${sessionId}`);
    return await response.json();
  } catch (error) {
    console.error('Error getting call log:', error);
    throw error;
  }
}

// Get call recording URL
export async function getCallRecordingUrl(userId: string, recordingId: string): Promise<string> {
  try {
    const rcsdk = await getUserRingCentralSDK(userId);
    const platform = rcsdk.platform();

    const response = await platform.get(`/restapi/v1.0/account/~/recording/${recordingId}`);
    const data = await response.json();
    return data.contentUri;
  } catch (error) {
    console.error('Error getting call recording URL:', error);
    throw error;
  }
}

// Request call transcription via RingCentral AI API
export async function requestCallTranscription(userId: string, recordingUrl: string, webhookUrl?: string) {
  try {
    const rcsdk = await getUserRingCentralSDK(userId);
    const platform = rcsdk.platform();

    const body: any = {
      contentUri: recordingUrl,
      encoding: 'Mpeg',
      languageCode: 'en-US',
      source: 'RingCentral',
      audioType: 'CallCenter',
      enablePunctuation: true,
      enableSpeakerDiarization: true,
    };

    let url = '/ai/audio/v1/async/speech-to-text';
    if (webhookUrl) {
      url += `?webhook=${encodeURIComponent(webhookUrl)}`;
    }

    const response = await platform.post(url, body);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error requesting call transcription:', error);
    throw error;
  }
}

// Get transcription status/result
export async function getTranscriptionResult(userId: string, jobId: string) {
  try {
    const rcsdk = await getUserRingCentralSDK(userId);
    const platform = rcsdk.platform();

    const response = await platform.get(`/ai/audio/v1/async/speech-to-text/${jobId}`);
    return await response.json();
  } catch (error) {
    console.error('Error getting transcription result:', error);
    throw error;
  }
}

// Request text summarization from RingCentral AI API
export async function requestTextSummarization(userId: string, utterances: Array<{ start: number; end: number; speakerId: string; text: string }>) {
  try {
    const rcsdk = await getUserRingCentralSDK(userId);
    const platform = rcsdk.platform();

    const body = {
      utterances,
      summaryType: 'All' // Get both abstractive and extractive summaries
    };

    const response = await platform.post('/ai/text/v1/async/summarize', body);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error requesting text summarization:', error);
    throw error;
  }
}

// Get summarization result
export async function getSummarizationResult(userId: string, jobId: string) {
  try {
    const rcsdk = await getUserRingCentralSDK(userId);
    const platform = rcsdk.platform();

    const response = await platform.get(`/ai/text/v1/async/summarize/${jobId}`);
    return await response.json();
  } catch (error) {
    console.error('Error getting summarization result:', error);
    throw error;
  }
}

// Try to get RingSense insights (requires RingSense license)
export async function getRingSenseInsights(userId: string, recordingId: string) {
  try {
    const rcsdk = await getUserRingCentralSDK(userId);
    const platform = rcsdk.platform();

    const response = await platform.get(`/ai/ringsense/v1/public/accounts/~/domains/pbx/records/${recordingId}/insights`);
    return await response.json();
  } catch (error: any) {
    // RingSense may not be available for all accounts
    if (error?.response?.status === 403 || error?.response?.status === 404) {
      console.log('[RingCentral] RingSense not available for this account');
      return null;
    }
    console.error('Error getting RingSense insights:', error);
    return null;
  }
}

// Get recent call log entries for a user
export async function getRecentCallLogs(userId: string, phoneNumber?: string, dateFrom?: Date) {
  try {
    const rcsdk = await getUserRingCentralSDK(userId);
    const platform = rcsdk.platform();

    const params: Record<string, string> = {
      view: 'Detailed',
      recordingType: 'All',
      perPage: '50'
    };

    if (dateFrom) {
      params.dateFrom = dateFrom.toISOString();
    }

    if (phoneNumber) {
      params.phoneNumber = phoneNumber;
    }

    const response = await platform.get('/restapi/v1.0/account/~/extension/~/call-log', params);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting call logs:', error);
    throw error;
  }
}

// Find a specific call by session ID or phone number from recent logs
export async function findCallRecording(userId: string, phoneNumber: string, callTime: Date): Promise<{ recordingId: string; recordingUrl: string } | null> {
  try {
    // Query calls from 10 minutes before the call time (increased window)
    const dateFrom = new Date(callTime.getTime() - 10 * 60 * 1000);
    const callLogs = await getRecentCallLogs(userId, undefined, dateFrom);

    if (!callLogs?.records) {
      console.log('[RingCentral] No call records found in call log');
      return null;
    }

    console.log(`[RingCentral] Found ${callLogs.records.length} call records, searching for phone: ${phoneNumber}`);

    // Normalize the phone number for comparison
    const normalizedPhone = phoneNumber.replace(/[^0-9+]/g, '');
    const phoneWithoutPlus = normalizedPhone.replace(/^\+/, '');
    // Get last 7-10 digits for matching (handles country codes)
    const phoneLastDigits = phoneWithoutPlus.slice(-10);

    // Find the matching call with a recording
    for (const record of callLogs.records) {
      const toNumber = record.to?.phoneNumber?.replace(/[^0-9+]/g, '') || '';
      const fromNumber = record.from?.phoneNumber?.replace(/[^0-9+]/g, '') || '';
      const toLastDigits = toNumber.replace(/^\+/, '').slice(-10);
      const fromLastDigits = fromNumber.replace(/^\+/, '').slice(-10);
      
      const matchesTo = toLastDigits === phoneLastDigits || toNumber.includes(phoneWithoutPlus) || phoneWithoutPlus.includes(toNumber.replace(/^\+/, ''));
      const matchesFrom = fromLastDigits === phoneLastDigits || fromNumber.includes(phoneWithoutPlus) || phoneWithoutPlus.includes(fromNumber.replace(/^\+/, ''));

      // Log details for debugging
      console.log(`[RingCentral] Checking call: to=${toNumber}, from=${fromNumber}, hasRecording=${!!record.recording?.id}, matchesTo=${matchesTo}, matchesFrom=${matchesFrom}`);

      if ((matchesTo || matchesFrom) && record.recording?.id) {
        console.log('[RingCentral] Found matching call with recording:', record.recording.id);
        return {
          recordingId: record.recording.id,
          recordingUrl: record.recording.contentUri
        };
      }
      
      // Also check if the call matches but recording is not yet available
      if (matchesTo || matchesFrom) {
        console.log(`[RingCentral] Found matching call but no recording yet. Call result: ${record.result}, duration: ${record.duration}`);
      }
    }

    console.log('[RingCentral] No matching call with recording found');
    return null;
  } catch (error) {
    console.error('Error finding call recording:', error);
    return null;
  }
}

// Generate RingCentral OAuth authorization URL
export async function generateUserRingCentralAuthUrl(userId: string): Promise<string> {
  if (!isOAuthConfigured()) {
    throw new Error('RingCentral OAuth not configured - please set RINGCENTRAL_CLIENT_ID and RINGCENTRAL_CLIENT_SECRET environment variables');
  }

  const state = nanoid(32);
  
  // Store the state with user ID for verification
  oauthStates.set(state, { userId, timestamp: Date.now() });

  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    state,
  });

  return `${SERVER_URL}/restapi/oauth/authorize?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForRingCentralTokens(code: string, state: string): Promise<{ userId: string; tokens: RingCentralTokens }> {
  if (!isOAuthConfigured()) {
    throw new Error('RingCentral OAuth not configured');
  }

  // Verify state
  const stateData = oauthStates.get(state);
  if (!stateData) {
    throw new Error('Invalid or expired OAuth state');
  }

  // Remove state after use
  oauthStates.delete(state);

  // Create SDK instance for token exchange
  const rcsdk = new SDK({
    server: SERVER_URL,
    clientId: CLIENT_ID!,
    clientSecret: CLIENT_SECRET!
  });

  const platform = rcsdk.platform();

  // Exchange code for tokens
  await platform.login({
    code,
    redirect_uri: REDIRECT_URI
  });

  const authData = await platform.auth().data();

  return {
    userId: stateData.userId,
    tokens: {
      access_token: authData.access_token!,
      refresh_token: authData.refresh_token,
      expires_in: Number(authData.expires_in) || 3600,
      token_type: authData.token_type || 'Bearer'
    }
  };
}

// Disconnect RingCentral integration
export async function disconnectRingCentral(userId: string): Promise<void> {
  const integration = await storage.getUserIntegrationByType(userId, 'ringcentral');
  if (integration) {
    await storage.updateUserIntegration(integration.id, {
      isActive: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
    });
  }
}

// Store RingCentral integration tokens
export async function storeRingCentralTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const now = new Date().toISOString();

  // Check if integration already exists
  const existingIntegration = await storage.getUserIntegrationByType(userId, 'ringcentral');

  if (existingIntegration) {
    // Update existing
    await storage.updateUserIntegration(existingIntegration.id, {
      accessToken: encryptTokenForStorage(accessToken),
      refreshToken: refreshToken ? encryptTokenForStorage(refreshToken) : existingIntegration.refreshToken,
      tokenExpiry: expiresAt,
      isActive: true,
      metadata: {
        ...(existingIntegration.metadata as object || {}),
        lastUsedAt: now
      }
    });
  } else {
    // Create new
    await storage.createUserIntegration({
      userId,
      integrationType: 'ringcentral',
      accessToken: encryptTokenForStorage(accessToken),
      refreshToken: refreshToken ? encryptTokenForStorage(refreshToken) : null,
      tokenExpiry: expiresAt,
      isActive: true,
      metadata: { lastUsedAt: now },
    });
  }
}

// Proactively refresh tokens for all active RingCentral integrations
// This should be run as a cron job every 5 days to keep tokens alive
export async function refreshAllActiveRingCentralTokens(): Promise<{ refreshed: number; failed: number; skipped: number }> {
  const results = { refreshed: 0, failed: 0, skipped: 0 };
  
  try {
    // Get all active RingCentral integrations
    const integrations = await storage.getActiveIntegrationsByType('ringcentral');
    
    if (!integrations || integrations.length === 0) {
      console.log('[RingCentral Token Refresh] No active integrations found');
      return results;
    }
    
    console.log(`[RingCentral Token Refresh] Processing ${integrations.length} active integrations`);
    
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    
    for (const integration of integrations) {
      try {
        // Check if we should refresh (not used in last 5 days, or tokens expire soon)
        const metadata = integration.metadata as { lastUsedAt?: string } | null;
        const lastUsedAt = metadata?.lastUsedAt ? new Date(metadata.lastUsedAt).getTime() : 0;
        const tokenExpiry = integration.tokenExpiry ? new Date(integration.tokenExpiry).getTime() : 0;
        const now = Date.now();
        
        // Skip if used recently (within last 5 days) and tokens not expiring soon
        if (lastUsedAt > fiveDaysAgo && tokenExpiry > now + 24 * 60 * 60 * 1000) {
          console.log(`[RingCentral Token Refresh] Skipping user ${integration.userId} - recently used`);
          results.skipped++;
          continue;
        }
        
        if (!integration.refreshToken) {
          console.log(`[RingCentral Token Refresh] Skipping user ${integration.userId} - no refresh token`);
          results.skipped++;
          continue;
        }
        
        const refreshToken = decryptTokenFromStorage(integration.refreshToken);
        
        try {
          const newTokens = await refreshAccessToken(refreshToken, integration.id);
          
          const newExpiresAt = new Date(now + (newTokens.expires_in * 1000));
          
          await storage.updateUserIntegration(integration.id, {
            accessToken: encryptTokenForStorage(newTokens.access_token),
            refreshToken: newTokens.refresh_token ? encryptTokenForStorage(newTokens.refresh_token) : integration.refreshToken,
            tokenExpiry: newExpiresAt,
            metadata: {
              ...(integration.metadata as object || {}),
              lastUsedAt: new Date().toISOString(),
              lastProactiveRefresh: new Date().toISOString()
            }
          });
          
          console.log(`[RingCentral Token Refresh] Successfully refreshed tokens for user ${integration.userId}`);
          results.refreshed++;
        } catch (refreshError) {
          // Token refresh failed - integration was auto-disconnected by refreshAccessToken
          console.error(`[RingCentral Token Refresh] Failed for user ${integration.userId}:`, refreshError);
          results.failed++;
        }
      } catch (integrationError) {
        console.error(`[RingCentral Token Refresh] Error processing integration ${integration.id}:`, integrationError);
        results.failed++;
      }
    }
    
    console.log(`[RingCentral Token Refresh] Complete - Refreshed: ${results.refreshed}, Failed: ${results.failed}, Skipped: ${results.skipped}`);
    return results;
  } catch (error) {
    console.error('[RingCentral Token Refresh] Error in refresh job:', error);
    throw error;
  }
}
