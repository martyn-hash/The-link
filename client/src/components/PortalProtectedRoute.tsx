import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { usePortalAuth } from '@/contexts/PortalAuthContext';

export function PortalProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = usePortalAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated && !location.startsWith('/portal/login') && !location.startsWith('/portal/verify')) {
      setLocation('/portal/login');
    }
  }, [isAuthenticated, location, setLocation]);

  if (!isAuthenticated && !location.startsWith('/portal/login') && !location.startsWith('/portal/verify')) {
    return null;
  }

  return <>{children}</>;
}
