import { format, differenceInDays } from "date-fns";
import type { User, Client, Project, Service } from "@shared/schema";

/**
 * Notification Variable Processor
 * 
 * This module handles dynamic variable replacement in notification templates.
 * It supports multiple variable categories: client, project, date, service, firm, and action links.
 */

export interface StageApprovalData {
  approvalName: string;
  responses: Array<{
    fieldName: string;
    fieldType: 'boolean' | 'number' | 'long_text' | 'multi_select';
    value: boolean | number | string | string[] | null;
  }>;
}

export interface NotificationVariableContext {
  // Client data
  client?: {
    id: string;
    name: string;
    email: string | null;
    clientType: string | null;
    financialYearEnd: Date | null;
  };
  
  // Person data (for individual contacts)
  person?: {
    id: string;
    fullName: string;
    email: string | null;
  };
  
  // Project data
  project?: {
    id: string;
    description: string;
    projectTypeName: string;
    currentStatus: string;
    startDate: Date | null;
    dueDate: Date | null;
  };
  
  // Service data
  service?: {
    name: string;
    description: string | null;
    frequency: string | null;
    nextStartDate: Date | null;
    nextDueDate: Date | null;
  };
  
  // Staff data
  projectOwner?: User;
  assignedStaff?: User;
  sendingStaff?: User; // The staff member sending the notification (for stage change client value notifications)
  
  // Firm settings
  firmSettings?: {
    firmName: string;
    firmPhone: string | null;
    firmEmail: string | null;
    portalUrl: string | null;
  };
  
  // Stage approval data (keyed by approval name)
  stageApprovals?: Map<string, StageApprovalData>;
}

/**
 * Calculate days between two dates (UTC midnight comparison)
 */
function calculateDaysDifference(fromDate: Date, toDate: Date): number {
  const from = new Date(Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()));
  const to = new Date(Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()));
  return differenceInDays(to, from);
}

/**
 * Format a user's name (handles null/missing names gracefully)
 */
function formatUserName(user?: User): string {
  if (!user) return "";
  
  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  } else if (user.email) {
    return user.email.split("@")[0]; // Use email prefix as fallback
  } else {
    return "Staff Member";
  }
}

/**
 * Extract first name from a full name or user object
 */
function getFirstName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[0] || "";
}

/**
 * Extract last name from a full name
 */
function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return parts.slice(1).join(" ");
  }
  return "";
}

/**
 * Format stage approval data into a readable summary
 * This generates a nice HTML/text representation of approval responses
 */
function formatStageApprovalSummary(approval: StageApprovalData): string {
  if (!approval.responses || approval.responses.length === 0) {
    return "";
  }
  
  const lines: string[] = [];
  
  for (const response of approval.responses) {
    let formattedValue: string;
    
    switch (response.fieldType) {
      case 'boolean':
        formattedValue = response.value === true ? 'Yes' : response.value === false ? 'No' : 'N/A';
        break;
      case 'number':
        formattedValue = response.value !== null && response.value !== undefined 
          ? String(response.value) 
          : 'N/A';
        break;
      case 'multi_select':
        formattedValue = Array.isArray(response.value) 
          ? response.value.join(', ') 
          : 'N/A';
        break;
      case 'long_text':
      default:
        formattedValue = response.value !== null && response.value !== undefined 
          ? String(response.value) 
          : 'N/A';
    }
    
    lines.push(`<strong>${response.fieldName}:</strong> ${formattedValue}`);
  }
  
  return lines.join('<br/>');
}

/**
 * Build action links based on context and firm settings
 */
function buildActionLinks(context: NotificationVariableContext): {
  portalLink: string;
  projectLink: string;
  documentUploadLink: string;
} {
  const baseUrl = context.firmSettings?.portalUrl || "";
  
  const portalLink = baseUrl ? `${baseUrl}/` : "";
  const projectLink = baseUrl && context.project?.id 
    ? `${baseUrl}/projects/${context.project.id}` 
    : "";
  const documentUploadLink = baseUrl && context.client?.id 
    ? `${baseUrl}/clients/${context.client.id}/documents` 
    : "";
  
  return { portalLink, projectLink, documentUploadLink };
}

