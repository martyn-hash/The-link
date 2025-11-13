import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, Download, Shield, FileSignature } from "lucide-react";
import { format } from "date-fns";
import { AuditTrailDialog } from "@/components/AuditTrailDialog";
import { useState } from "react";

interface SignatureRequestsPanelProps {
  clientId: string;
}

export function SignatureRequestsPanel({ clientId }: SignatureRequestsPanelProps) {
  const { toast } = useToast();
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [currentAuditTrail, setCurrentAuditTrail] = useState<any[]>([]);
  const [currentDocumentName, setCurrentDocumentName] = useState("");

  const { data: signatureRequests, isLoading } = useQuery<any[]>({
    queryKey: ['/api/signature-requests/client', clientId],
    enabled: !!clientId,
  });

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
        <p className="text-sm">Use the "Request Signature" button above to send documents for e-signature</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {signatureRequests.map((request: any) => (
        <div
          key={request.id}
          className="border border-l-4 rounded-lg"
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
          <div className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{request.documentName || "Untitled Document"}</h4>
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
                <p className="text-sm text-muted-foreground">
                  {request.createdAt ? (
                    <>Created {format(new Date(request.createdAt), 'MMM d, yyyy')}</>
                  ) : (
                    <>Created recently</>
                  )}
                  {request.completedAt && (
                    <> • Completed {format(new Date(request.completedAt), 'MMM d, yyyy')}</>
                  )}
                </p>
                {request.emailMessage && (
                  <p className="text-sm italic text-muted-foreground border-l-2 pl-3">
                    "{request.emailMessage}"
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {request.status === 'completed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const signedDoc = await fetch(`/api/signature-requests/${request.id}/signed-document`).then(r => r.json());
                        window.open(`/api/signed-documents/${signedDoc.id}/download`, '_blank');
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Could not download signed document",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid={`button-download-${request.id}`}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      const auditTrail = await fetch(`/api/signature-requests/${request.id}/audit-trail`).then(r => r.json());
                      setCurrentAuditTrail(auditTrail);
                      setCurrentDocumentName(request.documentName || "Untitled Document");
                      setAuditDialogOpen(true);
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Could not load audit trail",
                        variant: "destructive",
                      });
                    }
                  }}
                  data-testid={`button-audit-trail-${request.id}`}
                >
                  <Shield className="w-4 h-4 mr-1" />
                  Audit Trail
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
      
      <AuditTrailDialog
        open={auditDialogOpen}
        onOpenChange={setAuditDialogOpen}
        auditLogs={currentAuditTrail}
        documentName={currentDocumentName}
      />
    </div>
  );
}
