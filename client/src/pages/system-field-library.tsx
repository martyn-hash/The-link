import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, Search, Library, Edit, Trash2, Archive, ArchiveRestore, MoreVertical,
  Type, Hash, Calendar, ToggleLeft, List, CheckSquare, Mail, Phone, Link2,
  DollarSign, Percent, User, Upload, Image, FileText, Briefcase, Shield,
  Clock, Contact, FolderOpen, Puzzle, Eye, Copy
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TopNavigation from "@/components/top-navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import type { SystemFieldLibrary, InsertSystemFieldLibrary } from "@shared/schema";

const FIELD_TYPES = [
  { value: "short_text", label: "Short Text", icon: Type, description: "Single line text input" },
  { value: "long_text", label: "Long Text", icon: FileText, description: "Multi-line text area" },
  { value: "number", label: "Number", icon: Hash, description: "Numeric input" },
  { value: "boolean", label: "Yes/No", icon: ToggleLeft, description: "Toggle or checkbox" },
  { value: "date", label: "Date", icon: Calendar, description: "Date picker" },
  { value: "single_select", label: "Single Select", icon: List, description: "Dropdown with one choice" },
  { value: "multi_select", label: "Multi Select", icon: CheckSquare, description: "Multiple choice selection" },
  { value: "email", label: "Email", icon: Mail, description: "Email address input" },
  { value: "phone", label: "Phone", icon: Phone, description: "Phone number input" },
  { value: "url", label: "URL", icon: Link2, description: "Web address input" },
  { value: "currency", label: "Currency", icon: DollarSign, description: "Money amount" },
  { value: "percentage", label: "Percentage", icon: Percent, description: "Percentage value" },
  { value: "user_select", label: "User Select", icon: User, description: "Select a team member" },
  { value: "file_upload", label: "File Upload", icon: Upload, description: "Document attachment" },
  { value: "image_upload", label: "Image Upload", icon: Image, description: "Image attachment" },
] as const;

