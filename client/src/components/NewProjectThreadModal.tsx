import { useState, useEffect, useRef } from 'react';
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
import { X, Check, Paperclip, File as FileIcon, Table as TableIcon } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'isomorphic-dompurify';

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
  const quillRef = useRef<any>(null);

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
    mutationFn: async (data: { topic: string; participantUserIds: string[]; initialMessage: string; attachments?: any[] }) => {
      return await apiRequest('POST', '/api/internal/project-messages/threads', {
        projectId: project.id,
        topic: data.topic,
        participantUserIds: data.participantUserIds,
        initialMessage: data.initialMessage ? { content: data.initialMessage, attachments: data.attachments } : null,
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
      toast({
        title: "Failed to create thread",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
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
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!topic.trim()) {
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

    // Validate message content - check for text, tables, images, or any meaningful content
    const parser = new DOMParser();
    const doc = parser.parseFromString(initialMessage, 'text/html');
    const textContent = (doc.body.textContent || '').trim();
    const hasTables = doc.querySelectorAll('table').length > 0;
    const hasImages = doc.querySelectorAll('img').length > 0;
    const hasLists = doc.querySelectorAll('ul, ol').length > 0;
    const hasContent = textContent.length > 0 || hasTables || hasImages || hasLists;
    
    if (!hasContent && selectedFiles.length === 0) {
      toast({
        title: "Message required",
        description: "Please enter an initial message or attach files",
        variant: "destructive",
      });
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
          initialMessage: sanitizedMessage || '(Attachment)',
        });
      }
    } catch (error: any) {
      setUploadingFiles(false);
      toast({
        title: "Failed to create thread",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
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

  // ReactQuill modules configuration
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['clean']
    ],
  };

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent',
    'link',
    'color', 'background',
    'align'
  ];

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
            <div className="border rounded-md min-h-[300px]" data-testid="editor-initial-message">
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={initialMessage}
                onChange={setInitialMessage}
                modules={quillModules}
                formats={quillFormats}
                placeholder="Type or paste your message here. You can paste tables, formatted text, and content from Word or Outlook..."
                className="bg-background h-[300px]"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: Paste tables and formatted content directly from Word or Outlook. The editor supports rich text formatting including bold, italic, lists, colors, and more.
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createThreadMutation.isPending || uploadingFiles || !topic.trim() || selectedParticipants.length === 0}
            data-testid="button-create"
          >
            {uploadingFiles ? 'Uploading...' : createThreadMutation.isPending ? 'Creating...' : 'Create Thread'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
