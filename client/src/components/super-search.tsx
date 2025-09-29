import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Building2, 
  Users, 
  Plus, 
  FolderOpen, 
  MessageCircle, 
  Settings,
  User,
  Briefcase 
} from "lucide-react";

// Type definitions for search results
interface SearchResult {
  id: string;
  type: 'client' | 'person' | 'project' | 'communication' | 'service';
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface SuperSearchResults {
  clients: SearchResult[];
  people: SearchResult[];
  projects: SearchResult[];
  communications: SearchResult[];
  services: SearchResult[];
  total: number;
}

interface SuperSearchProps {
  placeholder?: string;
  className?: string;
}

export default function SuperSearch({ 
  placeholder = "Search clients, people, projects...",
  className = ""
}: SuperSearchProps) {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [, setLocation] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search for autocomplete
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Fetch search results from super search API
  const { data: searchResults, isLoading } = useQuery<SuperSearchResults>({
    queryKey: ["/api/search", { q: debouncedSearch }],
    enabled: debouncedSearch.length >= 2,
    retry: false,
    staleTime: 30000, // Cache for 30 seconds
  });

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
    setSearchValue(newValue);
    setShowDropdown(newValue.length >= 2);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      // Navigate to clients page with search as fallback
      setLocation(`/clients?search=${encodeURIComponent(searchValue.trim())}`);
      setShowDropdown(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // Navigate to appropriate page based on result type
    switch (result.type) {
      case 'client':
        setLocation(`/clients/${result.id}`);
        break;
      case 'person':
        setLocation(`/people/${result.id}`);
        break;
      case 'project':
        setLocation(`/projects/${result.id}`);
        break;
      case 'communication':
        // Navigate to client page and show communications
        if (result.metadata?.clientName) {
          setLocation(`/clients?search=${encodeURIComponent(result.metadata.clientName)}`);
        }
        break;
      case 'service':
        setLocation(`/services?search=${encodeURIComponent(result.title)}`);
        break;
      default:
        console.warn('Unknown result type:', result.type);
    }
    setShowDropdown(false);
    setSearchValue("");
  };

  const handleFocus = () => {
    if (searchValue.length >= 2) {
      setShowDropdown(true);
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'client':
        return <Building2 className="w-4 h-4" />;
      case 'person':
        return <User className="w-4 h-4" />;
      case 'project':
        return <FolderOpen className="w-4 h-4" />;
      case 'communication':
        return <MessageCircle className="w-4 h-4" />;
      case 'service':
        return <Briefcase className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getResultColor = (type: string) => {
    switch (type) {
      case 'client':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'person':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'project':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'communication':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'service':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCategoryTitle = (type: string) => {
    switch (type) {
      case 'client':
        return 'Clients';
      case 'person':
        return 'People';
      case 'project':
        return 'Projects';
      case 'communication':
        return 'Communications';
      case 'service':
        return 'Services';
      default:
        return 'Results';
    }
  };

  const renderResultCategory = (type: keyof SuperSearchResults, results: SearchResult[]) => {
    if (results.length === 0) return null;

    return (
      <div key={type} className="border-b border-border/50 last:border-b-0">
        <div className="px-3 py-2 bg-muted/50">
          <div className="flex items-center gap-2">
            {getResultIcon(type)}
            <span className="text-sm font-medium text-muted-foreground">
              {getCategoryTitle(type)} ({results.length})
            </span>
          </div>
        </div>
        {results.map((result) => (
          <div
            key={`${result.type}-${result.id}`}
            className="p-3 hover:bg-accent cursor-pointer border-b border-border/50 last:border-b-0"
            onClick={() => handleResultClick(result)}
            data-testid={`search-result-${result.type}-${result.id}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getResultColor(result.type)}`}>
                {getResultIcon(result.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">
                  {result.title}
                </div>
                {result.subtitle && (
                  <div className="text-sm text-muted-foreground truncate">
                    {result.subtitle}
                  </div>
                )}
                {result.description && (
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    {result.description}
                  </div>
                )}
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">
                {result.type}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const hasResults = searchResults && searchResults.total > 0;

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
        className="pl-10"
        data-testid="input-super-search"
      />

      {/* Search Results Dropdown */}
      {showDropdown && debouncedSearch.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Searching across all data...
              </div>
            </div>
          ) : hasResults ? (
            <>
              {renderResultCategory('clients', searchResults.clients)}
              {renderResultCategory('people', searchResults.people)}
              {renderResultCategory('projects', searchResults.projects)}
              {renderResultCategory('communications', searchResults.communications)}
              {renderResultCategory('services', searchResults.services)}
              
              {/* Footer with total count */}
              <div className="p-3 bg-muted/30 text-center">
                <span className="text-xs text-muted-foreground">
                  Showing {searchResults.total} results for "{debouncedSearch}"
                </span>
              </div>
            </>
          ) : (
            <div className="p-4 text-center">
              <div className="text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <div className="text-sm">No results found for "{debouncedSearch}"</div>
                <div className="text-xs mt-1">Try searching for clients, people, projects, or communications</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}