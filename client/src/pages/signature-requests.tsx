import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSignature, Check, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import TopNavigation from "@/components/top-navigation";
import BottomNav from "@/components/bottom-nav";

export default function SignatureRequestsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [_location, setLocation] = useLocation();

  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ['/api/signature-requests'],
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0A7BBF]/5 via-white to-[#76CA23]/5 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <TopNavigation />
      
      <main className="flex-1 container mx-auto px-4 py-6 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="w-6 h-6" />
            E-Signature Requests
          </h1>
          <p className="text-muted-foreground mt-1">
            View all signature requests across clients. Create new requests from individual client pages.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : !requests || requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileSignature className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No signature requests yet</h3>
              <p className="text-muted-foreground">
                Create signature requests from individual client pages to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {requests.map((item: any) => {
              const request = item.signatureRequest;
              const client = item.client;
              const creator = item.createdByPerson;

              return (
                <Card 
                  key={request.id} 
                  className={client?.id ? "hover:shadow-md transition-shadow cursor-pointer" : ""}
                  onClick={() => client?.id && setLocation(`/clients/${client.id}`)}
                  data-testid={`card-signature-request-${request.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{request.title || "Untitled Document"}</h3>
                          <Badge
                            variant={
                              request.status === 'completed' ? 'default' :
                              request.status === 'partially_signed' ? 'secondary' :
                              request.status === 'pending' ? 'outline' :
                              'destructive'
                            }
                            data-testid={`badge-status-${request.id}`}
                          >
                            {request.status === 'completed' && <Check className="w-3 h-3 mr-1" />}
                            {request.status === 'partially_signed' ? 'Partially Signed' :
                             request.status === 'pending' ? 'Pending' :
                             request.status === 'cancelled' ? 'Cancelled' :
                             request.status}
                          </Badge>
                        </div>

                        {client ? (
                          <div className="text-sm text-muted-foreground">
                            Client: <span className="font-medium">{client.companyName}</span>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground italic">
                            Client not found
                          </div>
                        )}

                        {request.message && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {request.message}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {request.createdAt ? (
                              <>Created {format(new Date(request.createdAt), 'MMM d, yyyy')}</>
                            ) : (
                              <>Created recently</>
                            )}
                          </span>
                          {creator && (
                            <span>
                              by {creator.fullName}
                            </span>
                          )}
                        </div>
                      </div>

                      {client?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/clients/${client.id}`);
                          }}
                          data-testid={`button-view-${request.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav onSearchClick={() => setLocation("/search")} />
    </div>
  );
}
