import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { Client, Person, Service, User, WorkRole, PeopleService, ProjectWithRelations, Document } from "@shared/schema";
import type { ClientPersonWithPerson, EnhancedClientService } from "../utils/types";

export interface PeopleServiceWithRelations extends PeopleService {
  person: Person;
  service: Service;
  serviceOwner?: User;
}

export interface UseClientDataResult {
  client: Client | undefined;
  isLoading: boolean;
  error: Error | null;

  relatedPeople: ClientPersonWithPerson[] | undefined;
  peopleLoading: boolean;
  peopleError: Error | null;

  clientServices: EnhancedClientService[] | undefined;
  servicesLoading: boolean;
  servicesError: Error | null;
  refetchServices: () => void;

  peopleServices: PeopleServiceWithRelations[] | undefined;
  peopleServicesLoading: boolean;
  peopleServicesError: Error | null;
  refetchPeopleServices: () => void;

  servicesWithRoles: (Service & { roles: WorkRole[] })[] | undefined;

  clientProjects: ProjectWithRelations[] | undefined;
  projectsLoading: boolean;
  projectsError: Error | null;

  taskInstances: any[] | undefined;
  taskInstancesLoading: boolean;

  clientInternalTasks: any[] | undefined;
  clientInternalTasksLoading: boolean;

  clientDocuments: Document[] | undefined;
  documentsLoading: boolean;
}

export function useClientData(clientId: string | undefined): UseClientDataResult {
  const { data: client, isLoading, error } = useQuery<Client>({
    queryKey: [`/api/clients/${clientId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!clientId,
  });

  const { 
    data: relatedPeople, 
    isLoading: peopleLoading, 
    error: peopleError 
  } = useQuery<ClientPersonWithPerson[]>({
    queryKey: ['/api/clients', clientId, 'people'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!clientId,
    retry: 1,
  });

  const { 
    data: clientServices, 
    isLoading: servicesLoading, 
    error: servicesError, 
    refetch: refetchServices 
  } = useQuery<EnhancedClientService[]>({
    queryKey: [`/api/client-services/client/${clientId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!clientId,
  });

  const { 
    data: peopleServices, 
    isLoading: peopleServicesLoading, 
    error: peopleServicesError, 
    refetch: refetchPeopleServices 
  } = useQuery<PeopleServiceWithRelations[]>({
    queryKey: [`/api/people-services/client/${clientId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!clientId,
  });

  const { data: servicesWithRoles } = useQuery<(Service & { roles: WorkRole[] })[]>({
    queryKey: ['/api/services'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!clientId,
  });

  const { 
    data: clientProjects, 
    isLoading: projectsLoading, 
    error: projectsError 
  } = useQuery<ProjectWithRelations[]>({
    queryKey: [`/api/clients/${clientId}/projects`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: "always",
  });

  const { 
    data: taskInstances, 
    isLoading: taskInstancesLoading 
  } = useQuery<any[]>({
    queryKey: [`/api/task-instances/client/${clientId}`],
    enabled: !!clientId,
  });

  const { 
    data: clientInternalTasks, 
    isLoading: clientInternalTasksLoading 
  } = useQuery<any[]>({
    queryKey: [`/api/internal-tasks/client/${clientId}`],
    enabled: !!clientId,
  });

  const { 
    data: clientDocuments, 
    isLoading: documentsLoading 
  } = useQuery<Document[]>({
    queryKey: ['/api/clients', clientId, 'documents'],
    enabled: !!clientId,
  });

  return {
    client,
    isLoading,
    error: error as Error | null,

    relatedPeople,
    peopleLoading,
    peopleError: peopleError as Error | null,

    clientServices,
    servicesLoading,
    servicesError: servicesError as Error | null,
    refetchServices,

    peopleServices,
    peopleServicesLoading,
    peopleServicesError: peopleServicesError as Error | null,
    refetchPeopleServices,

    servicesWithRoles,

    clientProjects,
    projectsLoading,
    projectsError: projectsError as Error | null,

    taskInstances,
    taskInstancesLoading,

    clientInternalTasks,
    clientInternalTasksLoading,

    clientDocuments,
    documentsLoading,
  };
}
