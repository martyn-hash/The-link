import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Check } from "lucide-react";
import { ProjectsList } from "../projects";
import type { ProjectWithRelations } from "@shared/schema";

interface ProjectsTabProps {
  clientId: string;
  projects: ProjectWithRelations[] | undefined;
  isLoading: boolean;
}

export function ProjectsTab({ clientId, projects, isLoading }: ProjectsTabProps) {
  const openProjects = projects?.filter(p => !p.completionStatus && !p.inactive);
  const completedProjects = projects?.filter(p => p.completionStatus || p.inactive);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Open Projects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectsList 
            projects={openProjects} 
            isLoading={isLoading}
            clientId={clientId}
            isCompleted={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="w-5 h-5" />
            Completed Projects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectsList 
            projects={completedProjects} 
            isLoading={isLoading}
            clientId={clientId}
            isCompleted={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}
