import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  MessageCircle,
  Send,
  User,
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
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { AttachmentList, FileUploadZone, VoiceNotePlayer } from '@/components/attachments';
import NewProjectThreadModal from '@/components/NewProjectThreadModal';
import DOMPurify from 'isomorphic-dompurify';
import { TiptapEditor } from '@/components/TiptapEditor';

interface ProjectMessageThread {
  id: string;
  projectId: string;
  topic: string;
  createdByUserId: string;
  lastMessageAt: string;
  isArchived: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  creator?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  participants?: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
}

interface ProjectMessage {
  id: string;
  threadId: string;
  userId: string;
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

interface ProjectMessagingProps {
  projectId: string;
  project: any;
}

export default function ProjectMessaging({ projectId, project }: ProjectMessagingProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'open' | 'archived'>('open');
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [notifyImmediately, setNotifyImmediately] = useState(true);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showAttachmentsGallery, setShowAttachmentsGallery] = useState(false);

  // Check URL for thread parameter (from push notification)
  const urlParams = new URLSearchParams(window.location.search);
  const threadFromUrl = urlParams.get('thread');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(threadFromUrl);

  // Fetch threads for this project
  const { data: threadsResponse, isLoading: threadsLoading } = useQuery<{
    threads: ProjectMessageThread[];
    pagination: { hasNextPage: boolean; nextCursor: string | null };
  }>({
    queryKey: ['/api/internal/project-messages/threads', projectId],
    enabled: !!user && !!projectId,
  });

  const threads = threadsResponse?.threads ?? [];

  // Auto-select first thread if none selected
  useEffect(() => {
    if (threads.length > 0 && !selectedThreadId && !threadsLoading) {
      // Try to find first non-archived thread, otherwise use first thread
      const firstOpenThread = threads.find(t => !t.isArchived);
      const threadToSelect = firstOpenThread || threads[0];
      setSelectedThreadId(threadToSelect.id);
    }
  }, [threads, selectedThreadId, threadsLoading]);

