import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import {
  pushSubscriptions,
  pushNotificationTemplates,
  notificationIcons,
  type PushSubscription,
  type InsertPushSubscription,
  type PushNotificationTemplate,
  type InsertPushNotificationTemplate,
  type NotificationIcon,
  type InsertNotificationIcon,
} from "@shared/schema";

export class PushNotificationStorage {
  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const [newSubscription] = await db
      .insert(pushSubscriptions)
      .values(subscription)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: subscription.userId || null,
          clientPortalUserId: subscription.clientPortalUserId || null,
          keys: subscription.keys,
          userAgent: subscription.userAgent,
          updatedAt: new Date(),
        }
      })
      .returning();
    return newSubscription;
  }

  async getPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }

  async getPushSubscriptionsByClientPortalUserId(clientPortalUserId: string): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.clientPortalUserId, clientPortalUserId));
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async deletePushSubscriptionsByUserId(userId: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async getAllPushNotificationTemplates(): Promise<PushNotificationTemplate[]> {
    return await db
      .select()
      .from(pushNotificationTemplates)
      .orderBy(pushNotificationTemplates.templateType);
  }

  async getPushNotificationTemplateByType(templateType: string): Promise<PushNotificationTemplate | undefined> {
    const results = await db
      .select()
      .from(pushNotificationTemplates)
      .where(
        and(
          eq(pushNotificationTemplates.templateType, templateType),
          eq(pushNotificationTemplates.isActive, true)
        )
      );
    
    if (results.length === 0) return undefined;
    
    const randomIndex = Math.floor(Math.random() * results.length);
    return results[randomIndex];
  }

  async updatePushNotificationTemplate(id: string, template: Partial<InsertPushNotificationTemplate>): Promise<PushNotificationTemplate> {
    const [updated] = await db
      .update(pushNotificationTemplates)
      .set({
        ...template,
        updatedAt: new Date(),
      })
      .where(eq(pushNotificationTemplates.id, id))
      .returning();
    return updated;
  }

  async createPushNotificationTemplate(template: InsertPushNotificationTemplate): Promise<PushNotificationTemplate> {
    const [newTemplate] = await db
      .insert(pushNotificationTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async deletePushNotificationTemplate(id: string): Promise<void> {
    await db.delete(pushNotificationTemplates).where(eq(pushNotificationTemplates.id, id));
  }

  async getAllNotificationIcons(): Promise<NotificationIcon[]> {
    return await db
      .select()
      .from(notificationIcons)
      .orderBy(notificationIcons.createdAt);
  }

  async getNotificationIconById(id: string): Promise<NotificationIcon | undefined> {
    const result = await db
      .select()
      .from(notificationIcons)
      .where(eq(notificationIcons.id, id))
      .limit(1);
    return result[0];
  }

  async createNotificationIcon(icon: InsertNotificationIcon): Promise<NotificationIcon> {
    const [newIcon] = await db
      .insert(notificationIcons)
      .values(icon)
      .returning();
    return newIcon;
  }

  async deleteNotificationIcon(id: string): Promise<void> {
    await db.delete(notificationIcons).where(eq(notificationIcons.id, id));
  }
}
