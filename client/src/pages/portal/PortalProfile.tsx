import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Mail, LogOut } from 'lucide-react';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import PortalBottomNav from '@/components/portal-bottom-nav';

export default function PortalProfile() {
  const [, setLocation] = useLocation();
  const { user, logout, isAuthenticated, isLoading } = usePortalAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/portal/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    setLocation('/portal/login');
  };

  const getUserInitials = () => {
    const email = user.email || '';
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="text-portal-profile-title">Profile</h1>
          <p className="text-gray-600 dark:text-gray-400">Your account information</p>
        </div>

        <Card data-testid="card-profile-info">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl" data-testid="text-user-email">{user.email}</CardTitle>
                <p className="text-sm text-muted-foreground">Client Portal User</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Mail className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-gray-900 dark:text-white" data-testid="text-user-email-detail">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Client ID</p>
                <p className="text-gray-900 dark:text-white font-mono text-sm" data-testid="text-user-client-id">{user.clientId}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button 
                variant="destructive" 
                className="w-full" 
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <PortalBottomNav />
    </div>
  );
}
