import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
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
import { Plus, Bell, Calendar, Workflow, RefreshCcw, Loader2 } from "lucide-react";
import type { ProjectType, KanbanStage, ProjectTypeNotification, ClientRequestTemplate } from "@shared/schema";
import { ProjectNotificationForm, StageNotificationForm, NotificationRow } from "../notifications";
import type { useNotificationMutations, useProjectTypeSettingsMutations } from "../../hooks";

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
          />
        )}

        {notifications?.some(n => n.category === 'project') ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.filter(n => n.category === 'project').map(notification => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    projectTypeId={projectTypeId}
                    stages={stages || []}
                    clientRequestTemplates={clientRequestTemplates || []}
                    onDelete={(id) => deleteNotificationMutation.mutate(id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : !isAddingProjectNotification && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No project notifications configured yet
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
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.filter(n => n.category === 'stage').map(notification => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    projectTypeId={projectTypeId}
                    stages={stages || []}
                    clientRequestTemplates={clientRequestTemplates || []}
                    onDelete={(id) => deleteNotificationMutation.mutate(id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : !isAddingStageNotification && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No stage notifications configured yet
            </CardContent>
          </Card>
        )}
      </div>
    </TabsContent>
  );
}
