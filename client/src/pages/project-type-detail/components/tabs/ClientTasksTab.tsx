import { useState, useMemo, useCallback } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { 
  Plus, Edit2, Trash2, Save, X, ClipboardList, GripVertical,
  Type, FileText, Mail, Hash, Calendar, CircleDot, CheckSquare, 
  ChevronDown, ChevronRight, ToggleLeft, Upload, HelpCircle, Layers, Library, Search, BookOpen
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { 
  ClientProjectTaskTemplateWithRelations, 
  ClientProjectTaskQuestion,
  ClientProjectTaskSection,
  KanbanStage,
  ChangeReason,
  SystemFieldLibrary
} from "@shared/schema";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { nanoid } from "nanoid";
import { FieldConfigModal as SharedFieldConfigModal } from "@/components/field-builder/FieldConfigModal";
import { clientTaskQuestionAdapter } from "@/components/field-builder/adapters";
import type { FieldDefinition } from "@/components/field-builder/types";

const QUESTION_TYPES = [
  { type: "short_text", label: "Short Text", icon: Type, color: "#3b82f6" },
  { type: "long_text", label: "Long Text", icon: FileText, color: "#8b5cf6" },
  { type: "email", label: "Email", icon: Mail, color: "#06b6d4" },
  { type: "number", label: "Number", icon: Hash, color: "#22c55e" },
  { type: "date", label: "Date", icon: Calendar, color: "#f59e0b" },
  { type: "single_choice", label: "Single Choice", icon: CircleDot, color: "#ec4899" },
  { type: "multi_choice", label: "Multi Choice", icon: CheckSquare, color: "#14b8a6" },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown, color: "#6366f1" },
  { type: "yes_no", label: "Yes/No", icon: ToggleLeft, color: "#84cc16" },
  { type: "file_upload", label: "File Upload", icon: Upload, color: "#f97316" },
] as const;

const SYSTEM_FIELD_CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "general", label: "General" },
  { value: "contact", label: "Contact" },
  { value: "financial", label: "Financial" },
  { value: "compliance", label: "Compliance" },
  { value: "documentation", label: "Documentation" },
  { value: "scheduling", label: "Scheduling" },
  { value: "custom", label: "Custom" },
] as const;

const WIZARD_STEPS = [
  { id: 1, name: "Basic Info", description: "Name and settings" },
  { id: 2, name: "Questions", description: "Build your form" },
] as const;

type QuestionType = typeof QUESTION_TYPES[number]["type"];

interface ConditionalLogicCondition {
  questionId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
  value?: string | number | boolean | string[];
}

interface ConditionalLogic {
  showIf?: ConditionalLogicCondition;
  logic?: 'and' | 'or';
  conditions?: ConditionalLogicCondition[];
}

interface EditingQuestion {
  id?: string;
  questionType: QuestionType;
  label: string;
  helpText: string;
  isRequired: boolean;
  order: number;
  options: string[];
  placeholder: string;
  sectionId?: string | null;
  conditionalLogic?: ConditionalLogic | null;
  libraryFieldId?: string | null;
}

interface EditingSection {
  id?: string;
  tempId?: string;
  name: string;
  description: string;
  order: number;
  isOpen?: boolean;
}

interface StageChangeRule {
  ifStageId: string;
  thenStageId: string;
  thenReasonId?: string | null;
}

interface EditingTemplate {
  id?: string;
  name: string;
  description: string;
  instructions: string;
  onCompletionStageId: string | null;
  onCompletionStageReasonId: string | null;
  stageChangeRules: StageChangeRule[];
  requireAllQuestions: boolean;
  expiryDaysAfterStart: number;
  requireOtp: boolean;
  isActive: boolean;
  sections: EditingSection[];
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
  sectionId: null,
  conditionalLogic: null,
  libraryFieldId: null,
};

const DEFAULT_SECTION: EditingSection = {
  name: "",
  description: "",
  order: 0,
  isOpen: true,
};

