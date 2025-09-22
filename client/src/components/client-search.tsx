import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Building2, Users, Plus } from "lucide-react";
import { type Client } from "@shared/schema";
import { CompaniesHouseClientModal } from "@/components/companies-house-client-modal";

interface ClientSearchProps {
  // For local search on clients page
  value?: string;
  onChange?: (value: string) => void;
  
  // For global search in navigation
  isGlobal?: boolean;
  placeholder?: string;
  className?: string;
}

export default function ClientSearch({ 
  value, 
  onChange, 
  isGlobal = false, 
  placeholder = "Search clients...",
  className = ""
}: ClientSearchProps) {
  const [localValue, setLocalValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [, setLocation] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const searchValue = isGlobal ? localValue : (value || "");

  // Debounce search for autocomplete
  useEffect(() => {
    if (!isGlobal) return;
    
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, isGlobal]);

  // Fetch clients for autocomplete (only when global and has search term)
  // Server-side filtering is now handled by the API endpoint
  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients", { search: debouncedSearch }],
    enabled: isGlobal && debouncedSearch.length >= 2,
    retry: false,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Server returns filtered results, limit to 5 for display
  const filteredClients = clients?.slice(0, 5) || [];

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    if (isGlobal) {
      setLocalValue(newValue);
      setShowDropdown(newValue.length >= 2);
    } else if (onChange) {
      onChange(newValue);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isGlobal && searchValue.trim()) {
      // Navigate to clients page with search - we'll handle this via URL params later
      setLocation(`/clients?search=${encodeURIComponent(searchValue.trim())}`);
      setShowDropdown(false);
    }
  };

  const handleClientClick = (clientId: string) => {
    setLocation(`/clients/${clientId}`);
    setShowDropdown(false);
    setLocalValue("");
  };

  const handleViewAllClients = () => {
    if (searchValue.trim()) {
      setLocation(`/clients?search=${encodeURIComponent(searchValue.trim())}`);
    } else {
      setLocation('/clients');
    }
    setShowDropdown(false);
    setLocalValue("");
  };

  const handleFocus = () => {
    if (isGlobal && searchValue.length >= 2) {
      setShowDropdown(true);
    }
  };

  const handleAddClient = () => {
    setShowClientModal(true);
  };

  const handleClientCreated = () => {
    // Invalidate clients cache to refresh search results
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    setShowClientModal(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={searchValue}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        onFocus={handleFocus}
        className="pl-10 pr-12"
        data-testid={isGlobal ? "input-global-search-clients" : "input-search-clients"}
      />
      
      {/* Add Client Button - only show for global search */}
      {isGlobal && (
        <Button
          onClick={handleAddClient}
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
          data-testid="button-add-client"
        >
          <Plus className="w-4 h-4 text-white" />
        </Button>
      )}

      {/* Autocomplete Dropdown - only show for global search */}
      {isGlobal && showDropdown && debouncedSearch.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md z-50 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-center text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Searching...
              </div>
            </div>
          ) : filteredClients.length > 0 ? (
            <>
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="p-3 hover:bg-accent cursor-pointer border-b border-border/50 last:border-b-0"
                  onClick={() => handleClientClick(client.id)}
                  data-testid={`autocomplete-client-${client.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {client.name}
                      </div>
                      {client.email && (
                        <div className="text-xs text-muted-foreground truncate">
                          {client.email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div
                className="p-3 hover:bg-accent cursor-pointer border-t border-border/50 text-primary"
                onClick={handleViewAllClients}
                data-testid="autocomplete-view-all-clients"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">View all clients</span>
                </div>
              </div>
            </>
          ) : (
            <div className="p-3">
              <div
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handleViewAllClients}
                data-testid="autocomplete-no-results-view-all"
              >
                <Users className="w-4 h-4" />
                <span className="text-sm">No clients found. View all clients</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Companies House Client Modal for Creation */}
      {isGlobal && (
        <CompaniesHouseClientModal
          open={showClientModal}
          onOpenChange={setShowClientModal}
          client={null}
          onSuccess={handleClientCreated}
        />
      )}
    </div>
  );
}