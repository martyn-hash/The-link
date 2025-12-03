import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import type { ProjectWithRelations } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { Eye, MessageSquare, CheckCircle, Mail, Phone, FileText, StickyNote, MessageCircle, Filter, Clock, User as UserIcon, ArrowRight, Paperclip, Download, ExternalLink, UserCog, PauseCircle, PlayCircle } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";

interface ProjectChronologyProps {
  project: ProjectWithRelations;
}

// Unified timeline entry type
interface TimelineEntry {
  id: string;
  timestamp: Date;
  type: 'stage_change' | 'role_change' | 'benched' | 'unbenched' | 'task_created' | 'task_completed' | 'phone_call' | 'note' | 'sms_sent' | 'sms_received' | 'email_sent' | 'email_received' | 'message_thread';
  detail: string;
  assignedTo?: string;
  changedBy?: string;
  timeInStage?: string;
  stageChangeStatus?: 'on_track' | 'behind_schedule' | 'late_overdue'; // For stage changes only - always set for stage_change type
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
  const isMobile = useIsMobile();
  
  // Filter state - track which categories are selected
  const [filters, setFilters] = useState({
    stageChanges: true,
    taskCreated: true,
    taskCompleted: true,
    progressNotes: true,
    messageThreads: true,
  });

  // Modal state for viewing details
  const [selectedStageChange, setSelectedStageChange] = useState<any | null>(null);
  const [selectedProgressNote, setSelectedProgressNote] = useState<any | null>(null);
  const [isViewingStageChange, setIsViewingStageChange] = useState(false);
  const [isViewingProgressNote, setIsViewingProgressNote] = useState(false);

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

  // Fetch stage approval fields for filtering stage approval responses
  const { data: stageApprovalFields, isLoading: isLoadingApprovalFields } = useQuery<any[]>({
    queryKey: ['/api/config/stage-approval-fields'],
  });

  const { data: changeReasons, isLoading: isLoadingReasons } = useQuery<any[]>({
    queryKey: ['/api/config/reasons'],
  });

  const { data: stages, isLoading: isLoadingStages } = useQuery<any[]>({
    queryKey: [`/api/config/project-types/${project.projectTypeId}/stages`],
    enabled: !!project.projectTypeId,
  });

  // Create a map of stage name to stage config for easy lookup
  const stageConfigMap = useMemo(() => {
    if (!stages) return new Map();
    return new Map(stages.map((stage: any) => [stage.name, stage]));
  }, [stages]);

  // Filter threads for this project
  const messageThreads = useMemo(() => {
    if (!allThreads) return [];
    return allThreads.filter((thread: any) => thread.projectId === project.id);
  }, [allThreads, project.id]);

  // Get filtered stage approval responses for the selected stage change
  const filteredStageApprovalResponses = useMemo(() => {
    // Return null if data is still loading
    if (isLoadingApprovalFields || isLoadingReasons || isLoadingStages) {
      return null;
    }

    // Return empty array if no stage change is selected or required data is missing
    if (!selectedStageChange || !project.stageApprovalResponses || !stageApprovalFields || !stages || !changeReasons) {
      return [];
    }

    // Determine which stage approval was required for this stage change
    let effectiveApprovalId: string | null = null;

    // First check if the change reason has an associated approval
    if (selectedStageChange.changeReason) {
      const reason = changeReasons.find((r: any) => r.reason === selectedStageChange.changeReason);
      if (reason?.stageApprovalId) {
        effectiveApprovalId = reason.stageApprovalId;
      }
    }

    // If no reason-level approval, check the stage itself
    if (!effectiveApprovalId && selectedStageChange.toStatus) {
      const stage = stages.find((s: any) => s.name === selectedStageChange.toStatus);
      if (stage?.stageApprovalId) {
        effectiveApprovalId = stage.stageApprovalId;
      }
    }

    // If no approval was required, return empty array
    if (!effectiveApprovalId) {
      return [];
    }

    // Get the field IDs for this approval
    const approvalFieldIds = new Set(
      stageApprovalFields
        .filter((f: any) => f.stageApprovalId === effectiveApprovalId)
        .map((f: any) => f.id)
    );

    // Filter responses to only include those for this approval's fields
    return project.stageApprovalResponses.filter((r: any) => 
      approvalFieldIds.has(r.fieldId)
    );
  }, [selectedStageChange, project.stageApprovalResponses, stageApprovalFields, stages, changeReasons, isLoadingApprovalFields, isLoadingReasons, isLoadingStages]);

