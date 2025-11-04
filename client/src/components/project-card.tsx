import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, AlertCircle, Clock } from "lucide-react";
import type { ProjectWithRelations, KanbanStage, User } from "@shared/schema";
import { calculateCurrentInstanceTime } from "@shared/businessTime";
import { useAuth } from "@/hooks/useAuth";

// Type for role assignee API response
interface RoleAssigneeResponse {
  user: User | null;
  roleUsed: string | null;
  usedFallback: boolean;
  source: 'role_assignment' | 'fallback_user' | 'direct_assignment' | 'none';
}

interface ProjectCardProps {
  project: ProjectWithRelations;
  stageConfig?: KanbanStage; // Fallback for display purposes from kanban board
  onOpenModal: () => void;
  isDragging?: boolean;
}

export default function ProjectCard({ 
  project, 
  stageConfig,
  onOpenModal, 
  isDragging = false 
}: ProjectCardProps) {
  // Get authentication state
  const { isAuthenticated, user } = useAuth();

  // Fetch project-specific stage configuration for business logic
  const { data: projectStages = [] } = useQuery<KanbanStage[]>({
    queryKey: ['/api/config/project-types', project.projectTypeId, 'stages'],
    enabled: !!project.projectTypeId && isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Use project-specific stage config if available, otherwise fall back to prop
  const effectiveStageConfig = useMemo(() => {
    const projectSpecificStage = projectStages.find(s => s.name === project.currentStatus);
    return projectSpecificStage || stageConfig;
  }, [projectStages, project.currentStatus, stageConfig]);

  // Fetch role-based assignee for this project
  const { 
    data: roleAssigneeData, 
    isLoading: isLoadingAssignee, 
    error: roleAssigneeError 
  } = useQuery<RoleAssigneeResponse>({
    queryKey: ['/api/projects', project.id, 'role-assignee'],
    enabled: !!project.id && isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: 1000, // Wait 1 second between retries
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ 
    id: project.id,
    disabled: isDragging,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Calculate assignee info using role-based assignment with fallback to direct assignment
  const assigneeInfo = useMemo(() => {
    // If still loading role assignment, use a loading placeholder
    if (isLoadingAssignee) {
      return {
        initials: "...",
        source: "loading" as const,
        usedFallback: false,
        roleUsed: null
      };
    }

    // If role assignment API call failed, fallback to direct assignment
    if (roleAssigneeError) {
      // Only log errors for non-authentication issues to reduce noise
      if (roleAssigneeError.message && !roleAssigneeError.message.includes('401')) {
        console.warn(`Role assignment API failed for project ${project.id}:`, roleAssigneeError);
      }
      // Fallback to direct assignment when role-based assignment fails
      if (project.currentAssignee) {
        return {
          initials: `${project.currentAssignee.firstName?.charAt(0) || ''}${project.currentAssignee.lastName?.charAt(0) || ''}`,
          source: "direct_assignment_fallback" as const,
          usedFallback: false,
          roleUsed: null
        };
      }
      
      if (project.clientManager) {
        return {
          initials: `${project.clientManager.firstName?.charAt(0) || ''}${project.clientManager.lastName?.charAt(0) || ''}`,
          source: "direct_assignment_fallback" as const,
          usedFallback: false,
          roleUsed: null
        };
      }

      return {
        initials: "?",
        source: "error" as const,
        usedFallback: false,
        roleUsed: null
      };
    }

    // Use role-based assignment if available (including null responses)
    if (roleAssigneeData) {
      if (roleAssigneeData.user) {
        const user = roleAssigneeData.user;
        return {
          initials: `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`,
          source: roleAssigneeData.source,
          usedFallback: roleAssigneeData.usedFallback,
          roleUsed: roleAssigneeData.roleUsed
        };
      } else if (roleAssigneeData.source === 'none') {
        // Handle 'none' source gracefully - no assignment found
        if (project.currentAssignee) {
          return {
            initials: `${project.currentAssignee.firstName?.charAt(0) || ''}${project.currentAssignee.lastName?.charAt(0) || ''}`,
            source: "direct_assignment" as const,
            usedFallback: false,
            roleUsed: null
          };
        }
        
        if (project.clientManager) {
          return {
            initials: `${project.clientManager.firstName?.charAt(0) || ''}${project.clientManager.lastName?.charAt(0) || ''}`,
            source: "direct_assignment" as const,
            usedFallback: false,
            roleUsed: null
          };
        }

        return {
          initials: "?",
          source: "none" as const,
          usedFallback: false,
          roleUsed: null
        };
      }
    }

    // Final fallback to direct assignment (for backward compatibility)
    if (project.currentAssignee) {
      return {
        initials: `${project.currentAssignee.firstName?.charAt(0) || ''}${project.currentAssignee.lastName?.charAt(0) || ''}`,
        source: "direct_assignment" as const,
        usedFallback: false,
        roleUsed: null
      };
    }
    
    if (project.clientManager) {
      return {
        initials: `${project.clientManager.firstName?.charAt(0) || ''}${project.clientManager.lastName?.charAt(0) || ''}`,
        source: "direct_assignment" as const,
        usedFallback: false,
        roleUsed: null
      };
    }

    return {
      initials: "?",
      source: "none" as const,
      usedFallback: false,
      roleUsed: null
    };
  }, [isLoadingAssignee, roleAssigneeError, roleAssigneeData, project.currentAssignee, project.clientManager, project.id]);

  // Memoized calculation of current business hours in stage using shared calculateCurrentInstanceTime function
  const currentBusinessHours = useMemo(() => {
    const createdAt = project.createdAt 
      ? (typeof project.createdAt === 'string' ? project.createdAt : new Date(project.createdAt).toISOString())
      : undefined;
    
    // Transform chronology data to match the expected format for calculateCurrentInstanceTime
    // Filter out null timestamps and convert Date objects to ISO strings
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

  // Check if project is overdue based on project-specific stage configuration
  const overdueStatus = useMemo(() => {
    // Handle edge case: maxInstanceTime = 0 means unlimited time (no overdue)
    if (!effectiveStageConfig?.maxInstanceTime || effectiveStageConfig.maxInstanceTime === 0) {
      return false; // No time limit configured or unlimited time
    }
    
    // Use >= for overdue threshold (inclusive) - projects are overdue when they meet or exceed the limit
    return currentBusinessHours >= effectiveStageConfig.maxInstanceTime;
  }, [currentBusinessHours, effectiveStageConfig?.maxInstanceTime]);

  const formattedTimeInStage = formatBusinessHours(currentBusinessHours);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSortableDragging ? "opacity-50" : ""
      } ${isDragging ? "rotate-5 shadow-lg" : ""}`}
      onClick={onOpenModal}
      data-testid={`project-card-${project.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h4 className="font-medium text-foreground line-clamp-1" title={project.client.name}>
            {project.client.name}
          </h4>
          <div className="flex items-center space-x-1 flex-shrink-0">
            {project.priority === "urgent" && (
              <AlertCircle className="w-3 h-3 text-red-500" />
            )}
            <GripVertical 
              className="w-4 h-4 text-muted-foreground opacity-40" 
              title="Drag to move"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3 text-muted-foreground">
            <span className="flex items-center space-x-1">
              <div 
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                  assigneeInfo.source === 'loading' 
                    ? 'bg-muted animate-pulse' 
                    : assigneeInfo.usedFallback 
                    ? 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400' 
                    : 'bg-accent'
                }`}
                data-testid={`assignee-avatar-${project.id}`}
                title={
                  assigneeInfo.source === 'loading' 
                    ? 'Loading assignee...'
                    : assigneeInfo.usedFallback 
                    ? `Fallback user (role: ${assigneeInfo.roleUsed})` 
                    : assigneeInfo.roleUsed 
                    ? `Role-based assignment (${assigneeInfo.roleUsed})` 
                    : 'Direct assignment'
                }
              >
                {assigneeInfo.initials}
              </div>
            </span>
            <div className="flex items-center space-x-2">
              <Clock className="w-3 h-3" />
              <span 
                data-testid={`business-hours-${project.id}`} 
                className={`${overdueStatus ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}
              >
                {formattedTimeInStage}
              </span>
              {overdueStatus && (
                <Badge 
                  variant="destructive" 
                  className="text-xs px-1 py-0 h-4"
                  data-testid={`overdue-indicator-${project.id}`}
                >
                  Overdue
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}