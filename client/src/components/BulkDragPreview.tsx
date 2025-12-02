import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectWithRelations } from "@shared/schema";

interface BulkDragPreviewProps {
  projects: ProjectWithRelations[];
  primaryProject: ProjectWithRelations;
}

export function BulkDragPreview({ projects, primaryProject }: BulkDragPreviewProps) {
  const count = projects.length;
  
  return (
    <div className="relative w-[280px]" data-testid="bulk-drag-preview">
      {count >= 3 && (
        <div
          className="absolute top-2 left-2 right-0 h-full bg-card border border-border rounded-lg opacity-40 pointer-events-none"
          style={{ transform: 'rotate(-2deg)' }}
        />
      )}
      
      {count >= 2 && (
        <div
          className="absolute top-1 left-1 right-0 h-full bg-card border border-border rounded-lg opacity-60 pointer-events-none"
          style={{ transform: 'rotate(-1deg)' }}
        />
      )}
      
      <Card className="border-2 border-primary/50 shadow-xl bg-card relative">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">
                {primaryProject.client?.name || 'Unknown Client'}
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {primaryProject.projectType?.name || 'Unknown Type'}
              </p>
            </div>
            
            <Badge 
              variant="default" 
              className="shrink-0 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5"
              data-testid="bulk-drag-count-badge"
            >
              {count}
            </Badge>
          </div>
          
          {count > 1 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Moving {count} projects
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
