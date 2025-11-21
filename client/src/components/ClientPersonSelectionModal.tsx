import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, User, Building2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import type { PreviewCandidate, PreviewCandidateRecipient } from "@shared/schema";

interface ClientPersonSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: PreviewCandidate[];
  hasEligibleCandidates: boolean;
  message?: string;
  isLoading: boolean;
  onSelect: (clientId: string, projectId: string, personId: string) => void;
}

export function ClientPersonSelectionModal({
  open,
  onOpenChange,
  candidates,
  hasEligibleCandidates,
  message,
  isLoading,
  onSelect,
}: ClientPersonSelectionModalProps) {
  const [selectedCandidateKey, setSelectedCandidateKey] = useState<string>("");
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");

  const handleCandidateChange = (candidateKey: string) => {
    setSelectedCandidateKey(candidateKey);
    // Reset person selection when candidate changes
    setSelectedPersonId("");
  };

  const handlePersonChange = (personId: string) => {
    setSelectedPersonId(personId);
  };

  const handleSubmit = () => {
    if (!selectedCandidateKey || !selectedPersonId) return;
    
    const selectedCandidate = candidates.find(c => `${c.clientId}-${c.projectId}` === selectedCandidateKey);
    if (!selectedCandidate) return;

    onSelect(selectedCandidate.clientId, selectedCandidate.projectId, selectedPersonId);
  };

  const selectedCandidate = candidates.find(c => `${c.clientId}-${c.projectId}` === selectedCandidateKey);
  const eligibleRecipients = selectedCandidate?.recipients.filter(r => r.canPreview) || [];
  const canSubmit = selectedCandidateKey && selectedPersonId && eligibleRecipients.some(r => r.personId === selectedPersonId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-client-person-selection">
        <DialogHeader>
          <DialogTitle>Select Client and Contact for Preview</DialogTitle>
          <DialogDescription>
            Choose a client and contact to see how this notification will appear with real data
          </DialogDescription>
        </DialogHeader>
        
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {!isLoading && !hasEligibleCandidates && (
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">
                    No Preview Available
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {message || "No clients with eligible contacts found. To preview this notification, you need to activate notifications for this project type and assign a service to at least one client with a related person who has notifications enabled."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {!isLoading && hasEligibleCandidates && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Column 1: Client & Project Selection */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Select Client & Project
                </h3>
                <RadioGroup value={selectedCandidateKey} onValueChange={handleCandidateChange}>
                  <div className="space-y-2">
                    {candidates.map((candidate) => {
                      const candidateKey = `${candidate.clientId}-${candidate.projectId}`;
                      const eligibleCount = candidate.recipients.filter(r => r.canPreview).length;
                      const totalCount = candidate.recipients.length;
                      
                      return (
                        <Card key={candidateKey} className={selectedCandidateKey === candidateKey ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : ""}>
                          <CardContent className="pt-4">
                            <div className="flex items-start space-x-3">
                              <RadioGroupItem value={candidateKey} id={candidateKey} data-testid={`radio-candidate-${candidateKey}`} />
                              <div className="flex-1 space-y-1">
                                <Label htmlFor={candidateKey} className="font-medium cursor-pointer">
                                  {candidate.clientName}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {candidate.projectDescription || candidate.projectName || `Project #${candidate.projectId.substring(0, 8)}`}
                                </p>
                                {candidate.stageName && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400">
                                    Stage: {candidate.stageName}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant={eligibleCount > 0 ? "default" : "secondary"} className="text-xs">
                                    {eligibleCount} / {totalCount} eligible
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </RadioGroup>
              </div>

              {/* Column 2: Person Selection */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Select Contact
                </h3>
                {!selectedCandidateKey && (
                  <Card className="border-dashed">
                    <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
                      Select a client & project to view available contacts
                    </CardContent>
                  </Card>
                )}
                {selectedCandidateKey && selectedCandidate && (
                  <RadioGroup value={selectedPersonId} onValueChange={handlePersonChange}>
                    <div className="space-y-2">
                      {selectedCandidate.recipients.map((recipient) => (
                        <Card 
                          key={recipient.personId} 
                          className={
                            selectedPersonId === recipient.personId 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" 
                              : !recipient.canPreview 
                              ? "opacity-50"
                              : ""
                          }
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-start space-x-3">
                              <RadioGroupItem 
                                value={recipient.personId} 
                                id={recipient.personId} 
                                disabled={!recipient.canPreview}
                                data-testid={`radio-person-${recipient.personId}`}
                              />
                              <div className="flex-1 space-y-1">
                                <Label 
                                  htmlFor={recipient.personId} 
                                  className={`font-medium ${recipient.canPreview ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                >
                                  {recipient.fullName}
                                </Label>
                                {recipient.email && (
                                  <p className="text-xs text-muted-foreground">{recipient.email}</p>
                                )}
                                {!recipient.canPreview && recipient.ineligibleReason && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    {recipient.ineligibleReason}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </RadioGroup>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-selection">
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!canSubmit}
                data-testid="button-confirm-selection"
              >
                Preview Notification
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
