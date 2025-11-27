import fetch from 'node-fetch';

interface HMRCVatCheckResponse {
  target: {
    name: string;
    vatNumber: string;
    address: {
      line1?: string;
      line2?: string;
      line3?: string;
      line4?: string;
      postcode?: string;
      countryCode?: string;
    };
  };
  processingDate: string;
}

interface HMRCVatCheckWithRefResponse extends HMRCVatCheckResponse {
  requester: string;
  consultationNumber: string;
}

interface VatValidationResult {
  isValid: boolean;
  companyName?: string;
  address?: string;
  postcode?: string;
  validatedAt?: string;
  consultationNumber?: string;
  error?: string;
  errorCode?: string;
  bypassed?: boolean;
}

interface HMRCAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  expiresAt: number;
}

let cachedToken: HMRCAccessToken | null = null;

const HMRC_API_BASE = process.env.HMRC_API_BASE_URL || 'https://api.service.hmrc.gov.uk';
const HMRC_AUTH_URL = process.env.HMRC_AUTH_URL || 'https://api.service.hmrc.gov.uk/oauth/token';

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.HMRC_CLIENT_ID;
  const clientSecret = process.env.HMRC_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('[HMRC] Missing HMRC_CLIENT_ID or HMRC_CLIENT_SECRET environment variables');
    return null;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.access_token;
  }

  try {
    const response = await fetch(HMRC_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'read:vat',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[HMRC] Failed to get access token:', response.status, errorText);
      return null;
    }

    const tokenData = await response.json() as Omit<HMRCAccessToken, 'expiresAt'>;
    cachedToken = {
      ...tokenData,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
    };

    console.log('[HMRC] Successfully obtained access token');
    return cachedToken.access_token;
  } catch (error) {
    console.error('[HMRC] Error getting access token:', error);
    return null;
  }
}

function formatVatNumber(vatNumber: string): string {
  const cleaned = vatNumber.replace(/[^0-9]/g, '');
  
  if (cleaned.length === 9) {
    return cleaned;
  }
  if (cleaned.length === 12) {
    return cleaned;
  }
  
  return cleaned;
}

function isValidVatNumberFormat(vatNumber: string): boolean {
  const cleaned = vatNumber.replace(/[^0-9]/g, '');
  return cleaned.length === 9 || cleaned.length === 12;
}

