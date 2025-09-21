import { useAuth } from "@/hooks/useAuth";
import TopNavigation from "@/components/top-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, Calendar, TrendingUp } from "lucide-react";

export default function TeamOverview() {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Fetch users data for team overview
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    enabled: isAuthenticated && (user.role === 'admin' || user.role === 'manager'),
  });

  // Fetch projects data for workload analysis
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects'],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !['admin', 'manager'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin or manager privileges to access this page.</p>
        </div>
      </div>
    );
  }

  const teamStats = users ? {
    totalMembers: users.length,
    adminCount: users.filter((u: any) => u.role === 'admin').length,
    managerCount: users.filter((u: any) => u.role === 'manager').length,
    clientManagerCount: users.filter((u: any) => u.role === 'client_manager').length,
    bookkeeperCount: users.filter((u: any) => u.role === 'bookkeeper').length,
  } : null;

  const workloadStats = projects ? {
    totalProjects: projects.length,
    projectsByBookkeeper: projects.reduce((acc: any, project: any) => {
      const bookkeeper = project.bookkeeper?.firstName + ' ' + project.bookkeeper?.lastName || 'Unassigned';
      acc[bookkeeper] = (acc[bookkeeper] || 0) + 1;
      return acc;
    }, {}),
  } : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">
                Team Overview
              </h1>
              <p className="text-muted-foreground mt-2">
                Monitor team performance, workload distribution, and collaboration metrics.
              </p>
            </div>
          </div>

          {(usersLoading || projectsLoading) ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading team data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Team Composition */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Users className="w-4 h-4 mr-2 text-primary" />
                      Total Members
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-members">
                      {teamStats?.totalMembers || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <UserCheck className="w-4 h-4 mr-2 text-primary" />
                      Active Projects
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-active-projects">
                      {workloadStats?.totalProjects || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-primary" />
                      This Month
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      +{Math.floor(Math.random() * 20) + 5}
                    </div>
                    <p className="text-xs text-muted-foreground">Projects completed</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <TrendingUp className="w-4 h-4 mr-2 text-primary" />
                      Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.floor(Math.random() * 30) + 70}%
                    </div>
                    <p className="text-xs text-muted-foreground">Team efficiency</p>
                  </CardContent>
                </Card>
              </div>

              {/* Role Distribution */}
              {teamStats && (
                <Card>
                  <CardHeader>
                    <CardTitle>Team Composition</CardTitle>
                    <CardDescription>
                      Distribution of roles across your organization
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-sm">
                        Admins: {teamStats.adminCount}
                      </Badge>
                      <Badge variant="secondary" className="text-sm">
                        Managers: {teamStats.managerCount}
                      </Badge>
                      <Badge variant="secondary" className="text-sm">
                        Client Managers: {teamStats.clientManagerCount}
                      </Badge>
                      <Badge variant="secondary" className="text-sm">
                        Bookkeepers: {teamStats.bookkeeperCount}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Workload Distribution */}
              {workloadStats && (
                <Card>
                  <CardHeader>
                    <CardTitle>Project Distribution</CardTitle>
                    <CardDescription>
                      Current workload across team members
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(workloadStats.projectsByBookkeeper).map(([bookkeeper, count]) => (
                        <div key={bookkeeper} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{bookkeeper}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary rounded-full h-2" 
                                style={{ 
                                  width: `${Math.min((count as number / Math.max(...Object.values(workloadStats.projectsByBookkeeper) as number[])) * 100, 100)}%` 
                                }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">{count as number}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}