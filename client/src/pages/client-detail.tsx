import { useParams, Link as RouterLink, useLocation } from "wouter";
import { useState, useLayoutEffect, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import DOMPurify from 'dompurify';
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, ExternalLink, Plus, ChevronDown, ChevronRight, ChevronUp, ChevronLeft, Phone, Mail, UserIcon, Clock, Settings, Users, Briefcase, Check, ShieldCheck, Link, X, Pencil, Eye, MessageSquare, PhoneCall, FileText, Send, Inbox, Upload, Download, Trash, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import TopNavigation from "@/components/top-navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import AddressLookup from "@/components/address-lookup";
import AddressMap from "@/components/address-map";
import TagManager from "@/components/tag-manager";
import ClientChronology from "@/components/client-chronology";
import { RingCentralPhone } from "@/components/ringcentral-phone";
import { ObjectUploader } from "@/components/ObjectUploader";
import { DocumentUploadDialog } from "@/components/DocumentUploadDialog";
import { DocumentPreviewDialog } from "@/components/DocumentPreviewDialog";
import DocumentFolderView from "@/components/DocumentFolderView";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { RiskAssessmentTab } from "@/components/RiskAssessmentTab";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useActivityTracker } from "@/lib/activityTracker";
import type { Client, Person, ClientPerson, Service, ClientService, User, WorkRole, ClientServiceRoleAssignment, PeopleService, ProjectWithRelations, Communication, Document, ClientPortalUser } from "@shared/schema";
import { insertPersonSchema, insertCommunicationSchema, insertClientCustomRequestSchema } from "@shared/schema";

// Utility function to format names from "LASTNAME, Firstname" to "Firstname Lastname"
function formatPersonName(fullName: string): string {
  if (!fullName) return '';
  
  // Check if name is in "LASTNAME, Firstname" format
  if (fullName.includes(',')) {
    const [lastName, firstName] = fullName.split(',').map(part => part.trim());
    
    // Convert to proper case and return "Firstname Lastname"
    const formattedFirstName = firstName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    const formattedLastName = lastName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    
    return `${formattedFirstName} ${formattedLastName}`;
  }
  
  // If not in comma format, return as is (already in proper format)
  return fullName;
}

// Utility function to format general dates
function formatDate(date: string | Date | null): string {
  if (!date) return 'Not provided';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// Utility function to format birth dates from Companies House (which only provides month/year)
function formatBirthDate(dateOfBirth: string | Date | null): string {
  if (!dateOfBirth) return 'Not provided';
  
  // Handle string inputs - detect if this looks like a partial date from Companies House
  if (typeof dateOfBirth === 'string') {
    // Pattern for partial dates: "YYYY-MM" or "YYYY-MM-01" with optional time suffix
    const partialDatePattern = /^(\d{4})-(\d{2})(?:-01(?:T00:00:00(?:\.\d+)?Z?)?)?$/;
    const match = dateOfBirth.match(partialDatePattern);
    
    if (match) {
      const [, year, month] = match;
      // This looks like a partial date - show as month/year
      // Use UTC to avoid timezone issues
      const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
      
      // Validate the constructed date
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-GB', { 
        month: 'long', 
        year: 'numeric',
        timeZone: 'UTC'
      });
    }
  }
  
  // For full dates or non-matching patterns, create date object
  const date = new Date(dateOfBirth);
  
  // Handle invalid dates
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  // Show full date for complete date information
  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC'
  });
}

