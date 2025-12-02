import { useQuery } from "@tanstack/react-query";
import type { CalendarEventsResponse } from "@shared/schema";

interface CalendarFilters {
  start: string;
  end: string;
  serviceFilter?: string;
  taskAssigneeFilter?: string;
  serviceOwnerFilter?: string;
  userFilter?: string;
  showArchived?: boolean;
  includeProjectDues?: boolean;
  includeTargetDates?: boolean;
  includeStageDeadlines?: boolean;
  includeTasks?: boolean;
}

export function useCalendarEvents(filters: CalendarFilters) {
  const params = new URLSearchParams();
  params.set("start", filters.start);
  params.set("end", filters.end);
  
  if (filters.serviceFilter && filters.serviceFilter !== "all") {
    params.set("serviceFilter", filters.serviceFilter);
  }
  if (filters.taskAssigneeFilter && filters.taskAssigneeFilter !== "all") {
    params.set("taskAssigneeFilter", filters.taskAssigneeFilter);
  }
  if (filters.serviceOwnerFilter && filters.serviceOwnerFilter !== "all") {
    params.set("serviceOwnerFilter", filters.serviceOwnerFilter);
  }
  if (filters.userFilter && filters.userFilter !== "all") {
    params.set("userFilter", filters.userFilter);
  }
  if (filters.showArchived !== undefined) {
    params.set("showArchived", String(filters.showArchived));
  }
  if (filters.includeProjectDues !== undefined) {
    params.set("includeProjectDues", String(filters.includeProjectDues));
  }
  if (filters.includeTargetDates !== undefined) {
    params.set("includeTargetDates", String(filters.includeTargetDates));
  }
  if (filters.includeStageDeadlines !== undefined) {
    params.set("includeStageDeadlines", String(filters.includeStageDeadlines));
  }
  if (filters.includeTasks !== undefined) {
    params.set("includeTasks", String(filters.includeTasks));
  }

  return useQuery<CalendarEventsResponse>({
    queryKey: ["/api/calendar/events", filters],
    enabled: Boolean(filters.start && filters.end),
  });
}
