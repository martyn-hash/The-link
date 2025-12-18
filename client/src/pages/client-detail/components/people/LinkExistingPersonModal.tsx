import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, User as UserIcon, Mail, Phone, Briefcase, Calendar, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";

interface SearchResult {
  id: string;
  fullName: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  dateOfBirth: string | null;
  occupation: string | null;
}

const OFFICER_ROLES = [
  { value: "Director", label: "Director" },
  { value: "Secretary", label: "Secretary" },
  { value: "Shareholder", label: "Shareholder" },
  { value: "Manager", label: "Manager" },
  { value: "Advisor", label: "Advisor" },
  { value: "Consultant", label: "Consultant" },
  { value: "Employee", label: "Employee" },
  { value: "Contractor", label: "Contractor" },
  { value: "Billing Contact", label: "Billing Contact" },
  { value: "Technical Contact", label: "Technical Contact" },
  { value: "Other", label: "Other" },
];

interface LinkExistingPersonModalProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LinkExistingPersonModal({
  clientId,
  isOpen,
  onClose,
  onSuccess,
}: LinkExistingPersonModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<SearchResult | null>(null);
  const [officerRole, setOfficerRole] = useState("");
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setDebouncedQuery("");
      setSelectedPerson(null);
      setOfficerRole("");
      setIsPrimaryContact(false);
    }
  }, [isOpen]);

  const { data: searchResults, isLoading: isSearching } = useQuery<SearchResult[]>({
    queryKey: ['/api/people/search', debouncedQuery, clientId],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedQuery,
        excludeClientId: clientId,
        limit: '20',
      });
      const response = await fetch(`/api/people/search?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const linkPersonMutation = useMutation({
    mutationFn: async (data: { personId: string; officerRole?: string; isPrimaryContact: boolean }) => {
      return await apiRequest("POST", `/api/clients/${clientId}/people/link`, data);
    },
    onSuccess: () => {
      toast({
        title: "Person Linked",
        description: "The person has been successfully connected to this client.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/people`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}`] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      if (error?.message?.includes("already linked")) {
        toast({
          title: "Already Connected",
          description: "This person is already linked to this client.",
          variant: "destructive",
        });
      } else {
        showFriendlyError({
          error,
          fallbackTitle: "Couldn't Link Person",
          fallbackDescription: "Something went wrong while linking this person. Please try again."
        });
      }
    },
  });

  const handleLink = () => {
    if (!selectedPerson) return;
    linkPersonMutation.mutate({
      personId: selectedPerson.id,
      officerRole: officerRole || undefined,
      isPrimaryContact,
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Link Existing Person
          </DialogTitle>
          <DialogDescription>
            Search for an existing person in the system to connect them to this client.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-person"
            />
          </div>

          {selectedPerson ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-lg" data-testid="text-selected-person-name">
                        {selectedPerson.fullName}
                      </h4>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                        {selectedPerson.primaryEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {selectedPerson.primaryEmail}
                          </span>
                        )}
                        {selectedPerson.primaryPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {selectedPerson.primaryPhone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPerson(null)}
                    data-testid="button-change-selection"
                  >
                    Change
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="officer-role">Role (Optional)</Label>
                  <Select value={officerRole} onValueChange={setOfficerRole}>
                    <SelectTrigger id="officer-role" data-testid="select-officer-role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {OFFICER_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox
                    id="primary-contact"
                    checked={isPrimaryContact}
                    onCheckedChange={(checked) => setIsPrimaryContact(checked === true)}
                    data-testid="checkbox-primary-contact"
                  />
                  <Label htmlFor="primary-contact" className="text-sm font-medium cursor-pointer">
                    Set as primary contact
                  </Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={onClose} data-testid="button-cancel-link">
                  Cancel
                </Button>
                <Button
                  onClick={handleLink}
                  disabled={linkPersonMutation.isPending}
                  data-testid="button-confirm-link"
                >
                  {linkPersonMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Link Person
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 max-h-[400px]">
              {debouncedQuery.length < 2 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Enter at least 2 characters to search</p>
                </div>
              ) : isSearching ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground mt-2">Searching...</p>
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => setSelectedPerson(person)}
                      className="w-full p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                      data-testid={`button-select-person-${person.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <UserIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{person.fullName}</h4>
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-0.5">
                            {person.primaryEmail && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{person.primaryEmail}</span>
                              </span>
                            )}
                            {person.occupation && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3 flex-shrink-0" />
                                {person.occupation}
                              </span>
                            )}
                            {person.dateOfBirth && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 flex-shrink-0" />
                                {formatDate(person.dateOfBirth)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No people found matching "{debouncedQuery}"</p>
                  <p className="text-sm mt-1">Try a different search term</p>
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
