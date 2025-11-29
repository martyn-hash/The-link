import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Eye, FileCheck, Building, TrendingUp, AlertCircle, CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

type GroupedChangeRequest = {
  client: {
    id: string;
    name: string;
    companyNumber: string | null;
  };
  accountsChanges: any[];
  confirmationStatementChanges: any[];
  affectedServices: string[];
  affectedProjects: number;
};

export default function ChChanges() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedGroup, setSelectedGroup] = useState<GroupedChangeRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
  const [actionNotes, setActionNotes] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());

  // Redirect non-admin users
  useEffect(() => {
    if (user && !user.isAdmin) {
      showFriendlyError({ error: "You don't have permission to access this page." });
      setLocation('/');
      return;
    }
  }, [user, setLocation]);

  // Fetch grouped CH change requests
  const { data: groupedRequests, isLoading: requestsLoading } = useQuery<GroupedChangeRequest[]>({
    queryKey: ["/api/ch-change-requests/grouped"],
    enabled: isAuthenticated && Boolean(user?.isAdmin),
    retry: false,
  });

  // Single client approve mutation
  const approveAllMutation = useMutation({
    mutationFn: async ({ clientId, notes }: { clientId: string; notes?: string }) => {
      return await apiRequest("POST", `/api/ch-change-requests/client/${clientId}/approve-all`, { notes });
    },
    onSuccess: (data) => {
      toast({ 
        title: "Success", 
        description: `Approved ${data.approvedCount} change requests. Updated ${data.updatedServices} services${data.updatedProjects > 0 ? ` and ${data.updatedProjects} projects` : ''}.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ch-change-requests/grouped"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowApproveDialog(false);
      setActionNotes("");
      setSelectedGroup(null);
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  // Bulk approve mutation for multiple clients
  const bulkApproveMutation = useMutation({
    mutationFn: async ({ clientIds, notes }: { clientIds: string[]; notes?: string }) => {
      return await apiRequest("POST", `/api/ch-change-requests/bulk-approve`, { clientIds, notes });
    },
    onSuccess: (data) => {
      if (data.approvedCount > 0) {
        toast({ 
          title: "Success", 
          description: `Approved ${data.approvedCount} change requests for ${data.clientsProcessed} clients. Updated ${data.updatedServices} services${data.updatedProjects > 0 ? ` and ${data.updatedProjects} projects` : ''}.`
        });
      } else {
        toast({ 
          title: "No Changes", 
          description: "No pending changes found for the selected clients.",
          variant: "default",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ch-change-requests/grouped"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowBulkApproveDialog(false);
      setActionNotes("");
      setSelectedClientIds(new Set());
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const handleViewDetails = (group: GroupedChangeRequest) => {
    setSelectedGroup(group);
    setShowDetailsModal(true);
  };

  const handleApproveAll = (group: GroupedChangeRequest) => {
    setSelectedGroup(group);
    setShowApproveDialog(true);
  };

  const handleConfirmApprove = () => {
    if (!selectedGroup) return;
    approveAllMutation.mutate({ clientId: selectedGroup.client.id, notes: actionNotes });
  };

  const handleConfirmBulkApprove = () => {
    if (selectedClientIds.size === 0) return;
    bulkApproveMutation.mutate({ clientIds: Array.from(selectedClientIds), notes: actionNotes });
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClientIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (!groupedRequests) return;
    if (selectedClientIds.size === groupedRequests.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(groupedRequests.map(g => g.client.id)));
    }
  };

  const isAllSelected = groupedRequests && groupedRequests.length > 0 && selectedClientIds.size === groupedRequests.length;

  const formatValue = (value: any) => {
    if (!value) return "—";
    if (value instanceof Date || typeof value === "string") {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return format(date, "dd/MM/yyyy");
        }
      } catch (e) {
        // Not a valid date, return as string
      }
    }
    return String(value);
  };

  const getChangesSummary = (group: GroupedChangeRequest) => {
    const parts: string[] = [];
    
    if (group.accountsChanges.length > 0) {
      const fields = group.accountsChanges.map(c => {
        if (c.fieldName === 'nextAccountsPeriodEnd') return 'period end';
        if (c.fieldName === 'nextAccountsDue') return 'due date';
        return c.fieldName;
      });
      parts.push(`Accounts (${fields.join(', ')})`);
    }
    
    if (group.confirmationStatementChanges.length > 0) {
      const fields = group.confirmationStatementChanges.map(c => {
        if (c.fieldName === 'confirmationStatementNextDue') return 'due';
        if (c.fieldName === 'confirmationStatementNextMadeUpTo') return 'made up to';
        return c.fieldName;
      });
      parts.push(`Conf. Statement (${fields.join(', ')})`);
    }
    
    return parts.join(' • ');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Authentication Required</h1>
          <p className="text-muted-foreground">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <FileCheck className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold" data-testid="text-page-title">
                  Companies House Changes
                </h1>
                <p className="text-muted-foreground mt-2">
                  Review and approve changes detected from nightly Companies House synchronization
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Pending Changes - Detailed View</span>
                <div className="flex items-center gap-3">
                  {selectedClientIds.size > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowBulkApproveDialog(true)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      data-testid="button-bulk-approve"
                    >
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Approve Selected ({selectedClientIds.size})
                    </Button>
                  )}
                  <Badge variant="outline" data-testid="text-clients-count">
                    {groupedRequests?.length || 0} Clients with Changes
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription>
                Each row shows a specific field change with old and new values for verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 border rounded">
                      <Skeleton className="h-12 w-12 rounded" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-4 w-[200px]" />
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              ) : groupedRequests && groupedRequests.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all"
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead className="w-56">Client</TableHead>
                        <TableHead className="w-40">Change Type</TableHead>
                        <TableHead className="w-56">Field</TableHead>
                        <TableHead className="w-40">Old Value</TableHead>
                        <TableHead className="w-40">New Value</TableHead>
                        <TableHead className="w-48">Affected Services</TableHead>
                        <TableHead className="w-36">Active Projects</TableHead>
                        <TableHead className="w-36">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedRequests.map((group) => {
                        // Flatten all changes into individual rows
                        const allChanges = [
                          ...group.accountsChanges.map(c => ({ ...c, changeType: 'Accounts', group })),
                          ...group.confirmationStatementChanges.map(c => ({ ...c, changeType: 'Confirmation Statement', group }))
                        ];
                        
                        return allChanges.map((change, idx) => {
                          // Show client info and actions only on first row for this client
                          const isFirstRow = idx === 0;
                          const rowSpan = allChanges.length;
                          
                          return (
                            <TableRow key={change.id} data-testid={`row-change-${change.id}`}>
                              {isFirstRow && (
                                <>
                                  <TableCell rowSpan={rowSpan} className="align-top">
                                    <Checkbox
                                      checked={selectedClientIds.has(group.client.id)}
                                      onCheckedChange={() => toggleClientSelection(group.client.id)}
                                      aria-label={`Select ${group.client.name}`}
                                      data-testid={`checkbox-client-${group.client.id}`}
                                    />
                                  </TableCell>
                                  <TableCell rowSpan={rowSpan} className="font-medium align-top border-r-2">
                                    <div className="flex items-center space-x-2">
                                      <Building className="w-4 h-4 text-muted-foreground" />
                                      <div>
                                        <div className="font-semibold">{group.client.name}</div>
                                        {group.client.companyNumber && (
                                          <div className="text-xs text-muted-foreground font-mono">
                                            {group.client.companyNumber}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                </>
                              )}
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {change.changeType}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                {change.fieldName === 'nextAccountsPeriodEnd' && 'Accounts Period End'}
                                {change.fieldName === 'nextAccountsDue' && 'Accounts Due Date'}
                                {change.fieldName === 'confirmationStatementNextDue' && 'CS Due Date'}
                                {change.fieldName === 'confirmationStatementNextMadeUpTo' && 'CS Made Up To'}
                              </TableCell>
                              <TableCell>
                                <div className="px-2 py-1 bg-red-50 border border-red-200 rounded text-red-700 text-sm font-mono">
                                  {formatValue(change.oldValue)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="px-2 py-1 bg-green-50 border border-green-200 rounded text-green-700 text-sm font-mono">
                                  {formatValue(change.newValue)}
                                </div>
                              </TableCell>
                              {isFirstRow && (
                                <>
                                  <TableCell rowSpan={rowSpan} className="align-top">
                                    {group.affectedServices.length > 0 ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center space-x-1">
                                          <TrendingUp className="w-3 h-3 text-blue-600" />
                                          <span className="text-sm font-medium">
                                            {group.affectedServices.length} {group.affectedServices.length === 1 ? 'service' : 'services'}
                                          </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {group.affectedServices.slice(0, 2).join(', ')}
                                          {group.affectedServices.length > 2 && ` +${group.affectedServices.length - 2}`}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">None</span>
                                    )}
                                  </TableCell>
                                  <TableCell rowSpan={rowSpan} className="align-top">
                                    {group.affectedProjects > 0 ? (
                                      <div className="flex items-center space-x-1">
                                        <AlertCircle className="w-4 h-4 text-orange-600" />
                                        <span className="font-medium text-orange-600 text-sm">
                                          {group.affectedProjects}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">None</span>
                                    )}
                                  </TableCell>
                                  <TableCell rowSpan={rowSpan} className="align-top border-l-2">
                                    <div className="flex flex-col space-y-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewDetails(group)}
                                        data-testid={`button-view-${group.client.id}`}
                                        className="w-full justify-start text-xs"
                                      >
                                        <Eye className="w-3 h-3 mr-1" />
                                        Details
                                      </Button>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => handleApproveAll(group)}
                                        className="bg-green-600 hover:bg-green-700 text-white w-full justify-start text-xs"
                                        data-testid={`button-approve-all-${group.client.id}`}
                                      >
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Approve All
                                      </Button>
                                    </div>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        });
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">No Pending Changes</h3>
                  <p className="text-sm text-muted-foreground">
                    No Companies House changes are awaiting review
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change Request Details</DialogTitle>
            <DialogDescription>
              All pending Companies House changes for {selectedGroup?.client.name}
            </DialogDescription>
          </DialogHeader>
          {selectedGroup && (
            <div className="space-y-6">
              {/* Client Info */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Client Name</Label>
                    <p className="mt-1 font-medium">{selectedGroup.client.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Company Number</Label>
                    <p className="mt-1 font-medium">{selectedGroup.client.companyNumber || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Accounts Changes */}
              {selectedGroup.accountsChanges.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center space-x-2">
                    <Badge>Accounts Changes</Badge>
                    <span className="text-sm text-muted-foreground">
                      ({selectedGroup.accountsChanges.length} {selectedGroup.accountsChanges.length === 1 ? 'field' : 'fields'})
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {selectedGroup.accountsChanges.map((change) => (
                      <div key={change.id} className="border rounded-lg p-4">
                        <div className="font-medium text-sm mb-2">
                          {change.fieldName === 'nextAccountsPeriodEnd' ? 'Accounts Period End Date' : 'Accounts Due Date'}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Current</Label>
                            <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                              {formatValue(change.oldValue)}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">New</Label>
                            <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                              {formatValue(change.newValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmation Statement Changes */}
              {selectedGroup.confirmationStatementChanges.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center space-x-2">
                    <Badge>Confirmation Statement Changes</Badge>
                    <span className="text-sm text-muted-foreground">
                      ({selectedGroup.confirmationStatementChanges.length} {selectedGroup.confirmationStatementChanges.length === 1 ? 'field' : 'fields'})
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {selectedGroup.confirmationStatementChanges.map((change) => (
                      <div key={change.id} className="border rounded-lg p-4">
                        <div className="font-medium text-sm mb-2">
                          {change.fieldName === 'confirmationStatementNextDue' ? 'Confirmation Statement Due Date' : 'Confirmation Statement Made Up To'}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Current</Label>
                            <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                              {formatValue(change.oldValue)}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">New</Label>
                            <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                              {formatValue(change.newValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Impact Analysis */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Impact Analysis</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Affected Services</span>
                    </div>
                    <Badge variant="secondary">
                      {selectedGroup.affectedServices.length} {selectedGroup.affectedServices.length === 1 ? 'service' : 'services'}
                    </Badge>
                  </div>
                  {selectedGroup.affectedServices.length > 0 && (
                    <div className="pl-6 text-sm text-muted-foreground">
                      {selectedGroup.affectedServices.join(', ')}
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                      <span className="font-medium">Active Projects (may be updated)</span>
                    </div>
                    <Badge variant="secondary">
                      {selectedGroup.affectedProjects} {selectedGroup.affectedProjects === 1 ? 'project' : 'projects'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve All Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve All Changes for {selectedGroup?.client.name}</AlertDialogTitle>
            <AlertDialogDescription>
              This will approve {selectedGroup ? selectedGroup.accountsChanges.length + selectedGroup.confirmationStatementChanges.length : 0} change{selectedGroup && (selectedGroup.accountsChanges.length + selectedGroup.confirmationStatementChanges.length) !== 1 ? 's' : ''} and automatically update:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Client Companies House data</li>
                {selectedGroup && selectedGroup.affectedServices.length > 0 && (
                  <li>{selectedGroup.affectedServices.length} service{selectedGroup.affectedServices.length !== 1 ? 's' : ''} ({selectedGroup.affectedServices.join(', ')})</li>
                )}
                {selectedGroup && selectedGroup.affectedProjects > 0 && (
                  <li>{selectedGroup.affectedProjects} active project{selectedGroup.affectedProjects !== 1 ? 's' : ''}</li>
                )}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approve-notes">Notes (optional)</Label>
            <Textarea
              id="approve-notes"
              placeholder="Add any notes about this approval..."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              data-testid="textarea-approve-notes"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActionNotes("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmApprove}
              disabled={approveAllMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-approve-all"
            >
              {approveAllMutation.isPending ? "Approving..." : "Approve All Changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Approve Dialog */}
      <AlertDialog open={showBulkApproveDialog} onOpenChange={setShowBulkApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Changes for {selectedClientIds.size} Client{selectedClientIds.size !== 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              This will approve all pending Companies House changes for the selected clients and automatically update their records, services, and projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulk-approve-notes">Notes (optional)</Label>
            <Textarea
              id="bulk-approve-notes"
              placeholder="Add any notes about this bulk approval..."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              data-testid="textarea-bulk-approve-notes"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActionNotes("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkApprove}
              disabled={bulkApproveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-bulk-approve"
            >
              {bulkApproveMutation.isPending ? "Approving..." : `Approve All (${selectedClientIds.size} clients)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
