import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/sidebar";
import UploadModal from "@/components/upload-modal";
import SettingsModal from "@/components/settings-modal";
import UserManagementModal from "@/components/user-management-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Settings, Users, FileText, BarChart } from "lucide-react";

export default function Admin() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && !!user && user?.role === 'admin',
    retry: false,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Check admin access
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
      return;
    }
  }, [user, toast]);

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

  if (user.role !== 'admin') {
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
  const totalProjects = projects?.length || 0;
  const totalUsers = users?.length || 0;
  const completedProjects = projects?.filter((p: any) => p.currentStatus === 'completed').length || 0;
  const activeProjects = totalProjects - completedProjects;

  const statusCounts = projects?.reduce((acc: any, project: any) => {
    acc[project.currentStatus] = (acc[project.currentStatus] || 0) + 1;
    return acc;
  }, {}) || {};

  const roleCounts = users?.reduce((acc: any, user: any) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {}) || {};

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      
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
              
              {user.role === 'admin' && (
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
                {user.role === 'admin' && (
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
                  {projects?.slice(0, 5).map((project: any) => {
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
                  
                  {!projects?.length && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent activity
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Modals */}
      <UploadModal 
        isOpen={showUploadModal} 
        onClose={() => setShowUploadModal(false)} 
      />
      
      {user.role === 'admin' && (
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
    </div>
  );
}
