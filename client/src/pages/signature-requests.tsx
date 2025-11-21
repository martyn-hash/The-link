import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSignature, Check, Eye, X, Clock } from "lucide-react";
import { format } from "date-fns";
import TopNavigation from "@/components/top-navigation";
import BottomNav from "@/components/bottom-nav";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SignatureRequestRowProps {
  item: any;
  onCancelClick: (requestId: string) => void;
  onViewClick: (clientId: string) => void;
}

function SignatureRequestRow({ item, onCancelClick, onViewClick }: SignatureRequestRowProps) {
  const isMobile = useIsMobile();
  const request = item.signatureRequest;
  const client = item.client;
  const creator = item.createdByPerson;

  // Get signed/total count
  const signedCount = item.recipients?.filter((r: any) => r.signedAt).length || 0;
  const totalCount = item.recipients?.length || 0;

  if (isMobile) {
    // Mobile card view
    return (
      <Card 
        className="mb-3"
        data-testid={`card-signature-request-${request.id}`}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate" data-testid={`text-title-${request.id}`}>
                  {request.title || "Untitled Document"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1" data-testid={`text-client-${request.id}`}>
                  {client?.companyName || "Unknown Client"}
                </p>
              </div>
              <Badge
                variant={
                  request.status === 'completed' ? 'default' :
                  request.status === 'partially_signed' ? 'secondary' :
                  request.status === 'pending' ? 'outline' :
                  'destructive'
                }
                className="text-xs shrink-0"
                data-testid={`badge-status-${request.id}`}
              >
                {request.status === 'completed' && <Check className="w-3 h-3 mr-1" />}
                {request.status === 'partially_signed' ? 'Partially Signed' :
                 request.status === 'pending' ? 'Pending' :
                 request.status === 'cancelled' ? 'Cancelled' :
                 request.status}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {totalCount > 0 && (
                <span data-testid={`text-signees-${request.id}`}>
                  {signedCount}/{totalCount} signed
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {request.createdAt ? format(new Date(request.createdAt), 'MMM d, yyyy') : '-'}
              </span>
            </div>

            {creator && (
              <p className="text-xs text-muted-foreground">
                by {creator.fullName}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              {(request.status === 'draft' || request.status === 'pending' || request.status === 'partially_signed') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancelClick(request.id)}
                  data-testid={`button-cancel-${request.id}`}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              )}
              {client?.id && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onViewClick(client.id)}
                  data-testid={`button-view-${request.id}`}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Client
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Desktop table row
  return (
    <TableRow data-testid={`row-${request.id}`}>
      <TableCell className="font-medium">
        <span data-testid={`text-title-${request.id}`}>
          {request.title || "Untitled Document"}
        </span>
      </TableCell>
      
      <TableCell>
        <span className="text-sm" data-testid={`text-client-${request.id}`}>
          {client?.companyName || '-'}
        </span>
      </TableCell>
      
      <TableCell>
        <Badge
          variant={
            request.status === 'completed' ? 'default' :
            request.status === 'partially_signed' ? 'secondary' :
            request.status === 'pending' ? 'outline' :
            'destructive'
          }
          className="text-xs"
          data-testid={`badge-status-${request.id}`}
        >
          {request.status === 'completed' && <Check className="w-3 h-3 mr-1" />}
          {request.status === 'partially_signed' ? 'Partially Signed' :
           request.status === 'pending' ? 'Pending' :
           request.status === 'cancelled' ? 'Cancelled' :
           request.status}
        </Badge>
      </TableCell>
      
      <TableCell>
        <span className="text-sm" data-testid={`text-signees-${request.id}`}>
          {totalCount > 0 ? `${signedCount}/${totalCount}` : '-'}
        </span>
      </TableCell>
      
      <TableCell>
        <span className="text-sm">
          {request.createdAt ? format(new Date(request.createdAt), 'MMM d, yyyy') : '-'}
        </span>
      </TableCell>

      <TableCell>
        <span className="text-sm text-muted-foreground">
          {creator?.fullName || '-'}
        </span>
      </TableCell>
      
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {(request.status === 'draft' || request.status === 'pending' || request.status === 'partially_signed') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCancelClick(request.id)}
              data-testid={`button-cancel-${request.id}`}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )}
          {client?.id && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onViewClick(client.id)}
              data-testid={`button-view-${request.id}`}
            >
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function SignatureRequestsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [_location, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const { data: allRequests, isLoading } = useQuery<any[]>({
    queryKey: ['/api/signature-requests'],
    queryFn: async () => {
      const response = await fetch('/api/signature-requests', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch signature requests');
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Filter to only show pending and partially_signed requests
  const requests = allRequests?.filter((item: any) => {
    const status = item.signatureRequest?.status;
    return status === 'pending' || status === 'partially_signed';
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const response = await fetch(`/api/signature-requests/${requestId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ cancellation_reason: reason }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel signature request");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === '/api/signature-requests'
      });
      toast({
        title: "Success",
        description: "Signature request cancelled successfully",
      });
      setCancelDialogOpen(false);
      setRequestToCancel(null);
      setCancellationReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel signature request",
        variant: "destructive",
      });
    },
  });

  const handleCancelClick = (requestId: string) => {
    setRequestToCancel(requestId);
    setCancellationReason("");
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = () => {
    if (!requestToCancel || !cancellationReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a cancellation reason",
        variant: "destructive",
      });
      return;
    }
    cancelMutation.mutate({ requestId: requestToCancel, reason: cancellationReason.trim() });
  };

  const handleViewClick = (clientId: string) => {
    setLocation(`/clients/${clientId}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0A7BBF]/5 via-white to-[#76CA23]/5 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <TopNavigation />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
              <FileSignature className="w-6 h-6 md:w-7 md:h-7" />
              E-Signature Requests
            </h1>
            <p className="text-meta mt-1">
              Active signature requests requiring completion. Create new requests from individual client pages.
            </p>
          </div>
        </div>
      </div>

      <main className="flex-1 w-full px-4 md:px-6 lg:px-8 py-6 md:py-8 pb-24 space-y-8">

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !requests || requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileSignature className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No active signature requests</h3>
              <p className="text-muted-foreground text-center">
                All signature requests have been completed or there are no pending requests.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {isMobile ? (
              // Mobile card view
              <div>
                {requests.map((item: any) => (
                  <SignatureRequestRow
                    key={item.signatureRequest.id}
                    item={item}
                    onCancelClick={handleCancelClick}
                    onViewClick={handleViewClick}
                  />
                ))}
              </div>
            ) : (
              // Desktop table view
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Signees</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((item: any) => (
                      <SignatureRequestRow
                        key={item.signatureRequest.id}
                        item={item}
                        onCancelClick={handleCancelClick}
                        onViewClick={handleViewClick}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav onSearchClick={() => setLocation("/search")} />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent data-testid="dialog-cancel-signature-request">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Signature Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this signature request? This action cannot be undone.
              Please provide a reason for cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="cancellation-reason">Cancellation Reason</Label>
            <Textarea
              id="cancellation-reason"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Please explain why this signature request is being cancelled..."
              className="min-h-[100px]"
              data-testid="input-cancellation-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setCancelDialogOpen(false);
                setCancellationReason("");
                setRequestToCancel(null);
              }}
              data-testid="button-cancel-dialog-close"
            >
              Keep Request
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={!cancellationReason.trim() || cancelMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-cancel-dialog-confirm"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
