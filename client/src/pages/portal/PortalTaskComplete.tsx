import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { format } from "date-fns";
import { ArrowLeft, Calendar as CalendarIcon, Save, Send, AlertCircle } from "lucide-react";

interface Question {
  id: string;
  type: string;
  label: string;
  isRequired: boolean;
  options?: string[];
  validationRules?: any;
  order: number;
}

interface Section {
  id: string;
  name: string;
  order: number;
  questions: Question[];
}

interface TaskInstance {
  id: string;
  status: string;
  template: {
    name: string;
    description: string;
  };
  sections: Section[];
  responses: Record<string, any>;
  submittedAt?: string;
}

export default function PortalTaskComplete() {
  const [, params] = useRoute("/portal/tasks/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const taskId = params?.id;
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});

  // Fetch task instance
  const { data: taskInstance, isLoading, error } = useQuery<TaskInstance>({
    queryKey: ['/api/portal/task-instances', taskId],
    queryFn: getQueryFn(`/api/portal/task-instances/${taskId}`),
    enabled: !!taskId,
    retry: 2,
  });

  // Initialize form data with existing responses
  useEffect(() => {
    if (taskInstance?.responses) {
      setFormData(taskInstance.responses);
    }
  }, [taskInstance]);

  // Save progress mutation
  const saveProgressMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return await apiRequest("PATCH", `/api/portal/task-instances/${taskId}`, {
        responses: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Progress Saved",
        description: "Your responses have been saved",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portal/task-instances', taskId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to save progress",
        variant: "destructive",
      });
    },
  });

  // Submit task mutation
  const submitTaskMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return await apiRequest("POST", `/api/portal/task-instances/${taskId}/submit`, {
        responses: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Your request has been submitted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/portal/task-instances'] });
      setLocation('/portal/tasks');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to submit request",
        variant: "destructive",
      });
    },
  });

  // Handle field change
  const handleFieldChange = (questionId: string, value: any) => {
    setFormData(prev => ({ ...prev, [questionId]: value }));
    // Clear error when field is updated
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  // Handle file upload
  const handleFileUpload = async (questionId: string, file: File) => {
    try {
      setUploadingFiles(prev => ({ ...prev, [questionId]: true }));

      // Request upload URL
      const uploadUrlResponse = await apiRequest("POST", "/api/portal/task-instances/upload-url", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        instanceId: taskId,
        questionId,
      });

      // Upload to object storage
      const uploadResponse = await fetch(uploadUrlResponse.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Confirm upload with server
      const confirmResponse = await apiRequest("POST", "/api/portal/task-instances/confirm-upload", {
        objectPath: uploadUrlResponse.objectPath,
        fileName: uploadUrlResponse.fileName,
        fileType: uploadUrlResponse.fileType,
        fileSize: uploadUrlResponse.fileSize,
        instanceId: taskId,
        questionId,
      });

      // Update form data with document reference
      handleFieldChange(questionId, JSON.stringify(confirmResponse.response));

      toast({
        title: "File Uploaded",
        description: `${file.name} has been uploaded successfully`,
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: error?.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(prev => ({ ...prev, [questionId]: false }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    taskInstance?.sections.forEach(section => {
      section.questions.forEach(question => {
        if (question.isRequired && !formData[question.id]) {
          newErrors[question.id] = "This field is required";
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    saveProgressMutation.mutate(formData);
  };

  // Handle submit
  const handleSubmit = () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    submitTaskMutation.mutate(formData);
  };

  // Render question based on type
  const renderQuestion = (question: Question) => {
    const value = formData[question.id];
    const hasError = !!errors[question.id];

    switch (question.type) {
      case 'text':
      case 'email':
      case 'number':
        return (
          <div className="space-y-2">
            <Label htmlFor={question.id}>
              {question.label}
              {question.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={question.id}
              type={question.type}
              value={value || ''}
              onChange={(e) => handleFieldChange(question.id, e.target.value)}
              className={hasError ? 'border-red-500' : ''}
              data-testid={`input-${question.id}`}
            />
            {hasError && (
              <p className="text-sm text-red-500" data-testid={`error-${question.id}`}>
                {errors[question.id]}
              </p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div className="space-y-2">
            <Label htmlFor={question.id}>
              {question.label}
              {question.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={question.id}
              value={value || ''}
              onChange={(e) => handleFieldChange(question.id, e.target.value)}
              rows={4}
              className={hasError ? 'border-red-500' : ''}
              data-testid={`textarea-${question.id}`}
            />
            {hasError && (
              <p className="text-sm text-red-500" data-testid={`error-${question.id}`}>
                {errors[question.id]}
              </p>
            )}
          </div>
        );

      case 'date':
        return (
          <div className="space-y-2">
            <Label htmlFor={question.id}>
              {question.label}
              {question.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal ${hasError ? 'border-red-500' : ''}`}
                  data-testid={`button-date-${question.id}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value ? format(new Date(value), 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={value ? new Date(value) : undefined}
                  onSelect={(date) => handleFieldChange(question.id, date?.toISOString())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {hasError && (
              <p className="text-sm text-red-500" data-testid={`error-${question.id}`}>
                {errors[question.id]}
              </p>
            )}
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            <Label>
              {question.label}
              {question.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <RadioGroup
              value={value || ''}
              onValueChange={(val) => handleFieldChange(question.id, val)}
              className={hasError ? 'border border-red-500 rounded p-2' : ''}
              data-testid={`radio-group-${question.id}`}
            >
              {question.options?.map((option, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value={option} 
                    id={`${question.id}-${idx}`} 
                    data-testid={`radio-${question.id}-${idx}`}
                  />
                  <Label htmlFor={`${question.id}-${idx}`} className="font-normal cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {hasError && (
              <p className="text-sm text-red-500" data-testid={`error-${question.id}`}>
                {errors[question.id]}
              </p>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            <Label>
              {question.label}
              {question.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className={`space-y-2 ${hasError ? 'border border-red-500 rounded p-2' : ''}`}>
              {question.options?.map((option, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${idx}`}
                    checked={Array.isArray(value) && value.includes(option)}
                    onCheckedChange={(checked) => {
                      const currentValue = Array.isArray(value) ? value : [];
                      const newValue = checked
                        ? [...currentValue, option]
                        : currentValue.filter((v: string) => v !== option);
                      handleFieldChange(question.id, newValue);
                    }}
                    data-testid={`checkbox-${question.id}-${idx}`}
                  />
                  <Label htmlFor={`${question.id}-${idx}`} className="font-normal cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
            {hasError && (
              <p className="text-sm text-red-500" data-testid={`error-${question.id}`}>
                {errors[question.id]}
              </p>
            )}
          </div>
        );

      case 'dropdown':
        return (
          <div className="space-y-2">
            <Label htmlFor={question.id}>
              {question.label}
              {question.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select
              value={value || ''}
              onValueChange={(val) => handleFieldChange(question.id, val)}
              data-testid={`select-${question.id}`}
            >
              <SelectTrigger className={hasError ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {question.options?.map((option, idx) => (
                  <SelectItem key={idx} value={option} data-testid={`select-option-${question.id}-${idx}`}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasError && (
              <p className="text-sm text-red-500" data-testid={`error-${question.id}`}>
                {errors[question.id]}
              </p>
            )}
          </div>
        );

      case 'yesno':
        return (
          <div className="space-y-2">
            <Label>
              {question.label}
              {question.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <RadioGroup
              value={value || ''}
              onValueChange={(val) => handleFieldChange(question.id, val)}
              className={`flex gap-4 ${hasError ? 'border border-red-500 rounded p-2' : ''}`}
              data-testid={`yesno-${question.id}`}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id={`${question.id}-yes`} data-testid={`radio-${question.id}-yes`} />
                <Label htmlFor={`${question.id}-yes`} className="font-normal cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id={`${question.id}-no`} data-testid={`radio-${question.id}-no`} />
                <Label htmlFor={`${question.id}-no`} className="font-normal cursor-pointer">No</Label>
              </div>
            </RadioGroup>
            {hasError && (
              <p className="text-sm text-red-500" data-testid={`error-${question.id}`}>
                {errors[question.id]}
              </p>
            )}
          </div>
        );

      case 'file':
        const isUploading = uploadingFiles[question.id];
        let fileInfo = null;
        try {
          if (value && typeof value === 'string') {
            fileInfo = JSON.parse(value);
          }
        } catch (e) {
          // Invalid JSON, ignore
        }

        return (
          <div className="space-y-2">
            <Label htmlFor={question.id}>
              {question.label}
              {question.isRequired && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {isSubmitted ? (
              // Read-only view for submitted tasks
              fileInfo ? (
                <div className="p-3 border rounded bg-gray-50 dark:bg-gray-800">
                  <p className="text-sm font-medium">{fileInfo.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {(fileInfo.fileSize / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No file uploaded</p>
              )
            ) : (
              <>
                <Input
                  id={question.id}
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(question.id, file);
                    }
                  }}
                  disabled={isUploading}
                  className={hasError ? 'border-red-500' : ''}
                  data-testid={`file-${question.id}`}
                />
                {isUploading && (
                  <p className="text-sm text-blue-600">Uploading...</p>
                )}
                {fileInfo && !isUploading && (
                  <div className="p-2 border rounded bg-green-50 dark:bg-green-950">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      ✓ {fileInfo.fileName} uploaded successfully
                    </p>
                  </div>
                )}
              </>
            )}
            {hasError && (
              <p className="text-sm text-red-500" data-testid={`error-${question.id}`}>
                {errors[question.id]}
              </p>
            )}
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground">
            Unsupported question type: {question.type}
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !taskInstance) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="bg-red-50 dark:bg-red-950 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <p className="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load request</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                  {(error as any)?.message || 'This request could not be found or you do not have permission to view it'}
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setLocation('/portal/tasks')}
                  data-testid="button-back-to-tasks"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Requests
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isSubmitted = taskInstance.status === 'submitted' || taskInstance.status === 'reviewed';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/portal/tasks')}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Requests
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-template-name">
                {taskInstance.template.name}
              </h1>
              {taskInstance.template.description && (
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  {taskInstance.template.description}
                </p>
              )}
            </div>
            <Badge 
              variant={isSubmitted ? 'default' : 'outline'}
              data-testid="badge-status"
            >
              {taskInstance.status}
            </Badge>
          </div>
        </div>

        {isSubmitted && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
            <CardContent className="pt-6">
              <p className="text-green-800 dark:text-green-200" data-testid="text-submitted-message">
                This request has been submitted on {taskInstance.submittedAt ? format(new Date(taskInstance.submittedAt), 'PPP') : 'unknown date'}. You can no longer make changes.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Sections and Questions */}
        {taskInstance.sections
          .sort((a, b) => a.order - b.order)
          .map(section => (
            <Card key={section.id} data-testid={`section-${section.id}`}>
              <CardHeader>
                <CardTitle data-testid={`section-name-${section.id}`}>
                  {section.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {section.questions
                  .sort((a, b) => a.order - b.order)
                  .map(question => (
                    <div key={question.id} data-testid={`question-${question.id}`}>
                      {renderQuestion(question)}
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}

        {/* Actions */}
        {!isSubmitted && (
          <div className="flex justify-end gap-4 sticky bottom-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saveProgressMutation.isPending}
              data-testid="button-save"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveProgressMutation.isPending ? 'Saving...' : 'Save Progress'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitTaskMutation.isPending}
              data-testid="button-submit"
            >
              <Send className="w-4 h-4 mr-2" />
              {submitTaskMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
