import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import type { ProjectWithRelations } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, MessageSquare, CheckCircle, Mail, Phone, FileText, StickyNote, MessageCircle } from "lucide-react";

interface ProjectChronologyProps {
  project: ProjectWithRelations;
}

// Unified timeline entry type
interface TimelineEntry {
  id: string;
  timestamp: Date;
  type: 'stage_change' | 'task_created' | 'task_completed' | 'phone_call' | 'note' | 'sms_sent' | 'sms_received' | 'email_sent' | 'email_received' | 'message_thread';
  detail: string;
  assignedTo?: string;
  changedBy?: string;
  timeInChange?: string;
  rawData: any;
}

// Helper function to format stage names for display
const formatStageName = (stageName: string): string => {
  return stageName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to format change reason for display
const formatChangeReason = (reason: string): string => {
  return reason
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function ProjectChronology({ project }: ProjectChronologyProps) {
  const [, setLocation] = useLocation();

  // Helper function to format time duration
  const formatDuration = (totalMinutes: number | null) => {
    if (!totalMinutes || totalMinutes === 0) return "0m";
    
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    
    if (totalMinutes < 60) {
      return `${totalMinutes}m`;
    }
    
    if (totalMinutes < 60 * 24) {
      if (minutes === 0) {
        return `${hours}h`;
      }
      return `${hours}h ${minutes}m`;
    }
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ');
  };

  // Fetch project tasks
  const { data: tasks } = useQuery<any[]>({
    queryKey: ['/api/internal-tasks/project', project.id],
    enabled: !!project.id,
  });

  // Fetch project communications (progress notes)
  const { data: communications } = useQuery<any[]>({
    queryKey: [`/api/projects/${project.id}/communications`],
    enabled: !!project.id,
  });

  // Fetch client message threads and filter for this project
  const { data: allThreads } = useQuery<any[]>({
    queryKey: ['/api/internal/messages/threads/client', project.clientId],
    enabled: !!project.clientId,
  });

  // Filter threads for this project
  const messageThreads = useMemo(() => {
    if (!allThreads) return [];
    return allThreads.filter((thread: any) => thread.projectId === project.id);
  }, [allThreads, project.id]);

  // Build unified timeline
  const timeline = useMemo((): TimelineEntry[] => {
    const entries: TimelineEntry[] = [];

    // Add stage changes from chronology
    if (project.chronology) {
      project.chronology.forEach((entry: any) => {
        const detail = entry.fromStatus 
          ? `${formatStageName(entry.fromStatus)} → ${formatStageName(entry.toStatus)}`
          : `Project created in ${formatStageName(entry.toStatus)}`;
        
        entries.push({
          id: `stage-${entry.id}`,
          timestamp: new Date(entry.timestamp),
          type: 'stage_change',
          detail,
          assignedTo: entry.assignee ? `${entry.assignee.firstName} ${entry.assignee.lastName}` : undefined,
          changedBy: entry.changedBy ? `${entry.changedBy.firstName} ${entry.changedBy.lastName}` : 'System',
          timeInChange: entry.timeInPreviousStage ? formatDuration(entry.timeInPreviousStage) : undefined,
          rawData: entry,
        });
      });
    }

    // Add tasks
    if (tasks) {
      tasks.forEach((task: any) => {
        // Task created
        if (task.createdAt) {
          entries.push({
            id: `task-created-${task.id}`,
            timestamp: new Date(task.createdAt),
            type: 'task_created',
            detail: task.title,
            assignedTo: task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Unassigned',
            changedBy: task.creator ? `${task.creator.firstName} ${task.creator.lastName}` : 'System',
            rawData: task,
          });
        }

        // Task completed
        if (task.completedAt) {
          entries.push({
            id: `task-completed-${task.id}`,
            timestamp: new Date(task.completedAt),
            type: 'task_completed',
            detail: task.title,
            assignedTo: task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : undefined,
            changedBy: task.completedBy ? `${task.completedBy.firstName} ${task.completedBy.lastName}` : undefined,
            rawData: task,
          });
        }
      });
    }

    // Add communications (progress notes)
    if (communications) {
      communications.forEach((comm: any) => {
        const typeLabels: Record<string, string> = {
          phone_call: 'Phone Call',
          note: 'Note',
          sms_sent: 'SMS Sent',
          sms_received: 'SMS Received',
          email_sent: 'Email Sent',
          email_received: 'Email Received',
        };

        // Use subject as detail, fall back to type label
        const detail = comm.subject || typeLabels[comm.type] || comm.type;
        
        // Use actualContactTime as primary timestamp, fall back to loggedAt or createdAt
        const commTimestamp = comm.actualContactTime || comm.loggedAt || comm.createdAt;
        
        entries.push({
          id: `comm-${comm.id}`,
          timestamp: new Date(commTimestamp),
          type: comm.type, // Use actual communication type instead of generic 'communication'
          detail,
          changedBy: comm.user ? `${comm.user.firstName} ${comm.user.lastName}` : 'System',
          rawData: comm,
        });
      });
    }

    // Add message threads
    if (messageThreads) {
      messageThreads.forEach((thread: any) => {
        entries.push({
          id: `thread-${thread.id}`,
          timestamp: new Date(thread.createdAt),
          type: 'message_thread',
          detail: thread.subject,
          changedBy: thread.createdBy ? `${thread.createdBy.firstName} ${thread.createdBy.lastName}` : 'Client Portal User',
          rawData: thread,
        });
      });
    }

    // Sort by timestamp descending (newest first)
    return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [project.chronology, tasks, communications, messageThreads, formatDuration]);

  // Get icon for entry type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'stage_change':
        return <Badge variant="outline" className="gap-1"><FileText className="w-3 h-3" />Stage Change</Badge>;
      case 'task_created':
        return <Badge variant="outline" className="gap-1"><CheckCircle className="w-3 h-3" />Task Created</Badge>;
      case 'task_completed':
        return <Badge variant="outline" className="gap-1 bg-green-100 dark:bg-green-900/20"><CheckCircle className="w-3 h-3" />Task Completed</Badge>;
      case 'phone_call':
        return <Badge variant="outline" className="gap-1"><Phone className="w-3 h-3" />Phone Call</Badge>;
      case 'note':
        return <Badge variant="outline" className="gap-1"><StickyNote className="w-3 h-3" />Note</Badge>;
      case 'sms_sent':
        return <Badge variant="outline" className="gap-1"><MessageCircle className="w-3 h-3" />SMS Sent</Badge>;
      case 'sms_received':
        return <Badge variant="outline" className="gap-1"><MessageCircle className="w-3 h-3" />SMS Received</Badge>;
      case 'email_sent':
        return <Badge variant="outline" className="gap-1"><Mail className="w-3 h-3" />Email Sent</Badge>;
      case 'email_received':
        return <Badge variant="outline" className="gap-1"><Mail className="w-3 h-3" />Email Received</Badge>;
      case 'message_thread':
        return <Badge variant="outline" className="gap-1"><MessageSquare className="w-3 h-3" />Message Thread</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Handle view action
  const handleView = (entry: TimelineEntry) => {
    switch (entry.type) {
      case 'task_created':
      case 'task_completed':
        setLocation(`/internal-tasks/${entry.rawData.id}`);
        break;
      case 'message_thread':
        setLocation(`/messages?thread=${entry.rawData.id}`);
        break;
      case 'phone_call':
      case 'note':
      case 'sms_sent':
      case 'sms_received':
      case 'email_sent':
      case 'email_received':
        // Could open a modal or navigate to communication detail
        // For now, just log
        console.log('View communication:', entry.rawData);
        break;
      case 'stage_change':
        // Could open a modal with full chronology details
        console.log('View stage change:', entry.rawData);
        break;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-foreground" data-testid="heading-project-chronology">
          Project Timeline
        </h4>
        <span className="text-sm text-muted-foreground">
          {timeline.length} {timeline.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {!timeline.length ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No timeline entries available</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Changed By</TableHead>
              <TableHead>Time in Change</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeline.map((entry) => (
              <TableRow key={entry.id} data-testid={`timeline-row-${entry.id}`}>
                <TableCell data-testid={`cell-timestamp-${entry.id}`}>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">
                      {format(entry.timestamp, 'MMM d, yyyy')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(entry.timestamp, 'h:mm a')}
                    </span>
                  </div>
                </TableCell>
                <TableCell data-testid={`cell-type-${entry.id}`}>
                  {getTypeIcon(entry.type)}
                </TableCell>
                <TableCell data-testid={`cell-detail-${entry.id}`}>
                  <span className="text-sm">{entry.detail}</span>
                </TableCell>
                <TableCell data-testid={`cell-assigned-to-${entry.id}`}>
                  <span className="text-sm text-muted-foreground">
                    {entry.assignedTo || '—'}
                  </span>
                </TableCell>
                <TableCell data-testid={`cell-changed-by-${entry.id}`}>
                  <span className="text-sm">
                    {entry.changedBy || '—'}
                  </span>
                </TableCell>
                <TableCell data-testid={`cell-time-${entry.id}`}>
                  <span className="text-sm text-muted-foreground">
                    {entry.timeInChange || '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(entry)}
                    data-testid={`button-view-${entry.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
