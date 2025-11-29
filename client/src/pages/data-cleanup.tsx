import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import TopNavigation from "@/components/top-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2, RefreshCw, Search, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

interface ClientWithCounts {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  clientType: string | null;
  projectCount: string;
  peopleCount: string;
  serviceCount: string;
  documentCount: string;
  messageThreadCount: string;
  communicationCount: string;
  taskCount: string;
}

interface DeletionPreview {
  summary: {
    clientCount: string;
    projectCount: string;
    peopleLinkedCount: string;
    clientServiceCount: string;
    documentCount: string;
    folderCount: string;
    signatureRequestCount: string;
    messageThreadCount: string;
    communicationCount: string;
    taskInstanceCount: string;
    portalUserCount: string;
    chronologyCount: string;
    projectChronologyCount: string;
  };
  orphanedPeople: Array<{ id: string; full_name: string; email: string | null }>;
  clientIds: string[];
}

interface DeletionResult {
  success: boolean;
  message: string;
  deletionLog: Record<string, number>;
}

export default function DataCleanupPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deleteOrphanedPeople, setDeleteOrphanedPeople] = useState(true);
  const [deletionPreview, setDeletionPreview] = useState<DeletionPreview | null>(null);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("limit", "500");
    return params.toString();
  };

  const { data: clients = [], isLoading, refetch, error } = useQuery<ClientWithCounts[]>({
    queryKey: ["/api/super-admin/data-cleanup/clients", { dateFrom, dateTo }],
    queryFn: async () => {
      const response = await fetch(`/api/super-admin/data-cleanup/clients?${buildQueryParams()}`);
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (clientIds: string[]) => {
      const response = await apiRequest("POST", "/api/super-admin/data-cleanup/preview", { clientIds });
      return response as DeletionPreview;
    },
    onSuccess: (data) => {
      setDeletionPreview(data);
      setShowPreviewDialog(true);
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ clientIds, deleteOrphanedPeople }: { clientIds: string[]; deleteOrphanedPeople: boolean }) => {
      const response = await apiRequest("DELETE", "/api/super-admin/data-cleanup/batch", { 
        clientIds, 
        deleteOrphanedPeople 
      });
      return response as DeletionResult;
    },
    onSuccess: (data) => {
      toast({
        title: "Cleanup Complete",
        description: data.message,
      });
      setSelectedClientIds(new Set());
      setShowConfirmDialog(false);
      setShowPreviewDialog(false);
      setDeletionPreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/data-cleanup/clients"] });
      refetch();
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClientIds(new Set(clients.map(c => c.id)));
    } else {
      setSelectedClientIds(new Set());
    }
  };

  const handleSelectClient = (clientId: string, checked: boolean) => {
    const newSet = new Set(selectedClientIds);
    if (checked) {
      newSet.add(clientId);
    } else {
      newSet.delete(clientId);
    }
    setSelectedClientIds(newSet);
  };

  const handlePreview = () => {
    if (selectedClientIds.size === 0) {
      toast({
        title: "No clients selected",
        description: "Please select at least one client to delete",
        variant: "destructive",
      });
      return;
    }
    previewMutation.mutate(Array.from(selectedClientIds));
  };

  const handleDelete = () => {
    if (!deletionPreview) return;
    deleteMutation.mutate({
      clientIds: deletionPreview.clientIds,
      deleteOrphanedPeople,
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy HH:mm");
    } catch {
      return dateStr;
    }
  };

  const getTotalRelatedRecords = (client: ClientWithCounts) => {
    return parseInt(client.projectCount) +
      parseInt(client.peopleCount) +
      parseInt(client.serviceCount) +
      parseInt(client.documentCount) +
      parseInt(client.messageThreadCount) +
      parseInt(client.communicationCount) +
      parseInt(client.taskCount);
  };

  if (!user?.superAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                You don't have permission to access this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="container mx-auto py-6 px-4">
        <Card className="border-destructive/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <CardTitle className="text-xl">Data Cleanup</CardTitle>
            </div>
            <CardDescription>
              Delete test/import data by selecting clients created within a date range. 
              This will permanently delete the selected clients and all related data including projects, people, services, documents, and messages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">Created From</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-44"
                  data-testid="input-date-from"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">Created To</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-44"
                  data-testid="input-date-to"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
                data-testid="button-search"
              >
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSelectedClientIds(new Set());
                }}
                data-testid="button-clear-filters"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            </div>

            {selectedClientIds.size > 0 && (
              <div className="flex items-center gap-4 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
                <Badge variant="destructive" className="text-base px-3 py-1">
                  {selectedClientIds.size} selected
                </Badge>
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={previewMutation.isPending}
                  data-testid="button-preview-deletion"
                >
                  {previewMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4 mr-2" />
                  )}
                  Preview Deletion
                </Button>
                <Button
                  variant="destructive"
                  onClick={handlePreview}
                  disabled={previewMutation.isPending}
                  data-testid="button-delete-selected"
                >
                  {previewMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete Selected
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center text-destructive py-8">
                Failed to load clients. Please try again.
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No clients found for the selected date range.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedClientIds.size === clients.length && clients.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="text-center">Projects</TableHead>
                      <TableHead className="text-center">People</TableHead>
                      <TableHead className="text-center">Services</TableHead>
                      <TableHead className="text-center">Docs</TableHead>
                      <TableHead className="text-center">Threads</TableHead>
                      <TableHead className="text-center">Total Related</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow 
                        key={client.id}
                        className={selectedClientIds.has(client.id) ? "bg-destructive/5" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedClientIds.has(client.id)}
                            onCheckedChange={(checked) => handleSelectClient(client.id, !!checked)}
                            data-testid={`checkbox-client-${client.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>
                            <div>{client.name}</div>
                            {client.email && (
                              <div className="text-xs text-muted-foreground">{client.email}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {client.clientType || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(client.createdAt)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={parseInt(client.projectCount) > 0 ? "secondary" : "outline"}>
                            {client.projectCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={parseInt(client.peopleCount) > 0 ? "secondary" : "outline"}>
                            {client.peopleCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={parseInt(client.serviceCount) > 0 ? "secondary" : "outline"}>
                            {client.serviceCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={parseInt(client.documentCount) > 0 ? "secondary" : "outline"}>
                            {client.documentCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={parseInt(client.messageThreadCount) > 0 ? "secondary" : "outline"}>
                            {client.messageThreadCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={getTotalRelatedRecords(client) > 0 ? "default" : "outline"}
                            className={getTotalRelatedRecords(client) > 10 ? "bg-amber-500" : ""}
                          >
                            {getTotalRelatedRecords(client)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Deletion Preview
            </DialogTitle>
            <DialogDescription>
              Review what will be deleted before confirming.
            </DialogDescription>
          </DialogHeader>
          
          {deletionPreview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-destructive/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Records to Delete</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Clients:</span>
                      <Badge variant="destructive">{deletionPreview.summary.clientCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Projects:</span>
                      <Badge variant="destructive">{deletionPreview.summary.projectCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Client Services:</span>
                      <Badge variant="destructive">{deletionPreview.summary.clientServiceCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>People Linked:</span>
                      <Badge variant="destructive">{deletionPreview.summary.peopleLinkedCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Documents:</span>
                      <Badge variant="destructive">{deletionPreview.summary.documentCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Folders:</span>
                      <Badge variant="destructive">{deletionPreview.summary.folderCount}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-destructive/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Additional Records</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Signature Requests:</span>
                      <Badge variant="destructive">{deletionPreview.summary.signatureRequestCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Message Threads:</span>
                      <Badge variant="destructive">{deletionPreview.summary.messageThreadCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Communications:</span>
                      <Badge variant="destructive">{deletionPreview.summary.communicationCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Task Instances:</span>
                      <Badge variant="destructive">{deletionPreview.summary.taskInstanceCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Portal Users:</span>
                      <Badge variant="destructive">{deletionPreview.summary.portalUserCount}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Chronology:</span>
                      <Badge variant="destructive">{deletionPreview.summary.chronologyCount}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {deletionPreview.orphanedPeople.length > 0 && (
                <Card className="border-amber-500/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        Orphaned People ({deletionPreview.orphanedPeople.length})
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="delete-orphaned" className="text-xs">
                          Also delete orphaned people
                        </Label>
                        <Switch
                          id="delete-orphaned"
                          checked={deleteOrphanedPeople}
                          onCheckedChange={setDeleteOrphanedPeople}
                          data-testid="switch-delete-orphaned"
                        />
                      </div>
                    </div>
                    <CardDescription className="text-xs">
                      These people are only linked to the selected clients and will become orphaned.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {deletionPreview.orphanedPeople.map((person) => (
                        <div key={person.id} className="text-sm flex justify-between py-1 border-b border-border/50 last:border-0">
                          <span>{person.full_name}</span>
                          <span className="text-muted-foreground text-xs">{person.email || "No email"}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPreviewDialog(false)}
                  data-testid="button-cancel-preview"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowConfirmDialog(true)}
                  data-testid="button-proceed-delete"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Proceed with Deletion
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Permanent Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <strong>{deletionPreview?.summary.clientCount}</strong> clients and all related data
              {deleteOrphanedPeople && deletionPreview?.orphanedPeople.length
                ? `, including ${deletionPreview.orphanedPeople.length} orphaned people`
                : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
