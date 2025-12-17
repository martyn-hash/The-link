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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Plus, Edit2, Trash2, Save, X, ClipboardList, GripVertical,
  Type, FileText, Mail, Hash, Calendar, CircleDot, CheckSquare, 
  ChevronDown, ToggleLeft, Upload, HelpCircle
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { 
  ClientProjectTaskTemplateWithRelations, 
  ClientProjectTaskQuestion,
  KanbanStage,
  ChangeReason 
} from "@shared/schema";

const QUESTION_TYPES = [
  { type: "short_text", label: "Short Text", icon: Type },
  { type: "long_text", label: "Long Text", icon: FileText },
  { type: "email", label: "Email", icon: Mail },
  { type: "number", label: "Number", icon: Hash },
  { type: "date", label: "Date", icon: Calendar },
  { type: "single_choice", label: "Single Choice", icon: CircleDot },
  { type: "multi_choice", label: "Multi Choice", icon: CheckSquare },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown },
  { type: "yes_no", label: "Yes/No", icon: ToggleLeft },
  { type: "file_upload", label: "File Upload", icon: Upload },
] as const;

type QuestionType = typeof QUESTION_TYPES[number]["type"];

interface EditingQuestion {
  id?: string;
  questionType: QuestionType;
  label: string;
  helpText: string;
  isRequired: boolean;
  order: number;
  options: string[];
  placeholder: string;
}

interface EditingTemplate {
  id?: string;
  name: string;
  description: string;
  instructions: string;
  onCompletionStageId: string | null;
  onCompletionStageReasonId: string | null;
  requireAllQuestions: boolean;
  expiryDaysAfterStart: number;
  isActive: boolean;
  questions: EditingQuestion[];
}

const DEFAULT_QUESTION: EditingQuestion = {
  questionType: "short_text",
  label: "",
  helpText: "",
  isRequired: false,
  order: 0,
  options: [],
  placeholder: "",
};

const DEFAULT_TEMPLATE: EditingTemplate = {
  name: "",
  description: "",
  instructions: "",
  onCompletionStageId: null,
  onCompletionStageReasonId: null,
  requireAllQuestions: true,
  expiryDaysAfterStart: 7,
  isActive: true,
  questions: [],
};

interface ClientTasksTabProps {
  projectTypeId: string;
  stages?: KanbanStage[];
  reasons?: ChangeReason[];
}

function PaletteItem({ type, label, icon: Icon, onClick }: { type: string; label: string; icon: React.ElementType; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type, label, isNew: true },
  });

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`flex items-center gap-2 px-3 py-2 bg-card border rounded-lg cursor-pointer hover:bg-accent hover:border-primary transition-colors text-sm ${
        isDragging ? 'opacity-50' : ''
      }`}
      data-testid={`palette-question-${type}`}
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span>{label}</span>
    </div>
  );
}

