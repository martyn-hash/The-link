import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  Plus, ClipboardList, Edit, Trash2, GripVertical, Check, X, HelpCircle, Layers, Settings2,
  Type, FileText, Mail, Hash, Calendar, CircleDot, CheckSquare, ChevronDown, ToggleLeft, Upload
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import type { ProjectType, KanbanStage, ChangeReason, ClientProjectTaskTemplate, ClientProjectTaskQuestion, InsertClientProjectTaskQuestion } from "@shared/schema";

interface ClientTasksTabProps {
  projectType: ProjectType;
  projectTypeId: string | undefined;
  stages: KanbanStage[] | undefined;
  reasons: ChangeReason[] | undefined;
  isAdmin: boolean;
}

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

function PaletteItem({ label, icon: Icon, type }: { label: string; icon: React.ElementType; type: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type, label, icon: Icon, isPalette: true },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-3 py-2 bg-card border rounded-lg cursor-grab hover:bg-accent hover:border-primary transition-colors text-sm ${
        isDragging ? 'opacity-50' : ''
      }`}
      data-testid={`palette-item-${type}`}
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function SortableQuestionItem({
  question,
  onEdit,
  onDelete,
}: {
  question: ClientProjectTaskQuestion;
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
  } = useSortable({ id: question.id });

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
      data-testid={`question-item-${question.id}`}
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
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{question.label}</p>
          {question.helpText && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{question.helpText}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{questionTypeInfo?.label}</Badge>
          {question.isRequired && <Badge variant="secondary" className="text-xs">Required</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-1 ml-2">
        <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-question-${question.id}`}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} data-testid={`button-delete-question-${question.id}`}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function QuestionDropZone({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'questions-dropzone' });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] rounded-lg border-2 border-dashed transition-colors p-4 ${
        isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
      }`}
    >
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
          <Layers className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm font-medium">Drag questions here to build your form</p>
          <p className="text-xs mt-1">Questions will appear in the order you arrange them</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

interface QuestionEditorProps {
  question: Partial<InsertClientProjectTaskQuestion> & { id?: string };
  onSave: (data: Partial<InsertClientProjectTaskQuestion>) => void;
  onCancel: () => void;
  isPending: boolean;
}

function QuestionEditor({ question, onSave, onCancel, isPending }: QuestionEditorProps) {
  const [label, setLabel] = useState(question.label || '');
  const [helpText, setHelpText] = useState(question.helpText || '');
  const [placeholder, setPlaceholder] = useState(question.placeholder || '');
  const [isRequired, setIsRequired] = useState(question.isRequired ?? true);
  const [options, setOptions] = useState<string[]>(question.options || []);
  const [newOption, setNewOption] = useState('');

  const needsOptions = ['single_choice', 'multi_choice', 'dropdown'].includes(question.questionType || '');

  const handleAddOption = () => {
    if (newOption.trim()) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!label.trim()) return;
    onSave({
      ...question,
      label: label.trim(),
      helpText: helpText.trim() || null,
      placeholder: placeholder.trim() || null,
      isRequired,
      options: needsOptions ? options : null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="question-label">Question Label *</Label>
        <Input
          id="question-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Enter the question text"
          data-testid="input-question-label"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="question-help">Help Text</Label>
        <Textarea
          id="question-help"
          value={helpText}
          onChange={(e) => setHelpText(e.target.value)}
          placeholder="Optional help text for the client"
          rows={2}
          data-testid="input-question-help"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="question-placeholder">Placeholder</Label>
        <Input
          id="question-placeholder"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          placeholder="Optional placeholder text"
          data-testid="input-question-placeholder"
        />
      </div>

      {needsOptions && (
        <div className="space-y-2">
          <Label>Options</Label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input value={option} readOnly className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveOption(index)}
                  data-testid={`button-remove-option-${index}`}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Add an option"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
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
          checked={isRequired}
          onCheckedChange={setIsRequired}
          data-testid="switch-question-required"
        />
        <Label htmlFor="question-required">Required question</Label>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!label.trim() || isPending} data-testid="button-save-question">
          {isPending ? 'Saving...' : 'Save Question'}
        </Button>
      </DialogFooter>
    </div>
  );
}

interface TaskTemplateWithQuestions extends ClientProjectTaskTemplate {
  questions?: ClientProjectTaskQuestion[];
}

export function ClientTasksTab({
  projectType,
  projectTypeId,
  stages,
  reasons,
  isAdmin,
}: ClientTasksTabProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplateWithQuestions | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<InsertClientProjectTaskQuestion> & { id?: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'template' | 'question'; id: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    instructions: '',
    onCompletionStageId: null as string | null,
    onCompletionStageReasonId: null as string | null,
    requireAllQuestions: true,
    expiryDaysAfterStart: 7,
    isActive: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: templates = [], isLoading: templatesLoading } = useQuery<TaskTemplateWithQuestions[]>({
    queryKey: ['/api/client-project-tasks/templates', { projectTypeId }],
    enabled: !!projectTypeId,
  });

  const { data: questions = [], isLoading: questionsLoading, refetch: refetchQuestions } = useQuery<ClientProjectTaskQuestion[]>({
    queryKey: ['/api/client-project-tasks/questions', { templateId: selectedTemplate?.id }],
    enabled: !!selectedTemplate?.id,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateForm) => {
      return apiRequest('POST', '/api/client-project-tasks/templates', { ...data, projectTypeId });
    },
    onSuccess: (newTemplate: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-project-tasks/templates'] });
      setSelectedTemplate(newTemplate);
      setIsCreating(false);
      toast({ title: 'Task template created' });
    },
    onError: (error) => showFriendlyError({ error }),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateForm & { id: string }) => {
      return apiRequest('PATCH', `/api/client-project-tasks/templates/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-project-tasks/templates'] });
      toast({ title: 'Task template updated' });
    },
    onError: (error) => showFriendlyError({ error }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/client-project-tasks/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-project-tasks/templates'] });
      setSelectedTemplate(null);
      setDeleteConfirm(null);
      toast({ title: 'Task template deleted' });
    },
    onError: (error) => showFriendlyError({ error }),
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (data: InsertClientProjectTaskQuestion) => {
      return apiRequest('POST', '/api/client-project-tasks/questions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-project-tasks/questions'] });
      setEditingQuestion(null);
      toast({ title: 'Question added' });
    },
    onError: (error) => showFriendlyError({ error }),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async (data: Partial<InsertClientProjectTaskQuestion> & { id: string }) => {
      return apiRequest('PATCH', `/api/client-project-tasks/questions/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-project-tasks/questions'] });
      setEditingQuestion(null);
      toast({ title: 'Question updated' });
    },
    onError: (error) => showFriendlyError({ error }),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/client-project-tasks/questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-project-tasks/questions'] });
      setDeleteConfirm(null);
      toast({ title: 'Question deleted' });
    },
    onError: (error) => showFriendlyError({ error }),
  });

  const reorderQuestionsMutation = useMutation({
    mutationFn: async ({ questionId, newOrder }: { questionId: string; newOrder: number }) => {
      return apiRequest('PATCH', `/api/client-project-tasks/questions/${questionId}`, { order: newOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-project-tasks/questions'] });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    
    if (!over) return;

    const activeData = active.data.current;
    
    if (activeData?.isPalette && selectedTemplate) {
      const newQuestion: InsertClientProjectTaskQuestion = {
        templateId: selectedTemplate.id,
        questionType: activeData.type,
        label: `New ${activeData.label}`,
        order: questions.length + 1,
        isRequired: true,
        helpText: null,
        placeholder: null,
        options: null,
        conditionalLogic: null,
      };
      setEditingQuestion(newQuestion);
      return;
    }

    if (active.id !== over.id && !activeData?.isPalette) {
      const oldIndex = questions.findIndex(q => q.id === active.id);
      const newIndex = questions.findIndex(q => q.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedQuestions = arrayMove(questions, oldIndex, newIndex);
        for (let i = 0; i < reorderedQuestions.length; i++) {
          if (reorderedQuestions[i].order !== i + 1) {
            await reorderQuestionsMutation.mutateAsync({
              questionId: reorderedQuestions[i].id,
              newOrder: i + 1,
            });
          }
        }
      }
    }
  };

  const handleCreateTemplate = () => {
    setIsCreating(true);
    setTemplateForm({
      name: '',
      description: '',
      instructions: '',
      onCompletionStageId: null,
      onCompletionStageReasonId: null,
      requireAllQuestions: true,
      expiryDaysAfterStart: 7,
      isActive: true,
    });
  };

  const handleSelectTemplate = (template: TaskTemplateWithQuestions) => {
    setSelectedTemplate(template);
    setIsCreating(false);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      instructions: template.instructions || '',
      onCompletionStageId: template.onCompletionStageId,
      onCompletionStageReasonId: template.onCompletionStageReasonId,
      requireAllQuestions: template.requireAllQuestions ?? true,
      expiryDaysAfterStart: template.expiryDaysAfterStart ?? 7,
      isActive: template.isActive ?? true,
    });
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name.trim()) return;
    
    if (selectedTemplate?.id) {
      updateTemplateMutation.mutate({ ...templateForm, id: selectedTemplate.id });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const handleSaveQuestion = (data: Partial<InsertClientProjectTaskQuestion>) => {
    if (editingQuestion?.id) {
      updateQuestionMutation.mutate({ ...data, id: editingQuestion.id } as any);
    } else if (selectedTemplate) {
      createQuestionMutation.mutate({
        ...data,
        templateId: selectedTemplate.id,
        order: questions.length + 1,
      } as InsertClientProjectTaskQuestion);
    }
  };

  const activeQuestion = activeId ? questions.find(q => q.id === activeId) : null;

  return (
    <TabsContent value="client-tasks" className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Client Tasks</h2>
        <p className="text-muted-foreground">
          Configure pre-work checklists that clients complete before project work begins
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Task Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {templatesLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : templates.length === 0 && !isCreating ? (
                <p className="text-sm text-muted-foreground">No templates yet</p>
              ) : (
                templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      selectedTemplate?.id === template.id
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:bg-accent'
                    }`}
                    data-testid={`template-item-${template.id}`}
                  >
                    <p className="font-medium text-sm truncate">{template.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={template.isActive ? "default" : "secondary"} className="text-xs">
                        {template.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCreateTemplate}
                data-testid="button-add-template"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Template
              </Button>
            </CardContent>
          </Card>

          {(selectedTemplate || isCreating) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Question Types
                </CardTitle>
                <CardDescription className="text-xs">
                  Drag to add to form
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {QUESTION_TYPES.map(qt => (
                  <PaletteItem key={qt.type} type={qt.type} label={qt.label} icon={qt.icon} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="col-span-6">
          {!selectedTemplate && !isCreating ? (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">Select or create a template</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose an existing template from the left or create a new one
                </p>
                <Button onClick={handleCreateTemplate} data-testid="button-create-first-template">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </div>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {isCreating ? 'New Task Template' : 'Questions'}
                  </CardTitle>
                  <CardDescription>
                    {isCreating ? 'Configure the template settings first, then add questions' : 'Drag and drop to reorder questions'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedTemplate && !isCreating ? (
                    <QuestionDropZone isEmpty={questions.length === 0}>
                      <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {questions.map(question => (
                            <SortableQuestionItem
                              key={question.id}
                              question={question}
                              onEdit={() => setEditingQuestion({ ...question, conditionalLogic: question.conditionalLogic as any })}
                              onDelete={() => setDeleteConfirm({ type: 'question', id: question.id })}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </QuestionDropZone>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Save the template settings first, then you can add questions</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <DragOverlay>
                {activeQuestion && (
                  <div className="px-4 py-3 bg-card border rounded-lg shadow-lg">
                    <p className="text-sm font-medium">{activeQuestion.label}</p>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        <div className="col-span-3">
          {(selectedTemplate || isCreating) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  Template Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Template Name *</Label>
                  <Input
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g., Pre-Work Checklist"
                    data-testid="input-template-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description of this task"
                    rows={2}
                    data-testid="input-template-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Client Instructions</Label>
                  <Textarea
                    value={templateForm.instructions}
                    onChange={(e) => setTemplateForm(f => ({ ...f, instructions: e.target.value }))}
                    placeholder="Instructions shown to the client at the top of the form"
                    rows={3}
                    data-testid="input-template-instructions"
                  />
                </div>

                <div className="space-y-2">
                  <Label>On Completion - Move to Stage</Label>
                  <Select
                    value={templateForm.onCompletionStageId || "none"}
                    onValueChange={(v) => setTemplateForm(f => ({ ...f, onCompletionStageId: v === "none" ? null : v }))}
                  >
                    <SelectTrigger data-testid="select-completion-stage">
                      <SelectValue placeholder="No stage change" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No stage change</SelectItem>
                      {stages?.map(stage => (
                        <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {templateForm.onCompletionStageId && (
                  <div className="space-y-2">
                    <Label>Stage Change Reason</Label>
                    <Select
                      value={templateForm.onCompletionStageReasonId || "none"}
                      onValueChange={(v) => setTemplateForm(f => ({ ...f, onCompletionStageReasonId: v === "none" ? null : v }))}
                    >
                      <SelectTrigger data-testid="select-completion-reason">
                        <SelectValue placeholder="No reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No reason</SelectItem>
                        {reasons?.map(reason => (
                          <SelectItem key={reason.id} value={reason.id}>{reason.reason}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Link Expiry (days after project start)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={templateForm.expiryDaysAfterStart}
                    onChange={(e) => setTemplateForm(f => ({ ...f, expiryDaysAfterStart: parseInt(e.target.value) || 7 }))}
                    data-testid="input-expiry-days"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={templateForm.requireAllQuestions}
                    onCheckedChange={(v) => setTemplateForm(f => ({ ...f, requireAllQuestions: v }))}
                    data-testid="switch-require-all"
                  />
                  <Label>Require all questions</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={templateForm.isActive}
                    onCheckedChange={(v) => setTemplateForm(f => ({ ...f, isActive: v }))}
                    data-testid="switch-template-active"
                  />
                  <Label>Template active</Label>
                </div>

                <div className="pt-4 space-y-2">
                  <Button
                    className="w-full"
                    onClick={handleSaveTemplate}
                    disabled={!templateForm.name.trim() || createTemplateMutation.isPending || updateTemplateMutation.isPending}
                    data-testid="button-save-template"
                  >
                    {createTemplateMutation.isPending || updateTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
                  </Button>
                  
                  {selectedTemplate && !isCreating && (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => setDeleteConfirm({ type: 'template', id: selectedTemplate.id })}
                      data-testid="button-delete-template"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Template
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={!!editingQuestion} onOpenChange={(open) => !open && setEditingQuestion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingQuestion?.id ? 'Edit Question' : 'Add Question'}
            </DialogTitle>
            <DialogDescription>
              Configure the question settings
            </DialogDescription>
          </DialogHeader>
          {editingQuestion && (
            <QuestionEditor
              question={editingQuestion}
              onSave={handleSaveQuestion}
              onCancel={() => setEditingQuestion(null)}
              isPending={createQuestionMutation.isPending || updateQuestionMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteConfirm?.type === 'template' ? 'Template' : 'Question'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. {deleteConfirm?.type === 'template' 
                ? 'All questions in this template will also be deleted.'
                : 'The question will be removed from the template.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm?.type === 'template') {
                  deleteTemplateMutation.mutate(deleteConfirm.id);
                } else if (deleteConfirm?.type === 'question') {
                  deleteQuestionMutation.mutate(deleteConfirm.id);
                }
              }}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  );
}
