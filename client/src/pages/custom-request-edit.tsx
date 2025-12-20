import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  ArrowLeft, Save, Plus, Edit, Trash2, GripVertical, FolderPlus, Settings,
  Type, FileText, Mail, Hash, Calendar, CircleDot, CheckSquare, ChevronDown, 
  ToggleLeft, Upload, Layers, Send
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
import { showFriendlyError } from "@/lib/friendlyErrors";
import { ConditionalLogicEditor, type ConditionalLogic, type QuestionReference } from "@/components/field-builder/ConditionalLogicEditor";

const requestSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  description: z.string().optional(),
});

const sectionSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().optional(),
});

const assignSchema = z.object({
  personId: z.string().min(1, "Please select a person"),
  dueDate: z.string().optional().nullable(),
});

type RequestForm = z.infer<typeof requestSchema>;
type SectionForm = z.infer<typeof sectionSchema>;
type AssignForm = z.infer<typeof assignSchema>;

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
  question: any;
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
  questions,
  onEditSection,
  onDeleteSection,
  onEditQuestion,
  onDeleteQuestion,
  onReorderQuestions,
}: {
  section: any;
  questions: any[];
  onEditSection: () => void;
  onDeleteSection: () => void;
  onEditQuestion: (questionId: string) => void;
  onDeleteQuestion: (questionId: string) => void;
  onReorderQuestions: (oldIndex: number, newIndex: number, onError?: () => void) => void;
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const rollback = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/custom-request-sections", section.id, "questions"] });
      };
      onReorderQuestions(oldIndex, newIndex, rollback);
    }
  };

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
              onClick={onEditSection}
              data-testid={`button-edit-section-${section.id}`}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeleteSection}
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
              Drag question types here or use the menu below
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}

