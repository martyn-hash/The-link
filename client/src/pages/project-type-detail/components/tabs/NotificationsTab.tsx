import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Bell, Calendar, Workflow, RefreshCcw, Loader2, Mail, MessageSquare, Smartphone, Clock, Play, Settings2, Trash2, ChevronRight, FileText, Users, Eye } from "lucide-react";
import type { ProjectType, KanbanStage, ProjectTypeNotification, ClientRequestTemplate, PreviewCandidatesResponse } from "@shared/schema";
import { ProjectNotificationForm, StageNotificationForm } from "../notifications";
import { NotificationPreviewDialog } from "@/components/NotificationPreviewDialog";
import { ClientPersonSelectionModal } from "@/components/ClientPersonSelectionModal";
import type { useNotificationMutations, useProjectTypeSettingsMutations } from "../../hooks";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const CHANNEL_CONFIG = {
  email: { icon: Mail, label: "Email", color: "#3b82f6" },
  sms: { icon: MessageSquare, label: "SMS", color: "#22c55e" },
  push: { icon: Smartphone, label: "Push", color: "#a855f7" },
};

interface NotificationCardProps {
  notification: ProjectTypeNotification;
  stages: KanbanStage[];
  clientRequestTemplates: ClientRequestTemplate[];
  projectTypeId: string;
  onDelete: (id: string) => void;
}

