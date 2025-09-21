import { Request, Response } from 'express';

// Companies House API service for company data integration
// Uses COMPANIES_HOUSE_API_KEY secret for authentication

interface CompaniesHouseSearchResult {
  company_number: string;
  company_status: string;
  company_type: string;
  date_of_creation: string;
  title: string;
  address: {
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
  description?: string;
  kind: string;
}

interface CompaniesHouseCompanyProfile {
  company_name: string;
  company_number: string;
  company_status: string;
  company_status_detail?: string;
  company_type: string;
  date_of_creation: string;
  date_of_dissolution?: string;
  jurisdiction: string;
  registered_office_address: {
    address_line_1?: string;
    address_line_2?: string;
    address_line_3?: string;
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
      day: number;
      month: number;
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
    persons_with_significant_control?: string;
  };
}

interface CompaniesHouseOfficer {
  officer_role: string;
  name: string;
  appointed_on?: string;
  resigned_on?: string;
  nationality?: string;
  country_of_residence?: string;
  occupation?: string;
  date_of_birth?: {
    month: number;
    year: number;
  };
  address: {
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
  links: {
    officer: {
      appointments: string;
    };
  };
}

interface CompaniesHousePSC {
  name?: string;
  name_elements?: {
    title?: string;
    forename?: string;
    surname?: string;
  };
  nationality?: string;
  country_of_residence?: string;
  date_of_birth?: {
    month: number;
    year: number;
  };
  address: {
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
  kind: string;
  natures_of_control: string[];
  notified_on: string;
}

class CompaniesHouseService {
  private apiKey: string;
  private baseUrl = 'https://api.company-information.service.gov.uk';

