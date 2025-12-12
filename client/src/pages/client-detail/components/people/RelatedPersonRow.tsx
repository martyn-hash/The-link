import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, ChevronDown, Eye, Mail, QrCode, Star, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import type { ClientPortalUser } from "@shared/schema";
import { ClientPersonWithPerson } from "../../utils/types";
import { formatPersonName, formatBirthDate } from "../../utils/formatters";
import { QuickViewPersonModal } from "./QuickViewPersonModal";

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
  const [showQuickView, setShowQuickView] = useState(false);
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
      showFriendlyError({
        error,
        fallbackTitle: "Couldn't Send Invitation",
        fallbackDescription: "Something went wrong while sending the portal invitation. Please check the email address and try again."
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
      showFriendlyError({
        error,
        fallbackTitle: "Couldn't Generate QR Code",
        fallbackDescription: "Something went wrong while creating the QR code. Please try again in a moment."
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
            <div className="flex items-center gap-2">
              <span data-testid={`text-person-name-${clientPerson.person.id}`}>
                {formatPersonName(clientPerson.person.fullName)}
              </span>
              {clientPerson.isPrimaryContact && (
                <Badge className="bg-blue-600 text-white" data-testid={`badge-primary-contact-${clientPerson.person.id}`}>
                  <Star className="h-3 w-3 mr-1" />
                  Primary
                </Badge>
              )}
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickView(true)}
                    data-testid={`button-quick-view-person-${clientPerson.person.id}`}
                  >
                    <FileSearch className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Quick view</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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

      {/* Quick View Modal */}
      <QuickViewPersonModal
        clientPerson={clientPerson}
        open={showQuickView}
        onOpenChange={setShowQuickView}
      />

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
