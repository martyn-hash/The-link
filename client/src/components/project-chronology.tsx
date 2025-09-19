import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import type { ProjectWithRelations, KanbanStage } from "@shared/schema";
import { calculateBusinessHours } from "@shared/businessTime";

interface ProjectChronologyProps {
  project: ProjectWithRelations;
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
  // State for live time updates
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every minute for live time calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Fetch kanban stages to get colors
  const { data: stages } = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/stages"],
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

  return (
    <div className="space-y-6">
      <h4 className="font-semibold text-foreground mb-4">Project Chronology</h4>
      <ScrollArea className="h-96">
        <div className="space-y-4">
          {sortedChronology.map((entry, index) => {
            const hasFields = entry.fieldResponses && entry.fieldResponses.length > 0;
            return (
              <div key={entry.id} className="border-l-2 border-primary pl-4 pb-4 min-h-[200px] flex flex-col">
                {/* Timestamp header */}
                <div className="flex justify-end mb-2">
                  <span className="text-xs text-muted-foreground">
                    {entry.timestamp ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true }) : 'Unknown'}
                  </span>
                </div>
                
                {/* Fixed two-column layout with scrollable right column */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                  {/* Left Column: Main chronology information */}
                  <div className="space-y-2">
                    {/* Status Change */}
                    <div className="flex items-center space-x-2">
                      {entry.fromStatus ? (
                        <div className="flex items-center space-x-2 text-sm">
                          <Badge 
                            className="text-xs border-0" 
                            style={getStageColorStyle(entry.fromStatus || '')}
                            data-testid={`badge-from-status-${entry.id}`}
                          >
                            {formatStageName(entry.fromStatus || '')}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge 
                            className="text-xs border-0" 
                            style={getStageColorStyle(entry.toStatus)}
                            data-testid={`badge-to-status-${entry.id}`}
                          >
                            {formatStageName(entry.toStatus)}
                          </Badge>
                        </div>
                      ) : (
                        <Badge 
                          className="text-xs border-0" 
                          style={getStageColorStyle(entry.toStatus)}
                          data-testid={`badge-initial-status-${entry.id}`}
                        >
                          {formatStageName(entry.toStatus)}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Change Reason */}
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground font-medium">Reason:</span>
                      <Badge variant="secondary" className="text-xs">
                        {entry.changeReason ? formatChangeReason(entry.changeReason) : 'Not specified'}
                      </Badge>
                    </div>
                    
                    {/* Time in Current Stage */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground font-medium">
                          {index === 0 ? "Time in current stage:" : "Time spent in this stage:"}
                        </span>
                        <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded" data-testid={`time-duration-${entry.id}`}>
                          {formatDuration(calculateTimeInCurrentStage(entry, index, sortedChronology))}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground font-medium">
                          {index === 0 ? "Business hours in current stage:" : "Business hours spent in this stage:"}
                        </span>
                        <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded" data-testid={`business-hours-${entry.id}`}>
                          {getBusinessHoursInCurrentStage(entry, index, sortedChronology)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Assignee Information */}
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground font-medium">
                        {entry.fromStatus ? "Assigned to:" : "Project created - Assigned to:"}
                      </span>
                      <span className="text-xs text-foreground">
                        {entry.assignee 
                          ? `${entry.assignee.firstName} ${entry.assignee.lastName}`
                          : "System"}
                      </span>
                    </div>

                    {/* Notes */}
                    {entry.notes && (
                      <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded text-xs text-muted-foreground italic">
                        "{entry.notes}"
                      </div>
                    )}
                  </div>

                  {/* Right Column: Additional Information with scrollable content */}
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground font-medium">Additional Information</span>
                    <ScrollArea className="h-[120px] w-full">
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-3 space-y-3 min-h-[120px]" data-testid={`additional-info-${entry.id}`}>
                        {/* Field Responses */}
                        {entry.fieldResponses && entry.fieldResponses.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-foreground border-b border-slate-300 dark:border-slate-600 pb-1">
                              Stage Approval Responses
                            </div>
                            {entry.fieldResponses.map((response) => {
                              // Get the appropriate value based on field type
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
                                <div key={response.id} className="space-y-1" data-testid={`field-response-${response.id}`}>
                                  <span className="text-xs font-medium text-foreground block">
                                    {response.customField.fieldName}
                                  </span>
                                  <div className="ml-1">
                                    {response.fieldType === 'long_text' ? (
                                      <div className="text-xs text-foreground bg-white dark:bg-slate-700 p-2 rounded border max-h-16 overflow-y-auto">
                                        {getFieldValue()}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-foreground">
                                        {getFieldValue()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Show placeholder if no additional information */}
                        {(!entry.fieldResponses || entry.fieldResponses.length === 0) && (
                          <div className="text-xs text-muted-foreground italic flex items-center justify-center h-full">
                            No additional information available
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            );
          })}
          
          {!sortedChronology.length && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No chronology available</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}