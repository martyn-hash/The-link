import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
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
} from "lucide-react";
import type { MergedTaskQuestion, ClientProjectTaskResponse, ClientProjectTaskInstance } from "@shared/schema";

interface TaskFormData {
  instance: ClientProjectTaskInstance;
  questions: MergedTaskQuestion[];
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
        }
      });
      setResponses(initialResponses);
      setSaveStatus(initialSaveStatus);
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

  const answeredCount = useMemo(() => {
    if (!data?.questions) return 0;
    return data.questions.filter(q => {
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
  }, [data?.questions, responses]);

  const requiredUnanswered = useMemo(() => {
    if (!data?.questions) return [];
    return data.questions.filter(q => {
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
  }, [data?.questions, responses]);

  const canSubmit = requiredUnanswered.length === 0;
  const progressPercent = data?.questions?.length ? (answeredCount / data.questions.length) * 100 : 0;

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

  const template = data.instance;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <img 
            src={logoPath} 
            alt="Growth Accountants" 
            className="h-12 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900" data-testid="task-title">
            Client Task
          </h1>
          <p className="text-muted-foreground mt-1">
            Please complete the questions below
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              {answeredCount} of {data.questions.length} questions answered
            </span>
            <span className="font-medium">
              {Math.round(progressPercent)}%
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" data-testid="progress-bar" />
        </div>

        {template && (
          <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen} className="mb-6">
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Instructions</CardTitle>
                    {instructionsOpen ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <p className="text-muted-foreground text-sm">
                    Please answer all required questions marked with a red asterisk (*). 
                    Your answers are saved automatically as you type. 
                    Click "Submit" when you're finished.
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        <div className="space-y-4">
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

        <div className="mt-8 space-y-4">
          {requiredUnanswered.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Required questions incomplete</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Please answer all required questions before submitting.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!showConfirmation ? (
            <Button
              data-testid="submit-button"
              className="w-full h-12 text-lg"
              disabled={!canSubmit}
              onClick={() => setShowConfirmation(true)}
            >
              <Send className="w-5 h-5 mr-2" />
              Continue to Submit
            </Button>
          ) : (
            <Card className="border-primary/20">
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
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by Growth Accountants
        </p>
      </div>
    </div>
  );
}
