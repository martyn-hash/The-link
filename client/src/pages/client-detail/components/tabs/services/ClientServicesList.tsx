import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceCard } from "./ServiceCard";
import { ClientServiceRow } from "../../services";
import { AddServiceModal } from "../../services/AddServiceModal";
import type { EnhancedClientService } from "../../../utils/types";

interface ClientServicesListProps {
  clientId: string;
  clientType: 'company' | 'individual' | null | undefined;
  companyNumber?: string | null;
  services: EnhancedClientService[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isMobile: boolean;
  onRefetch: () => void;
}

export function ClientServicesList({
  clientId,
  clientType,
  companyNumber,
  services,
  isLoading,
  isError,
  isMobile,
  onRefetch,
}: ClientServicesListProps) {
  const effectiveClientType = clientType === null && companyNumber 
    ? 'company' 
    : (clientType as 'company' | 'individual' | undefined);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-2">Failed to load services</p>
        <p className="text-muted-foreground text-sm">Please try refreshing the page or contact support if the issue persists.</p>
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">No client services have been added yet.</p>
      </div>
    );
  }

  const activeServices = services.filter(service => service.isActive !== false);
  const inactiveServices = services.filter(service => service.isActive === false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Client Services</CardTitle>
          <AddServiceModal 
            clientId={clientId} 
            clientType={effectiveClientType} 
            onSuccess={onRefetch} 
          />
        </div>
      </CardHeader>
      <CardContent>
        <div data-testid="section-client-services" className="space-y-6">
          {activeServices.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-3">Active Services</h4>
              {isMobile ? (
                <div className="space-y-3">
                  {activeServices.map((clientService) => (
                    <ServiceCard key={clientService.id} clientService={clientService} />
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Next Start</TableHead>
                        <TableHead>Next Due</TableHead>
                        <TableHead>Service Owner</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeServices.map((clientService) => (
                        <ClientServiceRow key={clientService.id} clientService={clientService} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {inactiveServices.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-3">Inactive Services</h4>
              {isMobile ? (
                <div className="space-y-3 opacity-60">
                  {inactiveServices.map((clientService) => (
                    <ServiceCard key={clientService.id} clientService={clientService} />
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg opacity-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Next Start</TableHead>
                        <TableHead>Next Due</TableHead>
                        <TableHead>Service Owner</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inactiveServices.map((clientService) => (
                        <ClientServiceRow key={clientService.id} clientService={clientService} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
