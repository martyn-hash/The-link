import { useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import ProjectCard from "./project-card";
import ProjectModal from "./project-modal";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import type { ProjectWithRelations, User } from "@shared/schema";

interface KanbanBoardProps {
  projects: ProjectWithRelations[];
  user: User;
}

const STAGE_CONFIG = {
  no_latest_action: {
    title: "No Latest Action",
    color: "bg-amber-500",
    assignedTo: "Client Manager",
  },
  bookkeeping_work_required: {
    title: "Bookkeeping Work Required",
    color: "bg-blue-500",
    assignedTo: "Bookkeeper",
  },
  in_review: {
    title: "In Review",
    color: "bg-purple-500",
    assignedTo: "Client Manager",
  },
  needs_client_input: {
    title: "Needs Input from Client",
    color: "bg-orange-500",
    assignedTo: "Client Manager",
  },
  completed: {
    title: "Completed",
    color: "bg-green-500",
    assignedTo: "Project Status",
  },
};

export default function KanbanBoard({ projects, user }: KanbanBoardProps) {
  const [selectedProject, setSelectedProject] = useState<ProjectWithRelations | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Group projects by status
  const projectsByStatus = projects.reduce((acc, project) => {
    const status = project.currentStatus;
    if (!acc[status]) acc[status] = [];
    acc[status].push(project);
    return acc;
  }, {} as Record<string, ProjectWithRelations[]>);

  // Calculate time in current stage
  const getTimeInStage = (project: ProjectWithRelations) => {
    const lastChronology = project.chronology?.[0];
    if (!lastChronology || !lastChronology.timestamp) return "0h";
    
    const timeDiff = Date.now() - new Date(lastChronology.timestamp).getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h`;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    // Note: Drag and drop status changes would be implemented here
    // For now, users can only change status through the project modal
  };

  const activeProject = activeId ? projects.find(p => p.id === activeId) : null;

  return (
    <div className="p-6" data-testid="kanban-board">
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex space-x-6 h-full overflow-x-auto">
          {Object.entries(STAGE_CONFIG).map(([status, config]) => {
            const stageProjects = projectsByStatus[status] || [];
            
            return (
              <div key={status} className="flex-1 min-w-80">
                <Card className="h-full">
                  <CardHeader className="sticky top-0 bg-card border-b border-border rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 ${config.color} rounded-full`} />
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
                      {stageProjects.map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          timeInStage={getTimeInStage(project)}
                          onOpenModal={() => setSelectedProject(project)}
                        />
                      ))}
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
              timeInStage={getTimeInStage(activeProject)}
              onOpenModal={() => {}}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>

      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          user={user}
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}
