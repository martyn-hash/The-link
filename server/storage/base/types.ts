/**
 * Shared types and utilities for the storage layer
 * These types are used across multiple storage modules
 */

// Type for scheduled services view that combines client and people services
export interface ScheduledServiceView {
  id: string;
  serviceId: string;
  serviceName: string;
  clientOrPersonName: string;
  clientOrPersonType: 'client' | 'person';
  nextStartDate: string | null;
  nextDueDate: string | null;
  targetDeliveryDate: string | null;
  currentProjectStartDate: string | null; // Current project start date (when hasActiveProject is true)
  currentProjectDueDate: string | null;   // Current project due date (when hasActiveProject is true)
  currentProjectTargetDeliveryDate: string | null; // Current project target delivery date
  projectTypeName: string | null;
  hasActiveProject: boolean;
  frequency: string;
  isActive: boolean;
  serviceOwnerId?: string;
  serviceOwnerName?: string;
}

// Super search result types
export interface SearchResult {
  id: string;
  type: 'client' | 'person' | 'project' | 'communication';
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface SuperSearchResults {
  clients: SearchResult[];
  people: SearchResult[];
  projects: SearchResult[];
  communications: SearchResult[];
  total: number;
}

// Re-export shared types from schema that are commonly used across modules
// Note: These are imported from @shared/schema, not defined here
export type {
  ProjectWithRelations,
  UpdateProjectStatus,
  UpdateProjectType,
  StageChangeNotificationPreview,
} from "@shared/schema";