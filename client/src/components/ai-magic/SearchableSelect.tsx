import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  suggestedName?: string;
  icon?: JSX.Element;
  testId?: string;
}

export function SearchableSelect({ 
  value, 
  onValueChange, 
  options, 
  placeholder, 
  suggestedName,
  icon,
  testId 
}: SearchableSelectProps) {
  const [searchValue, setSearchValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue), 200);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = debouncedSearch.length >= 1
    ? options.filter(o => o.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : options.slice(0, 10);

  const selectedOption = options.find(o => o.id === value);
  const displayValue = selectedOption?.name || (suggestedName ? `${suggestedName} (type to search)` : '');

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {icon && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <Input
          value={showDropdown ? searchValue : displayValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            if (!showDropdown) setShowDropdown(true);
          }}
          onFocus={() => {
            setShowDropdown(true);
            setSearchValue('');
          }}
          placeholder={placeholder}
          className={cn("h-8 text-sm", icon && "pl-8")}
          data-testid={testId}
        />
      </div>
      {showDropdown && (
        <div className="absolute z-[100] mt-1 w-full max-h-48 overflow-auto bg-popover border border-border rounded-md shadow-lg">
          <div
            className="px-3 py-2 text-sm cursor-pointer hover:bg-accent text-muted-foreground"
            onClick={() => {
              onValueChange('');
              setShowDropdown(false);
              setSearchValue('');
            }}
          >
            None
          </div>
          {filteredOptions.length === 0 && debouncedSearch.length >= 1 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches found</div>
          )}
          {filteredOptions.map((option) => (
            <div
              key={option.id}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer hover:bg-accent",
                option.id === value && "bg-accent"
              )}
              onClick={() => {
                onValueChange(option.id);
                setShowDropdown(false);
                setSearchValue('');
              }}
            >
              {option.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
