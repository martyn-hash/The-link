import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GripVertical, AlertCircle, Clock, Info, MessageSquare, Check, HelpCircle } from "lucide-react";
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
  isSelected?: boolean;
  onSelectToggle?: (projectId: string) => void;
  openQueryCount?: number; // Number of open bookkeeping queries
  isPendingMove?: boolean; // True when card is being moved (modal open, awaiting confirmation)
}

const ProjectCard = forwardRef<HTMLDivElement, ProjectCardProps>(({ 
  project, 
  stageConfig,
  onOpenModal, 
  isDragging = false,
  onShowInfo,
  onShowMessages,
  isSelected = false,
  onSelectToggle,
  openQueryCount = 0,
  isPendingMove = false,
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

  // PERFORMANCE FIX: Disabled role-assignee query for list view to prevent N+1 queries
  // The list view already has currentAssignee data from the main projects query
  // Role-assignee API is only needed in project detail view
  const { 
    data: roleAssigneeData, 
    isLoading: isLoadingAssignee, 
    error: roleAssigneeError 
  } = useQuery<RoleAssigneeResponse>({
    queryKey: ['/api/projects', project.id, 'role-assignee'],
    enabled: false, // ✅ DISABLED: Prevents 20+ individual API calls on projects list page
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

  // Format business hours for compact display (e.g., "2D 7H")
  const formatBusinessHoursCompact = (hours: number): string => {
    if (hours === 0) return "0H";
    if (hours < 1) return "< 1H";
    
    const roundedHours = Math.round(hours);
    
    if (roundedHours < 24) {
      return `${roundedHours}H`;
    } else {
      const days = Math.floor(roundedHours / 24);
      const remainingHours = Math.round(roundedHours % 24);
      
      if (remainingHours === 0) {
        return `${days}D`;
      } else {
        return `${days}D ${remainingHours}H`;
      }
    }
  };

  // Calculate project status (On Track, Behind Schedule, Late / Overdue)
  // Priority: 1) Benched (neutral), 2) Late/Overdue if past due date, 3) Behind Schedule if over stage time, 4) On Track
  // For COMPLETED projects: freeze the color based on status at completion time
  const projectStatus = useMemo(() => {
    // For benched projects, show neutral/gray status - they're neither on track nor behind
    if (project.isBenched) {
      return { 
        status: 'On The Bench' as const, 
        color: 'bg-gray-500 text-white' as const,
        bgColor: 'bg-gray-50 dark:bg-gray-800/30' as const
      };
    }
    
    // For completed projects, determine status at completion time (not current time)
    if (project.completionStatus) {
      // For completed_unsuccessfully projects, ALWAYS show as red (Late/Overdue)
      // This is because unsuccessful completion typically indicates the project missed
      // deadlines or had issues that prevented successful completion
      if (project.completionStatus === 'completed_unsuccessfully') {
        return { 
          status: 'Late / Overdue' as const, 
          color: 'bg-red-600 text-white' as const,
          bgColor: 'bg-red-50 dark:bg-red-950/30' as const
        };
      }
      
      // For completed_successfully projects, check if they were on time
      // Find the completion timestamp from chronology
      // Look for the LAST status change entry (entry with toStatus field), which indicates
      // when the project was moved to its final completed stage
      // This ignores post-completion notes or other non-status-change entries
      let completionDate: Date | null = null;
      
      if (project.chronology && Array.isArray(project.chronology) && project.chronology.length > 0) {
        // Iterate backwards to find the last status change entry (has toStatus field)
        for (let i = project.chronology.length - 1; i >= 0; i--) {
          const entry = project.chronology[i] as any;
          // Status change entries have toStatus field
          if (entry?.toStatus && entry?.timestamp) {
            completionDate = new Date(entry.timestamp);
            break;
          }
        }
      }
      
      // Fallback to updatedAt if no chronology timestamp found
      if (!completionDate && project.updatedAt) {
        completionDate = new Date(project.updatedAt);
      }
      
      // If we have a due date, compare completion date against it
      if (project.dueDate && completionDate) {
        const dueDate = new Date(project.dueDate);
        if (completionDate > dueDate) {
          // Completed AFTER due date = Late / Overdue (red)
          return { 
            status: 'Late / Overdue' as const, 
            color: 'bg-red-600 text-white' as const,
            bgColor: 'bg-red-50 dark:bg-red-950/30' as const
          };
        }
      }
      
      // Completed successfully on time or before due date = On Track (green)
      return { 
        status: 'On Track' as const, 
        color: 'bg-green-600 text-white' as const,
        bgColor: 'bg-green-50 dark:bg-green-950/30' as const
      };
    }
    
    // For active (non-completed) projects, use current time for status calculation
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
  }, [currentBusinessHours, effectiveStageConfig?.maxInstanceTime, project.dueDate, project.completionStatus, project.chronology, project.updatedAt, project.isBenched]);

  // Calculate time remaining until stage is due
  // This shows: max instance time for current stage - time already spent in this stage
  const timeRemaining = useMemo(() => {
    if (!effectiveStageConfig?.maxInstanceTime || effectiveStageConfig.maxInstanceTime === 0) {
      return null;
    }

    const remaining = effectiveStageConfig.maxInstanceTime - currentBusinessHours;
    return remaining;
  }, [currentBusinessHours, effectiveStageConfig?.maxInstanceTime]);

  // Format time for compact display (e.g., "2D 7H to go" or "Behind Schedule" or "Overdue")
  // Use projectStatus to determine the correct label:
  // - "Behind Schedule" when stage time exceeded but not past due date
  // - "Overdue" when past the actual project due date
  const formatTimeUntilDue = (hours: number | null, status: 'On Track' | 'Behind Schedule' | 'Late / Overdue' | 'On The Bench'): string => {
    if (hours === null) return "No deadline";
    if (hours <= 0) {
      // Use the actual status to determine the text
      if (status === 'Late / Overdue') {
        return "Overdue";
      }
      return "Behind Schedule";
    }
    
    const roundedHours = Math.round(hours);
    
    if (roundedHours < 1) return "< 1H to go";
    if (roundedHours < 24) return `${roundedHours}H to go`;
    
    const days = Math.floor(roundedHours / 24);
    const remainingHours = Math.round(roundedHours % 24);
    
    if (remainingHours === 0) {
      return `${days}D to go`;
    } else {
      return `${days}D ${remainingHours}H to go`;
    }
  };

  const formattedTimeUntilDue = formatTimeUntilDue(timeRemaining, projectStatus.status);

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

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.ctrlKey || e.metaKey) && onSelectToggle) {
      e.preventDefault();
      e.stopPropagation();
      onSelectToggle(project.id);
    } else {
      onOpenModal();
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
      } ${isDragging ? "rotate-5 shadow-lg" : ""} ${projectStatus.bgColor} relative ${
        isSelected ? "ring-2 ring-primary ring-offset-2" : ""
      } ${isPendingMove ? "ring-2 ring-blue-400 ring-offset-1 animate-pulse" : ""
      }`}
      onClick={handleCardClick}
      data-testid={`project-card-${project.id}`}
    >
      <CardContent className={`p-4 flex flex-col ${
        project.priorityServiceIndicators && project.priorityServiceIndicators.length > 0 && !isSelected 
          ? 'pt-7' 
          : ''
      }`}>
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-sm text-foreground line-clamp-1 flex-1 pr-2" title={project.client.name}>
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
            {/* Hide deadline indicator for benched projects - they're suspended */}
            {!project.isBenched && (
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
            )}
            {/* Open queries indicator */}
            {openQueryCount > 0 && (
              <span 
                className="inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap"
                title={`${openQueryCount} open ${openQueryCount === 1 ? 'query' : 'queries'}`}
                data-testid={`query-count-${project.id}`}
              >
                <HelpCircle className="w-3 h-3" />
                {openQueryCount}
              </span>
            )}
          </div>
        </div>
      </CardContent>

      {/* Priority service indicators - shown in top-left corner, limited to 2 inline with +N overflow */}
      {project.priorityServiceIndicators && project.priorityServiceIndicators.length > 0 && !isSelected && (
        <div 
          className="absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5"
          data-testid={`priority-indicators-${project.id}`}
        >
          {(() => {
            const MAX_VISIBLE = 1;
            const indicators = project.priorityServiceIndicators;
            const visibleIndicators = indicators.slice(0, MAX_VISIBLE);
            const overflowIndicators = indicators.slice(MAX_VISIBLE);
            const overflowCount = overflowIndicators.length;
            
            const formatDueDate = (date: Date | string | null | undefined): string => {
              if (!date) return '';
              const d = typeof date === 'string' ? new Date(date) : date;
              const day = d.getDate().toString().padStart(2, '0');
              const month = (d.getMonth() + 1).toString().padStart(2, '0');
              return `${day}/${month}`;
            };
            
            const renderIndicator = (indicator: typeof indicators[0], index: number) => {
              const indicatorObj = typeof indicator === 'string' 
                ? { name: indicator, count: 1, dueDate: null } 
                : indicator;
              
              const suffix = indicatorObj.count > 1 
                ? ' - Multiple' 
                : indicatorObj.dueDate 
                  ? ` - ${formatDueDate(indicatorObj.dueDate)}` 
                  : '';
              
              const displayText = `${indicatorObj.name}${suffix}`;
              const tooltipText = indicatorObj.count > 1 
                ? `Client has ${indicatorObj.count} active ${indicatorObj.name} projects`
                : `Client has ${indicatorObj.name} service`;
              
              return (
                <span
                  key={`${project.id}-indicator-${index}`}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  title={tooltipText}
                  data-testid={`priority-badge-${project.id}-${index}`}
                >
                  {displayText}
                </span>
              );
            };
            
            return (
              <>
                {visibleIndicators.map((indicator, index) => renderIndicator(indicator, index))}
                {overflowCount > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100 cursor-pointer hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`priority-overflow-${project.id}`}
                      >
                        +{overflowCount}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent 
                      side="bottom" 
                      align="start"
                      className="w-auto p-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col gap-1">
                        {overflowIndicators.map((indicator, idx) => {
                          const indicatorObj = typeof indicator === 'string' 
                            ? { name: indicator, count: 1, dueDate: null } 
                            : indicator;
                          const suffix = indicatorObj.count > 1 
                            ? ' - Multiple' 
                            : indicatorObj.dueDate 
                              ? ` - ${formatDueDate(indicatorObj.dueDate)}` 
                              : '';
                          return (
                            <span 
                              key={`overflow-${idx}`}
                              className="text-xs whitespace-nowrap"
                            >
                              {indicatorObj.name}{suffix}
                            </span>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Selection indicator in top-left corner */}
      {isSelected && (
        <div 
          className="absolute top-2 left-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center"
          data-testid={`selection-indicator-${project.id}`}
        >
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

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