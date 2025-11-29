/**
 * Notification Variable Metadata
 * 
 * Single source of truth for all available dynamic variables in notification templates.
 * Used by the NotificationVariableGuide component and other notification-related UIs.
 */

export interface NotificationVariable {
  id: string;
  token: string; // The actual variable placeholder, e.g., "{client_first_name}"
  label: string; // Display name
  category: "Client" | "Project" | "Dates" | "Service" | "Firm" | "Links" | "Recipients" | "Stage";
  description: string; // What the variable represents
  example?: string; // Example output
  channels?: ("email" | "sms" | "push")[]; // Which channels support this variable (undefined = all)
}

export const NOTIFICATION_VARIABLES: NotificationVariable[] = [
  // Client Variables
  {
    id: "client_first_name",
    token: "{client_first_name}",
    label: "Client First Name",
    category: "Client",
    description: "The first name of the client or contact person",
    example: "John"
  },
  {
    id: "client_last_name",
    token: "{client_last_name}",
    label: "Client Last Name",
    category: "Client",
    description: "The last name of the client or contact person",
    example: "Smith"
  },
  {
    id: "client_full_name",
    token: "{client_full_name}",
    label: "Client Full Name",
    category: "Client",
    description: "The full name of the client or company",
    example: "John Smith / Acme Corp"
  },
  {
    id: "client_company_name",
    token: "{client_company_name}",
    label: "Company Name",
    category: "Client",
    description: "The company or trading name",
    example: "Acme Corporation Ltd"
  },
  {
    id: "client_email",
    token: "{client_email}",
    label: "Client Email",
    category: "Client",
    description: "The client's email address",
    example: "john@example.com"
  },
  
  // Project Variables
  {
    id: "project_name",
    token: "{project_name}",
    label: "Project Name",
    category: "Project",
    description: "The description/name of the project",
    example: "VAT Return - Q1 2024"
  },
  {
    id: "project_type",
    token: "{project_type}",
    label: "Project Type",
    category: "Project",
    description: "The type of project",
    example: "VAT Return"
  },
  {
    id: "project_status",
    token: "{project_status}",
    label: "Project Status",
    category: "Project",
    description: "The current workflow stage of the project",
    example: "In Progress"
  },
  {
    id: "project_owner",
    token: "{project_owner}",
    label: "Project Owner",
    category: "Project",
    description: "The name of the staff member who owns this project",
    example: "Sarah Johnson"
  },
  {
    id: "assigned_staff",
    token: "{assigned_staff}",
    label: "Assigned Staff",
    category: "Project",
    description: "The name of the staff member currently assigned to the project",
    example: "Mike Davis"
  },
  
  // Date Variables
  {
    id: "current_date",
    token: "{current_date}",
    label: "Current Date",
    category: "Dates",
    description: "Today's date",
    example: "November 9, 2025"
  },
  {
    id: "next_start_date",
    token: "{next_start_date}",
    label: "Next Start Date",
    category: "Dates",
    description: "The upcoming start date for this service or project",
    example: "December 1, 2025"
  },
  {
    id: "next_due_date",
    token: "{next_due_date}",
    label: "Next Due Date",
    category: "Dates",
    description: "The upcoming due date for this service or project",
    example: "December 31, 2025"
  },
  {
    id: "days_until_start",
    token: "{days_until_start}",
    label: "Days Until Start",
    category: "Dates",
    description: "Number of days until the start date (can be negative if past)",
    example: "22"
  },
  {
    id: "days_until_due",
    token: "{days_until_due}",
    label: "Days Until Due",
    category: "Dates",
    description: "Number of days until the due date (can be negative if past)",
    example: "52"
  },
  {
    id: "days_overdue",
    token: "{days_overdue}",
    label: "Days Overdue",
    category: "Dates",
    description: "Number of days past the due date (empty if not overdue)",
    example: "3"
  },
  {
    id: "financial_year_end",
    token: "{financial_year_end}",
    label: "Financial Year End",
    category: "Dates",
    description: "The client's financial year end date",
    example: "March 31"
  },
  
  // Service Variables
  {
    id: "service_name",
    token: "{service_name}",
    label: "Service Name",
    category: "Service",
    description: "The name of the service",
    example: "Quarterly Bookkeeping"
  },
  {
    id: "service_description",
    token: "{service_description}",
    label: "Service Description",
    category: "Service",
    description: "A description of the service",
    example: "Comprehensive quarterly bookkeeping and reconciliation"
  },
  {
    id: "service_frequency",
    token: "{service_frequency}",
    label: "Service Frequency",
    category: "Service",
    description: "How often the service recurs",
    example: "Quarterly"
  },
  
  // Firm Variables
  {
    id: "firm_name",
    token: "{firm_name}",
    label: "Firm Name",
    category: "Firm",
    description: "Your firm's name",
    example: "The Link Accounting"
  },
  {
    id: "firm_phone",
    token: "{firm_phone}",
    label: "Firm Phone",
    category: "Firm",
    description: "Your firm's contact phone number",
    example: "020 1234 5678"
  },
  {
    id: "firm_email",
    token: "{firm_email}",
    label: "Firm Email",
    category: "Firm",
    description: "Your firm's contact email address",
    example: "hello@thelink.com"
  },
  {
    id: "staff_signature",
    token: "{staff_signature}",
    label: "Staff Signature",
    category: "Firm",
    description: "The email signature of the assigned staff member",
    example: "Best regards,\\nSarah Johnson\\nSenior Accountant"
  },
  
  // Action Link Variables
  {
    id: "portal_link",
    token: "{portal_link}",
    label: "Portal Link",
    category: "Links",
    description: "Link to the client portal homepage",
    example: "https://yourfirm.replit.app/"
  },
  {
    id: "project_link",
    token: "{project_link}",
    label: "Project Link",
    category: "Links",
    description: "Direct link to this specific project",
    example: "https://yourfirm.replit.app/projects/123"
  },
  {
    id: "document_upload_link",
    token: "{document_upload_link}",
    label: "Document Upload Link",
    category: "Links",
    description: "Link to upload documents for this client",
    example: "https://yourfirm.replit.app/clients/123/documents"
  },
  
  // Recipient Variables
  {
    id: "recipient_first_names",
    token: "{recipient_first_names}",
    label: "Recipient First Names",
    category: "Recipients",
    description: "First names of all selected recipients, joined naturally (e.g., 'John and Sarah' or 'John, Sarah and Mike')",
    example: "John and Sarah",
    channels: ["email"]
  },
  
  // Stage Approval Variables
  {
    id: "stage_approval",
    token: "{stage_approval:ApprovalName}",
    label: "Stage Approval Data",
    category: "Stage",
    description: "Completed items from a specific stage approval. Replace 'ApprovalName' with the exact name of the approval questionnaire (e.g., {stage_approval:Quality Control Review})",
    example: "• VAT reconciled: Yes\\n• Accounts reviewed: Yes",
    channels: ["email"]
  },
];

/**
 * Get variables by category
 */
export function getVariablesByCategory(category: NotificationVariable["category"]): NotificationVariable[] {
  return NOTIFICATION_VARIABLES.filter(v => v.category === category);
}

/**
 * Get all unique categories
 */
export function getCategories(): NotificationVariable["category"][] {
  return Array.from(new Set(NOTIFICATION_VARIABLES.map(v => v.category)));
}

/**
 * Get a specific variable by its ID
 */
export function getVariableById(id: string): NotificationVariable | undefined {
  return NOTIFICATION_VARIABLES.find(v => v.id === id);
}

/**
 * Filter variables by channel (email, sms, push)
 * Returns variables that are either available for all channels or explicitly support the given channel
 */
export function getVariablesByChannel(channel: "email" | "sms" | "push"): NotificationVariable[] {
  return NOTIFICATION_VARIABLES.filter(v => !v.channels || v.channels.includes(channel));
}
