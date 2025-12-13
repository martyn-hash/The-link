import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Eye, MessageSquare, UserIcon, Phone, Loader2, FileText, XCircle, ArrowDown, ArrowUp, Paperclip, AlertCircle, CheckCircle, Mail } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CommunicationCard } from "@/components/communication-card";
import { getIcon, getTypeLabel, getTypeColor } from "./helpers.tsx";
import type { CommunicationListProps, TimelineItem, CommunicationTimelineItem, InboxEmailTimelineItem, UnifiedTimelineItem, InboxEmailThreadGroup } from "./types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProjectLinkProps {
  projectId: string;
  projectName?: string;
  onClick?: () => void;
}

function ProjectLink({ projectId, projectName, onClick }: ProjectLinkProps) {
  if (!projectId) return <span className="text-sm text-muted-foreground">-</span>;
  
  return (
    <button
      onClick={onClick}
      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      data-testid={`link-project-${projectId}`}
    >
      {projectName || 'Unknown Project'}
    </button>
  );
}

function getCallRecipient(item: CommunicationTimelineItem): string | null {
  const comm = item.data;
  
  if (comm.person) {
    const firstName = comm.person.firstName || '';
    const lastName = comm.person.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;
  }
  
  const metadata = comm.metadata as Record<string, any> | null;
  
  // If there's a call description (e.g., "HMRC"), show it with the phone number
  if (metadata?.callDescription) {
    return `${metadata.callDescription} (${metadata.phoneNumber || 'Unknown'})`;
  }
  
  if (metadata?.phoneNumber) {
    return metadata.phoneNumber;
  }
  
  if (comm.subject && comm.subject.includes(' - ')) {
    const parts = comm.subject.split(' - ');
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
  }
  
  return null;
}

