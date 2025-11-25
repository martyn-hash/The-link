import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EditingStageApproval } from "../utils/types";

interface StageApprovalMutationCallbacks {
  onApprovalCreated?: () => void;
  onApprovalUpdated?: () => void;
  onApprovalDeleted?: () => void;
}

export function useStageApprovalMutations(
  projectTypeId: string | undefined,
  callbacks: StageApprovalMutationCallbacks = {}
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateApprovals = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stage-approvals"] });
  };

  const createStageApprovalMutation = useMutation({
    mutationFn: async (stageApproval: Omit<EditingStageApproval, 'id'>) => {
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", "/api/config/stage-approvals", { ...stageApproval, projectTypeId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage approval created successfully" });
      invalidateApprovals();
      callbacks.onApprovalCreated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create stage approval",
        variant: "destructive",
      });
    },
  });

  const updateStageApprovalMutation = useMutation({
    mutationFn: async ({ id, ...stageApproval }: EditingStageApproval) => {
      return await apiRequest("PATCH", `/api/config/stage-approvals/${id}`, stageApproval);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage approval updated successfully" });
      invalidateApprovals();
      callbacks.onApprovalUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stage approval",
        variant: "destructive",
      });
    },
  });

  const deleteStageApprovalMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/stage-approvals/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage approval deleted successfully" });
      invalidateApprovals();
      callbacks.onApprovalDeleted?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stage approval",
        variant: "destructive",
      });
    },
  });

  return {
    createStageApprovalMutation,
    updateStageApprovalMutation,
    deleteStageApprovalMutation,
  };
}