/**
 * Process notification template and replace all variables with actual values
 * 
 * @param template - The notification template string containing {variable} placeholders
 * @param context - The variable context containing all available data
 * @returns Processed template with variables replaced
 */
export function processNotificationVariables(
  template: string,
  context: NotificationVariableContext
): string {
  if (!template) return "";
  
  let processed = template;
  const now = new Date();
  
  // Client variables
  if (context.client) {
    const clientName = context.client.name || "";
    const firstName = getFirstName(clientName);
    const lastName = getLastName(clientName);
    
    processed = processed.replace(/\{client_first_name\}/g, firstName);
    processed = processed.replace(/\{client_last_name\}/g, lastName);
    processed = processed.replace(/\{client_full_name\}/g, clientName);
    processed = processed.replace(/\{client_company_name\}/g, clientName); // Same as full name for companies
    processed = processed.replace(/\{client_email\}/g, context.client.email || "");
  } else if (context.person) {
    // Use person data if client not available
    const personName = context.person.fullName || "";
    const firstName = getFirstName(personName);
    const lastName = getLastName(personName);
    
    processed = processed.replace(/\{client_first_name\}/g, firstName);
    processed = processed.replace(/\{client_last_name\}/g, lastName);
    processed = processed.replace(/\{client_full_name\}/g, personName);
    processed = processed.replace(/\{client_company_name\}/g, personName);
    processed = processed.replace(/\{client_email\}/g, context.person.email || "");
  }
  
  // Project variables
  if (context.project) {
    processed = processed.replace(/\{project_name\}/g, context.project.description || "");
    processed = processed.replace(/\{project_type\}/g, context.project.projectTypeName || "");
    processed = processed.replace(/\{project_status\}/g, context.project.currentStatus || "");
  }
  
  // Staff variables
  if (context.projectOwner) {
    processed = processed.replace(/\{project_owner\}/g, formatUserName(context.projectOwner));
  }
  if (context.assignedStaff) {
    processed = processed.replace(/\{assigned_staff\}/g, formatUserName(context.assignedStaff));
  }
  
  // Date variables
  processed = processed.replace(/\{current_date\}/g, format(now, "MMMM d, yyyy"));
  
  // Service date variables
  if (context.service?.nextStartDate) {
    processed = processed.replace(/\{next_start_date\}/g, format(context.service.nextStartDate, "MMMM d, yyyy"));
    
    const daysUntilStart = calculateDaysDifference(now, context.service.nextStartDate);
    processed = processed.replace(/\{days_until_start\}/g, daysUntilStart.toString());
  }
  
  if (context.service?.nextDueDate) {
    processed = processed.replace(/\{next_due_date\}/g, format(context.service.nextDueDate, "MMMM d, yyyy"));
    
    const daysUntilDue = calculateDaysDifference(now, context.service.nextDueDate);
    processed = processed.replace(/\{days_until_due\}/g, daysUntilDue.toString());
  }
  
  // Project date variables (override service dates if available)
  if (context.project?.startDate) {
    processed = processed.replace(/\{next_start_date\}/g, format(context.project.startDate, "MMMM d, yyyy"));
    
    const daysUntilStart = calculateDaysDifference(now, context.project.startDate);
    processed = processed.replace(/\{days_until_start\}/g, daysUntilStart.toString());
  }
  
  if (context.project?.dueDate) {
    processed = processed.replace(/\{next_due_date\}/g, format(context.project.dueDate, "MMMM d, yyyy"));
    
    const daysUntilDue = calculateDaysDifference(now, context.project.dueDate);
    processed = processed.replace(/\{days_until_due\}/g, daysUntilDue.toString());
    
    // Calculate days overdue (always replace, even if not overdue)
    // Negative daysUntilDue means overdue, positive means not yet due
    if (daysUntilDue < 0) {
      processed = processed.replace(/\{days_overdue\}/g, Math.abs(daysUntilDue).toString());
    } else {
      // Not overdue yet - replace with empty string to avoid showing {days_overdue} in template
      processed = processed.replace(/\{days_overdue\}/g, "");
    }
  } else if (context.service?.nextDueDate) {
    // Also handle days_overdue for service due dates
    const daysUntilDue = calculateDaysDifference(now, context.service.nextDueDate);
    if (daysUntilDue < 0) {
      processed = processed.replace(/\{days_overdue\}/g, Math.abs(daysUntilDue).toString());
    } else {
      processed = processed.replace(/\{days_overdue\}/g, "");
    }
  }
  
  // Financial year end
  if (context.client?.financialYearEnd) {
    processed = processed.replace(/\{financial_year_end\}/g, format(context.client.financialYearEnd, "MMMM d"));
  }
  
  // Service variables
  if (context.service) {
    processed = processed.replace(/\{service_name\}/g, context.service.name || "");
    processed = processed.replace(/\{service_description\}/g, context.service.description || "");
    processed = processed.replace(/\{service_frequency\}/g, context.service.frequency || "");
  }
  
  // Firm variables
  if (context.firmSettings) {
    processed = processed.replace(/\{firm_name\}/g, context.firmSettings.firmName || "The Link");
    processed = processed.replace(/\{firm_phone\}/g, context.firmSettings.firmPhone || "");
    processed = processed.replace(/\{firm_email\}/g, context.firmSettings.firmEmail || "");
  }
  
  // Staff signature (use assigned staff or project owner)
  const staffForSignature = context.assignedStaff || context.projectOwner;
  if (staffForSignature) {
    const signature = staffForSignature.emailSignature || formatUserName(staffForSignature);
    processed = processed.replace(/\{staff_signature\}/g, signature);
  }
  
  // Staff Calendly link (use sending staff, or assigned staff, or project owner)
  const staffForCalendly = context.sendingStaff || context.assignedStaff || context.projectOwner;
  if (staffForCalendly) {
    const calendlyLink = (staffForCalendly as any).calendlyLink || "";
    processed = processed.replace(/\{staff_calendly_link\}/g, calendlyLink);
  }
  
  // Action links
  const actionLinks = buildActionLinks(context);
  processed = processed.replace(/\{portal_link\}/g, actionLinks.portalLink);
  processed = processed.replace(/\{project_link\}/g, actionLinks.projectLink);
  processed = processed.replace(/\{document_upload_link\}/g, actionLinks.documentUploadLink);
  
  // Stage approval variables - pattern: {stage_approval:ApprovalName}
  // This allows templates to include approval data from specific named approvals
  if (context.stageApprovals && context.stageApprovals.size > 0) {
    // Find all {stage_approval:...} patterns in the template
    const approvalPattern = /\{stage_approval:([^}]+)\}/g;
    let match;
    
    while ((match = approvalPattern.exec(processed)) !== null) {
      const approvalName = match[1].trim();
      const approval = context.stageApprovals.get(approvalName);
      
      if (approval) {
        const formattedApproval = formatStageApprovalSummary(approval);
        // Use a new regex for replacement to avoid infinite loop
        processed = processed.replace(
          new RegExp(`\\{stage_approval:${approvalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'),
          formattedApproval
        );
      }
    }
  }
  
  // Frontend-only variables that should be preserved for client-side processing
  // These variables depend on user interaction (e.g., recipient selection) and cannot be resolved server-side
  const frontendOnlyVariables = [
    'recipient_first_names',
  ];
  
  // Remove any remaining unreplaced variables (graceful degradation)
  // This prevents showing {variable_name} to end users if data is missing
  // But preserve frontend-only variables that will be processed client-side
  processed = processed.replace(/\{([^}]+)\}/g, (match, varName) => {
    if (frontendOnlyVariables.includes(varName)) {
      return match; // Preserve the variable for frontend processing
    }
    return ""; // Remove unknown variables
  });
  
  return processed;
}
