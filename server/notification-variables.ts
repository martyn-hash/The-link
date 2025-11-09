import { format, differenceInDays } from "date-fns";
import type { User, Client, Project, Service } from "@shared/schema";

/**
 * Notification Variable Processor
 * 
 * This module handles dynamic variable replacement in notification templates.
 * It supports multiple variable categories: client, project, date, service, firm, and action links.
 */

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
  
  // Firm settings
  firmSettings?: {
    firmName: string;
    firmPhone: string | null;
    firmEmail: string | null;
    portalUrl: string | null;
  };
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
  
  // Action links
  const actionLinks = buildActionLinks(context);
  processed = processed.replace(/\{portal_link\}/g, actionLinks.portalLink);
  processed = processed.replace(/\{project_link\}/g, actionLinks.projectLink);
  processed = processed.replace(/\{document_upload_link\}/g, actionLinks.documentUploadLink);
  
  // Remove any remaining unreplaced variables (graceful degradation)
  // This prevents showing {variable_name} to end users if data is missing
  processed = processed.replace(/\{[^}]+\}/g, "");
  
  return processed;
}

/**
 * Generate dummy variable context for preview when no real data is available
 * Returns realistic example data that matches the NotificationVariableContext interface
 */
export function generateDummyVariableContext(): NotificationVariableContext {
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(now.getDate() + 7);
  
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);
  
  const marchYearEnd = new Date(now.getFullYear(), 2, 31); // March 31st
  
  return {
    client: {
      id: 'example-client-id',
      name: 'Acme Corporation Ltd',
      email: 'contact@acmecorp.example',
      clientType: 'Limited Company',
      financialYearEnd: marchYearEnd,
    },
    person: {
      id: 'example-person-id',
      fullName: 'John Smith',
      email: 'john.smith@acmecorp.example',
    },
    project: {
      id: 'example-project-id',
      description: 'Annual Accounts 2024',
      projectTypeName: 'Annual Accounts',
      currentStatus: 'In Progress',
      startDate: fourteenDaysAgo,
      dueDate: sevenDaysFromNow,
    },
    service: {
      name: 'Annual Accounts',
      description: 'Preparation of annual financial statements',
      frequency: 'Annual',
      nextStartDate: fourteenDaysAgo,
      nextDueDate: sevenDaysFromNow,
    },
    assignedStaff: {
      id: 'example-staff-id',
      email: 'sarah.johnson@yourfirm.example',
      firstName: 'Sarah',
      lastName: 'Johnson',
      profileImageUrl: null,
      emailSignature: '<p>Best regards,<br>Sarah Johnson<br>Senior Accountant</p>',
      isAdmin: false,
      canSeeAdminMenu: false,
      superAdmin: false,
      passwordHash: null,
      isFallbackUser: false,
      pushNotificationsEnabled: true,
      notificationPreferences: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    },
    firmSettings: {
      firmName: 'Your Firm Name',
      firmPhone: '01234 567890',
      firmEmail: 'info@yourfirm.example',
      portalUrl: 'https://portal.yourfirm.example',
    },
  };
}
