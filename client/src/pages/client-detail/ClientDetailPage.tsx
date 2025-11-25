import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { SwipeableTabsWrapper } from "@/components/swipeable-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TopNavigation from "@/components/top-navigation";
import { useActivityTracker } from "@/lib/activityTracker";
import type { EnhancedClientService } from "./utils/types";
import { AddPersonModal } from "./components/people";
import { EditServiceModal } from "./components/services";
import { CommunicationsTimeline } from "./components/communications";
import { CompanyCreationForm } from "./forms/CompanyCreationForm";
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
import { useClientData, useClientMutations, useCompanyConnections } from "./hooks";
import { ClientHeader } from "./components/ClientHeader";
import { ClientTabNavigation } from "./components/ClientTabNavigation";

export default function ClientDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { trackClientView } = useActivityTracker();
  
  // State for expanded/editing items in service modals
  const [expandedPersonalServiceId, setExpandedPersonalServiceId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingPersonalServiceId, setEditingPersonalServiceId] = useState<string | null>(null);
  
  // State for person editing
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [isNewRequestDialogOpen, setIsNewRequestDialogOpen] = useState(false);
  
  // State for company selection
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  
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

  // Company connections for individual clients (queries, mutations, state)
  const {
    companyConnections,
    connectionsLoading,
    companyServices: companyServicesData,
    companyServicesLoading,
    companyServicesError,
    availableCompanies,
    showCompanySelection,
    setShowCompanySelection,
    showCompanyCreation,
    setShowCompanyCreation,
    linkToCompanyMutation,
    unlinkFromCompanyMutation,
    convertToCompanyMutation,
  } = useCompanyConnections(id, client?.clientType as 'individual' | 'company' | undefined);

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
        <ClientHeader client={client} />

        {/* Main Content */}
        <div className="page-container py-6 md:py-8">
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="flex flex-col section-spacing"
          data-tab-content="true"
          data-client-tabs="main"
        >
          <ClientTabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            riskView={riskView}
            onRiskViewChange={setRiskView}
            isMobile={isMobile}
          />

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
              companyServices={companyServicesData as EnhancedClientService[] | undefined}
              servicesLoading={servicesLoading}
              servicesError={!!servicesError}
              companyServicesLoading={companyServicesLoading}
              companyServicesError={companyServicesError}
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

      {/* Company Selection Dialog */}
      <Dialog open={showCompanySelection} onOpenChange={setShowCompanySelection}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link to Company</DialogTitle>
            <DialogDescription>
              Select an existing company to connect this person to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger data-testid="select-company">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {availableCompanies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCompanySelection(false);
                  setSelectedCompanyId("");
                }}
                data-testid="button-cancel-company-selection"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedCompanyId) {
                    linkToCompanyMutation.mutate({ companyClientId: selectedCompanyId });
                    setSelectedCompanyId("");
                  }
                }}
                disabled={!selectedCompanyId || linkToCompanyMutation.isPending}
                data-testid="button-link-company"
              >
                {linkToCompanyMutation.isPending ? "Linking..." : "Link Company"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Company Creation Dialog */}
      <Dialog open={showCompanyCreation} onOpenChange={setShowCompanyCreation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
            <DialogDescription>
              Create a new company and link it to this person.
            </DialogDescription>
          </DialogHeader>
          <CompanyCreationForm
            onSubmit={(data) => convertToCompanyMutation.mutate(data)}
            onCancel={() => setShowCompanyCreation(false)}
            isSubmitting={convertToCompanyMutation.isPending}
          />
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
