import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface ProjectLinkProps {
  projectId: string;
}

export function ProjectLink({ projectId }: ProjectLinkProps) {
  const [, setLocation] = useLocation();
  const { data: project } = useQuery<any>({
    queryKey: ['/api/projects', projectId],
    enabled: !!projectId,
  });

  if (!project) {
    return <span className="text-sm text-muted-foreground">Loading...</span>;
  }

  return (
    <button
      onClick={() => setLocation(`/projects/${projectId}`)}
      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      data-testid={`link-project-${projectId}`}
    >
      {project.description || project.client?.name || 'Unknown Project'}
    </button>
  );
}
