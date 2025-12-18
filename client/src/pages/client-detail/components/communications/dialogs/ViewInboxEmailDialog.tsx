import DOMPurify from "isomorphic-dompurify";
import { Clock, UserIcon, Mail, Paperclip, ArrowDown, ArrowUp, CheckCircle, AlertCircle, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InboxEmailTimelineItem, InboxEmailThreadGroup } from "../types";

export interface ViewInboxEmailDialogProps {
  email: InboxEmailTimelineItem | null;
  thread?: InboxEmailThreadGroup | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatRecipients(recipients?: { address: string; name: string }[]): string {
  if (!recipients || recipients.length === 0) return '—';
  return recipients.map(r => r.name || r.address).join(', ');
}

function getSlaStatus(slaDeadline: string | null | undefined, status: string | undefined): { label: string; color: string } | null {
  if (!slaDeadline) return null;
  
  if (status === 'replied') {
    return { label: 'Replied', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
  }
  
  const deadline = new Date(slaDeadline);
  const now = new Date();
  
  if (deadline < now) {
    return { label: 'Overdue', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
  }
  
  return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' };
}

function SingleEmailView({ email }: { email: InboxEmailTimelineItem }) {
  const slaStatus = getSlaStatus(email.slaDeadline, email.status);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <span className="text-xs text-muted-foreground">Direction</span>
          <div className="mt-1">
            <Badge 
              variant="secondary" 
              className={email.direction === 'inbound' 
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              }
              data-testid={`badge-direction-${email.id}`}
            >
              {email.direction === 'inbound' ? (
                <><ArrowDown className="h-3 w-3 mr-1" />Inbound</>
              ) : (
                <><ArrowUp className="h-3 w-3 mr-1" />Outbound</>
              )}
            </Badge>
          </div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Date/Time</span>
          <div className="mt-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm" data-testid={`text-date-${email.id}`}>
              {email.displayDate}
            </span>
          </div>
        </div>
        {slaStatus && (
          <div>
            <span className="text-xs text-muted-foreground">SLA Status</span>
            <div className="mt-1">
              <Badge variant="secondary" className={slaStatus.color} data-testid={`badge-sla-${email.id}`}>
                {slaStatus.label === 'Replied' && <CheckCircle className="h-3 w-3 mr-1" />}
                {slaStatus.label === 'Overdue' && <AlertCircle className="h-3 w-3 mr-1" />}
                {slaStatus.label}
              </Badge>
            </div>
          </div>
        )}
        <div>
          <span className="text-xs text-muted-foreground">From</span>
          <div className="mt-1 flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm" data-testid={`text-from-${email.id}`}>
              {email.fromName || email.fromAddress || '—'}
            </span>
          </div>
        </div>
        <div className="col-span-2">
          <span className="text-xs text-muted-foreground">To</span>
          <div className="mt-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm truncate" data-testid={`text-to-${email.id}`}>
              {formatRecipients(email.toRecipients)}
            </span>
          </div>
        </div>
        {email.hasAttachments && (
          <div>
            <span className="text-xs text-muted-foreground">Attachments</span>
            <div className="mt-1 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Has attachments</span>
            </div>
          </div>
        )}
        {email.inboxName && (
          <div>
            <span className="text-xs text-muted-foreground">Inbox</span>
            <div className="mt-1">
              <span className="text-sm" data-testid={`text-inbox-${email.id}`}>
                {email.inboxName}
              </span>
            </div>
          </div>
        )}
      </div>

      {email.subject && (
        <div>
          <span className="text-xs text-muted-foreground font-medium">Subject</span>
          <h4 className="font-medium text-lg mt-1" data-testid={`text-subject-${email.id}`}>
            {email.subject}
          </h4>
        </div>
      )}

      {email.content && (
        <div className="flex-1">
          <span className="text-xs text-muted-foreground font-medium">Content</span>
          <ScrollArea className="h-[300px] mt-2 rounded-lg border">
            <div className="p-4 bg-muted/30" data-testid={`div-content-${email.id}`}>
              {email.data.metadata && typeof email.data.metadata === 'object' && 'bodyHtml' in (email.data.metadata as any) ? (
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100 [&_th]:dark:bg-gray-800 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize((email.data.metadata as any).bodyHtml, {
                      ALLOWED_TAGS: ['br', 'p', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'img', 'blockquote', 'pre', 'code'],
                      ALLOWED_ATTR: ['href', 'style', 'class', 'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'width', 'src', 'alt', 'title', 'height', 'target'],
                      ALLOW_DATA_ATTR: false
                    })
                  }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{email.content}</p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function ThreadEmailItem({ email, isFirst }: { email: InboxEmailTimelineItem; isFirst: boolean }) {
  return (
    <div className={`${!isFirst ? 'pt-4' : ''}`}>
      {!isFirst && <Separator className="mb-4" />}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Badge 
              variant="secondary" 
              className={`flex-shrink-0 ${email.direction === 'inbound' 
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              }`}
            >
              {email.direction === 'inbound' ? (
                <><ArrowDown className="h-3 w-3 mr-1" />In</>
              ) : (
                <><ArrowUp className="h-3 w-3 mr-1" />Out</>
              )}
            </Badge>
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">
                {email.direction === 'inbound' 
                  ? (email.fromName || email.fromAddress || 'Unknown')
                  : `To: ${formatRecipients(email.toRecipients)}`
                }
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" />
                {email.displayDate}
                {email.hasAttachments && <Paperclip className="h-3 w-3" />}
              </div>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border bg-muted/30 p-4">
          {email.data.metadata && typeof email.data.metadata === 'object' && 'bodyHtml' in (email.data.metadata as any) ? (
            <div 
              className="prose prose-sm dark:prose-invert max-w-none [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100 [&_th]:dark:bg-gray-800 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded"
              dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize((email.data.metadata as any).bodyHtml, {
                  ALLOWED_TAGS: ['br', 'p', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'img', 'blockquote', 'pre', 'code'],
                  ALLOWED_ATTR: ['href', 'style', 'class', 'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'width', 'src', 'alt', 'title', 'height', 'target'],
                  ALLOW_DATA_ATTR: false
                })
              }}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{email.content}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ViewInboxEmailDialog({ 
  email, 
  thread,
  isOpen, 
  onClose 
}: ViewInboxEmailDialogProps) {
  const isThreadView = !!thread && thread.emails.length > 0;
  
  if (!email && !thread) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isThreadView ? (
              <>
                <Layers className="h-5 w-5" />
                Email Thread ({thread!.messageCount} emails)
              </>
            ) : (
              <>
                <Mail className="h-5 w-5" />
                Email Details
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {isThreadView ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-4 py-2 bg-muted/50 rounded-lg mb-4">
              <h4 className="font-medium" data-testid="thread-subject">
                {thread!.subject || 'No Subject'}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {thread!.participants.length} participant{thread!.participants.length !== 1 ? 's' : ''}: {thread!.participants.join(', ')}
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-0 pr-4">
                {thread!.emails.map((email, index) => (
                  <ThreadEmailItem 
                    key={email.id} 
                    email={email} 
                    isFirst={index === 0}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : email ? (
          <div className="flex-1 overflow-auto">
            <SingleEmailView email={email} />
          </div>
        ) : null}

        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={() => onClose()}
            data-testid="button-close-inbox-email-detail"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
