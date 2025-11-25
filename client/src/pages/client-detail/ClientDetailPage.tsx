import { useParams, Link as RouterLink, useLocation } from "wouter";
import { useState, useLayoutEffect, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TiptapEditor } from '@/components/TiptapEditor';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import DOMPurify from 'dompurify';
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwipeableTabsWrapper } from "@/components/swipeable-tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, ExternalLink, Plus, ChevronDown, ChevronRight, ChevronUp, ChevronLeft, Phone, Mail, UserIcon, Clock, Settings, Users, Briefcase, Check, ShieldCheck, Link, X, Pencil, Eye, MessageSquare, PhoneCall, FileText, Send, Inbox, Upload, Download, Trash, QrCode, CheckSquare, FileSignature, Shield, PenLine } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
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
import { ClientNotificationsView } from "@/components/ClientNotificationsView";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { EmailThreadViewer } from "@/components/EmailThreadViewer";
import { CommunicationCard } from "@/components/communication-card";
import { SignatureRequestsPanel } from "@/components/SignatureRequestsPanel";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useActivityTracker } from "@/lib/activityTracker";
import type { Client, Person, ClientPerson, Service, ClientService, User, WorkRole, ClientServiceRoleAssignment, PeopleService, ProjectWithRelations, Communication, Document, ClientPortalUser } from "@shared/schema";
import { insertPersonSchema, insertCommunicationSchema, insertClientCustomRequestSchema } from "@shared/schema";
import { formatPersonName, formatDate, formatBirthDate, maskIdentifier } from "./utils/formatters";
import { getStatusColor, formatStatus } from "./utils/projectHelpers";
import { 
  CommunicationWithRelations, 
  ClientPersonWithPerson, 
  ClientPersonWithClient,
  ClientServiceWithService,
  ServiceWithDetails,
  EnhancedClientService,
  PeopleServiceWithRelations,
  addServiceSchema,
  AddServiceData,
  addPersonSchema,
  InsertPersonData,
  updatePersonSchema,
  UpdatePersonData,
  editServiceSchema,
  EditServiceData,
  linkPersonToCompanySchema,
  LinkPersonToCompanyData,
  AddServiceModalProps
} from "./utils/types";
import { PortalStatusColumn } from "./components/PortalStatusColumn";
import { ProjectsList, ServiceProjectsList, OpenProjectRow, CompletedProjectRow } from "./components/projects";
import { 
  PersonEditForm, 
  PersonViewMode, 
  RelatedPersonRow, 
  PersonTabbedView, 
  AddPersonModal 
} from "./components/people";
import {
  ClientServiceRow,
  EditableServiceDetails,
  EditServiceModal,
  AddServiceModal
} from "./components/services";

// Project Link Component - displays project name with link
function ProjectLink({ projectId }: { projectId: string }) {
  const [, setLocation] = useLocation();
  const { data: project } = useQuery<any>({
    queryKey: ['/api/projects', projectId],
    enabled: !!projectId,
  });

  if (!project) {
    return <span className="text-sm text-muted-foreground">Loading...</span>;
  }

  return (
    <button
      onClick={() => setLocation(`/projects/${projectId}`)}
      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      data-testid={`link-project-${projectId}`}
    >
      {project.description || project.client?.name || 'Unknown Project'}
    </button>
  );
}

