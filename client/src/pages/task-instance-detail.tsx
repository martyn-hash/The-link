import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Download, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import TopNavigation from "@/components/top-navigation";

interface Question {
  id: string;
  questionType: string;
  label: string;
  isRequired: boolean;
  options?: string[];
  response?: {
    responseValue: string;
    fileUrls?: string[];
  } | null;
}

interface Section {
  id: string;
  title: string;
  description?: string;
  order: number;
  questions: Question[];
}

interface TaskInstanceDetail {
  id: string;
  status: string;
  dueDate?: string;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  template?: {
    id: string;
    name: string;
    description?: string;
  };
  customRequest?: {
    id: string;
    name: string;
    description?: string;
  };
  client: {
    id: string;
    companyName: string;
  };
  person?: {
    id: string;
    fullName: string;
    email?: string;
  };
  sections: Section[];
}

function formatDate(dateString?: string) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(dateString?: string) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function QuestionResponse({ question }: { question: Question }) {
  const response = question.response;
  
  const renderResponse = () => {
    if (!response?.responseValue) {
      return <span className="text-muted-foreground italic">No response provided</span>;
    }

    switch (question.questionType) {
      case 'yes_no':
        return <Badge variant={response.responseValue === 'yes' ? 'default' : 'secondary'}>
          {response.responseValue.toUpperCase()}
        </Badge>;
      
      case 'file_upload':
        if (response.fileUrls && response.fileUrls.length > 0) {
          return (
            <div className="space-y-2">
              {response.fileUrls.map((url, idx) => {
                const fileName = url.split('/').pop() || 'Download';
                return (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    {fileName}
                  </a>
                );
              })}
            </div>
          );
        }
        return <span className="text-muted-foreground">No files uploaded</span>;
      
      case 'date':
        return <span className="font-medium">{formatDate(response.responseValue)}</span>;
      
      case 'multi_choice':
        try {
          const selected = JSON.parse(response.responseValue);
          return (
            <div className="flex flex-wrap gap-2">
              {selected.map((option: string, idx: number) => (
                <Badge key={idx} variant="outline">{option}</Badge>
              ))}
            </div>
          );
        } catch {
          return <span className="font-medium">{response.responseValue}</span>;
        }
      
      case 'long_text':
        return <div className="whitespace-pre-wrap bg-muted p-3 rounded-md">{response.responseValue}</div>;
      
      default:
        return <span className="font-medium">{response.responseValue}</span>;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="font-medium text-sm">
          {question.label}
          {question.isRequired && <span className="text-destructive ml-1">*</span>}
        </span>
      </div>
      <div className="ml-4">
        {renderResponse()}
      </div>
    </div>
  );
}

export default function TaskInstanceDetail() {
  const [, params] = useRoute("/task-instances/:id");
  const instanceId = params?.id;

  const { data: instance, isLoading } = useQuery<TaskInstanceDetail>({
    queryKey: [`/api/task-instances/${instanceId}/full`],
    enabled: !!instanceId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <main className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <main className="container mx-auto p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Task instance not found</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const statusColor = {
    'submitted': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'approved': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'in_progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'not_started': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  }[instance.status] || 'bg-gray-100 text-gray-800';

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <main className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/clients/${instance.client.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Client
          </Button>
        </Link>
      </div>

      {/* Task Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">
                {instance.template?.name || instance.customRequest?.name || 'Untitled Request'}
              </CardTitle>
              <CardDescription>
                {instance.template?.description || instance.customRequest?.description || ''}
              </CardDescription>
            </div>
            <Badge className={statusColor} data-testid="badge-status">
              {instance.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="font-medium">{instance.client.companyName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assigned To</p>
              <p className="font-medium">
                {instance.person?.fullName || 'Unassigned'}
                {instance.person?.email && (
                  <span className="text-sm text-muted-foreground ml-2">({instance.person.email})</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">{formatDate(instance.dueDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(instance.createdAt)}</p>
            </div>
            {instance.submittedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Submitted</p>
                <p className="font-medium">{formatDateTime(instance.submittedAt)}</p>
              </div>
            )}
            {instance.approvedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="font-medium">{formatDateTime(instance.approvedAt)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sections and Responses */}
      {instance.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.description && (
              <CardDescription>{section.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {section.questions.map((question, idx) => (
              <div key={question.id}>
                <QuestionResponse question={question} />
                {idx < section.questions.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Actions */}
      {instance.status === 'submitted' && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium">Mark as Reviewed</p>
                  <p className="text-sm text-muted-foreground">Approve this submission after reviewing all responses</p>
                </div>
              </div>
              <Button data-testid="button-approve">
                Approve Submission
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      </main>
    </div>
  );
}
