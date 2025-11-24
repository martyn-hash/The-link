import { db } from "../../db";
import { eq, desc, and, gte, lte, isNotNull } from "drizzle-orm";
import {
  scheduledNotifications,
  projectTypeNotifications,
  projectTypes,
  clientRequestReminders,
  people,
  type ScheduledNotification,
  type UpdateScheduledNotification,
} from "@shared/schema";

export class ScheduledNotificationStorage {
  async getAllScheduledNotifications(): Promise<ScheduledNotification[]> {
    return await db
      .select()
      .from(scheduledNotifications)
      .orderBy(desc(scheduledNotifications.scheduledFor));
  }

  async getScheduledNotificationById(id: string): Promise<ScheduledNotification | undefined> {
    const [notification] = await db
      .select()
      .from(scheduledNotifications)
      .where(eq(scheduledNotifications.id, id));
    return notification;
  }

  async getScheduledNotificationsForClient(clientId: string, filters?: {
    category?: string;
    type?: string;
    recipientId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  }): Promise<any[]> {
    const result = await db
      .select({
        notification: scheduledNotifications,
        recipient: people,
        projectTypeNotification: projectTypeNotifications,
        projectType: projectTypes,
        clientRequestReminder: clientRequestReminders,
      })
      .from(scheduledNotifications)
      .leftJoin(people, eq(scheduledNotifications.personId, people.id))
      .leftJoin(projectTypeNotifications, eq(scheduledNotifications.projectTypeNotificationId, projectTypeNotifications.id))
      .leftJoin(projectTypes, eq(projectTypeNotifications.projectTypeId, projectTypes.id))
      .leftJoin(clientRequestReminders, eq(scheduledNotifications.clientRequestReminderId, clientRequestReminders.id))
      .where(
        and(
          eq(scheduledNotifications.clientId, clientId),
          filters?.status ? eq(scheduledNotifications.status, filters.status as any) : undefined,
          filters?.recipientId ? eq(scheduledNotifications.personId, filters.recipientId) : undefined,
          filters?.dateFrom ? gte(scheduledNotifications.scheduledFor, new Date(filters.dateFrom)) : undefined,
          filters?.dateTo ? lte(scheduledNotifications.scheduledFor, new Date(filters.dateTo)) : undefined,
          filters?.category === 'project_notification' ? isNotNull(scheduledNotifications.projectTypeNotificationId) : undefined,
          filters?.category === 'client_request_reminder' ? isNotNull(scheduledNotifications.clientRequestReminderId) : undefined
        )
      )
      .orderBy(filters?.status === 'sent' ? desc(scheduledNotifications.sentAt) : desc(scheduledNotifications.scheduledFor));
    
    return result.map(row => {
      const category = row.notification.projectTypeNotificationId 
        ? 'project_notification' 
        : row.notification.clientRequestReminderId 
        ? 'client_request_reminder' 
        : 'unknown';
      
      let notificationTypeLabel = 'Unknown';
      if (row.projectTypeNotification) {
        const ptn = row.projectTypeNotification as any;
        if (ptn.category === 'stage') {
          notificationTypeLabel = `Stage: ${ptn.stageName || 'Unknown'}`;
        } else {
          const ref = ptn.dateReference;
          const offset = ptn.daysOffset || 0;
          if (offset === 0) {
            notificationTypeLabel = ref === 'start_date' ? 'Service Start Date' : 'Project Due Date';
          } else if (offset > 0) {
            notificationTypeLabel = `${offset} day${offset > 1 ? 's' : ''} after ${ref === 'start_date' ? 'start' : 'due date'}`;
          } else {
            notificationTypeLabel = `${Math.abs(offset)} day${Math.abs(offset) > 1 ? 's' : ''} before ${ref === 'start_date' ? 'start' : 'due date'}`;
          }
        }
      } else if (row.clientRequestReminder) {
        const crr = row.clientRequestReminder as any;
        const interval = crr.intervalDays;
        const sequence = crr.sequenceOrder;
        notificationTypeLabel = `Reminder ${sequence} (${interval} days)`;
      }
      
      return {
        ...row.notification,
        category,
        notificationTypeLabel,
        recipient: row.recipient ? {
          id: row.recipient.id,
          fullName: row.recipient.fullName,
          primaryEmail: row.recipient.primaryEmail,
          primaryPhone: row.recipient.primaryPhone,
        } : null,
        projectType: row.projectType ? {
          id: row.projectType.id,
          name: row.projectType.name,
        } : null,
      };
    });
  }

  async updateScheduledNotification(id: string, notification: UpdateScheduledNotification): Promise<ScheduledNotification> {
    const [updated] = await db
      .update(scheduledNotifications)
      .set(notification)
      .where(eq(scheduledNotifications.id, id))
      .returning();
    return updated;
  }

  async cancelScheduledNotificationsForProject(projectId: string, reason: string): Promise<void> {
    await db
      .update(scheduledNotifications)
      .set({
        status: 'cancelled',
        cancelReason: reason,
        cancelledBy: null,
        cancelledAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(scheduledNotifications.projectId, projectId),
          eq(scheduledNotifications.status, 'scheduled')
        )
      );
  }
}
