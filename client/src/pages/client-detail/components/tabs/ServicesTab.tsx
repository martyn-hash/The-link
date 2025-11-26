import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientServicesList, PersonalServicesList, ServicesDataSubTab } from "./services";
import type { Person, Service, User, PeopleService, Client } from "@shared/schema";
import type { EnhancedClientService } from "../../utils/types";
import { FileText, Settings } from "lucide-react";

interface CompanyConnection {
  client: Client;
  officerRole?: string;
  isPrimaryContact?: boolean;
}

interface ServiceWithRoles {
  id: string;
  roles?: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>;
}

type PeopleServiceWithRelations = PeopleService & { person: Person; service: Service; serviceOwner?: User };

interface ServicesTabProps {
  client: Client;
  clientId: string;
  companyConnections: CompanyConnection[];
  clientServices: EnhancedClientService[] | undefined;
  companyServices: EnhancedClientService[] | undefined;
  servicesLoading: boolean;
  servicesError: boolean;
  companyServicesLoading: boolean;
  companyServicesError: boolean;
  peopleServices: PeopleServiceWithRelations[] | undefined;
  peopleServicesLoading: boolean;
  peopleServicesError: boolean;
  servicesWithRoles: ServiceWithRoles[] | undefined;
  expandedPersonalServiceId: string | null;
  onExpandedPersonalServiceChange: (value: string | null) => void;
  onEditPersonalService: (serviceId: string) => void;
  onRefetchServices: () => void;
  onRefetchPeopleServices: () => void;
  isMobile: boolean;
}

export function ServicesTab({
  client,
  clientId,
  companyConnections,
  clientServices,
  companyServices,
  servicesLoading,
  servicesError,
  companyServicesLoading,
  companyServicesError,
  peopleServices,
  peopleServicesLoading,
  peopleServicesError,
  servicesWithRoles,
  expandedPersonalServiceId,
  onExpandedPersonalServiceChange,
  onEditPersonalService,
  onRefetchServices,
  onRefetchPeopleServices,
  isMobile,
}: ServicesTabProps) {
  const [activeSubTab, setActiveSubTab] = useState("list");
  
  const isCompany = client?.clientType === 'company' || 
                    (client?.clientType === null && client?.companyNumber);
  const isIndividualWithConnections = client?.clientType === 'individual' && (companyConnections?.length ?? 0) > 0;
  const showClientServices = isCompany || isIndividualWithConnections;

  const displayServices = isIndividualWithConnections ? companyServices : clientServices;
  const displayLoading = isIndividualWithConnections ? companyServicesLoading : servicesLoading;
  const displayError = isIndividualWithConnections ? companyServicesError : servicesError;

  return (
    <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="list" className="flex items-center gap-2" data-testid="tab-services-list">
          <Settings className="h-4 w-4" />
          Services
        </TabsTrigger>
        <TabsTrigger value="data" className="flex items-center gap-2" data-testid="tab-services-data">
          <FileText className="h-4 w-4" />
          Services Data
        </TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="space-y-8">
        {showClientServices && (
          <ClientServicesList
            clientId={clientId}
            clientType={client.clientType as 'company' | 'individual' | null | undefined}
            companyNumber={client.companyNumber}
            services={displayServices}
            isLoading={displayLoading}
            isError={displayError}
            isMobile={isMobile}
            onRefetch={onRefetchServices}
          />
        )}

        <PersonalServicesList
          clientId={clientId}
          clientType={client.clientType as 'company' | 'individual' | null | undefined}
          services={peopleServices}
          isLoading={peopleServicesLoading}
          isError={peopleServicesError}
          servicesWithRoles={servicesWithRoles}
          expandedServiceId={expandedPersonalServiceId}
          onExpandedChange={onExpandedPersonalServiceChange}
          onEditService={onEditPersonalService}
          onRefetch={() => { onRefetchServices(); onRefetchPeopleServices(); }}
        />
      </TabsContent>

      <TabsContent value="data">
        <ServicesDataSubTab
          clientId={clientId}
          clientServices={displayServices}
          isLoading={displayLoading}
          isError={displayError}
          onRefetch={onRefetchServices}
        />
      </TabsContent>
    </Tabs>
  );
}
