import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  HelpCircle, 
  MoreHorizontal, 
  Send, 
  CheckCircle, 
  Trash2,
  Edit,
  MessageSquare,
  CalendarIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Upload,
  Mail,
  Link2,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Paperclip,
  FileText,
  Image,
  Download,
  Eye,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { BookkeepingQueryWithRelations, User } from "@shared/schema";
import { QueryBulkImport, type ParsedQuery } from "./QueryBulkImport";
import { EmailDialog } from "@/pages/client-detail/components/communications/dialogs/EmailDialog";
import { ScheduledRemindersPanel } from "./ScheduledRemindersPanel";

type QueryStatus = "open" | "answered_by_staff" | "sent_to_client" | "answered_by_client" | "resolved";

interface PersonOption {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    primaryPhone?: string;
    primaryEmail?: string;
    telephone?: string;
    email?: string;
  };
  role?: string | null;
}

interface QueriesTabProps {
  projectId: string;
  clientId?: string;
  clientPeople?: PersonOption[];
  user?: User | null;
  clientName?: string;
}

const statusColors: Record<QueryStatus, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  answered_by_staff: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  sent_to_client: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  answered_by_client: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  resolved: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const statusLabels: Record<QueryStatus, string> = {
  open: "Open",
  answered_by_staff: "Staff Answered",
  sent_to_client: "Sent to Client",
  answered_by_client: "Client Answered",
  resolved: "Resolved",
};

function QueryStatusBadge({ status }: { status: QueryStatus }) {
  return (
    <Badge className={`${statusColors[status]} border-0`} data-testid={`badge-status-${status}`}>
      {statusLabels[status]}
    </Badge>
  );
}

function formatCurrency(amount: string | null | undefined): string {
  if (!amount) return "";
  const num = parseFloat(amount);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(num);
}

function AmountDisplay({ moneyIn, moneyOut }: { moneyIn?: string | null; moneyOut?: string | null }) {
  if (moneyIn && parseFloat(moneyIn) > 0) {
    return (
      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <ArrowDownLeft className="w-3 h-3" />
        {formatCurrency(moneyIn)}
      </span>
    );
  }
  if (moneyOut && parseFloat(moneyOut) > 0) {
    return (
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
        <ArrowUpRight className="w-3 h-3" />
        {formatCurrency(moneyOut)}
      </span>
    );
  }
  return <span className="text-muted-foreground">-</span>;
}

