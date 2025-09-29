import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { type Person } from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Search, User, Mail, Plus, Edit, Building2 } from "lucide-react";
import { format } from "date-fns";

export default function People() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  // Parse URL search parameter on mount and location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [location]);

  const { data: people, isLoading: peopleLoading, error } = useQuery<Person[]>({
    queryKey: ["/api/people"],
    enabled: isAuthenticated && !!user,
    retry: false,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Handle query errors
  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [error, toast]);

  // Filter people based on search term
  const filteredPeople = people?.filter(person =>
    person.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (person.email && person.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (person.primaryEmail && person.primaryEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  // Handle view person (for card clicks) - disabled for now since no detail page exists
  const handleViewPerson = (person: Person) => {
    // TODO: Navigate to person detail view when implemented
    console.log("Person card clicked:", person.fullName || person.id);
  };

  // Handle edit person - disabled for now since no detail page exists
  const handleEditPerson = (person: Person) => {
    // TODO: Navigate to person edit view when implemented
    console.log("Edit person clicked:", person.fullName || person.id);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Access control - only admins and managers can access people management
  if (!user.isAdmin && !user.canSeeAdminMenu) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin or manager privileges to access people management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">People</h1>
                <p className="text-muted-foreground">Manage contacts and individuals</p>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search people..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10"
                data-testid="input-search-people"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {peopleLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Unable to load people</h3>
              <p className="text-muted-foreground text-center max-w-md">
                There was an issue loading the people list. Please try refreshing the page or contact support if the problem persists.
              </p>
            </div>
          ) : filteredPeople.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              {searchTerm ? (
                <>
                  <Search className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-search-results">No people found</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    No people match your search for "{searchTerm}". Try adjusting your search terms.
                  </p>
                </>
              ) : (
                <>
                  <User className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2" data-testid="text-no-people">No people yet</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-4">
                    There are no people in the system yet. People will appear here as they are added to the system.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPeople.map((person) => (
                <Card 
                  key={person.id} 
                  className="hover:shadow-md transition-shadow group cursor-pointer" 
                  onClick={() => handleViewPerson(person)}
                  data-testid={`card-person-${person.id}`}
                >
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate" data-testid={`text-person-name-${person.id}`}>
                          {person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unnamed Person'}
                        </CardTitle>
                        {(person.email || person.primaryEmail) && (
                          <CardDescription className="flex items-center mt-1">
                            <Mail className="w-3 h-3 mr-1" />
                            <span className="truncate" data-testid={`text-person-email-${person.id}`}>
                              {person.email || person.primaryEmail}
                            </span>
                          </CardDescription>
                        )}
                      </div>
                      {user?.isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPerson(person);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-edit-person-${person.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {person.occupation && (
                        <p data-testid={`text-person-occupation-${person.id}`}>
                          {person.occupation}
                        </p>
                      )}
                      <p data-testid={`text-person-created-${person.id}`}>
                        Created: {person.createdAt ? format(new Date(person.createdAt), "MMM d, yyyy") : "Unknown"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}