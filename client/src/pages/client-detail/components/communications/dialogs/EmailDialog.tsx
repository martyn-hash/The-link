import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, Paperclip, Sparkles, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AudioRecorder } from "@/components/AudioRecorder";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TiptapEditor } from "@/components/TiptapEditor";
import { FileUploadZone, AttachmentList } from "@/components/attachments";
import { formatPersonName } from "../../../utils/formatters";
import type { EmailDialogProps } from "../types";

interface EmailAttachment {
  filename: string;
  contentType: string;
  content: string; // Base64 encoded
  size: number;
}

interface RecipientInfo {
  personId: string;
  fullName: string;
  email: string;
  role?: string | null;
}

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove the data:mime/type;base64, prefix
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

// Helper function to format role for display
const formatRole = (role: string | null | undefined): string => {
  if (!role) return "";
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function EmailDialog({ 
  clientId,
  projectId,
  clientPeople,
  user,
  isOpen, 
  onClose,
  onSuccess,
  clientCompany,
  initialValues
}: EmailDialogProps) {
  const { toast } = useToast();
  const [emailSubject, setEmailSubject] = useState<string>(initialValues?.subject || '');
  const [emailContent, setEmailContent] = useState<string>(initialValues?.content || '');
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  
  // Multiple recipient selection - initialize with AI-suggested recipients if provided
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(
    new Set(initialValues?.recipientIds || [])
  );
  
  // AI prompt state
  const [aiPrompt, setAiPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  
  // Filter to only show people with email addresses (check primaryEmail first, fallback to email)
  const peopleWithEmail: RecipientInfo[] = (clientPeople || [])
    .filter((cp: any) => {
      const email = cp.person?.primaryEmail || cp.person?.email;
      return email && email.trim() !== '';
    })
    .map((cp: any) => ({
      personId: cp.person.id,
      fullName: cp.person.fullName || `${cp.person.firstName || ''} ${cp.person.lastName || ''}`.trim(),
      email: cp.person.primaryEmail || cp.person.email,
      role: cp.role || null,
    }));

  // Helper function to extract first name from various formats
  const extractFirstName = (fullName: string): string => {
    if (!fullName) return "";
    
    // Handle "LASTNAME, Firstname" format (common in UK/formal systems)
    if (fullName.includes(",")) {
      const parts = fullName.split(",");
      if (parts.length >= 2) {
        const afterComma = parts[1].trim();
        return afterComma.split(/\s+/)[0] || "";
      }
    }
    
    // Handle "Firstname Lastname" format
    return fullName.split(/\s+/)[0] || "";
  };

  // Get recipient first names for AI context
  // If no recipients selected, use all available recipients for context
  const getRecipientFirstNames = (): string => {
    // Use selected recipients if any, otherwise fall back to all available recipients
    const recipientsToUse = selectedRecipients.size > 0 
      ? peopleWithEmail.filter(r => selectedRecipients.has(r.personId))
      : peopleWithEmail;
    
    const names = recipientsToUse
      .map(r => extractFirstName(r.fullName))
      .filter(name => name.length > 0);
    
    if (names.length === 0) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    
    const lastTwo = names.slice(-2).join(" and ");
    const rest = names.slice(0, -2);
    return [...rest, lastTwo].join(", ");
  };

  // Get sender's first name with robust fallbacks
  const getSenderFirstName = (): string => {
    if (!user) return "";
    
    // Try firstName first
    if (user.firstName && user.firstName.trim()) {
      return user.firstName.trim();
    }
    
    // Try to extract from fullName if available
    if ((user as any).fullName) {
      const extracted = extractFirstName((user as any).fullName);
      if (extracted) return extracted;
    }
    
    // Try to construct from firstName/lastName
    if (user.lastName) {
      return extractFirstName(user.lastName);
    }
    
    // Fallback to email username (before the @)
    if (user.email) {
      const emailUsername = user.email.split('@')[0];
      // Capitalize first letter and handle common patterns like john.doe
      const namePart = emailUsername.split(/[._-]/)[0];
      if (namePart) {
        return namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
      }
    }
    
    return "";
  };

  // Build AI context for personalization
  const getAiContext = () => ({
    recipientNames: getRecipientFirstNames() || undefined,
    senderName: getSenderFirstName() || undefined,
    clientCompany: clientCompany || undefined,
  });

  // Toggle a single recipient
  const toggleRecipient = (personId: string) => {
    const newSet = new Set(selectedRecipients);
    if (newSet.has(personId)) {
      newSet.delete(personId);
    } else {
      newSet.add(personId);
    }
    setSelectedRecipients(newSet);
  };

  // Toggle all recipients
  const toggleAllRecipients = () => {
    if (selectedRecipients.size === peopleWithEmail.length) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(peopleWithEmail.map(r => r.personId)));
    }
  };

  // Handle files being selected
  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newAttachments: EmailAttachment[] = [];
    const newPendingFiles: File[] = [];
    
    for (const file of files) {
      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          content: base64,
          size: file.size,
        });
        newPendingFiles.push(file);
      } catch (error) {
        console.error('Error converting file to base64:', error);
        showFriendlyError({ error: `Could not process ${file.name}` });
      }
    }
    
    setAttachments(prev => [...prev, ...newAttachments]);
    setPendingFiles(prev => [...prev, ...newPendingFiles]);
    setIsAttachmentsOpen(true);
  }, []);

  // Remove an attachment
  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { 
      recipients: { email: string; personId: string }[]; 
      subject: string; 
      content: string; 
      clientId: string;
      projectId?: string;
      isHtml?: boolean; 
      attachments?: EmailAttachment[] 
    }) => {
      // Send emails to all recipients
      const results = [];
      for (const recipient of data.recipients) {
        const result = await apiRequest('POST', '/api/email/send', {
          to: recipient.email,
          subject: data.subject,
          content: data.content,
          clientId: data.clientId,
          projectId: data.projectId,
          personId: recipient.personId,
          isHtml: data.isHtml,
          attachments: data.attachments,
        });
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/communications`] });
      }
      handleClose();
      const recipientCount = selectedRecipients.size;
      toast({
        title: "Email sent successfully",
        description: `The email has been sent to ${recipientCount} recipient${recipientCount > 1 ? 's' : ''} and logged.`,
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleClose = () => {
    setSelectedRecipients(new Set());
    setEmailSubject('');
    setEmailContent('');
    setAttachments([]);
    setPendingFiles([]);
    setIsAttachmentsOpen(false);
    setAiPrompt('');
    setShowPromptModal(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (selectedRecipients.size === 0) {
      showFriendlyError({ error: 'Please select at least one recipient.' });
      return;
    }

    // Get selected recipients with their emails
    const recipients = peopleWithEmail
      .filter(r => selectedRecipients.has(r.personId))
      .map(r => ({ email: r.email, personId: r.personId }));

    if (recipients.length === 0) {
      showFriendlyError({ error: 'No valid email addresses for selected recipients.' });
      return;
    }
    
    const textContent = emailContent
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-zA-Z]+;/g, '')
      .trim();
    if (!textContent || textContent.length === 0) {
      showFriendlyError({ error: 'Please enter a message.' });
      return;
    }
    
    let finalEmailContent = emailContent;
    if (user?.emailSignature && user.emailSignature.trim()) {
      const spacing = emailContent.trim() ? '<br><br>' : '';
      finalEmailContent = emailContent + spacing + user.emailSignature;
    }
    
    sendEmailMutation.mutate({
      recipients,
      subject: emailSubject || 'Message from CRM',
      content: finalEmailContent,
      isHtml: true,
      clientId: clientId,
      projectId: projectId,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  // AI refinement handler
  const handleAiRefine = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsRefining(true);
    try {
      const context = getAiContext();
      const response = await fetch("/api/ai/refine-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          currentSubject: emailSubject,
          currentBody: emailContent,
          recipientNames: context.recipientNames,
          senderName: context.senderName,
          clientCompany: context.clientCompany,
        }),
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to refine email");
      }
      
      const result = await response.json();
      if (result.subject) setEmailSubject(result.subject);
      if (result.body) setEmailContent(result.body);
      
      setAiPrompt("");
      setShowPromptModal(false);
      toast({
        title: "Email refined",
        description: "The AI has updated your email content.",
      });
    } catch (error) {
      console.error("AI refinement failed:", error);
      toast({
        title: "Refinement failed",
        description: "Unable to refine email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefining(false);
    }
  };

  const hasSelectedRecipients = selectedRecipients.size > 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleClose();
        if (open) {
          setEmailContent('');
          setEmailSubject('');
          setSelectedRecipients(new Set());
          setAttachments([]);
          setPendingFiles([]);
          setIsAttachmentsOpen(false);
          setAiPrompt('');
          setShowPromptModal(false);
        }
      }}>
        <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Email
            </DialogTitle>
            <DialogDescription>
              Select one or more recipients and compose your email. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 flex-1 overflow-y-auto max-h-[60vh]">
              {/* Left Column: Recipients & AI */}
              <div className="space-y-4">
                {/* Recipients Section */}
                <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Recipients <span className="text-destructive">*</span></Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Select contacts</Label>
                      {peopleWithEmail.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 text-xs px-1"
                          onClick={toggleAllRecipients}
                          data-testid="button-toggle-all-recipients"
                        >
                          {selectedRecipients.size === peopleWithEmail.length ? 'None' : 'All'}
                        </Button>
                      )}
                    </div>
                    
                    {peopleWithEmail.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No contacts with email addresses</p>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {peopleWithEmail.map((recipient) => (
                          <div key={recipient.personId} className="flex items-center gap-2">
                            <Checkbox
                              id={`recipient-${recipient.personId}`}
                              checked={selectedRecipients.has(recipient.personId)}
                              onCheckedChange={() => toggleRecipient(recipient.personId)}
                              data-testid={`checkbox-recipient-${recipient.personId}`}
                              className="h-3.5 w-3.5"
                            />
                            <label
                              htmlFor={`recipient-${recipient.personId}`}
                              className="text-xs cursor-pointer flex-1 flex items-center gap-1 truncate"
                            >
                              <span className="font-medium truncate">{formatPersonName(recipient.fullName)}</span>
                              {recipient.role && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                  {formatRole(recipient.role)}
                                </Badge>
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {selectedRecipients.size > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {selectedRecipients.size} selected
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Assistance Section */}
                <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <Label className="text-sm font-medium">AI Assist</Label>
                  </div>
                  
                  {/* Two-button row: Record and Prompt */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Voice Recording */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Record</Label>
                      <AudioRecorder
                        mode="email"
                        disabled={sendEmailMutation.isPending}
                        context={getAiContext()}
                        onResult={(result) => {
                          if (result.subject) setEmailSubject(result.subject);
                          if (result.content) setEmailContent(result.content);
                        }}
                      />
                    </div>

                    {/* Prompt Button */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Refine</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs px-2 gap-1"
                        onClick={() => setShowPromptModal(true)}
                        disabled={sendEmailMutation.isPending}
                        data-testid="button-toggle-prompt"
                      >
                        <Sparkles className="h-3 w-3" />
                        Prompt
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Attachments Section */}
                <Collapsible open={isAttachmentsOpen} onOpenChange={setIsAttachmentsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 justify-start"
                      data-testid="button-toggle-attachments"
                    >
                      <Paperclip className="h-4 w-4" />
                      Attachments
                      {attachments.length > 0 && (
                        <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-xs ml-auto">
                          {attachments.length}
                        </span>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-3">
                    <FileUploadZone
                      onFilesSelected={handleFilesSelected}
                      maxFiles={5}
                      maxSize={10 * 1024 * 1024}
                      acceptedTypes={['image/*', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv']}
                      compact
                    />
                    {pendingFiles.length > 0 && (
                      <AttachmentList
                        attachments={pendingFiles}
                        onRemove={handleRemoveAttachment}
                      />
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Right Column: Subject & Message */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email-subject" className="text-sm">Subject</Label>
                  <Input
                    id="email-subject"
                    ref={subjectInputRef}
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Message from CRM"
                    className="h-9"
                    data-testid="input-email-subject-dialog"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email-content" className="text-sm">Message <span className="text-destructive">*</span></Label>
                  <div data-testid="input-email-content-editor" className="border rounded-md">
                    <TiptapEditor
                      content={emailContent}
                      onChange={setEmailContent}
                      placeholder="Enter your email message..."
                      editorHeight="250px"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="mt-4 pt-4 border-t gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={sendEmailMutation.isPending || !hasSelectedRecipients} 
                data-testid="button-send-email-dialog"
              >
                {sendEmailMutation.isPending 
                  ? 'Sending...' 
                  : hasSelectedRecipients 
                    ? `Send to ${selectedRecipients.size} recipient${selectedRecipients.size > 1 ? 's' : ''}`
                    : 'Select Recipients'
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI Prompt Modal */}
      <Dialog open={showPromptModal} onOpenChange={setShowPromptModal}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-ai-prompt">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              AI Email Assistant
            </DialogTitle>
            <DialogDescription>
              Describe what you'd like your email to say. The AI will refine the current content based on your direction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Provide direction about what you want your email to say. It will also include any information currently in the body of the email."
              className="min-h-[120px] resize-none"
              data-testid="input-ai-prompt"
              disabled={isRefining}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPromptModal(false)}
              disabled={isRefining}
              data-testid="button-ai-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAiRefine}
              disabled={!aiPrompt.trim() || isRefining}
              data-testid="button-ai-refine"
              className="gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isRefining ? "Refining..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
