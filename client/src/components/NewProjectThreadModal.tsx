import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Check, Paperclip, File as FileIcon, Table as TableIcon } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { showFriendlyError } from '@/lib/friendlyErrors';
import DOMPurify from 'isomorphic-dompurify';
import { TiptapEditor } from '@/components/TiptapEditor';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface Project {
  id: string;
  clientId: string;
  currentAssigneeId: string | null;
  clientManagerId: string | null;
  bookkeeperId: string | null;
}

interface NewProjectThreadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}

export default function NewProjectThreadModal({
  open,
  onOpenChange,
  project,
}: NewProjectThreadModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [topic, setTopic] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [notifyImmediately, setNotifyImmediately] = useState(true);

  // Check if the editor has valid content (text, tables, images, or lists)
  const hasValidContent = useMemo(() => {
    if (!initialMessage) return false;
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(initialMessage, 'text/html');
    const textContent = (doc.body.textContent || '').trim();
    const hasTables = doc.querySelectorAll('table').length > 0;
    const hasImages = doc.querySelectorAll('img').length > 0;
    const hasLists = doc.querySelectorAll('ul, ol').length > 0;
    
    return textContent.length > 0 || hasTables || hasImages || hasLists;
  }, [initialMessage]);

  // Fetch all users for participant selection
  const { data: allUsers } = useQuery<User[]>({
    queryKey: ['/api/users/for-messaging'],
    enabled: open,
  });

  // Fetch project-assigned staff for prioritization
  const projectStaffIds = new Set([
    project.currentAssigneeId,
    project.clientManagerId,
    project.bookkeeperId,
    user?.id,
  ].filter(Boolean));

  // Upload files to object storage with improved error handling
  const uploadFiles = async (threadId: string, files: File[]) => {
    const uploadedAttachments = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const uploadUrlResponse = await apiRequest('POST', '/api/internal/project-messages/attachments/upload-url', {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          threadId: threadId,
        });

        const { url, objectPath } = uploadUrlResponse as any;

        const uploadResponse = await fetch(url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }

        uploadedAttachments.push({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          objectPath,
        });
      } catch (error) {
        const errorMessage = `Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    if (errors.length > 0) {
      setUploadErrors(errors);
      if (uploadedAttachments.length === 0) {
        throw new Error('All file uploads failed');
      }
    }

    return uploadedAttachments;
  };

  // Create thread mutation
  const createThreadMutation = useMutation({
    mutationFn: async (data: { topic: string; participantUserIds: string[]; initialMessage: { content: string; notifyImmediately?: boolean; attachments?: any[] } }) => {
      return await apiRequest('POST', '/api/internal/project-messages/threads', {
        projectId: project.id,
        topic: data.topic,
        participantUserIds: data.participantUserIds,
        initialMessage: data.initialMessage,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/project-messages/threads', project.id] });
      toast({
        title: "Thread created",
        description: "The conversation thread has been created with your message.",
      });
      handleClose();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleClose = () => {
    setTopic('');
    setSelectedParticipants([]);
    setSearchTerm('');
    setInitialMessage('');
    setShowSearchResults(false);
    setSelectedFiles([]);
    setUploadingFiles(false);
    setUploadErrors([]);
    setNotifyImmediately(true);
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!topic.trim()) {
      showFriendlyError({ error: "Please enter a topic for the thread" });
      return;
    }

    if (selectedParticipants.length === 0) {
      showFriendlyError({ error: "Please select at least one participant" });
      return;
    }

    // Validate message content - check for text, tables, images, or any meaningful content
    const parser = new DOMParser();
    const doc = parser.parseFromString(initialMessage, 'text/html');
    const textContent = (doc.body.textContent || '').trim();
    const hasTables = doc.querySelectorAll('table').length > 0;
    const hasImages = doc.querySelectorAll('img').length > 0;
    const hasLists = doc.querySelectorAll('ul, ol').length > 0;
    const hasContent = textContent.length > 0 || hasTables || hasImages || hasLists;
    
    if (!hasContent && selectedFiles.length === 0) {
      showFriendlyError({ error: "Please enter an initial message or attach files" });
      return;
    }

    // Sanitize HTML content before sending
    // NOTE: DOMPurify sanitizes style attribute content (removes javascript:, expression(), etc.) while preserving safe CSS
    const sanitizedMessage = DOMPurify.sanitize(initialMessage, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div'],
      ALLOWED_ATTR: ['href', 'target', 'class', 'style', 'colspan', 'rowspan', 'data-row', 'data-column', 'data-cell'],
      FORBID_ATTR: ['onerror', 'onload'],
      ALLOW_DATA_ATTR: false,
    });

    try {
      setUploadingFiles(true);
      setUploadErrors([]);

      if (selectedFiles.length > 0) {
        // Step 1: Create the thread WITHOUT an initial message
        const threadResponse = await apiRequest('POST', '/api/internal/project-messages/threads', {
          projectId: project.id,
          topic: topic.trim(),
          participantUserIds: selectedParticipants,
        }) as any;

        const threadId = threadResponse.id;

        // Step 2: Upload files using the thread ID
        const attachments = await uploadFiles(threadId, selectedFiles);

        // Step 3: Send the initial message with attachments
        // Ensure fallback text is also safe (no HTML)
        const messageContent = sanitizedMessage || '<p>(Attachment)</p>';
        await apiRequest('POST', `/api/internal/project-messages/threads/${threadId}/messages`, {
          content: messageContent,
          attachments: attachments,
          notifyImmediately,
        });

        // Step 4: Reset state, invalidate queries, show toast, and close
        setUploadingFiles(false);
        queryClient.invalidateQueries({ queryKey: ['/api/internal/project-messages/threads', project.id] });
        toast({
          title: "Thread created",
          description: "The conversation thread has been created with your message.",
        });
        handleClose();
      } else {
        // No files to upload - use existing behavior
        createThreadMutation.mutate({
          topic: topic.trim(),
          participantUserIds: selectedParticipants,
          initialMessage: {
            content: sanitizedMessage || '(Attachment)',
            notifyImmediately,
            attachments: [],
          },
        });
      }
    } catch (error: any) {
      setUploadingFiles(false);
      showFriendlyError({ error });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (selectedFiles.length + files.length > 5) {
      showFriendlyError({ error: "You can only attach up to 5 files per message" });
      return;
    }

    const validFiles = files.filter(file => {
      const isValid = file.size <= 25 * 1024 * 1024; // 25MB limit
      if (!isValid) {
        showFriendlyError({ error: `${file.name} exceeds 25MB limit` });
      }
      return isValid;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email;
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredUsers = allUsers?.filter(u =>
    getUserDisplayName(u).toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Sort users: project-assigned staff first, then alphabetically
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aIsProjectStaff = projectStaffIds.has(a.id);
    const bIsProjectStaff = projectStaffIds.has(b.id);
    
    if (aIsProjectStaff && !bIsProjectStaff) return -1;
    if (!aIsProjectStaff && bIsProjectStaff) return 1;
    
    return getUserDisplayName(a).localeCompare(getUserDisplayName(b));
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-new-thread">
        <DialogHeader>
          <DialogTitle>New Conversation Thread</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 flex-1 overflow-y-auto">
          {/* Topic Input */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter thread topic..."
              data-testid="input-topic"
            />
          </div>

          {/* Participant Selection */}
          <div className="space-y-2">
            <Label>Participants</Label>
            
            {/* Search Input */}
            <div className="relative">
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSearchResults(e.target.value.length > 0);
                }}
                onFocus={() => setShowSearchResults(searchTerm.length > 0)}
                placeholder="Search and select staff members..."
                data-testid="input-search-participants"
              />
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchTerm.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                  {sortedUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No staff members found
                    </p>
                  ) : (
                    <div className="p-1">
                      {sortedUsers.map(staffUser => {
                        const isProjectStaff = projectStaffIds.has(staffUser.id);
                        const isSelected = selectedParticipants.includes(staffUser.id);
                        
                        return (
                          <div
                            key={staffUser.id}
                            className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                            onClick={() => {
                              toggleParticipant(staffUser.id);
                              setSearchTerm('');
                              setShowSearchResults(false);
                            }}
                            data-testid={`user-item-${staffUser.id}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {getUserDisplayName(staffUser)}
                                </span>
                                {isProjectStaff && (
                                  <Badge variant="outline" className="text-xs">
                                    Project Staff
                                  </Badge>
                                )}
                                {isSelected && (
                                  <Check className="w-4 h-4 text-primary" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{staffUser.email}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Participants */}
            {selectedParticipants.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-md min-h-[40px]">
                {selectedParticipants.map(userId => {
                  const participant = allUsers?.find(u => u.id === userId);
                  if (!participant) return null;
                  
                  return (
                    <Badge
                      key={userId}
                      variant="secondary"
                      className="flex items-center gap-1"
                      data-testid={`selected-participant-${userId}`}
                    >
                      <span>{getUserDisplayName(participant)}</span>
                      <button
                        onClick={() => toggleParticipant(userId)}
                        className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                        data-testid={`remove-participant-${userId}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Initial Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Initial Message</Label>
            <TiptapEditor
              content={initialMessage}
              onChange={setInitialMessage}
              placeholder="Type or paste your message here. You can insert tables, formatted text, and content from Word or Outlook..."
              className="min-h-[300px]"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Use the table button in the toolbar to insert tables, or paste formatted content directly from Word or Outlook. The editor supports rich text formatting including bold, italic, lists, colors, and more.
            </p>
          </div>

          {/* File Attachments */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={selectedFiles.length >= 5}
                data-testid="button-attach-file"
              >
                <Paperclip className="w-4 h-4 mr-2" />
                Attach Files
              </Button>
              <span className="text-xs text-muted-foreground">
                {selectedFiles.length}/5 files (25MB max each)
              </span>
              <input
                id="file-upload"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,audio/*,.doc,.docx,.xls,.xlsx,.txt,.csv"
              />
            </div>
            
            {selectedFiles.length > 0 && (
              <div className="space-y-2 mt-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-md"
                    data-testid={`attachment-${index}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                      data-testid={`button-remove-attachment-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {uploadErrors.length > 0 && (
              <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-medium text-destructive mb-1">Upload warnings:</p>
                <ul className="text-xs text-destructive space-y-1">
                  {uploadErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-4">
          <div className="flex items-center space-x-2 mr-auto">
            <Checkbox 
              id="notify-immediately-new-thread" 
              checked={notifyImmediately}
              onCheckedChange={(checked) => setNotifyImmediately(checked as boolean)}
              data-testid="checkbox-notify-immediately"
            />
            <Label htmlFor="notify-immediately-new-thread" className="text-sm cursor-pointer">
              Notify colleagues immediately
            </Label>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createThreadMutation.isPending || uploadingFiles || !topic.trim() || selectedParticipants.length === 0 || (!hasValidContent && selectedFiles.length === 0)}
              data-testid="button-create"
            >
              {uploadingFiles ? 'Uploading...' : createThreadMutation.isPending ? 'Creating...' : 'Create Thread'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
