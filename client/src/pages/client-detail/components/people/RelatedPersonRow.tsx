import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, ChevronDown, Eye, Mail, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClientPortalUser } from "@shared/schema";
import { ClientPersonWithPerson } from "../../utils/types";
import { formatPersonName, formatBirthDate } from "../../utils/formatters";

interface RelatedPersonRowProps {
  clientPerson: ClientPersonWithPerson;
  clientId: string;
  clientName: string;
}

export function RelatedPersonRow({
  clientPerson,
  clientId,
  clientName,
}: RelatedPersonRowProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  
  const { data: portalUser, refetch } = useQuery<ClientPortalUser>({
    queryKey: [`/api/portal-user/by-person/${clientPerson.person.id}`],
    enabled: false,
  });

  const personEmail = clientPerson.person.primaryEmail || clientPerson.person.email;
  const hasEmail = Boolean(personEmail);

  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/portal-user/send-invitation", {
        personId: clientPerson.person.id,
        clientId,
        email: personEmail,
        name: formatPersonName(clientPerson.person.fullName),
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
        personId: clientPerson.person.id,
        clientId,
        email: personEmail,
        name: formatPersonName(clientPerson.person.fullName),
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
    refetch();
  }, [refetch]);

  return (
    <>
      <TableRow data-testid={`person-row-${clientPerson.person.id}`}>
        <TableCell className="font-medium">
          <div>
            <div data-testid={`text-person-name-${clientPerson.person.id}`}>
              {formatPersonName(clientPerson.person.fullName)}
            </div>
            {clientPerson.officerRole && (
              <div className="text-xs text-muted-foreground mt-1">
                {clientPerson.officerRole}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm" data-testid={`text-person-primary-email-${clientPerson.person.id}`}>
            {clientPerson.person.primaryEmail || clientPerson.person.email || '-'}
          </span>
        </TableCell>
        <TableCell>
          <span className="text-sm" data-testid={`text-person-primary-phone-${clientPerson.person.id}`}>
            {clientPerson.person.primaryPhone || clientPerson.person.telephone || '-'}
          </span>
        </TableCell>
        <TableCell className="text-center">
          {portalUser?.lastLogin ? (
            <Check className="h-4 w-4 text-green-500 mx-auto" data-testid={`icon-has-app-access-${clientPerson.person.id}`} />
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </TableCell>
        <TableCell className="text-center">
          {portalUser?.pushNotificationsEnabled ? (
            <Check className="h-4 w-4 text-blue-500 mx-auto" data-testid={`icon-push-enabled-${clientPerson.person.id}`} />
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </TableCell>
        <TableCell>
          <span className="text-sm" data-testid={`text-dob-${clientPerson.person.id}`}>
            {clientPerson.person.dateOfBirth ? formatBirthDate(clientPerson.person.dateOfBirth) : '-'}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!hasEmail} data-testid={`button-person-actions-${clientPerson.person.id}`}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => sendInviteMutation.mutate()}
                  disabled={sendInviteMutation.isPending || !hasEmail}
                  data-testid={`action-send-invite-${clientPerson.person.id}`}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send App Invite
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => generateQRMutation.mutate()}
                  disabled={generateQRMutation.isPending || !hasEmail}
                  data-testid={`action-show-qr-${clientPerson.person.id}`}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Show QR Code
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="default"
              size="sm"
              onClick={() => setLocation(`/person/${clientPerson.person.id}`)}
              data-testid={`button-view-person-${clientPerson.person.id}`}
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* QR Code Dialog */}
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Portal Access QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            {qrCodeDataUrl && (
              <img 
                src={qrCodeDataUrl} 
                alt="Portal QR Code" 
                className="w-64 h-64"
                data-testid="qr-code-image"
              />
            )}
            <p className="text-sm text-muted-foreground text-center">
              Scan this QR code to access the client portal
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
