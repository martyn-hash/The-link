import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSignature, Check, Clock, Eye, X } from "lucide-react";
import { format } from "date-fns";
import TopNavigation from "@/components/top-navigation";
import BottomNav from "@/components/bottom-nav";
import { useState } from "react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SignatureRequestsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [_location, setLocation] = useLocation();
  const { toast } = useToast();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ['/api/signature-requests'],
    enabled: isAuthenticated,
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
      queryClient.invalidateQueries({ queryKey: ['/api/signature-requests'] });
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
      
      <main className="flex-1 container mx-auto px-4 py-6 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="w-6 h-6" />
            E-Signature Requests
          </h1>
          <p className="text-muted-foreground mt-1">
            View all signature requests across clients. Create new requests from individual client pages.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : !requests || requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileSignature className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No signature requests yet</h3>
              <p className="text-muted-foreground">
                Create signature requests from individual client pages to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {requests.map((item: any) => {
              const request = item.signatureRequest;
              const client = item.client;
              const creator = item.createdByPerson;

              return (
                <Card 
                  key={request.id} 
                  className={client?.id ? "hover:shadow-md transition-shadow cursor-pointer" : ""}
                  onClick={() => client?.id && setLocation(`/clients/${client.id}`)}
                  data-testid={`card-signature-request-${request.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{request.title || "Untitled Document"}</h3>
                          <Badge
                            variant={
                              request.status === 'completed' ? 'default' :
                              request.status === 'partially_signed' ? 'secondary' :
                              request.status === 'pending' ? 'outline' :
                              'destructive'
                            }
                            data-testid={`badge-status-${request.id}`}
                          >
                            {request.status === 'completed' && <Check className="w-3 h-3 mr-1" />}
                            {request.status === 'partially_signed' ? 'Partially Signed' :
                             request.status === 'pending' ? 'Pending' :
                             request.status === 'cancelled' ? 'Cancelled' :
                             request.status}
                          </Badge>
                        </div>

                        {client ? (
                          <div className="text-sm text-muted-foreground">
                            Client: <span className="font-medium">{client.companyName}</span>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground italic">
                            Client not found
                          </div>
                        )}

                        {request.message && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {request.message}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {request.createdAt ? (
                              <>Created {format(new Date(request.createdAt), 'MMM d, yyyy')}</>
                            ) : (
                              <>Created recently</>
                            )}
                          </span>
                          {creator && (
                            <span>
                              by {creator.fullName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Show Cancel button for non-completed, non-cancelled requests */}
                        {(request.status === 'draft' || request.status === 'pending' || request.status === 'partially_signed') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelClick(request.id);
                            }}
                            data-testid={`button-cancel-${request.id}`}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                        {client?.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/clients/${client.id}`);
                            }}
                            data-testid={`button-view-${request.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
