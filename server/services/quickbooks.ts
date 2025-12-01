import { encryptTokenForStorage, decryptTokenFromStorage } from '../utils/tokenEncryption';
import { QboTokens } from '@shared/schema';

const QUICKBOOKS_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID;
const QUICKBOOKS_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET;

const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_API_BASE_URL = 'https://quickbooks.api.intuit.com';
const QBO_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

const QBO_SCOPES = 'com.intuit.quickbooks.accounting';
const REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI || 'https://flow.growth.accountants/api/oauth/callback';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}

interface QboCompanyInfo {
  CompanyInfo: {
    CompanyName: string;
    LegalName?: string;
    Email?: { Address: string };
  };
}

export function isQuickBooksConfigured(): boolean {
  return !!(QUICKBOOKS_CLIENT_ID && QUICKBOOKS_CLIENT_SECRET);
}

export function generateAuthUrl(state: string): string {
  if (!QUICKBOOKS_CLIENT_ID) {
    throw new Error('QuickBooks Client ID not configured');
  }

  // Get redirect URI at runtime to ensure env var changes are picked up
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || 'https://flow.growth.accountants/api/oauth/callback';
  console.log('[QuickBooks] Using redirect URI:', redirectUri);

  const params = new URLSearchParams({
    client_id: QUICKBOOKS_CLIENT_ID,
    response_type: 'code',
    scope: QBO_SCOPES,
    redirect_uri: redirectUri,
    state: state,
  });

  return `${QBO_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  if (!QUICKBOOKS_CLIENT_ID || !QUICKBOOKS_CLIENT_SECRET) {
    throw new Error('QuickBooks credentials not configured');
  }

  // Get redirect URI at runtime
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || 'https://flow.growth.accountants/api/oauth/callback';
  
  const credentials = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuickBooks token exchange failed:', errorText);
    throw new Error(`Failed to exchange code for tokens: ${response.status}`);
  }

  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  if (!QUICKBOOKS_CLIENT_ID || !QUICKBOOKS_CLIENT_SECRET) {
    throw new Error('QuickBooks credentials not configured');
  }

  const credentials = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuickBooks token refresh failed:', errorText);
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  return response.json();
}

export async function revokeToken(accessToken: string): Promise<void> {
  if (!QUICKBOOKS_CLIENT_ID || !QUICKBOOKS_CLIENT_SECRET) {
    throw new Error('QuickBooks credentials not configured');
  }

  const credentials = Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(QBO_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      token: accessToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuickBooks token revocation failed:', errorText);
  }
}

export async function getCompanyInfo(accessToken: string, realmId: string): Promise<QboCompanyInfo> {
  const response = await fetch(
    `${QBO_API_BASE_URL}/v3/company/${realmId}/companyinfo/${realmId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuickBooks company info fetch failed:', errorText);
    throw new Error(`Failed to get company info: ${response.status}`);
  }

  return response.json();
}

export async function makeQboApiRequest<T>(
  accessToken: string,
  realmId: string,
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown
): Promise<T> {
  const url = `${QBO_API_BASE_URL}/v3/company/${realmId}${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`QuickBooks API request failed for ${endpoint}:`, errorText);
    throw new Error(`QBO API request failed: ${response.status}`);
  }

  return response.json();
}

export function encryptTokens(accessToken: string, refreshToken: string): {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
} {
  return {
    accessTokenEncrypted: encryptTokenForStorage(accessToken),
    refreshTokenEncrypted: encryptTokenForStorage(refreshToken),
  };
}

export function decryptTokens(accessTokenEncrypted: string, refreshTokenEncrypted: string): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: decryptTokenFromStorage(accessTokenEncrypted),
    refreshToken: decryptTokenFromStorage(refreshTokenEncrypted),
  };
}

export function calculateTokenExpiry(expiresIn: number, refreshTokenExpiresIn: number): {
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
} {
  const now = new Date();
  return {
    accessTokenExpiresAt: new Date(now.getTime() + expiresIn * 1000),
    refreshTokenExpiresAt: new Date(now.getTime() + refreshTokenExpiresIn * 1000),
  };
}

export function isAccessTokenExpired(expiresAt: Date): boolean {
  const buffer = 5 * 60 * 1000;
  return new Date().getTime() + buffer >= expiresAt.getTime();
}

export function isRefreshTokenExpired(expiresAt: Date): boolean {
  const buffer = 24 * 60 * 60 * 1000;
  return new Date().getTime() + buffer >= expiresAt.getTime();
}

export function generateOAuthState(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
}
