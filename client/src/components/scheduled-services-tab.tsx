import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { isUnauthorizedError } from "@/lib/authUtils";
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
  currentProjectStartDate: string | null;
  currentProjectDueDate: string | null;
  projectTypeName: string;
  hasActiveProject: boolean;
  frequency: string;
  isActive: boolean;
  serviceOwnerId?: string;
  serviceOwnerName?: string;
}

export default function ScheduledServicesTab() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showAllServices, setShowAllServices] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("all");

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

  useEffect(() => {
    if (servicesError && isUnauthorizedError(servicesError)) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [servicesError]);

  const filteredServices = scheduledServices.filter(service => {
    if (!showAllServices) {
      if (!service.nextStartDate && !service.nextDueDate) {
        return false;
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
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

    if (selectedService !== "all" && service.serviceId !== selectedService) {
      return false;
    }

    return true;
  });

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

      refetchServices();
    } catch (error) {
      showFriendlyError({ error: "Failed to create projects. Please try again." });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-base md:text-lg">
            <Calendar className="w-4 h-4 md:w-5 md:h-5" />
            <span>Filters & Controls</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-4 md:gap-6">
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
                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Active Project
                        </Badge>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
