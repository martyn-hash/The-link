import { useEffect } from "react";
import type { DynamicDateFilter, ScheduleStatusFilter, ProjectFilters } from "@/types/projects-page";

interface UseProjectsUrlSyncParams {
  location: string;
  filters: ProjectFilters;
  setFilters: {
    setTaskAssigneeFilter: (value: string) => void;
    setServiceOwnerFilter: (value: string) => void;
    setDynamicDateFilter: (value: DynamicDateFilter) => void;
    setScheduleStatusFilter: (value: ScheduleStatusFilter) => void;
  };
}

export function useProjectsUrlSync({
  location,
  filters,
  setFilters,
}: UseProjectsUrlSyncParams) {
  const { scheduleStatusFilter, taskAssigneeFilter, serviceOwnerFilter } = filters;
  const { setTaskAssigneeFilter, setServiceOwnerFilter, setDynamicDateFilter, setScheduleStatusFilter } = setFilters;

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    
    const taskAssignee = searchParams.get('taskAssigneeFilter');
    if (taskAssignee && taskAssignee !== taskAssigneeFilter) {
      setTaskAssigneeFilter(taskAssignee);
    }
    
    const serviceOwner = searchParams.get('serviceOwnerFilter');
    if (serviceOwner && serviceOwner !== serviceOwnerFilter) {
      setServiceOwnerFilter(serviceOwner);
    }
    
    const dateFilter = searchParams.get('dynamicDateFilter');
    if (dateFilter && (dateFilter === 'overdue' || dateFilter === 'today' || dateFilter === 'next7days' || dateFilter === 'next14days' || dateFilter === 'next30days')) {
      setDynamicDateFilter(dateFilter as DynamicDateFilter);
    }
    
    const scheduleStatus = searchParams.get('scheduleStatus');
    if (scheduleStatus && ['behind', 'overdue', 'both'].includes(scheduleStatus)) {
      setScheduleStatusFilter(scheduleStatus as ScheduleStatusFilter);
    }
  }, [location]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const currentScheduleStatus = searchParams.get('scheduleStatus');
    
    if (scheduleStatusFilter !== "all" && currentScheduleStatus !== scheduleStatusFilter) {
      searchParams.set('scheduleStatus', scheduleStatusFilter);
      window.history.replaceState({}, '', `${window.location.pathname}?${searchParams.toString()}`);
    } else if (scheduleStatusFilter === "all" && currentScheduleStatus) {
      searchParams.delete('scheduleStatus');
      const newUrl = searchParams.toString() 
        ? `${window.location.pathname}?${searchParams.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [scheduleStatusFilter]);
}