export function QueriesTab({ projectId, clientId, clientPeople, user, clientName }: QueriesTabProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [selectedQueries, setSelectedQueries] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState<BookkeepingQueryWithRelations | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  // Email dialog state
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailInitialValues, setEmailInitialValues] = useState<{ 
    subject?: string; 
    content?: string;
    emailIntro?: string;
    protectedHtml?: string;
    emailSignoff?: string;
  }>({});
  const [pendingEmailQueryIds, setPendingEmailQueryIds] = useState<string[]>([]);
  const [pendingEmailTokenId, setPendingEmailTokenId] = useState<string | null>(null);
  const [pendingEmailExpiryDays, setPendingEmailExpiryDays] = useState<number | null>(null);
  const [configuredReminders, setConfiguredReminders] = useState<Array<{ id: string; scheduledAt: string; channel: 'email' | 'sms' | 'voice'; enabled: boolean }>>([]);
  const [isPreparingEmail, setIsPreparingEmail] = useState(false);
  
  // Send Options dialog state
  const [isSendOptionsOpen, setIsSendOptionsOpen] = useState(false);
  const [sendOptionsQueryIds, setSendOptionsQueryIds] = useState<string[]>([]);
  const [includeOnlineLink, setIncludeOnlineLink] = useState(true);
  const [linkExpiryDays, setLinkExpiryDays] = useState(3);
  
  // Token management state
  const [showActiveTokens, setShowActiveTokens] = useState(false);
  const [extendTokenId, setExtendTokenId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(3);
  const [reminderTokenId, setReminderTokenId] = useState<string | null>(null);
  const [isPreparingReminder, setIsPreparingReminder] = useState(false);

  // Add Query form state
  const [newQueryText, setNewQueryText] = useState("");
  const [newQueryDescription, setNewQueryDescription] = useState("");
  const [newQueryDate, setNewQueryDate] = useState<Date | undefined>(undefined);
  const [newQueryMoneyIn, setNewQueryMoneyIn] = useState("");
  const [newQueryMoneyOut, setNewQueryMoneyOut] = useState("");
  const [newQueryHasVat, setNewQueryHasVat] = useState(false);
  const [newQueryComment, setNewQueryComment] = useState("");

  // Edit Query form state
  const [editQueryText, setEditQueryText] = useState("");
  const [editQueryDescription, setEditQueryDescription] = useState("");
  const [editQueryDate, setEditQueryDate] = useState<Date | undefined>(undefined);
  const [editQueryMoneyIn, setEditQueryMoneyIn] = useState("");
  const [editQueryMoneyOut, setEditQueryMoneyOut] = useState("");
  const [editQueryHasVat, setEditQueryHasVat] = useState(false);
  const [editQueryStatus, setEditQueryStatus] = useState<QueryStatus>("open");
  const [editQueryResponse, setEditQueryResponse] = useState("");
  const [editQueryComment, setEditQueryComment] = useState("");
  
  // View All Responses modal state
  const [isViewAllOpen, setIsViewAllOpen] = useState(false);

  const { data: queries, isLoading } = useQuery<BookkeepingQueryWithRelations[]>({
    queryKey: ['/api/projects', projectId, 'queries'],
  });

  const { data: stats } = useQuery<{
    total: number;
    open: number;
    answeredByStaff: number;
    sentToClient: number;
    answeredByClient: number;
    resolved: number;
  }>({
    queryKey: ['/api/projects', projectId, 'queries', 'stats'],
  });

  // Query for active tokens (only fetch when expanded)
  const { data: activeTokens } = useQuery<{
    id: string;
    token: string;
    expiresAt: string;
    accessedAt: string | null;
    recipientEmail: string;
    recipientName: string | null;
    queryCount: number;
    createdAt: string;
    createdBy?: { firstName: string | null; lastName: string | null };
  }[]>({
    queryKey: ['/api/projects', projectId, 'queries', 'tokens'],
    enabled: showActiveTokens,
  });

  const extendTokenMutation = useMutation({
    mutationFn: async ({ tokenId, additionalDays }: { tokenId: string; additionalDays: number }) => {
      return apiRequest('POST', `/api/queries/tokens/${tokenId}/extend`, { additionalDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries', 'tokens'] });
      setExtendTokenId(null);
      toast({ title: "Link extended", description: `Link validity extended by ${extendDays} days.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to extend link.", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { 
      ourQuery: string; 
      description?: string;
      date?: string;
      moneyIn?: string;
      moneyOut?: string;
      hasVat?: boolean;
      comment?: string;
    }) => {
      return apiRequest('POST', `/api/projects/${projectId}/queries`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/queries/counts'] });
      resetAddForm();
      setIsAddDialogOpen(false);
      toast({ title: "Query created", description: "Your query has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create query.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { 
      id: string; 
      ourQuery?: string; 
      description?: string;
      date?: string | null;
      moneyIn?: string | null;
      moneyOut?: string | null;
      hasVat?: boolean | null;
      status?: QueryStatus; 
      clientResponse?: string;
      comment?: string;
    }) => {
      const { id, ...updateData } = data;
      return apiRequest('PATCH', `/api/queries/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/queries/counts'] });
      setIsEditDialogOpen(false);
      setEditingQuery(null);
      toast({ title: "Query updated", description: "Query has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update query.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/queries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/queries/counts'] });
      toast({ title: "Query deleted", description: "Query has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete query.", variant: "destructive" });
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async (data: { ids: string[]; status: QueryStatus }) => {
      return apiRequest('POST', '/api/queries/bulk-status', data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/queries/counts'] });
      setSelectedQueries([]);
      toast({ 
        title: "Queries updated", 
        description: `${variables.ids.length} queries marked as ${statusLabels[variables.status]}.` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update queries.", variant: "destructive" });
    },
  });

  // Inline VAT toggle mutation
  const toggleVatMutation = useMutation({
    mutationFn: async ({ id, hasVat }: { id: string; hasVat: boolean }) => {
      return apiRequest('PATCH', `/api/queries/${id}`, { hasVat });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update VAT status.", variant: "destructive" });
    },
  });

  // Bulk import handler
  const handleBulkImport = async (parsedQueries: ParsedQuery[]) => {
    let successCount = 0;
    let failCount = 0;
    
    for (const query of parsedQueries) {
      try {
        await apiRequest('POST', `/api/projects/${projectId}/queries`, {
          ourQuery: query.ourQuery || "Please clarify this transaction",
          description: query.description || undefined,
          date: query.date ? query.date.toISOString() : undefined,
          moneyIn: query.moneyIn || undefined,
          moneyOut: query.moneyOut || undefined,
        });
        successCount++;
      } catch (error) {
        failCount++;
        console.error("Failed to create query:", error);
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
    queryClient.invalidateQueries({ queryKey: ['/api/queries/counts'] });
    
    if (failCount === 0) {
      toast({ 
        title: "Import complete", 
        description: `Successfully imported ${successCount} queries.` 
      });
    } else {
      toast({ 
        title: "Import partially complete", 
        description: `Imported ${successCount} queries, ${failCount} failed.`,
        variant: "destructive" 
      });
    }
  };

  const resetAddForm = () => {
    setNewQueryText("");
    setNewQueryDescription("");
    setNewQueryDate(undefined);
    setNewQueryMoneyIn("");
    setNewQueryMoneyOut("");
    setNewQueryHasVat(false);
    setNewQueryComment("");
  };

  const handleAddQuery = () => {
    if (!newQueryText.trim()) return;
    createMutation.mutate({ 
      ourQuery: newQueryText.trim(),
      description: newQueryDescription.trim() || undefined,
      date: newQueryDate ? newQueryDate.toISOString() : undefined,
      moneyIn: newQueryMoneyIn || undefined,
      moneyOut: newQueryMoneyOut || undefined,
      hasVat: newQueryHasVat || undefined,
      comment: newQueryComment.trim() || undefined,
    });
  };

  const handleEditQuery = (query: BookkeepingQueryWithRelations) => {
    setEditingQuery(query);
    setEditQueryText(query.ourQuery || "");
    setEditQueryDescription(query.description || "");
    setEditQueryDate(query.date ? new Date(query.date) : undefined);
    setEditQueryMoneyIn(query.moneyIn || "");
    setEditQueryMoneyOut(query.moneyOut || "");
    setEditQueryHasVat(query.hasVat || false);
    setEditQueryStatus(query.status as QueryStatus);
    setEditQueryResponse(query.clientResponse || "");
    setEditQueryComment((query as any).comment || "");
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingQuery || !editQueryText.trim()) return;
    updateMutation.mutate({
      id: editingQuery.id,
      ourQuery: editQueryText.trim(),
      description: editQueryDescription.trim() || undefined,
      date: editQueryDate ? editQueryDate.toISOString() : undefined,
      moneyIn: editQueryMoneyIn || undefined,
      moneyOut: editQueryMoneyOut || undefined,
      hasVat: editQueryHasVat,
      status: editQueryStatus,
      clientResponse: editQueryResponse.trim() || undefined,
      comment: editQueryComment.trim() || undefined,
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedQueries(filteredQueries.map(q => q.id));
    } else {
      setSelectedQueries([]);
    }
  };

  const handleSelectQuery = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedQueries([...selectedQueries, id]);
    } else {
      setSelectedQueries(selectedQueries.filter(qId => qId !== id));
    }
  };

  // Open send options dialog before preparing email
  const handleOpenSendOptions = (queryIds: string[]) => {
    if (!clientId) {
      toast({ title: "Error", description: "Client ID is required to send queries.", variant: "destructive" });
      return;
    }
    setSendOptionsQueryIds(queryIds);
    setIncludeOnlineLink(true);
    setLinkExpiryDays(3);
    setIsSendOptionsOpen(true);
  };

  // Confirm send options and prepare email
  const handleConfirmSendOptions = async () => {
    setIsSendOptionsOpen(false);
    setIsPreparingEmail(true);
    
    try {
      // Only include expiryDays if online link is requested
      const requestBody: { queryIds: string[]; includeOnlineLink: boolean; expiryDays?: number } = {
        queryIds: sendOptionsQueryIds,
        includeOnlineLink,
      };
      
      if (includeOnlineLink) {
        requestBody.expiryDays = linkExpiryDays;
      }
      
      const response = await apiRequest('POST', `/api/projects/${projectId}/queries/prepare-email`, requestBody);
      
      // Store the token ID, query IDs, and expiry days for after email is sent
      setPendingEmailTokenId(includeOnlineLink ? response.tokenId : null);
      setPendingEmailQueryIds(sendOptionsQueryIds);
      setPendingEmailExpiryDays(includeOnlineLink ? linkExpiryDays : null);
      setConfiguredReminders([]);
      
      // Set initial values for email dialog with structured content for protected HTML
      setEmailInitialValues({
        subject: response.emailSubject,
        content: response.emailContent,
        // Structured content for protected HTML handling
        emailIntro: response.emailIntro,
        protectedHtml: response.protectedHtml,
        emailSignoff: response.emailSignoff,
      });
      
      // Open the email dialog
      setIsEmailDialogOpen(true);
    } catch (error) {
      console.error('Error preparing email:', error);
      toast({ title: "Error", description: "Failed to prepare email content.", variant: "destructive" });
    } finally {
      setIsPreparingEmail(false);
      setSendOptionsQueryIds([]);
    }
  };

  // Legacy function for backward compatibility
  const handlePrepareEmail = async (queryIds: string[]) => {
    handleOpenSendOptions(queryIds);
  };

  // Called when email is successfully sent
  const handleEmailSuccess = async () => {
    if (pendingEmailQueryIds.length > 0) {
      try {
        // Mark queries as sent and log to chronology
        await apiRequest('POST', `/api/projects/${projectId}/queries/mark-sent`, {
          queryIds: pendingEmailQueryIds,
          tokenId: pendingEmailTokenId,
        });
        
        // Save configured reminders if we have a token and enabled reminders
        if (pendingEmailTokenId && configuredReminders.length > 0) {
          const enabledReminders = configuredReminders.filter(r => r.enabled);
          if (enabledReminders.length > 0) {
            try {
              await apiRequest('POST', `/api/projects/${projectId}/queries/reminders`, {
                tokenId: pendingEmailTokenId,
                reminders: enabledReminders.map(r => ({
                  scheduledAt: r.scheduledAt,
                  channel: r.channel,
                })),
              });
              console.log(`Saved ${enabledReminders.length} scheduled reminders for token ${pendingEmailTokenId}`);
            } catch (reminderError) {
              console.error('Error saving reminders:', reminderError);
              // Don't fail the overall operation if reminder saving fails
            }
          }
        }
        
        // Refresh queries list and reminders
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries', 'reminders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/queries/counts'] });
        
        const reminderCount = configuredReminders.filter(r => r.enabled).length;
        toast({ 
          title: "Queries sent", 
          description: `${pendingEmailQueryIds.length} queries sent to client${reminderCount > 0 ? ` with ${reminderCount} scheduled reminder${reminderCount !== 1 ? 's' : ''}` : ''}.` 
        });
      } catch (error) {
        console.error('Error marking queries as sent:', error);
        // Email was sent, but marking failed - don't show error to user
      }
    }
    
    // Clear state
    setSelectedQueries([]);
    setPendingEmailQueryIds([]);
    setPendingEmailTokenId(null);
    setPendingEmailExpiryDays(null);
    setConfiguredReminders([]);
    setEmailInitialValues({});
    setIsEmailDialogOpen(false);
    setReminderTokenId(null);
  };

  const handleEmailClose = () => {
    setIsEmailDialogOpen(false);
    setEmailInitialValues({});
    // Don't clear pending query IDs until next prepare
    setReminderTokenId(null);
  };

  // Handle sending reminder for a token
  const handleSendReminder = async (tokenId: string) => {
    if (!clientId) {
      toast({ title: "Error", description: "Client ID is required to send reminder.", variant: "destructive" });
      return;
    }
    
    setIsPreparingReminder(true);
    setReminderTokenId(tokenId);
    
    try {
      const response = await apiRequest('POST', `/api/queries/tokens/${tokenId}/send-reminder`, {});
      
      // Set initial values for email dialog
      setEmailInitialValues({
        subject: response.emailSubject,
        content: response.emailContent,
      });
      
      // Clear the pending query IDs (this is a reminder, not a new send)
      setPendingEmailQueryIds([]);
      setPendingEmailTokenId(null);
      
      // Open the email dialog
      setIsEmailDialogOpen(true);
    } catch (error: any) {
      console.error('Error preparing reminder:', error);
      const errorMessage = error?.message || "Failed to prepare reminder.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      // Clear reminder state on error so subsequent regular sends work correctly
      setReminderTokenId(null);
    } finally {
      setIsPreparingReminder(false);
    }
  };

  // Handle reminder email success
  const handleReminderSuccess = async () => {
    toast({ 
      title: "Reminder sent", 
      description: "A reminder email has been sent to the client." 
    });
    
    // Refresh tokens list to update UI
    queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries', 'tokens'] });
    
    // Clear state
    setReminderTokenId(null);
    setEmailInitialValues({});
    setIsEmailDialogOpen(false);
  };

  const filteredQueries = queries?.filter(q => {
    if (filterStatus === "all") return true;
    return q.status === filterStatus;
  }) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            Bookkeeping Queries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Scheduled Reminders Panel - show above queries when reminders exist */}
      <ScheduledRemindersPanel projectId={projectId} />
      
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Bookkeeping Queries
            {stats && (
              <span className="text-sm font-normal text-muted-foreground ml-2" data-testid="text-query-count">
                ({stats.open} open / {stats.total} total)
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* View All Responses button - show when there are any client responses (text or attachments) */}
            {queries && queries.some(q => q.clientResponse || (q.clientAttachments && (q.clientAttachments as any[]).length > 0) || q.status === 'answered_by_client') && (
              <>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsViewAllOpen(true)}
                  data-testid="button-view-all-responses"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View All
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    const answeredQueries = queries.filter(q => q.status === 'answered_by_client');
                    if (answeredQueries.length === 0) {
                      toast({ 
                        title: "No queries to notify about",
                        description: "There are no queries waiting for staff review."
                      });
                      return;
                    }
                    const queryCount = answeredQueries.length;
                    const subject = `${queryCount} Bookkeeping ${queryCount === 1 ? 'Query' : 'Queries'} Answered${clientName ? ` - ${clientName}` : ''}`;
                    const content = `
                      <p>The client has responded to ${queryCount} bookkeeping ${queryCount === 1 ? 'query' : 'queries'}:</p>
                      <ul style="margin: 12px 0;">
                        ${answeredQueries.map(q => `
                          <li style="margin-bottom: 8px;">
                            <strong>${q.description || 'No description'}</strong>
                            ${q.date ? ` (${format(new Date(q.date), "dd MMM yyyy")})` : ''}
                            <br/>
                            <em>Query:</em> ${q.ourQuery}
                            <br/>
                            <em>Response:</em> ${q.clientResponse}
                          </li>
                        `).join('')}
                      </ul>
                      <p>Please review and process these responses.</p>
                    `.trim();
                    setEmailInitialValues({ subject, content });
                    setIsEmailDialogOpen(true);
                  }}
                  data-testid="button-notify-assignees"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Notify
                </Button>
              </>
            )}
            <QueryBulkImport 
              onImport={handleBulkImport}
              trigger={
                <Button size="sm" variant="outline" data-testid="button-import-queries">
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
              }
            />
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) resetAddForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-query">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Query
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Bookkeeping Query</DialogTitle>
                <DialogDescription>
                  Add a transaction query for the client or client manager to answer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Transaction Date */}
                <div>
                  <label className="text-sm font-medium">Transaction Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !newQueryDate && "text-muted-foreground"
                        )}
                        data-testid="button-add-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newQueryDate ? format(newQueryDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newQueryDate}
                        onSelect={setNewQueryDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Description (transaction narrative) */}
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={newQueryDescription}
                    onChange={(e) => setNewQueryDescription(e.target.value)}
                    placeholder="e.g., AMAZON PRIME *MS1234"
                    className="mt-1"
                    data-testid="input-query-description"
                  />
                </div>

                {/* Amount fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Money In (£)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newQueryMoneyIn}
                      onChange={(e) => {
                        setNewQueryMoneyIn(e.target.value);
                        if (e.target.value) setNewQueryMoneyOut("");
                      }}
                      placeholder="0.00"
                      className="mt-1"
                      data-testid="input-query-money-in"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Money Out (£)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newQueryMoneyOut}
                      onChange={(e) => {
                        setNewQueryMoneyOut(e.target.value);
                        if (e.target.value) setNewQueryMoneyIn("");
                      }}
                      placeholder="0.00"
                      className="mt-1"
                      data-testid="input-query-money-out"
                    />
                  </div>
                </div>

                {/* Has VAT toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Includes VAT</label>
                  <Switch
                    checked={newQueryHasVat}
                    onCheckedChange={setNewQueryHasVat}
                    data-testid="switch-add-has-vat"
                  />
                </div>

                {/* Query / Question */}
                <div>
                  <label className="text-sm font-medium">Your Query</label>
                  <Textarea
                    value={newQueryText}
                    onChange={(e) => setNewQueryText(e.target.value)}
                    placeholder="What is this transaction for? Is it a business expense?"
                    className="mt-1"
                    rows={3}
                    data-testid="input-query-text"
                  />
                </div>

                {/* Internal Comment */}
                <div>
                  <label className="text-sm font-medium">Internal Comment (staff only)</label>
                  <Textarea
                    value={newQueryComment}
                    onChange={(e) => setNewQueryComment(e.target.value)}
                    placeholder="Optional notes for staff reference..."
                    className="mt-1"
                    rows={2}
                    data-testid="input-query-comment"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddQuery} 
                  disabled={!newQueryText.trim() || createMutation.isPending}
                  data-testid="button-submit-query"
                >
                  Add Query
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters and Bulk Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="answered_by_staff">Staff Answered</SelectItem>
              <SelectItem value="sent_to_client">Sent to Client</SelectItem>
              <SelectItem value="answered_by_client">Client Answered</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>

          {selectedQueries.length > 0 && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handlePrepareEmail(selectedQueries)}
                disabled={!clientId}
                data-testid="button-send-selected"
              >
                <Send className="w-4 h-4 mr-2" />
                Send to Client ({selectedQueries.length})
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => bulkStatusMutation.mutate({ ids: selectedQueries, status: 'resolved' })}
                disabled={bulkStatusMutation.isPending}
                data-testid="button-resolve-selected"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Resolved ({selectedQueries.length})
              </Button>
            </div>
          )}
        </div>

        {/* Queries Table */}
        {filteredQueries.length === 0 ? (
          <div className="text-center py-8" data-testid="section-empty-queries">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">No queries found</p>
            <p className="text-sm text-muted-foreground">
              {filterStatus === "all" 
                ? "Add your first query to get started."
                : "No queries match the current filter."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedQueries.length === filteredQueries.length && filteredQueries.length > 0}
                        onCheckedChange={(checked) => handleSelectAll(checked === true)}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="w-24">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-28">Amount</TableHead>
                    <TableHead className="w-16 text-center">VAT</TableHead>
                    <TableHead>Query</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="text-right w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQueries.map((query) => (
                    <TableRow key={query.id} data-testid={`row-query-${query.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedQueries.includes(query.id)}
                          onCheckedChange={(checked) => handleSelectQuery(query.id, checked === true)}
                          data-testid={`checkbox-query-${query.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {query.date ? format(new Date(query.date), 'dd MMM') : '-'}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate text-sm" data-testid={`text-description-${query.id}`}>
                          {query.description || '-'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <AmountDisplay moneyIn={query.moneyIn} moneyOut={query.moneyOut} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={query.hasVat || false}
                          onCheckedChange={(checked) => toggleVatMutation.mutate({ id: query.id, hasVat: checked })}
                          disabled={toggleVatMutation.isPending}
                          data-testid={`switch-vat-${query.id}`}
                        />
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate font-medium text-sm" data-testid={`text-query-${query.id}`}>
                          {query.ourQuery}
                        </p>
                        {query.clientResponse && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            Response: {query.clientResponse}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <QueryStatusBadge status={query.status as QueryStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`button-actions-${query.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditQuery(query)}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Respond
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handlePrepareEmail([query.id])}
                              disabled={query.status === 'sent_to_client' || query.status === 'resolved' || !clientId}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Send to Client
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => bulkStatusMutation.mutate({ ids: [query.id], status: 'resolved' })}
                              disabled={query.status === 'resolved'}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark Resolved
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteMutation.mutate(query.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredQueries.map((query) => (
                <div 
                  key={query.id} 
                  className="border rounded-lg p-4"
                  data-testid={`card-query-${query.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={selectedQueries.includes(query.id)}
                        onCheckedChange={(checked) => handleSelectQuery(query.id, checked === true)}
                      />
                      <div className="min-w-0 flex-1">
                        {/* Date and Amount row */}
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-1">
                          {query.date && (
                            <span>{format(new Date(query.date), 'dd MMM yyyy')}</span>
                          )}
                          <AmountDisplay moneyIn={query.moneyIn} moneyOut={query.moneyOut} />
                        </div>
                        
                        {/* Description */}
                        {query.description && (
                          <p className="text-sm mb-1" data-testid={`text-description-mobile-${query.id}`}>
                            {query.description}
                          </p>
                        )}
                        
                        {/* Query */}
                        <p className="font-medium" data-testid={`text-query-mobile-${query.id}`}>
                          {query.ourQuery}
                        </p>
                        {query.clientResponse && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Response: {query.clientResponse}
                          </p>
                        )}
                        
                        {/* Status and VAT row */}
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <QueryStatusBadge status={query.status as QueryStatus} />
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground">VAT:</span>
                            <Switch
                              checked={query.hasVat || false}
                              onCheckedChange={(checked) => toggleVatMutation.mutate({ id: query.id, hasVat: checked })}
                              disabled={toggleVatMutation.isPending}
                              className="scale-75"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditQuery(query)}>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Respond
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handlePrepareEmail([query.id])}
                          disabled={query.status === 'sent_to_client' || query.status === 'resolved' || !clientId}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Send to Client
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => bulkStatusMutation.mutate({ ids: [query.id], status: 'resolved' })}
                          disabled={query.status === 'resolved'}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark Resolved
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteMutation.mutate(query.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Active Response Links Section */}
        {(queries?.length || 0) > 0 && (
          <div className="mt-6 pt-6 border-t">
            <button
              onClick={() => setShowActiveTokens(!showActiveTokens)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-toggle-active-links"
            >
              {showActiveTokens ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Link2 className="w-4 h-4" />
              Active Response Links
              {activeTokens && activeTokens.length > 0 && (
                <Badge variant="secondary" className="ml-1">{activeTokens.length}</Badge>
              )}
            </button>
            
            {showActiveTokens && (
              <div className="mt-4 space-y-3">
                {!activeTokens || activeTokens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active response links for this project.</p>
                ) : (
                  activeTokens.map((token) => {
                    const isExpired = new Date(token.expiresAt) < new Date();
                    const expiresIn = Math.ceil((new Date(token.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div 
                        key={token.id} 
                        className={cn(
                          "border rounded-lg p-4",
                          isExpired && "bg-destructive/5 border-destructive/20"
                        )}
                        data-testid={`token-card-${token.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">
                                {token.recipientName || token.recipientEmail}
                              </span>
                              <Badge variant={isExpired ? "destructive" : expiresIn <= 2 ? "outline" : "secondary"}>
                                <Clock className="w-3 h-3 mr-1" />
                                {isExpired 
                                  ? 'Expired' 
                                  : expiresIn === 0 
                                    ? 'Expires today'
                                    : expiresIn === 1 
                                      ? 'Expires tomorrow' 
                                      : `Expires in ${expiresIn} days`}
                              </Badge>
                              {token.accessedAt && (
                                <Badge variant="outline" className="text-green-600">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  Opened
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span>{token.queryCount} {token.queryCount === 1 ? 'query' : 'queries'}</span>
                              <span>Sent {format(new Date(token.createdAt), 'dd MMM yyyy')}</span>
                              {token.createdBy && (
                                <span>by {token.createdBy.firstName} {token.createdBy.lastName}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isExpired && !token.accessedAt && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendReminder(token.id)}
                                disabled={isPreparingReminder && reminderTokenId === token.id}
                                data-testid={`button-reminder-${token.id}`}
                              >
                                <Mail className="w-3 h-3 mr-1" />
                                {isPreparingReminder && reminderTokenId === token.id ? "..." : "Nudge"}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setExtendTokenId(token.id);
                                setExtendDays(3);
                              }}
                              data-testid={`button-extend-${token.id}`}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Extend
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Extend Token Dialog */}
      <Dialog open={!!extendTokenId} onOpenChange={(open) => !open && setExtendTokenId(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-extend-token">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Extend Link Validity
            </DialogTitle>
            <DialogDescription>
              Extend the expiry date of this response link.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Extend by</label>
            <Select 
              value={String(extendDays)} 
              onValueChange={(val) => setExtendDays(Number(val))}
            >
              <SelectTrigger className="w-full mt-1" data-testid="select-extend-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendTokenId(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => extendTokenId && extendTokenMutation.mutate({ tokenId: extendTokenId, additionalDays: extendDays })}
              disabled={extendTokenMutation.isPending}
              data-testid="button-confirm-extend"
            >
              {extendTokenMutation.isPending ? "Extending..." : "Extend Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Response Dialog - 2 Column Layout */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Query Response
            </DialogTitle>
            <DialogDescription>
              View and manage the query details, client response, and status.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[65vh] overflow-y-auto pr-2">
            {/* Left Column - Transaction Details & Query */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Transaction Details</h3>
              
              {/* Transaction Info Summary */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-auto py-1 px-2 font-medium",
                          !editQueryDate && "text-muted-foreground"
                        )}
                        data-testid="button-edit-date"
                      >
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                        {editQueryDate ? format(editQueryDate, "dd MMM yyyy") : "Set date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={editQueryDate}
                        onSelect={setEditQueryDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Description</span>
                  <span className="text-sm font-medium truncate max-w-[200px]">{editQueryDescription || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <AmountDisplay moneyIn={editQueryMoneyIn} moneyOut={editQueryMoneyOut} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">VAT</span>
                  <Switch
                    checked={editQueryHasVat}
                    onCheckedChange={setEditQueryHasVat}
                    data-testid="switch-edit-has-vat"
                  />
                </div>
              </div>

              {/* Editable fields in collapsible */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={editQueryDescription}
                    onChange={(e) => setEditQueryDescription(e.target.value)}
                    placeholder="Transaction description..."
                    className="mt-1"
                    data-testid="input-edit-query-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Money In (£)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editQueryMoneyIn}
                      onChange={(e) => {
                        setEditQueryMoneyIn(e.target.value);
                        if (e.target.value) setEditQueryMoneyOut("");
                      }}
                      placeholder="0.00"
                      className="mt-1"
                      data-testid="input-edit-money-in"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Money Out (£)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editQueryMoneyOut}
                      onChange={(e) => {
                        setEditQueryMoneyOut(e.target.value);
                        if (e.target.value) setEditQueryMoneyIn("");
                      }}
                      placeholder="0.00"
                      className="mt-1"
                      data-testid="input-edit-money-out"
                    />
                  </div>
                </div>
              </div>

              {/* Staff Query */}
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Staff Query
                </label>
                <Textarea
                  value={editQueryText}
                  onChange={(e) => setEditQueryText(e.target.value)}
                  className="mt-1"
                  rows={3}
                  data-testid="input-edit-query-text"
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={editQueryStatus} onValueChange={(val) => setEditQueryStatus(val as QueryStatus)}>
                  <SelectTrigger className="mt-1" data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="answered_by_staff">Staff Answered</SelectItem>
                    <SelectItem value="sent_to_client">Sent to Client</SelectItem>
                    <SelectItem value="answered_by_client">Client Answered</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Internal Comment */}
              <div>
                <label className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Internal Notes (staff only)
                </label>
                <Textarea
                  value={editQueryComment}
                  onChange={(e) => setEditQueryComment(e.target.value)}
                  placeholder="Private notes for staff reference..."
                  className="mt-1 border-amber-200 dark:border-amber-800"
                  rows={3}
                  data-testid="input-edit-query-comment"
                />
              </div>
            </div>

            {/* Right Column - Client Response & Attachments */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Client Response</h3>
              
              {/* Client Response */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <label className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-1.5 mb-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Client's Answer
                </label>
                <Textarea
                  value={editQueryResponse}
                  onChange={(e) => setEditQueryResponse(e.target.value)}
                  placeholder="Client's response will appear here..."
                  className="bg-white dark:bg-slate-900 border-green-200 dark:border-green-800"
                  rows={6}
                  data-testid="input-edit-query-response"
                />
              </div>

              {/* Client Attachments */}
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <Paperclip className="w-3.5 h-3.5" />
                  Client Attachments
                  {editingQuery?.clientAttachments && (editingQuery.clientAttachments as any[]).length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {(editingQuery.clientAttachments as any[]).length}
                    </Badge>
                  )}
                </label>
                {editingQuery?.clientAttachments && (editingQuery.clientAttachments as any[]).length > 0 ? (
                  <div className="space-y-2">
                    {(editingQuery.clientAttachments as any[]).map((attachment: any) => (
                      <div 
                        key={attachment.objectPath}
                        className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        {attachment.fileType?.startsWith('image/') ? (
                          <Image className="w-5 h-5 text-blue-500" />
                        ) : (
                          <FileText className="w-5 h-5 text-orange-500" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.fileSize < 1024 
                              ? `${attachment.fileSize} B` 
                              : attachment.fileSize < 1024 * 1024 
                                ? `${(attachment.fileSize / 1024).toFixed(1)} KB`
                                : `${(attachment.fileSize / (1024 * 1024)).toFixed(1)} MB`
                            }
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/object-storage/download-url?objectPath=${encodeURIComponent(attachment.objectPath)}`);
                              if (response.ok) {
                                const { url } = await response.json();
                                window.open(url, '_blank');
                              }
                            } catch (error) {
                              toast({ title: "Download failed", description: "Could not download the file.", variant: "destructive" });
                            }
                          }}
                          data-testid={`button-download-${attachment.objectPath}`}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No attachments from client</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={!editQueryText.trim() || updateMutation.isPending}
              data-testid="button-save-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Options Dialog - appears before email dialog */}
      <Dialog open={isSendOptionsOpen} onOpenChange={setIsSendOptionsOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-send-options">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Send Options
            </DialogTitle>
            <DialogDescription>
              Configure how you want to send {sendOptionsQueryIds.length} {sendOptionsQueryIds.length === 1 ? 'query' : 'queries'} to the client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Include Online Link Option */}
            <div className="flex items-start space-x-3">
              <Checkbox 
                id="include-online-link"
                checked={includeOnlineLink}
                onCheckedChange={(checked) => setIncludeOnlineLink(checked === true)}
                data-testid="checkbox-include-online-link"
              />
              <div className="grid gap-1.5">
                <label 
                  htmlFor="include-online-link" 
                  className="text-sm font-medium cursor-pointer"
                >
                  Include online completion link
                </label>
                <p className="text-sm text-muted-foreground">
                  Adds a secure link for the client to respond to queries online
                </p>
              </div>
            </div>

            {/* Link Expiry Days (only shown if online link is included) */}
            {includeOnlineLink && (
              <div className="pl-7 space-y-2">
                <label className="text-sm font-medium">Link valid for</label>
                <Select 
                  value={String(linkExpiryDays)} 
                  onValueChange={(val) => setLinkExpiryDays(Number(val))}
                >
                  <SelectTrigger className="w-full" data-testid="select-link-expiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The link will expire after this period
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendOptionsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSendOptions}
              disabled={isPreparingEmail}
              data-testid="button-confirm-send-options"
            >
              {isPreparingEmail ? "Preparing..." : "Continue to Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog for sending queries to client */}
      {clientId && (
        <EmailDialog
          clientId={clientId}
          projectId={projectId}
          clientPeople={clientPeople || []}
          user={user || null}
          isOpen={isEmailDialogOpen}
          onClose={handleEmailClose}
          onSuccess={reminderTokenId ? handleReminderSuccess : handleEmailSuccess}
          clientCompany={clientName}
          initialValues={emailInitialValues}
          queryEmailOptions={pendingEmailTokenId && pendingEmailExpiryDays ? {
            tokenId: pendingEmailTokenId,
            queryIds: pendingEmailQueryIds,
            queryCount: pendingEmailQueryIds.length,
            expiryDays: pendingEmailExpiryDays,
            expiryDate: new Date(Date.now() + pendingEmailExpiryDays * 24 * 60 * 60 * 1000).toISOString(),
          } : undefined}
          onRemindersConfigured={setConfiguredReminders}
        />
      )}

      {/* View All Responses Modal */}
      <Dialog open={isViewAllOpen} onOpenChange={setIsViewAllOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              All Query Responses
            </DialogTitle>
            <DialogDescription>
              Overview of all queries with client responses for this project.
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[70vh] space-y-4 pr-2">
            {queries?.filter(q => q.clientResponse || (q.clientAttachments && (q.clientAttachments as any[]).length > 0) || q.status === 'answered_by_client').length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No client responses yet</p>
              </div>
            ) : (
              queries?.filter(q => q.clientResponse || (q.clientAttachments && (q.clientAttachments as any[]).length > 0) || q.status === 'answered_by_client').map((query, index) => (
                <div 
                  key={query.id} 
                  className="p-4 border rounded-lg bg-white dark:bg-slate-900 space-y-3"
                >
                  {/* Query Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-muted-foreground">Query {index + 1}</span>
                        <QueryStatusBadge status={query.status as QueryStatus} />
                      </div>
                      {/* Transaction details */}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-2">
                        {query.date && (
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {format(new Date(query.date), "dd MMM yyyy")}
                          </span>
                        )}
                        {query.description && (
                          <span className="font-medium text-foreground">{query.description}</span>
                        )}
                        <AmountDisplay moneyIn={query.moneyIn} moneyOut={query.moneyOut} />
                        {query.hasVat && (
                          <Badge variant="outline" className="text-xs">VAT</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleEditQuery(query);
                        setIsViewAllOpen(false);
                      }}
                      data-testid={`button-respond-${query.id}`}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Respond
                    </Button>
                  </div>
                  
                  {/* Staff Query */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                      Staff Query
                    </span>
                    <p className="text-sm">{query.ourQuery}</p>
                  </div>
                  
                  {/* Client Response */}
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <span className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide mb-1 block">
                      Client Response
                    </span>
                    {query.clientResponse ? (
                      <p className="text-sm text-green-900 dark:text-green-100">{query.clientResponse}</p>
                    ) : (
                      <p className="text-sm text-green-700 dark:text-green-400 italic">
                        {(query.clientAttachments as any[])?.length > 0 
                          ? "Response provided via attachments below" 
                          : "No text response provided"}
                      </p>
                    )}
                    
                    {/* Client Attachments */}
                    {query.clientAttachments && (query.clientAttachments as any[]).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                          <Paperclip className="w-3 h-3" />
                          {(query.clientAttachments as any[]).length} attachment(s)
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {(query.clientAttachments as any[]).map((attachment: any) => (
                            <Button
                              key={attachment.objectPath}
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/object-storage/download-url?objectPath=${encodeURIComponent(attachment.objectPath)}`);
                                  if (response.ok) {
                                    const { url } = await response.json();
                                    window.open(url, '_blank');
                                  }
                                } catch (error) {
                                  toast({ title: "Download failed", variant: "destructive" });
                                }
                              }}
                            >
                              {attachment.fileType?.startsWith('image/') ? (
                                <Image className="w-3 h-3 mr-1" />
                              ) : (
                                <FileText className="w-3 h-3 mr-1" />
                              )}
                              {attachment.fileName}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Internal Comment (if any) */}
                  {query.comment && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1 block">
                        Internal Notes
                      </span>
                      <p className="text-sm text-amber-900 dark:text-amber-100">{query.comment}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsViewAllOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </>
  );
}