  // Fetch messages for selected thread
  const { data: messages, isLoading: messagesLoading } = useQuery<ProjectMessage[]>({
    queryKey: ['/api/internal/project-messages/threads', selectedThreadId, 'messages'],
    enabled: !!selectedThreadId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, attachments, notifyImmediately }: { content: string; attachments?: any; notifyImmediately?: boolean }) => {
      return await apiRequest('POST', `/api/internal/project-messages/threads/${selectedThreadId}/messages`, {
        content,
        attachments,
        notifyImmediately,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/project-messages/threads', selectedThreadId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/internal/project-messages/threads', projectId] });
      setNewMessage('');
      setSelectedFiles([]);
      setNotifyImmediately(true);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Archive/unarchive thread mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ threadId, archive }: { threadId: string; archive: boolean }) => {
      const endpoint = archive ? 'archive' : 'unarchive';
      return await apiRequest('PUT', `/api/internal/project-messages/threads/${threadId}/${endpoint}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/project-messages/threads', projectId] });
      toast({
        title: archiveMutation.variables?.archive ? "Thread archived" : "Thread unarchived",
        description: "The thread has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update thread",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const uploadFiles = async (files: File[]) => {
    const uploadedAttachments = [];

    for (const file of files) {
      try {
        const uploadUrlResponse = await apiRequest('POST', '/api/internal/project-messages/attachments/upload-url', {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          threadId: selectedThreadId,
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
        console.error(`Failed to upload ${file.name}:`, error);
        throw error;
      }
    }

    return uploadedAttachments;
  };

  const handleSendMessage = async () => {
    if (!selectedThreadId) {
      toast({
        title: "No thread selected",
        description: "Please select a thread first",
        variant: "destructive",
      });
      return;
    }

    // Check for meaningful content
    const parser = new DOMParser();
    const doc = parser.parseFromString(newMessage, 'text/html');
    const textContent = (doc.body.textContent || '').trim();
    const hasTables = doc.querySelectorAll('table').length > 0;
    const hasImages = doc.querySelectorAll('img').length > 0;
    const hasLists = doc.querySelectorAll('ul, ol').length > 0;
    const hasContent = textContent.length > 0 || hasTables || hasImages || hasLists;

    if (!hasContent && selectedFiles.length === 0) return;

    try {
      setUploadingFiles(true);
      let attachments = undefined;

      if (selectedFiles.length > 0) {
        attachments = await uploadFiles(selectedFiles);
      }

      // Sanitize HTML content before sending
      const sanitizedMessage = DOMPurify.sanitize(newMessage, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'target', 'class', 'style', 'colspan', 'rowspan', 'data-row', 'data-column', 'data-cell'],
        FORBID_ATTR: ['onerror', 'onload', 'contenteditable'],
        ALLOW_DATA_ATTR: false,
      });

      sendMessageMutation.mutate({
        content: sanitizedMessage || '<p>(Attachment)</p>',
        attachments,
        notifyImmediately,
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

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
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

  const filteredThreads = threads?.filter(thread => {
    if (archiveFilter === 'open') return !thread.isArchived;
    if (archiveFilter === 'archived') return thread.isArchived;
    return true;
  }) || [];

  const selectedThread = threads?.find(t => t.id === selectedThreadId);
  const getUserDisplayName = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.email || 'Unknown User';
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


  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 min-w-0">
        {/* Thread List */}
        <Card className="lg:w-80 lg:flex-shrink-0 h-[600px] flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Threads</h2>
              <Button
                size="sm"
                onClick={() => setShowNewThreadModal(true)}
                data-testid="button-new-thread"
              >
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={archiveFilter === 'open' ? 'default' : 'outline'}
              onClick={() => setArchiveFilter('open')}
              data-testid="filter-open"
            >
              Open
            </Button>
            <Button
              size="sm"
              variant={archiveFilter === 'archived' ? 'default' : 'outline'}
              onClick={() => setArchiveFilter('archived')}
              data-testid="filter-archived"
            >
              Archived
            </Button>
            <Button
              size="sm"
              variant={archiveFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setArchiveFilter('all')}
              data-testid="filter-all"
            >
              All
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {threadsLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No threads found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredThreads.map(thread => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                    selectedThreadId === thread.id ? 'bg-muted' : ''
                  }`}
                  data-testid={`thread-item-${thread.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-sm line-clamp-1">{thread.topic}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created by {getUserDisplayName(thread.creator)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {thread.participants?.length || 0} participant{thread.participants?.length !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Conversation View */}
      <Card className="flex-1 min-w-0 h-[600px] flex flex-col">
        {!selectedThreadId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select a thread to view messages</p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-1">{selectedThread?.topic}</h2>
                  <p className="text-sm text-muted-foreground">
                    Participants: {selectedThread?.participants?.map(p => getUserDisplayName(p)).join(', ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => archiveMutation.mutate({ 
                      threadId: selectedThreadId, 
                      archive: !selectedThread?.isArchived 
                    })}
                    data-testid="button-toggle-archive"
                  >
                    {selectedThread?.isArchived ? (
                      <><ArchiveRestore className="w-4 h-4 mr-1" /> Unarchive</>
                    ) : (
                      <><Archive className="w-4 h-4 mr-1" /> Archive</>
                    )}
                  </Button>
                </div>
              </div>
            </div>

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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : messages?.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No messages yet
                </div>
              ) : (
                messages?.map(message => {
                  const isOwnMessage = message.userId === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      data-testid={`message-${message.id}`}
                    >
                      <div className={`w-full max-w-[85%] ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {!isOwnMessage && (
                            <Avatar className="w-6 h-6">
                              <AvatarFallback>
                                {getUserDisplayName(message.user).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className="text-xs font-medium text-foreground">
                            {getUserDisplayName(message.user)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div
                          className="rounded-lg p-4 bg-card border border-border shadow-sm relative"
                        >
                          {isMessageLong(message.content) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-muted z-10"
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
                            className={`text-sm prose prose-sm max-w-none break-words prose-headings:text-foreground prose-strong:font-bold prose-strong:text-foreground prose-em:italic prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-a:text-primary prose-table:border-collapse prose-th:border prose-th:border-black prose-th:p-2 prose-th:bg-muted prose-td:border prose-td:border-black prose-td:p-2 ${
                              isMessageLong(message.content) && !expandedMessages.has(message.id) 
                                ? 'max-h-[200px] overflow-hidden relative' 
                                : ''
                            }`}
                            dangerouslySetInnerHTML={{ 
                              __html: DOMPurify.sanitize(message.content, {
                                ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div'],
                                ALLOWED_ATTR: ['href', 'target', 'class', 'style', 'colspan', 'rowspan', 'data-row', 'data-column', 'data-cell'],
                                FORBID_ATTR: ['onerror', 'onload', 'contenteditable'],
                                ALLOW_DATA_ATTR: false,
                              })
                            }}
                            data-testid="message-content"
                          />
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2">
                              <AttachmentList
                                attachments={message.attachments}
                                readonly={true}
                                threadId={message.threadId}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Composer */}
            <div className="p-4 border-t">
              <div className="flex flex-col gap-3">
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm"
                        data-testid={`selected-file-${index}`}
                      >
                        <File className="w-4 h-4" />
                        <span className="max-w-[150px] truncate">{file.name}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4 p-0"
                          onClick={() => handleRemoveFile(index)}
                          data-testid={`remove-file-${index}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <TiptapEditor
                  content={newMessage}
                  onChange={setNewMessage}
                  placeholder="Type your message with rich text, tables, and formatting..."
                  className="min-h-[150px]"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="notify-immediately" 
                        checked={notifyImmediately}
                        onCheckedChange={(checked) => setNotifyImmediately(checked as boolean)}
                        data-testid="checkbox-notify-immediately"
                      />
                      <Label htmlFor="notify-immediately" className="text-sm cursor-pointer">
                        Notify colleagues immediately
                      </Label>
                    </div>

                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                      id="file-upload"
                      data-testid="input-file"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={uploadingFiles}
                      onClick={() => document.getElementById('file-upload')?.click()}
                      data-testid="button-attach-file"
                    >
                      <Paperclip className="w-4 h-4 mr-2" />
                      Attach
                    </Button>
                  </div>

                  <Button
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending || uploadingFiles}
                    data-testid="button-send"
                  >
                    {uploadingFiles ? (
                      <>
                        <span className="w-4 h-4 animate-spin mr-2">⏳</span>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>

    <NewProjectThreadModal
      open={showNewThreadModal}
      onOpenChange={setShowNewThreadModal}
      project={project}
    />
  </>
  );
}
