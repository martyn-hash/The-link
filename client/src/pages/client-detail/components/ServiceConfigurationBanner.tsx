import { AlertTriangle, Info, X } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { EnhancedClientService } from "../utils/types";

interface ServiceConfigurationIssue {
  serviceName: string;
  serviceId: string;
  issues: string[];
}

interface ServiceConfigurationBannerProps {
  clientServices: EnhancedClientService[] | undefined;
  isLoading: boolean;
}

export function ServiceConfigurationBanner({ 
  clientServices, 
  isLoading 
}: ServiceConfigurationBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading || isDismissed || !clientServices) {
    return null;
  }

  const servicesWithIssues: ServiceConfigurationIssue[] = [];

  for (const clientService of clientServices) {
    const issues: string[] = [];
    const service = clientService.service;
    
    if (service.isStaticService) {
      continue;
    }

    const isCHService = service.isCompaniesHouseConnected;
    
    if (!clientService.nextStartDate) {
      issues.push("Missing next start date");
    }
    if (!clientService.nextDueDate) {
      issues.push("Missing next due date");
    }
    // Target delivery date is only required for non-CH services
    // CH services either auto-calculate it or it's optional depending on offset config
    if (!isCHService && !clientService.targetDeliveryDate) {
      issues.push("Missing target delivery date");
    }
    if (!clientService.serviceOwnerId) {
      issues.push("No service owner assigned");
    }
    
    const serviceRoles = clientService.service && (clientService.service as any).roles;
    if (serviceRoles && Array.isArray(serviceRoles) && serviceRoles.length > 0) {
      const assignedRoleIds = new Set(
        clientService.roleAssignments?.map(ra => ra.workRoleId) || []
      );
      const missingRoles = serviceRoles.filter((role: any) => !assignedRoleIds.has(role.id));
      if (missingRoles.length > 0) {
        issues.push(`Missing role assignments: ${missingRoles.map((r: any) => r.name).join(", ")}`);
      }
    }

    if (issues.length > 0) {
      servicesWithIssues.push({
        serviceName: service.name,
        serviceId: clientService.id,
        issues
      });
    }
  }

  if (servicesWithIssues.length === 0) {
    return null;
  }

  const totalIssues = servicesWithIssues.reduce((acc, s) => acc + s.issues.length, 0);

  return (
    <Alert 
      variant="destructive" 
      className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/30"
      data-testid="banner-service-config-issues"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200 flex items-center justify-between">
        <span>Service Configuration Issues Detected</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDismissed(true)}
          className="h-6 w-6 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
          data-testid="btn-dismiss-config-banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center gap-2 mt-1">
            <span>
              {servicesWithIssues.length} service{servicesWithIssues.length !== 1 ? 's' : ''} with {totalIssues} configuration issue{totalIssues !== 1 ? 's' : ''} that may prevent projects from being created correctly.
            </span>
            <CollapsibleTrigger asChild>
              <Button 
                variant="link" 
                className="text-amber-800 dark:text-amber-200 p-0 h-auto font-medium underline"
                data-testid="btn-toggle-config-details"
              >
                {isExpanded ? "Hide details" : "Show details"}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="mt-3 space-y-2">
            {servicesWithIssues.map((service) => (
              <div 
                key={service.serviceId} 
                className="bg-amber-100 dark:bg-amber-900/40 rounded-md p-3"
                data-testid={`config-issue-${service.serviceId}`}
              >
                <div className="font-medium text-amber-900 dark:text-amber-100">
                  {service.serviceName}
                </div>
                <ul className="mt-1 text-sm list-disc list-inside text-amber-700 dark:text-amber-300">
                  {service.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2 text-sm text-amber-600 dark:text-amber-400">
              <Info className="h-4 w-4" />
              <span>Go to the Services tab to fix these configuration issues.</span>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </AlertDescription>
    </Alert>
  );
}
