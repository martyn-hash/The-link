import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StagePipelineCompact, type StageItem } from "./stage-pipeline";
import {
  Layers,
  List,
  ShieldCheck,
  Bell,
  BookOpen,
  ClipboardList,
  Settings,
  CheckCircle2,
  Link2,
  FolderKanban,
  Clock,
  ChevronRight,
  Sparkles,
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
    active: boolean;
    singleProjectPerClient: boolean;
    serviceId?: string | null;
    serviceName?: string | null;
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
  onActiveToggle?: (active: boolean) => void;
  onSingleProjectToggle?: (singleProject: boolean) => void;
  onSectionClick?: (sectionId: string) => void;
  className?: string;
}

const defaultSections: ConfigSectionStatus[] = [
  { id: "stages", label: "Workflow Stages", icon: Layers, count: 0, status: "empty", description: "Define your project workflow" },
  { id: "reasons", label: "Change Reasons", icon: List, count: 0, status: "empty", description: "Track why projects move" },
  { id: "approvals", label: "Approval Gates", icon: ShieldCheck, count: 0, status: "empty", description: "Require sign-offs" },
  { id: "field-library", label: "Field Library", icon: BookOpen, count: 0, status: "empty", description: "Custom data fields" },
  { id: "notifications", label: "Notifications", icon: Bell, count: 0, status: "empty", description: "Automated alerts" },
  { id: "client-tasks", label: "Client Tasks", icon: ClipboardList, count: 0, status: "empty", description: "Client-facing forms" },
  { id: "settings", label: "Settings", icon: Settings, count: 0, status: "configured", description: "General configuration" },
];

function StatusBadge({ status }: { status: ConfigSectionStatus["status"] }) {
  const config = {
    configured: {
      label: "Ready",
      variant: "default" as const,
      className: "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400",
    },
    "needs-setup": {
      label: "Needs Setup",
      variant: "secondary" as const,
      className: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
    },
    empty: {
      label: "Not Configured",
      variant: "outline" as const,
      className: "text-muted-foreground",
    },
  };

  const { label, className: badgeClassName } = config[status];

  return (
    <Badge variant="outline" className={cn("text-xs", badgeClassName)}>
      {label}
    </Badge>
  );
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

export function ProjectTypeOverview({
  projectType,
  isLoading = false,
  stats = {},
  stages = [],
  configSections = defaultSections,
  isActiveTogglePending = false,
  isSingleProjectTogglePending = false,
  onActiveToggle,
  onSingleProjectToggle,
  onSectionClick,
  className,
}: ProjectTypeOverviewProps) {
  const mergedSections = useMemo(() => {
    if (configSections === defaultSections) return defaultSections;
    return defaultSections.map((def) => {
      const custom = configSections.find((s) => s.id === def.id);
      return custom || def;
    });
  }, [configSections]);

  const setupProgress = useMemo(() => {
    const configured = mergedSections.filter((s) => s.status === "configured").length;
    return Math.round((configured / mergedSections.length) * 100);
  }, [mergedSections]);

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

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="project-type-overview">
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

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="active-toggle"
                checked={projectType.active}
                disabled={isActiveTogglePending}
                onCheckedChange={onActiveToggle}
                data-testid="switch-active"
              />
              <label htmlFor="active-toggle" className="text-sm font-medium cursor-pointer">
                {projectType.active ? "Active" : "Inactive"}
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="single-project-toggle"
                checked={projectType.singleProjectPerClient}
                disabled={isSingleProjectTogglePending}
                onCheckedChange={onSingleProjectToggle}
                data-testid="switch-single-project"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label htmlFor="single-project-toggle" className="text-sm font-medium cursor-pointer">
                      Single Project
                    </label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Limit to one project of this type per client</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
          <QuickStatCard
            icon={Sparkles}
            label="Setup Progress"
            value={`${setupProgress}%`}
            subtext={`${mergedSections.filter((s) => s.status === "configured").length}/${mergedSections.length} sections`}
          />
        </div>

        {stages.length > 0 && (
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Workflow Pipeline</span>
            </div>
            <StagePipelineCompact stages={stages} />
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            Configuration Sections
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mergedSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => onSectionClick?.(section.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                    "hover:border-primary/50 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                    section.status === "configured" && "border-green-200 dark:border-green-900/50",
                    section.status === "needs-setup" && "border-amber-200 dark:border-amber-900/50"
                  )}
                  data-testid={`section-link-${section.id}`}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      section.status === "configured" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                      section.status === "needs-setup" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                      section.status === "empty" && "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{section.label}</span>
                      <div className="flex items-center gap-1">
                        {section.count > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {section.count}
                          </Badge>
                        )}
                        <StatusBadge status={section.status} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{section.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectTypeOverviewCompact({
  projectType,
  stages = [],
  configuredCount,
  totalCount,
  className,
}: {
  projectType: {
    id: string;
    name: string;
    active: boolean;
  };
  stages?: StageItem[];
  configuredCount?: number;
  totalCount?: number;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)} data-testid={`project-type-card-${projectType.id}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
              projectType.active
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            )}
          >
            <FolderKanban className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium truncate">{projectType.name}</h3>
            {stages.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {stages.length} stages
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {configuredCount !== undefined && totalCount !== undefined && (
            <Badge variant="outline" className="text-xs">
              {configuredCount}/{totalCount}
            </Badge>
          )}
          <Badge variant={projectType.active ? "default" : "secondary"}>
            {projectType.active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
