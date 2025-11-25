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
import { Clock, Eye, MessageSquare, UserIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CommunicationCard } from "@/components/communication-card";
import { getIcon, getTypeLabel, getTypeColor } from "./helpers.tsx";
import type { CommunicationListProps, TimelineItem, CommunicationWithRelations } from "./types";

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

export function CommunicationList({
  items,
  projectCache,
  onViewCommunication,
  onViewMessageThread,
  onViewEmailThread,
  onProjectClick,
}: CommunicationListProps & { onProjectClick?: (projectId: string) => void }) {
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

  if (isMobile) {
    return (
      <div className="space-y-3">
        {items.map((item: TimelineItem) => {
          const handleView = () => {
            if (item.type === 'message_thread') {
              onViewMessageThread(item.id);
            } else if (item.type === 'email_thread') {
              onViewEmailThread(item.id);
            } else {
              onViewCommunication(item as unknown as CommunicationWithRelations);
            }
          };

          const handleProjectClick = item.projectId && onProjectClick
            ? () => onProjectClick(item.projectId!)
            : undefined;

          return (
            <CommunicationCard
              key={item.id}
              id={item.id}
              type={item.type}
              loggedAt={item.loggedAt as string | Date}
              createdAt={item.createdAt as string | Date}
              subject={item.subject}
              content={item.content}
              user={item.user}
              createdBy={item.createdBy}
              projectId={item.projectId}
              projectName={projectCache[item.projectId!]?.description || projectCache[item.projectId!]?.client?.name}
              messageCount={item.messageCount}
              unreadCount={item.unreadCount}
              attachmentCount={item.attachmentCount}
              participants={item.participants}
              onView={handleView}
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
                  {item.loggedAt ? new Date(item.loggedAt as string).toLocaleString() : 
                   item.createdAt ? new Date(item.createdAt as string).toLocaleString() : 'No date'}
                </span>
              </div>
            </TableCell>
            <TableCell data-testid={`cell-content-${item.id}`}>
              <div className="max-w-md">
                {item.type === 'message_thread' ? (
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
                ) : item.type === 'email_thread' ? (
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
                  {item.type === 'email_thread' ? (
                    item.participants && item.participants.length > 0 
                      ? `${item.participants.length} participant${item.participants.length !== 1 ? 's' : ''}`
                      : 'Email'
                  ) : item.user ? (
                    `${item.user.firstName} ${item.user.lastName}`
                  ) : item.createdBy ? (
                    `User ${item.createdBy}`
                  ) : (
                    'System'
                  )}
                </span>
              </div>
            </TableCell>
            <TableCell data-testid={`cell-connected-${item.id}`}>
              {item.projectId ? (
                <ProjectLink 
                  projectId={item.projectId} 
                  projectName={projectCache[item.projectId]?.description || projectCache[item.projectId]?.client?.name}
                  onClick={onProjectClick ? () => onProjectClick(item.projectId!) : undefined}
                />
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              {item.type === 'message_thread' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewMessageThread(item.id)}
                  data-testid={`button-view-thread-${item.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Thread
                </Button>
              ) : item.type === 'email_thread' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewEmailThread(item.id)}
                  data-testid={`button-view-email-thread-${item.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Thread
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewCommunication(item as unknown as CommunicationWithRelations)}
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
