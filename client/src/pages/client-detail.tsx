import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryFn } from "@/lib/queryClient";
import type { Client } from "@shared/schema";

export default function ClientDetail() {
  const { id } = useParams();

  const { data: client, isLoading, error } = useQuery<Client>({
    queryKey: [`/api/clients/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
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
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Client Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              The client you're looking for could not be found.
            </p>
            <Button 
              onClick={() => window.history.back()}
              data-testid="button-go-back"
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-client-name">
                {client.name}
              </h1>
              <p className="text-muted-foreground flex items-center mt-1">
                {client.companyNumber && (
                  <>
                    <Building2 className="w-4 h-4 mr-1" />
                    Company #{client.companyNumber}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {client.companyStatus && (
                <Badge 
                  variant={client.companyStatus === 'active' ? 'default' : 'secondary'}
                  data-testid="badge-company-status"
                >
                  {client.companyStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-projects">Open Projects</TabsTrigger>
            <TabsTrigger value="communications" data-testid="tab-communications">Communications</TabsTrigger>
            <TabsTrigger value="chronology" data-testid="tab-chronology">Chronology</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Company Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Company Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Basic Information */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                      <p className="font-medium" data-testid="text-company-name">
                        {client.companiesHouseName || client.name}
                      </p>
                    </div>
                    
                    {client.companyNumber && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Company Number</label>
                        <p className="font-medium" data-testid="text-company-number">
                          {client.companyNumber}
                        </p>
                      </div>
                    )}
                    
                    {client.companyType && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Company Type</label>
                        <p className="font-medium" data-testid="text-company-type">
                          {client.companyType}
                        </p>
                      </div>
                    )}
                    
                    {client.dateOfCreation && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Date of Creation</label>
                        <p className="font-medium flex items-center gap-1" data-testid="text-date-creation">
                          <Calendar className="w-4 h-4" />
                          {new Date(client.dateOfCreation).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Address Information */}
                  <div className="space-y-3">
                    {(client.registeredAddress1 || client.registeredPostcode) && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          Registered Address
                        </label>
                        <div className="space-y-1" data-testid="text-company-address">
                          {client.registeredAddress1 && <p>{client.registeredAddress1}</p>}
                          {client.registeredAddress2 && <p>{client.registeredAddress2}</p>}
                          {client.registeredAddress3 && <p>{client.registeredAddress3}</p>}
                          {client.registeredPostcode && <p>{client.registeredPostcode}</p>}
                          {client.registeredCountry && <p>{client.registeredCountry}</p>}
                        </div>
                      </div>
                    )}

                    {client.email && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                        <p className="font-medium" data-testid="text-company-email">
                          {client.email}
                        </p>
                      </div>
                    )}

                  </div>
                </div>

                {client.companyNumber && (
                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`https://find-and-update.company-information.service.gov.uk/company/${client.companyNumber}`, '_blank')}
                      data-testid="button-view-companies-house"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View on Companies House
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Related People Section */}
            <Card>
              <CardHeader>
                <CardTitle>Related People</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8" data-testid="section-related-people">
                  <p className="text-muted-foreground">
                    Related people will be displayed here once they are added to the system.
                  </p>
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
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Services management will be implemented here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Open Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Open projects will be displayed here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Communications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Communication history will be shown here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chronology" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Chronology</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Timeline of events will be displayed here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Client documents will be managed here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Task management will be available here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}