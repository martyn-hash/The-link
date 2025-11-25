import { useParams, Link as RouterLink, useLocation } from "wouter";
import { useState, useEffect } from "react";
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
import { insertPersonSchema, insertCommunicationSchema } from "@shared/schema";
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
import { CommunicationsTimeline } from "./components/communications";
import { 
  ChronologyTab, 
  RiskTab, 
  DocumentsTab, 
  ProjectsTab, 
  OverviewTab, 
  TasksTab,
  ServicesTab 
} from "./components/tabs";
import { NewClientRequestDialog } from "./dialogs/NewClientRequestDialog";
import { useClientData, useClientMutations } from "./hooks";

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
  
  // Track client view activity when component mounts
  useEffect(() => {
    if (id) {
      trackClientView(id);
    }
  }, [id, trackClientView]);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [riskView, setRiskView] = useState<'risk' | 'notifications'>('risk');

  // All client data queries consolidated into a single hook
  const {
    client,
    isLoading,
    error,
    relatedPeople,
    peopleLoading,
    peopleError,
    clientServices,
    servicesLoading,
    servicesError,
    refetchServices,
    peopleServices,
    peopleServicesLoading,
    peopleServicesError,
    refetchPeopleServices,
    servicesWithRoles,
    clientProjects,
    projectsLoading,
    taskInstances,
    taskInstancesLoading,
    clientInternalTasks,
    clientInternalTasksLoading,
    clientDocuments,
    documentsLoading,
  } = useClientData(id);

  // Client mutations consolidated into a single hook
  const {
    updatePersonMutation,
    createPersonMutation,
    deleteDocumentMutation,
  } = useClientMutations(id, {
    onPersonUpdated: () => setEditingPersonId(null),
    onPersonCreated: () => setIsAddPersonModalOpen(false),
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
            <OverviewTab
              client={client!}
              clientId={id!}
              relatedPeople={relatedPeople}
              peopleLoading={peopleLoading}
              peopleError={peopleError}
              onAddPerson={() => setIsAddPersonModalOpen(true)}
              companyConnections={companyConnections}
              connectionsLoading={connectionsLoading}
              onAddCompanyConnection={() => setShowCompanySelection(true)}
              onCreateCompany={() => setShowCompanyCreation(true)}
              onRemoveCompanyConnection={(companyId) => unlinkFromCompanyMutation.mutate(companyId)}
              isLinkingCompany={linkToCompanyMutation.isPending}
              isUnlinkingCompany={unlinkFromCompanyMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="services" className="space-y-8 mt-6">
            <ServicesTab
              client={client!}
              clientId={id!}
              companyConnections={companyConnections}
              clientServices={clientServices}
              companyServices={companyServicesQueries.data as EnhancedClientService[] | undefined}
              servicesLoading={servicesLoading}
              servicesError={!!servicesError}
              companyServicesLoading={companyServicesQueries.isLoading}
              companyServicesError={companyServicesQueries.isError}
              peopleServices={peopleServices}
              peopleServicesLoading={peopleServicesLoading}
              peopleServicesError={!!peopleServicesError}
              servicesWithRoles={servicesWithRoles}
              expandedPersonalServiceId={expandedPersonalServiceId}
              onExpandedPersonalServiceChange={setExpandedPersonalServiceId}
              onEditPersonalService={setEditingPersonalServiceId}
              onRefetchServices={refetchServices}
              onRefetchPeopleServices={refetchPeopleServices}
              isMobile={isMobile}
            />
          </TabsContent>

          <TabsContent value="projects" className="space-y-6 mt-6">
            <ProjectsTab 
              clientId={id!} 
              projects={clientProjects} 
              isLoading={projectsLoading} 
            />
          </TabsContent>

          <TabsContent value="communications" className="space-y-8 mt-6">
            <CommunicationsTimeline clientId={id!} user={user} />
          </TabsContent>

          <TabsContent value="chronology" className="space-y-8 mt-6">
            <ChronologyTab clientId={id!} />
          </TabsContent>

          <TabsContent value="documents" className="space-y-8 mt-6">
            <DocumentsTab 
              clientId={id!} 
              onNavigateToSignatureRequest={() => navigate(`/clients/${id}/signature-requests/new`)} 
            />
          </TabsContent>

          <TabsContent value="tasks" className="space-y-8 mt-6">
            <TasksTab 
              clientId={id!}
              internalTasks={clientInternalTasks}
              internalTasksLoading={clientInternalTasksLoading}
              taskInstances={taskInstances}
              taskInstancesLoading={taskInstancesLoading}
              isMobile={isMobile}
              onNewClientRequest={() => setIsNewRequestDialogOpen(true)}
            />
          </TabsContent>

          <TabsContent value="risk" className="space-y-6 mt-6">
            <RiskTab clientId={id!} riskView={riskView} />
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
        clientId={id!}
        isOpen={isAddPersonModalOpen}
        onClose={() => setIsAddPersonModalOpen(false)}
        onSave={(data) => {
          createPersonMutation.mutate(data);
        }}
        isSaving={createPersonMutation.isPending}
      />

      {/* New Client Request Dialog */}
      <NewClientRequestDialog
        isOpen={isNewRequestDialogOpen}
        onOpenChange={setIsNewRequestDialogOpen}
        clientId={id!}
        relatedPeople={relatedPeople}
        onSuccess={(tab) => tab && setActiveTab(tab)}
      />

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
