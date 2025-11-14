import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Check, Download, Shield, FileSignature, X } from "lucide-react";
import { format } from "date-fns";
import { AuditTrailDialog } from "@/components/AuditTrailDialog";
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
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SignatureRequestsPanelProps {
  clientId: string;
}

export function SignatureRequestsPanel({ clientId }: SignatureRequestsPanelProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [currentAuditTrail, setCurrentAuditTrail] = useState<any[]>([]);
  const [currentDocumentName, setCurrentDocumentName] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const { data: signatureRequests, isLoading } = useQuery<any[]>({
    queryKey: ['/api/signature-requests/client', clientId],
    enabled: !!clientId,
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
      queryClient.invalidateQueries({ queryKey: ['/api/signature-requests/client', clientId] });
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

  const handleDownload = async (requestId: string) => {
    try {
      const response = await fetch(`/api/signature-requests/${requestId}/signed-document`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch signed document');
      }
      
      const signedDoc = await response.json();
      
      if (!signedDoc || !signedDoc.id) {
        throw new Error('Signed document not found');
      }
      
      window.open(`/api/signed-documents/${signedDoc.id}/download`, '_blank');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not download signed document",
        variant: "destructive",
      });
    }
  };

  const handleAuditTrail = async (requestId: string, documentName: string) => {
    try {
      const auditTrail = await fetch(`/api/signature-requests/${requestId}/audit-trail`).then(r => r.json());
      setCurrentAuditTrail(auditTrail);
      setCurrentDocumentName(documentName);
      setAuditDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not load audit trail",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!signatureRequests || signatureRequests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No signature requests yet</p>
        <p className="text-sm">Use the "Create Signature Request" button above to send documents for e-signature</p>
      </div>
    );
  }

  // Mobile Card View (preserving existing mobile-friendly layout)
  if (isMobile) {
    return (
      <>
        <div className="space-y-3">
          {signatureRequests.map((request: any) => (
            <Card 
              key={request.id} 
              className="border-l-4"
              style={{
                borderLeftColor:
                  request.status === 'completed' ? '#76CA23' :
                  request.status === 'partially_signed' ? '#FFA500' :
                  request.status === 'pending' ? '#0A7BBF' :
                  request.status === 'cancelled' ? '#999' :
                  '#ccc'
              }}
              data-testid={`card-signature-request-${request.id}`}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 justify-between">
                    <h4 className="font-medium" data-testid={`text-name-${request.id}`}>
                      {request.friendlyName || "Untitled Document"}
                    </h4>
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
                  <p className="text-sm text-muted-foreground" data-testid={`text-date-${request.id}`}>
                    Created {format(new Date(request.createdAt), 'MMM d, yyyy')}
                    {request.completedAt && (
                      <> • Completed {format(new Date(request.completedAt), 'MMM d, yyyy')}</>
                    )}
                  </p>
                  <div className="flex gap-2">
                    {(request.status === 'draft' || request.status === 'pending' || request.status === 'partially_signed') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelClick(request.id)}
                        className="flex-1"
                        data-testid={`button-cancel-${request.id}`}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                    {request.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(request.id)}
                        className="flex-1"
                        data-testid={`button-download-${request.id}`}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAuditTrail(request.id, request.friendlyName || "Untitled Document")}
                      className="flex-1"
                      data-testid={`button-audit-trail-${request.id}`}
                    >
                      <Shield className="w-4 h-4 mr-1" />
                      Audit Trail
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <AuditTrailDialog
          open={auditDialogOpen}
          onOpenChange={setAuditDialogOpen}
          auditLogs={currentAuditTrail}
          documentName={currentDocumentName}
        />
      </>
    );
  }

  // Desktop Table View (following data_view_guidelines.md)
  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signatureRequests.map((request: any) => (
              <TableRow key={request.id} data-testid={`row-${request.id}`}>
                <TableCell className="font-medium">
                  <span data-testid={`text-name-${request.id}`}>
                    {request.friendlyName || "Untitled Document"}
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
                  <span className="text-sm" data-testid={`text-created-${request.id}`}>
                    {format(new Date(request.createdAt), 'MMM d, yyyy')}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm" data-testid={`text-completed-${request.id}`}>
                    {request.completedAt ? format(new Date(request.completedAt), 'MMM d, yyyy') : '-'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {(request.status === 'draft' || request.status === 'pending' || request.status === 'partially_signed') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelClick(request.id)}
                        data-testid={`button-cancel-${request.id}`}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                    {request.status === 'completed' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleDownload(request.id)}
                        data-testid={`button-download-${request.id}`}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAuditTrail(request.id, request.friendlyName || "Untitled Document")}
                      data-testid={`button-audit-trail-${request.id}`}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Audit Trail
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <AuditTrailDialog
        open={auditDialogOpen}
        onOpenChange={setAuditDialogOpen}
        auditLogs={currentAuditTrail}
        documentName={currentDocumentName}
      />

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
    </>
  );
}
