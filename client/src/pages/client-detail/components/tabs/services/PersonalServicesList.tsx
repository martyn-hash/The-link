import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion } from "@/components/ui/accordion";
import { PersonalServiceRow } from "./PersonalServiceRow";
import { AddServiceModal } from "../../services/AddServiceModal";
import type { Person, Service, User, PeopleService } from "@shared/schema";

interface ServiceWithRoles {
  id: string;
  roles?: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>;
}

type PeopleServiceWithRelations = PeopleService & { person: Person; service: Service; serviceOwner?: User };

interface PersonalServicesListProps {
  clientId: string;
  clientType: 'company' | 'individual' | null | undefined;
  services: PeopleServiceWithRelations[] | undefined;
  isLoading: boolean;
  isError: boolean;
  servicesWithRoles: ServiceWithRoles[] | undefined;
  expandedServiceId: string | null;
  onExpandedChange: (value: string | null) => void;
  onEditService: (serviceId: string) => void;
  onRefetch: () => void;
}

export function PersonalServicesList({
  clientId,
  clientType,
  services,
  isLoading,
  isError,
  servicesWithRoles,
  expandedServiceId,
  onExpandedChange,
  onEditService,
  onRefetch,
}: PersonalServicesListProps) {
  const clientTypeLower = clientType?.toLowerCase();
  const title = clientTypeLower === 'individual' ? 'Services' : 'Personal Services';
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-destructive mb-2">Failed to load personal services</p>
            <p className="text-muted-foreground text-sm">Please try refreshing the page or contact support if the issue persists.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeServices = services?.filter(service => service.isActive !== false) || [];
  const inactiveServices = services?.filter(service => service.isActive === false) || [];
  const hasServices = (services?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddServiceModal 
          clientId={clientId} 
          clientType={clientType === null && clientId ? 'company' : (clientType as 'company' | 'individual' | undefined)} 
          onSuccess={onRefetch} 
        />
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={clientTypeLower === 'individual' ? '' : 'text-red-500'}>
              {title}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div data-testid="section-personal-services">
            {!hasServices ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No personal services have been added yet.</p>
              </div>
            ) : (
              <div className="bg-background space-y-6">
                {activeServices.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-3">Active Services</h4>
                    <Accordion
                      type="single"
                      collapsible
                      value={expandedServiceId ?? undefined}
                      onValueChange={(value) => onExpandedChange(value ?? null)}
                      className="space-y-4"
                    >
                      {activeServices.map((peopleService) => (
                        <PersonalServiceRow
                          key={peopleService.id}
                          peopleService={peopleService}
                          clientId={clientId}
                          servicesWithRoles={servicesWithRoles}
                          onEdit={onEditService}
                        />
                      ))}
                    </Accordion>
                  </div>
                )}
                
                {inactiveServices.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-3">Inactive Services</h4>
                    <Accordion
                      type="single"
                      collapsible
                      value={expandedServiceId ?? undefined}
                      onValueChange={(value) => onExpandedChange(value ?? null)}
                      className="space-y-4"
                    >
                      {inactiveServices.map((peopleService) => (
                        <PersonalServiceRow
                          key={peopleService.id}
                          peopleService={peopleService}
                          clientId={clientId}
                          isInactive
                          servicesWithRoles={servicesWithRoles}
                          onEdit={onEditService}
                        />
                      ))}
                    </Accordion>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
