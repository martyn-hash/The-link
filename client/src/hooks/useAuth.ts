import { useQuery, useMutation } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";

// Extended user type to include impersonation metadata
type UserWithImpersonation = User & {
  _impersonationState?: {
    isImpersonating: boolean;
    originalUserId?: string;
    impersonatedUserId?: string;
  };
};

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<UserWithImpersonation>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }), // Return null on 401 instead of throwing
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // Consider auth data stale after 5 minutes
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
      // Only refresh specific queries to avoid loops
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Refresh other user-dependent data
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
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
      // Only refresh specific queries to avoid loops
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Refresh other user-dependent data
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
  });

  const isImpersonating = !!user?._impersonationState?.isImpersonating;
  const isAdmin = user?.isAdmin;

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