function TranscriptionStatusIcon({ item }: { item: CommunicationTimelineItem }) {
  if (item.type !== 'phone_call') return null;
  
  const metadata = item.data.metadata as Record<string, any> | null;
  if (!metadata) return null;
  
  const status = metadata.transcriptionStatus;
  const duration = metadata.duration || 0;
  
  if (duration < 5 && !status) return null;
  
  let icon = null;
  let tooltipText = '';
  
  switch (status) {
    case 'pending':
    case 'requesting':
    case 'processing':
      icon = <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
      tooltipText = 'Transcription in progress...';
      break;
    case 'completed':
      icon = <FileText className="h-3 w-3 text-green-600 dark:text-green-400" />;
      tooltipText = 'Transcript available';
      break;
    case 'failed':
      icon = <XCircle className="h-3 w-3 text-red-500" />;
      tooltipText = 'Transcription failed';
      break;
    case 'not_available':
      return null;
    default:
      if (duration >= 5) {
        icon = <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
        tooltipText = 'Waiting for transcript...';
      }
  }
  
  if (!icon) return null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex ml-1">{icon}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DirectionIndicator({ direction }: { direction: 'inbound' | 'outbound' | null }) {
  if (!direction) return null;
  
  const isInbound = direction === 'inbound';
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${isInbound ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'}`}>
            {isInbound ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isInbound ? 'Inbound (received)' : 'Outbound (sent)'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SLABadge({ status, slaDeadline }: { status?: string; slaDeadline?: string | null }) {
  if (!status) return null;
  
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
  let label = status;
  let icon = null;
  
  switch (status) {
    case 'pending_reply':
      variant = 'outline';
      label = 'Pending';
      icon = <Clock className="h-3 w-3 mr-1" />;
      break;
    case 'replied':
      variant = 'secondary';
      label = 'Replied';
      icon = <CheckCircle className="h-3 w-3 mr-1 text-green-600" />;
      break;
    case 'overdue':
      variant = 'destructive';
      label = 'Overdue';
      icon = <AlertCircle className="h-3 w-3 mr-1" />;
      break;
    case 'no_action_needed':
      return null;
    default:
      return null;
  }
  
  return (
    <Badge variant={variant} className="text-xs flex items-center gap-0.5" data-testid={`badge-sla-${status}`}>
      {icon}
      {label}
    </Badge>
  );
}

export function CommunicationList({
  items,
  projectCache,
  onViewCommunication,
  onViewMessageThread,
  onViewEmailThread,
  onViewInboxEmail,
  onProjectClick,
}: CommunicationListProps) {
  const isMobile = useIsMobile();

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No communications recorded yet</p>
        <p className="text-sm">Add phone calls, notes, or messages to track client interactions</p>
      </div>
    );
  }

  const handleItemView = (item: TimelineItem) => {
    switch (item.kind) {
      case 'communication':
        onViewCommunication(item.data);
        break;
      case 'message_thread':
        onViewMessageThread(item.data);
        break;
      case 'email_thread':
        onViewEmailThread(item.data);
        break;
      case 'inbox_email':
        onViewInboxEmail(item);
        break;
      case 'inbox_email_thread':
        if (item.emails.length > 0) {
          onViewInboxEmail(item.emails[0]);
        }
        break;
    }
  };

  const getItemUser = (item: TimelineItem): string => {
    switch (item.kind) {
      case 'communication':
        if (item.data.user) {
          return `${item.data.user.firstName || ''} ${item.data.user.lastName || ''}`.trim() || 'Unknown';
        }
        return 'System';
      case 'email_thread':
        if (item.participants && item.participants.length > 0) {
          return `${item.participants.length} participant${item.participants.length !== 1 ? 's' : ''}`;
        }
        return 'Email';
      case 'message_thread':
        return 'Internal Message';
      case 'inbox_email':
        if (item.direction === 'inbound') {
          return item.fromName || item.fromAddress || 'Unknown sender';
        } else if (item.direction === 'outbound') {
          return item.inboxName || 'Staff';
        }
        return 'Email';
      case 'inbox_email_thread':
        return `${item.participants.length} participant${item.participants.length !== 1 ? 's' : ''}`;
      default:
        return 'System';
    }
  };

  if (isMobile) {
    return (
      <div className="space-y-3">
        {items.map((item: TimelineItem) => {
          const handleProjectClick = item.projectId && onProjectClick
            ? () => onProjectClick(item.projectId!)
            : undefined;

          return (
            <CommunicationCard
              key={item.id}
              id={item.id}
              type={item.type}
              loggedAt={item.displayDate}
              createdAt={item.displayDate}
              subject={item.subject}
              content={item.content}
              user={item.kind === 'communication' && item.data.user ? { 
                firstName: item.data.user.firstName || '', 
                lastName: item.data.user.lastName || '' 
              } : null}
              createdBy={item.kind === 'communication' ? item.data.userId : undefined}
              projectId={item.projectId}
              projectName={
                // First try embedded project data, then fallback to cache
                (item.kind === 'communication' && item.data.project?.description) ||
                projectCache[item.projectId!]?.description || 
                projectCache[item.projectId!]?.client?.name
              }
              messageCount={(item.kind === 'message_thread' || item.kind === 'email_thread' || item.kind === 'inbox_email_thread') ? item.messageCount : undefined}
              unreadCount={item.kind === 'message_thread' ? item.unreadCount : undefined}
              attachmentCount={item.kind === 'message_thread' ? item.attachmentCount : undefined}
              participants={item.kind === 'email_thread' ? item.participants : item.kind === 'inbox_email_thread' ? item.participants : undefined}
              onView={() => handleItemView(item)}
              onProjectClick={handleProjectClick}
            />
          );
        })}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Date/Time</TableHead>
          <TableHead>Subject/Content</TableHead>
          <TableHead>Created By</TableHead>
          <TableHead>Connected To</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item: TimelineItem) => (
          <TableRow key={item.id} data-testid={`communication-row-${item.id}`}>
            <TableCell data-testid={`cell-type-${item.id}`}>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  {getIcon(item.type)}
                </div>
                <Badge variant="secondary" className={getTypeColor(item.type)} data-testid={`badge-type-${item.id}`}>
                  {getTypeLabel(item.type)}
                </Badge>
              </div>
            </TableCell>
            <TableCell data-testid={`cell-date-${item.id}`}>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm" data-testid={`text-date-${item.id}`}>
                  {item.displayDate || 'No date'}
                </span>
              </div>
            </TableCell>
            <TableCell data-testid={`cell-content-${item.id}`}>
              <div className="max-w-md">
                {item.kind === 'message_thread' ? (
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {item.subject}
                      {item.attachmentCount && item.attachmentCount > 0 && (
                        <span className="inline-flex items-center text-xs text-muted-foreground">
                          📎 {item.attachmentCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.messageCount || 0} message{(item.messageCount || 0) !== 1 ? 's' : ''}
                      {item.unreadCount && item.unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {item.unreadCount} unread
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : item.kind === 'email_thread' ? (
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {item.subject || 'No Subject'}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.messageCount || 0} message{(item.messageCount || 0) !== 1 ? 's' : ''}
                      {item.participants && item.participants.length > 0 && (
                        <span className="ml-2">• {item.participants.length} participant{item.participants.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                ) : item.kind === 'inbox_email' ? (
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      <DirectionIndicator direction={item.direction} />
                      <span className="truncate max-w-[300px]">{item.subject || 'No Subject'}</span>
                      {item.hasAttachments && (
                        <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                      <SLABadge status={item.status} slaDeadline={item.slaDeadline} />
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.direction === 'inbound' ? (
                        <span>From: {item.fromName || item.fromAddress || 'Unknown'}</span>
                      ) : item.direction === 'outbound' ? (
                        <span>To: {item.toRecipients?.map(r => r.name || r.address).join(', ') || 'Unknown'}</span>
                      ) : null}
                      {item.inboxName && (
                        <span className="ml-2 text-muted-foreground/60">via {item.inboxName}</span>
                      )}
                    </div>
                    {item.content && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.content.substring(0, 80)}...
                      </div>
                    )}
                  </div>
                ) : item.kind === 'inbox_email_thread' ? (
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      <DirectionIndicator direction={item.latestDirection} />
                      <span className="truncate max-w-[300px]">{item.subject || 'No Subject'}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.messageCount} email{item.messageCount !== 1 ? 's' : ''}
                      {item.participants.length > 0 && (
                        <span className="ml-2">• {item.participants.length} participant{item.participants.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm truncate">
                    {item.subject && <div className="font-medium">{item.subject}</div>}
                    {item.content && <div className="text-muted-foreground text-xs">{item.content.substring(0, 50)}...</div>}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell data-testid={`cell-user-${item.id}`}>
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 w-4 text-muted-foreground" />
                <span className="text-sm" data-testid={`text-user-${item.id}`}>
                  {getItemUser(item)}
                </span>
              </div>
            </TableCell>
            <TableCell data-testid={`cell-connected-${item.id}`}>
              <div className="flex flex-col gap-1">
                {/* Show call recipient for phone calls */}
                {item.kind === 'communication' && item.type === 'phone_call' && (
                  (() => {
                    const recipient = getCallRecipient(item);
                    return recipient ? (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">{recipient}</span>
                        <TranscriptionStatusIcon item={item} />
                      </div>
                    ) : null;
                  })()
                )}
                {/* Show project link if available */}
                {item.projectId ? (
                  <ProjectLink 
                    projectId={item.projectId} 
                    projectName={
                      (item.kind === 'communication' && item.data.project?.description) ||
                      projectCache[item.projectId]?.description || 
                      projectCache[item.projectId]?.client?.name
                    }
                    onClick={onProjectClick ? () => onProjectClick(item.projectId!) : undefined}
                  />
                ) : (
                  /* Only show dash if no recipient and no project */
                  !(item.kind === 'communication' && item.type === 'phone_call' && getCallRecipient(item)) && (
                    <span className="text-sm text-muted-foreground">-</span>
                  )
                )}
              </div>
            </TableCell>
            <TableCell>
              {item.kind === 'message_thread' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewMessageThread(item.data)}
                  data-testid={`button-view-thread-${item.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Thread
                </Button>
              ) : item.kind === 'email_thread' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewEmailThread(item.data)}
                  data-testid={`button-view-email-thread-${item.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Thread
                </Button>
              ) : item.kind === 'inbox_email' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewInboxEmail(item)}
                  data-testid={`button-view-inbox-email-${item.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </Button>
              ) : item.kind === 'inbox_email_thread' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (item.emails.length > 0) {
                      onViewInboxEmail(item.emails[0]);
                    }
                  }}
                  data-testid={`button-view-inbox-thread-${item.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Thread
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewCommunication(item.data)}
                  data-testid={`button-view-communication-${item.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
