import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import ProjectCard from "./project-card";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, AlertCircle, RefreshCw } from "lucide-react";
import type { ProjectWithRelations, User, KanbanStage } from "@shared/schema";

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

export default function KanbanBoard({ projects, user }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [location, setLocation] = useLocation();

  const navigateToProject = (projectId: string) => {
    setLocation(`/projects/${projectId}`);
  };

  // Get unique project types from the projects
  const projectTypes = Array.from(new Set(projects.map(p => p.projectTypeId).filter(Boolean)));

  // Fetch stages for all project types represented in the projects
  const stageQueries = projectTypes.map(projectTypeId => 
    useQuery<KanbanStage[]>({
      queryKey: ['/api/config/project-types', projectTypeId, 'stages'],
      enabled: !!projectTypeId,
      staleTime: 5 * 60 * 1000,
    })
  );

  // Combine all stages from different project types
  const allStages = stageQueries.flatMap(query => query.data || []);
  const stagesLoading = stageQueries.some(query => query.isLoading);
  const stagesError = stageQueries.some(query => query.isError);
  const error = stageQueries.find(query => query.error)?.error;
  const refetchStages = () => stageQueries.forEach(query => query.refetch());
  
  // Use combined stages
  const stages = allStages;

  // Transform stages to match expected structure
  const stageConfig = stages?.reduce((acc, stage, index) => {
    acc[stage.name] = {
      title: stage.name.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      color: stage.color ?? "#6b7280",
      assignedTo: getRoleDisplayName(stage.assignedRole ?? ""),
      order: stage.order ?? index,
    };
    return acc;
  }, {} as Record<string, { title: string; color: string; assignedTo: string; order: number }>);

  // Group projects by status
  const projectsByStatus = projects.reduce((acc, project) => {
    const status = project.currentStatus;
    if (!acc[status]) acc[status] = [];
    acc[status].push(project);
    return acc;
  }, {} as Record<string, ProjectWithRelations[]>);


  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    // Note: Drag and drop status changes would be implemented here
    // For now, users can only change status through the project modal
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
  if (stagesLoading || !stageConfig) {
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
  const orderedStages = Object.entries(stageConfig).sort(([, a], [, b]) => {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    return orderA - orderB;
  });

  return (
    <div className="p-6" data-testid="kanban-board">
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex space-x-6 h-full overflow-x-auto">
          {orderedStages.map(([status, config]) => {
            const stageProjects = projectsByStatus[status] || [];
            
            return (
              <div key={status} className="flex-1 min-w-80">
                <Card className="h-full">
                  <CardHeader className="sticky top-0 bg-card border-b border-border rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={getColorStyle(config.color)}
                        />
                        <h3 className="font-semibold text-foreground text-sm">
                          {config.title}
                        </h3>
                        <Badge variant="secondary" className="text-xs">
                          {stageProjects.length}
                        </Badge>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Assigned to {config.assignedTo}
                    </p>
                  </CardHeader>
                  
                  <CardContent className="p-4 space-y-3 min-h-96">
                    <SortableContext
                      items={stageProjects.map(p => p.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {stageProjects.map((project) => {
                        // Find the stage configuration for this project's current status
                        const currentStageConfig = stages?.find(s => s.name === project.currentStatus);
                        
                        return (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            stageConfig={currentStageConfig}
                            onOpenModal={() => navigateToProject(project.id)}
                          />
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
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeProject && (
            <ProjectCard
              project={activeProject}
              stageConfig={stages?.find(s => s.name === activeProject.currentStatus)}
              onOpenModal={() => navigateToProject(activeProject.id)}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>

    </div>
  );
}
