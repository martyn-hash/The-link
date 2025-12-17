import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Send,
  CheckCircle2,
  Clock,
  Eye,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Loader2,
  Mail,
  Link2,
  AlertCircle,
  FileText,
  Calendar,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow, isPast, addDays } from "date-fns";
import { cn } from "@/lib/utils";

type TaskStatus = "pending" | "sent" | "in_progress" | "submitted" | "expired";

interface TaskInstance {
  id: string;
  projectId: string | null;
  clientId: string;
  templateId: string;
  overrideId: string | null;
  status: TaskStatus;
  sentAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  completedByName: string | null;
  completedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  template?: {
    id: string;
    name: string;
    description: string | null;
    instructions: string | null;
  };
  currentToken?: {
    id: string;
    token: string;
    expiresAt: string;
    accessedAt: string | null;
    recipientEmail: string | null;
    recipientName: string | null;
    createdAt: string;
  } | null;
  responses?: {
    id: string;
    questionId: string;
    questionSource: string;
    valueText: string | null;
    valueNumber: string | null;
    valueDate: string | null;
    valueBoolean: boolean | null;
    valueMultiSelect: string[] | null;
    answeredAt: string | null;
  }[];
}

interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  projectTypeId: string;
  isActive: boolean;
}

interface ClientProjectTasksSectionProps {
  projectId: string;
  clientId?: string;
  projectTypeId?: string;
  clientName?: string;
}

const statusColors: Record<TaskStatus, string> = {
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  submitted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  expired: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const statusLabels: Record<TaskStatus, string> = {
  pending: "Pending",
  sent: "Sent",
  in_progress: "In Progress",
  submitted: "Submitted",
  expired: "Expired",
};

const statusIcons: Record<TaskStatus, typeof Clock> = {
  pending: Clock,
  sent: Send,
  in_progress: RefreshCw,
  submitted: CheckCircle2,
  expired: AlertCircle,
};

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const Icon = statusIcons[status];
  return (
    <Badge className={`${statusColors[status]} border-0 gap-1`} data-testid={`badge-task-status-${status}`}>
      <Icon className="w-3 h-3" />
      {statusLabels[status]}
    </Badge>
  );
}

