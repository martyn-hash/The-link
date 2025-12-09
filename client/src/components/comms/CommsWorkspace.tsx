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

export function CommsWorkspace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedInboxId, setSelectedInboxId] = useState<string>("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Inbox className="h-5 w-5" />
                Inboxes
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh}
                data-testid="button-refresh-inboxes"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Select value={selectedInboxId} onValueChange={(value) => {
              setSelectedInboxId(value);
              setSelectedMessageId(null);
            }}>
              <SelectTrigger data-testid="select-inbox">
                <SelectValue placeholder="Select an inbox..." />
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

            <div className="mt-4 space-y-2">
              {myInboxes.map((access) => (
                <div
                  key={access.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedInboxId === access.inboxId
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => {
                    setSelectedInboxId(access.inboxId);
                    setSelectedMessageId(null);
                  }}
                  data-testid={`inbox-item-${access.inboxId}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {access.inbox.displayName || access.inbox.email}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {access.accessLevel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    {access.inbox.email}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <Card className="h-[400px] flex flex-col">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {selectedInbox ? `${selectedInbox.displayName || selectedInbox.email}` : "Emails"}
            </CardTitle>
            <CardDescription>
              {selectedInbox 
                ? "Select an email to view details"
                : "Select an inbox to view emails"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {!selectedInboxId ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Select an inbox from the left panel</p>
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
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-70" />
                  <p className="text-sm text-destructive">{(emailsError as Error).message}</p>
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
                      className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedMessageId === email.id ? "bg-muted" : ""
                      } ${!email.isRead ? "bg-primary/5" : ""}`}
                      onClick={() => setSelectedMessageId(email.id)}
                      data-testid={`email-item-${email.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm truncate ${!email.isRead ? "font-semibold" : ""}`}>
                              {email.from.emailAddress.name || email.from.emailAddress.address}
                            </span>
                            {email.hasAttachments && (
                              <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                            {email.importance === "high" && (
                              <Badge variant="destructive" className="text-xs shrink-0">!</Badge>
                            )}
                          </div>
                          <p className={`text-sm truncate ${!email.isRead ? "font-medium" : "text-muted-foreground"}`}>
                            {email.subject || "(No subject)"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {email.bodyPreview}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(email.receivedDateTime), { addSuffix: true })}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No emails found</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[250px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {selectedEmail ? "Email Detail" : "AI Assist"}
            </CardTitle>
            <CardDescription>
              {selectedEmail 
                ? format(new Date(selectedEmail.receivedDateTime), "PPpp")
                : "Context-aware briefing notes and suggested replies powered by AI"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailDetailLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : selectedEmail ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{selectedEmail.subject || "(No subject)"}</h3>
                    {selectedEmail.importance === "high" && (
                      <Badge variant="destructive">High Priority</Badge>
                    )}
                  </div>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">From:</span>{" "}
                      {selectedEmail.from.emailAddress.name || selectedEmail.from.emailAddress.address}
                      {selectedEmail.from.emailAddress.name && (
                        <span className="text-muted-foreground ml-1">
                          &lt;{selectedEmail.from.emailAddress.address}&gt;
                        </span>
                      )}
                    </p>
                    {selectedEmail.toRecipients && selectedEmail.toRecipients.length > 0 && (
                      <p>
                        <span className="text-muted-foreground">To:</span>{" "}
                        {selectedEmail.toRecipients.map(r => r.emailAddress.name || r.emailAddress.address).join(", ")}
                      </p>
                    )}
                    {selectedEmail.ccRecipients && selectedEmail.ccRecipients.length > 0 && (
                      <p>
                        <span className="text-muted-foreground">CC:</span>{" "}
                        {selectedEmail.ccRecipients.map(r => r.emailAddress.name || r.emailAddress.address).join(", ")}
                      </p>
                    )}
                  </div>
                  {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
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
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    {selectedInboxId 
                      ? "Select an email to view details"
                      : "AI Assist will be available when viewing an email"}
                  </p>
                  <p className="text-xs mt-1">Provides briefing notes and reply suggestions</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
