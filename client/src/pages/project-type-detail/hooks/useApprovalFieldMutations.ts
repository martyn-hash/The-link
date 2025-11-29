import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";

interface ApprovalFieldMutationCallbacks {
  onFieldCreated?: () => void;
  onFieldUpdated?: () => void;
  onFieldDeleted?: () => void;
}

export function useApprovalFieldMutations(
  callbacks: ApprovalFieldMutationCallbacks = {}
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateFields = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approval-fields"] });
  };

  const createApprovalFieldMutation = useMutation({
    mutationFn: async (field: any) => {
      return await apiRequest("POST", "/api/config/stage-approval-fields", field);
    },
    onSuccess: () => {
      invalidateFields();
      callbacks.onFieldCreated?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const updateApprovalFieldMutation = useMutation({
    mutationFn: async ({ id, field }: { id: string; field: any }) => {
      return await apiRequest("PATCH", `/api/config/stage-approval-fields/${id}`, field);
    },
    onSuccess: () => {
      invalidateFields();
      toast({
        title: "Success",
        description: "Approval field updated successfully",
      });
      callbacks.onFieldUpdated?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const deleteApprovalFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/stage-approval-fields/${id}`);
    },
    onSuccess: () => {
      invalidateFields();
      toast({
        title: "Success",
        description: "Approval field deleted successfully",
      });
      callbacks.onFieldDeleted?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  return {
    createApprovalFieldMutation,
    updateApprovalFieldMutation,
    deleteApprovalFieldMutation,
  };
}