const DEFAULT_TEMPLATE: EditingTemplate = {
  name: "",
  description: "",
  instructions: "",
  onCompletionStageId: null,
  onCompletionStageReasonId: null,
  stageChangeRules: [],
  requireAllQuestions: true,
  expiryDaysAfterStart: 7,
  requireOtp: false,
  isActive: true,
  sections: [],
  questions: [],
};

function ClientTaskQuestionConfigModal({
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
      sectionId: question.sectionId,
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
      order: question.order,
      questionType: mappedBack.questionType as QuestionType,
      label: mappedBack.label || "",
      helpText: mappedBack.helpText || "",
      isRequired: mappedBack.isRequired ?? false,
      options: mappedBack.options || [],
      placeholder: mappedBack.placeholder || "",
      conditionalLogic: mappedBack.conditionalLogic as ConditionalLogic | null,
      libraryFieldId: mappedBack.libraryFieldId,
      sectionId: mappedBack.sectionId,
    });
  }, [question, onSave]);

  return (
    <SharedFieldConfigModal
      key={`question-${question.id || questionIndex}`}
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

interface ClientTasksTabProps {
  projectTypeId: string;
  projectTypeName?: string;
  stages?: KanbanStage[];
  reasons?: ChangeReason[];
  enableClientProjectTasks?: boolean;
}

function PaletteItem({ type, label, icon: Icon, color, onClick }: { type: string; label: string; icon: React.ElementType; color: string; onClick?: () => void }) {
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
      className={`flex items-center gap-3 px-3 py-2.5 bg-card border rounded-lg cursor-pointer hover:bg-accent hover:border-primary hover:shadow-sm transition-all text-sm group ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
      data-testid={`palette-question-${type}`}
    >
      <div 
        className="w-8 h-8 rounded-md flex items-center justify-center transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function QuestionsDropZone({ children, isOver }: { children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({
    id: 'questions-drop-zone',
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`transition-colors ${isOver ? 'ring-2 ring-primary ring-offset-2 rounded-lg' : ''}`}
    >
      {children}
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
  const iconColor = questionTypeInfo?.color || "#6b7280";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-1 flex items-center justify-between px-4 py-3 bg-card border rounded-lg hover:border-primary/50 hover:shadow-sm transition-all group"
      data-testid={`question-item-${question.id || question.order}`}
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div 
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          <QuestionIcon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{question.label || "Untitled question"}</p>
          {question.helpText && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{question.helpText}</p>
          )}
        </div>
        <Badge variant="outline" className="text-xs flex-shrink-0">
          {questionTypeInfo?.label || question.questionType}
        </Badge>
        {question.isRequired && (
          <Badge variant="secondary" className="text-xs flex-shrink-0">Required</Badge>
        )}
      </div>
      <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

function SectionEditor({
  section,
  onSave,
  onCancel,
}: {
  section: EditingSection;
  onSave: (s: EditingSection) => void;
  onCancel: () => void;
}) {
  const [editedSection, setEditedSection] = useState<EditingSection>(section);

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{section.id ? "Edit Section" : "New Section"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="section-name">Section Name *</Label>
            <Input
              id="section-name"
              value={editedSection.name}
              onChange={(e) => setEditedSection(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Business Information"
              data-testid="input-section-name"
            />
          </div>

          <div>
            <Label htmlFor="section-description">Description (optional)</Label>
            <Textarea
              id="section-description"
              value={editedSection.description}
              onChange={(e) => setEditedSection(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description shown to clients"
              rows={2}
              data-testid="input-section-description"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-section">
            Cancel
          </Button>
          <Button 
            onClick={() => onSave(editedSection)} 
            disabled={!editedSection.name.trim()}
            data-testid="button-save-section"
          >
            Save Section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StageReasonMap {
  id: string;
  stageId: string;
  reasonId: string;
}

export function ClientTasksTab({ projectTypeId, projectTypeName, stages = [], reasons = [], enableClientProjectTasks = true }: ClientTasksTabProps) {
  const { toast } = useToast();
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingTemplate, setEditingTemplate] = useState<EditingTemplate | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [systemLibrarySearch, setSystemLibrarySearch] = useState("");
  const [systemLibraryCategory, setSystemLibraryCategory] = useState<string>("all");
  const [isSystemLibraryExpanded, setIsSystemLibraryExpanded] = useState(false);

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
    if (!editingTemplate) return;
    
    const mappedType = mapSystemFieldTypeToQuestionType(systemField.fieldType);
    
    const newQuestion: EditingQuestion = {
      ...DEFAULT_QUESTION,
      questionType: mappedType,
      label: systemField.fieldName,
      helpText: systemField.description || "",
      isRequired: systemField.isRequired || false,
      options: systemField.options || [],
      order: editingTemplate.questions.length,
      libraryFieldId: systemField.id,
    };
    
    setEditingTemplate(prev => prev ? {
      ...prev,
      questions: [...prev.questions, newQuestion]
    } : null);
    
    setEditingQuestionIndex(editingTemplate.questions.length);
  };

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

  const { data: stageReasonMaps = [] } = useQuery<StageReasonMap[]>({
    queryKey: ["/api/config/stage-reason-maps"],
  });

  const { data: systemFields = [] } = useQuery<SystemFieldLibrary[]>({
    queryKey: ["/api/system-field-library"],
  });

  const filteredSystemFields = useMemo(() => {
    return systemFields.filter(field => {
      if (!ALLOWED_SYSTEM_FIELD_TYPES.includes(field.fieldType)) return false;
      if (systemLibraryCategory !== "all" && field.category !== systemLibraryCategory) return false;
      if (systemLibrarySearch) {
        const searchLower = systemLibrarySearch.toLowerCase();
        const matchesName = field.fieldName.toLowerCase().includes(searchLower);
        const matchesDescription = field.description?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesDescription) return false;
      }
      return true;
    });
  }, [systemFields, systemLibraryCategory, systemLibrarySearch, ALLOWED_SYSTEM_FIELD_TYPES]);

  const getFieldTypeIcon = (fieldType: string) => {
    const mapping: Record<string, typeof Type> = {
      "boolean": ToggleLeft,
      "number": Hash,
      "short_text": Type,
      "long_text": FileText,
      "date": Calendar,
      "single_select": CircleDot,
      "multi_select": CheckSquare,
      "email": Mail,
      "file_upload": Upload,
      "image_upload": Upload,
    };
    return mapping[fieldType] || Type;
  };

  const getFilteredReasonsForStage = (stageId: string | null) => {
    if (!stageId) return [];
    const validReasonIds = stageReasonMaps
      .filter(map => map.stageId === stageId)
      .map(map => map.reasonId);
    return reasons.filter(reason => validReasonIds.includes(reason.id));
  };

  const createTemplateMutation = useMutation({
    mutationFn: async (data: { template: Omit<EditingTemplate, "questions">; questions: EditingQuestion[] }) => {
      console.log("[ClientTasks] Creating template with", data.questions.length, "questions");
      
      const { sections: _, ...templateDataWithoutSections } = data.template as any;
      const templateRes = await apiRequest("POST", "/api/task-templates", {
        ...templateDataWithoutSections,
        projectTypeId,
      });
      const template = templateRes as { id: string };
      
      if (!template?.id) {
        throw new Error("Failed to create template - no ID returned");
      }
      
      console.log("[ClientTasks] Template created with ID:", template.id);
      
      const sections = (data.template as any).sections || [];
      const sectionIdMap: Record<string, string> = {};
      
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        const sectionRes = await apiRequest("POST", "/api/task-template-sections", {
          templateId: template.id,
          name: s.name,
          description: s.description || null,
          order: i,
        }) as { id: string };
        if (s.tempId) sectionIdMap[s.tempId] = sectionRes.id;
        if (s.id) sectionIdMap[s.id] = sectionRes.id;
      }
      
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        const sectionId = q.sectionId ? (sectionIdMap[q.sectionId] || q.sectionId) : null;
        console.log("[ClientTasks] Creating question", i, ":", q.label);
        await apiRequest("POST", "/api/task-template-questions", {
          templateId: template.id,
          sectionId,
          questionType: q.questionType,
          label: q.label,
          helpText: q.helpText || null,
          isRequired: q.isRequired,
          order: i,
          options: q.options.length > 0 ? q.options : null,
          placeholder: q.placeholder || null,
          libraryFieldId: q.libraryFieldId || null,
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
      const { id, questions: _, sections, ...templateData } = data.template;
      await apiRequest("PATCH", `/api/task-templates/${id}`, templateData);
      
      let existingSections: { id: string }[] = [];
      try {
        const res = await fetch(`/api/task-templates/${id}/sections`, { credentials: 'include' });
        if (res.ok) existingSections = await res.json();
      } catch (e) { /* ignore */ }
      
      const existingSectionIds = existingSections.map(s => s.id);
      const newSectionIds = sections.filter(s => s.id).map(s => s.id!);
      const sectionIdMap: Record<string, string> = {};
      
      for (const sId of existingSectionIds) {
        if (!newSectionIds.includes(sId)) {
          await apiRequest("DELETE", `/api/task-template-sections/${sId}`);
        }
      }
      
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        const sectionData = {
          templateId: id,
          name: s.name,
          description: s.description || null,
          order: i,
        };
        
        if (s.id) {
          await apiRequest("PATCH", `/api/task-template-sections/${s.id}`, sectionData);
          sectionIdMap[s.id] = s.id;
        } else {
          const newSection = await apiRequest("POST", "/api/task-template-sections", sectionData) as { id: string };
          if (s.tempId) sectionIdMap[s.tempId] = newSection.id;
        }
      }
      
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
        let sectionId = q.sectionId;
        if (sectionId && sectionIdMap[sectionId]) {
          sectionId = sectionIdMap[sectionId];
        }
        
        const questionData = {
          templateId: id,
          sectionId,
          questionType: q.questionType,
          label: q.label,
          helpText: q.helpText || null,
          isRequired: q.isRequired,
          order: i,
          options: q.options.length > 0 ? q.options : null,
          placeholder: q.placeholder || null,
          libraryFieldId: q.libraryFieldId || null,
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
    setCurrentStep(1);
    setIsBuilderOpen(true);
  };

  const handleEditTemplate = (template: ClientProjectTaskTemplateWithRelations) => {
    const sections: EditingSection[] = (template.sections || []).map((s: ClientProjectTaskSection) => ({
      id: s.id,
      name: s.name,
      description: s.description || "",
      order: s.order,
      isOpen: true,
    }));
    
    setEditingTemplate({
      id: template.id,
      name: template.name,
      description: template.description || "",
      instructions: template.instructions || "",
      onCompletionStageId: template.onCompletionStageId,
      onCompletionStageReasonId: template.onCompletionStageReasonId,
      stageChangeRules: (template.stageChangeRules as StageChangeRule[] | null) || [],
      requireAllQuestions: template.requireAllQuestions ?? true,
      expiryDaysAfterStart: template.expiryDaysAfterStart ?? 7,
      requireOtp: template.requireOtp ?? false,
      isActive: template.isActive ?? true,
      sections,
      questions: (template.questions || []).map(q => ({
        id: q.id,
        questionType: q.questionType as QuestionType,
        label: q.label,
        helpText: q.helpText || "",
        isRequired: q.isRequired ?? false,
        order: q.order,
        options: q.options || [],
        placeholder: q.placeholder || "",
        sectionId: (q as any).sectionId || null,
      })),
    });
    setCurrentStep(1);
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

  const handleDragOver = (event: any) => {
    const { over } = event;
    setIsOverDropZone(over?.id === 'questions-drop-zone' || over?.data?.current?.type === 'question');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsOverDropZone(false);

    if (!editingTemplate) return;

    // Handle dropping palette item onto drop zone
    if (active.id.toString().startsWith('palette-')) {
      // Accept drop on the drop zone or on any existing question
      if (!over || (over.id !== 'questions-drop-zone' && !over.data?.current?.type)) return;
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
    const overIndex = over ? editingTemplate.questions.findIndex(
      q => (q.id || `temp-${q.order}`) === over.id
    ) : -1;

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

  const handleAddSection = () => {
    if (!editingTemplate) return;
    const tempId = `temp-section-${nanoid(8)}`;
    const newSection: EditingSection = {
      ...DEFAULT_SECTION,
      tempId,
      name: `Section ${editingTemplate.sections.length + 1}`,
      order: editingTemplate.sections.length,
      isOpen: true,
    };
    setEditingTemplate(prev => prev ? {
      ...prev,
      sections: [...prev.sections, newSection]
    } : null);
    setEditingSectionIndex(editingTemplate.sections.length);
  };

  const handleSaveSection = (updatedSection: EditingSection) => {
    if (!editingTemplate || editingSectionIndex === null) return;
    
    setEditingTemplate(prev => {
      if (!prev) return null;
      const newSections = [...prev.sections];
      newSections[editingSectionIndex] = updatedSection;
      return { ...prev, sections: newSections };
    });
    setEditingSectionIndex(null);
  };

  const handleDeleteSection = (index: number) => {
    if (!editingTemplate) return;
    const sectionToDelete = editingTemplate.sections[index];
    const sectionKey = sectionToDelete.id || sectionToDelete.tempId;
    
    setEditingTemplate(prev => {
      if (!prev) return null;
      const newSections = prev.sections.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
      const newQuestions = prev.questions.map(q => 
        (q.sectionId === sectionKey) 
          ? { ...q, sectionId: null } 
          : q
      );
      return { ...prev, sections: newSections, questions: newQuestions };
    });
  };

  const toggleSectionCollapse = (sectionKey: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  const handleMoveQuestionToSection = (questionIndex: number, sectionId: string | null) => {
    setEditingTemplate(prev => {
      if (!prev) return null;
      const newQuestions = [...prev.questions];
      newQuestions[questionIndex] = { ...newQuestions[questionIndex], sectionId };
      return { ...prev, questions: newQuestions };
    });
  };

  if (templatesLoading) {
    return (
      <TabsContent value="client-tasks" className="page-container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map(i => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    );
  }

  if (isBuilderOpen && editingTemplate) {
    return (
      <>
        {/* Hidden TabsContent to maintain tab structure */}
        <TabsContent value="client-tasks" className="hidden" />
        
        {/* Full-screen modal overlay */}
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => { setIsBuilderOpen(false); setEditingTemplate(null); }} data-testid="button-cancel-builder">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {editingTemplate.id ? "Edit Task Template" : "Create Task Template"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {projectTypeName || "Project Type"} - Client Pre-Work Checklist
                  </p>
                </div>
              </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2">
              {WIZARD_STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => step.id < currentStep ? setCurrentStep(step.id) : undefined}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
                      step.id === currentStep
                        ? "bg-primary text-primary-foreground"
                        : step.id < currentStep
                        ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                    disabled={step.id > currentStep}
                    data-testid={`step-${step.id}`}
                  >
                    <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center text-xs font-medium">
                      {step.id}
                    </span>
                    <span className="text-sm font-medium">{step.name}</span>
                  </button>
                  {index < WIZARD_STEPS.length - 1 && (
                    <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {currentStep > 1 && (
                <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)} data-testid="button-previous-step">
                  Previous
                </Button>
              )}
              {currentStep < WIZARD_STEPS.length ? (
                <Button 
                  onClick={() => setCurrentStep(currentStep + 1)} 
                  disabled={!editingTemplate.name.trim()}
                  data-testid="button-next-step"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSaveTemplate} 
                  disabled={!editingTemplate.name.trim() || createTemplateMutation.isPending || updateTemplateMutation.isPending}
                  data-testid="button-save-template"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {createTemplateMutation.isPending || updateTemplateMutation.isPending ? "Saving..." : "Save Template"}
                </Button>
              )}
            </div>
          </div>

          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="flex-1 flex items-start justify-center p-8 overflow-y-auto">
              <Card className="w-full max-w-2xl">
                <CardHeader>
                  <CardTitle>Template Settings</CardTitle>
                  <CardDescription>Configure the basic settings for this client task template</CardDescription>
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
                          onCompletionStageId: value === "none" ? null : value,
                          onCompletionStageReasonId: null
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
                          {getFilteredReasonsForStage(editingTemplate.onCompletionStageId).map(reason => (
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
                    <div className="flex items-end gap-4 flex-wrap">
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
                          id="require-otp"
                          checked={editingTemplate.requireOtp}
                          onCheckedChange={(checked) => setEditingTemplate(prev => prev ? { 
                            ...prev, 
                            requireOtp: checked 
                          } : null)}
                          data-testid="switch-require-otp"
                        />
                        <Label htmlFor="require-otp" className="text-sm" title="Clients must verify their email with a one-time code">Email verification</Label>
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
            </div>
          )}

          {/* Step 2: Questions & Sections Builder */}
          {currentStep === 2 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
          <div className="flex-1 flex overflow-hidden">
            <div className="w-[400px] border-r border-border bg-muted/30 flex flex-col overflow-hidden">
              {/* System Library Section - Collapsible */}
              <Collapsible 
                open={isSystemLibraryExpanded} 
                onOpenChange={setIsSystemLibraryExpanded}
                className={`flex flex-col border-b border-border transition-all ${isSystemLibraryExpanded ? "flex-1 min-h-0" : ""}`}
              >
                <CollapsibleTrigger asChild>
                  <button 
                    className="w-full p-4 border-b border-border bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/30 transition-colors text-left"
                    data-testid="button-toggle-system-library"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">System Library</h3>
                        {!isSystemLibraryExpanded && (
                          <p className="text-xs text-muted-foreground">Click to browse reusable fields</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">{filteredSystemFields.length}</Badge>
                      <ChevronDown className={`w-4 h-4 text-emerald-600 transition-transform ${isSystemLibraryExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-border/50 space-y-2">
                    <Select value={systemLibraryCategory} onValueChange={setSystemLibraryCategory}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-system-field-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_FIELD_CATEGORY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search fields..."
                        value={systemLibrarySearch}
                        onChange={(e) => setSystemLibrarySearch(e.target.value)}
                        className="h-8 text-xs pl-8"
                        data-testid="input-system-field-search"
                      />
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-1.5">
                      {filteredSystemFields.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          {systemLibrarySearch || systemLibraryCategory !== "all" 
                            ? "No matching fields found" 
                            : "No system fields available"}
                        </p>
                      ) : (
                        filteredSystemFields.map(field => {
                          const Icon = getFieldTypeIcon(field.fieldType);
                          return (
                            <button
                              key={field.id}
                              onClick={() => handleAddQuestionFromSystemLibrary(field)}
                              className="w-full flex items-center gap-2.5 p-2.5 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-left group"
                              data-testid={`system-field-${field.id}`}
                            >
                              <div className="w-7 h-7 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <Icon className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-foreground truncate">{field.fieldName}</div>
                                {field.description && (
                                  <div className="text-[10px] text-muted-foreground truncate">{field.description}</div>
                                )}
                              </div>
                              <Plus className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>

              {/* Custom Question Types Section - Takes remaining space */}
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="p-3 border-b border-border/50 bg-blue-50/50 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-500" />
                    <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400">Custom Fields</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Click or drag to add</p>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-1.5">
                    {QUESTION_TYPES.map(qt => (
                      <PaletteItem 
                        key={qt.type} 
                        type={qt.type} 
                        label={qt.label} 
                        icon={qt.icon}
                        color={qt.color}
                        onClick={() => handleAddQuestion(qt.type as QuestionType)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

              <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-3xl mx-auto space-y-6">
                  <QuestionsDropZone isOver={isOverDropZone}>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-base">Questions & Sections</CardTitle>
                          <CardDescription>
                            Organize questions into collapsible sections
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleAddSection} data-testid="button-add-section">
                          <Layers className="w-4 h-4 mr-1" />
                          Add Section
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {editingTemplate.questions.length === 0 && editingTemplate.sections.length === 0 ? (
                          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                            <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                            <p className="text-sm text-muted-foreground">
                              Drag question types from the left panel to add them to your form
                            </p>
                          </div>
                        ) : (
                          <>
                            {editingTemplate.sections.map((section, sectionIndex) => {
                              const sectionKey = section.id || section.tempId || `temp-section-${sectionIndex}`;
                              const sectionQuestions = editingTemplate.questions.filter(q => q.sectionId === sectionKey);
                              const isCollapsed = collapsedSections.has(sectionKey);
                              const sectionColors = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899"];
                              const sectionColor = sectionColors[sectionIndex % sectionColors.length];
                              
                              return (
                                <div 
                                  key={sectionKey} 
                                  className="border rounded-lg overflow-hidden shadow-sm"
                                  style={{ borderLeftWidth: '3px', borderLeftColor: sectionColor }}
                                >
                                  <div 
                                    className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => toggleSectionCollapse(sectionKey)}
                                    data-testid={`section-header-${sectionIndex}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div 
                                        className="w-7 h-7 rounded-md flex items-center justify-center"
                                        style={{ backgroundColor: `${sectionColor}15` }}
                                      >
                                        <Layers className="w-3.5 h-3.5" style={{ color: sectionColor }} />
                                      </div>
                                      <div>
                                        <span className="font-semibold">{section.name}</span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                          {sectionQuestions.length} {sectionQuestions.length === 1 ? 'question' : 'questions'}
                                        </span>
                                      </div>
                                      {isCollapsed ? (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 w-7 p-0"
                                        onClick={() => setEditingSectionIndex(sectionIndex)}
                                        data-testid={`button-edit-section-${sectionIndex}`}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 w-7 p-0 text-destructive"
                                        onClick={() => handleDeleteSection(sectionIndex)}
                                        data-testid={`button-delete-section-${sectionIndex}`}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  {!isCollapsed && (
                                    <div className="p-3 space-y-2 bg-card">
                                      {sectionQuestions.length === 0 ? (
                                        <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-4 text-center">
                                          <p className="text-xs text-muted-foreground">
                                            No questions in this section yet. Drag questions here or move existing ones.
                                          </p>
                                        </div>
                                      ) : (
                                        <SortableContext
                                          items={sectionQuestions.map(q => q.id || `temp-${q.order}`)}
                                          strategy={verticalListSortingStrategy}
                                        >
                                          {sectionQuestions.map((question) => {
                                            const qIndex = editingTemplate.questions.findIndex(q => q === question);
                                            return (
                                              <SortableQuestionItem
                                                key={question.id || `temp-${qIndex}`}
                                                question={question}
                                                onEdit={() => setEditingQuestionIndex(qIndex)}
                                                onDelete={() => handleDeleteQuestion(qIndex)}
                                              />
                                            );
                                          })}
                                        </SortableContext>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {(() => {
                              const unsectionedQuestions = editingTemplate.questions.filter(q => !q.sectionId);
                              if (unsectionedQuestions.length === 0 && editingTemplate.sections.length > 0) return null;
                              
                              return (
                                <div className="space-y-2">
                                  {editingTemplate.sections.length > 0 && (
                                    <div className="text-sm font-medium text-muted-foreground mb-2">Unsectioned Questions</div>
                                  )}
                                  <SortableContext
                                    items={unsectionedQuestions.map(q => q.id || `temp-${q.order}`)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {unsectionedQuestions.map((question) => {
                                      const qIndex = editingTemplate.questions.findIndex(q => q === question);
                                      return (
                                        <div key={question.id || `temp-${qIndex}`} className="flex items-center gap-2">
                                          <SortableQuestionItem
                                            question={question}
                                            onEdit={() => setEditingQuestionIndex(qIndex)}
                                            onDelete={() => handleDeleteQuestion(qIndex)}
                                          />
                                          {editingTemplate.sections.length > 0 && (
                                            <Select
                                              value="unsectioned"
                                              onValueChange={(value) => handleMoveQuestionToSection(qIndex, value === "unsectioned" ? null : value)}
                                            >
                                              <SelectTrigger className="w-32 h-8 text-xs" data-testid={`select-section-${qIndex}`}>
                                                <SelectValue placeholder="Move to..." />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="unsectioned">No section</SelectItem>
                                                {editingTemplate.sections.map((s, i) => {
                                                  const sectionVal = s.id || s.tempId || `temp-section-${i}`;
                                                  return (
                                                    <SelectItem key={sectionVal} value={sectionVal}>
                                                      {s.name}
                                                    </SelectItem>
                                                  );
                                                })}
                                              </SelectContent>
                                            </Select>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </SortableContext>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </QuestionsDropZone>
                </div>
              </div>
          </div>
          </DndContext>
          )}

        </div>

        {editingQuestionIndex !== null && editingTemplate.questions[editingQuestionIndex] && (
          <ClientTaskQuestionConfigModal
            question={editingTemplate.questions[editingQuestionIndex]}
            questionIndex={editingQuestionIndex}
            allQuestions={editingTemplate.questions}
            isOpen={true}
            onClose={() => setEditingQuestionIndex(null)}
            onSave={handleSaveQuestion}
          />
        )}

        {editingSectionIndex !== null && editingTemplate.sections[editingSectionIndex] && (
          <SectionEditor
            section={editingTemplate.sections[editingSectionIndex]}
            onSave={handleSaveSection}
            onCancel={() => setEditingSectionIndex(null)}
          />
        )}
      </>
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={!enableClientProjectTasks ? 0 : undefined}>
                <Button 
                  onClick={handleAddTemplate} 
                  disabled={!enableClientProjectTasks}
                  data-testid="button-add-template"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Template
                </Button>
              </span>
            </TooltipTrigger>
            {!enableClientProjectTasks && (
              <TooltipContent>
                <p>Client Project Tasks need to be enabled in Project Type Settings</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {!templates || templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No task templates yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a task template to send pre-work checklists to clients
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={!enableClientProjectTasks ? 0 : undefined}>
                    <Button 
                      onClick={handleAddTemplate} 
                      disabled={!enableClientProjectTasks}
                      data-testid="button-add-template-empty"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Template
                    </Button>
                  </span>
                </TooltipTrigger>
                {!enableClientProjectTasks && (
                  <TooltipContent>
                    <p>Client Project Tasks need to be enabled in Project Type Settings</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(template => {
                const questionCount = template.questions?.length || 0;
                const sectionCount = template.sections?.length || 0;
                
                return (
                  <TableRow 
                    key={template.id} 
                    data-testid={`row-template-${template.id}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEditTemplate(template)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <ClipboardList className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <span data-testid={`text-template-name-${template.id}`}>{template.name}</span>
                          {template.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[250px]">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                        </Badge>
                        {sectionCount > 0 && (
                          <Badge variant="outline">
                            {sectionCount} {sectionCount === 1 ? 'section' : 'sections'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.isActive ? "default" : "secondary"}>
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {template.expiryDaysAfterStart} days
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${template.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditTemplate(template)} data-testid={`button-edit-template-${template.id}`}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeleteTemplateId(template.id)} 
                            className="text-destructive focus:text-destructive"
                            data-testid={`button-delete-template-${template.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
