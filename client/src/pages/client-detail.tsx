import { useParams } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, ExternalLink, Plus, Phone, Mail, User, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryFn } from "@/lib/queryClient";
import type { Client, Person, ClientPerson } from "@shared/schema";

type ClientPersonWithPerson = ClientPerson & { person: Person };

interface PersonCardProps {
  clientPerson: ClientPersonWithPerson;
  selectedPersonId: string | null;
  onSelect: () => void;
}

function PersonCard({ clientPerson, selectedPersonId, onSelect }: PersonCardProps) {
  const isSelected = selectedPersonId === clientPerson.person.id;
  
  return (
    <div 
      className={`cursor-pointer p-4 rounded-lg border transition-colors ${
        isSelected 
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'bg-card hover:bg-accent/50 border-border'
      }`}
      onClick={onSelect}
      data-testid={`person-${clientPerson.person.id}`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-medium text-foreground truncate" data-testid={`text-person-name-${clientPerson.person.id}`}>
                {clientPerson.person.fullName}
              </h4>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {clientPerson.officerRole && (
                <Badge variant="secondary" className="text-xs" data-testid={`badge-role-${clientPerson.person.id}`}>
                  {clientPerson.officerRole}
                </Badge>
              )}
              {clientPerson.isPrimaryContact && (
                <Badge variant="default" className="text-xs" data-testid={`badge-primary-${clientPerson.person.id}`}>
                  Primary Contact
                </Badge>
              )}
            </div>
            {(clientPerson.person.nationality || clientPerson.person.occupation) && (
              <p className="text-sm text-muted-foreground truncate">
                {[clientPerson.person.nationality, clientPerson.person.occupation]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonDetailView({ clientPerson }: { clientPerson: ClientPersonWithPerson }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold" data-testid={`detail-person-name-${clientPerson.person.id}`}>
            {clientPerson.person.fullName}
          </h3>
          {clientPerson.officerRole && (
            <Badge variant="secondary" data-testid={`detail-badge-role-${clientPerson.person.id}`}>
              {clientPerson.officerRole}
            </Badge>
          )}
          {clientPerson.isPrimaryContact && (
            <Badge variant="default" data-testid={`detail-badge-primary-${clientPerson.person.id}`}>
              Primary Contact
            </Badge>
          )}
        </div>
        {(clientPerson.person.nationality || clientPerson.person.occupation) && (
          <p className="text-sm text-muted-foreground">
            {[clientPerson.person.nationality, clientPerson.person.occupation]
              .filter(Boolean)
              .join(' • ')}
          </p>
        )}
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <h4 className="font-medium text-foreground">Contact Information</h4>
        
        <div className="grid gap-4">
          {/* Email */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">Not available</p>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
            <Phone className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Phone</p>
              <p className="text-sm text-muted-foreground">Not available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Address Information */}
      {clientPerson.person.addressLine1 && (
        <div className="space-y-4">
          <h4 className="font-medium text-foreground">Address</h4>
          <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card">
            <MapPin className="w-5 h-5 mt-0.5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm">
                {[
                  clientPerson.person.addressLine1,
                  clientPerson.person.addressLine2,
                  clientPerson.person.locality,
                  clientPerson.person.postalCode
                ].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Personal Information */}
      <div className="space-y-4">
        <h4 className="font-medium text-foreground">Personal Information</h4>
        
        <div className="grid gap-4">
          {clientPerson.person.dateOfBirth && (
            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Date of Birth</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(clientPerson.person.dateOfBirth).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {clientPerson.person.nationality && (
            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
              <User className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Nationality</p>
                <p className="text-sm text-muted-foreground">{clientPerson.person.nationality}</p>
              </div>
            </div>
          )}

          {clientPerson.person.occupation && (
            <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Occupation</p>
                <p className="text-sm text-muted-foreground">{clientPerson.person.occupation}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Communications Placeholder */}
      <div className="space-y-4">
        <h4 className="font-medium text-foreground">Recent Communications</h4>
        <div className="p-4 rounded-lg border bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">No recent communications</p>
          <p className="text-xs text-muted-foreground mt-1">Communication history will appear here</p>
        </div>
      </div>
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: client, isLoading, error } = useQuery<Client>({
    queryKey: [`/api/clients/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });

  // Fetch related people/directors
  const { data: relatedPeople, isLoading: peopleLoading, error: peopleError } = useQuery<ClientPersonWithPerson[]>({
    queryKey: [`/api/clients/${id}/people`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id && !!client,
    retry: 1, // Retry once on failure
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-6 py-4">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="container mx-auto p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Client Not Found</h1>
          <p className="text-muted-foreground">The client you're looking for doesn't exist or you don't have permission to view it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
              <p className="text-muted-foreground">
                {client.companyNumber && `Company No: ${client.companyNumber} • `}
                {client.email || "No email on file"}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="company">Company Info</TabsTrigger>
            <TabsTrigger value="directors">Related People</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="chronology">Chronology</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Client Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Client Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Name</p>
                    <p className="font-medium">{client.name}</p>
                  </div>
                  {client.companyNumber && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Company Number</p>
                      <p className="font-medium">{client.companyNumber}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-500">Email</p>
                    <p className="font-medium">{client.email || "Not provided"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Address */}
              {client.registeredAddress1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1">
                      <p>{client.registeredAddress1}</p>
                      {client.registeredAddress2 && <p>{client.registeredAddress2}</p>}
                      {client.registeredPostcode && <p>{client.registeredPostcode}</p>}
                      {client.registeredCountry && <p>{client.registeredCountry}</p>}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Basic Information</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Company Name</p>
                        <p>{client.name}</p>
                      </div>
                      {client.companyNumber && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">Company Number</p>
                          <p>{client.companyNumber}</p>
                        </div>
                      )}
                      {client.companyStatus && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">Status</p>
                          <Badge variant={client.companyStatus === 'active' ? 'default' : 'secondary'}>
                            {client.companyStatus}
                          </Badge>
                        </div>
                      )}
                      {client.companyType && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">Company Type</p>
                          <p>{client.companyType}</p>
                        </div>
                      )}
                      {client.dateOfIncorporation && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">Date of Incorporation</p>
                          <p>{new Date(client.dateOfIncorporation).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {client.addressLine1 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Registered Address</h4>
                      <div className="text-sm space-y-1">
                        <p>{client.addressLine1}</p>
                        {client.addressLine2 && <p>{client.addressLine2}</p>}
                        <p>
                          {[client.locality, client.postalCode].filter(Boolean).join(', ')}
                        </p>
                        {client.country && <p>{client.country}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="directors" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Related People</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    data-testid="button-add-person"
                    onClick={() => {
                      // TODO: Implement add person modal/form
                      alert('Add person functionality coming soon!');
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
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
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Person Cards */}
                      <div className="lg:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {relatedPeople.map((clientPerson) => (
                            <PersonCard 
                              key={clientPerson.id}
                              clientPerson={clientPerson}
                              selectedPersonId={selectedPersonId}
                              onSelect={() => setSelectedPersonId(
                                selectedPersonId === clientPerson.person.id ? null : clientPerson.person.id
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* Person Detail View */}
                      <div className="lg:col-span-1">
                        {selectedPersonId ? (
                          <Card className="sticky top-4">
                            <CardHeader>
                              <CardTitle className="text-base">Person Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <PersonDetailView 
                                clientPerson={relatedPeople.find(p => p.person.id === selectedPersonId)!}
                              />
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="sticky top-4">
                            <CardContent className="pt-6">
                              <div className="text-center py-8">
                                <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                <p className="text-muted-foreground">Select a person to view details</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Click on any person card to see their full information
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Services information will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Communications</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Communication history will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Task management will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chronology" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Chronology</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Client chronology will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}