function NotificationCard({
  notification,
  stages,
  clientRequestTemplates,
  projectTypeId,
  onDelete,
}: NotificationCardProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectionModalOpen, setSelectionModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  const channel = CHANNEL_CONFIG[notification.notificationType as keyof typeof CHANNEL_CONFIG] || CHANNEL_CONFIG.email;
  const ChannelIcon = channel.icon;

  const candidatesQuery = useQuery<PreviewCandidatesResponse>({
    queryKey: ['/api/project-types', projectTypeId, 'notifications', notification.id, 'preview-candidates'],
    enabled: selectionModalOpen,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const previewMutation = useMutation({
    mutationFn: async ({ clientId, projectId, personId }: { clientId?: string; projectId?: string; personId?: string }) => {
      const params = new URLSearchParams();
      if (clientId) params.append('clientId', clientId);
      if (projectId) params.append('projectId', projectId);
      if (personId) params.append('personId', personId);
      
      const url = `/api/project-types/${projectTypeId}/notifications/${notification.id}/preview${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch preview');
      return res.json();
    },
  });

  const handlePreviewClick = () => {
    setSelectionModalOpen(true);
  };

  const handleClientPersonSelect = (clientId: string, projectId: string, personId: string) => {
    setSelectionModalOpen(false);
    previewMutation.mutate(
      { clientId, projectId, personId },
      {
        onSuccess: () => {
          setPreviewOpen(true);
        },
        onError: () => {
          toast({
            title: "Preview failed",
            description: "Unable to load notification preview. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDelete = () => {
    onDelete(notification.id);
    setDeleteConfirmOpen(false);
  };

  const getEligibleStages = () => {
    const eligibleIds = notification.eligibleStageIds as string[] | null;
    if (!eligibleIds || eligibleIds.length === 0) return null;
    return eligibleIds
      .map(id => stages.find(s => s.id === id))
      .filter(Boolean);
  };

  const getTriggerInfo = () => {
    if (notification.category === 'project') {
      const offsetLabel = notification.offsetType === 'on' ? 'On' : 
        `${notification.offsetDays} day${notification.offsetDays !== 1 ? 's' : ''} ${notification.offsetType}`;
      const dateRef = notification.dateReference === 'start_date' ? 'start date' : 'due date';
      return { label: offsetLabel, sublabel: dateRef };
    } else {
      const stage = stages.find(s => s.id === notification.stageId);
      const trigger = notification.stageTrigger === 'entry' ? 'Enters' : 'Exits';
      return { label: trigger, sublabel: stage?.name || 'Unknown stage' };
    }
  };

  const getContentPreview = () => {
    if (notification.notificationType === 'email') {
      return notification.emailTitle || 'No title';
    } else if (notification.notificationType === 'sms') {
      const content = notification.smsContent || '';
      return content.length > 50 ? content.substring(0, 50) + '...' : content || 'No content';
    } else {
      return notification.pushTitle || 'No title';
    }
  };

  const linkedTemplate = clientRequestTemplates.find(t => t.id === notification.clientRequestTemplateId);
  const triggerInfo = getTriggerInfo();
  const eligibleStages = getEligibleStages();

  return (
    <>
      <Card 
        className="group hover:shadow-md transition-all duration-200 hover:border-primary/30"
        data-testid={`card-notification-${notification.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-sm font-medium">
                  {notification.category === 'project' ? (
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Play className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{triggerInfo.label}</span>
                </div>
                
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                
                <div 
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: channel.color }}
                >
                  <ChannelIcon className="h-3.5 w-3.5" />
                  <span>{channel.label}</span>
                </div>
                
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-sm">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">Client contacts</span>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <p className="font-medium text-sm line-clamp-1" data-testid={`text-notification-content-${notification.id}`}>
                  {getContentPreview()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {notification.category === 'project' 
                    ? `Relative to ${triggerInfo.sublabel}`
                    : `When project ${triggerInfo.label.toLowerCase()} "${triggerInfo.sublabel}"`
                  }
                </p>
                
                {eligibleStages && eligibleStages.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="secondary" 
                          className="text-xs cursor-help"
                          data-testid={`badge-stage-restriction-${notification.id}`}
                        >
                          {eligibleStages.length} stage{eligibleStages.length !== 1 ? 's' : ''} only
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs font-medium mb-1">Active only when project is in:</p>
                        <div className="flex flex-wrap gap-1">
                          {eligibleStages.map(stage => stage && (
                            <span 
                              key={stage.id} 
                              className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted"
                            >
                              <span 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: stage.color || '#6b7280' }}
                              />
                              {stage.name}
                            </span>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {linkedTemplate && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>Sends: </span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/client-request-templates`);
                      }}
                    >
                      {linkedTemplate.name}
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handlePreviewClick}
                      data-testid={`button-preview-notification-${notification.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Preview</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => navigate(`/settings/project-types/${projectTypeId}/notifications/${notification.id}/edit`)}
                      data-testid={`button-edit-notification-${notification.id}`}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit notification</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          data-testid={`button-delete-notification-${notification.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Delete notification</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete notification?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove this notification. Projects will no longer trigger this notification.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <ClientPersonSelectionModal
        open={selectionModalOpen}
        onOpenChange={setSelectionModalOpen}
        candidates={candidatesQuery.data?.candidates || []}
        hasEligibleCandidates={candidatesQuery.data?.hasEligibleCandidates || false}
        message={candidatesQuery.data?.message}
        isLoading={candidatesQuery.isLoading}
        onSelect={handleClientPersonSelect}
      />
      
      <NotificationPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        previewData={previewMutation.data || null}
        isLoading={previewMutation.isPending}
      />
    </>
  );
}

interface NotificationMutationsWithToggle extends ReturnType<typeof useNotificationMutations> {
  toggleNotificationsActiveMutation: ReturnType<typeof useProjectTypeSettingsMutations>['toggleNotificationsActiveMutation'];
}

interface NotificationsTabProps {
  projectType: ProjectType;
  projectTypeId: string | undefined;
  notifications: ProjectTypeNotification[] | undefined;
  stages: KanbanStage[] | undefined;
  clientRequestTemplates: ClientRequestTemplate[] | undefined;
  isAdmin: boolean;
  isAddingProjectNotification: boolean;
  setIsAddingProjectNotification: (adding: boolean) => void;
  isAddingStageNotification: boolean;
  setIsAddingStageNotification: (adding: boolean) => void;
  showRescheduleDialog: boolean;
  setShowRescheduleDialog: (show: boolean) => void;
  notificationMutations: NotificationMutationsWithToggle;
}

export function NotificationsTab({
  projectType,
  projectTypeId,
  notifications,
  stages,
  clientRequestTemplates,
  isAdmin,
  isAddingProjectNotification,
  setIsAddingProjectNotification,
  isAddingStageNotification,
  setIsAddingStageNotification,
  showRescheduleDialog,
  setShowRescheduleDialog,
  notificationMutations,
}: NotificationsTabProps) {
  const { 
    createNotificationMutation, 
    deleteNotificationMutation, 
    rescheduleNotificationsMutation,
    toggleNotificationsActiveMutation 
  } = notificationMutations;

  return (
    <TabsContent value="notifications" className="p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Notification Management</h2>
        <p className="text-muted-foreground">
          Configure automated client notifications for this project type
        </p>
      </div>
      
      <Card className={projectType?.notificationsActive === false ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" : ""}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="h-5 w-5" />
                <h3 className="font-semibold">Automated Notifications</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {projectType?.notificationsActive === false 
                  ? "⚠️ All notifications are currently disabled for this project type. No emails, SMS, or push notifications will be sent to clients."
                  : "When enabled, clients will automatically receive configured notifications via email, SMS, and push notifications."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {projectType?.notificationsActive === false ? "Disabled" : "Enabled"}
              </span>
              <Switch
                checked={projectType?.notificationsActive !== false}
                onCheckedChange={(checked) => toggleNotificationsActiveMutation.mutate(checked)}
                disabled={toggleNotificationsActiveMutation.isPending}
                data-testid="switch-notifications-active"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Project Notifications
            </h3>
            <p className="text-sm text-muted-foreground">Date-based notifications triggered relative to project start or due dates</p>
          </div>
          <Button
            onClick={() => setIsAddingProjectNotification(true)}
            data-testid="button-add-project-notification"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Project Notification
          </Button>
        </div>

        {isAddingProjectNotification && (
          <ProjectNotificationForm
            onCancel={() => setIsAddingProjectNotification(false)}
            createMutation={createNotificationMutation}
            clientRequestTemplates={clientRequestTemplates || []}
            stages={stages}
          />
        )}

        {notifications?.some(n => n.category === 'project') ? (
          <div className="relative pl-6 border-l-2 border-muted ml-2 space-y-4">
            {notifications.filter(n => n.category === 'project').map((notification, index) => (
              <div key={notification.id} className="relative">
                <div className="absolute -left-[31px] top-4 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <NotificationCard
                  notification={notification}
                  projectTypeId={projectTypeId || ''}
                  stages={stages || []}
                  clientRequestTemplates={clientRequestTemplates || []}
                  onDelete={(id) => deleteNotificationMutation.mutate(id)}
                />
              </div>
            ))}
          </div>
        ) : !isAddingProjectNotification && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No project notifications configured yet</p>
              <p className="text-xs text-muted-foreground">Add notifications triggered by start or due dates</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center">
              <Workflow className="w-5 h-5 mr-2" />
              Stage Notifications
            </h3>
            <p className="text-sm text-muted-foreground">Workflow stage trigger notifications sent when projects enter or exit stages</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <AlertDialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-reschedule-notifications"
                    disabled={rescheduleNotificationsMutation.isPending}
                  >
                    {rescheduleNotificationsMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Rescheduling…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        Reschedule Notifications
                      </span>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reschedule all notifications?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will re-run scheduling for every existing service tied to this project type. Services with up-to-date schedules will be skipped automatically.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-reschedule-cancel">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      data-testid="button-reschedule-confirm"
                      disabled={rescheduleNotificationsMutation.isPending}
                      onClick={() => rescheduleNotificationsMutation.mutate()}
                    >
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              onClick={() => setIsAddingStageNotification(true)}
              disabled={!stages || stages.length === 0}
              data-testid="button-add-stage-notification"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Stage Notification
            </Button>
          </div>
        </div>

        {isAddingStageNotification && (
          <StageNotificationForm
            onCancel={() => setIsAddingStageNotification(false)}
            createMutation={createNotificationMutation}
            stages={stages || []}
            clientRequestTemplates={clientRequestTemplates || []}
          />
        )}

        {notifications?.some(n => n.category === 'stage') ? (
          <div className="relative pl-6 border-l-2 border-muted ml-2 space-y-4">
            {notifications.filter(n => n.category === 'stage').map((notification, index) => (
              <div key={notification.id} className="relative">
                <div className="absolute -left-[31px] top-4 w-4 h-4 rounded-full bg-background border-2 border-green-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
                <NotificationCard
                  notification={notification}
                  projectTypeId={projectTypeId || ''}
                  stages={stages || []}
                  clientRequestTemplates={clientRequestTemplates || []}
                  onDelete={(id) => deleteNotificationMutation.mutate(id)}
                />
              </div>
            ))}
          </div>
        ) : !isAddingStageNotification && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <Workflow className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No stage notifications configured yet</p>
              <p className="text-xs text-muted-foreground">Add notifications triggered when projects enter or exit stages</p>
            </CardContent>
          </Card>
        )}
      </div>
    </TabsContent>
  );
}
