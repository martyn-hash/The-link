import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, useDroppable, DragOverEvent, PointerSensor, KeyboardSensor, useSensor, useSensors, pointerWithin, rectIntersection } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import ProjectCard from "./project-card";
import ChangeStatusModal from "./ChangeStatusModal";
import { StageChangeModal } from "./stage-change-modal";
import { StageChangePopover } from "./stage-change-popover";
import { MessagesModal } from "./messages-modal";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, AlertCircle, RefreshCw, X, Maximize2, Minimize2, ChevronDown, ChevronRight, Clock, SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { BulkChangeStatusModal } from "./BulkChangeStatusModal";
import { BulkMoveRestrictionDialog } from "./BulkMoveRestrictionDialog";
import { BulkMoveStageConflictDialog } from "./BulkMoveStageConflictDialog";
import { BulkDragPreview } from "./BulkDragPreview";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectWithRelations, User, KanbanStage, ChangeReason } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { calculateCurrentInstanceTime } from "@shared/businessTime";

// Stage filter/sort configuration
type SortDirection = 'asc' | 'desc' | null;
interface StageFilterConfig {
  sortByTimeRemaining: SortDirection;
  filterByServices: string[]; // Service names to filter by (clients must have ALL selected services)
}

const COMPACT_MODE_STORAGE_KEY = "kanban-compact-mode";

interface KanbanBoardProps {
  projects: ProjectWithRelations[];
  user: User;
  isCompactMode?: boolean;
  onToggleCompactMode?: () => void;
  expandedStages?: Set<string>;
  onExpandedStagesChange?: (stages: Set<string>) => void;
}

// Transform user role enum values to display names
const getRoleDisplayName = (role: string | null): string => {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "client_manager":
      return "Client Manager";
    case "bookkeeper":
      return "Bookkeeper";
    default:
      return "Unassigned";
  }
};

// Get color style object for status dots - preserves exact hex colors
const getColorStyle = (hexColor: string): { backgroundColor: string } => {
  return { backgroundColor: hexColor || "#6b7280" };
};

// Droppable Column component for drag-and-drop zones
function DroppableColumn({ id, children, isCompact, isExpanded }: { id: string; children: React.ReactNode; isCompact?: boolean; isExpanded?: boolean }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div 
      ref={setNodeRef} 
      className={`h-full transition-all duration-300 ease-in-out ${
        isCompact && !isExpanded
          ? 'flex-1 min-w-[100px]' // Compact: grow equally to fill available width
          : isCompact && isExpanded
          ? 'flex-[2] min-w-80' // Expanded in compact mode: takes 2x the space of compact columns
          : 'flex-1 min-w-80' // Normal mode: equal flex
      }`}
    >
      {children}
    </div>
  );
}