function SortableQuestionItem({
  question,
  onEdit,
  onDelete,
}: {
  question: EditingQuestion;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: question.id || `temp-${question.order}`,
    data: { type: 'question', question },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const questionTypeInfo = QUESTION_TYPES.find(qt => qt.type === question.questionType);
  const QuestionIcon = questionTypeInfo?.icon || Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between px-4 py-3 bg-card border rounded-lg hover:border-primary/50 transition-colors"
      data-testid={`question-item-${question.id || question.order}`}
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <QuestionIcon className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium">{question.label || "Untitled question"}</p>
          {question.helpText && (
            <p className="text-xs text-muted-foreground mt-0.5">{question.helpText}</p>
          )}
        </div>
        <Badge variant="outline" className="text-xs">
          {questionTypeInfo?.label || question.questionType}
        </Badge>
        {question.isRequired && (
          <Badge variant="secondary" className="text-xs">Required</Badge>
        )}
      </div>
      <div className="flex items-center gap-1 ml-2">
        <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-question-${question.order}`}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive" data-testid={`button-delete-question-${question.order}`}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function QuestionEditor({
  question,
  onSave,
  onCancel,
}: {
  question: EditingQuestion;
  onSave: (q: EditingQuestion) => void;
  onCancel: () => void;
}) {
  const [editedQuestion, setEditedQuestion] = useState<EditingQuestion>(question);
  const [newOption, setNewOption] = useState("");

  const needsOptions = ["single_choice", "multi_choice", "dropdown"].includes(editedQuestion.questionType);

  const handleAddOption = () => {
    if (newOption.trim()) {
      setEditedQuestion(prev => ({
        ...prev,
        options: [...prev.options, newOption.trim()]
      }));
      setNewOption("");
    }
  };

  const handleRemoveOption = (index: number) => {
    setEditedQuestion(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="question-type">Question Type</Label>
            <Select
              value={editedQuestion.questionType}
              onValueChange={(value) => setEditedQuestion(prev => ({ ...prev, questionType: value as QuestionType }))}
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
              value={editedQuestion.label}
              onChange={(e) => setEditedQuestion(prev => ({ ...prev, label: e.target.value }))}
              placeholder="Enter your question here"
              data-testid="input-question-label"
            />
          </div>

          <div>
            <Label htmlFor="question-help">Help Text</Label>
            <Textarea
              id="question-help"
              value={editedQuestion.helpText}
              onChange={(e) => setEditedQuestion(prev => ({ ...prev, helpText: e.target.value }))}
              placeholder="Optional help text for the client"
              rows={2}
              data-testid="input-question-help"
            />
          </div>

          <div>
            <Label htmlFor="question-placeholder">Placeholder</Label>
            <Input
              id="question-placeholder"
              value={editedQuestion.placeholder}
              onChange={(e) => setEditedQuestion(prev => ({ ...prev, placeholder: e.target.value }))}
              placeholder="Placeholder text"
              data-testid="input-question-placeholder"
            />
          </div>

          {needsOptions && (
            <div>
              <Label>Options</Label>
              <div className="space-y-2 mt-2">
                {editedQuestion.options.map((opt, index) => (
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
              checked={editedQuestion.isRequired}
              onCheckedChange={(checked) => setEditedQuestion(prev => ({ ...prev, isRequired: checked }))}
              data-testid="switch-question-required"
            />
            <Label htmlFor="question-required">Required</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-question">
            Cancel
          </Button>
          <Button 
            onClick={() => onSave(editedQuestion)} 
            disabled={!editedQuestion.label.trim()}
            data-testid="button-save-question"
          >
            Save Question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientTasksTab({ projectTypeId, stages = [], reasons = [] }: ClientTasksTabProps) {
  const { toast } = useToast();
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EditingTemplate | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: templates, isLoading: templatesLoading } = useQuery<ClientProjectTaskTemplateWithRelations[]>({
    queryKey: ["/api/project-types", projectTypeId, "task-templates"],
    queryFn: async () => {
      const res = await fetch(`/api/project-types/${projectTypeId}/task-templates`);
      if (!res.ok) throw new Error("Failed to fetch task templates");
      return res.json();
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: { template: Omit<EditingTemplate, "questions">; questions: EditingQuestion[] }) => {
      console.log("[ClientTasks] Creating template with", data.questions.length, "questions");
      
      const templateRes = await apiRequest("POST", "/api/task-templates", {
        ...data.template,
        projectTypeId,
      });
      const template = templateRes as { id: string };
      
      if (!template?.id) {
        throw new Error("Failed to create template - no ID returned");
      }
      
      console.log("[ClientTasks] Template created with ID:", template.id);
      
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        console.log("[ClientTasks] Creating question", i, ":", q.label);
        await apiRequest("POST", "/api/task-template-questions", {
          templateId: template.id,
          questionType: q.questionType,
          label: q.label,
          helpText: q.helpText || null,
          isRequired: q.isRequired,
          order: i,
          options: q.options.length > 0 ? q.options : null,
          placeholder: q.placeholder || null,
        });
      }
      
      console.log("[ClientTasks] All questions created successfully");
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-types", projectTypeId, "task-templates"] });
      setIsBuilderOpen(false);
      setEditingTemplate(null);
      toast({ title: "Template created", description: "The task template has been created successfully." });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: { template: EditingTemplate; questions: EditingQuestion[] }) => {
      const { id, questions: _, ...templateData } = data.template;
      await apiRequest("PATCH", `/api/task-templates/${id}`, templateData);
      
      const existingTemplate = templates?.find(t => t.id === id);
      const existingQuestionIds = (existingTemplate?.questions || []).map(q => q.id);
      const newQuestionIds = data.questions.filter(q => q.id).map(q => q.id);
      
      for (const qId of existingQuestionIds) {
        if (!newQuestionIds.includes(qId)) {
          await apiRequest("DELETE", `/api/task-template-questions/${qId}`);
        }
      }
      
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        const questionData = {
          templateId: id,
          questionType: q.questionType,
          label: q.label,
          helpText: q.helpText || null,
          isRequired: q.isRequired,
          order: i,
          options: q.options.length > 0 ? q.options : null,
          placeholder: q.placeholder || null,
        };
        
        if (q.id) {
          await apiRequest("PATCH", `/api/task-template-questions/${q.id}`, questionData);
        } else {
          await apiRequest("POST", "/api/task-template-questions", questionData);
        }
      }
      
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-types", projectTypeId, "task-templates"] });
      setIsBuilderOpen(false);
      setEditingTemplate(null);
      toast({ title: "Template updated", description: "The task template has been updated successfully." });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiRequest("DELETE", `/api/task-templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-types", projectTypeId, "task-templates"] });
      setDeleteTemplateId(null);
      toast({ title: "Template deleted" });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const handleAddTemplate = () => {
    setEditingTemplate({ ...DEFAULT_TEMPLATE });
    setIsBuilderOpen(true);
  };

  const handleEditTemplate = (template: ClientProjectTaskTemplateWithRelations) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      description: template.description || "",
      instructions: template.instructions || "",
      onCompletionStageId: template.onCompletionStageId,
      onCompletionStageReasonId: template.onCompletionStageReasonId,
      requireAllQuestions: template.requireAllQuestions ?? true,
      expiryDaysAfterStart: template.expiryDaysAfterStart ?? 7,
      isActive: template.isActive ?? true,
      questions: (template.questions || []).map(q => ({
        id: q.id,
        questionType: q.questionType as QuestionType,
        label: q.label,
        helpText: q.helpText || "",
        isRequired: q.isRequired ?? false,
        order: q.order,
        options: q.options || [],
        placeholder: q.placeholder || "",
      })),
    });
    setIsBuilderOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    
    const { questions, ...templateData } = editingTemplate;
    console.log("[ClientTasks] handleSaveTemplate called with", questions.length, "questions:", questions.map(q => q.label));
    
    if (editingTemplate.id) {
      updateTemplateMutation.mutate({ template: editingTemplate, questions });
    } else {
      createTemplateMutation.mutate({ template: templateData, questions });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !editingTemplate) return;

    if (active.id.toString().startsWith('palette-')) {
      const questionType = active.data.current?.type as QuestionType;
      const newQuestion: EditingQuestion = {
        ...DEFAULT_QUESTION,
        questionType,
        order: editingTemplate.questions.length,
      };
      setEditingTemplate(prev => prev ? {
        ...prev,
        questions: [...prev.questions, newQuestion]
      } : null);
      setEditingQuestionIndex(editingTemplate.questions.length);
      return;
    }

    const activeIndex = editingTemplate.questions.findIndex(
      q => (q.id || `temp-${q.order}`) === active.id
    );
    const overIndex = editingTemplate.questions.findIndex(
      q => (q.id || `temp-${q.order}`) === over.id
    );

    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      setEditingTemplate(prev => prev ? {
        ...prev,
        questions: arrayMove(prev.questions, activeIndex, overIndex).map((q, i) => ({ ...q, order: i }))
      } : null);
    }
  };

  const handleSaveQuestion = (updatedQuestion: EditingQuestion) => {
    if (!editingTemplate || editingQuestionIndex === null) return;
    
    setEditingTemplate(prev => {
      if (!prev) return null;
      const newQuestions = [...prev.questions];
      newQuestions[editingQuestionIndex] = updatedQuestion;
      return { ...prev, questions: newQuestions };
    });
    setEditingQuestionIndex(null);
  };

  const handleAddQuestion = (questionType: QuestionType) => {
    if (!editingTemplate) return;
    
    const newQuestion: EditingQuestion = {
      ...DEFAULT_QUESTION,
      questionType,
      order: editingTemplate.questions.length,
    };
    
    setEditingTemplate(prev => prev ? {
      ...prev,
      questions: [...prev.questions, newQuestion]
    } : null);
    
    setEditingQuestionIndex(editingTemplate.questions.length);
  };

  const handleDeleteQuestion = (index: number) => {
    setEditingTemplate(prev => {
      if (!prev) return null;
      const newQuestions = prev.questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i }));
      return { ...prev, questions: newQuestions };
    });
  };

  if (templatesLoading) {
    return (
      <TabsContent value="client-tasks" className="page-container py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </TabsContent>
    );
  }

  if (isBuilderOpen && editingTemplate) {
    return (
      <TabsContent value="client-tasks" className="h-full">
        <div className="flex flex-col h-full">
          <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => { setIsBuilderOpen(false); setEditingTemplate(null); }}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <h2 className="text-lg font-semibold">
                {editingTemplate.id ? "Edit Task Template" : "Create Task Template"}
              </h2>
            </div>
            <Button 
              onClick={handleSaveTemplate} 
              disabled={!editingTemplate.name.trim() || createTemplateMutation.isPending || updateTemplateMutation.isPending}
              data-testid="button-save-template"
            >
              <Save className="w-4 h-4 mr-2" />
              {createTemplateMutation.isPending || updateTemplateMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="w-64 border-r border-border bg-muted/30 p-4 overflow-y-auto">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Question Types
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Click or drag questions to add them</p>
              <div className="space-y-2">
                {QUESTION_TYPES.map(qt => (
                  <PaletteItem 
                    key={qt.type} 
                    type={qt.type} 
                    label={qt.label} 
                    icon={qt.icon}
                    onClick={() => handleAddQuestion(qt.type as QuestionType)}
                  />
                ))}
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-2xl mx-auto space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Template Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="template-name">Name *</Label>
                        <Input
                          id="template-name"
                          value={editingTemplate.name}
                          onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                          placeholder="e.g., Pre-Bookkeeping Checklist"
                          data-testid="input-template-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="template-description">Description</Label>
                        <Textarea
                          id="template-description"
                          value={editingTemplate.description}
                          onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, description: e.target.value } : null)}
                          placeholder="Internal description of this template"
                          rows={2}
                          data-testid="input-template-description"
                        />
                      </div>
                      <div>
                        <Label htmlFor="template-instructions">Instructions for Client</Label>
                        <Textarea
                          id="template-instructions"
                          value={editingTemplate.instructions}
                          onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, instructions: e.target.value } : null)}
                          placeholder="Instructions displayed to the client at the top of the form"
                          rows={3}
                          data-testid="input-template-instructions"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="completion-stage">On Completion: Move to Stage</Label>
                          <Select
                            value={editingTemplate.onCompletionStageId || "none"}
                            onValueChange={(value) => setEditingTemplate(prev => prev ? { 
                              ...prev, 
                              onCompletionStageId: value === "none" ? null : value 
                            } : null)}
                          >
                            <SelectTrigger id="completion-stage" data-testid="select-completion-stage">
                              <SelectValue placeholder="No stage change" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No stage change</SelectItem>
                              {stages.map(stage => (
                                <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="completion-reason">With Reason</Label>
                          <Select
                            value={editingTemplate.onCompletionStageReasonId || "none"}
                            onValueChange={(value) => setEditingTemplate(prev => prev ? { 
                              ...prev, 
                              onCompletionStageReasonId: value === "none" ? null : value 
                            } : null)}
                            disabled={!editingTemplate.onCompletionStageId}
                          >
                            <SelectTrigger id="completion-reason" data-testid="select-completion-reason">
                              <SelectValue placeholder="No reason" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No reason</SelectItem>
                              {reasons.map(reason => (
                                <SelectItem key={reason.id} value={reason.id}>{reason.reason}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="expiry-days">Link Expires After (days)</Label>
                          <Input
                            id="expiry-days"
                            type="number"
                            min={1}
                            max={365}
                            value={editingTemplate.expiryDaysAfterStart}
                            onChange={(e) => setEditingTemplate(prev => prev ? { 
                              ...prev, 
                              expiryDaysAfterStart: parseInt(e.target.value) || 7 
                            } : null)}
                            data-testid="input-expiry-days"
                          />
                        </div>
                        <div className="flex items-end gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              id="require-all"
                              checked={editingTemplate.requireAllQuestions}
                              onCheckedChange={(checked) => setEditingTemplate(prev => prev ? { 
                                ...prev, 
                                requireAllQuestions: checked 
                              } : null)}
                              data-testid="switch-require-all"
                            />
                            <Label htmlFor="require-all" className="text-sm">Require all questions</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              id="is-active"
                              checked={editingTemplate.isActive}
                              onCheckedChange={(checked) => setEditingTemplate(prev => prev ? { 
                                ...prev, 
                                isActive: checked 
                              } : null)}
                              data-testid="switch-is-active"
                            />
                            <Label htmlFor="is-active" className="text-sm">Active</Label>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Questions</CardTitle>
                      <CardDescription>
                        Drag question types from the left panel to add them, or drag to reorder
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {editingTemplate.questions.length === 0 ? (
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                          <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                          <p className="text-sm text-muted-foreground">
                            Drag question types from the left panel to add them to your form
                          </p>
                        </div>
                      ) : (
                        <SortableContext
                          items={editingTemplate.questions.map(q => q.id || `temp-${q.order}`)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {editingTemplate.questions.map((question, index) => (
                              <SortableQuestionItem
                                key={question.id || `temp-${index}`}
                                question={question}
                                onEdit={() => setEditingQuestionIndex(index)}
                                onDelete={() => handleDeleteQuestion(index)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </DndContext>
          </div>
        </div>

        {editingQuestionIndex !== null && editingTemplate.questions[editingQuestionIndex] && (
          <QuestionEditor
            question={editingTemplate.questions[editingQuestionIndex]}
            onSave={handleSaveQuestion}
            onCancel={() => setEditingQuestionIndex(null)}
          />
        )}
      </TabsContent>
    );
  }

  return (
    <TabsContent value="client-tasks" className="page-container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Client Task Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create pre-work checklists that clients must complete before work begins
          </p>
        </div>
        <Button onClick={handleAddTemplate} data-testid="button-add-template">
          <Plus className="w-4 h-4 mr-2" />
          Add Template
        </Button>
      </div>

      {!templates || templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No task templates yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a task template to send pre-work checklists to clients
            </p>
            <Button onClick={handleAddTemplate} data-testid="button-add-template-empty">
              <Plus className="w-4 h-4 mr-2" />
              Create First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map(template => (
            <Card key={template.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium" data-testid={`text-template-name-${template.id}`}>
                        {template.name}
                      </h3>
                      <Badge variant={template.isActive ? "default" : "secondary"}>
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{template.questions?.length || 0} questions</span>
                      <span>Expires after {template.expiryDaysAfterStart} days</span>
                      {template.onCompletionStage && (
                        <span>Moves to: {template.onCompletionStage.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEditTemplate(template)}
                      data-testid={`button-edit-template-${template.id}`}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive"
                      onClick={() => setDeleteTemplateId(template.id)}
                      data-testid={`button-delete-template-${template.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this task template and all its questions. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplateId && deleteTemplateMutation.mutate(deleteTemplateId)}
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
