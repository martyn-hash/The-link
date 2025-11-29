import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { showFriendlyError } from "@/lib/friendlyErrors";
import TopNavigation from "@/components/top-navigation";
import UploadModal from "@/components/upload-modal";
import SettingsModal from "@/components/settings-modal";
import UserManagementModal from "@/components/user-management-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Upload, Settings, Users, FileText, BarChart, Trash2, Clock, PlayCircle, TestTube, Activity, CheckCircle, AlertCircle, TrendingUp, Eye, Calendar, Mail, Send, Wrench, AlertTriangle } from "lucide-react";

export default function Admin() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showSchedulingActions, setShowSchedulingActions] = useState(false);
  const [showSchedulingPreview, setShowSchedulingPreview] = useState(false);
  const [previewTargetDate, setPreviewTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showFrequencyFix, setShowFrequencyFix] = useState(false);
  const [frequencyIssues, setFrequencyIssues] = useState<any>(null);
  const [showSchedulingExceptions, setShowSchedulingExceptions] = useState(false);
  const [schedulingExceptions, setSchedulingExceptions] = useState<any>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated && !!user,
    retry: false,
  }) as { data: any[] | undefined, isLoading: boolean };

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!(isAuthenticated && user && user?.isAdmin),
    retry: false,
  }) as { data: any[] | undefined, isLoading: boolean };

  // Delete test data mutation
  const deleteTestDataMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/delete-test-data", { confirm: "DELETE" });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Test Data Deleted",
        description: `Successfully deleted ${data.totalDeleted} records across all tables.`,
        variant: "default",
      });
      
      // Invalidate all relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people-tags"] });
      
      // Close dialog and reset form
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/email/test-send", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Test Email Sent",
        description: `Test email successfully sent to ${data.details.to}. Check the inbox to confirm receipt.`,
        variant: "default",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Project scheduling mutations
  const runSchedulingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/project-scheduling/run", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Scheduling Complete",
        description: `Created ${data.projectsCreated} projects, rescheduled ${data.servicesRescheduled} services.`,
        variant: "default",
      });
      
      // Refresh project data
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const runDryRunMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/project-scheduling/test-dry-run", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Dry Run Complete",
        description: `Test run found ${data.servicesFoundDue} services that would be processed.`,
        variant: "default",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const runPreviewMutation = useMutation({
    mutationFn: async (targetDate: string) => {
      return await apiRequest("POST", "/api/project-scheduling/preview", { targetDate });
    },
    onSuccess: (data: any) => {
      console.log('Preview data received:', data);
      console.log('Preview data keys:', Object.keys(data));
      console.log('Services found due:', data.servicesFoundDue);
      console.log('Total services checked:', data.totalServicesChecked);
      setPreviewData(data);
      setShowSchedulingPreview(true);
      toast({
        title: "Preview Generated",
        description: `Found ${data.servicesFoundDue || 0} services due on ${data.targetDate ? new Date(data.targetDate).toLocaleDateString() : 'selected date'}.`,
        variant: "default",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const { data: schedulingAnalysis, refetch: refetchAnalysis } = useQuery({
    queryKey: ["/api/project-scheduling/analysis"],
    enabled: false, // Only fetch when manually triggered
    retry: false,
  });

  const { data: monitoringData, refetch: refetchMonitoring, isLoading: isLoadingMonitoring } = useQuery({
    queryKey: ["/api/project-scheduling/monitoring"],
    enabled: false, // Only fetch when manually triggered
    retry: false,
  });

  const fetchFrequencyIssuesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/frequency-issues", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch frequency issues");
      return response.json();
    },
    onSuccess: (data: any) => {
      setFrequencyIssues(data);
      setShowFrequencyFix(true);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const fixFrequenciesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/fix-frequencies", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Frequencies Fixed",
        description: data.message || `Fixed ${data.clientServicesFixed + data.peopleServicesFixed} services.`,
        variant: "default",
      });
      setShowFrequencyFix(false);
      setFrequencyIssues(null);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const fetchSchedulingExceptionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/scheduling-exceptions/unresolved", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch scheduling exceptions");
      return response.json();
    },
    onSuccess: (data: any) => {
      setSchedulingExceptions(data);
      setShowSchedulingExceptions(true);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const resolveExceptionMutation = useMutation({
    mutationFn: async ({ exceptionId, notes }: { exceptionId: string; notes?: string }) => {
      return await apiRequest("POST", `/api/admin/scheduling-exceptions/${exceptionId}/resolve`, { notes });
    },
    onSuccess: () => {
      toast({
        title: "Exception Resolved",
        description: "The scheduling exception has been marked as resolved.",
        variant: "default",
      });
      fetchSchedulingExceptionsMutation.mutate();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleDeleteTestData = () => {
    if (deleteConfirmText === "DELETE") {
      deleteTestDataMutation.mutate();
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading]);

  // Check admin access
  useEffect(() => {
    if (user && !user.isAdmin) {
      showFriendlyError({ error: "You don't have permission to access this page." });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
      return;
    }
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive text-lg mb-4">Access Denied</p>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const projectsArray = Array.isArray(projects) ? projects : [];
  const usersArray = Array.isArray(users) ? users : [];
  
  const totalProjects = projectsArray.length;
  const totalUsers = usersArray.length;
  const completedProjects = projectsArray.filter((p: any) => p.currentStatus === 'completed').length;
  const activeProjects = totalProjects - completedProjects;

  const statusCounts = projectsArray.reduce((acc: any, project: any) => {
    acc[project.currentStatus] = (acc[project.currentStatus] || 0) + 1;
    return acc;
  }, {});

  const roleCounts = usersArray.reduce((acc: any, user: any) => {
    if (user.isAdmin) {
      acc['Admin'] = (acc['Admin'] || 0) + 1;
    } else if (user.canSeeAdminMenu) {
      acc['Manager'] = (acc['Manager'] || 0) + 1;
    } else {
      acc['User'] = (acc['User'] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-foreground" data-testid="text-admin-title">
                Administration
              </h2>
              <p className="text-sm text-muted-foreground">
                System configuration and management
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button 
                onClick={() => setShowUploadModal(true)}
                className="px-4"
                data-testid="button-upload-projects"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Projects
              </Button>
              
              {user.isAdmin && (
                <Button 
                  onClick={() => setShowSettingsModal(true)}
                  variant="outline"
                  className="px-4"
                  data-testid="button-settings"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              )}
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-primary" />
                  Total Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-projects">{totalProjects}</div>
                <p className="text-xs text-muted-foreground">
                  {activeProjects} active, {completedProjects} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Users className="w-4 h-4 mr-2 text-primary" />
                  Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-users">{totalUsers}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(roleCounts).map(([role, count]) => (
                    <Badge key={role} variant="secondary" className="text-xs">
                      {role.replace('_', ' ')}: {count as number}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <BarChart className="w-4 h-4 mr-2 text-primary" />
                  Completion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-completion-rate">
                  {totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {completedProjects} of {totalProjects} projects
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => setShowUploadModal(true)}
                  data-testid="button-quick-upload"
                >
                  <Upload className="w-3 h-3 mr-2" />
                  Upload CSV
                </Button>
                {user.isAdmin && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => setShowUserModal(true)}
                      data-testid="button-quick-users"
                    >
                      <Users className="w-3 h-3 mr-2" />
                      Manage Users
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => setShowSettingsModal(true)}
                      data-testid="button-quick-settings"
                    >
                      <Settings className="w-3 h-3 mr-2" />
                      Configure
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => testEmailMutation.mutate()}
                      disabled={testEmailMutation.isPending}
                      data-testid="button-test-email"
                    >
                      <Send className="w-3 h-3 mr-2" />
                      {testEmailMutation.isPending ? "Sending..." : "Test Email"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => setShowSchedulingActions(!showSchedulingActions)}
                      data-testid="button-scheduling-actions"
                    >
                      <Clock className="w-3 h-3 mr-2" />
                      Project Scheduling
                    </Button>
                    {showSchedulingActions && (
                      <div className="ml-4 space-y-1 border-l border-border pl-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full justify-start text-xs"
                          onClick={() => runSchedulingMutation.mutate()}
                          disabled={runSchedulingMutation.isPending}
                          data-testid="button-run-scheduling"
                        >
                          <PlayCircle className="w-3 h-3 mr-2" />
                          {runSchedulingMutation.isPending ? "Running..." : "Run Now"}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full justify-start text-xs"
                          onClick={() => runDryRunMutation.mutate()}
                          disabled={runDryRunMutation.isPending}
                          data-testid="button-dry-run-scheduling"
                        >
                          <TestTube className="w-3 h-3 mr-2" />
                          {runDryRunMutation.isPending ? "Testing..." : "Test Run"}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full justify-start text-xs"
                          onClick={() => refetchAnalysis()}
                          data-testid="button-scheduling-analysis"
                        >
                          <BarChart className="w-3 h-3 mr-2" />
                          Analysis
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full justify-start text-xs"
                          onClick={() => refetchMonitoring()}
                          data-testid="button-scheduling-monitoring"
                        >
                          <Activity className="w-3 h-3 mr-2" />
                          Monitoring
                          {isLoadingMonitoring && <div className="ml-2 h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />}
                        </Button>
                        <div className="space-y-2 pt-2 border-t border-border">
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={previewTargetDate}
                              onChange={(e) => setPreviewTargetDate(e.target.value)}
                              className="flex-1 text-xs p-1 border rounded"
                              data-testid="input-preview-date"
                            />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              onClick={() => runPreviewMutation.mutate(previewTargetDate)}
                              disabled={runPreviewMutation.isPending}
                              data-testid="button-scheduling-preview"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              {runPreviewMutation.isPending ? "Loading..." : "Preview"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => fetchFrequencyIssuesMutation.mutate()}
                      disabled={fetchFrequencyIssuesMutation.isPending}
                      data-testid="button-fix-frequencies"
                    >
                      <Wrench className="w-3 h-3 mr-2" />
                      {fetchFrequencyIssuesMutation.isPending ? "Checking..." : "Fix Frequency Data"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => fetchSchedulingExceptionsMutation.mutate()}
                      disabled={fetchSchedulingExceptionsMutation.isPending}
                      data-testid="button-view-scheduling-exceptions"
                    >
                      <AlertCircle className="w-3 h-3 mr-2" />
                      {fetchSchedulingExceptionsMutation.isPending ? "Loading..." : "View Scheduling Errors"}
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleteTestDataMutation.isPending}
                      data-testid="button-delete-test-data"
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      {deleteTestDataMutation.isPending ? "Deleting..." : "Delete Test Data"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Project Status Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Project Status Distribution</CardTitle>
                <CardDescription>
                  Current breakdown of projects by stage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(statusCounts).map(([status, count]) => {
                    const percentage = totalProjects > 0 ? (count as number / totalProjects) * 100 : 0;
                    const statusLabel = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            status === 'no_latest_action' ? 'bg-amber-500' :
                            status === 'bookkeeping_work_required' ? 'bg-blue-500' :
                            status === 'in_review' ? 'bg-purple-500' :
                            status === 'needs_client_input' ? 'bg-orange-500' :
                            'bg-green-500'
                          }`} />
                          <span className="text-sm font-medium">{statusLabel}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">{count as number}</span>
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary rounded-full h-2" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest project status changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projectsArray.slice(0, 5).map((project: any) => {
                    const lastActivity = project.chronology?.[0];
                    if (!lastActivity) return null;
                    
                    return (
                      <div key={project.id} className="flex items-start space-x-3 pb-4 border-b last:border-0">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {project.client.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lastActivity.toStatus?.replace(/_/g, ' ')} • {
                              new Date(lastActivity.timestamp).toLocaleDateString()
                            }
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  
                  {!projectsArray.length && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent activity
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monitoring Dashboard */}
          {monitoringData && (monitoringData as any).statistics && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Scheduling System Monitoring
                  </CardTitle>
                  <CardDescription>
                    Real-time status and metrics for the automated project scheduling system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* System Status */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          (monitoringData as any).systemStatus === 'success' ? 'bg-green-500' :
                          (monitoringData as any).systemStatus === 'partial_failure' ? 'bg-yellow-500' :
                          (monitoringData as any).systemStatus === 'failure' ? 'bg-red-500' : 'bg-gray-400'
                        }`} />
                        <div>
                          <p className="font-medium">System Status</p>
                          <p className="text-sm text-muted-foreground">
                            {(monitoringData as any).systemStatus === 'success' ? 'All systems operational' :
                             (monitoringData as any).systemStatus === 'partial_failure' ? 'Some issues detected' :
                             (monitoringData as any).systemStatus === 'failure' ? 'System issues detected' : 'Status unknown'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        (monitoringData as any).systemStatus === 'success' ? 'default' :
                        (monitoringData as any).systemStatus === 'partial_failure' ? 'secondary' : 'destructive'
                      }>
                        {(monitoringData as any).systemStatus}
                      </Badge>
                    </div>

                    {/* Latest Run Info */}
                    {(monitoringData as any).latestRun && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 border rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Last Run</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date((monitoringData as any).latestRun.runDate).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(monitoringData as any).latestRun.runType} run
                          </p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium">Projects Created</span>
                          </div>
                          <p className="text-xl font-bold">{(monitoringData as any).latestRun.projectsCreated || 0}</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">Services Rescheduled</span>
                          </div>
                          <p className="text-xl font-bold">{(monitoringData as any).latestRun.servicesRescheduled || 0}</p>
                        </div>
                        <div className="p-3 border rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                            <span className="text-sm font-medium">Errors</span>
                          </div>
                          <p className="text-xl font-bold">{(monitoringData as any).latestRun.errorsEncountered || 0}</p>
                        </div>
                      </div>
                    )}

                    {/* Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{(monitoringData as any).statistics.totalRuns}</p>
                        <p className="text-sm text-muted-foreground">Total Runs</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{(monitoringData as any).statistics.successfulRuns}</p>
                        <p className="text-sm text-muted-foreground">Successful</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{(monitoringData as any).statistics.failedRuns}</p>
                        <p className="text-sm text-muted-foreground">Failed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{Math.round((monitoringData as any).statistics.averageExecutionTime / 1000)}s</p>
                        <p className="text-sm text-muted-foreground">Avg Runtime</p>
                      </div>
                    </div>

                    {/* Recent Runs */}
                    {(monitoringData as any).recentRuns?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">Recent Runs</h4>
                        <div className="space-y-2">
                          {(monitoringData as any).recentRuns.slice(0, 5).map((run: any) => (
                            <div key={run.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${
                                  run.status === 'success' ? 'bg-green-500' :
                                  run.status === 'partial_failure' ? 'bg-yellow-500' : 'bg-red-500'
                                }`} />
                                <div>
                                  <p className="text-sm font-medium">
                                    {new Date(run.runDate).toLocaleString()}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {run.runType} run • {run.projectsCreated || 0} projects created
                                  </p>
                                </div>
                              </div>
                              <Badge variant={run.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                                {run.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Analysis Dashboard */}
          {schedulingAnalysis && (schedulingAnalysis as any).totalServices !== undefined && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-5 w-5" />
                    Overdue Services Analysis
                  </CardTitle>
                  <CardDescription>
                    Current analysis of services requiring attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Summary Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-2xl font-bold">{(schedulingAnalysis as any).totalServices}</p>
                        <p className="text-sm text-muted-foreground">Total Services</p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-2xl font-bold text-red-600">{(schedulingAnalysis as any).overdueServices}</p>
                        <p className="text-sm text-muted-foreground">Overdue Services</p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-2xl font-bold text-orange-600">{(schedulingAnalysis as any).configurationErrors?.length || 0}</p>
                        <p className="text-sm text-muted-foreground">Config Errors</p>
                      </div>
                    </div>

                    {/* Overdue Services Details */}
                    {(schedulingAnalysis as any).servicesDetails?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">Overdue Services</h4>
                        <div className="space-y-2">
                          {(schedulingAnalysis as any).servicesDetails.map((service: any) => (
                            <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`overdue-service-${service.id}`}>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{service.serviceName}</p>
                                <p className="text-xs text-muted-foreground">{service.clientName}</p>
                                <p className="text-xs text-muted-foreground">
                                  Due: {new Date(service.nextStartDate).toLocaleDateString()} • {service.frequency}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge variant="destructive" className="text-xs">
                                  {service.daysPastDue} day{service.daysPastDue !== 1 ? 's' : ''} overdue
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Configuration Errors */}
                    {(schedulingAnalysis as any).configurationErrors?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">Configuration Issues</h4>
                        <div className="space-y-2">
                          {(schedulingAnalysis as any).configurationErrors.map((error: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 dark:bg-orange-900/20" data-testid={`config-error-${index}`}>
                              <div className="flex items-center gap-3">
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                <div>
                                  <p className="text-sm font-medium">{error.serviceName}</p>
                                  <p className="text-xs text-muted-foreground">{error.clientName}</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {error.error}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No Issues Found */}
                    {(schedulingAnalysis as any).overdueServices === 0 && (schedulingAnalysis as any).configurationErrors?.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <p className="text-lg font-medium">All services are up to date</p>
                        <p className="text-sm">No overdue services or configuration issues found.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Scheduling Preview Dashboard */}
          {showSchedulingPreview && previewData && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Scheduling Preview - {(() => {
                      if (!previewData.targetDate) return 'No Date';
                      const date = new Date(previewData.targetDate);
                      if (isNaN(date.getTime())) return 'Invalid Date';
                      return date.toLocaleDateString();
                    })()}
                  </CardTitle>
                  <CardDescription>
                    Detailed preview of what would happen during scheduling without making actual changes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Summary Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-2xl font-bold">{previewData?.totalServicesChecked || 0}</p>
                        <p className="text-sm text-muted-foreground">Total Services</p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{previewData?.servicesFoundDue || 0}</p>
                        <p className="text-sm text-muted-foreground">Services Due</p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{(previewData?.previewItems || []).filter((item: any) => item.willCreateProject).length}</p>
                        <p className="text-sm text-muted-foreground">Projects to Create</p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-2xl font-bold text-purple-600">{(previewData?.previewItems || []).filter((item: any) => item.willReschedule).length}</p>
                        <p className="text-sm text-muted-foreground">Services to Reschedule</p>
                      </div>
                    </div>

                    {/* Configuration Errors */}
                    {previewData.configurationErrors?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3 text-orange-600">Configuration Errors</h4>
                        <div className="space-y-2">
                          {previewData.configurationErrors.map((error: any, index: number) => (
                            <div key={index} className="flex items-center gap-3 p-3 border rounded-lg bg-orange-50 dark:bg-orange-900/20" data-testid={`preview-config-error-${index}`}>
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                              <div>
                                <p className="text-sm font-medium">{error.error}</p>
                                <p className="text-xs text-muted-foreground">Service Type: {error.serviceType}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preview Items Table */}
                    {previewData.previewItems?.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">Services Details</h4>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const csvContent = [
                                ['Client/Person', 'Service', 'Frequency', 'Current Next Start', 'Current Next Due', 'Project Start', 'Project Due', 'New Next Start', 'New Next Due', 'Will Create Project', 'Will Reschedule', 'Companies House', 'Project Type', 'Error'].join(','),
                                ...previewData.previewItems.map((item: any) => [
                                  item.clientName || item.personName || '',
                                  item.serviceName,
                                  item.frequency,
                                  new Date(item.currentNextStartDate).toLocaleDateString(),
                                  new Date(item.currentNextDueDate).toLocaleDateString(),
                                  new Date(item.projectPlannedStart).toLocaleDateString(),
                                  new Date(item.projectPlannedDue).toLocaleDateString(),
                                  new Date(item.newNextStartDate).toLocaleDateString(),
                                  new Date(item.newNextDueDate).toLocaleDateString(),
                                  item.willCreateProject ? 'Yes' : 'No',
                                  item.willReschedule ? 'Yes' : 'No',
                                  item.isCompaniesHouseService ? 'Yes' : 'No',
                                  item.projectTypeName,
                                  item.configurationError || ''
                                ].join(','))
                              ].join('\n');
                              
                              const blob = new Blob([csvContent], { type: 'text/csv' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `scheduling-preview-${new Date(previewData.targetDate).toISOString().split('T')[0]}.csv`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            data-testid="button-export-preview-csv"
                          >
                            <FileText className="w-3 h-3 mr-2" />
                            Export CSV
                          </Button>
                        </div>
                        
                        <div className="border rounded-lg overflow-hidden">
                          <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                  <th className="p-3 text-left font-medium">Client/Person</th>
                                  <th className="p-3 text-left font-medium">Service</th>
                                  <th className="p-3 text-left font-medium">Current Dates</th>
                                  <th className="p-3 text-left font-medium">Project Dates</th>
                                  <th className="p-3 text-left font-medium">New Dates</th>
                                  <th className="p-3 text-center font-medium">Actions</th>
                                  <th className="p-3 text-center font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {previewData.previewItems.map((item: any, index: number) => (
                                  <tr key={index} className="border-t hover:bg-muted/30" data-testid={`preview-item-${index}`}>
                                    <td className="p-3">
                                      <div>
                                        <p className="font-medium">{item.clientName || item.personName}</p>
                                        <p className="text-xs text-muted-foreground">{item.serviceType}</p>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div>
                                        <p className="font-medium">{item.serviceName}</p>
                                        <p className="text-xs text-muted-foreground">{item.frequency} • {item.projectTypeName}</p>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-xs">
                                        <p>Start: {new Date(item.currentNextStartDate).toLocaleDateString()}</p>
                                        <p>Due: {new Date(item.currentNextDueDate).toLocaleDateString()}</p>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-xs">
                                        <p>Start: {new Date(item.projectPlannedStart).toLocaleDateString()}</p>
                                        <p>Due: {new Date(item.projectPlannedDue).toLocaleDateString()}</p>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="text-xs">
                                        <p>Start: {new Date(item.newNextStartDate).toLocaleDateString()}</p>
                                        <p>Due: {new Date(item.newNextDueDate).toLocaleDateString()}</p>
                                      </div>
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="space-y-1">
                                        <Badge variant={item.willCreateProject ? "default" : "secondary"} className="text-xs">
                                          {item.willCreateProject ? "Create Project" : "No Project"}
                                        </Badge>
                                        <Badge variant={item.willReschedule ? "default" : "secondary"} className="text-xs">
                                          {item.willReschedule ? "Reschedule" : "No Reschedule"}
                                        </Badge>
                                      </div>
                                    </td>
                                    <td className="p-3 text-center">
                                      <div className="space-y-1">
                                        {item.isCompaniesHouseService && (
                                          <Badge variant="outline" className="text-xs">CH Service</Badge>
                                        )}
                                        {item.configurationError && (
                                          <Badge variant="destructive" className="text-xs">Error</Badge>
                                        )}
                                        {!item.configurationError && (
                                          <Badge variant="default" className="text-xs">Ready</Badge>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* No Services Found */}
                    {previewData.servicesFoundDue === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                        <p className="text-lg font-medium">No services due on this date</p>
                        <p className="text-sm">Try selecting a different date or check your service schedules.</p>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm">{previewData.summary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <UploadModal 
        isOpen={showUploadModal} 
        onClose={() => setShowUploadModal(false)} 
      />
      
      {user.isAdmin && (
        <>
          <UserManagementModal 
            isOpen={showUserModal} 
            onClose={() => setShowUserModal(false)} 
          />
          <SettingsModal 
            isOpen={showSettingsModal} 
            onClose={() => setShowSettingsModal(false)} 
          />
        </>
      )}
      
      {/* Delete Test Data Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Test Data</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete ALL data except user accounts:
              <br />• All projects and project history
              <br />• All clients and people
              <br />• All services and configurations  
              <br />• All tags and relationships
              <br />
              <strong>This action cannot be undone.</strong>
              <br /><br />
              Type <strong>DELETE</strong> to confirm this action:
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="my-4">
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              data-testid="input-delete-confirm"
            />
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setDeleteConfirmText("");
                setShowDeleteConfirm(false);
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTestData}
              disabled={deleteConfirmText !== "DELETE" || deleteTestDataMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteTestDataMutation.isPending ? "Deleting..." : "Delete Test Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Frequency Fix Dialog */}
      <AlertDialog open={showFrequencyFix} onOpenChange={setShowFrequencyFix}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Fix Service Frequency Data
            </AlertDialogTitle>
            <AlertDialogDescription>
              This tool will normalize frequency values to lowercase (e.g., "Quarterly" → "quarterly").
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {frequencyIssues && (
            <div className="my-4 space-y-4">
              <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 ${frequencyIssues.totalIssues > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                  <span className="font-medium">
                    {frequencyIssues.totalIssues === 0 
                      ? "No frequency issues found!" 
                      : `${frequencyIssues.totalIssues} issue${frequencyIssues.totalIssues !== 1 ? 's' : ''} found`}
                  </span>
                </div>
                {frequencyIssues.autoFixableIssues > 0 && (
                  <Badge variant="secondary">
                    {frequencyIssues.autoFixableIssues} can be auto-fixed
                  </Badge>
                )}
              </div>

              {frequencyIssues.clientServiceIssues?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Client Services:</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {frequencyIssues.clientServiceIssues.map((issue: any) => (
                      <div key={issue.id} className="text-sm p-2 bg-muted/50 rounded flex justify-between items-center">
                        <span className="truncate flex-1">{issue.clientName} / {issue.serviceName}</span>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge variant="destructive">{issue.currentFrequency}</Badge>
                          <span>→</span>
                          <Badge variant="default">{issue.suggestedFrequency}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {frequencyIssues.peopleServiceIssues?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">People Services:</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {frequencyIssues.peopleServiceIssues.map((issue: any) => (
                      <div key={issue.id} className="text-sm p-2 bg-muted/50 rounded flex justify-between items-center">
                        <span className="truncate flex-1">{issue.personName} / {issue.serviceName}</span>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge variant="destructive">{issue.currentFrequency}</Badge>
                          <span>→</span>
                          <Badge variant="default">{issue.suggestedFrequency}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Valid frequencies: {frequencyIssues.validFrequencies?.join(', ')}
              </div>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowFrequencyFix(false);
                setFrequencyIssues(null);
              }}
              data-testid="button-cancel-frequency-fix"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => fixFrequenciesMutation.mutate()}
              disabled={!frequencyIssues?.autoFixableIssues || fixFrequenciesMutation.isPending}
              data-testid="button-confirm-frequency-fix"
            >
              {fixFrequenciesMutation.isPending ? "Fixing..." : `Fix ${frequencyIssues?.autoFixableIssues || 0} Issues`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scheduling Exceptions Dialog */}
      <AlertDialog open={showSchedulingExceptions} onOpenChange={setShowSchedulingExceptions}>
        <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Scheduling Exceptions
            </AlertDialogTitle>
            <AlertDialogDescription>
              Review and resolve scheduling errors that occurred during automated project scheduling.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {schedulingExceptions && (
            <div className="my-4 space-y-4">
              <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 ${schedulingExceptions.total > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                  <span className="font-medium">
                    {schedulingExceptions.total === 0 
                      ? "No unresolved scheduling exceptions!" 
                      : `${schedulingExceptions.total} unresolved exception${schedulingExceptions.total !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>

              {schedulingExceptions.byErrorType && Object.keys(schedulingExceptions.byErrorType).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(schedulingExceptions.byErrorType).map(([errorType, count]: [string, any]) => (
                    <Badge key={errorType} variant="outline">
                      {errorType.replace(/_/g, ' ')}: {count}
                    </Badge>
                  ))}
                </div>
              )}

              {schedulingExceptions.exceptions?.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {schedulingExceptions.exceptions.map((exception: any) => (
                    <div key={exception.id} className="p-3 bg-muted/50 rounded-lg border">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {exception.clientOrPersonName || 'Unknown'} / {exception.serviceName || 'Unknown Service'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {exception.serviceType === 'client' ? 'Client Service' : 'People Service'}
                            {exception.frequency && ` • ${exception.frequency}`}
                          </div>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {exception.errorType?.replace(/_/g, ' ') || 'error'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground bg-destructive/10 p-2 rounded mt-2">
                        {exception.errorMessage}
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <div className="text-xs text-muted-foreground">
                          {exception.createdAt && new Date(exception.createdAt).toLocaleString()}
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => resolveExceptionMutation.mutate({ exceptionId: exception.id, notes: 'Resolved manually' })}
                          disabled={resolveExceptionMutation.isPending}
                          data-testid={`button-resolve-exception-${exception.id}`}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Mark Resolved
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {schedulingExceptions.total === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p>All scheduling exceptions have been resolved!</p>
                </div>
              )}
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowSchedulingExceptions(false);
                setSchedulingExceptions(null);
              }}
              data-testid="button-close-scheduling-exceptions"
            >
              Close
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => fetchSchedulingExceptionsMutation.mutate()}
              disabled={fetchSchedulingExceptionsMutation.isPending}
              data-testid="button-refresh-scheduling-exceptions"
            >
              Refresh
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
