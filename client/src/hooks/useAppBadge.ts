import { useEffect } from 'react';

export function useAppBadge(count: number | undefined) {
  useEffect(() => {
    // Check if the Badge API is supported
    if ('setAppBadge' in navigator) {
      if (count && count > 0) {
        (navigator as any).setAppBadge(count).catch((error: Error) => {
          console.error('Failed to set app badge:', error);
        });
      } else {
        (navigator as any).clearAppBadge().catch((error: Error) => {
          console.error('Failed to clear app badge:', error);
        });
      }
    }
  }, [count]);
}
