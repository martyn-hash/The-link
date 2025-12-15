import { useDroppable } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2 } from 'lucide-react';
import type { PageComponent } from '@shared/schema';
import { COMPONENT_TYPES } from './ComponentPalette';

interface PageCanvasProps {
  components: PageComponent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}

interface SortableComponentProps {
  component: PageComponent;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableComponent({ component, isSelected, onSelect, onDelete }: SortableComponentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: component.id,
    data: {
      type: 'component',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeConfig = COMPONENT_TYPES.find(t => t.type === component.componentType);
  const Icon = typeConfig?.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      data-testid={`canvas-component-${component.id}`}
    >
      <Card className="relative">
        <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            {...attributes}
            {...listeners}
            className="p-1 rounded hover:bg-muted cursor-grab active:cursor-grabbing"
            data-testid={`handle-${component.id}`}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <CardContent className="p-4 cursor-pointer" onClick={onSelect}>
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{typeConfig?.label || component.componentType}</p>
              <ComponentPreview component={component} />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              data-testid={`button-delete-${component.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComponentPreview({ component }: { component: PageComponent }) {
  const content = component.content as any;

  switch (component.componentType) {
    case 'heading':
    case 'text_block':
      return (
        <p className="text-sm text-muted-foreground truncate">
          {content?.text || 'No content'}
        </p>
      );

    case 'callout':
      return (
        <p className="text-sm text-muted-foreground truncate">
          {content?.title}: {content?.message || 'No message'}
        </p>
      );

    case 'button':
      return (
        <p className="text-sm text-muted-foreground truncate">
          Button: {content?.label || 'No label'}
        </p>
      );

    case 'image':
      return (
        <p className="text-sm text-muted-foreground truncate">
          {content?.src ? 'Image set' : 'No image'}
        </p>
      );

    case 'status_widget':
      return (
        <p className="text-sm text-muted-foreground">
          Client status information
        </p>
      );

    case 'spacer':
      return (
        <p className="text-sm text-muted-foreground">
          {content?.height || 32}px spacing
        </p>
      );

    case 'faq_accordion':
      return (
        <p className="text-sm text-muted-foreground">
          {content?.items?.length || 0} questions
        </p>
      );

    case 'table':
      return (
        <p className="text-sm text-muted-foreground">
          {content?.rows?.length || 0} rows
        </p>
      );

    case 'timeline':
      return (
        <p className="text-sm text-muted-foreground">
          {content?.items?.length || 0} timeline items
        </p>
      );

    case 'form':
      return (
        <p className="text-sm text-muted-foreground">
          {content?.fields?.length || 0} form fields
        </p>
      );

    default:
      return null;
  }
}

export function PageCanvas({ components, selectedId, onSelect, onDelete }: PageCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas',
    data: {
      type: 'canvas',
    },
  });

  const sortedComponents = [...components].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[400px] max-w-3xl mx-auto transition-colors rounded-lg p-8 ${
        isOver ? 'bg-primary/5 ring-2 ring-primary ring-dashed' : ''
      }`}
    >
      {components.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground"
          data-testid="canvas-empty"
        >
          <p className="text-lg font-medium">Drag components here</p>
          <p className="text-sm">or click on them in the palette to add</p>
        </div>
      ) : (
        <SortableContext items={sortedComponents.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 pl-8">
            {sortedComponents.map(component => (
              <SortableComponent
                key={component.id}
                component={component}
                isSelected={selectedId === component.id}
                onSelect={() => onSelect(component.id)}
                onDelete={() => onDelete(component.id)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
