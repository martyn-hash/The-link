import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useSwipeable } from 'react-swipeable';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { isUnauthorizedError } from '@/lib/authUtils';
import TopNavigation from '@/components/top-navigation';
import BottomNav from '@/components/bottom-nav';
import SuperSearch from '@/components/super-search';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  FolderKanban,
  Plus,
  Mail,
  Check,
  Reply,
  Smile,
  Filter
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { AttachmentList, FileUploadZone, VoiceNotePlayer } from '@/components/attachments';
import { EmailThreadViewer } from '@/components/EmailThreadViewer';

interface ProjectMessageThread {
  threadType: 'project';
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

interface StaffMessageThread {
  threadType: 'staff';
  id: string;
  topic: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
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

type MessageThread = ProjectMessageThread | StaffMessageThread;

interface UserType {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface StaffMessage {
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
  user?: UserType;
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

interface EmailThread {
  canonicalConversationId: string;
  subject: string | null;
  participants: string[];
  messageCount: number;
  hasUnread: boolean;
  lastMessageAt: string;
  firstMessageAt: string;
  latestPreview: string | null;
  clientId: string | null;
  clientName: string | null;
}

// Separate component to avoid hooks-in-loop issue
interface ThreadListItemProps {
  thread: MessageThread;
  isActive: boolean;
  isMobile: boolean;
  isSwipedLeft: boolean;
  isSwipedRight: boolean;
  onSwipedLeft: () => void;
  onSwipedRight: () => void;
  onReplyAction: () => void;
  onArchiveAction: () => void;
  onClick: () => void;
}

function ThreadListItem({
  thread,
  isActive,
  isMobile,
  isSwipedLeft,
  isSwipedRight,
  onSwipedLeft,
  onSwipedRight,
  onReplyAction,
  onArchiveAction,
  onClick
}: ThreadListItemProps) {
  // Use ref for immediate updates (state is too slow)
  const isSwipingRef = useRef(false);
  const swipeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Always call hook (React rules of hooks)
  const swipeHandlers = useSwipeable({
    onSwiping: () => {
      isSwipingRef.current = true;
      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current);
      }
    },
    onSwipedLeft: () => {
      onSwipedLeft();
      // Keep swiping flag true briefly to prevent click
      swipeTimeoutRef.current = setTimeout(() => {
        isSwipingRef.current = false;
      }, 300);
    },
    onSwipedRight: () => {
      onSwipedRight();
      // Keep swiping flag true briefly to prevent click
      swipeTimeoutRef.current = setTimeout(() => {
        isSwipingRef.current = false;
      }, 300);
    },
    preventScrollOnSwipe: true,
    trackMouse: false,
    delta: 50,
  });

