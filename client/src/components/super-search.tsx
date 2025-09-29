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
        // Navigate to people page with search filter since no person detail page exists yet
        setLocation(`/people?search=${encodeURIComponent(result.title)}`);
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
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200';
      case 'person':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200';
      case 'project':
        return 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200';
      case 'communication':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200';
      case 'service':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCategoryTitle = (type: string) => {
    switch (type) {
      case 'client':
      case 'clients':
        return 'Companies';
      case 'person':
      case 'people':
        return 'People';
      case 'project':
      case 'projects':
        return 'Projects';
      case 'communication':
      case 'communications':
        return 'Communications';
      case 'service':
      case 'services':
        return 'Work';
      default:
        return 'Results';
    }
  };

  const renderResultCategory = (type: keyof SuperSearchResults, results: SearchResult[], columnClass: string = "") => {
    if (results.length === 0) return null;

    return (
      <div key={type} className={`${columnClass} min-h-0`}>
        <div className="px-6 py-4 border-b border-border/20">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getResultColor(type)}`}>
              {getResultIcon(type)}
            </div>
            <span className="text-base font-semibold text-foreground">
              {getCategoryTitle(type)}
            </span>
            <Badge variant="outline" className="text-sm ml-auto px-2 py-1">
              {results.length}
            </Badge>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {results.map((result) => (
            <div
              key={`${result.type}-${result.id}`}
              className="px-6 py-4 hover:bg-accent/50 cursor-pointer border-b border-border/10 last:border-b-0 transition-colors"
              onClick={() => handleResultClick(result)}
              data-testid={`search-result-${result.type}-${result.id}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getResultColor(result.type)} flex-shrink-0`}>
                  {getResultIcon(result.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-base leading-tight">
                    {result.title}
                  </div>
                  {result.subtitle && (
                    <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {result.subtitle}
                    </div>
                  )}
                  {result.description && (
                    <div className="text-sm text-muted-foreground/80 mt-2 leading-relaxed">
                      {result.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
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

      {/* Search Results Mega Menu */}
      {showDropdown && debouncedSearch.length >= 2 && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-popover border border-border rounded-xl shadow-2xl z-50 w-[95vw] max-w-[1200px] min-h-[500px] max-h-[700px]">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <div className="flex items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="text-lg">Searching across all data...</span>
              </div>
            </div>
          ) : hasResults ? (
            <>
              {/* Header */}
              <div className="px-8 py-6 border-b border-border/20 bg-muted/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-foreground">Search Results</h3>
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {searchResults.total} total results
                  </Badge>
                </div>
                <p className="text-base text-muted-foreground mt-2">
                  Results for "{debouncedSearch}"
                </p>
              </div>
              
              {/* 3-Column Layout */}
              <div className="grid grid-cols-3 divide-x divide-border/20 min-h-[400px]">
                {/* Column 1: Clients & Communications */}
                <div className="flex flex-col">
                  {renderResultCategory('clients', searchResults.clients, 'flex-1')}
                  {searchResults.clients.length > 0 && searchResults.communications.length > 0 && (
                    <div className="border-t border-border/20 mx-6"></div>
                  )}
                  {renderResultCategory('communications', searchResults.communications, 'flex-1')}
                </div>
                
                {/* Column 2: Projects & Services */}
                <div className="flex flex-col">
                  {renderResultCategory('projects', searchResults.projects, 'flex-1')}
                  {searchResults.projects.length > 0 && searchResults.services.length > 0 && (
                    <div className="border-t border-border/20 mx-6"></div>
                  )}
                  {renderResultCategory('services', searchResults.services, 'flex-1')}
                </div>
                
                {/* Column 3: People */}
                <div className="flex flex-col">
                  {renderResultCategory('people', searchResults.people, 'flex-1')}
                </div>
              </div>
              
              {/* Footer */}
              <div className="px-8 py-4 border-t border-border/20 bg-muted/10">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Press Enter to search all clients</span>
                  <span>Click any result to navigate</span>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
              <div className="text-muted-foreground">
                <Search className="w-16 h-16 mx-auto mb-6 opacity-40" />
                <div className="text-xl font-medium mb-3">No results found</div>
                <div className="text-base mb-6">No matches for "{debouncedSearch}"</div>
                <div className="text-sm space-y-2 max-w-md">
                  <div>Try searching for:</div>
                  <div className="flex flex-wrap gap-3 justify-center mt-3">
                    <Badge variant="outline" className="text-sm py-1">Client names</Badge>
                    <Badge variant="outline" className="text-sm py-1">People names</Badge>
                    <Badge variant="outline" className="text-sm py-1">Project titles</Badge>
                    <Badge variant="outline" className="text-sm py-1">Services</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}