  // Build unified timeline
  const timeline = useMemo((): TimelineEntry[] => {
    const entries: TimelineEntry[] = [];

    // Check if project is overdue based on due date
    const isProjectOverdue = project.dueDate ? new Date() > new Date(project.dueDate) : false;

    // Add stage changes from chronology - process in chronological order to track cumulative time correctly
    if (project.chronology) {
      // Sort chronology by timestamp (oldest first) to calculate running cumulative time
      const sortedChronology = [...project.chronology].sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      });
      
      // Track cumulative business hours spent in each stage as we iterate
      const cumulativeStageTime = new Map<string, number>();
      
      sortedChronology.forEach((entry: any) => {
        // Determine entry type and detail format
        const isInactiveEntry = entry.changeReason === 'project_inactive' || entry.changeReason === 'project_reactivated';
        const isRoleChange = entry.entryType === 'role_change';
        const isBenchedEntry = entry.entryType === 'benched';
        const isUnbenchedEntry = entry.entryType === 'unbenched';
        
        let detail: string;
        if (isRoleChange) {
          // Role change entries use notes field for "Changed from X to Y"
          detail = entry.notes || `Role changed`;
        } else if (isBenchedEntry) {
          // Benched entries show the reason
          const reason = entry.changeReason || 'Moved to Bench';
          detail = entry.notes ? `${reason}: ${entry.notes}` : reason;
        } else if (isUnbenchedEntry) {
          // Unbenched entries show the restored status
          detail = entry.notes || `Removed from Bench → ${formatStageName(entry.toStatus)}`;
        } else if (isInactiveEntry) {
          detail = entry.notes || 'Project status changed';
        } else if (entry.fromStatus) {
          detail = `${formatStageName(entry.fromStatus)} → ${formatStageName(entry.toStatus)}`;
        } else {
          detail = `Project created in ${formatStageName(entry.toStatus)}`;
        }
        
        // Calculate stage change status with priority hierarchy:
        // 1. If project is overdue (past dueDate), ALL stage changes are RED
        // 2. If stage exceeded maxInstanceTime OR maxTotalTime, show AMBER
        // 3. Otherwise show GREEN
        let stageChangeStatus: 'on_track' | 'behind_schedule' | 'late_overdue';
        
        if (isProjectOverdue) {
          // Priority 1: Project is overdue - all stage changes are RED
          stageChangeStatus = 'late_overdue';
        } else if (entry.fromStatus && entry.businessHoursInPreviousStage !== null && entry.businessHoursInPreviousStage !== undefined) {
          const previousStageConfig = stageConfigMap.get(entry.fromStatus);
          const hoursInPreviousStage = entry.businessHoursInPreviousStage / 60;
          
          // Get cumulative time up to this point (before adding current entry's time)
          const cumulativeMinutesUpToNow = cumulativeStageTime.get(entry.fromStatus) || 0;
          const cumulativeHoursUpToNow = cumulativeMinutesUpToNow / 60;
          
          // Now add this entry's time to the running total for future iterations
          cumulativeStageTime.set(entry.fromStatus, cumulativeMinutesUpToNow + entry.businessHoursInPreviousStage);
          
          // Check if either time limit is exceeded at this transition
          const exceedsInstanceTime = previousStageConfig?.maxInstanceTime && previousStageConfig.maxInstanceTime > 0 
            && hoursInPreviousStage > previousStageConfig.maxInstanceTime;
          const exceedsTotalTime = previousStageConfig?.maxTotalTime && previousStageConfig.maxTotalTime > 0
            && (cumulativeHoursUpToNow + hoursInPreviousStage) > previousStageConfig.maxTotalTime;
          
          if (exceedsInstanceTime || exceedsTotalTime) {
            // Priority 2: Behind schedule - exceeded time limits
            stageChangeStatus = 'behind_schedule';
          } else {
            // Priority 3: On track
            stageChangeStatus = 'on_track';
          }
        } else {
          // Default to green for stage changes with no time tracking
          stageChangeStatus = 'on_track';
        }
        
        // Determine the timeline entry type
        let timelineType: TimelineEntry['type'] = 'stage_change';
        if (isRoleChange) {
          timelineType = 'role_change';
        } else if (isBenchedEntry) {
          timelineType = 'benched';
        } else if (isUnbenchedEntry) {
          timelineType = 'unbenched';
        }
        
        entries.push({
          id: `stage-${entry.id}`,
          timestamp: new Date(entry.timestamp),
          type: timelineType,
          detail,
          assignedTo: entry.assignee ? `${entry.assignee.firstName} ${entry.assignee.lastName}` : undefined,
          changedBy: entry.changedBy ? `${entry.changedBy.firstName} ${entry.changedBy.lastName}` : 'System',
          stageChangeStatus,
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
    const sorted = entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Post-process to shift timeInPreviousStage to the correct row
    // For each stage change with timeInPreviousStage, assign that time to the next entry
    // (which represents the period when the project was IN that previous stage)
    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      if (entry.type === 'stage_change' && entry.rawData.timeInPreviousStage) {
        // Find the next entry in the timeline (chronologically earlier)
        if (i + 1 < sorted.length) {
          sorted[i + 1].timeInStage = formatDuration(entry.rawData.timeInPreviousStage);
        }
      }
    }
    
    return sorted;
  }, [project.chronology, tasks, communications, messageThreads, stageConfigMap]);

  // Filter timeline based on selected filters
  const filteredTimeline = useMemo(() => {
    return timeline.filter(entry => {
      // Map entry type to filter category
      if (entry.type === 'stage_change' || entry.type === 'role_change' || entry.type === 'benched' || entry.type === 'unbenched') {
        return filters.stageChanges;
      }
      if (entry.type === 'task_created') {
        return filters.taskCreated;
      }
      if (entry.type === 'task_completed') {
        return filters.taskCompleted;
      }
      if (entry.type === 'phone_call' || entry.type === 'note' || 
          entry.type === 'sms_sent' || entry.type === 'sms_received' ||
          entry.type === 'email_sent' || entry.type === 'email_received') {
        return filters.progressNotes;
      }
      if (entry.type === 'message_thread') {
        return filters.messageThreads;
      }
      return true; // Show unknown types by default
    });
  }, [timeline, filters]);

  // Get icon for entry type with color coding for stage changes
  const getTypeIcon = (type: string, stageChangeStatus?: 'on_track' | 'behind_schedule' | 'late_overdue') => {
    switch (type) {
      case 'role_change':
        return <Badge variant="outline" className="gap-1 bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200"><UserCog className="w-3 h-3" />Role Change</Badge>;
      case 'benched':
        return <Badge variant="outline" className="gap-1 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200"><PauseCircle className="w-3 h-3" />Moved to Bench</Badge>;
      case 'unbenched':
        return <Badge variant="outline" className="gap-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200"><PlayCircle className="w-3 h-3" />Removed from Bench</Badge>;
      case 'stage_change':
        // Apply color coding based on stage change status
        // All stage changes now have a color: green (on track), amber (behind), or red (overdue)
        let colorClass: string;
        if (stageChangeStatus === 'on_track') {
          colorClass = 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200';
        } else if (stageChangeStatus === 'behind_schedule') {
          colorClass = 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200';
        } else {
          // 'late_overdue' - also covers undefined (should never happen)
          colorClass = 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200';
        }
        return <Badge variant="outline" className={`gap-1 ${colorClass}`}><FileText className="w-3 h-3" />Stage Change</Badge>;
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
        setSelectedProgressNote(entry.rawData);
        setIsViewingProgressNote(true);
        break;
      case 'stage_change':
      case 'benched':
      case 'unbenched':
        setSelectedStageChange(entry.rawData);
        setIsViewingStageChange(true);
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
          {filteredTimeline.length} of {timeline.length} {timeline.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Filter Controls */}
      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter:</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-stage-changes"
              checked={filters.stageChanges}
              onCheckedChange={(checked) => setFilters(prev => ({ ...prev, stageChanges: checked as boolean }))}
              data-testid="checkbox-filter-stage-changes"
            />
            <Label htmlFor="filter-stage-changes" className="text-sm cursor-pointer">
              Stage Changes
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-task-created"
              checked={filters.taskCreated}
              onCheckedChange={(checked) => setFilters(prev => ({ ...prev, taskCreated: checked as boolean }))}
              data-testid="checkbox-filter-task-created"
            />
            <Label htmlFor="filter-task-created" className="text-sm cursor-pointer">
              Task Created
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-task-completed"
              checked={filters.taskCompleted}
              onCheckedChange={(checked) => setFilters(prev => ({ ...prev, taskCompleted: checked as boolean }))}
              data-testid="checkbox-filter-task-completed"
            />
            <Label htmlFor="filter-task-completed" className="text-sm cursor-pointer">
              Task Completed
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-progress-notes"
              checked={filters.progressNotes}
              onCheckedChange={(checked) => setFilters(prev => ({ ...prev, progressNotes: checked as boolean }))}
              data-testid="checkbox-filter-progress-notes"
            />
            <Label htmlFor="filter-progress-notes" className="text-sm cursor-pointer">
              Progress Notes
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-message-threads"
              checked={filters.messageThreads}
              onCheckedChange={(checked) => setFilters(prev => ({ ...prev, messageThreads: checked as boolean }))}
              data-testid="checkbox-filter-message-threads"
            />
            <Label htmlFor="filter-message-threads" className="text-sm cursor-pointer">
              Message Threads
            </Label>
          </div>
        </div>
      </div>

      {!filteredTimeline.length ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No timeline entries available</p>
        </div>
      ) : isMobile ? (
        /* Mobile Card View */
        <div className="space-y-3">
          {filteredTimeline.map((entry) => (
            <Card key={entry.id} data-testid={`timeline-card-${entry.id}`}>
              <CardContent className="p-4 space-y-3">
                {/* Type Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1" data-testid={`card-type-${entry.id}`}>
                    {getTypeIcon(entry.type, entry.stageChangeStatus)}
                  </div>
                  <span className="text-xs text-muted-foreground" data-testid={`card-timestamp-${entry.id}`}>
                    {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                  </span>
                </div>

                {/* Detail */}
                <div className="space-y-1">
                  <p className="text-sm font-medium" data-testid={`card-detail-${entry.id}`}>
                    {entry.detail}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{format(entry.timestamp, 'MMM d, yyyy h:mm a')}</span>
                  </div>
                </div>

                {/* Changed By and Assigned To */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border text-xs">
                  <div>
                    <span className="text-muted-foreground">Changed By</span>
                    <p className="font-medium mt-1" data-testid={`card-changed-by-${entry.id}`}>
                      {entry.changedBy || '—'}
                    </p>
                  </div>
                  {entry.assignedTo && (
                    <div>
                      <span className="text-muted-foreground">Assigned To</span>
                      <p className="font-medium mt-1" data-testid={`card-assigned-to-${entry.id}`}>
                        {entry.assignedTo}
                      </p>
                    </div>
                  )}
                </div>

                {/* Time in Stage */}
                {entry.timeInStage && (
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Time in Stage:</span>
                    <span className="font-medium" data-testid={`card-time-${entry.id}`}>{entry.timeInStage}</span>
                  </div>
                )}

                {/* View Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleView(entry)}
                  data-testid={`button-view-${entry.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop Table View */
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Changed By</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Time in Stage</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTimeline.map((entry) => (
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
                  {getTypeIcon(entry.type, entry.stageChangeStatus)}
                </TableCell>
                <TableCell data-testid={`cell-detail-${entry.id}`}>
                  <span className="text-sm">{entry.detail}</span>
                </TableCell>
                <TableCell data-testid={`cell-changed-by-${entry.id}`}>
                  <span className="text-sm">
                    {entry.changedBy || '—'}
                  </span>
                </TableCell>
                <TableCell data-testid={`cell-assigned-to-${entry.id}`}>
                  <span className="text-sm text-muted-foreground">
                    {entry.assignedTo || '—'}
                  </span>
                </TableCell>
                <TableCell data-testid={`cell-time-${entry.id}`}>
                  <span className="text-sm text-muted-foreground">
                    {entry.timeInStage || '—'}
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

      {/* Stage Change Detail Modal */}
      <Dialog open={isViewingStageChange} onOpenChange={setIsViewingStageChange}>
        <DialogContent 
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Stage Change Details</DialogTitle>
          </DialogHeader>
          {selectedStageChange && (
            <div className="space-y-4">
              {/* Header Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="col-span-2">
                  <span className="text-xs text-muted-foreground">Stage Transition</span>
                  <div className="mt-2 flex items-center gap-3">
                    {selectedStageChange.fromStatus ? (
                      <>
                        <Badge variant="outline" className="text-sm" data-testid="modal-badge-from-stage">
                          {formatStageName(selectedStageChange.fromStatus)}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        <Badge variant="default" className="text-sm" data-testid="modal-badge-to-stage">
                          {formatStageName(selectedStageChange.toStatus)}
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="default" className="text-sm" data-testid="modal-badge-created-stage">
                        Project created in {formatStageName(selectedStageChange.toStatus)}
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Timestamp</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid="text-modal-timestamp">
                      {selectedStageChange.timestamp 
                        ? format(new Date(selectedStageChange.timestamp), 'MMM d, yyyy h:mm a')
                        : 'Unknown time'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Changed By</span>
                  <div className="mt-1">
                    {selectedStageChange.changedBy ? (
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid="text-modal-changed-by">
                          {selectedStageChange.changedBy.firstName} {selectedStageChange.changedBy.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground" data-testid="text-modal-system">System</span>
                    )}
                  </div>
                </div>
                {selectedStageChange.assignee && (
                  <div>
                    <span className="text-xs text-muted-foreground">Assigned To</span>
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid="text-modal-assignee">
                          {selectedStageChange.assignee.firstName} {selectedStageChange.assignee.lastName}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {selectedStageChange.timeInPreviousStage && (
                  <div>
                    <span className="text-xs text-muted-foreground">Time in Previous Stage</span>
                    <div className="mt-1 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium" data-testid="text-modal-time">
                        {formatDuration(selectedStageChange.timeInPreviousStage)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Change Reason */}
              {selectedStageChange.changeReason && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Change Reason</span>
                  <p className="text-sm font-medium mt-2" data-testid="text-modal-change-reason">
                    {formatChangeReason(selectedStageChange.changeReason)}
                  </p>
                </div>
              )}

              {/* Notes */}
              {(selectedStageChange.notesHtml || selectedStageChange.notes) && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Notes</span>
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg max-h-[400px] overflow-y-auto">
                    {selectedStageChange.notesHtml ? (
                      <div 
                        className="text-sm prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(selectedStageChange.notesHtml) 
                        }}
                        data-testid="text-modal-notes-html"
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap" data-testid="text-modal-notes">{selectedStageChange.notes}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {selectedStageChange.attachments && selectedStageChange.attachments.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    Attachments ({selectedStageChange.attachments.length})
                  </span>
                  <div className="mt-2 space-y-2">
                    {selectedStageChange.attachments.map((attachment: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`attachment-${index}`}
                      >
                        <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" data-testid={`attachment-name-${index}`}>
                            {attachment.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.fileType} · {(attachment.fileSize / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <a
                          href={`/api/projects/${project.id}/stage-change-attachments${attachment.objectPath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                          data-testid={`attachment-download-${index}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="hidden sm:inline">View</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Change Reason Custom Field Responses */}
              {selectedStageChange.fieldResponses && selectedStageChange.fieldResponses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Change Reason Questions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 p-4 bg-muted/30 rounded-lg">
                    {selectedStageChange.fieldResponses.map((response: any, index: number) => (
                      <div 
                        key={response.id || index} 
                        className={`space-y-1 ${index % 2 === 0 ? 'md:pr-6 md:border-r md:border-border' : 'md:pl-6'}`}
                        data-testid={`change-reason-response-${index}`}
                      >
                        <span className="text-xs text-muted-foreground font-medium">
                          {response.customField?.fieldName || 'Question'}
                        </span>
                        <div className="text-sm">
                          {response.fieldType === 'boolean' && (
                            <span>{response.valueBoolean ? 'Yes' : 'No'}</span>
                          )}
                          {response.fieldType === 'number' && (
                            <span>{response.valueNumber}</span>
                          )}
                          {response.fieldType === 'short_text' && (
                            <span>{response.valueShortText}</span>
                          )}
                          {response.fieldType === 'long_text' && (
                            <p className="whitespace-pre-wrap">{response.valueLongText}</p>
                          )}
                          {response.fieldType === 'multi_select' && (
                            <div className="flex flex-wrap gap-1">
                              {(response.valueMultiSelect || []).map((option: string, optIdx: number) => (
                                <Badge key={optIdx} variant="secondary" className="text-xs">
                                  {option}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stage Approval Responses */}
              {filteredStageApprovalResponses === null ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Stage Approval Questions</h4>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Loading approval data...</p>
                  </div>
                </div>
              ) : filteredStageApprovalResponses.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Stage Approval Questions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 p-4 bg-muted/30 rounded-lg">
                    {filteredStageApprovalResponses.map((response: any, index: number) => (
                      <div 
                        key={response.id || index} 
                        className={`space-y-1 ${index % 2 === 0 ? 'md:pr-6 md:border-r md:border-border' : 'md:pl-6'}`}
                        data-testid={`stage-approval-response-${index}`}
                      >
                        <span className="text-xs text-muted-foreground font-medium">
                          {response.field?.fieldName || 'Question'}
                        </span>
                        <div className="text-sm">
                          {response.field?.fieldType === 'boolean' && (
                            <span>{response.valueBoolean ? 'Yes' : 'No'}</span>
                          )}
                          {response.field?.fieldType === 'number' && (
                            <span>{response.valueNumber}</span>
                          )}
                          {response.field?.fieldType === 'long_text' && (
                            <p className="whitespace-pre-wrap">{response.valueLongText}</p>
                          )}
                          {response.field?.fieldType === 'multi_select' && (
                            <div className="flex flex-wrap gap-1">
                              {(response.valueMultiSelect || []).map((option: string, optIdx: number) => (
                                <Badge key={optIdx} variant="secondary" className="text-xs">
                                  {option}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Stage Approval Questions</h4>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground" data-testid="text-no-approval-required">No stage approval required for this change</p>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setIsViewingStageChange(false)}
                  data-testid="button-close-stage-change-detail"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Communication Detail Modal - consistent with ViewCommunicationDialog */}
      <Dialog open={isViewingProgressNote} onOpenChange={setIsViewingProgressNote}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProgressNote?.type === 'email_sent' || selectedProgressNote?.type === 'email_received' ? (
                <Mail className="w-5 h-5" />
              ) : selectedProgressNote?.type === 'sms_sent' || selectedProgressNote?.type === 'sms_received' ? (
                <MessageCircle className="w-5 h-5" />
              ) : selectedProgressNote?.type === 'phone_call' ? (
                <Phone className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              Communication Details
            </DialogTitle>
          </DialogHeader>
          {selectedProgressNote && (
            <div className="space-y-4">
              {/* Header Information - 2x2 grid matching ViewCommunicationDialog */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <span className="text-xs text-muted-foreground">Type</span>
                  <div className="mt-1">
                    <Badge variant="secondary" className={
                      selectedProgressNote.type === 'email_sent' || selectedProgressNote.type === 'email_received' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : selectedProgressNote.type === 'sms_sent' || selectedProgressNote.type === 'sms_received'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : selectedProgressNote.type === 'phone_call'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                    } data-testid="modal-badge-note-type">
                      {selectedProgressNote.type === 'phone_call' && 'Phone Call'}
                      {selectedProgressNote.type === 'note' && 'Note'}
                      {selectedProgressNote.type === 'sms_sent' && 'SMS Sent'}
                      {selectedProgressNote.type === 'sms_received' && 'SMS Received'}
                      {selectedProgressNote.type === 'email_sent' && 'Email Sent'}
                      {selectedProgressNote.type === 'email_received' && 'Email Received'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Date/Time</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid="text-modal-note-timestamp">
                      {selectedProgressNote.actualContactTime || selectedProgressNote.loggedAt || selectedProgressNote.createdAt
                        ? format(new Date(selectedProgressNote.actualContactTime || selectedProgressNote.loggedAt || selectedProgressNote.createdAt), 'dd/MM/yyyy, HH:mm:ss')
                        : 'Unknown time'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Created By</span>
                  <div className="mt-1">
                    {selectedProgressNote.user ? (
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid="text-modal-note-user">
                          {selectedProgressNote.user.firstName} {selectedProgressNote.user.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground" data-testid="text-modal-note-system">System</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Contact Person</span>
                  <div className="mt-1">
                    {selectedProgressNote.person ? (
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid="text-modal-note-person">
                          {selectedProgressNote.person.fullName || 
                           `${selectedProgressNote.person.firstName || ''} ${selectedProgressNote.person.lastName || ''}`.trim() ||
                           '—'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground" data-testid="text-modal-note-no-person">—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Subject */}
              {selectedProgressNote.subject && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Subject</span>
                  <h4 className="font-medium text-lg mt-1" data-testid="text-modal-note-subject">
                    {selectedProgressNote.subject}
                  </h4>
                </div>
              )}

              {/* Content - with HTML support for emails */}
              {(selectedProgressNote.content || selectedProgressNote.notes) && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Content</span>
                  <div className="mt-2 p-4 bg-muted/30 rounded-lg" data-testid="div-modal-note-content">
                    {(selectedProgressNote.type === 'email_sent' || selectedProgressNote.type === 'email_received') ? (
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(selectedProgressNote.content || selectedProgressNote.notes || '', {
                            ALLOWED_TAGS: ['br', 'p', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'],
                            ALLOWED_ATTR: ['href', 'style', 'class'],
                            ALLOW_DATA_ATTR: false
                          })
                        }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedProgressNote.content || selectedProgressNote.notes}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Duration (for phone calls) */}
              {selectedProgressNote.duration && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Duration</span>
                  <p className="text-sm mt-2" data-testid="text-modal-note-duration">
                    {selectedProgressNote.duration} minutes
                  </p>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setIsViewingProgressNote(false)}
                  data-testid="button-close-communication-detail"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
