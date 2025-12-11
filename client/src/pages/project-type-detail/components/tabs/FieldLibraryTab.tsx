import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Save, X, BookOpen, Hash, Type, ToggleLeft, Calendar, ListChecks, ListTodo } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { ApprovalFieldLibrary } from "@shared/schema";

const FIELD_TYPES = [
  { value: "boolean", label: "Yes/No", icon: ToggleLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "short_text", label: "Short Text", icon: Type },
  { value: "long_text", label: "Long Text", icon: Type },
  { value: "single_select", label: "Single Select", icon: ListTodo },
  { value: "multi_select", label: "Multi Select", icon: ListChecks },
  { value: "date", label: "Date", icon: Calendar },
] as const;

type FieldType = typeof FIELD_TYPES[number]["value"];

interface EditingField {
  id?: string;
  fieldName: string;
  fieldType: FieldType;
  description: string;
  options: string[];
}

const DEFAULT_FIELD: EditingField = {
  fieldName: "",
  fieldType: "boolean",
  description: "",
  options: [],
};

interface FieldLibraryTabProps {
  projectTypeId: string;
}

export function FieldLibraryTab({ projectTypeId }: FieldLibraryTabProps) {
  const { toast } = useToast();
  const [isAddingField, setIsAddingField] = useState(false);
  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);
  const [newOption, setNewOption] = useState("");

  const { data: libraryFields, isLoading: fieldsLoading } = useQuery<(ApprovalFieldLibrary & { usageCount: number })[]>({
    queryKey: ["/api/project-types", projectTypeId, "approval-field-library"],
    queryFn: async () => {
      const res = await fetch(`/api/project-types/${projectTypeId}/approval-field-library?includeUsage=true`);
      if (!res.ok) throw new Error("Failed to fetch library fields");
      return res.json();
    },
  });

  const createFieldMutation = useMutation({
    mutationFn: async (data: Omit<EditingField, "id">) => {
      const res = await apiRequest("POST", `/api/project-types/${projectTypeId}/approval-field-library`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-types", projectTypeId, "approval-field-library"] });
      setIsAddingField(false);
      setEditingField(null);
      toast({ title: "Field created", description: "The field has been added to the library." });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async (data: EditingField) => {
      const { id, ...rest } = data;
      const res = await apiRequest("PATCH", `/api/approval-field-library/${id}`, rest);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-types", projectTypeId, "approval-field-library"] });
      setEditingField(null);
      toast({ title: "Field updated" });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      await apiRequest("DELETE", `/api/approval-field-library/${fieldId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-types", projectTypeId, "approval-field-library"] });
      setDeleteFieldId(null);
      toast({ title: "Field deleted" });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const handleAddField = () => {
    setEditingField({ ...DEFAULT_FIELD });
    setIsAddingField(true);
  };

  const handleEditField = (field: ApprovalFieldLibrary) => {
    setEditingField({
      id: field.id,
      fieldName: field.fieldName,
      fieldType: field.fieldType as FieldType,
      description: field.description || "",
      options: field.options || [],
    });
  };

  const handleSaveField = () => {
    if (!editingField) return;
    
    if (!editingField.fieldName.trim()) {
      toast({ title: "Missing field name", variant: "destructive" });
      return;
    }

    if ((editingField.fieldType === "single_select" || editingField.fieldType === "multi_select") && editingField.options.length === 0) {
      toast({ title: "Select fields require at least one option", variant: "destructive" });
      return;
    }

    if (editingField.id) {
      updateFieldMutation.mutate(editingField);
    } else {
      createFieldMutation.mutate(editingField);
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setIsAddingField(false);
  };

  const handleAddOption = () => {
    if (!newOption.trim() || !editingField) return;
    setEditingField({
      ...editingField,
      options: [...editingField.options, newOption.trim()],
    });
    setNewOption("");
  };

  const handleRemoveOption = (index: number) => {
    if (!editingField) return;
    setEditingField({
      ...editingField,
      options: editingField.options.filter((_, i) => i !== index),
    });
  };

  const getFieldTypeLabel = (type: string) => {
    const fieldType = FIELD_TYPES.find(t => t.value === type);
    return fieldType?.label || type;
  };

  const getFieldTypeIcon = (type: string) => {
    const fieldType = FIELD_TYPES.find(t => t.value === type);
    const Icon = fieldType?.icon || Type;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <TabsContent value="field-library" className="page-container py-6 md:py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Approval Field Library</h2>
          <p className="text-muted-foreground">
            Create reusable fields for stage approvals. These can be used in standard approvals and client-specific overrides.
          </p>
        </div>
        <Button onClick={handleAddField} data-testid="button-add-library-field">
          <Plus className="w-4 h-4 mr-2" />
          Add Field
        </Button>
      </div>

      {fieldsLoading ? (
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
      ) : libraryFields && libraryFields.length > 0 ? (
        <div className="grid gap-4">
          {libraryFields.map((field) => (
            <Card key={field.id} data-testid={`card-library-field-${field.id}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    {getFieldTypeIcon(field.fieldType)}
                  </div>
                  <div>
                    <CardTitle className="text-base" data-testid={`text-field-name-${field.id}`}>
                      {field.fieldName}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {getFieldTypeLabel(field.fieldType)}
                      </Badge>
                      {field.usageCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Used in {field.usageCount} approval{field.usageCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditField(field)}
                    data-testid={`button-edit-field-${field.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteFieldId(field.id)}
                    disabled={field.usageCount > 0}
                    data-testid={`button-delete-field-${field.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              {field.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{field.description}</p>
                </CardContent>
              )}
              {field.options && field.options.length > 0 && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1">
                    {field.options.map((option, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {option}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-muted-foreground mb-4 mx-auto" />
          <h3 className="text-lg font-medium text-foreground mb-2">No library fields yet</h3>
          <p className="text-muted-foreground mb-4">
            Create reusable fields to maintain consistency across approvals and enable cross-client analysis.
          </p>
          <Button onClick={handleAddField}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Field
          </Button>
        </div>
      )}

      {(editingField || isAddingField) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingField?.id ? "Edit Library Field" : "Add New Library Field"}</CardTitle>
            <CardDescription>
              Define a reusable field that can be added to stage approvals across the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="field-name">Field Name</Label>
                <Input
                  id="field-name"
                  value={editingField?.fieldName || ""}
                  onChange={(e) => setEditingField({ ...editingField!, fieldName: e.target.value })}
                  placeholder="e.g., Bank Statement Reviewed"
                  data-testid="input-library-field-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="field-type">Field Type</Label>
                <Select
                  value={editingField?.fieldType || "boolean"}
                  onValueChange={(value) => setEditingField({ ...editingField!, fieldType: value as FieldType })}
                >
                  <SelectTrigger data-testid="select-library-field-type">
                    <SelectValue placeholder="Select field type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="w-4 h-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="field-description">Description (Optional)</Label>
                <Textarea
                  id="field-description"
                  value={editingField?.description || ""}
                  onChange={(e) => setEditingField({ ...editingField!, description: e.target.value })}
                  placeholder="Describe what this field captures"
                  data-testid="textarea-library-field-description"
                />
              </div>

              {(editingField?.fieldType === "single_select" || editingField?.fieldType === "multi_select") && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Add an option"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                      data-testid="input-library-field-option"
                    />
                    <Button type="button" variant="secondary" onClick={handleAddOption}>
                      Add
                    </Button>
                  </div>
                  {editingField.options.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editingField.options.map((option, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {option}
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveField}
                  disabled={createFieldMutation.isPending || updateFieldMutation.isPending}
                  data-testid="button-save-library-field"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingField?.id ? "Update Field" : "Create Field"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteFieldId} onOpenChange={() => setDeleteFieldId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Library Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this field from the library? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFieldId && deleteFieldMutation.mutate(deleteFieldId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  );
}
