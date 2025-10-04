import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, User, Building } from 'lucide-react';
import { portalApi } from '@/lib/portalApi';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import PortalBottomNav from '@/components/portal-bottom-nav';
import { usePortalManifest } from '@/hooks/usePortalManifest';

interface Message {
  id: string;
  threadId: string;
  content: string;
  userId: string | null;
  clientPortalUserId: string | null;
  isReadByStaff: boolean;
  isReadByClient: boolean;
  createdAt: string;
}

interface MessageThread {
  id: string;
  topic: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  clientId: string;
  lastMessageAt: string | null;
  createdAt: string;
}

const statusConfig = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
};

export default function PortalThreadDetail() {
  usePortalManifest();
  const params = useParams();
  const threadId = params.id as string;
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = usePortalAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const { data: thread } = useQuery<MessageThread>({
    queryKey: ['/api/portal/threads', threadId],
    queryFn: () => portalApi.threads.get(threadId),
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/portal/threads', threadId, 'messages'],
    queryFn: () => portalApi.messages.list(threadId),
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => portalApi.messages.send(threadId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portal/threads', threadId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portal/threads'] });
      setNewMessage('');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: () => portalApi.threads.markRead(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portal/unread-count'] });
    },
  });

  useEffect(() => {
    if (messages && messages.length > 0) {
      const hasUnread = messages.some(m => m.userId && !m.isReadByClient);
      if (hasUnread) {
        markReadMutation.mutate();
      }
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage.trim());
  };

  if (!thread) {
    return null;
  }

  const config = statusConfig[thread.status];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col pb-20">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/portal/threads')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {thread.topic}
              </h1>
            </div>
          </div>
          <div className="ml-12">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          {messagesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={i % 2 === 0 ? 'flex justify-end' : ''}>
                <div className="max-w-[80%]">
                  <Skeleton className="h-20 w-64" />
                </div>
              </div>
            ))
          ) : messages && messages.length > 0 ? (
            messages.map((message: Message) => {
              const isFromClient = !!message.clientPortalUserId;
              const isFromMe = message.clientPortalUserId === user?.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${message.id}`}
                >
                  <Card className={`max-w-[80%] ${isFromMe ? 'bg-blue-600 text-white' : ''}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <div className={`p-1.5 rounded-full ${isFromClient ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
                          {isFromClient ? (
                            <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Building className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                          )}
                        </div>
                        <span className={`text-xs font-medium ${isFromMe ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'}`}>
                          {isFromClient ? 'You' : 'Staff'}
                        </span>
                      </div>
                      <p className={`text-sm ${isFromMe ? 'text-white' : 'text-gray-900 dark:text-white'} whitespace-pre-wrap break-words`}>
                        {message.content}
                      </p>
                      <p className={`text-xs mt-2 ${isFromMe ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No messages yet. Start the conversation!
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Textarea
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              disabled={sendMessageMutation.isPending}
              data-testid="input-message"
              className="min-h-[60px] resize-none"
              rows={2}
            />
            <Button
              type="submit"
              size="icon"
              disabled={sendMessageMutation.isPending || !newMessage.trim()}
              data-testid="button-send-message"
              className="h-[60px] w-[60px]"
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
      <PortalBottomNav />
    </div>
  );
}
