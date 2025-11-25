import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Edit2, Trash2, Eye } from "lucide-react";
import { NotificationPreviewDialog } from "@/components/NotificationPreviewDialog";
import { ClientPersonSelectionModal } from "@/components/ClientPersonSelectionModal";
import type { 
  ProjectTypeNotification, 
  KanbanStage, 
  ClientRequestTemplate,
  PreviewCandidatesResponse 
} from "@shared/schema";

interface NotificationRowProps {
  notification: ProjectTypeNotification;
  projectTypeId: string;
  stages: KanbanStage[];
  clientRequestTemplates: ClientRequestTemplate[];
  onDelete: (id: string) => void;
}

export function NotificationRow({
  notification,
  projectTypeId,
  stages,
  clientRequestTemplates,
  onDelete,
}: NotificationRowProps) {
  const [, navigate] = useLocation();
  const [selectionModalOpen, setSelectionModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  const candidatesQuery = useQuery<PreviewCandidatesResponse>({
    queryKey: ['/api/project-types', projectTypeId, 'notifications', notification.id, 'preview-candidates'],
    enabled: selectionModalOpen,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
  
  const previewMutation = useMutation({
    mutationFn: async ({ clientId, projectId, personId }: { clientId?: string; projectId?: string; personId?: string }) => {
      const params = new URLSearchParams();
      if (clientId) params.append('clientId', clientId);
      if (projectId) params.append('projectId', projectId);
      if (personId) params.append('personId', personId);
      
      const url = `/api/project-types/${projectTypeId}/notifications/${notification.id}/preview${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch preview');
      return res.json();
    },
  });
  
  const handlePreviewClick = async () => {
    setSelectionModalOpen(true);
  };
  
  const handleClientPersonSelect = (clientId: string, projectId: string, personId: string) => {
    setSelectionModalOpen(false);
    previewMutation.mutate({ clientId, projectId, personId });
    setPreviewOpen(true);
  };
  
  const getTriggerSummary = () => {
    if (notification.category === 'project') {
      const offsetLabel = notification.offsetType === 'on' ? 'On' : 
        `${notification.offsetDays} day${notification.offsetDays !== 1 ? 's' : ''} ${notification.offsetType}`;
      const dateRef = notification.dateReference === 'start_date' ? 'start date' : 'due date';
      return `${offsetLabel} ${dateRef}`;
    } else {
      const stage = stages.find(s => s.id === notification.stageId);
      const trigger = notification.stageTrigger === 'entry' ? 'enters' : 'exits';
      return `When ${trigger} "${stage?.name || 'Unknown'}"`;
    }
  };

  const getContentPreview = () => {
    if (notification.notificationType === 'email') {
      return notification.emailTitle || '-';
    } else if (notification.notificationType === 'sms') {
      return notification.smsContent || '-';
    } else {
      return notification.pushTitle || '-';
    }
  };

  const getFullContent = () => {
    if (notification.notificationType === 'email') {
      return notification.emailBody ? 
        `${notification.emailTitle}\n\n${notification.emailBody.replace(/<[^>]*>/g, '')}` : 
        notification.emailTitle;
    } else if (notification.notificationType === 'sms') {
      return notification.smsContent;
    } else {
      return `${notification.pushTitle}\n${notification.pushBody}`;
    }
  };

  const linkedTemplate = clientRequestTemplates.find(t => t.id === notification.clientRequestTemplateId);

  return (
    <TableRow data-testid={`row-notification-${notification.id}`}>
      <TableCell className="font-medium">
        <Badge 
          variant="outline" 
          className="uppercase"
          data-testid={`badge-type-${notification.id}`}
        >
          {notification.notificationType}
        </Badge>
      </TableCell>
      
      <TableCell>
        <span className="text-sm" data-testid={`text-trigger-${notification.id}`}>
          {getTriggerSummary()}
        </span>
      </TableCell>
      
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm truncate max-w-xs block cursor-help" data-testid={`text-content-${notification.id}`}>
                {getContentPreview()}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <p className="whitespace-pre-wrap text-sm">{getFullContent()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      
      <TableCell>
        {linkedTemplate ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-sm"
            onClick={() => navigate(`/admin/client-request-templates`)}
            data-testid={`button-template-${notification.id}`}
          >
            {linkedTemplate.name}
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </TableCell>
      
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/settings/project-types/${projectTypeId}/notifications/${notification.id}/edit`)}
            data-testid={`button-edit-${notification.id}`}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreviewClick}
            data-testid={`button-preview-${notification.id}`}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <ClientPersonSelectionModal
            open={selectionModalOpen}
            onOpenChange={setSelectionModalOpen}
            candidates={candidatesQuery.data?.candidates || []}
            hasEligibleCandidates={candidatesQuery.data?.hasEligibleCandidates || false}
            message={candidatesQuery.data?.message}
            isLoading={candidatesQuery.isLoading}
            onSelect={handleClientPersonSelect}
          />
          <NotificationPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            previewData={previewMutation.data || null}
            isLoading={previewMutation.isPending}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(notification.id)}
            data-testid={`button-delete-${notification.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
