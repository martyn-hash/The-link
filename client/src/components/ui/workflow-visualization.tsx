import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  CheckCircle2,
  ShieldCheck,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  ArrowRight,
  ExternalLink,
  List,
  ClipboardList,
  AlertCircle,
  Timer,
  Hourglass,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";

export interface StageNotification {
  id: string;
  type: "email" | "sms" | "push";
  trigger: "entry" | "exit";
  title?: string;
  isActive: boolean;
  hasClientTask?: boolean;
  clientTaskName?: string;
}

export interface StageApprovalInfo {
  id: string;
  name: string;
  fieldCount: number;
}

export interface StageReason {
  id: string;
  name: string;
  hasCustomFields?: boolean;
}

export interface WorkflowStage {
  id: string;
  name: string;
  color: string;
  order: number;
  assigneeLabel?: string;
  assigneeRole?: string;
  maxInstanceTimeHours?: number;
  maxTotalTimeHours?: number;
  isFinal?: boolean;
  approval?: StageApprovalInfo;
  reasons: StageReason[];
  notifications: StageNotification[];
}

export interface ClientTask {
  id: string;
  name: string;
  description?: string;
  questionCount: number;
  onCompletionStageName?: string;
  hasReminders?: boolean;
  reminderCount?: number;
  isActive: boolean;
}

export interface ProjectNotification {
  id: string;
  type: "email" | "sms" | "push";
  dateReference: "start_date" | "due_date";
  offsetType: "before" | "on" | "after";
  offsetDays: number;
  title?: string;
  isActive: boolean;
  hasClientTask?: boolean;
  clientTaskName?: string;
  reminderCount?: number;
}

interface WorkflowVisualizationProps {
  stages: WorkflowStage[];
  clientTasks?: ClientTask[];
  projectNotifications?: ProjectNotification[];
  onNavigateToTab?: (tab: string, itemId?: string) => void;
  className?: string;
}

function NotificationIcon({ type }: { type: "email" | "sms" | "push" }) {
  switch (type) {
    case "email":
      return <Mail className="h-3.5 w-3.5" />;
    case "sms":
      return <MessageSquare className="h-3.5 w-3.5" />;
    case "push":
      return <Smartphone className="h-3.5 w-3.5" />;
  }
}

