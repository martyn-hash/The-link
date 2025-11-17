import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import TopNavigation from '@/components/top-navigation';
import BottomNav from '@/components/bottom-nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { AttachmentList, FileUploadZone, VoiceNotePlayer } from '@/components/attachments';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { useIsMobile } from '@/hooks/use-mobile';
import DOMPurify from 'isomorphic-dompurify';
import { TiptapEditor } from '@/components/TiptapEditor';

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

export interface StaffMessageThread {
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

interface User {
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
  user?: User;
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

interface InternalChatViewProps {
  showNavigation?: boolean;
  className?: string;
  initialThreadId?: string;
  onThreadSelected?: (threadId: string | null) => void;
}

export function InternalChatView({
  showNavigation = false,
  className = '',
  initialThreadId,
  onThreadSelected,
}: InternalChatViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialThreadId || null);
  const [archiveFilter, setArchiveFilter] = useState<'open' | 'archived'>('open');
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [threadSearchTerm, setThreadSearchTerm] = useState('');
  const [showNewThreadDialog, setShowNewThreadDialog] = useState(false);
  const [newThreadTopic, setNewThreadTopic] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedThreadType, setSelectedThreadType] = useState<'project' | 'staff' | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [initialMessage, setInitialMessage] = useState('');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);
  
  // Expand/collapse message state
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showAttachmentsGallery, setShowAttachmentsGallery] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch project message threads
  const { data: projectThreads, isLoading: projectThreadsLoading } = useQuery<ProjectMessageThread[]>({
    queryKey: ['/api/project-messages/my-threads', { includeArchived: archiveFilter === 'archived' }],
    queryFn: async () => {
      const response = await fetch(`/api/project-messages/my-threads?includeArchived=${archiveFilter === 'archived'}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch project threads');
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Fetch standalone staff message threads
  const { data: staffThreads, isLoading: staffThreadsLoading } = useQuery<StaffMessageThread[]>({
    queryKey: ['/api/staff-messages/my-threads', { includeArchived: archiveFilter === 'archived' }],
    queryFn: async () => {
      const response = await fetch(`/api/staff-messages/my-threads?includeArchived=${archiveFilter === 'archived'}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch staff threads');
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Merge both thread types
  const allThreads: MessageThread[] = [
    ...(projectThreads?.map(t => ({ ...t, threadType: 'project' as const })) || []),
    ...(staffThreads?.map(t => ({ ...t, threadType: 'staff' as const })) || []),
  ].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  const threadsLoading = projectThreadsLoading || staffThreadsLoading;

  // Pull-to-refresh handler - invalidates all message-related queries
  const handleRefresh = async () => {
    if (!user) return;
    
    await queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
    if (selectedThreadId) {
      const queryKey = selectedThreadType === 'staff' 
        ? ['/api/staff-messages/threads', selectedThreadId, 'messages']
        : ['/api/internal/project-messages/threads', selectedThreadId, 'messages'];
      await queryClient.invalidateQueries({ queryKey });
    }
  };

  // Fetch all users for participant selection
  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users/for-messaging'],
    queryFn: async () => {
      const response = await fetch('/api/users/for-messaging', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: showNewThreadDialog,
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
    enabled: !!selectedThreadId && !!selectedThreadType,
    refetchInterval: 10000,
  });

  // Infer thread type when thread is selected (handles URL navigation and programmatic selection)
  useEffect(() => {
    if (selectedThreadId && !selectedThreadType) {
      const thread = allThreads.find(t => t.id === selectedThreadId);
      if (thread) {
        setSelectedThreadType(thread.threadType);
      }
    }
  }, [selectedThreadId, selectedThreadType, allThreads]);

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
      const endpoint = selectedThreadType === 'staff'
        ? `/api/staff-messages/threads/${threadId}/mark-read`
        : `/api/internal/project-messages/threads/${threadId}/mark-read`;
      await apiRequest('PUT', endpoint, { lastReadMessageId: messageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: { content: string; attachments?: any[] }) => {
      const endpoint = selectedThreadType === 'staff'
        ? `/api/staff-messages/threads/${selectedThreadId}/messages`
        : `/api/internal/project-messages/threads/${selectedThreadId}/messages`;
      return apiRequest('POST', endpoint, data);
    },
    onSuccess: () => {
      setNewMessage('');
      setSelectedFiles([]);
      setRecordedAudio(null);
      setAudioUrl(null);
      const queryKey = selectedThreadType === 'staff'
        ? ['/api/staff-messages/threads', selectedThreadId, 'messages']
        : ['/api/internal/project-messages/threads', selectedThreadId, 'messages'];
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const createStaffThreadMutation = useMutation({
    mutationFn: (data: { topic: string; participantUserIds: string[]; initialMessage?: { content: string } }) =>
      apiRequest('POST', '/api/staff-messages/threads', data),
    onSuccess: (newThread: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
      setShowNewThreadDialog(false);
      setNewThreadTopic('');
      setSelectedParticipants([]);
      setSelectedThreadId(newThread.id);
      setSelectedThreadType('staff');
      toast({
        title: "Success",
        description: "Thread created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create thread",
        variant: "destructive",
      });
    },
  });

  const archiveThreadMutation = useMutation({
    mutationFn: (threadId: string) => {
      const endpoint = selectedThreadType === 'staff'
        ? `/api/staff-messages/threads/${threadId}/archive`
        : `/api/internal/project-messages/threads/${threadId}/archive`;
      return apiRequest('PUT', endpoint, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
      toast({
        title: "Success",
        description: "Thread archived",
      });
      setSelectedThreadId(null);
      setSelectedThreadType(null);
    },
  });

  const unarchiveThreadMutation = useMutation({
    mutationFn: (threadId: string) => {
      const endpoint = selectedThreadType === 'staff'
        ? `/api/staff-messages/threads/${threadId}/unarchive`
        : `/api/internal/project-messages/threads/${threadId}/unarchive`;
      return apiRequest('PUT', endpoint, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
      toast({
        title: "Success",
        description: "Thread unarchived",
      });
    },
  });

  const uploadFile = async (file: File): Promise<{
    fileName: string;
    fileType: string;
    fileSize: number;
    objectPath: string;
  }> => {
    try {
      // Determine the upload URL endpoint based on thread type
      const uploadUrlEndpoint = selectedThreadType === 'staff'
        ? '/api/staff-messages/attachments/upload-url'
        : '/api/internal/project-messages/attachments/upload-url';

      // Step 1: Get presigned URL from backend
      const urlResponse = await fetch(uploadUrlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          threadId: selectedThreadId,
        }),
      });

      if (!urlResponse.ok) {
        const errorText = await urlResponse.text();
        throw new Error(`Failed to get upload URL: ${urlResponse.status} - ${errorText}`);
      }

      const { url, objectPath } = await urlResponse.json();

      // Step 2: Upload file directly to object storage
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      // Return attachment metadata
      return {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        objectPath,
      };
    } catch (error: any) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    // Check for meaningful content
    if (!hasMeaningfulContent(newMessage) && selectedFiles.length === 0 && !recordedAudio) return;

    let attachments: any[] = [];

    try {
      setUploadingFiles(true);
      
      // Upload selected files
      if (selectedFiles.length > 0) {
        attachments = await Promise.all(selectedFiles.map(file => uploadFile(file)));
      }

      // Upload recorded audio
      if (recordedAudio) {
        // Create a file-like object from the blob
        const audioFile = Object.assign(recordedAudio, { name: 'voice-note.webm' }) as File;
        const audioAttachment = await uploadFile(audioFile);
        attachments.push(audioAttachment);
      }

      // Sanitize HTML content before sending
      const sanitizedMessage = DOMPurify.sanitize(newMessage, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'target', 'class', 'style', 'colspan', 'rowspan', 'data-row', 'data-column', 'data-cell'],
        FORBID_ATTR: ['onerror', 'onload', 'contenteditable'],
        ALLOW_DATA_ATTR: false,
      });

      // Send message with attachments
      sendMessageMutation.mutate({
        content: sanitizedMessage || '<p>(Attachment)</p>',
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    } catch (error: any) {
      toast({
        title: "Error",
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
      const topicMatches = thread.topic.toLowerCase().includes(searchLower);
      if (thread.threadType === 'project') {
        return topicMatches ||
               thread.project.description.toLowerCase().includes(searchLower) ||
               thread.client.name.toLowerCase().includes(searchLower);
      }
      return topicMatches;
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

  const stripHtml = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return (doc.body.textContent || '').trim();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isHtmlContent = (content: string): boolean => {
    // Check for actual HTML tags from our allow-list (not placeholders like <project>)
    const htmlTagPattern = /<(p|br|strong|b|em|i|u|s|h1|h2|h3|ol|ul|li|a|table|thead|tbody|tr|th|td|span|div)[>\s/]/i;
    return htmlTagPattern.test(content);
  };

  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const hasMeaningfulContent = (htmlContent: string): boolean => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const textContent = (doc.body.textContent || '').trim();
    const hasTables = doc.querySelectorAll('table').length > 0;
    const hasImages = doc.querySelectorAll('img').length > 0;
    const hasLists = doc.querySelectorAll('ul, ol').length > 0;
    return textContent.length > 0 || hasTables || hasImages || hasLists;
  };

  // Check if a message content is long enough to need expand/collapse
  const isMessageLong = (content: string): boolean => {
    // Check character count
    if (content.length > 500) return true;
    
    // Parse HTML to check for tall-rendering content
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    
    // Check for tables (often render tall)
    if (doc.querySelectorAll('table').length > 0) return true;
    
    // Check for images
    if (doc.querySelectorAll('img').length > 0) return true;
    
    // Check for many paragraphs or list items (>5)
    const blockCount = doc.querySelectorAll('p, li').length;
    if (blockCount > 5) return true;
    
    return false;
  };

  // Toggle message expansion
  const toggleMessageExpansion = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // Collect all attachments from all messages in the thread
  const allAttachments = useMemo(() => {
    if (!messages) return [];
    return messages
      .filter(m => m.attachments && m.attachments.length > 0)
      .flatMap(m => m.attachments || []);
  }, [messages]);

  // Call onThreadSelected when thread selection changes
  useEffect(() => {
    if (onThreadSelected) {
      onThreadSelected(selectedThreadId);
    }
  }, [selectedThreadId, onThreadSelected]);

  return (
    <div className={`min-h-screen bg-background ${className}`}>
      {showNavigation && <TopNavigation user={user} />}
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2" data-testid="page-title">
                <Users className="w-6 h-6 md:w-7 md:h-7" />
                Internal Chat
              </h1>
              <p className="text-meta mt-1">Staff-to-staff messaging</p>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowNewThreadDialog(true)}
              data-testid="button-new-thread"
            >
              New Thread
            </Button>
          </div>
        </div>
      </div>

      <div className="page-container py-6 md:py-8 space-y-8">
        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-300px)]">
          {/* Thread List */}
          <Card className="w-full md:w-60 md:flex-shrink-0 flex flex-col" data-testid="thread-list-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Conversations</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/project-messages/my-threads'] });
                    queryClient.invalidateQueries({ queryKey: ['/api/staff-messages/my-threads'] });
                  }}
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
                      onClick={() => {
                        setSelectedThreadId(thread.id);
                        setSelectedThreadType(thread.threadType);
                      }}
                      className={`w-full text-left p-2 hover:bg-muted/50 transition-colors ${
                        selectedThreadId === thread.id ? 'bg-muted' : ''
                      }`}
                      data-testid={`thread-item-${thread.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {thread.threadType === 'project' ? (
                            <div className="flex items-center gap-2 mb-0.5">
                              <FolderKanban className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm text-muted-foreground truncate" data-testid={`text-project-${thread.id}`}>
                                {thread.project.description}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mb-0.5">
                              <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm text-muted-foreground truncate">
                                {thread.participants.map(p => getUserDisplayName(p)).join(', ')}
                              </span>
                            </div>
                          )}
                          <p className="font-semibold text-sm mt-0.5 truncate" data-testid={`text-topic-${thread.id}`}>
                            {thread.topic}
                          </p>
                          {thread.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {stripHtml(thread.lastMessage.content)}
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
                <CardHeader className="border-b py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {selectedThread.threadType === 'project' && (
                        <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            <span data-testid="text-selected-company">
                              {selectedThread.client.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FolderKanban className="w-3.5 h-3.5" />
                            <span data-testid="text-selected-project">
                              {selectedThread.project.description}
                            </span>
                          </div>
                        </div>
                      )}
                      <CardTitle className="text-lg mb-1" data-testid="text-selected-topic">{selectedThread.topic}</CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span data-testid="text-participants">
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

                {/* All Attachments Gallery */}
                {allAttachments.length > 0 && (
                  <div className="border-b">
                    <button
                      onClick={() => setShowAttachmentsGallery(!showAttachmentsGallery)}
                      className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      data-testid="button-toggle-attachments-gallery"
                    >
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4" />
                        <span className="text-sm font-medium">All Attachments ({allAttachments.length})</span>
                      </div>
                      {showAttachmentsGallery ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    {showAttachmentsGallery && (
                      <div className="p-4 bg-muted/30">
                        <AttachmentList
                          attachments={allAttachments}
                          readonly={true}
                          threadId={selectedThreadId || undefined}
                        />
                      </div>
                    )}
                  </div>
                )}

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isMobile ? (
                    <PullToRefresh
                      onRefresh={handleRefresh}
                      pullingContent=""
                      refreshingContent={
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      }
                    >
                      <div className="space-y-4">
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
                                          <span className="text-xs font-medium text-foreground">
                                            {getUserDisplayName(message.user)}
                                          </span>
                                        </>
                                      )}
                                      {isCurrentUser && message.user && (
                                        <span className="text-xs font-medium text-foreground">
                                          {getUserDisplayName(message.user)}
                                        </span>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                                      </span>
                                    </div>
                                    <div
                                      className={`rounded-lg p-3 relative ${
                                        isCurrentUser
                                          ? 'bg-primary text-primary-foreground'
                                          : 'bg-muted'
                                      }`}
                                    >
                                      {isMessageLong(message.content) && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className={`absolute top-2 right-2 h-6 w-6 p-0 z-10 ${
                                            isCurrentUser 
                                              ? 'hover:bg-primary-foreground/20 text-primary-foreground' 
                                              : 'hover:bg-muted-foreground/20'
                                          }`}
                                          onClick={() => toggleMessageExpansion(message.id)}
                                          data-testid={`button-toggle-expand-${message.id}`}
                                        >
                                          {expandedMessages.has(message.id) ? (
                                            <ChevronUp className="w-4 h-4" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4" />
                                          )}
                                        </Button>
                                      )}
                                      <div 
                                        className={`text-sm prose prose-sm max-w-none break-words ${
                                          isCurrentUser 
                                            ? 'prose-headings:text-primary-foreground prose-p:text-primary-foreground prose-strong:font-bold prose-strong:text-primary-foreground prose-em:italic prose-em:text-primary-foreground prose-ul:text-primary-foreground prose-ol:text-primary-foreground prose-li:text-primary-foreground prose-a:text-primary-foreground prose-a:underline' 
                                            : 'prose-headings:text-foreground prose-strong:font-bold prose-strong:text-foreground prose-em:italic prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-a:text-primary'
                                        } prose-table:border-collapse prose-th:border prose-th:border-black prose-th:p-2 prose-th:bg-muted prose-td:border prose-td:border-black prose-td:p-2 ${
                                          isMessageLong(message.content) && !expandedMessages.has(message.id) 
                                            ? 'max-h-[200px] overflow-hidden relative' 
                                            : ''
                                        }`}
                                        dangerouslySetInnerHTML={{ 
                                          __html: DOMPurify.sanitize(
                                            isHtmlContent(message.content) 
                                              ? message.content 
                                              : `<p style="white-space: pre-wrap">${escapeHtml(message.content).replace(/\n/g, '<br>')}</p>`,
                                            {
                                              ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div'],
                                              ALLOWED_ATTR: ['href', 'target', 'class', 'style', 'colspan', 'rowspan', 'data-row', 'data-column', 'data-cell'],
                                            }
                                          )
                                        }}
                                      />
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
                      </div>
                    </PullToRefresh>
                  ) : (
                    <>
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
                                        <span className="text-xs font-medium text-foreground">
                                          {getUserDisplayName(message.user)}
                                        </span>
                                      </>
                                    )}
                                    {isCurrentUser && message.user && (
                                      <span className="text-xs font-medium text-foreground">
                                        {getUserDisplayName(message.user)}
                                      </span>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                                    </span>
                                  </div>
                                  <div
                                    className={`rounded-lg p-3 relative ${
                                      isCurrentUser
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                    }`}
                                  >
                                    {isMessageLong(message.content) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`absolute top-2 right-2 h-6 w-6 p-0 z-10 ${
                                          isCurrentUser 
                                            ? 'hover:bg-primary-foreground/20 text-primary-foreground' 
                                            : 'hover:bg-muted-foreground/20'
                                        }`}
                                        onClick={() => toggleMessageExpansion(message.id)}
                                        data-testid={`button-toggle-expand-${message.id}`}
                                      >
                                        {expandedMessages.has(message.id) ? (
                                          <ChevronUp className="w-4 h-4" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4" />
                                        )}
                                      </Button>
                                    )}
                                    <div 
                                      className={`text-sm prose prose-sm max-w-none break-words ${
                                        isCurrentUser 
                                          ? 'prose-headings:text-primary-foreground prose-p:text-primary-foreground prose-strong:font-bold prose-strong:text-primary-foreground prose-em:italic prose-em:text-primary-foreground prose-ul:text-primary-foreground prose-ol:text-primary-foreground prose-li:text-primary-foreground prose-a:text-primary-foreground prose-a:underline' 
                                          : 'prose-headings:text-foreground prose-strong:font-bold prose-strong:text-foreground prose-em:italic prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-a:text-primary'
                                      } prose-table:border-collapse prose-th:border prose-th:border-black prose-th:p-2 prose-th:bg-muted prose-td:border prose-td:border-black prose-td:p-2 ${
                                        isMessageLong(message.content) && !expandedMessages.has(message.id) 
                                          ? 'max-h-[200px] overflow-hidden relative' 
                                          : ''
                                      }`}
                                      dangerouslySetInnerHTML={{ 
                                        __html: DOMPurify.sanitize(
                                          isHtmlContent(message.content) 
                                            ? message.content 
                                            : `<p style="white-space: pre-wrap">${escapeHtml(message.content).replace(/\n/g, '<br>')}</p>`,
                                          {
                                            ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div'],
                                            ALLOWED_ATTR: ['href', 'target', 'class', 'style', 'colspan', 'rowspan', 'data-row', 'data-column', 'data-cell'],
                                          }
                                        )
                                      }}
                                    />
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
                    </>
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
                        compact={true}
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    <TiptapEditor
                      content={newMessage}
                      onChange={setNewMessage}
                      placeholder="Type your message with rich text, tables, and formatting..."
                      className="min-h-[150px]"
                    />

                    <div className="flex gap-2 items-center">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => isRecording ? stopRecording() : startRecording()}
                        disabled={uploadingFiles || !!recordedAudio}
                        data-testid="button-record-voice"
                      >
                        <Mic className="w-4 h-4" />
                      </Button>

                      <Button
                        onClick={handleSendMessage}
                        disabled={(!hasMeaningfulContent(newMessage) && selectedFiles.length === 0 && !recordedAudio) || uploadingFiles || sendMessageMutation.isPending}
                        data-testid="button-send"
                        className="flex-1"
                      >
                        {uploadingFiles || sendMessageMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Send Message
                      </Button>
                    </div>
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
      
      {showNavigation && <BottomNav user={user} onSearchClick={() => {}} />}
      
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
                  data-testid="input-search-participants"
                />
                
                {/* Search Results Dropdown */}
                {participantSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                    {usersLoading ? (
                      <div className="text-sm text-muted-foreground p-4 text-center">Loading users...</div>
                    ) : allUsers && allUsers.length > 0 ? (
                      <>
                        {allUsers
                          .filter(u => 
                            !selectedParticipants.includes(u.id) &&
                            (getUserDisplayName(u).toLowerCase().includes(participantSearch.toLowerCase()) ||
                             u.email.toLowerCase().includes(participantSearch.toLowerCase()))
                          )
                          .length > 0 ? (
                          <div className="p-1">
                            {allUsers
                              .filter(u => 
                                !selectedParticipants.includes(u.id) &&
                                (getUserDisplayName(u).toLowerCase().includes(participantSearch.toLowerCase()) ||
                                 u.email.toLowerCase().includes(participantSearch.toLowerCase()))
                              )
                              .map(u => (
                                <div
                                  key={u.id}
                                  onClick={() => {
                                    setSelectedParticipants(prev => [...prev, u.id]);
                                    setParticipantSearch('');
                                  }}
                                  className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                                  data-testid={`button-add-participant-${u.id}`}
                                >
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">{getUserDisplayName(u)}</div>
                                    <div className="text-xs text-muted-foreground">{u.email}</div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground p-4 text-center">No users found matching "{participantSearch}"</div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground p-4 text-center">No users available</div>
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
                          onClick={() => setSelectedParticipants(prev => prev.filter(id => id !== userId))}
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
              onClick={() => {
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
              }}
              disabled={createStaffThreadMutation.isPending || !newThreadTopic.trim() || selectedParticipants.length === 0 || !initialMessage.trim()}
              data-testid="button-create-thread"
            >
              {createStaffThreadMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Thread'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
