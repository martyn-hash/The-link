import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";

interface PreviewData {
  hasData: boolean;
  message?: string;
  projectId?: string;
  projectName?: string;
  clientName?: string;
  processedContent?: {
    type: 'email' | 'sms' | 'push';
    emailTitle?: string;
    emailBody?: string;
    smsContent?: string;
    pushTitle?: string;
    pushBody?: string;
  };
}

interface NotificationPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: PreviewData | null;
  isLoading: boolean;
}

export function NotificationPreviewDialog({
  open,
  onOpenChange,
  previewData,
  isLoading,
}: NotificationPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-notification-preview">
        <DialogHeader>
          <DialogTitle>Notification Preview</DialogTitle>
          <DialogDescription>
            Preview how this notification will appear with real data
          </DialogDescription>
        </DialogHeader>
        
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {!isLoading && previewData && !previewData.hasData && (
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">
                    No Preview Available
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {previewData.message || "Unable to generate preview with current data."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {!isLoading && previewData?.hasData && previewData.processedContent && (
          <div className="space-y-4">
            {/* Sample Data Info */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Sample Data:</strong> {previewData.clientName}
                  {previewData.projectName && ` - ${previewData.projectName}`}
                </p>
              </CardContent>
            </Card>
            
            {/* Processed Content */}
            {previewData.processedContent.type === 'email' && (
              <div className="space-y-3">
                <div>
                  <Badge variant="outline" className="mb-2">Email</Badge>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Subject:</p>
                          <p className="font-medium" data-testid="preview-email-title">
                            {previewData.processedContent.emailTitle}
                          </p>
                        </div>
                        <div className="border-t pt-3">
                          <p className="text-xs text-muted-foreground mb-2">Body:</p>
                          <div 
                            className="prose prose-sm dark:prose-invert max-w-none"
                            data-testid="preview-email-body"
                            dangerouslySetInnerHTML={{ 
                              __html: DOMPurify.sanitize(previewData.processedContent.emailBody || '') 
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            
            {previewData.processedContent.type === 'sms' && (
              <div>
                <Badge variant="outline" className="mb-2">SMS</Badge>
                <Card>
                  <CardContent className="pt-4">
                    <p className="whitespace-pre-wrap font-mono text-sm" data-testid="preview-sms-content">
                      {previewData.processedContent.smsContent}
                    </p>
                    <p className="text-xs text-muted-foreground mt-3">
                      {previewData.processedContent.smsContent?.length || 0} / 160 characters
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {previewData.processedContent.type === 'push' && (
              <div>
                <Badge variant="outline" className="mb-2">Push Notification</Badge>
                <Card className="max-w-sm">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <p className="font-semibold text-sm" data-testid="preview-push-title">
                        {previewData.processedContent.pushTitle}
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid="preview-push-body">
                        {previewData.processedContent.pushBody}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