export async function validateVatNumber(vatNumber: string): Promise<VatValidationResult> {
  const cleanedVat = formatVatNumber(vatNumber);
  
  if (!isValidVatNumberFormat(cleanedVat)) {
    return {
      isValid: false,
      error: 'Invalid VAT number format. Must be 9 or 12 digits.',
      errorCode: 'INVALID_FORMAT',
    };
  }

  // Check if HMRC VAT validation is enabled (defaults to true if not set)
  // Set HMRC_VAT_VALIDATION_ENABLED=false in production to bypass HMRC API calls
  if (!isVatValidationEnabled()) {
    console.log('[HMRC] VAT validation is disabled via HMRC_VAT_VALIDATION_ENABLED=false, bypassing API call');
    return {
      isValid: true,
      bypassed: true,
      validatedAt: new Date().toISOString(),
    };
  }

  const accessToken = await getAccessToken();
  
  if (!accessToken) {
    return {
      isValid: false,
      error: 'HMRC API credentials not configured. VAT validation unavailable.',
      errorCode: 'NO_CREDENTIALS',
    };
  }

  try {
    const response = await fetch(
      `${HMRC_API_BASE}/organisations/vat/check-vat-number/lookup/${cleanedVat}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.hmrc.2.0+json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 200) {
      const data = await response.json() as HMRCVatCheckResponse;
      
      const addressParts = [
        data.target.address.line1,
        data.target.address.line2,
        data.target.address.line3,
        data.target.address.line4,
      ].filter(Boolean);

      return {
        isValid: true,
        companyName: data.target.name,
        address: addressParts.join(', '),
        postcode: data.target.address.postcode,
        validatedAt: data.processingDate,
      };
    }

    if (response.status === 404) {
      return {
        isValid: false,
        error: 'VAT number not found in HMRC records.',
        errorCode: 'NOT_FOUND',
      };
    }

    if (response.status === 400) {
      const errorData = await response.json() as { code?: string; message?: string };
      return {
        isValid: false,
        error: errorData.message || 'Invalid request to HMRC API.',
        errorCode: errorData.code || 'BAD_REQUEST',
      };
    }

    const errorText = await response.text();
    console.error('[HMRC] Unexpected response:', response.status, errorText);
    
    return {
      isValid: false,
      error: `HMRC API error (status ${response.status})`,
      errorCode: 'API_ERROR',
    };
  } catch (error) {
    console.error('[HMRC] Error validating VAT number:', error);
    return {
      isValid: false,
      error: 'Failed to connect to HMRC API.',
      errorCode: 'CONNECTION_ERROR',
    };
  }
}

export async function validateVatNumberWithReference(
  vatNumber: string, 
  requesterVatNumber: string
): Promise<VatValidationResult> {
  const cleanedTarget = formatVatNumber(vatNumber);
  const cleanedRequester = formatVatNumber(requesterVatNumber);
  
  if (!isValidVatNumberFormat(cleanedTarget)) {
    return {
      isValid: false,
      error: 'Invalid target VAT number format. Must be 9 or 12 digits.',
      errorCode: 'INVALID_FORMAT',
    };
  }

  if (!isValidVatNumberFormat(cleanedRequester)) {
    return {
      isValid: false,
      error: 'Invalid requester VAT number format. Must be 9 or 12 digits.',
      errorCode: 'INVALID_FORMAT',
    };
  }

  const accessToken = await getAccessToken();
  
  if (!accessToken) {
    return {
      isValid: false,
      error: 'HMRC API credentials not configured. VAT validation unavailable.',
      errorCode: 'NO_CREDENTIALS',
    };
  }

  try {
    const response = await fetch(
      `${HMRC_API_BASE}/organisations/vat/check-vat-number/lookup/${cleanedTarget}/${cleanedRequester}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.hmrc.2.0+json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 200) {
      const data = await response.json() as HMRCVatCheckWithRefResponse;
      
      const addressParts = [
        data.target.address.line1,
        data.target.address.line2,
        data.target.address.line3,
        data.target.address.line4,
      ].filter(Boolean);

      return {
        isValid: true,
        companyName: data.target.name,
        address: addressParts.join(', '),
        postcode: data.target.address.postcode,
        validatedAt: data.processingDate,
        consultationNumber: data.consultationNumber,
      };
    }

    if (response.status === 404) {
      return {
        isValid: false,
        error: 'VAT number not found in HMRC records.',
        errorCode: 'NOT_FOUND',
      };
    }

    if (response.status === 403) {
      return {
        isValid: false,
        error: 'Requester VAT number is invalid or not authorized.',
        errorCode: 'FORBIDDEN',
      };
    }

    const errorText = await response.text();
    console.error('[HMRC] Unexpected response:', response.status, errorText);
    
    return {
      isValid: false,
      error: `HMRC API error (status ${response.status})`,
      errorCode: 'API_ERROR',
    };
  } catch (error) {
    console.error('[HMRC] Error validating VAT number with reference:', error);
    return {
      isValid: false,
      error: 'Failed to connect to HMRC API.',
      errorCode: 'CONNECTION_ERROR',
    };
  }
}

export function isHmrcConfigured(): boolean {
  return !!(process.env.HMRC_CLIENT_ID && process.env.HMRC_CLIENT_SECRET);
}

// Check if HMRC VAT validation is enabled
// Set HMRC_VAT_VALIDATION_ENABLED=false to temporarily bypass HMRC API calls
// Defaults to true if not set
export function isVatValidationEnabled(): boolean {
  const enabled = process.env.HMRC_VAT_VALIDATION_ENABLED;
  // If not set, default to true (enabled)
  if (enabled === undefined || enabled === '') {
    return true;
  }
  // Only 'false' (case-insensitive) disables it
  return enabled.toLowerCase() !== 'false';
}

export const VAT_NUMBER_REGEX = '^(GB)?\\s?\\d{3}\\s?\\d{4}\\s?\\d{2}(\\s?\\d{3})?$';
export const VAT_NUMBER_REGEX_ERROR = 'Please enter a valid UK VAT number (e.g., 123456789 or GB123456789)';

export const VAT_UDF_FIELD_ID = 'vat_number_auto';
export const VAT_UDF_FIELD_NAME = 'VAT Number';

export const VAT_ADDRESS_UDF_FIELD_ID = 'vat_address_auto';
export const VAT_ADDRESS_UDF_FIELD_NAME = 'VAT Address';
