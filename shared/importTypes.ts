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

export function suggestFieldMapping(sourceHeader: string, definitions: FieldMappingDefinition[]): string | null {
  const normalizedHeader = sourceHeader.toLowerCase().trim().replace(/[_\-\s]+/g, '');
  
  const exactMatches: Record<string, string> = {
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
    'name': 'personFullName',
    'personfullname': 'personFullName',
    'personemail': 'personEmail',
    'email': 'personEmail',
    'emailaddress': 'personEmail',
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
