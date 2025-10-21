import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { AttachmentList, FileUploadZone, VoiceNotePlayer } from '@/components/attachments';
import NewProjectThreadModal from '@/components/NewProjectThreadModal';

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

  // Check URL for thread parameter (from push notification)
  const urlParams = new URLSearchParams(window.location.search);
  const threadFromUrl = urlParams.get('thread');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(threadFromUrl);

  // Fetch threads for this project
  const { data: threads, isLoading: threadsLoading } = useQuery<ProjectMessageThread[]>({
    queryKey: ['/api/internal/project-messages/threads', projectId],
    enabled: !!user && !!projectId,
  });

  // Fetch messages for selected thread
  const { data: messages, isLoading: messagesLoading } = useQuery<ProjectMessage[]>({
    queryKey: ['/api/internal/project-messages/threads', selectedThreadId, 'messages'],
    enabled: !!selectedThreadId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments?: any }) => {
      return await apiRequest('POST', `/api/internal/project-messages/threads/${selectedThreadId}/messages`, {
        content,
        attachments,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/project-messages/threads', selectedThreadId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/internal/project-messages/threads', projectId] });
      setNewMessage('');
      setSelectedFiles([]);
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
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    try {
      setUploadingFiles(true);
      let attachments = undefined;

      if (selectedFiles.length > 0) {
        attachments = await uploadFiles(selectedFiles);
      }

      sendMessageMutation.mutate({
        content: newMessage.trim() || '(Attachment)',
        attachments,
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

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread List */}
        <Card className="lg:col-span-1 h-[600px] flex flex-col">
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
      <Card className="lg:col-span-2 h-[600px] flex flex-col">
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
                      <div className={`max-w-[70%] ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {!isOwnMessage && (
                            <Avatar className="w-6 h-6">
                              <AvatarFallback>
                                {getUserDisplayName(message.user).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {getUserDisplayName(message.user)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div
                          className={`rounded-lg p-3 ${
                            isOwnMessage
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2">
                              <AttachmentList
                                attachments={message.attachments}
                                threadId={selectedThreadId}
                                pathPrefix="/api/internal/project-messages/attachments"
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
              <div className="flex flex-col gap-2">
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
                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="min-h-[80px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    data-testid="textarea-message"
                  />
                  <div className="flex flex-col gap-2">
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
                      size="icon"
                      variant="outline"
                      disabled={uploadingFiles}
                      onClick={() => document.getElementById('file-upload')?.click()}
                      data-testid="button-attach-file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={sendMessageMutation.isPending || uploadingFiles || (!newMessage.trim() && selectedFiles.length === 0)}
                      data-testid="button-send"
                    >
                      {uploadingFiles ? (
                        <span className="w-4 h-4 animate-spin">⏳</span>
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
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
