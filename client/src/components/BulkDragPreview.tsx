import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Move } from "lucide-react";
import type { ProjectWithRelations } from "@shared/schema";

interface BulkDragPreviewProps {
  projects: ProjectWithRelations[];
  primaryProject: ProjectWithRelations;
}

export function BulkDragPreview({ projects }: BulkDragPreviewProps) {
  const count = projects.length;
  
  return (
    <div className="relative w-[200px]" data-testid="bulk-drag-preview">
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
        <CardContent className="p-4">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Move className="h-5 w-5 text-primary" />
              <Badge 
                variant="default" 
                className="bg-primary text-primary-foreground text-sm font-bold px-3 py-1"
                data-testid="bulk-drag-count-badge"
              >
                {count}
              </Badge>
            </div>
            
            <p className="text-sm font-medium text-foreground text-center">
              Moving {count} project{count !== 1 ? 's' : ''}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
