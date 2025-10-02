import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Building2, 
  Users, 
  Plus, 
  FolderOpen, 
  MessageCircle, 
  Settings,
  User,
  Briefcase,
  X 
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CompaniesHouseClientModal } from "@/components/companies-house-client-modal";

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
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function SuperSearch({ 
  placeholder = "Search clients, people, projects...",
  className = "",
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange
}: SuperSearchProps) {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [internalShowDropdown, setInternalShowDropdown] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [, setLocation] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Use external control if provided (for mobile modal), otherwise use internal state
  const showDropdown = externalIsOpen !== undefined ? externalIsOpen : internalShowDropdown;
  const setShowDropdown = externalOnOpenChange !== undefined ? externalOnOpenChange : setInternalShowDropdown;

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

  // Handle click outside to close dropdown (desktop only)
  useEffect(() => {
    // Don't handle click outside on mobile - Dialog component handles it
    if (isMobile) return;
    
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    
    // Only auto-show/hide dropdown on desktop based on character count
    // On mobile, the modal stays open until explicitly closed
    if (!isMobile) {
      setShowDropdown(newValue.length >= 2);
    }
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
    
    // Close dropdown/modal and reset state
    setShowDropdown(false);
    setSearchValue("");
    setActiveTab("all");
  };

  const handleFocus = () => {
    // Only auto-show dropdown on desktop when focused
    // Mobile uses explicit Dialog control
    if (!isMobile && searchValue.length >= 2) {
      setShowDropdown(true);
    }
  };

  const handleAddClient = () => {
    setShowClientModal(true);
    setShowDropdown(false); // Close search dropdown/modal when opening client modal
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
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border/20">
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center ${getResultColor(type)}`}>
              {getResultIcon(type)}
            </div>
            <span className="text-sm md:text-base font-semibold text-foreground">
              {getCategoryTitle(type)}
            </span>
            <Badge variant="outline" className="text-xs md:text-sm ml-auto px-2 py-1">
              {results.length}
            </Badge>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {results.map((result) => (
            <div
              key={`${result.type}-${result.id}`}
              className="px-4 md:px-6 py-3 md:py-4 hover:bg-accent/50 active:bg-accent cursor-pointer border-b border-border/10 last:border-b-0 transition-colors min-h-[60px]"
              onClick={() => handleResultClick(result)}
              data-testid={`search-result-${result.type}-${result.id}`}
            >
              <div className="flex items-start gap-3 md:gap-4">
                <div className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center ${getResultColor(result.type)} flex-shrink-0`}>
                  {getResultIcon(result.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm md:text-base leading-tight">
                    {result.title}
                  </div>
                  {result.subtitle && (
                    <div className="text-xs md:text-sm text-muted-foreground mt-1 leading-relaxed">
                      {result.subtitle}
                    </div>
                  )}
                  {result.description && (
                    <div className="text-xs md:text-sm text-muted-foreground/80 mt-1 md:mt-2 leading-relaxed">
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

  // Mobile-specific rendering for tabs
  const renderMobileResults = () => {
    if (!searchResults) return null;

    const allResults = [
      ...searchResults.clients,
      ...searchResults.people,
      ...searchResults.projects,
      ...searchResults.communications,
      ...searchResults.services,
    ];

    const tabs = [
      { value: "all", label: "All", count: searchResults.total, results: allResults },
      { value: "clients", label: "Companies", count: searchResults.clients.length, results: searchResults.clients },
      { value: "people", label: "People", count: searchResults.people.length, results: searchResults.people },
      { value: "projects", label: "Projects", count: searchResults.projects.length, results: searchResults.projects },
      { value: "services", label: "Work", count: searchResults.services.length, results: searchResults.services },
      { value: "communications", label: "Comms", count: searchResults.communications.length, results: searchResults.communications },
    ];

    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="grid grid-cols-6 w-full rounded-none border-b h-auto p-0">
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              data-testid={`tab-${tab.value}`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-medium">{tab.label}</span>
                {tab.count > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 min-w-[1rem]">
                    {tab.count}
                  </Badge>
                )}
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="flex-1 overflow-y-auto m-0">
            {tab.results.length > 0 ? (
              <div className="space-y-0">
                {tab.results.map(result => (
                  <div
                    key={`${result.type}-${result.id}`}
                    className="px-4 py-4 hover:bg-accent/50 active:bg-accent cursor-pointer border-b border-border/10 last:border-b-0 transition-colors min-h-[70px]"
                    onClick={() => handleResultClick(result)}
                    data-testid={`mobile-search-result-${result.type}-${result.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getResultColor(result.type)} flex-shrink-0`}>
                        {getResultIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground text-sm leading-tight">
                          {result.title}
                        </div>
                        {result.subtitle && (
                          <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                            {result.subtitle}
                          </div>
                        )}
                        {result.description && (
                          <div className="text-xs text-muted-foreground/80 mt-1 leading-relaxed line-clamp-2">
                            {result.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Search className="w-12 h-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No {tab.label.toLowerCase()} found</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    );
  };

  const hasResults = searchResults && searchResults.total > 0;

  // Mobile Full-Screen Modal
  if (isMobile) {
    return (
      <>
        <Dialog open={showDropdown} onOpenChange={setShowDropdown}>
          <DialogContent className="p-0 max-w-full w-full h-[100dvh] max-h-[100dvh] m-0 rounded-none flex flex-col">
            {/* Mobile Search Header */}
            <div className="flex items-center gap-3 p-4 border-b sticky top-0 bg-background z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDropdown(false)}
                className="h-9 w-9"
                data-testid="button-mobile-search-close"
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder={placeholder}
                  value={searchValue}
                  onChange={handleChange}
                  onKeyPress={handleKeyPress}
                  autoFocus
                  className="pl-10 pr-3 h-10"
                  data-testid="input-mobile-super-search"
                />
              </div>
              <Button
                variant="default"
                size="icon"
                onClick={handleAddClient}
                className="h-9 w-9 bg-blue-600 hover:bg-blue-700"
                data-testid="button-mobile-add-client"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Mobile Results */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                    <span className="text-sm text-muted-foreground">Searching...</span>
                  </div>
                </div>
              ) : debouncedSearch.length < 2 ? (
                <div className="flex-1 flex items-center justify-center p-8 text-center">
                  <div>
                    <Search className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Start typing to search</p>
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                      <Badge variant="outline" className="text-xs">Companies</Badge>
                      <Badge variant="outline" className="text-xs">People</Badge>
                      <Badge variant="outline" className="text-xs">Projects</Badge>
                    </div>
                  </div>
                </div>
              ) : hasResults ? (
                renderMobileResults()
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 text-center">
                  <div>
                    <Search className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                    <div className="text-base font-medium mb-2">No results found</div>
                    <div className="text-sm text-muted-foreground">Try a different search term</div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <CompaniesHouseClientModal
          open={showClientModal}
          onOpenChange={setShowClientModal}
        />
      </>
    );
  }

  // Desktop Dropdown Menu
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
        data-testid="input-super-search"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddClient}
        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 border-blue-600"
        data-testid="button-add-client"
        title="Add new client"
      >
        <Plus className="w-4 h-4 text-white" />
      </Button>

      {/* Desktop Search Results Mega Menu */}
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
              
              {/* 3-Column Layout - Desktop Only */}
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/20 min-h-[400px]">
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

      {/* Client Creation Modal */}
      <CompaniesHouseClientModal
        open={showClientModal}
        onOpenChange={setShowClientModal}
      />
    </div>
  );
}