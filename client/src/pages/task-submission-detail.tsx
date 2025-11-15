import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import TopNavigation from "@/components/top-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle, AlertCircle, FileText } from "lucide-react";

interface Question {
  id: string;
  type: string;
  label: string;
  options?: string[];
  order: number;
}

interface Section {
  id: string;
  name: string;
  order: number;
  questions: Question[];
}

interface TaskSubmission {
  id: string;
  status: string;
  template: {
    name: string;
    description: string;
  };
  client: {
    id: string;
    name: string;
  };
  relatedPerson: {
    fullName: string;
  };
  sections: Section[];
  responses: Record<string, any>;
  createdAt: string;
  submittedAt?: string;
}

export default function TaskSubmissionDetail() {
  const [, params] = useRoute("/task-submissions/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const submissionId = params?.id;

  // Fetch submission details
  const { data: submission, isLoading, error } = useQuery<TaskSubmission>({
    queryKey: ['/api/task-instances', submissionId, 'full'],
    queryFn: getQueryFn(`/api/task-instances/${submissionId}/full`),
    enabled: !!submissionId,
    retry: 2,
  });

  // Mark as reviewed mutation
  const markReviewedMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/task-instances/${submissionId}`, {
        status: 'reviewed',
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Task has been marked as reviewed",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/task-instances'] });
      queryClient.invalidateQueries({ queryKey: ['/api/task-instances', submissionId] });
      setLocation('/task-submissions');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to mark as reviewed",
        variant: "destructive",
      });
    },
  });

  // Render response value based on question type
  const renderResponse = (question: Question, value: any) => {
    if (!value) {
      return <span className="text-gray-400 italic">No response</span>;
    }

    switch (question.type) {
      case 'text':
      case 'email':
      case 'number':
      case 'textarea':
        return <span className="font-medium">{value}</span>;

      case 'date':
        try {
          return <span className="font-medium">{format(new Date(value), 'PPP')}</span>;
        } catch {
          return <span className="font-medium">{value}</span>;
        }

      case 'radio':
      case 'dropdown':
      case 'yesno':
        return <Badge variant="outline">{value}</Badge>;

      case 'checkbox':
        try {
          const items = Array.isArray(value) ? value : JSON.parse(value);
          return (
            <div className="flex flex-wrap gap-2">
              {items.map((item: string, idx: number) => (
                <Badge key={idx} variant="outline">{item}</Badge>
              ))}
            </div>
          );
        } catch {
          return <span className="font-medium">{value}</span>;
        }

      case 'file':
        try {
          const fileInfo = typeof value === 'string' ? JSON.parse(value) : value;
          return (
            <div className="flex items-center gap-2 p-3 border rounded bg-gray-50 dark:bg-gray-800">
              <FileText className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm font-medium">{fileInfo.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {fileInfo.fileSize ? `${(fileInfo.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'}
                </p>
              </div>
            </div>
          );
        } catch {
          return <span className="font-medium">{value}</span>;
        }

      default:
        return <span className="font-medium">{value}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <TopNavigation user={user} />
        <div className="p-8 space-y-6">
          <Skeleton className="h-12 w-3/4" />
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

  if (error || !submission) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <TopNavigation user={user} />
        <div className="p-8">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  Failed to load submission
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {(error as any)?.message || 'This submission could not be found'}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setLocation('/task-submissions')}
                  className="mt-4"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Submissions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <Button
            variant="ghost"
            onClick={() => setLocation('/task-submissions')}
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Submissions
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="text-template-name">
                {submission.template.name}
              </h1>
              {submission.template.description && (
                <p className="text-meta mt-2">
                  {submission.template.description}
                </p>
              )}
            </div>
            <Badge 
              variant={submission.status === 'reviewed' ? 'default' : 'outline'}
              data-testid="badge-status"
            >
              {submission.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="page-container py-6 md:py-8 space-y-8">

        {/* Submission Info */}
        <Card>
          <CardHeader>
            <CardTitle>Submission Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium" data-testid="text-client">{submission.client.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed by</p>
                <p className="font-medium" data-testid="text-person">{submission.relatedPerson.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{format(new Date(submission.createdAt), 'PPP')}</p>
              </div>
              {submission.submittedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="font-medium">{format(new Date(submission.submittedAt), 'PPP')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Responses by Section */}
        {submission.sections
          .sort((a, b) => a.order - b.order)
          .map((section) => (
            <Card key={section.id} data-testid={`section-${section.id}`}>
              <CardHeader>
                <CardTitle data-testid={`section-name-${section.id}`}>
                  {section.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {section.questions
                  .sort((a, b) => a.order - b.order)
                  .map((question) => (
                    <div key={question.id} data-testid={`question-${question.id}`}>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {question.label}
                        </p>
                        <div data-testid={`response-${question.id}`}>
                          {renderResponse(question, submission.responses[question.id])}
                        </div>
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}

        {/* Actions */}
        {submission.status === 'submitted' && (
          <div className="flex justify-end">
            <Button
              onClick={() => markReviewedMutation.mutate()}
              disabled={markReviewedMutation.isPending}
              data-testid="button-mark-reviewed"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {markReviewedMutation.isPending ? 'Marking...' : 'Mark as Reviewed'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
