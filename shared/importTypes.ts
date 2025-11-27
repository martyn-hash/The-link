export type ImportRecordStatus = 'created' | 'updated' | 'skipped' | 'failed';

export interface FieldMappingDefinition {
  systemField: string;
  label: string;
  description?: string;
  required: boolean;
  type: 'text' | 'number' | 'date' | 'email' | 'boolean' | 'select';
  options?: string[];
  group: string;
}

export interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  transformationType?: 'none' | 'date' | 'phone' | 'uppercase' | 'lowercase' | 'trim';
}

export interface SavedFieldMappingTemplate {
  id: string;
  name: string;
  importType: 'client_services' | 'people_services' | 'clients' | 'people';
  mappings: FieldMapping[];
  createdAt: string;
  updatedAt: string;
}

export interface ImportAuditRecord {
  rowNumber: number;
  status: ImportRecordStatus;
  recordType: 'client_service' | 'people_service' | 'client' | 'person' | 'role_assignment';
  identifier: string;
  details: string;
  sourceData: Record<string, any>;
  matchedEntity?: {
    id: string;
    name: string;
  };
  changes?: Record<string, { from: any; to: any }>;
  errorMessage?: string;
  warnings?: string[];
}

export interface ImportAuditReport {
  importId: string;
  importType: string;
  startedAt: string;
  completedAt: string;
  totalRows: number;
  summary: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  records: ImportAuditRecord[];
  errors: string[];
  warnings: string[];
}

export interface ServiceImportRow {
  clientName?: string;
  companyNumber?: string;
  personFullName?: string;
  personEmail?: string;
  serviceName: string;
  frequency?: string;
  nextStartDate?: string;
  nextDueDate?: string;
  serviceOwnerEmail?: string;
  isActive?: boolean | string;
  udfValues?: Record<string, any>;
  roleAssignments?: Array<{
    roleName: string;
    userEmail: string;
  }>;
}

export interface ParsedServiceImportData {
  type: 'client_services' | 'people_services' | 'mixed';
  rows: ServiceImportRow[];
  headers: string[];
  suggestedMappings: FieldMapping[];
}

export interface ServiceImportValidationResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  warnings: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  matchStats: {
    clientsMatched: number;
    clientsNotFound: number;
    peopleMatched: number;
    peopleNotFound: number;
    servicesMatched: number;
    servicesNotFound: number;
  };
  previewData: Array<{
    row: number;
    sourceData: Record<string, any>;
    matchedClient?: { id: string; name: string };
    matchedPerson?: { id: string; name: string };
    matchedService?: { id: string; name: string };
    action: 'create' | 'update' | 'skip';
    skipReason?: string;
  }>;
}

export interface ServiceImportExecutionResult {
  success: boolean;
  importId: string;
  summary: {
    clientServicesCreated: number;
    clientServicesUpdated: number;
    clientServicesSkipped: number;
    peopleServicesCreated: number;
    peopleServicesUpdated: number;
    peopleServicesSkipped: number;
    roleAssignmentsCreated: number;
    roleAssignmentsUpdated: number;
    udfValuesUpdated: number;
    errors: number;
  };
  auditReport: ImportAuditReport;
}

export const CLIENT_SERVICE_FIELD_DEFINITIONS: FieldMappingDefinition[] = [
  { systemField: 'companyNumber', label: 'Company Number', description: 'Companies House registration number (8 digits)', required: false, type: 'text', group: 'Client Identifier' },
  { systemField: 'clientName', label: 'Client Name', description: 'Name of the client company', required: false, type: 'text', group: 'Client Identifier' },
  { systemField: 'serviceName', label: 'Service Name', description: 'Name of the service to assign', required: true, type: 'text', group: 'Service' },
  { systemField: 'frequency', label: 'Frequency', description: 'How often the service is performed', required: false, type: 'select', options: ['monthly', 'quarterly', 'annual', 'one-off', 'weekly', 'fortnightly'], group: 'Service Config' },
  { systemField: 'nextStartDate', label: 'Next Start Date', description: 'When the next service period starts', required: false, type: 'date', group: 'Service Config' },
  { systemField: 'nextDueDate', label: 'Next Due Date', description: 'When the next service is due', required: false, type: 'date', group: 'Service Config' },
  { systemField: 'serviceOwnerEmail', label: 'Service Owner Email', description: 'Email of the user who owns this service', required: false, type: 'email', group: 'Service Config' },
  { systemField: 'isActive', label: 'Is Active', description: 'Whether the service is currently active', required: false, type: 'boolean', group: 'Service Config' },
];

