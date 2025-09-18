import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import type { ProjectWithRelations } from "@shared/schema";

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
            return (
              <div key={entry.id} className="border-l-2 border-primary pl-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {entry.fromStatus ? (
                      <div className="flex items-center space-x-2 text-sm">
                        <Badge variant="outline" className="text-xs">
                          {formatStageName(entry.fromStatus || '')}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="default" className="text-xs">
                          {formatStageName(entry.toStatus)}
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="default" className="text-xs">
                        {formatStageName(entry.toStatus)}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {entry.timestamp ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true }) : 'Unknown'}
                  </span>
                </div>
                
                <div className="space-y-2">
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

                  {/* Custom Field Responses */}
                  {entry.fieldResponses && entry.fieldResponses.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <span className="text-xs text-muted-foreground font-medium">Additional Information:</span>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-3 space-y-2" data-testid={`field-responses-${entry.id}`}>
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
                              default:
                                return 'Unknown field type';
                            }
                          };

                          return (
                            <div key={response.id} className="flex flex-col space-y-1" data-testid={`field-response-${response.id}`}>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-medium text-foreground">
                                  {response.customField.fieldName}:
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {response.fieldType.replace('_', ' ')}
                                </Badge>
                              </div>
                              <div className="ml-2">
                                {response.fieldType === 'long_text' ? (
                                  <div className="text-xs text-foreground bg-white dark:bg-slate-700 p-2 rounded border">
                                    {getFieldValue()}
                                  </div>
                                ) : (
                                  <span className="text-xs text-foreground font-mono">
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

                {entry.notes && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded text-xs text-muted-foreground italic">
                    "{entry.notes}"
                  </div>
                )}
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