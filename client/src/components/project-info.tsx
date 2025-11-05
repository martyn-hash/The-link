import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { ProjectWithRelations, User, KanbanStage } from "@shared/schema";
import { calculateCurrentInstanceTime, addBusinessHours } from "@shared/businessTime";
import { useMemo } from "react";

interface ProjectInfoProps {
  project: ProjectWithRelations;
  user: User;
  currentStage?: KanbanStage;
  currentAssignee?: {
    user: User | null;
    roleUsed: string | null;
    usedFallback: boolean;
    source: 'role_assignment' | 'fallback_user' | 'direct_assignment' | 'none';
  };
}

interface RoleAssignment {
  roleName: string;
  user: User | null;
}

interface ServiceRolesResponse {
  roles: RoleAssignment[];
}

// Helper function to format stage names for display
const formatStageName = (stageName: string): string => {
  return stageName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function ProjectInfo({ project, user, currentStage, currentAssignee }: ProjectInfoProps) {
  // Fetch current service roles for this project
  const { data: serviceRoles, isLoading: isLoadingServiceRoles } = useQuery<ServiceRolesResponse>({
    queryKey: ['/api/projects', project.id, 'service-roles'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${project.id}/service-roles`);
      if (!response.ok) throw new Error('Failed to fetch service roles');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Calculate current business hours in stage
  const currentBusinessHours = useMemo(() => {
    const createdAt = project.createdAt 
      ? (typeof project.createdAt === 'string' ? project.createdAt : new Date(project.createdAt).toISOString())
      : undefined;
    
    const transformedChronology = (project.chronology || [])
      .filter((entry): entry is typeof entry & { timestamp: NonNullable<typeof entry.timestamp> } => {
        return entry.timestamp !== null && entry.timestamp !== undefined;
      })
      .map((entry) => ({
        toStatus: entry.toStatus,
        timestamp: entry.timestamp instanceof Date 
          ? entry.timestamp.toISOString() 
          : typeof entry.timestamp === 'string'
          ? entry.timestamp
          : new Date(entry.timestamp).toISOString()
      }));
    
    try {
      return calculateCurrentInstanceTime(
        transformedChronology,
        project.currentStatus,
        createdAt
      );
    } catch (error) {
      console.error("Error calculating current instance time:", error);
      return 0;
    }
  }, [project.chronology, project.currentStatus, project.createdAt]);

  // Format business hours for display
  const formatBusinessHours = (hours: number): string => {
    if (hours === 0) return "0 business hours";
    if (hours < 1) return "< 1 business hour";
    
    const roundedHours = Math.round(hours * 10) / 10;
    
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

  // Calculate status (On Track, Behind Schedule, Overdue)
  const projectStatus = useMemo(() => {
    if (!currentStage?.maxInstanceTime || currentStage.maxInstanceTime === 0) {
      return { status: 'On Track', color: 'bg-green-600 text-white' };
    }

    const maxTime = currentStage.maxInstanceTime;
    const threshold80 = maxTime * 0.8; // 80% threshold for "Behind Schedule"

    if (currentBusinessHours >= maxTime) {
      return { status: 'Overdue / Late', color: 'bg-red-600 text-white' };
    } else if (currentBusinessHours >= threshold80) {
      return { status: 'Behind Schedule', color: 'bg-amber-500 text-white' };
    } else {
      return { status: 'On Track', color: 'bg-green-600 text-white' };
    }
  }, [currentBusinessHours, currentStage?.maxInstanceTime]);

  // Calculate time remaining until deadline
  const timeRemaining = useMemo(() => {
    if (!currentStage?.maxInstanceTime || currentStage.maxInstanceTime === 0) {
      return "No deadline";
    }

    const remaining = currentStage.maxInstanceTime - currentBusinessHours;
    if (remaining <= 0) {
      return "Overdue";
    }

    return formatBusinessHours(remaining);
  }, [currentBusinessHours, currentStage?.maxInstanceTime]);

  // Calculate stage deadline date
  const stageDeadline = useMemo(() => {
    if (!currentStage?.maxInstanceTime || currentStage.maxInstanceTime === 0) {
      return null;
    }

    const lastEntry = [...(project.chronology || [])]
      .filter(entry => entry.timestamp && entry.toStatus === project.currentStatus)
      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())[0];

    const startTime = lastEntry?.timestamp || project.createdAt;
    if (!startTime) return null;

    try {
      return addBusinessHours(startTime, currentStage.maxInstanceTime);
    } catch (error) {
      console.error("Error calculating deadline:", error);
      return null;
    }
  }, [project.chronology, project.currentStatus, project.createdAt, currentStage?.maxInstanceTime]);

  return (
    <div className="space-y-6">
      {/* Status Indicator Badge - Prominent at top */}
      <div className="flex justify-center">
        <Badge 
          className={`${projectStatus.color} text-lg px-6 py-2 font-semibold`}
          data-testid="badge-project-status"
        >
          {projectStatus.status}
        </Badge>
      </div>

      {/* Progress Metrics Section */}
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

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Role Assignments */}
        <div>
          <h4 className="font-semibold text-foreground mb-4">Role Assignments</h4>
          <div className="space-y-3">
            {isLoadingServiceRoles ? (
              <div className="flex justify-between">
                <span className="font-medium">Loading roles...</span>
              </div>
            ) : serviceRoles?.roles && serviceRoles.roles.length > 0 ? (
              serviceRoles.roles.map((roleAssignment) => (
                <div key={roleAssignment.roleName} className="flex justify-between">
                  <span className="text-muted-foreground">{roleAssignment.roleName}:</span>
                  {roleAssignment.user ? (
                    <span className="font-medium" data-testid={`text-role-${roleAssignment.roleName.toLowerCase().replace(/\s+/g, '-')}`}>
                      {roleAssignment.user.firstName} {roleAssignment.user.lastName}
                    </span>
                  ) : (
                    <span className="font-medium text-muted-foreground" data-testid={`text-role-${roleAssignment.roleName.toLowerCase().replace(/\s+/g, '-')}-none`}>
                      Not assigned
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="flex justify-between">
                <span className="text-muted-foreground">No roles assigned</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Stage Information */}
        <div>
          <h4 className="font-semibold text-foreground mb-4">Stage Information</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Assignee:</span>
              <span className="font-medium" data-testid="text-current-assignee">
                {currentAssignee?.user 
                  ? `${currentAssignee.user.firstName} ${currentAssignee.user.lastName}`
                  : 'Not assigned'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Stage:</span>
              <span className="font-medium" data-testid="text-current-stage">
                {formatStageName(project.currentStatus)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stage Max Time:</span>
              <span className="font-medium" data-testid="text-stage-max-time">
                {currentStage?.maxInstanceTime && currentStage.maxInstanceTime > 0
                  ? formatBusinessHours(currentStage.maxInstanceTime)
                  : 'No limit'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time in Current Stage:</span>
              <span 
                className={`font-medium ${projectStatus.status === 'Overdue / Late' ? 'text-red-600 dark:text-red-400' : projectStatus.status === 'Behind Schedule' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}
                data-testid="text-time-in-stage"
              >
                {formatBusinessHours(currentBusinessHours)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time Until Due:</span>
              <span 
                className={`font-medium ${timeRemaining === 'Overdue' ? 'text-red-600 dark:text-red-400' : ''}`}
                data-testid="text-time-until-due"
              >
                {timeRemaining}
              </span>
            </div>
            {stageDeadline && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stage Deadline:</span>
                <span className="font-medium" data-testid="text-stage-deadline">
                  {stageDeadline.toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}