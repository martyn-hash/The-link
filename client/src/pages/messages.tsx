import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import TopNavigation from '@/components/top-navigation';
import BottomNav from '@/components/bottom-nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  User,
  Building2,
  AlertCircle
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

interface MessageThread {
  id: string;
  clientPortalUserId: string;
  topic: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
  clientPortalUser?: {
    id: string;
    email: string;
    clientId: string;
    client?: {
      id: string;
      name: string;
    };
  };
  _count?: {
    messages: number;
  };
}

interface Message {
  id: string;
  threadId: string;
  userId: string | null;
  clientPortalUserId: string | null;
  content: string;
  isRead: boolean;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  clientPortalUser?: {
    id: string;
    email: string;
  };
}

const statusConfig = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: MessageCircle },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', icon: XCircle },
};

export default function Messages() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: threads, isLoading: threadsLoading } = useQuery<MessageThread[]>({
    queryKey: ['/api/internal/messages/threads', statusFilter ? { status: statusFilter } : {}],
    enabled: isAuthenticated && !!user,
    refetchInterval: 5000,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/internal/messages/threads', selectedThreadId, 'messages'],
    enabled: !!selectedThreadId && isAuthenticated,
    refetchInterval: 3000,
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ['/api/internal/messages/unread-count'],
    enabled: isAuthenticated && !!user,
    refetchInterval: 5000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ threadId, status }: { threadId: string; status: string }) =>
      apiRequest('PATCH', `/api/internal/messages/threads/${threadId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/messages/threads'] });
      toast({
        title: "Success",
        description: "Thread status updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update thread status",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest('POST', `/api/internal/messages/threads/${selectedThreadId}/messages`, { content }),
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/internal/messages/threads', selectedThreadId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/internal/messages/threads'] });
      toast({
        title: "Success",
        description: "Message sent",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const selectedThread = threads?.find(t => t.id === selectedThreadId);

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation user={user} />

      <main className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">
              Client Messages
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage conversations with your clients
            </p>
          </div>
          {unreadCount && unreadCount.count > 0 && (
            <Badge variant="destructive" className="text-lg px-3 py-1" data-testid="badge-unread-count">
              {unreadCount.count} unread
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Thread List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Conversations</CardTitle>
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="open" data-testid="filter-open">Open</TabsTrigger>
                  <TabsTrigger value="resolved" data-testid="filter-resolved">Resolved</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                {threadsLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : threads && threads.length > 0 ? (
                  <div className="divide-y">
                    {threads.map((thread) => {
                      const StatusIcon = statusConfig[thread.status].icon;
                      return (
                        <button
                          key={thread.id}
                          onClick={() => setSelectedThreadId(thread.id)}
                          className={`w-full text-left p-4 hover:bg-accent transition-colors ${
                            selectedThreadId === thread.id ? 'bg-accent' : ''
                          }`}
                          data-testid={`thread-${thread.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>
                                <Building2 className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <h3 className="font-semibold truncate" data-testid={`thread-topic-${thread.id}`}>
                                  {thread.topic}
                                </h3>
                                <Badge className={statusConfig[thread.status].color} data-testid={`thread-status-${thread.id}`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusConfig[thread.status].label}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate" data-testid={`thread-client-${thread.id}`}>
                                {thread.clientPortalUser?.client?.name || thread.clientPortalUser?.email}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No {statusFilter} conversations</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Message View */}
          <Card className="lg:col-span-2">
            {selectedThread ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle data-testid="text-selected-thread-topic">{selectedThread.topic}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1" data-testid="text-selected-thread-client">
                        {selectedThread.clientPortalUser?.client?.name || selectedThread.clientPortalUser?.email}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {selectedThread.status === 'open' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ threadId: selectedThread.id, status: 'in_progress' })}
                          disabled={updateStatusMutation.isPending}
                          data-testid="button-mark-in-progress"
                        >
                          Mark In Progress
                        </Button>
                      )}
                      {selectedThread.status === 'in_progress' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ threadId: selectedThread.id, status: 'resolved' })}
                          disabled={updateStatusMutation.isPending}
                          data-testid="button-mark-resolved"
                        >
                          Mark Resolved
                        </Button>
                      )}
                      {selectedThread.status === 'resolved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ threadId: selectedThread.id, status: 'open' })}
                          disabled={updateStatusMutation.isPending}
                          data-testid="button-reopen"
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="h-[400px] overflow-y-auto p-4 space-y-4" data-testid="messages-container">
                    {messagesLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))
                    ) : messages && messages.length > 0 ? (
                      messages.map((message) => {
                        const isStaff = !!message.userId;
                        return (
                          <div
                            key={message.id}
                            className={`flex gap-3 ${isStaff ? 'flex-row-reverse' : ''}`}
                            data-testid={`message-${message.id}`}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {isStaff ? (
                                  <User className="h-4 w-4" />
                                ) : (
                                  <Building2 className="h-4 w-4" />
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`flex-1 ${isStaff ? 'text-right' : ''}`}>
                              <div className="text-xs text-muted-foreground mb-1">
                                {isStaff
                                  ? `${message.user?.firstName || ''} ${message.user?.lastName || ''}`.trim() || message.user?.email
                                  : message.clientPortalUser?.email}
                                {' • '}
                                {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                              </div>
                              <div
                                className={`inline-block p-3 rounded-lg ${
                                  isStaff
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                                data-testid={`message-content-${message.id}`}
                              >
                                {message.content}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No messages yet</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t p-4">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="flex-1"
                        rows={3}
                        data-testid="input-message"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
                        data-testid="button-send-message"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-[500px]">
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select a conversation to view messages</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </main>

      <BottomNav onSearchClick={() => {}} />
    </div>
  );
}
