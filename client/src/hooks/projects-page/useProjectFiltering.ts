import { useMemo, useState, useEffect } from "react";
import type { 
  ProjectWithRelations, 
  ViewMode, 
  ProjectFilters,
  ITEMS_PER_PAGE 
} from "@/types/projects-page";
import {
  filterByService,
  filterByTaskAssignee,
  filterByServiceOwner,
  filterByUser,
  filterByDateRange,
  filterByScheduleStatus,
  filterByArchiveStatus,
  calculateActiveFilterCount,
} from "@/lib/projectFilterUtils";

interface UseProjectFilteringParams {
  projects: ProjectWithRelations[] | undefined;
  filters: ProjectFilters;
  stagesMap: Map<string, number>;
  stagesLoading: boolean;
  stagesError: boolean;
  viewMode: ViewMode;
  isManagerOrAdmin: boolean;
  itemsPerPage: number;
}

export function useProjectFiltering({
  projects,
  filters,
  stagesMap,
  stagesLoading,
  stagesError,
  viewMode,
  isManagerOrAdmin,
  itemsPerPage,
}: UseProjectFilteringParams) {
  const [currentPage, setCurrentPage] = useState(1);

  const {
    serviceFilter,
    taskAssigneeFilter,
    serviceOwnerFilter,
    userFilter,
    showArchived,
    dynamicDateFilter,
    customDateRange,
    scheduleStatusFilter,
  } = filters;

  const filteredProjects = useMemo(() => 
    (projects || []).filter((project: ProjectWithRelations) => {
      const serviceMatch = filterByService(project, serviceFilter);
      if (!serviceMatch) return false;

      const taskAssigneeMatch = filterByTaskAssignee(project, taskAssigneeFilter);
      if (!taskAssigneeMatch) return false;

      const serviceOwnerMatch = filterByServiceOwner(project, serviceOwnerFilter);
      if (!serviceOwnerMatch) return false;

      const userMatch = filterByUser(project, userFilter, isManagerOrAdmin);
      if (!userMatch) return false;

      const dateMatch = filterByDateRange(project, dynamicDateFilter, customDateRange);
      if (!dateMatch) return false;

      const scheduleMatch = filterByScheduleStatus(
        project,
        scheduleStatusFilter,
        stagesMap,
        stagesLoading,
        stagesError
      );
      if (scheduleMatch === 'skip') return false;
      if (!scheduleMatch) return false;

      const archiveMatch = filterByArchiveStatus(project, showArchived, viewMode);
      if (archiveMatch !== 'continue' && !archiveMatch) return false;

      return true;
    }), 
    [
      projects, 
      serviceFilter, 
      taskAssigneeFilter, 
      serviceOwnerFilter, 
      userFilter, 
      isManagerOrAdmin, 
      dynamicDateFilter, 
      customDateRange, 
      scheduleStatusFilter, 
      stagesMap, 
      stagesLoading, 
      stagesError, 
      showArchived, 
      viewMode
    ]
  );

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedProjects = useMemo(() => {
    if (viewMode === "list") {
      return filteredProjects.slice(startIndex, endIndex);
    }
    return filteredProjects;
  }, [filteredProjects, startIndex, endIndex, viewMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [serviceFilter, taskAssigneeFilter, serviceOwnerFilter, userFilter, showArchived, dynamicDateFilter, customDateRange, viewMode]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const activeFilterCount = useMemo(() => 
    calculateActiveFilterCount(
      serviceFilter,
      taskAssigneeFilter,
      serviceOwnerFilter,
      userFilter,
      showArchived,
      dynamicDateFilter,
      isManagerOrAdmin
    ),
    [serviceFilter, taskAssigneeFilter, serviceOwnerFilter, userFilter, showArchived, dynamicDateFilter, isManagerOrAdmin]
  );

  return {
    filteredProjects,
    paginatedProjects,
    activeFilterCount,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    endIndex,
  };
}
