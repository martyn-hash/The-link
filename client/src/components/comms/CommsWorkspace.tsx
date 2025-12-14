import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Inbox, RefreshCw, MessageSquare, Paperclip, ChevronRight, AlertCircle, Clock, User, Loader2, Search, CheckCircle, Link2, X } from "lucide-react";
import { formatDistanceToNow, format, isPast, isToday, differenceInHours } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type WorkflowFilter } from "./WorkflowToolbar";

interface InboxAccess {
  id: string;
  inboxId: string;
  userId: string;
  accessLevel: "read" | "write" | "full";
  grantedAt: string;
  inbox: {
    id: string;
    email: string;
    displayName: string | null;
    inboxType: string;
  };
}

interface StoredEmail {
  id: string;
  inboxId: string;
  microsoftId: string;
  conversationId: string | null;
  fromAddress: string;
  fromName: string | null;
  toRecipients: Array<{ address: string; name?: string }> | null;
  ccRecipients: Array<{ address: string; name?: string }> | null;
  subject: string | null;
  bodyPreview: string | null;
  bodyHtml: string | null;
  receivedAt: string;
  hasAttachments: boolean | null;
  importance: string | null;
  matchedClientId: string | null;
  slaDeadline: string | null;
  repliedAt: string | null;
  status: "pending_reply" | "replied" | "no_action_needed" | "overdue";
  isRead: boolean | null;
  isArchived: boolean | null;
  syncedAt: string | null;
  createdAt: string | null;
  matchedClient?: {
    id: string;
    name: string;
    companyName?: string;
  };
  workflowState?: {
    state: string;
    completedAt: string | null;
    linkedTaskId: string | null;
    taskRequirementMet: boolean | null;
    requiresTask: boolean | null;
    requiresReply: boolean | null;
    replySent: boolean | null;
  };
}

interface StoredEmailsResponse {
  emails: StoredEmail[];
  stats: {
    total: number;
    pending: number;
    overdue: number;
    dueToday: number;
    replied: number;
  };
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface EmailDetail {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  toRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  receivedDateTime: string;
  sentDateTime?: string;
  body: {
    contentType: string;
    content: string;
  };
  bodyPreview: string;
  hasAttachments: boolean;
  isRead: boolean;
  importance: string;
  conversationId?: string;
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    contentType: string;
    isInline?: boolean;
  }>;
}

interface CommsWorkspaceProps {
  selectedInboxId?: string;
  setSelectedInboxId?: (id: string) => void;
  selectedMessageId?: string | null;
  setSelectedMessageId?: (id: string | null) => void;
  activeFilter?: WorkflowFilter;
  setActiveFilter?: (filter: WorkflowFilter) => void;
}

