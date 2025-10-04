import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, Construction } from 'lucide-react';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import PortalBottomNav from '@/components/portal-bottom-nav';

export default function PortalTasks() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = usePortalAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/portal/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="text-portal-tasks-title">Tasks & Organizers</h1>
          <p className="text-gray-600 dark:text-gray-400">Your tasks and important dates</p>
        </div>

        <Card data-testid="card-coming-soon">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-full">
                <Construction className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Coming Soon</CardTitle>
                <CardDescription>Task management and organizers are being developed</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <CheckSquare className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">Future Features</p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• View and manage your tasks</li>
                  <li>• Track important dates and deadlines</li>
                  <li>• Organize documents and requirements</li>
                  <li>• Receive notifications and reminders</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <PortalBottomNav />
    </div>
  );
}
