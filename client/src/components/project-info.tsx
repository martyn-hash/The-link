import { Badge } from "@/components/ui/badge";
import type { ProjectWithRelations, User } from "@shared/schema";

interface ProjectInfoProps {
  project: ProjectWithRelations;
  user: User;
}

// Helper function to format stage names for display
const formatStageName = (stageName: string): string => {
  return stageName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getCurrentTimeInStage = (project: ProjectWithRelations) => {
  const lastEntry = project.chronology?.[0];
  if (!lastEntry || !lastEntry.timestamp) return "0h";
  
  const timeDiff = Date.now() - new Date(lastEntry.timestamp).getTime();
  const hours = Math.floor(timeDiff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h`;
};

export default function ProjectInfo({ project, user }: ProjectInfoProps) {
  return (
    <div className="space-y-6">
      {/* Progress Metrics Section - Row 1, Column 1 */}
      {project.progressMetrics && project.progressMetrics.length > 0 && (
        <div>
          <h4 className="font-semibold text-foreground mb-4">Progress Metrics</h4>
          <div className="space-y-3">
            {project.progressMetrics.map((metric) => (
              <div key={metric.reasonId} className="flex justify-between">
                <span className="text-muted-foreground">{metric.label}:</span>
                <span className="font-medium" data-testid={`text-progress-metric-${metric.reasonId}`}>
                  {metric.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Details Section */}
      <div>
        <h4 className="font-semibold text-foreground mb-4">Project Details</h4>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Client:</span>
            <span className="font-medium" data-testid="text-client-name">{project.client.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bookkeeper:</span>
            <span className="font-medium">
              {project.bookkeeper.firstName} {project.bookkeeper.lastName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Client Manager:</span>
            <span className="font-medium">
              {project.clientManager.firstName} {project.clientManager.lastName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Status:</span>
            <Badge variant="outline" data-testid="text-current-status">
              {formatStageName(project.currentStatus)}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Time in Current Stage:</span>
            <span className="font-medium" data-testid="text-time-in-stage">
              {getCurrentTimeInStage(project)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Priority:</span>
            <Badge variant={project.priority === "urgent" ? "destructive" : "secondary"}>
              {project.priority?.toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}