import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Clock, Monitor, Globe, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface AuditEvent {
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
  createdAt: string | null;
}

interface RecipientAuditData {
  recipientNumber: number;
  recipientId: string;
  personName: string | null;
  email: string;
  signedAt: string | null;
  status: 'signed' | 'pending';
  auditEvents: AuditEvent[];
}

interface AuditTrailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditLogs: RecipientAuditData[];
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
              No recipients found for this signature request.
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
          {auditLogs.map((recipient, index) => {
            // Get the most recent signature completion event for device/IP info
            const signatureEvent = recipient.auditEvents.find(e => e.eventType === 'signature_completed');
            
            return (
              <div key={recipient.recipientId} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-normal">
                        Recipient {recipient.recipientNumber}
                      </Badge>
                      <Badge 
                        variant={recipient.status === 'signed' ? "default" : "secondary"}
                        className={recipient.status === 'signed' ? "bg-green-600" : ""}
                      >
                        {recipient.status === 'signed' ? (
                          <><CheckCircle2 className="w-3 h-3 mr-1" /> Signed</>
                        ) : (
                          <><AlertCircle className="w-3 h-3 mr-1" /> Pending</>
                        )}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      {/* Recipient Information */}
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Recipient Information</h4>
                        <p className="text-sm">
                          <span className="font-medium">{recipient.personName || recipient.email}</span>
                          <br />
                          <span className="text-muted-foreground">{recipient.email}</span>
                        </p>
                      </div>

                      {/* Show details only if signed */}
                      {recipient.status === 'signed' && signatureEvent ? (
                        <>
                          {/* Timestamp */}
                          {recipient.signedAt && (
                            <div className="flex items-start gap-2">
                              <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                              <div className="text-sm">
                                <p className="font-medium">Signed At</p>
                                <p className="text-muted-foreground">
                                  {format(new Date(recipient.signedAt), 'MMMM d, yyyy \'at\' h:mm:ss a')}
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
                                {signatureEvent.deviceInfo} • {signatureEvent.browserInfo}
                                <br />
                                {signatureEvent.osInfo}
                              </p>
                            </div>
                          </div>

                          {/* IP Address */}
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                            <div className="text-sm">
                              <p className="font-medium">IP Address</p>
                              <p className="text-muted-foreground font-mono">{signatureEvent.ipAddress}</p>
                            </div>
                          </div>

                          {/* Authentication Method */}
                          <div className="flex items-start gap-2">
                            <Globe className="w-4 h-4 mt-0.5 text-muted-foreground" />
                            <div className="text-sm">
                              <p className="font-medium">Authentication</p>
                              <p className="text-muted-foreground">
                                {signatureEvent.authMethod === 'email_link' 
                                  ? 'Secure Email Link' 
                                  : signatureEvent.authMethod}
                              </p>
                            </div>
                          </div>

                          {/* Consent */}
                          {signatureEvent.consentAcceptedAt && (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs font-medium mb-1">
                                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                                Electronic Signature Consent
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Accepted on {format(new Date(signatureEvent.consentAcceptedAt), 'MMMM d, yyyy \'at\' h:mm:ss a')}
                              </p>
                              {signatureEvent.metadata?.consentText && (
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                  "{signatureEvent.metadata.consentText}"
                                </p>
                              )}
                            </div>
                          )}

                          {/* Document Hash */}
                          <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-xs font-medium mb-1">Document Integrity Hash (SHA-256)</p>
                            <p className="text-xs text-muted-foreground font-mono break-all">
                              {signatureEvent.documentHash}
                            </p>
                          </div>

                          {/* Audit Events Timeline */}
                          {recipient.auditEvents.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-xs font-medium mb-2">Activity Timeline</p>
                              <div className="space-y-2">
                                {recipient.auditEvents.map((event) => (
                                  <div key={event.id} className="text-xs text-muted-foreground flex items-start gap-2">
                                    <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <span className="font-medium">
                                        {event.eventType === 'document_opened' && 'Document Opened'}
                                        {event.eventType === 'consent_viewed' && 'Consent Viewed'}
                                        {event.eventType === 'signature_completed' && 'Signature Completed'}
                                        {event.eventType === 'session_claimed' && 'Session Started'}
                                        {!['document_opened', 'consent_viewed', 'signature_completed', 'session_claimed'].includes(event.eventType) && event.eventType}
                                      </span>
                                      {event.createdAt && (
                                        <span className="ml-2">
                                          {format(new Date(event.createdAt), 'MMM d, yyyy h:mm:ss a')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <AlertCircle className="w-4 h-4 inline mr-1" />
                            This recipient has not yet signed the document
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {index < auditLogs.length - 1 && <Separator className="my-4" />}
              </div>
            );
          })}

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
