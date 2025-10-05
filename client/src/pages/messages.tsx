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
  AlertCircle,
  Archive,
  ArchiveRestore,
  Paperclip,
  X,
  File
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

interface MessageThread {
  id: string;
  clientPortalUserId: string;
  topic: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'archived';
  isArchived: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
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
  attachments?: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
    objectPath: string;
  }> | null;
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
  archived: { label: 'Archived', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: Archive },
};

export default function Messages() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived'>('active');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

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

  const { data: allThreads, isLoading: threadsLoading } = useQuery<MessageThread[]>({
    queryKey: ['/api/internal/messages/threads'],
    enabled: isAuthenticated && !!user,
    refetchInterval: 5000,
  });

  const threads = allThreads?.filter(thread => {
    const isArchived = thread.isArchived === true;
    const matchesArchiveFilter = archiveFilter === 'archived' ? isArchived : !isArchived;
    
    if (!matchesArchiveFilter) return false;
    
    if (archiveFilter === 'active' && statusFilter) {
      return thread.status === statusFilter;
    }
    
    return true;
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
    mutationFn: (data: { content: string; attachments?: any[] }) =>
      apiRequest('POST', `/api/internal/messages/threads/${selectedThreadId}/messages`, data),
    onSuccess: () => {
      setNewMessage('');
      setSelectedFiles([]);
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

  const archiveThreadMutation = useMutation({
    mutationFn: (threadId: string) =>
      apiRequest('PUT', `/api/internal/messages/threads/${threadId}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/messages/threads'] });
      setSelectedThreadId(null);
      toast({
        title: "Success",
        description: "Thread archived",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive thread",
        variant: "destructive",
      });
    },
  });

  const unarchiveThreadMutation = useMutation({
    mutationFn: (threadId: string) =>
      apiRequest('PUT', `/api/internal/messages/threads/${threadId}/unarchive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/messages/threads'] });
      toast({
        title: "Success",
        description: "Thread restored",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unarchive thread",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isValid = file.size <= 10 * 1024 * 1024; // 10MB limit
      if (!isValid) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
          variant: "destructive",
        });
      }
      return isValid;
    });
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (files: File[]) => {
    const uploadedAttachments = [];
    
    for (const file of files) {
      try {
        const uploadUrlResponse = await apiRequest('POST', '/api/internal/messages/attachments/upload-url', {
          fileName: file.name,
          fileType: file.type,
        });
        
        const { url, objectPath } = uploadUrlResponse as any;
        
        await fetch(url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });
        
        uploadedAttachments.push({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          objectPath,
        });
      } catch (error) {
        console.error('Error uploading file:', file.name, error);
        throw new Error(`Failed to upload ${file.name}`);
      }
    }
    
    return uploadedAttachments;
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) return;
    
    try {
      setUploadingFiles(true);
      let attachments: Array<{ fileName: string; fileType: string; fileSize: number; objectPath: string; }> = [];
      
      if (selectedFiles.length > 0) {
        attachments = await uploadFiles(selectedFiles);
      }
      
      sendMessageMutation.mutate({
        content: newMessage || '(Attachment)',
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(false);
    }
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

        {/* Outer Active/Archived Tabs */}
        <Tabs value={archiveFilter} onValueChange={(value: string) => setArchiveFilter(value as 'active' | 'archived')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="active" data-testid="tab-active">
              Active
            </TabsTrigger>
            <TabsTrigger value="archived" data-testid="tab-archived">
              <Archive className="h-4 w-4 mr-2" />
              Archived
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0">
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
                      {!selectedThread.isArchived && (
                        <>
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => archiveThreadMutation.mutate(selectedThread.id)}
                            disabled={archiveThreadMutation.isPending}
                            data-testid="button-archive"
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </Button>
                        </>
                      )}
                      {selectedThread.isArchived && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unarchiveThreadMutation.mutate(selectedThread.id)}
                          disabled={unarchiveThreadMutation.isPending}
                          data-testid="button-unarchive"
                        >
                          <ArchiveRestore className="h-4 w-4 mr-2" />
                          Restore
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
                              <div>
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
                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {message.attachments.map((attachment, idx) => (
                                      <a
                                        key={idx}
                                        href={`/objects${attachment.objectPath}`}
                                        download={attachment.fileName}
                                        className="flex items-center gap-2 p-2 rounded bg-muted hover:bg-muted/80 transition-colors text-sm max-w-xs"
                                        data-testid={`attachment-${message.id}-${idx}`}
                                      >
                                        <File className="h-4 w-4 flex-shrink-0" />
                                        <span className="truncate">{attachment.fileName}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
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
                    {selectedFiles.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md text-sm"
                            data-testid={`selected-file-${index}`}
                          >
                            <File className="h-4 w-4" />
                            <span className="max-w-[200px] truncate">{file.name}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0"
                              onClick={() => removeFile(index)}
                              data-testid={`button-remove-file-${index}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !uploadingFiles) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="flex-1"
                        rows={3}
                        data-testid="input-message"
                      />
                      <div className="flex flex-col gap-2">
                        <label htmlFor="file-upload">
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            data-testid="button-attach-file"
                          >
                            <span className="cursor-pointer">
                              <Paperclip className="h-4 w-4" />
                            </span>
                          </Button>
                        </label>
                        <input
                          id="file-upload"
                          type="file"
                          multiple
                          accept="image/*,.pdf"
                          onChange={handleFileSelect}
                          className="hidden"
                          data-testid="input-file-upload"
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={(!newMessage.trim() && selectedFiles.length === 0) || uploadingFiles || sendMessageMutation.isPending}
                          data-testid="button-send-message"
                        >
                          {uploadingFiles ? (
                            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
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
      </TabsContent>

      <TabsContent value="archived" className="mt-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Archived Thread List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Archived Conversations</CardTitle>
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
                      const StatusIcon = statusConfig[thread.status]?.icon || MessageCircle;
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
                                  {thread.subject || thread.topic}
                                </h3>
                                <Badge variant="secondary" className="text-xs">
                                  <Archive className="h-3 w-3 mr-1" />
                                  Archived
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
                    <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No archived conversations</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Message View for Archived Thread */}
          <Card className="lg:col-span-2">
            {selectedThread ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle data-testid="text-selected-thread-topic">{selectedThread.subject || selectedThread.topic}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1" data-testid="text-selected-thread-client">
                        {selectedThread.clientPortalUser?.client?.name || selectedThread.clientPortalUser?.email}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {selectedThread.isArchived && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unarchiveThreadMutation.mutate(selectedThread.id)}
                          disabled={unarchiveThreadMutation.isPending}
                          data-testid="button-unarchive"
                        >
                          <ArchiveRestore className="h-4 w-4 mr-2" />
                          Restore
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
                              <div>
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
                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {message.attachments.map((attachment, idx) => (
                                      <a
                                        key={idx}
                                        href={`/objects${attachment.objectPath}`}
                                        download={attachment.fileName}
                                        className="flex items-center gap-2 p-2 rounded bg-muted hover:bg-muted/80 transition-colors text-sm max-w-xs"
                                        data-testid={`attachment-${message.id}-${idx}`}
                                      >
                                        <File className="h-4 w-4 flex-shrink-0" />
                                        <span className="truncate">{attachment.fileName}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No messages in this thread</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-[500px]">
                <div className="text-center text-muted-foreground">
                  <Archive className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select an archived conversation to view</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </TabsContent>
    </Tabs>
      </main>

      <BottomNav onSearchClick={() => {}} />
    </div>
  );
}