// Portal Status Column Component
function PortalStatusColumn({ 
  personId, 
  personEmail, 
  personName, 
  clientId, 
  clientName 
}: { 
  personId: string; 
  personEmail: string | null; 
  personName: string; 
  clientId: string; 
  clientName: string; 
}) {
  const { toast } = useToast();
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  
  // Fetch portal user status
  const { data: portalUser, isLoading, refetch } = useQuery<ClientPortalUser>({
    queryKey: [`/api/portal-user/by-person/${personId}`],
    enabled: false, // Don't auto-fetch
  });
  
  // Check if person has email
  const hasEmail = Boolean(personEmail);
  
  // Send invitation mutation
  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/portal-user/send-invitation", {
        personId,
        clientId,
        email: personEmail,
        name: formatPersonName(personName),
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
  
  // Generate QR code mutation
  const generateQRMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/portal-user/generate-qr-code", {
        personId,
        clientId,
        email: personEmail,
        name: formatPersonName(personName),
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
  
  // Fetch portal user on mount
  useEffect(() => {
    if (hasEmail) {
      refetch();
    }
  }, [hasEmail, refetch]);
  
  if (!hasEmail) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Portal Access</div>
        <p className="text-sm text-muted-foreground italic">No email available</p>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Portal Access</div>
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Portal Access</div>
      
      {/* Status Indicators */}
      {portalUser && (
        <div className="space-y-2">
          {portalUser.lastLogin && (
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">
                Has App Access
              </span>
            </div>
          )}
          {portalUser.pushNotificationsEnabled && (
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">
                Push Enabled
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => sendInviteMutation.mutate()}
          disabled={sendInviteMutation.isPending}
          data-testid={`button-send-portal-invite-${personId}`}
          className="w-full text-xs"
        >
          {sendInviteMutation.isPending ? "Sending..." : "Send Invite"}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateQRMutation.mutate()}
          disabled={generateQRMutation.isPending}
          data-testid={`button-generate-qr-${personId}`}
          className="w-full text-xs"
        >
          {generateQRMutation.isPending ? "Generating..." : "Show QR Code"}
        </Button>
      </div>
      
      {/* QR Code Dialog */}
      {qrCodeDataUrl && (
        <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Portal Login QR Code</DialogTitle>
              <DialogDescription>
                Scan this QR code to access the portal
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-4">
              <img 
                src={qrCodeDataUrl} 
                alt="Portal Login QR Code"
                className="max-w-full h-auto"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Communication types with relations
type CommunicationWithRelations = Communication & {
  client: Client;
  person?: Person;
  user: User;
};

// Quill editor configuration for email
const emailEditorModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link'],
    ['clean']
  ],
};

const emailEditorFormats = [
  'header', 'bold', 'italic', 'underline',
  'color', 'background', 'list', 'bullet',
  'align', 'link'
];

// Communications Timeline Component
function CommunicationsTimeline({ clientId, user }: { clientId: string; user: any }) {
  const [isAddingCommunication, setIsAddingCommunication] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isCreatingMessage, setIsCreatingMessage] = useState(false);
  const [smsPersonId, setSmsPersonId] = useState<string | undefined>();
  const [emailPersonId, setEmailPersonId] = useState<string | undefined>();
  const [emailContent, setEmailContent] = useState<string>('');
  const [selectedCommunication, setSelectedCommunication] = useState<CommunicationWithRelations | null>(null);
  const [isViewingCommunication, setIsViewingCommunication] = useState(false);
  const [isCallingPerson, setIsCallingPerson] = useState(false);
  const [callPersonId, setCallPersonId] = useState<string | undefined>();
  const [callPhoneNumber, setCallPhoneNumber] = useState<string | undefined>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch communications for this client
  const { data: communications, isLoading } = useQuery<CommunicationWithRelations[]>({
    queryKey: ['/api/communications/client', clientId],
    enabled: !!clientId,
  });

  // Fetch message threads for this client
  const { data: messageThreads, isLoading: isLoadingThreads } = useQuery<any[]>({
    queryKey: ['/api/internal/messages/threads/client', clientId],
    enabled: !!clientId,
  });

  // Fetch client people for person selection
  const { data: clientPeople } = useQuery({
    queryKey: ['/api/clients', clientId, 'people'],
    enabled: !!clientId,
  });

  const addCommunicationMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/communications`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
      setIsAddingCommunication(false);
      toast({
        title: "Communication added",
        description: "The communication has been logged successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add communication. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form schema for adding communications
  const addCommunicationSchema = insertCommunicationSchema.extend({
    type: z.enum(['phone_call', 'note', 'sms_sent', 'sms_received', 'email_sent', 'email_received']),
  }).omit({ userId: true });

  const addCommunicationForm = useForm({
    resolver: zodResolver(addCommunicationSchema),
    defaultValues: {
      clientId,
      type: 'note' as const,
      subject: '',
      content: '',
      personId: undefined,
      actualContactTime: new Date(),
    },
  });

  // Watch the communication type to show/hide SMS/email fields
  const communicationType = addCommunicationForm.watch("type");

  // SMS sending mutation
  const sendSmsMutation = useMutation({
    mutationFn: (data: { to: string; message: string; clientId: string; personId?: string }) => 
      apiRequest('POST', '/api/sms/send', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
      setIsSendingSMS(false);
      toast({
        title: "SMS sent successfully",
        description: "The SMS message has been sent and logged.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error sending SMS",
        description: error?.message || "Failed to send SMS. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Email sending mutation
  const sendEmailMutation = useMutation({
    mutationFn: (data: { to: string; subject: string; content: string; clientId: string; personId?: string; isHtml?: boolean }) => 
      apiRequest('POST', '/api/email/send', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
      setIsSendingEmail(false);
      toast({
        title: "Email sent successfully",
        description: "The email has been sent and logged.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error sending email",
        description: error?.message || "Failed to send email. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create message thread mutation
  const createMessageThreadMutation = useMutation({
    mutationFn: (data: { subject: string; content: string; clientId: string }) =>
      apiRequest('POST', '/api/internal/messages/threads', data),
    onSuccess: (data: any) => {
      setIsCreatingMessage(false);
      toast({
        title: "Message thread created",
        description: "Redirecting to messages...",
      });
      setTimeout(() => {
        setLocation('/messages');
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create message thread",
        variant: "destructive",
      });
    },
  });

  const onSubmitCommunication = (values: any) => {
    // Handle SMS sending separately - now requires person selection
    if (values.type === 'sms_sent') {
      if (!values.personId || values.personId === 'none') {
        toast({
          title: "Person selection required",
          description: "Please select a person to send SMS to.",
          variant: "destructive",
        });
        return;
      }
      
      // Find the selected person and validate mobile number
      const selectedPerson = clientPeople?.find((cp: any) => cp.person.id === values.personId);
      if (!selectedPerson?.person.primaryPhone) {
        toast({
          title: "No mobile number available",
          description: "The selected person does not have a primary mobile number on file. Please update their contact information first.",
          variant: "destructive",
        });
        return;
      }
      
      sendSmsMutation.mutate({
        to: selectedPerson.person.primaryPhone,
        message: values.content,
        clientId: values.clientId,
        personId: values.personId,
      });
    } else if (values.type === 'email_sent') {
      // Handle email sending - also requires person selection for consistency
      if (!values.personId || values.personId === 'none') {
        toast({
          title: "Person selection required",
          description: "Please select a person to send email to.",
          variant: "destructive",
        });
        return;
      }
      
      // Find the selected person and validate email address
      const selectedPerson = clientPeople?.find((cp: any) => cp.person.id === values.personId);
      if (!selectedPerson?.person.primaryEmail) {
        toast({
          title: "No email address available",
          description: "The selected person does not have a primary email address on file. Please update their contact information first.",
          variant: "destructive",
        });
        return;
      }
      
      sendEmailMutation.mutate({
        to: selectedPerson.person.primaryEmail,
        subject: values.subject || 'Message from CRM',
        content: values.content,
        clientId: values.clientId,
        personId: values.personId,
      });
    } else {
      // Handle regular communication logging
      const formData = {
        ...values,
        personId: values.personId === 'none' ? null : values.personId
      };
      addCommunicationMutation.mutate(formData);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'phone_call':
        return <PhoneCall className="h-4 w-4" />;
      case 'note':
        return <FileText className="h-4 w-4" />;
      case 'sms_sent':
        return <Send className="h-4 w-4" />;
      case 'sms_received':
        return <Inbox className="h-4 w-4" />;
      case 'email_sent':
        return <Mail className="h-4 w-4" />;
      case 'email_received':
        return <Inbox className="h-4 w-4" />;
      case 'message_thread':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'phone_call':
        return 'Phone Call';
      case 'note':
        return 'Note';
      case 'sms_sent':
        return 'SMS Sent';
      case 'sms_received':
        return 'SMS Received';
      case 'email_sent':
        return 'Email Sent';
      case 'email_received':
        return 'Email Received';
      case 'message_thread':
        return 'Instant Message';
      default:
        return 'Communication';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'phone_call':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'note':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'sms_sent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'sms_received':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'email_sent':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'email_received':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'message_thread':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  // Merge communications and message threads
  const allItems = [...(communications || []), ...(messageThreads || []).map(thread => ({
    ...thread,
    type: 'message_thread',
    loggedAt: thread.createdAt,
    content: thread.lastMessage?.content || '',
  }))].sort((a, b) => 
    new Date(b.loggedAt || b.createdAt).getTime() - new Date(a.loggedAt || a.createdAt).getTime()
  );

  if (isLoading || isLoadingThreads) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Communications Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Communications Timeline
          </CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsCallingPerson(true)}
              size="sm"
              variant="outline"
              data-testid="button-make-call"
            >
              <PhoneCall className="h-4 w-4 mr-2" />
              Make Call
            </Button>
            <Button
              onClick={() => setIsSendingSMS(true)}
              size="sm"
              variant="outline"
              data-testid="button-send-sms"
            >
              <Send className="h-4 w-4 mr-2" />
              Send SMS
            </Button>
            <Button
              onClick={() => setIsSendingEmail(true)}
              size="sm"
              variant="outline"
              data-testid="button-send-email"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
            <Button
              onClick={() => setIsCreatingMessage(true)}
              size="sm"
              variant="default"
              data-testid="button-instant-message"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Instant Message
            </Button>
            <Button
              onClick={() => setIsAddingCommunication(true)}
              size="sm"
              data-testid="button-add-communication"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Communication
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!allItems || allItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No communications recorded yet</p>
            <p className="text-sm">Add phone calls, notes, or messages to track client interactions</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Date/Time</TableHead>
                <TableHead>Subject/Content</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allItems.map((item: any) => (
                <TableRow key={item.id} data-testid={`communication-row-${item.id}`}>
                  <TableCell data-testid={`cell-type-${item.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        {getIcon(item.type)}
                      </div>
                      <Badge variant="secondary" className={getTypeColor(item.type)} data-testid={`badge-type-${item.id}`}>
                        {getTypeLabel(item.type)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`cell-date-${item.id}`}>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm" data-testid={`text-date-${item.id}`}>
                        {item.loggedAt ? new Date(item.loggedAt).toLocaleString() : 
                         item.createdAt ? new Date(item.createdAt).toLocaleString() : 'No date'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`cell-content-${item.id}`}>
                    <div className="max-w-md">
                      {item.type === 'message_thread' ? (
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {item.subject}
                            {item.attachmentCount > 0 && (
                              <span className="inline-flex items-center text-xs text-muted-foreground">
                                📎 {item.attachmentCount}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.messageCount || 0} message{(item.messageCount || 0) !== 1 ? 's' : ''}
                            {item.unreadCount > 0 && (
                              <Badge variant="destructive" className="ml-2">
                                {item.unreadCount} unread
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm truncate">
                          {item.subject && <div className="font-medium">{item.subject}</div>}
                          {item.content && <div className="text-muted-foreground text-xs">{item.content.substring(0, 50)}...</div>}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell data-testid={`cell-user-${item.id}`}>
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm" data-testid={`text-user-${item.id}`}>
                        {item.user ? `${item.user.firstName} ${item.user.lastName}` : 
                         item.createdBy ? `User ${item.createdBy}` : 'System'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.type === 'message_thread' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/messages?thread=${item.id}`)}
                        data-testid={`button-view-thread-${item.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Thread
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCommunication(item);
                          setIsViewingCommunication(true);
                        }}
                        data-testid={`button-view-communication-${item.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add Communication Modal */}
      <Dialog open={isAddingCommunication} onOpenChange={setIsAddingCommunication}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Communication</DialogTitle>
          </DialogHeader>
          <Form {...addCommunicationForm}>
            <form onSubmit={addCommunicationForm.handleSubmit(onSubmitCommunication)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addCommunicationForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Communication Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-communication-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="phone_call">Phone Call</SelectItem>
                          <SelectItem value="note">Note</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addCommunicationForm.control}
                  name="personId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger data-testid="select-person">
                            <SelectValue placeholder="Select person" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No specific person</SelectItem>
                          {clientPeople?.map((cp: any) => (
                            <SelectItem key={cp.person.id} value={cp.person.id}>
                              {formatPersonName(cp.person.fullName)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={addCommunicationForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Brief description or call purpose"
                        data-testid="input-subject"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* SMS and Email fields removed - now handled by separate dedicated dialogs */}

              <FormField
                control={addCommunicationForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter communication details, call notes, or message content..."
                        className="min-h-32"
                        data-testid="textarea-content"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Record detailed notes about the communication
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingCommunication(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addCommunicationMutation.isPending}
                  data-testid="button-save-communication"
                >
                  {addCommunicationMutation.isPending ? 'Saving...' : 'Save Communication'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* SMS Sending Dialog */}
      <Dialog open={isSendingSMS} onOpenChange={setIsSendingSMS}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send SMS
            </DialogTitle>
            <DialogDescription>
              Send an SMS using the selected person's Primary Mobile. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const message = formData.get('message') as string;

              if (!smsPersonId) {
                toast({ title: 'Contact person required', description: 'Please select a person to send the SMS to.', variant: 'destructive' });
                return;
              }
              const selected = (clientPeople || []).find((cp: any) => cp.person.id === smsPersonId);
              const to = selected?.person?.primaryPhone;

              if (!to) {
                toast({ title: 'No mobile number', description: 'The selected person has no Primary Mobile saved.', variant: 'destructive' });
                return;
              }
              if (!message?.trim()) {
                toast({ title: 'Message required', description: 'Please enter a message.', variant: 'destructive' });
                return;
              }

              sendSmsMutation.mutate({
                to,
                message,
                clientId,
                personId: smsPersonId,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Person <span className="text-destructive">*</span></label>
              <Select value={smsPersonId} onValueChange={(value) => setSmsPersonId(value)}>
                <SelectTrigger data-testid="select-sms-person">
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  {(clientPeople || []).map((cp: any) => (
                    <SelectItem key={cp.person.id} value={cp.person.id}>
                      {formatPersonName(cp.person.fullName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {smsPersonId && (
                <p className="text-xs text-muted-foreground">
                  Mobile: {(clientPeople || []).find((cp: any) => cp.person.id === smsPersonId)?.person?.primaryPhone || '—'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Message <span className="text-destructive">*</span></label>
              <Textarea
                name="message"
                placeholder="Enter your SMS message..."
                className="min-h-20"
                data-testid="input-sms-message-dialog"
                required
              />
              <p className="text-xs text-muted-foreground">Uses the person's Primary Mobile (stored in +447… format)</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsSendingSMS(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendSmsMutation.isPending} data-testid="button-send-sms-dialog">
                {sendSmsMutation.isPending ? 'Sending...' : 'Send SMS'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Email Sending Dialog */}
      <Dialog open={isSendingEmail} onOpenChange={(open) => {
        setIsSendingEmail(open);
        if (open) {
          // Reset form when opening
          setEmailContent('');
          setEmailPersonId(undefined);
        }
      }}>
        <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Email
            </DialogTitle>
            <DialogDescription>
              Send an email using the selected person's Primary Email. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const subject = formData.get('subject') as string;
            
            if (!emailPersonId) {
              toast({ title: 'Contact person required', description: 'Please select a person to send the email to.', variant: 'destructive' });
              return;
            }
            const selected = (clientPeople || []).find((cp: any) => cp.person.id === emailPersonId);
            const to = selected?.person?.primaryEmail;

            if (!to) {
              toast({ title: 'No email address', description: 'The selected person has no Primary Email saved.', variant: 'destructive' });
              return;
            }
            // Check for empty content (Quill returns HTML even when empty)
            const textContent = emailContent
              .replace(/<[^>]*>/g, '')  // Remove HTML tags
              .replace(/&nbsp;/g, ' ')   // Replace non-breaking spaces
              .replace(/&[a-zA-Z]+;/g, '') // Remove other HTML entities
              .trim();
            if (!textContent || textContent.length === 0) {
              toast({ title: 'Message required', description: 'Please enter a message.', variant: 'destructive' });
              return;
            }
            
            // Append user's email signature if it exists
            let finalEmailContent = emailContent;
            if (user?.emailSignature && user.emailSignature.trim()) {
              // Add some spacing before the signature
              const spacing = emailContent.trim() ? '<br><br>' : '';
              finalEmailContent = emailContent + spacing + user.emailSignature;
            }
            
            sendEmailMutation.mutate({
              to,
              subject: subject || 'Message from CRM',
              content: finalEmailContent,
              isHtml: true,
              clientId: clientId,
              personId: emailPersonId,
            });
            
            // Form will be reset in onSuccess handler
          }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Person <span className="text-destructive">*</span></label>
              <Select value={emailPersonId} onValueChange={(value) => setEmailPersonId(value)}>
                <SelectTrigger data-testid="select-email-person">
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  {(clientPeople || []).map((cp: any) => (
                    <SelectItem key={cp.person.id} value={cp.person.id}>
                      {formatPersonName(cp.person.fullName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {emailPersonId && (
                <p className="text-xs text-muted-foreground">
                  Email: {(clientPeople || []).find((cp: any) => cp.person.id === emailPersonId)?.person?.primaryEmail || '—'}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input
                name="subject"
                placeholder="Message from CRM"
                data-testid="input-email-subject-dialog"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Message <span className="text-destructive">*</span></label>
              <ResizablePanelGroup direction="vertical" className="min-h-[300px] border rounded-md">
                <ResizablePanel defaultSize={100} minSize={40}>
                  <div data-testid="input-email-content-editor" className="h-full p-0">
                    <ReactQuill
                      value={emailContent}
                      onChange={setEmailContent}
                      modules={emailEditorModules}
                      formats={emailEditorFormats}
                      theme="snow"
                      placeholder="Enter your email message..."
                      className="h-full"
                      style={{ height: '100%' }}
                    />
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={0} minSize={0} className="bg-muted/20">
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    Drag to resize editor
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
              <p className="text-xs text-muted-foreground">Uses the person's Primary Email address • Drag the handle above to resize editor height</p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsSendingEmail(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendEmailMutation.isPending} data-testid="button-send-email-dialog">
                {sendEmailMutation.isPending ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Communication Detail Modal */}
      <Dialog open={isViewingCommunication} onOpenChange={setIsViewingCommunication}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCommunication && getIcon(selectedCommunication.type)}
              Communication Details
            </DialogTitle>
          </DialogHeader>
          {selectedCommunication && (
            <div className="space-y-4">
              {/* Header Information */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <span className="text-xs text-muted-foreground">Type</span>
                  <div className="mt-1">
                    <Badge variant="secondary" className={getTypeColor(selectedCommunication.type)} data-testid={`modal-badge-type-${selectedCommunication.id}`}>
                      {getTypeLabel(selectedCommunication.type)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Date/Time</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-modal-date-${selectedCommunication.id}`}>
                      {selectedCommunication.loggedAt 
                        ? new Date(selectedCommunication.loggedAt).toLocaleString() 
                        : 'No date'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Created By</span>
                  <div className="mt-1 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-modal-user-${selectedCommunication.id}`}>
                      {selectedCommunication.user.firstName} {selectedCommunication.user.lastName}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Contact Person</span>
                  <div className="mt-1">
                    {selectedCommunication.person ? (
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid={`text-modal-person-${selectedCommunication.id}`}>
                          {formatPersonName(selectedCommunication.person.fullName)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground" data-testid={`text-modal-no-person-${selectedCommunication.id}`}>—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Subject */}
              {selectedCommunication.subject && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Subject</span>
                  <h4 className="font-medium text-lg mt-1" data-testid={`text-modal-subject-${selectedCommunication.id}`}>
                    {selectedCommunication.subject}
                  </h4>
                </div>
              )}

              {/* Content */}
              {selectedCommunication.content && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Content</span>
                  <div className="mt-2 p-4 bg-muted/30 rounded-lg" data-testid={`div-modal-content-${selectedCommunication.id}`}>
                    {selectedCommunication.type === 'email_sent' || selectedCommunication.type === 'email_received' ? (
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(selectedCommunication.content, {
                            ALLOWED_TAGS: ['br', 'p', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'],
                            ALLOWED_ATTR: ['href', 'style', 'class'],
                            ALLOW_DATA_ATTR: false
                          })
                        }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{selectedCommunication.content}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setIsViewingCommunication(false)}
                  data-testid="button-close-communication-detail"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Instant Message Dialog */}
      <Dialog open={isCreatingMessage} onOpenChange={setIsCreatingMessage}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Create Instant Message
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Start a new secure message thread with the client
            </p>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createMessageThreadMutation.mutate({
              subject: formData.get('subject') as string,
              content: formData.get('content') as string,
              clientId: clientId,
            });
          }}>
            <div className="space-y-4">
              <div>
                <label htmlFor="subject" className="text-sm font-medium">Subject</label>
                <Input
                  id="subject"
                  name="subject"
                  placeholder="e.g., Document request, Account update..."
                  required
                  data-testid="input-message-subject"
                />
              </div>
              <div>
                <label htmlFor="content" className="text-sm font-medium">Initial Message</label>
                <textarea
                  id="content"
                  name="content"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Type your message here..."
                  required
                  data-testid="input-message-content"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreatingMessage(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMessageThreadMutation.isPending} data-testid="button-send-message">
                {createMessageThreadMutation.isPending ? 'Creating...' : 'Create & Send'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Call Dialog */}
      <CallDialog
        clientId={clientId}
        personId={callPersonId}
        phoneNumber={callPhoneNumber}
        isOpen={isCallingPerson}
        onClose={() => {
          setIsCallingPerson(false);
          setCallPersonId(undefined);
          setCallPhoneNumber(undefined);
        }}
      />
    </Card>
  );
}

// Call Dialog Component
function CallDialog({ 
  clientId, 
  personId, 
  phoneNumber,
  isOpen,
  onClose
}: { 
  clientId: string; 
  personId?: string; 
  phoneNumber?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>(personId);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | undefined>(phoneNumber);
  
  // Fetch client people for person selection
  const { data: clientPeople } = useQuery({
    queryKey: ['/api/clients', clientId, 'people'],
    enabled: !!clientId && isOpen,
  });

  // Update selected person when prop changes
  useEffect(() => {
    setSelectedPersonId(personId);
    setSelectedPhoneNumber(phoneNumber);
  }, [personId, phoneNumber]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Make a Call</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Person Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Person (Optional)</label>
            <Select
              value={selectedPersonId || 'none'}
              onValueChange={(value) => {
                if (value === 'none') {
                  setSelectedPersonId(undefined);
                  setSelectedPhoneNumber(undefined);
                } else {
                  setSelectedPersonId(value);
                  const selected = (clientPeople || []).find((cp: any) => cp.person.id === value);
                  setSelectedPhoneNumber(selected?.person?.primaryPhone || undefined);
                }
              }}
            >
              <SelectTrigger data-testid="select-call-person">
                <SelectValue placeholder="Select a person..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No person selected</SelectItem>
                {(clientPeople || []).map((cp: any) => (
                  <SelectItem key={cp.person.id} value={cp.person.id}>
                    {cp.person.firstName} {cp.person.lastName}
                    {cp.person.primaryPhone && ` - ${cp.person.primaryPhone}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ring Central Phone Component */}
          <RingCentralPhone
            clientId={clientId}
            personId={selectedPersonId}
            defaultPhoneNumber={selectedPhoneNumber}
            onCallComplete={(data) => {
              queryClient.invalidateQueries({ queryKey: ['/api/communications/client', clientId] });
              toast({
                title: "Call logged",
                description: "Call has been recorded in communications timeline",
              });
              onClose();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ClientPersonWithPerson = ClientPerson & { person: Person };
type ClientPersonWithClient = ClientPerson & { client: Client };
type ClientServiceWithService = ClientService & { 
  service: Service & { 
    projectType: { id: string; name: string; description: string | null; serviceId: string | null; active: boolean | null; order: number; createdAt: Date | null } 
  } 
};

// Types for enhanced service data
type ServiceWithDetails = Service & {
  roles: WorkRole[];
};

// Enhanced client service type that includes service owner and role assignments
type EnhancedClientService = ClientService & {
  service: Service & {
    projectType?: {
      id: string;
      name: string;
      description: string | null;
      serviceId: string | null;
      active: boolean | null;
      order: number;
      createdAt: Date | null;
    };
  };
  serviceOwner?: User;
  roleAssignments: (ClientServiceRoleAssignment & {
    workRole: WorkRole;
    user: User;
  })[];
};

// Form schema for adding services (conditional validation based on service type)
const addServiceSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]).optional(),
  nextStartDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  serviceOwnerId: z.string().optional(),
});

type AddServiceData = z.infer<typeof addServiceSchema>;

// Validation schema for adding new person data
const addPersonSchema = insertPersonSchema.extend({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  email2: z.string().email("Invalid email format").optional().or(z.literal("")),
  telephone2: z.string().optional().or(z.literal("")),
  linkedinUrl: z.union([z.string().url("Invalid LinkedIn URL"), z.literal("")]).optional(),
  instagramUrl: z.union([z.string().url("Invalid Instagram URL"), z.literal("")]).optional(),
  twitterUrl: z.union([z.string().url("Invalid Twitter/X URL"), z.literal("")]).optional(),
  facebookUrl: z.union([z.string().url("Invalid Facebook URL"), z.literal("")]).optional(),
  tiktokUrl: z.union([z.string().url("Invalid TikTok URL"), z.literal("")]).optional(),
});

type InsertPersonData = z.infer<typeof addPersonSchema>;

// Validation schema for updating person data - use shared schema for consistency
const updatePersonSchema = insertPersonSchema.partial().extend({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  email2: z.string().email("Invalid email format").optional().or(z.literal("")),
  telephone2: z.string().optional().or(z.literal("")),
  // Primary contact fields
  primaryPhone: z.string().optional().or(z.literal("")),
  primaryEmail: z.string().email("Invalid email format").optional().or(z.literal("")),
  linkedinUrl: z.union([z.string().url("Invalid LinkedIn URL"), z.literal("")]).optional(),
  instagramUrl: z.union([z.string().url("Invalid Instagram URL"), z.literal("")]).optional(),
  twitterUrl: z.union([z.string().url("Invalid Twitter/X URL"), z.literal("")]).optional(),
  facebookUrl: z.union([z.string().url("Invalid Facebook URL"), z.literal("")]).optional(),
  tiktokUrl: z.union([z.string().url("Invalid TikTok URL"), z.literal("")]).optional(),
});

type UpdatePersonData = z.infer<typeof updatePersonSchema>;

// Schema for editing service data
const editServiceSchema = z.object({
  nextStartDate: z.string().optional(),
  nextDueDate: z.string().optional(),
  serviceOwnerId: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]).optional(),
  isActive: z.boolean().optional(),
  roleAssignments: z.array(z.object({
    workRoleId: z.string(),
    userId: z.string(),
  })).optional(),
});

type EditServiceData = z.infer<typeof editServiceSchema>;

// Helper function to mask sensitive identifiers
function maskIdentifier(value: string, visibleChars = 2): string {
  if (!value || value.length <= visibleChars) return value;
  const masked = '*'.repeat(Math.max(0, value.length - visibleChars));
  return masked + value.slice(-visibleChars);
}

// PersonCardProps removed - using Accordion pattern

interface AddServiceModalProps {
  clientId: string;
  clientType?: 'company' | 'individual';
  onSuccess: () => void;
}

function AddServiceModal({ clientId, clientType = 'company', onSuccess }: AddServiceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const { toast } = useToast();
  
  // Helper function to determine field state for visual indicators
  const getFieldState = (fieldName: keyof AddServiceData, isRequired: boolean = false): 'required-empty' | 'required-filled' | 'optional' | 'error' => {
    const formErrors = form.formState.errors;
    const fieldValue = form.getValues(fieldName);
    const hasError = !!formErrors[fieldName];
    
    if (hasError) return 'error';
    
    if (isRequired) {
      return fieldValue ? 'required-filled' : 'required-empty';
    }
    
    return 'optional';
  };
  
  // Helper for role assignment field states
  const getRoleFieldState = (roleId: string): 'required-empty' | 'required-filled' | 'error' => {
    const hasAssignment = !!roleAssignments[roleId];
    return hasAssignment ? 'required-filled' : 'required-empty';
  };
  
  // Helper for person selection field state
  const getPersonFieldState = (): 'required-empty' | 'required-filled' | 'error' => {
    return selectedPersonId ? 'required-filled' : 'required-empty';
  };
  
  const form = useForm<AddServiceData>({
    resolver: zodResolver(addServiceSchema),
    defaultValues: {
      frequency: "monthly",
      nextStartDate: "",
      nextDueDate: "",
      serviceOwnerId: "",
    },
  });

  // Fetch client data for Companies House fields
  const { data: client } = useQuery<Client>({
    queryKey: [`/api/clients/${clientId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });

  // Fetch available services based on client type
  const servicesQueryKey = clientType === 'individual' 
    ? ['/api/services'] // All services (will filter to personal services only)
    : ['/api/services/client-assignable']; // Client assignable services only
    
  const { data: allServices, isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: servicesQueryKey,
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });
  
  // Filter services based on client type
  const services = clientType === 'individual' 
    ? allServices?.filter(service => service.isPersonalService) 
    : allServices;

  // Fetch related people for this client (needed for personal service assignment)
  const { data: clientPeople, isLoading: peopleLoading } = useQuery<ClientPersonWithPerson[]>({
    queryKey: [`/api/clients/${clientId}/people`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(isOpen && selectedService?.isPersonalService),
  });

  // Fetch users for role assignments and service owner selection
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOpen,
  });

  // Service selection change handler with Companies House auto-population and personal service detection
  const handleServiceChange = (serviceId: string) => {
    const service = services?.find(s => s.id === serviceId);
    if (!service) return;
    
    setSelectedService(service);
    
    // Reset assignments when service changes
    setRoleAssignments({});
    setSelectedPersonId("");
    
    // Clear fields for static services (they don't need frequency, dates, or owner)
    if (service.isStaticService) {
      form.setValue('frequency', undefined as any);
      form.setValue('nextStartDate', '');
      form.setValue('nextDueDate', '');
      form.setValue('serviceOwnerId', '');
    }
    // Auto-populate Companies House fields if service is CH-connected
    else if (service.isCompaniesHouseConnected && client) {
      // Force annual frequency
      form.setValue('frequency', 'annually');
      
      // Auto-populate start and due dates from client CH data
      if (service.chStartDateField && service.chDueDateField) {
        const startDateValue = client[service.chStartDateField as keyof Client] as string | Date | null;
        const dueDateValue = client[service.chDueDateField as keyof Client] as string | Date | null;
        
        if (startDateValue) {
          const startDate = new Date(startDateValue);
          form.setValue('nextStartDate', startDate.toISOString().split('T')[0]);
        }
        
        if (dueDateValue) {
          const dueDate = new Date(dueDateValue);
          form.setValue('nextDueDate', dueDate.toISOString().split('T')[0]);
        }
      }
    }
  };
  
  // Handle role assignment changes
  const handleRoleAssignmentChange = (roleId: string, userId: string) => {
    setRoleAssignments(prev => ({ ...prev, [roleId]: userId }));
  };
  
  // Validate that all roles are assigned (gracefully handle missing roles data)
  const areAllRolesAssigned = () => {
    if (!selectedService || !selectedService.roles || selectedService.roles.length === 0) return true;
    return selectedService.roles.every(role => roleAssignments[role.id]);
  };

  // Validate form is ready for submission
  const canSubmit = () => {
    if (!selectedService) return false;
    if (isPersonalService) {
      return !!selectedPersonId; // Personal service requires person selection
    } else {
      return areAllRolesAssigned(); // Client service requires role assignments
    }
  };
  
  // Check if service has roles that need assignment
  const hasRolesToAssign = () => {
    return selectedService?.roles && selectedService.roles.length > 0;
  };

  // Check if selected service is personal service
  const isPersonalService = selectedService?.isPersonalService || false;

  // Handle person selection change
  const handlePersonChange = (personId: string) => {
    setSelectedPersonId(personId);
  };

  // Create people service mutation for personal services
  const createPeopleServiceMutation = useMutation({
    mutationFn: async (data: AddServiceData) => {
      // Convert date strings to datetime format for backend validation
      const formatDateToDateTime = (dateString: string | undefined): string | null => {
        if (!dateString) return null;
        // HTML date inputs provide YYYY-MM-DD format, convert to ISO datetime
        return new Date(dateString + 'T00:00:00.000Z').toISOString();
      };

      return await apiRequest("POST", "/api/people-services", {
        personId: selectedPersonId,
        serviceId: data.serviceId,
        serviceOwnerId: data.serviceOwnerId || null,
        frequency: data.frequency,
        nextStartDate: formatDateToDateTime(data.nextStartDate),
        nextDueDate: formatDateToDateTime(data.nextDueDate),
        notes: null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Personal Service Added",
        description: "Personal service has been successfully assigned to the person.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/people-services/service/${selectedService?.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/people`] });
      form.reset();
      setSelectedService(null);
      setSelectedPersonId("");
      setRoleAssignments({});
      setIsOpen(false);
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add personal service. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create client service mutation with role assignments
  const createClientServiceMutation = useMutation({
    mutationFn: async (data: AddServiceData) => {
      // Step 1: Create the client service
      const clientService = await apiRequest("POST", "/api/client-services", {
        clientId,
        serviceId: data.serviceId,
        frequency: data.frequency,
        nextStartDate: data.nextStartDate && data.nextStartDate.trim() ? new Date(data.nextStartDate).toISOString() : null,
        nextDueDate: data.nextDueDate && data.nextDueDate.trim() ? new Date(data.nextDueDate).toISOString() : null,
        serviceOwnerId: data.serviceOwnerId && data.serviceOwnerId.trim() ? data.serviceOwnerId : null,
      });
      
      // Step 2: Create role assignments if any roles are assigned
      if (selectedService?.roles && roleAssignments && Object.keys(roleAssignments).length > 0) {
        try {
          const roleAssignmentPromises = Object.entries(roleAssignments).map(([roleId, userId]) => 
            apiRequest("POST", `/api/client-services/${clientService.id}/role-assignments`, {
              workRoleId: roleId,
              userId: userId,
            })
          );
          
          await Promise.all(roleAssignmentPromises);
        } catch (roleError) {
          // Role assignment failed but service was created - inform user
          throw new Error(`Service was created but role assignments failed: ${roleError instanceof Error ? roleError.message : 'Unknown error'}. Please assign roles manually from the service management page.`);
        }
      }
      
      return clientService;
    },
    onSuccess: () => {
      toast({
        title: "Service Added",
        description: "Service has been successfully added to the client.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/client-services/client/${clientId}`] });
      form.reset();
      setSelectedService(null);
      setRoleAssignments({});
      setIsOpen(false);
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add service. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddServiceData) => {
    // Handle personal services vs client services
    if (isPersonalService) {
      // Validate person selection for personal services
      if (!selectedPersonId) {
        toast({
          title: "Person Required",
          description: "Please select a person to assign this personal service to.",
          variant: "destructive",
        });
        return;
      }
      createPeopleServiceMutation.mutate(data);
    } else {
      // Skip validation for static services (they don't require frequency, dates, or service owner)
      if (!isStaticService) {
        // Validate required fields for non-static client services
        if (!data.frequency) {
          toast({
            title: "Frequency Required",
            description: "Please select a frequency for this client service.",
            variant: "destructive",
          });
          return;
        }
        if (!data.nextStartDate) {
          toast({
            title: "Start Date Required", 
            description: "Please select a next start date for this client service.",
            variant: "destructive",
          });
          return;
        }
        if (!data.nextDueDate) {
          toast({
            title: "Due Date Required",
            description: "Please select a next due date for this client service.",
            variant: "destructive",
          });
          return;
        }
        if (!data.serviceOwnerId) {
          toast({
            title: "Service Owner Required",
            description: "Please select a service owner for this client service.",
            variant: "destructive",
          });
          return;
        }
        // Validate role assignments for client services
        if (!areAllRolesAssigned()) {
          toast({
            title: "Incomplete Role Assignments",
            description: "Please assign users to all required roles before saving.",
            variant: "destructive",
          });
          return;
        }
      }
      createClientServiceMutation.mutate(data);
    }
  };
  
  // Check if Companies House service is selected
  const isCompaniesHouseService = selectedService?.isCompaniesHouseConnected || false;
  
  // Check if Static service is selected
  const isStaticService = selectedService?.isStaticService || false;
  
  // Helper to check if field should be disabled (only if CH service AND data was successfully populated)
  const isFieldDisabled = (fieldName: 'frequency' | 'nextStartDate' | 'nextDueDate') => {
    if (!isCompaniesHouseService) return false;
    
    // Only disable if the field was actually populated with CH data
    if (fieldName === 'frequency') {
      return form.getValues('frequency') === 'annually';
    }
    if (fieldName === 'nextStartDate') {
      return !!form.getValues('nextStartDate');
    }
    if (fieldName === 'nextDueDate') {
      return !!form.getValues('nextDueDate');
    }
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-service">
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Service</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Column 1: Service Details */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Service Details</h3>
                <FormField
                  control={form.control}
                  name="serviceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        required={true} 
                        fieldState={getFieldState('serviceId', true)}
                      >
                        Service
                      </FormLabel>
                      <Select onValueChange={(value) => { field.onChange(value); handleServiceChange(value); }} value={field.value}>
                        <FormControl>
                          <SelectTrigger 
                            data-testid="select-service"
                            fieldState={getFieldState('serviceId', true)}
                          >
                            <SelectValue placeholder="Select a service" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {servicesLoading ? (
                            <div className="p-2 text-center text-muted-foreground">Loading services...</div>
                          ) : services && services.length > 0 ? (
                            services.map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.name}
                                {service.isPersonalService && (
                                  <Badge variant="secondary" className="ml-2 text-xs">Personal Service</Badge>
                                )}
                                {service.isStaticService && (
                                  <Badge variant="outline" className="ml-2 text-xs text-gray-500 border-gray-300">Static</Badge>
                                )}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-center text-muted-foreground">No services available</div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Wrapper for fields that should be grayed out for static services */}
                <div className="relative">
                  {/* Overlay for static services */}
                  {isStaticService && (
                    <div className="absolute inset-0 bg-blue-100/80 dark:bg-blue-950/80 rounded-lg z-10 flex items-center justify-center backdrop-blur-sm">
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-blue-200 dark:border-blue-700 max-w-sm">
                        <p className="text-sm text-blue-900 dark:text-blue-100 text-center font-medium">
                          No details are required for the <span className="font-semibold">{selectedService?.name}</span> service
                        </p>
                      </div>
                    </div>
                  )}

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        fieldState={isPersonalService || isStaticService ? 'optional' : getFieldState('frequency', !isPersonalService && !isStaticService)}
                      >
                        Frequency
                      </FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={isFieldDisabled('frequency') || isStaticService}
                      >
                        <FormControl>
                          <SelectTrigger 
                            data-testid="select-frequency"
                            fieldState={isFieldDisabled('frequency') || isStaticService ? undefined : (isPersonalService ? 'optional' : getFieldState('frequency', !isPersonalService))}
                            className={isFieldDisabled('frequency') || isStaticService ? 'bg-muted text-muted-foreground pointer-events-none' : ''}
                          >
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                      {isCompaniesHouseService && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Frequency is automatically set to "Annually" for Companies House services
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        fieldState={isPersonalService || isStaticService ? 'optional' : getFieldState('nextStartDate', !isPersonalService && !isStaticService)}
                      >
                        Next Start Date
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-next-start-date"
                          fieldState={isFieldDisabled('nextStartDate') || isStaticService ? undefined : (isPersonalService ? 'optional' : getFieldState('nextStartDate', !isPersonalService))}
                          disabled={isFieldDisabled('nextStartDate') || isStaticService}
                          className={isFieldDisabled('nextStartDate') || isStaticService ? 'bg-muted text-muted-foreground pointer-events-none' : ''}
                        />
                      </FormControl>
                      {isCompaniesHouseService && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Date automatically populated from Companies House data
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextDueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        fieldState={isPersonalService || isStaticService ? 'optional' : getFieldState('nextDueDate', !isPersonalService && !isStaticService)}
                      >
                        Next Due Date
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-next-due-date"
                          fieldState={isFieldDisabled('nextDueDate') || isStaticService ? undefined : (isPersonalService ? 'optional' : getFieldState('nextDueDate', !isPersonalService))}
                          disabled={isFieldDisabled('nextDueDate') || isStaticService}
                          className={isFieldDisabled('nextDueDate') || isStaticService ? 'bg-muted text-muted-foreground pointer-events-none' : ''}
                        />
                      </FormControl>
                      {isCompaniesHouseService && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Date automatically populated from Companies House data
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
              </div>

              {/* Column 2: Service Owner & Role Assignments */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Owner & Team</h3>
                
                {/* Wrapper for Service Owner that should be grayed out for static services */}
                <div className="relative">
                  {/* Overlay for static services */}
                  {isStaticService && (
                    <div className="absolute inset-0 bg-blue-100/80 dark:bg-blue-950/80 rounded-lg z-10 flex items-center justify-center backdrop-blur-sm">
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-blue-200 dark:border-blue-700 max-w-sm">
                        <p className="text-sm text-blue-900 dark:text-blue-100 text-center font-medium">
                          No owner assignment needed
                        </p>
                      </div>
                    </div>
                  )}

                <FormField
                  control={form.control}
                  name="serviceOwnerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        required={!isPersonalService && !isStaticService} 
                        fieldState={isPersonalService || isStaticService ? 'optional' : getFieldState('serviceOwnerId', !isPersonalService && !isStaticService)}
                      >
                        Service Owner
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isStaticService}>
                        <FormControl>
                          <SelectTrigger 
                            data-testid="select-service-owner"
                            fieldState={isPersonalService || isStaticService ? 'optional' : getFieldState('serviceOwnerId', !isPersonalService && !isStaticService)}
                            className={isStaticService ? 'bg-muted text-muted-foreground pointer-events-none' : ''}
                          >
                            <SelectValue placeholder="Select service owner" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {usersLoading ? (
                            <div className="p-2 text-center text-muted-foreground">Loading users...</div>
                          ) : users && users.length > 0 ? (
                            users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-center text-muted-foreground">No users available</div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>

                {/* Person Selection - Only shown for personal services */}
                {isPersonalService && (
                  <div className="space-y-2">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <UserIcon className="w-4 h-4 text-blue-600" />
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">Personal Service Assignment</h4>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-200 mb-4">
                        This is a personal service. Please select the person to assign this service to.
                      </p>
                      {peopleLoading ? (
                        <div className="text-sm text-muted-foreground">Loading related people...</div>
                      ) : clientPeople && clientPeople.length > 0 ? (
                        <div>
                          <label className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 block">
                            Select Person <span className="text-red-500">*</span>
                          </label>
                          <Select onValueChange={handlePersonChange} value={selectedPersonId}>
                            <SelectTrigger 
                              data-testid="select-person" 
                              fieldState={getPersonFieldState()}
                              className="bg-white dark:bg-gray-800"
                            >
                              <SelectValue placeholder="Choose a person to assign this service to" />
                            </SelectTrigger>
                            <SelectContent>
                              {clientPeople.map((clientPerson) => (
                                <SelectItem key={clientPerson.person.id} value={clientPerson.person.id}>
                                  {formatPersonName(clientPerson.person.fullName)}
                                  {(clientPerson.person.primaryEmail || clientPerson.person.email) && (
                                    <span className="text-muted-foreground ml-2">({clientPerson.person.primaryEmail || clientPerson.person.email})</span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="text-sm text-amber-700 dark:text-amber-200">
                          No people are associated with this client yet. Please add people to the client first.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Role Assignments Section */}
                {hasRolesToAssign() && (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-sm mb-3">Role Assignments</h4>
                      <p className="text-xs text-muted-foreground mb-4">
                        Assign users to the required roles for this service.
                      </p>
                      
                      <div className="space-y-3">
                        {selectedService?.roles?.map((role) => (
                          <div key={role.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h5 className="font-medium text-sm">{role.name}</h5>
                                {role.description && (
                                  <p className="text-xs text-muted-foreground">{role.description}</p>
                                )}
                              </div>
                            </div>
                            <Select 
                              value={roleAssignments[role.id] || ""} 
                              onValueChange={(userId) => handleRoleAssignmentChange(role.id, userId)}
                            >
                              <SelectTrigger 
                                className="w-full" 
                                data-testid={`select-role-${role.id}`}
                                fieldState={getRoleFieldState(role.id)}
                              >
                                <SelectValue placeholder="Select user" />
                              </SelectTrigger>
                              <SelectContent>
                                {usersLoading ? (
                                  <div className="p-2 text-center text-muted-foreground">Loading users...</div>
                                ) : users && users.length > 0 ? (
                                  users.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {user.firstName} {user.lastName}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="p-2 text-center text-muted-foreground">No users available</div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                      
                      {/* Role assignment validation message */}
                      {hasRolesToAssign() && !areAllRolesAssigned() && !isPersonalService && (
                        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            Please assign users to all roles before saving the service.
                          </p>
                        </div>
                      )}
                      
                      {/* Personal service validation message */}
                      {isPersonalService && !selectedPersonId && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Please select a person to assign this personal service to.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                data-testid="button-cancel-add-service"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createClientServiceMutation.isPending || createPeopleServiceMutation.isPending || !canSubmit()}
                data-testid="button-save-service"
              >
                {(createClientServiceMutation.isPending || createPeopleServiceMutation.isPending) ? 
                  "Adding..." : 
                  isPersonalService ? "Assign Personal Service" : "Add Service"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Add Person Modal Component
function AddPersonModal({ 
  clientId, 
  isOpen, 
  onClose, 
  onSave, 
  isSaving 
}: {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InsertPersonData) => void;
  isSaving: boolean;
}) {
  const form = useForm<InsertPersonData>({
    resolver: zodResolver(insertPersonSchema),
    defaultValues: {
      fullName: "",
      title: "",
      dateOfBirth: "",
      nationality: "",
      occupation: "",
      telephone: "",
      email: "",
      primaryPhone: "",
      primaryEmail: "",
      telephone2: "",
      email2: "",
      linkedinUrl: "",
      twitterUrl: "",
      facebookUrl: "",
      instagramUrl: "",
      tiktokUrl: "",
      addressLine1: "",
      postalCode: "",
      locality: "",
      region: "",
      country: "",
      addressVerified: false,
      niNumber: "",
      personalUtrNumber: "",
      photoIdVerified: false,
      isMainContact: false,
    },
  });

  const handleSubmit = (data: InsertPersonData) => {
    // Convert UK mobile number to international format for primaryPhone
    if (data.primaryPhone) {
      // If it starts with 07, convert to +447
      if (data.primaryPhone.startsWith('07')) {
        data.primaryPhone = '+447' + data.primaryPhone.slice(2);
      }
      // If it starts with 447 or +447, ensure it has the + prefix
      else if (data.primaryPhone.startsWith('447')) {
        data.primaryPhone = '+' + data.primaryPhone;
      }
      else if (!data.primaryPhone.startsWith('+447')) {
        // For other formats, try to clean and convert
        const cleanPhone = data.primaryPhone.replace(/[^\d]/g, '');
        if (cleanPhone.startsWith('07') && cleanPhone.length === 11) {
          data.primaryPhone = '+447' + cleanPhone.slice(2);
        }
      }
    }
    onSave(data);
  };

  const handleAddressSelect = (addressData: any) => {
    // Map from AddressLookup format to form fields
    form.setValue("addressLine1", addressData.addressLine1 || "");
    form.setValue("postalCode", addressData.postalCode || "");
    form.setValue("locality", addressData.locality || "");
    form.setValue("region", addressData.region || "");
    form.setValue("country", addressData.country || "United Kingdom");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Person</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm flex items-center">
                  <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  Basic Information
                </h5>
                
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-fullName" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} data-testid="input-dateOfBirth" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="nationality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nationality</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-nationality" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="occupation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occupation</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-occupation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isMainContact"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={field.onChange}
                          data-testid="input-isMainContact"
                        />
                      </FormControl>
                      <FormLabel>Main Contact</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  Address Information
                </h5>
                
                <div>
                  <label className="text-sm font-medium">Address Lookup</label>
                  <AddressLookup 
                    onAddressSelect={handleAddressSelect}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Start typing to search for addresses
                  </p>
                </div>
                
                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-addressLine1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-postalCode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="locality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Locality</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-locality" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-region" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-country" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Verification & Other */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm flex items-center">
                  <ShieldCheck className="h-4 w-4 mr-2 text-muted-foreground" />
                  Verification & Other
                </h5>
                
                <FormField
                  control={form.control}
                  name="niNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NI Number</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-niNumber" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="personalUtrNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personal UTR</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-personalUtrNumber" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="photoIdVerified"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={field.onChange}
                          data-testid="input-photoIdVerified"
                        />
                      </FormControl>
                      <FormLabel>Photo ID Verified</FormLabel>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="addressVerified"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={field.onChange}
                          data-testid="input-addressVerified"
                        />
                      </FormControl>
                      <FormLabel>Address Verified</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information - New 1-column section */}
            <div className="space-y-4 border-t pt-6">
              <h5 className="font-medium text-sm flex items-center">
                <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                Contact Information
              </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primary Contact */}
                <div className="space-y-4">
                  <h6 className="text-sm font-medium">Primary Contact Details</h6>
                  
                  <FormField
                    control={form.control}
                    name="primaryEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value || ""} data-testid="input-primaryEmail" />
                        </FormControl>
                        <FormDescription>
                          Main email address for SMS/Email communications
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="primaryPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Mobile Phone</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={field.value || ""} 
                            placeholder="07123456789"
                            data-testid="input-primaryPhone" 
                          />
                        </FormControl>
                        <FormDescription>
                          UK mobile number for SMS (format: 07xxxxxxxxx)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value || ""} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="telephone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Phone</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-telephone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Secondary Contact */}
                <div className="space-y-4">
                  <h6 className="text-sm font-medium">Secondary Contact Details</h6>
                  
                  <FormField
                    control={form.control}
                    name="email2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value || ""} data-testid="input-email2" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="telephone2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Phone</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-telephone2" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Social Media */}
              <div className="space-y-4">
                <h6 className="text-sm font-medium">Social Media & Professional Profiles</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="linkedinUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://linkedin.com/in/..." data-testid="input-linkedinUrl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="twitterUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter/X URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://twitter.com/..." data-testid="input-twitterUrl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="facebookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facebook URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://facebook.com/..." data-testid="input-facebookUrl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="instagramUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://instagram.com/..." data-testid="input-instagramUrl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="tiktokUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TikTok URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://tiktok.com/@..." data-testid="input-tiktokUrl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                data-testid="button-cancel-add-person"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSaving}
                data-testid="button-save-add-person"
              >
                {isSaving ? "Adding..." : "Add Person"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Editable Service Details Component
function EditableServiceDetails({
  clientService,
  onUpdate
}: {
  clientService: EnhancedClientService;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [udfValues, setUdfValues] = useState<Record<string, any>>(() => {
    const values = (clientService.udfValues as Record<string, any>) || {};
    const formattedValues: Record<string, any> = {};
    
    // Format date values for HTML date inputs
    if (clientService.service?.udfDefinitions && Array.isArray(clientService.service.udfDefinitions)) {
      clientService.service.udfDefinitions.forEach((field: any) => {
        if (field.type === 'date' && values[field.id]) {
          const date = new Date(values[field.id]);
          formattedValues[field.id] = date.toISOString().split('T')[0];
        } else {
          formattedValues[field.id] = values[field.id];
        }
      });
    }
    
    return formattedValues;
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: { udfValues: Record<string, any> }) => {
      const processedUdfValues: Record<string, any> = {};
      
      // Convert date values from YYYY-MM-DD to ISO format for backend storage
      if (clientService.service?.udfDefinitions && Array.isArray(clientService.service.udfDefinitions)) {
        clientService.service.udfDefinitions.forEach((field: any) => {
          const value = data.udfValues[field.id];
          
          if (field.type === 'date' && value) {
            processedUdfValues[field.id] = new Date(value).toISOString();
          } else {
            processedUdfValues[field.id] = value;
          }
        });
      }

      return apiRequest("PUT", `/api/client-services/${clientService.id}`, {
        nextStartDate: clientService.nextStartDate,
        nextDueDate: clientService.nextDueDate,
        serviceOwnerId: clientService.serviceOwnerId,
        frequency: clientService.frequency,
        isActive: clientService.isActive,
        roleAssignments: clientService.roleAssignments?.map(ra => ({
          workRoleId: ra.workRole.id,
          userId: ra.user.id,
        })) || [],
        udfValues: processedUdfValues,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service details updated successfully",
      });
      setIsEditing(false);
      onUpdate();
      queryClient.invalidateQueries({ queryKey: [`/api/client-services/client/${clientService.clientId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update service details",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateServiceMutation.mutate({ udfValues });
  };

  const handleCancel = () => {
    // Reset to original values
    const values = (clientService.udfValues as Record<string, any>) || {};
    const formattedValues: Record<string, any> = {};
    
    if (clientService.service?.udfDefinitions && Array.isArray(clientService.service.udfDefinitions)) {
      clientService.service.udfDefinitions.forEach((field: any) => {
        if (field.type === 'date' && values[field.id]) {
          const date = new Date(values[field.id]);
          formattedValues[field.id] = date.toISOString().split('T')[0];
        } else {
          formattedValues[field.id] = values[field.id];
        }
      });
    }
    
    setUdfValues(formattedValues);
    setIsEditing(false);
  };

  if (!clientService.service?.udfDefinitions || !Array.isArray(clientService.service.udfDefinitions) || clientService.service.udfDefinitions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No service details defined for this service.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="font-medium text-sm flex items-center">
          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
          Service Details
        </h5>
        {!isEditing && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setIsEditing(true)}
            data-testid="button-edit-service-details"
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {clientService.service.udfDefinitions.map((field: any) => (
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              {field.name}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            
            {field.type === 'number' && (
              <Input
                type="number"
                value={udfValues[field.id] ?? ''}
                onChange={(e) => setUdfValues({ ...udfValues, [field.id]: e.target.value ? Number(e.target.value) : null })}
                placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}`}
                disabled={!isEditing}
                data-testid={`input-service-detail-${field.id}`}
              />
            )}
            
            {field.type === 'date' && (
              <Input
                type="date"
                value={udfValues[field.id] ?? ''}
                onChange={(e) => setUdfValues({ ...udfValues, [field.id]: e.target.value })}
                disabled={!isEditing}
                data-testid={`input-service-detail-${field.id}`}
              />
            )}
            
            {field.type === 'boolean' && (
              <div className="flex items-center space-x-2 h-10">
                <Switch
                  checked={udfValues[field.id] ?? false}
                  onCheckedChange={(checked) => setUdfValues({ ...udfValues, [field.id]: checked })}
                  disabled={!isEditing}
                  data-testid={`switch-service-detail-${field.id}`}
                />
                <span className="text-sm text-muted-foreground">
                  {udfValues[field.id] ? 'Yes' : 'No'}
                </span>
              </div>
            )}
            
            {field.type === 'short_text' && (
              <Input
                type="text"
                value={udfValues[field.id] ?? ''}
                onChange={(e) => setUdfValues({ ...udfValues, [field.id]: e.target.value })}
                placeholder={field.placeholder || `Enter ${field.name.toLowerCase()}`}
                disabled={!isEditing}
                data-testid={`input-service-detail-${field.id}`}
              />
            )}
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={updateServiceMutation.isPending}
            data-testid="button-cancel-service-details"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateServiceMutation.isPending}
            data-testid="button-save-service-details"
          >
            {updateServiceMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}

// Edit Service Modal Component
function EditServiceModal({ 
  service, 
  isOpen, 
  onClose 
}: { 
  service: EnhancedClientService; 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const { toast } = useToast();
  const form = useForm<EditServiceData>({
    resolver: zodResolver(editServiceSchema),
    defaultValues: {
      nextStartDate: service.nextStartDate ? new Date(service.nextStartDate).toISOString().split('T')[0] : '',
      nextDueDate: service.nextDueDate ? new Date(service.nextDueDate).toISOString().split('T')[0] : '',
      serviceOwnerId: service.serviceOwnerId || 'none',
      frequency: (service.frequency as "daily" | "weekly" | "monthly" | "quarterly" | "annually") || 'monthly',
      isActive: service.isActive ?? true, // Default to true if null or undefined
    },
  });

  const [roleAssignments, setRoleAssignments] = useState(
    service.roleAssignments?.map(ra => ({
      workRoleId: ra.workRole.id,
      userId: ra.user.id,
    })) || []
  );

  // Check if this is a Companies House service
  const isCompaniesHouseService = service.service.isCompaniesHouseConnected;

  // Detect if this is a people service by checking if it has a personId property
  const isPeopleService = 'personId' in service;

  // Use the mutation for updating service
  const updateServiceMutation = useMutation({
    mutationFn: async (data: EditServiceData & { serviceId: string; roleAssignments: Array<{workRoleId: string; userId: string}> }) => {
      // First update the service itself (dates, owner, frequency, etc.)
      const serviceUpdateData = {
        nextStartDate: data.nextStartDate && data.nextStartDate.trim() !== '' ? 
          (data.nextStartDate.includes('T') ? data.nextStartDate : data.nextStartDate + 'T00:00:00.000Z') : 
          undefined,
        nextDueDate: data.nextDueDate && data.nextDueDate.trim() !== '' ? 
          (data.nextDueDate.includes('T') ? data.nextDueDate : data.nextDueDate + 'T00:00:00.000Z') : 
          undefined,
        serviceOwnerId: data.serviceOwnerId === "none" ? null : data.serviceOwnerId,
        frequency: isCompaniesHouseService ? "annually" : data.frequency,
        isActive: data.isActive,
      };
      
      // Call the appropriate API endpoint based on service type
      if (isPeopleService) {
        await apiRequest("PUT", `/api/people-services/${data.serviceId}`, serviceUpdateData);
      } else {
        await apiRequest("PUT", `/api/client-services/${data.serviceId}`, serviceUpdateData);
      }
      
      // For now, we'll just update the service fields
      // Role assignment updates can be implemented later
      
      return { success: true };
    },
    onSuccess: () => {
      // Invalidate the appropriate cache based on service type
      if (isPeopleService) {
        queryClient.invalidateQueries({ queryKey: [`/api/people-services/client/${service.clientId}`] });
      } else {
        queryClient.invalidateQueries({ queryKey: [`/api/client-services/client/${service.clientId}`] });
      }
      
      // Also invalidate chronology to show service activation/deactivation events
      queryClient.invalidateQueries({ queryKey: ["/api/clients", service.clientId, "chronology"] });
      
      toast({
        title: "Success",
        description: "Service updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      console.error('Failed to update service:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update service",
        variant: "destructive",
      });
    },
  });

  // Query for work roles and users
  const { data: workRoles = [] } = useQuery<WorkRole[]>({
    queryKey: ['/api/work-roles'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const handleSubmit = (data: EditServiceData) => {
    updateServiceMutation.mutate({
      ...data,
      serviceId: service.id,
      roleAssignments,
    });
  };



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Service: {service.service.name}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Service Owner */}
            <FormField
              control={form.control}
              name="serviceOwnerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Owner</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-service-owner">
                        <SelectValue placeholder="Select service owner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No owner assigned</SelectItem>
                      {allUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Active/Inactive Toggle */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Service Status</FormLabel>
                    <FormDescription>
                      Inactive services will not generate new projects when the scheduler runs.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-service-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Frequency field - disabled for Companies House services */}
            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={isCompaniesHouseService ? "annually" : field.value}
                    disabled={isCompaniesHouseService}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                  {isCompaniesHouseService && (
                    <FormDescription className="text-blue-600 dark:text-blue-400">
                      Companies House services are automatically set to annual frequency.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date fields - only show for non-Companies House services */}
            {!isCompaniesHouseService && (
              <>
                <FormField
                  control={form.control}
                  name="nextStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-next-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextDueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-next-due-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Companies House notice */}
            {isCompaniesHouseService && (
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Companies House Service:</strong> Start and due dates are automatically managed based on client data and cannot be edited manually.
                </p>
              </div>
            )}

            {/* Role Assignments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel>Role Assignments</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Roles are defined in Admin. You can only change who fills each role here.
                </p>
              </div>

              {service.roleAssignments && service.roleAssignments.length > 0 ? (
                service.roleAssignments.map((assignment) => (
                  <div key={assignment.workRole.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{assignment.workRole.name}</div>
                      {assignment.workRole.description && (
                        <div className="text-xs text-muted-foreground">{assignment.workRole.description}</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Select
                        value={roleAssignments.find(ra => ra.workRoleId === assignment.workRole.id)?.userId || assignment.user.id}
                        onValueChange={(value) => {
                          const newAssignments = [...roleAssignments];
                          const existingIndex = newAssignments.findIndex(ra => ra.workRoleId === assignment.workRole.id);
                          if (existingIndex >= 0) {
                            newAssignments[existingIndex].userId = value;
                          } else {
                            newAssignments.push({ workRoleId: assignment.workRole.id, userId: value });
                          }
                          setRoleAssignments(newAssignments);
                        }}
                      >
                        <SelectTrigger data-testid={`select-user-${assignment.workRole.id}`}>
                          <SelectValue placeholder="Select assignee" />
                        </SelectTrigger>
                        <SelectContent>
                          {allUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No role assignments found for this service. Roles can be configured in the admin area.
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-edit">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateServiceMutation.isPending}
                data-testid="button-save-service"
              >
                {updateServiceMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// PersonCard component removed - using Accordion pattern

// Form schema for linking person to a new company
const linkPersonToCompanySchema = z.object({
  clientId: z.string().min(1, "Company is required"),
  officerRole: z.string().optional(),
  isPrimaryContact: z.boolean().optional()
});

type LinkPersonToCompanyData = z.infer<typeof linkPersonToCompanySchema>;

// Tabbed view component for person details
function PersonTabbedView({ 
  clientPerson, 
  editingPersonId, 
  setEditingPersonId, 
  updatePersonMutation, 
  revealedIdentifiers, 
  setRevealedIdentifiers, 
  peopleServices,
  clientId
}: {
  clientPerson: ClientPersonWithPerson;
  editingPersonId: string | null;
  setEditingPersonId: (id: string | null) => void;
  updatePersonMutation: any;
  revealedIdentifiers: Set<string>;
  setRevealedIdentifiers: (fn: (prev: Set<string>) => Set<string>) => void;
  peopleServices?: (PeopleService & { person: Person; service: Service; serviceOwner?: User })[];
  clientId: string;
}) {
  const [activeTab, setActiveTab] = useState("basic-info");
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Mobile swipe navigation for person tabs
  useEffect(() => {
    if (!isMobile) return;

    const tabs = ["basic-info", "contact-info", "personal-services", "related-companies"];
    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50;
      const currentIndex = tabs.indexOf(activeTab);
      
      if (touchStartX - touchEndX > swipeThreshold && currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1]);
      } else if (touchEndX - touchStartX > swipeThreshold && currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1]);
      }
    };

    const tabsContainer = document.querySelector(`[data-person-tabs="${clientPerson.person.id}"]`);
    if (tabsContainer) {
      tabsContainer.addEventListener('touchstart', handleTouchStart as any);
      tabsContainer.addEventListener('touchend', handleTouchEnd as any);

      return () => {
        tabsContainer.removeEventListener('touchstart', handleTouchStart as any);
        tabsContainer.removeEventListener('touchend', handleTouchEnd as any);
      };
    }
  }, [isMobile, activeTab, clientPerson.person.id]);

  // Scroll active person tab into view on mobile
  useEffect(() => {
    if (!isMobile) return;
    
    // Use specific selector for this person's tabs
    const personTabsContainer = document.querySelector(`[data-person-tabs="${clientPerson.person.id}"]`);
    if (personTabsContainer) {
      const activeTabButton = personTabsContainer.querySelector(`[data-testid="tab-${activeTab}"]`);
      if (activeTabButton) {
        activeTabButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab, isMobile, clientPerson.person.id]);

  // Shared form state for all tabs
  const editForm = useForm<UpdatePersonData>({
    resolver: zodResolver(updatePersonSchema),
    shouldUnregister: false, // Keep form values when fields unmount
    defaultValues: {
      fullName: clientPerson.person.fullName || "",
      title: clientPerson.person.title || "",
      dateOfBirth: clientPerson.person.dateOfBirth || "",
      nationality: clientPerson.person.nationality || undefined,
      occupation: clientPerson.person.occupation || "",
      telephone: clientPerson.person.telephone || "",
      email: clientPerson.person.email || "",
      addressLine1: clientPerson.person.addressLine1 || "",
      addressLine2: clientPerson.person.addressLine2 || "",
      locality: clientPerson.person.locality || "",
      region: clientPerson.person.region || "",
      postalCode: clientPerson.person.postalCode || "",
      country: clientPerson.person.country || "",
      isMainContact: Boolean(clientPerson.person.isMainContact),
      niNumber: clientPerson.person.niNumber || "",
      personalUtrNumber: clientPerson.person.personalUtrNumber || "",
      photoIdVerified: Boolean(clientPerson.person.photoIdVerified),
      addressVerified: Boolean(clientPerson.person.addressVerified),
      telephone2: clientPerson.person.telephone2 || "",
      email2: clientPerson.person.email2 || "",
      // Primary contact fields
      primaryPhone: clientPerson.person.primaryPhone || "",
      primaryEmail: clientPerson.person.primaryEmail || "",
      linkedinUrl: clientPerson.person.linkedinUrl || "",
      instagramUrl: clientPerson.person.instagramUrl || "",
      twitterUrl: clientPerson.person.twitterUrl || "",
      facebookUrl: clientPerson.person.facebookUrl || "",
      tiktokUrl: clientPerson.person.tiktokUrl || "",
    },
  });

  // Derive edit state from existing editingPersonId
  const isEditing = editingPersonId === clientPerson.person.id;

  const getCurrentFormValues = (): UpdatePersonData => ({
    fullName: clientPerson.person.fullName || "",
    title: clientPerson.person.title || "",
    dateOfBirth: clientPerson.person.dateOfBirth || "",
    nationality: clientPerson.person.nationality || undefined,
    occupation: clientPerson.person.occupation || "",
    telephone: clientPerson.person.telephone || "",
    email: clientPerson.person.email || "",
    addressLine1: clientPerson.person.addressLine1 || "",
    addressLine2: clientPerson.person.addressLine2 || "",
    locality: clientPerson.person.locality || "",
    region: clientPerson.person.region || "",
    postalCode: clientPerson.person.postalCode || "",
    country: clientPerson.person.country || "",
    isMainContact: Boolean(clientPerson.person.isMainContact),
    niNumber: clientPerson.person.niNumber || "",
    personalUtrNumber: clientPerson.person.personalUtrNumber || "",
    photoIdVerified: Boolean(clientPerson.person.photoIdVerified),
    addressVerified: Boolean(clientPerson.person.addressVerified),
    telephone2: clientPerson.person.telephone2 || "",
    email2: clientPerson.person.email2 || "",
    // Primary contact fields
    primaryPhone: clientPerson.person.primaryPhone || "",
    primaryEmail: clientPerson.person.primaryEmail || "",
    linkedinUrl: clientPerson.person.linkedinUrl || "",
    instagramUrl: clientPerson.person.instagramUrl || "",
    twitterUrl: clientPerson.person.twitterUrl || "",
    facebookUrl: clientPerson.person.facebookUrl || "",
    tiktokUrl: clientPerson.person.tiktokUrl || "",
  });

  const startEditing = () => {
    setEditingPersonId(clientPerson.person.id);
    // Reset form with latest server data
    editForm.reset(getCurrentFormValues());
  };

  const cancelEditing = () => {
    setEditingPersonId(null);
    // Reset to current server values
    editForm.reset(getCurrentFormValues());
  };

  const saveChanges = async (data: UpdatePersonData) => {
    updatePersonMutation.mutate({ 
      personId: clientPerson.person.id, 
      data 
    }, {
      onSuccess: () => {
        setEditingPersonId(null);
        // Invalidate relevant queries to refresh data
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/people`] });
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}`] });
      },
      onError: (error: any) => {
        // Handle validation errors by finding the first error and switching to its tab
        const formErrors = editForm.formState.errors;
        if (Object.keys(formErrors).length > 0) {
          const firstErrorField = Object.keys(formErrors)[0];
          
          // Determine which tab contains the error
          const basicInfoFields = ['fullName', 'title', 'dateOfBirth', 'nationality', 'occupation', 'isMainContact'];
          const contactInfoFields = ['addressLine1', 'addressLine2', 'locality', 'region', 'postalCode', 'country', 'email2', 'telephone2', 'linkedinUrl', 'twitterUrl', 'facebookUrl', 'instagramUrl', 'tiktokUrl'];
          
          if (basicInfoFields.includes(firstErrorField)) {
            setActiveTab('basic-info');
          } else if (contactInfoFields.includes(firstErrorField)) {
            setActiveTab('contact-info');
          }
          
          toast({
            title: "Validation Error",
            description: "Please check the form fields for errors.",
            variant: "destructive",
          });
        }
      }
    });
  };

  // Form for linking to new company
  const linkForm = useForm<LinkPersonToCompanyData>({
    resolver: zodResolver(linkPersonToCompanySchema),
    defaultValues: {
      officerRole: "",
      isPrimaryContact: false,
    },
  });

  // Fetch all companies this person is connected to
  const { data: personCompanies, isLoading: companiesLoading } = useQuery<ClientPersonWithClient[]>({
    queryKey: [`/api/people/${clientPerson.person.id}/companies`],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Fetch all clients for filtering
  const { data: allClients, isLoading: availableCompaniesLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isLinkModalOpen,
  });

  // Compute available companies based on current data
  const availableCompanies = useMemo(() => {
    if (!allClients || !personCompanies) return [];
    return allClients.filter(client => 
      client.clientType === 'company' && 
      client.id !== clientId && // Exclude current client
      !personCompanies.some(pc => pc.client.id === client.id)
    );
  }, [allClients, personCompanies, clientId]);

  // Link person to company mutation
  const linkToCompanyMutation = useMutation({
    mutationFn: async (data: LinkPersonToCompanyData) => {
      return await apiRequest("POST", `/api/people/${clientPerson.person.id}/companies`, data);
    },
    onSuccess: () => {
      toast({
        title: "Connection Added",
        description: "Person has been successfully connected to the company.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/people/${clientPerson.person.id}/companies`] });
      linkForm.reset();
      setIsLinkModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to connect person to company. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Unlink person from company mutation
  const unlinkFromCompanyMutation = useMutation({
    mutationFn: async (companyClientId: string) => {
      await apiRequest("DELETE", `/api/people/${clientPerson.person.id}/companies/${companyClientId}`);
    },
    onSuccess: () => {
      toast({
        title: "Connection Removed",
        description: "Person has been disconnected from the company.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/people/${clientPerson.person.id}/companies`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove connection. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLinkCompany = (data: LinkPersonToCompanyData) => {
    linkToCompanyMutation.mutate(data);
  };

  const handleUnlinkCompany = (companyClientId: string, companyName: string) => {
    if (confirm(`Are you sure you want to remove the connection between ${formatPersonName(clientPerson.person.fullName)} and ${companyName}?`)) {
      unlinkFromCompanyMutation.mutate(companyClientId);
    }
  };

  return (
    <div className="pt-4" data-person-tabs={clientPerson.person.id}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Desktop Tabs - Grid Layout */}
        <div className="hidden md:block w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic-info" data-testid="tab-basic-info">Basic Info</TabsTrigger>
            <TabsTrigger value="contact-info" data-testid="tab-contact-info">Contact Info</TabsTrigger>
            <TabsTrigger value="personal-services" data-testid="tab-personal-services">Personal Services</TabsTrigger>
            <TabsTrigger value="related-companies" data-testid="tab-related-companies">Related Companies</TabsTrigger>
          </TabsList>
        </div>

        {/* Mobile Tabs - Carousel with Peek Preview and Arrow Navigation */}
        <div className="md:hidden w-full relative">
          {/* Left Arrow */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
            onClick={() => {
              const tabs = ["basic-info", "contact-info", "personal-services", "related-companies"];
              const currentIndex = tabs.indexOf(activeTab);
              if (currentIndex > 0) {
                setActiveTab(tabs[currentIndex - 1]);
              }
            }}
            disabled={activeTab === "basic-info"}
            data-testid="person-tab-nav-left"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          {/* Right Arrow */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
            onClick={() => {
              const tabs = ["basic-info", "contact-info", "personal-services", "related-companies"];
              const currentIndex = tabs.indexOf(activeTab);
              if (currentIndex < tabs.length - 1) {
                setActiveTab(tabs[currentIndex + 1]);
              }
            }}
            disabled={activeTab === "related-companies"}
            data-testid="person-tab-nav-right"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          <div className="w-full overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-4 px-[10vw]" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <TabsList className="inline-flex gap-2 h-auto">
              <TabsTrigger 
                value="basic-info" 
                data-testid="tab-basic-info" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
              >
                Basic Info
              </TabsTrigger>
              <TabsTrigger 
                value="contact-info" 
                data-testid="tab-contact-info" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
              >
                Contact Info
              </TabsTrigger>
              <TabsTrigger 
                value="personal-services" 
                data-testid="tab-personal-services" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
              >
                Personal Services
              </TabsTrigger>
              <TabsTrigger 
                value="related-companies" 
                data-testid="tab-related-companies" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
              >
                Related Companies
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Basic Info Tab */}
        <TabsContent value="basic-info" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h5 className="font-medium text-sm flex items-center">
                <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                Basic Information
              </h5>
              {!isEditing ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  data-testid={`button-edit-basic-info-${clientPerson.id}`}
                  onClick={startEditing}
                >
                  Edit
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={cancelEditing}
                    disabled={updatePersonMutation.isPending}
                    data-testid={`button-cancel-basic-info-${clientPerson.id}`}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={editForm.handleSubmit(saveChanges)}
                    disabled={updatePersonMutation.isPending}
                    data-testid={`button-save-basic-info-${clientPerson.id}`}
                  >
                    {updatePersonMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>

            {isEditing ? (
              <Form {...editForm}>
                <div className="space-y-4">
                  {/* Basic Info Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid={`input-fullName-${clientPerson.id}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} data-testid={`input-title-${clientPerson.id}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} type="date" data-testid={`input-dateOfBirth-${clientPerson.id}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="nationality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nationality</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid={`select-nationality-${clientPerson.id}`}>
                                <SelectValue placeholder="Select nationality" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="british">British</SelectItem>
                              <SelectItem value="american">American</SelectItem>
                              <SelectItem value="canadian">Canadian</SelectItem>
                              <SelectItem value="australian">Australian</SelectItem>
                              <SelectItem value="german">German</SelectItem>
                              <SelectItem value="french">French</SelectItem>
                              <SelectItem value="spanish">Spanish</SelectItem>
                              <SelectItem value="italian">Italian</SelectItem>
                              <SelectItem value="dutch">Dutch</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="occupation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Occupation</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} data-testid={`input-occupation-${clientPerson.id}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="isMainContact"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Main Contact</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              This person is the primary contact
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                              data-testid={`switch-isMainContact-${clientPerson.id}`}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </Form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                    <p className="text-sm mt-1" data-testid={`view-fullName-${clientPerson.id}`}>
                      {formatPersonName(clientPerson.person.fullName) || 'Not provided'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Title</label>
                    <p className="text-sm mt-1" data-testid={`view-title-${clientPerson.id}`}>
                      {clientPerson.person.title || 'Not provided'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                    <p className="text-sm mt-1" data-testid={`view-dateOfBirth-${clientPerson.id}`}>
                      {formatBirthDate(clientPerson.person.dateOfBirth)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nationality</label>
                    <p className="text-sm mt-1" data-testid={`view-nationality-${clientPerson.id}`}>
                      {clientPerson.person.nationality ? clientPerson.person.nationality.charAt(0).toUpperCase() + clientPerson.person.nationality.slice(1) : 'Not provided'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Occupation</label>
                    <p className="text-sm mt-1" data-testid={`view-occupation-${clientPerson.id}`}>
                      {clientPerson.person.occupation || 'Not provided'}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Main Contact</label>
                    <p className="text-sm mt-1" data-testid={`view-isMainContact-${clientPerson.id}`}>
                      {clientPerson.person.isMainContact ? (
                        <Badge variant="default" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Primary Contact
                        </Badge>
                      ) : 'Not primary contact'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Contact Info Tab */}
        <TabsContent value="contact-info" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h5 className="font-medium text-sm flex items-center">
                <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                Contact Information
              </h5>
              {!isEditing ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  data-testid={`button-edit-contact-info-${clientPerson.id}`}
                  onClick={startEditing}
                >
                  Edit
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={cancelEditing}
                    disabled={updatePersonMutation.isPending}
                    data-testid={`button-cancel-contact-info-${clientPerson.id}`}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={editForm.handleSubmit(saveChanges)}
                    disabled={updatePersonMutation.isPending}
                    data-testid={`button-save-contact-info-${clientPerson.id}`}
                  >
                    {updatePersonMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>

            {isEditing ? (
              <Form {...editForm}>
                <div className="space-y-6">
                  {/* Address Fields */}
                  <div className="space-y-4">
                    <h6 className="font-medium text-sm flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                      Address Information
                    </h6>
                    
                    <div className="space-y-3">
                      <AddressLookup
                        onAddressSelect={(address) => {
                          editForm.setValue("addressLine1", address.addressLine1);
                          editForm.setValue("addressLine2", address.addressLine2 || "");
                          editForm.setValue("locality", address.locality);
                          editForm.setValue("region", address.region);
                          editForm.setValue("postalCode", address.postalCode);
                          editForm.setValue("country", address.country);
                        }}
                        value={
                          clientPerson.person.addressLine1 ? {
                            addressLine1: clientPerson.person.addressLine1,
                            addressLine2: clientPerson.person.addressLine2 || "",
                            locality: clientPerson.person.locality || "",
                            region: clientPerson.person.region || "",
                            postalCode: clientPerson.person.postalCode || "",
                            country: clientPerson.person.country || ""
                          } : undefined
                        }
                        data-testid={`input-address-lookup-${clientPerson.id}`}
                      />
                    </div>
                  </div>

                  {/* Primary Contact Fields */}
                  <div className="space-y-4">
                    <h6 className="font-medium text-sm">Primary Contact Details (for SMS & Email)</h6>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="primaryPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Mobile Phone</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="tel" 
                                placeholder="07123456789"
                                data-testid={`input-primaryPhone-${clientPerson.id}`}
                              />
                            </FormControl>
                            <div className="text-xs text-muted-foreground">
                              UK mobile format (07xxxxxxxxx)
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editForm.control}
                        name="primaryEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Email Address</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="email" 
                                placeholder="user@example.com"
                                data-testid={`input-primaryEmail-${clientPerson.id}`}
                              />
                            </FormControl>
                            <div className="text-xs text-muted-foreground">
                              Used for email communications
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Additional Contact Fields */}
                  <div className="space-y-4">
                    <h6 className="font-medium text-sm">Additional Contact Details</h6>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="email2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secondary Email</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="email" 
                                placeholder="secondary@example.com"
                                data-testid={`input-email2-${clientPerson.id}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editForm.control}
                        name="telephone2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secondary Phone</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                type="tel" 
                                placeholder="+44 1234 567890"
                                data-testid={`input-telephone2-${clientPerson.id}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Social Media Fields */}
                  <div className="space-y-4">
                    <h6 className="font-medium text-sm">Social Media & Professional Profiles</h6>
                    
                    <div className="space-y-3">
                      <FormField
                        control={editForm.control}
                        name="linkedinUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>LinkedIn Profile</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="https://linkedin.com/in/username"
                                data-testid={`input-linkedinUrl-${clientPerson.id}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="twitterUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Twitter/X Profile</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="https://x.com/username"
                                  data-testid={`input-twitterUrl-${clientPerson.id}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={editForm.control}
                          name="facebookUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Facebook Profile</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="https://facebook.com/username"
                                  data-testid={`input-facebookUrl-${clientPerson.id}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="instagramUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Instagram Profile</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="https://instagram.com/username"
                                  data-testid={`input-instagramUrl-${clientPerson.id}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={editForm.control}
                          name="tiktokUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>TikTok Profile</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="https://tiktok.com/@username"
                                  data-testid={`input-tiktokUrl-${clientPerson.id}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Form>
            ) : (
              <div className="space-y-4">
                {/* Primary Contact Details */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <h6 className="text-sm font-medium text-muted-foreground">Primary Contact Details</h6>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Email:</span> {clientPerson.person.primaryEmail || clientPerson.person.email || "Not provided"}
                    </div>
                    <div>
                      <span className="font-medium">Phone:</span> {clientPerson.person.primaryPhone || clientPerson.person.telephone || "Not provided"}
                    </div>
                  </div>
                </div>

                {/* Secondary Contact Details */}
                {(clientPerson.person.email2 || clientPerson.person.telephone2) && (
                  <div className="space-y-3">
                    <h6 className="text-sm font-medium">Additional Contact Details</h6>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Secondary Email</label>
                        <p className="text-sm mt-1">
                          {clientPerson.person.email2 || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Secondary Phone</label>
                        <p className="text-sm mt-1">
                          {clientPerson.person.telephone2 || 'Not provided'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Social Media Profiles */}
                <div className="space-y-3">
                  <h6 className="text-sm font-medium">Social Media & Professional Profiles</h6>
                  <div className="grid grid-cols-1 gap-3">
                    {clientPerson.person.linkedinUrl && (
                      <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                        <span className="text-sm text-muted-foreground">LinkedIn:</span>
                        <a href={clientPerson.person.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                          {clientPerson.person.linkedinUrl}
                        </a>
                      </div>
                    )}
                    {!clientPerson.person.linkedinUrl && !clientPerson.person.twitterUrl && 
                     !clientPerson.person.facebookUrl && !clientPerson.person.instagramUrl && 
                     !clientPerson.person.tiktokUrl && (
                      <p className="text-sm text-muted-foreground italic p-4 border rounded-lg bg-muted/30">
                        No social media profiles provided
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Personal Services Tab */}
        <TabsContent value="personal-services" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h5 className="font-medium text-sm flex items-center">
                <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
                Personal Services
              </h5>
              {isEditing && (
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={cancelEditing}
                    disabled={updatePersonMutation.isPending}
                    data-testid={`button-cancel-personal-services-${clientPerson.id}`}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={editForm.handleSubmit(saveChanges)}
                    disabled={updatePersonMutation.isPending}
                    data-testid={`button-save-personal-services-${clientPerson.id}`}
                  >
                    {updatePersonMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>

            {(() => {
              const personServices = peopleServices?.filter(ps => ps.personId === clientPerson.person.id) || [];
              
              if (personServices.length === 0) {
                return (
                  <div className="p-4 rounded-lg border border-dashed bg-muted/30 text-center">
                    <p className="text-sm text-muted-foreground italic">
                      No personal services assigned to this person
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {personServices.map((peopleService) => (
                    <div 
                      key={peopleService.id}
                      className="p-4 rounded-lg border bg-background"
                      data-testid={`personal-service-${peopleService.id}`}
                    >
                      <h5 className="font-medium text-sm mb-2">{peopleService.service.name}</h5>
                      {peopleService.service.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {peopleService.service.description}
                        </p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        {peopleService.serviceOwner && (
                          <div className="flex items-center space-x-1">
                            <UserIcon className="h-3 w-3" />
                            <span>Owner: {peopleService.serviceOwner.firstName} {peopleService.serviceOwner.lastName}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Assigned: {formatDate(peopleService.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </TabsContent>

        {/* Related Companies Tab */}
        <TabsContent value="related-companies" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h5 className="font-medium text-sm flex items-center">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                Related Companies
              </h5>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLinkModalOpen(true)}
                data-testid={`button-add-company-connection-${clientPerson.id}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </div>

            <div data-testid={`related-companies-${clientPerson.id}`}>
              {companiesLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : !personCompanies || personCompanies.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Company Connections</h3>
                  <p className="text-gray-500 mb-4">
                    This person is not connected to any companies yet.
                  </p>
                  <Button onClick={() => setIsLinkModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Connect to Company
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {personCompanies.map((connection) => (
                    <div key={connection.id} className="border rounded-lg p-4 bg-white" data-testid={`company-connection-${connection.client.id}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Building2 className="h-5 w-5 text-blue-600" />
                            <h4 className="font-medium text-gray-900">
                              <RouterLink
                                href={`/clients/${connection.client.id}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                data-testid={`link-company-${connection.client.id}`}
                              >
                                {connection.client.name}
                              </RouterLink>
                            </h4>
                            {connection.officerRole && (
                              <Badge variant="outline">{connection.officerRole}</Badge>
                            )}
                            {connection.isPrimaryContact && (
                              <Badge className="bg-green-100 text-green-800">Primary Contact</Badge>
                            )}
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            {connection.client.companyNumber && (
                              <p><span className="font-medium">Company Number:</span> {connection.client.companyNumber}</p>
                            )}
                            {connection.client.companyStatus && (
                              <p><span className="font-medium">Status:</span> {connection.client.companyStatus}</p>
                            )}
                            {connection.createdAt && (
                              <p><span className="font-medium">Connected:</span> {new Date(connection.createdAt).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnlinkCompany(connection.client.id, connection.client.name)}
                          disabled={unlinkFromCompanyMutation.isPending}
                          data-testid={`button-remove-connection-${connection.client.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Link to Company Modal */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect to Company</DialogTitle>
          </DialogHeader>
          
          <Form {...linkForm}>
            <form onSubmit={linkForm.handleSubmit(handleLinkCompany)} className="space-y-4">
              <FormField
                control={linkForm.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-company">
                          <SelectValue placeholder="Select a company" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCompaniesLoading ? (
                          <div className="p-2 text-sm text-gray-500">Loading companies...</div>
                        ) : availableCompanies && availableCompanies.length > 0 ? (
                          availableCompanies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-gray-500">No available companies</div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={linkForm.control}
                name="officerRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., Director, Secretary" 
                        data-testid="input-officer-role"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={linkForm.control}
                name="isPrimaryContact"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-primary-contact"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Primary Contact</FormLabel>
                      <p className="text-sm text-gray-600">
                        Mark this person as the primary contact for the company
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLinkModalOpen(false)}
                  data-testid="button-cancel-link"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={linkToCompanyMutation.isPending}
                  data-testid="button-confirm-link"
                >
                  {linkToCompanyMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link className="h-4 w-4 mr-2" />
                      Connect
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component for viewing person details (read-only mode) - shows all fields like edit form
function PersonViewMode({ 
  clientPerson, 
  revealedIdentifiers, 
  setRevealedIdentifiers, 
  onEdit,
  peopleServices 
}: {
  clientPerson: ClientPersonWithPerson;
  revealedIdentifiers: Set<string>;
  setRevealedIdentifiers: (fn: (prev: Set<string>) => Set<string>) => void;
  onEdit: () => void;
  peopleServices?: (PeopleService & { person: Person; service: Service; serviceOwner?: User })[];
}) {
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h5 className="font-medium text-sm flex items-center">
            <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
            Basic Information
          </h5>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Full Name</label>
              <p className="text-sm mt-1" data-testid={`view-fullName-${clientPerson.id}`}>
                {formatPersonName(clientPerson.person.fullName) || 'Not provided'}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <p className="text-sm mt-1" data-testid={`view-title-${clientPerson.id}`}>
                {clientPerson.person.title || 'Not provided'}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
              <p className="text-sm mt-1" data-testid={`view-dateOfBirth-${clientPerson.id}`}>
                {formatBirthDate(clientPerson.person.dateOfBirth)}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nationality</label>
              <p className="text-sm mt-1" data-testid={`view-nationality-${clientPerson.id}`}>
                {clientPerson.person.nationality ? clientPerson.person.nationality.charAt(0).toUpperCase() + clientPerson.person.nationality.slice(1) : 'Not provided'}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Occupation</label>
              <p className="text-sm mt-1" data-testid={`view-occupation-${clientPerson.id}`}>
                {clientPerson.person.occupation || 'Not provided'}
              </p>
            </div>
            
          </div>
        </div>

        {/* Address Information */}
        <div className="space-y-4">
          <h5 className="font-medium text-sm flex items-center">
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
            Address Information
          </h5>
          
          {(() => {
            const person = clientPerson.person;
            const hasAddress = !!(person.addressLine1 || person.addressLine2 || person.locality || person.region || person.postalCode || person.country);
            
            if (!hasAddress) {
              return (
                <p className="text-sm text-muted-foreground italic p-4 border rounded-lg bg-muted/30">
                  No address information available
                </p>
              );
            }

            // Create address lines while removing duplicates
            const addressParts = [];
            const usedValues = new Set();
            
            // Add address lines if they exist and aren't duplicates
            [person.addressLine1, person.addressLine2].forEach(line => {
              if (line && line.trim() && !usedValues.has(line.trim().toLowerCase())) {
                addressParts.push(line.trim());
                usedValues.add(line.trim().toLowerCase());
              }
            });
            
            // Add locality, region, postal code (avoiding duplicates)
            const locationParts = [person.locality, person.region, person.postalCode]
              .filter(part => part && part.trim() && !usedValues.has(part.trim().toLowerCase()))
              .map(part => part!.trim());
            
            if (locationParts.length > 0) {
              addressParts.push(locationParts.join(", "));
            }
            
            // Add country if not already included
            if (person.country && person.country.trim() && !usedValues.has(person.country.trim().toLowerCase())) {
              addressParts.push(person.country.trim());
            }

            return (
              <div className="p-4 rounded-lg bg-background border">
                <div className="space-y-1 text-sm" data-testid={`text-person-address-${clientPerson.id}`}>
                  {addressParts.map((part, index) => (
                    <div key={index} className={index === 0 ? "font-medium" : ""}>
                      {part}
                    </div>
                  ))}
                </div>
                {person.addressVerified && (
                  <div className="flex items-center space-x-2 mt-3 pt-3 border-t">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">Address Verified</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Verification & Sensitive Information */}
        <div className="space-y-4">
          <h5 className="font-medium text-sm flex items-center">
            <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
            Verification & Details
          </h5>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Main Contact</span>
                </div>
                <div className="flex items-center space-x-2">
                  {clientPerson.person.isMainContact ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Yes</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">No</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Photo ID Verified</span>
                </div>
                <div className="flex items-center space-x-2">
                  {clientPerson.person.photoIdVerified ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Verified</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not verified</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Address Verified</span>
                </div>
                <div className="flex items-center space-x-2">
                  {clientPerson.person.addressVerified ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Verified</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not verified</span>
                  )}
                </div>
              </div>
            </div>
            
            {(clientPerson.person.niNumber || clientPerson.person.personalUtrNumber) && (
              <div className="p-4 rounded-lg border border-dashed bg-muted/30">
                <h6 className="text-sm font-medium mb-3">Sensitive Information</h6>
                <div className="space-y-3">
                  {clientPerson.person.niNumber && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-muted-foreground">NI Number</label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          data-testid={`button-reveal-ni-${clientPerson.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const key = `ni-${clientPerson.person.id}`;
                            setRevealedIdentifiers(prev => {
                              const next = new Set(prev);
                              if (next.has(key)) {
                                next.delete(key);
                              } else {
                                next.add(key);
                              }
                              return next;
                            });
                          }}
                        >
                          {revealedIdentifiers.has(`ni-${clientPerson.person.id}`) ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      <p className="font-mono text-sm mt-1" data-testid={`text-ni-number-${clientPerson.id}`}>
                        {revealedIdentifiers.has(`ni-${clientPerson.person.id}`) 
                          ? clientPerson.person.niNumber 
                          : maskIdentifier(clientPerson.person.niNumber, 2)}
                      </p>
                    </div>
                  )}
                  {clientPerson.person.personalUtrNumber && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-muted-foreground">Personal UTR</label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          data-testid={`button-reveal-utr-${clientPerson.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const key = `utr-${clientPerson.person.id}`;
                            setRevealedIdentifiers(prev => {
                              const next = new Set(prev);
                              if (next.has(key)) {
                                next.delete(key);
                              } else {
                                next.add(key);
                              }
                              return next;
                            });
                          }}
                        >
                          {revealedIdentifiers.has(`utr-${clientPerson.person.id}`) ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      <p className="font-mono text-sm mt-1" data-testid={`text-utr-number-${clientPerson.id}`}>
                        {revealedIdentifiers.has(`utr-${clientPerson.person.id}`) 
                          ? clientPerson.person.personalUtrNumber 
                          : maskIdentifier(clientPerson.person.personalUtrNumber, 2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Extended Contact Information - New 1-column section */}
      <div className="space-y-4 border-t pt-6">
        <h4 className="font-bold text-base flex items-center border-b pb-2 mb-4">
          <Phone className="h-5 w-5 mr-2 text-primary" />
          Contact Information
        </h4>
        
        <div className="grid grid-cols-1 gap-4">
          {/* Primary contact info */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h6 className="text-sm font-medium text-muted-foreground">Primary Contact Details</h6>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Email:</span> {clientPerson.person.primaryEmail || clientPerson.person.email || "Not provided"}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {clientPerson.person.primaryPhone || clientPerson.person.telephone || "Not provided"}
              </div>
            </div>
          </div>

          {/* Secondary contact info */}
          {(clientPerson.person.email2 || clientPerson.person.telephone2) && (
            <div className="space-y-3">
              <h6 className="text-sm font-medium">Additional Contact Details</h6>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Secondary Email</label>
                  <p className="text-sm mt-1" data-testid={`view-email2-${clientPerson.id}`}>
                    {clientPerson.person.email2 || 'Not provided'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Secondary Phone</label>
                  <p className="text-sm mt-1" data-testid={`view-telephone2-${clientPerson.id}`}>
                    {clientPerson.person.telephone2 || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Social media profiles */}
          <div className="space-y-3">
            <h6 className="text-sm font-medium">Social Media & Professional Profiles</h6>
            {(clientPerson.person.linkedinUrl || 
              clientPerson.person.twitterUrl || 
              clientPerson.person.facebookUrl || 
              clientPerson.person.instagramUrl || 
              clientPerson.person.tiktokUrl) ? (
              <div className="grid grid-cols-1 gap-3">
                {clientPerson.person.linkedinUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-blue-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">LinkedIn</label>
                      <a 
                        href={clientPerson.person.linkedinUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block"
                        data-testid={`view-linkedinUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.linkedinUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.twitterUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-black dark:text-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">Twitter/X</label>
                      <a 
                        href={clientPerson.person.twitterUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-black dark:text-white hover:underline block"
                        data-testid={`view-twitterUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.twitterUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.facebookUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-blue-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">Facebook</label>
                      <a 
                        href={clientPerson.person.facebookUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block"
                        data-testid={`view-facebookUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.facebookUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.instagramUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-pink-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.618 5.367 11.986 11.988 11.986C18.636 23.973 24 18.605 24 11.987 24 5.367 18.636.001 12.017.001zm5.568 16.855c-.778.778-1.697 1.139-2.773 1.139H9.188c-1.076 0-1.995-.361-2.773-1.139S5.276 15.158 5.276 14.082V9.917c0-1.076.361-1.995 1.139-2.773s1.697-1.139 2.773-1.139h5.624c1.076 0 1.995.361 2.773 1.139s1.139 1.697 1.139 2.773v4.165c0 1.076-.361 1.995-1.139 2.773zm-8.195-7.638a3.82 3.82 0 013.821-3.821c2.108 0 3.821 1.713 3.821 3.821s-1.713 3.821-3.821 3.821a3.82 3.82 0 01-3.821-3.821zm6.148-1.528a.905.905 0 11-1.81 0 .905.905 0 011.81 0z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">Instagram</label>
                      <a 
                        href={clientPerson.person.instagramUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-pink-600 hover:underline block"
                        data-testid={`view-instagramUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.instagramUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.tiktokUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-black dark:text-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">TikTok</label>
                      <a 
                        href={clientPerson.person.tiktokUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-black dark:text-white hover:underline block"
                        data-testid={`view-tiktokUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.tiktokUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic p-4 border rounded-lg bg-muted/30" data-testid={`text-no-social-links-${clientPerson.id}`}>
                No social media profiles provided
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Personal Services section */}
      {peopleServices && (
        <div className="space-y-4 border-t pt-6">
          <h4 className="font-bold text-base flex items-center border-b pb-2 mb-4">
            <Settings className="h-5 w-5 mr-2 text-primary" />
            Personal Services
          </h4>

          {(() => {
            const personServices = peopleServices.filter(ps => ps.personId === clientPerson.person.id);
            
            if (personServices.length === 0) {
              return (
                <div className="p-4 rounded-lg border border-dashed bg-muted/30 text-center">
                  <p className="text-sm text-muted-foreground italic">
                    No personal services assigned to this person
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {personServices.map((peopleService) => (
                  <div 
                    key={peopleService.id}
                    className="p-4 rounded-lg border bg-background"
                    data-testid={`personal-service-${peopleService.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-sm mb-2">{peopleService.service.name}</h5>
                        {peopleService.service.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {peopleService.service.description}
                          </p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          {peopleService.serviceOwner && (
                            <div className="flex items-center space-x-1">
                              <UserIcon className="h-3 w-3" />
                              <span>Owner: {peopleService.serviceOwner.firstName} {peopleService.serviceOwner.lastName}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>Assigned: {formatDate(peopleService.createdAt)}</span>
                          </div>
                        </div>
                        
                        {peopleService.notes && (
                          <div className="mt-2 p-2 rounded bg-muted/50">
                            <p className="text-xs text-muted-foreground">
                              <strong>Notes:</strong> {peopleService.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t">
        <Button 
          variant="outline" 
          size="sm"
          data-testid={`button-edit-person-${clientPerson.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          Edit Details
        </Button>
      </div>
    </div>
  );
}

// Component for editing person details
function PersonEditForm({ 
  clientPerson, 
  onSave, 
  onCancel, 
  isSaving 
}: {
  clientPerson: ClientPersonWithPerson;
  onSave: (data: UpdatePersonData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const form = useForm<UpdatePersonData>({
    resolver: zodResolver(updatePersonSchema),
    defaultValues: {
      fullName: clientPerson.person.fullName || "",
      title: clientPerson.person.title || "",
      dateOfBirth: clientPerson.person.dateOfBirth || "",
      nationality: clientPerson.person.nationality || "",
      occupation: clientPerson.person.occupation || "",
      telephone: clientPerson.person.telephone || "",
      email: clientPerson.person.email || "",
      addressLine1: clientPerson.person.addressLine1 || "",
      addressLine2: clientPerson.person.addressLine2 || "",
      locality: clientPerson.person.locality || "",
      region: clientPerson.person.region || "",
      postalCode: clientPerson.person.postalCode || "",
      country: clientPerson.person.country || "",
      isMainContact: Boolean(clientPerson.person.isMainContact),
      niNumber: clientPerson.person.niNumber || "",
      personalUtrNumber: clientPerson.person.personalUtrNumber || "",
      photoIdVerified: Boolean(clientPerson.person.photoIdVerified),
      addressVerified: Boolean(clientPerson.person.addressVerified),
      // Extended contact information
      telephone2: clientPerson.person.telephone2 || "",
      email2: clientPerson.person.email2 || "",
      // Primary communication fields
      primaryPhone: clientPerson.person.primaryPhone || "",
      primaryEmail: clientPerson.person.primaryEmail || "",
      // Social media URLs
      linkedinUrl: clientPerson.person.linkedinUrl || "",
      instagramUrl: clientPerson.person.instagramUrl || "",
      twitterUrl: clientPerson.person.twitterUrl || "",
      facebookUrl: clientPerson.person.facebookUrl || "",
      tiktokUrl: clientPerson.person.tiktokUrl || "",
    },
  });

  const handleSubmit = (data: UpdatePersonData) => {
    // Convert UK mobile format to international format for primaryPhone
    if (data.primaryPhone && data.primaryPhone.trim()) {
      let cleanPhone = data.primaryPhone.replace(/[^\d]/g, '');
      
      if (cleanPhone.startsWith('07') && cleanPhone.length === 11) {
        data.primaryPhone = `+447${cleanPhone.slice(2)}`;
      } else if (cleanPhone.startsWith('447') && cleanPhone.length === 12) {
        data.primaryPhone = `+${cleanPhone}`;
      }
      // Keep other formats as-is for international compatibility
    }
    
    onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h5 className="font-medium text-sm flex items-center">
              <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
              Basic Information
            </h5>
            
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid={`input-fullName-${clientPerson.id}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid={`input-title-${clientPerson.id}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} type="date" data-testid={`input-dateOfBirth-${clientPerson.id}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="nationality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nationality</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid={`select-nationality-${clientPerson.id}`}>
                        <SelectValue placeholder="Select nationality" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="british">British</SelectItem>
                      <SelectItem value="american">American</SelectItem>
                      <SelectItem value="canadian">Canadian</SelectItem>
                      <SelectItem value="australian">Australian</SelectItem>
                      <SelectItem value="german">German</SelectItem>
                      <SelectItem value="french">French</SelectItem>
                      <SelectItem value="spanish">Spanish</SelectItem>
                      <SelectItem value="italian">Italian</SelectItem>
                      <SelectItem value="dutch">Dutch</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="occupation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupation</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid={`input-occupation-${clientPerson.id}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <h5 className="font-medium text-sm flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
              Address Information
            </h5>
            
            <div className="space-y-3">
              <AddressLookup
                onAddressSelect={(address) => {
                  form.setValue("addressLine1", address.addressLine1);
                  form.setValue("addressLine2", address.addressLine2 || "");
                  form.setValue("locality", address.locality);
                  form.setValue("region", address.region);
                  form.setValue("postalCode", address.postalCode);
                  form.setValue("country", address.country);
                }}
                value={
                  clientPerson.person.addressLine1 ? {
                    addressLine1: clientPerson.person.addressLine1,
                    addressLine2: clientPerson.person.addressLine2 || "",
                    locality: clientPerson.person.locality || "",
                    region: clientPerson.person.region || "",
                    postalCode: clientPerson.person.postalCode || "",
                    country: clientPerson.person.country || ""
                  } : undefined
                }
                data-testid={`input-address-lookup-${clientPerson.id}`}
              />
              
            </div>
          </div>

          {/* Verification & Sensitive Information */}
          <div className="space-y-4">
            <h5 className="font-medium text-sm flex items-center">
              <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
              Verification & Details
            </h5>
            
            <FormField
              control={form.control}
              name="isMainContact"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Main Contact</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      This person is the primary contact
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      data-testid={`switch-isMainContact-${clientPerson.id}`}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="photoIdVerified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      data-testid={`checkbox-photoIdVerified-${clientPerson.id}`}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Photo ID Verified</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Official photo identification has been verified
                    </div>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="addressVerified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      data-testid={`checkbox-addressVerified-${clientPerson.id}`}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Address Verified</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Address has been verified through official documents
                    </div>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="niNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NI Number</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="AB123456C"
                      data-testid={`input-niNumber-${clientPerson.id}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="personalUtrNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal UTR</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="1234567890"
                      data-testid={`input-personalUtrNumber-${clientPerson.id}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Extended Contact Information - New 1-column section */}
        <div className="space-y-4 border-t pt-6">
          <h5 className="font-medium text-sm flex items-center">
            <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
            Contact Information
          </h5>
          
          <div className="grid grid-cols-1 gap-4">
            {/* Primary contact info - editable fields */}
            <div className="space-y-4">
              <h6 className="text-sm font-medium">Primary Contact Details (for SMS & Email)</h6>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primaryPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Mobile Phone</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="tel" 
                          placeholder="07123456789"
                          data-testid={`input-primaryPhone-${clientPerson.id}`}
                        />
                      </FormControl>
                      <div className="text-xs text-muted-foreground">
                        UK mobile format (07xxxxxxxxx)
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="primaryEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="email" 
                          placeholder="user@example.com"
                          data-testid={`input-primaryEmail-${clientPerson.id}`}
                        />
                      </FormControl>
                      <div className="text-xs text-muted-foreground">
                        Used for email communications
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Legacy contact info - read only display for reference */}
            {(clientPerson.person.email || clientPerson.person.telephone) && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <h6 className="text-sm font-medium text-muted-foreground">Legacy Contact Details</h6>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {clientPerson.person.email && (
                    <div>
                      <span className="font-medium">Legacy Email:</span> {clientPerson.person.email}
                    </div>
                  )}
                  {clientPerson.person.telephone && (
                    <div>
                      <span className="font-medium">Legacy Phone:</span> {clientPerson.person.telephone}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  These are legacy fields. Use the Primary fields above for current contact information.
                </p>
              </div>
            )}

            {/* Secondary contact fields */}
            <div className="space-y-4">
              <h6 className="text-sm font-medium">Additional Contact Details</h6>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Email</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="email" 
                          placeholder="secondary@example.com"
                          data-testid={`input-email2-${clientPerson.id}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="telephone2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Phone</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="tel" 
                          placeholder="+44 1234 567890"
                          data-testid={`input-telephone2-${clientPerson.id}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Social media fields */}
            <div className="space-y-4">
              <h6 className="text-sm font-medium">Social Media & Professional Profiles</h6>
              
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn Profile</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="https://linkedin.com/in/username"
                          data-testid={`input-linkedinUrl-${clientPerson.id}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="twitterUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter/X Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://x.com/username"
                            data-testid={`input-twitterUrl-${clientPerson.id}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="facebookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facebook Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://facebook.com/username"
                            data-testid={`input-facebookUrl-${clientPerson.id}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="instagramUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://instagram.com/username"
                            data-testid={`input-instagramUrl-${clientPerson.id}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="tiktokUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TikTok Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://tiktok.com/@username"
                            data-testid={`input-tiktokUrl-${clientPerson.id}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSaving}
            data-testid={`button-cancel-person-${clientPerson.id}`}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSaving}
            data-testid={`button-save-person-${clientPerson.id}`}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Company Creation Form Component
function CompanyCreationForm({ onSubmit, onCancel, isSubmitting }: {
  onSubmit: (data: { companyName: string; companyNumber?: string; officerRole?: string; isPrimaryContact?: boolean; }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(z.object({
      companyName: z.string().min(1, "Company name is required"),
      companyNumber: z.string().optional(),
      officerRole: z.string().optional(),
      isPrimaryContact: z.boolean().optional().default(false)
    })),
    defaultValues: {
      companyName: "",
      companyNumber: "",
      officerRole: "",
      isPrimaryContact: false
    }
  });

  const handleSubmit = (data: any) => {
    onSubmit({
      companyName: data.companyName,
      companyNumber: data.companyNumber || undefined,
      officerRole: data.officerRole || undefined,
      isPrimaryContact: data.isPrimaryContact || false
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter company name" {...field} data-testid="input-company-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="companyNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter company number (optional)" {...field} data-testid="input-company-number" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="officerRole"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Role</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Director, Secretary (optional)" {...field} data-testid="input-officer-role" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="isPrimaryContact"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Primary Contact</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Mark this person as the main contact for the company
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-primary-contact"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="button-cancel-company-creation"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-submit-company-creation"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 mr-2" />
                Create Company
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Component to display service-specific projects
function ServiceProjectsList({ serviceId }: { serviceId: string }) {
  const [, setLocation] = useLocation();
  const { id } = useParams();

  const { data: projects, isLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: [`/api/clients/${id}/projects?serviceId=${serviceId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!serviceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return <ProjectsList projects={projects} isLoading={isLoading} clientId={id} />;
}

// Component to display a list of projects with hyperlinks
function ProjectsList({ projects, isLoading, clientId }: { projects?: ProjectWithRelations[]; isLoading: boolean; clientId?: string }) {
  const [, setLocation] = useLocation();

  const getStatusColor = (status: string) => {
    const colors = {
      no_latest_action: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      bookkeeping_work_required: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      in_review: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      needs_client_input: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const navigateToProject = (projectId: string) => {
    // Include client ID as query parameter when navigating from client detail page
    const url = clientId ? `/projects/${projectId}?from=client&clientId=${clientId}` : `/projects/${projectId}`;
    setLocation(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-8">
        <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground mb-2">No projects found</p>
        <p className="text-sm text-muted-foreground">
          Projects will appear here when they are created for this client.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <div key={project.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm" data-testid={`text-project-title-${project.id}`}>
                {project.description}
              </h4>
              <Badge className={`text-xs ${getStatusColor(project.currentStatus)}`} data-testid={`badge-status-${project.id}`}>
                {formatStatus(project.currentStatus)}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {project.dueDate && (
                <span>Due: {new Date(project.dueDate).toLocaleDateString()}</span>
              )}
              {project.projectMonth && (
                <span className="ml-3">Month: {project.projectMonth}</span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToProject(project.id)}
            data-testid={`button-view-project-${project.id}`}
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
        </div>
      ))}
    </div>
  );
}

// Related Person Row Component for condensed table view
function RelatedPersonRow({
  clientPerson,
  clientId,
  clientName,
}: {
  clientPerson: ClientPersonWithPerson;
  clientId: string;
  clientName: string;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  
  // Fetch portal user status
  const { data: portalUser, refetch } = useQuery<ClientPortalUser>({
    queryKey: [`/api/portal-user/by-person/${clientPerson.person.id}`],
    enabled: false,
  });

  const personEmail = clientPerson.person.primaryEmail || clientPerson.person.email;
  const hasEmail = Boolean(personEmail);

  // Send invitation mutation
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

  // Fetch and generate QR code when needed
  const handleShowQRCode = async () => {
    try {
      const response = await fetch(`/api/portal-user/qr-code/${clientPerson.person.id}`);
      if (!response.ok) throw new Error('Failed to generate QR code');
      
      const data = await response.json();
      setQrCodeDataUrl(data.qrCode);
      setShowQRCode(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive",
      });
    }
  };

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
                  onClick={handleShowQRCode}
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

// Client Service Row Component for condensed table view
function ClientServiceRow({
  clientService,
}: {
  clientService: EnhancedClientService;
}) {
  const [, setLocation] = useLocation();

  return (
    <TableRow data-testid={`service-row-${clientService.id}`}>
      <TableCell className="font-medium">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span data-testid={`text-service-name-${clientService.id}`}>
              {clientService.service?.name || 'Service'}
            </span>
            {clientService.service?.isStaticService && (
              <Badge variant="secondary" className="bg-gray-500 text-white text-xs" data-testid={`badge-static-${clientService.id}`}>
                Static
              </Badge>
            )}
            {clientService.service?.isPersonalService && (
              <Badge variant="secondary" className="bg-purple-500 text-white text-xs" data-testid={`badge-personal-${clientService.id}`}>
                Personal
              </Badge>
            )}
            {clientService.service?.isCompaniesHouseConnected && (
              <Badge variant="secondary" className="bg-blue-500 text-white text-xs" data-testid={`badge-ch-${clientService.id}`}>
                CH
              </Badge>
            )}
          </div>
          {clientService.service?.description && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {clientService.service.description}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm" data-testid={`text-frequency-${clientService.id}`}>
          {clientService.frequency || '-'}
        </span>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {clientService.nextStartDate ? (
            <div data-testid={`text-next-start-${clientService.id}`}>
              {formatDate(clientService.nextStartDate)}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {clientService.nextDueDate ? (
            <div data-testid={`text-next-due-${clientService.id}`}>
              {formatDate(clientService.nextDueDate)}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {clientService.serviceOwner ? (
            <div data-testid={`text-service-owner-${clientService.id}`}>
              {clientService.serviceOwner.firstName} {clientService.serviceOwner.lastName}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="default"
          size="sm"
          onClick={() => setLocation(`/client-service/${clientService.id}`)}
          data-testid={`button-view-service-${clientService.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { trackClientView } = useActivityTracker();
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [expandedClientServiceId, setExpandedClientServiceId] = useState<string | null>(null);
  const [expandedPersonalServiceId, setExpandedPersonalServiceId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingPersonalServiceId, setEditingPersonalServiceId] = useState<string | null>(null);
  const [revealedIdentifiers, setRevealedIdentifiers] = useState<Set<string>>(new Set());
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [isNewRequestDialogOpen, setIsNewRequestDialogOpen] = useState(false);
  const [requestType, setRequestType] = useState<'template' | 'custom' | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  
  // Custom request form schema with validation
  const customRequestFormSchema = insertClientCustomRequestSchema.extend({
    name: z.string().min(1, "Request name is required"),
    description: z.string().optional(),
  }).omit({ clientId: true });
  
  // Custom request form
  const customRequestForm = useForm<z.infer<typeof customRequestFormSchema>>({
    resolver: zodResolver(customRequestFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  
  // Track client view activity when component mounts
  useEffect(() => {
    if (id) {
      trackClientView(id);
    }
  }, [id, trackClientView]);
  
  // DEBUG: Tab jumping investigation
  const [activeTab, setActiveTab] = useState<string>("overview");
  const debugMetricsRef = useRef<any[]>([]);

  // Mobile swipe navigation for tabs
  useEffect(() => {
    if (!isMobile) return;

    const tabs = ["overview", "services", "projects", "communications", "chronology", "documents", "tasks"];
    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50; // Minimum distance for swipe
      const currentIndex = tabs.indexOf(activeTab);
      
      if (touchStartX - touchEndX > swipeThreshold && currentIndex < tabs.length - 1) {
        // Swipe left - go to next tab
        setActiveTab(tabs[currentIndex + 1]);
      } else if (touchEndX - touchStartX > swipeThreshold && currentIndex > 0) {
        // Swipe right - go to previous tab
        setActiveTab(tabs[currentIndex - 1]);
      }
    };

    const tabsContainer = document.querySelector('[data-tab-content="true"]');
    if (tabsContainer) {
      tabsContainer.addEventListener('touchstart', handleTouchStart as any);
      tabsContainer.addEventListener('touchend', handleTouchEnd as any);

      return () => {
        tabsContainer.removeEventListener('touchstart', handleTouchStart as any);
        tabsContainer.removeEventListener('touchend', handleTouchEnd as any);
      };
    }
  }, [isMobile, activeTab]);

  // Scroll active client tab into view on mobile when activeTab changes
  useEffect(() => {
    if (!isMobile) return;
    
    // Use more specific selector for client tabs only
    const clientTabsContainer = document.querySelector('[data-client-tabs="main"]');
    if (clientTabsContainer) {
      const activeTabButton = clientTabsContainer.querySelector(`[data-testid="tab-${activeTab}"]`);
      if (activeTabButton) {
        activeTabButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab, isMobile]);

  // DEBUG: Comprehensive tab interaction logging
  useLayoutEffect(() => {
    const logMetrics = (eventType: string, tabValue?: string) => {
      const timestamp = Date.now();
      const metrics = {
        timestamp,
        eventType,
        tabValue,
        scrollY: window.scrollY,
        activeElement: document.activeElement?.tagName + (document.activeElement?.className ? `.${document.activeElement.className}` : ''),
        hash: location.hash,
        tabsList: document.querySelector('[role="tablist"]')?.getBoundingClientRect(),
        activeTabPanel: document.querySelector('[role="tabpanel"][data-state="active"]')?.getBoundingClientRect(),
        windowSize: { width: window.innerWidth, height: window.innerHeight },
        documentSize: { clientHeight: document.documentElement.clientHeight },
        bodyRect: document.body.getBoundingClientRect(),
      };
      
      console.log(`🔍 TAB DEBUG [${eventType}]:`, JSON.stringify(metrics, null, 2));
      debugMetricsRef.current.push(metrics);
      // Keep only last 20 entries to prevent memory issues
      if (debugMetricsRef.current.length > 20) {
        debugMetricsRef.current = debugMetricsRef.current.slice(-20);
      }
    };

    // Log on tab value change
    if (activeTab) {
      logMetrics('TAB_VALUE_CHANGE', activeTab);
      
      // Log again after DOM update
      requestAnimationFrame(() => {
        logMetrics('TAB_VALUE_CHANGE_AFTER_RAF', activeTab);
        setTimeout(() => logMetrics('TAB_VALUE_CHANGE_AFTER_TIMEOUT', activeTab), 0);
      });
    }
  }, [activeTab]);

  // DEBUG: Layout shift observer and global event listeners
  useEffect(() => {
    // Add PerformanceObserver for layout shifts
    let layoutShiftObserver: PerformanceObserver | null = null;
    if ('PerformanceObserver' in window) {
      layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift') {
            console.log(`⚡ LAYOUT SHIFT: value=${(entry as any).value}, hadRecentInput=${(entry as any).hadRecentInput}, activeTab=${activeTab}, scrollY=${window.scrollY}`);
          }
        }
      });
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
    }
    let scrollTimer: NodeJS.Timeout;
    const throttledScrollLog = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        console.log(`📜 SCROLL EVENT: scrollY=${window.scrollY}, activeTab=${activeTab}`);
      }, 50);
    };

    const focusHandler = (e: FocusEvent) => {
      const target = e.target as Element;
      console.log(`🎯 FOCUS EVENT: target=${target?.tagName}.${target?.className || ''}, relatedTarget=${(e.relatedTarget as Element)?.tagName || 'null'}, activeTab=${activeTab}, scrollY=${window.scrollY}`);
    };

    const hashChangeHandler = () => {
      console.log(`🔗 HASH CHANGE: hash=${location.hash}, activeTab=${activeTab}, scrollY=${window.scrollY}`);
    };

    window.addEventListener('scroll', throttledScrollLog, { passive: true });
    document.addEventListener('focusin', focusHandler);
    window.addEventListener('hashchange', hashChangeHandler);

    return () => {
      clearTimeout(scrollTimer);
      window.removeEventListener('scroll', throttledScrollLog);
      document.removeEventListener('focusin', focusHandler);
      window.removeEventListener('hashchange', hashChangeHandler);
      layoutShiftObserver?.disconnect();
    };
  }, [activeTab]);

  // DEBUG: Click event logging on tab triggers
  useEffect(() => {
    const handleTabClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[role="tab"]')) {
        const tabValue = target.getAttribute('data-value') || target.textContent?.toLowerCase().replace(/\s+/g, '') || 'unknown';
        console.log(`🖱️ TAB CLICK: tab=${tabValue}, scrollY=${window.scrollY}, timestamp=${Date.now()}`);
      }
    };

    document.addEventListener('mousedown', handleTabClick);
    return () => document.removeEventListener('mousedown', handleTabClick);
  }, []);

  const { data: client, isLoading, error } = useQuery<Client>({
    queryKey: [`/api/clients/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });

  // Fetch related people/directors
  const { data: relatedPeople, isLoading: peopleLoading, error: peopleError } = useQuery<ClientPersonWithPerson[]>({
    queryKey: ['/api/clients', id, 'people'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client,
    retry: 1, // Retry once on failure
  });

  // Fetch client services
  const { data: clientServices, isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useQuery<EnhancedClientService[]>({
    queryKey: [`/api/client-services/client/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client,
  });

  // Fetch personal services for people related to this client
  const { data: peopleServices, isLoading: peopleServicesLoading, error: peopleServicesError, refetch: refetchPeopleServices } = useQuery<(PeopleService & { person: Person; service: Service; serviceOwner?: User })[]>({
    queryKey: [`/api/people-services/client/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client,
  });

  // Fetch all services with roles to get role information for personal services
  const { data: servicesWithRoles } = useQuery<(Service & { roles: WorkRole[] })[]>({
    queryKey: ['/api/services'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client,
  });

  // Fetch projects for this client
  const { data: clientProjects, isLoading: projectsLoading, error: projectsError } = useQuery<ProjectWithRelations[]>({
    queryKey: [`/api/clients/${id}/projects`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch task instances for this client
  const { data: taskInstances, isLoading: taskInstancesLoading } = useQuery<any[]>({
    queryKey: [`/api/task-instances/client/${id}`],
    enabled: !!id && !!client,
  });

  // Fetch task template categories
  const { data: taskCategories } = useQuery<any[]>({
    queryKey: ['/api/task-template-categories'],
    enabled: isNewRequestDialogOpen,
  });

  // Fetch task templates for selected category
  const { data: taskTemplates } = useQuery<any[]>({
    queryKey: ['/api/task-templates', { categoryId: selectedCategoryId }],
    enabled: isNewRequestDialogOpen && !!selectedCategoryId,
  });

  // Mutation for creating task instance
  const createTaskInstanceMutation = useMutation({
    mutationFn: async (data: { templateId: string; personId: string }) => {
      return await apiRequest("POST", "/api/task-instances", {
        templateId: data.templateId,
        clientId: id,
        personId: data.personId,
        status: "not_started",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Client request created successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/task-instances/client/${id}`] });
      setIsNewRequestDialogOpen(false);
      setSelectedCategoryId("");
      setSelectedTemplateId("");
      setSelectedPersonId("");
      setActiveTab("tasks"); // Switch to tasks tab to show the new request
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create client request",
        variant: "destructive",
      });
    },
  });

  // Mutation for creating custom request
  const createCustomRequestMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return await apiRequest("POST", `/api/clients/${id}/custom-requests`, {
        clientId: id,
        name: data.name,
        description: data.description || "",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Custom request created successfully. You can now add sections and questions in the admin area.",
      });
      // Invalidate custom requests query to refresh the list
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${id}/custom-requests`] });
      setIsNewRequestDialogOpen(false);
      setRequestType(null);
      customRequestForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create custom request",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating person data
  const updatePersonMutation = useMutation({
    mutationFn: async ({ personId, data }: { personId: string; data: UpdatePersonData }) => {
      return await apiRequest("PATCH", `/api/people/${personId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'people'] });
      setEditingPersonId(null);
      toast({
        title: "Success",
        description: "Person details updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update person details",
        variant: "destructive",
      });
    },
  });

  // Mutation for creating new person
  const createPersonMutation = useMutation({
    mutationFn: async (data: InsertPersonData) => {
      return await apiRequest("POST", `/api/clients/${id}/people`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'people'] });
      setIsAddPersonModalOpen(false);
      toast({
        title: "Success",
        description: "Person added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add person",
        variant: "destructive",
      });
    },
  });


  // Company Connections functionality for individual clients (many-to-many)
  const [showCompanySelection, setShowCompanySelection] = useState(false);
  const [showCompanyCreation, setShowCompanyCreation] = useState(false);

  // Query to fetch company connections for this person (many-to-many)
  const { data: companyConnections = [], isLoading: connectionsLoading } = useQuery<Array<{
    client: Client;
    officerRole?: string;
    isPrimaryContact?: boolean;
  }>>({
    queryKey: [`/api/people/${id}/companies`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client && client.clientType === 'individual',
  });

  // Query to fetch client services for all connected companies (for individual clients)
  const companyServicesQueries = useQuery<ClientServiceWithService[]>({
    queryKey: ['connected-company-services', (companyConnections ?? []).map(conn => conn.client.id)],
    queryFn: async () => {
      const connectedCompanyIds = (companyConnections ?? []).map(conn => conn.client.id);
      if (client?.clientType !== 'individual' || connectedCompanyIds.length === 0) {
        return [];
      }
      
      // Fetch services for all connected companies
      const servicesPromises = connectedCompanyIds.map(async (companyId) => {
        const response = await fetch(`/api/client-services/client/${companyId}`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch services for company ${companyId}`);
        }
        const services = await response.json();
        return services.map((service: any) => ({ ...service, companyId, companyName: companyConnections.find(conn => conn.client.id === companyId)?.client.name }));
      });
      
      const allServices = await Promise.all(servicesPromises);
      return allServices.flat();
    },
    enabled: !!client && client.clientType === 'individual' && (companyConnections?.length ?? 0) > 0,
  });

  // Query to fetch all company clients for selection
  const { data: companyClients } = useQuery<Client[]>({
    queryKey: ['/api/clients?search='],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: showCompanySelection,
  });

  // Mutation to link person to a company
  const linkToCompanyMutation = useMutation({
    mutationFn: async (data: { companyClientId: string; officerRole?: string; isPrimaryContact?: boolean }) => {
      return await apiRequest("POST", `/api/people/${id}/companies`, {
        clientId: data.companyClientId,
        officerRole: data.officerRole,
        isPrimaryContact: data.isPrimaryContact
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/people/${id}/companies`] });
      setShowCompanySelection(false);
      toast({
        title: "Success",
        description: "Successfully linked to company",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to link to company",
        variant: "destructive",
      });
    },
  });

  // Mutation to unlink person from a company
  const unlinkFromCompanyMutation = useMutation({
    mutationFn: async (companyClientId: string) => {
      return await apiRequest("DELETE", `/api/people/${id}/companies/${companyClientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/people/${id}/companies`] });
      toast({
        title: "Success",
        description: "Successfully removed company connection",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove company connection",
        variant: "destructive",
      });
    },
  });

  // Mutation to convert individual client to company client
  const convertToCompanyMutation = useMutation({
    mutationFn: async (companyData: { 
      companyName: string; 
      companyNumber?: string; 
      officerRole?: string; 
      isPrimaryContact?: boolean;
    }) => {
      return await apiRequest("POST", `/api/people/${id}/convert-to-company-client`, companyData);
    },
    onSuccess: (result: any) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/people/${id}/companies`] });
      setShowCompanyCreation(false);
      toast({
        title: "Success",
        description: `Successfully created company "${result.companyClient.fullName}" and linked to this person`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create company",
        variant: "destructive",
      });
    },
  });

  // Filter company clients (exclude individuals, current client, and already connected companies)
  const connectedCompanyIds = (companyConnections ?? []).map(conn => conn.client.id);
  const availableCompanies = companyClients?.filter(
    c => c.clientType === 'company' && c.id !== id && !connectedCompanyIds.includes(c.id)
  ) || [];

  // Documents query and mutation
  const { data: documents, isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ['/api/clients', id, 'documents'],
    enabled: !!id,
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return await apiRequest('DELETE', `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'documents'] });
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {user && <TopNavigation user={user} />}
        <div className="flex-1">
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-6 py-4">
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="container mx-auto p-6">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {user && <TopNavigation user={user} />}
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-96">
            <CardHeader>
              <CardTitle className="text-destructive">Client Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                The client you're looking for could not be found.
              </p>
              <Button 
                onClick={() => window.history.back()}
                data-testid="button-go-back"
              >
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {user && <TopNavigation user={user} />}
      <div className="flex-1" style={{ paddingBottom: isMobile ? '4rem' : '0' }}>
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-foreground truncate" data-testid="text-client-name">
                {client.name}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center mt-1 flex-wrap gap-x-2">
                {client.companyNumber && (
                  <>
                    <Building2 className="w-4 h-4 mr-1" />
                    Company #{client.companyNumber}
                  </>
                )}
                {client.dateOfCreation && (
                  <>
                    {client.companyNumber && <span className="mx-2">•</span>}
                    <Calendar className="w-4 h-4 mr-1" />
                    Formed: {new Date(client.dateOfCreation).toLocaleDateString()}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {client.companyStatus && (
                <Badge 
                  variant={client.companyStatus === 'active' ? 'default' : 'secondary'}
                  data-testid="badge-company-status"
                >
                  {client.companyStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Main Content */}
        <div className="container mx-auto p-4 md:p-6">
        <Tabs 
          defaultValue="overview" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex flex-col"
          data-tab-content="true"
          data-client-tabs="main"
        >
          {/* Desktop Tabs - Grid Layout */}
          <div className="hidden md:block w-full">
            <TabsList className="grid w-full grid-cols-8 gap-1 h-auto">
              <TabsTrigger value="overview" data-testid="tab-overview" className="text-sm py-2">Overview</TabsTrigger>
              <TabsTrigger value="services" data-testid="tab-services" className="text-sm py-2">Services</TabsTrigger>
              <TabsTrigger value="projects" data-testid="tab-projects" className="text-sm py-2">Projects</TabsTrigger>
              <TabsTrigger value="communications" data-testid="tab-communications" className="text-sm py-2">Comms</TabsTrigger>
              <TabsTrigger value="chronology" data-testid="tab-chronology" className="text-sm py-2">History</TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents" className="text-sm py-2">Docs</TabsTrigger>
              <TabsTrigger value="tasks" data-testid="tab-tasks" className="text-sm py-2">Tasks</TabsTrigger>
              <TabsTrigger value="risk" data-testid="tab-risk" className="text-sm py-2">Risk</TabsTrigger>
            </TabsList>
          </div>

          {/* Mobile Tabs - Carousel with Peek Preview and Arrow Navigation */}
          <div className="md:hidden w-full relative">
            {/* Left Arrow */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
              onClick={() => {
                const tabs = ["overview", "services", "projects", "communications", "chronology", "documents", "tasks", "risk"];
                const currentIndex = tabs.indexOf(activeTab);
                if (currentIndex > 0) {
                  setActiveTab(tabs[currentIndex - 1]);
                }
              }}
              disabled={activeTab === "overview"}
              data-testid="tab-nav-left"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            {/* Right Arrow */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
              onClick={() => {
                const tabs = ["overview", "services", "projects", "communications", "chronology", "documents", "tasks", "risk"];
                const currentIndex = tabs.indexOf(activeTab);
                if (currentIndex < tabs.length - 1) {
                  setActiveTab(tabs[currentIndex + 1]);
                }
              }}
              disabled={activeTab === "risk"}
              data-testid="tab-nav-right"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>

            <div className="w-full overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-4 px-[10vw]" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <TabsList className="inline-flex gap-2 h-auto">
              <TabsTrigger 
                value="overview" 
                data-testid="tab-overview" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
                onClick={() => {
                  const container = document.querySelector('.snap-x');
                  const tab = document.querySelector('[data-testid="tab-overview"]');
                  if (container && tab) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }
                }}
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                data-testid="tab-services" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
                onClick={() => {
                  const container = document.querySelector('.snap-x');
                  const tab = document.querySelector('[data-testid="tab-services"]');
                  if (container && tab) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }
                }}
              >
                Services
              </TabsTrigger>
              <TabsTrigger 
                value="projects" 
                data-testid="tab-projects" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
                onClick={() => {
                  const container = document.querySelector('.snap-x');
                  const tab = document.querySelector('[data-testid="tab-projects"]');
                  if (container && tab) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }
                }}
              >
                Projects
              </TabsTrigger>
              <TabsTrigger 
                value="communications" 
                data-testid="tab-communications" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
                onClick={() => {
                  const container = document.querySelector('.snap-x');
                  const tab = document.querySelector('[data-testid="tab-communications"]');
                  if (container && tab) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }
                }}
              >
                Comms
              </TabsTrigger>
              <TabsTrigger 
                value="chronology" 
                data-testid="tab-chronology" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
                onClick={() => {
                  const container = document.querySelector('.snap-x');
                  const tab = document.querySelector('[data-testid="tab-chronology"]');
                  if (container && tab) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }
                }}
              >
                History
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                data-testid="tab-documents" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
                onClick={() => {
                  const container = document.querySelector('.snap-x');
                  const tab = document.querySelector('[data-testid="tab-documents"]');
                  if (container && tab) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }
                }}
              >
                Docs
              </TabsTrigger>
              <TabsTrigger 
                value="tasks" 
                data-testid="tab-tasks" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
                onClick={() => {
                  const container = document.querySelector('.snap-x');
                  const tab = document.querySelector('[data-testid="tab-tasks"]');
                  if (container && tab) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }
                }}
              >
                Tasks
              </TabsTrigger>
              <TabsTrigger 
                value="risk" 
                data-testid="tab-risk" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
                onClick={() => {
                  const container = document.querySelector('.snap-x');
                  const tab = document.querySelector('[data-testid="tab-risk"]');
                  if (container && tab) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }
                }}
              >
                Risk
              </TabsTrigger>
            </TabsList>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Company Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Company Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  // Create formatted address string for the map
                  const addressParts = [
                    client.registeredAddress1,
                    client.registeredAddress2,
                    client.registeredAddress3,
                    client.registeredPostcode,
                    client.registeredCountry
                  ].filter(Boolean);
                  const fullAddress = addressParts.join(', ');
                  const hasAddress = addressParts.length > 0;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Registered Office Address */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <MapPin className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-semibold">Registered Office</h3>
                        </div>
                        
                        {hasAddress ? (
                          <div className="p-4 rounded-lg bg-muted/30 border">
                            <div className="space-y-1" data-testid="text-company-address">
                              {client.registeredAddress1 && <p className="font-medium">{client.registeredAddress1}</p>}
                              {client.registeredAddress2 && <p>{client.registeredAddress2}</p>}
                              {client.registeredAddress3 && <p>{client.registeredAddress3}</p>}
                              {client.registeredPostcode && <p className="font-medium">{client.registeredPostcode}</p>}
                              {client.registeredCountry && <p className="text-muted-foreground">{client.registeredCountry}</p>}
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground italic p-4 border rounded-lg bg-muted/30">
                            No registered address available
                          </p>
                        )}

                        {client.email && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              Company Email
                            </label>
                            <p className="font-medium" data-testid="text-company-email">
                              {client.email}
                            </p>
                          </div>
                        )}

                        {client.companyType && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                              <Building2 className="w-4 h-4" />
                              Company Type
                            </label>
                            <p className="font-medium" data-testid="text-company-type">
                              {client.companyType}
                            </p>
                          </div>
                        )}

                        {/* Client Tags */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            Client Tags
                          </label>
                          <TagManager 
                            entityId={client.id} 
                            entityType="client" 
                            className="mt-2"
                          />
                        </div>
                      </div>

                      {/* Google Maps */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <MapPin className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-semibold">Location</h3>
                        </div>
                        
                        {hasAddress ? (
                          <AddressMap 
                            address={fullAddress}
                            className="h-[300px]"
                          />
                        ) : (
                          <div className="h-[300px] rounded-lg border bg-muted/30 flex items-center justify-center">
                            <p className="text-muted-foreground">No address available for map display</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {client.companyNumber && (
                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`https://find-and-update.company-information.service.gov.uk/company/${client.companyNumber}`, '_blank')}
                      data-testid="button-view-companies-house"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View on Companies House
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Related People Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Related People</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    data-testid="button-add-person"
                    onClick={() => setIsAddPersonModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div data-testid="section-related-people">
                  {peopleLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : peopleError ? (
                    <div className="text-center py-8">
                      <p className="text-destructive mb-2">
                        Failed to load related people
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Please try refreshing the page or contact support if the issue persists.
                      </p>
                    </div>
                  ) : relatedPeople && relatedPeople.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Primary Email</TableHead>
                            <TableHead>Primary Phone</TableHead>
                            <TableHead className="text-center">App Access</TableHead>
                            <TableHead className="text-center">Push</TableHead>
                            <TableHead>Date of Birth</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {relatedPeople.map((clientPerson) => (
                            <RelatedPersonRow
                              key={clientPerson.person.id}
                              clientPerson={clientPerson}
                              clientId={id!}
                              clientName={client?.name || ''}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        No directors or related people found for this client.
                      </p>
                      <p className="text-muted-foreground text-sm mt-2">
                        Directors will be automatically added when creating clients from Companies House data.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Company Connections Section - Only show for individual clients */}
            {client.clientType === 'individual' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Company Connections
                      {companyConnections.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {companyConnections.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        data-testid="button-add-company-connection"
                        onClick={() => setShowCompanySelection(true)}
                        disabled={linkToCompanyMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {linkToCompanyMutation.isPending ? "Connecting..." : "Add Company"}
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        data-testid="button-create-company"
                        onClick={() => setShowCompanyCreation(true)}
                      >
                        <Building2 className="h-4 w-4 mr-2" />
                        Create Company
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div data-testid="section-company-connections">
                    {connectionsLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : companyConnections.length > 0 ? (
                      <div className="space-y-3">
                        {companyConnections.map((connection, index) => (
                          <div key={connection.client.id} className="p-4 rounded-lg border bg-card" data-testid={`company-connection-${connection.client.id}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                                  <Building2 className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-lg" data-testid={`text-company-name-${connection.client.id}`}>
                                    {connection.client.name}
                                  </h4>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    {connection.officerRole && (
                                      <Badge variant="outline" className="text-xs">
                                        {connection.officerRole}
                                      </Badge>
                                    )}
                                    {connection.isPrimaryContact && (
                                      <Badge variant="secondary" className="text-xs">
                                        Primary Contact
                                      </Badge>
                                    )}
                                    {!connection.officerRole && !connection.isPrimaryContact && "Company connection"}
                                  </div>
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                data-testid={`button-remove-company-connection-${connection.client.id}`}
                                onClick={() => unlinkFromCompanyMutation.mutate(connection.client.id)}
                                disabled={unlinkFromCompanyMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground mb-4">
                          No companies connected to this individual client.
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Connect this person to companies they are associated with as directors, shareholders, or contacts.
                        </p>
                        <Button 
                          variant="outline"
                          data-testid="button-add-first-company-connection"
                          onClick={() => setShowCompanySelection(true)}
                          disabled={linkToCompanyMutation.isPending}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {linkToCompanyMutation.isPending ? "Connecting..." : "Add Company Connection"}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="services" className="space-y-6 mt-6">
            {/* Client Services Section - Show for company clients OR individual clients with company connections */}
            {(() => {
              // Handle legacy data where clientType might be null for companies
              const isCompany = client?.clientType === 'company' || 
                                (client?.clientType === null && client?.companyNumber); // Legacy companies have null clientType but have companyNumber
              const isIndividualWithConnections = client?.clientType === 'individual' && (companyConnections?.length ?? 0) > 0;
              
              return (isCompany || isIndividualWithConnections);
            })() && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Client Services</CardTitle>
                    <AddServiceModal 
                      clientId={client.id} 
                      clientType={
                        client.clientType === null && client.companyNumber 
                          ? 'company' 
                          : (client.clientType as 'company' | 'individual' | undefined)
                      } 
                      onSuccess={refetchServices} 
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div data-testid="section-client-services">
                    {(() => {
                      // Simple conditional logic for data source
                      const isIndividualWithConnections = client.clientType === 'individual' && (companyConnections?.length ?? 0) > 0;
                      const displayServices: EnhancedClientService[] | undefined = isIndividualWithConnections ? (companyServicesQueries.data as unknown as EnhancedClientService[]) : clientServices;
                      const loading = isIndividualWithConnections ? companyServicesQueries.isLoading : servicesLoading;
                      const error = isIndividualWithConnections ? companyServicesQueries.isError : servicesError;
                      
                      if (loading) {
                        return (
                          <div className="space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                          </div>
                        );
                      }
                      
                      if (error) {
                        return (
                          <div className="text-center py-8">
                            <p className="text-destructive mb-2">Failed to load services</p>
                            <p className="text-muted-foreground text-sm">Please try refreshing the page or contact support if the issue persists.</p>
                          </div>
                        );
                      }
                      
                      if (displayServices && displayServices.length > 0) {
                        // Separate active and inactive client services
                        const activeClientServices = displayServices.filter(service => service.isActive !== false);
                        const inactiveClientServices = displayServices.filter(service => service.isActive === false);
                        
                        return (
                          <div className="bg-background space-y-6">
                            {/* Active Client Services */}
                            {activeClientServices.length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm text-muted-foreground mb-3">Active Services</h4>
                                <div className="border rounded-lg">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Service</TableHead>
                                        <TableHead>Frequency</TableHead>
                                        <TableHead>Next Start</TableHead>
                                        <TableHead>Next Due</TableHead>
                                        <TableHead>Service Owner</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {activeClientServices.map((clientService: EnhancedClientService) => (
                                        <ClientServiceRow 
                                          key={clientService.id}
                                          clientService={clientService}
                                        />
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                            
                            {/* Inactive Client Services */}
                            {inactiveClientServices.length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm text-muted-foreground mb-3">Inactive Services</h4>
                                <div className="border rounded-lg opacity-60">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Service</TableHead>
                                        <TableHead>Frequency</TableHead>
                                        <TableHead>Next Start</TableHead>
                                        <TableHead>Next Due</TableHead>
                                        <TableHead>Service Owner</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {inactiveClientServices.map((clientService: EnhancedClientService) => (
                                        <ClientServiceRow 
                                          key={clientService.id}
                                          clientService={clientService}
                                        />
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      
                      return (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground mb-4">No client services have been added yet.</p>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Personal Services Section */}
            <div className="space-y-4">
              {/* Add Personal Service Button - positioned above the Personal Services card */}
              <div className="flex justify-end">
                <AddServiceModal 
                  clientId={client.id} 
                  clientType="individual" 
                  onSuccess={() => { refetchServices(); refetchPeopleServices(); }} 
                />
              </div>
              
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className={client.clientType === 'individual' ? '' : 'text-red-500'}>
                      {client.clientType === 'individual' ? 'Services' : 'Personal Services'}
                    </CardTitle>
                  </div>
                </CardHeader>
              <CardContent>
                <div data-testid="section-personal-services">
                  {peopleServicesLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : peopleServicesError ? (
                    <div className="text-center py-8">
                      <p className="text-destructive mb-2">Failed to load personal services</p>
                      <p className="text-muted-foreground text-sm">Please try refreshing the page or contact support if the issue persists.</p>
                    </div>
                  ) : peopleServices && peopleServices.length > 0 ? (
                    (() => {
                      // Separate active and inactive people services
                      const activePeopleServices = peopleServices.filter(service => service.isActive !== false);
                      const inactivePeopleServices = peopleServices.filter(service => service.isActive === false);
                      
                      return (
                        <div className="bg-background space-y-6">
                          {/* Active People Services */}
                          {activePeopleServices.length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm text-muted-foreground mb-3">Active Services</h4>
                              <Accordion
                                type="single"
                                collapsible
                                value={expandedPersonalServiceId ?? undefined}
                                onValueChange={(value) => setExpandedPersonalServiceId(value ?? null)}
                                className="space-y-4"
                              >
                                {activePeopleServices.map((peopleService: PeopleService & { person: Person; service: Service; serviceOwner?: User }) => (
                          <AccordionItem key={peopleService.id} value={peopleService.id} className="border rounded-lg bg-card">
                            <AccordionTrigger 
                              className="text-left hover:no-underline p-4"
                              data-testid={`personal-service-row-${peopleService.id}`}
                            >
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full mr-4">
                                {/* Column 1: Service Name and Description */}
                                <div className="space-y-2">
                                  <div>
                                    <h4 className="font-medium text-lg" data-testid={`text-personal-service-name-${peopleService.id}`}>
                                      {peopleService.service?.name || 'Service'}
                                    </h4>
                                    {peopleService.service?.description && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {peopleService.service.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Frequency: {peopleService.frequency || 'Not scheduled'}
                                  </div>
                                </div>

                                {/* Column 2: Next Service Dates (Start & Due) */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-muted-foreground">Next Service Dates</span>
                                  </div>
                                  <div className="space-y-1">
                                    {peopleService.nextStartDate ? (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs text-muted-foreground">Start:</span>
                                        <span className="text-sm font-medium" data-testid={`text-next-start-date-${peopleService.id}`}>
                                          {formatDate(peopleService.nextStartDate)}
                                        </span>
                                      </div>
                                    ) : null}
                                    {peopleService.nextDueDate ? (
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs text-muted-foreground">Due:</span>
                                        <span className="text-sm font-medium" data-testid={`text-next-due-date-${peopleService.id}`}>
                                          {formatDate(peopleService.nextDueDate)}
                                        </span>
                                      </div>
                                    ) : null}
                                    {!peopleService.nextStartDate && !peopleService.nextDueDate && (
                                      <p className="text-sm text-muted-foreground italic">Not scheduled</p>
                                    )}
                                  </div>
                                </div>

                                {/* Column 3: Current Project Dates */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-muted-foreground">Current Project Dates</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground italic">No active project</p>
                                </div>

                                {/* Column 4: Person */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 mb-2">
                                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-muted-foreground">Person</span>
                                  </div>
                                  {peopleService.person ? (
                                    <div className="space-y-1">
                                      <div className="text-sm font-medium" data-testid={`text-person-name-${peopleService.id}`}>
                                        {formatPersonName(peopleService.person.fullName)}
                                      </div>
                                      {peopleService.person.email && (
                                        <div className="text-xs text-muted-foreground">
                                          {peopleService.person.email}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">No person assigned</p>
                                  )}
                                </div>
                              </div>
                            </AccordionTrigger>
                            
                            <AccordionContent className="px-4 pb-4 border-t bg-gradient-to-r from-muted/30 to-muted/10 dark:from-muted/40 dark:to-muted/20" data-testid={`section-personal-service-details-${peopleService.id}`}>
                              <div className="pt-4">
                                <div className="flex items-center justify-between mb-4">
                                  <div></div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditingPersonalServiceId(peopleService.id)}
                                    data-testid={`button-edit-personal-service-${peopleService.id}`}
                                    className="h-8 px-3 text-xs"
                                  >
                                    <Pencil className="h-3 w-3 mr-1" />
                                    Edit Service
                                  </Button>
                                </div>
                                <Tabs defaultValue="roles" className="w-full">
                                  <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="roles" data-testid={`tab-roles-${peopleService.id}`}>Roles & Assignments</TabsTrigger>
                                    <TabsTrigger value="projects" data-testid={`tab-projects-${peopleService.id}`}>Related Projects</TabsTrigger>
                                  </TabsList>

                                  <TabsContent value="roles" className="mt-4">
                                    <div className="space-y-4">
                                      <h5 className="font-medium text-sm flex items-center">
                                        <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                                        Role Assignments
                                      </h5>
                                      
                                      {(() => {
                                        // Find roles for this service
                                        const serviceWithRoles = servicesWithRoles?.find(s => s.id === peopleService.service.id);
                                        const roles = serviceWithRoles?.roles || [];

                                        if (roles.length === 0) {
                                          return (
                                            <div className="text-center py-8">
                                              <p className="text-muted-foreground">No roles defined for this service.</p>
                                            </div>
                                          );
                                        }

                                        return (
                                          <div className="space-y-3">
                                            {roles.map((role) => (
                                              <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                                <div className="flex items-center space-x-3">
                                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <UserIcon className="h-4 w-4 text-primary" />
                                                  </div>
                                                  <div>
                                                    <div className="font-medium text-sm" data-testid={`role-name-${role.id}`}>
                                                      {role.name}
                                                    </div>
                                                    {role.description && (
                                                      <div className="text-xs text-muted-foreground" data-testid={`role-description-${role.id}`}>
                                                        {role.description}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                  {peopleService.serviceOwner ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400" data-testid={`role-owner-${role.id}`}>
                                                      {peopleService.serviceOwner.firstName} {peopleService.serviceOwner.lastName}
                                                    </span>
                                                  ) : (
                                                    <span className="text-amber-600 dark:text-amber-400" data-testid={`role-unassigned-${role.id}`}>
                                                      Unassigned
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                            <div className="text-xs text-muted-foreground mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                              <p className="font-medium mb-1">Personal Service Assignment</p>
                                              <p>
                                                This service is assigned to <span className="font-medium">{formatPersonName(peopleService.person.fullName)}</span>
                                                {peopleService.serviceOwner ? 
                                                  ` and managed by ${peopleService.serviceOwner.firstName} ${peopleService.serviceOwner.lastName}.` :
                                                  '. No service owner is currently assigned.'}
                                              </p>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </TabsContent>

                                  <TabsContent value="projects" className="mt-4">
                                    <div className="space-y-4">
                                      <h5 className="font-medium text-sm flex items-center">
                                        <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />
                                        Related Projects
                                      </h5>
                                      
                                      <ServiceProjectsList 
                                        serviceId={peopleService.serviceId} 
                                      />
                                    </div>
                                  </TabsContent>
                                </Tabs>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                                </Accordion>
                              </div>
                            )}
                            
                            {/* Inactive People Services */}
                            {inactivePeopleServices.length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm text-muted-foreground mb-3">Inactive Services</h4>
                                <Accordion
                                  type="single"
                                  collapsible
                                  value={expandedPersonalServiceId ?? undefined}
                                  onValueChange={(value) => setExpandedPersonalServiceId(value ?? null)}
                                  className="space-y-4"
                                >
                                  {inactivePeopleServices.map((peopleService: PeopleService & { person: Person; service: Service; serviceOwner?: User }) => (
                                    <AccordionItem key={peopleService.id} value={peopleService.id} className="border rounded-lg bg-card opacity-60">
                                      <AccordionTrigger 
                                        className="text-left hover:no-underline p-4"
                                        data-testid={`personal-service-row-${peopleService.id}`}
                                      >
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full mr-4">
                                          {/* Column 1: Service Name and Description */}
                                          <div className="space-y-2">
                                            <div>
                                              <h4 className="font-medium text-lg" data-testid={`text-personal-service-name-${peopleService.id}`}>
                                                {peopleService.service?.name || 'Service'} <span className="text-xs text-red-500">(Inactive)</span>
                                              </h4>
                                              {peopleService.service?.description && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                  {peopleService.service.description}
                                                </p>
                                              )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              Frequency: {peopleService.frequency || 'Not scheduled'}
                                            </div>
                                          </div>

                                          {/* Column 2: Next Service Dates (Start & Due) */}
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2 mb-2">
                                              <Clock className="h-4 w-4 text-muted-foreground" />
                                              <span className="text-sm font-medium text-muted-foreground">Next Service Dates</span>
                                            </div>
                                            <div className="space-y-1">
                                              {peopleService.nextStartDate ? (
                                                <div className="flex items-center space-x-2">
                                                  <span className="text-xs text-muted-foreground">Start:</span>
                                                  <span className="text-sm font-medium" data-testid={`text-personal-next-start-date-${peopleService.id}`}>
                                                    {formatDate(peopleService.nextStartDate)}
                                                  </span>
                                                </div>
                                              ) : null}
                                              {peopleService.nextDueDate ? (
                                                <div className="flex items-center space-x-2">
                                                  <span className="text-xs text-muted-foreground">Due:</span>
                                                  <span className="text-sm font-medium" data-testid={`text-personal-next-due-date-${peopleService.id}`}>
                                                    {formatDate(peopleService.nextDueDate)}
                                                  </span>
                                                </div>
                                              ) : null}
                                              {!peopleService.nextStartDate && !peopleService.nextDueDate && (
                                                <p className="text-sm text-muted-foreground italic">Not scheduled</p>
                                              )}
                                            </div>
                                          </div>

                                          {/* Column 3: Current Project Dates */}
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2 mb-2">
                                              <Calendar className="h-4 w-4 text-muted-foreground" />
                                              <span className="text-sm font-medium text-muted-foreground">Current Project Dates</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground italic">No active project</p>
                                          </div>

                                          {/* Column 4: Service Owner */}
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2 mb-2">
                                              <UserIcon className="h-4 w-4 text-muted-foreground" />
                                              <span className="text-sm font-medium text-muted-foreground">Service Owner</span>
                                            </div>
                                            {peopleService.serviceOwner ? (
                                              <div className="space-y-1">
                                                <div className="text-sm font-medium" data-testid={`text-personal-service-owner-${peopleService.id}`}>
                                                  {peopleService.serviceOwner.firstName} {peopleService.serviceOwner.lastName}
                                                </div>
                                                {peopleService.serviceOwner.email && (
                                                  <div className="text-xs text-muted-foreground">
                                                    {peopleService.serviceOwner.email}
                                                  </div>
                                                )}
                                              </div>
                                            ) : (
                                              <p className="text-sm text-muted-foreground italic">No owner assigned</p>
                                            )}
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      
                                      <AccordionContent className="px-4 pb-4 border-t bg-gradient-to-r from-muted/30 to-muted/10 dark:from-muted/40 dark:to-muted/20" data-testid={`section-personal-service-details-${peopleService.id}`}>
                                        <div className="pt-4">
                                          <div className="flex items-center justify-between mb-4">
                                            <div></div>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setEditingPersonalServiceId(peopleService.id)}
                                              data-testid={`button-edit-personal-service-${peopleService.id}`}
                                              className="h-8 px-3 text-xs"
                                            >
                                              <Pencil className="h-3 w-3 mr-1" />
                                              Edit Service
                                            </Button>
                                          </div>
                                          <Tabs defaultValue="roles" className="w-full">
                                            <TabsList className="grid w-full grid-cols-2">
                                              <TabsTrigger value="roles" data-testid={`tab-personal-roles-${peopleService.id}`}>Assignment Details</TabsTrigger>
                                              <TabsTrigger value="projects" data-testid={`tab-personal-projects-${peopleService.id}`}>Related Projects</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="roles" className="mt-4">
                                              <div className="space-y-4">
                                                <h5 className="font-medium text-sm flex items-center">
                                                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                                                  Assignment Details
                                                </h5>
                                                
                                                {(() => {
                                                  return (
                                                    <div className="text-xs text-muted-foreground mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                                      <p className="font-medium mb-1">Personal Service Assignment</p>
                                                      <p>
                                                        This service is assigned to <span className="font-medium">{formatPersonName(peopleService.person.fullName)}</span>
                                                        {peopleService.serviceOwner ? 
                                                          ` and managed by ${peopleService.serviceOwner.firstName} ${peopleService.serviceOwner.lastName}.` :
                                                          '. No service owner is currently assigned.'}
                                                      </p>
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                            </TabsContent>

                                            <TabsContent value="projects" className="mt-4">
                                              <div className="space-y-4">
                                                <h5 className="font-medium text-sm flex items-center">
                                                  <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />
                                                  Related Projects
                                                </h5>
                                                
                                                <ServiceProjectsList 
                                                  serviceId={peopleService.serviceId} 
                                                />
                                              </div>
                                            </TabsContent>
                                          </Tabs>
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                                </Accordion>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">No personal services have been added yet.</p>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6 mt-6">
            {/* Open Projects Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Open Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectsList 
                  projects={clientProjects?.filter(p => !p.completionStatus)} 
                  isLoading={projectsLoading}
                  clientId={id}
                />
              </CardContent>
            </Card>

            {/* Completed Projects Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Completed Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectsList 
                  projects={clientProjects?.filter(p => p.completionStatus)} 
                  isLoading={projectsLoading}
                  clientId={id}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communications" className="space-y-6 mt-6">
            <CommunicationsTimeline clientId={id} user={user} />
          </TabsContent>

          <TabsContent value="chronology" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Client Activity Chronology
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ClientChronology clientId={id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentFolderView 
                  clientId={id} 
                  renderActions={(currentFolderId) => (
                    <>
                      <CreateFolderDialog clientId={id} />
                      <DocumentUploadDialog clientId={id} source="direct upload" folderId={currentFolderId} />
                    </>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Client Requests
                  </CardTitle>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsNewRequestDialogOpen(true)}
                    data-testid="button-new-client-request"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Client Request
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {taskInstancesLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : !taskInstances || taskInstances.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No client requests yet. Click "New Client Request" to create one.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Request Name</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taskInstances.map((instance: any) => (
                          <TableRow key={instance.id} data-testid={`row-task-${instance.id}`}>
                            <TableCell className="font-medium">
                              <span data-testid={`text-name-${instance.id}`}>
                                {instance.template?.name || 'Untitled Request'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm" data-testid={`text-assignee-${instance.id}`}>
                                {instance.relatedPerson ? formatPersonName(instance.relatedPerson.fullName) : '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  instance.status === 'submitted' ? 'default' : 
                                  instance.status === 'approved' ? 'default' : 
                                  'outline'
                                }
                                data-testid={`badge-status-${instance.id}`}
                              >
                                {instance.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm" data-testid={`text-created-${instance.id}`}>
                                {formatDate(instance.createdAt)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => setLocation(`/task-instances/${instance.id}`)}
                                data-testid={`button-view-${instance.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk" className="space-y-6 mt-6">
            <RiskAssessmentTab clientId={id} />
          </TabsContent>
        </Tabs>
        </div>
      </div>
      
      {/* Edit Service Modal */}
      {editingServiceId && (() => {
        const currentService = clientServices?.find(cs => cs.id === editingServiceId);
        if (currentService) {
          return (
            <EditServiceModal
              service={currentService as EnhancedClientService}
              isOpen={!!editingServiceId}
              onClose={() => setEditingServiceId(null)}
            />
          );
        }
        return null;
      })()}

      {/* Edit Personal Service Modal */}
      {editingPersonalServiceId && (() => {
        const currentPersonalService = peopleServices?.find(ps => ps.id === editingPersonalServiceId);
        if (currentPersonalService) {
          return (
            <EditServiceModal
              service={currentPersonalService as any}
              isOpen={!!editingPersonalServiceId}
              onClose={() => setEditingPersonalServiceId(null)}
            />
          );
        }
        return null;
      })()}

      {/* Add Person Modal */}
      <AddPersonModal
        clientId={id}
        isOpen={isAddPersonModalOpen}
        onClose={() => setIsAddPersonModalOpen(false)}
        onSave={(data) => {
          createPersonMutation.mutate({
            ...data,
            clientId: id,
          });
        }}
        isSaving={createPersonMutation.isPending}
      />

      {/* New Client Request Dialog */}
      <Dialog open={isNewRequestDialogOpen} onOpenChange={(open) => {
        setIsNewRequestDialogOpen(open);
        if (!open) {
          setRequestType(null);
          setSelectedCategoryId("");
          setSelectedTemplateId("");
          setSelectedPersonId("");
          customRequestForm.reset();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Client Request</DialogTitle>
            <DialogDescription>
              {!requestType ? "Choose how to create the request" : requestType === 'template' ? "Select a template and assign it to a related person" : "Create a custom one-time request"}
            </DialogDescription>
          </DialogHeader>
          
          {!requestType ? (
            <div className="grid grid-cols-2 gap-4 py-4">
              <Card 
                className="cursor-pointer hover:bg-accent transition-colors p-6"
                onClick={() => setRequestType('template')}
                data-testid="card-use-template"
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <FileText className="w-12 h-12 text-primary" />
                  <div>
                    <h3 className="font-semibold">Use Template</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Select from reusable templates
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card 
                className="cursor-pointer hover:bg-accent transition-colors p-6"
                onClick={() => setRequestType('custom')}
                data-testid="card-create-custom"
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <Plus className="w-12 h-12 text-primary" />
                  <div>
                    <h3 className="font-semibold">Create Custom</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Build a one-time request
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          ) : requestType === 'template' ? (
            <>
              <div className="space-y-4">
                {/* Category Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select 
                    value={selectedCategoryId} 
                    onValueChange={(value) => {
                      setSelectedCategoryId(value);
                      setSelectedTemplateId("");
                    }}
                  >
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(taskCategories || []).map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Template Selection */}
                {selectedCategoryId && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Template</label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger data-testid="select-template">
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {(taskTemplates || []).map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Related Person Selection */}
                {selectedTemplateId && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assign to Related Person</label>
                    <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                      <SelectTrigger data-testid="select-person">
                        <SelectValue placeholder="Select a person" />
                      </SelectTrigger>
                      <SelectContent>
                        {(relatedPeople || []).map((cp: any) => (
                          <SelectItem key={cp.person.id} value={cp.person.id}>
                            {formatPersonName(cp.person.fullName)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRequestType(null);
                    setSelectedCategoryId("");
                    setSelectedTemplateId("");
                    setSelectedPersonId("");
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (selectedTemplateId && selectedPersonId) {
                      createTaskInstanceMutation.mutate({
                        templateId: selectedTemplateId,
                        personId: selectedPersonId,
                      });
                    }
                  }}
                  disabled={!selectedTemplateId || !selectedPersonId || createTaskInstanceMutation.isPending}
                  data-testid="button-create-request"
                >
                  {createTaskInstanceMutation.isPending ? "Creating..." : "Create Request"}
                </Button>
              </div>
            </>
          ) : (
            <Form {...customRequestForm}>
              <form onSubmit={customRequestForm.handleSubmit((data) => createCustomRequestMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={customRequestForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Quarterly Business Review Documents"
                          data-testid="input-custom-request-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={customRequestForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Describe what information you need from the client..."
                          rows={4}
                          data-testid="input-custom-request-description"
                        />
                      </FormControl>
                      <FormDescription>
                        Provide details about what this request is for
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-muted/30 border border-dashed rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    After creating the custom request, you'll be able to add sections and questions in the builder.
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setRequestType(null);
                      customRequestForm.reset();
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={createCustomRequestMutation.isPending}
                    data-testid="button-create-custom-request"
                  >
                    {createCustomRequestMutation.isPending ? "Creating..." : "Create Custom Request"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />}

      {/* Mobile Search Modal */}
      {isMobile && (
        <SuperSearch
          isOpen={mobileSearchOpen}
          onOpenChange={setMobileSearchOpen}
        />
      )}
    </div>
  );
}
