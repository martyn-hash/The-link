import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import type { EnhancedClientService } from "../../../utils/types";

interface ServiceCardProps {
  clientService: EnhancedClientService;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try {
    return format(new Date(date), 'dd/MM/yyyy');
  } catch {
    return '-';
  }
}

export function ServiceCard({ clientService }: ServiceCardProps) {
  const [, setLocation] = useLocation();

  return (
    <Card data-testid={`service-card-${clientService.id}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium" data-testid={`text-service-name-${clientService.id}`}>
                {clientService.service?.name || 'Service'}
              </span>
              {clientService.service?.isStaticService && (
                <Badge variant="secondary" className="bg-gray-500 text-white text-xs" data-testid={`badge-static-${clientService.id}`}>
                  Static
                </Badge>
              )}
              {clientService.service?.isPersonalService && (
                <Badge variant="secondary" className="bg-purple-500 text-white text-xs" data-testid={`badge-personal-${clientService.id}`}>
                  Personal
                </Badge>
              )}
              {clientService.service?.isCompaniesHouseConnected && (
                <Badge variant="secondary" className="bg-blue-500 text-white text-xs" data-testid={`badge-ch-${clientService.id}`}>
                  CH
                </Badge>
              )}
            </div>
            {clientService.service?.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {clientService.service.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
            <div>
              <span className="text-muted-foreground text-xs">Frequency</span>
              <p className="font-medium" data-testid={`text-frequency-${clientService.id}`}>
                {clientService.frequency || '-'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Service Owner</span>
              <p className="font-medium" data-testid={`text-service-owner-${clientService.id}`}>
                {clientService.serviceOwner 
                  ? `${clientService.serviceOwner.firstName} ${clientService.serviceOwner.lastName}`
                  : '-'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Next Start</span>
              <p className="font-medium" data-testid={`text-next-start-${clientService.id}`}>
                {formatDate(clientService.nextStartDate)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Target Delivery</span>
              <p className="font-medium text-purple-600" data-testid={`text-target-delivery-${clientService.id}`}>
                {formatDate(clientService.targetDeliveryDate)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Next Due</span>
              <p className="font-medium" data-testid={`text-next-due-${clientService.id}`}>
                {formatDate(clientService.nextDueDate)}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={() => setLocation(`/client-service/${clientService.id}`)}
            data-testid={`button-view-service-${clientService.id}`}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