export default function CustomRequestEdit() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [sections, setSections] = useState<any[]>([]);
  const [editRequestDialogOpen, setEditRequestDialogOpen] = useState(false);
  const [editSectionId, setEditSectionId] = useState<string | null>(null);
  const [creatingQuestion, setCreatingQuestion] = useState<{ sectionId: string; questionType: string } | null>(null);
  const [editQuestionId, setEditQuestionId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ type: string; label: string } | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [createQuestionOptions, setCreateQuestionOptions] = useState<string[]>([]);
  const [editQuestionOptions, setEditQuestionOptions] = useState<string[]>([]);
  const [createQuestionConditionalLogic, setCreateQuestionConditionalLogic] = useState<ConditionalLogic | null>(null);
  const [editQuestionConditionalLogic, setEditQuestionConditionalLogic] = useState<ConditionalLogic | null>(null);

  // Fetch custom request with full details
  const { data: request, isLoading: requestLoading } = useQuery<any>({
    queryKey: ["/api/custom-requests", id, "full"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });

  // Fetch client to get people for assignment
  const { data: client } = useQuery<any>({
    queryKey: ["/api/clients", request?.clientId],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!request?.clientId,
  });

  // Fetch people for assignment
  const { data: people = [] } = useQuery<any[]>({
    queryKey: ["/api/clients", request?.clientId, "people"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!request?.clientId,
  });

  // Sync sections from request data
  useEffect(() => {
    if (request?.sections) {
      setSections(request.sections.sort((a: any, b: any) => a.order - b.order));
    }
  }, [request]);

  // Forms
  const requestForm = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      name: request?.name || "",
      description: request?.description || "",
    },
  });

  const sectionForm = useForm<SectionForm>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const assignForm = useForm<AssignForm>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      personId: "",
      dueDate: undefined,
    },
  });

  // Update form when request loads
  useEffect(() => {
    if (request) {
      requestForm.reset({
        name: request.name,
        description: request.description || "",
      });
    }
  }, [request, requestForm]);

  // Mutations
  const updateRequestMutation = useMutation({
    mutationFn: async (data: RequestForm) => {
      return apiRequest("PATCH", `/api/custom-requests/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Custom request updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-requests", id, "full"] });
      setEditRequestDialogOpen(false);
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; order: number }) => {
      return apiRequest("POST", `/api/custom-requests/${id}/sections`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Section added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-requests", id, "full"] });
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: async (data: { id: string; title: string; description?: string }) => {
      return apiRequest("PATCH", `/api/custom-request-sections/${data.id}`, {
        title: data.title,
        description: data.description,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Section updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-requests", id, "full"] });
      setEditSectionId(null);
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      return apiRequest("DELETE", `/api/custom-request-sections/${sectionId}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Section deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-requests", id, "full"] });
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const reorderSectionsMutation = useMutation({
    mutationFn: async (updates: { id: string; order: number }[]) => {
      return apiRequest("PATCH", "/api/custom-request-sections/reorder", { updates });
    },
    onError: (error) => {
      showFriendlyError({ error });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-requests", id, "full"] });
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (data: { sectionId: string; questionType: string; label: string; helpText?: string; isRequired: boolean; options?: string[]; conditionalLogic?: ConditionalLogic | null }) => {
      const payload: any = {
        questionType: data.questionType,
        label: data.label,
        helpText: data.helpText,
        isRequired: data.isRequired,
        order: 0,
        conditionalLogic: data.conditionalLogic || null,
      };
      
      // Include options if provided
      if (data.options && data.options.length > 0) {
        payload.options = data.options;
      }
      
      return apiRequest("POST", `/api/custom-request-sections/${data.sectionId}/questions`, payload);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Question added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-requests", id, "full"] });
      setCreatingQuestion(null);
      setCreateQuestionOptions([]);
      setCreateQuestionConditionalLogic(null);
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async (data: { id: string; [key: string]: any }) => {
      const { id: questionId, ...updateData } = data;
      return apiRequest("PATCH", `/api/custom-request-questions/${questionId}`, updateData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Question updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-requests", id, "full"] });
      setEditQuestionId(null);
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      return apiRequest("DELETE", `/api/custom-request-questions/${questionId}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Question deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-requests", id, "full"] });
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const reorderQuestionsMutation = useMutation({
    mutationFn: async (data: { updates: { id: string; order: number }[]; onError?: () => void }) => {
      return apiRequest("PATCH", "/api/custom-request-questions/reorder", { updates: data.updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-requests", id, "full"] });
    },
    onError: (error, variables) => {
      showFriendlyError({ error });
      if (variables.onError) {
        variables.onError();
      }
      queryClient.invalidateQueries({ queryKey: ["/api/custom-requests", id, "full"] });
    },
  });

  const createTaskInstanceMutation = useMutation({
    mutationFn: async (data: AssignForm) => {
      return apiRequest("POST", "/api/task-instances", {
        templateId: null,
        customRequestId: id,
        clientId: request?.clientId,
        personId: data.personId,
        dueDate: data.dueDate || null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Task instance created and assigned successfully",
      });
      setAssignDialogOpen(false);
      setLocation(`/clients/${request?.clientId}`);
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const handleReorderQuestions = (sectionId: string, oldIndex: number, newIndex: number, onError?: () => void) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section?.questions) return;

    const reordered = arrayMove(section.questions, oldIndex, newIndex);
    const updates = reordered.map((question: any, index: number) => ({
      id: question.id,
      order: index,
    }));

    reorderQuestionsMutation.mutate({ updates, onError });
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
      const type = active.data.current?.type;
      
      // If dropping a section from palette
      if (type === "section") {
        const order = sections.length;
        createSectionMutation.mutate({
          title: "New Section",
          description: "",
          order,
        });
        return;
      }
      
      // If dropping a question type from palette into a section
      let targetSectionId: string | null = null;
      
      if (String(over.id).startsWith("section-")) {
        targetSectionId = over.data?.current?.sectionId || null;
      } else if (sections.some(s => s.id === over.id)) {
        targetSectionId = String(over.id);
      }
      
      if (targetSectionId && type) {
        setCreatingQuestion({ sectionId: targetSectionId, questionType: type });
        setCreateQuestionOptions([]);
        setCreateQuestionConditionalLogic(null);
        return;
      }
      
      return;
    }

    // Handle section reordering
    if (active.id !== over.id && sections.some(s => s.id === over.id)) {
      setSections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        if (oldIndex === -1 || newIndex === -1) return items;
        
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        const updates = newOrder.map((section, index) => ({
          id: section.id,
          order: index,
        }));
        reorderSectionsMutation.mutate(updates);
        
        return newOrder;
      });
    }
  };

  const handleSubmitRequest = (data: RequestForm) => {
    updateRequestMutation.mutate(data);
  };

  const handleSubmitSection = (data: SectionForm) => {
    if (editSectionId) {
      updateSectionMutation.mutate({ id: editSectionId, ...data });
    }
  };

  const handleSubmitAssign = (data: AssignForm) => {
    createTaskInstanceMutation.mutate(data);
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

  if (requestLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation user={user} />
        <div className="container mx-auto py-8">
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Loading custom request...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation user={user} />
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Custom request not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Find section being edited
  const editSection = editSectionId ? sections.find(s => s.id === editSectionId) : null;

  // Find question being edited
  let editQuestion: any = null;
  if (editQuestionId) {
    for (const section of sections) {
      const question = section.questions?.find((q: any) => q.id === editQuestionId);
      if (question) {
        editQuestion = question;
        break;
      }
    }
  }

  // Flatten all questions from all sections for conditional logic
  const allQuestions = useMemo(() => {
    const questions: any[] = [];
    for (const section of sections) {
      if (section.questions) {
        questions.push(...section.questions.map((q: any) => ({ ...q, sectionId: section.id })));
      }
    }
    return questions;
  }, [sections]);

  // Compute previous questions for edit (questions that come before the current one)
  const previousQuestionsForEdit = useMemo((): QuestionReference[] => {
    if (!editQuestion || !allQuestions.length) return [];
    
    const sortedQuestions = [...allQuestions].sort((a, b) => {
      if (a.sectionId !== b.sectionId) {
        const sectionA = sections.find(s => s.id === a.sectionId);
        const sectionB = sections.find(s => s.id === b.sectionId);
        return (sectionA?.order || 0) - (sectionB?.order || 0);
      }
      return (a.order || 0) - (b.order || 0);
    });
    
    const currentIndex = sortedQuestions.findIndex(q => q.id === editQuestion.id);
    if (currentIndex <= 0) return [];
    
    return sortedQuestions.slice(0, currentIndex).map(q => ({
      id: q.id,
      label: q.label,
      questionType: q.questionType,
      options: q.options,
    }));
  }, [editQuestion, allQuestions, sections]);

  // Compute previous questions for create (all existing questions in all sections)
  const previousQuestionsForCreate = useMemo((): QuestionReference[] => {
    if (!creatingQuestion || !allQuestions.length) return [];
    
    const sortedQuestions = [...allQuestions].sort((a, b) => {
      if (a.sectionId !== b.sectionId) {
        const sectionA = sections.find(s => s.id === a.sectionId);
        const sectionB = sections.find(s => s.id === b.sectionId);
        return (sectionA?.order || 0) - (sectionB?.order || 0);
      }
      return (a.order || 0) - (b.order || 0);
    });
    
    return sortedQuestions.map(q => ({
      id: q.id,
      label: q.label,
      questionType: q.questionType,
      options: q.options,
    }));
  }, [creatingQuestion, allQuestions, sections]);

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation user={user} />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div className="flex items-start justify-between mb-4">
            <Link href={`/clients/${request.clientId}`}>
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Client
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditRequestDialogOpen(true)}
                data-testid="button-edit-request-details"
              >
                <Settings className="w-4 h-4 mr-2" />
                Edit Request Details
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setAssignDialogOpen(true)}
                disabled={sections.length === 0}
                data-testid="button-assign-request"
              >
                <Send className="w-4 h-4 mr-2" />
                Assign & Issue
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold" data-testid="text-request-name">{request.name}</h1>
              <Badge variant="secondary" data-testid="badge-request-type">
                Custom Request
              </Badge>
            </div>
            
            {request.description && (
              <p className="text-muted-foreground text-lg" data-testid="text-request-description">
                {request.description}
              </p>
            )}
            
            <div className="flex items-center space-x-4">
              {client && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Client:</span>
                  <Badge variant="outline" data-testid="badge-client-name">
                    {client.name}
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

        {/* Main Content */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
            {/* Palette */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Components</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2 text-muted-foreground">Structure</p>
                    <PaletteItem label="Section" icon={Layers} type="section" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2 text-muted-foreground">Question Types</p>
                    <div className="space-y-2">
                      {QUESTION_TYPES.map((qt) => (
                        <PaletteItem key={qt.type} {...qt} />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sections */}
            <DropZone>
              <div className="space-y-4">
                {sections.length === 0 ? (
                  <Card>
                    <CardContent className="py-12">
                      <div className="text-center">
                        <p className="text-muted-foreground mb-2">No sections yet</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Drag the "Section" component from the left or click the button below
                        </p>
                        <Button
                          onClick={() => {
                            const order = sections.length;
                            createSectionMutation.mutate({
                              title: "New Section",
                              description: "",
                              order,
                            });
                          }}
                          data-testid="button-add-first-section"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Section
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    {sections.map((section) => (
                      <SortableSectionCard
                        key={section.id}
                        section={section}
                        questions={section.questions || []}
                        onEditSection={() => {
                          setEditSectionId(section.id);
                          sectionForm.reset({
                            title: section.title,
                            description: section.description || "",
                          });
                        }}
                        onDeleteSection={() => deleteSectionMutation.mutate(section.id)}
                        onEditQuestion={(questionId) => {
                          // Check if this is a request to create a new question
                          if (questionId.startsWith('CREATE_NEW_')) {
                            const parts = questionId.split('_');
                            const questionType = parts.slice(2, -1).join('_'); // Get type between CREATE_NEW_ and last segment
                            const sectionId = parts[parts.length - 1];
                            setCreatingQuestion({ sectionId, questionType });
                            setCreateQuestionOptions([]);
                            setCreateQuestionConditionalLogic(null);
                          } else {
                            const question = section.questions?.find((q: any) => q.id === questionId);
                            if (question) {
                              setEditQuestionId(questionId);
                              setEditQuestionOptions(question.options || []);
                              setEditQuestionConditionalLogic(question.conditionalLogic || null);
                            }
                          }
                        }}
                        onDeleteQuestion={(questionId) => deleteQuestionMutation.mutate(questionId)}
                        onReorderQuestions={(oldIndex, newIndex, onError) => 
                          handleReorderQuestions(section.id, oldIndex, newIndex, onError)
                        }
                      />
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => {
                        const order = sections.length;
                        createSectionMutation.mutate({
                          title: "New Section",
                          description: "",
                          order,
                        });
                      }}
                      className="w-full"
                      data-testid="button-add-section"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Another Section
                    </Button>
                  </SortableContext>
                )}
              </div>
            </DropZone>
          </div>
          <DragOverlay>
            {activeDrag && (
              <div className="flex items-center space-x-3 px-4 py-3 bg-card border rounded-lg shadow-lg">
                <span className="text-sm font-medium">{activeDrag.label}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Edit Request Dialog */}
      <Dialog open={editRequestDialogOpen} onOpenChange={setEditRequestDialogOpen}>
        <DialogContent data-testid="dialog-edit-request">
          <DialogHeader>
            <DialogTitle>Edit Request Details</DialogTitle>
          </DialogHeader>
          <Form {...requestForm}>
            <form onSubmit={requestForm.handleSubmit(handleSubmitRequest)} className="space-y-4">
              <FormField
                control={requestForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-request-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={requestForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="textarea-request-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditRequestDialogOpen(false)}
                  data-testid="button-cancel-edit-request"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-save-request">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog open={!!editSectionId} onOpenChange={(open) => !open && setEditSectionId(null)}>
        <DialogContent data-testid="dialog-edit-section">
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
          </DialogHeader>
          <Form {...sectionForm}>
            <form onSubmit={sectionForm.handleSubmit(handleSubmitSection)} className="space-y-4">
              <FormField
                control={sectionForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-section-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={sectionForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="textarea-section-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditSectionId(null)}
                  data-testid="button-cancel-edit-section"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-save-section">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create Question Dialog */}
      <Dialog open={!!creatingQuestion} onOpenChange={(open) => {
        if (!open) {
          setCreatingQuestion(null);
          setCreateQuestionOptions([]);
          setCreateQuestionConditionalLogic(null);
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

            {/* Conditional Logic for Create */}
            {previousQuestionsForCreate.length > 0 && (
              <ConditionalLogicEditor
                conditionalLogic={createQuestionConditionalLogic}
                onChange={setCreateQuestionConditionalLogic}
                previousQuestions={previousQuestionsForCreate}
              />
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
                    showFriendlyError({ error: "Question label is required" });
                    return;
                  }

                  // Validate options for choice questions
                  if (["single_choice", "multi_choice", "dropdown"].includes(creatingQuestion.questionType)) {
                    if (!createQuestionOptions || createQuestionOptions.length === 0 || createQuestionOptions.every(o => !o.trim())) {
                      showFriendlyError({ error: "At least one option is required for choice questions" });
                      return;
                    }
                  }

                  const payload: any = {
                    sectionId: creatingQuestion.sectionId,
                    questionType: creatingQuestion.questionType,
                    label,
                    helpText: helpText || undefined,
                    isRequired: isRequired || false,
                    conditionalLogic: createQuestionConditionalLogic || null,
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
          setEditQuestionConditionalLogic(null);
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

              {/* Conditional Logic for Edit */}
              {previousQuestionsForEdit.length > 0 && (
                <ConditionalLogicEditor
                  conditionalLogic={editQuestionConditionalLogic}
                  onChange={setEditQuestionConditionalLogic}
                  previousQuestions={previousQuestionsForEdit}
                />
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
                      showFriendlyError({ error: "Question label is required" });
                      return;
                    }

                    // Validate options for choice questions
                    if (["single_choice", "multi_choice", "dropdown"].includes(editQuestion.questionType)) {
                      if (!editQuestionOptions || editQuestionOptions.length === 0 || editQuestionOptions.every(o => !o.trim())) {
                        showFriendlyError({ error: "At least one option is required for choice questions" });
                        return;
                      }
                    }

                    const payload: any = {
                      id: editQuestion.id,
                      label,
                      helpText: helpText || undefined,
                      isRequired: isRequired || false,
                      conditionalLogic: editQuestionConditionalLogic || null,
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

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent data-testid="dialog-assign-request">
          <DialogHeader>
            <DialogTitle>Assign & Issue Request</DialogTitle>
            <DialogDescription>
              Assign this custom request to a person and create a task instance for them to complete.
            </DialogDescription>
          </DialogHeader>
          <Form {...assignForm}>
            <form onSubmit={assignForm.handleSubmit(handleSubmitAssign)} className="space-y-4">
              <FormField
                control={assignForm.control}
                name="personId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Person</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-person">
                          <SelectValue placeholder="Select a person" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {people.map((relationship: any) => (
                          <SelectItem key={relationship.person.id} value={relationship.person.id} data-testid={`option-person-${relationship.person.id}`}>
                            {relationship.person.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={assignForm.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date (optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        data-testid="input-due-date" 
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
                  onClick={() => setAssignDialogOpen(false)}
                  data-testid="button-cancel-assign"
                >
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-confirm-assign">
                  <Send className="w-4 h-4 mr-2" />
                  Assign & Issue
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
