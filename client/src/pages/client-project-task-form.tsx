import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useSwipeable } from "react-swipeable";
import confetti from "canvas-confetti";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import logoPath from "@assets/full_logo_transparent_600_1761924125378.png";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  Cloud,
  CloudOff,
  Send,
  FileText,
  Calendar,
  Hash,
  Mail,
  ToggleLeft,
  ListChecks,
  Upload,
  HelpCircle,
  PartyPopper,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { MergedTaskQuestion, ClientProjectTaskResponse, ClientProjectTaskInstance, TaskFormSection, ConditionalLogic } from "@shared/schema";

function evaluateCondition(
  condition: { questionId: string; operator: string; value?: any },
  responses: Record<string, ResponseValue>,
  allQuestions: MergedTaskQuestion[]
): boolean {
  const response = responses[condition.questionId];
  const question = allQuestions.find(q => q.id === condition.questionId);
  
  const getResponseValue = (): any => {
    if (!response) return undefined;
    if (response.valueText !== undefined && response.valueText !== null) return response.valueText;
    if (response.valueNumber !== undefined && response.valueNumber !== null) return response.valueNumber;
    if (response.valueBoolean !== undefined && response.valueBoolean !== null) {
      if (question?.questionType === 'yes_no') {
        return response.valueBoolean ? 'yes' : 'no';
      }
      return response.valueBoolean;
    }
    if (response.valueMultiSelect && response.valueMultiSelect.length > 0) return response.valueMultiSelect;
    if (response.valueDate) return response.valueDate;
    return undefined;
  };
  
  const responseValue = getResponseValue();
  const isEmpty = responseValue === undefined || responseValue === null || responseValue === '' || 
    (Array.isArray(responseValue) && responseValue.length === 0);
  
  switch (condition.operator) {
    case 'equals':
      if (Array.isArray(responseValue)) {
        return responseValue.includes(condition.value);
      }
      return String(responseValue) === String(condition.value);
    case 'not_equals':
      if (Array.isArray(responseValue)) {
        return !responseValue.includes(condition.value);
      }
      return String(responseValue) !== String(condition.value);
    case 'contains':
      if (Array.isArray(responseValue)) {
        return responseValue.some(v => String(v).toLowerCase().includes(String(condition.value).toLowerCase()));
      }
      return String(responseValue || '').toLowerCase().includes(String(condition.value || '').toLowerCase());
    case 'is_empty':
      return isEmpty;
    case 'is_not_empty':
      return !isEmpty;
    default:
      return true;
  }
}

function isQuestionVisible(
  question: MergedTaskQuestion,
  responses: Record<string, ResponseValue>,
  allQuestions: MergedTaskQuestion[]
): boolean {
  const conditionalLogic = question.conditionalLogic as ConditionalLogic | null;
  if (!conditionalLogic) return true;
  
  if (conditionalLogic.showIf) {
    const mainConditionMet = evaluateCondition(conditionalLogic.showIf, responses, allQuestions);
    
    if (conditionalLogic.conditions && conditionalLogic.conditions.length > 0) {
      const additionalResults = conditionalLogic.conditions.map(c => evaluateCondition(c, responses, allQuestions));
      
      if (conditionalLogic.logic === 'or') {
        return mainConditionMet || additionalResults.some(r => r);
      } else {
        return mainConditionMet && additionalResults.every(r => r);
      }
    }
    
    return mainConditionMet;
  }
  
  return true;
}

const CARD_BACKGROUND_COLORS = [
  'bg-blue-50/70',
  'bg-green-50/70',
  'bg-amber-50/70',
  'bg-rose-50/70',
  'bg-purple-50/70',
  'bg-cyan-50/70',
];

