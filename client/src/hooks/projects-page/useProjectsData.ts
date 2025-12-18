import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { 
  ViewMode, 
  Dashboard, 
  ServiceOption, 
  StageOption,
  ProjectWithRelations,
  User,
  ProjectView,
  UserProjectPreferences
} from "@/types/projects-page";

interface InternalTaskWithStatus {
  id: string;
  status: string;
  isQuickReminder?: boolean | null;
}

interface CachedProjectsResponse {
  projects: ProjectWithRelations[] | null;
  stageStats: Record<string, number> | null;
  fromCache: boolean;
  cachedAt: string | null;
  isStale: boolean;
  staleAt: string | null;
}

interface UseProjectsDataParams {
  userId: string | undefined;
  isAuthenticated: boolean;
  isAdmin: boolean;
  canSeeAdminMenu: boolean;
  viewMode: ViewMode;
  showArchived: boolean;
  showCompletedRegardless: boolean;
  serviceDueDateFilter: string;
  selectedViewId?: string | null;
}

export function useProjectsData({
  userId,
  isAuthenticated,
  isAdmin,
  canSeeAdminMenu,
  viewMode,
  showArchived,
  showCompletedRegardless,
  serviceDueDateFilter,
  selectedViewId,
}: UseProjectsDataParams) {
  const viewKey = selectedViewId || 'default';
  const isSavedView = !!selectedViewId;
  const hasNoSpecialFilters = serviceDueDateFilter === "all";
  const canUseCache = hasNoSpecialFilters || isSavedView;

  const { data: cachedProjectsData } = useQuery<CachedProjectsResponse>({
    queryKey: ["/api/projects/cached", { 
      viewKey,
      showArchived,
      showCompletedRegardless,
      dueDate: serviceDueDateFilter !== "all" ? serviceDueDateFilter : undefined,
    }],
    enabled: isAuthenticated && !!userId && canUseCache,
    retry: false,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  const { data: projects, isLoading: projectsLoading, error, isFetching: projectsFetching } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/projects", { 
      viewKey,
      showArchived,
      showCompletedRegardless,
      dueDate: serviceDueDateFilter !== "all" ? serviceDueDateFilter : undefined,
    }],
    enabled: isAuthenticated && !!userId,
    retry: false,
    staleTime: 2 * 60 * 1000,
    placeholderData: canUseCache ? (cachedProjectsData?.projects ?? undefined) : undefined,
  });

  const isUsingCachedData = projectsLoading && canUseCache && cachedProjectsData?.fromCache === true && cachedProjectsData?.projects !== null;
  const cachedAt = cachedProjectsData?.cachedAt;
  const isCacheStale = cachedProjectsData?.isStale ?? false;
  const cacheStaleAt = cachedProjectsData?.staleAt;
  const isRefreshingInBackground = projectsFetching && !projectsLoading;
  const isSyncing = (isUsingCachedData && isCacheStale) || isRefreshingInBackground;

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && Boolean(isAdmin || canSeeAdminMenu),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allServices = [] } = useQuery<ServiceOption[]>({
    queryKey: ["/api/services/active"],
    enabled: isAuthenticated && !!userId,
    retry: false,
    staleTime: 5 * 60 * 1000,
    select: (data: any[]) => data.map((s: any) => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name))
  });

  const { data: savedViews = [], isLoading: savedViewsLoading } = useQuery<ProjectView[]>({
    queryKey: ["/api/project-views"],
    enabled: isAuthenticated && !!userId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: dashboards = [], isLoading: dashboardsLoading } = useQuery<Dashboard[]>({
    queryKey: ["/api/dashboards"],
    enabled: isAuthenticated && !!userId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: userProjectPreferences, isLoading: preferencesLoading } = useQuery<UserProjectPreferences>({
    queryKey: ["/api/user-project-preferences"],
    enabled: isAuthenticated && !!userId,
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  const { data: allClients = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/clients"],
    enabled: isAuthenticated && !!userId && viewMode === "dashboard",
    retry: false,
    staleTime: 5 * 60 * 1000,
    select: (data: any[]) => data.map((c: any) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name))
  });

  const { data: allProjectTypes = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/project-types"],
    enabled: isAuthenticated && !!userId,
    retry: false,
    staleTime: 5 * 60 * 1000,
    select: (data: any[]) => data.map((pt: any) => ({ id: pt.id, name: pt.name })).sort((a, b) => a.name.localeCompare(b.name))
  });

  const { data: allStages = [], isLoading: stagesLoading, isError: stagesError } = useQuery<StageOption[]>({
    queryKey: ["/api/config/stages"],
    enabled: isAuthenticated && !!userId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  const allStagesMap = useMemo(() => {
    const map = new Map<string, number>();
    allStages.forEach(stage => {
      if (stage.maxInstanceTime && stage.maxInstanceTime > 0) {
        map.set(`${stage.projectTypeId}:${stage.name}`, stage.maxInstanceTime);
      }
    });
    return map;
  }, [allStages]);

  const { data: openTasksData = [] } = useQuery<InternalTaskWithStatus[]>({
    queryKey: ['/api/internal-tasks/assigned', userId, 'open'],
    queryFn: async () => {
      const url = `/api/internal-tasks/assigned/${userId}?status=open`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch assigned tasks');
      return response.json();
    },
    enabled: isAuthenticated && !!userId,
    retry: false,
    staleTime: 30 * 1000,
  });

  const openTasksAndRemindersCount = useMemo(() => 
    openTasksData.filter(item => item.status === 'open' || item.status === 'in_progress').length,
    [openTasksData]
  );

  const handleRefresh = useCallback(async () => {
    if (!isAuthenticated || !userId) return;
    
    await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/services/with-active-clients"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/project-views"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
    await queryClient.invalidateQueries({ queryKey: ['/api/internal-tasks/assigned'] });
  }, [isAuthenticated, userId]);

  const taskAssignees = useMemo(() => 
    Array.from(
      new Map(
        (projects || [])
          .map((p: ProjectWithRelations) => p.currentAssignee)
          .filter((assignee): assignee is NonNullable<typeof assignee> => Boolean(assignee))
          .map(assignee => [assignee.id, assignee])
      ).values()
    ),
    [projects]
  );

  const serviceOwners = useMemo(() =>
    Array.from(
      new Map(
        (projects || [])
          .map((p: ProjectWithRelations) => p.projectOwner)
          .filter((owner): owner is NonNullable<typeof owner> => Boolean(owner))
          .map(owner => [owner.id, owner])
      ).values()
    ),
    [projects]
  );

  return {
    projects,
    projectsLoading,
    projectsFetching,
    isUsingCachedData,
    isRefreshingInBackground,
    isSyncing,
    isCacheStale,
    cacheStaleAt,
    cachedAt,
    users,
    usersLoading,
    allServices,
    savedViews,
    savedViewsLoading,
    dashboards,
    dashboardsLoading,
    userProjectPreferences,
    preferencesLoading,
    allClients,
    allProjectTypes,
    allStages,
    allStagesMap,
    stagesLoading,
    stagesError,
    openTasksAndRemindersCount,
    handleRefresh,
    error,
    taskAssignees,
    serviceOwners,
  };
}
