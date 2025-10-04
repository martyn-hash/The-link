import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, Plus, LogOut, Clock, CheckCircle, XCircle } from 'lucide-react';
import { portalApi } from '@/lib/portalApi';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { formatDistanceToNow } from 'date-fns';
import PortalBottomNav from '@/components/portal-bottom-nav';
import PWAInstallPrompt from '@/components/pwa-install-prompt';

interface MessageThread {
  id: string;
  topic: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  clientId: string;
  lastMessageAt: string | null;
  createdAt: string;
}

const statusConfig = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: MessageCircle },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', icon: XCircle },
};

export default function PortalThreadList() {
  const [location, setLocation] = useLocation();
  const { user, logout, isAuthenticated, isLoading } = usePortalAuth();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/portal/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const { data: threads, isLoading: threadsLoading } = useQuery({
    queryKey: ['/api/portal/threads', statusFilter],
    queryFn: () => portalApi.threads.list(statusFilter),
    refetchInterval: 5000,
  });

  const { data: unreadData } = useQuery({
    queryKey: ['/api/portal/unread-count'],
    queryFn: () => portalApi.unreadCount(),
    refetchInterval: 5000,
  });

  const handleLogout = () => {
    logout();
    setLocation('/portal/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={statusFilter === undefined ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(undefined)}
                data-testid="filter-all"
              >
                All
                {unreadData?.count > 0 && (
                  <Badge className="ml-2" variant="destructive">{unreadData.count}</Badge>
                )}
              </Button>
              {Object.entries(statusConfig).map(([status, config]) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  data-testid={`filter-${status}`}
                >
                  {config.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {threadsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : threads && threads.length > 0 ? (
            threads.map((thread: MessageThread) => {
              const config = statusConfig[thread.status];
              const StatusIcon = config.icon;
              
              return (
                <Card
                  key={thread.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(`/portal/threads/${thread.id}`)}
                  data-testid={`thread-${thread.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate mb-1">
                          {thread.topic}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <StatusIcon className="h-4 w-4" />
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                            {config.label}
                          </span>
                          {thread.lastMessageAt && (
                            <span className="text-xs">
                              {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-12">
              <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No messages yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Start a conversation with us
              </p>
            </div>
          )}
        </div>

        <div className="fixed bottom-24 right-6">
          <Button
            size="lg"
            className="rounded-full shadow-lg h-14 w-14 p-0"
            onClick={() => setLocation('/portal/threads/new')}
            data-testid="button-new-thread"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>
      <PortalBottomNav />
      <PWAInstallPrompt />
    </div>
  );
}