  constructor() {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    if (!apiKey) {
      throw new Error('COMPANIES_HOUSE_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
  }

  private getAuthHeaders() {
    return {
      'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
      'Content-Type': 'application/json'
    };
  }

  private async makeRequest(endpoint: string) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Companies House API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // Search for companies by name
  async searchCompanies(query: string, itemsPerPage = 20): Promise<CompaniesHouseSearchResult[]> {
    const encodedQuery = encodeURIComponent(query);
    const data = await this.makeRequest(`/search/companies?q=${encodedQuery}&items_per_page=${itemsPerPage}`);
    return data.items || [];
  }

  // Get company profile by company number
  async getCompanyProfile(companyNumber: string): Promise<CompaniesHouseCompanyProfile> {
    return this.makeRequest(`/company/${companyNumber}`);
  }

  // Get officers for a company
  async getCompanyOfficers(companyNumber: string): Promise<CompaniesHouseOfficer[]> {
    const data = await this.makeRequest(`/company/${companyNumber}/officers`);
    return data.items || [];
  }

  // Get persons with significant control (PSC)
  async getCompanyPSC(companyNumber: string): Promise<CompaniesHousePSC[]> {
    try {
      const data = await this.makeRequest(`/company/${companyNumber}/persons-with-significant-control`);
      return data.items || [];
    } catch (error) {
      // Some companies may not have PSC data available
      console.warn(`No PSC data available for company ${companyNumber}:`, error);
      return [];
    }
  }

  // Transform Companies House company profile to our client schema
  transformCompanyToClient(profile: CompaniesHouseCompanyProfile) {
    const address = profile.registered_office_address;
    
    return {
      name: profile.company_name,
      companiesHouseName: profile.company_name,
      companyNumber: profile.company_number,
      companyStatus: profile.company_status,
      companyType: profile.company_type,
      dateOfCreation: profile.date_of_creation ? new Date(profile.date_of_creation) : undefined,
      jurisdiction: profile.jurisdiction,
      sicCodes: profile.sic_codes || [],
      // Registered office address
      registeredAddress1: address.premises ? `${address.premises} ${address.address_line_1}` : address.address_line_1,
      registeredAddress2: address.address_line_2,
      registeredAddress3: address.care_of || address.locality,
      registeredAddress4: address.region,
      registeredPostcode: address.postal_code,
      registeredCountry: address.country,
      // Accounts information
      accountingReferenceDay: profile.accounts?.accounting_reference_date?.day,
      accountingReferenceMonth: profile.accounts?.accounting_reference_date?.month,
      lastAccountsMadeUpTo: profile.accounts?.last_accounts?.made_up_to ? new Date(profile.accounts.last_accounts.made_up_to) : undefined,
      lastAccountsType: profile.accounts?.last_accounts?.type,
      nextAccountsDue: profile.accounts?.next_due ? new Date(profile.accounts.next_due) : undefined,
      nextAccountsPeriodEnd: profile.accounts?.next_made_up_to ? new Date(profile.accounts.next_made_up_to) : undefined,
      accountsOverdue: profile.accounts?.overdue || false,
      // Confirmation statement information
      confirmationStatementLastMadeUpTo: profile.confirmation_statement?.last_made_up_to ? new Date(profile.confirmation_statement.last_made_up_to) : undefined,
      confirmationStatementNextDue: profile.confirmation_statement?.next_due ? new Date(profile.confirmation_statement.next_due) : undefined,
      confirmationStatementNextMadeUpTo: profile.confirmation_statement?.next_made_up_to ? new Date(profile.confirmation_statement.next_made_up_to) : undefined,
      confirmationStatementOverdue: profile.confirmation_statement?.overdue || false,
      // Store full API response for audit trail
      companiesHouseData: profile
    };
  }

  // Transform Companies House officer to our person schema
  transformOfficerToPerson(officer: CompaniesHouseOfficer, companyNumber: string) {
    const address = officer.address;
    
    return {
      fullName: officer.name,
      // Parse name components if needed (simple approach)
      firstName: this.extractFirstName(officer.name),
      lastName: this.extractLastName(officer.name),
      nationality: officer.nationality,
      countryOfResidence: officer.country_of_residence,
      occupation: officer.occupation,
      dateOfBirth: officer.date_of_birth ? `${officer.date_of_birth.year}-${officer.date_of_birth.month.toString().padStart(2, '0')}-01` : undefined,
      // Address mapping
      addressLine1: address.premises ? `${address.premises} ${address.address_line_1}` : address.address_line_1,
      addressLine2: address.address_line_2,
      locality: address.locality,
      region: address.region,
      postalCode: address.postal_code,
      country: address.country,
      // Generate person number from officer link if available
      personNumber: this.extractPersonNumberFromLink(officer.links?.officer?.appointments),
      notes: `Companies House officer for company ${companyNumber}. Role: ${officer.officer_role}${officer.appointed_on ? `, appointed: ${officer.appointed_on}` : ''}${officer.resigned_on ? `, resigned: ${officer.resigned_on}` : ''}`
    };
  }

  // Transform PSC to person schema
  transformPSCToPerson(psc: CompaniesHousePSC, companyNumber: string) {
    const address = psc.address;
    const name = psc.name || `${psc.name_elements?.forename || ''} ${psc.name_elements?.surname || ''}`.trim();
    
    return {
      fullName: name,
      title: psc.name_elements?.title,
      firstName: psc.name_elements?.forename,
      lastName: psc.name_elements?.surname,
      nationality: psc.nationality,
      countryOfResidence: psc.country_of_residence,
      dateOfBirth: psc.date_of_birth ? `${psc.date_of_birth.year}-${psc.date_of_birth.month.toString().padStart(2, '0')}-01` : undefined,
      // Address mapping
      addressLine1: address.premises ? `${address.premises} ${address.address_line_1}` : address.address_line_1,
      addressLine2: address.address_line_2,
      locality: address.locality,
      region: address.region,
      postalCode: address.postal_code,
      country: address.country,
      notes: `Person with Significant Control for company ${companyNumber}. Control: ${psc.natures_of_control?.join(', ')}. Notified: ${psc.notified_on}`
    };
  }

  private extractFirstName(fullName: string): string | undefined {
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 1 ? parts[0] : undefined;
  }

  private extractLastName(fullName: string): string | undefined {
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(-1)[0] : undefined;
  }

  private extractPersonNumberFromLink(appointmentsLink?: string): string | undefined {
    if (!appointmentsLink) return undefined;
    // Extract person ID from link like "/officers/xyz123abc/appointments"
    const match = appointmentsLink.match(/\/officers\/([^\/]+)\/appointments/);
    return match ? match[1] : undefined;
  }
}

export const companiesHouseService = new CompaniesHouseService();