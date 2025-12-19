import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { showFriendlyError } from "@/lib/friendlyErrors";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Layers, List, ShieldCheck, Bell, BookOpen, ClipboardList, LayoutDashboard } from "lucide-react";
import { ProjectTypeOverview, type ConfigSectionStatus } from "@/components/ui/project-type-overview";
import type { StageItem } from "@/components/ui/stage-pipeline";

import type { EditingStage, EditingReason, EditingStageApproval, EditingStageApprovalField } from "./utils/types";
import { SYSTEM_ROLE_OPTIONS } from "./utils/constants";
import { PageHeader } from "./components/PageHeader";
import { 
  SettingsTab, 
  KanbanStagesTab, 
  ChangeReasonsTab, 
  StageApprovalsTab, 
  NotificationsTab,
  FieldLibraryTab,
  ClientTasksTab,
} from "./components/tabs";
import { 
  useProjectTypeQueries,
  useStageMutations,
  useReasonMutations,
  useStageApprovalMutations,
  useStageReasonMapMutations,
  useProjectTypeSettingsMutations,
  useCustomFieldMutations,
  useApprovalFieldMutations,
  useNotificationMutations,
} from "./hooks";

export default function ProjectTypeDetail() {
  const { id: projectTypeId } = useParams();
  const [location, navigate] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated, isAdmin } = useAuth();
  const { toast } = useToast();

  // State for editing forms
  const [editingStage, setEditingStage] = useState<EditingStage | null>(null);
  const [editingReason, setEditingReason] = useState<EditingReason | null>(null);
  const [editingStageApproval, setEditingStageApproval] = useState<EditingStageApproval | null>(null);
  const [editingStageApprovalField, setEditingStageApprovalField] = useState<EditingStageApprovalField | null>(null);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [isAddingReason, setIsAddingReason] = useState(false);
  const [isAddingStageApproval, setIsAddingStageApproval] = useState(false);
  const [isAddingStageApprovalField, setIsAddingStageApprovalField] = useState(false);
  
  // State for stage-reason mappings
  const [selectedStageReasons, setSelectedStageReasons] = useState<string[]>([]);
  const [selectedStageApprovalId, setSelectedStageApprovalId] = useState<string | null>(null);
  
  // State for custom fields management
  const [isAddingCustomField, setIsAddingCustomField] = useState(false);
  const [isAddingApprovalField, setIsAddingApprovalField] = useState(false);
  
  // State for settings (service linkage)
  const [isEditingServiceLinkage, setIsEditingServiceLinkage] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isEditingDialora, setIsEditingDialora] = useState(false);
  
  // State for notifications
  const [isAddingProjectNotification, setIsAddingProjectNotification] = useState(false);
  const [isAddingStageNotification, setIsAddingStageNotification] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  
  // State for tab navigation with URL hash sync
  const validTabs = ["overview", "stages", "reasons", "approvals", "field-library", "notifications", "client-tasks", "settings"];
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (validTabs.includes(hash)) return hash;
    }
    return "overview";
  });
  
  // Sync tab changes to URL hash with browser history support
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const newUrl = tab === "overview" 
        ? window.location.pathname 
        : `${window.location.pathname}#${tab}`;
      window.history.pushState({ tab }, "", newUrl);
    }
  };
  
  // Set initial history state on mount so back navigation works properly
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      const currentTab = hash && validTabs.includes(hash) ? hash : "overview";
      if (!window.history.state?.tab) {
        window.history.replaceState({ tab: currentTab }, "");
      }
    }
  }, []);
  
  // Listen for browser back/forward navigation and hash changes
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.tab && validTabs.includes(event.state.tab)) {
        setActiveTab(event.state.tab);
      } else {
        setActiveTab("overview");
      }
    };
    
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      } else {
        setActiveTab("overview");
      }
    };
    
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handleHashChange);
    
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading]);

  // Fetch all project type data using consolidated hook
  const {
    projectType,
    projectTypeLoading,
    projectTypeError,
    stages,
    stagesLoading,
    reasons,
    reasonsLoading,
    stageApprovals,
    stageApprovalsLoading,
    projectTypeRoles,
    rolesLoading,
    allUsers,
    usersLoading,
    notifications,
    notificationsLoading,
    clientRequestTemplates,
    taskTemplates,
    allStageApprovalFields,
    stageApprovalFieldsLoading,
    allStageReasonMaps,
    allCustomFields,
    allServices,
    approvalFieldLibrary,
  } = useProjectTypeQueries({
    projectTypeId,
    isAuthenticated,
    authLoading,
    user,
  });

  // Use service-specific roles for service-linked project types, or users for non-service types
  const availableRoles = projectType?.serviceId
    ? (projectTypeRoles && projectTypeRoles.length > 0 
        ? projectTypeRoles.map(role => ({ value: role.id, label: role.name }))
        : SYSTEM_ROLE_OPTIONS)
    : (allUsers
        ? allUsers.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))
        : []);

  // Helper function to get role label for a stage
  const getStageRoleLabel = (stage: any) => {
    // For service-linked project types, check assignedWorkRoleId first
    if (projectType?.serviceId && stage.assignedWorkRoleId) {
      const serviceRole = availableRoles.find(r => r.value === stage.assignedWorkRoleId);
      return serviceRole ? serviceRole.label : "Unknown Service Role";
    }
    
    // For non-service project types, check assignedUserId
    if (!projectType?.serviceId && stage.assignedUserId) {
      const assignedUser = allUsers?.find(u => u.id === stage.assignedUserId);
      return assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : "Assigned User";
    }
    
    // Legacy support: check assignedRole for existing stages
    if (stage.assignedRole) {
      const role = availableRoles.find(r => r.value === stage.assignedRole);
      return role ? role.label : stage.assignedRole;
    }
    
    return "Unknown";
  };

  // Compute stage items for the overview pipeline
  const stageItems: StageItem[] = useMemo(() => {
    if (!stages) return [];
    return stages.map(stage => ({
      id: stage.id,
      name: stage.name,
      color: stage.color || "#6b7280",
      order: stage.order,
      assigneeLabel: getStageRoleLabel(stage),
      slaHours: stage.maxInstanceTime || undefined,
      totalTimeHours: stage.maxTotalTime || undefined,
      isFinal: (stage as any).canBeFinalStage || false,
      hasApproval: !!stage.stageApprovalId,
    }));
  }, [stages, availableRoles, allUsers, projectType?.serviceId]);

  // Compute configuration section statuses
  const configSections: ConfigSectionStatus[] = useMemo(() => {
    const getSettingsStatus = (): "configured" | "needs-setup" | "empty" => {
      if (!projectType) return "empty";
      const isActive = projectType.active === true;
      const hasServiceLinked = projectType.serviceId ? allServices?.some(s => s.id === projectType.serviceId) : true;
      return (isActive && hasServiceLinked) ? "configured" : "needs-setup";
    };

    // Field Library uses approvalFieldLibrary (project-type-specific)
    const fieldLibraryCount = approvalFieldLibrary?.length || 0;
    
    // Client Tasks uses clientRequestTemplates (global templates)
    const clientTasksCount = clientRequestTemplates?.length || 0;

    return [
      { 
        id: "stages", 
        label: "Workflow Stages", 
        icon: Layers, 
        count: stages?.length || 0, 
        status: (stages?.length || 0) > 0 ? "configured" : "needs-setup",
        description: "Define your project workflow" 
      },
      { 
        id: "reasons", 
        label: "Change Reasons", 
        icon: List, 
        count: reasons?.length || 0, 
        status: (reasons?.length || 0) > 0 ? "configured" : "empty",
        description: "Track why projects move" 
      },
      { 
        id: "approvals", 
        label: "Approval Gates", 
        icon: ShieldCheck, 
        count: stageApprovals?.length || 0, 
        status: (stageApprovals?.length || 0) > 0 ? "configured" : "empty",
        description: "Require sign-offs" 
      },
      { 
        id: "field-library", 
        label: "Field Library", 
        icon: BookOpen, 
        count: fieldLibraryCount, 
        status: fieldLibraryCount > 0 ? "configured" : "empty",
        description: "Custom data fields" 
      },
      { 
        id: "notifications", 
        label: "Notifications", 
        icon: Bell, 
        count: notifications?.length || 0, 
        status: (notifications?.length || 0) > 0 ? "configured" : "empty",
        description: "Automated alerts" 
      },
      { 
        id: "client-tasks", 
        label: "Client Tasks", 
        icon: ClipboardList, 
        count: clientTasksCount,
        status: clientTasksCount > 0 ? "configured" : "empty",
        description: "Client-facing forms" 
      },
      { 
        id: "settings", 
        label: "Settings", 
        icon: Settings, 
        count: 0, 
        status: getSettingsStatus(),
        description: "General configuration" 
      },
    ];
  }, [stages, reasons, stageApprovals, approvalFieldLibrary, notifications, clientRequestTemplates, projectType, allServices]);

  // Handle section click from overview
  const handleSectionClick = (sectionId: string) => {
    handleTabChange(sectionId);
  };

  // Handle unauthorized errors only - project not found is handled inline
  useEffect(() => {
    if (projectTypeError && isUnauthorizedError(projectTypeError)) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [projectTypeError]);

  // Mutation hooks with callbacks for state management
  const { createStageMutation, updateStageMutation, deleteStageMutation, reorderStagesMutation } = useStageMutations(
    projectTypeId,
    {
      onStageCreated: () => { setIsAddingStage(false); setEditingStage(null); },
      onStageUpdated: () => { setEditingStage(null); },
    }
  );

  const { createReasonMutation, updateReasonMutation, deleteReasonMutation } = useReasonMutations(
    projectTypeId,
    {
      onReasonCreated: () => { setIsAddingReason(false); setEditingReason(null); },
      onReasonUpdated: () => { setEditingReason(null); },
    }
  );

  const { createStageApprovalMutation, updateStageApprovalMutation, deleteStageApprovalMutation } = useStageApprovalMutations(
    projectTypeId,
    {
      onApprovalCreated: () => { setIsAddingStageApproval(false); setEditingStageApproval(null); },
      onApprovalUpdated: () => { setEditingStageApproval(null); },
    }
  );

  const { createStageReasonMapMutation, deleteStageReasonMapMutation } = useStageReasonMapMutations();

  const { 
    updateProjectTypeServiceLinkageMutation, 
    toggleNotificationsActiveMutation, 
    updateProjectTypeActiveMutation, 
    updateProjectTypeSingleProjectMutation,
    updateDialoraSettingsMutation,
    toggleVoiceAiMutation,
    updateDescriptionMutation,
    toggleClientProjectTasksMutation,
  } = useProjectTypeSettingsMutations(
    projectTypeId,
    {
      onServiceLinkageUpdated: () => { setIsEditingServiceLinkage(false); setSelectedServiceId(null); },
      onDialoraSettingsUpdated: () => { setIsEditingDialora(false); },
    }
  );

  const { createCustomFieldMutation, updateCustomFieldMutation, deleteCustomFieldMutation } = useCustomFieldMutations();

  const { createApprovalFieldMutation, updateApprovalFieldMutation, deleteApprovalFieldMutation } = useApprovalFieldMutations();

  const { 
    createNotificationMutation, 
    updateNotificationMutation, 
    deleteNotificationMutation, 
    rescheduleNotificationsMutation,
    createReminderMutation,
    updateReminderMutation,
    deleteReminderMutation,
  } = useNotificationMutations(
    projectTypeId,
    {
      onNotificationCreated: () => { setIsAddingProjectNotification(false); setIsAddingStageNotification(false); },
      onRescheduleComplete: () => { setShowRescheduleDialog(false); },
    }
  );

  // Handler functions that need local state/validation
  const handleActiveToggle = (checked: boolean) => {
    if (checked && stages) {
      const hasFinalStage = stages.some((stage: any) => stage.canBeFinalStage === true);
      if (!hasFinalStage) {
        showFriendlyError({ error: "At least one stage must be marked as 'Can be final Stage' before activating this project type." });
        return;
      }
    }
    updateProjectTypeActiveMutation.mutate(checked);
  };

  const handleSingleProjectToggle = (checked: boolean) => {
    updateProjectTypeSingleProjectMutation.mutate(checked);
  };

  const handleNotificationsToggle = (checked: boolean) => {
    toggleNotificationsActiveMutation.mutate(checked);
  };

  const handleVoiceAiToggle = (checked: boolean) => {
    toggleVoiceAiMutation.mutate(checked);
  };

  const handleClientProjectTasksToggle = (checked: boolean) => {
    toggleClientProjectTasksMutation.mutate(checked);
  };

  const handleDescriptionSave = (description: string) => {
    updateDescriptionMutation.mutate(description);
  };

  const handleConfigureDialora = () => {
    handleTabChange("settings");
    setTimeout(() => setIsEditingDialora(true), 100);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (projectTypeLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border bg-card">
            <div className="page-container py-6 md:py-8">
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-10 w-full max-w-md" />
              </div>
            </div>
          </div>
          <div className="flex-1 page-container py-6 md:py-8">
            <div className="space-y-8">
              <Skeleton className="h-12 w-full" />
              <div className="grid gap-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!projectType) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Settings className="w-12 h-12 text-muted-foreground mb-4 mx-auto" />
              <h3 className="text-lg font-medium text-foreground mb-2">Project type not found</h3>
              <p className="text-muted-foreground mb-4">The requested project type could not be found.</p>
              <Link href="/settings">
                <Button>Back to Project Types</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleStageSubmit = async () => {
    if (!editingStage) return;
    
    try {
      // Prepare stage data with correct assignment fields
      let stageData = { ...editingStage };
      
      // Clean up assignment fields based on project type
      if (projectType?.serviceId) {
        // Service-linked: ensure only assignedWorkRoleId is set
        stageData.assignedRole = undefined;
        stageData.assignedUserId = undefined;
        
        // Client-side validation: require service role selection
        if (!stageData.assignedWorkRoleId) {
          showFriendlyError({ error: "Please select a service role" });
          return;
        }
      } else {
        // Non-service: ensure only assignedUserId is set
        stageData.assignedRole = undefined;
        stageData.assignedWorkRoleId = undefined;
        
        // Client-side validation: require user selection
        if (!stageData.assignedUserId) {
          showFriendlyError({ error: "Please select a user" });
          return;
        }
      }

      console.log("Project type detail - submitting stage data:", stageData);
      
      // Save the stage first
      if (editingStage.id) {
        const { id: _id, ...data } = stageData;
        await updateStageMutation.mutateAsync({ id: editingStage.id, data });
      } else {
        // Strip id field for creation to avoid validation errors
        const { id, ...createData } = stageData;
        const createdStage = await createStageMutation.mutateAsync(createData);
        if (createdStage && typeof createdStage === 'object' && 'id' in createdStage) {
          editingStage.id = (createdStage as any).id;
        }
      }
      
      // Handle stage-reason mappings if editing an existing stage
      if (editingStage.id && allStageReasonMaps) {
        const existingMappings = allStageReasonMaps.filter((map: any) => map.stageId === editingStage.id);
        
        // Remove mappings that are no longer selected
        for (const mapping of existingMappings) {
          if (!selectedStageReasons.includes(mapping.reasonId)) {
            await deleteStageReasonMapMutation.mutateAsync(mapping.id);
          }
        }
        
        // Add new mappings
        for (const reasonId of selectedStageReasons) {
          const existingMapping = existingMappings.find((m: any) => m.reasonId === reasonId);
          if (!existingMapping) {
            await createStageReasonMapMutation.mutateAsync({ stageId: editingStage.id, reasonId });
          }
        }
      }
      
      // Handle stage approval mapping
      if (editingStage.id && selectedStageApprovalId !== editingStage.stageApprovalId) {
        editingStage.stageApprovalId = selectedStageApprovalId || undefined;
        await updateStageMutation.mutateAsync({ 
          id: editingStage.id, 
          data: { stageApprovalId: selectedStageApprovalId || null } 
        });
      }
      
    } catch (error) {
      console.error("Error saving stage:", error);
    }
  };

  const handleReasonSubmit = () => {
    if (!editingReason) return;
    
    if (editingReason.id) {
      updateReasonMutation.mutate(editingReason);
    } else {
      createReasonMutation.mutate(editingReason);
    }
  };

  const handleStageApprovalSubmit = () => {
    if (!editingStageApproval) return;
    
    if (editingStageApproval.id) {
      updateStageApprovalMutation.mutate(editingStageApproval);
    } else {
      createStageApprovalMutation.mutate(editingStageApproval);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <PageHeader
          projectType={projectType}
          isActiveTogglePending={updateProjectTypeActiveMutation.isPending}
          isSingleProjectTogglePending={updateProjectTypeSingleProjectMutation.isPending}
          onActiveToggle={handleActiveToggle}
          onSingleProjectToggle={handleSingleProjectToggle}
        />

        {/* Content with tabs */}
        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full">
            <div className="border-b border-border bg-card px-6">
              <TabsList className="flex flex-wrap w-full max-w-6xl gap-1">
                <TabsTrigger value="overview" className="flex items-center" data-testid="tab-overview">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="stages" className="flex items-center" data-testid="tab-stages">
                  <Layers className="w-4 h-4 mr-2" />
                  Stages
                </TabsTrigger>
                <TabsTrigger value="reasons" className="flex items-center" data-testid="tab-reasons">
                  <List className="w-4 h-4 mr-2" />
                  Reasons
                </TabsTrigger>
                <TabsTrigger value="approvals" className="flex items-center" data-testid="tab-approvals">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Approvals
                </TabsTrigger>
                <TabsTrigger value="field-library" className="flex items-center" data-testid="tab-field-library">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Field Library
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center" data-testid="tab-notifications">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="client-tasks" className="flex items-center" data-testid="tab-client-tasks">
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Client Tasks
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center" data-testid="tab-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="page-container py-6 md:py-8">
              <ProjectTypeOverview
                projectType={projectType ? {
                  id: projectType.id,
                  name: projectType.name,
                  description: projectType.description,
                  active: projectType.active !== false,
                  singleProjectPerClient: projectType.singleProjectPerClient === true,
                  notificationsActive: projectType.notificationsActive !== false,
                  enableClientProjectTasks: projectType.enableClientProjectTasks !== false,
                  useVoiceAiForQueries: projectType.useVoiceAiForQueries === true,
                  serviceId: projectType.serviceId,
                  serviceName: allServices?.find(s => s.id === projectType.serviceId)?.name,
                  dialoraConfigured: !!(projectType.dialoraSettings?.outboundWebhooks?.length),
                } : null}
                isLoading={projectTypeLoading}
                stages={stageItems}
                configSections={configSections}
                isActiveTogglePending={updateProjectTypeActiveMutation.isPending}
                isSingleProjectTogglePending={updateProjectTypeSingleProjectMutation.isPending}
                isNotificationsTogglePending={toggleNotificationsActiveMutation.isPending}
                isClientProjectTasksTogglePending={toggleClientProjectTasksMutation.isPending}
                isVoiceAiTogglePending={toggleVoiceAiMutation.isPending}
                isDescriptionSaving={updateDescriptionMutation.isPending}
                onActiveToggle={handleActiveToggle}
                onSingleProjectToggle={handleSingleProjectToggle}
                onNotificationsToggle={handleNotificationsToggle}
                onClientProjectTasksToggle={handleClientProjectTasksToggle}
                onVoiceAiToggle={handleVoiceAiToggle}
                onDescriptionSave={handleDescriptionSave}
                onConfigureDialora={handleConfigureDialora}
                onSectionClick={handleSectionClick}
              />
            </TabsContent>

            <KanbanStagesTab
              projectType={projectType}
              stages={stages}
              stagesLoading={stagesLoading}
              reasons={reasons}
              reasonsLoading={reasonsLoading}
              stageApprovals={stageApprovals}
              availableRoles={availableRoles}
              rolesLoading={rolesLoading}
              usersLoading={usersLoading}
              allStageReasonMaps={allStageReasonMaps}
              editingStage={editingStage}
              setEditingStage={setEditingStage}
              isAddingStage={isAddingStage}
              setIsAddingStage={setIsAddingStage}
              selectedStageReasons={selectedStageReasons}
              setSelectedStageReasons={setSelectedStageReasons}
              selectedStageApprovalId={selectedStageApprovalId}
              setSelectedStageApprovalId={setSelectedStageApprovalId}
              stageMutations={{ createStageMutation, updateStageMutation, deleteStageMutation, reorderStagesMutation }}
              stageReasonMapMutations={{ createStageReasonMapMutation, deleteStageReasonMapMutation }}
              onStageSubmit={handleStageSubmit}
              getStageRoleLabel={getStageRoleLabel}
            />

            <ChangeReasonsTab
              reasons={reasons}
              reasonsLoading={reasonsLoading}
              stageApprovals={stageApprovals}
              stageApprovalsLoading={stageApprovalsLoading}
              allCustomFields={allCustomFields}
              editingReason={editingReason}
              setEditingReason={setEditingReason}
              isAddingReason={isAddingReason}
              setIsAddingReason={setIsAddingReason}
              isAddingCustomField={isAddingCustomField}
              setIsAddingCustomField={setIsAddingCustomField}
              reasonMutations={{ createReasonMutation, updateReasonMutation, deleteReasonMutation }}
              customFieldMutations={{ createCustomFieldMutation, updateCustomFieldMutation, deleteCustomFieldMutation }}
              onReasonSubmit={handleReasonSubmit}
            />

            <StageApprovalsTab
              projectTypeId={projectTypeId!}
              projectType={projectType}
              stages={stages}
            />

            <FieldLibraryTab projectTypeId={projectTypeId!} />

            <ClientTasksTab
              projectTypeId={projectTypeId!}
              stages={stages}
              reasons={reasons}
              enableClientProjectTasks={projectType?.enableClientProjectTasks !== false}
            />
            
            <NotificationsTab
              projectType={projectType}
              projectTypeId={projectTypeId}
              notifications={notifications}
              stages={stages}
              clientRequestTemplates={clientRequestTemplates}
              taskTemplates={taskTemplates}
              isAdmin={isAdmin === true}
              isAddingProjectNotification={isAddingProjectNotification}
              setIsAddingProjectNotification={setIsAddingProjectNotification}
              isAddingStageNotification={isAddingStageNotification}
              setIsAddingStageNotification={setIsAddingStageNotification}
              showRescheduleDialog={showRescheduleDialog}
              setShowRescheduleDialog={setShowRescheduleDialog}
              notificationMutations={{ 
                createNotificationMutation, 
                updateNotificationMutation,
                deleteNotificationMutation, 
                rescheduleNotificationsMutation,
                createReminderMutation,
                updateReminderMutation,
                deleteReminderMutation,
                toggleNotificationsActiveMutation, 
              }}
            />


            {/* Settings Tab */}
            <SettingsTab
              projectType={projectType}
              allServices={allServices}
              isEditingServiceLinkage={isEditingServiceLinkage}
              setIsEditingServiceLinkage={setIsEditingServiceLinkage}
              selectedServiceId={selectedServiceId}
              setSelectedServiceId={setSelectedServiceId}
              updateProjectTypeServiceLinkageMutation={updateProjectTypeServiceLinkageMutation}
              updateDialoraSettingsMutation={updateDialoraSettingsMutation}
              toggleVoiceAiMutation={toggleVoiceAiMutation}
              isEditingDialora={isEditingDialora}
              setIsEditingDialora={setIsEditingDialora}
            />
          </Tabs>
        </div>
      </div>
    </div>
  );
}