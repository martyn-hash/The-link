import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { showFriendlyError } from "@/lib/friendlyErrors";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Layers, List, ShieldCheck, Bell } from "lucide-react";

import type { EditingStage, EditingReason, EditingStageApproval, EditingStageApprovalField } from "./utils/types";
import { SYSTEM_ROLE_OPTIONS } from "./utils/constants";
import { PageHeader } from "./components/PageHeader";
import { 
  SettingsTab, 
  KanbanStagesTab, 
  ChangeReasonsTab, 
  StageApprovalsTab, 
  NotificationsTab 
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
    allStageApprovalFields,
    stageApprovalFieldsLoading,
    allStageReasonMaps,
    allCustomFields,
    allServices,
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
  const { createStageMutation, updateStageMutation, deleteStageMutation } = useStageMutations(
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
        await updateStageMutation.mutateAsync(stageData);
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
        const updateData = { ...editingStage, stageApprovalId: selectedStageApprovalId || undefined };
        await updateStageMutation.mutateAsync(updateData);
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
          <Tabs defaultValue="stages" className="h-full">
            <div className="border-b border-border bg-card px-6">
              <TabsList className="grid w-full max-w-3xl grid-cols-5">
                <TabsTrigger value="stages" className="flex items-center" data-testid="tab-stages">
                  <Layers className="w-4 h-4 mr-2" />
                  Kanban Stages
                </TabsTrigger>
                <TabsTrigger value="reasons" className="flex items-center" data-testid="tab-reasons">
                  <List className="w-4 h-4 mr-2" />
                  Change Reasons
                </TabsTrigger>
                <TabsTrigger value="approvals" className="flex items-center" data-testid="tab-approvals">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Stage Approvals
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center" data-testid="tab-notifications">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center" data-testid="tab-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

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
              stageMutations={{ createStageMutation, updateStageMutation, deleteStageMutation }}
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
              stageApprovals={stageApprovals}
              stageApprovalsLoading={stageApprovalsLoading}
              allStageApprovalFields={allStageApprovalFields}
              editingStageApproval={editingStageApproval}
              setEditingStageApproval={setEditingStageApproval}
              isAddingStageApproval={isAddingStageApproval}
              setIsAddingStageApproval={setIsAddingStageApproval}
              editingStageApprovalField={editingStageApprovalField}
              setEditingStageApprovalField={setEditingStageApprovalField}
              isAddingApprovalField={isAddingApprovalField}
              setIsAddingApprovalField={setIsAddingApprovalField}
              stageApprovalMutations={{ createStageApprovalMutation, updateStageApprovalMutation, deleteStageApprovalMutation }}
              approvalFieldMutations={{ createApprovalFieldMutation, updateApprovalFieldMutation, deleteApprovalFieldMutation }}
              onStageApprovalSubmit={handleStageApprovalSubmit}
            />
            
            <NotificationsTab
              projectType={projectType}
              projectTypeId={projectTypeId}
              notifications={notifications}
              stages={stages}
              clientRequestTemplates={clientRequestTemplates}
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