// Communications Timeline Component
function CommunicationsTimeline({ clientId, user }: { clientId: string; user: any }) {
  const isMobile = useIsMobile();
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
  const [emailThreadViewerOpen, setEmailThreadViewerOpen] = useState(false);
  const [selectedEmailThreadId, setSelectedEmailThreadId] = useState<string | null>(null);
  const [commTypeFilter, setCommTypeFilter] = useState<'all' | 'phone_call' | 'sms' | 'email' | 'message_thread' | 'note' | 'email_thread'>('all');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Projects cache for card view
  const [projectCache, setProjectCache] = useState<Record<string, any>>({});

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

  // Fetch email threads for this client
  const { data: emailThreadsData, isLoading: isLoadingEmailThreads } = useQuery<{
    threads: Array<{
      canonicalConversationId: string;
      subject: string | null;
      participants: string[] | null;
      firstMessageAt: string;
      lastMessageAt: string;
      messageCount: number;
      latestPreview: string | null;
      latestDirection: 'inbound' | 'outbound' | 'internal' | 'external' | null;
    }>;
  }>({
    queryKey: ['/api/emails/client', clientId],
    enabled: !!clientId,
  });

  // Fetch client people for person selection
  const { data: clientPeople } = useQuery({
    queryKey: ['/api/clients', clientId, 'people'],
    enabled: !!clientId,
  });

  const addCommunicationMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', `/api/communications`, data),
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
      case 'email_thread':
        return <Mail className="h-4 w-4" />;
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
      case 'email_thread':
        return 'Email Thread';
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
      case 'email_thread':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  // Merge communications, message threads, and email threads
  const emailThreads = emailThreadsData?.threads || [];
  const allItems = [
    ...(communications || []),
    ...(messageThreads || []).map(thread => ({
      ...thread,
      type: 'message_thread',
      loggedAt: thread.createdAt,
      content: thread.lastMessage?.content || '',
    })),
    ...emailThreads.map(thread => ({
      ...thread,
      id: thread.canonicalConversationId,
      type: 'email_thread',
      loggedAt: thread.lastMessageAt,
      createdAt: thread.firstMessageAt,
      subject: thread.subject || 'No Subject',
      content: thread.latestPreview || thread.subject || '',
      user: null, // Email threads don't have a specific CRM user
      createdBy: null,
      projectId: null, // Email threads aren't directly linked to projects in this view
    }))
  ].sort((a, b) => 
    new Date(b.loggedAt || b.createdAt).getTime() - new Date(a.loggedAt || a.createdAt).getTime()
  );

  // Apply communication type filter
  const filteredItems = allItems.filter(item => {
    if (commTypeFilter === 'all') return true;
    if (commTypeFilter === 'sms') return item.type === 'sms_sent' || item.type === 'sms_received';
    if (commTypeFilter === 'email') return item.type === 'email_sent' || item.type === 'email_received';
    return item.type === commTypeFilter;
  });

  if (isLoading || isLoadingThreads || isLoadingEmailThreads) {
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
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <span className="hidden md:inline">Communications Timeline</span>
            <span className="md:hidden">Comms</span>
          </CardTitle>
          
          {/* Mobile: Single Dropdown Menu */}
          {isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" data-testid="button-mobile-actions-menu">
                  <Plus className="h-4 w-4 mr-2" />
                  New
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setIsCallingPerson(true)} data-testid="menu-make-call">
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Make Call
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsSendingSMS(true)} data-testid="menu-send-sms">
                  <Send className="h-4 w-4 mr-2" />
                  Send SMS
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsSendingEmail(true)} data-testid="menu-send-email">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsCreatingMessage(true)} data-testid="menu-instant-message">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Instant Message
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsAddingCommunication(true)} data-testid="menu-add-communication">
                  <FileText className="h-4 w-4 mr-2" />
                  Add Note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            /* Desktop: All Buttons */
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
          )}
        </div>
        
        {/* Communication Type Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <Button
            variant={commTypeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCommTypeFilter('all')}
            data-testid="button-filter-all"
            className="flex-shrink-0"
          >
            All ({allItems.length})
          </Button>
          <Button
            variant={commTypeFilter === 'phone_call' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCommTypeFilter('phone_call')}
            data-testid="button-filter-phone-call"
            className="flex-shrink-0"
          >
            <PhoneCall className="h-3 w-3 mr-1" />
            Calls ({allItems.filter(i => i.type === 'phone_call').length})
          </Button>
          <Button
            variant={commTypeFilter === 'sms' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCommTypeFilter('sms')}
            data-testid="button-filter-sms"
            className="flex-shrink-0"
          >
            <Send className="h-3 w-3 mr-1" />
            SMS ({allItems.filter(i => i.type === 'sms_sent' || i.type === 'sms_received').length})
          </Button>
          <Button
            variant={commTypeFilter === 'email' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCommTypeFilter('email')}
            data-testid="button-filter-email"
            className="flex-shrink-0"
          >
            <Mail className="h-3 w-3 mr-1" />
            Emails ({allItems.filter(i => i.type === 'email_sent' || i.type === 'email_received').length})
          </Button>
          <Button
            variant={commTypeFilter === 'message_thread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCommTypeFilter('message_thread')}
            data-testid="button-filter-message-thread"
            className="flex-shrink-0"
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            Messages ({allItems.filter(i => i.type === 'message_thread').length})
          </Button>
          <Button
            variant={commTypeFilter === 'note' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCommTypeFilter('note')}
            data-testid="button-filter-note"
            className="flex-shrink-0"
          >
            <FileText className="h-3 w-3 mr-1" />
            Notes ({allItems.filter(i => i.type === 'note').length})
          </Button>
          <Button
            variant={commTypeFilter === 'email_thread' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCommTypeFilter('email_thread')}
            data-testid="button-filter-email-thread"
            className="flex-shrink-0"
          >
            <Mail className="h-3 w-3 mr-1" />
            Email Threads ({allItems.filter(i => i.type === 'email_thread').length})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!allItems || allItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No communications recorded yet</p>
            <p className="text-sm">Add phone calls, notes, or messages to track client interactions</p>
          </div>
        ) : isMobile ? (
          /* Mobile Card View */
          <div className="space-y-3">
            {filteredItems.map((item: any) => {
              const handleView = () => {
                if (item.type === 'message_thread') {
                  setLocation(`/messages?thread=${item.id}`);
                } else if (item.type === 'email_thread') {
                  setSelectedEmailThreadId(item.id);
                  setEmailThreadViewerOpen(true);
                } else {
                  setSelectedCommunication(item);
                  setIsViewingCommunication(true);
                }
              };

              const handleProjectClick = item.projectId ? () => {
                setLocation(`/projects/${item.projectId}`);
              } : undefined;

              return (
                <CommunicationCard
                  key={item.id}
                  id={item.id}
                  type={item.type}
                  loggedAt={item.loggedAt}
                  createdAt={item.createdAt}
                  subject={item.subject}
                  content={item.content}
                  user={item.user}
                  createdBy={item.createdBy}
                  projectId={item.projectId}
                  projectName={projectCache[item.projectId]?.description || projectCache[item.projectId]?.client?.name}
                  messageCount={item.messageCount}
                  unreadCount={item.unreadCount}
                  attachmentCount={item.attachmentCount}
                  participants={item.participants}
                  onView={handleView}
                  onProjectClick={handleProjectClick}
                />
              );
            })}
          </div>
        ) : (
          /* Desktop Table View */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Date/Time</TableHead>
                <TableHead>Subject/Content</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Connected To</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item: any) => (
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
                      ) : item.type === 'email_thread' ? (
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {item.subject || 'No Subject'}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.messageCount || 0} message{(item.messageCount || 0) !== 1 ? 's' : ''}
                            {item.participants && item.participants.length > 0 && (
                              <span className="ml-2">• {item.participants.length} participant{item.participants.length !== 1 ? 's' : ''}</span>
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
                      <UserIcon className="w-4 w-4 text-muted-foreground" />
                      <span className="text-sm" data-testid={`text-user-${item.id}`}>
                        {item.type === 'email_thread' ? (
                          item.participants && item.participants.length > 0 
                            ? `${item.participants.length} participant${item.participants.length !== 1 ? 's' : ''}`
                            : 'Email'
                        ) : item.user ? (
                          `${item.user.firstName} ${item.user.lastName}`
                        ) : item.createdBy ? (
                          `User ${item.createdBy}`
                        ) : (
                          'System'
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`cell-connected-${item.id}`}>
                    {item.projectId ? (
                      <ProjectLink projectId={item.projectId} />
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
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
                    ) : item.type === 'email_thread' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedEmailThreadId(item.id);
                          setEmailThreadViewerOpen(true);
                        }}
                        data-testid={`button-view-email-thread-${item.id}`}
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
              <div data-testid="input-email-content-editor">
                <TiptapEditor
                  content={emailContent}
                  onChange={setEmailContent}
                  placeholder="Enter your email message..."
                  editorHeight="300px"
                />
              </div>
              <p className="text-xs text-muted-foreground">Uses the person's Primary Email address</p>
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

      {/* Email Thread Viewer Modal */}
      <EmailThreadViewer
        threadId={selectedEmailThreadId}
        open={emailThreadViewerOpen}
        onOpenChange={setEmailThreadViewerOpen}
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

export default function ClientDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
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
  const [riskView, setRiskView] = useState<'risk' | 'notifications'>('risk');
  const debugMetricsRef = useRef<any[]>([]);

  // Tab scrolling is now handled by SwipeableTabsWrapper component

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
    refetchOnMount: "always", // Always refetch to ensure fresh data after mutations
  });

  // Fetch task instances for this client
  const { data: taskInstances, isLoading: taskInstancesLoading } = useQuery<any[]>({
    queryKey: [`/api/task-instances/client/${id}`],
    enabled: !!id && !!client,
  });

  // Fetch internal tasks for this client
  const { data: clientInternalTasks, isLoading: clientInternalTasksLoading } = useQuery<any[]>({
    queryKey: [`/api/internal-tasks/client/${id}`],
    enabled: !!id,
  });

  // Fetch task template categories
  const { data: taskCategories } = useQuery<any[]>({
    queryKey: ['/api/client-request-template-categories'],
    enabled: isNewRequestDialogOpen,
  });

  // Fetch task templates for selected category
  const { data: clientRequestTemplates } = useQuery<any[]>({
    queryKey: ['/api/client-request-templates', { categoryId: selectedCategoryId }],
    enabled: isNewRequestDialogOpen && !!selectedCategoryId,
  });

  // Mutation for creating task instance
  const createTaskInstanceMutation = useMutation({
    mutationFn: async (data: { templateId: string; personId: string }) => {
      return await apiRequest("POST", "/api/task-instances", {
        templateId: data.templateId,
        customRequestId: null,
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

  // Mutation for creating custom request with task instance
  const createCustomRequestMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      // Create the custom request (without task instance)
      const customRequest = await apiRequest("POST", `/api/clients/${id}/custom-requests`, {
        clientId: id,
        name: data.name,
        description: data.description || "",
      });
      
      return customRequest;
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Custom request created. Add sections and questions to complete it.",
      });
      // Invalidate custom requests query
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${id}/custom-requests`] });
      setIsNewRequestDialogOpen(false);
      setRequestType(null);
      customRequestForm.reset();
      // Navigate to the custom request builder page
      setLocation(`/custom-requests/${data.id}/edit`);
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
  const { data: clientDocuments, isLoading: documentsLoading } = useQuery<Document[]>({
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
        <div className="page-container py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground truncate" data-testid="text-client-name">
                {client.name}
              </h1>
              <div className="flex items-center mt-2 flex-wrap gap-x-3 text-meta">
                {client.companyNumber && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    Company #{client.companyNumber}
                  </span>
                )}
                {client.dateOfCreation && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Formed {new Date(client.dateOfCreation).toLocaleDateString()}
                  </span>
                )}
              </div>
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
        <div className="page-container py-6 md:py-8">
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex flex-col section-spacing"
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={activeTab === "risk" ? "secondary" : "ghost"}
                    className="text-sm py-2 h-9 px-3 w-full"
                    data-testid="dropdown-risk-notifications"
                  >
                    <span>More...</span>
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => {
                      setActiveTab("risk");
                      setRiskView("risk");
                    }}
                    className="bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700"
                    data-testid="menu-item-risk"
                  >
                    Risk
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setActiveTab("risk");
                      setRiskView("notifications");
                    }}
                    className="bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700"
                    data-testid="menu-item-notifications"
                  >
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={activeTab === "risk" ? "secondary" : "ghost"}
                    className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0"
                    style={{ width: '80vw' }}
                    data-testid="dropdown-risk-notifications-mobile"
                  >
                    <span>More...</span>
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => {
                      setActiveTab("risk");
                      setRiskView("risk");
                    }}
                    className="bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700"
                    data-testid="menu-item-risk-mobile"
                  >
                    Risk
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setActiveTab("risk");
                      setRiskView("notifications");
                    }}
                    className="bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700"
                    data-testid="menu-item-notifications-mobile"
                  >
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TabsList>
            </div>
          </div>

          {/* Mobile Section Title - Shows current tab name */}
          {isMobile && (
            <div className="mt-4 mb-2">
              <h2 className="text-lg font-semibold text-foreground" data-testid="mobile-section-title">
                {activeTab === "overview" && "Overview"}
                {activeTab === "services" && "Services"}
                {activeTab === "projects" && "Projects"}
                {activeTab === "communications" && "Communications"}
                {activeTab === "chronology" && "History"}
                {activeTab === "documents" && "Documents"}
                {activeTab === "tasks" && "Tasks"}
                {activeTab === "risk" && (riskView === "risk" ? "Risk Assessment" : "Notifications")}
              </h2>
            </div>
          )}

          <SwipeableTabsWrapper
            tabs={["overview", "services", "projects", "communications", "chronology", "documents", "tasks", "risk"]}
            currentTab={activeTab}
            onTabChange={setActiveTab}
            enabled={isMobile}
          >
          <TabsContent value="overview" className="space-y-8 mt-6">
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

          <TabsContent value="services" className="space-y-8 mt-6">
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
                                
                                {isMobile ? (
                                  /* Mobile Card View */
                                  <div className="space-y-3">
                                    {activeClientServices.map((clientService: EnhancedClientService) => (
                                      <Card key={clientService.id} data-testid={`service-card-${clientService.id}`}>
                                        <CardContent className="p-4">
                                          <div className="space-y-3">
                                            {/* Service Name & Badges */}
                                            <div>
                                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="font-medium" data-testid={`text-service-name-${clientService.id}`}>
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
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                  {clientService.service.description}
                                                </p>
                                              )}
                                            </div>

                                            {/* Service Details Grid */}
                                            <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
                                              <div>
                                                <span className="text-muted-foreground text-xs">Frequency</span>
                                                <p className="font-medium" data-testid={`text-frequency-${clientService.id}`}>
                                                  {clientService.frequency || '-'}
                                                </p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground text-xs">Service Owner</span>
                                                <p className="font-medium" data-testid={`text-service-owner-${clientService.id}`}>
                                                  {clientService.serviceOwner 
                                                    ? `${clientService.serviceOwner.firstName} ${clientService.serviceOwner.lastName}`
                                                    : '-'}
                                                </p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground text-xs">Next Start</span>
                                                <p className="font-medium" data-testid={`text-next-start-${clientService.id}`}>
                                                  {clientService.nextStartDate 
                                                    ? formatDate(clientService.nextStartDate)
                                                    : '-'}
                                                </p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground text-xs">Next Due</span>
                                                <p className="font-medium" data-testid={`text-next-due-${clientService.id}`}>
                                                  {clientService.nextDueDate 
                                                    ? formatDate(clientService.nextDueDate)
                                                    : '-'}
                                                </p>
                                              </div>
                                            </div>

                                            {/* View Button */}
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="w-full mt-2"
                                              onClick={() => setLocation(`/client-service/${clientService.id}`)}
                                              data-testid={`button-view-service-${clientService.id}`}
                                            >
                                              <Eye className="h-4 w-4 mr-2" />
                                              View Details
                                            </Button>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                ) : (
                                  /* Desktop Table View */
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
                                )}
                              </div>
                            )}
                            
                            {/* Inactive Client Services */}
                            {inactiveClientServices.length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm text-muted-foreground mb-3">Inactive Services</h4>
                                
                                {isMobile ? (
                                  /* Mobile Card View */
                                  <div className="space-y-3 opacity-60">
                                    {inactiveClientServices.map((clientService: EnhancedClientService) => (
                                      <Card key={clientService.id} data-testid={`service-card-${clientService.id}`}>
                                        <CardContent className="p-4">
                                          <div className="space-y-3">
                                            {/* Service Name & Badges */}
                                            <div>
                                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="font-medium" data-testid={`text-service-name-${clientService.id}`}>
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
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                  {clientService.service.description}
                                                </p>
                                              )}
                                            </div>

                                            {/* Service Details Grid */}
                                            <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
                                              <div>
                                                <span className="text-muted-foreground text-xs">Frequency</span>
                                                <p className="font-medium" data-testid={`text-frequency-${clientService.id}`}>
                                                  {clientService.frequency || '-'}
                                                </p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground text-xs">Service Owner</span>
                                                <p className="font-medium" data-testid={`text-service-owner-${clientService.id}`}>
                                                  {clientService.serviceOwner 
                                                    ? `${clientService.serviceOwner.firstName} ${clientService.serviceOwner.lastName}`
                                                    : '-'}
                                                </p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground text-xs">Next Start</span>
                                                <p className="font-medium" data-testid={`text-next-start-${clientService.id}`}>
                                                  {clientService.nextStartDate 
                                                    ? formatDate(clientService.nextStartDate)
                                                    : '-'}
                                                </p>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground text-xs">Next Due</span>
                                                <p className="font-medium" data-testid={`text-next-due-${clientService.id}`}>
                                                  {clientService.nextDueDate 
                                                    ? formatDate(clientService.nextDueDate)
                                                    : '-'}
                                                </p>
                                              </div>
                                            </div>

                                            {/* View Button */}
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="w-full mt-2"
                                              onClick={() => setLocation(`/client-service/${clientService.id}`)}
                                              data-testid={`button-view-service-${clientService.id}`}
                                            >
                                              <Eye className="h-4 w-4 mr-2" />
                                              View Details
                                            </Button>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                ) : (
                                  /* Desktop Table View */
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
                                )}
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
                  projects={clientProjects?.filter(p => !p.completionStatus && !p.inactive)} 
                  isLoading={projectsLoading}
                  clientId={id}
                  isCompleted={false}
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
                  projects={clientProjects?.filter(p => p.completionStatus || p.inactive)} 
                  isLoading={projectsLoading}
                  clientId={id}
                  isCompleted={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communications" className="space-y-8 mt-6">
            <CommunicationsTimeline clientId={id} user={user} />
          </TabsContent>

          <TabsContent value="chronology" className="space-y-8 mt-6">
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

          <TabsContent value="documents" className="space-y-8 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Nested Tabs for Client Docs vs Signed Docs */}
                <Tabs defaultValue="client-docs" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="client-docs" data-testid="tab-client-docs">
                      <FileText className="w-4 h-4 mr-2" />
                      Client Docs
                    </TabsTrigger>
                    <TabsTrigger value="signed-docs" data-testid="tab-signed-docs">
                      <FileSignature className="w-4 h-4 mr-2" />
                      Signed Docs
                    </TabsTrigger>
                  </TabsList>

                  {/* Client Docs Tab - Regular documents */}
                  <TabsContent value="client-docs" className="space-y-4">
                    <DocumentFolderView 
                      clientId={id}
                      filterOutSignatureRequests={true}
                      renderActions={(currentFolderId) => (
                        <>
                          <CreateFolderDialog clientId={id} />
                          <DocumentUploadDialog clientId={id} source="direct upload" folderId={currentFolderId} />
                        </>
                      )}
                    />
                  </TabsContent>

                  {/* Signed Docs Tab - Signature request documents + E-Signatures section */}
                  <TabsContent value="signed-docs" className="space-y-6">
                    {/* Create Signature Request Button */}
                    <div className="flex justify-end">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate(`/clients/${id}/signature-requests/new`)}
                        data-testid="button-create-signature-request"
                      >
                        <PenLine className="w-4 h-4 mr-2" />
                        Create Signature Request
                      </Button>
                    </div>

                    {/* E-Signature Requests Section */}
                    <div>
                      <h3 className="text-sm font-medium mb-3 text-muted-foreground">E-Signature Requests</h3>
                      <SignatureRequestsPanel clientId={id} />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-8 mt-6">
            {/* Internal Tasks Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5" />
                    Internal Tasks
                  </CardTitle>
                  <CreateTaskDialog
                    trigger={
                      <Button
                        variant="default"
                        size="sm"
                        data-testid="button-new-internal-task"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Task
                      </Button>
                    }
                    defaultConnections={{ clientId: id }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {clientInternalTasksLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : !clientInternalTasks || clientInternalTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No internal tasks for this client yet.</p>
                  </div>
                ) : isMobile ? (
                  /* Mobile Card View */
                  <div className="space-y-3">
                    {clientInternalTasks.map((task: any) => (
                      <Card key={task.id} data-testid={`card-internal-task-${task.id}`}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {/* Task Title & Type */}
                            <div>
                              <RouterLink href={`/internal-tasks?task=${task.id}`}>
                                <a className="font-medium text-base hover:underline" data-testid={`link-task-${task.id}`}>
                                  {task.title}
                                </a>
                              </RouterLink>
                              {task.taskType?.name && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {task.taskType.name}
                                </p>
                              )}
                            </div>

                            {/* Priority & Status Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge 
                                variant={
                                  task.priority === 'urgent' ? 'destructive' :
                                  task.priority === 'high' ? 'default' :
                                  'secondary'
                                }
                                data-testid={`badge-priority-${task.id}`}
                              >
                                {task.priority}
                              </Badge>
                              <Badge 
                                variant={
                                  task.status === 'closed' ? 'outline' :
                                  task.status === 'in_progress' ? 'default' :
                                  'secondary'
                                }
                                data-testid={`badge-status-${task.id}`}
                              >
                                {task.status === 'in_progress' ? 'In Progress' : task.status}
                              </Badge>
                            </div>

                            {/* Task Details Grid */}
                            <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
                              <div>
                                <span className="text-muted-foreground text-xs">Assigned To</span>
                                <p className="font-medium">
                                  {task.assignee?.firstName} {task.assignee?.lastName}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">Due Date</span>
                                <p className="font-medium">
                                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                                </p>
                              </div>
                            </div>

                            {/* View Button */}
                            <RouterLink href={`/internal-tasks/${task.id}?from=client&clientId=${id}`}>
                              <Button
                                variant="outline"
                                className="w-full h-11 mt-2"
                                data-testid={`button-view-task-${task.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                            </RouterLink>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  /* Desktop Table View */
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientInternalTasks.map((task: any) => (
                          <TableRow key={task.id} data-testid={`row-internal-task-${task.id}`}>
                            <TableCell className="font-medium">
                              <RouterLink href={`/internal-tasks?task=${task.id}`}>
                                <a className="hover:underline" data-testid={`link-task-${task.id}`}>
                                  {task.title}
                                </a>
                              </RouterLink>
                            </TableCell>
                            <TableCell className="text-sm">{task.taskType?.name || '-'}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  task.priority === 'urgent' ? 'destructive' :
                                  task.priority === 'high' ? 'default' :
                                  'secondary'
                                }
                                data-testid={`badge-priority-${task.id}`}
                              >
                                {task.priority}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {task.assignee?.firstName} {task.assignee?.lastName}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  task.status === 'closed' ? 'outline' :
                                  task.status === 'in_progress' ? 'default' :
                                  'secondary'
                                }
                                data-testid={`badge-status-${task.id}`}
                              >
                                {task.status === 'in_progress' ? 'In Progress' : task.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <RouterLink href={`/internal-tasks/${task.id}?from=client&clientId=${id}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-view-task-${task.id}`}
                                >
                                  View
                                </Button>
                              </RouterLink>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Client Requests Section */}
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
                ) : isMobile ? (
                  /* Mobile Card View */
                  <div className="space-y-3">
                    {taskInstances.map((instance: any) => (
                      <Card key={instance.id} data-testid={`card-request-${instance.id}`}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {/* Request Name & Category */}
                            <div>
                              <h4 className="font-medium text-base" data-testid={`text-name-${instance.id}`}>
                                {instance.template?.name || instance.customRequest?.name || 'Untitled Request'}
                              </h4>
                              {instance.categoryName && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {instance.categoryName}
                                </p>
                              )}
                            </div>

                            {/* Status Badge */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge 
                                variant={
                                  instance.status === 'submitted' ? 'outline' : 
                                  instance.status === 'approved' ? 'default' : 
                                  instance.status === 'in_progress' ? 'default' :
                                  'secondary'
                                }
                                data-testid={`badge-status-${instance.id}`}
                              >
                                {instance.status === 'not_started' ? 'Not Started' :
                                 instance.status === 'in_progress' ? 'In Progress' :
                                 instance.status === 'submitted' ? 'Submitted' :
                                 instance.status === 'approved' ? 'Approved' :
                                 instance.status}
                              </Badge>
                            </div>

                            {/* Progress Bar (if in progress) */}
                            {instance.status === 'in_progress' && instance.progress && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Progress</span>
                                  <span>
                                    {instance.progress.completed}/{instance.progress.total} ({instance.progress.percentage}%)
                                  </span>
                                </div>
                                <Progress value={instance.progress.percentage} className="h-2" />
                              </div>
                            )}

                            {/* Request Details Grid */}
                            <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
                              <div>
                                <span className="text-muted-foreground text-xs">Assigned To</span>
                                <p className="font-medium" data-testid={`text-assignee-${instance.id}`}>
                                  {instance.relatedPerson ? formatPersonName(instance.relatedPerson.fullName) : '-'}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground text-xs">Created</span>
                                <p className="font-medium" data-testid={`text-created-${instance.id}`}>
                                  {formatDate(instance.createdAt)}
                                </p>
                              </div>
                              <div className="col-span-2">
                                <span className="text-muted-foreground text-xs">Due Date</span>
                                <p className="font-medium">
                                  {instance.dueDate ? formatDate(instance.dueDate) : '-'}
                                </p>
                              </div>
                            </div>

                            {/* View Button */}
                            <Button
                              variant="default"
                              className="w-full h-11 mt-2"
                              onClick={() => setLocation(`/task-instances/${instance.id}`)}
                              data-testid={`button-view-${instance.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Request
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  /* Desktop Table View */
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Request Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taskInstances.map((instance: any) => (
                          <TableRow key={instance.id} data-testid={`row-task-${instance.id}`}>
                            <TableCell className="font-medium">
                              <span data-testid={`text-name-${instance.id}`}>
                                {instance.template?.name || instance.customRequest?.name || 'Untitled Request'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{instance.categoryName || '-'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm" data-testid={`text-assignee-${instance.id}`}>
                                {instance.relatedPerson ? formatPersonName(instance.relatedPerson.fullName) : '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground" data-testid={`text-created-${instance.id}`}>
                                {formatDate(instance.createdAt)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {instance.dueDate ? formatDate(instance.dueDate) : '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  instance.status === 'submitted' ? 'outline' : 
                                  instance.status === 'approved' ? 'default' : 
                                  instance.status === 'in_progress' ? 'default' :
                                  'secondary'
                                }
                                data-testid={`badge-status-${instance.id}`}
                              >
                                {instance.status === 'not_started' ? 'Not Started' :
                                 instance.status === 'in_progress' ? 'In Progress' :
                                 instance.status === 'submitted' ? 'Submitted' :
                                 instance.status === 'approved' ? 'Approved' :
                                 instance.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {instance.status === 'in_progress' && instance.progress ? (
                                <div className="flex items-center gap-2 min-w-[120px]">
                                  <Progress value={instance.progress.percentage} className="h-2 flex-1" />
                                  <span className="text-xs text-muted-foreground">
                                    {instance.progress.completed}/{instance.progress.total} ({instance.progress.percentage}%)
                                  </span>
                                </div>
                              ) : (
                                '-'
                              )}
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
            {riskView === "risk" ? (
              <RiskAssessmentTab clientId={id!} />
            ) : (
              <ClientNotificationsView clientId={id!} />
            )}
          </TabsContent>
          </SwipeableTabsWrapper>
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
                        {(clientRequestTemplates || []).map((template) => (
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
      <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />

      {/* Mobile Search Modal */}
      <SuperSearch
        isOpen={mobileSearchOpen}
        onOpenChange={setMobileSearchOpen}
      />
    </div>
  );
}
