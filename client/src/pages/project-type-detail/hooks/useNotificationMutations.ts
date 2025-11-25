import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { 
  InsertProjectTypeNotification,
  UpdateProjectTypeNotification,
  InsertClientRequestReminder,
  UpdateClientRequestReminder,
} from "@shared/schema";

interface NotificationMutationCallbacks {
  onNotificationCreated?: () => void;
  onNotificationUpdated?: () => void;
  onNotificationDeleted?: () => void;
  onRescheduleComplete?: () => void;
  onReminderCreated?: () => void;
  onReminderUpdated?: () => void;
  onReminderDeleted?: () => void;
}

export function useNotificationMutations(
  projectTypeId: string | undefined,
  callbacks: NotificationMutationCallbacks = {}
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/project-types", projectTypeId, "notifications"] });
  };

  const createNotificationMutation = useMutation({
    mutationFn: async (notification: InsertProjectTypeNotification) => {
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", `/api/project-types/${projectTypeId}/notifications`, notification);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Notification created successfully" });
      invalidateNotifications();
      callbacks.onNotificationCreated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create notification",
        variant: "destructive",
      });
    },
  });

  const updateNotificationMutation = useMutation({
    mutationFn: async ({ id, ...data }: UpdateProjectTypeNotification & { id: string }) => {
      return await apiRequest("PATCH", `/api/notifications/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Notification updated successfully" });
      invalidateNotifications();
      callbacks.onNotificationUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update notification",
        variant: "destructive",
      });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Notification deleted successfully" });
      invalidateNotifications();
      callbacks.onNotificationDeleted?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete notification",
        variant: "destructive",
      });
    },
  });

  const rescheduleNotificationsMutation = useMutation({
    mutationFn: async () => {
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", `/api/project-types/${projectTypeId}/reschedule-notifications`);
    },
    onSuccess: (data: any) => {
      const description = data.errors > 0
        ? `${data.scheduled} scheduled, ${data.skipped} skipped, ${data.errors} failed of ${data.total} service(s)`
        : `${data.scheduled} scheduled, ${data.skipped} skipped of ${data.total} service(s)`;
      
      toast({ 
        title: "Notifications re-scheduled", 
        description,
        variant: data.errors > 0 ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-notifications"] });
      invalidateNotifications();
      callbacks.onRescheduleComplete?.();
    },
    onError: (error: any) => {
      toast({
        title: "Re-schedule failed",
        description: error.message || "Failed to re-schedule notifications",
        variant: "destructive",
      });
      callbacks.onRescheduleComplete?.();
    },
  });

  const createReminderMutation = useMutation({
    mutationFn: async ({ notificationId, ...reminder }: InsertClientRequestReminder & { notificationId: string }) => {
      return await apiRequest("POST", `/api/notifications/${notificationId}/reminders`, reminder);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Reminder created successfully" });
      invalidateNotifications();
      callbacks.onReminderCreated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create reminder",
        variant: "destructive",
      });
    },
  });

  const updateReminderMutation = useMutation({
    mutationFn: async ({ id, ...data }: UpdateClientRequestReminder & { id: string }) => {
      return await apiRequest("PATCH", `/api/reminders/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Reminder updated successfully" });
      invalidateNotifications();
      callbacks.onReminderUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update reminder",
        variant: "destructive",
      });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/reminders/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Reminder deleted successfully" });
      invalidateNotifications();
      callbacks.onReminderDeleted?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete reminder",
        variant: "destructive",
      });
    },
  });

  return {
    createNotificationMutation,
    updateNotificationMutation,
    deleteNotificationMutation,
    rescheduleNotificationsMutation,
    createReminderMutation,
    updateReminderMutation,
    deleteReminderMutation,
  };
}
