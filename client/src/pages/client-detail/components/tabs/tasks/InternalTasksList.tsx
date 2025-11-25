import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye } from "lucide-react";
import { Link as RouterLink } from "wouter";

interface InternalTask {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'closed';
  dueDate?: string | Date;
  assignee?: {
    firstName?: string;
    lastName?: string;
  };
  taskType?: {
    name?: string;
  };
}

interface InternalTasksListProps {
  tasks: InternalTask[] | undefined;
  isLoading: boolean;
  clientId: string;
  isMobile: boolean;
}

function getPriorityVariant(priority: string): 'destructive' | 'default' | 'secondary' {
  if (priority === 'urgent') return 'destructive';
  if (priority === 'high') return 'default';
  return 'secondary';
}

function getStatusVariant(status: string): 'outline' | 'default' | 'secondary' {
  if (status === 'closed') return 'outline';
  if (status === 'in_progress') return 'default';
  return 'secondary';
}

function formatStatus(status: string): string {
  if (status === 'in_progress') return 'In Progress';
  return status;
}

export function InternalTasksList({ tasks, isLoading, clientId, isMobile }: InternalTasksListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No internal tasks for this client yet.</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {tasks.map((task) => (
          <Card key={task.id} data-testid={`card-internal-task-${task.id}`}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <RouterLink href={`/internal-tasks?task=${task.id}`}>
                    <a className="font-medium text-base hover:underline" data-testid={`link-task-${task.id}`}>
                      {task.title}
                    </a>
                  </RouterLink>
                  {task.taskType?.name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {task.taskType.name}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getPriorityVariant(task.priority)} data-testid={`badge-priority-${task.id}`}>
                    {task.priority}
                  </Badge>
                  <Badge variant={getStatusVariant(task.status)} data-testid={`badge-status-${task.id}`}>
                    {formatStatus(task.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
                  <div>
                    <span className="text-muted-foreground text-xs">Assigned To</span>
                    <p className="font-medium">
                      {task.assignee?.firstName} {task.assignee?.lastName}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Due Date</span>
                    <p className="font-medium">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                    </p>
                  </div>
                </div>

                <RouterLink href={`/internal-tasks/${task.id}?from=client&clientId=${clientId}`}>
                  <Button
                    variant="outline"
                    className="w-full h-11 mt-2"
                    data-testid={`button-view-task-${task.id}`}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </RouterLink>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} data-testid={`row-internal-task-${task.id}`}>
              <TableCell className="font-medium">
                <RouterLink href={`/internal-tasks?task=${task.id}`}>
                  <a className="hover:underline" data-testid={`link-task-${task.id}`}>
                    {task.title}
                  </a>
                </RouterLink>
              </TableCell>
              <TableCell className="text-sm">{task.taskType?.name || '-'}</TableCell>
              <TableCell>
                <Badge variant={getPriorityVariant(task.priority)} data-testid={`badge-priority-${task.id}`}>
                  {task.priority}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {task.assignee?.firstName} {task.assignee?.lastName}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(task.status)} data-testid={`badge-status-${task.id}`}>
                  {formatStatus(task.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
              </TableCell>
              <TableCell className="text-right">
                <RouterLink href={`/internal-tasks/${task.id}?from=client&clientId=${clientId}`}>
                  <Button variant="ghost" size="sm" data-testid={`button-view-task-${task.id}`}>
                    View
                  </Button>
                </RouterLink>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