export const PEOPLE_SERVICE_FIELD_DEFINITIONS: FieldMappingDefinition[] = [
  { systemField: 'personEmail', label: 'Person Email', description: 'Email address of the person', required: false, type: 'email', group: 'Person Identifier' },
  { systemField: 'personFullName', label: 'Person Full Name', description: 'Full name of the person', required: false, type: 'text', group: 'Person Identifier' },
  { systemField: 'serviceName', label: 'Service Name', description: 'Name of the service to assign', required: true, type: 'text', group: 'Service' },
  { systemField: 'frequency', label: 'Frequency', description: 'How often the service is performed', required: false, type: 'select', options: ['monthly', 'quarterly', 'annual', 'one-off', 'weekly', 'fortnightly'], group: 'Service Config' },
  { systemField: 'nextStartDate', label: 'Next Start Date', description: 'When the next service period starts', required: false, type: 'date', group: 'Service Config' },
  { systemField: 'nextDueDate', label: 'Next Due Date', description: 'When the next service is due', required: false, type: 'date', group: 'Service Config' },
  { systemField: 'serviceOwnerEmail', label: 'Service Owner Email', description: 'Email of the user who owns this service', required: false, type: 'email', group: 'Service Config' },
  { systemField: 'isActive', label: 'Is Active', description: 'Whether the service is currently active', required: false, type: 'boolean', group: 'Service Config' },
];

export const CLIENT_FIELD_DEFINITIONS: FieldMappingDefinition[] = [
  { systemField: 'name', label: 'Client Name', description: 'Name of the client company or individual', required: true, type: 'text', group: 'Basic Info' },
  { systemField: 'clientType', label: 'Client Type', description: 'Type of client (Company, Individual, etc.)', required: false, type: 'select', options: ['Company', 'Individual', 'Partnership', 'Trust', 'Charity'], group: 'Basic Info' },
  { systemField: 'tradingAs', label: 'Trading As', description: 'Trading name if different from company name', required: false, type: 'text', group: 'Basic Info' },
  { systemField: 'companyNumber', label: 'Company Number', description: 'Companies House registration number (8 digits)', required: false, type: 'text', group: 'Company Details' },
  { systemField: 'companyUtr', label: 'Company UTR', description: 'Company Unique Taxpayer Reference', required: false, type: 'text', group: 'Company Details' },
  { systemField: 'companiesHouseAuthCode', label: 'CH Auth Code', description: 'Companies House authentication code', required: false, type: 'text', group: 'Company Details' },
  { systemField: 'email', label: 'Company Email', description: 'Main company email address', required: false, type: 'email', group: 'Contact' },
  { systemField: 'companyEmailDomain', label: 'Email Domain', description: 'Company email domain (e.g. company.co.uk)', required: false, type: 'text', group: 'Contact' },
  { systemField: 'companyTelephone', label: 'Company Telephone', description: 'Main company phone number', required: false, type: 'text', group: 'Contact' },
  { systemField: 'registeredAddress', label: 'Registered Address', description: 'Full registered office address', required: false, type: 'text', group: 'Addresses' },
  { systemField: 'postalAddress', label: 'Postal Address', description: 'Postal/correspondence address if different', required: false, type: 'text', group: 'Addresses' },
  { systemField: 'managerEmail', label: 'Manager Email', description: 'Email of the assigned manager', required: false, type: 'email', group: 'Assignment' },
  { systemField: 'monthlyChargeQuote', label: 'Monthly Charge', description: 'Monthly charge quote amount', required: false, type: 'text', group: 'Billing' },
  { systemField: 'clientOnboardedDate', label: 'Onboarded Date', description: 'Date client was onboarded', required: false, type: 'date', group: 'Dates' },
  { systemField: 'notes', label: 'Notes', description: 'General notes about the client', required: false, type: 'text', group: 'Other' },
];