function formatHours(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days}d`;
  return `${days}d ${remainingHours}h`;
}

function StageCard({
  stage,
  isFirst,
  isLast,
  onNavigateToTab,
}: {
  stage: WorkflowStage;
  isFirst: boolean;
  isLast: boolean;
  onNavigateToTab?: (tab: string, itemId?: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasDetails = 
    stage.reasons.length > 0 || 
    stage.notifications.length > 0 || 
    stage.approval ||
    stage.maxInstanceTimeHours ||
    stage.maxTotalTimeHours;

  const entryNotifications = stage.notifications.filter(n => n.trigger === "entry");
  const exitNotifications = stage.notifications.filter(n => n.trigger === "exit");

  return (
    <div className="relative flex" data-testid={`workflow-stage-${stage.id}`}>
      <div className="flex flex-col items-center mr-4">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg ring-4 ring-background z-10"
          style={{ backgroundColor: stage.color }}
        >
          {stage.order + 1}
        </div>
        {!isLast && (
          <div 
            className="w-0.5 flex-1 min-h-[24px]"
            style={{ backgroundColor: `${stage.color}40` }}
          />
        )}
      </div>

      <div className="flex-1 pb-6">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <Card className="overflow-hidden border-l-4 shadow-sm hover:shadow-md transition-shadow" style={{ borderLeftColor: stage.color }}>
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base" data-testid={`stage-name-${stage.id}`}>
                        {stage.name}
                      </h3>
                      {stage.isFinal && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Final
                        </Badge>
                      )}
                      {stage.approval && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-xs">
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          Approval Required
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                      {stage.assigneeLabel && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {stage.assigneeLabel}
                        </span>
                      )}
                      {stage.maxInstanceTimeHours && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1">
                                <Timer className="h-3.5 w-3.5" />
                                {formatHours(stage.maxInstanceTimeHours)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Max time per visit to this stage</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {stage.maxTotalTimeHours && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                <Hourglass className="h-3.5 w-3.5" />
                                {formatHours(stage.maxTotalTimeHours)} total
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Max total time in this stage across all visits</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {stage.reasons.length > 0 && (
                        <span className="flex items-center gap-1">
                          <List className="h-3.5 w-3.5" />
                          {stage.reasons.length} reason{stage.reasons.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {stage.notifications.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Bell className="h-3.5 w-3.5" />
                          {stage.notifications.length} notification{stage.notifications.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {hasDetails && (
                    <div className="shrink-0 p-1 hover:bg-muted rounded transition-colors">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              {hasDetails && (
                <CardContent className="pt-0 pb-4 px-4 space-y-4">
                  <div className="border-t pt-4 space-y-4">
                    {stage.approval && (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span className="font-medium text-sm text-amber-900 dark:text-amber-100">
                              {stage.approval.name}
                            </span>
                            {stage.approval.fieldCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {stage.approval.fieldCount} field{stage.approval.fieldCount !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                          {onNavigateToTab && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToTab("approvals", stage.approval?.id);
                              }}
                              data-testid={`link-edit-approval-${stage.id}`}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {stage.reasons.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                            <List className="h-4 w-4" />
                            Change Reasons
                          </h4>
                          {onNavigateToTab && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToTab("reasons");
                              }}
                              data-testid={`link-edit-reasons-${stage.id}`}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Manage
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {stage.reasons.map((reason) => (
                            <Badge
                              key={reason.id}
                              variant="outline"
                              className="text-xs font-normal"
                            >
                              {reason.name}
                              {reason.hasCustomFields && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <ClipboardList className="h-3 w-3 ml-1 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>Has custom fields</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(entryNotifications.length > 0 || exitNotifications.length > 0) && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                            <Bell className="h-4 w-4" />
                            Stage Notifications
                          </h4>
                          {onNavigateToTab && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToTab("notifications");
                              }}
                              data-testid={`link-edit-notifications-${stage.id}`}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Manage
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {entryNotifications.length > 0 && (
                            <div className="flex items-start gap-2">
                              <div className="shrink-0 mt-0.5">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="p-1 rounded bg-green-100 dark:bg-green-900/40">
                                        <ArrowDownToLine className="h-3 w-3 text-green-600 dark:text-green-400" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>On stage entry</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {entryNotifications.map((notification) => (
                                  <Badge
                                    key={notification.id}
                                    variant="outline"
                                    className={cn(
                                      "text-xs font-normal",
                                      !notification.isActive && "opacity-50"
                                    )}
                                  >
                                    <NotificationIcon type={notification.type} />
                                    <span className="ml-1 capitalize">{notification.type}</span>
                                    {notification.hasClientTask && (
                                      <ClipboardList className="h-3 w-3 ml-1 text-blue-500" />
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {exitNotifications.length > 0 && (
                            <div className="flex items-start gap-2">
                              <div className="shrink-0 mt-0.5">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="p-1 rounded bg-orange-100 dark:bg-orange-900/40">
                                        <ArrowUpFromLine className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>On stage exit</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {exitNotifications.map((notification) => (
                                  <Badge
                                    key={notification.id}
                                    variant="outline"
                                    className={cn(
                                      "text-xs font-normal",
                                      !notification.isActive && "opacity-50"
                                    )}
                                  >
                                    <NotificationIcon type={notification.type} />
                                    <span className="ml-1 capitalize">{notification.type}</span>
                                    {notification.hasClientTask && (
                                      <ClipboardList className="h-3 w-3 ml-1 text-blue-500" />
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(stage.maxInstanceTimeHours || stage.maxTotalTimeHours) && (
                      <div className="flex items-center gap-4 pt-2 border-t text-sm">
                        {stage.maxInstanceTimeHours && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/40">
                              <Timer className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <span className="font-medium text-foreground">{formatHours(stage.maxInstanceTimeHours)}</span>
                              <span className="text-xs ml-1">per visit</span>
                            </div>
                          </div>
                        )}
                        {stage.maxTotalTimeHours && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="p-1.5 rounded bg-orange-100 dark:bg-orange-900/40">
                              <Hourglass className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                              <span className="font-medium text-foreground">{formatHours(stage.maxTotalTimeHours)}</span>
                              <span className="text-xs ml-1">total max</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}

function ProjectNotificationsSection({
  notifications,
  onNavigateToTab,
}: {
  notifications: ProjectNotification[];
  onNavigateToTab?: (tab: string) => void;
}) {
  if (notifications.length === 0) return null;

  const beforeStart = notifications.filter(n => n.dateReference === "start_date" && n.offsetType === "before");
  const onStart = notifications.filter(n => n.dateReference === "start_date" && n.offsetType === "on");
  const afterStart = notifications.filter(n => n.dateReference === "start_date" && n.offsetType === "after");
  const beforeDue = notifications.filter(n => n.dateReference === "due_date" && n.offsetType === "before");
  const onDue = notifications.filter(n => n.dateReference === "due_date" && n.offsetType === "on");
  const afterDue = notifications.filter(n => n.dateReference === "due_date" && n.offsetType === "after");

  const renderNotificationGroup = (items: ProjectNotification[], label: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex flex-wrap gap-1.5">
          {items.map((n) => (
            <Badge
              key={n.id}
              variant="outline"
              className={cn("text-xs font-normal", !n.isActive && "opacity-50")}
            >
              <NotificationIcon type={n.type} />
              <span className="ml-1">
                {n.offsetType === "on" ? "On" : `${n.offsetDays}d ${n.offsetType}`}
              </span>
              {n.hasClientTask && <ClipboardList className="h-3 w-3 ml-1 text-blue-500" />}
              {(n.reminderCount ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  +{n.reminderCount} reminders
                </Badge>
              )}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="mt-6" data-testid="project-notifications-section">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded bg-purple-100 dark:bg-purple-900/40">
              <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            Date-Based Notifications
          </h3>
          {onNavigateToTab && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onNavigateToTab("notifications")}
              data-testid="link-edit-project-notifications"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Manage
            </Button>
          )}
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              Relative to Start Date
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-green-200 dark:border-green-800">
              {renderNotificationGroup(beforeStart, "Before")}
              {renderNotificationGroup(onStart, "On start")}
              {renderNotificationGroup(afterStart, "After")}
              {beforeStart.length === 0 && onStart.length === 0 && afterStart.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No notifications</span>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              Relative to Due Date
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-red-200 dark:border-red-800">
              {renderNotificationGroup(beforeDue, "Before")}
              {renderNotificationGroup(onDue, "On due")}
              {renderNotificationGroup(afterDue, "After")}
              {beforeDue.length === 0 && onDue.length === 0 && afterDue.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No notifications</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientTasksSection({
  tasks,
  onNavigateToTab,
}: {
  tasks: ClientTask[];
  onNavigateToTab?: (tab: string) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <Card className="mt-6" data-testid="client-tasks-section">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/40">
              <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            Client Tasks
            <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
          </h3>
          {onNavigateToTab && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onNavigateToTab("client-tasks")}
              data-testid="link-edit-client-tasks"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Manage
            </Button>
          )}
        </div>
        
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "p-3 rounded-lg border bg-card transition-colors",
                !task.isActive && "opacity-60"
              )}
              data-testid={`client-task-${task.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm truncate">{task.name}</span>
                    {!task.isActive && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">Inactive</Badge>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <ClipboardList className="h-3 w-3" />
                  {task.questionCount} question{task.questionCount !== 1 ? "s" : ""}
                </span>
                {task.onCompletionStageName && (
                  <span className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    → {task.onCompletionStageName}
                  </span>
                )}
                {task.hasReminders && (
                  <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800">
                    <Bell className="h-2.5 w-2.5 mr-0.5" />
                    {task.reminderCount} reminder{task.reminderCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyWorkflow({ onNavigateToTab }: { onNavigateToTab?: (tab: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-workflow">
      <div className="p-4 rounded-full bg-muted mb-4">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Workflow Stages</h3>
      <p className="text-muted-foreground text-sm mb-4 max-w-md">
        Define your project workflow by adding stages. Each stage represents a step in your process that projects move through.
      </p>
      {onNavigateToTab && (
        <Button onClick={() => onNavigateToTab("stages")} data-testid="button-add-stages">
          Add Workflow Stages
        </Button>
      )}
    </div>
  );
}

export function WorkflowVisualization({
  stages,
  clientTasks = [],
  projectNotifications = [],
  onNavigateToTab,
  className,
}: WorkflowVisualizationProps) {
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.order - b.order),
    [stages]
  );

  if (stages.length === 0) {
    return <EmptyWorkflow onNavigateToTab={onNavigateToTab} />;
  }

  return (
    <div className={cn("space-y-2", className)} data-testid="workflow-visualization">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Workflow Pipeline
          <Badge variant="secondary" className="text-xs">{stages.length} stages</Badge>
        </h2>
        {onNavigateToTab && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateToTab("stages")}
            data-testid="link-manage-stages"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Edit Stages
          </Button>
        )}
      </div>

      <div className="relative">
        {sortedStages.map((stage, index) => (
          <StageCard
            key={stage.id}
            stage={stage}
            isFirst={index === 0}
            isLast={index === sortedStages.length - 1}
            onNavigateToTab={onNavigateToTab}
          />
        ))}
      </div>

      <ProjectNotificationsSection 
        notifications={projectNotifications}
        onNavigateToTab={onNavigateToTab}
      />

      <ClientTasksSection 
        tasks={clientTasks}
        onNavigateToTab={onNavigateToTab}
      />
    </div>
  );
}
