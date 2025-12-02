import { useState } from "react";
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
import { Plus, AlertCircle, RefreshCw, X } from "lucide-react";
import { BulkChangeStatusModal } from "./BulkChangeStatusModal";
import { BulkMoveRestrictionDialog } from "./BulkMoveRestrictionDialog";
import { BulkMoveStageConflictDialog } from "./BulkMoveStageConflictDialog";
import { BulkDragPreview } from "./BulkDragPreview";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectWithRelations, User, KanbanStage, ChangeReason } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface KanbanBoardProps {
  projects: ProjectWithRelations[];
  user: User;
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
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className="flex-1 min-w-80 h-full">{children}</div>;
}

export default function KanbanBoard({ projects, user }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // State for ChangeStatusModal
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithRelations | null>(null);
  const [targetStatus, setTargetStatus] = useState<string | null>(null);
  const [overedColumn, setOveredColumn] = useState<string | null>(null);
  
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
    };
    return acc;
  }, {} as Record<string, { title: string; color: string; assignedTo: string; order: number; isCompletionColumn: boolean }>);
  
  // Calculate max order from filtered stages
  const maxOrder = filteredStages.reduce((max, stage) => Math.max(max, stage.order ?? 0), 0);
  
  // Add synthetic completion columns for completed projects
  const stageConfigWithCompletions = stageConfig ? {
    ...stageConfig,
    'Completed - Unsuccessful': {
      title: 'Completed - Unsuccessful',
      color: '#ef4444',
      assignedTo: 'System',
      order: maxOrder + 1,
      isCompletionColumn: true,
    },
    'Completed - Success': {
      title: 'Completed - Success',
      color: '#22c55e',
      assignedTo: 'System',
      order: maxOrder + 2,
      isCompletionColumn: true,
    },
  } : stageConfig;

  // Group projects by status, mapping completion statuses to synthetic columns
  const projectsByStatus = projects.reduce((acc, project) => {
    let status: string;
    
    // Map completion statuses to synthetic column names
    if (project.completionStatus === 'completed_successfully') {
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
    
    // Block drag operations for completed projects (read-only)
    if (draggedProject?.completionStatus) {
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

    // Prevent drops into completion columns (read-only)
    const isCompletionColumn = targetStatusName === 'Completed - Success' || targetStatusName === 'Completed - Unsuccessful';
    if (isCompletionColumn) {
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

  return (
    <div className="p-6" data-testid="kanban-board">
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
        <div className="flex space-x-6 h-full overflow-x-auto">
          {orderedStages.map(([status, config]) => {
            const stageProjects = projectsByStatus[status] || [];
            
            return (
              <DroppableColumn key={status} id={`column-${status}`}>
                <Card className={`h-full ${config.isCompletionColumn ? 'border-2 border-dashed opacity-90' : ''}`}>
                    <CardHeader className={`sticky top-0 bg-card border-b border-border rounded-t-lg ${config.isCompletionColumn ? 'bg-muted/50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={getColorStyle(config.color)}
                          />
                          <h3 className={`font-semibold text-sm ${config.isCompletionColumn ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {config.title}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {stageProjects.length}
                          </Badge>
                        </div>
                        {!config.isCompletionColumn && <Plus className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {config.isCompletionColumn ? 'Read-only' : `Assigned to ${config.assignedTo}`}
                      </p>
                    </CardHeader>
                    
                    <CardContent className={`p-4 space-y-3 min-h-96 ${config.isCompletionColumn ? 'bg-muted/20' : ''}`}>
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
                  </Card>
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
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
