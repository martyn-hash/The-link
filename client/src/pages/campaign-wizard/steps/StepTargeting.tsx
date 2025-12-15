import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { 
  Target, 
  Plus, 
  X, 
  Loader2, 
  Users, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Building2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { WizardState, FilterGroup, Filter } from '../CampaignWizard';

interface StepTargetingProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState> | ((prev: WizardState) => Partial<WizardState>)) => void;
  campaignId: string | null;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

const OPERATOR_LABELS: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  in: 'is one of',
  not_in: 'is not one of',
  contains: 'contains',
  greater_than: 'is greater than',
  less_than: 'is less than',
  between: 'is between',
  is_true: 'is true',
  is_false: 'is false',
  within_days: 'is within',
  before: 'is before',
  after: 'is after',
};

export function StepTargeting({ state, updateState, campaignId }: StepTargetingProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [previewPage, setPreviewPage] = useState(0);

  const { data: availableFilters, isLoading: loadingFilters } = useQuery<any[]>({
    queryKey: ['/api/campaign-targeting/available-filters'],
  });

  const { data: previewData, isLoading: loadingPreview, refetch: refetchPreview } = useQuery({
    queryKey: ['/api/campaigns', campaignId, 'targeting', 'preview', previewPage],
    queryFn: async () => {
      if (!campaignId) return null;
      const res = await fetch(`/api/campaigns/${campaignId}/targeting/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ limit: 10, offset: previewPage * 10 }),
      });
      if (!res.ok) throw new Error('Failed to load preview');
      return res.json();
    },
    enabled: !!campaignId && state.targeting.filterGroups.length > 0,
  });

  const saveTargetingMutation = useMutation({
    mutationFn: async (criteria: any[]) => {
      if (!campaignId) return;
      return apiRequest('POST', `/api/campaigns/${campaignId}/target-criteria`, criteria);
    },
    onSuccess: () => {
      refetchPreview();
    },
  });

  useEffect(() => {
    if (previewData?.totalMatched !== undefined) {
      updateState(prev => ({
        targeting: { ...prev.targeting, matchedClientCount: previewData.totalMatched },
      }));
    }
  }, [previewData?.totalMatched]);

  const saveCriteria = useCallback(() => {
    if (!campaignId) return;
    
    const flatCriteria = state.targeting.filterGroups.flatMap((group, groupIndex) =>
      group.filters.map(filter => ({
        filterType: filter.filterType,
        operator: filter.operator,
        filterValue: filter.value,
        groupNumber: groupIndex,
      }))
    );
    
    saveTargetingMutation.mutate(flatCriteria);
  }, [campaignId, state.targeting.filterGroups]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (campaignId && state.targeting.filterGroups.length > 0) {
        saveCriteria();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state.targeting.filterGroups, campaignId]);

  const addFilterGroup = () => {
    const newGroup: FilterGroup = {
      id: generateId(),
      filters: [{
        id: generateId(),
        filterType: '',
        operator: 'equals',
        value: null,
      }],
    };
    updateState(prev => ({
      targeting: {
        ...prev.targeting,
        filterGroups: [...prev.targeting.filterGroups, newGroup],
      },
    }));
    setExpandedGroups(prev => ({ ...prev, [newGroup.id]: true }));
  };

  const removeFilterGroup = (groupId: string) => {
    updateState(prev => ({
      targeting: {
        ...prev.targeting,
        filterGroups: prev.targeting.filterGroups.filter(g => g.id !== groupId),
      },
    }));
  };

  const addFilterToGroup = (groupId: string) => {
    updateState(prev => ({
      targeting: {
        ...prev.targeting,
        filterGroups: prev.targeting.filterGroups.map(g =>
          g.id === groupId
            ? {
                ...g,
                filters: [...g.filters, {
                  id: generateId(),
                  filterType: '',
                  operator: 'equals',
                  value: null,
                }],
              }
            : g
        ),
      },
    }));
  };

  const removeFilter = (groupId: string, filterId: string) => {
    updateState(prev => ({
      targeting: {
        ...prev.targeting,
        filterGroups: prev.targeting.filterGroups.map(g =>
          g.id === groupId
            ? { ...g, filters: g.filters.filter(f => f.id !== filterId) }
            : g
        ).filter(g => g.filters.length > 0),
      },
    }));
  };

  const updateFilter = (groupId: string, filterId: string, updates: Partial<Filter>) => {
    updateState(prev => ({
      targeting: {
        ...prev.targeting,
        filterGroups: prev.targeting.filterGroups.map(g =>
          g.id === groupId
            ? {
                ...g,
                filters: g.filters.map(f =>
                  f.id === filterId ? { ...f, ...updates } : f
                ),
              }
            : g
        ),
      },
    }));
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const categorizedFilters = availableFilters ? categorizeFilters(availableFilters) : {} as Record<string, any[]>;

  return (
    <div className="space-y-6" data-testid="step-targeting">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-step-title">
          Who should receive this campaign?
        </h2>
        <p className="text-muted-foreground mt-1">
          Define your target audience using filters. Clients matching ALL filters within a group are included.
        </p>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">
                    {state.targeting.matchedClientCount !== null
                      ? state.targeting.matchedClientCount.toLocaleString()
                      : '—'}
                  </span>
                  <span className="text-muted-foreground">clients match your criteria</span>
                </div>
                {loadingPreview && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Calculating...
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchPreview()}
              disabled={loadingPreview || !campaignId}
              data-testid="button-refresh-count"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loadingPreview && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {state.targeting.filterGroups.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No filters added</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Add your first filter to start building your audience
              </p>
              <Button onClick={addFilterGroup} data-testid="button-add-first-filter">
                <Plus className="h-4 w-4 mr-2" />
                Add Filter
              </Button>
            </CardContent>
          </Card>
        ) : (
          state.targeting.filterGroups.map((group, groupIndex) => (
            <div key={group.id}>
              {groupIndex > 0 && (
                <div className="flex items-center gap-4 my-4">
                  <Separator className="flex-1" />
                  <Badge variant="secondary" className="text-sm font-medium">
                    OR
                  </Badge>
                  <Separator className="flex-1" />
                </div>
              )}
              
              <Card data-testid={`filter-group-${groupIndex}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleGroupExpanded(group.id)}
                      className="flex items-center gap-2 hover:text-primary transition-colors"
                    >
                      {expandedGroups[group.id] !== false ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      <CardTitle className="text-base">
                        Filter Group {groupIndex + 1}
                      </CardTitle>
                      <Badge variant="outline" className="ml-2">
                        {group.filters.length} {group.filters.length === 1 ? 'filter' : 'filters'}
                      </Badge>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFilterGroup(group.id)}
                      data-testid={`button-remove-group-${groupIndex}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    All conditions in this group must match (AND logic)
                  </CardDescription>
                </CardHeader>

                {expandedGroups[group.id] !== false && (
                  <CardContent className="space-y-3">
                    {group.filters.map((filter, filterIndex) => (
                      <div key={filter.id}>
                        {filterIndex > 0 && (
                          <div className="flex items-center gap-2 my-2">
                            <Badge variant="outline" className="text-xs">AND</Badge>
                          </div>
                        )}
                        <FilterRow
                          filter={filter}
                          availableFilters={availableFilters || []}
                          categorizedFilters={categorizedFilters}
                          onUpdate={(updates) => updateFilter(group.id, filter.id, updates)}
                          onRemove={() => removeFilter(group.id, filter.id)}
                          canRemove={group.filters.length > 1}
                          testId={`filter-${groupIndex}-${filterIndex}`}
                        />
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addFilterToGroup(group.id)}
                      className="mt-2"
                      data-testid={`button-add-filter-to-group-${groupIndex}`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Filter to Group
                    </Button>
                  </CardContent>
                )}
              </Card>
            </div>
          ))
        )}

        {state.targeting.filterGroups.length > 0 && (
          <Button
            variant="outline"
            onClick={addFilterGroup}
            className="w-full border-dashed"
            data-testid="button-add-filter-group"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Filter Group (OR)
          </Button>
        )}
      </div>

      {state.targeting.filterGroups.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Preview Matched Clients
                </CardTitle>
                <CardDescription>
                  Showing first {previewData?.preview?.length || 0} of {previewData?.totalMatched || 0} matched clients
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchPreview()}
                disabled={loadingPreview}
                data-testid="button-refresh-preview"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", loadingPreview && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : previewData?.preview?.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.preview.map((client: any) => (
                      <TableRow key={client.id} data-testid={`preview-row-${client.id}`}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell className="text-muted-foreground">{client.email || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No clients match your current filters. Try adjusting your criteria.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface FilterRowProps {
  filter: Filter;
  availableFilters: any[];
  categorizedFilters: Record<string, any[]>;
  onUpdate: (updates: Partial<Filter>) => void;
  onRemove: () => void;
  canRemove: boolean;
  testId: string;
}

function FilterRow({ filter, availableFilters, categorizedFilters, onUpdate, onRemove, canRemove, testId }: FilterRowProps) {
  const selectedFilter = availableFilters.find(f => f.type === filter.filterType);
  const operators = selectedFilter?.operators || ['equals'];

  const { data: filterOptions } = useQuery({
    queryKey: ['/api/campaign-targeting/filter-options', filter.filterType],
    enabled: !!filter.filterType && selectedFilter?.valueType === 'select',
  });

  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      <Select
        value={filter.filterType}
        onValueChange={(value) => onUpdate({ filterType: value, value: null })}
      >
        <SelectTrigger className="w-[220px]" data-testid={`${testId}-type`}>
          <SelectValue placeholder="Select filter..." />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(categorizedFilters).map(([category, filters]) => (
            <div key={category}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {category}
              </div>
              {filters.map((f: any) => (
                <SelectItem key={f.type} value={f.type}>
                  {f.label}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filter.operator}
        onValueChange={(value) => onUpdate({ operator: value })}
        disabled={!filter.filterType}
      >
        <SelectTrigger className="w-[140px]" data-testid={`${testId}-operator`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op: string) => (
            <SelectItem key={op} value={op}>
              {OPERATOR_LABELS[op] || op}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedFilter?.valueType === 'select' ? (
        <Select
          value={filter.value || ''}
          onValueChange={(value) => onUpdate({ value })}
          disabled={!filter.filterType}
        >
          <SelectTrigger className="flex-1" data-testid={`${testId}-value`}>
            <SelectValue placeholder="Select value..." />
          </SelectTrigger>
          <SelectContent>
            {(filterOptions || []).map((opt: any) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : selectedFilter?.valueType === 'boolean' ? (
        <Select
          value={filter.value?.toString() || 'true'}
          onValueChange={(value) => onUpdate({ value: value === 'true' })}
        >
          <SelectTrigger className="flex-1" data-testid={`${testId}-value`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      ) : selectedFilter?.valueType === 'number' ? (
        <Input
          type="number"
          value={filter.value || ''}
          onChange={(e) => onUpdate({ value: e.target.value ? parseInt(e.target.value) : null })}
          placeholder="Enter number..."
          className="flex-1"
          data-testid={`${testId}-value`}
        />
      ) : (
        <Input
          value={filter.value || ''}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder="Enter value..."
          className="flex-1"
          disabled={!filter.filterType}
          data-testid={`${testId}-value`}
        />
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
        onClick={onRemove}
        disabled={!canRemove}
        data-testid={`${testId}-remove`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function categorizeFilters(filters: any[]): Record<string, any[]> {
  const categories: Record<string, any[]> = {
    'Client Basics': [],
    'Services': [],
    'Projects': [],
    'Data Completeness': [],
    'Engagement': [],
    'Other': [],
  };

  filters.forEach((filter: any) => {
    const category = filter.category || 'Other';
    if (categories[category]) {
      categories[category].push(filter);
    } else {
      categories['Other'].push(filter);
    }
  });

  return Object.fromEntries(
    Object.entries(categories).filter(([_, filters]) => filters.length > 0)
  );
}
