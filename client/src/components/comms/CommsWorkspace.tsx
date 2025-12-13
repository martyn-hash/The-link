import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Inbox, RefreshCw, MessageSquare, Paperclip, ChevronRight, AlertCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

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

interface EmailMessage {
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
  receivedDateTime: string;
  bodyPreview: string;
  hasAttachments: boolean;
  isRead: boolean;
  importance: string;
}

interface EmailListResponse {
  messages: EmailMessage[];
  hasMore: boolean;
  total: number | null;
  inbox: {
    id: string;
    email: string;
    displayName: string;
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
}

export function CommsWorkspace({
  selectedInboxId: propSelectedInboxId,
  setSelectedInboxId: propSetSelectedInboxId,
  selectedMessageId: propSelectedMessageId,
  setSelectedMessageId: propSetSelectedMessageId,
}: CommsWorkspaceProps = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Internal state as fallback when props not provided
  const [internalSelectedInboxId, setInternalSelectedInboxId] = useState<string>("");
  const [internalSelectedMessageId, setInternalSelectedMessageId] = useState<string | null>(null);
  
  // Use props if provided, otherwise use internal state
  const selectedInboxId = propSelectedInboxId ?? internalSelectedInboxId;
  const setSelectedInboxId = propSetSelectedInboxId ?? setInternalSelectedInboxId;
  const selectedMessageId = propSelectedMessageId ?? internalSelectedMessageId;
  const setSelectedMessageId = propSetSelectedMessageId ?? setInternalSelectedMessageId;

  const { data: myInboxes = [], isLoading: inboxesLoading } = useQuery<InboxAccess[]>({
    queryKey: ["/api/my-inboxes"],
    enabled: !!user,
  });

  const selectedInbox = useMemo(() => {
    if (!selectedInboxId) return null;
    return myInboxes.find(ia => ia.inboxId === selectedInboxId)?.inbox;
  }, [selectedInboxId, myInboxes]);

  const { 
    data: emailData, 
    isLoading: emailsLoading,
    error: emailsError,
    refetch: refetchEmails 
  } = useQuery<EmailListResponse>({
    queryKey: ["/api/comms/inbox", selectedInboxId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/comms/inbox/${selectedInboxId}/messages`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to fetch emails");
      }
      return res.json();
    },
    enabled: !!selectedInboxId && selectedInboxId !== "",
  });

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

  const handleRefresh = () => {
    if (selectedInboxId) {
      refetchEmails();
    }
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Left Column: Email List */}
      <div className="lg:col-span-1 flex flex-col h-full">
        <Card className="flex-1 flex flex-col min-h-[500px]">
          <CardHeader className="pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {selectedInbox ? `${selectedInbox.displayName || selectedInbox.email}` : "Emails"}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh}
                disabled={!selectedInboxId}
                data-testid="button-refresh-emails"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              {selectedInbox 
                ? `${emailData?.messages?.length || 0} messages`
                : "Select an inbox from the header"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {!selectedInboxId ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center p-4">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Select an inbox from the dropdown above</p>
                </div>
              </div>
            ) : emailsLoading ? (
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
            ) : emailData?.messages && emailData.messages.length > 0 ? (
              <ScrollArea className="h-full">
                <div className="divide-y">
                  {emailData.messages.map((email) => (
                    <div
                      key={email.id}
                      className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedMessageId === email.id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                      } ${!email.isRead ? "bg-primary/5" : ""}`}
                      onClick={() => setSelectedMessageId(email.id)}
                      data-testid={`email-item-${email.id}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm truncate flex-1 ${!email.isRead ? "font-semibold" : ""}`}>
                          {email.from.emailAddress.name || email.from.emailAddress.address}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(email.receivedDateTime), { addSuffix: true })}
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
                      <p className="text-xs text-muted-foreground truncate">
                        {email.bodyPreview}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center p-4">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No emails found</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Email Detail (full width) */}
      <div className="lg:col-span-2 flex flex-col h-full">
        <Card className="flex-1 flex flex-col min-h-[500px]">
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
          <CardContent className="flex-1 overflow-auto">
            {emailDetailLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : selectedEmail ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-semibold text-lg leading-tight">{selectedEmail.subject || "(No subject)"}</h3>
                    {selectedEmail.importance === "high" && (
                      <Badge variant="destructive" className="shrink-0">High Priority</Badge>
                    )}
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
