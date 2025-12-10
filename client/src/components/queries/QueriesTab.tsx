import { useState, useMemo, useCallback, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Bell,
  AlertTriangle,
  Loader2,
  Search,
  X,
  ArrowDownUp,
  FolderPlus,
  Folder,
  FolderMinus,
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
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [amountFilter, setAmountFilter] = useState<"all" | "in" | "out">("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [activeSubTab, setActiveSubTab] = useState<"queries" | "reminders">("queries");
  
  // Debounce search term using useEffect with proper cleanup
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);
  
  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
  }, []);
  
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
  const [pendingEmailVoiceAiAvailable, setPendingEmailVoiceAiAvailable] = useState<boolean>(false);
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
  
  // Import loading state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

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
  
  // Notify Assignees dialog state
  const [isNotifyDialogOpen, setIsNotifyDialogOpen] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  
  // Group creation state
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

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

  // Query for scheduled reminders to show count in tab
  const { data: scheduledReminders } = useQuery<{ id: string; status: string }[]>({
    queryKey: ['/api/projects', projectId, 'query-reminders'],
  });
  
  const pendingReminderCount = scheduledReminders?.filter(r => r.status === 'pending').length || 0;

  // Query for project assignees (for notify functionality)
  const { data: projectAssignees, isLoading: isLoadingAssignees } = useQuery<{
    id: string;
    projectId: string;
    userId: string;
    roleId: string | null;
    user: { id: string; firstName: string | null; lastName: string | null; email: string };
    role: { id: string; name: string } | null;
  }[]>({
    queryKey: ['/api/projects', projectId, 'assignees'],
    enabled: isNotifyDialogOpen,
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

  const notifyAssigneesMutation = useMutation({
    mutationFn: async ({ userIds, message }: { userIds: string[]; message: string }) => {
      return apiRequest('POST', `/api/projects/${projectId}/queries/notify-assignees`, { userIds, message });
    },
    onSuccess: () => {
      setIsNotifyDialogOpen(false);
      setSelectedAssignees([]);
      toast({ 
        title: "Notifications sent", 
        description: "Project assignees have been notified about the query status." 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send notifications.", variant: "destructive" });
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

  // Create query group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (data: { groupName: string; description?: string; queryIds: string[] }) => {
      return apiRequest('POST', `/api/projects/${projectId}/query-groups`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'query-groups'] });
      setSelectedQueries([]);
      setIsGroupDialogOpen(false);
      setGroupName("");
      setGroupDescription("");
      toast({ 
        title: "Group created", 
        description: `"${variables.groupName}" created with ${variables.queryIds.length} queries.` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create group.", variant: "destructive" });
    },
  });

  // Remove query from group mutation
  const removeFromGroupMutation = useMutation({
    mutationFn: async ({ groupId, queryId }: { groupId: string; queryId: string }) => {
      return apiRequest('DELETE', `/api/query-groups/${groupId}/queries`, { queryIds: [queryId] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'query-groups'] });
      toast({ 
        title: "Removed from group", 
        description: "Query has been removed from its group." 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove query from group.", variant: "destructive" });
    },
  });

  // Handle group creation dialog opening
  const handleOpenGroupDialog = () => {
    if (selectedQueries.length === 0) return;
    
    // Try to auto-suggest a group name based on common description prefix
    const selectedQueryData = queries?.filter(q => selectedQueries.includes(q.id)) || [];
    const descriptions = selectedQueryData.map(q => q.description?.toLowerCase() || "").filter(Boolean);
    
    if (descriptions.length > 1) {
      // Find common prefix
      let commonPrefix = descriptions[0];
      for (let i = 1; i < descriptions.length; i++) {
        while (descriptions[i].indexOf(commonPrefix) !== 0 && commonPrefix.length > 0) {
          commonPrefix = commonPrefix.slice(0, -1);
        }
      }
      // Clean up and capitalize
      if (commonPrefix.length >= 4) {
        const words = commonPrefix.trim().split(' ').filter(w => w.length > 0);
        const suggestedName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        setGroupName(suggestedName);
      }
    }
    
    setIsGroupDialogOpen(true);
  };

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedQueries.length === 0) return;
    createGroupMutation.mutate({
      groupName: groupName.trim(),
      description: groupDescription.trim() || undefined,
      queryIds: selectedQueries,
    });
  };

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
    setIsImporting(true);
    setImportProgress({ current: 0, total: parsedQueries.length });
    
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (let i = 0; i < parsedQueries.length; i++) {
        const query = parsedQueries[i];
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
        setImportProgress({ current: i + 1, total: parsedQueries.length });
      }
      
      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/queries/counts'] });
      
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
    } finally {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0 });
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
      
      // Store the token ID, query IDs, expiry days, and voice AI availability for after email is sent
      setPendingEmailTokenId(includeOnlineLink ? response.tokenId : null);
      setPendingEmailQueryIds(sendOptionsQueryIds);
      setPendingEmailExpiryDays(includeOnlineLink ? linkExpiryDays : null);
      setPendingEmailVoiceAiAvailable(response.voiceAiAvailable ?? false);
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

  // Get unique groups from queries for the filter dropdown
  const uniqueGroups = useMemo(() => {
    const groups: { id: string; name: string }[] = [];
    const seenIds = new Set<string>();
    
    (queries || []).forEach(q => {
      if (q.group && q.group.id && !seenIds.has(q.group.id)) {
        seenIds.add(q.group.id);
        groups.push({ id: q.group.id, name: q.group.groupName });
      }
    });
    
    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }, [queries]);

  const filteredQueries = useMemo(() => {
    let result = queries || [];
    
    // Status filter
    if (filterStatus !== "all") {
      result = result.filter(q => q.status === filterStatus);
    }
    
    // Description search (case-insensitive)
    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase();
      result = result.filter(q => 
        q.description?.toLowerCase().includes(term) ||
        q.ourQuery?.toLowerCase().includes(term)
      );
    }
    
    // Amount filter (money in/out)
    if (amountFilter === "in") {
      result = result.filter(q => q.moneyIn && parseFloat(q.moneyIn) > 0);
    } else if (amountFilter === "out") {
      result = result.filter(q => q.moneyOut && parseFloat(q.moneyOut) > 0);
    }
    
    // Group filter
    if (groupFilter === "ungrouped") {
      result = result.filter(q => !q.groupId);
    } else if (groupFilter !== "all") {
      result = result.filter(q => q.groupId === groupFilter);
    }
    
    return result;
  }, [queries, filterStatus, debouncedSearchTerm, amountFilter, groupFilter]);
  
  // Check if any filters are active
  const hasActiveFilters = filterStatus !== "all" || debouncedSearchTerm.trim() !== "" || amountFilter !== "all" || groupFilter !== "all";
  
  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilterStatus("all");
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setAmountFilter("all");
    setGroupFilter("all");
  }, []);

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
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as "queries" | "reminders")} className="w-full flex flex-col flex-1 min-h-0">
        <Card className="relative flex flex-col flex-1 min-h-0">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  Bookkeeping Queries
                </CardTitle>
              </div>
              
              {/* Sub-tab navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="queries" className="gap-1.5" data-testid="tab-queries">
                    <HelpCircle className="w-4 h-4" />
                    Queries
                    {stats && (stats.open + stats.sentToClient) > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {stats.open + stats.sentToClient}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="reminders" className="gap-1.5" data-testid="tab-scheduled-reminders">
                    <Bell className="w-4 h-4" />
                    Scheduled Reminders
                    {pendingReminderCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {pendingReminderCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                {/* Actions - only show when on queries tab */}
                {activeSubTab === "queries" && (
                  <div className="flex items-center gap-2">
            {/* View All Responses button - show when there are any client responses (text or attachments) */}
            {queries && queries.some(q => q.clientResponse || (q.clientAttachments && (q.clientAttachments as any[]).length > 0) || q.status === 'answered_by_client') && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setIsViewAllOpen(true)}
                data-testid="button-view-all-responses"
              >
                <Eye className="w-4 h-4 mr-2" />
                View All
              </Button>
            )}
            {/* Notify Assignees button - always visible */}
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setIsNotifyDialogOpen(true)}
              data-testid="button-notify-assignees"
            >
              <Users className="w-4 h-4 mr-2" />
              Notify
            </Button>
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
                )}
              </div>
            </div>
          </CardHeader>
          
          {/* Loading Overlay - shows during import or email preparation */}
          {(isImporting || isPreparingEmail || isPreparingReminder) && (
            <div 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg"
              data-testid="loading-overlay"
            >
              <div className="flex flex-col items-center gap-3 p-6 bg-card rounded-lg shadow-lg border">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  {isImporting && (
                    <>
                      <p className="font-medium text-foreground">Importing queries...</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {importProgress.current} of {importProgress.total} complete
                      </p>
                    </>
                  )}
                  {isPreparingEmail && (
                    <>
                      <p className="font-medium text-foreground">Preparing email...</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Setting up your message
                      </p>
                    </>
                  )}
                  {isPreparingReminder && (
                    <>
                      <p className="font-medium text-foreground">Preparing reminder...</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Loading reminder details
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
            
          {/* Queries Tab Content */}
          <TabsContent value="queries" className="mt-0 flex-1 min-h-0 overflow-hidden">
            <CardContent className="pt-0 h-full overflow-y-auto">
        {/* Filters and Bulk Actions */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-filter-status">
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
            
            {/* Amount Filter */}
            <Select value={amountFilter} onValueChange={(v) => setAmountFilter(v as "all" | "in" | "out")}>
              <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-filter-amount">
                <ArrowDownUp className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Amount" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Amounts</SelectItem>
                <SelectItem value="in">
                  <span className="flex items-center gap-2">
                    <ArrowDownLeft className="w-3 h-3 text-green-600" />
                    Money In
                  </span>
                </SelectItem>
                <SelectItem value="out">
                  <span className="flex items-center gap-2">
                    <ArrowUpRight className="w-3 h-3 text-red-600" />
                    Money Out
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {/* Group Filter */}
            {uniqueGroups.length > 0 && (
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-filter-group">
                  <Folder className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  <SelectItem value="ungrouped">Ungrouped</SelectItem>
                  {uniqueGroups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search descriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-9"
                data-testid="input-search-queries"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={clearSearch}
                  data-testid="button-clear-search"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Filter Results Summary */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Showing {filteredQueries.length} of {queries?.length || 0} queries
                {debouncedSearchTerm && (
                  <span className="ml-1">
                    matching "<span className="font-medium">{debouncedSearchTerm}</span>"
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={clearAllFilters}
                data-testid="button-clear-all-filters"
              >
                Clear all filters
              </Button>
            </div>
          )}
          
          {/* Bulk Actions */}
          {selectedQueries.length > 0 && (
            <div className="flex gap-2 items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handlePrepareEmail(selectedQueries)}
                        disabled={!clientId || pendingReminderCount > 0}
                        data-testid="button-send-selected"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send to Client ({selectedQueries.length})
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {pendingReminderCount > 0 && (
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p>You have {pendingReminderCount} scheduled reminder{pendingReminderCount !== 1 ? 's' : ''} pending. Cancel reminders first to send a fresh email.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
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
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleOpenGroupDialog}
                disabled={createGroupMutation.isPending}
                data-testid="button-group-selected"
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                Group Selected ({selectedQueries.length})
              </Button>
            </div>
          )}
        </div>

        {/* Pending Reminders Warning */}
        {pendingReminderCount > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 mb-4 flex items-start gap-3" data-testid="alert-reminders-pending">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {pendingReminderCount} scheduled reminder{pendingReminderCount !== 1 ? 's' : ''} pending
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                Cancel existing reminders in the Scheduled Reminders tab before sending a fresh query email.
              </p>
            </div>
          </div>
        )}

        {/* Queries Table */}
        {filteredQueries.length === 0 ? (
          <div className="text-center py-8" data-testid="section-empty-queries">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-2">No queries found</p>
            <p className="text-sm text-muted-foreground mb-4">
              {hasActiveFilters 
                ? "No queries match your current filters."
                : "Add your first query to get started."}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                data-testid="button-clear-filters-empty"
              >
                Clear all filters
              </Button>
            )}
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
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm flex-1" data-testid={`text-description-${query.id}`}>
                            {query.description || '-'}
                          </p>
                          {query.group && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs flex-shrink-0 gap-1 cursor-default"
                                    data-testid={`badge-group-${query.id}`}
                                  >
                                    <Folder className="w-3 h-3" />
                                    {query.group.groupName}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Grouped: {query.group.groupName}</p>
                                  {query.group.description && (
                                    <p className="text-muted-foreground">{query.group.description}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
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
                              disabled={query.status === 'sent_to_client' || query.status === 'resolved' || !clientId || pendingReminderCount > 0}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              {pendingReminderCount > 0 ? 'Reminders pending' : 'Send to Client'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => bulkStatusMutation.mutate({ ids: [query.id], status: 'resolved' })}
                              disabled={query.status === 'resolved'}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark Resolved
                            </DropdownMenuItem>
                            {query.group && (
                              <DropdownMenuItem 
                                onClick={() => removeFromGroupMutation.mutate({ groupId: query.group!.id, queryId: query.id })}
                                disabled={removeFromGroupMutation.isPending}
                              >
                                <FolderMinus className="w-4 h-4 mr-2" />
                                Remove from Group
                              </DropdownMenuItem>
                            )}
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
                        
                        {/* Status, Group and VAT row */}
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <QueryStatusBadge status={query.status as QueryStatus} />
                          {query.group && (
                            <Badge 
                              variant="outline" 
                              className="text-xs gap-1"
                              data-testid={`badge-group-mobile-${query.id}`}
                            >
                              <Folder className="w-3 h-3" />
                              {query.group.groupName}
                            </Badge>
                          )}
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
                          disabled={query.status === 'sent_to_client' || query.status === 'resolved' || !clientId || pendingReminderCount > 0}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          {pendingReminderCount > 0 ? 'Reminders pending' : 'Send to Client'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => bulkStatusMutation.mutate({ ids: [query.id], status: 'resolved' })}
                          disabled={query.status === 'resolved'}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark Resolved
                        </DropdownMenuItem>
                        {query.group && (
                          <DropdownMenuItem 
                            onClick={() => removeFromGroupMutation.mutate({ groupId: query.group!.id, queryId: query.id })}
                            disabled={removeFromGroupMutation.isPending}
                          >
                            <FolderMinus className="w-4 h-4 mr-2" />
                            Remove from Group
                          </DropdownMenuItem>
                        )}
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
              </TabsContent>
              
          {/* Scheduled Reminders Tab Content */}
          <TabsContent value="reminders" className="mt-0 flex-1 min-h-0 overflow-hidden">
            <CardContent className="pt-0 h-full overflow-y-auto">
              <ScheduledRemindersPanel projectId={projectId} />
            </CardContent>
          </TabsContent>
        </Card>
      </Tabs>

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
            voiceAiAvailable: pendingEmailVoiceAiAvailable,
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
                        {query.group && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Folder className="w-3 h-3" />
                            {query.group.groupName}
                          </Badge>
                        )}
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

      {/* Notify Assignees Dialog */}
      <Dialog open={isNotifyDialogOpen} onOpenChange={(open) => {
        setIsNotifyDialogOpen(open);
        if (!open) setSelectedAssignees([]);
      }}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-notify-assignees">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Notify Project Assignees
            </DialogTitle>
            <DialogDescription>
              Send a push notification and email to project assignees about the current query status.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Query Summary */}
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="text-sm font-medium mb-2">Query Status Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Open:</span>
                  <span className="font-medium">{stats?.open || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent to Client:</span>
                  <span className="font-medium">{stats?.sentToClient || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Awaiting Review:</span>
                  <span className="font-medium">{stats?.answeredByClient || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolved:</span>
                  <span className="font-medium">{stats?.resolved || 0}</span>
                </div>
              </div>
            </div>

            {/* Assignee Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Select Assignees to Notify</label>
              {isLoadingAssignees ? (
                <div className="space-y-2 border rounded-lg p-2" data-testid="assignees-loading">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : projectAssignees && projectAssignees.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                  {projectAssignees.map((assignee) => (
                    <div 
                      key={assignee.userId}
                      className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                      onClick={() => {
                        setSelectedAssignees(prev => 
                          prev.includes(assignee.userId)
                            ? prev.filter(id => id !== assignee.userId)
                            : [...prev, assignee.userId]
                        );
                      }}
                      data-testid={`assignee-row-${assignee.userId}`}
                    >
                      <Checkbox 
                        checked={selectedAssignees.includes(assignee.userId)}
                        data-testid={`checkbox-assignee-${assignee.userId}`}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {assignee.user.firstName} {assignee.user.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{assignee.user.email}</span>
                          {assignee.role && (
                            <Badge variant="outline" className="text-xs">
                              {assignee.role.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg" data-testid="no-assignees-found">
                  No project assignees found
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNotifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                const message = `Query status update${clientName ? ` for ${clientName}` : ''}: ${stats?.open || 0} open, ${stats?.answeredByClient || 0} awaiting review, ${stats?.resolved || 0} resolved.`;
                notifyAssigneesMutation.mutate({ userIds: selectedAssignees, message });
              }}
              disabled={selectedAssignees.length === 0 || notifyAssigneesMutation.isPending}
              data-testid="button-send-notifications"
            >
              {notifyAssigneesMutation.isPending ? "Sending..." : `Notify ${selectedAssignees.length > 0 ? `(${selectedAssignees.length})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={isGroupDialogOpen} onOpenChange={(open) => {
        setIsGroupDialogOpen(open);
        if (!open) {
          setGroupName("");
          setGroupDescription("");
        }
      }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-create-group">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5" />
              Create Query Group
            </DialogTitle>
            <DialogDescription>
              Group {selectedQueries.length} selected queries together. Grouped queries will be shown as a single item to clients.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label htmlFor="groupName" className="text-sm font-medium">
                Group Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="groupName"
                placeholder="e.g., Barclays Bank, Amazon Purchases"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                data-testid="input-group-name"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="groupDescription" className="text-sm font-medium">
                Description <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="groupDescription"
                placeholder="Brief description of this group"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                data-testid="input-group-description"
              />
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{selectedQueries.length}</span> queries will be added to this group
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || createGroupMutation.isPending}
              data-testid="button-create-group"
            >
              {createGroupMutation.isPending ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
