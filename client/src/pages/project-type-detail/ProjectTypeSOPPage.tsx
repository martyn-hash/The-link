import { useMemo, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  ShieldCheck,
  Clock,
  User,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  ClipboardList,
  List,
  Timer,
  Hourglass,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRight,
  Link2,
} from "lucide-react";
import type {
  ProjectType,
  KanbanStage,
  ChangeReason,
  StageApproval,
  StageApprovalField,
  ProjectTypeNotification,
  ClientProjectTaskTemplate,
} from "@shared/schema";
import { SYSTEM_ROLE_OPTIONS } from "./utils/constants";

function formatHours(hours: number): string {
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days} day${days !== 1 ? "s" : ""}`;
  return `${days} day${days !== 1 ? "s" : ""} ${remainingHours} hour${remainingHours !== 1 ? "s" : ""}`;
}

function NotificationTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "email":
      return <Mail className="h-4 w-4" />;
    case "sms":
      return <MessageSquare className="h-4 w-4" />;
    case "push":
      return <Smartphone className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

export default function ProjectTypeSOPPage() {
  const { id: projectTypeId } = useParams();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  const enabled = !!projectTypeId && isAuthenticated && !!user && !authLoading;
  const globalEnabled = isAuthenticated && !!user && !authLoading;

  const { data: projectType, isLoading: projectTypeLoading } = useQuery<ProjectType>({
    queryKey: ["/api/config/project-types", projectTypeId],
    queryFn: async () => {
      const response = await fetch(`/api/config/project-types?inactive=true`);
      if (!response.ok) throw new Error("Failed to fetch project types");
      const allTypes = await response.json();
      return allTypes.find((pt: ProjectType) => pt.id === projectTypeId);
    },
    enabled,
  });

  const { data: stages } = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "stages"],
    enabled,
  });

  const { data: reasons } = useQuery<ChangeReason[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "reasons"],
    enabled,
  });

  const { data: stageApprovals } = useQuery<StageApproval[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "stage-approvals"],
    enabled,
  });

  const { data: stageApprovalFields } = useQuery<StageApprovalField[]>({
    queryKey: ["/api/config/stage-approval-fields"],
    enabled: globalEnabled,
  });

  const { data: stageReasonMaps } = useQuery<any[]>({
    queryKey: ["/api/config/stage-reason-maps"],
    enabled: globalEnabled,
  });

  const { data: notifications } = useQuery<ProjectTypeNotification[]>({
    queryKey: ["/api/project-types", projectTypeId, "notifications"],
    enabled,
  });

  const { data: taskTemplates } = useQuery<ClientProjectTaskTemplate[]>({
    queryKey: ["/api/project-types", projectTypeId, "task-templates"],
    enabled,
  });

  const { data: projectTypeRoles } = useQuery<any[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "roles"],
    enabled,
  });

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: !!projectType && !projectType.serviceId && globalEnabled,
  });

  const { data: services } = useQuery<any[]>({
    queryKey: ["/api/services"],
    enabled: globalEnabled,
  });

  const availableRoles = useMemo(() => {
    if (!projectType) return [];
    return projectType.serviceId
      ? (projectTypeRoles && projectTypeRoles.length > 0 
          ? projectTypeRoles.map(role => ({ value: role.id, label: role.name }))
          : SYSTEM_ROLE_OPTIONS)
      : (allUsers
          ? allUsers.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))
          : []);
  }, [projectType, projectTypeRoles, allUsers]);

  const getStageRoleLabel = (stage: any) => {
    if (projectType?.serviceId && stage.assignedWorkRoleId) {
      const serviceRole = availableRoles.find(r => r.value === stage.assignedWorkRoleId);
      return serviceRole ? serviceRole.label : "Unknown";
    }
    if (!projectType?.serviceId && stage.assignedUserId) {
      const assignedUser = allUsers?.find(u => u.id === stage.assignedUserId);
      return assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : "Unknown";
    }
    if (stage.assignedRole) {
      const role = availableRoles.find(r => r.value === stage.assignedRole);
      return role ? role.label : stage.assignedRole;
    }
    return "Unassigned";
  };

  const sortedStages = useMemo(() => {
    return stages ? [...stages].sort((a, b) => a.order - b.order) : [];
  }, [stages]);

  const projectNotifications = useMemo(() => {
    return notifications?.filter(n => n.category === "project") || [];
  }, [notifications]);

  const serviceName = useMemo(() => {
    if (!projectType?.serviceId || !services) return null;
    return services.find(s => s.id === projectType.serviceId)?.name;
  }, [projectType, services]);

  const handlePrint = () => {
    window.print();
  };

  if (authLoading || projectTypeLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-48 mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!projectType) {
    return (
      <div className="min-h-screen bg-white p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Project Type Not Found</h1>
          <Link href="/settings">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1.5cm; size: A4; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="min-h-screen bg-white">
        <div className="no-print sticky top-0 z-50 bg-white border-b px-6 py-4 flex items-center justify-between">
          <Link href={`/settings/project-types/${projectTypeId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project Type
            </Button>
          </Link>
          <Button onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print SOP
          </Button>
        </div>

        <div className="max-w-4xl mx-auto p-8">
          <header className="mb-8 pb-6 border-b-2 border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="sop-title">
                  {projectType.name}
                </h1>
                <p className="text-lg text-gray-600">Standard Operating Procedure</p>
                {serviceName && (
                  <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5">
                    <Link2 className="h-4 w-4" />
                    Service: {serviceName}
                  </p>
                )}
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>Generated: {new Date().toLocaleDateString()}</p>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "mt-2",
                    projectType.active 
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                  )}
                >
                  {projectType.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            {projectType.description && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700">{projectType.description}</p>
              </div>
            )}
          </header>

          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2 pb-2 border-b">
              <div className="p-1.5 rounded bg-blue-100">
                <List className="h-5 w-5 text-blue-600" />
              </div>
              Workflow Stages
            </h2>

            <div className="space-y-0">
              {sortedStages.map((stage, index) => {
                const stageReasonIds = stageReasonMaps
                  ?.filter((map: any) => map.stageId === stage.id)
                  .map((map: any) => map.reasonId) || [];
                const stageReasons = reasons?.filter(r => stageReasonIds.includes(r.id)) || [];
                const approval = stage.stageApprovalId 
                  ? stageApprovals?.find(a => a.id === stage.stageApprovalId)
                  : undefined;
                const approvalFields = approval 
                  ? stageApprovalFields?.filter(f => f.stageApprovalId === approval.id) || []
                  : [];
                const stageNotifs = notifications?.filter(n => n.category === "stage" && n.stageId === stage.id) || [];
                const entryNotifs = stageNotifs.filter(n => n.stageTrigger === "entry");
                const exitNotifs = stageNotifs.filter(n => n.stageTrigger === "exit");

                return (
                  <div key={stage.id} className="relative" data-testid={`sop-stage-${stage.id}`}>
                    <div className="flex">
                      <div className="flex flex-col items-center mr-6">
                        <div
                          className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md"
                          style={{ backgroundColor: stage.color || "#6b7280" }}
                        >
                          {index + 1}
                        </div>
                        {index < sortedStages.length - 1 && (
                          <div 
                            className="w-0.5 flex-1 min-h-[32px]"
                            style={{ backgroundColor: `${stage.color || "#6b7280"}40` }}
                          />
                        )}
                      </div>

                      <div className="flex-1 pb-8">
                        <div className="border rounded-lg p-5 bg-white shadow-sm">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                {stage.name}
                                {(stage as any).canBeFinalStage && (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Final Stage
                                  </Badge>
                                )}
                              </h3>
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <User className="h-4 w-4" />
                                Assigned to: {getStageRoleLabel(stage)}
                              </p>
                            </div>
                            <div className="flex gap-3 text-sm">
                              {stage.maxInstanceTime && (
                                <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  <Timer className="h-4 w-4" />
                                  <span>{formatHours(stage.maxInstanceTime)} per visit</span>
                                </div>
                              )}
                              {stage.maxTotalTime && (
                                <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                  <Hourglass className="h-4 w-4" />
                                  <span>{formatHours(stage.maxTotalTime)} total</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {approval && (
                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <div className="flex items-center gap-2 font-medium text-amber-800 mb-2">
                                <ShieldCheck className="h-4 w-4" />
                                Approval Required: {approval.name}
                              </div>
                              {approvalFields.length > 0 && (
                                <div className="text-sm text-amber-700">
                                  <span className="font-medium">Checklist items: </span>
                                  {approvalFields.map((f, i) => (
                                    <span key={f.id}>
                                      {f.fieldName}
                                      {i < approvalFields.length - 1 ? ", " : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {stageReasons.length > 0 && (
                            <div className="mb-4">
                              <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                                <List className="h-4 w-4 text-gray-500" />
                                Change Reasons:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {stageReasons.map(reason => (
                                  <Badge key={reason.id} variant="outline" className="text-xs bg-gray-50">
                                    {reason.reason}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {stageNotifs.length > 0 && (
                            <div className="pt-3 border-t">
                              <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                                <Bell className="h-4 w-4 text-gray-500" />
                                Stage Notifications:
                              </p>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {entryNotifs.length > 0 && (
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                      <ArrowDownToLine className="h-3 w-3" />
                                      On Entry:
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {entryNotifs.map(n => (
                                        <Badge key={n.id} variant="outline" className="text-xs">
                                          <NotificationTypeIcon type={n.notificationType} />
                                          <span className="ml-1 capitalize">{n.notificationType}</span>
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {exitNotifs.length > 0 && (
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                      <ArrowUpFromLine className="h-3 w-3" />
                                      On Exit:
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {exitNotifs.map(n => (
                                        <Badge key={n.id} variant="outline" className="text-xs">
                                          <NotificationTypeIcon type={n.notificationType} />
                                          <span className="ml-1 capitalize">{n.notificationType}</span>
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {sortedStages.length === 0 && (
                <p className="text-gray-500 italic p-4 bg-gray-50 rounded-lg">
                  No workflow stages have been configured for this project type.
                </p>
              )}
            </div>
          </section>

          {projectNotifications.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2 pb-2 border-b">
                <div className="p-1.5 rounded bg-purple-100">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                Scheduled Notifications
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    Relative to Start Date
                  </h3>
                  <div className="space-y-2">
                    {projectNotifications
                      .filter(n => n.dateReference === "start_date")
                      .sort((a, b) => (a.offsetDays || 0) - (b.offsetDays || 0))
                      .map(n => (
                        <div key={n.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                          <NotificationTypeIcon type={n.notificationType} />
                          <span className="capitalize">{n.notificationType}</span>
                          <span className="text-gray-500">
                            {n.offsetType === "on" ? "on start" : `${n.offsetDays} days ${n.offsetType}`}
                          </span>
                        </div>
                      ))}
                    {projectNotifications.filter(n => n.dateReference === "start_date").length === 0 && (
                      <p className="text-sm text-gray-400 italic">None configured</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    Relative to Due Date
                  </h3>
                  <div className="space-y-2">
                    {projectNotifications
                      .filter(n => n.dateReference === "due_date")
                      .sort((a, b) => (a.offsetDays || 0) - (b.offsetDays || 0))
                      .map(n => (
                        <div key={n.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                          <NotificationTypeIcon type={n.notificationType} />
                          <span className="capitalize">{n.notificationType}</span>
                          <span className="text-gray-500">
                            {n.offsetType === "on" ? "on due" : `${n.offsetDays} days ${n.offsetType}`}
                          </span>
                        </div>
                      ))}
                    {projectNotifications.filter(n => n.dateReference === "due_date").length === 0 && (
                      <p className="text-sm text-gray-400 italic">None configured</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {taskTemplates && taskTemplates.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2 pb-2 border-b">
                <div className="p-1.5 rounded bg-blue-100">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                </div>
                Client Tasks
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                {taskTemplates.map(task => {
                  const completionStage = task.onCompletionStageId 
                    ? stages?.find(s => s.id === task.onCompletionStageId)
                    : undefined;

                  return (
                    <div 
                      key={task.id} 
                      className={cn(
                        "p-4 border rounded-lg",
                        task.isActive ? "bg-white" : "bg-gray-50 opacity-75"
                      )}
                      data-testid={`sop-task-${task.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{task.name}</h3>
                        {!task.isActive && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <ClipboardList className="h-3 w-3" />
                          {(task as any).questionCount || 0} questions
                        </span>
                        {completionStage && (
                          <span className="flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" />
                            Moves to: {completionStage.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <footer className="mt-12 pt-6 border-t text-center text-sm text-gray-500">
            <p>This document was automatically generated from the project type configuration.</p>
            <p className="mt-1">For the most up-to-date information, please refer to the system.</p>
          </footer>
        </div>
      </div>
    </>
  );
}
