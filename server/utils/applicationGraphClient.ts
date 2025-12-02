/**
 * Application-Level Microsoft Graph Client
 * 
 * Uses client credentials flow (daemon/service authentication) to access
 * Microsoft Graph API with application-level permissions.
 * 
 * This allows tenant-wide access to read emails for any user without
 * requiring individual user OAuth consent.
 * 
 * Required permissions (Application type, admin consent required):
 * - Mail.Read or Mail.ReadWrite: Read mail in all mailboxes
 * - User.Read.All: Read all users' full profiles
 */

import { Client } from '@microsoft/microsoft-graph-client';

// Environment configuration
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const TENANT_ID = process.env.MICROSOFT_TENANT_ID;

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Check if application credentials are configured
 */
export function isApplicationGraphConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && TENANT_ID);
}

/**
 * Get access token using client credentials flow
 * Uses tenant-specific endpoint with .default scope for application permissions
 */
async function getApplicationAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET || !TENANT_ID) {
    throw new Error(
      'Microsoft application credentials not configured. Required: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID'
    );
  }

  // Check if we have a valid cached token (with 5 minute buffer)
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  // Request new token using client credentials flow
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  console.log('[Application Graph] Requesting new access token...');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Application Graph] Token request failed:', errorText);
    throw new Error(`Failed to get application access token: ${response.status} ${response.statusText}`);
  }

  const tokenData = await response.json() as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  // Cache the token
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: now + tokenData.expires_in * 1000,
  };

  console.log('[Application Graph] Successfully obtained access token');
  return tokenData.access_token;
}

/**
 * Get a Microsoft Graph client using application credentials
 * This client can access any user's data in the tenant
 * 
 * WARNING: Never cache this client. Always call this function for fresh auth.
 */
export async function getApplicationGraphClient(): Promise<Client> {
  const accessToken = await getApplicationAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken,
    },
  });
}

/**
 * Look up a user by their email address and get their Azure AD GUID
 */
export async function getUserByEmail(email: string): Promise<{
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
} | null> {
  try {
    const client = await getApplicationGraphClient();
    
    // Try direct lookup by userPrincipalName (email)
    const user = await client
      .api(`/users/${encodeURIComponent(email)}`)
      .select('id,displayName,mail,userPrincipalName')
      .get();

    return {
      id: user.id,
      displayName: user.displayName,
      mail: user.mail,
      userPrincipalName: user.userPrincipalName,
    };
  } catch (error: any) {
    // If direct lookup fails, try filter by mail or userPrincipalName
    if (error.statusCode === 404) {
      try {
        const client = await getApplicationGraphClient();
        const users = await client
          .api('/users')
          .filter(`mail eq '${email}' or userPrincipalName eq '${email}'`)
          .select('id,displayName,mail,userPrincipalName')
          .top(1)
          .get();

        if (users.value && users.value.length > 0) {
          const user = users.value[0];
          return {
            id: user.id,
            displayName: user.displayName,
            mail: user.mail,
            userPrincipalName: user.userPrincipalName,
          };
        }
      } catch (filterError) {
        console.error('[Application Graph] Filter lookup also failed:', filterError);
      }
    }
    
    console.error('[Application Graph] Error looking up user by email:', error);
    return null;
  }
}

/**
 * Get a user by their Azure AD GUID
 */
export async function getUserById(userId: string): Promise<{
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
} | null> {
  try {
    const client = await getApplicationGraphClient();
    
    const user = await client
      .api(`/users/${userId}`)
      .select('id,displayName,mail,userPrincipalName')
      .get();

    return {
      id: user.id,
      displayName: user.displayName,
      mail: user.mail,
      userPrincipalName: user.userPrincipalName,
    };
  } catch (error) {
    console.error('[Application Graph] Error getting user by ID:', error);
    return null;
  }
}

/**
 * Get emails from a user's mailbox using application permissions
 * 
 * @param userIdOrEmail - Azure AD user GUID or email address
 * @param options - Query options
 */
export async function getUserEmails(
  userIdOrEmail: string,
  options: {
    folder?: 'Inbox' | 'SentItems' | 'Drafts' | 'DeletedItems' | string;
    top?: number;
    skip?: number;
    filter?: string;
    orderBy?: string;
    select?: string[];
  } = {}
): Promise<{
  messages: any[];
  nextLink?: string;
  count?: number;
}> {
  const {
    folder = 'Inbox',
    top = 50,
    skip,
    filter,
    orderBy = 'receivedDateTime desc',
    select = [
      'id',
      'internetMessageId',
      'conversationId',
      'subject',
      'from',
      'toRecipients',
      'ccRecipients',
      'receivedDateTime',
      'sentDateTime',
      'hasAttachments',
      'bodyPreview',
      'isRead',
    ],
  } = options;

  const client = await getApplicationGraphClient();

  // Build the API path
  const apiPath = folder
    ? `/users/${encodeURIComponent(userIdOrEmail)}/mailFolders/${folder}/messages`
    : `/users/${encodeURIComponent(userIdOrEmail)}/messages`;

  let request = client
    .api(apiPath)
    .select(select.join(','))
    .top(top)
    .orderby(orderBy);

  if (skip) {
    request = request.skip(skip);
  }

  if (filter) {
    request = request.filter(filter);
  }

  const response = await request.get();

  return {
    messages: response.value || [],
    nextLink: response['@odata.nextLink'],
    count: response['@odata.count'],
  };
}

/**
 * Get a specific email message from any user's mailbox
 */
export async function getUserEmailById(
  userIdOrEmail: string,
  messageId: string,
  includeBody: boolean = true
): Promise<any> {
  const client = await getApplicationGraphClient();

  const select = [
    'id',
    'internetMessageId',
    'conversationId',
    'conversationIndex',
    'subject',
    'from',
    'toRecipients',
    'ccRecipients',
    'bccRecipients',
    'receivedDateTime',
    'sentDateTime',
    'hasAttachments',
    'bodyPreview',
    'isRead',
    'inReplyTo',
  ];

  if (includeBody) {
    select.push('body');
  }

  const message = await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${messageId}`)
    .select(select.join(','))
    .get();

  return message;
}

/**
 * List all users in the tenant
 */
export async function listTenantUsers(options: {
  top?: number;
  filter?: string;
} = {}): Promise<{
  users: Array<{
    id: string;
    displayName: string;
    mail: string;
    userPrincipalName: string;
  }>;
  nextLink?: string;
}> {
  const { top = 100, filter } = options;

  const client = await getApplicationGraphClient();

  let request = client
    .api('/users')
    .select('id,displayName,mail,userPrincipalName')
    .top(top);

  if (filter) {
    request = request.filter(filter);
  }

  const response = await request.get();

  return {
    users: response.value || [],
    nextLink: response['@odata.nextLink'],
  };
}

/**
 * Get mailbox folder information for a user
 */
export async function getUserMailFolders(userIdOrEmail: string): Promise<Array<{
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}>> {
  const client = await getApplicationGraphClient();

  const response = await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/mailFolders`)
    .select('id,displayName,totalItemCount,unreadItemCount')
    .get();

  return response.value || [];
}
