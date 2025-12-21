import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm, useFieldArray, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { apiRequest } from "@/lib/queryClient";
import { type Service, type WorkRole, type UDFDefinition, baseInsertServiceSchema, insertWorkRoleSchema, serviceClientTypeValues, type ServiceClientType } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Settings, Edit, Trash2, Users, Briefcase, ArrowLeft, X, Copy, Check, Library, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { nanoid } from "nanoid";
import { SystemFieldLibraryPicker } from "@/components/system-field-library-picker";
import type { SystemFieldLibrary } from "@shared/schema";
import { ServiceWizard } from "@/components/service-wizard/ServiceWizard";
import type { ServiceWizardFormData } from "@/components/service-wizard/types";

// Form schemas
const createServiceFormSchema = baseInsertServiceSchema.extend({
  roleIds: z.array(z.string()).default([]),
}).superRefine((data, ctx) => {
  // Conditional validation: CH fields required when CH is enabled
  if (data.isCompaniesHouseConnected) {
    if (!data.chStartDateField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date field is required when Companies House connection is enabled",
        path: ["chStartDateField"],
      });
    }
    if (!data.chDueDateField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Due date field is required when Companies House connection is enabled",
        path: ["chDueDateField"],
      });
    }
  }
});

const createWorkRoleFormSchema = insertWorkRoleSchema;

type CreateServiceFormData = z.infer<typeof createServiceFormSchema>;
type CreateWorkRoleFormData = z.infer<typeof createWorkRoleFormSchema>;

interface ServiceWithDetails extends Service {
  roles: WorkRole[];
  projectType?: { name: string; id: string; description?: string; active: boolean; };
}

interface WorkRoleWithUsage extends WorkRole {
  serviceCount: number;
}

// View mode types
type ViewMode = 'list' | 'create-service' | 'edit-service' | 'create-role' | 'edit-role';
type TabMode = 'services' | 'roles';

// UDF Editor Component
interface UDFEditorProps {
  control: any;
  name: string;
}

const ALLOWED_UDF_SYSTEM_FIELD_TYPES = ["boolean", "number", "short_text", "long_text", "date", "single_select", "multi_select", "email", "phone", "url", "currency", "percentage", "file_upload", "image_upload", "user_select"];

type UDFType = "short_text" | "number" | "date" | "boolean" | "dropdown";

const mapSystemFieldTypeToUDFType = (fieldType: string): UDFType => {
  const typeMap: Record<string, UDFType> = {
    boolean: "boolean",
    number: "number",
    short_text: "short_text",
    long_text: "short_text",
    date: "date",
    single_select: "dropdown",
    multi_select: "dropdown",
    email: "short_text",
    phone: "short_text",
    url: "short_text",
    currency: "number",
    percentage: "number",
    file_upload: "short_text",
    image_upload: "short_text",
    user_select: "dropdown",
  };
  return typeMap[fieldType] || "short_text";
};

