/**
 * Companies House API Integration Utilities
 * 
 * This module provides TypeScript interfaces, API client class, and transformation
 * utilities for integrating with the UK Companies House API.
 */

import { z } from "zod";

// ===========================================
// TypeScript Interfaces for API Responses
// ===========================================

/**
 * Companies House Company Profile API Response Interface
 * Based on testing with company 14753824 and official API documentation
 */
export interface CompaniesHouseCompanyResponse {
  company_name: string;
  company_number: string;
  company_status: string;
  company_status_detail?: string;
  type: string;
  date_of_creation: string;
  jurisdiction: string;
  registered_office_address: {
    address_line_1?: string;
    address_line_2?: string;
    care_of?: string;
    country?: string;
    locality?: string;
    po_box?: string;
    postal_code?: string;
    premises?: string;
    region?: string;
  };
  sic_codes?: string[];
  accounts?: {
    accounting_reference_date?: {
      day: string;
      month: string;
    };
    last_accounts?: {
      made_up_to?: string;
      type?: string;
    };
    next_due?: string;
    next_made_up_to?: string;
    overdue?: boolean;
  };
  confirmation_statement?: {
    last_made_up_to?: string;
    next_due?: string;
    next_made_up_to?: string;
    overdue?: boolean;
  };
  links: {
    self: string;
    filing_history?: string;
    officers?: string;
    charges?: string;
    persons_with_significant_control?: string;
  };
  etag?: string;
}

/**
 * Companies House Officer Interface
 */
export interface CompaniesHouseOfficer {
  name: string;
  officer_role: string;
  appointed_on?: string;
  resigned_on?: string;
  date_of_birth?: {
    month?: number;
    year?: number;
  };
  nationality?: string;
  country_of_residence?: string;
  occupation?: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    care_of?: string;
    country?: string;
    locality?: string;
    po_box?: string;
    postal_code?: string;
    premises?: string;
    region?: string;
  };
  identification?: {
    identification_type?: string;
    legal_authority?: string;
    legal_form?: string;
    place_registered?: string;
    registration_number?: string;
  };
  links?: {
    officer?: {
      appointments?: string;
    };
  };
}

/**
 * Companies House Officers API Response Interface
 */
export interface CompaniesHouseOfficersResponse {
  etag: string;
  items: CompaniesHouseOfficer[];
  items_per_page: number;
  kind: string;
  links: {
    self: string;
  };
  start_index: number;
  total_results: number;
  active_count?: number;
  inactive_count?: number;
  resigned_count?: number;
}

/**
 * Error Response Interface
 */
export interface CompaniesHouseError {
  error: string;
  type: string;
}

// ===========================================
// Custom Error Classes
// ===========================================

export class CompaniesHouseAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorType?: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'CompaniesHouseAPIError';
  }
}

export class CompaniesHouseNotFoundError extends CompaniesHouseAPIError {
  constructor(companyNumber: string) {
    super(`Company ${companyNumber} not found`, 404, 'not-found');
    this.name = 'CompaniesHouseNotFoundError';
  }
}

export class CompaniesHouseRateLimitError extends CompaniesHouseAPIError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 429, 'rate-limit');
    this.name = 'CompaniesHouseRateLimitError';
  }
}

// ===========================================
// Companies House API Client Class
// ===========================================

