import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckSquare, FileText, Plus } from "lucide-react";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { InternalTasksList, ClientRequestsList } from "./tasks";

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

interface TaskInstance {
  id: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'approved';
  createdAt: string | Date;
  dueDate?: string | Date;
  categoryName?: string;
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
  template?: {
    name?: string;
  };
  customRequest?: {
    name?: string;
  };
  relatedPerson?: {
    fullName?: string;
  };
}

interface TasksTabProps {
  clientId: string;
  internalTasks: InternalTask[] | undefined;
  internalTasksLoading: boolean;
  taskInstances: TaskInstance[] | undefined;
  taskInstancesLoading: boolean;
  isMobile: boolean;
  onNewClientRequest: () => void;
}

export function TasksTab({
  clientId,
  internalTasks,
  internalTasksLoading,
  taskInstances,
  taskInstancesLoading,
  isMobile,
  onNewClientRequest,
}: TasksTabProps) {
  return (
    <div className="space-y-8">
      {/* Internal Tasks Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5" />
              Internal Tasks
            </CardTitle>
            <CreateTaskDialog
              trigger={
                <Button
                  variant="default"
                  size="sm"
                  data-testid="button-new-internal-task"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </Button>
              }
              defaultConnections={{ clientId }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <InternalTasksList
            tasks={internalTasks}
            isLoading={internalTasksLoading}
            clientId={clientId}
            isMobile={isMobile}
          />
        </CardContent>
      </Card>

      {/* Client Requests Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Client Requests
            </CardTitle>
            <Button
              variant="default"
              size="sm"
              onClick={onNewClientRequest}
              data-testid="button-new-client-request"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Client Request
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ClientRequestsList
            instances={taskInstances}
            isLoading={taskInstancesLoading}
            isMobile={isMobile}
          />
        </CardContent>
      </Card>
    </div>
  );
}
