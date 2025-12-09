import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, XCircle, CheckCircle2, Building2 } from "lucide-react";

interface InvalidVatModalProps {
  isOpen: boolean;
  onClose: () => void;
  vatNumber: string;
  error?: string;
  errorCode?: string;
}

export function InvalidVatModal({ isOpen, onClose, vatNumber, error, errorCode }: InvalidVatModalProps) {
  const getErrorAdvice = () => {
    if (errorCode === 'INVALID_FORMAT') {
      return {
        title: "Invalid VAT Number Format",
        advice: [
          "UK VAT numbers should be 9 or 12 digits",
          "Examples of valid formats:",
          "• 123456789",
          "• GB123456789",
          "• GB 123 4567 89",
          "• 123456789012 (12-digit branch number)",
        ],
        tip: "Make sure to remove any extra spaces or special characters other than the GB prefix."
      };
    }
    
    if (errorCode === 'NOT_FOUND') {
      return {
        title: "VAT Number Not Found",
        advice: [
          "This VAT number was not found in HMRC's records.",
          "Please check that:",
          "• The number is entered correctly",
          "• The business is VAT registered",
          "• The registration is still active",
        ],
        tip: "You can verify VAT numbers on the official HMRC website."
      };
    }
    
    if (errorCode === 'NO_CREDENTIALS') {
      return {
        title: "HMRC API Not Configured",
        advice: [
          "The HMRC VAT validation service is not currently available.",
          "Please contact your system administrator to configure the HMRC API credentials.",
        ],
        tip: "VAT validation requires HMRC API access to verify numbers."
      };
    }
    
    return {
      title: "Validation Failed",
      advice: [
        "We couldn't validate this VAT number at this time.",
        error || "Please try again later or contact support if the problem persists.",
      ],
      tip: "If this issue continues, the HMRC service may be temporarily unavailable."
    };
  };

  const errorInfo = getErrorAdvice();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="modal-invalid-vat">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <DialogTitle className="text-center">{errorInfo.title}</DialogTitle>
          <DialogDescription className="text-center">
            VAT Number: <span className="font-mono font-medium">{vatNumber}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            {errorInfo.advice.map((line, index) => (
              <p key={index} className="text-sm text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
          
          {errorInfo.tip && (
            <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{errorInfo.tip}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full" data-testid="button-close-invalid-vat-modal">
            Got it, I'll check the number
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CompanyNameMismatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  vatNumber: string;
  hmrcCompanyName: string;
  clientCompanyName: string;
  isPending?: boolean;
}

export function CompanyNameMismatchModal({ 
  isOpen, 
  onClose, 
  onProceed, 
  vatNumber, 
  hmrcCompanyName, 
  clientCompanyName,
  isPending 
}: CompanyNameMismatchModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-company-name-mismatch">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center">Company Name Mismatch</DialogTitle>
          <DialogDescription className="text-center">
            The VAT registration name doesn't match this client's name
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client Name in System</p>
                <p className="font-medium" data-testid="text-client-name">{clientCompanyName}</p>
              </div>
            </div>
            
            <div className="border-t" />
            
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">HMRC VAT Registration</p>
                <p className="font-medium" data-testid="text-hmrc-company-name">{hmrcCompanyName}</p>
                <p className="text-xs text-muted-foreground font-mono mt-1">VAT: {vatNumber}</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium mb-1">Why might this happen?</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-300">
              <li>Trading name differs from legal name</li>
              <li>Company name has changed since VAT registration</li>
              <li>VAT number belongs to a parent or subsidiary company</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="w-full sm:w-auto"
            disabled={isPending}
            data-testid="button-cancel-mismatch"
          >
            Go Back
          </Button>
          <Button 
            onClick={onProceed} 
            className="w-full sm:w-auto"
            disabled={isPending}
            data-testid="button-proceed-mismatch"
          >
            {isPending ? "Saving..." : "Proceed Anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
