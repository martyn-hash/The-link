import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  WorkflowVisualization,
  type WorkflowStage,
  type ClientTask,
  type ProjectNotification,
} from "./workflow-visualization";
import {
  Link2,
  Edit2,
  Save,
  X,
  Printer,
} from "lucide-react";

export interface ConfigSectionStatus {
  id: string;
  label: string;
  icon: any;
  count: number;
  status: "configured" | "needs-setup" | "empty";
  description?: string;
}

interface ProjectTypeOverviewProps {
  projectType: {
    id: string;
    name: string;
    description?: string | null;
    active: boolean;
    singleProjectPerClient: boolean;
    notificationsActive?: boolean;
    enableClientProjectTasks?: boolean;
    useVoiceAiForQueries?: boolean;
    serviceId?: string | null;
    serviceName?: string | null;
    dialoraConfigured?: boolean;
  } | null;
  isLoading?: boolean;
  stages?: WorkflowStage[];
  clientTasks?: ClientTask[];
  projectNotifications?: ProjectNotification[];
  configSections?: ConfigSectionStatus[];
  isDescriptionSaving?: boolean;
  onDescriptionSave?: (description: string) => void;
  onSectionClick?: (sectionId: string, itemId?: string) => void;
  onPrintSOP?: () => void;
  className?: string;
}

export function ProjectTypeOverview({
  projectType,
  isLoading = false,
  stages = [],
  clientTasks = [],
  projectNotifications = [],
  configSections = [],
  isDescriptionSaving = false,
  onDescriptionSave,
  onSectionClick,
  onPrintSOP,
  className,
}: ProjectTypeOverviewProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(projectType?.description || "");

  useEffect(() => {
    if (!isEditingDescription && projectType?.description !== undefined) {
      setDescriptionValue(projectType.description || "");
    }
  }, [projectType?.description, isEditingDescription]);

  const handleStartEditing = () => {
    setDescriptionValue(projectType?.description || "");
    setIsEditingDescription(true);
  };

  const handleSaveDescription = () => {
    if (onDescriptionSave) {
      onDescriptionSave(descriptionValue);
    }
    setIsEditingDescription(false);
  };

  const handleCancelDescription = () => {
    setDescriptionValue(projectType?.description || "");
    setIsEditingDescription(false);
  };

  if (isLoading || !projectType) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)} data-testid="project-type-overview">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl" data-testid="text-project-type-name">
                  {projectType.name}
                </CardTitle>
                <Badge
                  variant={projectType.active ? "default" : "secondary"}
                  className={cn(
                    projectType.active
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  )}
                >
                  {projectType.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {projectType.serviceId && projectType.serviceName && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Linked to {projectType.serviceName}</span>
                </div>
              )}
            </div>
            {onPrintSOP && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPrintSOP}
                className="shrink-0"
                data-testid="button-print-sop"
              >
                <Printer className="h-4 w-4 mr-2" />
                Export SOP
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Description</label>
              {!isEditingDescription && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEditing}
                  data-testid="button-edit-description"
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
              )}
            </div>
            {isEditingDescription ? (
              <div className="space-y-2">
                <Textarea
                  value={descriptionValue}
                  onChange={(e) => setDescriptionValue(e.target.value)}
                  placeholder="Describe this project type..."
                  className="min-h-[80px]"
                  data-testid="input-description"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveDescription}
                    disabled={isDescriptionSaving}
                    data-testid="button-save-description"
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelDescription}
                    data-testid="button-cancel-description"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50 min-h-[60px]">
                {projectType.description || "No description set. Click Edit to add one."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <WorkflowVisualization
        stages={stages}
        clientTasks={clientTasks}
        projectNotifications={projectNotifications}
        onNavigateToTab={onSectionClick}
      />
    </div>
  );
}
