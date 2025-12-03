import multer from "multer";
import { storage } from "../storage/index";
import { z } from "zod";

// Email attachment schema
export const emailAttachmentSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  contentType: z.string().min(1, "Content type is required"),
  content: z.string().min(1, "Content is required"), // Base64 encoded
  size: z.number().positive("Size must be positive"),
});

// Email sending schema
export const sendEmailSchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Email content is required"),
  clientId: z.string().optional(),
  personId: z.string().optional(),
  projectId: z.string().optional(),
  isHtml: z.boolean().optional(),
  attachments: z.array(emailAttachmentSchema).optional(),
});

// Push notification schemas
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh key is required"),
    auth: z.string().min(1, "auth key is required"),
  }),
  userAgent: z.string().optional(),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL"),
});

export const pushSendSchema = z.object({
  userIds: z.array(z.string()).min(1, "At least one user ID is required"),
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
  url: z.string().optional(),
  icon: z.string().optional(),
  tag: z.string().optional(),
  requireInteraction: z.boolean().optional(),
});

// Push notification template schemas
export const createNotificationTemplateSchema = z.object({
  templateType: z.enum(["new_message_staff", "new_message_client", "document_request", "task_assigned", "project_stage_change", "status_update", "reminder"]),
  name: z.string().min(1, "Name is required"),
  titleTemplate: z.string().min(1, "Title template is required"),
  bodyTemplate: z.string().min(1, "Body template is required"),
  iconUrl: z.string().nullable().optional(),
  badgeUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateNotificationTemplateSchema = z.object({
  titleTemplate: z.string().min(1, "Title template is required").optional(),
  bodyTemplate: z.string().min(1, "Body template is required").optional(),
  iconUrl: z.string().min(1).optional(),
  badgeUrl: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

export const testNotificationTemplateSchema = z.object({
  sampleData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

// Analytics query schema
export const analyticsQuerySchema = z.object({
  filters: z.object({
    serviceFilter: z.string().optional(),
    showArchived: z.boolean().optional(),
    taskAssigneeFilter: z.string().optional(),
    serviceOwnerFilter: z.string().optional(),
    userFilter: z.string().optional(),
    dynamicDateFilter: z.enum(['all', 'overdue', 'today', 'next7days', 'next14days', 'next30days', 'custom']).optional(),
    customDateRange: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }).optional(),
  }).optional(),
  groupBy: z.enum(['projectType', 'status', 'assignee', 'serviceOwner', 'daysOverdue'], {
    required_error: "groupBy must be one of: projectType, status, assignee, serviceOwner, daysOverdue",
  }),
  metric: z.string().optional(),
});

// RingCentral validation schemas
export const ringCentralAuthenticateSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  refreshToken: z.string().optional(),
  expiresIn: z.number().positive("Expiration time must be positive"),
});

export const ringCentralLogCallSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  personId: z.string().optional(),
  phoneNumber: z.string().min(1, "Phone number is required"),
  direction: z.enum(['inbound', 'outbound']),
  duration: z.number().optional(),
  sessionId: z.string().min(1, "Session ID is required"),
  recordingId: z.string().optional(),
});

export const ringCentralRequestTranscriptSchema = z.object({
  communicationId: z.string().min(1, "Communication ID is required"),
  recordingId: z.string().min(1, "Recording ID is required"),
});

// SMS sending validation schema
export const sendSmsSchema = z.object({
  to: z.string().min(1, "Phone number is required"),
  message: z.string().min(1, "SMS message is required"),
  clientId: z.string().min(1, "Client ID is required"),
  personId: z.string().optional(),
  projectId: z.string().optional(),
});

// Resource-specific parameter validation schemas
export const paramUserIdSchema = z.object({
  userId: z.string().min(1, "User ID is required")
});

export const paramUserIdAsIdSchema = z.object({
  id: z.string().min(1, "User ID is required")
});

export const paramUuidSchema = z.object({
  id: z.string().min(1, "ID is required").uuid("Invalid ID format")
});

export const paramClientIdSchema = z.object({
  clientId: z.string().min(1, "Client ID is required").uuid("Invalid client ID format")
});

export const paramServiceIdSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required").uuid("Invalid service ID format")
});

export const paramProjectTypeIdSchema = z.object({
  projectTypeId: z.string().min(1, "Project type ID is required").uuid("Invalid project type ID format")
});

export const paramClientServiceIdSchema = z.object({
  clientServiceId: z.string().min(1, "Client service ID is required").uuid("Invalid client service ID format")
});

export const paramPeopleServiceIdSchema = z.object({
  peopleServiceId: z.string().min(1, "People service ID is required").uuid("Invalid people service ID format")
});

export const paramPersonIdSchema = z.object({
  personId: z.string().min(1, "Person ID is required")
});

export const paramApprovalIdSchema = z.object({
  approvalId: z.string().min(1, "Approval ID is required").uuid("Invalid approval ID format")
});

export const paramCompanyNumberSchema = z.object({
  companyNumber: z.string().min(1, "Company number is required").regex(/^[A-Z0-9]{6,8}$/, "Invalid UK company number format")
});

