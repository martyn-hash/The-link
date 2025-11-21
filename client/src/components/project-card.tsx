import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GripVertical, AlertCircle, Clock, Info, MessageSquare } from "lucide-react";
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

interface ProjectCardProps extends React.HTMLAttributes<HTMLDivElement> {
  project: ProjectWithRelations;
  stageConfig?: KanbanStage; // Fallback for display purposes from kanban board
  onOpenModal: () => void;
  isDragging?: boolean;
  onShowInfo?: (projectId: string) => void;
  onShowMessages?: (projectId: string) => void;
}

const ProjectCard = forwardRef<HTMLDivElement, ProjectCardProps>(({ 
  project, 
  stageConfig,
  onOpenModal, 
  isDragging = false,
  onShowInfo,
  onShowMessages,
  ...props
}, forwardedRef) => {
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

  // Calculate project status (On Track, Behind Schedule, Late / Overdue)
  // Priority: 1) Late/Overdue if past due date, 2) Behind Schedule if over stage time, 3) On Track
  const projectStatus = useMemo(() => {
    const now = new Date();
    
    // Priority 1: Check if project is past its overall due date
    if (project.dueDate) {
      const dueDate = new Date(project.dueDate);
      if (now > dueDate) {
        return { 
          status: 'Late / Overdue' as const, 
          color: 'bg-red-600 text-white' as const,
          bgColor: 'bg-red-50 dark:bg-red-950/30' as const
        };
      }
    }
    
    // Priority 2: Check if project has been in current stage longer than allowed
    if (effectiveStageConfig?.maxInstanceTime && effectiveStageConfig.maxInstanceTime > 0) {
      if (currentBusinessHours > effectiveStageConfig.maxInstanceTime) {
        return { 
          status: 'Behind Schedule' as const, 
          color: 'bg-amber-500 text-white' as const,
          bgColor: 'bg-amber-50 dark:bg-amber-950/30' as const
        };
      }
    }
    
    // Priority 3: On Track
    return { 
      status: 'On Track' as const, 
      color: 'bg-green-600 text-white' as const,
      bgColor: 'bg-green-50 dark:bg-green-950/30' as const
    };
  }, [currentBusinessHours, effectiveStageConfig?.maxInstanceTime, project.dueDate]);

  // Calculate time remaining until stage is due
  // This shows: max instance time for current stage - time already spent in this stage
  const timeRemaining = useMemo(() => {
    if (!effectiveStageConfig?.maxInstanceTime || effectiveStageConfig.maxInstanceTime === 0) {
      return null;
    }

    const remaining = effectiveStageConfig.maxInstanceTime - currentBusinessHours;
    return remaining;
  }, [currentBusinessHours, effectiveStageConfig?.maxInstanceTime]);

  // Format time for display (without "business" keyword)
  const formatTimeUntilDue = (hours: number | null): string => {
    if (hours === null) return "No deadline";
    if (hours <= 0) return "Overdue";
    
    const roundedHours = Math.round(hours * 10) / 10;
    
    if (roundedHours < 1) return "< 1 hour until due";
    if (roundedHours === 1) return "1 hour until due";
    if (roundedHours < 24) return `${roundedHours} hours until due`;
    
    const days = Math.floor(roundedHours / 24);
    const remainingHours = Math.round((roundedHours % 24) * 10) / 10;
    
    if (remainingHours === 0) {
      return days === 1 ? "1 day until due" : `${days} days until due`;
    } else {
      return `${days} ${days === 1 ? 'day' : 'days'}, ${remainingHours} hours until due`;
    }
  };

  const formattedTimeUntilDue = formatTimeUntilDue(timeRemaining);

  // Get assignee first name
  const assigneeFirstName = useMemo(() => {
    if (isLoadingAssignee) return "...";
    
    if (roleAssigneeData?.user) {
      return roleAssigneeData.user.firstName || "?";
    }
    
    if (project.currentAssignee) {
      return project.currentAssignee.firstName || "?";
    }
    
    if (project.clientManager) {
      return project.clientManager.firstName || "?";
    }
    
    return "?";
  }, [isLoadingAssignee, roleAssigneeData, project.currentAssignee, project.clientManager]);

  const hasQuickActions = onShowInfo || onShowMessages;

  // Merge refs: combine forwardedRef from HoverCard and setNodeRef from useSortable
  const mergedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  return (
    <Card
      ref={mergedRef}
      style={style}
      {...attributes}
      {...listeners}
      {...props}
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSortableDragging ? "opacity-50" : ""
      } ${isDragging ? "rotate-5 shadow-lg" : ""} ${projectStatus.bgColor} relative`}
      onClick={onOpenModal}
      data-testid={`project-card-${project.id}`}
    >
      <CardContent className="p-4 flex flex-col">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-foreground line-clamp-1 flex-1 pr-2" title={project.client.name}>
            {project.client.name}
          </h4>
          <div className="flex items-center space-x-1 flex-shrink-0">
            {project.priority === "urgent" && (
              <AlertCircle className="w-3 h-3 text-red-500" />
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2 text-muted-foreground truncate flex-1">
            <span 
              className="font-medium truncate"
              data-testid={`assignee-name-${project.id}`}
              title={assigneeFirstName}
            >
              {assigneeFirstName}
            </span>
            <span 
              data-testid={`time-until-due-${project.id}`} 
              className={`text-xs whitespace-nowrap ${
                projectStatus.status === 'Late / Overdue' 
                  ? 'text-red-600 dark:text-red-400' 
                  : projectStatus.status === 'Behind Schedule' 
                  ? 'text-amber-600 dark:text-amber-400' 
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {formattedTimeUntilDue}
            </span>
          </div>
        </div>
      </CardContent>

      {/* Info button in top-right corner - hidden on desktop (hover devices), visible on mobile */}
      {hasQuickActions && onShowInfo && (
        <div 
          className="absolute top-2 right-2 z-10 [@media(hover:hover)]:hidden"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-full shadow-sm hover:shadow-md transition-shadow"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowInfo(project.id);
                  }}
                  data-testid={`button-info-${project.id}`}
                >
                  <Info className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View latest stage change</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Messages button in bottom-right corner */}
      {hasQuickActions && onShowMessages && (
        <div 
          className="absolute bottom-2 right-2 z-10"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-full shadow-sm hover:shadow-md transition-shadow"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowMessages(project.id);
                  }}
                  data-testid={`button-messages-${project.id}`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View project messages</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </Card>
  );
});

ProjectCard.displayName = "ProjectCard";

export default ProjectCard;