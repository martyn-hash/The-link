import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { 
  Target, 
  Plus, 
  X, 
  Loader2, 
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Building2,
  GripVertical,
  Search,
  Info,
  Trash2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useWizardSidebar, type WizardState, type FilterGroup, type Filter } from '../CampaignWizard';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { FilterInputControl } from './targeting/FilterInputControl';

interface StepTargetingProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState> | ((prev: WizardState) => Partial<WizardState>)) => void;
  campaignId: string | null;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

const FILTER_CATEGORIES = [
  { id: 'Client Profile', label: 'Client Profile', icon: '👤' },
  { id: 'Services', label: 'Services', icon: '📋' },
  { id: 'Projects & Deadlines', label: 'Projects & Deadlines', icon: '📅' },
  { id: 'Data Completeness', label: 'Data Completeness', icon: '✓' },
  { id: 'Engagement', label: 'Engagement', icon: '📊' },
  { id: 'UDFs', label: 'Service Fields (UDFs)', icon: '📝' },
];

export function StepTargeting({ state, updateState, campaignId }: StepTargetingProps) {
  const { setSidebarContent } = useWizardSidebar();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Client Profile': true,
    'Services': true,
    'Projects & Deadlines': true,
    'Data Completeness': false,
    'Engagement': false,
    'UDFs': false,
  });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

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
      group.filters.map((filter, filterIndex) => ({
        filterType: filter.filterType,
        operator: filter.operator,
        value: filter.value,
        filterGroup: groupIndex,
        sortOrder: filterIndex,
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

  const addFilter = useCallback((filterType: string) => {
    const filterDef = availableFilters?.find(f => f.type === filterType);
    const defaultOperator = filterDef?.operators?.[0] || 'equals';
    
    const newFilter: Filter = {
      id: generateId(),
      filterType,
      operator: defaultOperator,
      value: null,
    };

    if (state.targeting.filterGroups.length === 0) {
      const newGroup: FilterGroup = {
        id: generateId(),
        filters: [newFilter],
      };
      updateState(prev => ({
        targeting: {
          ...prev.targeting,
          filterGroups: [newGroup],
        },
      }));
    } else {
      updateState(prev => ({
        targeting: {
          ...prev.targeting,
          filterGroups: prev.targeting.filterGroups.map((g, i) =>
            i === 0 ? { ...g, filters: [...g.filters, newFilter] } : g
          ),
        },
      }));
    }
  }, [availableFilters, state.targeting.filterGroups.length, updateState]);

  const addFilterGroup = () => {
    const newGroup: FilterGroup = {
      id: generateId(),
      filters: [],
    };
    updateState(prev => ({
      targeting: {
        ...prev.targeting,
        filterGroups: [...prev.targeting.filterGroups, newGroup],
      },
    }));
  };

  const removeFilterGroup = (groupId: string) => {
    updateState(prev => ({
      targeting: {
        ...prev.targeting,
        filterGroups: prev.targeting.filterGroups.filter(g => g.id !== groupId),
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    
    if (event.over && event.active.id) {
      const filterType = event.active.id as string;
      if (filterType.startsWith('palette-')) {
        const actualFilterType = filterType.replace('palette-', '');
        addFilter(actualFilterType);
      }
    }
  };

  const categorizedFilters = availableFilters ? categorizeFilters(availableFilters) : {};

  const filteredFilters = searchQuery
    ? Object.fromEntries(
        Object.entries(categorizedFilters).map(([cat, filters]) => [
          cat,
          (filters as any[]).filter(f =>
            f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.description?.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        ]).filter(([_, filters]) => (filters as any[]).length > 0)
      )
    : categorizedFilters;

  useEffect(() => {
    setSidebarContent(
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-sm mb-2">Available Filters</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Click a filter to add it to your targeting criteria
          </p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search filters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-filter-search"
          />
        </div>

        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-2 pr-2">
            {FILTER_CATEGORIES.map((category) => {
              const filters = (filteredFilters as Record<string, any[]>)[category.id] || [];
              if (filters.length === 0 && searchQuery) return null;
              
              return (
                <Collapsible
                  key={category.id}
                  open={expandedCategories[category.id]}
                  onOpenChange={(open) => setExpandedCategories(prev => ({ ...prev, [category.id]: open }))}
                >
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full px-2 py-1.5 text-sm font-medium hover:bg-muted rounded-md transition-colors">
                      <span className="flex items-center gap-2">
                        <span>{category.icon}</span>
                        <span>{category.label}</span>
                        <Badge variant="secondary" className="text-xs h-5">
                          {filters.length}
                        </Badge>
                      </span>
                      {expandedCategories[category.id] ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pl-2 space-y-0.5 mt-1">
                      {filters.map((filter: any) => (
                        <FilterPaletteItem
                          key={filter.type}
                          filter={filter}
                          onAdd={() => addFilter(filter.type)}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Click filters to add them. Filters within a group use AND logic.
              Add multiple groups for OR logic.
            </p>
          </div>
        </div>
      </div>
    );

    return () => setSidebarContent(null);
  }, [setSidebarContent, searchQuery, expandedCategories, filteredFilters, addFilter]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6" data-testid="step-targeting">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-step-title">
            Who should receive this campaign?
          </h2>
          <p className="text-muted-foreground mt-1">
            Define your target audience using filters. Click filters from the left panel to add them.
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

        <DropZone isEmpty={state.targeting.filterGroups.length === 0}>
          {state.targeting.filterGroups.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No filters added</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Click filters from the left panel to start building your audience
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {state.targeting.filterGroups.map((group, groupIndex) => (
                <div key={group.id}>
                  {groupIndex > 0 && (
                    <div className="flex items-center gap-4 my-4">
                      <Separator className="flex-1" />
                      <Badge variant="secondary" className="text-sm font-medium px-3 py-1">
                        OR
                      </Badge>
                      <Separator className="flex-1" />
                    </div>
                  )}
                  
                  <Card data-testid={`filter-group-${groupIndex}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">
                            Filter Group {groupIndex + 1}
                          </CardTitle>
                          <Badge variant="outline">
                            {group.filters.length} {group.filters.length === 1 ? 'filter' : 'filters'}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFilterGroup(group.id)}
                          data-testid={`button-remove-group-${groupIndex}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <CardDescription>
                        All conditions must match (AND logic)
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {group.filters.map((filter, filterIndex) => (
                        <div key={filter.id}>
                          {filterIndex > 0 && (
                            <div className="flex items-center gap-2 my-2 ml-2">
                              <Badge variant="outline" className="text-xs bg-background">AND</Badge>
                            </div>
                          )}
                          <FilterCard
                            filter={filter}
                            availableFilters={availableFilters || []}
                            onUpdate={(updates) => updateFilter(group.id, filter.id, updates)}
                            onRemove={() => removeFilter(group.id, filter.id)}
                            testId={`filter-${groupIndex}-${filterIndex}`}
                          />
                        </div>
                      ))}

                      {group.filters.length === 0 && (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                          Click a filter from the left panel to add it to this group
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addFilterGroup}
                className="w-full border-dashed"
                data-testid="button-add-filter-group"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Filter Group (OR)
              </Button>
            </div>
          )}
        </DropZone>

        {state.targeting.filterGroups.length > 0 && state.targeting.filterGroups.some(g => g.filters.length > 0) && (
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

      <DragOverlay>
        {activeDragId && (
          <div className="bg-primary text-primary-foreground px-3 py-2 rounded-md shadow-lg text-sm font-medium">
            {activeDragId.replace('palette-', '')}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface FilterPaletteItemProps {
  filter: any;
  onAdd: () => void;
}

function FilterPaletteItem({ filter, onAdd }: FilterPaletteItemProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onAdd}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-left group"
            data-testid={`palette-filter-${filter.type}`}
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="truncate">{filter.label}</span>
          </button>
        </TooltipTrigger>
        {filter.description && (
          <TooltipContent side="right" className="max-w-[200px]">
            <p className="text-xs">{filter.description}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

interface DropZoneProps {
  children: React.ReactNode;
  isEmpty: boolean;
}

function DropZone({ children, isEmpty }: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id: 'filter-drop-zone' });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[200px] rounded-lg transition-all",
        isEmpty && "border-2 border-dashed border-muted-foreground/25",
        isOver && "border-primary bg-primary/5"
      )}
    >
      {children}
    </div>
  );
}

interface FilterCardProps {
  filter: Filter;
  availableFilters: any[];
  onUpdate: (updates: Partial<Filter>) => void;
  onRemove: () => void;
  testId: string;
}

function FilterCard({ filter, availableFilters, onUpdate, onRemove, testId }: FilterCardProps) {
  const filterDef = availableFilters.find(f => f.type === filter.filterType);

  return (
    <div 
      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border"
      data-testid={testId}
    >
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-medium">
            {filterDef?.label || filter.filterType}
          </Badge>
          {filterDef?.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">{filterDef.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <FilterInputControl
          filter={filter}
          filterDef={filterDef}
          onUpdate={onUpdate}
          testId={testId}
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
        onClick={onRemove}
        data-testid={`${testId}-remove`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function categorizeFilters(filters: any[]): Record<string, any[]> {
  const categories: Record<string, any[]> = {
    'Client Profile': [],
    'Services': [],
    'Projects & Deadlines': [],
    'Data Completeness': [],
    'Engagement': [],
    'UDFs': [],
  };

  filters.forEach((filter: any) => {
    const category = filter.category || 'Client Profile';
    if (categories[category]) {
      categories[category].push(filter);
    } else {
      categories['Client Profile'].push(filter);
    }
  });

  return Object.fromEntries(
    Object.entries(categories).filter(([_, filters]) => filters.length > 0)
  );
}
