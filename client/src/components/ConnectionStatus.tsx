import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useServerConnection } from '@/hooks/useServerConnection';

/**
 * Connection status indicator that shows when server is unreachable
 * and when it's reconnecting after a restart.
 */
export function ConnectionStatus() {
  const { status, isOnline, isOffline, isReconnecting } = useServerConnection();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (isOnline && status === 'online') {
      // Show "reconnected" message briefly after coming back online
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, status]);

  // Don't show anything if connection is stable
  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-bottom-4">
      {isOffline && (
        <div className="flex items-center gap-2 px-4 py-3 bg-destructive text-destructive-foreground rounded-lg shadow-lg">
          <WifiOff className="h-5 w-5" />
          <div>
            <p className="font-medium text-sm">Connection Lost</p>
            <p className="text-xs opacity-90">Unable to reach server</p>
          </div>
        </div>
      )}

      {isReconnecting && (
        <div className="flex items-center gap-2 px-4 py-3 bg-yellow-500 text-white rounded-lg shadow-lg">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
          <div>
            <p className="font-medium text-sm">Reconnecting...</p>
            <p className="text-xs opacity-90">Trying to reach server</p>
          </div>
        </div>
      )}

      {showReconnected && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg shadow-lg">
          <Wifi className="h-5 w-5" />
          <div>
            <p className="font-medium text-sm">Connected</p>
            <p className="text-xs opacity-90">Server is back online</p>
          </div>
        </div>
      )}
    </div>
  );
}
