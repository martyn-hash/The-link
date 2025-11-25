import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EditingReason } from "../utils/types";

interface ReasonMutationCallbacks {
  onReasonCreated?: () => void;
  onReasonUpdated?: () => void;
  onReasonDeleted?: () => void;
}

export function useReasonMutations(
  projectTypeId: string | undefined,
  callbacks: ReasonMutationCallbacks = {}
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateReasons = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "reasons"] });
  };

  const createReasonMutation = useMutation({
    mutationFn: async (reason: Omit<EditingReason, 'id'>) => {
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", "/api/config/reasons", { ...reason, projectTypeId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Reason created successfully" });
      invalidateReasons();
      callbacks.onReasonCreated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create reason",
        variant: "destructive",
      });
    },
  });

  const updateReasonMutation = useMutation({
    mutationFn: async ({ id, ...reason }: EditingReason) => {
      return await apiRequest("PATCH", `/api/config/reasons/${id}`, reason);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Reason updated successfully" });
      invalidateReasons();
      callbacks.onReasonUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update reason",
        variant: "destructive",
      });
    },
  });

  const deleteReasonMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/reasons/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Reason deleted successfully" });
      invalidateReasons();
      callbacks.onReasonDeleted?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete reason",
        variant: "destructive",
      });
    },
  });

  return {
    createReasonMutation,
    updateReasonMutation,
    deleteReasonMutation,
  };
}
