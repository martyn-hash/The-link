import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Edit, Trash2, GripVertical, HelpCircle } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TopNavigation from "@/components/top-navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientRequestTemplateQuestion, ClientRequestTemplateSection, ClientRequestTemplate } from "@shared/schema";

const QUESTION_TYPES = [
  { value: "short_text", label: "Short Text", description: "Single line text input" },
  { value: "long_text", label: "Long Text", description: "Multi-line text area" },
  { value: "email", label: "Email", description: "Email address input" },
  { value: "number", label: "Number", description: "Numeric input" },
  { value: "date", label: "Date", description: "Date picker" },
  { value: "single_choice", label: "Single Choice", description: "Radio buttons (choose one)" },
  { value: "multi_choice", label: "Multiple Choice", description: "Checkboxes (choose many)" },
  { value: "dropdown", label: "Dropdown", description: "Select dropdown menu" },
  { value: "yes_no", label: "Yes/No", description: "Boolean yes/no question" },
  { value: "file_upload", label: "File Upload", description: "File upload field" },
] as const;

interface SortableQuestion extends ClientRequestTemplateQuestion {
  id: string;
}

function SortableQuestionCard({ 
  question, 
  onEdit, 
  onDelete 
}: { 
  question: SortableQuestion; 
  onEdit: () => void; 
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const questionType = QUESTION_TYPES.find(t => t.value === question.questionType);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border rounded-lg p-4 mb-3"
      data-testid={`question-card-${question.id}`}
    >
      <div className="flex items-start space-x-3">
        <button
          className="cursor-grab active:cursor-grabbing mt-1"
          {...attributes}
          {...listeners}
          data-testid={`drag-handle-${question.id}`}
        >
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-medium" data-testid={`question-label-${question.id}`}>
              {question.label}
            </h4>
            {question.isRequired && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded" data-testid={`required-badge-${question.id}`}>
                Required
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground" data-testid={`question-type-${question.id}`}>
            {questionType?.label}
          </p>
          {question.helpText && (
            <p className="text-xs text-muted-foreground mt-1" data-testid={`question-help-${question.id}`}>
              {question.helpText}
            </p>
          )}
        </div>
        <div className="flex space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            data-testid={`button-edit-question-${question.id}`}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            data-testid={`button-delete-question-${question.id}`}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TaskTemplateSectionQuestionsPage() {
  const { templateId, sectionId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<SortableQuestion[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ClientRequestTemplateQuestion | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<ClientRequestTemplateQuestion | null>(null);

  // Form state for question builder
  const [formData, setFormData] = useState({
    label: "",
    helpText: "",
    questionType: "short_text" as ClientRequestTemplateQuestion["questionType"],
    isRequired: false,
    options: [] as string[],
    validationRules: {} as Record<string, any>,
  });

  const { data: template } = useQuery<ClientRequestTemplate>({
    queryKey: ["/api/client-request-templates", templateId],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!templateId,
  });

  const { data: section } = useQuery<ClientRequestTemplateSection>({
    queryKey: ["/api/task-template-sections", sectionId],
    queryFn: async () => {
      const sections = await fetch(`/api/client-request-templates/${templateId}/sections`).then(r => r.json());
      return sections.find((s: ClientRequestTemplateSection) => s.id === sectionId);
    },
    enabled: !!templateId && !!sectionId,
  });

  const { data: questionsData, isLoading: questionsLoading } = useQuery<ClientRequestTemplateQuestion[]>({
    queryKey: ["/api/task-template-sections", sectionId, "questions"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!sectionId,
  });

  useEffect(() => {
    if (questionsData) {
      setQuestions(questionsData.map(q => ({ ...q, id: q.id })));
    }
  }, [questionsData]);

  const reorderQuestionsMutation = useMutation({
    mutationFn: async (orderedQuestions: { id: string; sortOrder: number }[]) => {
      return apiRequest("POST", "/api/task-template-questions/reorder", { questions: orderedQuestions });
    },
    onError: (error) => {
      showFriendlyError({ error });
      queryClient.invalidateQueries({ queryKey: ["/api/task-template-sections", sectionId, "questions"] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        const updates = newOrder.map((question, index) => ({
          id: question.id,
          sortOrder: index,
        }));
        reorderQuestionsMutation.mutate(updates);
        
        return newOrder;
      });
    }
  };

  const resetForm = () => {
    setFormData({
      label: "",
      helpText: "",
      questionType: "short_text",
      isRequired: false,
      options: [],
      validationRules: {},
    });
  };

  const openAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const openEditDialog = (question: ClientRequestTemplateQuestion) => {
    setFormData({
      label: question.label,
      helpText: question.helpText || "",
      questionType: question.questionType,
      isRequired: question.isRequired,
      options: question.options || [],
      validationRules: (question.validationRules as Record<string, any>) || {},
    });
    setEditingQuestion(question);
    setShowAddDialog(true);
  };

  const handleSaveQuestion = async () => {
    if (!formData.label.trim()) {
      showFriendlyError({ error: "Question label is required" });
      return;
    }

    // Validate options for choice questions
    if (["single_choice", "multi_choice", "dropdown"].includes(formData.questionType)) {
      if (!formData.options || formData.options.length === 0 || formData.options.every(o => !o.trim())) {
        showFriendlyError({ error: "At least one option is required for choice questions" });
        return;
      }
    }

    try {
      const payload: any = {
        label: formData.label,
        helpText: formData.helpText || undefined,
        questionType: formData.questionType,
        isRequired: formData.isRequired,
      };

      // Only include options if it's a choice question
      if (["single_choice", "multi_choice", "dropdown"].includes(formData.questionType)) {
        payload.options = formData.options.filter(o => o.trim());
      }

      // Only include validationRules if there are any
      if (Object.keys(formData.validationRules).length > 0) {
        payload.validationRules = formData.validationRules;
      }

      if (editingQuestion) {
        await apiRequest("PATCH", `/api/task-template-questions/${editingQuestion.id}`, payload);
        toast({
          title: "Success",
          description: "Question updated successfully",
        });
      } else {
        await apiRequest("POST", `/api/task-template-sections/${sectionId}/questions`, payload);
        toast({
          title: "Success",
          description: "Question added successfully",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/task-template-sections", sectionId, "questions"] });
      setShowAddDialog(false);
      setEditingQuestion(null);
      resetForm();
    } catch (error) {
      showFriendlyError({ error });
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deletingQuestion) return;

    try {
      await apiRequest("DELETE", `/api/task-template-questions/${deletingQuestion.id}`);
      toast({
        title: "Success",
        description: "Question deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/task-template-sections", sectionId, "questions"] });
      setDeletingQuestion(null);
    } catch (error) {
      showFriendlyError({ error });
    }
  };

  const needsOptions = ["single_choice", "multi_choice", "dropdown"].includes(formData.questionType);

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <Link href={`/request-templates/${templateId}/edit`}>
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Template
            </Button>
          </Link>

          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="text-page-title">
              {section?.title || "Section"} Questions
            </h1>
            <p className="text-meta mt-1">
              Template: {template?.name}
            </p>
            {section?.description && (
              <p className="text-sm text-muted-foreground mt-2">{section.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="page-container py-6 md:py-8 space-y-8">

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Questions ({questions.length})</CardTitle>
              <Button onClick={openAddDialog} data-testid="button-add-question">
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {questionsLoading ? (
              <div className="flex justify-center py-8">
                <p className="text-muted-foreground">Loading questions...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <HelpCircle className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-2">No questions yet</p>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  Add questions to collect information from clients
                </p>
                <Button onClick={openAddDialog} data-testid="button-add-first-question">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Question
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={questions.map(q => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {questions.map((question) => (
                      <SortableQuestionCard
                        key={question.id}
                        question={question}
                        onEdit={() => openEditDialog(question)}
                        onDelete={() => setDeletingQuestion(question)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Drag questions to reorder them.
            </p>
          </CardContent>
        </Card>

        {/* Add/Edit Question Dialog */}
        {showAddDialog && (
          <Dialog open={true} onOpenChange={() => {
            setShowAddDialog(false);
            setEditingQuestion(null);
            resetForm();
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingQuestion ? "Edit" : "Add"} Question</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="question-label">Question Label *</Label>
                  <Input
                    id="question-label"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g. What is your full name?"
                    data-testid="input-question-label"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="question-type">Question Type *</Label>
                  <Select
                    value={formData.questionType}
                    onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        questionType: value as ClientRequestTemplateQuestion["questionType"],
                        options: [],
                        validationRules: {}
                      });
                    }}
                  >
                    <SelectTrigger id="question-type" data-testid="select-question-type" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="help-text">Help Text (Optional)</Label>
                  <Textarea
                    id="help-text"
                    value={formData.helpText}
                    onChange={(e) => setFormData({ ...formData, helpText: e.target.value })}
                    placeholder="Additional guidance for users"
                    data-testid="input-help-text"
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="required"
                    checked={formData.isRequired}
                    onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked as boolean })}
                    data-testid="checkbox-required"
                  />
                  <Label htmlFor="required" className="cursor-pointer">
                    Required field
                  </Label>
                </div>

                {/* Options for choice questions */}
                {needsOptions && (
                  <div>
                    <Label>Options *</Label>
                    <div className="space-y-2 mt-2">
                      {formData.options.map((option: string, index: number) => (
                        <div key={index} className="flex space-x-2">
                          <Input
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...formData.options];
                              newOptions[index] = e.target.value;
                              setFormData({ ...formData, options: newOptions });
                            }}
                            placeholder={`Option ${index + 1}`}
                            data-testid={`input-option-${index}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newOptions = formData.options.filter((_: string, i: number) => i !== index);
                              setFormData({ ...formData, options: newOptions });
                            }}
                            data-testid={`button-remove-option-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newOptions = [...formData.options, ""];
                          setFormData({ ...formData, options: newOptions });
                        }}
                        data-testid="button-add-option"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Option
                      </Button>
                    </div>
                  </div>
                )}

                {/* Validation for number */}
                {formData.questionType === "number" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="min-value">Minimum Value (Optional)</Label>
                      <Input
                        id="min-value"
                        type="number"
                        value={formData.validationRules.min || ""}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          validationRules: { ...formData.validationRules, min: e.target.value ? Number(e.target.value) : undefined } 
                        })}
                        placeholder="Min"
                        data-testid="input-min-value"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-value">Maximum Value (Optional)</Label>
                      <Input
                        id="max-value"
                        type="number"
                        value={formData.validationRules.max || ""}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          validationRules: { ...formData.validationRules, max: e.target.value ? Number(e.target.value) : undefined } 
                        })}
                        placeholder="Max"
                        data-testid="input-max-value"
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                {/* File upload settings */}
                {formData.questionType === "file_upload" && (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Checkbox
                        id="multiple-files"
                        checked={formData.validationRules.multiple || false}
                        onCheckedChange={(checked) => setFormData({ 
                          ...formData, 
                          validationRules: { ...formData.validationRules, multiple: checked as boolean } 
                        })}
                        data-testid="checkbox-multiple-files"
                      />
                      <Label htmlFor="multiple-files" className="cursor-pointer">
                        Allow multiple files
                      </Label>
                    </div>
                    <div>
                      <Label htmlFor="accepted-types">Accepted File Types (Optional)</Label>
                      <Input
                        id="accepted-types"
                        value={formData.validationRules.acceptedTypes || ""}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          validationRules: { ...formData.validationRules, acceptedTypes: e.target.value } 
                        })}
                        placeholder="e.g. .pdf,.doc,.docx"
                        data-testid="input-accepted-types"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Comma-separated file extensions (leave empty to allow all types)
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddDialog(false);
                      setEditingQuestion(null);
                      resetForm();
                    }}
                    data-testid="button-cancel-question"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveQuestion}
                    data-testid="button-save-question"
                  >
                    {editingQuestion ? "Update" : "Add"} Question
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Question Dialog */}
        {deletingQuestion && (
          <Dialog open={true} onOpenChange={() => setDeletingQuestion(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Question</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete "{deletingQuestion.label}"? This cannot be undone.
              </p>
              <div className="flex justify-end space-x-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeletingQuestion(null)}
                  data-testid="button-cancel-delete-question"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteQuestion}
                  data-testid="button-confirm-delete-question"
                >
                  Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
