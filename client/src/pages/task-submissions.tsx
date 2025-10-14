import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TopNavigation from "@/components/top-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Search, Eye, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

interface TaskSubmission {
  id: string;
  template: {
    name: string;
    description?: string;
  };
  client: {
    id: string;
    name: string;
  };
  relatedPerson: {
    fullName: string;
  };
  status: string;
  createdAt: string;
  submittedAt?: string;
}

export default function TaskSubmissions() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "reviewed">("submitted");

  // Fetch all task instances
  const { data: submissions, isLoading } = useQuery<TaskSubmission[]>({
    queryKey: ['/api/task-instances'],
  });

  // Filter submissions
  const filteredSubmissions = submissions?.filter(submission => {
    const matchesSearch = 
      submission.template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.relatedPerson.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" || submission.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  const submittedCount = submissions?.filter(s => s.status === 'submitted').length || 0;
  const reviewedCount = submissions?.filter(s => s.status === 'reviewed').length || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopNavigation />
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="page-title">
            Task Submissions
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Review and manage submitted client requests
          </p>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by template, client, or person..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs for Status Filtering */}
        <Tabs value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <TabsList>
            <TabsTrigger value="submitted" data-testid="tab-submitted">
              Submitted ({submittedCount})
            </TabsTrigger>
            <TabsTrigger value="reviewed" data-testid="tab-reviewed">
              Reviewed ({reviewedCount})
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">
              All ({submissions?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="space-y-4 mt-6">
            {isLoading ? (
              // Loading state
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              // Empty state
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <FileText className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                      No submissions found
                    </h3>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {searchQuery 
                        ? "No submissions match your search criteria"
                        : statusFilter === 'submitted'
                        ? "No submissions are waiting for review"
                        : statusFilter === 'reviewed'
                        ? "No submissions have been reviewed yet"
                        : "No task submissions have been created yet"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Submissions list
              <div className="space-y-4">
                {filteredSubmissions.map((submission) => (
                  <Card 
                    key={submission.id}
                    className="hover:shadow-md transition-shadow"
                    data-testid={`card-submission-${submission.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2" data-testid={`title-${submission.id}`}>
                            {submission.template.name}
                            {submission.status === 'reviewed' && (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            <div className="space-y-1">
                              <div data-testid={`client-${submission.id}`}>
                                Client: <span className="font-medium">{submission.client.name}</span>
                              </div>
                              <div data-testid={`person-${submission.id}`}>
                                Completed by: <span className="font-medium">{submission.relatedPerson.fullName}</span>
                              </div>
                              {submission.submittedAt && (
                                <div className="text-xs">
                                  Submitted: {new Date(submission.submittedAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </CardDescription>
                        </div>
                        <Badge 
                          variant={submission.status === 'reviewed' ? 'default' : 'outline'}
                          data-testid={`badge-status-${submission.id}`}
                        >
                          {submission.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/task-submissions/${submission.id}`)}
                          data-testid={`button-review-${submission.id}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {submission.status === 'reviewed' ? 'View Details' : 'Review'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
