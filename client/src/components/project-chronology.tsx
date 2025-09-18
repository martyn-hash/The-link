import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { ProjectWithRelations, KanbanStage } from "@shared/schema";

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
  // Fetch kanban stages to get colors
  const { data: stages } = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/stages"],
  });

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

  // Function to calculate duration dynamically from timestamps
  const calculateDurationInMinutes = (entry: any, index: number, chronologyArray: any[]): number => {
    // If this is the first entry (no fromStatus), no duration to show
    if (!entry.fromStatus || !entry.timestamp) {
      return 0;
    }

    let previousTimestamp: string | null = null;

    // For entries that are not the last in array (not the oldest chronologically)
    if (index < chronologyArray.length - 1) {
      // Get the previous entry (next in array since array is newest to oldest)
      const previousEntry = chronologyArray[index + 1];
      previousTimestamp = previousEntry?.timestamp;
    } else {
      // This is the oldest chronology entry, calculate from project creation
      previousTimestamp = project.createdAt ? new Date(project.createdAt).toISOString() : null;
    }

    // Calculate duration if we have both timestamps
    if (previousTimestamp && entry.timestamp) {
      const currentTime = new Date(entry.timestamp);
      const previousTime = new Date(previousTimestamp);
      const diffMs = currentTime.getTime() - previousTime.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60))); // Convert to minutes
    }

    return 0; // Default fallback for missing timestamps
  };

  return (
    <div className="space-y-6">
      <h4 className="font-semibold text-foreground mb-4">Project Chronology</h4>
      <ScrollArea className="h-96">
        <div className="space-y-4">
          {project.chronology?.sort((a, b) => {
            // Sort by timestamp in descending order (newest first)
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA;
          }).map((entry, index) => {
            const hasFields = entry.fieldResponses && entry.fieldResponses.length > 0;
            return (
              <div key={entry.id} className="border-l-2 border-primary pl-4 pb-4">
                {/* Timestamp header */}
                <div className="flex justify-end mb-2">
                  <span className="text-xs text-muted-foreground">
                    {entry.timestamp ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true }) : 'Unknown'}
                  </span>
                </div>
                
                {/* Conditional grid layout - full width if no custom fields, two columns if fields exist */}
                <div className={`grid grid-cols-1 ${hasFields ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} gap-4`}>
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
                    
                    {/* Time in Previous Stage */}
                    {entry.fromStatus && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground font-medium">Duration in previous stage:</span>
                        <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                          {formatDuration(calculateDurationInMinutes(entry, index, project.chronology || []))}
                        </span>
                      </div>
                    )}
                    
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

                  {/* Right Column: Custom Fields */}
                  {entry.fieldResponses && entry.fieldResponses.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground font-medium">Additional Information</span>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-3 space-y-3" data-testid={`field-responses-${entry.id}`}>
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
                                  <div className="text-xs text-foreground bg-white dark:bg-slate-700 p-2 rounded border">
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
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {!project.chronology?.length && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No chronology available</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}