function ResponseViewer({ 
  instanceId, 
  responses 
}: { 
  instanceId: string; 
  responses: TaskInstance['responses']; 
}) {
  const { data: questions } = useQuery<{
    id: string;
    label: string;
    questionType: string;
    isRequired: boolean;
    source: 'template' | 'override';
  }[]>({
    queryKey: ['/api/task-instances', instanceId, 'merged-questions'],
  });

  if (!questions || !responses) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
        Loading responses...
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No responses yet
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
      {questions.map((question) => {
        const response = responses.find(r => r.questionId === question.id);
        const value = response?.valueText 
          || response?.valueNumber 
          || (response?.valueBoolean !== null && response?.valueBoolean !== undefined ? (response.valueBoolean ? 'Yes' : 'No') : null)
          || (response?.valueDate ? format(new Date(response.valueDate), 'dd MMM yyyy') : null)
          || (response?.valueMultiSelect?.join(', '))
          || null;

        return (
          <div key={question.id} className="space-y-1">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {question.label}
                  {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                </p>
                <p className={cn(
                  "text-sm mt-1",
                  value ? "text-foreground" : "text-muted-foreground italic"
                )}>
                  {value || "No response"}
                </p>
                {response?.answeredAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Answered {formatDistanceToNow(new Date(response.answeredAt), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ClientProjectTasksSection({
  projectId,
  clientId,
  projectTypeId,
  clientName,
}: ClientProjectTasksSectionProps) {
  const { toast } = useToast();
  const [expandedInstances, setExpandedInstances] = useState<Set<string>>(new Set());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [expiryDays, setExpiryDays] = useState(7);
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false);
  const [extendingTokenId, setExtendingTokenId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(3);

  const { data: instances, isLoading } = useQuery<TaskInstance[]>({
    queryKey: ['/api/projects', projectId, 'task-instances'],
  });

  const { data: templates } = useQuery<TaskTemplate[]>({
    queryKey: ['/api/project-types', projectTypeId, 'task-templates'],
    enabled: !!projectTypeId,
  });

  const activeTemplates = templates?.filter(t => t.isActive) || [];

  const createInstanceMutation = useMutation({
    mutationFn: async (data: {
      templateId: string;
      recipientEmail: string;
      recipientName: string;
      expiryDays: number;
    }) => {
      return apiRequest('POST', `/api/projects/${projectId}/task-instances`, {
        templateId: data.templateId,
        clientId,
        status: 'sent',
        recipientEmail: data.recipientEmail,
        recipientName: data.recipientName,
        expiryDays: data.expiryDays,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'task-instances'] });
      setIsCreateDialogOpen(false);
      resetCreateForm();
      toast({ title: "Task sent", description: "Client task has been created and sent." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create task", 
        variant: "destructive" 
      });
    },
  });

  const resendLinkMutation = useMutation({
    mutationFn: async ({ instanceId, email, name }: { instanceId: string; email: string; name?: string }) => {
      return apiRequest('POST', `/api/task-instances/${instanceId}/resend`, { 
        recipientEmail: email,
        recipientName: name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'task-instances'] });
      toast({ title: "Link resent", description: "A new link has been sent to the client." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resend link.", variant: "destructive" });
    },
  });

  const extendExpiryMutation = useMutation({
    mutationFn: async ({ tokenId, additionalDays }: { tokenId: string; additionalDays: number }) => {
      return apiRequest('POST', `/api/task-tokens/${tokenId}/extend`, { additionalDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'task-instances'] });
      setIsExtendDialogOpen(false);
      setExtendingTokenId(null);
      toast({ title: "Expiry extended", description: `Link validity extended by ${extendDays} days.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to extend expiry.", variant: "destructive" });
    },
  });

  const resetCreateForm = () => {
    setSelectedTemplateId("");
    setRecipientEmail("");
    setRecipientName("");
    setExpiryDays(7);
  };

  const toggleExpanded = (instanceId: string) => {
    setExpandedInstances(prev => {
      const next = new Set(prev);
      if (next.has(instanceId)) {
        next.delete(instanceId);
      } else {
        next.add(instanceId);
      }
      return next;
    });
  };

  const handleCreateTask = () => {
    if (!selectedTemplateId || !recipientEmail) {
      toast({ title: "Error", description: "Please select a template and enter recipient email.", variant: "destructive" });
      return;
    }
    createInstanceMutation.mutate({
      templateId: selectedTemplateId,
      recipientEmail,
      recipientName,
      expiryDays,
    });
  };

  const copyLinkToClipboard = (token: string) => {
    const url = `${window.location.origin}/task/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Task link copied to clipboard." });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const hasInstances = instances && instances.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Client Project Tasks</h3>
          {hasInstances && (
            <Badge variant="secondary" className="text-xs">
              {instances.length}
            </Badge>
          )}
        </div>
        {activeTemplates.length > 0 && (
          <Button
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="button-create-task"
          >
            <Plus className="w-4 h-4 mr-1" />
            Send Task
          </Button>
        )}
      </div>

      {!hasInstances ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">
              No client tasks have been sent for this project yet.
            </p>
            {activeTemplates.length > 0 ? (
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-send-first-task">
                <Send className="w-4 h-4 mr-2" />
                Send Client Task
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Configure task templates in the project type settings to enable client tasks.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {instances.map((instance) => {
            const isExpanded = expandedInstances.has(instance.id);
            const token = instance.currentToken;
            const isExpired = token?.expiresAt && isPast(new Date(token.expiresAt));
            const canExtend = token && !isExpired && instance.status !== 'submitted';
            const canResend = instance.status !== 'submitted';

            return (
              <Card key={instance.id} data-testid={`task-instance-card-${instance.id}`}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(instance.id)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-sm font-medium">
                                {instance.template?.name || "Task"}
                              </CardTitle>
                              <TaskStatusBadge status={instance.status} />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                              {token?.recipientEmail && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {token.recipientEmail}
                                </span>
                              )}
                              {instance.sentAt && (
                                <span className="flex items-center gap-1">
                                  <Send className="w-3 h-3" />
                                  Sent {formatDistanceToNow(new Date(instance.sentAt), { addSuffix: true })}
                                </span>
                              )}
                              {instance.submittedAt && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                                  Submitted {formatDistanceToNow(new Date(instance.submittedAt), { addSuffix: true })}
                                </span>
                              )}
                              {token?.expiresAt && instance.status !== 'submitted' && (
                                <span className={cn(
                                  "flex items-center gap-1",
                                  isExpired && "text-red-600"
                                )}>
                                  <Clock className="w-3 h-3" />
                                  {isExpired 
                                    ? `Expired ${formatDistanceToNow(new Date(token.expiresAt), { addSuffix: true })}`
                                    : `Expires ${format(new Date(token.expiresAt), 'dd MMM yyyy')}`
                                  }
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      {instance.completedByName && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>
                            Completed by <strong>{instance.completedByName}</strong>
                            {instance.completedByEmail && ` (${instance.completedByEmail})`}
                          </span>
                        </div>
                      )}

                      {instance.status === 'submitted' && instance.responses && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            Responses
                          </h4>
                          <ResponseViewer 
                            instanceId={instance.id} 
                            responses={instance.responses} 
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        {token && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyLinkToClipboard(token.token);
                                  }}
                                  data-testid={`button-copy-link-${instance.id}`}
                                >
                                  <Link2 className="w-4 h-4 mr-1" />
                                  Copy Link
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy task link to clipboard</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {token && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/task/${token.token}`, '_blank');
                            }}
                            data-testid={`button-preview-${instance.id}`}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                        )}

                        {canExtend && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExtendingTokenId(token.id);
                              setIsExtendDialogOpen(true);
                            }}
                            data-testid={`button-extend-${instance.id}`}
                          >
                            <Calendar className="w-4 h-4 mr-1" />
                            Extend Expiry
                          </Button>
                        )}

                        {canResend && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              resendLinkMutation.mutate({
                                instanceId: instance.id,
                                email: token?.recipientEmail || '',
                                name: token?.recipientName || undefined,
                              });
                            }}
                            disabled={resendLinkMutation.isPending}
                            data-testid={`button-resend-${instance.id}`}
                          >
                            {resendLinkMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4 mr-1" />
                            )}
                            Resend Link
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Task Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Client Task</DialogTitle>
            <DialogDescription>
              Send a pre-work checklist to the client for this project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template">Task Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger id="template" data-testid="select-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient-name">Recipient Name</Label>
              <Input
                id="recipient-name"
                data-testid="input-recipient-name"
                placeholder="e.g. John Smith"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient-email">Recipient Email</Label>
              <Input
                id="recipient-email"
                data-testid="input-recipient-email"
                type="email"
                placeholder="e.g. john@company.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiry-days">Link Expires In</Label>
              <Select value={expiryDays.toString()} onValueChange={(v) => setExpiryDays(parseInt(v))}>
                <SelectTrigger id="expiry-days" data-testid="select-expiry-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={createInstanceMutation.isPending || !selectedTemplateId || !recipientEmail}
              data-testid="button-confirm-send-task"
            >
              {createInstanceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Expiry Dialog */}
      <Dialog open={isExtendDialogOpen} onOpenChange={setIsExtendDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Extend Link Expiry</DialogTitle>
            <DialogDescription>
              Add more time before the task link expires.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="extend-days">Extend By</Label>
              <Select value={extendDays.toString()} onValueChange={(v) => setExtendDays(parseInt(v))}>
                <SelectTrigger id="extend-days" data-testid="select-extend-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExtendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (extendingTokenId) {
                  extendExpiryMutation.mutate({
                    tokenId: extendingTokenId,
                    additionalDays: extendDays,
                  });
                }
              }}
              disabled={extendExpiryMutation.isPending}
              data-testid="button-confirm-extend"
            >
              {extendExpiryMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4 mr-2" />
              )}
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
