import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Building2, Users, FolderOpen } from "lucide-react";
import { type ProjectWithRelations, type Client, type Person } from "@shared/schema";

interface RecentlyViewedPanelProps {
  data?: {
    recentClients: (Client & { activeProjects: number; lastViewed: Date })[];
    recentPeople: (Person & { lastViewed: Date })[];
    recentProjects: (ProjectWithRelations & { lastViewed: Date })[];
  };
}

export function RecentlyViewedPanel({ data }: RecentlyViewedPanelProps) {
  const [filter, setFilter] = useState<"all" | "clients" | "people" | "projects">("all");
  
  const recentClients = data?.recentClients || [];
  const recentPeople = data?.recentPeople || [];
  const recentProjects = data?.recentProjects || [];

  const getFilteredItems = () => {
    const clientItems = recentClients.map((client) => ({ 
      type: 'client' as const, 
      data: client,
      lastViewed: new Date(client.lastViewed)
    }));
    const peopleItems = recentPeople.map((person) => ({ 
      type: 'person' as const, 
      data: person,
      lastViewed: new Date(person.lastViewed)
    }));
    const projectItems = recentProjects.map((project) => ({ 
      type: 'project' as const, 
      data: project,
      lastViewed: new Date(project.lastViewed)
    }));

    switch (filter) {
      case 'clients':
        return clientItems;
      case 'people':
        return peopleItems;
      case 'projects':
        return projectItems;
      case 'all':
      default:
        const allItems = [...clientItems, ...peopleItems, ...projectItems];
        return allItems.sort((a, b) => b.lastViewed.getTime() - a.lastViewed.getTime());
    }
  };

  const filteredItems = getFilteredItems();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-500" />
            Recently Viewed
          </CardTitle>
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-[130px] h-8" data-testid="filter-recently-viewed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="clients">Clients</SelectItem>
              <SelectItem value="people">People</SelectItem>
              <SelectItem value="projects">Projects</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="flex gap-3 min-w-max pb-2">
            {filteredItems.map((item) => {
              if (item.type === 'client') {
                const client = item.data as Client & { activeProjects: number; lastViewed: Date };
                return (
                  <div 
                    key={`client-${client.id}`} 
                    className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors w-[160px] flex-shrink-0"
                    onClick={() => window.location.href = `/clients/${client.id}`}
                    data-testid={`recent-client-${client.id}`}
                  >
                    <div className="flex flex-col gap-2">
                      <Building2 className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-medium line-clamp-2">{client.name}</span>
                      <span className="text-xs text-muted-foreground">{client.activeProjects} projects</span>
                    </div>
                  </div>
                );
              } else if (item.type === 'person') {
                const person = item.data as Person & { lastViewed: Date };
                return (
                  <div 
                    key={`person-${person.id}`} 
                    className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors w-[160px] flex-shrink-0"
                    onClick={() => window.location.href = `/person/${person.id}`}
                    data-testid={`recent-person-${person.id}`}
                  >
                    <div className="flex flex-col gap-2">
                      <Users className="w-5 h-5 text-purple-500" />
                      <span className="text-sm font-medium line-clamp-2">{person.firstName} {person.lastName}</span>
                      <span className="text-xs text-muted-foreground">{person.email || 'No email'}</span>
                    </div>
                  </div>
                );
              } else {
                const project = item.data as ProjectWithRelations;
                return (
                  <div 
                    key={`project-${project.id}`} 
                    className="p-3 bg-muted/50 rounded-lg border hover:bg-accent cursor-pointer transition-colors w-[160px] flex-shrink-0"
                    onClick={() => window.location.href = `/projects/${project.id}`}
                    data-testid={`recent-project-${project.id}`}
                  >
                    <div className="flex flex-col gap-2">
                      <FolderOpen className="w-5 h-5 text-violet-500" />
                      <span className="text-sm font-medium line-clamp-2">{project.client?.name}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">{(project as any).projectType?.name || "Unknown"}</span>
                    </div>
                  </div>
                );
              }
            })}
            {filteredItems.length === 0 && (
              <div className="w-full">
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
