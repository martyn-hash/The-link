import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import TopNavigation from "@/components/top-navigation";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, RefreshCw, AlertCircle } from "lucide-react";
import { format, isValid } from "date-fns";

// Helper function to safely format dates
const safeFormatDate = (dateValue: string | null | undefined, formatString: string = 'MMM d, yyyy'): string | null => {
  if (!dateValue) return null;
  try {
    const date = new Date(dateValue);
    if (!isValid(date)) return null;
    return format(date, formatString);
  } catch {
    return null;
  }
};

interface ScheduledServiceView {
  id: string;
  serviceId: string;
  serviceName: string;
  clientOrPersonName: string;
  clientOrPersonType: 'client' | 'person';
  nextStartDate: string | null;
  nextDueDate: string | null;
  currentProjectStartDate: string | null; // Current project start date (when hasActiveProject is true)
  currentProjectDueDate: string | null;   // Current project due date (when hasActiveProject is true)
  projectTypeName: string;
  hasActiveProject: boolean;
  frequency: string;
  isActive: boolean;
  serviceOwnerId?: string;
  serviceOwnerName?: string;
}

export default function ScheduledServices() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("all");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  // Check admin access
  useEffect(() => {
    if (user && !user.isAdmin && !user.canSeeAdminMenu) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Fetch scheduled services data (placeholder for now)
  const { 
    data: scheduledServices = [], 
    isLoading: servicesLoading, 
    error: servicesError,
    refetch: refetchServices 
  } = useQuery<ScheduledServiceView[]>({
    queryKey: ['/api/scheduled-services'],
    enabled: Boolean(isAuthenticated && user && (user.isAdmin || user.canSeeAdminMenu)),
    retry: false,
  });

  // Handle query errors
  useEffect(() => {
    if (servicesError && isUnauthorizedError(servicesError)) {
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
  }, [servicesError, toast]);

  // Filter services based on current settings
  const filteredServices = scheduledServices.filter(service => {
    // Date filter: show only today's services or all services
    if (!showAllServices) {
      // For "today's services only", require either nextStartDate or nextDueDate to be today
      if (!service.nextStartDate && !service.nextDueDate) {
        return false; // Exclude services with no dates
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day
      
      const startDateIsToday = service.nextStartDate ? (() => {
        try {
          const startDate = new Date(service.nextStartDate);
          startDate.setHours(0, 0, 0, 0);
          return startDate.getTime() === today.getTime();
        } catch {
          return false;
        }
      })() : false;
      
      const dueDateIsToday = service.nextDueDate ? (() => {
        try {
          const dueDate = new Date(service.nextDueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === today.getTime();
        } catch {
          return false;
        }
      })() : false;
      
      if (!startDateIsToday && !dueDateIsToday) {
        return false;
      }
    }

    // Service filter: show specific service or all services
    if (selectedService !== "all" && service.serviceId !== selectedService) {
      return false;
    }

    return true;
  });

  // Get unique services for filter dropdown
  const uniqueServicesMap = new Map();
  scheduledServices.forEach(s => {
    if (!uniqueServicesMap.has(s.serviceId)) {
      uniqueServicesMap.set(s.serviceId, { id: s.serviceId, name: s.serviceName });
    }
  });
  const uniqueServices = Array.from(uniqueServicesMap.values());

  const handleCreateProjects = async () => {
    try {
      const response = await fetch('/api/project-scheduling/run', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to create projects');
      }

      const result = await response.json();
      
      toast({
        title: "Projects Created Successfully",
        description: `Created ${result.projectsCreated} projects and rescheduled ${result.servicesRescheduled} services.`,
      });

      // Refresh the data
      refetchServices();
    } catch (error) {
      toast({
        title: "Error Creating Projects",
        description: "Failed to create projects. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user.isAdmin && !user.canSeeAdminMenu) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation user={user} />
        <div className="container mx-auto px-6 py-8">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation user={user} />
      
      <div className="page-container py-6 md:py-8" style={{ paddingBottom: isMobile ? '5rem' : undefined }}>
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="heading-scheduled-services">
            Scheduled Services
          </h1>
          <p className="text-meta mt-2">
            Manage and monitor all scheduled services for clients and people
          </p>
        </div>

        {/* Filters and Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-base md:text-lg">
              <Calendar className="w-4 h-4 md:w-5 md:h-5" />
              <span>Filters & Controls</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-4 md:gap-6">
              {/* Date Filter Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-all-services"
                  checked={showAllServices}
                  onCheckedChange={setShowAllServices}
                  data-testid="switch-show-all-services"
                />
                <Label htmlFor="show-all-services" className="text-sm md:text-base">
                  {showAllServices ? "Show All Services" : "Today's Services Only"}
                </Label>
              </div>

              {/* Service Filter */}
              <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-2 flex-1 md:flex-none">
                <Label htmlFor="service-filter" className="text-sm md:text-base">Service:</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="w-full md:w-48" data-testid="select-service-filter">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    {uniqueServices.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Create Projects Button */}
              <Button 
                onClick={handleCreateProjects}
                className="flex items-center justify-center space-x-2 w-full md:w-auto"
                data-testid="button-create-projects"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Create Projects</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Services Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Services ({filteredServices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {servicesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {showAllServices ? "No services found" : "No services scheduled for today"}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service Name</TableHead>
                        <TableHead>Client / Person Name</TableHead>
                        <TableHead>Service Dates (Next)</TableHead>
                        <TableHead>Current Project Dates</TableHead>
                        <TableHead>Project Type</TableHead>
                        <TableHead>Project Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredServices.map((service) => (
                        <TableRow key={service.id} data-testid={`row-service-${service.id}`}>
                          <TableCell className="font-medium">{service.serviceName}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span>{service.clientOrPersonName}</span>
                              <Badge variant="outline" className="text-xs">
                                {service.clientOrPersonType}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {service.nextStartDate && safeFormatDate(service.nextStartDate) && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-muted-foreground">Start:</span>
                                  <span className="text-sm">{safeFormatDate(service.nextStartDate)}</span>
                                  {service.nextStartDate && new Date(service.nextStartDate).toDateString() === new Date().toDateString() && (
                                    <Badge variant="default" className="text-xs">Today</Badge>
                                  )}
                                </div>
                              )}
                              {service.nextDueDate && safeFormatDate(service.nextDueDate) && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-muted-foreground">Due:</span>
                                  <span className="text-sm">{safeFormatDate(service.nextDueDate)}</span>
                                </div>
                              )}
                              {!service.nextStartDate && !service.nextDueDate && (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {service.hasActiveProject && (service.currentProjectStartDate || service.currentProjectDueDate) ? (
                              <div className="space-y-1">
                                {service.currentProjectStartDate && safeFormatDate(service.currentProjectStartDate) && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-muted-foreground">Started:</span>
                                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                      {safeFormatDate(service.currentProjectStartDate)}
                                    </span>
                                  </div>
                                )}
                                {service.currentProjectDueDate && safeFormatDate(service.currentProjectDueDate) && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-muted-foreground">Due:</span>
                                    <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                                      {safeFormatDate(service.currentProjectDueDate)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>{service.projectTypeName}</TableCell>
                          <TableCell>
                            {service.hasActiveProject ? (
                              <div className="flex items-center space-x-2">
                                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  Active Project
                                </Badge>
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-muted-foreground">
                                No Active Project
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {filteredServices.map((service) => (
                    <Card key={service.id} data-testid={`card-service-${service.id}`} className="border-l-4" style={{ borderLeftColor: service.hasActiveProject ? 'rgb(34 197 94)' : 'rgb(156 163 175)' }}>
                      <CardContent className="p-4 space-y-3">
                        {/* Service Name and Status */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-base">{service.serviceName}</h3>
                          {service.hasActiveProject ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs whitespace-nowrap">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-muted-foreground text-xs whitespace-nowrap">
                              No Project
                            </Badge>
                          )}
                        </div>

                        {/* Client/Person */}
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Client:</span>
                          <span className="font-medium">{service.clientOrPersonName}</span>
                          <Badge variant="outline" className="text-xs">
                            {service.clientOrPersonType}
                          </Badge>
                        </div>

                        {/* Project Type */}
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Type:</span>
                          <span>{service.projectTypeName}</span>
                        </div>

                        {/* Next Service Dates */}
                        {(service.nextStartDate || service.nextDueDate) && (
                          <div className="space-y-1 pt-2 border-t">
                            <div className="text-xs font-semibold text-muted-foreground mb-1">Next Service</div>
                            {service.nextStartDate && safeFormatDate(service.nextStartDate) && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Start:</span>
                                <span>{safeFormatDate(service.nextStartDate)}</span>
                                {new Date(service.nextStartDate).toDateString() === new Date().toDateString() && (
                                  <Badge variant="default" className="text-xs">Today</Badge>
                                )}
                              </div>
                            )}
                            {service.nextDueDate && safeFormatDate(service.nextDueDate) && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Due:</span>
                                <span>{safeFormatDate(service.nextDueDate)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Current Project Dates */}
                        {service.hasActiveProject && (service.currentProjectStartDate || service.currentProjectDueDate) && (
                          <div className="space-y-1 pt-2 border-t">
                            <div className="text-xs font-semibold text-muted-foreground mb-1">Current Project</div>
                            {service.currentProjectStartDate && safeFormatDate(service.currentProjectStartDate) && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Started:</span>
                                <span className="font-medium text-blue-700 dark:text-blue-300">
                                  {safeFormatDate(service.currentProjectStartDate)}
                                </span>
                              </div>
                            )}
                            {service.currentProjectDueDate && safeFormatDate(service.currentProjectDueDate) && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Due:</span>
                                <span className="font-medium text-orange-700 dark:text-orange-300">
                                  {safeFormatDate(service.currentProjectDueDate)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />

      {/* Mobile Search Modal */}
      <SuperSearch
        isOpen={mobileSearchOpen}
        onOpenChange={setMobileSearchOpen}
      />
    </div>
  );
}