function UDFEditor({ control, name }: UDFEditorProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [systemLibraryPickerOpen, setSystemLibraryPickerOpen] = useState(false);
  const { toast } = useToast();

  const addUDF = () => {
    append({
      id: nanoid(),
      name: "",
      type: "short_text" as const,
      required: false,
      placeholder: "",
      options: [],
      regex: "",
      regexError: "",
    });
  };

  const handleAddFromLibrary = (systemField: SystemFieldLibrary) => {
    const mappedType = mapSystemFieldTypeToUDFType(systemField.fieldType);
    append({
      id: nanoid(),
      name: systemField.fieldName,
      type: mappedType,
      required: systemField.isRequired || false,
      placeholder: "",
      options: systemField.options || [],
      regex: "",
      regexError: "",
    });
    setSystemLibraryPickerOpen(false);
  };

  const copyFieldId = async (fieldId: string) => {
    try {
      await navigator.clipboard.writeText(fieldId);
      setCopiedId(fieldId);
      toast({
        title: "Field ID copied",
        description: `Use "${fieldId}" in your Excel import file`,
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      showFriendlyError({ error: "Please manually copy the field ID" });
    }
  };

  const udfTypes = [
    { value: "short_text", label: "Short Text" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "boolean", label: "Yes/No" },
    { value: "dropdown", label: "Dropdown List" },
  ];

  const { watch } = useFormContext();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">User Defined Fields</h4>
          <p className="text-sm text-muted-foreground">
            Define custom fields that will be available when creating clients for this service
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSystemLibraryPickerOpen(true)}
            className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
            data-testid="button-pick-udf-from-library"
          >
            <Library className="w-4 h-4 mr-2" />
            Pick from Library
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addUDF}
            data-testid="button-add-udf"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Field
          </Button>
        </div>
      </div>

      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const fieldType = watch(`${name}.${index}.type`);
            const showOptions = fieldType === "dropdown";
            const showRegex = fieldType === "short_text" || fieldType === "number";
            
            return (
              <Card key={field.id} className="p-5" data-testid={`card-udf-${index}`}>
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Field ID:</span>
                      <code className="bg-muted px-2 py-1 rounded text-xs font-mono" data-testid={`text-udf-id-${index}`}>
                        {field.id}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => copyFieldId(field.id)}
                        data-testid={`button-copy-udf-id-${index}`}
                      >
                        {copiedId === field.id ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => remove(index)}
                      data-testid={`button-remove-udf-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <FormField
                      control={control}
                      name={`${name}.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Field Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., VAT Number"
                              data-testid={`input-udf-name-${index}`}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`${name}.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Field Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} data-testid={`select-udf-type-${index}`}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {udfTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`${name}.${index}.placeholder`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Placeholder</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Enter VAT number..."
                              data-testid={`input-udf-placeholder-${index}`}
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`${name}.${index}.required`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-7">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid={`checkbox-udf-required-${index}`}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Required</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {showOptions && (
                    <FormField
                      control={control}
                      name={`${name}.${index}.options`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dropdown Options</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter options separated by commas (e.g., Option A, Option B, Option C)"
                              data-testid={`input-udf-options-${index}`}
                              value={Array.isArray(field.value) ? field.value.join(", ") : (field.value || "")}
                              onChange={(e) => {
                                field.onChange(e.target.value);
                              }}
                              onBlur={(e) => {
                                const options = e.target.value.split(",").map(o => o.trim()).filter(o => o);
                                field.onChange(options);
                              }}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Separate each option with a comma</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {showRegex && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <FormField
                        control={control}
                        name={`${name}.${index}.regex`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Validation Pattern (Regex)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., ^GB[0-9]{9}$ for VAT numbers"
                                data-testid={`input-udf-regex-${index}`}
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Optional: Enter a regex pattern to validate input</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={control}
                        name={`${name}.${index}.regexError`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Validation Error Message</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Please enter a valid UK VAT number"
                                data-testid={`input-udf-regex-error-${index}`}
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Error message shown when validation fails</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {fields.length === 0 && (
        <Card className="p-6" data-testid="card-no-udfs">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No custom fields defined</p>
            <p className="text-xs mt-1">Click "Add Field" to create custom fields for this service</p>
          </div>
        </Card>
      )}

      <SystemFieldLibraryPicker
        open={systemLibraryPickerOpen}
        onOpenChange={setSystemLibraryPickerOpen}
        onSelectField={handleAddFromLibrary}
        allowedFieldTypes={ALLOWED_UDF_SYSTEM_FIELD_TYPES}
        title="Pick from System Field Library"
        description="Select a pre-defined field from your company's reusable field library"
      />
    </div>
  );
}

export default function Services() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Compute admin status for consistent typing
  const isAdmin = Boolean(user?.isAdmin);

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

  // Redirect non-admin users
  useEffect(() => {
    if (user && !user.isAdmin) {
      showFriendlyError({ error: "You don't have permission to access this page." });
      setLocation('/');
      return;
    }
  }, [user, setLocation]);
  const queryClient = useQueryClient();
  
  // View state management
  const [currentTab, setCurrentTab] = useState<TabMode>('services');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  
  // Edit states
  const [editingService, setEditingService] = useState<ServiceWithDetails | null>(null);
  const [editingRole, setEditingRole] = useState<WorkRoleWithUsage | null>(null);
  
  // Priority indicator targets (for multi-select)
  const [priorityIndicatorTargets, setPriorityIndicatorTargets] = useState<string[]>([]);
  
  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardMode, setWizardMode] = useState<"create" | "edit">("create");
  const [wizardEditingService, setWizardEditingService] = useState<ServiceWithDetails | null>(null);
  
  // Search state
  const [serviceSearchTerm, setServiceSearchTerm] = useState("");

  // Forms
  const serviceForm = useForm<CreateServiceFormData>({
    resolver: zodResolver(createServiceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      roleIds: [],
      udfDefinitions: [],
      isCompaniesHouseConnected: false,
      chStartDateField: "",
      chDueDateField: "",
      chTargetDeliveryDaysOffset: null,
      isVatService: false,
      applicableClientTypes: "company",
    },
  });

  const roleForm = useForm<CreateWorkRoleFormData>({
    resolver: zodResolver(createWorkRoleFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Data fetching
  const { data: services, isLoading: servicesLoading, error: servicesError } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services", { active: showActiveOnly }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (showActiveOnly) {
        params.append('active', 'true');
      }
      const response = await fetch(`/api/services?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      return response.json();
    },
    enabled: isAuthenticated && isAdmin,
    retry: false,
  });

  const { data: basicWorkRoles, isLoading: rolesLoading, error: rolesError } = useQuery<WorkRole[]>({
    queryKey: ["/api/work-roles"],
    enabled: isAuthenticated && isAdmin,
    retry: false,
  });

  // Compute work roles with service count
  const workRoles: WorkRoleWithUsage[] = basicWorkRoles?.map(role => {
    const serviceCount = services?.filter(service => 
      service.roles.some(serviceRole => serviceRole.id === role.id)
    ).length || 0;
    return {
      ...role,
      serviceCount
    };
  }) || [];

  // Project types no longer needed for service creation

  const { data: allWorkRoles } = useQuery<WorkRole[]>({
    queryKey: ["/api/work-roles"],
    enabled: isAuthenticated && isAdmin,
    retry: false,
  });


  // Mutations
  const createServiceMutation = useMutation({
    mutationFn: async (data: CreateServiceFormData) => {
      const { roleIds, ...serviceData } = data;
      const service = await apiRequest("POST", "/api/services", serviceData) as Service;
      
      // Add roles to service
      if (roleIds.length > 0) {
        await Promise.all(
          roleIds.map(roleId =>
            apiRequest("POST", `/api/services/${service.id}/roles`, { roleId })
          )
        );
      }
      
      // Save priority indicator targets if any selected
      if (priorityIndicatorTargets.length > 0) {
        await apiRequest("PUT", `/api/services/${service.id}/priority-indicator-targets`, { 
          targetServiceIds: priorityIndicatorTargets 
        });
      }
      
      return service;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Service created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      setViewMode('list');
      serviceForm.reset();
      setPriorityIndicatorTargets([]);
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: CreateServiceFormData & { id: string }) => {
      const { roleIds, id, ...serviceData } = data;
      
      // Filter out any null, undefined, or empty roleIds
      const validRoleIds = roleIds.filter(roleId => roleId && roleId.trim() !== "");
      
      // Update service
      const service = await apiRequest("PATCH", `/api/services/${id}`, serviceData) as Service;
      
      // Get current roles
      const currentRoles = await apiRequest("GET", `/api/services/${id}/roles`) as WorkRole[];
      const currentRoleIds = currentRoles.map(role => role.id);
      
      // Remove roles not in new list
      const rolesToRemove = currentRoleIds.filter(roleId => !validRoleIds.includes(roleId));
      await Promise.all(
        rolesToRemove.map(roleId =>
          apiRequest("DELETE", `/api/services/${id}/roles/${roleId}`)
        )
      );
      
      // Add new roles
      const rolesToAdd = validRoleIds.filter(roleId => !currentRoleIds.includes(roleId));
      await Promise.all(
        rolesToAdd.map(roleId =>
          apiRequest("POST", `/api/services/${id}/roles`, { roleId })
        )
      );
      
      // Save priority indicator targets
      await apiRequest("PUT", `/api/services/${id}/priority-indicator-targets`, { 
        targetServiceIds: priorityIndicatorTargets 
      });
      
      return service;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Service updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      setViewMode('list');
      setEditingService(null);
      serviceForm.reset();
      setPriorityIndicatorTargets([]);
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      return await apiRequest("DELETE", `/api/services/${serviceId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Service deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      setDeleteServiceId(null);
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: CreateWorkRoleFormData) => {
      return await apiRequest("POST", "/api/work-roles", data) as WorkRole;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Work role created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles", "all"] });
      setViewMode('list');
      roleForm.reset();
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: CreateWorkRoleFormData & { id: string }) => {
      const { id, ...roleData } = data;
      return await apiRequest("PATCH", `/api/work-roles/${id}`, roleData) as WorkRole;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Work role updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles", "all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setViewMode('list');
      setEditingRole(null);
      roleForm.reset();
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      return await apiRequest("DELETE", `/api/work-roles/${roleId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Work role deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles", "all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setDeleteRoleId(null);
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  // Mutation to save priority indicator targets
  const savePriorityIndicatorTargetsMutation = useMutation({
    mutationFn: async ({ serviceId, targetServiceIds }: { serviceId: string; targetServiceIds: string[] }) => {
      return await apiRequest("PUT", `/api/services/${serviceId}/priority-indicator-targets`, { targetServiceIds });
    },
  });

  // Helper to normalize UDF options (handles string vs array)
  const normalizeUdfOptions = (data: CreateServiceFormData): CreateServiceFormData => {
    if (!data.udfDefinitions) return data;
    return {
      ...data,
      udfDefinitions: data.udfDefinitions.map(udf => ({
        ...udf,
        options: typeof udf.options === 'string' 
          ? udf.options.split(',').map(o => o.trim()).filter(o => o)
          : (udf.options || [])
      }))
    };
  };

  // Event handlers
  const handleCreateService = (data: CreateServiceFormData) => {
    createServiceMutation.mutate(normalizeUdfOptions(data));
  };

  const handleUpdateService = (data: CreateServiceFormData) => {
    if (!editingService) return;
    updateServiceMutation.mutate({ ...normalizeUdfOptions(data), id: editingService.id });
  };

  const handleEditService = async (service: ServiceWithDetails) => {
    setEditingService(service);
    serviceForm.reset({
      name: service.name,
      description: service.description ?? "",
      roleIds: service.roles.map(role => role.id),
      udfDefinitions: Array.isArray(service.udfDefinitions) ? service.udfDefinitions : [],
      isCompaniesHouseConnected: service.isCompaniesHouseConnected ?? false,
      chStartDateField: service.chStartDateField ?? "",
      chDueDateField: service.chDueDateField ?? "",
      chTargetDeliveryDaysOffset: (service as any).chTargetDeliveryDaysOffset ?? null,
      isPersonalService: service.isPersonalService ?? false,
      isStaticService: service.isStaticService ?? false,
      isVatService: (service as any).isVatService ?? false,
      applicableClientTypes: (service as any).applicableClientTypes ?? "company",
      showInProjectServiceId: (service as any).showInProjectServiceId ?? null,
    });
    
    // Fetch existing priority indicator targets
    try {
      const response = await fetch(`/api/services/${service.id}/priority-indicator-targets`);
      if (response.ok) {
        const data = await response.json();
        setPriorityIndicatorTargets(data.targetServiceIds || []);
      } else {
        setPriorityIndicatorTargets([]);
      }
    } catch (error) {
      setPriorityIndicatorTargets([]);
    }
    
    setViewMode('edit-service');
  };

  const handleCreateRole = (data: CreateWorkRoleFormData) => {
    createRoleMutation.mutate(data);
  };

  const handleUpdateRole = (data: CreateWorkRoleFormData) => {
    if (!editingRole) return;
    updateRoleMutation.mutate({ ...data, id: editingRole.id });
  };

  // Navigation helpers
  const handleStartCreateService = () => {
    setWizardMode("create");
    setWizardEditingService(null);
    setShowWizard(true);
  };

  const handleStartCreateRole = () => {
    roleForm.reset();
    setViewMode('create-role');
  };

  const handleCancelForm = () => {
    serviceForm.reset();
    roleForm.reset();
    setEditingService(null);
    setEditingRole(null);
    setPriorityIndicatorTargets([]);
    setViewMode('list');
  };

  const handleEditRole = (role: WorkRoleWithUsage) => {
    setEditingRole(role);
    roleForm.reset({
      name: role.name,
      description: role.description ?? "",
    });
    setViewMode('edit-role');
  };
  
  // Wizard handlers
  const handleOpenWizardForEdit = (service: ServiceWithDetails) => {
    setWizardMode("edit");
    setWizardEditingService(service);
    setShowWizard(true);
  };
  
  const handleWizardCancel = () => {
    setShowWizard(false);
    setWizardEditingService(null);
  };
  
  const handleWizardSave = async (data: ServiceWizardFormData) => {
    try {
      if (wizardMode === "create") {
        const { roleIds, priorityIndicatorTargets: targets, ...serviceData } = data;
        const service = await apiRequest("POST", "/api/services", serviceData) as Service;
        
        if (roleIds.length > 0) {
          await Promise.all(
            roleIds.map(roleId =>
              apiRequest("POST", `/api/services/${service.id}/roles`, { roleId })
            )
          );
        }
        
        if (targets.length > 0) {
          await apiRequest("PUT", `/api/services/${service.id}/priority-indicator-targets`, { 
            targetServiceIds: targets 
          });
        }
        
        toast({ title: "Success", description: "Service created successfully" });
      } else {
        const { roleIds, priorityIndicatorTargets: targets, id, ...serviceData } = data;
        
        const validRoleIds = roleIds.filter(roleId => roleId && roleId.trim() !== "");
        const validTargets = targets.filter(target => target && target.trim() !== "");
        
        await apiRequest("PATCH", `/api/services/${id}`, serviceData);
        
        const currentRoles = await apiRequest("GET", `/api/services/${id}/roles`) as WorkRole[];
        const currentRoleIds = currentRoles.map(role => role.id);
        
        const rolesToRemove = currentRoleIds.filter(roleId => !validRoleIds.includes(roleId));
        await Promise.all(
          rolesToRemove.map(roleId =>
            apiRequest("DELETE", `/api/services/${id}/roles/${roleId}`)
          )
        );
        
        const rolesToAdd = validRoleIds.filter(roleId => !currentRoleIds.includes(roleId));
        await Promise.all(
          rolesToAdd.map(roleId =>
            apiRequest("POST", `/api/services/${id}/roles`, { roleId })
          )
        );
        
        await apiRequest("PUT", `/api/services/${id}/priority-indicator-targets`, { 
          targetServiceIds: validTargets 
        });
        
        toast({ title: "Success", description: "Service updated successfully" });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-roles"] });
      setShowWizard(false);
      setWizardEditingService(null);
    } catch (error: any) {
      showFriendlyError({ error });
    }
  };

  // Auth and error handling
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    const error = servicesError || rolesError;
    if (error && isUnauthorizedError(error)) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [servicesError, rolesError]);

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

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="page-container py-6 md:py-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">Services & Roles</h1>
                <p className="text-meta mt-1">Manage services and work roles for your organization</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content with tabs */}
        <div className="flex-1 overflow-auto">
          <Tabs value={currentTab} onValueChange={(value) => { setCurrentTab(value as TabMode); setViewMode('list'); }} className="h-full">
            <div className="border-b border-border bg-card px-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="services" className="flex items-center" data-testid="tab-services">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Services
                </TabsTrigger>
                <TabsTrigger value="roles" className="flex items-center" data-testid="tab-roles">
                  <Users className="w-4 h-4 mr-2" />
                  Work Roles
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-8">
              <div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
              {/* Services List View */}
              {currentTab === 'services' && viewMode === 'list' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold">Services</h2>
                      <p className="text-muted-foreground">Manage services and their associated project types and roles</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="active-filter"
                          checked={showActiveOnly}
                          onCheckedChange={setShowActiveOnly}
                          data-testid="switch-active-filter"
                        />
                        <label htmlFor="active-filter" className="text-sm font-medium">
                          Show active only
                        </label>
                      </div>
                      <Button onClick={handleStartCreateService} data-testid="button-add-service">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Service
                      </Button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative max-w-sm mb-6">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Search services..."
                      value={serviceSearchTerm}
                      onChange={(e) => setServiceSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-services"
                    />
                  </div>

                  {/* Services Table */}
                  <div className="border rounded-lg">
                    {servicesLoading ? (
                      <div className="p-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex items-center space-x-4 mb-4">
                            <Skeleton className="h-12 w-12 rounded" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-4 w-[250px]" />
                              <Skeleton className="h-4 w-[200px]" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Project Type</TableHead>
                            <TableHead>Mapped Roles</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {services?.filter((service) => {
                            if (!serviceSearchTerm) return true;
                            const searchLower = serviceSearchTerm.toLowerCase();
                            return (
                              service.name.toLowerCase().includes(searchLower) ||
                              (service.description && service.description.toLowerCase().includes(searchLower)) ||
                              service.roles.some(role => role?.name?.toLowerCase().includes(searchLower)) ||
                              (service.projectType?.name && service.projectType.name.toLowerCase().includes(searchLower))
                            );
                          }).map((service) => (
                            <TableRow key={service.id} data-testid={`row-service-${service.id}`}>
                              <TableCell className="font-medium">{service.name}</TableCell>
                              <TableCell>{service.description || "—"}</TableCell>
                              <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                  <Badge 
                                    variant="default" 
                                    className="bg-green-500 text-white"
                                    data-testid={`status-${service.id}`}
                                  >
                                    Active
                                  </Badge>
                                  {service.isCompaniesHouseConnected && (
                                    <Badge 
                                      variant="secondary" 
                                      className="bg-blue-500 text-white"
                                      data-testid={`ch-status-${service.id}`}
                                    >
                                      CH
                                    </Badge>
                                  )}
                                  {(service as any).applicableClientTypes === "individual" && (
                                    <Badge 
                                      variant="secondary" 
                                      className="bg-purple-500 text-white"
                                      data-testid={`client-type-${service.id}`}
                                    >
                                      Individual Only
                                    </Badge>
                                  )}
                                  {(service as any).applicableClientTypes === "both" && (
                                    <Badge 
                                      variant="secondary" 
                                      className="bg-indigo-500 text-white"
                                      data-testid={`client-type-${service.id}`}
                                    >
                                      Company & Individual
                                    </Badge>
                                  )}
                                  {service.isStaticService && (
                                    <Badge 
                                      variant="secondary" 
                                      className="bg-gray-500 text-white"
                                      data-testid={`static-status-${service.id}`}
                                    >
                                      Static
                                    </Badge>
                                  )}
                                  {(service as any).isVatService && (
                                    <Badge 
                                      variant="secondary" 
                                      className="bg-emerald-500 text-white"
                                      data-testid={`vat-status-${service.id}`}
                                    >
                                      VAT
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell data-testid={`project-type-${service.id}`}>
                                {service.projectType?.name || "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {service.roles.filter(role => role && role.id && role.name).map((role) => (
                                    <Badge key={role.id} variant="outline" className="text-xs">
                                      {role.name}
                                    </Badge>
                                  ))}
                                  {service.roles.filter(role => role && role.id && role.name).length === 0 && <span className="text-muted-foreground">No roles</span>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleOpenWizardForEdit(service)}
                                    data-testid={`button-edit-service-${service.id}`}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setDeleteServiceId(service.id)}
                                    data-testid={`button-delete-service-${service.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {services?.filter((service) => {
                            if (!serviceSearchTerm) return true;
                            const searchLower = serviceSearchTerm.toLowerCase();
                            return (
                              service.name.toLowerCase().includes(searchLower) ||
                              (service.description && service.description.toLowerCase().includes(searchLower)) ||
                              service.roles.some(role => role?.name?.toLowerCase().includes(searchLower)) ||
                              (service.projectType?.name && service.projectType.name.toLowerCase().includes(searchLower))
                            );
                          }).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                {serviceSearchTerm ? "No services match your search." : "No services found. Create your first service to get started."}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </>
              )}

              {/* Create Service Form View */}
              {currentTab === 'services' && viewMode === 'create-service' && (
                <>
                  <div className="flex items-center space-x-4 mb-6">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCancelForm}
                      data-testid="button-back-to-services"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold">Create New Service</h2>
                      <p className="text-muted-foreground">Add a new service with associated project type and roles</p>
                    </div>
                  </div>
                  <Card className="max-w-4xl">
                    <CardHeader>
                      <CardTitle>Service Details</CardTitle>
                      <CardDescription>Enter the information for your new service</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...serviceForm}>
                        <form onSubmit={serviceForm.handleSubmit(handleCreateService)} className="space-y-6">
                          <FormField
                            control={serviceForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., Monthly Bookkeeping Service"
                                    data-testid="input-service-name"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={serviceForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Describe this service..."
                                    data-testid="textarea-service-description"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Applicable Client Types Section */}
                          <FormField
                            control={serviceForm.control}
                            name="applicableClientTypes"
                            render={({ field }) => (
                              <FormItem className="rounded-lg border p-4 shadow-sm">
                                <div className="space-y-3">
                                  <div>
                                    <FormLabel>Applicable Client Types</FormLabel>
                                    <div className="text-sm text-muted-foreground">
                                      Choose which client types this service applies to
                                    </div>
                                  </div>
                                  <FormControl>
                                    <Select onValueChange={field.onChange} value={field.value || "company"} data-testid="select-client-types">
                                      <SelectTrigger className="w-full md:w-[300px]">
                                        <SelectValue placeholder="Select client types" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="company">Company Only</SelectItem>
                                        <SelectItem value="individual">Individual Only</SelectItem>
                                        <SelectItem value="both">Both Company & Individual</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />

                          {/* Static Service Section */}
                          <FormField
                            control={serviceForm.control}
                            name="isStaticService"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                                <div className="space-y-1">
                                  <FormLabel htmlFor="static-service-switch-create">Static Service</FormLabel>
                                  <div className="text-sm text-muted-foreground">
                                    Mark this service as static (display only, cannot be mapped to project types)
                                  </div>
                                </div>
                                <FormControl>
                                  <Switch
                                    id="static-service-switch-create"
                                    checked={field.value || false}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-static-service"
                                    aria-describedby="static-service-description"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          {/* Companies House Connection Section */}
                          <div className="border rounded-lg p-5 space-y-5 bg-muted/50">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-medium">Companies House Integration</h3>
                            </div>
                            
                            <FormField
                              control={serviceForm.control}
                              name="isCompaniesHouseConnected"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background">
                                  <div className="space-y-1">
                                    <FormLabel htmlFor="ch-connection-switch">Enable Companies House Connection</FormLabel>
                                    <div className="text-sm text-muted-foreground">
                                      Auto-populate dates from client Companies House data (accounts and confirmation statement deadlines)
                                    </div>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      id="ch-connection-switch"
                                      checked={field.value || false}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-ch-connection"
                                      aria-describedby="ch-connection-description"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {serviceForm.watch("isCompaniesHouseConnected") && (
                              <div className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  <FormField
                                    control={serviceForm.control}
                                    name="chStartDateField"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Start Date Field</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""} data-testid="select-ch-start-field">
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select CH field" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="nextAccountsPeriodEnd">Next Accounts Period End</SelectItem>
                                            <SelectItem value="confirmationStatementNextMadeUpTo">Confirmation Statement Next Made Up To</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={serviceForm.control}
                                    name="chDueDateField"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Due Date Field</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""} data-testid="select-ch-due-field">
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select CH field" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="nextAccountsDue">Next Accounts Due</SelectItem>
                                            <SelectItem value="confirmationStatementNextDue">Confirmation Statement Next Due</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                
                                <FormField
                                  control={serviceForm.control}
                                  name="chTargetDeliveryDaysOffset"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Target Delivery Days Before Deadline</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min="0"
                                          placeholder="e.g. 14"
                                          value={field.value ?? ""}
                                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                          data-testid="input-ch-target-delivery-offset"
                                        />
                                      </FormControl>
                                      <div className="text-sm text-muted-foreground">
                                        Number of days before the CH deadline to set as internal target delivery date. Leave empty for no target.
                                      </div>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </div>

                          {/* VAT Service Section */}
                          <div className="border rounded-lg p-5 space-y-5 bg-muted/50">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-medium">HMRC VAT Integration</h3>
                            </div>
                            
                            <FormField
                              control={serviceForm.control}
                              name="isVatService"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background">
                                  <div className="space-y-1">
                                    <FormLabel htmlFor="vat-service-switch-create">Enable VAT Service</FormLabel>
                                    <div className="text-sm text-muted-foreground">
                                      Auto-creates a VAT Number field with format validation and optional HMRC verification
                                    </div>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      id="vat-service-switch-create"
                                      checked={field.value || false}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-vat-service"
                                      aria-describedby="vat-service-description"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {serviceForm.watch("isVatService") && (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                  <strong>Note:</strong> When enabled, a "VAT Number" field will be automatically added to this service. 
                                  The field includes UK VAT number format validation. When clients enter a VAT number, staff can 
                                  optionally verify it against HMRC records.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Show in Project Section - Multi-select */}
                          <div className="rounded-lg border p-4 shadow-sm">
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium">Show in Project</label>
                                <div className="text-sm text-muted-foreground">
                                  Select one or more services where this service should appear as a priority indicator on project cards
                                </div>
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {services?.map((service) => (
                                  <div key={service.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`priority-target-create-${service.id}`}
                                      checked={priorityIndicatorTargets.includes(service.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setPriorityIndicatorTargets([...priorityIndicatorTargets, service.id]);
                                        } else {
                                          setPriorityIndicatorTargets(priorityIndicatorTargets.filter(id => id !== service.id));
                                        }
                                      }}
                                      data-testid={`checkbox-priority-target-${service.id}`}
                                    />
                                    <label 
                                      htmlFor={`priority-target-create-${service.id}`} 
                                      className="text-sm font-medium cursor-pointer"
                                    >
                                      {service.name}
                                    </label>
                                  </div>
                                ))}
                                {(!services || services.length === 0) && (
                                  <p className="text-sm text-muted-foreground">No other services available</p>
                                )}
                              </div>
                              {priorityIndicatorTargets.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  Selected: {priorityIndicatorTargets.length} service(s)
                                </div>
                              )}
                            </div>
                          </div>

                          <FormField
                            control={serviceForm.control}
                            name="roleIds"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Work Roles</FormLabel>
                                <FormControl>
                                  <div className="space-y-2">
                                    {allWorkRoles?.filter(role => role && role.id && role.name).map((role) => (
                                      <div key={role.id} className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={role.id}
                                          checked={field.value.includes(role.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              field.onChange([...field.value, role.id]);
                                            } else {
                                              field.onChange(field.value.filter(id => id !== role.id));
                                            }
                                          }}
                                          data-testid={`checkbox-role-${role.id}`}
                                        />
                                        <label htmlFor={role.id} className="text-sm font-medium">
                                          {role.name}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {/* UDF Editor Section */}
                          <UDFEditor control={serviceForm.control} name="udfDefinitions" />
                          
                          <div className="flex justify-end space-x-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCancelForm}
                              data-testid="button-cancel-create-service"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={createServiceMutation.isPending}
                              data-testid="button-save-service"
                            >
                              {createServiceMutation.isPending ? "Creating..." : "Create Service"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Edit Service Form View */}
              {currentTab === 'services' && viewMode === 'edit-service' && editingService && (
                <>
                  <div className="flex items-center space-x-4 mb-6">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCancelForm}
                      data-testid="button-back-to-services"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold">Edit Service</h2>
                      <p className="text-muted-foreground">Update the service information</p>
                    </div>
                  </div>
                  <Card className="max-w-4xl">
                    <CardHeader>
                      <CardTitle>Edit Service: {editingService.name}</CardTitle>
                      <CardDescription>Modify the service details below</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...serviceForm}>
                        <form onSubmit={serviceForm.handleSubmit(handleUpdateService)} className="space-y-6">
                          <FormField
                            control={serviceForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., Monthly Bookkeeping Service"
                                    data-testid="input-service-name"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={serviceForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Describe this service..."
                                    data-testid="textarea-service-description"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Applicable Client Types Section */}
                          <FormField
                            control={serviceForm.control}
                            name="applicableClientTypes"
                            render={({ field }) => (
                              <FormItem className="rounded-lg border p-4 shadow-sm">
                                <div className="space-y-3">
                                  <div>
                                    <FormLabel>Applicable Client Types</FormLabel>
                                    <div className="text-sm text-muted-foreground">
                                      Choose which client types this service applies to
                                    </div>
                                  </div>
                                  <FormControl>
                                    <Select onValueChange={field.onChange} value={field.value || "company"} data-testid="select-client-types-edit">
                                      <SelectTrigger className="w-full md:w-[300px]">
                                        <SelectValue placeholder="Select client types" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="company">Company Only</SelectItem>
                                        <SelectItem value="individual">Individual Only</SelectItem>
                                        <SelectItem value="both">Both Company & Individual</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />

                          {/* Static Service Section */}
                          <FormField
                            control={serviceForm.control}
                            name="isStaticService"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                                <div className="space-y-1">
                                  <FormLabel htmlFor="static-service-switch-edit">Static Service</FormLabel>
                                  <div className="text-sm text-muted-foreground">
                                    Mark this service as static (display only, cannot be mapped to project types)
                                  </div>
                                </div>
                                <FormControl>
                                  <Switch
                                    id="static-service-switch-edit"
                                    checked={field.value || false}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-static-service-edit"
                                    aria-describedby="static-service-description"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          {/* Companies House Connection Section */}
                          <div className="border rounded-lg p-5 space-y-5 bg-muted/50">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-medium">Companies House Integration</h3>
                            </div>
                            
                            <FormField
                              control={serviceForm.control}
                              name="isCompaniesHouseConnected"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background">
                                  <div className="space-y-1">
                                    <FormLabel htmlFor="ch-connection-switch-edit">Enable Companies House Connection</FormLabel>
                                    <div className="text-sm text-muted-foreground">
                                      Auto-populate dates from client Companies House data (accounts and confirmation statement deadlines)
                                    </div>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      id="ch-connection-switch-edit"
                                      checked={field.value || false}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-ch-connection-edit"
                                      aria-describedby="ch-connection-description"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {serviceForm.watch("isCompaniesHouseConnected") && (
                              <div className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                  <FormField
                                    control={serviceForm.control}
                                    name="chStartDateField"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Start Date Field</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""} data-testid="select-ch-start-field-edit">
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select CH field" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="nextAccountsPeriodEnd">Next Accounts Period End</SelectItem>
                                            <SelectItem value="confirmationStatementNextMadeUpTo">Confirmation Statement Next Made Up To</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={serviceForm.control}
                                    name="chDueDateField"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Due Date Field</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value || ""} data-testid="select-ch-due-field-edit">
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select CH field" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="nextAccountsDue">Next Accounts Due</SelectItem>
                                            <SelectItem value="confirmationStatementNextDue">Confirmation Statement Next Due</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                
                                <FormField
                                  control={serviceForm.control}
                                  name="chTargetDeliveryDaysOffset"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Target Delivery Days Before Deadline</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min="0"
                                          placeholder="e.g. 14"
                                          value={field.value ?? ""}
                                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                          data-testid="input-ch-target-delivery-offset-edit"
                                        />
                                      </FormControl>
                                      <div className="text-sm text-muted-foreground">
                                        Number of days before the CH deadline to set as internal target delivery date. Leave empty for no target.
                                      </div>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </div>

                          {/* VAT Service Section */}
                          <div className="border rounded-lg p-5 space-y-5 bg-muted/50">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-medium">HMRC VAT Integration</h3>
                            </div>
                            
                            <FormField
                              control={serviceForm.control}
                              name="isVatService"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-background">
                                  <div className="space-y-1">
                                    <FormLabel htmlFor="vat-service-switch-edit">Enable VAT Service</FormLabel>
                                    <div className="text-sm text-muted-foreground">
                                      Auto-creates a VAT Number field with format validation and optional HMRC verification
                                    </div>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      id="vat-service-switch-edit"
                                      checked={field.value || false}
                                      onCheckedChange={field.onChange}
                                      data-testid="switch-vat-service-edit"
                                      aria-describedby="vat-service-description"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            {serviceForm.watch("isVatService") && (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                  <strong>Note:</strong> When enabled, a "VAT Number" field will be automatically added to this service. 
                                  The field includes UK VAT number format validation. When clients enter a VAT number, staff can 
                                  optionally verify it against HMRC records.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Show in Project Section - Multi-select */}
                          <div className="rounded-lg border p-4 shadow-sm">
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium">Show in Project</label>
                                <div className="text-sm text-muted-foreground">
                                  Select one or more services where this service should appear as a priority indicator on project cards
                                </div>
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {services?.filter(s => s.id !== editingService?.id).map((service) => (
                                  <div key={service.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`priority-target-edit-${service.id}`}
                                      checked={priorityIndicatorTargets.includes(service.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setPriorityIndicatorTargets([...priorityIndicatorTargets, service.id]);
                                        } else {
                                          setPriorityIndicatorTargets(priorityIndicatorTargets.filter(id => id !== service.id));
                                        }
                                      }}
                                      data-testid={`checkbox-priority-target-edit-${service.id}`}
                                    />
                                    <label 
                                      htmlFor={`priority-target-edit-${service.id}`} 
                                      className="text-sm font-medium cursor-pointer"
                                    >
                                      {service.name}
                                    </label>
                                  </div>
                                ))}
                                {(!services || services.filter(s => s.id !== editingService?.id).length === 0) && (
                                  <p className="text-sm text-muted-foreground">No other services available</p>
                                )}
                              </div>
                              {priorityIndicatorTargets.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  Selected: {priorityIndicatorTargets.length} service(s)
                                </div>
                              )}
                            </div>
                          </div>

                          <FormField
                            control={serviceForm.control}
                            name="roleIds"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Work Roles</FormLabel>
                                <FormControl>
                                  <div className="space-y-2">
                                    {allWorkRoles?.filter(role => role && role.id && role.name).map((role) => (
                                      <div key={role.id} className="flex items-center space-x-2">
                                        <input
                                          type="checkbox"
                                          id={role.id}
                                          checked={field.value.includes(role.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              field.onChange([...field.value, role.id]);
                                            } else {
                                              field.onChange(field.value.filter(id => id !== role.id));
                                            }
                                          }}
                                          data-testid={`checkbox-role-${role.id}`}
                                        />
                                        <label htmlFor={role.id} className="text-sm font-medium">
                                          {role.name}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {/* UDF Editor Section */}
                          <UDFEditor control={serviceForm.control} name="udfDefinitions" />
                          
                          <div className="flex justify-end space-x-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCancelForm}
                              data-testid="button-cancel-edit-service"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={updateServiceMutation.isPending}
                              data-testid="button-update-service"
                            >
                              {updateServiceMutation.isPending ? "Updating..." : "Update Service"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </>
              )}
              </div>
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles" className="space-y-8">
              <div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
              {/* Roles List View */}
              {currentTab === 'roles' && viewMode === 'list' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">Work Roles</h2>
                      <p className="text-muted-foreground">Manage work roles that can be assigned to services</p>
                    </div>
                    <Button onClick={handleStartCreateRole} data-testid="button-add-role">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Role
                    </Button>
                  </div>

                  {/* Roles Table */}
                  <div className="border rounded-lg">
                    {rolesLoading ? (
                      <div className="p-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex items-center space-x-4 mb-4">
                            <Skeleton className="h-12 w-12 rounded" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-4 w-[250px]" />
                              <Skeleton className="h-4 w-[200px]" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Used in Services</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workRoles?.map((role) => (
                            <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                              <TableCell className="font-medium">{role.name}</TableCell>
                              <TableCell>{role.description || "—"}</TableCell>
                              <TableCell>
                                <Badge variant={role.serviceCount > 0 ? "default" : "secondary"}>
                                  {role.serviceCount} service{role.serviceCount !== 1 ? 's' : ''}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleEditRole(role)}
                                    data-testid={`button-edit-role-${role.id}`}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setDeleteRoleId(role.id)}
                                    data-testid={`button-delete-role-${role.id}`}
                                    disabled={role.serviceCount > 0}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {workRoles?.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                No work roles found. Create your first role to get started.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </>
              )}

              {/* Create Role Form View */}
              {currentTab === 'roles' && viewMode === 'create-role' && (
                <>
                  <div className="flex items-center space-x-4 mb-6">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCancelForm}
                      data-testid="button-back-to-roles"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold">Create New Work Role</h2>
                      <p className="text-muted-foreground">Add a new work role that can be assigned to services</p>
                    </div>
                  </div>
                  <Card className="max-w-4xl">
                    <CardHeader>
                      <CardTitle>Role Details</CardTitle>
                      <CardDescription>Enter the information for your new work role</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...roleForm}>
                        <form onSubmit={roleForm.handleSubmit(handleCreateRole)} className="space-y-4">
                          <FormField
                            control={roleForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., Senior Bookkeeper"
                                    data-testid="input-role-name"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={roleForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Describe this work role..."
                                    data-testid="textarea-role-description"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCancelForm}
                              data-testid="button-cancel-create-role"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={createRoleMutation.isPending}
                              data-testid="button-save-role"
                            >
                              {createRoleMutation.isPending ? "Creating..." : "Create Role"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Edit Role Form View */}
              {currentTab === 'roles' && viewMode === 'edit-role' && editingRole && (
                <>
                  <div className="flex items-center space-x-4 mb-6">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCancelForm}
                      data-testid="button-back-to-roles"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold">Edit Work Role</h2>
                      <p className="text-muted-foreground">Update the work role information</p>
                    </div>
                  </div>
                  <Card className="max-w-4xl">
                    <CardHeader>
                      <CardTitle>Edit Role: {editingRole.name}</CardTitle>
                      <CardDescription>Modify the role details below</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...roleForm}>
                        <form onSubmit={roleForm.handleSubmit(handleUpdateRole)} className="space-y-4">
                          <FormField
                            control={roleForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., Senior Bookkeeper"
                                    data-testid="input-role-name"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={roleForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Describe this work role..."
                                    data-testid="textarea-role-description"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCancelForm}
                              data-testid="button-cancel-edit-role"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={updateRoleMutation.isPending}
                              data-testid="button-update-role"
                            >
                              {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </>
              )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>


      {/* Delete Service Confirmation */}
      <AlertDialog open={!!deleteServiceId} onOpenChange={() => setDeleteServiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-service">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteServiceId && deleteServiceMutation.mutate(deleteServiceId)}
              data-testid="button-confirm-delete-service"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Role Confirmation */}
      <AlertDialog open={!!deleteRoleId} onOpenChange={() => setDeleteRoleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this work role? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-role">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRoleId && deleteRoleMutation.mutate(deleteRoleId)}
              data-testid="button-confirm-delete-role"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Service Wizard */}
      {showWizard && (
        <ServiceWizard
          mode={wizardMode}
          initialData={wizardEditingService || undefined}
          onSave={handleWizardSave}
          onCancel={handleWizardCancel}
        />
      )}
    </div>
  );
}