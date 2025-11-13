import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Clock, Monitor, Globe, MapPin, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  eventType: string;
  signerName: string;
  signerEmail: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;
  browserInfo: string;
  osInfo: string;
  consentAcceptedAt: string | null;
  signedAt: string | null;
  documentHash: string;
  authMethod: string;
  metadata: any;
}

interface AuditTrailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditLogs: AuditLog[];
  documentName?: string;
}

export function AuditTrailDialog({
  open,
  onOpenChange,
  auditLogs,
  documentName = "Document",
}: AuditTrailDialogProps) {
  if (!auditLogs || auditLogs.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Audit Trail
            </DialogTitle>
            <DialogDescription>
              No audit trail entries found for this document.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Electronic Signature Audit Trail
          </DialogTitle>
          <DialogDescription>
            Complete audit trail for {documentName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {auditLogs.map((log, index) => (
            <div key={log.id} className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="font-normal">
                      Signer {index + 1}
                    </Badge>
                    <Badge 
                      variant={log.signedAt ? "default" : "secondary"}
                      className={log.signedAt ? "bg-green-600" : ""}
                    >
                      {log.signedAt ? (
                        <><CheckCircle2 className="w-3 h-3 mr-1" /> Signed</>
                      ) : (
                        "Pending"
                      )}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {/* Signer Information */}
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Signer Information</h4>
                      <p className="text-sm">
                        <span className="font-medium">{log.signerName}</span>
                        <br />
                        <span className="text-muted-foreground">{log.signerEmail}</span>
                      </p>
                    </div>

                    {/* Timestamp */}
                    {log.signedAt && (
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div className="text-sm">
                          <p className="font-medium">Signed At</p>
                          <p className="text-muted-foreground">
                            {format(new Date(log.signedAt), 'MMMM d, yyyy \'at\' h:mm:ss a')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Device & Browser Information */}
                    <div className="flex items-start gap-2">
                      <Monitor className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="text-sm">
                        <p className="font-medium">Device & Browser</p>
                        <p className="text-muted-foreground">
                          {log.deviceInfo} • {log.browserInfo}
                          <br />
                          {log.osInfo}
                        </p>
                      </div>
                    </div>

                    {/* IP Address */}
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="text-sm">
                        <p className="font-medium">IP Address</p>
                        <p className="text-muted-foreground font-mono">{log.ipAddress}</p>
                      </div>
                    </div>

                    {/* Authentication Method */}
                    <div className="flex items-start gap-2">
                      <Globe className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <div className="text-sm">
                        <p className="font-medium">Authentication</p>
                        <p className="text-muted-foreground">
                          {log.authMethod === 'email_link' 
                            ? 'Secure Email Link' 
                            : log.authMethod}
                        </p>
                      </div>
                    </div>

                    {/* Consent */}
                    {log.consentAcceptedAt && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs font-medium mb-1">
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          Electronic Signature Consent
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Accepted on {format(new Date(log.consentAcceptedAt), 'MMMM d, yyyy \'at\' h:mm:ss a')}
                        </p>
                        {log.metadata?.consentText && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            "{log.metadata.consentText}"
                          </p>
                        )}
                      </div>
                    )}

                    {/* Document Hash */}
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs font-medium mb-1">Document Integrity Hash (SHA-256)</p>
                      <p className="text-xs text-muted-foreground font-mono break-all">
                        {log.documentHash}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {index < auditLogs.length - 1 && <Separator className="my-4" />}
            </div>
          ))}

          {/* Footer Information */}
          <div className="border-t pt-4 mt-6">
            <p className="text-xs text-muted-foreground">
              This audit trail is maintained in accordance with UK eIDAS regulations for electronic signatures.
              All timestamps are recorded in UTC and converted to your local timezone for display.
              The document hash provides cryptographic verification of document integrity.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
