import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import {
  Type,
  Heading1,
  Image,
  Table,
  MousePointer,
  FileText,
  AlertCircle,
  Activity,
  Clock,
  HelpCircle,
  GitCompareArrows,
  Video,
  FileIcon,
  Minus,
} from 'lucide-react';

export type ComponentType =
  | 'text_block'
  | 'heading'
  | 'image'
  | 'table'
  | 'button'
  | 'form'
  | 'callout'
  | 'status_widget'
  | 'timeline'
  | 'faq_accordion'
  | 'comparison_table'
  | 'video_embed'
  | 'document_list'
  | 'spacer';

export interface ComponentTypeConfig {
  type: ComponentType;
  label: string;
  icon: any;
  category: 'basic' | 'advanced' | 'actions';
  description: string;
  defaultContent: any;
}

export const COMPONENT_TYPES: ComponentTypeConfig[] = [
  {
    type: 'heading',
    label: 'Heading',
    icon: Heading1,
    category: 'basic',
    description: 'Section title or heading',
    defaultContent: { text: 'Heading', level: 'h2' },
  },
  {
    type: 'text_block',
    label: 'Text Block',
    icon: Type,
    category: 'basic',
    description: 'Paragraph of text',
    defaultContent: { text: 'Enter your text here...' },
  },
  {
    type: 'image',
    label: 'Image',
    icon: Image,
    category: 'basic',
    description: 'Image with optional caption',
    defaultContent: { src: '', alt: '', caption: '' },
  },
  {
    type: 'button',
    label: 'Button',
    icon: MousePointer,
    category: 'basic',
    description: 'Clickable button',
    defaultContent: { label: 'Click me', actionId: '' },
  },
  {
    type: 'spacer',
    label: 'Spacer',
    icon: Minus,
    category: 'basic',
    description: 'Add vertical spacing',
    defaultContent: { height: 32 },
  },
  {
    type: 'callout',
    label: 'Callout',
    icon: AlertCircle,
    category: 'advanced',
    description: 'Highlighted message box',
    defaultContent: { type: 'info', title: 'Important', message: 'Your message here' },
  },
  {
    type: 'status_widget',
    label: 'Status Widget',
    icon: Activity,
    category: 'advanced',
    description: 'Shows client status info',
    defaultContent: { showAccountsDue: true, showConfirmationStatement: true, showManager: true },
  },
  {
    type: 'table',
    label: 'Table',
    icon: Table,
    category: 'advanced',
    description: 'Data table',
    defaultContent: { headers: ['Column 1', 'Column 2'], rows: [{ cells: ['Value 1', 'Value 2'] }] },
  },
  {
    type: 'timeline',
    label: 'Timeline',
    icon: Clock,
    category: 'advanced',
    description: 'Vertical timeline',
    defaultContent: { items: [{ date: 'Step 1', title: 'First step', description: 'Description' }] },
  },
  {
    type: 'faq_accordion',
    label: 'FAQ Accordion',
    icon: HelpCircle,
    category: 'advanced',
    description: 'Expandable Q&A sections',
    defaultContent: { items: [{ question: 'Question?', answer: 'Answer here.' }] },
  },
  {
    type: 'comparison_table',
    label: 'Comparison',
    icon: GitCompareArrows,
    category: 'advanced',
    description: 'Compare options side by side',
    defaultContent: { options: [{ name: 'Option A', features: ['Feature 1'] }, { name: 'Option B', features: ['Feature 2'] }] },
  },
  {
    type: 'video_embed',
    label: 'Video',
    icon: Video,
    category: 'advanced',
    description: 'Embedded video player',
    defaultContent: { url: '', type: 'youtube' },
  },
  {
    type: 'document_list',
    label: 'Documents',
    icon: FileIcon,
    category: 'advanced',
    description: 'List of downloadable files',
    defaultContent: { documents: [] },
  },
  {
    type: 'form',
    label: 'Form',
    icon: FileText,
    category: 'actions',
    description: 'Input form for data collection',
    defaultContent: { fields: [{ name: 'field1', label: 'Field', type: 'text' }] },
  },
];

interface DraggableComponentProps {
  config: ComponentTypeConfig;
}

function DraggableComponent({ config }: DraggableComponentProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${config.type}`,
    data: {
      type: 'palette',
      componentType: config.type,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = config.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing"
      data-testid={`palette-${config.type}`}
    >
      <Card className="hover:border-primary transition-colors">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{config.label}</p>
            <p className="text-xs text-muted-foreground truncate">{config.description}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ComponentPalette() {
  const basicComponents = COMPONENT_TYPES.filter(c => c.category === 'basic');
  const advancedComponents = COMPONENT_TYPES.filter(c => c.category === 'advanced');
  const actionComponents = COMPONENT_TYPES.filter(c => c.category === 'actions');

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Basic
        </p>
        <div className="space-y-2">
          {basicComponents.map(config => (
            <DraggableComponent key={config.type} config={config} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Advanced
        </p>
        <div className="space-y-2">
          {advancedComponents.map(config => (
            <DraggableComponent key={config.type} config={config} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Data Collection
        </p>
        <div className="space-y-2">
          {actionComponents.map(config => (
            <DraggableComponent key={config.type} config={config} />
          ))}
        </div>
      </div>
    </div>
  );
}
