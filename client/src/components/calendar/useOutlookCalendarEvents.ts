import { useQuery } from "@tanstack/react-query";
import type { MSCalendarEvent } from "@shared/schema";

interface MSCalendarEventsResponse {
  events: MSCalendarEvent[];
  userColors: Record<string, string>;
}

interface OutlookCalendarFilters {
  start: string;
  end: string;
  selectedUserIds: string[];
  enabled?: boolean;
}

export function useOutlookCalendarEvents(filters: OutlookCalendarFilters) {
  return useQuery<MSCalendarEventsResponse>({
    queryKey: ["/api/ms-calendar/events", { 
      start: filters.start, 
      end: filters.end, 
      selectedUserIds: filters.selectedUserIds.join(",") 
    }],
    enabled: Boolean(filters.start && filters.end && filters.enabled !== false && filters.selectedUserIds.length > 0),
    staleTime: 30000,
  });
}
