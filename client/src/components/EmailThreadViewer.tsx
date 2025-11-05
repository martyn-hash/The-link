import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { AttachmentList, AttachmentPreview, type AttachmentData } from '@/components/attachments';
import { 
  ChevronDown, 
  ChevronUp, 
  Mail, 
  Calendar,
  User,
  Paperclip
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import DOMPurify from 'isomorphic-dompurify';

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
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mb-3 opacity-50" />
              <p>No messages in this thread</p>
            </div>
          )}
        </ScrollArea>
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
