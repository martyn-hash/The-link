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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, PhoneCall, Send, Mail, MessageSquare, FileText, X, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CommunicationFiltersProps, CommunicationFilterType, TimelineItem, DirectionFilterType, SLAStatusFilterType } from "./types";

const FILTER_OPTIONS: { value: CommunicationFilterType; label: string; icon: typeof PhoneCall }[] = [
  { value: 'phone_call', label: 'Calls', icon: PhoneCall },
  { value: 'sms', label: 'SMS', icon: Send },
  { value: 'email', label: 'Emails', icon: Mail },
  { value: 'message_thread', label: 'Messages', icon: MessageSquare },
  { value: 'note', label: 'Notes', icon: FileText },
  { value: 'email_thread', label: 'Email Threads', icon: Mail },
];

const DIRECTION_OPTIONS: { value: DirectionFilterType; label: string; icon: typeof ArrowDownLeft }[] = [
  { value: 'all', label: 'All directions', icon: ArrowDownLeft },
  { value: 'inbound', label: 'Inbound', icon: ArrowDownLeft },
  { value: 'outbound', label: 'Outbound', icon: ArrowUpRight },
];

const SLA_STATUS_OPTIONS: { value: SLAStatusFilterType; label: string; icon: typeof Clock }[] = [
  { value: 'all', label: 'All status', icon: Clock },
  { value: 'pending', label: 'Pending', icon: Clock },
  { value: 'replied', label: 'Replied', icon: CheckCircle2 },
  { value: 'overdue', label: 'Overdue', icon: AlertCircle },
];

function getFilterCount(items: TimelineItem[], type: CommunicationFilterType): number {
  if (type === 'all') return items.length;
  if (type === 'sms') return items.filter(i => i.type === 'sms_sent' || i.type === 'sms_received').length;
  if (type === 'email') return items.filter(i => i.type === 'email_sent' || i.type === 'email_received' || i.kind === 'inbox_email').length;
  return items.filter(i => i.type === type).length;
}

function getDirectionCount(items: TimelineItem[], direction: DirectionFilterType): number {
  if (direction === 'all') return items.length;
  return items.filter(i => {
    if (i.kind === 'inbox_email') {
      return i.direction === direction;
    }
    if (i.kind === 'communication') {
      if (direction === 'inbound') {
        return i.type === 'sms_received' || i.type === 'email_received' || i.type === 'phone_call';
      }
      if (direction === 'outbound') {
        return i.type === 'sms_sent' || i.type === 'email_sent';
      }
    }
    return false;
  }).length;
}

function getSlaStatusCount(items: TimelineItem[], status: SLAStatusFilterType): number {
  if (status === 'all') return items.length;
  return items.filter(i => {
    if (i.kind === 'inbox_email') {
      return i.status === status;
    }
    return false;
  }).length;
}

export function CommunicationFilters({ 
  selectedFilters, 
  onFilterChange, 
  items,
  directionFilter,
  onDirectionChange,
  slaStatusFilter,
  onSlaStatusChange,
  searchQuery,
  onSearchChange
}: CommunicationFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const isAllSelected = selectedFilters.includes('all') || selectedFilters.length === 0;
  const activeTypeFiltersCount = isAllSelected ? 0 : selectedFilters.length;
  const hasDirectionFilter = directionFilter !== 'all';
  const hasSlaFilter = slaStatusFilter !== 'all';
  const totalActiveFilters = activeTypeFiltersCount + (hasDirectionFilter ? 1 : 0) + (hasSlaFilter ? 1 : 0);

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

  const handleClearAllFilters = () => {
    onFilterChange(['all']);
    onDirectionChange('all');
    onSlaStatusChange('all');
    setIsOpen(false);
  };

  const isFilterSelected = (filterType: CommunicationFilterType): boolean => {
    if (filterType === 'all') {
      return isAllSelected;
    }
    return selectedFilters.includes(filterType);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search communications..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 w-[200px]"
          data-testid="input-search-communications"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => onSearchChange('')}
            data-testid="button-clear-search"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            data-testid="button-filter-trigger"
          >
            <Filter className="h-4 w-4" />
            Type
            {activeTypeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {activeTypeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Filter by type</span>
              {activeTypeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onFilterChange(['all'])}
                  data-testid="button-clear-type-filters"
                >
                  Clear
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

      <Select value={directionFilter} onValueChange={(value) => onDirectionChange(value as DirectionFilterType)}>
        <SelectTrigger 
          className="w-[140px] h-9" 
          data-testid="select-direction-filter"
        >
          <SelectValue placeholder="Direction" />
        </SelectTrigger>
        <SelectContent>
          {DIRECTION_OPTIONS.map((option) => {
            const Icon = option.icon;
            const count = getDirectionCount(items, option.value);
            return (
              <SelectItem 
                key={option.value} 
                value={option.value}
                data-testid={`direction-option-${option.value}`}
              >
                <span className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${option.value === 'inbound' ? 'text-blue-500' : option.value === 'outbound' ? 'text-green-500' : ''}`} />
                  {option.label}
                  <span className="text-muted-foreground text-xs">({count})</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <Select value={slaStatusFilter} onValueChange={(value) => onSlaStatusChange(value as SLAStatusFilterType)}>
        <SelectTrigger 
          className="w-[130px] h-9" 
          data-testid="select-sla-filter"
        >
          <SelectValue placeholder="SLA Status" />
        </SelectTrigger>
        <SelectContent>
          {SLA_STATUS_OPTIONS.map((option) => {
            const Icon = option.icon;
            const count = getSlaStatusCount(items, option.value);
            return (
              <SelectItem 
                key={option.value} 
                value={option.value}
                data-testid={`sla-option-${option.value}`}
              >
                <span className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${
                    option.value === 'pending' ? 'text-yellow-500' : 
                    option.value === 'replied' ? 'text-green-500' : 
                    option.value === 'overdue' ? 'text-red-500' : ''
                  }`} />
                  {option.label}
                  <span className="text-muted-foreground text-xs">({count})</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {totalActiveFilters > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-muted-foreground hover:text-foreground"
          onClick={handleClearAllFilters}
          data-testid="button-clear-all-filters"
        >
          <X className="h-4 w-4 mr-1" />
          Clear all
        </Button>
      )}

      {activeTypeFiltersCount > 0 && (
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
