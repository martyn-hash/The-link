// Activity tracking utility for monitoring user interactions
import { apiRequest, queryClient } from "@/lib/queryClient";

// Track when a user views an entity
export async function trackActivity(entityType: 'client' | 'project' | 'person' | 'communication', entityId: string) {
  try {
    await apiRequest('POST', '/api/track-activity', {
      entityType,
      entityId,
    });
    
    // Use refetchQueries to force immediate refetch if dashboard is mounted
    // This handles the case where user uses browser back button and dashboard never unmounts
    queryClient.refetchQueries({ 
      queryKey: ["/api/dashboard"],
      type: 'active' // Only refetch if query has active observers (dashboard is mounted)
    });
  } catch (error) {
    // Activity tracking is non-critical, silently fail
  }
}

// Helper hook for tracking page views
export function useActivityTracker() {
  return {
    trackClientView: (clientId: string) => trackActivity('client', clientId),
    trackProjectView: (projectId: string) => trackActivity('project', projectId),
    trackPersonView: (personId: string) => trackActivity('person', personId),
    trackCommunicationView: (communicationId: string) => trackActivity('communication', communicationId),
  };
}