export const PEOPLE_FIELD_DEFINITIONS: FieldMappingDefinition[] = [
  { systemField: 'fullName', label: 'Full Name', description: 'Full name of the person', required: false, type: 'text', group: 'Basic Info' },
  { systemField: 'firstName', label: 'First Name', description: 'First/given name', required: false, type: 'text', group: 'Basic Info' },
  { systemField: 'lastName', label: 'Last Name', description: 'Last/family name', required: false, type: 'text', group: 'Basic Info' },
  { systemField: 'email', label: 'Email', description: 'Email address', required: false, type: 'email', group: 'Contact' },
  { systemField: 'mobileNumber', label: 'Mobile Number', description: 'Mobile phone number (UK format)', required: false, type: 'text', group: 'Contact' },
  { systemField: 'dateOfBirth', label: 'Date of Birth', description: 'Date of birth (DD/MM/YYYY)', required: false, type: 'date', group: 'Personal' },
  { systemField: 'niNumber', label: 'NI Number', description: 'National Insurance number', required: false, type: 'text', group: 'Personal' },
  { systemField: 'utr', label: 'UTR', description: 'Unique Taxpayer Reference', required: false, type: 'text', group: 'Personal' },
  { systemField: 'postalAddress', label: 'Postal Address', description: 'Full postal address', required: false, type: 'text', group: 'Address' },
  { systemField: 'clientCompanyNumber', label: 'Client Company Number', description: 'Company number of associated client', required: false, type: 'text', group: 'Client Association' },
  { systemField: 'clientName', label: 'Client Name', description: 'Name of associated client', required: false, type: 'text', group: 'Client Association' },
  { systemField: 'initialContactDate', label: 'Initial Contact Date', description: 'Date of first contact', required: false, type: 'date', group: 'Dates' },
  { systemField: 'addressVerified', label: 'Address Verified', description: 'Has address been verified?', required: false, type: 'boolean', group: 'Verification' },
  { systemField: 'photoIdVerified', label: 'Photo ID Verified', description: 'Has photo ID been verified?', required: false, type: 'boolean', group: 'Verification' },
  { systemField: 'moneyLaunderingComplete', label: 'AML Complete', description: 'Money laundering checks complete?', required: false, type: 'boolean', group: 'Verification' },
  { systemField: 'notes', label: 'Notes', description: 'General notes about the person', required: false, type: 'text', group: 'Other' },
];

