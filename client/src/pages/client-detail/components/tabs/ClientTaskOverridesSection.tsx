import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Plus,
  Trash2,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  FileText,
  Settings2,
  Undo2,
  MinusCircle,
  Type,
  AlignLeft,
  Hash,
  Calendar,
  CheckSquare,
  ToggleLeft,
  List,
  ChevronDownSquare,
  Upload,
  Mail,
  Library,
} from "lucide-react";
import type {
  ProjectType,
  ClientProjectTaskTemplateWithRelations,
  ClientProjectTaskOverrideWithRelations,
  ClientProjectTaskQuestion,
  ClientProjectTaskOverrideQuestion,
  SystemFieldLibrary,
} from "@shared/schema";
import type { EnhancedClientService } from "../../utils/types";
import { SystemFieldLibraryPicker } from "@/components/system-field-library-picker";
import { FieldConfigModal as SharedFieldConfigModal } from "@/components/field-builder/FieldConfigModal";
import { clientTaskQuestionAdapter } from "@/components/field-builder/adapters";
import type { FieldDefinition } from "@/components/field-builder/types";

interface ClientTaskOverridesSectionProps {
  clientId: string;
}

type QuestionType = "short_text" | "long_text" | "number" | "date" | "single_choice" | "multi_choice" | "yes_no" | "dropdown" | "file_upload" | "email";

interface ConditionalLogicCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than";
  value: string;
}

interface ConditionalLogic {
  action: "show" | "hide" | "require";
  conditions: ConditionalLogicCondition[];
  logicType: "all" | "any";
}

interface EditingQuestion {
  id?: string;
  overrideId: string;
  questionType: QuestionType;
  label: string;
  helpText: string;
  isRequired: boolean;
  order: number;
  options: string[];
  placeholder: string;
  libraryFieldId?: string | null;
  conditionalLogic: ConditionalLogic | null;
}

const QUESTION_TYPES = [
  { type: "short_text" as QuestionType, label: "Short Text", icon: Type, color: "#3b82f6" },
  { type: "long_text" as QuestionType, label: "Long Text", icon: AlignLeft, color: "#8b5cf6" },
  { type: "email" as QuestionType, label: "Email", icon: Mail, color: "#f59e0b" },
  { type: "number" as QuestionType, label: "Number", icon: Hash, color: "#22c55e" },
  { type: "date" as QuestionType, label: "Date", icon: Calendar, color: "#ec4899" },
  { type: "single_choice" as QuestionType, label: "Single Choice", icon: CheckSquare, color: "#14b8a6" },
  { type: "multi_choice" as QuestionType, label: "Multiple Choice", icon: List, color: "#6366f1" },
  { type: "yes_no" as QuestionType, label: "Yes/No", icon: ToggleLeft, color: "#f97316" },
  { type: "dropdown" as QuestionType, label: "Dropdown", icon: ChevronDownSquare, color: "#0ea5e9" },
  { type: "file_upload" as QuestionType, label: "File Upload", icon: Upload, color: "#10b981" },
];

const DEFAULT_QUESTION: Omit<EditingQuestion, 'overrideId'> = {
  questionType: "short_text",
  label: "",
  helpText: "",
  isRequired: false,
  order: 1,
  options: [],
  placeholder: "",
  libraryFieldId: null,
  conditionalLogic: null,
};

