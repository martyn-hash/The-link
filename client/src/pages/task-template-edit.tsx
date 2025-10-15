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
import type { TaskTemplate, TaskTemplateSection, TaskTemplateCategory, InsertTaskTemplateSection, TaskTemplateQuestion, InsertTaskTemplateQuestion } from "@shared/schema";

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

interface SortableSection extends TaskTemplateSection {
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

function SortableSectionCard({ 
  section, 
  templateId,
  onEdit, 
  onDelete,
  onEditQuestion,
}: { 
  section: SortableSection; 
  templateId: string;
  onEdit: () => void; 
  onDelete: () => void;
  onEditQuestion: (question: TaskTemplateQuestion) => void;
}) {
  const { toast } = useToast();
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
  } = useSortable({ id: section.id });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `section-${section.id}`,
    data: { sectionId: section.id },
  });

  const combinedRef = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const { data: questions } = useQuery<TaskTemplateQuestion[]>({
    queryKey: ["/api/task-template-sections", section.id, "questions"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      return apiRequest("DELETE", `/api/task-template-questions/${questionId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Question deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/task-template-sections", section.id, "questions"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete question",
        variant: "destructive",
      });
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={combinedRef}
      style={style}
      className={`bg-card border rounded-lg p-4 mb-3 ${isOver ? 'ring-2 ring-primary' : ''}`}
      data-testid={`section-card-${section.id}`}
    >
      <div className="flex items-start space-x-3 mb-3">
        <button
          className="cursor-grab active:cursor-grabbing mt-1"
          {...attributes}
          {...listeners}
          data-testid={`drag-handle-${section.id}`}
        >
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h4 className="font-medium" data-testid={`section-title-${section.id}`}>
            {section.title}
          </h4>
          {section.description && (
            <p className="text-sm text-muted-foreground mt-1" data-testid={`section-description-${section.id}`}>
              {section.description}
            </p>
          )}
        </div>
        <div className="flex space-x-1">
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
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </div>

      {/* Questions List */}
      <div className="ml-8 space-y-2">
        {questions && questions.length > 0 ? (
          questions.map((question) => (
            <div
              key={question.id}
              className="flex items-center gap-2 p-2 bg-muted/30 rounded border"
              data-testid={`question-item-${question.id}`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{question.label}</p>
                  {question.isRequired && (
                    <Badge variant="destructive" className="text-xs px-1 py-0" data-testid={`badge-required-${question.id}`}>
                      Required
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{question.questionType}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onEditQuestion(question)}
                data-testid={`button-edit-question-${question.id}`}
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  if (confirm(`Delete question "${question.label}"?`)) {
                    deleteQuestionMutation.mutate(question.id);
                  }
                }}
                data-testid={`button-delete-question-${question.id}`}
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground italic py-2">
            No questions yet. Drag a question type here to add one.
          </p>
        )}
      </div>
    </div>
  );
}

function SectionModal({
  templateId,
  section,
  onSuccess,
}: {
  templateId: string;
  section?: TaskTemplateSection;
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
      return apiRequest("POST", `/api/task-templates/${templateId}/sections`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Section ${isEditing ? 'updated' : 'created'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates", templateId, "sections"] });
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
  section: TaskTemplateSection;
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
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates", section.templateId, "sections"] });
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
  const [editingSection, setEditingSection] = useState<TaskTemplateSection | null>(null);
  const [deletingSection, setDeletingSection] = useState<TaskTemplateSection | null>(null);
  const [editTemplateDialogOpen, setEditTemplateDialogOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<{ type: string; label: string } | null>(null);
  const [creatingQuestion, setCreatingQuestion] = useState<{ sectionId: string; questionType: string } | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<TaskTemplateQuestion | null>(null);

  const { data: template, isLoading: templateLoading } = useQuery<TaskTemplate>({
    queryKey: ["/api/task-templates", id],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!id,
  });

  const { data: categories } = useQuery<TaskTemplateCategory[]>({
    queryKey: ["/api/task-template-categories"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: sectionsData, isLoading: sectionsLoading } = useQuery<TaskTemplateSection[]>({
    queryKey: ["/api/task-templates", id, "sections"],
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
      return apiRequest("PATCH", `/api/task-templates/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates", id, "sections"] });
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: async (sectionData: { title: string; description?: string; sortOrder: number }) => {
      return apiRequest("POST", `/api/task-templates/${id}/sections`, sectionData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Section created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates", id, "sections"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create section",
        variant: "destructive",
      });
    },
  });

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
        const sortOrder = sections.length;
        createSectionMutation.mutate({
          title: "New Section",
          description: "",
          sortOrder,
        });
        return;
      }
      
      // If dropping a question type from palette into a section
      // Check if over.id starts with "section-" OR if it matches a section ID directly
      let targetSectionId: string | null = null;
      
      if (String(over.id).startsWith("section-")) {
        // Extract from droppable ID format: section-{uuid}
        targetSectionId = over.data?.current?.sectionId || null;
      } else if (sections.some(s => s.id === over.id)) {
        // over.id is a section ID directly (from sortable)
        targetSectionId = String(over.id);
      }
      
      if (targetSectionId) {
        setCreatingQuestion({ sectionId: targetSectionId, questionType: type });
        return;
      }
      
      return;
    }

    // Handle section reordering - only if dropping on another section
    if (active.id !== over.id && sections.some(s => s.id === over.id)) {
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
        <TopNavigation />
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
        <TopNavigation />
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

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="container mx-auto py-8">
        {/* Compact Header with Template Details */}
        <div className="mb-6">
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
              <h1 className="text-3xl font-bold" data-testid="text-template-name">{template.name}</h1>
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
                              onEditQuestion={setEditingQuestion}
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
                      queryClient.invalidateQueries({ queryKey: ["/api/task-templates", id, "sections"] });
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
                        queryClient.invalidateQueries({ queryKey: ["/api/task-templates", id, "sections"] });
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
        {creatingQuestion && (
          <Dialog open={true} onOpenChange={() => setCreatingQuestion(null)}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add {QUESTION_TYPES.find(qt => qt.type === creatingQuestion.questionType)?.label} Question</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const label = formData.get("label") as string;
                  const helpText = formData.get("helpText") as string;
                  const isRequired = formData.get("isRequired") === "on";
                  
                  apiRequest("POST", `/api/task-template-sections/${creatingQuestion.sectionId}/questions`, {
                    questionType: creatingQuestion.questionType,
                    label,
                    helpText: helpText || undefined,
                    isRequired,
                    order: 0,
                  })
                    .then(() => {
                      toast({
                        title: "Success",
                        description: "Question added successfully",
                      });
                      queryClient.invalidateQueries({ queryKey: ["/api/task-template-sections", creatingQuestion.sectionId, "questions"] });
                      setCreatingQuestion(null);
                    })
                    .catch((error) => {
                      toast({
                        title: "Error",
                        description: error instanceof Error ? error.message : "Failed to add question",
                        variant: "destructive",
                      });
                    });
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="question-label" className="text-sm font-medium">
                    Question Label *
                  </label>
                  <Input
                    id="question-label"
                    name="label"
                    required
                    placeholder="e.g. What is your full name?"
                    data-testid="input-question-label"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="question-help" className="text-sm font-medium">
                    Help Text (Optional)
                  </label>
                  <Textarea
                    id="question-help"
                    name="helpText"
                    placeholder="Additional guidance for this question"
                    data-testid="input-question-help"
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="question-required"
                    name="isRequired"
                    className="rounded border-gray-300"
                    data-testid="checkbox-question-required"
                  />
                  <label htmlFor="question-required" className="text-sm font-medium">
                    Required field
                  </label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreatingQuestion(null)}
                    data-testid="button-cancel-question"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-save-question">
                    Add Question
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Question Dialog */}
        {editingQuestion && (
          <Dialog open={true} onOpenChange={() => setEditingQuestion(null)}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit {QUESTION_TYPES.find(qt => qt.type === editingQuestion.questionType)?.label} Question</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const label = formData.get("label") as string;
                  const helpText = formData.get("helpText") as string;
                  const isRequired = formData.get("isRequired") === "on";
                  
                  apiRequest("PATCH", `/api/task-template-questions/${editingQuestion.id}`, {
                    label,
                    helpText: helpText || undefined,
                    isRequired,
                  })
                    .then(() => {
                      toast({
                        title: "Success",
                        description: "Question updated successfully",
                      });
                      queryClient.invalidateQueries({ queryKey: ["/api/task-template-sections", editingQuestion.sectionId, "questions"] });
                      setEditingQuestion(null);
                    })
                    .catch((error) => {
                      toast({
                        title: "Error",
                        description: error instanceof Error ? error.message : "Failed to update question",
                        variant: "destructive",
                      });
                    });
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="edit-question-label" className="text-sm font-medium">
                    Question Label *
                  </label>
                  <Input
                    id="edit-question-label"
                    name="label"
                    required
                    defaultValue={editingQuestion.label}
                    placeholder="e.g. What is your full name?"
                    data-testid="input-edit-question-label"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="edit-question-help" className="text-sm font-medium">
                    Help Text (Optional)
                  </label>
                  <Textarea
                    id="edit-question-help"
                    name="helpText"
                    defaultValue={editingQuestion.helpText || ""}
                    placeholder="Additional guidance for this question"
                    data-testid="input-edit-question-help"
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-question-required"
                    name="isRequired"
                    defaultChecked={editingQuestion.isRequired}
                    className="rounded border-gray-300"
                    data-testid="checkbox-edit-question-required"
                  />
                  <label htmlFor="edit-question-required" className="text-sm font-medium">
                    Required field
                  </label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingQuestion(null)}
                    data-testid="button-cancel-edit-question"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-save-edit-question">
                    Save Changes
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

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
