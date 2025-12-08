import type { ProjectWithRelations, DynamicDateFilter, ScheduleStatusFilter, CustomDateRange } from "@/types/projects-page";

export function filterByService(project: ProjectWithRelations, serviceFilter: string): boolean {
  if (serviceFilter === "all") return true;
  return project.projectType?.service?.id === serviceFilter;
}

export function filterByTaskAssignee(project: ProjectWithRelations, taskAssigneeFilter: string): boolean {
  if (taskAssigneeFilter === "all") return true;
  return project.currentAssigneeId === taskAssigneeFilter;
}

export function filterByServiceOwner(project: ProjectWithRelations, serviceOwnerFilter: string): boolean {
  if (serviceOwnerFilter === "all") return true;
  return project.projectOwnerId === serviceOwnerFilter;
}

export function filterByUser(project: ProjectWithRelations, userFilter: string, isManagerOrAdmin: boolean): boolean {
  if (userFilter === "all" || !isManagerOrAdmin) return true;
  return project.bookkeeperId === userFilter || 
         project.clientManagerId === userFilter ||
         project.currentAssigneeId === userFilter;
}

export function filterByDateRange(
  project: ProjectWithRelations, 
  dynamicDateFilter: DynamicDateFilter, 
  customDateRange: CustomDateRange
): boolean {
  if (dynamicDateFilter === "all" || !project.dueDate) return true;
  
  const dueDate = new Date(project.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (dynamicDateFilter) {
    case "overdue":
      return dueDate < today;
    case "today": {
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      return dueDate >= today && dueDate <= todayEnd;
    }
    case "next7days": {
      const next7Days = new Date(today);
      next7Days.setDate(next7Days.getDate() + 7);
      return dueDate >= today && dueDate <= next7Days;
    }
    case "next14days": {
      const next14Days = new Date(today);
      next14Days.setDate(next14Days.getDate() + 14);
      return dueDate >= today && dueDate <= next14Days;
    }
    case "next30days": {
      const next30Days = new Date(today);
      next30Days.setDate(next30Days.getDate() + 30);
      return dueDate >= today && dueDate <= next30Days;
    }
    case "custom": {
      if (customDateRange.from && customDateRange.to) {
        const fromDate = new Date(customDateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(customDateRange.to);
        toDate.setHours(23, 59, 59, 999);
        return dueDate >= fromDate && dueDate <= toDate;
      }
      return true;
    }
    default:
      return true;
  }
}

export function filterByScheduleStatus(
  project: ProjectWithRelations,
  scheduleStatusFilter: ScheduleStatusFilter,
  stagesMap: Map<string, number>,
  stagesLoading: boolean,
  stagesError: boolean
): boolean | 'skip' {
  if (scheduleStatusFilter === "all") return true;
  
  if (project.completionStatus) return false;
  
  const now = new Date();
  const isOverdue = project.dueDate ? new Date(project.dueDate) < now : false;
  
  let isBehindSchedule = false;
  const stagesLoaded = stagesMap.size > 0;
  const needsStageData = scheduleStatusFilter === "behind" || scheduleStatusFilter === "both";
  
  if (needsStageData && !stagesLoaded) {
    if (stagesLoading) return 'skip';
    if (stagesError) {
      if (scheduleStatusFilter === "behind") return 'skip';
    }
  }
  
  if (stagesLoaded) {
    const stageMaxTime = stagesMap.get(`${project.projectTypeId}:${project.currentStatus}`);
    if (stageMaxTime && stageMaxTime > 0) {
      const chronology = project.chronology || [];
      const sortedChronology = [...chronology].sort((a: any, b: any) => 
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
      
      const lastEntry = sortedChronology.find((entry: any) => entry.toStatus === project.currentStatus);
      
      if (lastEntry?.timestamp) {
        const start = new Date(lastEntry.timestamp);
        const hoursDiff = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
        isBehindSchedule = hoursDiff > stageMaxTime;
      }
    }
  }
  
  switch (scheduleStatusFilter) {
    case "behind":
      return isBehindSchedule;
    case "overdue":
      return isOverdue;
    case "both":
      return isBehindSchedule || isOverdue;
    default:
      return true;
  }
}

export function filterByArchiveStatus(
  project: ProjectWithRelations, 
  showArchived: boolean, 
  viewMode: string
): boolean | 'continue' {
  if (project.completionStatus) {
    if (viewMode === "kanban") {
      return 'continue';
    } else {
      return showArchived;
    }
  } else if (project.archived) {
    return showArchived;
  }
  return 'continue';
}

export function filterByClientHasProjectTypes(
  project: ProjectWithRelations,
  clientHasProjectTypeIds: string[],
  allProjects: ProjectWithRelations[]
): boolean {
  if (!clientHasProjectTypeIds || clientHasProjectTypeIds.length === 0) return true;
  
  const clientId = project.clientId;
  if (!clientId) return false;
  
  const clientProjects = allProjects.filter(p => 
    p.clientId === clientId && 
    p.id !== project.id && 
    !p.archived && 
    !p.completionStatus
  );
  
  return clientHasProjectTypeIds.every(requiredTypeId => 
    clientProjects.some(p => p.projectTypeId === requiredTypeId)
  );
}

export function calculateActiveFilterCount(
  serviceFilter: string,
  taskAssigneeFilter: string,
  serviceOwnerFilter: string,
  userFilter: string,
  showArchived: boolean,
  dynamicDateFilter: DynamicDateFilter,
  isManagerOrAdmin: boolean,
  clientHasProjectTypeIds: string[] = []
): number {
  let count = 0;
  if (serviceFilter !== "all") count++;
  if (taskAssigneeFilter !== "all") count++;
  if (serviceOwnerFilter !== "all") count++;
  if (userFilter !== "all" && isManagerOrAdmin) count++;
  if (showArchived) count++;
  if (dynamicDateFilter !== "all") count++;
  if (clientHasProjectTypeIds.length > 0) count++;
  return count;
}
