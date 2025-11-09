import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, ArrowLeft, User, Building2, Search, Sparkles } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DOMPurify from "isomorphic-dompurify";

interface PreviewCandidate {
  personId: string;
  personName: string;
  personEmail: string | null;
  personPhone: string | null;
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  projectStatus: string;
  projectDueDate: string | null;
  projectStartDate: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
  pushOptIn: boolean;
}

interface PreviewData {
  hasData: boolean;
  mode?: 'real' | 'dummy';
  message?: string;
  personId?: string;
  personName?: string;
  projectId?: string;
  projectDescription?: string;
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

interface Notification {
  id: string;
  notificationType: 'email' | 'sms' | 'push';
}

interface ProjectTypeNotificationPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: Notification | null;
  projectTypeId: string;
}

export function ProjectTypeNotificationPreviewDialog({
  open,
  onOpenChange,
  notification,
  projectTypeId,
}: ProjectTypeNotificationPreviewDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const channel = notification?.notificationType;
  
  // Step 1: Fetch preview candidates
  const { data: candidatesData, isLoading: isLoadingCandidates } = useQuery<{
    candidates: PreviewCandidate[];
    total: number;
  }>({
    queryKey: ['/api/project-types', projectTypeId, 'preview-candidates', { channel, search: searchQuery }],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (channel) {
        queryParams.set('channel', channel);
      }
      if (searchQuery) {
        queryParams.set('search', searchQuery);
      }
      
      const url = `/api/project-types/${projectTypeId}/preview-candidates?${queryParams}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch preview candidates');
      }
      
      return response.json();
    },
    enabled: open && step === 1 && !!notification,
  });
  
  // Step 2: Fetch preview with selected person or dummy data
  const previewMutation = useMutation({
    mutationFn: async (params: { personId?: string; mode?: 'dummy' }) => {
      if (!notification) return null;
      
      const queryParams = new URLSearchParams();
      if (params.personId) {
        queryParams.set('personId', params.personId);
      }
      if (params.mode === 'dummy') {
        queryParams.set('mode', 'dummy');
      }
      
      const response = await fetch(
        `/api/project-types/${projectTypeId}/notifications/${notification.id}/preview?${queryParams}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch preview');
      }
      
      return response.json();
    },
  });
  
  const handleSelectPerson = (personId: string) => {
    setSelectedPersonId(personId);
    previewMutation.mutate({ personId });
    setStep(2);
  };
  
  const handleUseDummyData = () => {
    setSelectedPersonId(null);
    previewMutation.mutate({ mode: 'dummy' });
    setStep(2);
  };
  
  const handleBack = () => {
    setStep(1);
    setSelectedPersonId(null);
    previewMutation.reset();
  };
  
  const handleClose = (isOpen: boolean) => {
    onOpenChange(isOpen);
    // Only reset state when actually closing
    if (!isOpen) {
      setTimeout(() => {
        setStep(1);
        setSelectedPersonId(null);
        setSearchQuery("");
        previewMutation.reset();
      }, 200);
    }
  };
  
  const previewData = previewMutation.data as PreviewData | null;
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="dialog-notification-preview">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 2 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="mr-2"
                data-testid="button-back-to-selection"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            Notification Preview
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? "Select a person to preview with their real data, or use dummy data"
              : "Preview how this notification will appear"
            }
          </DialogDescription>
        </DialogHeader>
        
        {/* Step 1: Person Selection */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by person name, email, or client name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-candidates"
              />
            </div>
            
            {/* Dummy Data Button */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleUseDummyData}
              data-testid="button-use-dummy-data"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Use Dummy Data (Sample Preview)
            </Button>
            
            {/* Loading State */}
            {isLoadingCandidates && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            
            {/* Empty State */}
            {!isLoadingCandidates && candidatesData && candidatesData.candidates.length === 0 && (
              <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-900 dark:text-yellow-100">
                        No Active Projects Found
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        {searchQuery 
                          ? "No people or clients match your search. Try different keywords or use dummy data."
                          : "No active projects found for this notification type. Use dummy data to preview the template."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Candidates List */}
            {!isLoadingCandidates && candidatesData && candidatesData.candidates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {candidatesData.total} {candidatesData.total === 1 ? 'person' : 'people'} with active projects
                </p>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {candidatesData.candidates.map((candidate) => (
                    <Card 
                      key={`${candidate.personId}-${candidate.clientId}`}
                      className="hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleSelectPerson(candidate.personId)}
                      data-testid={`candidate-${candidate.personId}`}
                    >
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate">{candidate.personName}</span>
                              {!candidate.hasEmail && channel === 'email' && (
                                <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950/20">
                                  No Email
                                </Badge>
                              )}
                              {!candidate.hasPhone && channel === 'sms' && (
                                <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950/20">
                                  No Phone
                                </Badge>
                              )}
                              {!candidate.pushOptIn && channel === 'push' && (
                                <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950/20">
                                  No Push
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{candidate.clientName}</span>
                            </div>
                            
                            <p className="text-xs text-muted-foreground truncate">
                              Project: {candidate.projectName || 'Untitled'}
                              {candidate.projectDueDate && ` • Due: ${new Date(candidate.projectDueDate).toLocaleDateString()}`}
                            </p>
                          </div>
                          
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectPerson(candidate.personId);
                            }}
                            data-testid={`button-select-${candidate.personId}`}
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Step 2: Preview Display */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto">
            {previewMutation.isPending && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            
            {!previewMutation.isPending && previewData && !previewData.hasData && (
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
            
            {!previewMutation.isPending && previewData?.hasData && previewData.processedContent && (
              <div className="space-y-4">
                {/* Sample Data Info */}
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    {previewData.mode === 'dummy' ? (
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        <p className="text-sm">
                          <strong>Using Dummy Data:</strong> This is a sample preview with placeholder values
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        <strong>Preview Data:</strong> {previewData.personName || previewData.clientName}
                        {previewData.clientName && previewData.personName && ` - ${previewData.clientName}`}
                        {previewData.projectDescription && ` • ${previewData.projectDescription}`}
                      </p>
                    )}
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
