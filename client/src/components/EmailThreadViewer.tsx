import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AttachmentList, AttachmentPreview, FileUploadZone, type AttachmentData } from '@/components/attachments';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  ChevronDown, 
  ChevronUp, 
  Mail, 
  Calendar,
  User,
  Paperclip,
  Reply,
  ReplyAll,
  Send,
  X,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import DOMPurify from 'isomorphic-dompurify';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface EmailAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  objectPath: string;
}

interface EmailMessage {
  internetMessageId: string;
  from: string;
  to: string[] | null;
  cc: string[] | null;
  subject: string | null;
  body: string | null;
  bodyPreview: string | null;
  receivedDateTime: string;
  sentDateTime: string | null;
  direction: 'inbound' | 'outbound' | 'internal' | 'external';
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
}

interface EmailThread {
  canonicalConversationId: string;
  subject: string | null;
  participants: string[] | null;
  firstMessageAt: string;
  lastMessageAt: string;
  messageCount: number;
}

interface EmailThreadViewerProps {
  threadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailThreadViewer({ threadId, open, onOpenChange }: EmailThreadViewerProps) {
  const { toast } = useToast();
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Reply form state
  const [isReplying, setIsReplying] = useState(false);
  const [replyType, setReplyType] = useState<'reply' | 'reply-all'>('reply');
  const [replyBody, setReplyBody] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);