export function suggestFieldMapping(sourceHeader: string, definitions: FieldMappingDefinition[]): string | null {
  const normalizedHeader = sourceHeader.toLowerCase().trim().replace(/[_\-\s]+/g, '');
  
  const exactMatches: Record<string, string> = {
    // Service import mappings
    'companynumber': 'companyNumber',
    'companyno': 'companyNumber',
    'compno': 'companyNumber',
    'regnum': 'companyNumber',
    'registrationnumber': 'companyNumber',
    'clientname': 'clientName',
    'client': 'clientName',
    'company': 'clientName',
    'companyname': 'clientName',
    'personname': 'personFullName',
    'fullname': 'personFullName',
    'personfullname': 'personFullName',
    'personemail': 'personEmail',
    'emailaddress': 'email',
    'servicename': 'serviceName',
    'service': 'serviceName',
    'frequency': 'frequency',
    'freq': 'frequency',
    'period': 'frequency',
    'nextstartdate': 'nextStartDate',
    'startdate': 'nextStartDate',
    'start': 'nextStartDate',
    'nextduedate': 'nextDueDate',
    'duedate': 'nextDueDate',
    'due': 'nextDueDate',
    'deadline': 'nextDueDate',
    'serviceowner': 'serviceOwnerEmail',
    'serviceowneremail': 'serviceOwnerEmail',
    'owner': 'serviceOwnerEmail',
    'owneremail': 'serviceOwnerEmail',
    'isactive': 'isActive',
    'active': 'isActive',
    'status': 'isActive',
    // Client import mappings
    'name': 'name',
    'clienttype': 'clientType',
    'type': 'clientType',
    'tradingas': 'tradingAs',
    'tradingname': 'tradingAs',
    'companyutr': 'companyUtr',
    'utr': 'companyUtr',
    'chauthcode': 'companiesHouseAuthCode',
    'authcode': 'companiesHouseAuthCode',
    'authenticationcode': 'companiesHouseAuthCode',
    'email': 'email',
    'companyemail': 'email',
    'emaildomain': 'companyEmailDomain',
    'domain': 'companyEmailDomain',
    'telephone': 'companyTelephone',
    'phone': 'companyTelephone',
    'companyphone': 'companyTelephone',
    'companytelephone': 'companyTelephone',
    'registeredaddress': 'registeredAddress',
    'regaddress': 'registeredAddress',
    'postaladdress': 'postalAddress',
    'address': 'postalAddress',
    'correspondenceaddress': 'postalAddress',
    'manageremail': 'managerEmail',
    'manager': 'managerEmail',
    'monthlycharge': 'monthlyChargeQuote',
    'monthlyquote': 'monthlyChargeQuote',
    'monthlycharges': 'monthlyChargeQuote',
    'fee': 'monthlyChargeQuote',
    'onboardeddate': 'clientOnboardedDate',
    'creationdate': 'clientOnboardedDate',
    'clientstartdate': 'clientOnboardedDate',
    'notes': 'notes',
    // People import mappings
    'firstname': 'firstName',
    'forename': 'firstName',
    'givenname': 'firstName',
    'lastname': 'lastName',
    'surname': 'lastName',
    'familyname': 'lastName',
    'mobilenumber': 'mobileNumber',
    'mobile': 'mobileNumber',
    'phonenumber': 'mobileNumber',
    'dateofbirth': 'dateOfBirth',
    'dob': 'dateOfBirth',
    'birthdate': 'dateOfBirth',
    'ninumber': 'niNumber',
    'ni': 'niNumber',
    'nationalinsurance': 'niNumber',
    'nino': 'niNumber',
    'clientcompanynumber': 'clientCompanyNumber',
    'initialcontactdate': 'initialContactDate',
    'initialcontact': 'initialContactDate',
    'contactdate': 'initialContactDate',
    'addressverified': 'addressVerified',
    'photoidverified': 'photoIdVerified',
    'photoid': 'photoIdVerified',
    'idverified': 'photoIdVerified',
    'moneylaunderingcomplete': 'moneyLaunderingComplete',
    'amlcomplete': 'moneyLaunderingComplete',
    'aml': 'moneyLaunderingComplete',
  };
  
  if (exactMatches[normalizedHeader]) {
    return exactMatches[normalizedHeader];
  }
  
  for (const def of definitions) {
    const normalizedField = def.systemField.toLowerCase();
    const normalizedLabel = def.label.toLowerCase().replace(/[_\-\s]+/g, '');
    
    if (normalizedHeader.includes(normalizedField) || normalizedField.includes(normalizedHeader)) {
      return def.systemField;
    }
    if (normalizedHeader.includes(normalizedLabel) || normalizedLabel.includes(normalizedHeader)) {
      return def.systemField;
    }
  }
  
  return null;
}

export function generateAuditReportCSV(report: ImportAuditReport): string {
  const headers = [
    'Row Number',
    'Status',
    'Record Type',
    'Identifier',
    'Details',
    'Matched Entity ID',
    'Matched Entity Name',
    'Error Message',
    'Warnings',
    'Source Data'
  ];
  
  const rows = report.records.map(record => [
    record.rowNumber.toString(),
    record.status,
    record.recordType,
    record.identifier,
    record.details,
    record.matchedEntity?.id || '',
    record.matchedEntity?.name || '',
    record.errorMessage || '',
    record.warnings?.join('; ') || '',
    JSON.stringify(record.sourceData)
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  return csvContent;
}