  const handleClick = (e: React.MouseEvent) => {
    // Don't open thread if currently swiping or just swiped
    if (isSwipingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick();
  };

  return (
    <div
      {...(isMobile ? swipeHandlers : {})}
      className="relative overflow-hidden"
      data-testid={`thread-container-${thread.id}`}
    >
      {/* Swipe action buttons */}
      {isSwipedLeft && (
        <div className="absolute inset-y-0 right-0 flex items-center bg-blue-500 px-4 z-10">
          <Button
            size="sm"
            variant="ghost"
            onClick={onReplyAction}
            className="text-white hover:bg-blue-600"
            data-testid={`button-swipe-reply-${thread.id}`}
          >
            <Reply className="w-5 h-5" />
          </Button>
        </div>
      )}
      {isSwipedRight && (
        <div className="absolute inset-y-0 left-0 flex items-center bg-purple-500 px-4 z-10">
          <Button
            size="sm"
            variant="ghost"
            onClick={onArchiveAction}
            className="text-white hover:bg-purple-600"
            data-testid={`button-swipe-archive-${thread.id}`}
          >
            {thread.isArchived ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
          </Button>
        </div>
      )}

      <button
        onClick={handleClick}
        className={`w-full text-left p-2 hover:bg-muted/50 transition-all ${
          isActive ? 'bg-muted' : ''
        } ${isSwipedLeft ? 'translate-x-[-80px]' : isSwipedRight ? 'translate-x-[80px]' : ''}`}
        data-testid={`thread-item-${thread.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {thread.threadType === 'project' ? (
              <div className="flex items-center gap-2 mb-0.5">
                <FolderKanban className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {thread.project.description}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-0.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {thread.participants.map(p => 
                    [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email
                  ).join(', ')}
                </span>
              </div>
            )}
            <p className="font-semibold text-sm mt-0.5 truncate">
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
    </div>
  );
}

export default function Messages() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [archiveFilter, setArchiveFilter] = useState<'open' | 'archived'>('open');
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [threadSearchTerm, setThreadSearchTerm] = useState('');
  const [showNewThreadDialog, setShowNewThreadDialog] = useState(false);
  const [showMobileThreadView, setShowMobileThreadView] = useState(false);
  const [newThreadTopic, setNewThreadTopic] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedThreadType, setSelectedThreadType] = useState<'project' | 'staff' | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [activeTab, setActiveTab] = useState('internal');
  const [selectedEmailThreadId, setSelectedEmailThreadId] = useState<string | null>(null);
  const [emailThreadViewerOpen, setEmailThreadViewerOpen] = useState(false);
  const [emailFilter, setEmailFilter] = useState<'my' | 'all'>('my');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [readStatusFilter, setReadStatusFilter] = useState<'all' | 'read' | 'unread'>('all');

  // Mobile-specific state
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showMobileFilterMenu, setShowMobileFilterMenu] = useState(false);
  const [swipedThreadId, setSwipedThreadId] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Message interaction state
  const [replyToMessage, setReplyToMessage] = useState<(ProjectMessage | StaffMessage) | null>(null);
  const [longPressedMessageId, setLongPressedMessageId] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMessageContextMenu, setShowMessageContextMenu] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch project message threads (Client Chat)
  const { data: projectThreads, isLoading: projectThreadsLoading } = useQuery<ProjectMessageThread[]>({
    queryKey: ['/api/project-messages/my-threads', { includeArchived: archiveFilter === 'archived' }],
    queryFn: async () => {
      const response = await fetch(`/api/project-messages/my-threads?includeArchived=${archiveFilter === 'archived'}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch project threads');
      return response.json();
    },
    enabled: isAuthenticated && !!user,
    refetchInterval: 30000,
  });

  // Fetch standalone staff message threads (Internal Chat)
  const { data: staffThreads, isLoading: staffThreadsLoading } = useQuery<StaffMessageThread[]>({
    queryKey: ['/api/staff-messages/my-threads', { includeArchived: archiveFilter === 'archived' }],
    queryFn: async () => {
      const response = await fetch(`/api/staff-messages/my-threads?includeArchived=${archiveFilter === 'archived'}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch staff threads');
      return response.json();
    },
    enabled: isAuthenticated && !!user,
    refetchInterval: 30000,
  });

  // Fetch email threads (Client Emails)
  const { data: emailThreadsData, isLoading: emailThreadsLoading } = useQuery<{ threads: EmailThread[] }>({
    queryKey: ['/api/emails/my-threads', { myEmailsOnly: emailFilter === 'my' }],
    queryFn: async () => {
      const myEmailsOnly = emailFilter === 'my';
      const response = await fetch(`/api/emails/my-threads?myEmailsOnly=${myEmailsOnly}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch email threads');
      return response.json();
    },
    enabled: isAuthenticated && !!user,
    refetchInterval: 30000,
  });

  const emailThreads = emailThreadsData?.threads || [];

  // Separate threads by type
  const internalThreads: MessageThread[] = (staffThreads?.map(t => ({ ...t, threadType: 'staff' as const })) || [])
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  const clientThreads: MessageThread[] = (projectThreads?.map(t => ({ ...t, threadType: 'project' as const })) || [])
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  const threadsLoading = projectThreadsLoading || staffThreadsLoading || emailThreadsLoading;

  // Calculate unread counts
  const internalUnreadCount = internalThreads.reduce((sum, thread) => sum + thread.unreadCount, 0);
  const clientUnreadCount = clientThreads.reduce((sum, thread) => sum + thread.unreadCount, 0);
  const emailUnreadCount = emailThreads.filter(thread => thread.hasUnread).length;

  // Fetch all users for participant selection
  const { data: allUsers, isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ['/api/users/for-messaging'],
    queryFn: async () => {
      const response = await fetch('/api/users/for-messaging', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: isAuthenticated && showNewThreadDialog,
  });

  // Fetch messages for selected thread (works for both project and staff threads)
  const { data: messages, isLoading: messagesLoading} = useQuery<(ProjectMessage | StaffMessage)[]>({
    queryKey: [selectedThreadType === 'staff' ? '/api/staff-messages/threads' : '/api/internal/project-messages/threads', selectedThreadId, 'messages'],
    queryFn: async () => {
      const baseUrl = selectedThreadType === 'staff' 
        ? `/api/staff-messages/threads/${selectedThreadId}/messages`
        : `/api/internal/project-messages/threads/${selectedThreadId}/messages`;
      const response = await fetch(baseUrl, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!selectedThreadId && !!selectedThreadType && isAuthenticated,
    refetchInterval: 10000,
  });

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: (data: { content: string; attachments?: any[] }) => {
      const url = selectedThreadType === 'staff'
        ? `/api/staff-messages/threads/${selectedThreadId}/messages`
        : `/api/internal/project-messages/threads/${selectedThreadId}/messages`;
      return apiRequest('POST', url, data);
    },
    onSuccess: () => {
      setNewMessage('');
      setSelectedFiles([]);
      setRecordedAudio(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      queryClient.invalidateQueries({ queryKey: [selectedThreadType === 'staff' ? '/api/staff-messages/threads' : '/api/internal/project-messages/threads', selectedThreadId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
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
    mutationFn: (threadId: string) => {
      const url = selectedThreadType === 'staff'
        ? `/api/staff-messages/threads/${threadId}/archive`
        : `/api/internal/project-messages/threads/${threadId}/archive`;
      return apiRequest('PUT', url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
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
    mutationFn: (threadId: string) => {
      const url = selectedThreadType === 'staff'
        ? `/api/staff-messages/threads/${threadId}/unarchive`
        : `/api/internal/project-messages/threads/${threadId}/unarchive`;
      return apiRequest('PUT', url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
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

  const createStaffThreadMutation = useMutation({
    mutationFn: (data: { topic: string; participantUserIds: string[]; initialMessage?: { content: string; attachments?: any[] } }) =>
      apiRequest('POST', '/api/staff-messages/threads', data),
    onSuccess: (newThread: any) => {
      setShowNewThreadDialog(false);
      setNewThreadTopic('');
      setSelectedParticipants([]);
      setInitialMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
      setSelectedThreadId(newThread.id);
      setSelectedThreadType('staff');
      setActiveTab('internal');
      toast({
        title: "Success",
        description: "Staff thread created",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create thread",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: ({ threadId, threadType, lastMessageId }: { threadId: string; threadType: 'staff' | 'project'; lastMessageId: string }) => {
      const url = threadType === 'staff'
        ? `/api/staff-messages/threads/${threadId}/mark-read`
        : `/api/internal/project-messages/threads/${threadId}/mark-read`;
      return apiRequest('PUT', url, { lastReadMessageId: lastMessageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when viewing a thread
  useEffect(() => {
    if (selectedThreadId && selectedThreadType && messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      markAsReadMutation.mutate({
        threadId: selectedThreadId,
        threadType: selectedThreadType,
        lastMessageId: lastMessage.id,
      });
    }
  }, [selectedThreadId, selectedThreadType, messages]);

  // Reset swipe state when filter menu or search opens
  useEffect(() => {
    if (showMobileFilterMenu || mobileSearchOpen) {
      setSwipedThreadId(null);
      setSwipeDirection(null);
    }
  }, [showMobileFilterMenu, mobileSearchOpen]);

  // Helper functions
  const getUserDisplayName = (user: { firstName: string | null; lastName: string | null; email: string }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email;
  };

  const getUserInitials = (user: { firstName: string | null; lastName: string | null; email: string }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  const uploadFiles = async (files: File[]) => {
    const uploadedAttachments = [];
    for (const file of files) {
      try {
        const uploadUrlResponse = await apiRequest('POST', '/api/internal/messages/attachments/upload-url', {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
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
    if (!newMessage.trim() && selectedFiles.length === 0 && !recordedAudio) return;

    try {
      setUploadingFiles(true);
      let attachments: Array<{ fileName: string; fileType: string; fileSize: number; objectPath: string; }> = [];

      if (selectedFiles.length > 0) {
        attachments = await uploadFiles(selectedFiles);
      }

      if (recordedAudio) {
        const fileName = `voice-note-${Date.now()}.mp4`;
        const audioFile = Object.assign(recordedAudio, {
          name: fileName,
          lastModified: Date.now()
        });
        const voiceAttachments = await uploadFiles([audioFile as File]);
        attachments = [...attachments, ...voiceAttachments];
      }

      // Include reply-to metadata if set (requires backend support)
      const payload: any = {
        content: newMessage || (recordedAudio ? '(Voice Note)' : '(Attachment)'),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      // Add reply-to reference if user is replying to a message
      // Note: Backend API needs to support replyToMessageId field
      if (replyToMessage) {
        payload.replyToMessageId = replyToMessage.id;
      }

      sendMessageMutation.mutate(payload);
      
      // Clear reply-to after sending
      clearReplyTo();
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/mp4' });
      
      const audioChunks: Blob[] = [];
      isCancelledRef.current = false;
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        if (!isCancelledRef.current && audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/mp4' });
          setRecordedAudio(audioBlob);
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
        }
        stream.getTracks().forEach(track => track.stop());
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      const interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setRecordingInterval(interval);
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: 'Recording failed',
        description: 'Unable to access microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      
      if (recordingInterval) {
        clearInterval(recordingInterval);
        setRecordingInterval(null);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      isCancelledRef.current = true;
      mediaRecorder.stop();
      setIsRecording(false);
      
      if (recordingInterval) {
        clearInterval(recordingInterval);
        setRecordingInterval(null);
      }
    }
    
    setRecordedAudio(null);
    setRecordingTime(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const deleteRecording = () => {
    setRecordedAudio(null);
    setRecordingTime(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Swipe handling for thread items
  const handleSwipeLeft = (threadId: string) => {
    setSwipedThreadId(threadId);
    setSwipeDirection('left');
  };

  const handleSwipeRight = (threadId: string) => {
    setSwipedThreadId(threadId);
    setSwipeDirection('right');
  };

  const handleReplyAction = (thread: MessageThread) => {
    setSelectedThreadId(thread.id);
    setSelectedThreadType(thread.threadType);
    setSwipedThreadId(null);
    setSwipeDirection(null);
    if (isMobile) {
      setShowMobileThreadView(true);
    }
  };

  const handleArchiveAction = (thread: MessageThread) => {
    // Create thread-specific archive mutation based on thread's own type
    const archiveUrl = thread.threadType === 'staff'
      ? `/api/staff-messages/threads/${thread.id}/archive`
      : `/api/internal/project-messages/threads/${thread.id}/archive`;
    
    const unarchiveUrl = thread.threadType === 'staff'
      ? `/api/staff-messages/threads/${thread.id}/unarchive`
      : `/api/internal/project-messages/threads/${thread.id}/unarchive`;

    const url = thread.isArchived ? unarchiveUrl : archiveUrl;

    apiRequest('PUT', url)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
        queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
        toast({
          title: "Success",
          description: thread.isArchived ? "Thread restored" : "Thread archived",
        });
      })
      .catch((error: Error) => {
        toast({
          title: "Error",
          description: error.message || `Failed to ${thread.isArchived ? 'restore' : 'archive'} thread`,
          variant: "destructive",
        });
      });

    setSwipedThreadId(null);
    setSwipeDirection(null);
  };

  // Long press handling for message context menu (react/reply)
  const handleMessageTouchStart = (messageId: string) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressedMessageId(messageId);
      setShowMessageContextMenu(true);
    }, 500); // 500ms long press
  };

  const handleMessageTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleContextMenuReact = () => {
    setShowMessageContextMenu(false);
    setShowReactionPicker(true);
  };

  const handleContextMenuReply = () => {
    const message = messages?.find(m => m.id === longPressedMessageId);
    if (message) {
      handleReplyToMessage(message);
    }
    setShowMessageContextMenu(false);
    setLongPressedMessageId(null);
  };

  const handleReaction = (emoji: string) => {
    // TODO: Backend API support needed for persisting reactions
    // Would typically POST to /api/.../messages/{messageId}/reactions
    // with { emoji, userId } and store in reactions table
    
    // For now, provide user feedback that the feature is recognized
    toast({
      title: "Reaction feature",
      description: `You selected ${emoji} - Backend API support needed for persistence`,
    });
    
    setShowReactionPicker(false);
    setLongPressedMessageId(null);
  };

  // Reply to message handling
  const handleReplyToMessage = (message: ProjectMessage | StaffMessage) => {
    setReplyToMessage(message);
  };

  const clearReplyTo = () => {
    setReplyToMessage(null);
  };

  const handleCreateStaffThread = () => {
    if (!newThreadTopic.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter a topic for the thread",
        variant: "destructive",
      });
      return;
    }

    if (selectedParticipants.length === 0) {
      toast({
        title: "Participants required",
        description: "Please select at least one participant",
        variant: "destructive",
      });
      return;
    }

    if (!initialMessage.trim()) {
      toast({
        title: "Message required",
        description: "Please enter an initial message for the thread",
        variant: "destructive",
      });
      return;
    }

    createStaffThreadMutation.mutate({
      topic: newThreadTopic.trim(),
      participantUserIds: selectedParticipants,
      initialMessage: { content: initialMessage.trim() },
    });
  };

  // Redirect to login if not authenticated
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

  // Get current threads based on active tab
  const currentThreads = activeTab === 'internal' ? internalThreads : activeTab === 'client' ? clientThreads : [];
  
  // Filter threads based on search
  const filteredThreads = currentThreads.filter(thread => {
    if (threadSearchTerm.trim()) {
      const searchLower = threadSearchTerm.toLowerCase();
      const topicMatch = thread.topic.toLowerCase().includes(searchLower);
      const participantMatch = thread.participants.some(p => 
        getUserDisplayName(p).toLowerCase().includes(searchLower)
      );
      const messageMatch = thread.lastMessage?.content.toLowerCase().includes(searchLower);
      
      if (thread.threadType === 'project') {
        const clientMatch = thread.client.name.toLowerCase().includes(searchLower);
        const projectMatch = thread.project.description.toLowerCase().includes(searchLower);
        return topicMatch || participantMatch || messageMatch || clientMatch || projectMatch;
      }
      
      return topicMatch || participantMatch || messageMatch;
    }
    return true;
  });

  // Get unique clients from email threads for filter dropdown
  const uniqueClients = Array.from(
    new Map(
      emailThreads
        .filter(t => t.clientId && t.clientName)
        .map(t => [t.clientId, { id: t.clientId, name: t.clientName }])
    ).values()
  ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Filter email threads based on search, client, and read status
  const filteredEmailThreads = emailThreads.filter(thread => {
    // Search filter
    if (threadSearchTerm.trim()) {
      const searchLower = threadSearchTerm.toLowerCase();
      const subjectMatch = thread.subject?.toLowerCase().includes(searchLower);
      const participantMatch = thread.participants.some(p => p.toLowerCase().includes(searchLower));
      const clientMatch = thread.clientName?.toLowerCase().includes(searchLower);
      const previewMatch = thread.latestPreview?.toLowerCase().includes(searchLower);
      if (!(subjectMatch || participantMatch || clientMatch || previewMatch)) {
        return false;
      }
    }
    
    // Client filter
    if (clientFilter !== 'all' && thread.clientId !== clientFilter) {
      return false;
    }
    
    // Read status filter
    if (readStatusFilter === 'read' && thread.hasUnread) {
      return false;
    }
    if (readStatusFilter === 'unread' && !thread.hasUnread) {
      return false;
    }
    
    return true;
  });

  const selectedThread = currentThreads.find(t => t.id === selectedThreadId);

  // Filter participants for selection
  const filteredParticipants = participantSearch.trim()
    ? allUsers?.filter(u => {
        const searchLower = participantSearch.toLowerCase();
        const nameMatch = getUserDisplayName(u).toLowerCase().includes(searchLower);
        const emailMatch = u.email.toLowerCase().includes(searchLower);
        return (nameMatch || emailMatch) && u.id !== user?.id;
      })
    : allUsers?.filter(u => u.id !== user?.id);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full p-2 md:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            {!isMobile && (
              <div className="flex items-center justify-between mb-4">
                <TabsList className="grid w-full max-w-2xl grid-cols-3">
                  <TabsTrigger value="internal" className="relative" data-testid="tab-internal-chat">
                    Internal Chat
                    {internalUnreadCount > 0 && (
                      <Badge className="ml-2 h-5 min-w-5 px-1.5" variant="destructive" data-testid="badge-internal-unread">
                        {internalUnreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="client" className="relative" data-testid="tab-client-chat">
                    Client Chat
                    {clientUnreadCount > 0 && (
                      <Badge className="ml-2 h-5 min-w-5 px-1.5" variant="destructive" data-testid="badge-client-unread">
                        {clientUnreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="emails" className="relative" data-testid="tab-client-emails">
                    Client Emails
                    {emailUnreadCount > 0 && (
                      <Badge className="ml-2 h-5 min-w-5 px-1.5" variant="destructive" data-testid="badge-email-unread">
                        {emailUnreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {activeTab === 'internal' && (
                  <Button onClick={() => setShowNewThreadDialog(true)} data-testid="button-new-thread">
                    <Plus className="w-4 h-4 mr-2" />
                    New Thread
                  </Button>
                )}
              </div>
            )}

            <div className="flex-1 flex gap-4 overflow-hidden">
              {/* Thread List */}
              <Card className="w-full md:w-80 flex flex-col">
                <CardHeader className="space-y-3 pb-3">
                  <Input
                    placeholder={
                      isMobile
                        ? activeTab === 'emails'
                          ? 'Search Client Emails...'
                          : activeTab === 'client'
                          ? 'Search Client Messages...'
                          : 'Search Internal Messages...'
                        : 'Search threads...'
                    }
                    value={threadSearchTerm}
                    onChange={(e) => setThreadSearchTerm(e.target.value)}
                    data-testid="input-search-threads"
                  />
                  {activeTab === 'emails' ? (
                    <>
                      <div className="flex gap-2">
                        <Button
                          variant={emailFilter === 'my' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEmailFilter('my')}
                          data-testid="button-filter-my-emails"
                        >
                          My Emails
                        </Button>
                        <Button
                          variant={emailFilter === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEmailFilter('all')}
                          data-testid="button-filter-all-emails"
                        >
                          All Team Emails
                        </Button>
                      </div>
                      
                      <div className="flex gap-2">
                        <Select value={clientFilter} onValueChange={setClientFilter}>
                          <SelectTrigger className="h-9 text-sm" data-testid="select-client-filter">
                            <SelectValue placeholder="All Clients" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Clients</SelectItem>
                            {uniqueClients.map(client => (
                              <SelectItem key={client.id} value={client.id!}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant={readStatusFilter === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setReadStatusFilter('all')}
                          data-testid="button-filter-all-status"
                        >
                          All
                        </Button>
                        <Button
                          variant={readStatusFilter === 'unread' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setReadStatusFilter('unread')}
                          data-testid="button-filter-unread"
                        >
                          Unread
                        </Button>
                        <Button
                          variant={readStatusFilter === 'read' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setReadStatusFilter('read')}
                          data-testid="button-filter-read"
                        >
                          Read
                        </Button>
                      </div>
                    </>
                  ) : !isMobile ? (
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
                  ) : null}
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-0">
                  {threadsLoading ? (
                    <div className="p-4 space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : activeTab === 'emails' ? (
                    filteredEmailThreads && filteredEmailThreads.length > 0 ? (
                      <div className="divide-y divide-border">
                        {filteredEmailThreads.map((thread) => (
                          <button
                            key={thread.canonicalConversationId}
                            onClick={() => {
                              setSelectedEmailThreadId(thread.canonicalConversationId);
                              setEmailThreadViewerOpen(true);
                            }}
                            className="w-full text-left p-2 hover:bg-muted/50 transition-colors"
                            data-testid={`email-thread-item-${thread.canonicalConversationId}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                {thread.clientName && (
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm text-muted-foreground truncate">
                                      {thread.clientName}
                                    </span>
                                  </div>
                                )}
                                <p className="font-semibold text-sm mt-0.5 truncate">
                                  {thread.subject || 'No Subject'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {thread.latestPreview || `${thread.messageCount} message${thread.messageCount !== 1 ? 's' : ''}`}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground truncate">
                                    {thread.participants.slice(0, 2).join(', ')}
                                    {thread.participants.length > 2 && ` +${thread.participants.length - 2} more`}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                                </span>
                                {thread.hasUnread && (
                                  <div className="w-2 h-2 rounded-full bg-primary" data-testid={`dot-unread-${thread.canonicalConversationId}`} />
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground">
                        <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No email threads found</p>
                      </div>
                    )
                  ) : filteredThreads && filteredThreads.length > 0 ? (
                    <div className="divide-y divide-border">
                      {filteredThreads.map((thread) => (
                        <ThreadListItem
                          key={thread.id}
                          thread={thread}
                          isActive={selectedThreadId === thread.id}
                          isMobile={isMobile}
                          isSwipedLeft={swipedThreadId === thread.id && swipeDirection === 'left'}
                          isSwipedRight={swipedThreadId === thread.id && swipeDirection === 'right'}
                          onSwipedLeft={() => handleSwipeLeft(thread.id)}
                          onSwipedRight={() => handleSwipeRight(thread.id)}
                          onReplyAction={() => handleReplyAction(thread)}
                          onArchiveAction={() => handleArchiveAction(thread)}
                          onClick={() => {
                            if (swipedThreadId === thread.id) {
                              setSwipedThreadId(null);
                              setSwipeDirection(null);
                            } else {
                              setSelectedThreadId(thread.id);
                              setSelectedThreadType(thread.threadType);
                              if (isMobile) {
                                setShowMobileThreadView(true);
                              }
                            }
                          }}
                        />
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

              {/* Message View - Hidden on mobile */}
              {!isMobile && (
              <Card className="flex-1 flex flex-col" data-testid="message-view-card">
                {selectedThreadId && selectedThread ? (
                  <>
                    <CardHeader className="border-b">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {selectedThread.threadType === 'project' && (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {selectedThread.client.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <FolderKanban className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {selectedThread.project.description}
                                </span>
                              </div>
                            </>
                          )}
                          <CardTitle className="text-lg">{selectedThread.topic}</CardTitle>
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <Users className="w-4 h-4" />
                            <span>
                              {selectedThread.participants.map(p => getUserDisplayName(p)).join(', ')}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {selectedThread.threadType === 'project' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(`/projects/${selectedThread.project.id}`)}
                              data-testid="button-view-project"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View Project
                            </Button>
                          )}
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
                                className={`group flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                                data-testid={`message-${message.id}`}
                                onTouchStart={() => handleMessageTouchStart(message.id)}
                                onTouchEnd={handleMessageTouchEnd}
                                onMouseLeave={handleMessageTouchEnd}
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
                                  <div className="relative">
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
                                    
                                    {/* Reply button - shows on hover/group-hover */}
                                    <div className={`absolute ${isCurrentUser ? 'left-[-40px]' : 'right-[-40px]'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleReplyToMessage(message)}
                                        className="h-8 w-8 p-0 rounded-full bg-muted shadow-sm hover:bg-accent"
                                        data-testid={`button-reply-${message.id}`}
                                      >
                                        <Reply className="h-4 w-4" />
                                      </Button>
                                    </div>
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
                      {/* Reply-to indicator */}
                      {replyToMessage && (
                        <div className="mb-3 flex items-center gap-2 p-2 bg-muted rounded text-sm">
                          <Reply className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="font-medium text-xs">
                              Replying to {replyToMessage.user ? getUserDisplayName(replyToMessage.user) : 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {replyToMessage.content.substring(0, 50)}...
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearReplyTo}
                            data-testid="button-clear-reply"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}

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
              )}
            </div>
          </Tabs>
        </div>
      </div>
      
      {/* FAB for mobile - filter menu */}
      {isMobile && (
        <div className="fixed bottom-24 right-6 z-50">
          <Popover open={showMobileFilterMenu} onOpenChange={setShowMobileFilterMenu}>
            <PopoverTrigger asChild>
              <Button
                size="lg"
                className="rounded-full shadow-lg h-14 w-14 p-0"
                data-testid="button-mobile-filter-fab"
              >
                <Filter className="h-6 w-6" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="end" data-testid="popover-mobile-filter">
              <div className="space-y-3">
                <div className="font-semibold mb-2">Filter Messages</div>
                
                {/* View type selection */}
                <div className="space-y-2">
                  <Label className="text-sm">Message Type</Label>
                  <Select value={activeTab} onValueChange={(value) => {
                    setActiveTab(value);
                    setShowMobileFilterMenu(false);
                  }}>
                    <SelectTrigger data-testid="select-message-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal Chat</SelectItem>
                      <SelectItem value="client">Client Chat</SelectItem>
                      <SelectItem value="emails">Client Emails</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Archive filter */}
                {activeTab !== 'emails' && (
                  <div className="space-y-2">
                    <Label className="text-sm">Status</Label>
                    <Select value={archiveFilter} onValueChange={(value: 'open' | 'archived') => setArchiveFilter(value)}>
                      <SelectTrigger data-testid="select-archive-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <BottomNav user={user} onSearchClick={() => setMobileSearchOpen(true)} />

      {/* Mobile Search Modal */}
      <SuperSearch
        isOpen={mobileSearchOpen}
        onOpenChange={setMobileSearchOpen}
      />

      {/* Mobile Thread View Dialog */}
      {isMobile && selectedThreadId && selectedThread && (
        <Dialog open={showMobileThreadView} onOpenChange={setShowMobileThreadView}>
          <DialogContent className="max-w-full h-[90vh] p-0 flex flex-col">
            <DialogHeader className="border-b p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {selectedThread.threadType === 'project' && (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {selectedThread.client.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <FolderKanban className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {selectedThread.project.description}
                        </span>
                      </div>
                    </>
                  )}
                  <DialogTitle>{selectedThread.topic}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>
                      {selectedThread.participants.map(p => getUserDisplayName(p)).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messagesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : messages && messages.length > 0 ? (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.userId === user?.id ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback>
                        {message.user
                          ? `${message.user.firstName?.[0] || ''}${message.user.lastName?.[0] || ''}`
                          : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex-1 space-y-1 ${message.userId === user?.id ? 'text-right' : ''}`}>
                      <div className="flex items-center gap-2 text-sm">
                        {message.userId === user?.id ? (
                          <>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                            </span>
                            <span className="font-medium">You</span>
                          </>
                        ) : (
                          <>
                            <span className="font-medium">
                              {message.user ? getUserDisplayName(message.user) : 'Unknown User'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                            </span>
                          </>
                        )}
                      </div>
                      <div
                        className={`inline-block rounded-lg px-3 py-2 ${
                          message.userId === user?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                      {message.attachments && message.attachments.length > 0 && (
                        <AttachmentList attachments={message.attachments} readonly={true} />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No messages yet</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t p-4 space-y-2">
              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-muted px-2 py-1 rounded text-sm">
                      <File className="w-4 h-4" />
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <button
                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {recordedAudio && audioUrl && (
                <div className="bg-muted p-2 rounded flex items-center gap-2">
                  <VoiceNotePlayer audioUrl={audioUrl} />
                  <button
                    onClick={() => {
                      setRecordedAudio(null);
                      setAudioUrl(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <Textarea
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 min-h-[60px] resize-none"
                  disabled={uploadingFiles}
                />

                <Button
                  onClick={handleSendMessage}
                  disabled={(!newMessage.trim() && selectedFiles.length === 0 && !recordedAudio) || uploadingFiles || sendMessageMutation.isPending}
                  size="sm"
                >
                  {uploadingFiles || sendMessageMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* New Staff Thread Dialog */}
      <Dialog open={showNewThreadDialog} onOpenChange={setShowNewThreadDialog}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-new-thread">
          <DialogHeader>
            <DialogTitle>Create New Staff Thread</DialogTitle>
            <DialogDescription>
              Start a new conversation with team members and send your first message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                placeholder="Enter thread topic..."
                value={newThreadTopic}
                onChange={(e) => setNewThreadTopic(e.target.value)}
                data-testid="input-thread-topic"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Participants</Label>
              
              {/* Search Input */}
              <div className="relative">
                <Input
                  placeholder="Search and select staff members..."
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  data-testid="input-participant-search"
                />
                
                {/* Search Results Dropdown */}
                {participantSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                    {usersLoading ? (
                      <div className="text-sm text-muted-foreground p-4 text-center">Loading users...</div>
                    ) : filteredParticipants && filteredParticipants.length > 0 ? (
                      <div className="p-1">
                        {filteredParticipants.map((u) => {
                          const isSelected = selectedParticipants.includes(u.id);
                          return (
                            <div
                              key={u.id}
                              onClick={() => {
                                if (!isSelected) {
                                  setSelectedParticipants([...selectedParticipants, u.id]);
                                }
                                setParticipantSearch('');
                              }}
                              className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                              data-testid={`button-add-participant-${u.id}`}
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm">{getUserDisplayName(u)}</div>
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground p-4 text-center">No users found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Participants */}
              {selectedParticipants.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-md min-h-[40px]">
                  {selectedParticipants.map((userId) => {
                    const user = allUsers?.find(u => u.id === userId);
                    return user ? (
                      <Badge
                        key={userId}
                        variant="secondary"
                        className="flex items-center gap-1"
                        data-testid={`selected-participant-${userId}`}
                      >
                        <span>{getUserDisplayName(user)}</span>
                        <button
                          onClick={() => setSelectedParticipants(selectedParticipants.filter(id => id !== userId))}
                          className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                          data-testid={`remove-participant-${userId}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="initial-message">Initial Message</Label>
              <Textarea
                id="initial-message"
                placeholder="Type your first message..."
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-initial-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNewThreadDialog(false);
                setNewThreadTopic('');
                setSelectedParticipants([]);
                setInitialMessage('');
                setParticipantSearch('');
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateStaffThread} 
              disabled={!newThreadTopic.trim() || selectedParticipants.length === 0 || !initialMessage.trim()}
              data-testid="button-create-thread"
            >
              Create Thread
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Thread Viewer Modal */}
      {selectedEmailThreadId && (
        <EmailThreadViewer
          threadId={selectedEmailThreadId}
          open={emailThreadViewerOpen}
          onOpenChange={(open) => {
            setEmailThreadViewerOpen(open);
            if (!open) {
              setSelectedEmailThreadId(null);
            }
          }}
        />
      )}

      {/* Message Context Menu - appears on long press */}
      {showMessageContextMenu && longPressedMessageId && (
        <Dialog open={showMessageContextMenu} onOpenChange={setShowMessageContextMenu}>
          <DialogContent className="sm:max-w-[300px]" data-testid="dialog-message-context-menu">
            <DialogHeader>
              <DialogTitle>Message Options</DialogTitle>
              <DialogDescription>
                Choose an action for this message
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-4">
              <Button
                variant="outline"
                onClick={handleContextMenuReply}
                className="justify-start"
                data-testid="button-context-reply"
              >
                <Reply className="w-4 h-4 mr-2" />
                Reply to Message
              </Button>
              <Button
                variant="outline"
                onClick={handleContextMenuReact}
                className="justify-start"
                data-testid="button-context-react"
              >
                <Smile className="w-4 h-4 mr-2" />
                Add Reaction
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Reaction Picker Modal - appears after selecting "Add Reaction" */}
      {showReactionPicker && longPressedMessageId && (
        <Dialog open={showReactionPicker} onOpenChange={setShowReactionPicker}>
          <DialogContent className="sm:max-w-[400px]" data-testid="dialog-reaction-picker">
            <DialogHeader>
              <DialogTitle>React to Message</DialogTitle>
              <DialogDescription>
                Choose an emoji reaction
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-5 gap-3 py-4">
              {['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥', '🎉', '✅'].map((emoji) => (
                <Button
                  key={emoji}
                  variant="outline"
                  size="lg"
                  onClick={() => handleReaction(emoji)}
                  className="text-3xl h-16 hover:scale-110 transition-transform"
                  data-testid={`button-reaction-${emoji}`}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
