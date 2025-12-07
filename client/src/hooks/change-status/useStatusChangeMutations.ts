import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { useToast } from "@/hooks/use-toast";
import type {
  InsertStageApprovalResponse,
  StageChangeNotificationPreview,
  ClientValueNotificationPreview,
} from "@shared/schema";
import type {
  UploadedAttachment,
  CustomFieldResponse,
  PendingQuery,
  StaffNotificationSendData,
  ClientNotificationSendData,
} from "@/types/changeStatus";

interface StatusChangeData {
  newStatus: string;
  changeReason: string;
  stageId?: string;
  reasonId?: string;
  notesHtml?: string;
  attachments?: UploadedAttachment[];
  fieldResponses?: CustomFieldResponse[];
}

interface UpdateStatusSuccessContext {
  clientNotificationPreview?: ClientValueNotificationPreview;
  staffNotificationPreview?: StageChangeNotificationPreview;
  notificationType?: 'client' | 'staff';
}

interface UseStatusChangeMutationsParams {
  projectId: string;
  onStatusUpdateSuccess?: (context: UpdateStatusSuccessContext) => void;
  onStatusUpdateError?: () => void;
  onClientNotificationSuccess?: () => void;
  onStaffNotificationSuccess?: () => void;
  getPendingQueries?: () => PendingQuery[];
  resetFormState?: () => void;
  notificationPreview?: StageChangeNotificationPreview | null;
  clientNotificationPreview?: ClientValueNotificationPreview | null;
}

export function useStatusChangeMutations({
  projectId,
  onStatusUpdateSuccess,
  onStatusUpdateError,
  onClientNotificationSuccess,
  onStaffNotificationSuccess,
  getPendingQueries,
  resetFormState,
  notificationPreview,
  clientNotificationPreview,
}: UseStatusChangeMutationsParams) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async (data: StatusChangeData) => {
      return await apiRequest("PATCH", `/api/projects/${projectId}/status`, data);
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["/api/projects"] });
      const previousProjects = queryClient.getQueryData(["/api/projects"]);

      queryClient.setQueryData(["/api/projects"], (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((p: any) =>
          p.id === projectId
            ? { ...p, currentStatus: data.newStatus }
            : p
        );
      });

      return { previousProjects };
    },
    onSuccess: async (data: any) => {
      const clientPreview = data.clientNotificationPreview;
      const type = data.notificationType;

      const pendingQueries = getPendingQueries?.() ?? [];
      if (pendingQueries.length > 0) {
        try {
          const validQueries = pendingQueries
            .filter(query => query.description || query.ourQuery)
            .map(query => ({
              projectId: projectId,
              date: query.date?.toISOString() || null,
              description: query.description || null,
              moneyIn: query.moneyIn ? query.moneyIn : null,
              moneyOut: query.moneyOut ? query.moneyOut : null,
              ourQuery: query.ourQuery || "",
              status: "open" as const,
            }));
          
          if (validQueries.length > 0) {
            await apiRequest("POST", `/api/projects/${projectId}/queries/bulk`, {
              queries: validQueries,
            });
          }
          
          toast({
            title: "Success",
            description: `Stage updated and ${validQueries.length} ${validQueries.length === 1 ? 'query' : 'queries'} created`,
          });
        } catch (error) {
          console.error("Failed to create queries:", error);
          toast({
            title: "Stage Updated",
            description: "Stage was updated but some queries failed to create",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Success",
          description: "Stage updated successfully",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "queries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/queries/counts"] });

      resetFormState?.();

      onStatusUpdateSuccess?.({
        clientNotificationPreview: type === 'client' ? clientPreview : undefined,
        staffNotificationPreview: type === 'staff' ? (data.notificationPreview as StageChangeNotificationPreview | undefined) : undefined,
        notificationType: type === 'client' ? 'client' : type === 'staff' ? 'staff' : undefined,
      });
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(["/api/projects"], context.previousProjects);
      }
      showFriendlyError({ error });
      onStatusUpdateError?.();
    },
  });

  const submitApprovalResponsesMutation = useMutation({
    mutationFn: async (data: {
      responses: InsertStageApprovalResponse[];
      statusData: StatusChangeData;
    }) => {
      const result = await apiRequest("POST", `/api/projects/${projectId}/stage-approval-responses`, {
        responses: data.responses,
      });
      return { result, statusData: data.statusData };
    },
    onSuccess: (data) => {
      updateStatusMutation.mutate(data.statusData);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const sendClientNotificationMutation = useMutation({
    mutationFn: async (data: ClientNotificationSendData) => {
      if (!clientNotificationPreview) throw new Error("No client notification preview available");

      return await apiRequest("POST", `/api/projects/${projectId}/send-client-value-notification`, {
        projectId: projectId,
        dedupeKey: clientNotificationPreview.dedupeKey,
        ...data,
      });
    },
    onSuccess: (data: any) => {
      const wasSent = !data.suppress && data.sent;

      if (wasSent) {
        toast({
          title: "Notification sent",
          description: "Client contacts have been notified of the stage change",
        });
      }

      onClientNotificationSuccess?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const sendStaffNotificationMutation = useMutation({
    mutationFn: async (data: StaffNotificationSendData) => {
      if (!notificationPreview) throw new Error("No notification preview available");

      return await apiRequest("POST", `/api/projects/${projectId}/send-stage-change-notification`, {
        projectId: projectId,
        dedupeKey: notificationPreview.dedupeKey,
        ...data,
      });
    },
    onSuccess: (data: any) => {
      const wasSent = !data.suppress && data.sent;

      if (wasSent) {
        toast({
          title: "Notification sent",
          description: "Staff has been notified of the stage change",
        });
      }

      onStaffNotificationSuccess?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  return {
    updateStatus: updateStatusMutation,
    submitApprovalResponses: submitApprovalResponsesMutation,
    sendClientNotification: sendClientNotificationMutation,
    sendStaffNotification: sendStaffNotificationMutation,
  };
}
