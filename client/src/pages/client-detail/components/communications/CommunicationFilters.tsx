import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, PhoneCall, Send, Mail, MessageSquare, FileText, X } from "lucide-react";
import type { CommunicationFiltersProps, CommunicationFilterType, TimelineItem } from "./types";

const FILTER_OPTIONS: { value: CommunicationFilterType; label: string; icon: typeof PhoneCall }[] = [
  { value: 'phone_call', label: 'Calls', icon: PhoneCall },
  { value: 'sms', label: 'SMS', icon: Send },
  { value: 'email', label: 'Emails', icon: Mail },
  { value: 'message_thread', label: 'Messages', icon: MessageSquare },
  { value: 'note', label: 'Notes', icon: FileText },
  { value: 'email_thread', label: 'Email Threads', icon: Mail },
];

function getFilterCount(items: TimelineItem[], type: CommunicationFilterType): number {
  if (type === 'all') return items.length;
  if (type === 'sms') return items.filter(i => i.type === 'sms_sent' || i.type === 'sms_received').length;
  if (type === 'email') return items.filter(i => i.type === 'email_sent' || i.type === 'email_received').length;
  return items.filter(i => i.type === type).length;
}

export function CommunicationFilters({ selectedFilters, onFilterChange, items }: CommunicationFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const isAllSelected = selectedFilters.includes('all') || selectedFilters.length === 0;
  const activeFiltersCount = isAllSelected ? 0 : selectedFilters.length;

  const handleToggleFilter = (filterType: CommunicationFilterType) => {
    if (filterType === 'all') {
      onFilterChange(['all']);
      return;
    }

    let newFilters = [...selectedFilters].filter(f => f !== 'all');
    
    if (newFilters.includes(filterType)) {
      newFilters = newFilters.filter(f => f !== filterType);
    } else {
      newFilters.push(filterType);
    }

    if (newFilters.length === 0) {
      onFilterChange(['all']);
    } else {
      onFilterChange(newFilters as CommunicationFilterType[]);
    }
  };

  const handleClearFilters = () => {
    onFilterChange(['all']);
    setIsOpen(false);
  };

  const isFilterSelected = (filterType: CommunicationFilterType): boolean => {
    if (filterType === 'all') {
      return isAllSelected;
    }
    return selectedFilters.includes(filterType);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            data-testid="button-filter-trigger"
          >
            <Filter className="h-4 w-4" />
            Filter
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Filter by type</span>
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleClearFilters}
                  data-testid="button-clear-filters"
                >
                  Clear all
                </Button>
              )}
            </div>
          </div>
          <div className="p-2 space-y-1">
            <div
              className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted cursor-pointer"
              onClick={() => handleToggleFilter('all')}
              data-testid="filter-option-all"
            >
              <Checkbox
                id="filter-all"
                checked={isAllSelected}
                onCheckedChange={() => handleToggleFilter('all')}
              />
              <Label
                htmlFor="filter-all"
                className="flex-1 cursor-pointer text-sm font-normal flex items-center justify-between"
              >
                <span>All types</span>
                <span className="text-muted-foreground text-xs">{items.length}</span>
              </Label>
            </div>
            
            <div className="h-px bg-border my-2" />
            
            {FILTER_OPTIONS.map((option) => {
              const Icon = option.icon;
              const count = getFilterCount(items, option.value);
              
              return (
                <div
                  key={option.value}
                  className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                  onClick={() => handleToggleFilter(option.value)}
                  data-testid={`filter-option-${option.value}`}
                >
                  <Checkbox
                    id={`filter-${option.value}`}
                    checked={isFilterSelected(option.value)}
                    onCheckedChange={() => handleToggleFilter(option.value)}
                  />
                  <Label
                    htmlFor={`filter-${option.value}`}
                    className="flex-1 cursor-pointer text-sm font-normal flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </span>
                    <span className="text-muted-foreground text-xs">{count}</span>
                  </Label>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedFilters.filter(f => f !== 'all').map((filter) => {
            const option = FILTER_OPTIONS.find(o => o.value === filter);
            if (!option) return null;
            const Icon = option.icon;
            
            return (
              <Badge
                key={filter}
                variant="secondary"
                className="gap-1 pr-1"
                data-testid={`badge-filter-${filter}`}
              >
                <Icon className="h-3 w-3" />
                {option.label}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => handleToggleFilter(filter)}
                  data-testid={`button-remove-filter-${filter}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