export function CommsWorkspace({
  selectedInboxId: propSelectedInboxId,
  setSelectedInboxId: propSetSelectedInboxId,
  selectedMessageId: propSelectedMessageId,
  setSelectedMessageId: propSetSelectedMessageId,
  activeFilter: propActiveFilter,
  setActiveFilter: propSetActiveFilter,
}: CommsWorkspaceProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Internal state as fallback when props not provided
  const [internalSelectedInboxId, setInternalSelectedInboxId] = useState<string>("");
  const [internalSelectedMessageId, setInternalSelectedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [internalActiveFilter, setInternalActiveFilter] = useState<WorkflowFilter>(null);
  
  // Track emails that are being completed (optimistic UI)
  const [pendingCompletions, setPendingCompletions] = useState<Set<string>>(new Set());
  
  // Local filter: show completed emails
  const [showCompleted, setShowCompleted] = useState<boolean>(false);
  
  // Clear showCompleted when a header filter is selected
  useEffect(() => {
    if (activeFilter) {
      setShowCompleted(false);
    }
  }, [activeFilter]);
  
  // Use props if provided, otherwise use internal state
  const selectedInboxId = propSelectedInboxId ?? internalSelectedInboxId;
  const setSelectedInboxId = propSetSelectedInboxId ?? setInternalSelectedInboxId;
  const selectedMessageId = propSelectedMessageId ?? internalSelectedMessageId;
  const setSelectedMessageId = propSetSelectedMessageId ?? setInternalSelectedMessageId;
  const activeFilter = propActiveFilter ?? internalActiveFilter;
  const setActiveFilter = propSetActiveFilter ?? setInternalActiveFilter;

  const { data: myInboxes = [], isLoading: inboxesLoading } = useQuery<InboxAccess[]>({
    queryKey: ["/api/my-inboxes"],
    enabled: !!user,
  });

  const selectedInbox = useMemo(() => {
    if (!selectedInboxId) return null;
    return myInboxes.find(ia => ia.inboxId === selectedInboxId)?.inbox;
  }, [selectedInboxId, myInboxes]);

  // Fetch stored emails from database (with SLA tracking) - defaults to last 7 days
  const { 
    data: emailData, 
    isLoading: emailsLoading,
    error: emailsError,
    refetch: refetchEmails 
  } = useQuery<StoredEmailsResponse>({
    queryKey: ["/api/comms/inbox", selectedInboxId, "stored-emails", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "50",
        sinceDays: "7",
      });
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      const res = await fetch(`/api/comms/inbox/${selectedInboxId}/stored-emails?${params}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to fetch emails");
      }
      return res.json();
    },
    enabled: !!selectedInboxId && selectedInboxId !== "",
    staleTime: 5 * 60 * 1000,
  });

  // Fetch filtered workflow emails when a filter is active (or showing completed)
  const effectiveFilter = showCompleted ? "completed" : activeFilter;
  const { data: workflowEmails, isLoading: workflowLoading } = useQuery<{ emails: StoredEmail[] }>({
    queryKey: ["/api/comms/inbox", selectedInboxId, "workflow-emails", effectiveFilter],
    queryFn: async () => {
      const res = await fetch(`/api/comms/inbox/${selectedInboxId}/workflow-emails?filter=${effectiveFilter}`);
      if (!res.ok) throw new Error("Failed to fetch workflow emails");
      return res.json();
    },
    enabled: !!selectedInboxId && selectedInboxId !== "" && !!effectiveFilter,
  });

  // Use filtered emails when filter is active (including completed), otherwise use regular emails
  const displayEmails = effectiveFilter && workflowEmails?.emails 
    ? workflowEmails.emails 
    : emailData?.emails;

  // Sync mutation to fetch new emails from Microsoft Graph
  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/comms/inbox/${selectedInboxId}/sync`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/comms/inbox" && 
          query.queryKey[1] === selectedInboxId && 
          query.queryKey[2] === "stored-emails"
      });
      toast({
        title: "Emails synced",
        description: `${data.newEmails || 0} new emails synced, ${data.matchedCount || 0} matched to clients.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: error.message || "Failed to sync emails from server.",
      });
    },
  });

  // Complete email mutation - marks an email as done/actioned
  const completeEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      // Add to pending completions for optimistic UI
      setPendingCompletions(prev => new Set(prev).add(emailId));
      return await apiRequest("POST", `/api/comms/inbox-emails/${emailId}/complete`);
    },
    onSuccess: (_data, emailId) => {
      // Invalidate both regular and workflow email queries
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/comms/inbox" && 
          query.queryKey[1] === selectedInboxId
      });
      toast({
        title: "Email completed",
        description: "Email has been marked as done and removed from your list.",
      });
      // Remove from pending after successful completion
      setPendingCompletions(prev => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    },
    onError: (error: Error, emailId) => {
      toast({
        variant: "destructive",
        title: "Failed to complete email",
        description: error.message || "Could not mark email as complete.",
      });
      // Remove from pending on error
      setPendingCompletions(prev => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    },
  });

  // Fetch email detail from Graph API (for full content)
  const { 
    data: selectedEmail, 
    isLoading: emailDetailLoading 
  } = useQuery<EmailDetail>({
    queryKey: ["/api/comms/inbox", selectedInboxId, "messages", selectedMessageId],
    queryFn: async () => {
      const res = await fetch(`/api/comms/inbox/${selectedInboxId}/messages/${selectedMessageId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to fetch email");
      }
      return res.json();
    },
    enabled: !!selectedInboxId && !!selectedMessageId,
  });

  // Get the stored email for the selected message (to access workflowState)
  const selectedStoredEmail = useMemo(() => {
    if (!selectedMessageId || !displayEmails) return null;
    return displayEmails.find(e => e.microsoftId === selectedMessageId);
  }, [selectedMessageId, displayEmails]);

  // Fetch email classification for the selected email
  const { data: emailClassification } = useQuery<{ classification: { requiresTask: boolean; requiresReply: boolean } | null }>({
    queryKey: ["/api/comms/emails", selectedStoredEmail?.id, "classification"],
    queryFn: async () => {
      const res = await fetch(`/api/comms/emails/${selectedStoredEmail?.id}/classification`);
      if (!res.ok) throw new Error("Failed to fetch classification");
      return res.json();
    },
    enabled: !!selectedStoredEmail?.id,
  });

  // Fetch user's tasks (projects) for linking dropdown
  interface Task {
    id: string;
    name: string;
    currentStatus: string;
    completionStatus: boolean;
    clientId: string | null;
    clientName?: string;
  }
  const { data: tasksData } = useQuery<Task[]>({
    queryKey: ["/api/projects"],
    enabled: !!selectedStoredEmail && (emailClassification?.classification?.requiresTask || selectedStoredEmail?.workflowState?.requiresTask),
  });

  // Filter tasks to show incomplete ones, prioritize same client if email matched
  const availableTasks = useMemo(() => {
    if (!tasksData) return [];
    const incompleteTasks = tasksData.filter(t => t.currentStatus !== 'completed' && !t.completionStatus);
    if (selectedStoredEmail?.matchedClientId) {
      // Sort client tasks first
      return [...incompleteTasks].sort((a, b) => {
        const aMatch = a.clientId === selectedStoredEmail.matchedClientId ? 1 : 0;
        const bMatch = b.clientId === selectedStoredEmail.matchedClientId ? 1 : 0;
        return bMatch - aMatch;
      });
    }
    return incompleteTasks;
  }, [tasksData, selectedStoredEmail?.matchedClientId]);

  // Link task mutation
  const linkTaskMutation = useMutation({
    mutationFn: async ({ emailId, taskId }: { emailId: string; taskId: string | null }) => {
      return await apiRequest("PATCH", `/api/comms/inbox-emails/${emailId}/link-task`, { taskId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/comms/inbox" && 
          query.queryKey[1] === selectedInboxId
      });
      toast({
        title: "Task linked",
        description: "Email has been linked to the selected task.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to link task",
        description: error.message || "Could not link task to email.",
      });
    },
  });

  const handleRefresh = async () => {
    if (selectedInboxId) {
      await syncMutation.mutateAsync();
    }
  };

  const getSlaStatusBadge = (email: StoredEmail) => {
    if (email.status === "replied") {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Replied</Badge>;
    }
    if (email.status === "no_action_needed") {
      return null;
    }
    if (!email.slaDeadline) {
      return null;
    }
    
    const deadline = new Date(email.slaDeadline);
    const now = new Date();
    
    if (isPast(deadline)) {
      return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    }
    
    if (isToday(deadline)) {
      const hoursLeft = differenceInHours(deadline, now);
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          Due in {hoursLeft}h
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
        <Clock className="h-3 w-3 mr-1" />
        {format(deadline, "MMM d")}
      </Badge>
    );
  };

  if (inboxesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading inboxes...</p>
        </div>
      </div>
    );
  }

  if (myInboxes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            No Inbox Access
          </CardTitle>
          <CardDescription>
            You don't have access to any email inboxes yet. Contact your administrator to request access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Mail className="h-12 w-12 opacity-50" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden">
      {/* Left Column: Email List */}
      <div className="lg:col-span-1 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-3 shrink-0">
            {/* Inbox Selector */}
            {myInboxes.length > 0 && (
              <div className="mb-2">
                <Select value={selectedInboxId} onValueChange={(id) => {
                  setSelectedInboxId(id);
                  setSelectedMessageId(null);
                }}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-comms-inbox">
                    <div className="flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-primary flex-shrink-0" />
                      <SelectValue placeholder="Select inbox..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {myInboxes.map((access) => (
                      <SelectItem key={access.inboxId} value={access.inboxId}>
                        <div className="flex items-center gap-2">
                          <span>{access.inbox.displayName || access.inbox.email}</span>
                          <Badge variant="outline" className="text-xs">
                            {access.accessLevel}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {selectedInbox ? `${selectedInbox.displayName || selectedInbox.email}` : "Emails"}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh}
                disabled={!selectedInboxId || syncMutation.isPending}
                data-testid="button-sync-emails"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <CardDescription className="flex-1">
                {selectedInbox 
                  ? showCompleted
                    ? `${displayEmails?.length || 0} completed emails`
                    : activeFilter
                      ? `${displayEmails?.length || 0} filtered emails`
                      : `${emailData?.emails?.length || 0} emails (last 7 days)`
                  : "Select an inbox above"}
              </CardDescription>
              {selectedInbox && emailData?.stats && (
                <div className="flex items-center gap-1 text-xs">
                  {emailData.stats.overdue > 0 && (
                    <Badge variant="destructive" className="text-xs">{emailData.stats.overdue} overdue</Badge>
                  )}
                  {emailData.stats.dueToday > 0 && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                      {emailData.stats.dueToday} due today
                    </Badge>
                  )}
                </div>
              )}
            </div>
            {selectedInboxId && (
              <div className="space-y-2 pt-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search emails..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                    data-testid="input-email-search"
                  />
                </div>
                <Button
                  variant={showCompleted ? "default" : "outline"}
                  size="sm"
                  className="w-full gap-2 h-8"
                  onClick={() => {
                    setShowCompleted(!showCompleted);
                    if (!showCompleted) {
                      setActiveFilter(null);
                    }
                  }}
                  data-testid="button-show-completed"
                >
                  <CheckCircle className="h-4 w-4" />
                  {showCompleted ? "Showing Completed" : "Show Completed"}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0 flex flex-col" style={{ overflowY: 'auto' }}>
            {!selectedInboxId ? (
              <div className="flex items-center justify-center flex-1 text-muted-foreground h-full">
                <div className="text-center p-4">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Select an inbox from the dropdown</p>
                </div>
              </div>
            ) : emailsLoading || (activeFilter && workflowLoading) ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : emailsError ? (
              <div className="flex items-center justify-center h-full text-muted-foreground p-4">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-70" />
                  <p className="text-sm text-destructive font-medium">Unable to load emails</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    {(emailsError as Error).message.includes("not configured") 
                      ? "Email integration is not set up."
                      : (emailsError as Error).message.includes("not enabled")
                      ? "Email features are disabled."
                      : "Connection error. Please try again."}
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => refetchEmails()}>
                    Try Again
                  </Button>
                </div>
              </div>
            ) : displayEmails && displayEmails.length > 0 ? (
              <ScrollArea className="flex-1 min-h-0">
                <div className="divide-y">
                  {displayEmails.map((email) => (
                    <div
                      key={email.id}
                      className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedMessageId === email.microsoftId ? "bg-primary/10 border-l-2 border-l-primary" : ""
                      } ${!email.isRead ? "bg-primary/5" : ""}`}
                      onClick={() => setSelectedMessageId(email.microsoftId)}
                      data-testid={`email-item-${email.id}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Checkbox
                          className="shrink-0 h-4 w-4"
                          checked={email.workflowState?.state === "complete" || pendingCompletions.has(email.id)}
                          onCheckedChange={(checked) => {
                            const isPending = pendingCompletions.has(email.id);
                            const isComplete = email.workflowState?.state === "complete";
                            if (checked && !isComplete && !isPending && selectedInboxId) {
                              completeEmailMutation.mutate(email.id);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={email.workflowState?.state === "complete" || pendingCompletions.has(email.id)}
                          data-testid={`checkbox-complete-email-${email.id}`}
                        />
                        <span className={`text-sm truncate flex-1 ${!email.isRead ? "font-semibold" : ""}`}>
                          {email.fromName || email.fromAddress}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm truncate flex-1 ${!email.isRead ? "font-medium" : "text-muted-foreground"}`}>
                          {email.subject || "(No subject)"}
                        </p>
                        {email.hasAttachments && (
                          <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        {email.importance === "high" && (
                          <Badge variant="destructive" className="text-xs shrink-0 px-1">!</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground truncate flex-1">
                          {email.bodyPreview}
                        </p>
                        {getSlaStatusBadge(email)}
                      </div>
                      {email.matchedClient && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {email.matchedClient.name}
                            {email.matchedClient.companyName && ` - ${email.matchedClient.companyName}`}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center p-4">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No client emails found</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    Click the sync button to fetch new emails
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Email Detail (full width) */}
      <div className="lg:col-span-2 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {selectedEmail ? "Email Detail" : "Email Content"}
              </CardTitle>
              {selectedEmail && (
                <Badge variant="outline" className="text-xs">
                  {format(new Date(selectedEmail.receivedDateTime), "PP")}
                </Badge>
              )}
            </div>
            <CardDescription>
              {selectedEmail 
                ? format(new Date(selectedEmail.receivedDateTime), "PPpp")
                : "Select an email to view its content"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 p-0 flex flex-col" style={{ overflowY: 'auto' }}>
            {emailDetailLoading ? (
              <div className="space-y-3 p-4 flex-1">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : selectedEmail ? (
              <div className="space-y-4 p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-semibold text-lg leading-tight">{selectedEmail.subject || "(No subject)"}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      {(() => {
                        const storedEmail = emailData?.emails?.find(e => e.microsoftId === selectedMessageId);
                        return storedEmail ? getSlaStatusBadge(storedEmail) : null;
                      })()}
                      {selectedEmail.importance === "high" && (
                        <Badge variant="destructive">High Priority</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm space-y-1 bg-muted/30 rounded-lg p-3">
                    <p>
                      <span className="text-muted-foreground font-medium">From:</span>{" "}
                      {selectedEmail.from.emailAddress.name || selectedEmail.from.emailAddress.address}
                      {selectedEmail.from.emailAddress.name && (
                        <span className="text-muted-foreground ml-1">
                          &lt;{selectedEmail.from.emailAddress.address}&gt;
                        </span>
                      )}
                    </p>
                    {selectedEmail.toRecipients && selectedEmail.toRecipients.length > 0 && (
                      <p>
                        <span className="text-muted-foreground font-medium">To:</span>{" "}
                        {selectedEmail.toRecipients.map(r => r.emailAddress.name || r.emailAddress.address).join(", ")}
                      </p>
                    )}
                    {selectedEmail.ccRecipients && selectedEmail.ccRecipients.length > 0 && (
                      <p>
                        <span className="text-muted-foreground font-medium">CC:</span>{" "}
                        {selectedEmail.ccRecipients.map(r => r.emailAddress.name || r.emailAddress.address).join(", ")}
                      </p>
                    )}
                  </div>
                  {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.attachments.filter(a => !a.isInline).map(attachment => (
                        <Badge key={attachment.id} variant="secondary" className="flex items-center gap-1">
                          <Paperclip className="h-3 w-3" />
                          {attachment.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t pt-4">
                  {selectedEmail.body.contentType === "html" ? (
                    <div 
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.body.content }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm font-sans">
                      {selectedEmail.body.content}
                    </pre>
                  )}
                </div>

                {/* Task Linking Section - Stage 6 */}
                {selectedStoredEmail && (emailClassification?.classification?.requiresTask || selectedStoredEmail.workflowState?.requiresTask) && (
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Link2 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Linked Task</span>
                      {selectedStoredEmail.workflowState?.taskRequirementMet && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Task Complete
                        </Badge>
                      )}
                    </div>
                    
                    {selectedStoredEmail.workflowState?.linkedTaskId ? (
                      <div className="flex items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <CheckCircle className={`h-4 w-4 shrink-0 ${selectedStoredEmail.workflowState.taskRequirementMet ? 'text-green-600' : 'text-muted-foreground'}`} />
                          <span className="text-sm truncate">
                            {tasksData?.find(t => t.id === selectedStoredEmail.workflowState?.linkedTaskId)?.name || 'Linked Task'}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => linkTaskMutation.mutate({ emailId: selectedStoredEmail.id, taskId: null })}
                          disabled={linkTaskMutation.isPending}
                          data-testid="button-unlink-task"
                        >
                          {linkTaskMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Select
                          value=""
                          onValueChange={(taskId) => {
                            if (taskId && selectedStoredEmail) {
                              linkTaskMutation.mutate({ emailId: selectedStoredEmail.id, taskId });
                            }
                          }}
                          disabled={linkTaskMutation.isPending}
                        >
                          <SelectTrigger className="h-9 text-sm" data-testid="select-link-task">
                            <SelectValue placeholder="Select a task to link..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTasks.length > 0 ? (
                              availableTasks.slice(0, 20).map((task) => (
                                <SelectItem key={task.id} value={task.id}>
                                  <div className="flex items-center gap-2">
                                    <span className="truncate">{task.name}</span>
                                    {task.clientId === selectedStoredEmail.matchedClientId && (
                                      <Badge variant="outline" className="text-xs shrink-0">Same Client</Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))
                            ) : (
                              <div className="p-2 text-sm text-muted-foreground text-center">
                                No available tasks
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Link this email to a task. The email will auto-complete when the task is done.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[300px] text-muted-foreground">
                <div className="text-center">
                  <Mail className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-1">No email selected</p>
                  <p className="text-sm">
                    {selectedInboxId 
                      ? "Click on an email from the list to view its content"
                      : "Select an inbox first, then choose an email"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
