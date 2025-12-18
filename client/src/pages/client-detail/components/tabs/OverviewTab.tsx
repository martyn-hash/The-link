import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, MapPin, Mail, ExternalLink, Plus, X, Users, Settings, FileText, UserPlus, Link } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TagManager from "@/components/tag-manager";
import { RelatedPersonRow } from "../people";
import { ClientServicesList, PersonalServicesList, ServicesDataSubTab } from "./services";
import type { Client, Person, Service, User, PeopleService } from "@shared/schema";
import type { ClientPersonWithPerson, EnhancedClientService, ClientServiceWithService } from "../../utils/types";

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

interface ServicesSectionProps {
  client: Client;
  clientId: string;
  companyConnections: CompanyConnection[];
  clientServices: EnhancedClientService[] | undefined;
  companyServices: ClientServiceWithService[] | undefined;
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

function ServicesSection({
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
}: ServicesSectionProps) {
  const [activeSubTab, setActiveSubTab] = useState("list");

  const clientTypeLower = client?.clientType?.toLowerCase();
  const isCompany = clientTypeLower === 'company' || 
                    (client?.clientType === null && client?.companyNumber);
  const isIndividualWithConnections = clientTypeLower === 'individual' && (companyConnections?.length ?? 0) > 0;
  const showClientServices = isCompany || isIndividualWithConnections;

  const displayServices = isIndividualWithConnections ? companyServices : clientServices;
  const displayLoading = isIndividualWithConnections ? companyServicesLoading : servicesLoading;
  const displayError = isIndividualWithConnections ? companyServicesError : servicesError;

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="list" className="flex items-center gap-2" data-testid="tab-services-list">
              <Settings className="h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2" data-testid="tab-services-data">
              <FileText className="h-4 w-4" />
              Service Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
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
      </CardContent>
    </Card>
  );
}

