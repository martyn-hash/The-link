import type { Express } from "express";
import { storage } from "../storage";
import { z } from "zod";
import {
  insertProjectTypeNotificationSchema,
  updateProjectTypeNotificationSchema,
  insertClientRequestReminderSchema,
  updateClientRequestReminderSchema,
  type ScheduledNotification,
} from "@shared/schema";
import { scheduleProjectNotifications } from "../notification-scheduler";

// Parameter validation schemas
const paramNotificationIdSchema = z.object({
  notificationId: z.string().min(1, "Notification ID is required").uuid("Invalid notification ID format")
});

const paramReminderIdSchema = z.object({
  reminderId: z.string().min(1, "Reminder ID is required").uuid("Invalid reminder ID format")
});

const paramScheduledNotificationIdSchema = z.object({
  scheduledNotificationId: z.string().min(1, "Scheduled notification ID is required").uuid("Invalid scheduled notification ID format")
});

const paramProjectTypeIdSchema = z.object({
  projectTypeId: z.string().min(1, "Project type ID is required").uuid("Invalid project type ID format")
});

// Helper function for parameter validation
const validateParams = <T>(schema: z.ZodSchema<T>, params: any): { success: true; data: T } | { success: false; errors: any[] } => {
  const result = schema.safeParse(params);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error.issues };
};

