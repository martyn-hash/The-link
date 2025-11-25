import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClientPortalUser } from "@shared/schema";
import { formatPersonName } from "../utils/formatters";

interface PortalStatusColumnProps {
  personId: string;
  personEmail: string | null;
  personName: string;
  clientId: string;
  clientName: string;
}

export function PortalStatusColumn({ 
  personId, 
  personEmail, 
  personName, 
  clientId, 
  clientName 
}: PortalStatusColumnProps) {
  const { toast } = useToast();
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  
  const { data: portalUser, isLoading, refetch } = useQuery<ClientPortalUser>({
    queryKey: [`/api/portal-user/by-person/${personId}`],
    enabled: false,
  });
  
  const hasEmail = Boolean(personEmail);
  
  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/portal-user/send-invitation", {
        personId,
        clientId,
        email: personEmail,
        name: formatPersonName(personName),
        clientName,
      });
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent",
        description: `Portal invitation sent to ${personEmail}`,
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });
  
  const generateQRMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/portal-user/generate-qr-code", {
        personId,
        clientId,
        email: personEmail,
        name: formatPersonName(personName),
      });
    },
    onSuccess: (data: any) => {
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setShowQRCode(true);
      toast({
        title: "QR Code Generated",
        description: "Scan to access portal",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to generate QR code",
        variant: "destructive",
      });
    },
  });
  
  useEffect(() => {
    if (hasEmail) {
      refetch();
    }
  }, [hasEmail, refetch]);
  
  if (!hasEmail) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Portal Access</div>
        <p className="text-sm text-muted-foreground italic">No email available</p>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Portal Access</div>
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Portal Access</div>
      
      {portalUser && (
        <div className="space-y-2">
          {portalUser.lastLogin && (
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">
                Has App Access
              </span>
            </div>
          )}
          {portalUser.pushNotificationsEnabled && (
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">
                Push Enabled
              </span>
            </div>
          )}
        </div>
      )}
      
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          onClick={() => sendInviteMutation.mutate()}
          disabled={sendInviteMutation.isPending}
          data-testid={`button-send-portal-invite-${personId}`}
          className="w-full h-11 text-xs"
        >
          {sendInviteMutation.isPending ? "Sending..." : "Send Invite"}
        </Button>
        
        <Button
          variant="outline"
          onClick={() => generateQRMutation.mutate()}
          disabled={generateQRMutation.isPending}
          data-testid={`button-generate-qr-${personId}`}
          className="w-full h-11 text-xs"
        >
          {generateQRMutation.isPending ? "Generating..." : "Show QR Code"}
        </Button>
      </div>
      
      {qrCodeDataUrl && (
        <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Portal Login QR Code</DialogTitle>
              <DialogDescription>
                Scan this QR code to access the portal
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-4">
              <img 
                src={qrCodeDataUrl} 
                alt="Portal Login QR Code"
                className="max-w-full h-auto"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
