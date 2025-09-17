import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Clock, User as UserIcon } from "lucide-react";
import ProjectModal from "./project-modal";
import type { ProjectWithRelations, User } from "@shared/schema";

interface TaskListProps {
  projects: ProjectWithRelations[];
  user: User;
  selectedProjectId?: string | null;
  onSelectProject?: (projectId: string | null) => void;
}

export default function TaskList({ projects, user, selectedProjectId, onSelectProject }: TaskListProps) {
  const [selectedProject, setSelectedProject] = useState<ProjectWithRelations | null>(null);
  const [sortBy, setSortBy] = useState<"client" | "status" | "time">("time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const getStatusLabel = (status: string) => {
    const labels = {
      no_latest_action: "No Latest Action",
      bookkeeping_work_required: "Bookkeeping Work Required",
      in_review: "In Review",
      needs_client_input: "Needs Input from Client",
      completed: "Completed",
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      no_latest_action: "bg-amber-100 text-amber-800",
      bookkeeping_work_required: "bg-blue-100 text-blue-800",
      in_review: "bg-purple-100 text-purple-800",
      needs_client_input: "bg-orange-100 text-orange-800",
      completed: "bg-green-100 text-green-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };


  const getTimeInStage = (project: ProjectWithRelations) => {
    const lastChronology = project.chronology?.[0];
    if (!lastChronology || !lastChronology.timestamp) return 0;
    
    return Date.now() - new Date(lastChronology.timestamp).getTime();
  };

  const formatTimeInStage = (project: ProjectWithRelations) => {
    const timeDiff = getTimeInStage(project);
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h`;
  };

  const sortedProjects = [...projects].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case "client":
        comparison = a.client.name.localeCompare(b.client.name);
        break;
      case "status":
        comparison = a.currentStatus.localeCompare(b.currentStatus);
        break;
      case "time":
        comparison = getTimeInStage(b) - getTimeInStage(a);
        break;
    }
    
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  // Filter projects assigned to current user or visible to their role
  const visibleProjects = sortedProjects.filter(project => {
    if (user.role === 'admin' || user.role === 'manager') {
      return true; // Can see all projects
    }
    
    return (
      project.currentAssigneeId === user.id ||
      project.clientManagerId === user.id ||
      project.bookkeeperId === user.id
    );
  });

  return (
    <div className="p-6" data-testid="task-list">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>Task List</span>
            <Badge variant="secondary">{visibleProjects.length} tasks</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visibleProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg font-medium mb-2">No tasks found</p>
              <p>You don't have any assigned tasks at the moment.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => handleSort("client")}
                  >
                    Client {sortBy === "client" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => handleSort("status")}
                  >
                    Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => handleSort("time")}
                  >
                    Time in Stage {sortBy === "time" && (sortOrder === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleProjects.map((project) => (
                  <TableRow 
                    key={project.id} 
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedProjectId === project.id 
                        ? 'bg-primary/10 border-l-2 border-primary' 
                        : ''
                    }`}
                    onClick={() => onSelectProject?.(project.id)}
                    data-testid={`task-row-${project.id}`}
                    aria-selected={selectedProjectId === project.id}
                  >
                    <TableCell className="font-medium">
                      <span>{project.client.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(project.currentStatus)}>
                        {getStatusLabel(project.currentStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {project.currentAssignee 
                            ? `${project.currentAssignee.firstName} ${project.currentAssignee.lastName}`
                            : project.clientManager
                            ? `${project.clientManager.firstName} ${project.clientManager.lastName}`
                            : "Unassigned"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{formatTimeInStage(project)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(project);
                        }}
                        data-testid={`button-view-project-${project.id}`}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