function ClientTaskOverrideQuestionConfigModal({
  question,
  questionIndex,
  allQuestions,
  isOpen,
  onClose,
  onSave,
}: {
  question: EditingQuestion;
  questionIndex: number;
  allQuestions: EditingQuestion[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (q: EditingQuestion) => void;
}) {
  const getQuestionKey = (q: EditingQuestion, idx: number) => q.id || `temp-${idx}`;
  
  const fieldDefinition = useMemo(() => {
    const domainField = {
      id: question.id,
      label: question.label,
      questionType: question.questionType,
      helpText: question.helpText,
      isRequired: question.isRequired,
      order: question.order,
      options: question.options,
      placeholder: question.placeholder,
      conditionalLogic: question.conditionalLogic,
      libraryFieldId: question.libraryFieldId,
    };
    return clientTaskQuestionAdapter.mapToFieldDefinition(domainField, questionIndex);
  }, [question, questionIndex]);

  const availableFieldsForConditions = useMemo(() => {
    return allQuestions
      .map((q, originalIdx) => ({ ...q, _originalIndex: originalIdx }))
      .slice(0, questionIndex)
      .filter(q => q.label.trim())
      .map((q) => ({
        id: getQuestionKey(q, q._originalIndex),
        label: q.label,
        fieldType: q.questionType,
        options: q.questionType === 'yes_no' ? ['yes', 'no'] : q.options,
      }));
  }, [allQuestions, questionIndex]);

  const handleSave = useCallback((savedField: FieldDefinition) => {
    const mappedBack = clientTaskQuestionAdapter.mapFromFieldDefinition(savedField);
    onSave({
      id: question.id,
      overrideId: question.overrideId,
      order: question.order,
      questionType: mappedBack.questionType as QuestionType,
      label: mappedBack.label || "",
      helpText: mappedBack.helpText || "",
      isRequired: mappedBack.isRequired ?? false,
      options: mappedBack.options || [],
      placeholder: mappedBack.placeholder || "",
      conditionalLogic: mappedBack.conditionalLogic as ConditionalLogic | null,
      libraryFieldId: mappedBack.libraryFieldId,
    });
  }, [question, onSave]);

  return (
    <SharedFieldConfigModal
      key={`override-question-${question.id || questionIndex}`}
      field={fieldDefinition}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      allowedFieldTypes={clientTaskQuestionAdapter.allowedFieldTypes}
      capabilities={clientTaskQuestionAdapter.capabilities}
      availableFieldsForConditions={availableFieldsForConditions}
    />
  );
}

export function ClientTaskOverridesSection({ clientId }: ClientTaskOverridesSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreatingOverride, setIsCreatingOverride] = useState(false);
  const [selectedProjectTypeId, setSelectedProjectTypeId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [expandedOverrideId, setExpandedOverrideId] = useState<string | null>(null);
  const [deleteOverrideId, setDeleteOverrideId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<EditingQuestion | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const [systemLibraryPickerOpen, setSystemLibraryPickerOpen] = useState(false);
  const [currentOverrideIdForLibrary, setCurrentOverrideIdForLibrary] = useState<string | null>(null);

  const ALLOWED_SYSTEM_FIELD_TYPES = ["boolean", "number", "short_text", "long_text", "date", "single_select", "multi_select", "dropdown", "email", "phone", "url", "currency", "percentage", "user_select", "file_upload", "image_upload"];

  const mapSystemFieldTypeToQuestionType = (fieldType: string): QuestionType => {
    const mapping: Record<string, QuestionType> = {
      "boolean": "yes_no",
      "number": "number",
      "short_text": "short_text",
      "long_text": "long_text",
      "date": "date",
      "single_select": "single_choice",
      "multi_select": "multi_choice",
      "dropdown": "dropdown",
      "email": "email",
      "file_upload": "file_upload",
      "image_upload": "file_upload",
      "currency": "number",
      "percentage": "number",
      "url": "short_text",
      "phone": "short_text",
      "user_select": "dropdown",
    };
    return mapping[fieldType] || "short_text";
  };

  const handleAddQuestionFromSystemLibrary = (systemField: SystemFieldLibrary) => {
    if (!currentOverrideIdForLibrary) return;
    
    const override = overrides?.find(o => o.id === currentOverrideIdForLibrary);
    if (!override) return;
    
    const mappedType = mapSystemFieldTypeToQuestionType(systemField.fieldType);
    const existingQuestionsCount = override.questions?.length || 0;
    
    setEditingQuestion({
      ...DEFAULT_QUESTION,
      overrideId: currentOverrideIdForLibrary,
      questionType: mappedType,
      label: systemField.fieldName,
      helpText: systemField.description || "",
      isRequired: systemField.isRequired || false,
      options: systemField.options || [],
      order: existingQuestionsCount + 1,
      libraryFieldId: systemField.id,
    });
    setEditingQuestionIndex(existingQuestionsCount);
    
    setCurrentOverrideIdForLibrary(null);
  };

  const openSystemLibraryPicker = (overrideId: string) => {
    setCurrentOverrideIdForLibrary(overrideId);
    setSystemLibraryPickerOpen(true);
  };

  const { data: projectTypes, isLoading: projectTypesLoading } = useQuery<ProjectType[]>({
    queryKey: ["/api/config/project-types"],
  });

  const { data: clientServices, isLoading: clientServicesLoading } = useQuery<EnhancedClientService[]>({
    queryKey: [`/api/client-services/client/${clientId}`],
    enabled: !!clientId,
  });

  const filteredProjectTypes = useMemo(() => {
    if (!projectTypes) return [];
    if (!clientServices || clientServices.length === 0) {
      return [];
    }
    const clientServiceIds = new Set(clientServices.map(cs => cs.serviceId));
    return projectTypes.filter(pt => pt.serviceId && clientServiceIds.has(pt.serviceId));
  }, [projectTypes, clientServices]);

  const { data: overrides, isLoading: overridesLoading } = useQuery<ClientProjectTaskOverrideWithRelations[]>({
    queryKey: ["/api/clients", clientId, "task-overrides"],
  });

  const { data: templatesForType } = useQuery<ClientProjectTaskTemplateWithRelations[]>({
    queryKey: ["/api/project-types", selectedProjectTypeId, "task-templates"],
    enabled: !!selectedProjectTypeId,
  });

  const activeTemplates = useMemo(() => 
    templatesForType?.filter(t => t.isActive) || [],
    [templatesForType]
  );

  const expandedOverride = useMemo(() => 
    overrides?.find(o => o.id === expandedOverrideId),
    [overrides, expandedOverrideId]
  );

  const { data: baseTemplateQuestions } = useQuery<ClientProjectTaskQuestion[]>({
    queryKey: ["/api/task-templates", expandedOverride?.baseTemplateId, "questions"],
    enabled: !!expandedOverride?.baseTemplateId,
  });

  const createOverrideMutation = useMutation({
    mutationFn: async (data: { clientId: string; baseTemplateId: string }) => {
      const res = await apiRequest("POST", "/api/task-overrides", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "task-overrides"] });
      toast({ title: "Override created", description: "Custom task template override has been created." });
      setIsCreatingOverride(false);
      setSelectedProjectTypeId("");
      setSelectedTemplateId("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create override", description: error.message, variant: "destructive" });
    },
  });

  const updateOverrideMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { removedQuestionIds?: string[] } }) => {
      const res = await apiRequest("PATCH", `/api/task-overrides/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "task-overrides"] });
      toast({ title: "Override updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update override", description: error.message, variant: "destructive" });
    },
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/task-overrides/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "task-overrides"] });
      toast({ title: "Override deleted", description: "Client will now use the standard template." });
      setDeleteOverrideId(null);
      setExpandedOverrideId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete override", description: error.message, variant: "destructive" });
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (data: Omit<EditingQuestion, 'id'>) => {
      const res = await apiRequest("POST", "/api/task-override-questions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "task-overrides"] });
      toast({ title: "Question added" });
      setEditingQuestion(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add question", description: error.message, variant: "destructive" });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EditingQuestion> }) => {
      const res = await apiRequest("PATCH", `/api/task-override-questions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "task-overrides"] });
      toast({ title: "Question updated" });
      setEditingQuestion(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update question", description: error.message, variant: "destructive" });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/task-override-questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "task-overrides"] });
      toast({ title: "Question deleted" });
      setDeleteQuestionId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete question", description: error.message, variant: "destructive" });
    },
  });

  const handleRemoveQuestion = (override: ClientProjectTaskOverrideWithRelations, questionId: string) => {
    const currentRemoved = override.removedQuestionIds || [];
    if (!currentRemoved.includes(questionId)) {
      updateOverrideMutation.mutate({
        id: override.id,
        data: { removedQuestionIds: [...currentRemoved, questionId] }
      });
    }
  };

  const handleRestoreQuestion = (override: ClientProjectTaskOverrideWithRelations, questionId: string) => {
    const currentRemoved = override.removedQuestionIds || [];
    updateOverrideMutation.mutate({
      id: override.id,
      data: { removedQuestionIds: currentRemoved.filter(id => id !== questionId) }
    });
  };

  const handleCreateOverride = () => {
    if (!selectedTemplateId) return;
    createOverrideMutation.mutate({
      clientId,
      baseTemplateId: selectedTemplateId,
    });
  };

  const handleAddQuestion = (overrideId: string, existingQuestionsCount: number) => {
    setEditingQuestion({
      ...DEFAULT_QUESTION,
      overrideId,
      order: existingQuestionsCount + 1,
    });
    setEditingQuestionIndex(existingQuestionsCount);
  };

  const handleEditQuestion = (question: ClientProjectTaskOverrideQuestion, overrideId: string, questionIndex: number) => {
    setEditingQuestion({
      id: question.id,
      overrideId,
      questionType: question.questionType as QuestionType,
      label: question.label,
      helpText: question.helpText || "",
      isRequired: question.isRequired || false,
      order: question.order,
      options: question.options || [],
      placeholder: question.placeholder || "",
      conditionalLogic: question.conditionalLogic as ConditionalLogic | null,
    });
    setEditingQuestionIndex(questionIndex);
  };

  const handleSaveQuestionFromModal = (updatedQuestion: EditingQuestion) => {
    if (!updatedQuestion.label.trim()) {
      toast({ title: "Please enter a question label", variant: "destructive" });
      return;
    }

    if (updatedQuestion.id) {
      const { id, overrideId, ...data } = updatedQuestion;
      updateQuestionMutation.mutate({ id, data });
    } else {
      createQuestionMutation.mutate(updatedQuestion);
    }
    setEditingQuestion(null);
    setEditingQuestionIndex(null);
  };

  const currentOverrideQuestions = useMemo(() => {
    if (!editingQuestion?.overrideId) return [];
    const override = overrides?.find(o => o.id === editingQuestion.overrideId);
    if (!override?.questions) return [];
    return override.questions.map((q, idx) => ({
      ...q,
      overrideId: editingQuestion.overrideId,
      conditionalLogic: q.conditionalLogic as ConditionalLogic | null,
    })) as EditingQuestion[];
  }, [editingQuestion?.overrideId, overrides]);

  if (overridesLoading || projectTypesLoading || clientServicesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const enrichedOverrides = (overrides || []).map(override => ({
    ...override,
    projectTypeName: projectTypes?.find(
      pt => pt.id === (override.baseTemplate as any)?.projectTypeId
    )?.name || "Unknown",
    templateName: (override.baseTemplate as any)?.name || "Unknown Template",
  }));

  return (
    <div className="space-y-6">
      <Separator className="my-8" />
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Client Project Task Overrides
          </h2>
          <p className="text-muted-foreground text-sm">
            Customize pre-work task templates for this specific client.
          </p>
        </div>
        <Button onClick={() => setIsCreatingOverride(true)} data-testid="button-create-task-override">
          <Plus className="w-4 h-4 mr-2" />
          Add Task Override
        </Button>
      </div>

      {enrichedOverrides.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No task overrides configured</h3>
            <p className="text-muted-foreground mb-4">
              This client uses the standard task templates for all project types.
            </p>
            <Button onClick={() => setIsCreatingOverride(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Task Override
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enrichedOverrides.map((override) => {
            const isExpanded = expandedOverrideId === override.id;
            const removedIds = override.removedQuestionIds || [];
            
            return (
              <Card key={override.id} data-testid={`card-task-override-${override.id}`}>
                <CardHeader 
                  className="cursor-pointer"
                  onClick={() => setExpandedOverrideId(isExpanded ? null : override.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <div>
                        <CardTitle className="text-base" data-testid={`text-override-template-${override.id}`}>
                          {override.name || override.templateName}
                        </CardTitle>
                        <CardDescription>
                          {override.projectTypeName}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {removedIds.length > 0 && (
                        <Badge variant="secondary">
                          {removedIds.length} removed
                        </Badge>
                      )}
                      {(override.questions?.length || 0) > 0 && (
                        <Badge variant="outline">
                          +{override.questions?.length} added
                        </Badge>
                      )}
                      <Badge variant="secondary">Override</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteOverrideId(override.id);
                        }}
                        data-testid={`button-delete-task-override-${override.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                {isExpanded && (
                  <CardContent className="pt-0 border-t">
                    <div className="pt-4 space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Settings2 className="w-4 h-4" />
                            Inherited Questions
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            From base template
                          </span>
                        </div>
                        
                        {baseTemplateQuestions && baseTemplateQuestions.length > 0 ? (
                          <div className="space-y-2">
                            {baseTemplateQuestions
                              .sort((a, b) => a.order - b.order)
                              .map((question) => {
                                const isRemoved = removedIds.includes(question.id);
                                const questionTypeInfo = QUESTION_TYPES.find(qt => qt.type === question.questionType);
                                const QuestionIcon = questionTypeInfo?.icon || Type;
                                const iconColor = questionTypeInfo?.color || "#6b7280";
                                
                                return (
                                  <div
                                    key={question.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border group ${
                                      isRemoved 
                                        ? "bg-muted/50 border-dashed" 
                                        : "bg-background"
                                    }`}
                                    data-testid={`inherited-question-${question.id}`}
                                  >
                                    <div 
                                      className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${isRemoved ? "opacity-50" : ""}`}
                                      style={{ backgroundColor: `${iconColor}15` }}
                                    >
                                      <QuestionIcon className="w-4 h-4" style={{ color: iconColor }} />
                                    </div>
                                    <div className={`flex-1 min-w-0 ${isRemoved ? "line-through text-muted-foreground" : ""}`}>
                                      <p className="font-medium text-sm truncate">{question.label}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge 
                                          variant="secondary" 
                                          className="text-xs"
                                          style={{ backgroundColor: isRemoved ? undefined : `${iconColor}15`, color: isRemoved ? undefined : iconColor }}
                                        >
                                          {questionTypeInfo?.label || question.questionType}
                                        </Badge>
                                        {question.isRequired && (
                                          <Badge variant="outline" className="text-xs">Required</Badge>
                                        )}
                                      </div>
                                    </div>
                                    {isRemoved ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRestoreQuestion(override, question.id)}
                                        data-testid={`button-restore-question-${question.id}`}
                                      >
                                        <Undo2 className="w-4 h-4 mr-1" />
                                        Restore
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveQuestion(override, question.id)}
                                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        data-testid={`button-remove-question-${question.id}`}
                                      >
                                        <MinusCircle className="w-4 h-4 mr-1" />
                                        Remove
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            Base template has no questions
                          </p>
                        )}
                      </div>

                      <Separator />

                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Additional Questions
                          </h4>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
                              onClick={() => openSystemLibraryPicker(override.id)}
                              data-testid="button-open-system-library-override"
                            >
                              <Library className="w-4 h-4 mr-2" />
                              From Library
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddQuestion(override.id, override.questions?.length || 0)}
                              data-testid="button-add-override-question"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Question
                            </Button>
                          </div>
                        </div>
                        
                        {override.questions && override.questions.length > 0 ? (
                          <div className="space-y-2">
                            {override.questions
                              .sort((a, b) => a.order - b.order)
                              .map((question, qIdx) => {
                                const questionTypeInfo = QUESTION_TYPES.find(qt => qt.type === question.questionType);
                                const QuestionIcon = questionTypeInfo?.icon || Type;
                                const iconColor = questionTypeInfo?.color || "#6b7280";
                                
                                return (
                                <div
                                  key={question.id}
                                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/50 hover:shadow-sm transition-all group"
                                  data-testid={`override-question-${question.id}`}
                                >
                                  <div 
                                    className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${iconColor}15` }}
                                  >
                                    <QuestionIcon className="w-4 h-4" style={{ color: iconColor }} />
                                  </div>
                                  <div 
                                    className="flex-1 cursor-pointer min-w-0"
                                    onClick={() => handleEditQuestion(question, override.id, qIdx)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-sm truncate">{question.label}</p>
                                      <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 flex-shrink-0">
                                        Client Override
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge 
                                        variant="secondary" 
                                        className="text-xs"
                                        style={{ backgroundColor: `${iconColor}15`, color: iconColor }}
                                      >
                                        {questionTypeInfo?.label || question.questionType}
                                      </Badge>
                                      {question.isRequired && (
                                        <Badge variant="outline" className="text-xs">Required</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setDeleteQuestionId(question.id)}
                                    data-testid={`button-delete-override-question-${question.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                                );
                              })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                            No additional questions. Add questions that are specific to this client.
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isCreatingOverride} onOpenChange={setIsCreatingOverride}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task Template Override</DialogTitle>
            <DialogDescription>
              Customize a task template for this client. The override inherits all questions from the base template, and you can add or remove questions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Type</label>
              <Select
                value={selectedProjectTypeId}
                onValueChange={(value) => {
                  setSelectedProjectTypeId(value);
                  setSelectedTemplateId("");
                }}
              >
                <SelectTrigger data-testid="select-project-type">
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProjectTypes.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No project types match this client's services
                    </div>
                  ) : (
                    filteredProjectTypes.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id}>
                        {pt.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedProjectTypeId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Task Template</label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger data-testid="select-template">
                    <SelectValue placeholder="Select task template" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No active templates for this project type
                      </div>
                    ) : (
                      activeTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingOverride(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateOverride}
              disabled={!selectedTemplateId || createOverrideMutation.isPending}
              data-testid="button-confirm-create-override"
            >
              {createOverrideMutation.isPending ? "Creating..." : "Create Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingQuestion && editingQuestionIndex !== null && (
        <ClientTaskOverrideQuestionConfigModal
          question={editingQuestion}
          questionIndex={editingQuestionIndex}
          allQuestions={currentOverrideQuestions}
          isOpen={true}
          onClose={() => {
            setEditingQuestion(null);
            setEditingQuestionIndex(null);
          }}
          onSave={handleSaveQuestionFromModal}
        />
      )}

      <AlertDialog open={!!deleteOverrideId} onOpenChange={() => setDeleteOverrideId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Task Override?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the custom task template override for this client. The client will use the standard template instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOverrideId && deleteOverrideMutation.mutate(deleteOverrideId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-task-override"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteQuestionId} onOpenChange={() => setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this question from the override. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteQuestionId && deleteQuestionMutation.mutate(deleteQuestionId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-question"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* System Field Library Picker */}
      <SystemFieldLibraryPicker
        open={systemLibraryPickerOpen}
        onOpenChange={setSystemLibraryPickerOpen}
        onSelectField={handleAddQuestionFromSystemLibrary}
        allowedFieldTypes={ALLOWED_SYSTEM_FIELD_TYPES}
        title="Pick from System Field Library"
        description="Select a pre-defined field from your company's reusable field library"
      />
    </div>
  );
}
