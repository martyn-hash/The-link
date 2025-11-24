import { Client } from '@microsoft/microsoft-graph-client';
import { storage } from '../storage/index';
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

/**
 * Create a reply to an email message using Microsoft Graph API
 * @param userId - The ID of the user sending the reply
 * @param messageId - The Graph API message ID to reply to
 * @param content - The reply content (HTML or plain text)
 * @param isHtml - Whether the content is HTML (default: true)
 * @param subject - Optional custom subject line
 * @param to - Optional custom To recipients
 * @param cc - Optional custom CC recipients
 * @param attachments - Optional array of attachment metadata from object storage
 */
export async function createReplyToMessage(
  userId: string,
  messageId: string,
  content: string,
  isHtml: boolean = true,
  subject?: string,
  to?: string[],
  cc?: string[],
  attachments?: Array<{ objectPath: string; fileName: string; contentType?: string; fileSize?: number }>
) {
  try {
    const graphClient = await getUserOutlookClient(userId);
    const { ObjectStorageService } = await import('../services/objectStorageService');
    
    if (!isHtml && (!attachments || attachments.length === 0)) {
      // For plain text without attachments, we can use the simple /reply action
      await graphClient
        .api(`/me/messages/${messageId}/reply`)
        .post({ comment: content });
      return { success: true };
    }

    // For HTML content or attachments, we need to:
    // 1. Create a draft reply
    // 2. Update the draft's body to HTML
    // 3. Add attachments if any
    // 4. Send the draft

    // Step 1: Create draft reply
    const draftReply = await graphClient
      .api(`/me/messages/${messageId}/createReply`)
      .post({});

    if (!draftReply || !draftReply.id) {
      throw new Error('Failed to create draft reply');
    }

    // Step 2: Update draft body with HTML content and custom recipients/subject
    const patchData: any = {
      body: {
        contentType: 'HTML',
        content: content
      }
    };
    
    // Add custom subject if provided
    if (subject) {
      patchData.subject = subject;
    }
    
    // Add custom To recipients if provided
    if (to && to.length > 0) {
      patchData.toRecipients = to.map(email => ({
        emailAddress: { address: email }
      }));
    }
    
    // Add custom CC recipients if provided
    if (cc && cc.length > 0) {
      patchData.ccRecipients = cc.map(email => ({
        emailAddress: { address: email }
      }));
    }
    
    await graphClient
      .api(`/me/messages/${draftReply.id}`)
      .patch(patchData);

    // Step 3: Add attachments if provided
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        // Download file from object storage
        const fileBuffer = await ObjectStorageService.downloadFile(attachment.objectPath);
        
        // Convert buffer to base64
        const base64Content = fileBuffer.toString('base64');
        
        // Add attachment to draft
        await graphClient
          .api(`/me/messages/${draftReply.id}/attachments`)
          .post({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.fileName,
            contentType: attachment.contentType || 'application/octet-stream',
            contentBytes: base64Content
          });
      }
    }

    // Step 4: Send the draft
    await graphClient
      .api(`/me/messages/${draftReply.id}/send`)
      .post({});

    return { success: true };
  } catch (error) {
    console.error('Error creating reply via user Outlook:', error);
    throw error;
  }
}

/**
 * Create a reply-all to an email message using Microsoft Graph API
 * @param userId - The ID of the user sending the reply
 * @param messageId - The Graph API message ID to reply to
 * @param content - The reply content (HTML or plain text)
 * @param isHtml - Whether the content is HTML (default: true)
 * @param subject - Optional custom subject line
 * @param to - Optional custom To recipients
 * @param cc - Optional custom CC recipients
 * @param attachments - Optional array of attachment metadata from object storage
 */
