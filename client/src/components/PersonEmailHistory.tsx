import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Mail, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Paperclip,
  ChevronDown,
  ChevronUp,
  Calendar,
  X
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import DOMPurify from 'isomorphic-dompurify';
import { EmailThreadViewer } from './EmailThreadViewer';

interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

interface EmailMessage {
  internetMessageId: string;
  canonicalConversationId: string;
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

interface PersonEmailHistoryProps {
  personId: string;
  personName?: string;
  showHeader?: boolean;
  maxHeight?: string;
}

export function PersonEmailHistory({ 
  personId, 
  personName,
  showHeader = true,
  maxHeight = "600px"
}: PersonEmailHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadViewerOpen, setThreadViewerOpen] = useState(false);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  const queryUrl = debouncedSearch 
    ? `/api/emails/person/${personId}?search=${encodeURIComponent(debouncedSearch)}`
    : `/api/emails/person/${personId}`;

  const { data, isLoading, error } = useQuery<{
    person: { id: string; fullName: string; emails: string[] };
    messages: EmailMessage[];
    total: number;
    limit: number;
    offset: number;
  }>({
    queryKey: ['/api/emails/person', personId, debouncedSearch],
    queryFn: async () => {
      const res = await fetch(queryUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch emails');
      return res.json();
    },
    enabled: !!personId,
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

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'inbound':
        return <ArrowDownLeft className="h-3 w-3 text-blue-500" />;
      case 'outbound':
        return <ArrowUpRight className="h-3 w-3 text-green-500" />;
      default:
        return <Mail className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getDirectionLabel = (direction: string) => {
    switch (direction) {
      case 'inbound':
        return 'Received';
      case 'outbound':
        return 'Sent';
      case 'internal':
        return 'Internal';
      default:
        return direction;
    }
  };

  const sanitizeHtml = (html: string | null, maxLength: number = 200, isExpanded: boolean = false): string => {
    if (!html) return '';
    
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'span', 'div'],
      ALLOWED_ATTR: ['href', 'target', 'rel']
    });
    
    if (isExpanded || sanitized.length <= maxLength) {
      return sanitized;
    }
    
    return sanitized.substring(0, maxLength) + '...';
  };

  const handleViewThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setThreadViewerOpen(true);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Unable to load email history</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const content = (
    <>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails by subject or content..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
            data-testid="input-search-person-emails"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => {
                setSearchQuery('');
                setDebouncedSearch('');
              }}
              data-testid="button-clear-search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {data?.person?.emails && data.person.emails.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          <span className="text-sm text-muted-foreground">Emails:</span>
          {data.person.emails.map((email, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs" data-testid={`badge-person-email-${idx}`}>
              {email}
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 p-3 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : data?.messages && data.messages.length > 0 ? (
        <ScrollArea className="pr-4" style={{ maxHeight }}>
          <div className="space-y-2">
            {data.messages.map((message) => {
              const isExpanded = expandedMessages.has(message.internetMessageId);
              
              return (
                <div
                  key={message.internetMessageId}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => toggleMessageExpansion(message.internetMessageId)}
                  data-testid={`email-item-${message.internetMessageId}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {getInitials(message.from)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {getDirectionIcon(message.direction)}
                          <span className="font-medium text-sm truncate">
                            {message.from}
                          </span>
                          {message.hasAttachments && (
                            <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className="text-xs">
                            {getDirectionLabel(message.direction)}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      
                      <p className="font-medium text-sm mb-1 truncate">
                        {message.subject || '(No subject)'}
                      </p>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(message.receivedDateTime), 'MMM d, yyyy h:mm a')}
                        </span>
                        <span className="text-muted-foreground/60">
                          ({formatDistanceToNow(new Date(message.receivedDateTime), { addSuffix: true })})
                        </span>
                      </div>
                      
                      {!isExpanded && message.bodyPreview && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.bodyPreview}
                        </p>
                      )}
                      
                      {isExpanded && (
                        <div className="mt-3 space-y-3">
                          <div className="text-xs space-y-1">
                            {message.to && message.to.length > 0 && (
                              <p><span className="font-medium">To:</span> {message.to.join(', ')}</p>
                            )}
                            {message.cc && message.cc.length > 0 && (
                              <p><span className="font-medium">Cc:</span> {message.cc.join(', ')}</p>
                            )}
                          </div>
                          
                          {message.body ? (
                            <div 
                              className="text-sm prose prose-sm max-w-none dark:prose-invert border-t pt-3"
                              dangerouslySetInnerHTML={{ 
                                __html: sanitizeHtml(message.body, 1000, true) 
                              }}
                            />
                          ) : message.bodyPreview ? (
                            <p className="text-sm border-t pt-3">{message.bodyPreview}</p>
                          ) : null}
                          
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="border-t pt-3">
                              <p className="text-xs font-medium mb-2 flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />
                                Attachments ({message.attachments.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {message.attachments.map((att) => (
                                  <Badge 
                                    key={att.id} 
                                    variant="secondary" 
                                    className="text-xs"
                                    data-testid={`attachment-${att.id}`}
                                  >
                                    {att.filename}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="border-t pt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewThread(message.canonicalConversationId);
                              }}
                              data-testid="button-view-full-thread"
                            >
                              <Mail className="h-4 w-4 mr-2" />
                              View Full Thread
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {data.total > data.messages.length && (
            <div className="text-center mt-4 text-sm text-muted-foreground">
              Showing {data.messages.length} of {data.total} emails
            </div>
          )}
        </ScrollArea>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No emails found</p>
          <p className="text-sm mt-1">
            {debouncedSearch 
              ? `No emails matching "${debouncedSearch}"`
              : data?.person?.emails?.length 
                ? "No email history available for this person yet"
                : "This person doesn't have any email addresses on file"
            }
          </p>
        </div>
      )}

      <EmailThreadViewer
        threadId={selectedThreadId}
        open={threadViewerOpen}
        onOpenChange={setThreadViewerOpen}
      />
    </>
  );

  if (!showHeader) {
    return <div className="p-4">{content}</div>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5" />
          Email History
          {personName && <span className="text-muted-foreground font-normal">for {personName}</span>}
          {data?.total !== undefined && data.total > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {data.total} {data.total === 1 ? 'email' : 'emails'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