const FIELD_CATEGORIES = [
  { value: "general", label: "General", icon: FolderOpen, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { value: "contact", label: "Contact", icon: Contact, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  { value: "financial", label: "Financial", icon: DollarSign, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  { value: "compliance", label: "Compliance", icon: Shield, color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  { value: "documentation", label: "Documentation", icon: FileText, color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  { value: "scheduling", label: "Scheduling", icon: Clock, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300" },
  { value: "custom", label: "Custom", icon: Puzzle, color: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300" },
] as const;

const CONTEXT_LABELS: Record<string, string> = {
  stage_approval: "Stage Approvals",
  client_task: "Client Tasks",
  request_template: "Request Templates",
  campaign_page: "Campaign Pages",
  reason_custom_field: "Reason Custom Fields",
  service_udf: "Service UDFs",
  page_template: "Page Templates",
};

const CURRENCY_OPTIONS = [
  { value: "GBP", label: "£ GBP (British Pound)", symbol: "£" },
  { value: "USD", label: "$ USD (US Dollar)", symbol: "$" },
  { value: "EUR", label: "€ EUR (Euro)", symbol: "€" },
  { value: "AUD", label: "$ AUD (Australian Dollar)", symbol: "$" },
  { value: "CAD", label: "$ CAD (Canadian Dollar)", symbol: "$" },
];

const FILE_TYPE_OPTIONS = [
  { value: "documents", label: "Documents (PDF, Word, Excel)" },
  { value: "images", label: "Images (JPG, PNG, GIF)" },
  { value: "spreadsheets", label: "Spreadsheets (Excel, CSV)" },
  { value: "any", label: "Any file type" },
];

const fieldFormSchema = z.object({
  fieldName: z.string().min(1, "Field name is required").max(255),
  fieldType: z.enum([
    "short_text", "long_text", "number", "boolean", "date",
    "single_select", "multi_select", "email", "phone", "url",
    "currency", "percentage", "user_select", "file_upload", "image_upload"
  ]),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  category: z.enum(["general", "contact", "financial", "compliance", "documentation", "scheduling", "custom"]),
  tags: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().default(false),
  currencyCode: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  decimalPlaces: z.coerce.number().min(0).max(4).optional(),
  allowedFileTypes: z.string().optional(),
  maxFileSize: z.coerce.number().optional(),
  allowMultipleUsers: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.fieldType === "single_select" || data.fieldType === "multi_select") {
      return data.options && data.options.length > 0;
    }
    return true;
  },
  { message: "Select fields require at least one option", path: ["options"] }
);

type FieldFormData = z.infer<typeof fieldFormSchema>;

function getFieldTypeIcon(fieldType: string) {
  const type = FIELD_TYPES.find(t => t.value === fieldType);
  return type?.icon || Type;
}

function getCategoryBadge(category: string) {
  const cat = FIELD_CATEGORIES.find(c => c.value === category);
  if (!cat) return null;
  const Icon = cat.icon;
  return (
    <Badge variant="secondary" className={`${cat.color} gap-1`}>
      <Icon className="w-3 h-3" />
      {cat.label}
    </Badge>
  );
}

function FieldFormModal({
  field,
  open,
  onOpenChange,
  onSuccess,
}: {
  field?: SystemFieldLibrary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const isEditing = !!field;
  const [optionsText, setOptionsText] = useState("");

  const form = useForm<FieldFormData>({
    resolver: zodResolver(fieldFormSchema),
    defaultValues: {
      fieldName: "",
      fieldType: "short_text",
      description: "",
      placeholder: "",
      helpText: "",
      category: "general",
      tags: [],
      options: [],
      isRequired: false,
      currencyCode: "GBP",
      minValue: undefined,
      maxValue: undefined,
      decimalPlaces: 2,
      allowedFileTypes: "any",
      maxFileSize: undefined,
      allowMultipleUsers: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (field) {
        const validationRules = (field.validationRules as Record<string, any>) || {};
        const displayConfig = (field.displayConfig as Record<string, any>) || {};
        form.reset({
          fieldName: field.fieldName || "",
          fieldType: (field.fieldType as any) || "short_text",
          description: field.description || "",
          placeholder: field.placeholder || "",
          helpText: field.helpText || "",
          category: (field.category as any) || "general",
          tags: field.tags || [],
          options: field.options || [],
          isRequired: field.isRequired || false,
          currencyCode: displayConfig.currencyCode || "GBP",
          minValue: validationRules.min,
          maxValue: validationRules.max,
          decimalPlaces: displayConfig.decimalPlaces ?? 2,
          allowedFileTypes: validationRules.allowedFileTypes || "any",
          maxFileSize: validationRules.maxFileSize,
          allowMultipleUsers: displayConfig.allowMultipleUsers || false,
        });
        setOptionsText(field.options?.join("\n") || "");
      } else {
        form.reset({
          fieldName: "",
          fieldType: "short_text",
          description: "",
          placeholder: "",
          helpText: "",
          category: "general",
          tags: [],
          options: [],
          isRequired: false,
          currencyCode: "GBP",
          minValue: undefined,
          maxValue: undefined,
          decimalPlaces: 2,
          allowedFileTypes: "any",
          maxFileSize: undefined,
          allowMultipleUsers: false,
        });
        setOptionsText("");
      }
    }
  }, [open, field, form]);

  const watchedFieldType = form.watch("fieldType");
  const showOptions = watchedFieldType === "single_select" || watchedFieldType === "multi_select";

  useEffect(() => {
    const parsedOptions = optionsText.split("\n").filter(o => o.trim());
    form.setValue('options', parsedOptions, { shouldValidate: false });
  }, [optionsText, form]);

  const buildPayload = (data: FieldFormData) => {
    const validationRules: Record<string, any> = {};
    const displayConfig: Record<string, any> = {};

    if (data.fieldType === "currency") {
      displayConfig.currencyCode = data.currencyCode || "GBP";
      displayConfig.decimalPlaces = data.decimalPlaces ?? 2;
    }
    if (data.fieldType === "number" || data.fieldType === "percentage") {
      if (data.minValue !== undefined && data.minValue !== null) validationRules.min = data.minValue;
      if (data.maxValue !== undefined && data.maxValue !== null) validationRules.max = data.maxValue;
      if (data.fieldType === "number" && data.decimalPlaces !== undefined) {
        displayConfig.decimalPlaces = data.decimalPlaces;
      }
    }
    if (data.fieldType === "file_upload" || data.fieldType === "image_upload") {
      validationRules.allowedFileTypes = [data.allowedFileTypes || "any"];
      if (data.maxFileSize) validationRules.maxFileSizeMb = data.maxFileSize;
    }
    if (data.fieldType === "user_select") {
      displayConfig.allowMultipleUsers = data.allowMultipleUsers || false;
    }

    return {
      fieldName: data.fieldName,
      fieldType: data.fieldType,
      description: data.description,
      placeholder: data.placeholder,
      helpText: data.helpText,
      category: data.category,
      tags: data.tags,
      options: showOptions ? optionsText.split("\n").filter(o => o.trim()) : undefined,
      isRequired: data.isRequired,
      validationRules: Object.keys(validationRules).length > 0 ? validationRules : undefined,
      displayConfig: Object.keys(displayConfig).length > 0 ? displayConfig : undefined,
    };
  };

  const createMutation = useMutation({
    mutationFn: async (data: FieldFormData) => {
      return apiRequest("POST", "/api/system-field-library", buildPayload(data));
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Field created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/system-field-library"] });
      onSuccess();
      onOpenChange(false);
      form.reset();
      setOptionsText("");
    },
    onError: (error) => {
      showFriendlyError({ error: error instanceof Error ? error.message : "Failed to create field" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FieldFormData) => {
      return apiRequest("PATCH", `/api/system-field-library/${field!.id}`, buildPayload(data));
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Field updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/system-field-library"] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      showFriendlyError({ error: error instanceof Error ? error.message : "Failed to update field" });
    },
  });

  const handleSubmit = (data: FieldFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Field" : "Create New Field"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the field properties below." : "Define a reusable field for your forms."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fieldName"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Field Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Bank Rec Checked" {...field} data-testid="input-field-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fieldType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-field-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FIELD_TYPES.map((type) => {
                          const Icon = type.icon;
                          return (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                <span>{type.label}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {FIELD_TYPES.find(t => t.value === field.value)?.description}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FIELD_CATEGORIES.map((cat) => {
                          const Icon = cat.icon;
                          return (
                            <SelectItem key={cat.value} value={cat.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                <span>{cat.label}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe what this field is for..." 
                        {...field} 
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="placeholder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placeholder Text</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Enter value..." {...field} data-testid="input-placeholder" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="helpText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Help Text</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., This is displayed below the field" {...field} data-testid="input-help-text" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showOptions && (
                <FormItem className="col-span-2">
                  <FormLabel>Options *</FormLabel>
                  <Textarea
                    placeholder="Enter each option on a new line"
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    rows={4}
                    data-testid="input-options"
                  />
                  <FormDescription>
                    Enter one option per line. These will be the choices available in the dropdown.
                  </FormDescription>
                </FormItem>
              )}

              {watchedFieldType === "currency" && (
                <>
                  <FormField
                    control={form.control}
                    name="currencyCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "GBP"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-currency">
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CURRENCY_OPTIONS.map((curr) => (
                              <SelectItem key={curr.value} value={curr.value}>
                                {curr.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="decimalPlaces"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Decimal Places</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={0} 
                            max={4} 
                            {...field} 
                            value={field.value ?? 2}
                            data-testid="input-decimal-places" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {(watchedFieldType === "number" || watchedFieldType === "percentage") && (
                <>
                  <FormField
                    control={form.control}
                    name="minValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Value</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="No minimum" 
                            {...field} 
                            value={field.value ?? ""}
                            data-testid="input-min-value" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Value</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="No maximum" 
                            {...field} 
                            value={field.value ?? ""}
                            data-testid="input-max-value" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {watchedFieldType === "number" && (
                    <FormField
                      control={form.control}
                      name="decimalPlaces"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Decimal Places</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={0} 
                              max={4} 
                              {...field} 
                              value={field.value ?? ""}
                              placeholder="Whole numbers"
                              data-testid="input-decimal-places" 
                            />
                          </FormControl>
                          <FormDescription>Leave empty for whole numbers</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              {(watchedFieldType === "file_upload" || watchedFieldType === "image_upload") && (
                <>
                  <FormField
                    control={form.control}
                    name="allowedFileTypes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allowed File Types</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "any"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-file-types">
                              <SelectValue placeholder="Select file types" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FILE_TYPE_OPTIONS.map((type) => (
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
                    control={form.control}
                    name="maxFileSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max File Size (MB)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            placeholder="No limit" 
                            {...field} 
                            value={field.value ?? ""}
                            data-testid="input-max-file-size" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {watchedFieldType === "user_select" && (
                <FormField
                  control={form.control}
                  name="allowMultipleUsers"
                  render={({ field }) => (
                    <FormItem className="col-span-2 flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Allow Multiple Users</FormLabel>
                        <FormDescription>
                          Allow selecting more than one team member
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-multiple-users"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="isRequired"
                render={({ field }) => (
                  <FormItem className="col-span-2 flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Required Field</FormLabel>
                      <FormDescription>
                        Make this field mandatory when used in forms
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-required"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-field"
              >
                {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (isEditing ? "Update Field" : "Create Field")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function UsageDialog({ field, open, onOpenChange }: { field: SystemFieldLibrary; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: usages, isLoading } = useQuery<any[]>({
    queryKey: ["/api/system-field-library", field.id, "usage"],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Field Usage: {field.fieldName}
          </DialogTitle>
          <DialogDescription>
            This field is used in {field.usageCount || 0} place(s).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : usages && usages.length > 0 ? (
            usages.map((usage: any) => (
              <div key={usage.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <Badge variant="outline">{CONTEXT_LABELS[usage.context] || usage.context}</Badge>
                  {usage.fieldNameOverride && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      (as "{usage.fieldNameOverride}")
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-4">
              This field is not currently used in any forms.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SystemFieldLibraryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingField, setEditingField] = useState<SystemFieldLibrary | null>(null);
  const [usageField, setUsageField] = useState<SystemFieldLibrary | null>(null);

  const { data: fields, isLoading: fieldsLoading } = useQuery<SystemFieldLibrary[]>({
    queryKey: ["/api/system-field-library", { isArchived: showArchived ? 'true' : 'false' }],
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/system-field-library/${id}/archive`),
    onSuccess: () => {
      toast({ title: "Success", description: "Field archived" });
      queryClient.invalidateQueries({ queryKey: ["/api/system-field-library"] });
    },
    onError: (error) => showFriendlyError({ error: error instanceof Error ? error.message : "Failed to archive field" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/system-field-library/${id}/restore`),
    onSuccess: () => {
      toast({ title: "Success", description: "Field restored" });
      queryClient.invalidateQueries({ queryKey: ["/api/system-field-library"] });
    },
    onError: (error) => showFriendlyError({ error: error instanceof Error ? error.message : "Failed to restore field" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/system-field-library/${id}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Field permanently deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/system-field-library"] });
    },
    onError: (error) => showFriendlyError({ error: error instanceof Error ? error.message : "Failed to delete field" }),
  });

  const filteredFields = useMemo(() => {
    if (!fields) return [];
    return fields.filter((field) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = field.fieldName.toLowerCase().includes(query);
        const matchesDescription = field.description?.toLowerCase().includes(query);
        const matchesTags = field.tags?.some(t => t.toLowerCase().includes(query));
        if (!matchesName && !matchesDescription && !matchesTags) return false;
      }
      if (categoryFilter !== "all" && field.category !== categoryFilter) return false;
      if (typeFilter !== "all" && field.fieldType !== typeFilter) return false;
      return true;
    });
  }, [fields, searchQuery, categoryFilter, typeFilter]);

  const handleEdit = (field: SystemFieldLibrary) => {
    setEditingField(field);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingField(null);
    setFormOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation user={user} />
      
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
                <Library className="w-6 h-6 md:w-7 md:h-7" />
                System Field Library
              </h1>
              <p className="text-meta mt-1">
                Create and manage reusable fields for forms across the system
              </p>
            </div>
            <Button onClick={handleCreate} data-testid="button-create-field">
              <Plus className="w-4 h-4 mr-2" />
              Create Field
            </Button>
          </div>
        </div>
      </div>

      <div className="page-container py-6 md:py-8 space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-fields"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40" data-testid="filter-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {FIELD_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40" data-testid="filter-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={showArchived ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                  data-testid="toggle-archived"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  {showArchived ? "Archived" : "Active"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {fieldsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredFields.length === 0 ? (
              <div className="text-center py-12">
                <Library className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {showArchived ? "No archived fields" : "No fields yet"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {showArchived 
                    ? "Archived fields will appear here" 
                    : "Create your first reusable field to get started"
                  }
                </p>
                {!showArchived && (
                  <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Field
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Used In</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFields.map((field) => {
                    const TypeIcon = getFieldTypeIcon(field.fieldType);
                    return (
                      <TableRow key={field.id} data-testid={`row-field-${field.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{field.fieldName}</span>
                            {field.isRequired && (
                              <Badge variant="outline" className="text-xs">Required</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">
                              {FIELD_TYPES.find(t => t.value === field.fieldType)?.label}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getCategoryBadge(field.category)}</TableCell>
                        <TableCell>
                          <span className="text-muted-foreground text-sm truncate max-w-xs block">
                            {field.description || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUsageField(field)}
                            data-testid={`button-usage-${field.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {field.usageCount || 0}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-actions-${field.id}`}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!field.isArchived ? (
                                <>
                                  <DropdownMenuItem onClick={() => handleEdit(field)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setUsageField(field)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View Usage
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => archiveMutation.mutate(field.id)}
                                    className="text-amber-600"
                                  >
                                    <Archive className="w-4 h-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuItem onClick={() => restoreMutation.mutate(field.id)}>
                                    <ArchiveRestore className="w-4 h-4 mr-2" />
                                    Restore
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem 
                                        onSelect={(e) => e.preventDefault()}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Permanently
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Field Permanently?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently delete "{field.fieldName}". This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteMutation.mutate(field.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <FieldFormModal
        field={editingField}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={() => {
          setEditingField(null);
        }}
      />

      {usageField && (
        <UsageDialog
          field={usageField}
          open={!!usageField}
          onOpenChange={(open) => !open && setUsageField(null)}
        />
      )}
    </div>
  );
}