interface TaskFormData {
  instance: ClientProjectTaskInstance;
  questions: MergedTaskQuestion[];
  sections: TaskFormSection[];
  responses: ClientProjectTaskResponse[];
  token: {
    expiresAt: string | null;
    accessedAt: string | null;
  };
  recipientName?: string | null;
  recipientEmail?: string | null;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface ResponseValue {
  questionId: string;
  questionSource: 'template' | 'override';
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null;
  valueBoolean?: boolean | null;
  valueMultiSelect?: string[] | null;
  valueFile?: any | null;
}

function ExpiredOrSubmittedView({ 
  isSubmitted, 
  isExpired, 
  expiresAt 
}: { 
  isSubmitted: boolean; 
  isExpired: boolean; 
  expiresAt?: string | null;
}) {
  const formattedExpiryDate = expiresAt 
    ? format(new Date(expiresAt), "d MMMM yyyy 'at' h:mm a")
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <img 
            src={logoPath} 
            alt="Growth Accountants" 
            className="h-12 mx-auto mb-4"
          />
          
          {isSubmitted ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">Already Submitted</h2>
              <p className="text-muted-foreground">
                This task has already been completed. Thank you for your submission!
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-semibold">Link Expired</h2>
              <p className="text-muted-foreground">
                This link expired{formattedExpiryDate ? ` on ${formattedExpiryDate}` : ''}.
                Please contact your accountant for a new link.
              </p>
            </>
          )}
          
          <p className="text-sm text-muted-foreground">
            Need help? Just get in touch with your accountant.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SuccessView() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <img 
            src={logoPath} 
            alt="Growth Accountants" 
            className="h-12 mx-auto mb-4"
          />
          
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <PartyPopper className="w-10 h-10 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-green-700">Thank You!</h2>
          <p className="text-muted-foreground">
            Your responses have been submitted successfully. Your accountant will review them shortly.
          </p>
          
