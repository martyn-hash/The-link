import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Eye, Trash2, Plus, Settings, Palette, Layout, MousePointer } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { ComponentPalette, ComponentType, COMPONENT_TYPES } from './ComponentPalette.js';
import { PageCanvas } from './PageCanvas.js';
import { ComponentEditor } from './ComponentEditor.js';
import { ActionEditor } from './ActionEditor.js';
import type { Page, PageComponent, PageAction } from '@shared/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface PageWithDetails extends Page {
  components: PageComponent[];
  actions: PageAction[];
}

export default function PageBuilder() {
  const [, params] = useRoute('/page-builder/:id');
  const [, setLocation] = useLocation();
  const pageId = params?.id;
  const isNewPage = pageId === 'new';
  
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'components' | 'actions' | 'settings'>('components');
  const [draggedType, setDraggedType] = useState<ComponentType | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (isNewPage && !isCreating) {
      setIsCreating(true);
      apiRequest('POST', '/api/pages', {
        name: 'Untitled Page',
        slug: `page-${Date.now()}`,
        layoutType: 'single_column',
      })
        .then((newPage: any) => {
          setLocation(`/page-builder/${newPage.id}`, { replace: true });
        })
        .catch((err) => {
          toast({ title: 'Error creating page', description: err.message, variant: 'destructive' });
          setLocation('/super-admin/campaigns');
        });
    }
  }, [isNewPage, isCreating, setLocation]);

  const { data: page, isLoading } = useQuery<PageWithDetails>({
    queryKey: ['/api/pages', pageId],
    enabled: !!pageId && !isNewPage,
  });

  const updatePageMutation = useMutation({
    mutationFn: async (data: Partial<Page>) => {
      return apiRequest('PATCH', `/api/pages/${pageId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pages', pageId] });
      toast({ title: 'Page saved' });
    },
    onError: (error: any) => {
      toast({ title: 'Error saving page', description: error.message, variant: 'destructive' });
    },
  });

  const addComponentMutation = useMutation({
    mutationFn: async (data: { componentType: string; content?: any; sortOrder?: number }) => {
      return apiRequest('POST', `/api/pages/${pageId}/components`, data);
    },
    onSuccess: (newComponent: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pages', pageId] });
      setSelectedComponentId(newComponent.id);
    },
    onError: (error: any) => {
      toast({ title: 'Error adding component', description: error.message, variant: 'destructive' });
    },
  });

  const updateComponentsMutation = useMutation({
    mutationFn: async (components: Partial<PageComponent>[]) => {
      return apiRequest('PUT', `/api/pages/${pageId}/components`, components);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pages', pageId] });
    },
    onError: (error: any) => {
      toast({ title: 'Error updating components', description: error.message, variant: 'destructive' });
    },
  });

  const addActionMutation = useMutation({
    mutationFn: async (data: { actionType: string; label: string }) => {
      return apiRequest('POST', `/api/pages/${pageId}/actions`, data);
    },
    onSuccess: (newAction: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pages', pageId] });
      setSelectedActionId(newAction.id);
    },
    onError: (error: any) => {
      toast({ title: 'Error adding action', description: error.message, variant: 'destructive' });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'palette') {
      setDraggedType(active.data.current.componentType as ComponentType);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedType(null);

    if (!over) return;

    if (active.data.current?.type === 'palette') {
      const componentType = active.data.current.componentType as ComponentType;
      const typeConfig = COMPONENT_TYPES.find((t: { type: string }) => t.type === componentType);
      
      addComponentMutation.mutate({
        componentType,
        content: typeConfig?.defaultContent || {},
        sortOrder: page?.components?.length || 0,
      });
    } else if (active.data.current?.type === 'component' && over.data.current?.type === 'component') {
      const oldIndex = page?.components?.findIndex(c => c.id === active.id) ?? -1;
      const newIndex = page?.components?.findIndex(c => c.id === over.id) ?? -1;

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newComponents = arrayMove(page?.components || [], oldIndex, newIndex);
        const updatedComponents = newComponents.map((c, index) => ({
          ...c,
          sortOrder: index,
        }));
        updateComponentsMutation.mutate(updatedComponents);
      }
    }
  };

  const handleDeleteComponent = (componentId: string) => {
    if (!page?.components) return;
    const newComponents = page.components.filter(c => c.id !== componentId);
    updateComponentsMutation.mutate(newComponents.map((c, i) => ({ ...c, sortOrder: i })));
    setSelectedComponentId(null);
  };

  const handleUpdateComponent = (componentId: string, updates: Partial<PageComponent>) => {
    if (!page?.components) return;
    const newComponents = page.components.map(c =>
      c.id === componentId ? { ...c, ...updates } : c
    );
    updateComponentsMutation.mutate(newComponents);
  };

  const selectedComponent = page?.components?.find(c => c.id === selectedComponentId);
  const selectedAction = page?.actions?.find(a => a.id === selectedActionId);

  if (isLoading || isNewPage) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Page not found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/super-admin/campaigns')} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-page-name">{page.name}</h1>
            <p className="text-sm text-muted-foreground">Page Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)} data-testid="button-preview">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            onClick={() => updatePageMutation.mutate({})}
            disabled={updatePageMutation.isPending}
            data-testid="button-save"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r bg-card p-4 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="components" data-testid="tab-components">
                <Layout className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="actions" data-testid="tab-actions">
                <MousePointer className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">
                <Settings className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="components" className="mt-4">
              <ComponentPalette />
            </TabsContent>
            <TabsContent value="actions" className="mt-4 space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => addActionMutation.mutate({ actionType: 'interested', label: 'New Action' })}
                data-testid="button-add-action"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Action
              </Button>
              {page.actions?.map(action => (
                <Card
                  key={action.id}
                  className={`cursor-pointer ${selectedActionId === action.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedActionId(action.id)}
                  data-testid={`card-action-${action.id}`}
                >
                  <CardContent className="p-3">
                    <p className="font-medium text-sm">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.actionType}</p>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="settings" className="mt-4 space-y-4">
              <div>
                <Label htmlFor="page-name">Page Name</Label>
                <Input
                  id="page-name"
                  value={page.name}
                  onChange={(e) => updatePageMutation.mutate({ name: e.target.value })}
                  data-testid="input-page-name"
                />
              </div>
              <div>
                <Label htmlFor="header-title">Header Title</Label>
                <Input
                  id="header-title"
                  value={page.headerTitle || ''}
                  onChange={(e) => updatePageMutation.mutate({ headerTitle: e.target.value })}
                  placeholder="{{client.name}}"
                  data-testid="input-header-title"
                />
              </div>
              <div>
                <Label htmlFor="header-subtitle">Header Subtitle</Label>
                <Textarea
                  id="header-subtitle"
                  value={page.headerSubtitle || ''}
                  onChange={(e) => updatePageMutation.mutate({ headerSubtitle: e.target.value })}
                  placeholder="Important information for {{person.firstName}}"
                  data-testid="input-header-subtitle"
                />
              </div>
              <div>
                <Label htmlFor="theme-color">Theme Color</Label>
                <Input
                  id="theme-color"
                  type="color"
                  value={page.themeColor || '#3b82f6'}
                  onChange={(e) => updatePageMutation.mutate({ themeColor: e.target.value })}
                  data-testid="input-theme-color"
                />
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <main className="flex-1 overflow-auto p-6 bg-muted/30">
            <PageCanvas
              components={page.components || []}
              selectedId={selectedComponentId}
              onSelect={setSelectedComponentId}
              onDelete={handleDeleteComponent}
            />
          </main>

          <DragOverlay>
            {draggedType && (
              <div className="bg-card border rounded-lg p-3 shadow-lg">
                <p className="text-sm font-medium">
                  {COMPONENT_TYPES.find((t: { type: string }) => t.type === draggedType)?.label}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {(selectedComponent || selectedAction) && (
          <aside className="w-80 border-l bg-card p-4 overflow-y-auto">
            {selectedComponent && (
              <ComponentEditor
                component={selectedComponent}
                onUpdate={(updates: Partial<PageComponent>) => handleUpdateComponent(selectedComponent.id, updates)}
                onClose={() => setSelectedComponentId(null)}
              />
            )}
            {selectedAction && !selectedComponent && (
              <ActionEditor
                action={selectedAction}
                pageId={pageId!}
                onClose={() => setSelectedActionId(null)}
              />
            )}
          </aside>
        )}
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Page Preview</DialogTitle>
            <DialogDescription>
              This is how your page will look to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-6 bg-white">
            {page.headerTitle && (
              <h1 className="text-2xl font-bold mb-2">{page.headerTitle}</h1>
            )}
            {page.headerSubtitle && (
              <p className="text-muted-foreground mb-6">{page.headerSubtitle}</p>
            )}
            <div className="space-y-4">
              {page.components?.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(comp => (
                <div key={comp.id} className="p-4 border rounded">
                  <p className="text-sm text-muted-foreground">{comp.componentType}</p>
                  <pre className="text-xs mt-2">{JSON.stringify(comp.content, null, 2)}</pre>
                </div>
              ))}
            </div>
            {page.actions && page.actions.length > 0 && (
              <div className="mt-6 flex gap-2">
                {page.actions.map(action => (
                  <Button key={action.id} variant="default">
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
