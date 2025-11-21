import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  User, 
  FolderOpen, 
  MessageCircle, 
  Search,
  X
} from "lucide-react";

// Entity types we support
export type EntityType = 'client' | 'person' | 'project' | 'message';

// Selected entity interface
export interface SelectedEntity {
  id: string;
  type: EntityType;
  label: string; // Display name
}

// Search result interface (API returns 'communication' which we normalize to 'message')
interface SearchResult {
  id: string;
  type: EntityType | 'communication';
  title: string;
  subtitle?: string;
}

interface EntitySearchResults {
  clients: SearchResult[];
  people: SearchResult[];
  projects: SearchResult[];
  communications: SearchResult[];
}

interface EntitySearchProps {
  placeholder?: string;
  selectedEntities?: SelectedEntity[];
  onSelect: (entity: SelectedEntity) => void;
  onRemove: (entityId: string) => void;
  allowMultiple?: boolean;
  className?: string;
  onSearchStart?: () => void;
  onSearchClear?: () => void;
}

export default function EntitySearch({ 
  placeholder = "Search clients, people, projects, messages...",
  selectedEntities = [],
  onSelect,
  onRemove,
  allowMultiple = true,
  className = "",
  onSearchStart,
  onSearchClear,
}: EntitySearchProps) {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Fetch search results
  const { data: searchResults, isLoading } = useQuery<EntitySearchResults>({
    queryKey: ["/api/search", { q: debouncedSearch }],
    enabled: debouncedSearch.length >= 2,
    retry: false,
    staleTime: 30000,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    const shouldShow = newValue.length >= 2;
    setShowDropdown(shouldShow);
    
    // Notify parent when search starts or clears
    if (shouldShow && newValue.length === 2) {
      onSearchStart?.();
    } else if (newValue.length === 0) {
      onSearchClear?.();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // Normalize entity type (communication -> message for backend compatibility)
    const normalizedType = result.type === 'communication' ? 'message' : result.type;
    
    // Check if already selected
    const alreadySelected = selectedEntities.some(e => e.id === result.id && e.type === normalizedType);
    if (alreadySelected) {
      setShowDropdown(false);
      setSearchValue("");
      return;
    }

    // Create selected entity
    const entity: SelectedEntity = {
      id: result.id,
      type: normalizedType,
      label: result.title
    };

    onSelect(entity);
    
    // Clear search and close dropdown
    setSearchValue("");
    setShowDropdown(false);
    onSearchClear?.();
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
      case 'message':
        return <MessageCircle className="w-4 h-4" />;
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
      case 'message':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCategoryTitle = (type: string) => {
    switch (type) {
      case 'clients':
        return 'Companies';
      case 'people':
        return 'People';
      case 'projects':
        return 'Projects';
      case 'communications':
        return 'Messages';
      default:
        return 'Results';
    }
  };

  const renderResultCategory = (type: keyof EntitySearchResults, results: SearchResult[]) => {
    if (results.length === 0) return null;

    return (
      <div key={type} className="border-b border-border/20 last:border-b-0">
        <div className="px-3 py-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {getCategoryTitle(type)}
            </span>
            <Badge variant="outline" className="text-xs px-1.5">
              {results.length}
            </Badge>
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {results.map((result) => (
            <div
              key={`${result.type}-${result.id}`}
              className="px-3 py-2 hover:bg-accent cursor-pointer border-b border-border/10 last:border-b-0"
              onClick={() => handleResultClick(result)}
              data-testid={`entity-result-${result.type}-${result.id}`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded flex items-center justify-center ${getResultColor(result.type)} flex-shrink-0`}>
                  {getResultIcon(result.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{result.title}</div>
                  {result.subtitle && (
                    <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const allResults = searchResults ? [
    ...searchResults.clients.map(r => ({ ...r, type: 'client' as EntityType })),
    ...searchResults.people.map(r => ({ ...r, type: 'person' as EntityType })),
    ...searchResults.projects.map(r => ({ ...r, type: 'project' as EntityType })),
    ...searchResults.communications.map(r => ({ ...r, type: 'message' as EntityType }))
  ] : [];

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchValue}
          onChange={handleChange}
          onFocus={() => searchValue.length >= 2 && setShowDropdown(true)}
          className="pl-10"
          data-testid="input-entity-search"
        />
      </div>

      {/* Selected Entities */}
      {selectedEntities.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedEntities.map((entity) => (
            <Badge
              key={`${entity.type}-${entity.id}`}
              variant="secondary"
              className="flex items-center gap-1 pl-2 pr-1"
              data-testid={`selected-entity-${entity.type}-${entity.id}`}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center ${getResultColor(entity.type)}`}>
                {getResultIcon(entity.type)}
              </div>
              <span className="text-xs">{entity.label}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => onRemove(entity.id)}
                data-testid={`button-remove-entity-${entity.id}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search Results Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg overflow-auto">
          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          
          {!isLoading && allResults.length === 0 && debouncedSearch.length >= 2 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}
          
          {!isLoading && searchResults && (
            <>
              {renderResultCategory('clients', searchResults.clients)}
              {renderResultCategory('people', searchResults.people)}
              {renderResultCategory('projects', searchResults.projects)}
              {renderResultCategory('communications', searchResults.communications)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
