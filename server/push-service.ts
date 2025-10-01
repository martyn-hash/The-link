import webpush from 'web-push';

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
  console.warn('VAPID keys not configured. Push notifications will not work.');
} else {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  data?: Record<string, any>;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushNotificationPayload
): Promise<void> {
  try {
    console.log('[Push Service] Sending notification:', {
      endpoint: subscription.endpoint.substring(0, 50) + '...',
      title: payload.title,
      hasKeys: !!subscription.keys
    });
    
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    
    console.log('[Push Service] Notification sent successfully');
  } catch (error: any) {
    console.error('[Push Service] Failed to send notification:', {
      error: error.message,
      statusCode: error.statusCode,
      endpoint: subscription.endpoint.substring(0, 50) + '...',
    });
    
    if (error.statusCode === 410 || error.statusCode === 404) {
      throw new Error('SUBSCRIPTION_EXPIRED');
    }
    throw error;
  }
}

export async function sendPushNotificationToMultiple(
  subscriptions: PushSubscriptionData[],
  payload: PushNotificationPayload
): Promise<{
  successful: number;
  failed: number;
  expiredSubscriptions: string[];
}> {
  const expiredSubscriptions: string[] = [];
  let successful = 0;
  let failed = 0;

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await sendPushNotification(subscription, payload);
        successful++;
      } catch (error: any) {
        if (error.message === 'SUBSCRIPTION_EXPIRED') {
          expiredSubscriptions.push(subscription.endpoint);
        }
        failed++;
      }
    })
  );

  return {
    successful,
    failed,
    expiredSubscriptions
  };
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}
