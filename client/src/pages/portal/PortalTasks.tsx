import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, Clock, FileText, CheckCircle, Eye } from 'lucide-react';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import PortalBottomNav from '@/components/portal-bottom-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { portalRequest } from '@/lib/portalApi';

interface TaskInstance {
  id: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'cancelled';
  createdAt: string;
  submittedAt?: string;
  dueDate?: string;
  template?: {
    id: string;
    name: string;
    description?: string;
  };
  customRequest?: {
    id: string;
    name: string;
    description?: string;
  };
  client: {
    id: string;
    name: string;
  };
}

export default function PortalTasks() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = usePortalAuth();
  const [activeTab, setActiveTab] = useState<string>('pending');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/portal/login');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Fetch task instances for the logged-in portal user
  const { data: taskInstances, isLoading, error } = useQuery<TaskInstance[]>({
    queryKey: ['/api/portal/task-instances'],
    queryFn: () => portalRequest('GET', '/api/portal/task-instances'),
    enabled: isAuthenticated && !!user,
    retry: 2,
  });

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'not_started':
        return <Badge variant="outline" data-testid={`badge-status-not-started`}>Not Started</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500 text-white hover:bg-yellow-600" data-testid={`badge-status-in-progress`}>In Progress</Badge>;
      case 'submitted':
        return <Badge variant="default" data-testid={`badge-status-submitted`}>Submitted</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-600" data-testid={`badge-status-approved`}>Approved</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" data-testid={`badge-status-cancelled`}>Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_started':
        return <FileText className="h-5 w-5 text-gray-400" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'submitted':
        return <CheckSquare className="h-5 w-5 text-green-500" />;
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'cancelled':
        return <FileText className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Filter tasks by status
  const filteredTasks = taskInstances?.filter(task => {
    if (activeTab === 'pending') return task.status === 'not_started' || task.status === 'in_progress';
    if (activeTab === 'completed') return task.status === 'submitted' || task.status === 'approved';
    return task.status === activeTab;
  }) || [];

  const pendingCount = taskInstances?.filter(t => t.status === 'not_started' || t.status === 'in_progress').length || 0;
  const completedCount = taskInstances?.filter(t => t.status === 'submitted' || t.status === 'approved').length || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="text-portal-tasks-title">
            My Requests
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and complete requests from your service provider
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">
              Completed ({completedCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {error ? (
              // Error state
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <div className="bg-red-50 dark:bg-red-950 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-red-500" />
                    </div>
                    <p className="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load requests</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                      {(error as any)?.message || 'An error occurred while fetching your requests'}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.location.reload()}
                      data-testid="button-reload"
                    >
                      Reload Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : isLoading ? (
              // Loading state
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              // Empty state
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">No requests found</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      {activeTab === 'pending'
                        ? 'You have no pending requests.'
                        : 'You have no completed requests.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Task list
              <div className="space-y-4">
                {filteredTasks.map((task) => (
                  <Card 
                    key={task.id} 
                    className="hover:shadow-md transition-shadow"
                    data-testid={`card-task-${task.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getStatusIcon(task.status)}
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-1" data-testid={`text-task-name-${task.id}`}>
                              {task.template?.name || task.customRequest?.name}
                            </CardTitle>
                            {(task.template?.description || task.customRequest?.description) && (
                              <CardDescription data-testid={`text-task-description-${task.id}`}>
                                {task.template?.description || task.customRequest?.description}
                              </CardDescription>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                              <span>From: {task.client.name}</span>
                              <span>•</span>
                              <span>Created: {formatDate(task.createdAt)}</span>
                            </div>
                            {task.submittedAt && (
                              <div className="text-sm text-gray-500 mt-1">
                                Submitted: {formatDate(task.submittedAt)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(task.status)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-end">
                        <Button
                          variant={task.status === 'submitted' || task.status === 'approved' ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => setLocation(`/portal/tasks/${task.id}`)}
                          data-testid={`button-view-task-${task.id}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {task.status === 'submitted' || task.status === 'approved' 
                            ? 'View' 
                            : task.status === 'in_progress' 
                            ? 'Continue' 
                            : 'Start'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <PortalBottomNav />
    </div>
  );
}
