import { useQuery, useMutation } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Extended user type to include impersonation metadata
type UserWithImpersonation = User & {
  _impersonationState?: {
    isImpersonating: boolean;
    originalUserId?: string;
    impersonatedUserId?: string;
  };
};

export function useAuth() {
  const { data: user, isLoading } = useQuery<UserWithImpersonation>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const startImpersonationMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const response = await fetch(`/api/auth/impersonate/${targetUserId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error("Failed to start impersonation");
      return response.json();
    },
    onSuccess: () => {
      // Refresh user data to get the impersonated user
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Refresh all cached data since the user context has changed
      queryClient.invalidateQueries();
    },
  });

  const stopImpersonationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/impersonate", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error("Failed to stop impersonation");
      return response.json();
    },
    onSuccess: () => {
      // Refresh user data to get back to original user
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Refresh all cached data since the user context has changed
      queryClient.invalidateQueries();
    },
  });

  const isImpersonating = !!user?._impersonationState?.isImpersonating;
  const isAdmin = user?.role === 'admin';

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    
    // Impersonation state
    isImpersonating,
    impersonationState: user?._impersonationState,
    
    // Impersonation controls (admin only)
    startImpersonation: startImpersonationMutation.mutate,
    stopImpersonation: stopImpersonationMutation.mutate,
    isStartingImpersonation: startImpersonationMutation.isPending,
    isStoppingImpersonation: stopImpersonationMutation.isPending,
    
    // Utility
    isAdmin,
  };
}