export default function KanbanBoard({ 
  projects, 
  user,
  isCompactMode: externalCompactMode,
  onToggleCompactMode: externalToggleCompactMode,
  expandedStages: externalExpandedStages,
  onExpandedStagesChange: externalExpandedStagesChange
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Internal compact mode state - only used if external props not provided
  const [internalCompactMode, setInternalCompactMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COMPACT_MODE_STORAGE_KEY);
      return saved === 'true';
    }
    return false;
  });
  const [internalExpandedStages, setInternalExpandedStages] = useState<Set<string>>(new Set());
  
  // Use external state if provided, otherwise internal
  const isCompactMode = externalCompactMode !== undefined ? externalCompactMode : internalCompactMode;
  const expandedStages = externalExpandedStages !== undefined ? externalExpandedStages : internalExpandedStages;
  const setExpandedStages = externalExpandedStagesChange || setInternalExpandedStages;
  
  // Persist compact mode preference to localStorage (only for internal state)
  useEffect(() => {
    if (externalCompactMode === undefined) {
      localStorage.setItem(COMPACT_MODE_STORAGE_KEY, String(internalCompactMode));
    }
  }, [internalCompactMode, externalCompactMode]);
  
  // Toggle compact mode on/off
  const toggleCompactMode = useCallback(() => {
    if (externalToggleCompactMode) {
      externalToggleCompactMode();
    } else {
      setInternalCompactMode(prev => {
        const newValue = !prev;
        if (newValue) {
          setInternalExpandedStages(new Set());
        }
        return newValue;
      });
    }
  }, [externalToggleCompactMode]);
  
  // Toggle a single stage expanded/collapsed in compact mode
  const toggleStageExpanded = useCallback((stageName: string) => {
    const currentStages = externalExpandedStages !== undefined ? externalExpandedStages : internalExpandedStages;
    const newSet = new Set(currentStages);
    if (newSet.has(stageName)) {
      newSet.delete(stageName);
    } else {
      newSet.add(stageName);
    }
    if (externalExpandedStagesChange) {
      externalExpandedStagesChange(newSet);
    } else {
      setInternalExpandedStages(newSet);
    }
  }, [externalExpandedStages, externalExpandedStagesChange, internalExpandedStages]);
  
  // Expand all stages
  const expandAllStages = useCallback(() => {
    if (externalToggleCompactMode) {
      externalToggleCompactMode();
    } else {
      setInternalCompactMode(false);
    }
    if (externalExpandedStagesChange) {
      externalExpandedStagesChange(new Set());
    } else {
      setInternalExpandedStages(new Set());
    }
  }, [externalToggleCompactMode, externalExpandedStagesChange]);
  
  // Check if external control is being used (to hide internal toolbar)
  const isExternallyControlled = externalCompactMode !== undefined;
  
  // State for ChangeStatusModal
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithRelations | null>(null);
  const [targetStatus, setTargetStatus] = useState<string | null>(null);
  const [overedColumn, setOveredColumn] = useState<string | null>(null);
  
  // State for immediate visual card movement (optimistic UI)
  const [pendingMove, setPendingMove] = useState<{ projectId: string; toStatus: string } | null>(null);
  
  // State for StageChangeModal (mobile fallback) and MessagesModal
  const [showStageChangeModal, setShowStageChangeModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [modalProjectId, setModalProjectId] = useState<string | null>(null);
  
  // State for hover-based popover (desktop only)
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  
  // State for multi-select (CTRL+Click)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  
  // State for bulk change status modal
  const [showBulkChangeStatusModal, setShowBulkChangeStatusModal] = useState(false);
  
  // State for bulk move restriction dialog
  const [showBulkMoveRestrictionDialog, setShowBulkMoveRestrictionDialog] = useState(false);
  const [showBulkMoveStageConflictDialog, setShowBulkMoveStageConflictDialog] = useState(false);
  const [conflictingStageNames, setConflictingStageNames] = useState<string[]>([]);
  const [bulkMoveRestrictions, setBulkMoveRestrictions] = useState<string[]>([]);
  
  // State for pre-validated bulk move data
  const [bulkMoveValidReasons, setBulkMoveValidReasons] = useState<Array<{ id: string; reason: string }>>([]);
  const [isValidatingBulkMove, setIsValidatingBulkMove] = useState(false);
  
  // Get authentication state
  const { isAuthenticated, user: authUser } = useAuth();
  
  // Fetch query counts for all projects (batch query)
  const { data: queryCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['/api/queries/counts'],
    enabled: isAuthenticated && !!authUser,
    staleTime: 30 * 1000, // 30 seconds - refresh frequently for query counts
    refetchInterval: 60 * 1000, // Refetch every minute
  });
  
  // State for stage-level filters and sorting
  const [stageFilters, setStageFilters] = useState<Record<string, StageFilterConfig>>({});
  
  // Get all unique service types across all projects' clients for filter options
  const allServiceTypes = useMemo(() => {
    const services = new Set<string>();
    projects.forEach(project => {
      if (project.priorityServiceIndicators) {
        project.priorityServiceIndicators.forEach(indicator => {
          const name = typeof indicator === 'string' ? indicator : indicator.name;
          if (name) services.add(name);
        });
      }
    });
    return Array.from(services).sort();
  }, [projects]);
  
  // Helper to calculate time remaining for a project in its current stage
  const getProjectTimeRemaining = useCallback((project: ProjectWithRelations, stageConfig?: KanbanStage): number | null => {
    if (!stageConfig?.maxInstanceTime || stageConfig.maxInstanceTime === 0) {
      return null;
    }
    
    try {
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
      
      const currentBusinessHours = calculateCurrentInstanceTime(
        transformedChronology,
        project.currentStatus,
        createdAt
      );
      
      return stageConfig.maxInstanceTime - currentBusinessHours;
    } catch (error) {
      return null;
    }
  }, []);
  
  // Get filter config for a stage, or defaults
  const getStageFilter = (stageName: string): StageFilterConfig => {
    return stageFilters[stageName] || { sortByTimeRemaining: null, filterByServices: [] };
  };
  
  // Update filter for a specific stage
  const updateStageFilter = (stageName: string, updates: Partial<StageFilterConfig>) => {
    setStageFilters(prev => ({
      ...prev,
      [stageName]: { ...getStageFilter(stageName), ...updates }
    }));
  };
  
  // Clear all filters for a stage
  const clearStageFilter = (stageName: string) => {
    setStageFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[stageName];
      return newFilters;
    });
  };
  
  // Check if a stage has any active filters
  const hasActiveFilters = (stageName: string): boolean => {
    const filter = stageFilters[stageName];
    if (!filter) return false;
    return filter.sortByTimeRemaining !== null || filter.filterByServices.length > 0;
  };
  
  // Handler for toggling project selection (CTRL+Click)
  const handleSelectToggle = (projectId: string) => {
    setSelectedProjectIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };
  
  // Clear selection when appropriate
  const clearSelection = () => {
    setSelectedProjectIds(new Set());
  };

  // Handlers for quick actions
  const handleShowInfo = (projectId: string) => {
    setModalProjectId(projectId);
    setShowStageChangeModal(true);
  };

  const handleShowMessages = (projectId: string) => {
    setModalProjectId(projectId);
    setShowMessagesModal(true);
  };

  // Configure sensors with activation constraints to distinguish between clicks and drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // User must drag 8px before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Custom collision detection that prioritizes column droppables over cards
  const customCollisionDetection = (args: any) => {
    // First try pointerWithin for pointer/touch sensors
    const pointerCollisions = pointerWithin(args);
    
    // If pointer strategy found results, prioritize column droppables
    if (pointerCollisions.length > 0) {
      const columnCollisions = pointerCollisions.filter((collision: any) => {
        return typeof collision.id === 'string' && collision.id.startsWith('column-');
      });
      
      // If we found a column, return it; otherwise return the pointer results
      if (columnCollisions.length > 0) {
        return columnCollisions;
      }
      return pointerCollisions;
    }
    
    // Fall back to rectIntersection for keyboard sensors and when pointer yields no hits
    const rectCollisions = rectIntersection(args);
    const columnCollisions = rectCollisions.filter((collision: any) => {
      return typeof collision.id === 'string' && collision.id.startsWith('column-');
    });
    
    // If we found a column, return it; otherwise return all rect collision results
    if (columnCollisions.length > 0) {
      return columnCollisions;
    }
    return rectCollisions;
  };

  const navigateToProject = (projectId: string) => {
    setLocation(`/projects/${projectId}`);
  };

  // Get unique project type (kanban assumes single project type/service filter)
  const projectTypeId = projects[0]?.projectTypeId;

  // Fetch stages for the project type
  const { 
    data: stages, 
    isLoading: stagesLoading, 
    isError: stagesError,
    error,
    refetch: refetchStages 
  } = useQuery<KanbanStage[]>({
    queryKey: ['/api/config/project-types', projectTypeId, 'stages'],
    enabled: !!projectTypeId && isAuthenticated && !!authUser,
    staleTime: 5 * 60 * 1000,
  });

  // Filter out any completion-related stages from the original stages list
  const filteredStages = stages?.filter(stage => 
    !stage.name.toLowerCase().includes('completed')
  ) ?? [];

  // Transform filtered stages to match expected structure
  const stageConfig = filteredStages.reduce((acc, stage, index) => {
    acc[stage.name] = {
      title: stage.name.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      color: stage.color ?? "#6b7280",
      assignedTo: "Role-based", // This will be determined by role assignments
      order: stage.order ?? index,
      isCompletionColumn: false,
      isBenchColumn: false,
    };
    return acc;
  }, {} as Record<string, { title: string; color: string; assignedTo: string; order: number; isCompletionColumn: boolean; isBenchColumn: boolean }>);
  
  // Calculate max order from filtered stages
  const maxOrder = filteredStages.reduce((max, stage) => Math.max(max, stage.order ?? 0), 0);
  
  // Add synthetic columns for completed and benched projects
  // Order: active stages -> Completed - Unsuccessful -> Completed - Success -> On The Bench (very end)
  const stageConfigWithCompletions = stageConfig ? {
    ...stageConfig,
    'Completed - Unsuccessful': {
      title: 'Completed - Unsuccessful',
      color: '#ef4444',
      assignedTo: 'System',
      order: maxOrder + 1,
      isCompletionColumn: true,
      isBenchColumn: false,
    },
    'Completed - Success': {
      title: 'Completed - Success',
      color: '#22c55e',
      assignedTo: 'System',
      order: maxOrder + 2,
      isCompletionColumn: true,
      isBenchColumn: false,
    },
    'On The Bench': {
      title: 'On The Bench',
      color: '#f59e0b', // Amber color for bench
      assignedTo: 'Suspended',
      order: maxOrder + 3, // Very end - after all completion columns
      isCompletionColumn: false,
      isBenchColumn: true,
    },
  } : stageConfig;

  // Group projects by status, mapping benched and completion statuses to synthetic columns
  // Also account for pending moves to show cards in target column immediately
  const projectsByStatus = projects.reduce((acc, project) => {
    let status: string;
    
    // Check if this project has a pending move (optimistic UI)
    if (pendingMove && pendingMove.projectId === project.id) {
      status = pendingMove.toStatus;
    // Map benched projects to the bench column
    } else if (project.isBenched) {
      status = 'On The Bench';
    // Map completion statuses to synthetic column names
    } else if (project.completionStatus === 'completed_successfully') {
      status = 'Completed - Success';
    } else if (project.completionStatus === 'completed_unsuccessfully') {
      status = 'Completed - Unsuccessful';
    } else {
      // Use regular current status for active projects
      status = project.currentStatus;
    }
    
    if (!acc[status]) acc[status] = [];
    acc[status].push(project);
    return acc;
  }, {} as Record<string, ProjectWithRelations[]>);


  const handleDragStart = (event: DragStartEvent) => {
    const draggedProjectId = event.active.id as string;
    const draggedProject = projects.find(p => p.id === draggedProjectId);
    
    // Block drag operations for completed or benched projects (read-only)
    if (draggedProject?.completionStatus || draggedProject?.isBenched) {
      return;
    }
    
    // Close any open hover popovers when drag starts
    setHoveredProjectId(null);
    
    // Handle selection state for bulk moves:
    // 1. If dragging a selected card with multi-select active (>1), keep all selections for bulk move
    // 2. If dragging an unselected card, clear selection and start fresh (single drag)
    if (selectedProjectIds.has(draggedProjectId) && selectedProjectIds.size > 1) {
      // Dragging a card that's part of multi-selection - keep all selected for bulk move
      // Selection stays as-is
    } else {
      // Not a multi-select bulk drag - clear any existing selection
      clearSelection();
    }
    
    setActiveId(draggedProjectId);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && typeof over.id === 'string' && over.id.startsWith('column-')) {
      // Extract status name from column ID (e.g., "column-in_review" -> "in_review")
      const columnStatus = over.id.replace('column-', '');
      setOveredColumn(columnStatus);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || typeof over.id !== 'string') {
      setOveredColumn(null);
      return;
    }

    let targetStatusName: string | null = null;

    // Check if dropped over a column directly
    if (over.id.startsWith('column-')) {
      targetStatusName = over.id.replace('column-', '');
    } else {
      // Dropped over a project card - find which column the target project is in
      const targetProject = projects.find(p => p.id === over.id);
      if (targetProject) {
        targetStatusName = targetProject.currentStatus;
      }
    }

    // Prevent drops into completion or bench columns (read-only)
    const isCompletionColumn = targetStatusName === 'Completed - Success' || targetStatusName === 'Completed - Unsuccessful';
    const isBenchColumn = targetStatusName === 'On The Bench';
    if (isCompletionColumn || isBenchColumn) {
      setOveredColumn(null);
      return;
    }

    // Handle status change if we found a valid target status
    if (targetStatusName) {
      const draggedProjectId = active.id as string;
      const draggedProject = projects.find(p => p.id === draggedProjectId);
      
      // Check if this is a bulk move - when multi-select is active (>1 selected), any drag uses the selection
      const hasMultiSelect = selectedProjectIds.size > 1;
      const isBulkMove = hasMultiSelect;
      
      if (isBulkMove) {
        // Get all selected projects
        const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
        
        // Check that all selected projects are in the same current stage
        const currentStages = new Set(selectedProjects.map(p => p.currentStatus));
        if (currentStages.size > 1) {
          // Show conflict dialog with the list of stages
          setConflictingStageNames(Array.from(currentStages));
          setShowBulkMoveStageConflictDialog(true);
          setOveredColumn(null);
          return;
        }
        
        // Check if moving to a different status
        const sourceStatus = selectedProjects[0].currentStatus;
        if (sourceStatus !== targetStatusName) {
          // Pre-flight validation: check if bulk move is allowed for this stage
          setIsValidatingBulkMove(true);
          try {
            const eligibility = await apiRequest("POST", "/api/projects/bulk-move-eligibility", {
              projectTypeId: selectedProjects[0].projectTypeId,
              targetStageName: targetStatusName,
            });
            
            if (eligibility.eligible) {
              // Stage is eligible for bulk move - show the form modal
              setBulkMoveValidReasons(eligibility.validReasons || []);
              setTargetStatus(targetStatusName);
              setShowBulkChangeStatusModal(true);
            } else {
              // Stage has restrictions - show informative dialog
              setBulkMoveRestrictions(eligibility.restrictions || ["unknown"]);
              setTargetStatus(targetStatusName);
              setShowBulkMoveRestrictionDialog(true);
            }
          } catch (error) {
            console.error("[Kanban] Bulk move eligibility check failed:", error);
            toast({
              title: "Validation failed",
              description: "Could not validate bulk move eligibility. Please try again.",
              variant: "destructive",
            });
          } finally {
            setIsValidatingBulkMove(false);
          }
        }
      } else {
        // Single project move
        if (draggedProject && draggedProject.currentStatus !== targetStatusName) {
          // Set pending move for immediate visual feedback
          setPendingMove({ projectId: draggedProject.id, toStatus: targetStatusName });
          setSelectedProject(draggedProject);
          setTargetStatus(targetStatusName);
          setShowChangeStatusModal(true);
        }
      }
    }
    
    // Reset overed column
    setOveredColumn(null);
  };

  // Callback when status is successfully updated
  const handleStatusUpdated = () => {
    // Clear pending move - the cache is now updated with the real data
    setPendingMove(null);
    // Modal handles its own closing (including showing client notification if needed)
    // Only reset the selected project/target state when modal closes via handleModalClose
    // Don't close the modal here - let ChangeStatusModal control that based on whether
    // there's a client notification to show
  };

  // Callback when modal is closed without updating
  const handleModalClose = () => {
    setShowChangeStatusModal(false);
    setSelectedProject(null);
    setTargetStatus(null);
    // Clear pending move - card snaps back to original position
    setPendingMove(null);
  };
  
  // Callback when bulk modal is closed
  const handleBulkModalClose = () => {
    setShowBulkChangeStatusModal(false);
    setTargetStatus(null);
    setBulkMoveValidReasons([]);
    clearSelection();
  };
  
  // Callback when bulk status update is successful
  const handleBulkStatusUpdated = () => {
    setShowBulkChangeStatusModal(false);
    setTargetStatus(null);
    setBulkMoveValidReasons([]);
    clearSelection();
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
  };
  
  // Callback when restriction dialog is closed
  const handleRestrictionDialogClose = () => {
    setShowBulkMoveRestrictionDialog(false);
    setTargetStatus(null);
    setBulkMoveRestrictions([]);
    // Don't clear selection - let user try moving to a different stage
  };

  const activeProject = activeId ? projects.find(p => p.id === activeId) : null;

  // Show error state if stages query failed
  if (stagesError) {
    return (
      <div className="p-6" data-testid="kanban-board-error">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Stages</h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Unable to load kanban stages. Please try again."}
            </p>
            <Button 
              onClick={() => refetchStages()} 
              data-testid="button-retry-stages"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state while stages are being fetched
  if (stagesLoading || !stageConfigWithCompletions) {
    return (
      <div className="p-6" data-testid="kanban-board-loading">
        <div className="flex space-x-6 h-full overflow-x-auto">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex-1 min-w-80">
              <Card className="h-full">
                <CardHeader className="sticky top-0 bg-card border-b border-border rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Skeleton className="w-3 h-3 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-6" />
                    </div>
                    <Skeleton className="w-4 h-4" />
                  </div>
                  <Skeleton className="h-3 w-24 mt-1" />
                </CardHeader>
                <CardContent className="p-4 space-y-3 min-h-96">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Sort stages by order with deterministic fallback and get ordered entries
  const orderedStages = Object.entries(stageConfigWithCompletions).sort(([, a], [, b]) => {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    return orderA - orderB;
  });

  // Calculate schedule status counts for a group of projects
  const getScheduleCounts = (stageProjects: ProjectWithRelations[], stageConfig?: KanbanStage) => {
    const now = new Date();
    let overdueCount = 0;
    let behindCount = 0;
    let onTrackCount = 0;
    
    stageProjects.forEach(project => {
      // Skip completed projects
      if (project.completionStatus) return;
      
      // Check if overdue (past due date) - highest priority
      if (project.dueDate) {
        const dueDate = new Date(project.dueDate);
        if (dueDate < now) {
          overdueCount++;
          return;
        }
      }
      
      // Check if behind schedule (exceeded stage time limit)
      if (stageConfig?.maxInstanceTime && stageConfig.maxInstanceTime > 0) {
        try {
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
          
          const currentBusinessHours = calculateCurrentInstanceTime(
            transformedChronology,
            project.currentStatus,
            createdAt
          );
          
          if (currentBusinessHours > stageConfig.maxInstanceTime) {
            behindCount++;
            return;
          }
        } catch (error) {
          // Log calculation errors for debugging, treat project as on-track
          console.warn(`[Kanban] Failed to calculate business hours for project ${project.id}:`, error);
        }
      }
      
      // Otherwise, on track
      onTrackCount++;
    });
    
    return { 
      total: stageProjects.length, 
      onTrack: onTrackCount, 
      behind: behindCount, 
      overdue: overdueCount 
    };
  };

  // Legacy function for backward compatibility
  const getOverdueCount = (stageProjects: ProjectWithRelations[]) => {
    return stageProjects.filter(project => {
      if (!project.dueDate) return false;
      const dueDate = new Date(project.dueDate);
      const now = new Date();
      return dueDate < now && !project.completionStatus;
    }).length;
  };

  return (
    <div className={isExternallyControlled ? "px-6 pb-6" : "p-6"} data-testid="kanban-board">
      {/* Compact Mode Toolbar - only shown when not externally controlled */}
      {!isExternallyControlled && (
        <div className="mb-4 flex items-center justify-between" data-testid="kanban-toolbar">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isCompactMode ? "default" : "outline"}
                    size="sm"
                    onClick={toggleCompactMode}
                    className="gap-2"
                    data-testid="button-toggle-compact-mode"
                  >
                    {isCompactMode ? (
                      <>
                        <Maximize2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Expand All</span>
                      </>
                    ) : (
                      <>
                        <Minimize2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Compact View</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isCompactMode 
                    ? "Exit compact mode and show all stages fully expanded" 
                    : "Switch to compact view to see all stages at a glance"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {isCompactMode && expandedStages.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedStages(new Set())}
                className="gap-1 text-muted-foreground"
                data-testid="button-collapse-all-stages"
              >
                <X className="h-3 w-3" />
                Collapse all ({expandedStages.size})
              </Button>
            )}
          </div>
          
          {isCompactMode && (
            <p className="text-xs text-muted-foreground hidden sm:block">
              Click any stage to expand it
            </p>
          )}
        </div>
      )}

      {/* Selection indicator bar */}
      {selectedProjectIds.size > 0 && (
        <div 
          className="mb-4 flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg p-3"
          data-testid="selection-indicator-bar"
        >
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-sm">
              {selectedProjectIds.size} project{selectedProjectIds.size !== 1 ? 's' : ''} selected
            </Badge>
            <span className="text-sm text-muted-foreground">
              Hold Ctrl/Cmd and click to select more, then drag to move
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            className="gap-1"
            data-testid="button-clear-selection"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      )}
      
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className={`flex h-full overflow-x-auto ${isCompactMode ? 'gap-1' : 'space-x-6'}`}>
          {orderedStages.map(([status, config]) => {
            const rawStageProjects = projectsByStatus[status] || [];
            // Get the actual stage config from the API for schedule calculations
            const actualStageConfig = stages?.find(s => s.name === status);
            const scheduleCounts = getScheduleCounts(rawStageProjects, actualStageConfig);
            const isStageExpanded = expandedStages.has(status);
            const showCompact = isCompactMode && !isStageExpanded;
            
            // Determine if this is a special column (read-only)
            const isSpecialColumn = config.isCompletionColumn || config.isBenchColumn;
            
            // Apply stage-level filtering and sorting
            const stageFilter = getStageFilter(status);
            let stageProjects = [...rawStageProjects];
            
            // Filter by services (AND logic - client must have ALL selected services)
            if (stageFilter.filterByServices.length > 0) {
              stageProjects = stageProjects.filter(project => {
                const projectServices = (project.priorityServiceIndicators || []).map(ind => 
                  typeof ind === 'string' ? ind : ind.name
                );
                return stageFilter.filterByServices.every(service => 
                  projectServices.includes(service)
                );
              });
            }
            
            // Sort by time remaining
            if (stageFilter.sortByTimeRemaining && actualStageConfig) {
              stageProjects.sort((a, b) => {
                const timeA = getProjectTimeRemaining(a, actualStageConfig);
                const timeB = getProjectTimeRemaining(b, actualStageConfig);
                
                // Null values (no deadline) go to the end
                if (timeA === null && timeB === null) return 0;
                if (timeA === null) return 1;
                if (timeB === null) return -1;
                
                // For 'asc' (urgent first): least time remaining first (smallest values first)
                // For 'desc' (most time): most time remaining first (largest values first)
                return stageFilter.sortByTimeRemaining === 'asc' 
                  ? timeA - timeB 
                  : timeB - timeA;
              });
            }
            
            return (
              <DroppableColumn key={status} id={`column-${status}`} isCompact={isCompactMode} isExpanded={isStageExpanded}>
                <Card 
                  className={`h-full transition-all duration-300 ${config.isCompletionColumn ? 'border-2 border-dashed opacity-90' : ''} ${config.isBenchColumn ? 'border-2 border-amber-300 dark:border-amber-700' : ''} ${showCompact ? 'cursor-pointer hover:border-primary/50' : ''}`}
                  onClick={showCompact ? () => toggleStageExpanded(status) : undefined}
                >
                  {/* Compact View Header */}
                  {showCompact ? (
                    <div className="p-3 h-full flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={getColorStyle(config.color)}
                        />
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                      
                      <h3 
                        className={`font-semibold text-xs leading-tight mb-2 ${config.isCompletionColumn ? 'text-muted-foreground' : ''} ${config.isBenchColumn ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}
                        style={{ 
                          writingMode: 'vertical-rl',
                          textOrientation: 'mixed',
                          transform: 'rotate(180deg)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxHeight: '150px'
                        }}
                      >
                        {config.title}
                      </h3>
                      
                      {/* Color-coded counts */}
                      <div className="mt-auto space-y-1">
                        {/* Total count - soft gray (pastel of black) */}
                        <Badge 
                          className={`text-xs w-full justify-center ${config.isBenchColumn ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700/50'}`}
                        >
                          {scheduleCounts.total}
                        </Badge>
                        
                        {!config.isCompletionColumn && !config.isBenchColumn && (
                          <>
                            {/* On track - soft green (matches card background) */}
                            {scheduleCounts.onTrack > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge 
                                      className="text-xs w-full justify-center bg-green-50 hover:bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-200 dark:hover:bg-green-900/50"
                                    >
                                      {scheduleCounts.onTrack}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {scheduleCounts.onTrack} on track
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {/* Behind schedule - soft amber (matches card background) */}
                            {scheduleCounts.behind > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge 
                                      className="text-xs w-full justify-center bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                                    >
                                      {scheduleCounts.behind}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {scheduleCounts.behind} behind schedule
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {/* Overdue - soft red (matches card background) */}
                            {scheduleCounts.overdue > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge 
                                      className="text-xs w-full justify-center bg-red-50 hover:bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-900/50"
                                    >
                                      {scheduleCounts.overdue}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {scheduleCounts.overdue} overdue
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Full View */
                    <>
                      <CardHeader 
                        className={`sticky top-0 bg-card border-b border-border rounded-t-lg ${config.isCompletionColumn ? 'bg-muted/50' : ''} ${config.isBenchColumn ? 'bg-amber-50 dark:bg-amber-950/30' : ''} ${isCompactMode && isStageExpanded ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                        onClick={isCompactMode && isStageExpanded ? () => toggleStageExpanded(status) : undefined}
                        data-testid={isCompactMode && isStageExpanded ? `header-collapse-${status}` : undefined}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={getColorStyle(config.color)}
                            />
                            <h3 className={`font-semibold text-sm ${config.isCompletionColumn ? 'text-muted-foreground' : ''} ${config.isBenchColumn ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
                              {config.title}
                            </h3>
                            <Badge className={`text-xs ${config.isBenchColumn ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800/50 dark:text-gray-300'}`}>
                              {hasActiveFilters(status) && stageProjects.length !== rawStageProjects.length 
                                ? `${stageProjects.length}/${rawStageProjects.length}` 
                                : stageProjects.length}
                            </Badge>
                            {!config.isCompletionColumn && !config.isBenchColumn && (
                              <>
                                {scheduleCounts.onTrack > 0 && (
                                  <Badge className="text-xs bg-green-50 hover:bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-200">
                                    {scheduleCounts.onTrack}
                                  </Badge>
                                )}
                                {scheduleCounts.behind > 0 && (
                                  <Badge className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                                    {scheduleCounts.behind}
                                  </Badge>
                                )}
                                {scheduleCounts.overdue > 0 && (
                                  <Badge className="text-xs bg-red-50 hover:bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-200 gap-1">
                                    <Clock className="w-3 h-3" />
                                    {scheduleCounts.overdue}
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {/* Stage filter popover - only show for non-special columns */}
                            {!isSpecialColumn && (
                              <Popover>
                                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className={`h-6 w-6 p-0 ${hasActiveFilters(status) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                    data-testid={`filter-button-${status}`}
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent 
                                  className="w-64 p-3" 
                                  align="end"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-medium text-sm">Sort & Filter</h4>
                                      {hasActiveFilters(status) && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 px-2 text-xs"
                                          onClick={() => clearStageFilter(status)}
                                          data-testid={`clear-filter-${status}`}
                                        >
                                          Clear
                                        </Button>
                                      )}
                                    </div>
                                    
                                    {/* Sort by time remaining */}
                                    <div className="space-y-2">
                                      <Label className="text-xs text-muted-foreground">Sort by time remaining</Label>
                                      <div className="flex gap-1">
                                        <Button
                                          variant={getStageFilter(status).sortByTimeRemaining === 'asc' ? 'default' : 'outline'}
                                          size="sm"
                                          className="flex-1 h-7 text-xs gap-1"
                                          onClick={() => updateStageFilter(status, { 
                                            sortByTimeRemaining: getStageFilter(status).sortByTimeRemaining === 'asc' ? null : 'asc' 
                                          })}
                                          data-testid={`sort-asc-${status}`}
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                          Urgent first
                                        </Button>
                                        <Button
                                          variant={getStageFilter(status).sortByTimeRemaining === 'desc' ? 'default' : 'outline'}
                                          size="sm"
                                          className="flex-1 h-7 text-xs gap-1"
                                          onClick={() => updateStageFilter(status, { 
                                            sortByTimeRemaining: getStageFilter(status).sortByTimeRemaining === 'desc' ? null : 'desc' 
                                          })}
                                          data-testid={`sort-desc-${status}`}
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                          Most time
                                        </Button>
                                      </div>
                                    </div>
                                    
                                    {/* Filter by client's other services */}
                                    {allServiceTypes.length > 0 && (
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Client has other services</Label>
                                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                          {allServiceTypes.map(service => {
                                            const currentFilter = getStageFilter(status);
                                            const isChecked = currentFilter.filterByServices.includes(service);
                                            return (
                                              <div key={service} className="flex items-center gap-2">
                                                <Checkbox
                                                  id={`filter-${status}-${service}`}
                                                  checked={isChecked}
                                                  onCheckedChange={(checked) => {
                                                    const newServices = checked
                                                      ? [...currentFilter.filterByServices, service]
                                                      : currentFilter.filterByServices.filter(s => s !== service);
                                                    updateStageFilter(status, { filterByServices: newServices });
                                                  }}
                                                  data-testid={`filter-service-${status}-${service}`}
                                                />
                                                <Label 
                                                  htmlFor={`filter-${status}-${service}`}
                                                  className="text-xs cursor-pointer"
                                                >
                                                  {service}
                                                </Label>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Active filter summary */}
                                    {hasActiveFilters(status) && (
                                      <div className="pt-2 border-t">
                                        <p className="text-xs text-muted-foreground">
                                          {getStageFilter(status).sortByTimeRemaining && (
                                            <span className="block">
                                              Sorted: {getStageFilter(status).sortByTimeRemaining === 'asc' ? 'Urgent first' : 'Most time first'}
                                            </span>
                                          )}
                                          {getStageFilter(status).filterByServices.length > 0 && (
                                            <span className="block">
                                              Filtered: {getStageFilter(status).filterByServices.join(' + ')}
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {isCompactMode && isStageExpanded && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>Click header to collapse</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {!isSpecialColumn && !isCompactMode && <Plus className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" />}
                          </div>
                        </div>
                        <p className={`text-xs mt-1 ${config.isBenchColumn ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                          {config.isCompletionColumn ? 'Read-only' : config.isBenchColumn ? 'Temporarily suspended' : `Assigned to ${config.assignedTo}`}
                        </p>
                      </CardHeader>
                      
                      <CardContent className={`p-4 space-y-3 min-h-96 ${config.isCompletionColumn ? 'bg-muted/20' : ''} ${config.isBenchColumn ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                        <SortableContext
                          items={stageProjects.map(p => p.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {stageProjects.map((project) => {
                            // Find the stage configuration for this project's current status
                            const currentStageConfig = stages?.find(s => s.name === project.currentStatus);
                            
                            return (
                              <StageChangePopover
                                key={project.id}
                                projectId={project.id}
                                open={hoveredProjectId === project.id}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setHoveredProjectId(project.id);
                                  } else if (hoveredProjectId === project.id) {
                                    setHoveredProjectId(null);
                                  }
                                }}
                              >
                                <ProjectCard
                                  project={project}
                                  stageConfig={currentStageConfig}
                                  onOpenModal={() => navigateToProject(project.id)}
                                  onShowInfo={handleShowInfo}
                                  onShowMessages={handleShowMessages}
                                  isSelected={selectedProjectIds.has(project.id)}
                                  onSelectToggle={handleSelectToggle}
                                  openQueryCount={queryCounts[project.id] || 0}
                                  isPendingMove={pendingMove?.projectId === project.id}
                                />
                              </StageChangePopover>
                            );
                          })}
                        </SortableContext>
                        
                        {stageProjects.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <p className="text-sm">No projects in this stage</p>
                          </div>
                        )}
                      </CardContent>
                    </>
                  )}
                </Card>
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={selectedProjectIds.size > 1 ? null : undefined}>
          {activeProject && selectedProjectIds.size > 1 ? (
            <BulkDragPreview
              projects={projects.filter(p => selectedProjectIds.has(p.id))}
              primaryProject={activeProject}
            />
          ) : activeProject ? (
            <ProjectCard
              project={activeProject}
              stageConfig={stages?.find(s => s.name === activeProject.currentStatus)}
              onOpenModal={() => navigateToProject(activeProject.id)}
              isDragging
              openQueryCount={queryCounts[activeProject.id] || 0}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Change Status Modal for drag-and-drop status changes */}
      {selectedProject && (
        <ChangeStatusModal
          isOpen={showChangeStatusModal}
          onClose={handleModalClose}
          project={selectedProject}
          user={user}
          onStatusUpdated={handleStatusUpdated}
          initialNewStatus={targetStatus || undefined}
        />
      )}

      {/* Stage Change Info Modal */}
      {modalProjectId && (
        <StageChangeModal
          projectId={modalProjectId}
          open={showStageChangeModal}
          onOpenChange={setShowStageChangeModal}
        />
      )}

      {/* Messages Modal */}
      {modalProjectId && (
        <MessagesModal
          projectId={modalProjectId}
          project={projects.find(p => p.id === modalProjectId)}
          open={showMessagesModal}
          onOpenChange={setShowMessagesModal}
        />
      )}

      {/* Bulk Change Status Modal for multi-select moves */}
      <BulkChangeStatusModal
        isOpen={showBulkChangeStatusModal}
        onClose={handleBulkModalClose}
        projectIds={Array.from(selectedProjectIds)}
        projects={projects.filter(p => selectedProjectIds.has(p.id))}
        targetStatus={targetStatus || ""}
        user={user}
        onStatusUpdated={handleBulkStatusUpdated}
        preValidatedReasons={bulkMoveValidReasons}
      />

      {/* Bulk Move Restriction Dialog - shows when bulk move is not allowed */}
      <BulkMoveRestrictionDialog
        isOpen={showBulkMoveRestrictionDialog}
        onClose={handleRestrictionDialogClose}
        targetStageName={targetStatus || ""}
        restrictions={bulkMoveRestrictions}
        projectCount={selectedProjectIds.size}
      />

      <BulkMoveStageConflictDialog
        isOpen={showBulkMoveStageConflictDialog}
        onClose={() => {
          setShowBulkMoveStageConflictDialog(false);
          setConflictingStageNames([]);
        }}
        stageNames={conflictingStageNames}
      />
    </div>
  );
}
