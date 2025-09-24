import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type ChChangeRequest, type Client } from "@shared/schema";
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
import { CheckCircle, XCircle, Clock, Eye, FileCheck, Building } from "lucide-react";
import { format } from "date-fns";

export default function ChChanges() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedRequest, setSelectedRequest] = useState<ChChangeRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [actionNotes, setActionNotes] = useState("");

  // Redirect non-admin users
  useEffect(() => {
    if (user && !user.isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      setLocation('/');
      return;
    }
  }, [user, toast, setLocation]);

  // Fetch pending CH change requests
  const { data: changeRequests, isLoading: requestsLoading, error } = useQuery<ChChangeRequest[]>({
    queryKey: ["/api/ch-change-requests"],
    enabled: isAuthenticated && Boolean(user?.isAdmin),
    retry: false,
  });

  // Fetch clients for displaying names
  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: isAuthenticated && Boolean(user?.isAdmin),
    retry: false,
  });

  const getClientName = (clientId: string) => {
    const client = clients?.find(c => c.id === clientId);
    return client?.name || "Unknown Client";
  };

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await apiRequest("POST", `/api/ch-change-requests/${id}/approve`, { notes });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Change request approved successfully" });
      // Invalidate both change requests and clients queries to ensure UI refresh
      queryClient.invalidateQueries({ queryKey: ["/api/ch-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowApproveDialog(false);
      setActionNotes("");
      setSelectedRequest(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve change request",
        variant: "destructive",
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await apiRequest("POST", `/api/ch-change-requests/${id}/reject`, { notes });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Change request rejected successfully" });
      // Invalidate both change requests and clients queries to ensure UI refresh  
      queryClient.invalidateQueries({ queryKey: ["/api/ch-change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowRejectDialog(false);
      setActionNotes("");
      setSelectedRequest(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject change request",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleViewDetails = (request: ChChangeRequest) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const handleApprove = (request: ChChangeRequest) => {
    setSelectedRequest(request);
    setShowApproveDialog(true);
  };

  const handleReject = (request: ChChangeRequest) => {
    setSelectedRequest(request);
    setShowRejectDialog(true);
  };

  const handleConfirmApprove = () => {
    if (!selectedRequest) return;
    approveMutation.mutate({ id: selectedRequest.id, notes: actionNotes });
  };

  const handleConfirmReject = () => {
    if (!selectedRequest) return;
    rejectMutation.mutate({ id: selectedRequest.id, notes: actionNotes });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500 text-white"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-500 text-white"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500 text-white"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFieldDisplayName = (fieldName: string | null) => {
    if (!fieldName) return "Unknown Field";
    const displayNames: Record<string, string> = {
      nextAccountsPeriodEnd: "Next Accounts Period End",
      nextAccountsDue: "Next Accounts Due",
      confirmationStatementNextDue: "Confirmation Statement Next Due",
      confirmationStatementNextMadeUpTo: "Confirmation Statement Next Made Up To",
    };
    return displayNames[fieldName] || fieldName;
  };

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
                  Review and approve changes to client Companies House data
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Change Requests</span>
                <Badge variant="outline" data-testid="text-requests-count">
                  {changeRequests?.length || 0} Requests
                </Badge>
              </CardTitle>
              <CardDescription>
                Pending changes detected from nightly Companies House data synchronization
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
              ) : changeRequests && changeRequests.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Field Changed</TableHead>
                      <TableHead>Old Value</TableHead>
                      <TableHead>New Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changeRequests.map((request) => (
                      <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <Building className="w-4 h-4 text-muted-foreground" />
                            <span>{getClientName(request.clientId)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getFieldDisplayName(request.fieldName)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">
                            {formatValue(request.oldValue)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {formatValue(request.newValue)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(request.status)}
                        </TableCell>
                        <TableCell>
                          {request.createdAt ? format(new Date(request.createdAt), "dd/MM/yyyy HH:mm") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(request)}
                              data-testid={`button-view-${request.id}`}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            {request.status === 'pending' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleApprove(request)}
                                  className="text-green-600 hover:bg-green-50"
                                  data-testid={`button-approve-${request.id}`}
                                >
                                  <CheckCircle className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReject(request)}
                                  className="text-red-600 hover:bg-red-50"
                                  data-testid={`button-reject-${request.id}`}
                                >
                                  <XCircle className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">No Change Requests</h3>
                  <p className="text-sm text-muted-foreground">
                    No pending Companies House change requests to review
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change Request Details</DialogTitle>
            <DialogDescription>
              Detailed information about the proposed Companies House data change
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Client</Label>
                  <p className="mt-1">{getClientName(selectedRequest.clientId)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Field</Label>
                <p className="mt-1">{getFieldDisplayName(selectedRequest.fieldName)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Current Value</Label>
                  <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded">
                    <span className="text-red-700">{formatValue(selectedRequest.oldValue)}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">New Value</Label>
                  <div className="mt-1 p-3 bg-green-50 border border-green-200 rounded">
                    <span className="text-green-700">{formatValue(selectedRequest.newValue)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                <p className="mt-1">{selectedRequest.createdAt ? format(new Date(selectedRequest.createdAt), "dd/MM/yyyy 'at' HH:mm") : "Unknown"}</p>
              </div>
              
              {selectedRequest.notes && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
                  <p className="mt-1 text-sm">{selectedRequest.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Change Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this Companies House data change? This action cannot be undone.
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
              disabled={approveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Change Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this Companies House data change?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-notes">Notes (optional)</Label>
            <Textarea
              id="reject-notes"
              placeholder="Explain why this change is being rejected..."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              data-testid="textarea-reject-notes"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActionNotes("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}