import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StagePipelineCompact, type StageItem } from "./stage-pipeline";
import {
  Layers,
  Link2,
  FolderKanban,
  Clock,
  CheckCircle2,
  Bell,
  Phone,
  Edit2,
  Save,
  X,
  AlertCircle,
  Settings2,
  ClipboardList,
} from "lucide-react";

export interface ConfigSectionStatus {
  id: string;
  label: string;
  icon: typeof Layers;
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
  stats?: {
    activeProjects?: number;
    completedProjects?: number;
    avgCompletionDays?: number;
  };
  stages?: StageItem[];
  configSections?: ConfigSectionStatus[];
  isActiveTogglePending?: boolean;
  isSingleProjectTogglePending?: boolean;
  isNotificationsTogglePending?: boolean;
  isClientProjectTasksTogglePending?: boolean;
  isVoiceAiTogglePending?: boolean;
  isDescriptionSaving?: boolean;
  onActiveToggle?: (active: boolean) => void;
  onSingleProjectToggle?: (singleProject: boolean) => void;
  onNotificationsToggle?: (active: boolean) => void;
  onClientProjectTasksToggle?: (enabled: boolean) => void;
  onVoiceAiToggle?: (useVoiceAi: boolean) => void;
  onDescriptionSave?: (description: string) => void;
  onConfigureDialora?: () => void;
  onSectionClick?: (sectionId: string) => void;
  className?: string;
}

function QuickStatCard({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {subtext && <p className="text-xs text-muted-foreground/70">{subtext}</p>}
      </div>
    </div>
  );
}

function SettingToggle({
  id,
  icon: Icon,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
  extraContent,
  testId,
}: {
  id: string;
  icon: typeof Bell;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  extraContent?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-1">
          <label htmlFor={id} className="text-sm font-medium cursor-pointer">
            {label}
          </label>
          <p className="text-xs text-muted-foreground">{description}</p>
          {extraContent}
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        data-testid={testId}
      />
    </div>
  );
}

export function ProjectTypeOverview({
  projectType,
  isLoading = false,
  stats = {},
  stages = [],
  configSections = [],
  isActiveTogglePending = false,
  isSingleProjectTogglePending = false,
  isNotificationsTogglePending = false,
  isClientProjectTasksTogglePending = false,
  isVoiceAiTogglePending = false,
  isDescriptionSaving = false,
  onActiveToggle,
  onSingleProjectToggle,
  onNotificationsToggle,
  onClientProjectTasksToggle,
  onVoiceAiToggle,
  onDescriptionSave,
  onConfigureDialora,
  onSectionClick,
  className,
}: ProjectTypeOverviewProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState(projectType?.description || "");

  // Sync description value when projectType data changes (e.g., after fetch)
  useEffect(() => {
    if (!isEditingDescription && projectType?.description !== undefined) {
      setDescriptionValue(projectType.description || "");
    }
  }, [projectType?.description, isEditingDescription]);

  // Also sync when entering edit mode to ensure we have latest value
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
          <div className="flex gap-4">
            <Skeleton className="h-20 w-32" />
            <Skeleton className="h-20 w-32" />
            <Skeleton className="h-20 w-32" />
          </div>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const dialoraConfigured = projectType.dialoraConfigured ?? false;

  return (
    <div className={cn("space-y-6", className)} data-testid="project-type-overview">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <QuickStatCard
              icon={FolderKanban}
              label="Active Projects"
              value={stats.activeProjects ?? 0}
            />
            <QuickStatCard
              icon={CheckCircle2}
              label="Completed"
              value={stats.completedProjects ?? 0}
            />
            <QuickStatCard
              icon={Clock}
              label="Avg. Completion"
              value={stats.avgCompletionDays ? `${stats.avgCompletionDays}d` : "—"}
            />
          </div>

          {stages.length > 0 && (
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Workflow Pipeline</span>
                  <Badge variant="outline" className="text-xs">{stages.length} stages</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSectionClick?.("stages")}
                  data-testid="link-manage-stages"
                >
                  Manage
                </Button>
              </div>
              <StagePipelineCompact stages={stages} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingToggle
            id="active-toggle"
            icon={CheckCircle2}
            label="Active"
            description="Enable this project type for new projects"
            checked={projectType.active}
            disabled={isActiveTogglePending}
            onCheckedChange={onActiveToggle}
            testId="switch-active"
          />

          <SettingToggle
            id="single-project-toggle"
            icon={FolderKanban}
            label="Single Project Per Client"
            description="Limit to one project of this type per client"
            checked={projectType.singleProjectPerClient}
            disabled={isSingleProjectTogglePending}
            onCheckedChange={onSingleProjectToggle}
            testId="switch-single-project"
          />

          <SettingToggle
            id="notifications-toggle"
            icon={Bell}
            label="Automated Notifications"
            description="Send automated reminders and alerts for projects"
            checked={projectType.notificationsActive ?? true}
            disabled={isNotificationsTogglePending}
            onCheckedChange={onNotificationsToggle}
            testId="switch-notifications"
          />

          <SettingToggle
            id="client-project-tasks-toggle"
            icon={ClipboardList}
            label="Enable Client Project Tasks"
            description="Allow sending pre-work checklists to clients for projects"
            checked={projectType.enableClientProjectTasks ?? true}
            disabled={isClientProjectTasksTogglePending}
            onCheckedChange={onClientProjectTasksToggle}
            testId="switch-client-project-tasks"
          />

          <SettingToggle
            id="voice-ai-toggle"
            icon={Phone}
            label="Voice AI Reminders"
            description="Use Dialora AI to make automated phone call reminders"
            checked={projectType.useVoiceAiForQueries ?? false}
            disabled={isVoiceAiTogglePending}
            onCheckedChange={onVoiceAiToggle}
            testId="switch-voice-ai"
            extraContent={
              projectType.useVoiceAiForQueries && !dialoraConfigured ? (
                <div className="mt-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onConfigureDialora}
                          className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950"
                          data-testid="button-configure-dialora"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Configure Dialora
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Set up Dialora webhooks to enable Voice AI calls</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ) : projectType.useVoiceAiForQueries && dialoraConfigured ? (
                <Badge variant="outline" className="mt-2 text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                  Dialora Configured
                </Badge>
              ) : null
            }
          />
        </CardContent>
      </Card>

      {configSections.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Quick Navigation</CardTitle>
              <span className="text-xs text-muted-foreground">Click to configure</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {configSections.filter(s => s.id !== "settings").map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => onSectionClick?.(section.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                      "hover:border-primary/50 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    )}
                    data-testid={`section-link-${section.id}`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{section.label}</span>
                        {section.count > 0 && (
                          <Badge variant="secondary" className="text-xs">{section.count}</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
