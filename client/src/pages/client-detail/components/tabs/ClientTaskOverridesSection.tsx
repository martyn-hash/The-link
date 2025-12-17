import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  X,
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
} from "lucide-react";
import type {
  ProjectType,
  ClientProjectTaskTemplateWithRelations,
  ClientProjectTaskOverrideWithRelations,
  ClientProjectTaskQuestion,
  ClientProjectTaskOverrideQuestion,
} from "@shared/schema";

interface ClientTaskOverridesSectionProps {
  clientId: string;
}

type QuestionType = "short_text" | "long_text" | "number" | "date" | "single_choice" | "multi_choice" | "yes_no" | "dropdown" | "file_upload" | "email";

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
}

const QUESTION_TYPES = [
  { type: "short_text" as QuestionType, label: "Short Text", icon: Type },
  { type: "long_text" as QuestionType, label: "Long Text", icon: AlignLeft },
  { type: "email" as QuestionType, label: "Email", icon: Mail },
  { type: "number" as QuestionType, label: "Number", icon: Hash },
  { type: "date" as QuestionType, label: "Date", icon: Calendar },
  { type: "single_choice" as QuestionType, label: "Single Choice", icon: CheckSquare },
  { type: "multi_choice" as QuestionType, label: "Multiple Choice", icon: List },
  { type: "yes_no" as QuestionType, label: "Yes/No", icon: ToggleLeft },
  { type: "dropdown" as QuestionType, label: "Dropdown", icon: ChevronDownSquare },
  { type: "file_upload" as QuestionType, label: "File Upload", icon: Upload },
];

const DEFAULT_QUESTION: Omit<EditingQuestion, 'overrideId'> = {
  questionType: "short_text",
  label: "",
  helpText: "",
  isRequired: false,
  order: 1,
  options: [],
  placeholder: "",
};

export function ClientTaskOverridesSection({ clientId }: ClientTaskOverridesSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreatingOverride, setIsCreatingOverride] = useState(false);
  const [selectedProjectTypeId, setSelectedProjectTypeId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [expandedOverrideId, setExpandedOverrideId] = useState<string | null>(null);
  const [deleteOverrideId, setDeleteOverrideId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<EditingQuestion | null>(null);
  const [newOption, setNewOption] = useState("");
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);

  const { data: projectTypes, isLoading: projectTypesLoading } = useQuery<ProjectType[]>({
    queryKey: ["/api/config/project-types"],
  });

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
  };

  const handleEditQuestion = (question: ClientProjectTaskOverrideQuestion, overrideId: string) => {
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
    });
  };

  const handleSaveQuestion = () => {
    if (!editingQuestion || !editingQuestion.label.trim()) {
      toast({ title: "Please enter a question label", variant: "destructive" });
      return;
    }

    if (editingQuestion.id) {
      const { id, overrideId, ...data } = editingQuestion;
      updateQuestionMutation.mutate({ id, data });
    } else {
      createQuestionMutation.mutate(editingQuestion);
    }
  };

  const handleAddOption = () => {
    if (newOption.trim() && editingQuestion) {
      setEditingQuestion({
        ...editingQuestion,
        options: [...editingQuestion.options, newOption.trim()]
      });
      setNewOption("");
    }
  };

  const handleRemoveOption = (index: number) => {
    if (editingQuestion) {
      setEditingQuestion({
        ...editingQuestion,
        options: editingQuestion.options.filter((_, i) => i !== index)
      });
    }
  };

  const needsOptions = editingQuestion && ["single_choice", "multi_choice", "dropdown"].includes(editingQuestion.questionType);

  if (overridesLoading || projectTypesLoading) {
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
                                
                                return (
                                  <div
                                    key={question.id}
                                    className={`flex items-center justify-between p-3 rounded-lg border ${
                                      isRemoved 
                                        ? "bg-muted/50 border-dashed" 
                                        : "bg-background"
                                    }`}
                                    data-testid={`inherited-question-${question.id}`}
                                  >
                                    <div className={`flex-1 ${isRemoved ? "line-through text-muted-foreground" : ""}`}>
                                      <p className="font-medium text-sm">{question.label}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-xs">
                                          {question.questionType}
                                        </Badge>
                                        {question.isRequired && (
                                          <Badge variant="secondary" className="text-xs">Required</Badge>
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
                                        className="text-muted-foreground hover:text-destructive"
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
                        
                        {override.questions && override.questions.length > 0 ? (
                          <div className="space-y-2">
                            {override.questions
                              .sort((a, b) => a.order - b.order)
                              .map((question) => (
                                <div
                                  key={question.id}
                                  className="flex items-center justify-between p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20"
                                  data-testid={`override-question-${question.id}`}
                                >
                                  <div 
                                    className="flex-1 cursor-pointer"
                                    onClick={() => handleEditQuestion(question, override.id)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-sm">{question.label}</p>
                                      <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900">
                                        Client Override
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs">
                                        {question.questionType}
                                      </Badge>
                                      {question.isRequired && (
                                        <Badge variant="secondary" className="text-xs">Required</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteQuestionId(question.id)}
                                    data-testid={`button-delete-override-question-${question.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
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
                  {projectTypes?.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name}
                    </SelectItem>
                  ))}
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

      <Dialog open={!!editingQuestion} onOpenChange={() => setEditingQuestion(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuestion?.id ? "Edit Question" : "Add Question"}</DialogTitle>
          </DialogHeader>
          
          {editingQuestion && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="question-type">Question Type</Label>
                <Select
                  value={editingQuestion.questionType}
                  onValueChange={(value) => setEditingQuestion({ ...editingQuestion, questionType: value as QuestionType })}
                >
                  <SelectTrigger id="question-type" data-testid="select-question-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map(qt => (
                      <SelectItem key={qt.type} value={qt.type}>
                        <div className="flex items-center gap-2">
                          <qt.icon className="w-4 h-4" />
                          {qt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="question-label">Question Label *</Label>
                <Input
                  id="question-label"
                  value={editingQuestion.label}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, label: e.target.value })}
                  placeholder="Enter your question here"
                  data-testid="input-question-label"
                />
              </div>

              <div>
                <Label htmlFor="question-help">Help Text</Label>
                <Textarea
                  id="question-help"
                  value={editingQuestion.helpText}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, helpText: e.target.value })}
                  placeholder="Optional help text for the client"
                  rows={2}
                  data-testid="input-question-help"
                />
              </div>

              <div>
                <Label htmlFor="question-placeholder">Placeholder</Label>
                <Input
                  id="question-placeholder"
                  value={editingQuestion.placeholder}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, placeholder: e.target.value })}
                  placeholder="Placeholder text"
                  data-testid="input-question-placeholder"
                />
              </div>

              {needsOptions && (
                <div>
                  <Label>Options</Label>
                  <div className="space-y-2 mt-2">
                    {editingQuestion.options.map((opt, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input value={opt} disabled className="flex-1" />
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveOption(index)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Input
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        placeholder="Add option"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddOption()}
                        data-testid="input-new-option"
                      />
                      <Button variant="outline" size="sm" onClick={handleAddOption} data-testid="button-add-option">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  id="question-required"
                  checked={editingQuestion.isRequired}
                  onCheckedChange={(checked) => setEditingQuestion({ ...editingQuestion, isRequired: checked })}
                  data-testid="switch-question-required"
                />
                <Label htmlFor="question-required">Required</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingQuestion(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveQuestion}
              disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
              data-testid="button-save-question"
            >
              {(createQuestionMutation.isPending || updateQuestionMutation.isPending) ? "Saving..." : "Save Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
