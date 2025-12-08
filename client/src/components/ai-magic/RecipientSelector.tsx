import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Edit2, Loader2, User, AlertCircle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PersonSearchResult {
  id: string;
  type: 'person';
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: {
    clientId?: string;
    clientName?: string;
    primaryEmail?: string;
    primaryPhone?: string;
    phone?: string;
  };
}

export interface PersonSelection {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  telephone?: string;
  clientId: string;
  clientName: string;
}

export interface RecipientSelectorProps {
  matchedPerson: { id: string; firstName: string | null; lastName: string | null; email?: string | null; telephone?: string | null } | null;
  matchedClientName: string;
  matchConfidence: number;
  originalName: string;
  contactType: 'email' | 'mobile';
  onPersonChange: (person: PersonSelection) => void;
}

export function RecipientSelector({
  matchedPerson,
  matchedClientName,
  matchConfidence,
  originalName,
  contactType,
  onPersonChange
}: RecipientSelectorProps) {
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue), 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsSearchMode(false);
        setSearchValue('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: searchResults, isLoading } = useQuery<{ people: PersonSearchResult[] }>({
    queryKey: ['/api/search', { q: debouncedSearch }],
    enabled: debouncedSearch.length >= 2,
  });

  const filteredResults = (searchResults?.people || []).filter(p => {
    if (contactType === 'email') {
      const email = p.metadata?.primaryEmail || p.subtitle;
      return email && email.trim() !== '';
    } else {
      return p.metadata?.primaryPhone && p.metadata.primaryPhone.trim() !== '';
    }
  });

  const handleSelectPerson = (person: PersonSearchResult) => {
    const nameParts = person.title.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    onPersonChange({
      id: person.id,
      firstName,
      lastName,
      email: person.metadata?.primaryEmail || person.subtitle,
      telephone: person.metadata?.primaryPhone,
      clientId: person.metadata?.clientId || '',
      clientName: person.metadata?.clientName || ''
    });
    setIsSearchMode(false);
    setSearchValue('');
  };

  const personName = matchedPerson 
    ? `${matchedPerson.firstName || ''} ${matchedPerson.lastName || ''}`.trim() 
    : '';
  const contactInfo = contactType === 'email' ? matchedPerson?.email : matchedPerson?.telephone;
  
  const hasValidMatch = matchedPerson && (personName || contactInfo);

  if (isSearchMode || !hasValidMatch) {
    return (
      <div ref={containerRef} className="space-y-2">
        {!hasValidMatch && !isSearchMode && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm text-amber-700 dark:text-amber-400">
              Couldn't find "{originalName}". Search below to select the right person.
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={`Search for a person with ${contactType}...`}
              className="h-8 text-sm pl-8"
              autoFocus
              data-testid="input-recipient-search"
            />
          </div>
          {hasValidMatch && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsSearchMode(false);
                setSearchValue('');
              }}
              className="h-8 px-2"
              data-testid="button-cancel-search"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        
        {debouncedSearch.length >= 2 && (
          <div className="bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
            {isLoading && (
              <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Searching...
              </div>
            )}
            {!isLoading && filteredResults.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No people found with {contactType === 'email' ? 'email address' : 'mobile number'}
              </div>
            )}
            {filteredResults.map((person) => (
              <div
                key={person.id}
                className="px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSelectPerson(person)}
                data-testid={`search-result-${person.id}`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {person.title}
                      {person.metadata?.clientName && (
                        <span className="text-muted-foreground font-normal"> - {person.metadata.clientName}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {contactType === 'email' && (person.metadata?.primaryEmail || person.subtitle) && (
                        <span className="text-sky-600 dark:text-sky-400">{person.metadata?.primaryEmail || person.subtitle}</span>
                      )}
                      {contactType === 'mobile' && person.metadata?.primaryPhone && (
                        <span className="text-emerald-600 dark:text-emerald-400">{person.metadata.primaryPhone}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground text-sm">To:</span>
            <span className="font-medium text-sm">{personName}</span>
            {contactInfo && (
              <span className="text-xs text-muted-foreground">({contactInfo})</span>
            )}
            {!matchedPerson && (
              <span className="text-xs text-amber-600 font-medium">(no match found)</span>
            )}
          </div>
          {matchedClientName && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3" />
              {matchedClientName}
            </div>
          )}
          {matchedPerson && matchConfidence > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Match confidence: {Math.round(matchConfidence)}%
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsSearchMode(true)}
          className="h-7 px-2 text-xs shrink-0"
          data-testid="button-change-recipient"
        >
          <Edit2 className="w-3 h-3 mr-1" />
          Change
        </Button>
      </div>
    </div>
  );
}