  // Reset reply state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsReplying(false);
      setReplyBody('');
      setReplyAttachments([]);
      setExpandedMessages(new Set());
    }
    onOpenChange(newOpen);
  };

  const { data: threadData, isLoading } = useQuery<{
    thread: EmailThread;
    messages: EmailMessage[];
  }>({
    queryKey: ['/api/emails/thread', threadId],
    enabled: !!threadId && open,
  });

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

  const getInitials = (email: string) => {
    const name = email.split('@')[0];
    return name.substring(0, 2).toUpperCase();
  };

  const getDirectionBadge = (direction: string) => {
    switch (direction) {
      case 'inbound':
        return <Badge variant="secondary" data-testid="badge-direction-inbound">Received</Badge>;
      case 'outbound':
        return <Badge variant="default" data-testid="badge-direction-outbound">Sent</Badge>;
      case 'internal':
        return <Badge variant="outline" data-testid="badge-direction-internal">Internal</Badge>;
      default:
        return null;
    }
  };

  const handlePreviewAttachment = async (attachment: EmailAttachment) => {
    try {
      // Fetch signed URL for the attachment
      const response = await fetch(`/api/emails/attachments/${attachment.id}`);
      if (!response.ok) {
        console.error('Failed to get attachment URL');
        return;
      }
      
      const data = await response.json();
      
      setPreviewAttachment({
        fileName: attachment.fileName,
        fileType: attachment.contentType,
        fileSize: attachment.fileSize,
        objectPath: attachment.objectPath,
        url: data.url
      });
      setPreviewOpen(true);
    } catch (error) {
      console.error('Error previewing attachment:', error);
    }
  };
  
  const sanitizeAndTruncate = (html: string | null, maxLength: number, isExpanded: boolean): string => {
    if (!html) return '';
    
    // Sanitize HTML first
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      ALLOWED_ATTR: ['href', 'target', 'rel']
    });
    
    // If expanded or content is short, return sanitized HTML
    if (isExpanded || sanitized.length <= maxLength) {
      return sanitized;
    }
    
    // For truncation, use bodyPreview instead of truncating HTML
    return sanitized.substring(0, maxLength) + '...';
  };

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async (data: { messageId: string; to: string[]; cc: string[]; subject: string; body: string; attachments: File[] }) => {
      // Step 1: Upload attachments to get metadata
      let attachmentMetadata: any[] = [];
      if (data.attachments.length > 0) {
        const formData = new FormData();
        data.attachments.forEach(file => formData.append('files', file));

        const uploadResponse = await fetch('/api/upload/attachments', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!uploadResponse.ok) throw new Error('Failed to upload attachments');
        attachmentMetadata = await uploadResponse.json();
      }

      // Step 2: Send the reply with attachment metadata using apiRequest
      return await apiRequest(`/api/emails/${data.messageId}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          to: data.to,
          cc: data.cc,
          subject: data.subject,
          body: data.body,
          replyAll: replyType === 'reply-all',
          attachments: attachmentMetadata,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      toast({
        title: 'Reply sent',
        description: 'Your email reply has been sent successfully.',
      });
      setIsReplying(false);
      setReplyBody('');
      setReplyAttachments([]);
      
      // Invalidate queries to refresh email threads
      queryClient.invalidateQueries({ queryKey: ['/api/emails/thread', threadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/emails/my-threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/emails/client'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send reply',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleReply = (type: 'reply' | 'reply-all') => {
    setReplyType(type);
    setIsReplying(true);
    setReplyBody('');
    setReplyAttachments([]);
  };

  const handleSendReply = () => {
    if (!threadData?.messages || threadData.messages.length === 0) return;
    if (!replyBody.trim()) {
      toast({
        title: 'Email body required',
        description: 'Please enter a message before sending.',
        variant: 'destructive',
      });
      return;
    }

    // Get the latest message to reply to
    const latestMessage = threadData.messages[threadData.messages.length - 1];
    
    // Determine recipients based on reply type
    const to = replyType === 'reply-all' 
      ? [...(latestMessage.to || []), latestMessage.from].filter((email, index, self) => self.indexOf(email) === index)
      : [latestMessage.from];
    
    const cc = replyType === 'reply-all' ? (latestMessage.cc || []) : [];
    
    const subject = latestMessage.subject?.startsWith('Re:') 
      ? latestMessage.subject 
      : `Re: ${latestMessage.subject || 'No Subject'}`;

    replyMutation.mutate({
      messageId: latestMessage.internetMessageId,
      to,
      cc,
      subject,
      body: replyBody,
      attachments: replyAttachments,
    });
  };

  const handleCancelReply = () => {
    setIsReplying(false);
    setReplyBody('');
    setReplyAttachments([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0" data-testid="dialog-email-thread">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2" data-testid="text-thread-subject">
            <Mail className="h-5 w-5" />
            {isLoading ? (
              <Skeleton className="h-6 w-64" />
            ) : (
              <span>{threadData?.thread.subject || 'No Subject'}</span>
            )}
          </DialogTitle>
          
          {isLoading ? (
            <div className="flex gap-2 mt-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-32" />
            </div>
          ) : threadData?.thread.participants && threadData.thread.participants.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {threadData.thread.participants.map((participant, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline" 
                  className="gap-1"
                  data-testid={`badge-participant-${idx}`}
                >
                  <User className="h-3 w-3" />
                  {participant}
                </Badge>
              ))}
            </div>
          ) : null}
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : threadData?.messages && threadData.messages.length > 0 ? (
            <div className="space-y-4">
              {threadData.messages.map((message) => {
                const isExpanded = expandedMessages.has(message.internetMessageId);
                const bodyContent = message.body || message.bodyPreview || '';
                const needsExpansion = bodyContent.length > 300;
                const displayHtml = sanitizeAndTruncate(bodyContent, 300, isExpanded);

                // Convert email attachments to AttachmentData format for AttachmentList
                const attachmentData: AttachmentData[] = message.attachments?.map(att => ({
                  fileName: att.fileName,
                  fileType: att.contentType,
                  fileSize: att.fileSize,
                  objectPath: att.objectPath,
                  // URL will be fetched on preview
                })) || [];

                return (
                  <Card key={message.internetMessageId} data-testid={`card-message-${message.internetMessageId}`}>
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <Avatar data-testid={`avatar-sender-${message.internetMessageId}`}>
                          <AvatarFallback className="text-xs">
                            {getInitials(message.from)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium" data-testid={`text-sender-${message.internetMessageId}`}>
                                  {message.from}
                                </span>
                                {getDirectionBadge(message.direction)}
                              </div>
                              
                              {message.to && message.to.length > 0 && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  <span className="font-medium">To:</span> {message.to.join(', ')}
                                </div>
                              )}
                              
                              {message.cc && message.cc.length > 0 && (
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium">CC:</span> {message.cc.join(', ')}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1" data-testid={`text-date-${message.internetMessageId}`}>
                                <Calendar className="h-3 w-3" />
                                {format(new Date(message.receivedDateTime), 'PPp')}
                              </div>
                              <span className="text-xs">
                                {formatDistanceToNow(new Date(message.receivedDateTime), { addSuffix: true })}
                              </span>
                            </div>
                          </div>

                          <div className="prose prose-sm max-w-none mt-3">
                            <div 
                              className="whitespace-pre-wrap text-sm"
                              data-testid={`text-body-${message.internetMessageId}`}
                              dangerouslySetInnerHTML={{ __html: displayHtml }}
                            />
                          </div>

                          {needsExpansion && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleMessageExpansion(message.internetMessageId)}
                              className="mt-2"
                              data-testid={`button-expand-${message.internetMessageId}`}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                  Show less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  Show more
                                </>
                              )}
                            </Button>
                          )}

                          {message.hasAttachments && message.attachments && message.attachments.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Paperclip className="h-4 w-4" />
                                Attachments ({message.attachments.length})
                              </div>
                              <AttachmentList
                                attachments={attachmentData}
                                readonly={true}
                                onPreview={(_, index) => {
                                  if (message.attachments && message.attachments[index]) {
                                    handlePreviewAttachment(message.attachments[index]);
                                  }
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* Reply/Reply All Buttons */}
              {!isReplying && (
                <div className="flex gap-2 mt-6 pt-4 border-t">
                  <Button
                    variant="default"
                    onClick={() => handleReply('reply')}
                    data-testid="button-reply"
                  >
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReply('reply-all')}
                    data-testid="button-reply-all"
                  >
                    <ReplyAll className="h-4 w-4 mr-2" />
                    Reply All
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mb-3 opacity-50" />
              <p>No messages in this thread</p>
            </div>
          )}
        </ScrollArea>

        {/* Reply Compose Interface */}
        {isReplying && threadData?.messages && threadData.messages.length > 0 && (
          <>
            <Separator />
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  {replyType === 'reply-all' ? (
                    <>
                      <ReplyAll className="h-4 w-4" />
                      Reply All
                    </>
                  ) : (
                    <>
                      <Reply className="h-4 w-4" />
                      Reply
                    </>
                  )}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelReply}
                  data-testid="button-cancel-reply"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Recipients Display */}
              {(() => {
                const latestMessage = threadData.messages[threadData.messages.length - 1];
                const to = replyType === 'reply-all' 
                  ? [...(latestMessage.to || []), latestMessage.from].filter((email, index, self) => self.indexOf(email) === index)
                  : [latestMessage.from];
                const cc = replyType === 'reply-all' ? (latestMessage.cc || []) : [];
                
                return (
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="font-medium">To:</span> {to.join(', ')}
                    </div>
                    {cc.length > 0 && (
                      <div>
                        <span className="font-medium">CC:</span> {cc.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Rich Text Editor */}
              <div className="border rounded-md">
                <ReactQuill
                  value={replyBody}
                  onChange={setReplyBody}
                  placeholder="Type your reply..."
                  className="h-48"
                  data-testid="editor-reply-body"
                />
              </div>

              {/* Attachment Upload */}
              <div>
                <FileUploadZone
                  onFilesSelected={setReplyAttachments}
                  maxFiles={5}
                  maxSize={25 * 1024 * 1024} // 25MB
                />
                {replyAttachments.length > 0 && (
                  <div className="mt-2">
                    <AttachmentList
                      attachments={replyAttachments.map(file => ({
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                      }))}
                      readonly={false}
                      onRemove={(index) => {
                        setReplyAttachments(prev => prev.filter((_, i) => i !== index));
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Send Button */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelReply}
                  data-testid="button-cancel-reply-bottom"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendReply}
                  disabled={replyMutation.isPending || !replyBody.trim()}
                  data-testid="button-send-reply"
                >
                  {replyMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
      
      {previewAttachment && (
        <AttachmentPreview
          attachment={previewAttachment}
          open={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewAttachment(null);
          }}
        />
      )}
    </Dialog>
  );
}