          <p className="text-sm text-muted-foreground pt-4">
            You can close this page now.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
  saveStatus,
}: {
  question: MergedTaskQuestion;
  value: ResponseValue | undefined;
  onChange: (value: ResponseValue) => void;
  saveStatus?: SaveStatus;
}) {
  const getInputIcon = () => {
    switch (question.questionType) {
      case 'short_text':
      case 'long_text':
        return <FileText className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'number':
        return <Hash className="w-4 h-4" />;
      case 'date':
        return <Calendar className="w-4 h-4" />;
      case 'yes_no':
        return <ToggleLeft className="w-4 h-4" />;
      case 'single_choice':
      case 'multi_choice':
      case 'dropdown':
        return <ListChecks className="w-4 h-4" />;
      case 'file_upload':
        return <Upload className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const createResponse = (updates: Partial<ResponseValue>): ResponseValue => ({
    questionId: question.id,
    questionSource: question.source,
    ...updates,
  });

  const renderInput = () => {
    switch (question.questionType) {
      case 'short_text':
        return (
          <Input
            data-testid={`input-${question.id}`}
            placeholder={question.placeholder || 'Enter your answer...'}
            value={value?.valueText || ''}
            onChange={(e) => onChange(createResponse({ valueText: e.target.value }))}
            className="w-full"
          />
        );

      case 'long_text':
        return (
          <Textarea
            data-testid={`textarea-${question.id}`}
            placeholder={question.placeholder || 'Enter your answer...'}
            value={value?.valueText || ''}
            onChange={(e) => onChange(createResponse({ valueText: e.target.value }))}
            className="w-full min-h-[100px]"
          />
        );

      case 'email':
        return (
          <Input
            data-testid={`input-email-${question.id}`}
            type="email"
            placeholder={question.placeholder || 'email@example.com'}
            value={value?.valueText || ''}
            onChange={(e) => onChange(createResponse({ valueText: e.target.value }))}
            className="w-full"
          />
        );

      case 'number':
        return (
          <Input
            data-testid={`input-number-${question.id}`}
            type="number"
            placeholder={question.placeholder || 'Enter a number...'}
            value={value?.valueNumber ?? ''}
            onChange={(e) => onChange(createResponse({ valueNumber: e.target.value ? Number(e.target.value) : null }))}
            className="w-full"
          />
        );

      case 'date':
        return (
          <Input
            data-testid={`input-date-${question.id}`}
            type="date"
            value={value?.valueDate ? value.valueDate.split('T')[0] : ''}
            onChange={(e) => onChange(createResponse({ valueDate: e.target.value || null }))}
            className="w-full"
          />
        );

      case 'yes_no':
        return (
          <RadioGroup
            data-testid={`radio-yesno-${question.id}`}
            value={value?.valueBoolean === true ? 'yes' : value?.valueBoolean === false ? 'no' : ''}
            onValueChange={(v) => onChange(createResponse({ valueBoolean: v === 'yes' }))}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id={`${question.id}-yes`} data-testid={`radio-yes-${question.id}`} />
              <Label htmlFor={`${question.id}-yes`}>Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id={`${question.id}-no`} data-testid={`radio-no-${question.id}`} />
              <Label htmlFor={`${question.id}-no`}>No</Label>
            </div>
          </RadioGroup>
        );

      case 'single_choice':
        return (
          <RadioGroup
            data-testid={`radio-single-${question.id}`}
            value={value?.valueText || ''}
            onValueChange={(v) => onChange(createResponse({ valueText: v }))}
            className="space-y-2"
          >
            {question.options?.map((option, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <RadioGroupItem 
                  value={option} 
                  id={`${question.id}-${idx}`} 
                  data-testid={`radio-option-${question.id}-${idx}`}
                />
                <Label htmlFor={`${question.id}-${idx}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'multi_choice':
        const selectedValues = value?.valueMultiSelect || [];
        return (
          <div className="space-y-2" data-testid={`checkbox-multi-${question.id}`}>
            {question.options?.map((option, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${idx}`}
                  data-testid={`checkbox-option-${question.id}-${idx}`}
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...selectedValues, option]
                      : selectedValues.filter(v => v !== option);
                    onChange(createResponse({ valueMultiSelect: newValues }));
                  }}
                />
                <Label htmlFor={`${question.id}-${idx}`}>{option}</Label>
              </div>
            ))}
          </div>
        );

      case 'dropdown':
        return (
          <Select
            value={value?.valueText || ''}
            onValueChange={(v) => onChange(createResponse({ valueText: v }))}
          >
            <SelectTrigger data-testid={`select-${question.id}`} className="w-full">
              <SelectValue placeholder={question.placeholder || 'Select an option...'} />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option, idx) => (
                <SelectItem 
                  key={idx} 
                  value={option}
                  data-testid={`select-option-${question.id}-${idx}`}
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'file_upload':
        return (
          <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
            <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Please email files directly to your accountant</p>
            <p className="text-xs mt-1 text-muted-foreground/70">File upload feature coming soon</p>
          </div>
        );

      default:
        return (
          <Input
            placeholder="Enter your answer..."
            value={value?.valueText || ''}
            onChange={(e) => onChange(createResponse({ valueText: e.target.value }))}
            className="w-full"
          />
        );
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1">
            <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
              {getInputIcon()}
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                {question.label}
                {question.isRequired && (
                  <span className="text-red-500 text-sm">*</span>
                )}
              </CardTitle>
              {question.helpText && (
                <CardDescription className="mt-1 flex items-start gap-1">
                  <HelpCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {question.helpText}
                </CardDescription>
              )}
            </div>
          </div>
          
          {saveStatus && (
            <div className="flex items-center gap-1 text-xs">
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Cloud className="w-3 h-3 text-green-600" />
                  <span className="text-green-600">Saved</span>
                </>
              )}
              {saveStatus === 'unsaved' && (
                <>
                  <CloudOff className="w-3 h-3 text-amber-600" />
                  <span className="text-amber-600">Unsaved</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertCircle className="w-3 h-3 text-red-600" />
                  <span className="text-red-600">Error</span>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {renderInput()}
      </CardContent>
      {question.source === 'override' && (
        <div className="absolute top-0 right-0 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-bl">
          Custom
        </div>
      )}
    </Card>
  );
}

export default function ClientProjectTaskFormPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [responses, setResponses] = useState<Record<string, ResponseValue>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'sections'>('cards');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [isPulsing, setIsPulsing] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const hasDismissedCelebration = useRef(false);
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const DEBOUNCE_MS = 1500;
  const hasTriggeredConfetti = useRef(false);

  const triggerConfetti = useCallback(() => {
    if (hasTriggeredConfetti.current) return;
    hasTriggeredConfetti.current = true;
    
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  }, []);

  const { data, isLoading, error, isError } = useQuery<TaskFormData>({
    queryKey: ['/api/client-task', token],
    enabled: !!token,
    retry: false,
  });

  const autoSaveMutation = useMutation({
    mutationFn: async (responsesToSave: ResponseValue[]) => {
      const response = await fetch(`/api/client-task/${token}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: responsesToSave }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save responses');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      variables.forEach(r => {
        setSaveStatus(prev => ({ ...prev, [r.questionId]: 'saved' }));
      });
    },
    onError: (error: Error, variables) => {
      variables.forEach(r => {
        setSaveStatus(prev => ({ ...prev, [r.questionId]: 'error' }));
      });
      toast({
        variant: "destructive",
        title: "Couldn't save your response",
        description: "Please check your connection and try again.",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const allResponses = Object.values(responses);
      const response = await fetch(`/api/client-task/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          responses: allResponses,
          completedByName: submitterName || undefined,
          completedByEmail: submitterEmail || undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit');
      }
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      triggerConfetti();
    },
    onError: (error: Error) => {
      let friendlyDescription = error.message;
      
      if (error.message.includes('expired')) {
        friendlyDescription = "This link has expired. Please contact your accountant for a new link.";
      } else if (error.message.includes('already submitted')) {
        friendlyDescription = "This task has already been submitted.";
      }
      
      toast({
        title: "Couldn't submit",
        description: friendlyDescription,
        variant: "destructive",
      });
    },
  });

  const debouncedSave = useCallback((questionId: string, responseValue: ResponseValue) => {
    if (saveTimeouts.current[questionId]) {
      clearTimeout(saveTimeouts.current[questionId]);
    }

    setSaveStatus(prev => ({ ...prev, [questionId]: 'unsaved' }));

    saveTimeouts.current[questionId] = setTimeout(() => {
      setSaveStatus(prev => ({ ...prev, [questionId]: 'saving' }));
      autoSaveMutation.mutate([responseValue]);
    }, DEBOUNCE_MS);
  }, [autoSaveMutation]);

  useEffect(() => {
    return () => {
      Object.values(saveTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (data?.responses) {
      const initialResponses: Record<string, ResponseValue> = {};
      const initialSaveStatus: Record<string, SaveStatus> = {};
      let hasSavedResponses = false;
      
      data.responses.forEach(r => {
        initialResponses[r.questionId] = {
          questionId: r.questionId,
          questionSource: r.questionSource as 'template' | 'override',
          valueText: r.valueText,
          valueNumber: r.valueNumber,
          valueDate: r.valueDate ? new Date(r.valueDate).toISOString() : null,
          valueBoolean: r.valueBoolean,
          valueMultiSelect: r.valueMultiSelect,
          valueFile: r.valueFile,
        };
        if (r.answeredAt) {
          initialSaveStatus[r.questionId] = 'saved';
          hasSavedResponses = true;
        }
      });
      setResponses(initialResponses);
      setSaveStatus(initialSaveStatus);
      
      if (hasSavedResponses) {
        setShowWelcomeBack(true);
        setTimeout(() => setShowWelcomeBack(false), 4000);
      }
    }
  }, [data?.responses]);

  useEffect(() => {
    if (data) {
      if (data.recipientName) setSubmitterName(data.recipientName);
      if (data.recipientEmail) setSubmitterEmail(data.recipientEmail);
    }
  }, [data]);

  const handleResponseChange = useCallback((value: ResponseValue) => {
    setResponses(prev => ({
      ...prev,
      [value.questionId]: value,
    }));
    debouncedSave(value.questionId, value);
  }, [debouncedSave]);

  const visibleQuestions = useMemo(() => {
    if (!data?.questions) return [];
    return data.questions.filter(q => isQuestionVisible(q, responses, data.questions));
  }, [data?.questions, responses]);

  const answeredCount = useMemo(() => {
    return visibleQuestions.filter(q => {
      const response = responses[q.id];
      if (!response) return false;
      if (response.valueText) return true;
      if (response.valueNumber !== null && response.valueNumber !== undefined) return true;
      if (response.valueDate) return true;
      if (response.valueBoolean !== null && response.valueBoolean !== undefined) return true;
      if (response.valueMultiSelect && response.valueMultiSelect.length > 0) return true;
      if (response.valueFile) return true;
      return false;
    }).length;
  }, [visibleQuestions, responses]);

  const requiredUnanswered = useMemo(() => {
    return visibleQuestions.filter(q => {
      if (!q.isRequired) return false;
      const response = responses[q.id];
      if (!response) return true;
      if (response.valueText) return false;
      if (response.valueNumber !== null && response.valueNumber !== undefined) return false;
      if (response.valueDate) return false;
      if (response.valueBoolean !== null && response.valueBoolean !== undefined) return false;
      if (response.valueMultiSelect && response.valueMultiSelect.length > 0) return false;
      if (response.valueFile) return false;
      return true;
    });
  }, [visibleQuestions, responses]);

  const canSubmit = requiredUnanswered.length === 0;
  const progressPercent = visibleQuestions.length ? (answeredCount / visibleQuestions.length) * 100 : 0;
  const totalQuestions = visibleQuestions.length;
  const currentQuestion = visibleQuestions[currentQuestionIndex];
  const allQuestionsAnswered = answeredCount === totalQuestions && totalQuestions > 0;

  // Group questions by section for section-based navigation
  const sectionGroups = useMemo(() => {
    if (!visibleQuestions.length) return [];
    
    const sections = data?.sections || [];
    const groups: { id: string | null; name: string; description: string | null; questions: MergedTaskQuestion[] }[] = [];
    
    // Group visible questions by sectionId
    const questionsBySection = new Map<string | null, MergedTaskQuestion[]>();
    visibleQuestions.forEach(q => {
      const sectionId = q.sectionId || null;
      if (!questionsBySection.has(sectionId)) {
        questionsBySection.set(sectionId, []);
      }
      questionsBySection.get(sectionId)!.push(q);
    });
    
    // Add sections in order (only if they have questions)
    sections.forEach(section => {
      const questions = questionsBySection.get(section.id) || [];
      if (questions.length > 0) {
        groups.push({
          id: section.id,
          name: section.name,
          description: section.description,
          questions,
        });
        questionsBySection.delete(section.id);
      }
    });
    
    // Add unsectioned questions as "General Questions" only if:
    // 1. There are unsectioned questions AND
    // 2. There is at least one actual section with questions (otherwise, no sections view)
    const unsectionedQuestions = questionsBySection.get(null) || [];
    if (unsectionedQuestions.length > 0 && groups.length > 0) {
      groups.unshift({
        id: null,
        name: 'General Questions',
        description: null,
        questions: unsectionedQuestions,
      });
    }
    
    return groups;
  }, [visibleQuestions, data?.sections]);

  const totalSections = sectionGroups.length;
  // hasSections: true if any sections exist (enables section UI)
  const hasSections = totalSections > 0;
  // hasMultipleSections: true if navigating between sections makes sense
  const hasMultipleSections = totalSections >= 2;
  const currentSection = sectionGroups[Math.min(currentSectionIndex, Math.max(0, totalSections - 1))];
  const currentSectionQuestions = currentSection?.questions || [];

  const isQuestionAnswered = useCallback((questionId: string) => {
    const response = responses[questionId];
    if (!response) return false;
    if (response.valueText) return true;
    if (response.valueNumber !== null && response.valueNumber !== undefined) return true;
    if (response.valueDate) return true;
    if (response.valueBoolean !== null && response.valueBoolean !== undefined) return true;
    if (response.valueMultiSelect && response.valueMultiSelect.length > 0) return true;
    if (response.valueFile) return true;
    return false;
  }, [responses]);

  const navigatePrev = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 300);
    }
  }, [currentQuestionIndex]);

  const navigateNext = useCallback(() => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 300);
    } else if (allQuestionsAnswered && !hasDismissedCelebration.current) {
      setShowCelebration(true);
      triggerConfetti();
    }
  }, [currentQuestionIndex, totalQuestions, allQuestionsAnswered, triggerConfetti]);

  const navigatePrevSection = useCallback(() => {
    if (!hasSections) return;
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 300);
    }
  }, [currentSectionIndex, hasSections]);

  const navigateNextSection = useCallback(() => {
    if (!hasSections) return;
    if (currentSectionIndex < totalSections - 1) {
      setCurrentSectionIndex(prev => prev + 1);
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 300);
    } else if (allQuestionsAnswered && !hasDismissedCelebration.current) {
      setShowCelebration(true);
      triggerConfetti();
    }
  }, [currentSectionIndex, totalSections, hasSections, allQuestionsAnswered, triggerConfetti]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => (viewMode === 'sections' && hasSections) ? navigateNextSection() : navigateNext(),
    onSwipedRight: () => (viewMode === 'sections' && hasSections) ? navigatePrevSection() : navigatePrev(),
    preventScrollOnSwipe: true,
    trackMouse: false,
  });

  const globalSaveStatus = useMemo(() => {
    const statuses = Object.values(saveStatus);
    if (statuses.length === 0) return null;
    if (statuses.some(s => s === 'error')) return 'error';
    if (statuses.some(s => s === 'saving')) return 'saving';
    if (statuses.some(s => s === 'unsaved')) return 'unsaved';
    if (statuses.every(s => s === 'saved')) return 'saved';
    return null;
  }, [saveStatus]);

  useEffect(() => {
    if (!allQuestionsAnswered) {
      hasDismissedCelebration.current = false;
      hasTriggeredConfetti.current = false;
    }
  }, [allQuestionsAnswered]);

  // Track if initial view mode has been set based on sections availability
  const hasInitializedViewMode = useRef(false);

  // Initialize view mode once when data loads - if multiple sections available, use sections on mobile
  useEffect(() => {
    if (!data || hasInitializedViewMode.current) return;
    
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    if (hasMultipleSections && isMobile) {
      setViewMode('sections');
    }
    hasInitializedViewMode.current = true;
  }, [data, hasMultipleSections]);

  // Fallback: if currently in sections mode but no sections available, switch to cards
  useEffect(() => {
    if (!hasSections && viewMode === 'sections') {
      setViewMode('cards');
    }
  }, [hasSections, viewMode]);

  // Clamp currentSectionIndex when sectionGroups change
  useEffect(() => {
    if (totalSections > 0 && currentSectionIndex >= totalSections) {
      setCurrentSectionIndex(Math.max(0, totalSections - 1));
    }
  }, [totalSections, currentSectionIndex]);

  // Clamp currentQuestionIndex when visible questions change
  useEffect(() => {
    if (totalQuestions > 0 && currentQuestionIndex >= totalQuestions) {
      setCurrentQuestionIndex(Math.max(0, totalQuestions - 1));
    }
  }, [totalQuestions, currentQuestionIndex]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <img 
            src={logoPath} 
            alt="Growth Accountants" 
            className="h-12 mx-auto mb-4 animate-pulse"
          />
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground mt-2">Loading your task...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = (error as any)?.message || 'Something went wrong';
    const isExpired = errorMessage.includes('expired');
    const isAlreadySubmitted = errorMessage.includes('submitted');
    
    if (isExpired || isAlreadySubmitted) {
      return (
        <ExpiredOrSubmittedView 
          isSubmitted={isAlreadySubmitted} 
          isExpired={isExpired} 
        />
      );
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground">
              We couldn't load this task. The link may be invalid or expired.
            </p>
            <p className="text-sm text-muted-foreground">
              Please contact your accountant for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return <SuccessView />;
  }

  if (!data) {
    return null;
  }

  // Celebration screen when all questions answered
  if (showCelebration && !isSubmitted) {
    return (
      <div className="h-[100dvh] bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 flex flex-col items-center justify-center p-4 overflow-hidden">
        <div className="text-center max-w-md mx-auto">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mx-auto mb-6 flex items-center justify-center shadow-lg animate-bounce">
            <PartyPopper className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold text-green-800 mb-3">
            Amazing Work!
          </h1>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            <p className="text-lg text-green-700">
              You've answered all {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'}!
            </p>
            <Sparkles className="w-5 h-5 text-yellow-500" />
          </div>
          
          <div className="bg-white/80 backdrop-blur rounded-xl p-4 mb-6 border border-green-200 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
              <Cloud className="w-4 h-4" />
              <span className="text-sm font-medium">All your answers are safely saved</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your progress is automatically saved to the cloud. You won't lose anything!
            </p>
          </div>
          
          <Button
            onClick={() => {
              setShowCelebration(false);
              setShowConfirmation(true);
            }}
            size="lg"
            className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg"
            data-testid="button-submit-celebration"
          >
            <Send className="w-6 h-6 mr-2" />
            Continue to Submit
          </Button>
          
          <button
            onClick={() => {
              setShowCelebration(false);
              hasDismissedCelebration.current = true;
            }}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground underline"
            data-testid="button-review-answers"
          >
            Wait, let me review my answers first
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col overflow-hidden fixed inset-0 overscroll-none touch-none">
      {/* Welcome back toast */}
      {showWelcomeBack && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
            <Cloud className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">Welcome back! Your progress is saved</span>
          </div>
        </div>
      )}

      {/* Compact header */}
      <header className="bg-white border-b shrink-0">
        <div className="max-w-4xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <img src={logoPath} alt="Logo" className="h-7" />
            <div className="flex items-center gap-3">
              {/* Global save status */}
              {globalSaveStatus && (
                <div className="flex items-center gap-1 text-xs">
                  {globalSaveStatus === 'saving' && (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground hidden sm:inline">Saving...</span>
                    </>
                  )}
                  {globalSaveStatus === 'saved' && (
                    <>
                      <Cloud className="w-3 h-3 text-green-600" />
                      <span className="text-green-600 hidden sm:inline">Saved</span>
                    </>
                  )}
                  {globalSaveStatus === 'unsaved' && (
                    <>
                      <CloudOff className="w-3 h-3 text-amber-600" />
                      <span className="text-amber-600 hidden sm:inline">Unsaved</span>
                    </>
                  )}
                  {globalSaveStatus === 'error' && (
                    <>
                      <AlertCircle className="w-3 h-3 text-red-600" />
                      <span className="text-red-600 hidden sm:inline">Error</span>
                    </>
                  )}
                </div>
              )}
              <div className="text-right">
                <p className="text-xs font-medium">Client Task</p>
                <p className="text-[10px] text-muted-foreground">{answeredCount} of {totalQuestions} answered</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className={cn(
        "flex-1 min-h-0 max-w-4xl mx-auto px-3 py-3 w-full flex flex-col",
        viewMode === 'cards' || viewMode === 'sections' ? "overflow-hidden" : "overflow-y-auto"
      )}>
        {/* View mode toggle - desktop only */}
        <div className="hidden sm:flex justify-end gap-2 mb-3">
          {hasSections && (
            <Button
              variant={viewMode === 'sections' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('sections')}
              data-testid="button-view-sections"
            >
              Sections
            </Button>
          )}
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
            data-testid="button-view-cards"
          >
            Cards
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            data-testid="button-view-list"
          >
            List
          </Button>
        </div>

        {/* Confirmation card */}
        {showConfirmation ? (
          <Card className="border-primary/20 mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Confirm Your Submission</CardTitle>
              <CardDescription>
                Please confirm your details before submitting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="submitter-name">Your Name</Label>
                <Input
                  id="submitter-name"
                  data-testid="input-submitter-name"
                  placeholder="Enter your name"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitter-email">Your Email</Label>
                <Input
                  id="submitter-email"
                  data-testid="input-submitter-email"
                  type="email"
                  placeholder="Enter your email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowConfirmation(false)}
                >
                  Back
                </Button>
                <Button
                  data-testid="confirm-submit-button"
                  className="flex-1"
                  disabled={submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Submit
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'sections' && hasSections && currentSection ? (
          /* Sections view - one section at a time with all its questions */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden" {...swipeHandlers}>
            <Card 
              className={cn(
                "flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-300",
                CARD_BACKGROUND_COLORS[currentSectionIndex % CARD_BACKGROUND_COLORS.length]
              )}
              style={{ touchAction: 'pan-y' }} 
              data-testid={`section-card-${currentSection.id || 'general'}`}
            >
              <CardHeader className="border-b py-2 px-3 bg-white/50 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs transition-all duration-300",
                        isPulsing && "scale-125 bg-primary text-primary-foreground animate-pulse"
                      )}
                    >
                      Section {currentSectionIndex + 1} of {totalSections}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium">{currentSection.name}</div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto pt-3 pb-3 px-3 space-y-4 touch-pan-y overscroll-contain">
                {/* Section description if present */}
                {currentSection.description && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">{currentSection.description}</p>
                  </div>
                )}

                {/* All questions in this section */}
                {currentSectionQuestions.map((question, qIndex) => (
                  <div key={question.id} className="bg-white rounded-lg p-3 border">
                    <div className="flex items-start gap-2 mb-2">
                      <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">{question.label}</p>
                          {isQuestionAnswered(question.id) && (
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          )}
                        </div>
                        {question.helpText && (
                          <p className="text-xs text-muted-foreground mt-0.5">{question.helpText}</p>
                        )}
                        {question.isRequired && (
                          <Badge variant="destructive" className="text-[10px] py-0 mt-1">Required</Badge>
                        )}
                      </div>
                    </div>
                    <QuestionInput
                      question={question}
                      value={responses[question.id]}
                      onChange={handleResponseChange}
                      saveStatus={saveStatus[question.id]}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : viewMode === 'cards' && currentQuestion ? (
          /* Card view - swipeable single question */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden" {...swipeHandlers}>
            <Card 
              className={cn(
                "flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-300",
                CARD_BACKGROUND_COLORS[currentQuestionIndex % CARD_BACKGROUND_COLORS.length]
              )}
              style={{ touchAction: 'pan-y' }} 
              data-testid={`question-card-${currentQuestion.id}`}
            >
              <CardHeader className="border-b py-2 px-3 bg-white/50 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs transition-all duration-300",
                        isPulsing && "scale-125 bg-primary text-primary-foreground animate-pulse"
                      )}
                    >
                      {currentQuestionIndex + 1} of {totalQuestions}
                    </Badge>
                    {currentQuestion.isRequired && (
                      <Badge variant="destructive" className="text-xs py-0">Required</Badge>
                    )}
                  </div>
                  {isQuestionAnswered(currentQuestion.id) && (
                    <Badge variant="default" className="bg-green-600 text-xs py-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Answered
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto pt-3 pb-3 px-3 space-y-3 touch-pan-y overscroll-contain">
                {/* Question label in blue box */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">{currentQuestion.label}</p>
                      {currentQuestion.helpText && (
                        <p className="text-xs text-blue-600 mt-1">{currentQuestion.helpText}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Input field */}
                <div className="bg-white rounded-lg p-3 border">
                  <QuestionInput
                    question={currentQuestion}
                    value={responses[currentQuestion.id]}
                    onChange={handleResponseChange}
                    saveStatus={saveStatus[currentQuestion.id]}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* List view - all questions stacked */
          <div className="space-y-4 pb-24">
            {data.questions.map((question, index) => (
              <QuestionInput
                key={question.id}
                question={question}
                value={responses[question.id]}
                onChange={handleResponseChange}
                saveStatus={saveStatus[question.id]}
              />
            ))}
          </div>
        )}
      </main>

      {/* Fixed footer with navigation/submit */}
      {!showConfirmation && (
        <footer className="bg-white border-t shrink-0 p-3">
          <div className="max-w-4xl mx-auto">
            {viewMode === 'sections' && hasSections ? (
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={navigatePrevSection}
                  disabled={currentSectionIndex === 0}
                  className="flex-1 sm:flex-none"
                  data-testid="button-prev-section"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                
                <div className="flex-1 max-w-xs hidden sm:block">
                  <Progress value={progressPercent} className="h-2" data-testid="progress-bar" />
                </div>
                
                {currentSectionIndex === totalSections - 1 && canSubmit ? (
                  <Button
                    onClick={() => setShowConfirmation(true)}
                    className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
                    data-testid="submit-button"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Submit</span>
                  </Button>
                ) : (
                  <Button
                    onClick={navigateNextSection}
                    disabled={currentSectionIndex === totalSections - 1}
                    className="flex-1 sm:flex-none"
                    data-testid="button-next-section"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            ) : viewMode === 'cards' ? (
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={navigatePrev}
                  disabled={currentQuestionIndex === 0}
                  className="flex-1 sm:flex-none"
                  data-testid="button-prev"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                
                <div className="flex-1 max-w-xs hidden sm:block">
                  <Progress value={progressPercent} className="h-2" data-testid="progress-bar" />
                </div>
                
                {currentQuestionIndex === totalQuestions - 1 && canSubmit ? (
                  <Button
                    onClick={() => setShowConfirmation(true)}
                    className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
                    data-testid="submit-button"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Submit</span>
                  </Button>
                ) : (
                  <Button
                    onClick={navigateNext}
                    disabled={currentQuestionIndex === totalQuestions - 1}
                    className="flex-1 sm:flex-none"
                    data-testid="button-next"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            ) : (
              /* List view footer */
              <Button
                onClick={() => setShowConfirmation(true)}
                disabled={!canSubmit}
                className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg"
                data-testid="submit-button"
              >
                <Send className="w-5 h-5 mr-2" />
                Continue to Submit
              </Button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
