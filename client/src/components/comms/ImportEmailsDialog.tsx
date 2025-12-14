import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Search, Mail, Paperclip, User, Clock, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BrowseEmail {
  microsoftId: string;
  subject: string;
  from: string;
  fromName: string;
  toRecipients: Array<{ address: string; name?: string }>;
  ccRecipients: Array<{ address: string; name?: string }>;
  receivedAt: string;
  bodyPreview: string;
  hasAttachments: boolean;
  isRead: boolean;
  importance: string;
  isInSystem: boolean;
  isQuarantined: boolean;
  canImport: boolean;
}

interface Client {
  id: string;
  name: string;
  companyName?: string;
}

interface ImportEmailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inboxId: string;
  inboxEmail: string;
}

export function ImportEmailsDialog({ open, onOpenChange, inboxId, inboxEmail }: ImportEmailsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sinceDays, setSinceDays] = useState("30");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const { data: browseData, isLoading: isBrowsing, refetch: refetchBrowse } = useQuery<{
    emails: BrowseEmail[];
    total: number;
    hasMore: boolean;
  }>({
    queryKey: ["/api/comms/inbox", inboxId, "browse", searchQuery, sinceDays],
    queryFn: async () => {
      const params = new URLSearchParams({
        top: "50",
        sinceDays,
        ...(searchQuery && { search: searchQuery }),
      });
      const res = await fetch(`/api/comms/inbox/${inboxId}/browse?${params}`);
      if (!res.ok) throw new Error("Failed to browse inbox");
      return res.json();
    },
    enabled: open && !!inboxId,
    refetchOnWindowFocus: false,
  });

  const { data: clientsData, isLoading: isLoadingClients } = useQuery<{ clients: Client[] }>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients?limit=500");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
    enabled: open,
  });

  const importMutation = useMutation({
    mutationFn: async ({ microsoftId, clientId }: { microsoftId: string; clientId: string }) => {
      return apiRequest("POST", `/api/comms/inbox/${inboxId}/import`, {
        microsoftId,
        clientId,
      });
    },
    onSuccess: (_, variables) => {
      setSelectedEmails(prev => {
        const next = new Set(prev);
        next.delete(variables.microsoftId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/comms/inbox", inboxId] });
      refetchBrowse();
    },
  });

  const handleImportSelected = async () => {
    if (!selectedClientId) {
      toast({
        title: "Select a client",
        description: "Please select a client to associate with the imported emails.",
        variant: "destructive",
      });
      return;
    }

    if (selectedEmails.size === 0) {
      toast({
        title: "No emails selected",
        description: "Please select at least one email to import.",
        variant: "destructive",
      });
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const microsoftId of Array.from(selectedEmails)) {
      try {
        await importMutation.mutateAsync({ microsoftId, clientId: selectedClientId });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error("Failed to import email:", microsoftId, error);
      }
    }

    if (successCount > 0) {
      toast({
        title: "Emails imported",
        description: `Successfully imported ${successCount} email${successCount > 1 ? "s" : ""}.${errorCount > 0 ? ` ${errorCount} failed.` : ""}`,
      });
    }

    if (errorCount === 0) {
      setSelectedEmails(new Set());
      setSelectedClientId("");
    }
  };

  const toggleEmailSelection = (microsoftId: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(microsoftId)) {
        next.delete(microsoftId);
      } else {
        next.add(microsoftId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!browseData?.emails) return;
    const importableIds = browseData.emails.filter(e => e.canImport).map(e => e.microsoftId);
    setSelectedEmails(new Set(importableIds));
  };

  const clearSelection = () => {
    setSelectedEmails(new Set());
  };

  const emails = browseData?.emails || [];
  const importableEmails = emails.filter(e => e.canImport);
  const clients = clientsData?.clients || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Emails
          </DialogTitle>
          <DialogDescription>
            Browse your inbox ({inboxEmail}) and import emails that weren't automatically captured.
            Select emails and choose a client to associate them with.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by subject or sender..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="import-search-input"
            />
          </div>
          <Select value={sinceDays} onValueChange={setSinceDays}>
            <SelectTrigger className="w-36" data-testid="import-since-days">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetchBrowse()} data-testid="import-refresh">
            <Loader2 className={`h-4 w-4 ${isBrowsing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex gap-3 items-center border-b pb-3">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-64" data-testid="import-client-select">
              <SelectValue placeholder="Select client to associate..." />
            </SelectTrigger>
            <SelectContent>
              {isLoadingClients ? (
                <div className="p-2 text-muted-foreground text-sm">Loading clients...</div>
              ) : clients.length === 0 ? (
                <div className="p-2 text-muted-foreground text-sm">No clients found</div>
              ) : (
                clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} {client.companyName ? `(${client.companyName})` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={selectAll} disabled={importableEmails.length === 0}>
              Select All ({importableEmails.length})
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection} disabled={selectedEmails.size === 0}>
              Clear
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 border rounded-md">
          <div className="p-2 space-y-1">
            {isBrowsing ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : emails.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No emails found that can be imported.</p>
                <p className="text-sm">All recent emails may already be in the system.</p>
              </div>
            ) : (
              emails.map((email) => (
                <div
                  key={email.microsoftId}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    email.canImport
                      ? selectedEmails.has(email.microsoftId)
                        ? "bg-primary/10 border-primary/30"
                        : "hover:bg-muted/50 cursor-pointer"
                      : "opacity-50 bg-muted/30"
                  }`}
                  onClick={() => email.canImport && toggleEmailSelection(email.microsoftId)}
                  data-testid={`import-email-${email.microsoftId}`}
                >
                  <div className="pt-1">
                    {email.canImport ? (
                      <Checkbox
                        checked={selectedEmails.has(email.microsoftId)}
                        onCheckedChange={() => toggleEmailSelection(email.microsoftId)}
                        data-testid={`import-checkbox-${email.microsoftId}`}
                      />
                    ) : email.isInSystem ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {email.fromName || email.from}
                      </span>
                      {email.fromName && (
                        <span className="text-xs text-muted-foreground truncate">
                          &lt;{email.from}&gt;
                        </span>
                      )}
                      {!email.canImport && (
                        <Badge variant="secondary" className="text-xs">
                          {email.isInSystem ? "Already imported" : "Quarantined"}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm truncate">{email.subject}</div>
                    <div className="text-xs text-muted-foreground truncate">{email.bodyPreview}</div>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground whitespace-nowrap">
                    <span>{formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}</span>
                    <div className="flex gap-1">
                      {email.hasAttachments && <Paperclip className="h-3 w-3" />}
                      {email.importance === "high" && <AlertCircle className="h-3 w-3 text-red-500" />}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
            {selectedEmails.size > 0 && (
              <>
                <CheckCircle className="h-4 w-4" />
                {selectedEmails.size} selected
              </>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImportSelected}
            disabled={selectedEmails.size === 0 || !selectedClientId || importMutation.isPending}
            data-testid="import-submit-button"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Import {selectedEmails.size > 0 ? `(${selectedEmails.size})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
