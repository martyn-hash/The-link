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
  const params = new URLSearchParams();
  params.set("start", filters.start);
  params.set("end", filters.end);
  
  if (filters.selectedUserIds.length > 0) {
    params.set("selectedUserIds", filters.selectedUserIds.join(","));
  }

  return useQuery<MSCalendarEventsResponse>({
    queryKey: ["/api/ms-calendar/events", filters.start, filters.end, filters.selectedUserIds],
    enabled: Boolean(filters.start && filters.end && filters.enabled !== false && filters.selectedUserIds.length > 0),
    staleTime: 30000,
  });
}
