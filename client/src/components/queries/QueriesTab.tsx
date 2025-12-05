import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import type { BookkeepingQueryWithRelations } from "@shared/schema";

type QueryStatus = "open" | "answered_by_staff" | "sent_to_client" | "answered_by_client" | "resolved";

interface QueriesTabProps {
  projectId: string;
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

export function QueriesTab({ projectId }: QueriesTabProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [selectedQueries, setSelectedQueries] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState<BookkeepingQueryWithRelations | null>(null);
  const [newQueryText, setNewQueryText] = useState("");
  const [newQueryDescription, setNewQueryDescription] = useState("");
  const [editQueryText, setEditQueryText] = useState("");
  const [editQueryDescription, setEditQueryDescription] = useState("");
  const [editQueryStatus, setEditQueryStatus] = useState<QueryStatus>("open");
  const [editQueryResponse, setEditQueryResponse] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  const createMutation = useMutation({
    mutationFn: async (data: { ourQuery: string; description?: string }) => {
      return apiRequest('POST', `/api/projects/${projectId}/queries`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
      setNewQueryText("");
      setNewQueryDescription("");
      setIsAddDialogOpen(false);
      toast({ title: "Query created", description: "Your query has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create query.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; ourQuery?: string; description?: string; status?: QueryStatus; clientResponse?: string }) => {
      const { id, ...updateData } = data;
      return apiRequest('PATCH', `/api/queries/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
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

  const sendToClientMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest('POST', '/api/queries/send-to-client', { ids });
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'queries'] });
      setSelectedQueries([]);
      toast({ 
        title: "Queries sent", 
        description: `${ids.length} queries marked as sent to client.` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send queries to client.", variant: "destructive" });
    },
  });

  const handleAddQuery = () => {
    if (!newQueryText.trim()) return;
    createMutation.mutate({ 
      ourQuery: newQueryText.trim(),
      description: newQueryDescription.trim() || undefined,
    });
  };

  const handleEditQuery = (query: BookkeepingQueryWithRelations) => {
    setEditingQuery(query);
    setEditQueryText(query.ourQuery || "");
    setEditQueryDescription(query.description || "");
    setEditQueryStatus(query.status as QueryStatus);
    setEditQueryResponse(query.clientResponse || "");
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingQuery || !editQueryText.trim()) return;
    updateMutation.mutate({
      id: editingQuery.id,
      ourQuery: editQueryText.trim(),
      description: editQueryDescription.trim() || undefined,
      status: editQueryStatus,
      clientResponse: editQueryResponse.trim() || undefined,
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
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-query">
                <Plus className="w-4 h-4 mr-2" />
                Add Query
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Bookkeeping Query</DialogTitle>
                <DialogDescription>
                  Add a new question or query for the bookkeeping team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Query</label>
                  <Textarea
                    value={newQueryText}
                    onChange={(e) => setNewQueryText(e.target.value)}
                    placeholder="Enter your query or question..."
                    className="mt-1"
                    data-testid="input-query-text"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description (optional)</label>
                  <Input
                    value={newQueryDescription}
                    onChange={(e) => setNewQueryDescription(e.target.value)}
                    placeholder="Brief description of the transaction..."
                    className="mt-1"
                    data-testid="input-query-description"
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
                onClick={() => sendToClientMutation.mutate(selectedQueries)}
                disabled={sendToClientMutation.isPending}
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
            <div className="hidden md:block border rounded-lg">
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
                    <TableHead>Query</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="max-w-xs">
                        <p className="truncate font-medium" data-testid={`text-query-${query.id}`}>
                          {query.ourQuery}
                        </p>
                        {query.clientResponse && (
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            Response: {query.clientResponse}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {query.description && (
                          <span className="text-sm text-muted-foreground" data-testid={`text-description-${query.id}`}>
                            {query.description}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <QueryStatusBadge status={query.status as QueryStatus} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {query.createdAt && format(new Date(query.createdAt), 'MMM d, yyyy')}
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
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => sendToClientMutation.mutate([query.id])}
                              disabled={query.status === 'sent_to_client' || query.status === 'resolved'}
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
                        <p className="font-medium" data-testid={`text-query-mobile-${query.id}`}>
                          {query.ourQuery}
                        </p>
                        {query.clientResponse && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Response: {query.clientResponse}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <QueryStatusBadge status={query.status as QueryStatus} />
                          {query.description && (
                            <span className="text-xs text-muted-foreground">{query.description}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {query.createdAt && format(new Date(query.createdAt), 'MMM d, yyyy')}
                        </p>
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
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => sendToClientMutation.mutate([query.id])}
                          disabled={query.status === 'sent_to_client' || query.status === 'resolved'}
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
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Query</DialogTitle>
            <DialogDescription>
              Update the query details and status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Query</label>
              <Textarea
                value={editQueryText}
                onChange={(e) => setEditQueryText(e.target.value)}
                className="mt-1"
                data-testid="input-edit-query-text"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                value={editQueryDescription}
                onChange={(e) => setEditQueryDescription(e.target.value)}
                placeholder="Brief description of the transaction..."
                className="mt-1"
                data-testid="input-edit-query-description"
              />
            </div>
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
            <div>
              <label className="text-sm font-medium">Client Response (optional)</label>
              <Textarea
                value={editQueryResponse}
                onChange={(e) => setEditQueryResponse(e.target.value)}
                placeholder="Enter the client's response..."
                className="mt-1"
                data-testid="input-edit-query-response"
              />
            </div>
          </div>
          <DialogFooter>
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
    </Card>
  );
}
