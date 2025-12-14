import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Briefcase, Calendar, Clock, Pencil, RotateCcw, Users, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ServiceProjectsList } from "../../projects/ServiceProjectsList";
import type { Person, Service, User, PeopleService } from "@shared/schema";

interface ServiceWithRoles {
  id: string;
  roles?: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>;
}

export interface PersonalServiceRowProps {
  peopleService: PeopleService & { person: Person; service: Service; serviceOwner?: User };
  isInactive?: boolean;
  servicesWithRoles?: ServiceWithRoles[];
  onEdit: (serviceId: string) => void;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try {
    return format(new Date(date), 'dd/MM/yyyy');
  } catch {
    return '-';
  }
}

function formatPersonName(fullName?: string | null): string {
  if (!fullName) return '-';
  const parts = fullName.split(' ');
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }
  return fullName;
}

export function PersonalServiceRow({ 
  peopleService, 
  isInactive = false,
  servicesWithRoles,
  onEdit 
}: PersonalServiceRowProps) {
  const { toast } = useToast();
  const serviceWithRoles = servicesWithRoles?.find(s => s.id === peopleService.service.id);
  const roles = serviceWithRoles?.roles || [];

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/people-services/${peopleService.id}`, {
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/people-services'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({
        title: "Service Reactivated",
        description: `${peopleService.service?.name || 'Service'} has been reactivated successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reactivate service",
        description: error.message || "An error occurred while reactivating the service.",
        variant: "destructive",
      });
    },
  });

  return (
    <AccordionItem 
      value={peopleService.id} 
      className={`border rounded-lg bg-card ${isInactive ? 'opacity-60' : ''}`}
    >
      <AccordionTrigger 
        className="text-left hover:no-underline p-4"
        data-testid={`personal-service-row-${peopleService.id}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full mr-4">
          <div className="space-y-2">
            <div>
              <h4 className="font-medium text-lg" data-testid={`text-personal-service-name-${peopleService.id}`}>
                {peopleService.service?.name || 'Service'}
                {isInactive && <span className="text-xs text-red-500 ml-2">(Inactive)</span>}
              </h4>
              {peopleService.service?.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {peopleService.service.description}
                </p>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Frequency: {peopleService.frequency || 'Not scheduled'}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Next Service Dates</span>
            </div>
            <div className="space-y-1">
              {peopleService.nextStartDate ? (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground">Start:</span>
                  <span className="text-sm font-medium" data-testid={`text-next-start-date-${peopleService.id}`}>
                    {formatDate(peopleService.nextStartDate)}
                  </span>
                </div>
              ) : null}
              {peopleService.nextDueDate ? (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground">Due:</span>
                  <span className="text-sm font-medium" data-testid={`text-next-due-date-${peopleService.id}`}>
                    {formatDate(peopleService.nextDueDate)}
                  </span>
                </div>
              ) : null}
              {!peopleService.nextStartDate && !peopleService.nextDueDate && (
                <p className="text-sm text-muted-foreground italic">Not scheduled</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Current Project Dates</span>
            </div>
            <p className="text-sm text-muted-foreground italic">No active project</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Person</span>
            </div>
            {peopleService.person ? (
              <div className="space-y-1">
                <div className="text-sm font-medium" data-testid={`text-person-name-${peopleService.id}`}>
                  {formatPersonName(peopleService.person.fullName)}
                </div>
                {peopleService.person.email && (
                  <div className="text-xs text-muted-foreground">
                    {peopleService.person.email}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No person assigned</p>
            )}
          </div>
        </div>
      </AccordionTrigger>
      
      <AccordionContent 
        className="px-4 pb-4 border-t bg-gradient-to-r from-muted/30 to-muted/10 dark:from-muted/40 dark:to-muted/20" 
        data-testid={`section-personal-service-details-${peopleService.id}`}
      >
        <div className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            <div className="flex items-center gap-2">
              {isInactive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reactivateMutation.mutate()}
                  disabled={reactivateMutation.isPending}
                  data-testid={`button-reactivate-personal-service-${peopleService.id}`}
                  className="h-8 px-3 text-xs"
                >
                  <RotateCcw className={`h-3 w-3 mr-1 ${reactivateMutation.isPending ? 'animate-spin' : ''}`} />
                  {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(peopleService.id)}
                data-testid={`button-edit-personal-service-${peopleService.id}`}
                className="h-8 px-3 text-xs"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit Service
              </Button>
            </div>
          </div>
          <Tabs defaultValue="roles" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="roles" data-testid={`tab-roles-${peopleService.id}`}>Roles & Assignments</TabsTrigger>
              <TabsTrigger value="projects" data-testid={`tab-projects-${peopleService.id}`}>Related Projects</TabsTrigger>
            </TabsList>

            <TabsContent value="roles" className="mt-4">
              <div className="space-y-4">
                <h5 className="font-medium text-sm flex items-center">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  Role Assignments
                </h5>
                
                {roles.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No roles defined for this service.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {roles.map((role) => (
                      <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-sm" data-testid={`role-name-${role.id}`}>
                              {role.name}
                            </div>
                            {role.description && (
                              <div className="text-xs text-muted-foreground" data-testid={`role-description-${role.id}`}>
                                {role.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {peopleService.serviceOwner ? (
                            <span className="text-emerald-600 dark:text-emerald-400" data-testid={`role-owner-${role.id}`}>
                              {peopleService.serviceOwner.firstName} {peopleService.serviceOwner.lastName}
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400" data-testid={`role-unassigned-${role.id}`}>
                              Unassigned
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-muted-foreground mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="font-medium mb-1">Personal Service Assignment</p>
                      <p>
                        This service is assigned to <span className="font-medium">{formatPersonName(peopleService.person.fullName)}</span>
                        {peopleService.serviceOwner ? 
                          ` and managed by ${peopleService.serviceOwner.firstName} ${peopleService.serviceOwner.lastName}.` :
                          '. No service owner is currently assigned.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="projects" className="mt-4">
              <div className="space-y-4">
                <h5 className="font-medium text-sm flex items-center">
                  <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />
                  Related Projects
                </h5>
                
                <ServiceProjectsList serviceId={peopleService.serviceId} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
