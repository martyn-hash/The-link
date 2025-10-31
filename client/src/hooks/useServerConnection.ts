import { useEffect, useState, useCallback } from 'react';
import { queryClient } from '@/lib/queryClient';

export type ConnectionStatus = 'online' | 'offline' | 'reconnecting';

interface UseServerConnectionOptions {
  /**
   * How often to check server connection (in milliseconds)
   * Default: 30000 (30 seconds)
   */
  checkInterval?: number;

  /**
   * Endpoint to ping for health check
   * Default: '/api/health'
   */
  healthEndpoint?: string;

  /**
   * Enable connection monitoring
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Hook to monitor server connection status and handle automatic reconnection
 * when server restarts.
 */
export function useServerConnection(options: UseServerConnectionOptions = {}) {
  const {
    checkInterval = 30000, // Check every 30 seconds
    healthEndpoint = '/api/health',
    enabled = true,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [wasOffline, setWasOffline] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!enabled) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(healthEndpoint, {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // Server is online
        if (wasOffline) {
          console.log('[Connection Monitor] Server is back online, refreshing data...');
          setStatus('online');
          setWasOffline(false);

          // Invalidate queries instead of refetching to avoid thundering herd
          // Only refetch queries that are currently being observed (mounted components)
          queryClient.invalidateQueries({ refetchType: 'active' });
        } else if (status !== 'online') {
          setStatus('online');
        }
      } else {
        // Server returned error
        console.warn('[Connection Monitor] Server returned error:', response.status);
        setStatus('offline');
        setWasOffline(true);
      }
    } catch (error) {
      // Server is unreachable
      if (error instanceof Error) {
        console.warn('[Connection Monitor] Server unreachable:', error.message);
      }

      if (status === 'online') {
        setStatus('reconnecting');
      } else {
        setStatus('offline');
      }
      setWasOffline(true);
    }
  }, [enabled, healthEndpoint, status, wasOffline]);

  // Initial connection check
  useEffect(() => {
    if (enabled) {
      checkConnection();
    }
  }, [enabled, checkConnection]);

  // Periodic connection monitoring
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(checkConnection, checkInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, checkInterval, checkConnection]);

  // Monitor browser online/offline events
  useEffect(() => {
    if (!enabled) return;

    const handleOnline = () => {
      console.log('[Connection Monitor] Browser detected online, checking server...');
      checkConnection();
    };

    const handleOffline = () => {
      console.log('[Connection Monitor] Browser detected offline');
      setStatus('offline');
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, checkConnection]);

  // Monitor page visibility - check connection when user returns to tab
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[Connection Monitor] Page visible, checking server...');
        checkConnection();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, checkConnection]);

  return {
    status,
    isOnline: status === 'online',
    isOffline: status === 'offline',
    isReconnecting: status === 'reconnecting',
    checkConnection,
  };
}
