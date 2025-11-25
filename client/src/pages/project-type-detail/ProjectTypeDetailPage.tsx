import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { TiptapEditor } from '@/components/TiptapEditor';
import DOMPurify from 'dompurify';
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { 
  ProjectType,
  KanbanStage, 
  ChangeReason, 
  StageApproval,
  StageApprovalField,
  WorkRole,
  Service,
  User,
  ProjectTypeNotification,
  InsertProjectTypeNotification,
  UpdateProjectTypeNotification,
  ClientRequestReminder,
  InsertClientRequestReminder,
  UpdateClientRequestReminder,
  ClientRequestTemplate,
  PreviewCandidatesResponse
} from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Edit2, Trash2, Save, X, ArrowLeft, Settings, Layers, List, ShieldCheck, Bell, Calendar, Workflow, RefreshCcw, Loader2, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { NotificationVariableGuide } from "@/components/NotificationVariableGuide";
import { NotificationPreviewDialog } from "@/components/NotificationPreviewDialog";
import { ClientPersonSelectionModal } from "@/components/ClientPersonSelectionModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import type { EditingStage, EditingReason, EditingStageApproval, EditingStageApprovalField } from "./utils/types";
import { 
  DEFAULT_STAGE, 
  DEFAULT_REASON, 
  DEFAULT_STAGE_APPROVAL, 
  DEFAULT_STAGE_APPROVAL_FIELD,
  SYSTEM_ROLE_OPTIONS,
  STAGE_COLORS 
} from "./utils/constants";
import { CharacterCounter } from "./utils/helpers";
import { 
  ProjectNotificationForm, 
  StageNotificationForm, 
  NotificationRow, 
  ReminderForm 
} from "./components/notifications";
import { CustomFieldForm, ApprovalFieldForm } from "./components/fields";
import { SettingsTab } from "./components/tabs";
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
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [isAddingCustomField, setIsAddingCustomField] = useState(false);
  const [isAddingApprovalField, setIsAddingApprovalField] = useState(false);
  
  // State for settings (service linkage)
  const [isEditingServiceLinkage, setIsEditingServiceLinkage] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  
  // State for notifications
  const [isAddingProjectNotification, setIsAddingProjectNotification] = useState(false);
  const [isAddingStageNotification, setIsAddingStageNotification] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [editingNotification, setEditingNotification] = useState<ProjectTypeNotification | null>(null);
  const [addingReminderForNotification, setAddingReminderForNotification] = useState<string | null>(null);
  const [editingReminder, setEditingReminder] = useState<ClientRequestReminder | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

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
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [projectTypeError, toast]);

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
    updateProjectTypeSingleProjectMutation 
  } = useProjectTypeSettingsMutations(
    projectTypeId,
    {
      onServiceLinkageUpdated: () => { setIsEditingServiceLinkage(false); setSelectedServiceId(null); },
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
      onNotificationCreated: () => { setIsAddingProjectNotification(false); setIsAddingStageNotification(false); setEditingNotification(null); },
      onNotificationUpdated: () => { setEditingNotification(null); },
      onRescheduleComplete: () => { setShowRescheduleDialog(false); },
      onReminderCreated: () => { setAddingReminderForNotification(null); },
      onReminderUpdated: () => { setEditingReminder(null); },
    }
  );

  // Handler functions that need local state/validation
  const handleActiveToggle = (checked: boolean) => {
    if (checked && stages) {
      const hasFinalStage = stages.some((stage: any) => stage.canBeFinalStage === true);
      if (!hasFinalStage) {
        toast({
          title: "Cannot Activate Project Type",
          description: "At least one stage must be marked as 'Can be final Stage' before activating this project type.",
          variant: "destructive",
        });
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
          toast({
            title: "Validation Error",
            description: "Please select a service role",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Non-service: ensure only assignedUserId is set
        stageData.assignedRole = undefined;
        stageData.assignedWorkRoleId = undefined;
        
        // Client-side validation: require user selection
        if (!stageData.assignedUserId) {
          toast({
            title: "Validation Error",
            description: "Please select a user",
            variant: "destructive",
          });
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
        {/* Header with breadcrumbs */}
        <div className="border-b border-border bg-card">
          <div className="page-container py-6 md:py-8">
            {/* Breadcrumb */}
            <Breadcrumb className="mb-4">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/settings" data-testid="breadcrumb-settings">
                      Settings
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-project-type">
                    {projectType.name}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-4">
                  <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground flex items-center" data-testid="text-project-type-name">
                    <Settings className="w-6 h-6 mr-3 text-primary" />
                    {projectType.name}
                  </h1>
                  <div className="flex items-center space-x-6">
                    {/* Active/Inactive Toggle */}
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="active-toggle"
                        checked={projectType.active !== false}
                        onCheckedChange={handleActiveToggle}
                        disabled={updateProjectTypeActiveMutation.isPending}
                        data-testid="switch-active-project-type"
                      />
                      <Label 
                        htmlFor="active-toggle" 
                        className="text-sm font-medium cursor-pointer"
                        data-testid="label-active-project-type"
                      >
                        {projectType.active !== false ? "Active" : "Inactive"}
                      </Label>
                    </div>
                    
                    {/* Single Project Per Client Toggle */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center space-x-2" data-testid="tooltip-trigger-single-project">
                            <Switch
                              id="single-project-toggle"
                              checked={projectType.singleProjectPerClient === true}
                              onCheckedChange={handleSingleProjectToggle}
                              disabled={updateProjectTypeSingleProjectMutation.isPending}
                              data-testid="switch-single-project-per-client"
                            />
                            <Label 
                              htmlFor="single-project-toggle" 
                              className="text-sm font-medium cursor-pointer"
                              data-testid="label-single-project-per-client"
                            >
                              Single Project Per Client
                            </Label>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent data-testid="tooltip-content-single-project">
                          <p className="max-w-xs">
                            When enabled, scheduling a new project will automatically archive any active projects of this type for the same client as unsuccessfully completed.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                {projectType.description && (
                  <p className="text-muted-foreground mt-1" data-testid="text-project-type-description">
                    {projectType.description}
                  </p>
                )}
              </div>
              <Link href="/settings">
                <Button variant="outline" data-testid="button-back-to-project-types">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Project Types
                </Button>
              </Link>
            </div>
          </div>
        </div>

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

            {/* Kanban Stages Tab */}
            <TabsContent value="stages" className="page-container py-6 md:py-8 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Kanban Stages</h2>
                  <p className="text-muted-foreground">Configure the workflow stages for this project type</p>
                </div>
                <Button 
                  onClick={() => {
                    setEditingStage({ ...DEFAULT_STAGE, order: (stages?.length || 0) });
                    setIsAddingStage(true);
                    setSelectedStageReasons([]);
                    setSelectedStageApprovalId(null);
                  }}
                  data-testid="button-add-stage"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stage
                </Button>
              </div>

              {stagesLoading ? (
                <div className="grid gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : stages && stages.length > 0 ? (
                <div className="grid gap-4">
                  {stages.map((stage) => (
                    <Card key={stage.id} data-testid={`card-stage-${stage.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: stage.color || '#6b7280' }}
                          />
                          <CardTitle className="text-base" data-testid={`text-stage-name-${stage.id}`}>
                            {stage.name}
                          </CardTitle>
                          <Badge variant="secondary" data-testid={`badge-stage-role-${stage.id}`}>
                            {getStageRoleLabel(stage)}
                          </Badge>
                          {(stage as any).canBeFinalStage && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700" data-testid={`badge-final-stage-${stage.id}`}>
                              Final Stage
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingStage({
                                id: stage.id,
                                name: stage.name,
                                assignedRole: stage.assignedRole || undefined,
                                assignedWorkRoleId: (stage as any).assignedWorkRoleId || undefined,
                                assignedUserId: (stage as any).assignedUserId || undefined,
                                order: stage.order,
                                color: stage.color || "#6b7280",
                                maxInstanceTime: stage.maxInstanceTime || undefined,
                                maxTotalTime: stage.maxTotalTime || undefined,
                                canBeFinalStage: (stage as any).canBeFinalStage || false
                              });
                              
                              // Load existing mappings for this stage
                              if (allStageReasonMaps) {
                                const stageMappings = allStageReasonMaps.filter((map: any) => map.stageId === stage.id);
                                setSelectedStageReasons(stageMappings.map((m: any) => m.reasonId));
                              }
                              
                              // Set stage approval
                              setSelectedStageApprovalId(stage.stageApprovalId || null);
                            }}
                            data-testid={`button-edit-stage-${stage.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteStageMutation.mutate(stage.id)}
                            data-testid={`button-delete-stage-${stage.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>Order: {stage.order}</span>
                          {stage.maxInstanceTime && <span>Max time: {stage.maxInstanceTime}h</span>}
                          {stage.maxTotalTime && <span>Total time: {stage.maxTotalTime}h</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Layers className="w-12 h-12 text-muted-foreground mb-4 mx-auto" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No stages configured</h3>
                  <p className="text-muted-foreground mb-4">Add your first kanban stage to start configuring the workflow.</p>
                  <Button 
                    onClick={() => {
                      setEditingStage({ ...DEFAULT_STAGE, order: 0 });
                      setIsAddingStage(true);
                      setSelectedStageReasons([]);
                      setSelectedStageApprovalId(null);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Stage
                  </Button>
                </div>
              )}

              {/* Stage Editing Form */}
              {(editingStage || isAddingStage) && (
                <Card>
                  <CardHeader>
                    <CardTitle>{editingStage?.id ? "Edit Stage" : "Add New Stage"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stage-name">Stage Name</Label>
                        <Input
                          id="stage-name"
                          value={editingStage?.name || ""}
                          onChange={(e) => setEditingStage(prev => ({ ...prev!, name: e.target.value }))}
                          placeholder="Enter stage name"
                          data-testid="input-stage-name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="stage-role">
                          {projectType?.serviceId ? "Assigned Service Role" : "Assigned User"}
                        </Label>
                        <Select
                          value={projectType?.serviceId 
                            ? (editingStage?.assignedWorkRoleId || "") 
                            : (editingStage?.assignedUserId || "")
                          }
                          onValueChange={(value) => {
                            if (projectType?.serviceId) {
                              setEditingStage(prev => ({ 
                                ...prev!, 
                                assignedWorkRoleId: value,
                                assignedUserId: undefined,
                                assignedRole: undefined
                              }));
                            } else {
                              setEditingStage(prev => ({ 
                                ...prev!, 
                                assignedUserId: value,
                                assignedWorkRoleId: undefined,
                                assignedRole: undefined
                              }));
                            }
                          }}
                          disabled={rolesLoading || usersLoading}
                        >
                          <SelectTrigger data-testid="select-stage-role">
                            <SelectValue placeholder={rolesLoading ? "Loading..." : 
                              projectType?.serviceId ? "Select service role" : "Select user"} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map(role => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {projectType?.serviceId && (
                          <p className="text-xs text-muted-foreground">
                            Using service-specific roles
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stage-order">Order</Label>
                        <Input
                          id="stage-order"
                          type="number"
                          value={editingStage?.order || 0}
                          onChange={(e) => setEditingStage(prev => ({ ...prev!, order: parseInt(e.target.value) || 0 }))}
                          data-testid="input-stage-order"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stage-color">Color</Label>
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            {STAGE_COLORS.map(color => (
                              <button
                                key={color}
                                type="button"
                                className={`w-6 h-6 rounded-full border-2 ${editingStage?.color === color ? 'border-foreground' : 'border-transparent'}`}
                                style={{ backgroundColor: color }}
                                onClick={() => setEditingStage(prev => ({ ...prev!, color }))}
                                data-testid={`button-stage-color-${color.replace('#', '')}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stage-max-instance">Max Instance Time (hours)</Label>
                        <Input
                          id="stage-max-instance"
                          type="number"
                          value={editingStage?.maxInstanceTime || ""}
                          onChange={(e) => setEditingStage(prev => ({ 
                            ...prev!, 
                            maxInstanceTime: e.target.value ? parseInt(e.target.value) : undefined 
                          }))}
                          placeholder="Optional"
                          data-testid="input-stage-max-instance-time"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stage-max-total">Max Total Time (hours)</Label>
                        <Input
                          id="stage-max-total"
                          type="number"
                          value={editingStage?.maxTotalTime || ""}
                          onChange={(e) => setEditingStage(prev => ({ 
                            ...prev!, 
                            maxTotalTime: e.target.value ? parseInt(e.target.value) : undefined 
                          }))}
                          placeholder="Optional"
                          data-testid="input-stage-max-total-time"
                        />
                      </div>
                    </div>

                    {/* Stage Approval Selection */}
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="stage-approval">Stage Approval (Optional)</Label>
                      <Select
                        value={selectedStageApprovalId || "none"}
                        onValueChange={(value) => setSelectedStageApprovalId(value === "none" ? null : value)}
                      >
                        <SelectTrigger data-testid="select-stage-approval">
                          <SelectValue placeholder="Select stage approval" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No approval required</SelectItem>
                          {stageApprovals?.map(approval => (
                            <SelectItem key={approval.id} value={approval.id}>
                              {approval.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Can be final Stage */}
                    <div className="space-y-2 col-span-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="can-be-final-stage"
                          checked={editingStage?.canBeFinalStage || false}
                          onCheckedChange={(checked) => {
                            setEditingStage(prev => ({ 
                              ...prev!, 
                              canBeFinalStage: checked === true 
                            }));
                          }}
                          data-testid="checkbox-can-be-final-stage"
                        />
                        <Label htmlFor="can-be-final-stage" className="text-sm font-normal">
                          Can be final Stage
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Allow projects to be marked as complete when in this stage
                      </p>
                    </div>

                    {/* Change Reasons Selection */}
                    <div className="space-y-2 col-span-2">
                      <Label>Change Reasons for this Stage</Label>
                      <p className="text-sm text-muted-foreground">
                        Select which change reasons can be used when transitioning from this stage
                      </p>
                      <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                        {reasonsLoading ? (
                          <p className="text-sm text-muted-foreground">Loading change reasons...</p>
                        ) : reasons && reasons.length > 0 ? (
                          <div className="space-y-2">
                            {reasons.map(reason => (
                              <div key={reason.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`reason-${reason.id}`}
                                  checked={selectedStageReasons.includes(reason.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedStageReasons(prev => [...prev, reason.id]);
                                    } else {
                                      setSelectedStageReasons(prev => prev.filter(id => id !== reason.id));
                                    }
                                  }}
                                  data-testid={`checkbox-stage-reason-${reason.id}`}
                                />
                                <Label htmlFor={`reason-${reason.id}`} className="text-sm flex-1">
                                  {reason.reason}
                                  {reason.description && (
                                    <span className="text-muted-foreground ml-1">
                                      - {reason.description}
                                    </span>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No change reasons configured. Add change reasons first.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingStage(null);
                          setIsAddingStage(false);
                          setSelectedStageReasons([]);
                          setSelectedStageApprovalId(null);
                        }}
                        data-testid="button-cancel-stage"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleStageSubmit}
                        disabled={!editingStage?.name || createStageMutation.isPending || updateStageMutation.isPending}
                        data-testid="button-save-stage"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {editingStage?.id ? "Update" : "Create"} Stage
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Change Reasons Tab */}
            <TabsContent value="reasons" className="page-container py-6 md:py-8 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Change Reasons</h2>
                  <p className="text-muted-foreground">Configure reasons for status changes in this project type</p>
                </div>
                <Button 
                  onClick={() => {
                    setEditingReason(DEFAULT_REASON);
                    setIsAddingReason(true);
                  }}
                  data-testid="button-add-reason"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Reason
                </Button>
              </div>

              {reasonsLoading ? (
                <div className="grid gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : reasons && reasons.length > 0 ? (
                <div className="grid gap-4">
                  {reasons.map((reason) => (
                    <Card key={reason.id} data-testid={`card-reason-${reason.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base" data-testid={`text-reason-name-${reason.id}`}>
                              {reason.reason}
                            </CardTitle>
                            {reason.stageApprovalId && (
                              <Badge variant="secondary" className="text-xs">
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                Has Approval
                              </Badge>
                            )}
                          </div>
                          {reason.description && (
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-reason-description-${reason.id}`}>
                              {reason.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingReason({
                              ...reason,
                              description: reason.description || "",
                              showCountInProject: reason.showCountInProject || false,
                              countLabel: reason.countLabel || "",
                              stageApprovalId: reason.stageApprovalId || undefined
                            })}
                            data-testid={`button-edit-reason-${reason.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteReasonMutation.mutate(reason.id)}
                            data-testid={`button-delete-reason-${reason.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      {reason.showCountInProject && reason.countLabel && (
                        <CardContent>
                          <Badge variant="secondary" data-testid={`badge-reason-count-${reason.id}`}>
                            Count: {reason.countLabel}
                          </Badge>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <List className="w-12 h-12 text-muted-foreground mb-4 mx-auto" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No change reasons configured</h3>
                  <p className="text-muted-foreground mb-4">Add change reasons to track why projects move between stages.</p>
                  <Button 
                    onClick={() => {
                      setEditingReason(DEFAULT_REASON);
                      setIsAddingReason(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Reason
                  </Button>
                </div>
              )}

              {/* Reason Editing Form */}
              {(editingReason || isAddingReason) && (
                <Card>
                  <CardHeader>
                    <CardTitle>{editingReason?.id ? "Edit Change Reason" : "Add New Change Reason"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reason-name">Reason</Label>
                        <Input
                          id="reason-name"
                          value={editingReason?.reason || ""}
                          onChange={(e) => setEditingReason(prev => ({ ...prev!, reason: e.target.value }))}
                          placeholder="Enter reason name"
                          data-testid="input-reason-name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="reason-description">Description</Label>
                        <Textarea
                          id="reason-description"
                          value={editingReason?.description || ""}
                          onChange={(e) => setEditingReason(prev => ({ ...prev!, description: e.target.value }))}
                          placeholder="Optional description"
                          data-testid="textarea-reason-description"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="reason-show-count"
                          checked={editingReason?.showCountInProject || false}
                          onCheckedChange={(checked) => setEditingReason(prev => ({ 
                            ...prev!, 
                            showCountInProject: !!checked 
                          }))}
                          data-testid="checkbox-reason-show-count"
                        />
                        <Label htmlFor="reason-show-count">Show count in project</Label>
                      </div>

                      {editingReason?.showCountInProject && (
                        <div className="space-y-2">
                          <Label htmlFor="reason-count-label">Count Label</Label>
                          <Input
                            id="reason-count-label"
                            value={editingReason?.countLabel || ""}
                            onChange={(e) => setEditingReason(prev => ({ ...prev!, countLabel: e.target.value }))}
                            placeholder="Enter count label"
                            data-testid="input-reason-count-label"
                          />
                        </div>
                      )}

                      {/* Stage Approval Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="reason-stage-approval">Stage Approval (Optional)</Label>
                        <p className="text-sm text-muted-foreground">
                          Assign a specific approval questionnaire to this reason. If set, this takes precedence over the stage's approval.
                        </p>
                        <Select
                          value={editingReason?.stageApprovalId || "none"}
                          onValueChange={(value) => setEditingReason(prev => ({ 
                            ...prev!, 
                            stageApprovalId: value === "none" ? undefined : value 
                          }))}
                        >
                          <SelectTrigger data-testid="select-reason-stage-approval">
                            <SelectValue placeholder="No approval" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No approval</SelectItem>
                            {stageApprovalsLoading ? (
                              <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : stageApprovals && stageApprovals.length > 0 ? (
                              stageApprovals.map(approval => (
                                <SelectItem key={approval.id} value={approval.id}>
                                  {approval.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-approvals" disabled>No approvals configured</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {editingReason?.stageApprovalId && (
                          <Badge variant="secondary" className="mt-2">
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            This reason has its own approval (overrides stage-level approval)
                          </Badge>
                        )}
                      </div>

                      {/* Custom Fields Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Custom Fields</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAddingCustomField(true)}
                            data-testid="button-add-custom-field"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Custom Field
                          </Button>
                        </div>
                        
                        <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                          {editingReason?.id && allCustomFields ? (
                            allCustomFields.filter(field => field.reasonId === editingReason.id).length > 0 ? (
                              <div className="space-y-2">
                                {allCustomFields
                                  .filter(field => field.reasonId === editingReason.id)
                                  .sort((a, b) => a.order - b.order)
                                  .map((field, index) => (
                                    <div key={field.id} className="flex items-center justify-between p-2 border rounded">
                                      <div className="flex-1">
                                        <div className="text-sm font-medium">{field.fieldName}</div>
                                        <div className="text-xs text-muted-foreground">
                                          Type: {field.fieldType} {field.isRequired && "(Required)"}
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteCustomFieldMutation.mutate(field.id)}
                                        data-testid={`button-delete-custom-field-${field.id}`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No custom fields configured for this reason
                              </p>
                            )
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Save the reason first to add custom fields
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Add Custom Field Form */}
                      {isAddingCustomField && editingReason?.id && (
                        <Card className="mt-4">
                          <CardHeader>
                            <CardTitle className="text-base">Add Custom Field</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <CustomFieldForm 
                              reasonId={editingReason.id}
                              onSuccess={() => setIsAddingCustomField(false)}
                              onCancel={() => setIsAddingCustomField(false)}
                              createMutation={createCustomFieldMutation}
                              existingFields={allCustomFields?.filter(f => f.reasonId === editingReason.id) || []}
                            />
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <div className="flex justify-end space-x-2 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingReason(null);
                          setIsAddingReason(false);
                        }}
                        data-testid="button-cancel-reason"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleReasonSubmit}
                        disabled={!editingReason?.reason || createReasonMutation.isPending || updateReasonMutation.isPending}
                        data-testid="button-save-reason"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {editingReason?.id ? "Update" : "Create"} Reason
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Stage Approvals Tab */}
            <TabsContent value="approvals" className="page-container py-6 md:py-8 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Stage Approvals</h2>
                  <p className="text-muted-foreground">Configure approval processes for stages in this project type</p>
                </div>
                <Button 
                  onClick={() => {
                    setEditingStageApproval(DEFAULT_STAGE_APPROVAL);
                    setIsAddingStageApproval(true);
                  }}
                  data-testid="button-add-stage-approval"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Approval
                </Button>
              </div>

              {stageApprovalsLoading ? (
                <div className="grid gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : stageApprovals && stageApprovals.length > 0 ? (
                <div className="grid gap-4">
                  {stageApprovals.map((approval) => (
                    <Card key={approval.id} data-testid={`card-approval-${approval.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                          <CardTitle className="text-base flex items-center" data-testid={`text-approval-name-${approval.id}`}>
                            <ShieldCheck className="w-4 h-4 mr-2 text-primary" />
                            {approval.name}
                          </CardTitle>
                          {approval.description && (
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-approval-description-${approval.id}`}>
                              {approval.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingStageApproval({
                              ...approval,
                              description: approval.description || ""
                            })}
                            data-testid={`button-edit-approval-${approval.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteStageApprovalMutation.mutate(approval.id)}
                            data-testid={`button-delete-approval-${approval.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">
                          {allStageApprovalFields?.filter(f => f.stageApprovalId === approval.id).length || 0} fields configured
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ShieldCheck className="w-12 h-12 text-muted-foreground mb-4 mx-auto" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No stage approvals configured</h3>
                  <p className="text-muted-foreground mb-4">Add approval processes to validate stage transitions.</p>
                  <Button 
                    onClick={() => {
                      setEditingStageApproval(DEFAULT_STAGE_APPROVAL);
                      setIsAddingStageApproval(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Approval
                  </Button>
                </div>
              )}

              {/* Stage Approval Editing Form */}
              {(editingStageApproval || isAddingStageApproval) && (
                <Card>
                  <CardHeader>
                    <CardTitle>{editingStageApproval?.id ? "Edit Stage Approval" : "Add New Stage Approval"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="approval-name">Approval Name</Label>
                        <Input
                          id="approval-name"
                          value={editingStageApproval?.name || ""}
                          onChange={(e) => setEditingStageApproval(prev => ({ ...prev!, name: e.target.value }))}
                          placeholder="Enter approval name"
                          data-testid="input-approval-name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="approval-description">Description</Label>
                        <Textarea
                          id="approval-description"
                          value={editingStageApproval?.description || ""}
                          onChange={(e) => setEditingStageApproval(prev => ({ ...prev!, description: e.target.value }))}
                          placeholder="Optional description"
                          data-testid="textarea-approval-description"
                        />
                      </div>

                      {/* Stage Approval Fields Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Approval Fields</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsAddingApprovalField(true);
                              setEditingStageApprovalField(null);
                            }}
                            data-testid="button-add-approval-field"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Approval Field
                          </Button>
                        </div>
                        
                        <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                          {editingStageApproval?.id && allStageApprovalFields ? (
                            allStageApprovalFields?.filter(field => field.stageApprovalId === editingStageApproval.id).length > 0 ? (
                              <div className="space-y-2">
                                {allStageApprovalFields
                                  ?.filter(field => field.stageApprovalId === editingStageApproval.id)
                                  .sort((a, b) => a.order - b.order)
                                  .map((field, index) => (
                                    <div key={field.id} className="flex items-center justify-between p-2 border rounded">
                                      <div className="flex-1">
                                        <div className="text-sm font-medium">{field.fieldName}</div>
                                        <div className="text-xs text-muted-foreground">
                                          Type: {field.fieldType} {field.isRequired && "(Required)"}
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEditingStageApprovalField({
                                              ...field,
                                              isRequired: field.isRequired ?? false,
                                            });
                                            setIsAddingApprovalField(false);
                                          }}
                                          data-testid={`button-edit-approval-field-${field.id}`}
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteApprovalFieldMutation.mutate(field.id)}
                                          data-testid={`button-delete-approval-field-${field.id}`}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No approval fields configured for this stage approval
                              </p>
                            )
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Save the stage approval first to add approval fields
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Add/Edit Approval Field Form */}
                      {(isAddingApprovalField || editingStageApprovalField) && editingStageApproval?.id && (
                        <Card className="mt-4">
                          <CardHeader>
                            <CardTitle className="text-base">
                              {editingStageApprovalField ? "Edit Approval Field" : "Add Approval Field"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ApprovalFieldForm 
                              key={editingStageApprovalField?.id || 'new'}
                              stageApprovalId={editingStageApproval.id}
                              onSuccess={() => {
                                setIsAddingApprovalField(false);
                                setEditingStageApprovalField(null);
                              }}
                              onCancel={() => {
                                setIsAddingApprovalField(false);
                                setEditingStageApprovalField(null);
                              }}
                              createMutation={createApprovalFieldMutation}
                              updateMutation={updateApprovalFieldMutation}
                              existingFields={allStageApprovalFields?.filter(f => f.stageApprovalId === editingStageApproval.id) || []}
                              editingField={editingStageApprovalField}
                            />
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <div className="flex justify-end space-x-2 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingStageApproval(null);
                          setIsAddingStageApproval(false);
                        }}
                        data-testid="button-cancel-approval"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleStageApprovalSubmit}
                        disabled={!editingStageApproval?.name || createStageApprovalMutation.isPending || updateStageApprovalMutation.isPending}
                        data-testid="button-save-approval"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {editingStageApproval?.id ? "Update" : "Create"} Approval
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            {/* Notifications Tab */}
            <TabsContent value="notifications" className="p-6 space-y-8">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Notification Management</h2>
                <p className="text-muted-foreground">
                  Configure automated client notifications for this project type
                </p>
              </div>
              
              {/* Notifications Master Toggle */}
              <Card className={projectType?.notificationsActive === false ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Bell className="h-5 w-5" />
                        <h3 className="font-semibold">Automated Notifications</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {projectType?.notificationsActive === false 
                          ? "⚠️ All notifications are currently disabled for this project type. No emails, SMS, or push notifications will be sent to clients."
                          : "When enabled, clients will automatically receive configured notifications via email, SMS, and push notifications."}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {projectType?.notificationsActive === false ? "Disabled" : "Enabled"}
                      </span>
                      <Switch
                        checked={projectType?.notificationsActive !== false}
                        onCheckedChange={(checked) => toggleNotificationsActiveMutation.mutate(checked)}
                        disabled={toggleNotificationsActiveMutation.isPending}
                        data-testid="switch-notifications-active"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Section 1: Project Notifications (Date-based) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center">
                      <Calendar className="w-5 h-5 mr-2" />
                      Project Notifications
                    </h3>
                    <p className="text-sm text-muted-foreground">Date-based notifications triggered relative to project start or due dates</p>
                  </div>
                  <Button
                    onClick={() => setIsAddingProjectNotification(true)}
                    data-testid="button-add-project-notification"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Project Notification
                  </Button>
                </div>

                {isAddingProjectNotification && (
                  <ProjectNotificationForm
                    onCancel={() => setIsAddingProjectNotification(false)}
                    createMutation={createNotificationMutation}
                    clientRequestTemplates={clientRequestTemplates || []}
                  />
                )}

                {notifications?.some(n => n.category === 'project') ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Trigger</TableHead>
                          <TableHead>Content</TableHead>
                          <TableHead>Template</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notifications.filter(n => n.category === 'project').map(notification => (
                          <NotificationRow
                            key={notification.id}
                            notification={notification}
                            projectTypeId={projectTypeId}
                            stages={stages || []}
                            clientRequestTemplates={clientRequestTemplates || []}
                            onDelete={(id) => deleteNotificationMutation.mutate(id)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : !isAddingProjectNotification && (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      No project notifications configured yet
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Section 2: Stage Notifications */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center">
                      <Workflow className="w-5 h-5 mr-2" />
                      Stage Notifications
                    </h3>
                    <p className="text-sm text-muted-foreground">Workflow stage trigger notifications sent when projects enter or exit stages</p>
                  </div>
                  <div className="flex gap-2">
                    {isAdmin && (
                      <AlertDialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid="button-reschedule-notifications"
                            disabled={rescheduleNotificationsMutation.isPending}
                          >
                            {rescheduleNotificationsMutation.isPending ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Rescheduling…
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <RefreshCcw className="h-4 w-4" />
                                Reschedule Notifications
                              </span>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reschedule all notifications?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will re-run scheduling for every existing service tied to this project type. Services with up-to-date schedules will be skipped automatically.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-reschedule-cancel">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              data-testid="button-reschedule-confirm"
                              disabled={rescheduleNotificationsMutation.isPending}
                              onClick={() => rescheduleNotificationsMutation.mutate()}
                            >
                              Confirm
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <Button
                      onClick={() => setIsAddingStageNotification(true)}
                      disabled={!stages || stages.length === 0}
                      data-testid="button-add-stage-notification"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Stage Notification
                    </Button>
                  </div>
                </div>

                {isAddingStageNotification && (
                  <StageNotificationForm
                    onCancel={() => setIsAddingStageNotification(false)}
                    createMutation={createNotificationMutation}
                    stages={stages || []}
                    clientRequestTemplates={clientRequestTemplates || []}
                  />
                )}

                {notifications?.some(n => n.category === 'stage') ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Trigger</TableHead>
                          <TableHead>Content</TableHead>
                          <TableHead>Template</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notifications.filter(n => n.category === 'stage').map(notification => (
                          <NotificationRow
                            key={notification.id}
                            notification={notification}
                            projectTypeId={projectTypeId}
                            stages={stages || []}
                            clientRequestTemplates={clientRequestTemplates || []}
                            onDelete={(id) => deleteNotificationMutation.mutate(id)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : !isAddingStageNotification && (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      No stage notifications configured yet
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>


            {/* Settings Tab */}
            <SettingsTab
              projectType={projectType}
              allServices={allServices}
              isEditingServiceLinkage={isEditingServiceLinkage}
              setIsEditingServiceLinkage={setIsEditingServiceLinkage}
              selectedServiceId={selectedServiceId}
              setSelectedServiceId={setSelectedServiceId}
              updateProjectTypeServiceLinkageMutation={updateProjectTypeServiceLinkageMutation}
            />
          </Tabs>
        </div>
      </div>
    </div>
  );
}