interface OverviewTabProps {
  client: Client;
  clientId: string;
  relatedPeople: ClientPersonWithPerson[] | undefined;
  peopleLoading: boolean;
  peopleError: Error | null;
  onAddPerson: () => void;
  onLinkExistingPerson: () => void;
  companyConnections: CompanyConnection[];
  connectionsLoading: boolean;
  onAddCompanyConnection: () => void;
  onCreateCompany: () => void;
  onRemoveCompanyConnection: (companyId: string) => void;
  isLinkingCompany: boolean;
  isUnlinkingCompany: boolean;
  clientServices: EnhancedClientService[] | undefined;
  companyServices: ClientServiceWithService[] | undefined;
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

export function OverviewTab({
  client,
  clientId,
  relatedPeople,
  peopleLoading,
  peopleError,
  onAddPerson,
  onLinkExistingPerson,
  companyConnections,
  connectionsLoading,
  onAddCompanyConnection,
  onCreateCompany,
  onRemoveCompanyConnection,
  isLinkingCompany,
  isUnlinkingCompany,
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
}: OverviewTabProps) {
  const hasAddress = [
    client.registeredAddress1,
    client.registeredAddress2,
    client.registeredAddress3,
    client.registeredPostcode,
    client.registeredCountry
  ].filter(Boolean).length > 0;

  return (
    <div className="space-y-8">
      {/* Company Details with Related People - 35/65 Split */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Company Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-[30%_1fr] gap-6">
            {/* Left Side - Company Details (30%) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Registered Office</h3>
                </div>
                {client.companyNumber && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`https://find-and-update.company-information.service.gov.uk/company/${client.companyNumber}`, '_blank')}
                    data-testid="button-view-companies-house"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Companies House
                  </Button>
                )}
              </div>
              
              {hasAddress ? (
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="space-y-1" data-testid="text-company-address">
                    {client.registeredAddress1 && <p className="font-medium">{client.registeredAddress1}</p>}
                    {client.registeredAddress2 && <p>{client.registeredAddress2}</p>}
                    {client.registeredAddress3 && <p>{client.registeredAddress3}</p>}
                    {client.registeredPostcode && <p className="font-medium">{client.registeredPostcode}</p>}
                    {client.registeredCountry && <p className="text-muted-foreground">{client.registeredCountry}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground italic p-4 border rounded-lg bg-muted/30">
                  No registered address available
                </p>
              )}

              {client.email && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    Company Email
                  </label>
                  <p className="font-medium" data-testid="text-company-email">
                    {client.email}
                  </p>
                </div>
              )}

              {client.companyType && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    Company Type
                  </label>
                  <p className="font-medium" data-testid="text-company-type">
                    {client.companyType}
                  </p>
                </div>
              )}

              {/* Client Tags */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  Client Tags
                </label>
                <TagManager 
                  entityId={client.id} 
                  entityType="client" 
                  className="mt-2"
                />
              </div>

            </div>

            {/* Right Side - Related People (70%) */}
            <div className="space-y-4 lg:border-l lg:pl-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Related People</h3>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      data-testid="button-add-person-dropdown"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onAddPerson} data-testid="menu-add-new-person">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create New Person
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onLinkExistingPerson} data-testid="menu-link-existing-person">
                      <Link className="h-4 w-4 mr-2" />
                      Link Existing Person
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div data-testid="section-related-people">
                {peopleLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : peopleError ? (
                  <div className="text-center py-8">
                    <p className="text-destructive mb-2">
                      Failed to load related people
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Please try refreshing the page or contact support if the issue persists.
                    </p>
                  </div>
                ) : relatedPeople && relatedPeople.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Primary Email</TableHead>
                          <TableHead>Primary Phone</TableHead>
                          <TableHead>Date of Birth</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...relatedPeople]
                          .sort((a, b) => {
                            if (a.isPrimaryContact && !b.isPrimaryContact) return -1;
                            if (!a.isPrimaryContact && b.isPrimaryContact) return 1;
                            return 0;
                          })
                          .map((clientPerson) => (
                          <RelatedPersonRow
                            key={clientPerson.person.id}
                            clientPerson={clientPerson}
                            clientId={clientId}
                            clientName={client?.name || ''}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No directors or related people found for this client.
                    </p>
                    <p className="text-muted-foreground text-sm mt-2">
                      Directors will be automatically added when creating clients from Companies House data.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Section with Sub-tabs */}
      <ServicesSection
        client={client}
        clientId={clientId}
        companyConnections={companyConnections}
        clientServices={clientServices}
        companyServices={companyServices}
        servicesLoading={servicesLoading}
        servicesError={servicesError}
        companyServicesLoading={companyServicesLoading}
        companyServicesError={companyServicesError}
        peopleServices={peopleServices}
        peopleServicesLoading={peopleServicesLoading}
        peopleServicesError={peopleServicesError}
        servicesWithRoles={servicesWithRoles}
        expandedPersonalServiceId={expandedPersonalServiceId}
        onExpandedPersonalServiceChange={onExpandedPersonalServiceChange}
        onEditPersonalService={onEditPersonalService}
        onRefetchServices={onRefetchServices}
        onRefetchPeopleServices={onRefetchPeopleServices}
        isMobile={isMobile}
      />

      {/* Company Connections Section - Only show for individual clients */}
      {client.clientType?.toLowerCase() === 'individual' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Company Connections
                {companyConnections.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {companyConnections.length}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  data-testid="button-add-company-connection"
                  onClick={onAddCompanyConnection}
                  disabled={isLinkingCompany}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isLinkingCompany ? "Connecting..." : "Add Company"}
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  data-testid="button-create-company"
                  onClick={onCreateCompany}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Create Company
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div data-testid="section-company-connections">
              {connectionsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : companyConnections.length > 0 ? (
                <div className="space-y-3">
                  {companyConnections.map((connection) => (
                    <div key={connection.client.id} className="p-4 rounded-lg border bg-card" data-testid={`company-connection-${connection.client.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <Building2 className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium text-lg" data-testid={`text-company-name-${connection.client.id}`}>
                              {connection.client.name}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {connection.officerRole && (
                                <Badge variant="outline" className="text-xs">
                                  {connection.officerRole}
                                </Badge>
                              )}
                              {connection.isPrimaryContact && (
                                <Badge variant="secondary" className="text-xs">
                                  Primary Contact
                                </Badge>
                              )}
                              {!connection.officerRole && !connection.isPrimaryContact && "Company connection"}
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid={`button-remove-company-connection-${connection.client.id}`}
                          onClick={() => onRemoveCompanyConnection(connection.client.id)}
                          disabled={isUnlinkingCompany}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No companies connected to this individual client.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect this person to companies they are associated with as directors, shareholders, or contacts.
                  </p>
                  <Button 
                    variant="outline"
                    data-testid="button-add-first-company-connection"
                    onClick={onAddCompanyConnection}
                    disabled={isLinkingCompany}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {isLinkingCompany ? "Connecting..." : "Add Company Connection"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