export const paramUserIntegrationIdSchema = z.object({
  userIntegrationId: z.string().min(1, "User integration ID is required").uuid("Invalid user integration ID format")
});

// Helper function for parameter validation
export const validateParams = <T>(schema: z.ZodSchema<T>, params: any): { success: true; data: T } | { success: false; errors: any[] } => {
  const result = schema.safeParse(params);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error.issues };
};

// Name parsing utilities for duplicate detection
export interface ParsedName {
  firstName: string;
  lastName: string;
  fullName: string;
}

export const parseFullName = (fullName: string): ParsedName => {
  const normalizedName = fullName.trim().replace(/\s+/g, ' ');

  // Remove common honorifics
  const cleanName = normalizedName
    .replace(/^(Mr|Mrs|Ms|Miss|Dr|Prof|Sir|Dame|Lord|Lady)\.?\s+/i, '');

  // Handle "LASTNAME, Firstname Middlename" format (common from Companies House)
  if (cleanName.includes(',')) {
    const parts = cleanName.split(',', 2);
    const lastName = parts[0].trim();
    const remainingNames = parts[1].trim();
    const firstName = remainingNames.split(' ')[0];

    return {
      firstName: firstName,
      lastName: lastName,
      fullName: normalizedName
    };
  }

  // Handle "Firstname Middlename LASTNAME" format
  const nameParts = cleanName.split(' ');
  if (nameParts.length === 1) {
    return {
      firstName: nameParts[0],
      lastName: '',
      fullName: normalizedName
    };
  }

  const lastName = nameParts[nameParts.length - 1];
  const firstName = nameParts[0];

  return {
    firstName: firstName,
    lastName: lastName,
    fullName: normalizedName
  };
};

// Configure multer for file uploads
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Middleware to resolve effective user (for impersonation)
export const resolveEffectiveUser = async (req: any, res: any, next: any) => {
  try {
    if (req.user && req.user.id) {
      const originalUserId = req.user.id;
      const originalUser = await storage.getUser(originalUserId);

      if (originalUser && originalUser.isAdmin) {
        const effectiveUser = await storage.getEffectiveUser(originalUserId);
        if (effectiveUser && effectiveUser.id !== originalUserId) {
          // Replace user context with impersonated user
          req.user.effectiveUser = effectiveUser;
          req.user.effectiveUserId = effectiveUser.id;
          req.user.effectiveIsAdmin = effectiveUser.isAdmin;
          req.user.isImpersonating = true;
        } else {
          // No impersonation, use original user
          req.user.effectiveUser = originalUser;
          req.user.effectiveUserId = originalUserId;
          req.user.effectiveIsAdmin = originalUser.isAdmin;
          req.user.isImpersonating = false;
        }
      } else if (originalUser) {
        // Non-admin user, no impersonation possible
        req.user.effectiveUser = originalUser;
        req.user.effectiveUserId = originalUserId;
        req.user.effectiveIsAdmin = originalUser.isAdmin;
        req.user.isImpersonating = false;
      }
    }
    next();
  } catch (error) {
    console.error("Error resolving effective user:", error instanceof Error ? error.message : error);
    next();
  }
};

// Helper function to check admin role (must be real admin, not impersonated)
export const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const originalUserId = req.user!.id;
    const originalUser = await storage.getUser(originalUserId);
    if (!originalUser || !originalUser.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: "Authorization error" });
  }
};

// Helper function to check super admin role (must be real super admin, not impersonated)
export const requireSuperAdmin = async (req: any, res: any, next: any) => {
  try {
    const originalUserId = req.user!.id;
    const originalUser = await storage.getUser(originalUserId);
    if (!originalUser || !originalUser.superAdmin) {
      return res.status(403).json({ message: "Super Admin access required" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: "Authorization error" });
  }
};

// Helper function to check manager+ role (uses effective user for proper testing)
export const requireManager = async (req: any, res: any, next: any) => {
  try {
    const effectiveUser = req.user!.effectiveUser;
    if (!effectiveUser || (!effectiveUser.isAdmin && !effectiveUser.canSeeAdminMenu)) {
      return res.status(403).json({ message: "Manager access required" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: "Authorization error" });
  }
};

// Helper function to verify user has access to a client
export const userHasClientAccess = async (userId: string, clientId: string): Promise<boolean> => {
  try {
    const user = await storage.getUser(userId);
    if (!user) return false;

    // Admins have access to all clients
    if (user.isAdmin) return true;

    // Check if user has any role assignments for this client's services
    const clientServices = await storage.getAllClientServices();
    const clientServicesForClient = clientServices.filter((cs: any) => cs.clientId === clientId);
    const clientServiceIds = clientServicesForClient.map((cs: any) => cs.id);

    if (clientServiceIds.length === 0) return false;

    // Check if user is assigned to any of these services
    for (const serviceId of clientServiceIds) {
      const assignments = await storage.getClientServiceRoleAssignments(serviceId);
      if (assignments.some((a: any) => a.userId === userId)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking client access:", error);
    return false;
  }
};
