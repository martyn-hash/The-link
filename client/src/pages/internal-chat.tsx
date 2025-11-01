import { useState, useEffect, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MessageCircle,
  Send,
  User,
  Building2,
  Archive,
  ArchiveRestore,
  Paperclip,
  X,
  File,
  Mic,
  Square,
  Trash2,
  FileAudio,
  Image as ImageIcon,
  RefreshCw,
  ExternalLink,
  Users,
  FolderKanban
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { AttachmentList, FileUploadZone, VoiceNotePlayer } from '@/components/attachments';

interface ProjectMessageThread {
  id: string;
  projectId: string;
  topic: string;
  status: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  project: {
    id: string;
    description: string;
    clientId: string;
  };
  client: {
    id: string;
    name: string;
  };
  unreadCount: number;
  lastMessage: {
    content: string;
    createdAt: string;
    userId: string | null;
  } | null;
  participants: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
}

interface ProjectMessage {
  id: string;
  threadId: string;
  userId: string | null;
  content: string;
  attachments?: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
    objectPath: string;
  }> | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export default function InternalChat() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [archiveFilter, setArchiveFilter] = useState<'open' | 'archived'>('open');
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [threadSearchTerm, setThreadSearchTerm] = useState('');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Fetch all threads the user participates in
  const { data: allThreads, isLoading: threadsLoading } = useQuery<ProjectMessageThread[]>({
    queryKey: ['/api/project-messages/my-threads', { includeArchived: archiveFilter === 'archived' }],
    queryFn: async () => {
      const response = await fetch(`/api/project-messages/my-threads?includeArchived=${archiveFilter === 'archived'}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch threads');
      return response.json();
    },
    enabled: isAuthenticated && !!user,
    refetchInterval: 30000,
  });

  // Fetch messages for selected thread
  const { data: messages, isLoading: messagesLoading } = useQuery<ProjectMessage[]>({
    queryKey: ['/api/internal/project-messages/threads', selectedThreadId, 'messages'],
    queryFn: async () => {
      const response = await fetch(`/api/internal/project-messages/threads/${selectedThreadId}/messages`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!selectedThreadId && isAuthenticated,
    refetchInterval: 10000,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when thread is selected
  useEffect(() => {
    if (selectedThreadId) {
      const lastMessage = messages?.[messages.length - 1];
      if (lastMessage) {
        markAsReadMutation.mutate({ threadId: selectedThreadId, messageId: lastMessage.id });
      }
    }
  }, [selectedThreadId, messages]);

  const markAsReadMutation = useMutation({
    mutationFn: async ({ threadId, messageId }: { threadId: string; messageId: string }) => {
      await apiRequest('POST', `/api/internal/project-messages/threads/${threadId}/mark-read`, { lastReadMessageId: messageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: { content: string; attachments?: any[] }) =>
      apiRequest('POST', `/api/internal/project-messages/threads/${selectedThreadId}/messages`, data),
    onSuccess: () => {
      setNewMessage('');
      setSelectedFiles([]);
      setRecordedAudio(null);
      setAudioUrl(null);
      queryClient.invalidateQueries({ queryKey: ['/api/internal/project-messages/threads', selectedThreadId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const archiveThreadMutation = useMutation({
    mutationFn: (threadId: string) =>
      apiRequest('PUT', `/api/internal/project-messages/threads/${threadId}/archive`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
      toast({
        title: "Success",
        description: "Thread archived",
      });
      setSelectedThreadId(null);
    },
  });

  const unarchiveThreadMutation = useMutation({
    mutationFn: (threadId: string) =>
      apiRequest('PUT', `/api/internal/project-messages/threads/${threadId}/unarchive`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
      toast({
        title: "Success",
        description: "Thread unarchived",
      });
    },
  });

  const handleSendMessage = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0 && !recordedAudio) return;

    let attachments: any[] = [];

    if (selectedFiles.length > 0) {
      setUploadingFiles(true);
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file));

      try {
        const response = await fetch('/api/upload/attachments', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!response.ok) throw new Error('Failed to upload files');
        attachments = await response.json();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to upload files",
          variant: "destructive",
        });
        setUploadingFiles(false);
        return;
      }
      setUploadingFiles(false);
    }

    if (recordedAudio) {
      setUploadingFiles(true);
      const formData = new FormData();
      formData.append('files', recordedAudio, 'voice-note.webm');

      try {
        const response = await fetch('/api/upload/attachments', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!response.ok) throw new Error('Failed to upload voice note');
        const uploadedFiles = await response.json();
        attachments = [...attachments, ...uploadedFiles];
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to upload voice note",
          variant: "destructive",
        });
        setUploadingFiles(false);
        return;
      }
      setUploadingFiles(false);
    }

    sendMessageMutation.mutate({
      content: newMessage,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        if (!isCancelledRef.current) {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          setRecordedAudio(blob);
          setAudioUrl(URL.createObjectURL(blob));
        }
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      isCancelledRef.current = false;

      const interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setRecordingInterval(interval);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingInterval) clearInterval(recordingInterval);
    }
  };

  const cancelRecording = () => {
    isCancelledRef.current = true;
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingInterval) clearInterval(recordingInterval);
      setRecordingTime(0);
      setRecordedAudio(null);
      setAudioUrl(null);
    }
  };

  const deleteRecording = () => {
    setRecordedAudio(null);
    setAudioUrl(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  };

  const selectedThread = allThreads?.find(t => t.id === selectedThreadId);

  const filteredThreads = allThreads?.filter(thread => {
    if (threadSearchTerm) {
      const searchLower = threadSearchTerm.toLowerCase();
      return thread.topic.toLowerCase().includes(searchLower) ||
             thread.project.description.toLowerCase().includes(searchLower) ||
             thread.client.name.toLowerCase().includes(searchLower);
    }
    return true;
  });

  const getUserDisplayName = (user: { firstName: string | null; lastName: string | null; email: string }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email;
  };

  const getUserInitials = (user: { firstName: string | null; lastName: string | null; email: string }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
        <BottomNav user={user} onSearchClick={() => {}} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation user={user} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-200px)]">
          {/* Thread List */}
          <Card className="w-full md:w-1/3 flex flex-col" data-testid="thread-list-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2" data-testid="page-title">
                  <Users className="w-5 h-5" />
                  Internal Chat
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] })}
                  data-testid="button-refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-3 mt-4">
                <Input
                  placeholder="Search threads..."
                  value={threadSearchTerm}
                  onChange={(e) => setThreadSearchTerm(e.target.value)}
                  data-testid="input-search-threads"
                />
                <div className="flex gap-2">
                  <Button
                    variant={archiveFilter === 'open' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setArchiveFilter('open')}
                    data-testid="button-filter-open"
                  >
                    Active
                  </Button>
                  <Button
                    variant={archiveFilter === 'archived' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setArchiveFilter('archived')}
                    data-testid="button-filter-archived"
                  >
                    Archived
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {threadsLoading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredThreads && filteredThreads.length > 0 ? (
                <div className="divide-y divide-border">
                  {filteredThreads.map((thread) => (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`w-full text-left p-2 hover:bg-muted/50 transition-colors ${
                        selectedThreadId === thread.id ? 'bg-muted' : ''
                      }`}
                      data-testid={`thread-item-${thread.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <FolderKanban className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm text-muted-foreground truncate" data-testid={`text-project-${thread.id}`}>
                              {thread.project.description}
                            </span>
                          </div>
                          <p className="font-semibold text-sm mt-0.5 truncate" data-testid={`text-topic-${thread.id}`}>
                            {thread.topic}
                          </p>
                          {thread.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {thread.lastMessage.content}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                          </span>
                          {thread.unreadCount > 0 && (
                            <div className="w-2 h-2 rounded-full bg-primary" data-testid={`dot-unread-${thread.id}`} />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No threads found</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message View */}
          <Card className="flex-1 flex flex-col" data-testid="message-view-card">
            {selectedThreadId && selectedThread ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground" data-testid="text-selected-company">
                          {selectedThread.client.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <FolderKanban className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground" data-testid="text-selected-project">
                          {selectedThread.project.description}
                        </span>
                      </div>
                      <CardTitle className="text-lg" data-testid="text-selected-topic">{selectedThread.topic}</CardTitle>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span data-testid="text-participants">
                          {selectedThread.participants.map(p => getUserDisplayName(p)).join(', ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/projects/${selectedThread.project.id}`)}
                        data-testid="button-view-project"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View Project
                      </Button>
                      {selectedThread.isArchived ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unarchiveThreadMutation.mutate(selectedThread.id)}
                          data-testid="button-unarchive"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => archiveThreadMutation.mutate(selectedThread.id)}
                          data-testid="button-archive"
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messagesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : messages && messages.length > 0 ? (
                    <>
                      {messages.map((message) => {
                        const isCurrentUser = message.userId === user?.id;
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                            data-testid={`message-${message.id}`}
                          >
                            <div className={`max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                {!isCurrentUser && message.user && (
                                  <>
                                    <Avatar className="w-6 h-6">
                                      <AvatarFallback className="text-xs">
                                        {getUserInitials(message.user)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-muted-foreground">
                                      {getUserDisplayName(message.user)}
                                    </span>
                                  </>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                              <div
                                className={`rounded-lg p-3 ${
                                  isCurrentUser
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="mt-2">
                                    <AttachmentList
                                      attachments={message.attachments}
                                      readonly={true}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No messages yet</p>
                    </div>
                  )}
                </CardContent>

                <div className="border-t p-4">
                  {recordedAudio && audioUrl && (
                    <div className="mb-3 flex items-center gap-2 p-2 bg-muted rounded">
                      <FileAudio className="w-4 h-4" />
                      <VoiceNotePlayer audioUrl={audioUrl} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={deleteRecording}
                        data-testid="button-delete-recording"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {selectedFiles.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 bg-muted rounded px-3 py-2">
                          <File className="w-4 h-4" />
                          <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {isRecording && (
                    <div className="mb-3 flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950 rounded">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">Recording: {formatTime(recordingTime)}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={stopRecording}
                        data-testid="button-stop-recording"
                      >
                        <Square className="w-4 h-4 mr-1" />
                        Stop
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelRecording}
                        data-testid="button-cancel-recording"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {!isRecording && !recordedAudio && selectedFiles.length < 5 && (
                    <div className="mb-3">
                      <FileUploadZone
                        onFilesSelected={(files) => setSelectedFiles([...selectedFiles, ...files])}
                        maxFiles={5 - selectedFiles.length}
                        maxSize={25 * 1024 * 1024}
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => isRecording ? stopRecording() : startRecording()}
                      disabled={uploadingFiles || !!recordedAudio}
                      data-testid="button-record-voice"
                    >
                      <Mic className="w-4 h-4" />
                    </Button>

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
                      className="flex-1 min-h-[80px] resize-none"
                      disabled={uploadingFiles}
                      data-testid="input-message"
                    />

                    <Button
                      onClick={handleSendMessage}
                      disabled={(!newMessage.trim() && selectedFiles.length === 0 && !recordedAudio) || uploadingFiles || sendMessageMutation.isPending}
                      data-testid="button-send"
                    >
                      {uploadingFiles || sendMessageMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a thread to view messages</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
      <BottomNav user={user} onSearchClick={() => {}} />
    </div>
  );
}
