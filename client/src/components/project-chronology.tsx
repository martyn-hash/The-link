import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import type { ProjectWithRelations, KanbanStage, User } from "@shared/schema";
import { calculateBusinessHours } from "@shared/businessTime";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Clock, User as UserIcon } from "lucide-react";

interface ProjectChronologyProps {
  project: ProjectWithRelations;
  currentAssignee?: RoleAssigneeResponse | null;
}

interface RoleAssigneeResponse {
  user: User | null;
  roleUsed: string | null;
  usedFallback: boolean;
  source: 'role_assignment' | 'fallback_user' | 'direct_assignment' | 'none';
}

// Component to display the role assignee for a specific stage
function ChronologyAssignee({ projectId, stageName }: { projectId: string; stageName: string | null }) {
  // Guard against null/undefined stageName
  const { data: roleAssigneeData, isLoading } = useQuery<RoleAssigneeResponse>({
    queryKey: ['/api/projects', projectId, 'role-assignee', stageName],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/role-assignee?stageName=${encodeURIComponent(stageName!)}`);
      if (!response.ok) throw new Error('Failed to fetch role assignee');
      return response.json();
    },
    enabled: !!stageName, // Only fetch if stageName is not null/undefined
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Show "System" for null/undefined stageName (initial project creation)
  if (!stageName) {
    return <span className="text-sm text-muted-foreground">System</span>;
  }

  if (isLoading) {
    return <span className="text-sm">...</span>;
  }

  if (roleAssigneeData?.user) {
    return (
      <span className="text-sm">
        {roleAssigneeData.user.firstName} {roleAssigneeData.user.lastName}
      </span>
    );
  }

  return <span className="text-sm text-muted-foreground">Unassigned</span>;
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

export default function ProjectChronology({ project, currentAssignee }: ProjectChronologyProps) {
  // State for live time updates
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [isViewingEntry, setIsViewingEntry] = useState(false);

  // Update current time every minute for live time calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Fetch kanban stages for this project's project type to get colors
  const { data: stages } = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/project-types", project.projectTypeId, "stages"],
    enabled: !!project.projectTypeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Memoize sorted chronology to avoid re-sorting on every render
  const sortedChronology = useMemo(() => {
    if (!project.chronology) return [];
    return [...project.chronology].sort((a, b) => {
      // Sort by timestamp in descending order (newest first)
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [project.chronology]);

  // Create a mapping of stage names to colors
  const stageColors = stages?.reduce((acc, stage) => {
    acc[stage.name] = stage.color || "#6b7280";
    return acc;
  }, {} as Record<string, string>) || {};

  // Helper function to get stage color style
  const getStageColorStyle = (stageName: string): React.CSSProperties => {
    const color = stageColors[stageName] || "#6b7280";
    return {
      backgroundColor: color,
      color: "white",
      borderColor: color,
    };
  };
  // Helper function to format time duration
  const formatDuration = (totalMinutes: number | null) => {
    if (!totalMinutes || totalMinutes === 0) return "0 minutes";
    
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    
    // For very short durations (less than 1 hour), show just minutes
    if (totalMinutes < 60) {
      return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
    }
    
    // For durations less than 1 day, show hours and minutes
    if (totalMinutes < 60 * 24) {
      if (minutes === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
      }
      return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    // For longer durations, show days, hours, and minutes (but omit zero values)
    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    
    return parts.join(', ');
  };

  // Memoized function to calculate time spent IN the current stage (not previous stage)
  const calculateTimeInCurrentStage = useMemo(() => {
    return (entry: any, index: number, chronologyArray: any[]): number => {
      // For the most recent entry (current stage), calculate live time using current state
      if (index === 0) {
        if (!entry.timestamp) return 0;
        const timeDiff = currentTime - new Date(entry.timestamp).getTime();
        return Math.max(0, Math.floor(timeDiff / (1000 * 60))); // Convert to minutes
      }

      // For completed stages, calculate time from this entry to the next entry
      if (!entry.timestamp) {
        return 0;
      }

      let nextTimestamp: string | null = null;

      // Get the next chronology entry (previous in array since array is newest to oldest)
      if (index > 0) {
        const nextEntry = chronologyArray[index - 1];
        nextTimestamp = nextEntry?.timestamp;
      }

      // Calculate duration if we have both timestamps
      if (nextTimestamp && entry.timestamp) {
        const nextTime = new Date(nextTimestamp);
        const entryTime = new Date(entry.timestamp);
        const diffMs = nextTime.getTime() - entryTime.getTime();
        return Math.max(0, Math.floor(diffMs / (1000 * 60))); // Convert to minutes
      }

      return 0; // Default fallback for missing timestamps
    };
  }, [currentTime]);

  // Memoized function to get business hours for time spent IN the current stage
  const getBusinessHoursInCurrentStage = useMemo(() => {
    return (entry: any, index: number, chronologyArray: any[]): string => {
      // For the most recent entry (current stage), calculate live business hours using current state
      if (index === 0) {
        if (!entry.timestamp) return "0 business hours";
        try {
          const businessHours = calculateBusinessHours(entry.timestamp, new Date(currentTime).toISOString());
          return formatBusinessHours(businessHours);
        } catch (error) {
          console.error('Error calculating live business hours:', error);
          return "0 business hours";
        }
      }

      // For completed stages, calculate business hours from this entry to the next entry
      if (!entry.timestamp) {
        return "0 business hours";
      }

      let nextTimestamp: string | null = null;

      // Get the next chronology entry (previous in array since array is newest to oldest)
      if (index > 0) {
        const nextEntry = chronologyArray[index - 1];
        nextTimestamp = nextEntry?.timestamp;
      }

      // Calculate business hours if we have both timestamps
      if (nextTimestamp && entry.timestamp) {
        try {
          const businessHours = calculateBusinessHours(entry.timestamp, nextTimestamp);
          return formatBusinessHours(businessHours);
        } catch (error) {
          console.error('Error calculating business hours:', error);
          return "0 business hours";
        }
      }

      return "0 business hours";
    };
  }, [currentTime]);

  // Format business hours for display
  const formatBusinessHours = (hours: number): string => {
    if (hours === 0) return "0 business hours";
    if (hours < 1) return "< 1 business hour";
    
    const roundedHours = Math.round(hours * 10) / 10; // Round to 1 decimal place
    
    if (roundedHours === 1) {
      return "1 business hour";
    } else if (roundedHours < 24) {
      return `${roundedHours} business hours`;
    } else {
      const days = Math.floor(roundedHours / 24);
      const remainingHours = Math.round((roundedHours % 24) * 10) / 10;
      
      if (remainingHours === 0) {
        return days === 1 ? "1 business day" : `${days} business days`;
      } else {
        const dayText = days === 1 ? "day" : "days";
        const hourText = remainingHours === 1 ? "hour" : "hours";
        return `${days} business ${dayText}, ${remainingHours} ${hourText}`;
      }
    }
  };

  // Format current status for display
  const formattedStatus = project.currentStatus
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Get assignee name
  const assigneeName = currentAssignee?.user 
    ? `${currentAssignee.user.firstName} ${currentAssignee.user.lastName}`
    : 'Unassigned';

  return (
    <div className="space-y-6">
      <h4 className="font-semibold text-foreground mb-4" data-testid="heading-project-chronology">
        {project.description} - Currently assigned to: {assigneeName} - {formattedStatus}
      </h4>
      {!sortedChronology.length ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No chronology available</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>From Stage</TableHead>
              <TableHead>To Stage</TableHead>
              <TableHead>Change Reason</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Changed By</TableHead>
              <TableHead>Time in Stage</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedChronology.map((entry, index) => (
              <TableRow key={entry.id} data-testid={`chronology-row-${entry.id}`}>
                <TableCell data-testid={`cell-timestamp-${entry.id}`}>
                  <span className="text-xs text-muted-foreground" data-testid={`text-timestamp-${entry.id}`}>
                    {entry.timestamp 
                      ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })
                      : 'Unknown'}
                  </span>
                </TableCell>
                <TableCell data-testid={`cell-from-status-${entry.id}`}>
                  {entry.fromStatus ? (
                    <Badge 
                      className="text-xs border-0" 
                      style={getStageColorStyle(entry.fromStatus)}
                      data-testid={`badge-from-status-${entry.id}`}
                    >
                      {formatStageName(entry.fromStatus)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground" data-testid={`text-no-from-status-${entry.id}`}>—</span>
                  )}
                </TableCell>
                <TableCell data-testid={`cell-to-status-${entry.id}`}>
                  <Badge 
                    className="text-xs border-0" 
                    style={getStageColorStyle(entry.toStatus)}
                    data-testid={`badge-to-status-${entry.id}`}
                  >
                    {formatStageName(entry.toStatus)}
                  </Badge>
                </TableCell>
                <TableCell data-testid={`cell-change-reason-${entry.id}`}>
                  <Badge 
                    variant="secondary" 
                    className="text-xs"
                    data-testid={`badge-change-reason-${entry.id}`}
                  >
                    {entry.changeReason ? formatChangeReason(entry.changeReason) : 'Not specified'}
                  </Badge>
                </TableCell>
                <TableCell data-testid={`cell-assignee-${entry.id}`}>
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <div data-testid={`text-assignee-${entry.id}`}>
                      <ChronologyAssignee projectId={project.id} stageName={entry.toStatus} />
                    </div>
                  </div>
                </TableCell>
                <TableCell data-testid={`cell-changed-by-${entry.id}`}>
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-changed-by-${entry.id}`}>
                      {entry.changedBy ? `${entry.changedBy.firstName} ${entry.changedBy.lastName}` : <span className="text-muted-foreground">System</span>}
                    </span>
                  </div>
                </TableCell>
                <TableCell data-testid={`cell-time-${entry.id}`}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-xs" data-testid={`text-time-duration-${entry.id}`}>
                        {formatDuration(calculateTimeInCurrentStage(entry, index, sortedChronology))}
                      </span>
                      <span className="text-xs text-muted-foreground" data-testid={`text-business-hours-${entry.id}`}>
                        {getBusinessHoursInCurrentStage(entry, index, sortedChronology)}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedEntry({ entry, index });
                      setIsViewingEntry(true);
                    }}
                    data-testid={`button-view-chronology-${entry.id}`}
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

      {/* View Chronology Detail Modal */}
      <Dialog open={isViewingEntry} onOpenChange={setIsViewingEntry}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chronology Entry Details</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              {/* Header Information */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <span className="text-xs text-muted-foreground">Timestamp</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-modal-timestamp-${selectedEntry.entry.id}`}>
                      {selectedEntry.entry.timestamp 
                        ? formatDistanceToNow(new Date(selectedEntry.entry.timestamp), { addSuffix: true }) 
                        : 'Unknown'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Assigned To</span>
                  <div className="mt-1 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <div data-testid={`text-modal-assignee-${selectedEntry.entry.id}`}>
                      <ChronologyAssignee projectId={project.id} stageName={selectedEntry.entry.toStatus} />
                    </div>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Changed By</span>
                  <div className="mt-1 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-modal-changed-by-${selectedEntry.entry.id}`}>
                      {selectedEntry.entry.changedBy 
                        ? `${selectedEntry.entry.changedBy.firstName} ${selectedEntry.entry.changedBy.lastName}`
                        : <span className="text-muted-foreground">System</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stage Transition */}
              <div>
                <span className="text-xs text-muted-foreground font-medium">Stage Transition</span>
                <div className="mt-2 flex items-center gap-3">
                  {selectedEntry.entry.fromStatus ? (
                    <>
                      <Badge 
                        className="text-sm border-0" 
                        style={getStageColorStyle(selectedEntry.entry.fromStatus)}
                      >
                        {formatStageName(selectedEntry.entry.fromStatus)}
                      </Badge>
                      <span className="text-muted-foreground text-lg">→</span>
                      <Badge 
                        className="text-sm border-0" 
                        style={getStageColorStyle(selectedEntry.entry.toStatus)}
                      >
                        {formatStageName(selectedEntry.entry.toStatus)}
                      </Badge>
                    </>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Project Created</p>
                      <Badge 
                        className="text-sm border-0" 
                        style={getStageColorStyle(selectedEntry.entry.toStatus)}
                      >
                        {formatStageName(selectedEntry.entry.toStatus)}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Change Reason */}
              <div>
                <span className="text-xs text-muted-foreground font-medium">Change Reason</span>
                <div className="mt-2">
                  <Badge variant="secondary">
                    {selectedEntry.entry.changeReason ? formatChangeReason(selectedEntry.entry.changeReason) : 'Not specified'}
                  </Badge>
                </div>
              </div>

              {/* Time Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    {selectedEntry.index === 0 ? "Time in Current Stage" : "Time Spent in Stage"}
                  </span>
                  <p className="text-lg font-semibold text-blue-700 dark:text-blue-300 mt-1">
                    {formatDuration(calculateTimeInCurrentStage(selectedEntry.entry, selectedEntry.index, sortedChronology))}
                  </p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                    {selectedEntry.index === 0 ? "Business Hours in Current Stage" : "Business Hours Spent"}
                  </span>
                  <p className="text-lg font-semibold text-green-700 dark:text-green-300 mt-1">
                    {getBusinessHoursInCurrentStage(selectedEntry.entry, selectedEntry.index, sortedChronology)}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {selectedEntry.entry.notes && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Notes</span>
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg">
                    <p className="text-sm italic">"{selectedEntry.entry.notes}"</p>
                  </div>
                </div>
              )}

              {/* Custom Field Responses */}
              {selectedEntry.entry.fieldResponses && selectedEntry.entry.fieldResponses.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Stage Approval Responses</span>
                  <div className="mt-2 space-y-3">
                    {selectedEntry.entry.fieldResponses.map((response: any) => {
                      const getFieldValue = () => {
                        switch (response.fieldType) {
                          case 'number':
                            return response.valueNumber?.toString() || 'No value';
                          case 'short_text':
                            return response.valueShortText || 'No value';
                          case 'long_text':
                            return response.valueLongText || 'No value';
                          case 'multi_select':
                            return response.valueMultiSelect?.join(', ') || 'No selections';
                          default:
                            return 'Unknown field type';
                        }
                      };

                      return (
                        <div key={response.id} className="p-3 bg-muted/30 rounded-lg">
                          <span className="text-sm font-medium block mb-2">
                            {response.customField.fieldName}
                          </span>
                          {response.fieldType === 'long_text' ? (
                            <div className="text-sm bg-background p-2 rounded border max-h-32 overflow-y-auto">
                              {getFieldValue()}
                            </div>
                          ) : (
                            <span className="text-sm">{getFieldValue()}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setIsViewingEntry(false)}
                  data-testid="button-close-chronology-detail"
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