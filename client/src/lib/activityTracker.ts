// Activity tracking utility for monitoring user interactions
import { apiRequest } from "@/lib/queryClient";

// Track when a user views an entity
export async function trackActivity(entityType: 'client' | 'project' | 'person' | 'communication', entityId: string) {
  try {
    await apiRequest('POST', '/api/track-activity', {
      entityType,
      entityId,
    });
  } catch (error) {
    // Don't log to console to avoid spamming - activity tracking is non-critical
    // console.warn('Failed to track activity:', error);
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