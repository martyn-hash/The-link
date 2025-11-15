import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  ArrowLeft, Save, Plus, Edit, Trash2, GripVertical, FolderPlus, Settings,
  Type, FileText, Mail, Hash, Calendar, CircleDot, CheckSquare, ChevronDown, 
  ToggleLeft, Upload, Layers
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "wouter";
import TopNavigation from "@/components/top-navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientRequestTemplate, ClientRequestTemplateSection, ClientRequestTemplateCategory, InsertClientRequestTemplateSection, ClientRequestTemplateQuestion, InsertClientRequestTemplateQuestion } from "@shared/schema";

const templateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.enum(["draft", "active"]),
});

const sectionSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
});

type TemplateForm = z.infer<typeof templateSchema>;
type SectionForm = z.infer<typeof sectionSchema>;

interface SortableSection extends ClientRequestTemplateSection {
  id: string;
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

function DropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'sections-dropzone',
  });

  return (
    <div 
      ref={setNodeRef}
      className={`transition-colors ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
    >
      {children}
    </div>
  );
}

function PaletteItem({ 
  label, 
  icon: Icon, 
  type 
}: { 
  label: string; 
  icon: React.ElementType; 
  type: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type, label, icon: Icon },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center space-x-3 px-4 py-3 bg-card border rounded-lg cursor-grab hover:bg-accent hover:border-primary transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
      data-testid={`palette-item-${type}`}
    >
      <Icon className="w-5 h-5 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function SortableQuestionItem({
  question,
  onEdit,
  onDelete,
}: {
  question: ClientRequestTemplateQuestion;
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
    id: question.id,
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
      data-testid={`question-item-${question.id}`}
    >
      <div className="flex items-center space-x-3 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          data-testid={`drag-handle-question-${question.id}`}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <QuestionIcon className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-sm font-medium" data-testid={`text-question-label-${question.id}`}>
            {question.label}
          </p>
          {question.helpText && (
            <p className="text-xs text-muted-foreground mt-1" data-testid={`text-question-help-${question.id}`}>
              {question.helpText}
            </p>
          )}
        </div>
        {question.isRequired && (
          <Badge variant="secondary" className="text-xs" data-testid={`badge-question-required-${question.id}`}>
            Required
          </Badge>
        )}
      </div>
      <div className="flex items-center space-x-2">
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
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function SortableSectionCard({ 
  section, 
  templateId,
  onEdit, 
  onDelete,
  onEditQuestion,
  onDeleteQuestion,
}: { 
  section: SortableSection; 
  templateId: string;
  onEdit: () => void; 
  onDelete: () => void;
  onEditQuestion: (questionId: string) => void;
  onDeleteQuestion: (questionId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: section.id,
    data: { type: 'section', section },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `section-${section.id}`,
    data: { sectionId: section.id },
  });

  const { data: questionsData } = useQuery<ClientRequestTemplateQuestion[]>({
    queryKey: ["/api/task-template-sections", section.id, "questions"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const questions = questionsData || [];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`transition-colors ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      data-testid={`section-card-${section.id}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-1"
              data-testid={`drag-handle-section-${section.id}`}
            >
              <GripVertical className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg" data-testid={`text-section-title-${section.id}`}>
                {section.title}
              </CardTitle>
              {section.description && (
                <p className="text-sm text-muted-foreground mt-1" data-testid={`text-section-description-${section.id}`}>
                  {section.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              data-testid={`button-edit-section-${section.id}`}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              data-testid={`button-delete-section-${section.id}`}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent ref={setDropRef}>
        {questions.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground mb-4">
              Drag question types here to add questions
            </p>
            <Select
              onValueChange={(type) => {
                onEditQuestion('CREATE_NEW_' + type + '_' + section.id);
              }}
            >
              <SelectTrigger className="w-[200px] mx-auto" data-testid={`select-add-question-${section.id}`}>
                <SelectValue placeholder="Add question..." />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_TYPES.map((qt) => (
                  <SelectItem key={qt.type} value={qt.type} data-testid={`option-question-type-${qt.type}`}>
                    {qt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {questions.map((question) => (
                <SortableQuestionItem
                  key={question.id}
                  question={question}
                  onEdit={() => onEditQuestion(question.id)}
                  onDelete={() => onDeleteQuestion(question.id)}
                />
              ))}
              <Select
                onValueChange={(type) => {
                  onEditQuestion('CREATE_NEW_' + type + '_' + section.id);
                }}
              >
                <SelectTrigger className="w-full" data-testid={`select-add-question-${section.id}`}>
                  <SelectValue placeholder="Add another question..." />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((qt) => (
                    <SelectItem key={qt.type} value={qt.type} data-testid={`option-question-type-${qt.type}`}>
                      {qt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SortableContext>
        )}
      </CardContent>
    </Card>
  );
}

function SectionModal({
  templateId,
  section,
  onSuccess,
}: {
  templateId: string;
  section?: ClientRequestTemplateSection;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const isEditing = !!section;

  const form = useForm<SectionForm>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      title: section?.title || "",
      description: section?.description || "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: SectionForm) => {
      if (isEditing) {
        return apiRequest("PATCH", `/api/task-template-sections/${section.id}`, data);
      }
      return apiRequest("POST", `/api/client-request-templates/${templateId}/sections`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Section ${isEditing ? 'updated' : 'created'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/client-request-templates", templateId, "sections"] });
      onSuccess();
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save section",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: SectionForm) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="ghost" size="sm">
            <Edit className="w-4 h-4" />
          </Button>
        ) : (
          <Button data-testid="button-add-section">
            <Plus className="w-4 h-4 mr-2" />
            Add Section
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Section</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Section Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Personal Information" data-testid="input-section-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Brief description of this section"
                      data-testid="input-section-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-section"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                data-testid="button-save-section"
              >
                {saveMutation.isPending ? "Saving..." : (isEditing ? "Update" : "Add")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSectionDialog({ 
  section,
  onSuccess,
}: { 
  section: ClientRequestTemplateSection;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/task-template-sections/${section.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Section deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/client-request-templates", section.templateId, "sections"] });
      onSuccess();
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete section",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Section</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete "{section.title}"? This will also delete all questions in this section. This cannot be undone.
        </p>
        <div className="flex justify-end space-x-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="button-cancel-delete-section"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="button-confirm-delete-section"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TaskTemplateEditPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [sections, setSections] = useState<SortableSection[]>([]);
  const [editingSection, setEditingSection] = useState<ClientRequestTemplateSection | null>(null);
  const [deletingSection, setDeletingSection] = useState<ClientRequestTemplateSection | null>(null);
  const [editTemplateDialogOpen, setEditTemplateDialogOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<{ type: string; label: string } | null>(null);
  const [creatingQuestion, setCreatingQuestion] = useState<{ sectionId: string; questionType: string } | null>(null);
  const [editQuestionId, setEditQuestionId] = useState<string | null>(null);
  const [editQuestionSectionId, setEditQuestionSectionId] = useState<string | null>(null);
  const [createQuestionOptions, setCreateQuestionOptions] = useState<string[]>([]);
  const [editQuestionOptions, setEditQuestionOptions] = useState<string[]>([]);

  const { data: template, isLoading: templateLoading } = useQuery<ClientRequestTemplate>({
    queryKey: ["/api/client-request-templates", id],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!id,
  });

  const { data: categories } = useQuery<ClientRequestTemplateCategory[]>({
    queryKey: ["/api/client-request-template-categories"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: sectionsData, isLoading: sectionsLoading } = useQuery<ClientRequestTemplateSection[]>({
    queryKey: ["/api/client-request-templates", id, "sections"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!id,
  });

  // Update local sections when data loads
  useEffect(() => {
    if (sectionsData) {
      setSections(sectionsData.map(s => ({ ...s, id: s.id })));
    }
  }, [sectionsData]);

  const form = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name || "",
      description: template?.description || "",
      categoryId: template?.categoryId || undefined,
      status: template?.status || "draft",
    },
  });

  // Update form when template loads
  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description || "",
        categoryId: template.categoryId || undefined,
        status: template.status,
      });
    }
  }, [template, form]);

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: TemplateForm) => {
      return apiRequest("PATCH", `/api/client-request-templates/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/client-request-templates", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-request-templates"] });
      setEditTemplateDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update template",
        variant: "destructive",
      });
    },
  });

  const reorderSectionsMutation = useMutation({
    mutationFn: async (orderedSections: { id: string; sortOrder: number }[]) => {
      return apiRequest("POST", "/api/task-template-sections/reorder", { sections: orderedSections });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reorder sections",
        variant: "destructive",
      });
      // Reload sections on error
      queryClient.invalidateQueries({ queryKey: ["/api/client-request-templates", id, "sections"] });
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: async (sectionData: { title: string; description?: string; sortOrder: number }) => {
      return apiRequest("POST", `/api/client-request-templates/${id}/sections`, sectionData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Section created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/client-request-templates", id, "sections"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create section",
        variant: "destructive",
      });
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (data: { sectionId: string; questionType: string; label: string; helpText?: string; isRequired: boolean; options?: string[] }) => {
      const payload: any = {
        questionType: data.questionType,
        label: data.label,
        helpText: data.helpText,
        isRequired: data.isRequired,
        order: 0,
      };
      
      // Include options if provided
      if (data.options && data.options.length > 0) {
        payload.options = data.options;
      }
      
      return apiRequest("POST", `/api/task-template-sections/${data.sectionId}/questions`, payload);
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: "Question added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/task-template-sections", variables.sectionId, "questions"] });
      setCreatingQuestion(null);
      setCreateQuestionOptions([]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add question",
        variant: "destructive",
      });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async (data: { id: string; sectionId?: string; [key: string]: any }) => {
      const { id: questionId, sectionId, ...updateData } = data;
      return apiRequest("PATCH", `/api/task-template-questions/${questionId}`, updateData);
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: "Question updated successfully",
      });
      // Invalidate the specific section's questions if we know the section
      if (variables.sectionId) {
        queryClient.invalidateQueries({ queryKey: ["/api/task-template-sections", variables.sectionId, "questions"] });
      } else {
        // Otherwise invalidate all section questions
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && 
                   key[0] === "/api/task-template-sections" && 
                   key[2] === "questions";
          }
        });
      }
      setEditQuestionId(null);
      setEditQuestionSectionId(null);
      setEditQuestionOptions([]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update question",
        variant: "destructive",
      });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      return apiRequest("DELETE", `/api/task-template-questions/${questionId}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Question deleted successfully",
      });
      // Invalidate all section questions to refresh the UI
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && 
                 key[0] === "/api/task-template-sections" && 
                 key[2] === "questions";
        }
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete question",
        variant: "destructive",
      });
    },
  });

  const reorderQuestionsMutation = useMutation({
    mutationFn: async (data: { sectionId: string; questions: { id: string; sortOrder: number }[]; onError?: () => void }) => {
      return apiRequest("POST", "/api/task-template-questions/reorder", {
        questions: data.questions,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-template-sections", variables.sectionId, "questions"] });
    },
    onError: (error, variables) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reorder questions",
        variant: "destructive",
      });
      // Call rollback callback if provided
      if (variables.onError) {
        variables.onError();
      }
      // Also invalidate to ensure UI syncs with server state
      queryClient.invalidateQueries({ queryKey: ["/api/task-template-sections", variables.sectionId, "questions"] });
    },
  });

  const handleReorderQuestions = (sectionId: string, oldIndex: number, newIndex: number, onError?: () => void) => {
    // Get the questions for this section from the query cache
    const questionsData = queryClient.getQueryData<ClientRequestTemplateQuestion[]>(["/api/task-template-sections", sectionId, "questions"]);
    if (!questionsData) return;

    const reordered = arrayMove(questionsData, oldIndex, newIndex);
    const updates = reordered.map((question, index) => ({
      id: question.id,
      sortOrder: index,
    }));

    reorderQuestionsMutation.mutate({ sectionId, questions: updates, onError });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type && active.data.current?.label) {
      setActiveDrag({
        type: active.data.current.type,
        label: active.data.current.label,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDrag(null);

    if (!over) return;

    // Check if dragging from palette
    if (String(active.id).startsWith("palette-")) {
      const draggedData = active.data.current;
      const type = draggedData?.type;
      
      // If dropping a section from palette
      if (type === "section") {
        const sortOrder = sections.length;
        createSectionMutation.mutate({
          title: "New Section",
          description: "",
          sortOrder,
        });
        return;
      }
      
      // If dropping a question type from palette into a section
      // Check if dropping into a section (via droppable zone)
      if (over.data?.current?.sectionId) {
        const sectionId = over.data.current.sectionId;
        setCreatingQuestion({ sectionId, questionType: type });
        return;
      }
      
      return;
    }

    // Check if dragging a question (reordering within a section)
    if (active.data.current?.type === 'question' && over.data.current?.type === 'question') {
      const activeQuestion = active.data.current.question;
      const overQuestion = over.data.current.question;
      
      // Make sure they're in the same section
      if (activeQuestion.sectionId === overQuestion.sectionId) {
        const sectionId = activeQuestion.sectionId;
        const questionsData = queryClient.getQueryData<ClientRequestTemplateQuestion[]>(["/api/task-template-sections", sectionId, "questions"]);
        if (questionsData) {
          const oldIndex = questionsData.findIndex((q) => q.id === active.id);
          const newIndex = questionsData.findIndex((q) => q.id === over.id);
          
          if (oldIndex !== -1 && newIndex !== -1) {
            handleReorderQuestions(sectionId, oldIndex, newIndex);
          }
        }
      }
      return;
    }

    // Handle section reordering
    if (active.id !== over.id && sections.some(s => s.id === active.id) && sections.some(s => s.id === over.id)) {
      setSections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        if (oldIndex === -1 || newIndex === -1) return items;
        
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update sort orders and send to server
        const updates = newOrder.map((section, index) => ({
          id: section.id,
          sortOrder: index,
        }));
        reorderSectionsMutation.mutate(updates);
        
        return newOrder;
      });
    }
  };

  const handleSubmit = (data: TemplateForm) => {
    updateTemplateMutation.mutate(data);
  };

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

  if (templateLoading || sectionsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation user={user} />
        <div className="container mx-auto py-8">
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Loading template...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation user={user} />
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Template not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const category = categories?.find(c => c.id === template.categoryId);

  // Find question being edited
  let editQuestion: any = null;
  if (editQuestionId) {
    for (const section of sections) {
      const sectionQuestions = queryClient.getQueryData<ClientRequestTemplateQuestion[]>(["/api/task-template-sections", section.id, "questions"]);
      if (sectionQuestions) {
        const question = sectionQuestions.find((q: any) => q.id === editQuestionId);
        if (question) {
          editQuestion = question;
          break;
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation user={user} />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div className="flex items-start justify-between mb-4">
            <Link href="/task-templates">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditTemplateDialogOpen(true)}
              data-testid="button-edit-template-details"
            >
              <Settings className="w-4 h-4 mr-2" />
              Edit Template Details
            </Button>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="text-template-name">{template.name}</h1>
              <Badge
                variant={template.status === "active" ? "default" : "secondary"}
                data-testid="badge-template-status"
              >
                {template.status}
              </Badge>
            </div>
            
            {template.description && (
              <p className="text-muted-foreground text-lg" data-testid="text-template-description">
                {template.description}
              </p>
            )}
            
            <div className="flex items-center space-x-4">
              {category && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Category:</span>
                  <Badge variant="outline" data-testid="badge-template-category">
                    {category.name}
                  </Badge>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Sections:</span>
                <span className="text-sm font-medium" data-testid="text-section-count">
                  {sections.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Sidebar + Sections */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6">
            {/* Left Sidebar - Component Palette */}
            <div className="w-80 flex-shrink-0">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="text-lg">Components</CardTitle>
                  <p className="text-sm text-muted-foreground">Drag to add</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Section Item */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Layout</h4>
                    <PaletteItem
                      label="Section"
                      icon={Layers}
                      type="section"
                    />
                  </div>

                  {/* Question Types */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Question Types</h4>
                    <div className="space-y-2">
                      {QUESTION_TYPES.map((qt) => (
                        <PaletteItem
                          key={qt.type}
                          label={qt.label}
                          icon={qt.icon}
                          type={qt.type}
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content - Sections */}
            <div className="flex-1">
              <DropZone>
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Template Builder</CardTitle>
                      <SectionModal templateId={template.id} onSuccess={() => {}} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {sections.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <FolderPlus className="w-12 h-12 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground mb-2">No sections yet</p>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                          Drag a Section from the sidebar to get started
                        </p>
                      </div>
                    ) : (
                      <SortableContext
                        items={sections.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {sections.map((section) => (
                            <SortableSectionCard
                              key={section.id}
                              section={section}
                              templateId={template.id}
                              onEdit={() => setEditingSection(section)}
                              onDelete={() => setDeletingSection(section)}
                              onEditQuestion={(questionId) => {
                                // Handle creating new question via select dropdown
                                if (questionId.startsWith('CREATE_NEW_')) {
                                  const parts = questionId.split('_');
                                  const sectionId = parts[parts.length - 1];
                                  const questionType = parts.slice(2, -1).join('_');
                                  setCreatingQuestion({ sectionId, questionType });
                                } else {
                                  // Editing existing question
                                  const sectionQuestions = queryClient.getQueryData<ClientRequestTemplateQuestion[]>(["/api/task-template-sections", section.id, "questions"]);
                                  const question = sectionQuestions?.find((q: any) => q.id === questionId);
                                  if (question) {
                                    setEditQuestionId(questionId);
                                    setEditQuestionSectionId(section.id);
                                    setEditQuestionOptions(question.options || []);
                                  }
                                }
                              }}
                              onDeleteQuestion={(questionId) => deleteQuestionMutation.mutate(questionId)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    )}
                    <p className="text-xs text-muted-foreground mt-4">
                      Drag sections to reorder them. Drag question types into sections to add questions.
                    </p>
                  </CardContent>
                </Card>
              </DropZone>
            </div>
          </div>
          <DragOverlay>
            {activeDrag && (
              <div className="flex items-center space-x-3 px-4 py-3 bg-card border rounded-lg shadow-lg">
                <span className="text-sm font-medium">{activeDrag.label}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Edit Section Dialog */}
        {editingSection && (
          <Dialog open={true} onOpenChange={() => setEditingSection(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Section</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const title = formData.get("title") as string;
                  const description = formData.get("description") as string;
                  
                  apiRequest("PATCH", `/api/task-template-sections/${editingSection.id}`, {
                    title,
                    description,
                  })
                    .then(() => {
                      toast({
                        title: "Success",
                        description: "Section updated successfully",
                      });
                      queryClient.invalidateQueries({ queryKey: ["/api/client-request-templates", id, "sections"] });
                      setEditingSection(null);
                    })
                    .catch((error) => {
                      toast({
                        title: "Error",
                        description: error instanceof Error ? error.message : "Failed to update section",
                        variant: "destructive",
                      });
                    });
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="edit-title" className="text-sm font-medium">
                    Section Title
                  </label>
                  <Input
                    id="edit-title"
                    name="title"
                    defaultValue={editingSection.title}
                    required
                    placeholder="e.g. Personal Information"
                    data-testid="input-edit-section-title"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="edit-description" className="text-sm font-medium">
                    Description (Optional)
                  </label>
                  <Textarea
                    id="edit-description"
                    name="description"
                    defaultValue={editingSection.description || ""}
                    placeholder="Brief description of this section"
                    data-testid="input-edit-section-description"
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingSection(null)}
                    data-testid="button-cancel-edit-section"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-save-edit-section">
                    Update
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Section Dialog */}
        {deletingSection && (
          <Dialog open={true} onOpenChange={() => setDeletingSection(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Section</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete "{deletingSection.title}"? This will also delete all questions in this section. This cannot be undone.
              </p>
              <div className="flex justify-end space-x-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeletingSection(null)}
                  data-testid="button-cancel-delete-section-dialog"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    apiRequest("DELETE", `/api/task-template-sections/${deletingSection.id}`)
                      .then(() => {
                        toast({
                          title: "Success",
                          description: "Section deleted successfully",
                        });
                        queryClient.invalidateQueries({ queryKey: ["/api/client-request-templates", id, "sections"] });
                        setDeletingSection(null);
                      })
                      .catch((error) => {
                        toast({
                          title: "Error",
                          description: error instanceof Error ? error.message : "Failed to delete section",
                          variant: "destructive",
                        });
                      });
                  }}
                  data-testid="button-confirm-delete-section-dialog"
                >
                  Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Create Question Dialog */}
        <Dialog open={!!creatingQuestion} onOpenChange={(open) => {
          if (!open) {
            setCreatingQuestion(null);
            setCreateQuestionOptions([]);
          }
        }}>
          <DialogContent data-testid="dialog-create-question" className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Question</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Question Type</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {creatingQuestion && QUESTION_TYPES.find(qt => qt.type === creatingQuestion.questionType)?.label}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Label</label>
                <Input
                  id="question-label"
                  placeholder="Enter question label"
                  data-testid="input-question-label"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Help Text (optional)</label>
                <Textarea
                  id="question-help"
                  placeholder="Enter help text"
                  data-testid="textarea-question-help"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="question-required"
                  className="rounded"
                  data-testid="checkbox-question-required"
                />
                <label htmlFor="question-required" className="text-sm font-medium">
                  Required
                </label>
              </div>

              {/* Options for choice questions */}
              {creatingQuestion && ["single_choice", "multi_choice", "dropdown"].includes(creatingQuestion.questionType) && (
                <div>
                  <label className="text-sm font-medium">Options *</label>
                  <div className="space-y-2 mt-2">
                    {createQuestionOptions.map((option, index) => (
                      <div key={index} className="flex space-x-2">
                        <Input
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...createQuestionOptions];
                            newOptions[index] = e.target.value;
                            setCreateQuestionOptions(newOptions);
                          }}
                          placeholder={`Option ${index + 1}`}
                          data-testid={`input-create-option-${index}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newOptions = createQuestionOptions.filter((_, i) => i !== index);
                            setCreateQuestionOptions(newOptions);
                          }}
                          data-testid={`button-remove-create-option-${index}`}
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
                        setCreateQuestionOptions([...createQuestionOptions, ""]);
                      }}
                      data-testid="button-add-create-option"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setCreatingQuestion(null)}
                  data-testid="button-cancel-create-question"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!creatingQuestion) return;
                    const label = (document.getElementById("question-label") as HTMLInputElement)?.value;
                    const helpText = (document.getElementById("question-help") as HTMLTextAreaElement)?.value;
                    const isRequired = (document.getElementById("question-required") as HTMLInputElement)?.checked;
                    
                    if (!label) {
                      toast({
                        title: "Error",
                        description: "Question label is required",
                        variant: "destructive",
                      });
                      return;
                    }

                    // Validate options for choice questions
                    if (["single_choice", "multi_choice", "dropdown"].includes(creatingQuestion.questionType)) {
                      if (!createQuestionOptions || createQuestionOptions.length === 0 || createQuestionOptions.every(o => !o.trim())) {
                        toast({
                          title: "Error",
                          description: "At least one option is required for choice questions",
                          variant: "destructive",
                        });
                        return;
                      }
                    }

                    const payload: any = {
                      sectionId: creatingQuestion.sectionId,
                      questionType: creatingQuestion.questionType,
                      label,
                      helpText: helpText || undefined,
                      isRequired: isRequired || false,
                    };

                    // Include options if it's a choice question
                    if (["single_choice", "multi_choice", "dropdown"].includes(creatingQuestion.questionType)) {
                      payload.options = createQuestionOptions.filter(o => o.trim());
                    }

                    createQuestionMutation.mutate(payload);
                  }}
                  data-testid="button-save-question"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Question Dialog */}
        <Dialog open={!!editQuestionId} onOpenChange={(open) => {
          if (!open) {
            setEditQuestionId(null);
            setEditQuestionOptions([]);
          }
        }}>
          <DialogContent data-testid="dialog-edit-question" className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Question</DialogTitle>
            </DialogHeader>
            {editQuestion && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Question Type</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {QUESTION_TYPES.find(qt => qt.type === editQuestion.questionType)?.label}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Label</label>
                  <Input
                    id="edit-question-label"
                    defaultValue={editQuestion.label}
                    data-testid="input-edit-question-label"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Help Text (optional)</label>
                  <Textarea
                    id="edit-question-help"
                    defaultValue={editQuestion.helpText || ""}
                    data-testid="textarea-edit-question-help"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-question-required"
                    defaultChecked={editQuestion.isRequired}
                    className="rounded"
                    data-testid="checkbox-edit-question-required"
                  />
                  <label htmlFor="edit-question-required" className="text-sm font-medium">
                    Required
                  </label>
                </div>

                {/* Options for choice questions */}
                {["single_choice", "multi_choice", "dropdown"].includes(editQuestion.questionType) && (
                  <div>
                    <label className="text-sm font-medium">Options *</label>
                    <div className="space-y-2 mt-2">
                      {editQuestionOptions.map((option, index) => (
                        <div key={index} className="flex space-x-2">
                          <Input
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...editQuestionOptions];
                              newOptions[index] = e.target.value;
                              setEditQuestionOptions(newOptions);
                            }}
                            placeholder={`Option ${index + 1}`}
                            data-testid={`input-edit-option-${index}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newOptions = editQuestionOptions.filter((_, i) => i !== index);
                              setEditQuestionOptions(newOptions);
                            }}
                            data-testid={`button-remove-edit-option-${index}`}
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
                          setEditQuestionOptions([...editQuestionOptions, ""]);
                        }}
                        data-testid="button-add-edit-option"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Option
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditQuestionId(null)}
                    data-testid="button-cancel-edit-question"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const label = (document.getElementById("edit-question-label") as HTMLInputElement)?.value;
                      const helpText = (document.getElementById("edit-question-help") as HTMLTextAreaElement)?.value;
                      const isRequired = (document.getElementById("edit-question-required") as HTMLInputElement)?.checked;
                      
                      if (!label) {
                        toast({
                          title: "Error",
                          description: "Question label is required",
                          variant: "destructive",
                        });
                        return;
                      }

                      // Validate options for choice questions
                      if (["single_choice", "multi_choice", "dropdown"].includes(editQuestion.questionType)) {
                        if (!editQuestionOptions || editQuestionOptions.length === 0 || editQuestionOptions.every(o => !o.trim())) {
                          toast({
                            title: "Error",
                            description: "At least one option is required for choice questions",
                            variant: "destructive",
                          });
                          return;
                        }
                      }

                      const payload: any = {
                        id: editQuestion.id,
                        sectionId: editQuestionSectionId,
                        label,
                        helpText: helpText || undefined,
                        isRequired: isRequired || false,
                      };

                      // Include options if it's a choice question
                      if (["single_choice", "multi_choice", "dropdown"].includes(editQuestion.questionType)) {
                        payload.options = editQuestionOptions.filter(o => o.trim());
                      }

                      updateQuestionMutation.mutate(payload);
                    }}
                    data-testid="button-update-question"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Update
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Template Details Dialog */}
        <Dialog open={editTemplateDialogOpen} onOpenChange={(open) => {
          setEditTemplateDialogOpen(open);
          if (!open) {
            form.reset();
          }
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Template Details</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. New Client Onboarding"
                          data-testid="input-edit-template-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what this template is for..."
                          rows={3}
                          data-testid="input-edit-template-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-template-category">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-template-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditTemplateDialogOpen(false);
                      form.reset();
                    }}
                    data-testid="button-cancel-edit-template"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateTemplateMutation.isPending}
                    data-testid="button-save-edit-template"
                  >
                    {updateTemplateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
