import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mail, Paperclip, Sparkles, Mic, Eye, Edit3, Lock, Clock, Phone, MessageSquare, Users, ArrowRightCircle, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave";
import { ReminderScheduleEditor } from "@/components/reminders/ReminderScheduleEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AudioRecorder } from "@/components/AudioRecorder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  id: string; // Composite key: personId-emailIndex for uniqueness
  personId: string;
  fullName: string;
  email: string;
  emailLabel?: string; // "Primary", "Alternative", "Secondary"
  phone?: string | null;
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
  initialValues,
  queryEmailOptions,
  onRemindersConfigured,
  onCompletionActionConfigured
}: EmailDialogProps) {
  const { toast } = useToast();
  const [emailSubject, setEmailSubject] = useState<string>(initialValues?.subject || '');
  const [emailContent, setEmailContent] = useState<string>(initialValues?.content || '');
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  
  // Protected HTML mode state (for query emails with tables/buttons)
  const [emailIntro, setEmailIntro] = useState<string>('');
  const [emailSignoff, setEmailSignoff] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  
  // Check if we're in protected HTML mode
  const hasProtectedHtml = Boolean(initialValues?.protectedHtml);
  const protectedHtml = initialValues?.protectedHtml || '';
  
  // Query email mode with reminders
  const isQueryEmailMode = Boolean(queryEmailOptions);
  const [reminderSchedule, setReminderSchedule] = useState<import('../types').ReminderScheduleItem[]>([]);
  
  // Tab state for query email mode (Compose, Scheduling, Actions)
  const [activeTab, setActiveTab] = useState<'compose' | 'scheduling' | 'actions'>('compose');
  const [hasVisitedSchedulingTab, setHasVisitedSchedulingTab] = useState(false);
  const [hasVisitedActionsTab, setHasVisitedActionsTab] = useState(false);
  
  // Multiple recipient selection - start empty, will be populated by useEffect after peopleWithEmail is ready
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const hasSelectedRecipients = selectedRecipients.size > 0;
  
  // AI prompt state
  const [aiPrompt, setAiPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  
  // CC/BCC state
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [ccEmails, setCcEmails] = useState<string>("");
  const [bccEmails, setBccEmails] = useState<string>("");
  
  // On-completion action state (auto-stage-change when client completes queries)
  const [enableOnCompletion, setEnableOnCompletion] = useState(false);
  const [onCompletionStageId, setOnCompletionStageId] = useState<string>('');
  const [onCompletionStageReasonId, setOnCompletionStageReasonId] = useState<string>('');

  // Fetch project stages when in query email mode - preload immediately for faster UX
  const { data: projectStages } = useQuery<Array<{ id: string; name: string; order: number }>>({
    queryKey: [`/api/config/project-types/${queryEmailOptions?.projectTypeId}/stages`],
    enabled: isOpen && isQueryEmailMode && !!queryEmailOptions?.projectTypeId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Fetch stage reasons when a stage is selected
  const { data: stageReasons } = useQuery<Array<{ id: string; reason: string }>>({
    queryKey: [`/api/config/stages/${onCompletionStageId}/reasons`],
    enabled: !!onCompletionStageId,
  });
  
  // Notify parent when on-completion action configuration changes
  // Always use 'submitted' trigger - fires when client submits the form
  // BOTH stage AND reason are REQUIRED for auto-stage-change
  useEffect(() => {
    if (onCompletionActionConfigured) {
      if (enableOnCompletion && onCompletionStageId && onCompletionStageReasonId) {
        onCompletionActionConfigured({
          trigger: 'submitted',
          stageId: onCompletionStageId,
          stageReasonId: onCompletionStageReasonId,
        });
      } else {
        onCompletionActionConfigured(null);
      }
    }
  }, [enableOnCompletion, onCompletionStageId, onCompletionStageReasonId, onCompletionActionConfigured]);

  // Auto-save draft for email composition
  const { savedContent: savedDraft, additionalFields: savedFields, hasDraft, saveDraft, clearDraft } = useDraftAutoSave({
    key: `email-draft-${clientId}-${projectId || 'no-project'}`,
    debounceMs: 500,
  });

  // Restore draft when dialog opens (only if no initialValues provided)
  useEffect(() => {
    if (isOpen && !initialValues?.subject && !initialValues?.content) {
      if (hasDraft && savedDraft) {
        setEmailContent(savedDraft);
        if (savedFields?.subject) {
          setEmailSubject(savedFields.subject);
        }
      }
    }
  }, [isOpen, hasDraft, savedDraft, savedFields, initialValues?.subject, initialValues?.content]);

  // Auto-save email content when it changes
  useEffect(() => {
    if (isOpen && !hasProtectedHtml) {
      saveDraft(emailContent, { subject: emailSubject });
    }
  }, [emailContent, emailSubject, isOpen, saveDraft, hasProtectedHtml]);
  
  // Build the final email content for sending (combines intro + protected HTML + signoff)
  const getFinalEmailContent = useCallback(() => {
    if (hasProtectedHtml) {
      return `${emailIntro}\n\n${protectedHtml}\n\n${emailSignoff}`;
    }
    return emailContent;
  }, [hasProtectedHtml, emailIntro, protectedHtml, emailSignoff, emailContent]);
  
  // Build list of all email options for all people (each email is a separate selectable option)
  const peopleWithEmail: RecipientInfo[] = useMemo(() => (clientPeople || [])
    .flatMap((cp: any) => {
      const person = cp.person;
      if (!person) return [];
      
      const fullName = person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim();
      const role = cp.role || null;
      const phone = person.primaryPhone || person.telephone || person.mobile || null;
      
      // Collect all unique emails for this person with labels
      const emails: Array<{ email: string; label: string }> = [];
      const seenEmails = new Set<string>();
      
      // Primary email (check both primaryEmail and email fields)
      if (person.primaryEmail?.trim()) {
        const email = person.primaryEmail.trim().toLowerCase();
        if (!seenEmails.has(email)) {
          seenEmails.add(email);
          emails.push({ email: person.primaryEmail.trim(), label: 'Primary' });
        }
      }
      
      // Alternative email (the 'email' field when primaryEmail exists, or as primary fallback)
      if (person.email?.trim()) {
        const email = person.email.trim().toLowerCase();
        if (!seenEmails.has(email)) {
          seenEmails.add(email);
          emails.push({ email: person.email.trim(), label: person.primaryEmail ? 'Alternative' : 'Primary' });
        }
      }
      
      // Secondary email (email2 field)
      if (person.email2?.trim()) {
        const email = person.email2.trim().toLowerCase();
        if (!seenEmails.has(email)) {
          seenEmails.add(email);
          emails.push({ email: person.email2.trim(), label: 'Secondary' });
        }
      }
      
      // Create a RecipientInfo entry for each email
      return emails.map((emailObj, idx) => ({
        id: `${person.id}-${idx}`,
        personId: person.id,
        fullName,
        email: emailObj.email,
        emailLabel: emailObj.label,
        phone,
        role,
      }));
    }), [clientPeople]);
  
  // Helper to convert legacy personId to the primary email's composite id
  const personIdToCompositeId = useCallback((personId: string): string | null => {
    // Find the first (primary) email entry for this person
    const entry = peopleWithEmail.find(p => p.personId === personId);
    return entry?.id || null;
  }, [peopleWithEmail]);

  // Sync state from initialValues when props change (needed for async-prepared content like queries)
  useEffect(() => {
    if (isOpen && initialValues) {
      if (initialValues.subject) {
        setEmailSubject(initialValues.subject);
      }
      // Handle protected HTML mode separately
      if (initialValues.protectedHtml) {
        // Use structured content
        setEmailIntro(initialValues.emailIntro || '');
        setEmailSignoff(initialValues.emailSignoff || '');
        // Don't set emailContent - we'll combine at send time
      } else if (initialValues.content) {
        setEmailContent(initialValues.content);
      }
      // Convert legacy personIds to composite ids if needed
      if (initialValues.recipientIds && initialValues.recipientIds.length > 0 && peopleWithEmail.length > 0) {
        const convertedIds = new Set<string>();
        for (const id of initialValues.recipientIds) {
          // Check if this ID is already a composite id (contains '-')
          if (id.includes('-') && peopleWithEmail.some(p => p.id === id)) {
            convertedIds.add(id);
          } else {
            // Legacy personId - convert to primary email's composite id
            const compositeId = personIdToCompositeId(id);
            if (compositeId) {
              convertedIds.add(compositeId);
            }
          }
        }
        setSelectedRecipients(convertedIds);
      }
    }
  }, [isOpen, initialValues?.subject, initialValues?.content, initialValues?.recipientIds, initialValues?.protectedHtml, initialValues?.emailIntro, initialValues?.emailSignoff, peopleWithEmail, personIdToCompositeId]);
  
  // Calculate channel availability based on selected recipients
  const getChannelAvailability = useCallback(() => {
    const selectedPeople = peopleWithEmail.filter(p => selectedRecipients.has(p.id));
    const totalSelected = selectedPeople.length;
    const withPhone = selectedPeople.filter(p => p.phone && p.phone.trim() !== '').length;
    const withEmail = totalSelected; // All selected have email (filtered above)
    
    return {
      totalSelected,
      email: { count: withEmail, available: withEmail > 0 },
      sms: { count: withPhone, available: withPhone > 0 },
      voice: { count: withPhone, available: withPhone > 0 },
    };
  }, [peopleWithEmail, selectedRecipients]);
  
  const channelAvailability = getChannelAvailability();
  
  // Handle tab change and track tab visits
  // Sequential progression is enforced via disabled tab triggers AND this handler
  // Guard against keyboard navigation bypassing disabled tabs
  // Use setTimeout to delay the state change - this prevents the button swap 
  // from happening during the same click event cycle
  const handleTabChange = useCallback((value: string) => {
    // Guard: In query mode, enforce tab prerequisites to prevent keyboard bypass
    if (isQueryEmailMode) {
      // Scheduling requires recipients
      if (value === 'scheduling' && !hasSelectedRecipients) {
        return; // Block navigation
      }
      // Actions requires Scheduling to have been visited
      if (value === 'actions' && !hasVisitedSchedulingTab) {
        return; // Block navigation
      }
    }
    
    setActiveTab(value as 'compose' | 'scheduling' | 'actions');
    
    // Track tab visits with delay to prevent button swap during same click cycle
    if (value === 'scheduling') {
      setTimeout(() => {
        setHasVisitedSchedulingTab(true);
      }, 0);
    }
    if (value === 'actions') {
      setTimeout(() => {
        setHasVisitedActionsTab(true);
      }, 0);
    }
  }, [isQueryEmailMode, hasSelectedRecipients, hasVisitedSchedulingTab]);

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
      ? peopleWithEmail.filter(r => selectedRecipients.has(r.id))
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
    
    // Fallback: try to extract from lastName if firstName unavailable
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

  // Toggle a single recipient (now using composite id for email-level selection)
  const toggleRecipient = (id: string) => {
    const newSet = new Set(selectedRecipients);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRecipients(newSet);
  };

  // Toggle all recipients
  const toggleAllRecipients = () => {
    if (selectedRecipients.size === peopleWithEmail.length) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(peopleWithEmail.map(r => r.id)));
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
      attachments?: EmailAttachment[];
      cc?: string[];
      bcc?: string[];
    }) => {
      // Send a single email with all recipients in the "To" field
      const toEmails = data.recipients.map(r => r.email);
      const personIds = data.recipients.map(r => r.personId);
      
      const result = await apiRequest('POST', '/api/email/send', {
        to: toEmails, // Array of recipient emails
        subject: data.subject,
        content: data.content,
        clientId: data.clientId,
        projectId: data.projectId,
        personIds: personIds, // Array of person IDs for logging
        isHtml: data.isHtml,
        attachments: data.attachments,
        cc: data.cc,
        bcc: data.bcc,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/communications`] });
      }
      
      // Get the primary recipient's data to pass back for reminder scheduling
      const primaryRecipient = peopleWithEmail.find(p => selectedRecipients.has(p.id));
      const recipientData = primaryRecipient ? {
        email: primaryRecipient.email,
        name: primaryRecipient.fullName || 'Client',
        phone: primaryRecipient.phone || null,
      } : undefined;
      
      handleClose(true);
      const recipientCount = selectedRecipients.size;
      toast({
        title: "Email sent successfully",
        description: `The email has been sent to ${recipientCount} recipient${recipientCount > 1 ? 's' : ''} and logged.`,
      });
      onSuccess?.(recipientData);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleClose = (clearDraftOnClose: boolean = false) => {
    setSelectedRecipients(new Set());
    setEmailSubject('');
    setEmailContent('');
    setEmailIntro('');
    setEmailSignoff('');
    setShowPreview(false);
    setAttachments([]);
    setPendingFiles([]);
    setIsAttachmentsOpen(false);
    setAiPrompt('');
    setShowPromptModal(false);
    setShowCcBcc(false);
    setCcEmails('');
    setBccEmails('');
    if (clearDraftOnClose) {
      clearDraft();
    }
    onClose();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (selectedRecipients.size === 0) {
      showFriendlyError({ error: 'Please select at least one recipient.' });
      return;
    }
    
    // Validate auto-stage-change configuration - reason is REQUIRED
    if (isQueryEmailMode && enableOnCompletion) {
      if (!onCompletionStageId) {
        showFriendlyError({ error: 'Please select a stage for the auto-move action, or disable it.' });
        return;
      }
      if (!onCompletionStageReasonId) {
        showFriendlyError({ error: 'Please select a stage change reason. This is required for auto-move actions.' });
        return;
      }
    }

    // Get selected recipients with their emails
    const recipients = peopleWithEmail
      .filter(r => selectedRecipients.has(r.id))
      .map(r => ({ email: r.email, personId: r.personId }));

    if (recipients.length === 0) {
      showFriendlyError({ error: 'No valid email addresses for selected recipients.' });
      return;
    }
    
    // Get the combined content (handles both regular and protected HTML modes)
    const combinedContent = getFinalEmailContent();
    
    const textContent = combinedContent
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-zA-Z]+;/g, '')
      .trim();
    if (!textContent || textContent.length === 0) {
      showFriendlyError({ error: 'Please enter a message.' });
      return;
    }
    
    let finalEmailContent = combinedContent;
    if (user?.emailSignature && user.emailSignature.trim()) {
      const spacing = combinedContent.trim() ? '<br><br>' : '';
      finalEmailContent = combinedContent + spacing + user.emailSignature;
    }
    
    // Parse CC and BCC emails (comma-separated, trimmed)
    const parsedCc = ccEmails
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@'));
    const parsedBcc = bccEmails
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes('@'));
    
    sendEmailMutation.mutate({
      recipients,
      subject: emailSubject || 'Message from CRM',
      content: finalEmailContent,
      isHtml: true,
      clientId: clientId,
      projectId: projectId,
      attachments: attachments.length > 0 ? attachments : undefined,
      cc: parsedCc.length > 0 ? parsedCc : undefined,
      bcc: parsedBcc.length > 0 ? parsedBcc : undefined,
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleClose(false);
        if (open) {
          setSelectedRecipients(new Set());
          setAttachments([]);
          setPendingFiles([]);
          setIsAttachmentsOpen(false);
          setAiPrompt('');
          setShowPromptModal(false);
          setReminderSchedule([]);
          setActiveTab('compose');
          setHasVisitedSchedulingTab(false);
          setHasVisitedActionsTab(false);
          setEnableOnCompletion(false);
          setOnCompletionStageId('');
          setOnCompletionStageReasonId('');
        }
      }}>
        <DialogContent className={`w-full max-h-[90vh] overflow-hidden flex flex-col ${isQueryEmailMode ? 'max-w-7xl' : 'max-w-5xl'}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {isQueryEmailMode ? 'Send Query Email with Reminders' : 'Send Email'}
            </DialogTitle>
            <DialogDescription>
              {isQueryEmailMode 
                ? 'Send queries to client with automated follow-up reminders. Fields marked with * are required.'
                : 'Select one or more recipients and compose your email. Fields marked with * are required.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            {/* Tabbed layout for query emails, standard layout otherwise */}
            {isQueryEmailMode ? (
              <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
                <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-4">
                  <TabsTrigger 
                    type="button"
                    value="compose" 
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
                  >
                    Compose
                  </TabsTrigger>
                  <TabsTrigger 
                    type="button"
                    value="scheduling" 
                    disabled={!hasSelectedRecipients}
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!hasSelectedRecipients ? "Select at least one recipient first" : undefined}
                  >
                    <Clock className="h-4 w-4 mr-1.5" />
                    Scheduling
                    {hasSelectedRecipients && !hasVisitedSchedulingTab && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        Review
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    type="button"
                    value="actions" 
                    disabled={!hasSelectedRecipients || !hasVisitedSchedulingTab}
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!hasSelectedRecipients ? "Select at least one recipient first" : !hasVisitedSchedulingTab ? "Review Scheduling tab first" : undefined}
                  >
                    <ArrowRightCircle className="h-4 w-4 mr-1.5" />
                    Actions
                    {hasSelectedRecipients && hasVisitedSchedulingTab && !hasVisitedActionsTab && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        Review
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                {/* Compose Tab Content */}
                <TabsContent value="compose" className="flex-1 mt-0">
                  <div className="grid gap-4 overflow-y-auto max-h-[55vh] grid-cols-1 md:grid-cols-[280px_1fr]">
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
                          <div key={recipient.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`recipient-${recipient.id}`}
                              checked={selectedRecipients.has(recipient.id)}
                              onCheckedChange={() => toggleRecipient(recipient.id)}
                              data-testid={`checkbox-recipient-${recipient.id}`}
                              className="h-3.5 w-3.5"
                            />
                            <label
                              htmlFor={`recipient-${recipient.id}`}
                              className="text-xs cursor-pointer flex-1 flex flex-col truncate"
                            >
                              <div className="flex items-center gap-1">
                                <span className="font-medium truncate">{formatPersonName(recipient.fullName)}</span>
                                {recipient.emailLabel && (
                                  <Badge variant={recipient.emailLabel === 'Primary' ? 'default' : 'outline'} className="text-[10px] px-1 py-0 h-4">
                                    {recipient.emailLabel}
                                  </Badge>
                                )}
                                {recipient.role && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                    {formatRole(recipient.role)}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-muted-foreground truncate">{recipient.email}</span>
                              {/* Channel icons */}
                              {isQueryEmailMode && (
                                <div className="flex items-center gap-0.5 ml-auto shrink-0">
                                  <span title="Email available"><Mail className="h-3 w-3 text-blue-500" /></span>
                                  {recipient.phone ? (
                                    <>
                                      <span title="SMS available"><MessageSquare className="h-3 w-3 text-purple-500" /></span>
                                      <span title="Voice available"><Phone className="h-3 w-3 text-green-500" /></span>
                                    </>
                                  ) : (
                                    <>
                                      <span title="No phone - SMS unavailable"><MessageSquare className="h-3 w-3 text-muted-foreground/30" /></span>
                                      <span title="No phone - Voice unavailable"><Phone className="h-3 w-3 text-muted-foreground/30" /></span>
                                    </>
                                  )}
                                </div>
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
                
                {/* CC/BCC Toggle */}
                <Collapsible open={showCcBcc} onOpenChange={setShowCcBcc}>
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      data-testid="button-toggle-cc-bcc"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {showCcBcc ? 'Hide CC/BCC' : 'Add CC/BCC'}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="email-cc" className="text-xs text-muted-foreground">CC (comma-separated emails)</Label>
                      <Input
                        id="email-cc"
                        value={ccEmails}
                        onChange={(e) => setCcEmails(e.target.value)}
                        placeholder="email1@example.com, email2@example.com"
                        className="h-8 text-sm"
                        data-testid="input-email-cc"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email-bcc" className="text-xs text-muted-foreground">BCC (comma-separated emails)</Label>
                      <Input
                        id="email-bcc"
                        value={bccEmails}
                        onChange={(e) => setBccEmails(e.target.value)}
                        placeholder="email1@example.com, email2@example.com"
                        className="h-8 text-sm"
                        data-testid="input-email-bcc"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Protected HTML Mode (Query Emails with tables/buttons) */}
                {hasProtectedHtml ? (
                  <div className="space-y-3">
                    {/* Toggle between Edit and Preview */}
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Message <span className="text-destructive">*</span></Label>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant={showPreview ? "ghost" : "secondary"}
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => setShowPreview(false)}
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant={showPreview ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => setShowPreview(true)}
                        >
                          <Eye className="h-3 w-3" />
                          Preview
                        </Button>
                      </div>
                    </div>

                    {showPreview ? (
                      /* Full Preview Mode */
                      <div className="border rounded-md bg-white dark:bg-gray-950 overflow-y-auto" style={{ maxHeight: '350px' }}>
                        <div 
                          className="p-4 prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: getFinalEmailContent() }}
                        />
                      </div>
                    ) : (
                      /* Edit Mode with structured sections */
                      <div className="space-y-3">
                        {/* Intro Section (Editable) */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Introduction</Label>
                          <div data-testid="input-email-intro-editor" className="border rounded-md">
                            <TiptapEditor
                              content={emailIntro}
                              onChange={setEmailIntro}
                              placeholder="Hello, ..."
                              editorHeight="80px"
                            />
                          </div>
                        </div>

                        {/* Protected HTML Section (Read-only preview) */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Lock className="h-3 w-3 text-muted-foreground" />
                            <Label className="text-xs text-muted-foreground">Query Table & Response Link (Protected)</Label>
                          </div>
                          <div className="border rounded-md bg-muted/30 overflow-x-auto" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                            <div 
                              className="p-3 prose prose-sm max-w-none dark:prose-invert scale-90 origin-top-left"
                              style={{ width: '111%' }}
                              dangerouslySetInnerHTML={{ __html: protectedHtml }}
                            />
                          </div>
                        </div>

                        {/* Sign-off Section (Editable) */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Sign-off</Label>
                          <div data-testid="input-email-signoff-editor" className="border rounded-md">
                            <TiptapEditor
                              content={emailSignoff}
                              onChange={setEmailSignoff}
                              placeholder="Best regards, ..."
                              editorHeight="80px"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Standard Mode (single editor) */
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
                )}
              </div>
                  </div>
                </TabsContent>
                
                {/* Scheduling Tab Content */}
                <TabsContent value="scheduling" className="flex-1 mt-0">
                  <div className="space-y-4 overflow-y-auto max-h-[55vh]">
                    {/* Compact header with expiry badge and recipient summary */}
                    {queryEmailOptions && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Automated Reminders</h4>
                          <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                            <Clock className="h-3 w-3 mr-1" />
                            Expires: {queryEmailOptions.expiryDate 
                              ? new Date(queryEmailOptions.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) 
                              : `in ${queryEmailOptions.expiryDays} days`}
                          </Badge>
                        </div>
                        {/* Recipient preview */}
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Users className="h-3 w-3" />
                          <span>
                            Sending to: {selectedRecipients.size > 0 
                              ? Array.from(selectedRecipients).slice(0, 3).map(recipientId => {
                                  const person = peopleWithEmail.find(p => p.id === recipientId);
                                  return person?.fullName?.split(' ')[0] || person?.email?.split('@')[0] || 'Unknown';
                                }).join(', ') + (selectedRecipients.size > 3 ? ` +${selectedRecipients.size - 3} more` : '')
                              : 'No recipients selected'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Reminder Schedule */}
                    {queryEmailOptions && (
                      <ReminderScheduleEditor
                        expiryDays={queryEmailOptions.expiryDays}
                        recipientPhone={queryEmailOptions.recipientPhone}
                        recipientEmail={selectedRecipients.size > 0 
                          ? peopleWithEmail.find(p => selectedRecipients.has(p.id))?.email 
                          : undefined}
                        channelAvailability={channelAvailability}
                        expiryDate={queryEmailOptions.expiryDate}
                        schedule={reminderSchedule}
                        onScheduleChange={(newSchedule) => {
                          setReminderSchedule(newSchedule);
                          onRemindersConfigured?.(newSchedule);
                        }}
                        disabled={sendEmailMutation.isPending}
                        voiceAiAvailable={queryEmailOptions.voiceAiAvailable}
                      />
                    )}

                    {/* Info panel about reminders */}
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Automated Follow-up</span>
                      </div>
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        {reminderSchedule.filter(r => r.enabled).length} reminder{reminderSchedule.filter(r => r.enabled).length !== 1 ? 's' : ''} will be sent if queries remain unanswered.
                        Reminders stop automatically when all queries are answered.
                      </p>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Actions Tab Content */}
                <TabsContent value="actions" className="flex-1 mt-0">
                  <div className="space-y-4 overflow-y-auto max-h-[55vh]">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">On Completion Actions</h4>
                      <p className="text-xs text-muted-foreground">
                        Configure automatic actions when the client completes their queries.
                      </p>
                    </div>

                    {/* Auto-move project section */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="enable-on-completion" className="text-sm font-medium cursor-pointer">
                            Move project when complete
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Automatically move the project to a different stage when the client submits their responses.
                          </p>
                        </div>
                        <Switch
                          id="enable-on-completion"
                          checked={enableOnCompletion}
                          onCheckedChange={setEnableOnCompletion}
                          data-testid="switch-enable-on-completion"
                        />
                      </div>
                      
                      {enableOnCompletion && (
                        <div className="space-y-4 pt-3 border-t">
                          {/* Stage selection */}
                          <div className="space-y-2">
                            <Label className="text-sm">Move to stage</Label>
                            <Select
                              value={onCompletionStageId}
                              onValueChange={(val) => {
                                setOnCompletionStageId(val);
                                setOnCompletionStageReasonId('');
                              }}
                            >
                              <SelectTrigger className="w-full" data-testid="select-completion-stage">
                                <SelectValue placeholder="Select stage..." />
                              </SelectTrigger>
                              <SelectContent>
                                {projectStages
                                  ?.filter((stage) => stage.name !== queryEmailOptions?.currentStageName)
                                  .map((stage) => (
                                    <SelectItem key={stage.id} value={stage.id}>
                                      {stage.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Stage reason selection - REQUIRED */}
                          {onCompletionStageId && (
                            <div className="space-y-2">
                              <Label className="text-sm">Stage change reason <span className="text-destructive">*</span></Label>
                              {stageReasons && stageReasons.length > 0 ? (
                                <Select
                                  value={onCompletionStageReasonId}
                                  onValueChange={setOnCompletionStageReasonId}
                                >
                                  <SelectTrigger className="w-full" data-testid="select-completion-reason">
                                    <SelectValue placeholder="Select reason..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stageReasons.map((reason) => (
                                      <SelectItem key={reason.id} value={reason.id}>
                                        {reason.reason}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                  No reasons configured for this stage. Please configure stage reasons in Settings.
                                </p>
                              )}
                            </div>
                          )}
                          
                          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                              The project will only be moved if it's still in the same stage as when queries were sent.
                              This prevents overriding any manual stage changes made in the meantime.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Summary of configured action - requires both stage AND reason */}
                    {enableOnCompletion && onCompletionStageId && onCompletionStageReasonId && (
                      <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <ArrowRightCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-900 dark:text-green-100">Action Configured</span>
                        </div>
                        <p className="text-xs text-green-800 dark:text-green-200">
                          When the client submits their responses, the project will automatically move to "{projectStages?.find(s => s.id === onCompletionStageId)?.name}" with reason "{stageReasons?.find(r => r.id === onCompletionStageReasonId)?.reason}".
                        </p>
                      </div>
                    )}
                    
                    {/* Incomplete configuration warning */}
                    {enableOnCompletion && onCompletionStageId && !onCompletionStageReasonId && stageReasons && stageReasons.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-sm font-medium text-amber-900 dark:text-amber-100">Action Incomplete</span>
                        </div>
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          Please select a stage change reason to complete the configuration.
                        </p>
                      </div>
                    )}

                    {!enableOnCompletion && (
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">
                          No actions configured. The project will remain in its current stage when queries are completed.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              /* Standard email mode - original 2-column layout */
              <div className="grid gap-4 flex-1 overflow-y-auto max-h-[60vh] grid-cols-1 md:grid-cols-[280px_1fr]">
                {/* Left Column: Recipients & AI (duplicated for non-query mode) */}
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
                            data-testid="button-toggle-all-recipients-standard"
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
                            <div key={recipient.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`recipient-standard-${recipient.id}`}
                                checked={selectedRecipients.has(recipient.id)}
                                onCheckedChange={() => toggleRecipient(recipient.id)}
                                data-testid={`checkbox-recipient-standard-${recipient.id}`}
                                className="h-3.5 w-3.5"
                              />
                              <label
                                htmlFor={`recipient-standard-${recipient.id}`}
                                className="text-xs cursor-pointer flex-1 flex flex-col truncate"
                              >
                                <div className="flex items-center gap-1">
                                  <span className="font-medium truncate">{formatPersonName(recipient.fullName)}</span>
                                  {recipient.emailLabel && (
                                    <Badge variant={recipient.emailLabel === 'Primary' ? 'default' : 'outline'} className="text-[10px] px-1 py-0 h-4">
                                      {recipient.emailLabel}
                                    </Badge>
                                  )}
                                  {recipient.role && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                      {formatRole(recipient.role)}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-muted-foreground truncate">{recipient.email}</span>
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
                    
                    <div className="grid grid-cols-2 gap-2">
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
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Prompt</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full h-9 text-xs gap-1.5"
                          onClick={() => setShowPromptModal(true)}
                          disabled={sendEmailMutation.isPending}
                          data-testid="button-ai-prompt-standard"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Refine</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Attachments Section */}
                  <Collapsible open={isAttachmentsOpen} onOpenChange={setIsAttachmentsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between h-8 px-3 bg-muted/30 hover:bg-muted/50"
                        data-testid="button-toggle-attachments-standard"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Attachments</span>
                          {attachments.length > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                              {attachments.length}
                            </Badge>
                          )}
                        </div>
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
                    <Label htmlFor="email-subject" className="text-sm">Subject <span className="text-destructive">*</span></Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Enter email subject..."
                      data-testid="input-email-subject-standard"
                    />
                  </div>
                  
                  {/* CC/BCC Toggle */}
                  <Collapsible open={showCcBcc} onOpenChange={setShowCcBcc}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        data-testid="button-toggle-cc-bcc-standard"
                      >
                        <Users className="h-3.5 w-3.5" />
                        {showCcBcc ? 'Hide CC/BCC' : 'Add CC/BCC'}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor="email-cc-standard" className="text-xs text-muted-foreground">CC (comma-separated emails)</Label>
                        <Input
                          id="email-cc-standard"
                          value={ccEmails}
                          onChange={(e) => setCcEmails(e.target.value)}
                          placeholder="email1@example.com, email2@example.com"
                          className="h-8 text-sm"
                          data-testid="input-email-cc-standard"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="email-bcc-standard" className="text-xs text-muted-foreground">BCC (comma-separated emails)</Label>
                        <Input
                          id="email-bcc-standard"
                          value={bccEmails}
                          onChange={(e) => setBccEmails(e.target.value)}
                          placeholder="email1@example.com, email2@example.com"
                          className="h-8 text-sm"
                          data-testid="input-email-bcc-standard"
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="email-content" className="text-sm">Message <span className="text-destructive">*</span></Label>
                    <div data-testid="input-email-content-editor-standard" className="border rounded-md">
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
            )}

            {/* Footer */}
            <DialogFooter className="mt-4 pt-4 border-t gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => handleClose()}>
                Cancel
              </Button>
              {isQueryEmailMode && hasSelectedRecipients && !hasVisitedSchedulingTab ? (
                <Button 
                  type="button" 
                  onClick={() => handleTabChange('scheduling')}
                  data-testid="button-next-scheduling"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Next: Scheduling
                </Button>
              ) : isQueryEmailMode && hasSelectedRecipients && !hasVisitedActionsTab ? (
                <Button 
                  type="button" 
                  onClick={() => handleTabChange('actions')}
                  data-testid="button-next-actions"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium gap-2"
                >
                  <ArrowRightCircle className="h-4 w-4" />
                  Next: Actions
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={
                    sendEmailMutation.isPending || 
                    !hasSelectedRecipients || 
                    (isQueryEmailMode && (!hasVisitedSchedulingTab || !hasVisitedActionsTab)) ||
                    (isQueryEmailMode && enableOnCompletion && (!onCompletionStageId || !onCompletionStageReasonId))
                  } 
                  data-testid="button-send-email-dialog"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  title={
                    isQueryEmailMode && enableOnCompletion && (!onCompletionStageId || !onCompletionStageReasonId)
                      ? "Please complete the auto-move configuration (stage and reason required)"
                      : undefined
                  }
                >
                  {sendEmailMutation.isPending 
                    ? 'Sending...' 
                    : hasSelectedRecipients 
                      ? `Send to ${selectedRecipients.size} recipient${selectedRecipients.size > 1 ? 's' : ''}`
                      : 'Select Recipients'
                  }
                </Button>
              )}
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
