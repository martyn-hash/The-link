import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Inbox, RefreshCw, MessageSquare } from "lucide-react";

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

export function CommsWorkspace() {
  const { user } = useAuth();
  const [selectedInboxId, setSelectedInboxId] = useState<string>("all");

  const { data: myInboxes = [], isLoading: inboxesLoading } = useQuery<InboxAccess[]>({
    queryKey: ["/api/my-inboxes"],
    enabled: !!user,
  });

  const selectedInbox = useMemo(() => {
    if (selectedInboxId === "all") return null;
    return myInboxes.find(ia => ia.inboxId === selectedInboxId)?.inbox;
  }, [selectedInboxId, myInboxes]);

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
              <Button variant="ghost" size="sm" data-testid="button-refresh-inboxes">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Select value={selectedInboxId} onValueChange={setSelectedInboxId}>
              <SelectTrigger data-testid="select-inbox">
                <SelectValue placeholder="Select inbox" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Inboxes</SelectItem>
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
                  onClick={() => setSelectedInboxId(access.inboxId)}
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
        <div className="grid grid-rows-2 gap-4 h-full min-h-[600px]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {selectedInbox ? `${selectedInbox.displayName || selectedInbox.email}` : "Email View"}
              </CardTitle>
              <CardDescription>
                {selectedInbox 
                  ? "Select an email to view details and compose replies"
                  : "Select an inbox to view emails from known contacts"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <div className="text-center">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    {selectedInbox 
                      ? "Email list will appear here (coming soon)"
                      : "Select an inbox from the left panel"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                AI Assist
              </CardTitle>
              <CardDescription>
                Context-aware briefing notes and suggested replies powered by AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">AI Assist will be available when viewing an email</p>
                  <p className="text-xs mt-1">Provides briefing notes and reply suggestions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
