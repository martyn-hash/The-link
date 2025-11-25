import { useQuery } from "@tanstack/react-query";
import type { 
  ProjectType,
  KanbanStage, 
  ChangeReason, 
  StageApproval,
  StageApprovalField,
  WorkRole,
  Service,
  User,
  ProjectTypeNotification,
  ClientRequestTemplate,
} from "@shared/schema";

interface UseProjectTypeQueriesParams {
  projectTypeId: string | undefined;
  isAuthenticated: boolean;
  user: any;
}

export function useProjectTypeQueries({
  projectTypeId,
  isAuthenticated,
  user,
}: UseProjectTypeQueriesParams) {
  const enabled = !!projectTypeId && isAuthenticated && !!user;
  const globalEnabled = isAuthenticated && !!user;

  const projectTypeQuery = useQuery<ProjectType>({
    queryKey: ["/api/config/project-types", projectTypeId],
    queryFn: async () => {
      const response = await fetch(`/api/config/project-types?inactive=true`);
      if (!response.ok) throw new Error("Failed to fetch project types");
      const allTypes = await response.json();
      const type = allTypes.find((pt: ProjectType) => pt.id === projectTypeId);
      if (!type) throw new Error("Project type not found");
      return type;
    },
    enabled,
    retry: false,
  });

  const stagesQuery = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "stages"],
    enabled,
  });

  const reasonsQuery = useQuery<ChangeReason[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "reasons"],
    enabled,
  });

  const stageApprovalsQuery = useQuery<StageApproval[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "stage-approvals"],
    enabled,
  });

  const projectTypeRolesQuery = useQuery<WorkRole[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "roles"],
    enabled,
  });

  const allUsersQuery = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!projectTypeQuery.data && !projectTypeQuery.data.serviceId && globalEnabled,
  });

  const notificationsQuery = useQuery<ProjectTypeNotification[]>({
    queryKey: ["/api/project-types", projectTypeId, "notifications"],
    enabled,
  });

  const clientRequestTemplatesQuery = useQuery<ClientRequestTemplate[]>({
    queryKey: ["/api/client-request-templates"],
    enabled: globalEnabled,
  });

  const allStageApprovalFieldsQuery = useQuery<StageApprovalField[]>({
    queryKey: ["/api/config/stage-approval-fields"],
    enabled: globalEnabled,
  });

  const allStageReasonMapsQuery = useQuery<any[]>({
    queryKey: ["/api/config/stage-reason-maps"],
    enabled: globalEnabled,
  });

  const allCustomFieldsQuery = useQuery<any[]>({
    queryKey: ["/api/config/custom-fields"],
    enabled: globalEnabled,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const allServicesQuery = useQuery<Service[]>({
    queryKey: ["/api/services"],
    enabled: globalEnabled,
  });

  return {
    projectType: projectTypeQuery.data,
    projectTypeLoading: projectTypeQuery.isLoading,
    projectTypeError: projectTypeQuery.error,
    
    stages: stagesQuery.data,
    stagesLoading: stagesQuery.isLoading,
    
    reasons: reasonsQuery.data,
    reasonsLoading: reasonsQuery.isLoading,
    
    stageApprovals: stageApprovalsQuery.data,
    stageApprovalsLoading: stageApprovalsQuery.isLoading,
    
    projectTypeRoles: projectTypeRolesQuery.data,
    rolesLoading: projectTypeRolesQuery.isLoading,
    
    allUsers: allUsersQuery.data,
    usersLoading: allUsersQuery.isLoading,
    
    notifications: notificationsQuery.data,
    notificationsLoading: notificationsQuery.isLoading,
    
    clientRequestTemplates: clientRequestTemplatesQuery.data,
    
    allStageApprovalFields: allStageApprovalFieldsQuery.data,
    stageApprovalFieldsLoading: allStageApprovalFieldsQuery.isLoading,
    
    allStageReasonMaps: allStageReasonMapsQuery.data,
    
    allCustomFields: allCustomFieldsQuery.data,
    
    allServices: allServicesQuery.data,
  };
}
