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
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
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
  File,
  Mic,
  Square,
  Trash2,
  FileAudio,
  Image as ImageIcon,
  RefreshCw,
  ClipboardList,
  Filter,
  Calendar
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { AttachmentList, FileUploadZone, VoiceNotePlayer } from '@/components/attachments';

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
  lastMessageByStaff?: boolean; // Track if last message was from staff
  lastMessageContent?: string | null; // Preview of last message
  lastMessageSenderName?: string | null; // Name of last message sender
  hasUnreadMessages?: boolean; // Whether there are unread messages from clients
  clientPortalUser?: {
    id: string;
    email: string;
    clientId: string;
    personId?: string;
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
  console.log('[Messages] ===== STAFF MESSAGES PAGE LOADED - VERSION 2.0 =====');
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'open' | 'archived'>('open');
  const [readFilter, setReadFilter] = useState<'all' | 'unread'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<{ url: string; fileName: string } | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);
  
  // Task creation modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // New message modal state
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [newThreadSubject, setNewThreadSubject] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);

  // Thread list search state
  const [threadSearchTerm, setThreadSearchTerm] = useState('');

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

  // Mark messages as read when a thread is selected
  useEffect(() => {
    if (selectedThreadId) {
      markAsReadMutation.mutate(selectedThreadId);
    }
  }, [selectedThreadId]);

  const { data: allThreads, isLoading: threadsLoading } = useQuery<MessageThread[]>({
    queryKey: ['/api/internal/messages/threads'],
    enabled: isAuthenticated && !!user,
    refetchInterval: 5000,
  });

  const threads = allThreads?.filter(thread => {
    const isArchived = thread.isArchived === true;
    
    // Archive filter
    if (archiveFilter === 'open' && isArchived) return false;
    if (archiveFilter === 'archived' && !isArchived) return false;
    
    // Read/Unread filter
    if (readFilter === 'unread' && !thread.hasUnreadMessages) return false;
    
    // Date range filter
    if (dateFrom) {
      const threadDate = new Date(thread.updatedAt);
      const fromDate = new Date(dateFrom);
      if (threadDate < fromDate) return false;
    }
    if (dateTo) {
      const threadDate = new Date(thread.updatedAt);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      if (threadDate > toDate) return false;
    }
    
    // Enhanced search: client name, person email, message content
    if (threadSearchTerm.trim()) {
      const searchLower = threadSearchTerm.toLowerCase();
      const clientName = thread.clientPortalUser?.client?.name || '';
      const personEmail = thread.clientPortalUser?.email || '';
      const messageContent = thread.lastMessageContent || '';
      
      const matches = 
        clientName.toLowerCase().includes(searchLower) ||
        personEmail.toLowerCase().includes(searchLower) ||
        messageContent.toLowerCase().includes(searchLower);
      
      if (!matches) return false;
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

  // Fetch task templates for task creation
  const { data: taskTemplates } = useQuery<Array<{ id: string; name: string; status: string }>>({
    queryKey: ['/api/task-templates'],
    enabled: showTaskModal,
  });

  // Fetch clients for new message search
  const { data: clients } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/clients', { search: clientSearch }],
    enabled: showNewMessageModal && clientSearch.length >= 2,
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

  const createTaskMutation = useMutation({
    mutationFn: (data: { templateId: string; clientId: string; personId?: string | null }) =>
      apiRequest('POST', '/api/task-instances', {
        ...data,
        customRequestId: null, // Required by schema - either templateId or customRequestId must be provided
      }),
    onSuccess: () => {
      setShowTaskModal(false);
      setSelectedTemplate('');
      toast({
        title: "Success",
        description: "Client request created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create client request",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (threadId: string) =>
      apiRequest('PUT', `/api/internal/messages/threads/${threadId}/mark-read`),
    onSuccess: () => {
      // Invalidate unread count to refresh the badge
      queryClient.invalidateQueries({ queryKey: ['/api/internal/messages/unread-count'] });
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: (data: { subject: string; clientId: string }) =>
      apiRequest('POST', '/api/internal/messages/threads', data),
    onSuccess: (newThread: MessageThread) => {
      setShowNewMessageModal(false);
      setNewThreadSubject('');
      setClientSearch('');
      setSelectedClient(null);
      queryClient.invalidateQueries({ queryKey: ['/api/internal/messages/threads'] });
      // Select the newly created thread
      setSelectedThreadId(newThread.id);
      toast({
        title: "Success",
        description: "New conversation started",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create conversation",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFilesSelected(files);
  };

  const handleFilesSelected = (files: File[]) => {
    // Check if adding these files would exceed the limit
    if (selectedFiles.length + files.length > 5) {
      toast({
        title: "Too many files",
        description: "You can only attach up to 5 files per message",
        variant: "destructive",
      });
      return;
    }

    const validFiles = files.filter(file => {
      const isValid = file.size <= 25 * 1024 * 1024; // 25MB limit
      if (!isValid) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 25MB limit`,
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
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Update progress
        const progressPercent = Math.round((i / totalFiles) * 100);
        setUploadProgress(progressPercent);

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

        // Update progress after each file
        const newProgressPercent = Math.round(((i + 1) / totalFiles) * 100);
        setUploadProgress(newProgressPercent);
      } catch (error) {
        console.error('Error uploading file:', file.name, error);
        throw new Error(`Failed to upload ${file.name}`);
      }
    }

    return uploadedAttachments;
  };

  const handleCreateTask = () => {
    if (!selectedTemplate || !selectedThread) return;

    const clientId = selectedThread.clientPortalUser?.clientId;
    const personId = selectedThread.clientPortalUser?.personId;

    if (!clientId) {
      toast({
        title: "Error",
        description: "Unable to determine client for this thread",
        variant: "destructive",
      });
      return;
    }

    createTaskMutation.mutate({
      templateId: selectedTemplate,
      clientId,
      personId,
    });
  };

  const handleCreateNewThread = () => {
    if (!newThreadSubject.trim() || !selectedClient) {
      toast({
        title: "Error",
        description: "Please enter a subject and select a client",
        variant: "destructive",
      });
      return;
    }

    createThreadMutation.mutate({
      subject: newThreadSubject,
      clientId: selectedClient.id,
    });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    try {
      setUploadingFiles(true);
      setUploadProgress(0);
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
      setUploadProgress(0);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/mp4'
      });
      
      const audioChunks: Blob[] = [];
      isCancelledRef.current = false;
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        // Only create audio blob if not cancelled
        if (!isCancelledRef.current && audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/mp4' });
          setRecordedAudio(audioBlob);
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
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
      // Mark as cancelled BEFORE stopping
      isCancelledRef.current = true;
      
      mediaRecorder.stop();
      setIsRecording(false);
      
      if (recordingInterval) {
        clearInterval(recordingInterval);
        setRecordingInterval(null);
      }
    }
    
    // Clean up state
    setRecordedAudio(null);
    setRecordingTime(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const discardRecording = () => {
    setRecordedAudio(null);
    setRecordingTime(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const reRecord = async () => {
    // Discard current recording
    discardRecording();
    // Start a new recording
    await startRecording();
  };

  const sendVoiceNote = async () => {
    if (!recordedAudio) return;

    try {
      setUploadingFiles(true);

      // Convert blob to file-like object for browser compatibility
      const fileName = `voice-note-${Date.now()}.mp4`;

      // Create a File-like object that works in all browsers
      // Some browsers don't support the File constructor, so we extend the Blob
      const audioFile = Object.assign(recordedAudio, {
        name: fileName,
        lastModified: Date.now()
      });

      // Verify file has size
      console.log('Voice note file:', {
        name: (audioFile as any).name,
        size: audioFile.size,
        type: audioFile.type,
        lastModified: (audioFile as any).lastModified
      });

      if (!audioFile.size || audioFile.size === 0) {
        throw new Error('Voice note has no audio data');
      }

      // Upload the audio file
      const attachments = await uploadFiles([audioFile as File]);

      // Send as message
      sendMessageMutation.mutate({
        content: '(Voice Note)',
        attachments
      });

      // Clean up
      discardRecording();
    } catch (error: any) {
      console.error('Voice note upload error:', error);
      toast({
        title: 'Failed to send voice note',
        description: error.message || 'Unable to upload audio. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploadingFiles(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">
            Client Messages
          </h1>
          <div className="flex items-center gap-3">
            {unreadCount && unreadCount.count > 0 && (
              <Badge variant="destructive" className="text-lg px-3 py-1" data-testid="badge-unread-count">
                {unreadCount.count} unread
              </Badge>
            )}
            <Button 
              onClick={() => setShowNewMessageModal(true)}
              className="gap-2"
              data-testid="button-new-message"
            >
              <MessageCircle className="h-4 w-4" />
              New Message
            </Button>
          </div>
        </div>

        {/* Streamlined Thread List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Thread List */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <Input 
                    value={threadSearchTerm}
                    onChange={(e) => setThreadSearchTerm(e.target.value)}
                    placeholder="Search"
                    className="w-full"
                    data-testid="input-thread-search"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="ml-2" data-testid="button-filter">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-3">Filters</h4>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Status</Label>
                        <RadioGroup value={archiveFilter} onValueChange={(value) => setArchiveFilter(value as 'all' | 'open' | 'archived')}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" id="status-all" />
                            <Label htmlFor="status-all" className="font-normal cursor-pointer">All</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="open" id="status-open" />
                            <Label htmlFor="status-open" className="font-normal cursor-pointer">Open</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="archived" id="status-archived" />
                            <Label htmlFor="status-archived" className="font-normal cursor-pointer">Archived</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Read Status</Label>
                        <RadioGroup value={readFilter} onValueChange={(value) => setReadFilter(value as 'all' | 'unread')}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" id="read-all" />
                            <Label htmlFor="read-all" className="font-normal cursor-pointer">All</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="unread" id="read-unread" />
                            <Label htmlFor="read-unread" className="font-normal cursor-pointer">Unread only</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Date Range</Label>
                        <div className="space-y-2">
                          <div>
                            <Label htmlFor="date-from" className="text-xs text-muted-foreground">From</Label>
                            <Input 
                              id="date-from"
                              type="date"
                              value={dateFrom}
                              onChange={(e) => setDateFrom(e.target.value)}
                              className="w-full"
                              data-testid="input-date-from"
                            />
                          </div>
                          <div>
                            <Label htmlFor="date-to" className="text-xs text-muted-foreground">To</Label>
                            <Input 
                              id="date-to"
                              type="date"
                              value={dateTo}
                              onChange={(e) => setDateTo(e.target.value)}
                              className="w-full"
                              data-testid="input-date-to"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {(archiveFilter !== 'open' || readFilter !== 'all' || dateFrom || dateTo) && (
                        <>
                          <Separator />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => {
                              setArchiveFilter('open');
                              setReadFilter('all');
                              setDateFrom('');
                              setDateTo('');
                            }}
                            data-testid="button-clear-filters"
                          >
                            Clear Filters
                          </Button>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                {threadsLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : threads && threads.length > 0 ? (
                  <div className="divide-y">
                    {threads.map((thread) => {
                      const messagePreview = thread.lastMessageContent 
                        ? thread.lastMessageContent.substring(0, 60) + (thread.lastMessageContent.length > 60 ? '...' : '')
                        : 'No messages yet';
                      
                      return (
                        <button
                          key={thread.id}
                          onClick={() => setSelectedThreadId(thread.id)}
                          className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors relative ${
                            selectedThreadId === thread.id ? 'bg-accent' : ''
                          } ${thread.hasUnreadMessages ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                          data-testid={`thread-${thread.id}`}
                        >
                          {thread.hasUnreadMessages && (
                            <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full" data-testid={`unread-indicator-${thread.id}`}></div>
                          )}
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <h3 className={`text-sm truncate ${thread.hasUnreadMessages ? 'font-bold' : 'font-semibold'}`} data-testid={`thread-topic-${thread.id}`}>
                              {thread.subject || thread.topic}
                            </h3>
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                              {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true }).replace('about ', '')}
                            </span>
                          </div>
                          <p className={`text-xs text-muted-foreground truncate mb-0.5 ${thread.hasUnreadMessages ? 'font-semibold' : ''}`} data-testid={`thread-client-${thread.id}`}>
                            {thread.clientPortalUser?.client?.name || thread.clientPortalUser?.email}
                          </p>
                          {thread.lastMessageSenderName && (
                            <p className={`text-xs truncate ${thread.hasUnreadMessages ? 'font-medium text-foreground' : 'text-muted-foreground'}`} data-testid={`thread-preview-${thread.id}`}>
                              <span className="font-medium">{thread.lastMessageSenderName}:</span> {messagePreview}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No conversations found</p>
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
                                <span data-testid={`message-sender-${message.id}`}>
                                  {isStaff
                                    ? `${message.user?.firstName || ''} ${message.user?.lastName || ''}`.trim() || message.user?.email
                                    : message.clientPortalUser?.email}
                                </span>
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
                                  <div className="mt-2 space-y-2">
                                    {message.attachments.map((attachment, idx) => {
                                      const isImage = attachment.fileType.startsWith('image/');
                                      const isAudio = attachment.fileType.startsWith('audio/');
                                      // Use the authorized endpoint for staff to access attachments
                                      const objectUrl = attachment.objectPath.replace('/objects/', `/api/internal/messages/attachments/`) + `?threadId=${selectedThreadId}`;
                                      
                                      if (isImage) {
                                        return (
                                          <div key={idx} className="mt-2">
                                            <button
                                              onClick={() => setPreviewImage({ url: objectUrl, fileName: attachment.fileName })}
                                              className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:opacity-90 transition-opacity cursor-pointer"
                                              data-testid={`image-attachment-${idx}`}
                                            >
                                              <img 
                                                src={objectUrl} 
                                                alt={attachment.fileName}
                                                className="max-w-full h-auto max-h-64 object-contain bg-gray-100 dark:bg-gray-800"
                                                loading="lazy"
                                              />
                                            </button>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                              <ImageIcon className="h-3 w-3" />
                                              <span className="truncate">{attachment.fileName}</span>
                                            </div>
                                          </div>
                                        );
                                      }
                                      
                                      if (isAudio) {
                                        return (
                                          <div key={idx} className="p-3 rounded-lg bg-muted">
                                            <div className="flex items-center gap-2 mb-2">
                                              <FileAudio className="h-4 w-4" />
                                              <span className="text-xs flex-1 truncate">{attachment.fileName}</span>
                                            </div>
                                            <audio 
                                              src={objectUrl} 
                                              controls 
                                              className="w-full max-w-xs"
                                              preload="metadata"
                                              data-testid={`audio-attachment-${idx}`}
                                            />
                                          </div>
                                        );
                                      }
                                      
                                      return (
                                        <a
                                          key={idx}
                                          href={objectUrl}
                                          download={attachment.fileName}
                                          className="flex items-center gap-2 p-2 rounded bg-muted hover:bg-muted/80 transition-colors text-sm max-w-xs"
                                          data-testid={`attachment-${message.id}-${idx}`}
                                        >
                                          <File className="h-4 w-4 flex-shrink-0" />
                                          <span className="truncate">{attachment.fileName}</span>
                                        </a>
                                      );
                                    })}
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
                    {/* Upload Progress */}
                    {uploadingFiles && uploadProgress > 0 && (
                      <div className="mb-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Uploading files...</span>
                          <span className="font-medium">{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                      </div>
                    )}

                    {/* File Upload Zone */}
                    {!isRecording && !recordedAudio && selectedFiles.length < 5 && (
                      <div className="mb-3">
                        <FileUploadZone
                          onFilesSelected={handleFilesSelected}
                          maxFiles={5 - selectedFiles.length}
                          maxSize={25 * 1024 * 1024}
                          acceptedTypes={['image/*', '.pdf', 'audio/*', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv']}
                        />
                      </div>
                    )}

                    {/* Attachment List */}
                    {selectedFiles.length > 0 && (
                      <div className="mb-3">
                        <AttachmentList
                          attachments={selectedFiles}
                          onRemove={removeFile}
                        />
                      </div>
                    )}
                    
                    {/* Recording indicator */}
                    {isRecording && (
                      <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                              <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75" />
                            </div>
                            <span className="text-sm font-medium text-red-700 dark:text-red-300">
                              Recording... {formatTime(recordingTime)}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={cancelRecording}
                              data-testid="button-cancel-recording"
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={stopRecording}
                              data-testid="button-stop-recording"
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <Square className="h-4 w-4 mr-1" />
                              Stop
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Recorded audio preview */}
                    {recordedAudio && !isRecording && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileAudio className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Voice Note</p>
                              <p className="text-xs text-blue-600 dark:text-blue-400">{formatTime(recordingTime)}</p>
                              {audioUrl && (
                                <audio src={audioUrl} controls className="mt-2 w-full max-w-xs" data-testid="audio-preview" />
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={reRecord}
                              title="Re-record"
                              data-testid="button-rerecord"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={discardRecording}
                              title="Discard"
                              data-testid="button-discard-recording"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={sendVoiceNote}
                              disabled={uploadingFiles}
                              data-testid="button-send-voice-note"
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {uploadingFiles ? (
                                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                              ) : (
                                <>
                                  <Send className="h-4 w-4 mr-1" />
                                  Send
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !uploadingFiles && !isRecording && !recordedAudio) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        disabled={isRecording || !!recordedAudio || uploadingFiles}
                        className="flex-1"
                        rows={3}
                        data-testid="input-message"
                      />
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowTaskModal(true)}
                          disabled={isRecording || !!recordedAudio || uploadingFiles}
                          data-testid="button-create-task"
                          title="Create task from message"
                        >
                          <ClipboardList className="h-4 w-4" />
                        </Button>
                        <label htmlFor="file-upload">
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            disabled={isRecording || !!recordedAudio || uploadingFiles}
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
                          accept="image/*,.pdf,audio/*,.doc,.docx,.xls,.xlsx,.txt,.csv"
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={isRecording || !!recordedAudio}
                          data-testid="input-file-upload"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={startRecording}
                          disabled={isRecording || !!recordedAudio || uploadingFiles}
                          data-testid="button-start-recording"
                        >
                          <Mic className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={handleSendMessage}
                          disabled={(!newMessage.trim() && selectedFiles.length === 0) || uploadingFiles || sendMessageMutation.isPending || isRecording || !!recordedAudio}
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
      </main>

      <BottomNav onSearchClick={() => {}} />

      {/* New Message Modal */}
      <Dialog open={showNewMessageModal} onOpenChange={setShowNewMessageModal}>
        <DialogContent data-testid="dialog-new-message">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
            <DialogDescription>
              Start a new conversation with a client
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input 
                value={newThreadSubject}
                onChange={(e) => setNewThreadSubject(e.target.value)}
                placeholder="Enter message subject"
                data-testid="input-thread-subject"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Client</label>
              <Input 
                value={selectedClient ? selectedClient.name : clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setSelectedClient(null);
                }}
                placeholder="Search for a client..."
                data-testid="input-client-search"
              />
              {clientSearch.length >= 2 && !selectedClient && clients && clients.length > 0 && (
                <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setSelectedClient(client);
                        setClientSearch(client.name);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                      data-testid={`client-option-${client.id}`}
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              )}
              {clientSearch.length >= 2 && !selectedClient && clients && clients.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">No clients found</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowNewMessageModal(false);
                  setNewThreadSubject('');
                  setClientSearch('');
                  setSelectedClient(null);
                }}
                data-testid="button-cancel-new-message"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateNewThread}
                disabled={!newThreadSubject.trim() || !selectedClient || createThreadMutation.isPending}
                data-testid="button-create-thread"
              >
                {createThreadMutation.isPending ? 'Creating...' : 'Start Conversation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Creation Modal */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle>Create Client Request</DialogTitle>
            <DialogDescription>
              Select a task template to create a new client request for {selectedThread?.clientPortalUser?.client?.name || 'this client'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Task Template</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger data-testid="select-task-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {taskTemplates?.filter(t => t.status === 'active').map((template) => (
                    <SelectItem key={template.id} value={template.id} data-testid={`template-${template.id}`}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowTaskModal(false); setSelectedTemplate(''); }} data-testid="button-cancel-task">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTask}
                disabled={!selectedTemplate || createTaskMutation.isPending}
                data-testid="button-confirm-create-task"
              >
                {createTaskMutation.isPending ? 'Creating...' : 'Create Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
          data-testid="image-preview-modal"
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(null);
              }}
              data-testid="button-close-preview"
            >
              <X className="h-6 w-6" />
            </button>
            <img 
              src={previewImage.url}
              alt={previewImage.fileName}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-center mt-2">{previewImage.fileName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
