import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { portalRequest } from '@/lib/portalApi';

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
  error: string | null;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: 'default',
    error: null
  });

  const isPortal = window.location.pathname.startsWith('/portal');
  
  // Use the appropriate request function based on context
  const makeRequest = isPortal ? portalRequest : apiRequest;

  useEffect(() => {
    checkPushSupport();
  }, []);

  const checkPushSupport = async () => {
    try {
      const isSupported = 
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      if (!isSupported) {
        setState(prev => ({
          ...prev,
          isSupported: false,
          isLoading: false,
          error: 'Push notifications are not supported in this browser'
        }));
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const permission = Notification.permission;

      setState(prev => ({
        ...prev,
        isSupported: true,
        isSubscribed: subscription !== null,
        permission,
        isLoading: false
      }));
    } catch (error) {
      console.error('Error checking push support:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to check push notification support'
      }));
    }
  };

  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        setState(prev => ({
          ...prev,
          permission,
          isLoading: false,
          error: 'Notification permission denied'
        }));
        return false;
      }

      const response = await fetch('/api/push/vapid-public-key');
      const { publicKey } = await response.json();

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const subscriptionJSON = subscription.toJSON();
      const subscribeEndpoint = isPortal ? '/api/portal/push/subscribe' : '/api/push/subscribe';
      await makeRequest('POST', subscribeEndpoint, {
        endpoint: subscription.endpoint,
        keys: subscriptionJSON.keys,
        userAgent: navigator.userAgent
      });

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        permission: 'granted',
        isLoading: false
      }));

      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to subscribe to push notifications'
      }));
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const unsubscribeEndpoint = isPortal ? '/api/portal/push/unsubscribe' : '/api/push/unsubscribe';
        await makeRequest('DELETE', unsubscribeEndpoint, {
          endpoint: subscription.endpoint
        });
        await subscription.unsubscribe();
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false
      }));

      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to unsubscribe from push notifications'
      }));
      return false;
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    refresh: checkPushSupport
  };
}