export async function createReplyAllToMessage(
  userId: string,
  messageId: string,
  content: string,
  isHtml: boolean = true,
  subject?: string,
  to?: string[],
  cc?: string[],
  attachments?: Array<{ objectPath: string; fileName: string; contentType?: string; fileSize?: number }>
) {
  try {
    const graphClient = await getUserOutlookClient(userId);
    const { ObjectStorageService } = await import('../services/objectStorageService');
    
    if (!isHtml && (!attachments || attachments.length === 0)) {
      // For plain text without attachments, we can use the simple /replyAll action
      await graphClient
        .api(`/me/messages/${messageId}/replyAll`)
        .post({ comment: content });
      return { success: true };
    }

    // For HTML content or attachments, we need to:
    // 1. Create a draft reply-all
    // 2. Update the draft's body to HTML
    // 3. Add attachments if any
    // 4. Send the draft

    // Step 1: Create draft reply-all
    const draftReply = await graphClient
      .api(`/me/messages/${messageId}/createReplyAll`)
      .post({});

    if (!draftReply || !draftReply.id) {
      throw new Error('Failed to create draft reply-all');
    }

    // Step 2: Update draft body with HTML content and custom recipients/subject
    const patchData: any = {
      body: {
        contentType: 'HTML',
        content: content
      }
    };
    
    // Add custom subject if provided
    if (subject) {
      patchData.subject = subject;
    }
    
    // Add custom To recipients if provided
    if (to && to.length > 0) {
      patchData.toRecipients = to.map(email => ({
        emailAddress: { address: email }
      }));
    }
    
    // Add custom CC recipients if provided
    if (cc && cc.length > 0) {
      patchData.ccRecipients = cc.map(email => ({
        emailAddress: { address: email }
      }));
    }
    
    await graphClient
      .api(`/me/messages/${draftReply.id}`)
      .patch(patchData);

    // Step 3: Add attachments if provided
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        // Download file from object storage
        const fileBuffer = await ObjectStorageService.downloadFile(attachment.objectPath);
        
        // Convert buffer to base64
        const base64Content = fileBuffer.toString('base64');
        
        // Add attachment to draft
        await graphClient
          .api(`/me/messages/${draftReply.id}/attachments`)
          .post({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.fileName,
            contentType: attachment.contentType || 'application/octet-stream',
            contentBytes: base64Content
          });
      }
    }

    // Step 4: Send the draft
    await graphClient
      .api(`/me/messages/${draftReply.id}/send`)
      .post({});

    return { success: true };
  } catch (error) {
    console.error('Error creating reply-all via user Outlook:', error);
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

/**
 * Download email attachment content from Microsoft Graph API
 * @param userId - The ID of the user who owns the mailbox
 * @param messageId - The Graph API message ID containing the attachment
 * @param attachmentId - The Graph API attachment ID to download
 * @returns Buffer containing the attachment content
 */
export async function downloadEmailAttachment(
  userId: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  try {
    const graphClient = await getUserOutlookClient(userId);
    
    // Download attachment content as binary
    // The /$value endpoint returns the raw content
    const attachmentContent = await graphClient
      .api(`/me/messages/${messageId}/attachments/${attachmentId}/$value`)
      .getStream();
    
    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of attachmentContent) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  } catch (error) {
    console.error(`Error downloading attachment ${attachmentId} from message ${messageId}:`, error);
    throw error;
  }
}

// OAuth configuration
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || 'demo-client-id';
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || 'demo-client-secret';
// Auto-detect the correct redirect URI based on environment
const getRedirectUri = () => {
  if (process.env.MICROSOFT_REDIRECT_URI) {
    return process.env.MICROSOFT_REDIRECT_URI;
  }
  
  // Production environment
  if (process.env.NODE_ENV === 'production') {
    return 'https://flow.growth.accountants/api/oauth/outlook/callback';
  }
  
  // Replit environment - use REPLIT_DEV_DOMAIN
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/oauth/outlook/callback`;
  }
  
  // Default fallback for local development
  return 'http://localhost:5000/api/oauth/outlook/callback';
};

const REDIRECT_URI = getRedirectUri();
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