export class CompaniesHouseAPI {
  private readonly baseUrl = 'https://api.company-information.service.gov.uk';
  private readonly apiKey: string;
  private readonly authHeader: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COMPANIES_HOUSE_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('COMPANIES_HOUSE_API_KEY environment variable is required');
    }

    // Companies House uses HTTP Basic Auth with API key as username and empty password
    this.authHeader = 'Basic ' + Buffer.from(`${this.apiKey}:`).toString('base64');
  }

  /**
   * Handle HTTP response and convert errors to appropriate error types
   */
  private async handleResponse<T>(response: Response, companyNumber?: string): Promise<T> {
    if (response.ok) {
      return await response.json();
    }

    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: 'Failed to parse error response' };
    }

    switch (response.status) {
      case 404:
        if (companyNumber) {
          throw new CompaniesHouseNotFoundError(companyNumber);
        }
        throw new CompaniesHouseAPIError('Resource not found', 404, 'not-found', errorData);
      
      case 429:
        const retryAfter = response.headers.get('Retry-After');
        throw new CompaniesHouseRateLimitError(retryAfter ? parseInt(retryAfter) : undefined);
      
      case 401:
        throw new CompaniesHouseAPIError('Invalid API key or unauthorized access', 401, 'unauthorized', errorData);
      
      case 403:
        throw new CompaniesHouseAPIError('Access forbidden', 403, 'forbidden', errorData);
      
      case 500:
      case 502:
      case 503:
      case 504:
        throw new CompaniesHouseAPIError('Companies House API server error', response.status, 'server-error', errorData);
      
      default:
        throw new CompaniesHouseAPIError(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          'unknown',
          errorData
        );
    }
  }

  /**
   * Make a request to the Companies House API with proper error handling
   */
  private async makeRequest<T>(endpoint: string, companyNumber?: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
          'User-Agent': 'Bookkeeping-App/1.0'
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      return await this.handleResponse<T>(response, companyNumber);
    } catch (error) {
      if (error instanceof CompaniesHouseAPIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new CompaniesHouseAPIError('Request timeout', 408, 'timeout', error);
        }
        if (error.message.includes('fetch')) {
          throw new CompaniesHouseAPIError('Network error or connection failed', 0, 'network', error);
        }
      }

      throw new CompaniesHouseAPIError('Unexpected error occurred', 0, 'unknown', error);
    }
  }

  /**
   * Validate and sanitize company number format
   */
  private validateCompanyNumber(companyNumber: string): string {
    if (!companyNumber || typeof companyNumber !== 'string') {
      throw new CompaniesHouseAPIError('Company number is required and must be a string', 400, 'validation');
    }

    // Remove whitespace and convert to uppercase
    const sanitized = companyNumber.trim().toUpperCase();
    
    // Basic validation - Companies House numbers are typically 8 digits, 
    // but can be shorter with leading zeros omitted
    if (!/^[0-9A-Z]{1,8}$/.test(sanitized)) {
      throw new CompaniesHouseAPIError(
        'Invalid company number format. Must be 1-8 alphanumeric characters',
        400,
        'validation'
      );
    }

    // Pad with leading zeros to 8 digits for consistency
    return sanitized.padStart(8, '0');
  }

  /**
   * Fetch company data from Companies House API
   */
  async getCompany(companyNumber: string): Promise<CompaniesHouseCompanyResponse> {
    const validatedCompanyNumber = this.validateCompanyNumber(companyNumber);
    const endpoint = `/company/${validatedCompanyNumber}`;
    
    return await this.makeRequest<CompaniesHouseCompanyResponse>(endpoint, validatedCompanyNumber);
  }

  /**
   * Fetch officers/directors data from Companies House API
   */
  async getOfficers(companyNumber: string): Promise<CompaniesHouseOfficersResponse> {
    const validatedCompanyNumber = this.validateCompanyNumber(companyNumber);
    const endpoint = `/company/${validatedCompanyNumber}/officers`;
    
    return await this.makeRequest<CompaniesHouseOfficersResponse>(endpoint, validatedCompanyNumber);
  }
}

// ===========================================
// Transformation Utility Functions
// ===========================================

/**
 * Transform Companies House company data to our clients table format
 */
export function transformCompanyData(apiResponse: CompaniesHouseCompanyResponse): any {
  const registeredAddress = apiResponse.registered_office_address;
  
  return {
    // Basic client information
    name: apiResponse.company_name,
    
    // Companies House integration fields
    clientType: 'company',
    companyNumber: apiResponse.company_number,
    companiesHouseName: apiResponse.company_name,
    companyStatus: apiResponse.company_status,
    companyType: apiResponse.type,
    
    // Dates and basic info
    dateOfCreation: apiResponse.date_of_creation ? new Date(apiResponse.date_of_creation) : null,
    jurisdiction: apiResponse.jurisdiction,
    sicCodes: apiResponse.sic_codes || [],
    
    // Registered office address
    registeredAddress1: [registeredAddress?.premises, registeredAddress?.address_line_1]
      .filter(Boolean).join(' ').trim() || registeredAddress?.address_line_1 || null,
    registeredAddress2: registeredAddress?.address_line_2 || null,
    registeredAddress3: registeredAddress?.care_of || null,
    registeredCountry: registeredAddress?.country || null,
    registeredPostcode: registeredAddress?.postal_code || null,
    
    // Accounts filing information
    accountingReferenceDay: apiResponse.accounts?.accounting_reference_date?.day ? 
      parseInt(apiResponse.accounts.accounting_reference_date.day) : null,
    accountingReferenceMonth: apiResponse.accounts?.accounting_reference_date?.month ? 
      parseInt(apiResponse.accounts.accounting_reference_date.month) : null,
    lastAccountsMadeUpTo: apiResponse.accounts?.last_accounts?.made_up_to ? 
      new Date(apiResponse.accounts.last_accounts.made_up_to) : null,
    lastAccountsType: apiResponse.accounts?.last_accounts?.type || null,
    nextAccountsDue: apiResponse.accounts?.next_due ? 
      new Date(apiResponse.accounts.next_due) : null,
    nextAccountsPeriodEnd: apiResponse.accounts?.next_made_up_to ? 
      new Date(apiResponse.accounts.next_made_up_to) : null,
    accountsOverdue: apiResponse.accounts?.overdue || false,
    
    // Confirmation statement information
    confirmationStatementLastMadeUpTo: apiResponse.confirmation_statement?.last_made_up_to ? 
      new Date(apiResponse.confirmation_statement.last_made_up_to) : null,
    confirmationStatementNextDue: apiResponse.confirmation_statement?.next_due ? 
      new Date(apiResponse.confirmation_statement.next_due) : null,
    confirmationStatementNextMadeUpTo: apiResponse.confirmation_statement?.next_made_up_to ? 
      new Date(apiResponse.confirmation_statement.next_made_up_to) : null,
    confirmationStatementOverdue: apiResponse.confirmation_statement?.overdue || false,
    
    // Store full JSON response for future reference
    companiesHouseData: apiResponse,
  };
}

