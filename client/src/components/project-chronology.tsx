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
  const formatDuration = (minutes: number | null) => {
    if (!minutes || minutes === 0) return "0 days, 0 hours";
    const days = Math.floor(minutes / (60 * 24));
    const hours = Math.floor((minutes % (60 * 24)) / 60);
    return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6">
      <h4 className="font-semibold text-foreground mb-4">Project Chronology</h4>
      <ScrollArea className="h-96">
        <div className="space-y-4">
          {project.chronology?.map((entry, index) => {
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
                  {entry.fromStatus && entry.timeInPreviousStage !== null && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground font-medium">Duration in previous stage:</span>
                      <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                        {formatDuration(entry.timeInPreviousStage)}
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