export function registerNotificationRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  
  // ==================== Project Type Notifications ====================
  
  // Get all notifications for a project type
  app.get("/api/project-types/:projectTypeId/notifications", isAuthenticated, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramProjectTypeIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid project type ID", errors: validation.errors });
      }

      const { projectTypeId } = validation.data;
      const notifications = await storage.getProjectTypeNotificationsByProjectTypeId(projectTypeId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching project type notifications:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Create a new project type notification
  app.post("/api/project-types/:projectTypeId/notifications", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramProjectTypeIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid project type ID", errors: validation.errors });
      }

      const { projectTypeId } = validation.data;
      const notificationData = insertProjectTypeNotificationSchema.parse({
        ...req.body,
        projectTypeId
      });

      // Validate project type exists
      const projectType = await storage.getProjectTypeById(projectTypeId);
      if (!projectType) {
        return res.status(404).json({ message: "Project type not found" });
      }

      // If stage notification, validate stage exists and belongs to project type
      if (notificationData.stageId) {
        const stage = await storage.getStageById(notificationData.stageId);
        if (!stage) {
          return res.status(404).json({ message: "Stage not found" });
        }
        if (stage.projectTypeId !== projectTypeId) {
          return res.status(400).json({ message: "Stage does not belong to this project type" });
        }
      }

      // If linked to client request template, validate it exists
      if (notificationData.clientRequestTemplateId) {
        const template = await storage.getClientRequestTemplateById(notificationData.clientRequestTemplateId);
        if (!template) {
          return res.status(404).json({ message: "Client request template not found" });
        }
        
        // Only email and push notifications can be linked to client request templates
        if (notificationData.notificationType === 'sms') {
          return res.status(400).json({ 
            message: "SMS notifications cannot be linked to client request templates. Only email and push notifications are supported." 
          });
        }
      }

      const notification = await storage.createProjectTypeNotification(notificationData);
      
      // Schedule notifications retroactively for all existing services
      try {
        // Only schedule for project notifications (not stage notifications)
        if (notification.category === 'project') {
          console.log(`[Notifications] Scheduling notifications retroactively for new notification ${notification.id}`);
          
          // Get the service for this project type
          const service = await storage.getServiceByProjectTypeId(projectTypeId);
          if (service) {
            // Get all client services
            const clientServices = await storage.getClientServicesByServiceId(service.id);
            console.log(`[Notifications] Found ${clientServices.length} client service(s) to schedule`);
            
            for (const clientService of clientServices) {
              // Schedule if service has either start date or due date
              if (clientService.nextStartDate || clientService.nextDueDate) {
                await scheduleProjectNotifications({
                  clientServiceId: clientService.id,
                  clientId: clientService.clientId,
                  projectTypeId: projectTypeId,
                  nextStartDate: clientService.nextStartDate,
                  nextDueDate: clientService.nextDueDate || null,
                });
              }
            }
            
            // Note: People services are not yet fully implemented in the notification system
            // and are skipped for now (consistent with main project scheduler)
          }
        }
      } catch (scheduleError) {
        console.error('[Notifications] Error scheduling notifications retroactively:', scheduleError);
        // Don't fail the request if retroactive scheduling fails
      }
      
      res.json(notification);
    } catch (error) {
      console.error("Error creating project type notification:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        return res.status(400).json({
          message: "Validation failed",
          errors: (error as any).issues
        });
      }

      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  // Update a project type notification
  app.patch("/api/notifications/:notificationId", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid notification ID", errors: validation.errors });
      }

      const { notificationId } = validation.data;
      const updateData = updateProjectTypeNotificationSchema.parse(req.body);

      // Verify notification exists
      const existingNotification = await storage.getProjectTypeNotificationById(notificationId);
      if (!existingNotification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // If stage is being updated, validate it exists and belongs to project type
      if (updateData.stageId) {
        const stage = await storage.getStageById(updateData.stageId);
        if (!stage) {
          return res.status(404).json({ message: "Stage not found" });
        }
        if (stage.projectTypeId !== existingNotification.projectTypeId) {
          return res.status(400).json({ message: "Stage does not belong to this project type" });
        }
      }

      // If linked to client request template, validate it exists
      if (updateData.clientRequestTemplateId) {
        const template = await storage.getClientRequestTemplateById(updateData.clientRequestTemplateId);
        if (!template) {
          return res.status(404).json({ message: "Client request template not found" });
        }
        
        // Only email and push notifications can be linked to client request templates
        const notificationType = updateData.notificationType || existingNotification.notificationType;
        if (notificationType === 'sms') {
          return res.status(400).json({ 
            message: "SMS notifications cannot be linked to client request templates. Only email and push notifications are supported." 
          });
        }
      }

      const updated = await storage.updateProjectTypeNotification(notificationId, updateData);
      
      // Schedule notifications retroactively for all existing services
      try {
        // Only schedule for project notifications (not stage notifications)
        if (updated.category === 'project') {
          console.log(`[Notifications] Re-scheduling notifications retroactively for updated notification ${updated.id}`);
          
          // Get the service for this project type
          const service = await storage.getServiceByProjectTypeId(updated.projectTypeId);
          if (service) {
            // Get all client services
            const clientServices = await storage.getClientServicesByServiceId(service.id);
            console.log(`[Notifications] Found ${clientServices.length} client service(s) to re-schedule`);
            
            for (const clientService of clientServices) {
              // Schedule if service has either start date or due date
              if (clientService.nextStartDate || clientService.nextDueDate) {
                await scheduleProjectNotifications({
                  clientServiceId: clientService.id,
                  clientId: clientService.clientId,
                  projectTypeId: updated.projectTypeId,
                  nextStartDate: clientService.nextStartDate,
                  nextDueDate: clientService.nextDueDate || null,
                });
              }
            }
            
            // Note: People services are not yet fully implemented in the notification system
            // and are skipped for now (consistent with main project scheduler)
          }
        }
      } catch (scheduleError) {
        console.error('[Notifications] Error re-scheduling notifications retroactively:', scheduleError);
        // Don't fail the request if retroactive scheduling fails
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating project type notification:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        return res.status(400).json({
          message: "Validation failed",
          errors: (error as any).issues
        });
      }

      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  // Delete a project type notification
  app.delete("/api/notifications/:notificationId", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid notification ID", errors: validation.errors });
      }

      const { notificationId } = validation.data;

      // Verify notification exists
      const notification = await storage.getProjectTypeNotificationById(notificationId);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Delete associated reminders if this is linked to a client request template
      if (notification.clientRequestTemplateId) {
        const reminders = await storage.getClientRequestRemindersByNotificationId(notificationId);
        for (const reminder of reminders) {
          await storage.deleteClientRequestReminder(reminder.id);
        }
      }

      await storage.deleteProjectTypeNotification(notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting project type notification:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // ==================== Client Request Reminders ====================

  // Get all reminders for a project type notification
  app.get("/api/notifications/:notificationId/reminders", isAuthenticated, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid notification ID", errors: validation.errors });
      }

      const { notificationId } = validation.data;
      const reminders = await storage.getClientRequestRemindersByNotificationId(notificationId);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching client request reminders:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch reminders" });
    }
  });

  // Create a new client request reminder
  app.post("/api/notifications/:notificationId/reminders", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid notification ID", errors: validation.errors });
      }

      const { notificationId } = validation.data;
      
      // Verify notification exists and is linked to a client request template
      const notification = await storage.getProjectTypeNotificationById(notificationId);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      if (!notification.clientRequestTemplateId) {
        return res.status(400).json({ 
          message: "Reminders can only be added to notifications linked to client request templates" 
        });
      }

      const reminderData = insertClientRequestReminderSchema.parse({
        ...req.body,
        projectTypeNotificationId: notificationId
      });

      // Only email and push notifications are supported for reminders
      if (reminderData.notificationType === 'sms') {
        return res.status(400).json({ 
          message: "SMS reminders are not supported. Only email and push notifications are supported." 
        });
      }

      const reminder = await storage.createClientRequestReminder(reminderData);
      res.json(reminder);
    } catch (error) {
      console.error("Error creating client request reminder:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        return res.status(400).json({
          message: "Validation failed",
          errors: (error as any).issues
        });
      }

      res.status(500).json({ message: "Failed to create reminder" });
    }
  });

  // Update a client request reminder
  app.patch("/api/reminders/:reminderId", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramReminderIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid reminder ID", errors: validation.errors });
      }

      const { reminderId } = validation.data;
      const updateData = updateClientRequestReminderSchema.parse(req.body);

      // Verify reminder exists
      const existingReminder = await storage.getClientRequestReminderById(reminderId);
      if (!existingReminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }

      // Only email and push notifications are supported for reminders
      if (updateData.notificationType === 'sms') {
        return res.status(400).json({ 
          message: "SMS reminders are not supported. Only email and push notifications are supported." 
        });
      }

      const updated = await storage.updateClientRequestReminder(reminderId, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating client request reminder:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        return res.status(400).json({
          message: "Validation failed",
          errors: (error as any).issues
        });
      }

      res.status(500).json({ message: "Failed to update reminder" });
    }
  });

  // Delete a client request reminder
  app.delete("/api/reminders/:reminderId", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramReminderIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid reminder ID", errors: validation.errors });
      }

      const { reminderId } = validation.data;

      // Verify reminder exists
      const reminder = await storage.getClientRequestReminderById(reminderId);
      if (!reminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }

      await storage.deleteClientRequestReminder(reminderId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting client request reminder:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete reminder" });
    }
  });

  // ==================== Scheduled Notifications ====================

  // Get all scheduled notifications (with filtering)
  app.get("/api/scheduled-notifications", isAuthenticated, async (req: any, res: any) => {
    try {
      const { status, clientId, projectId, startDate, endDate } = req.query;
      
      let notifications = await storage.getAllScheduledNotifications();

      // Apply filters
      if (status) {
        notifications = notifications.filter((n: ScheduledNotification) => n.status === status);
      }
      if (clientId) {
        notifications = notifications.filter((n: ScheduledNotification) => n.clientId === clientId);
      }
      if (projectId) {
        notifications = notifications.filter((n: ScheduledNotification) => n.projectId === projectId);
      }
      if (startDate) {
        const start = new Date(startDate as string);
        notifications = notifications.filter((n: ScheduledNotification) => 
          new Date(n.scheduledFor) >= start
        );
      }
      if (endDate) {
        const end = new Date(endDate as string);
        notifications = notifications.filter((n: ScheduledNotification) => 
          new Date(n.scheduledFor) <= end
        );
      }

      res.json(notifications);
    } catch (error) {
      console.error("Error fetching scheduled notifications:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch scheduled notifications" });
    }
  });

  // Get a specific scheduled notification
  app.get("/api/scheduled-notifications/:scheduledNotificationId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { scheduledNotificationId } = req.params;
      const validation = validateParams(paramScheduledNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid scheduled notification ID", errors: validation.errors });
      }

      const notification = await storage.getScheduledNotificationById(scheduledNotificationId);
      if (!notification) {
        return res.status(404).json({ message: "Scheduled notification not found" });
      }

      res.json(notification);
    } catch (error) {
      console.error("Error fetching scheduled notification:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch scheduled notification" });
    }
  });

  // Cancel a scheduled notification
  app.post("/api/scheduled-notifications/:scheduledNotificationId/cancel", isAuthenticated, requireManager, async (req: any, res: any) => {
    try {
      const { scheduledNotificationId } = req.params;
      const validation = validateParams(paramScheduledNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid scheduled notification ID", errors: validation.errors });
      }

      const notification = await storage.getScheduledNotificationById(scheduledNotificationId);
      if (!notification) {
        return res.status(404).json({ message: "Scheduled notification not found" });
      }

      if (notification.status !== 'scheduled') {
        return res.status(400).json({ message: "Only scheduled notifications can be cancelled" });
      }

      const updated = await storage.updateScheduledNotification(scheduledNotificationId, {
        status: 'cancelled'
      });
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling scheduled notification:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to cancel notification" });
    }
  });

  // Bulk cancel scheduled notifications
  app.post("/api/scheduled-notifications/bulk-cancel", isAuthenticated, requireManager, async (req: any, res: any) => {
    try {
      const schema = z.object({
        notificationIds: z.array(z.string().uuid())
      });
      const { notificationIds } = schema.parse(req.body);

      const results = {
        cancelled: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const id of notificationIds) {
        try {
          const notification = await storage.getScheduledNotificationById(id);
          if (!notification) {
            results.failed++;
            results.errors.push(`Notification ${id} not found`);
            continue;
          }

          if (notification.status !== 'scheduled') {
            results.failed++;
            results.errors.push(`Notification ${id} is not scheduled (status: ${notification.status})`);
            continue;
          }

          await storage.updateScheduledNotification(id, { status: 'cancelled' });
          results.cancelled++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Error cancelling ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error bulk cancelling notifications:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({
          message: "Validation failed",
          errors: (error as any).issues
        });
      }

      res.status(500).json({ message: "Failed to cancel notifications" });
    }
  });

  // Get notification history for a client
  app.get("/api/clients/:clientId/notification-history", isAuthenticated, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      const history = await storage.getNotificationHistoryByClientId(clientId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching notification history:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch notification history" });
    }
  });

  // Get notification history for a project
  app.get("/api/projects/:projectId/notification-history", isAuthenticated, async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const history = await storage.getNotificationHistoryByProjectId(projectId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching notification history:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch notification history" });
    }
  });
}