/**
 * Transform Companies House officers data to our people table format
 * Returns an array of people records
 */
export function transformOfficersData(apiResponse: CompaniesHouseOfficersResponse): any[] {
  return apiResponse.items.map(officer => {
    const address = officer.address;
    
    // Parse the name - Companies House provides full name in various formats
    let firstName: string | null = null;
    let lastName: string | null = null;
    let fullName = officer.name;
    
    // Basic name parsing - split on last space for first/last name
    if (fullName && !fullName.includes(',')) {
      const nameParts = fullName.trim().split(' ');
      if (nameParts.length >= 2) {
        lastName = nameParts.pop() || null;
        firstName = nameParts.join(' ') || null;
      } else {
        lastName = fullName;
      }
    }
    
    return {
      // Basic information
      firstName,
      lastName,
      fullName,
      
      // Contact details (usually not provided by Companies House for privacy)
      telephone: null,
      email: null,
      
      // Correspondence address (if provided)
      address1: [address?.premises, address?.address_line_1]
        .filter(Boolean).join(' ').trim() || address?.address_line_1 || null,
      address2: address?.address_line_2 || null,
      address3: address?.care_of || null,
      locality: address?.locality || null,
      region: address?.region || null,
      country: address?.country || null,
      postalCode: address?.postal_code || null,
      
      // Companies House specific fields
      personNumber: null, // Not provided in officers endpoint
      nationality: officer.nationality || null,
      countryOfResidence: officer.country_of_residence || null,
      occupation: officer.occupation || null,
      dateOfBirthMonth: officer.date_of_birth?.month || null,
      dateOfBirthYear: officer.date_of_birth?.year || null,
      
      // Registered address (same as correspondence for officers)
      registeredAddress1: [address?.premises, address?.address_line_1]
        .filter(Boolean).join(' ').trim() || address?.address_line_1 || null,
      registeredAddress2: address?.address_line_2 || null,
      registeredAddress3: address?.care_of || null,
      registeredLocality: address?.locality || null,
      registeredRegion: address?.region || null,
      registeredCountry: address?.country || null,
      registeredPostalCode: address?.postal_code || null,
      
      // Metadata
      isFromCompaniesHouse: true,
      companiesHouseData: officer,
      
      // Officer role information (for clientPeople junction table)
      _officerRole: officer.officer_role,
      _appointedOn: officer.appointed_on ? new Date(officer.appointed_on) : null,
      _resignedOn: officer.resigned_on ? new Date(officer.resigned_on) : null,
    };
  });
}

// ===========================================
// Validation Schemas
// ===========================================

/**
 * Zod schema for validating company numbers
 */
export const companyNumberSchema = z.string()
  .min(1, 'Company number is required')
  .max(8, 'Company number must be 8 characters or less')
  .regex(/^[0-9A-Z]+$/, 'Company number must contain only alphanumeric characters')
  .transform(val => val.trim().toUpperCase().padStart(8, '0'));

// ===========================================
// Default Export
// ===========================================

/**
 * Create a default instance of the Companies House API client
 */
export const companiesHouseApi = new CompaniesHouseAPI();

// Export all types and classes for external use
export default {
  CompaniesHouseAPI,
  transformCompanyData,
  transformOfficersData,
  companiesHouseApi,
  CompaniesHouseAPIError,
  CompaniesHouseNotFoundError,
  CompaniesHouseRateLimitError,
};