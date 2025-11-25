import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { ProjectWithRelations } from "@shared/schema";
import { ProjectsList } from "./ProjectsList";

interface ServiceProjectsListProps {
  serviceId: string;
}

export function ServiceProjectsList({ serviceId }: ServiceProjectsListProps) {
  const { id } = useParams();

  const { data: projects, isLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: [`/api/clients/${id}/projects?serviceId=${serviceId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!serviceId,
    staleTime: 5 * 60 * 1000,
  });

  return <ProjectsList projects={projects} isLoading={isLoading} clientId={id} />;
}
