import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  FileText,
  Users,
  Briefcase,
  MessageCircle,
  Clock,
  Files,
  CheckSquare,
  Plus
} from "lucide-react";

interface ClientDetailViewProps {
  clientId: string;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  clientType?: string;
  companyNumber?: string;
  companiesHouseName?: string;
  companyStatus?: string;
  companyType?: string;
  dateOfCreation?: string;
  jurisdiction?: string;
  sicCodes?: string[];
  registeredAddress1?: string;
  registeredAddress2?: string;
  registeredAddress3?: string;
  registeredCountry?: string;
  registeredPostcode?: string;
  accountingReferenceDay?: number;
  accountingReferenceMonth?: number;
  lastAccountsMadeUpTo?: string;
  nextAccountsDue?: string;
  accountsOverdue?: boolean;
  confirmationStatementNextDue?: string;
  confirmationStatementOverdue?: boolean;
  companiesHouseData?: any;
  createdAt?: string;
}

interface ClientPerson {
  id: string;
  person: {
    id: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    telephone?: string;
  };
  relationshipType?: string;
  officerRole?: string;
  appointedOn?: string;
  resignedOn?: string;
  isActive: boolean;
}

export function ClientDetailView({ clientId }: ClientDetailViewProps) {
  // Fetch client data
  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
  });

  // Fetch related people
  const { data: clientPeople, isLoading: peopleLoading } = useQuery<ClientPerson[]>({
    queryKey: ["/api/clients", clientId, "people"],
  });

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading client details...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Client not found</p>
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not available";
    return new Date(dateString).toLocaleDateString();
  };

  const formatAddress = () => {
    const parts = [
      client.registeredAddress1,
      client.registeredAddress2,
      client.registeredAddress3,
      client.registeredCountry,
      client.registeredPostcode
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Not available";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {client.clientType === "company" ? (
          <Building2 className="w-8 h-8 text-primary" />
        ) : (
          <User className="w-8 h-8 text-primary" />
        )}
        <div>
          <h1 className="text-2xl font-bold" data-testid="client-name">
            {client.clientType === "company" ? client.companiesHouseName || client.name : client.name}
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            {client.clientType === "company" && client.companyNumber && (
              <span data-testid="company-number">Company #{client.companyNumber}</span>
            )}
            {client.companyStatus && (
              <Badge variant={client.companyStatus === "active" ? "default" : "secondary"} data-testid="company-status">
                {client.companyStatus}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <FileText className="w-4 h-4 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="services" data-testid="tab-services">
            <Briefcase className="w-4 h-4 mr-1" />
            Services
          </TabsTrigger>
          <TabsTrigger value="projects" data-testid="tab-projects">
            <CheckSquare className="w-4 h-4 mr-1" />
            Open Projects
          </TabsTrigger>
          <TabsTrigger value="communications" data-testid="tab-communications">
            <MessageCircle className="w-4 h-4 mr-1" />
            Communications
          </TabsTrigger>
          <TabsTrigger value="chronology" data-testid="tab-chronology">
            <Clock className="w-4 h-4 mr-1" />
            Chronology
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <Files className="w-4 h-4 mr-1" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <CheckSquare className="w-4 h-4 mr-1" />
            Tasks
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Company/Individual Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {client.clientType === "company" ? (
                  <Building2 className="w-5 h-5" />
                ) : (
                  <User className="w-5 h-5" />
                )}
                {client.clientType === "company" ? "Company Details" : "Individual Details"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.clientType === "company" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Official Name</label>
                      <p className="text-sm" data-testid="detail-company-name">
                        {client.companiesHouseName || "Not available"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Company Type</label>
                      <p className="text-sm" data-testid="detail-company-type">
                        {client.companyType || "Not available"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Jurisdiction</label>
                      <p className="text-sm" data-testid="detail-jurisdiction">
                        {client.jurisdiction || "Not available"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Date of Creation</label>
                      <p className="text-sm" data-testid="detail-creation-date">
                        {formatDate(client.dateOfCreation)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Registered Address</label>
                      <p className="text-sm" data-testid="detail-address">
                        {formatAddress()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Next Accounts Due</label>
                      <div className="flex items-center gap-2">
                        <p className="text-sm" data-testid="detail-accounts-due">
                          {formatDate(client.nextAccountsDue)}
                        </p>
                        {client.accountsOverdue && (
                          <Badge variant="destructive">Overdue</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Next Confirmation Statement</label>
                      <div className="flex items-center gap-2">
                        <p className="text-sm" data-testid="detail-confirmation-due">
                          {formatDate(client.confirmationStatementNextDue)}
                        </p>
                        {client.confirmationStatementOverdue && (
                          <Badge variant="destructive">Overdue</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">SIC Codes</label>
                      <div className="flex flex-wrap gap-1" data-testid="detail-sic-codes">
                        {client.sicCodes && client.sicCodes.length > 0 ? (
                          client.sicCodes.map((code, index) => (
                            <Badge key={index} variant="outline">{code}</Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">None specified</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                    <p className="text-sm" data-testid="detail-individual-name">
                      {client.name}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-sm" data-testid="detail-individual-email">
                      {client.email || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Client Since</label>
                    <p className="text-sm" data-testid="detail-client-since">
                      {formatDate(client.createdAt)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related People Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Related People
                </div>
                <Button size="sm" variant="outline" data-testid="button-add-person">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Person
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {peopleLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading people...</p>
                </div>
              ) : clientPeople && clientPeople.length > 0 ? (
                <div className="space-y-3">
                  {clientPeople.map((clientPerson) => (
                    <div key={clientPerson.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`person-${clientPerson.id}`}>
                      <div className="flex items-center gap-3">
                        <User className="w-8 h-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium" data-testid={`person-name-${clientPerson.id}`}>
                            {clientPerson.person.fullName || `${clientPerson.person.firstName} ${clientPerson.person.lastName}`.trim() || "Unknown Name"}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {clientPerson.officerRole && (
                              <Badge variant="outline" data-testid={`person-role-${clientPerson.id}`}>
                                {clientPerson.officerRole}
                              </Badge>
                            )}
                            {clientPerson.relationshipType && (
                              <span data-testid={`person-relationship-${clientPerson.id}`}>
                                {clientPerson.relationshipType}
                              </span>
                            )}
                            {clientPerson.appointedOn && (
                              <span data-testid={`person-appointed-${clientPerson.id}`}>
                                Since {formatDate(clientPerson.appointedOn)}
                              </span>
                            )}
                          </div>
                          {clientPerson.person.email && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <Mail className="w-3 h-3" />
                              <span data-testid={`person-email-${clientPerson.id}`}>
                                {clientPerson.person.email}
                              </span>
                            </div>
                          )}
                          {clientPerson.person.telephone && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <Phone className="w-3 h-3" />
                              <span data-testid={`person-phone-${clientPerson.id}`}>
                                {clientPerson.person.telephone}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!clientPerson.isActive && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        <Button size="sm" variant="ghost" data-testid={`button-edit-person-${clientPerson.id}`}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No related people added yet</p>
                  <p className="text-sm">Click "Add Person" to add contacts, directors, or other related individuals</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Placeholder tabs */}
        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Services management will be implemented here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle>Open Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Open projects will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications">
          <Card>
            <CardHeader>
              <CardTitle>Communications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Communications history will be shown here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chronology">
          <Card>
            <CardHeader>
              <CardTitle>Chronology</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Client activity chronology will be displayed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Client documents will be managed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Client-related tasks will be shown here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}