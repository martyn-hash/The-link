import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import { Eye, RotateCcw } from "lucide-react";
import { formatDate } from "../../utils/formatters";
import { EnhancedClientService } from "../../utils/types";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ClientServiceRowProps {
  clientService: EnhancedClientService;
}

export function ClientServiceRow({ clientService }: ClientServiceRowProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isInactive = clientService.isActive === false;

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/client-services/${clientService.id}`, {
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/client-services/client/${clientService.clientId}`] });
      toast({
        title: "Service Reactivated",
        description: `${clientService.service?.name || 'Service'} has been reactivated successfully.`,
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
    <TableRow data-testid={`service-row-${clientService.id}`}>
      <TableCell className="font-medium">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span data-testid={`text-service-name-${clientService.id}`}>
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
            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {clientService.service.description}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm" data-testid={`text-frequency-${clientService.id}`}>
          {clientService.frequency || '-'}
        </span>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {clientService.nextStartDate ? (
            <div data-testid={`text-next-start-${clientService.id}`}>
              {formatDate(clientService.nextStartDate)}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {clientService.targetDeliveryDate ? (
            <div className="text-purple-600" data-testid={`text-target-delivery-${clientService.id}`}>
              {formatDate(clientService.targetDeliveryDate)}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {clientService.nextDueDate ? (
            <div data-testid={`text-next-due-${clientService.id}`}>
              {formatDate(clientService.nextDueDate)}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {clientService.serviceOwner ? (
            <div data-testid={`text-service-owner-${clientService.id}`}>
              {clientService.serviceOwner.firstName} {clientService.serviceOwner.lastName}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {isInactive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => reactivateMutation.mutate()}
              disabled={reactivateMutation.isPending}
              data-testid={`button-reactivate-service-${clientService.id}`}
            >
              <RotateCcw className={`h-4 w-4 mr-2 ${reactivateMutation.isPending ? 'animate-spin' : ''}`} />
              {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate'}
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={() => setLocation(`/client-service/${clientService.id}`)}
            data-testid={`button-view-service-${clientService.id}`}
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
