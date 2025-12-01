import { useLocation } from "wouter";
import { Briefcase, Eye } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProjectWithRelations } from "@shared/schema";
import { formatDate } from "../../utils/formatters";
import { getStatusColor, formatStatus } from "../../utils/projectHelpers";
import { OpenProjectRow } from "./OpenProjectRow";
import { CompletedProjectRow } from "./CompletedProjectRow";

interface ProjectsListProps {
  projects?: ProjectWithRelations[];
  isLoading: boolean;
  clientId?: string;
  isCompleted?: boolean;
}

export function ProjectsList({ projects, isLoading, clientId, isCompleted = false }: ProjectsListProps) {
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return isMobile ? (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    ) : (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-purple-700 dark:text-purple-400">Target Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Assignee</TableHead>
              {isCompleted && <TableHead>Completion</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map(i => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                {isCompleted && <TableCell><Skeleton className="h-4 w-20" /></TableCell>}
                <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-8">
        <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground mb-2">No projects found</p>
        <p className="text-sm text-muted-foreground">
          Projects will appear here when they are created for this client.
        </p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {projects.map((project) => {
          const assigneeName = project.currentAssignee 
            ? `${project.currentAssignee.firstName} ${project.currentAssignee.lastName}`
            : '-';

          const completionStatusDisplay = project.completionStatus 
            ? (project.completionStatus === 'completed_successfully' ? 'Successful' : 'Unsuccessful')
            : '-';

          const completionStatusColor = project.completionStatus === 'completed_successfully'
            ? 'text-green-600 dark:text-green-400'
            : project.completionStatus === 'completed_unsuccessfully'
            ? 'text-red-600 dark:text-red-400'
            : 'text-muted-foreground';

          const navigateToProject = () => {
            const url = clientId ? `/projects/${project.id}?from=client&clientId=${clientId}` : `/projects/${project.id}`;
            setLocation(url);
          };

          return (
            <Card key={project.id} data-testid={`card-project-${project.id}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-base" data-testid={`text-name-${project.id}`}>
                      {project.description}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge 
                      className={`text-xs ${getStatusColor(project.currentStatus)}`} 
                      data-testid={`badge-status-${project.id}`}
                    >
                      {formatStatus(project.currentStatus)}
                    </Badge>
                    {project.inactive && (
                      <Badge 
                        className="text-xs bg-muted text-muted-foreground dark:bg-slate-800 dark:text-slate-200 border border-border"
                        data-testid={`badge-inactive-${project.id}`}
                      >
                        Inactive
                      </Badge>
                    )}
                    {isCompleted && (
                      <span className={`text-sm font-medium ${completionStatusColor}`} data-testid={`text-completion-${project.id}`}>
                        {completionStatusDisplay}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
                    <div>
                      <span className="text-muted-foreground text-xs">Assignee</span>
                      <p className="font-medium" data-testid={`text-assignee-${project.id}`}>
                        {assigneeName}
                      </p>
                    </div>
                    <div>
                      <span className="text-purple-600 dark:text-purple-400 text-xs">Target Date</span>
                      <p className="font-medium text-purple-700 dark:text-purple-400" data-testid={`text-targetdate-${project.id}`}>
                        {project.targetDeliveryDate ? formatDate(project.targetDeliveryDate) : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Due Date</span>
                      <p className="font-medium" data-testid={`text-duedate-${project.id}`}>
                        {project.dueDate ? formatDate(project.dueDate) : '-'}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="default"
                    size="sm"
                    className="w-full mt-2"
                    onClick={navigateToProject}
                    data-testid={`button-view-${project.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Project
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-purple-700 dark:text-purple-400">Target Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Assignee</TableHead>
            {isCompleted && <TableHead>Completion</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => 
            isCompleted ? (
              <CompletedProjectRow key={project.id} project={project} clientId={clientId} />
            ) : (
              <OpenProjectRow key={project.id} project={project} clientId={clientId} />
            )
          )}
        </TableBody>
      </Table>
    </div>
  );
}
