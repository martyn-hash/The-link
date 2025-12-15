import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { X, Plus, Trash2 } from 'lucide-react';
import type { PageComponent } from '@shared/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COMPONENT_TYPES } from './ComponentPalette';

interface ComponentEditorProps {
  component: PageComponent;
  onUpdate: (updates: Partial<PageComponent>) => void;
  onClose: () => void;
}

export function ComponentEditor({ component, onUpdate, onClose }: ComponentEditorProps) {
  const [content, setContent] = useState<any>(component.content || {});

  useEffect(() => {
    setContent(component.content || {});
  }, [component.id, component.content]);

  const handleContentChange = (key: string, value: any) => {
    const newContent = { ...content, [key]: value };
    setContent(newContent);
    onUpdate({ content: newContent });
  };

  const typeConfig = COMPONENT_TYPES.find(t => t.type === component.componentType);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{typeConfig?.label || 'Component'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-editor">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {component.componentType === 'heading' && (
          <HeadingEditor content={content} onChange={handleContentChange} />
        )}
        {component.componentType === 'text_block' && (
          <TextBlockEditor content={content} onChange={handleContentChange} />
        )}
        {component.componentType === 'callout' && (
          <CalloutEditor content={content} onChange={handleContentChange} />
        )}
        {component.componentType === 'button' && (
          <ButtonEditor content={content} onChange={handleContentChange} />
        )}
        {component.componentType === 'image' && (
          <ImageEditor content={content} onChange={handleContentChange} />
        )}
        {component.componentType === 'spacer' && (
          <SpacerEditor content={content} onChange={handleContentChange} />
        )}
        {component.componentType === 'status_widget' && (
          <StatusWidgetEditor content={content} onChange={handleContentChange} />
        )}
        {component.componentType === 'faq_accordion' && (
          <FaqAccordionEditor content={content} onChange={handleContentChange} />
        )}
        {component.componentType === 'timeline' && (
          <TimelineEditor content={content} onChange={handleContentChange} />
        )}
        {component.componentType === 'video_embed' && (
          <VideoEmbedEditor content={content} onChange={handleContentChange} />
        )}
        {component.componentType === 'table' && (
          <TableEditor content={content} onChange={handleContentChange} />
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Use merge fields like {'{{client.name}}'} or {'{{person.firstName}}'} for personalization.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function HeadingEditor({ content, onChange }: { content: any; onChange: (key: string, value: any) => void }) {
  return (
    <>
      <div>
        <Label htmlFor="heading-text">Heading Text</Label>
        <Input
          id="heading-text"
          value={content.text || ''}
          onChange={(e) => onChange('text', e.target.value)}
          placeholder="Enter heading..."
          data-testid="input-heading-text"
        />
      </div>
      <div>
        <Label htmlFor="heading-level">Level</Label>
        <Select value={content.level || 'h2'} onValueChange={(v) => onChange('level', v)}>
          <SelectTrigger data-testid="select-heading-level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="h1">Heading 1 (Large)</SelectItem>
            <SelectItem value="h2">Heading 2 (Medium)</SelectItem>
            <SelectItem value="h3">Heading 3 (Small)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function TextBlockEditor({ content, onChange }: { content: any; onChange: (key: string, value: any) => void }) {
  return (
    <div>
      <Label htmlFor="text-content">Text Content</Label>
      <Textarea
        id="text-content"
        value={content.text || ''}
        onChange={(e) => onChange('text', e.target.value)}
        placeholder="Enter your text..."
        rows={5}
        data-testid="input-text-content"
      />
    </div>
  );
}

function CalloutEditor({ content, onChange }: { content: any; onChange: (key: string, value: any) => void }) {
  return (
    <>
      <div>
        <Label htmlFor="callout-type">Type</Label>
        <Select value={content.type || 'info'} onValueChange={(v) => onChange('type', v)}>
          <SelectTrigger data-testid="select-callout-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">Info (Blue)</SelectItem>
            <SelectItem value="warning">Warning (Yellow)</SelectItem>
            <SelectItem value="success">Success (Green)</SelectItem>
            <SelectItem value="error">Error (Red)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="callout-title">Title</Label>
        <Input
          id="callout-title"
          value={content.title || ''}
          onChange={(e) => onChange('title', e.target.value)}
          data-testid="input-callout-title"
        />
      </div>
      <div>
        <Label htmlFor="callout-message">Message</Label>
        <Textarea
          id="callout-message"
          value={content.message || ''}
          onChange={(e) => onChange('message', e.target.value)}
          rows={3}
          data-testid="input-callout-message"
        />
      </div>
    </>
  );
}

function ButtonEditor({ content, onChange }: { content: any; onChange: (key: string, value: any) => void }) {
  return (
    <>
      <div>
        <Label htmlFor="button-label">Button Label</Label>
        <Input
          id="button-label"
          value={content.label || ''}
          onChange={(e) => onChange('label', e.target.value)}
          data-testid="input-button-label"
        />
      </div>
      <div>
        <Label htmlFor="button-variant">Style</Label>
        <Select value={content.variant || 'default'} onValueChange={(v) => onChange('variant', v)}>
          <SelectTrigger data-testid="select-button-variant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Primary</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
            <SelectItem value="outline">Outline</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function ImageEditor({ content, onChange }: { content: any; onChange: (key: string, value: any) => void }) {
  return (
    <>
      <div>
        <Label htmlFor="image-src">Image URL</Label>
        <Input
          id="image-src"
          value={content.src || ''}
          onChange={(e) => onChange('src', e.target.value)}
          placeholder="https://..."
          data-testid="input-image-src"
        />
      </div>
      <div>
        <Label htmlFor="image-alt">Alt Text</Label>
        <Input
          id="image-alt"
          value={content.alt || ''}
          onChange={(e) => onChange('alt', e.target.value)}
          data-testid="input-image-alt"
        />
      </div>
      <div>
        <Label htmlFor="image-caption">Caption (optional)</Label>
        <Input
          id="image-caption"
          value={content.caption || ''}
          onChange={(e) => onChange('caption', e.target.value)}
          data-testid="input-image-caption"
        />
      </div>
    </>
  );
}

function SpacerEditor({ content, onChange }: { content: any; onChange: (key: string, value: any) => void }) {
  return (
    <div>
      <Label htmlFor="spacer-height">Height (pixels)</Label>
      <Input
        id="spacer-height"
        type="number"
        value={content.height || 32}
        onChange={(e) => onChange('height', parseInt(e.target.value) || 32)}
        data-testid="input-spacer-height"
      />
    </div>
  );
}

function StatusWidgetEditor({ content, onChange }: { content: any; onChange: (key: string, value: any) => void }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Label htmlFor="show-accounts">Show Accounts Due</Label>
        <Switch
          id="show-accounts"
          checked={content.showAccountsDue ?? true}
          onCheckedChange={(v) => onChange('showAccountsDue', v)}
          data-testid="switch-show-accounts"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="show-confirmation">Show Confirmation Statement</Label>
        <Switch
          id="show-confirmation"
          checked={content.showConfirmationStatement ?? true}
          onCheckedChange={(v) => onChange('showConfirmationStatement', v)}
          data-testid="switch-show-confirmation"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="show-manager">Show Manager Name</Label>
        <Switch
          id="show-manager"
          checked={content.showManager ?? true}
          onCheckedChange={(v) => onChange('showManager', v)}
          data-testid="switch-show-manager"
        />
      </div>
    </>
  );
}

function FaqAccordionEditor({ content, onChange }: { content: any; onChange: (key: string, value: any) => void }) {
  const items = content.items || [];

  const addItem = () => {
    onChange('items', [...items, { question: '', answer: '' }]);
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange('items', newItems);
  };

  const removeItem = (index: number) => {
    onChange('items', items.filter((_: any, i: number) => i !== index));
  };

  return (
    <div className="space-y-3">
      {items.map((item: any, index: number) => (
        <div key={index} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <Label>Question</Label>
              <Input
                value={item.question || ''}
                onChange={(e) => updateItem(index, 'question', e.target.value)}
                placeholder="Enter question..."
                data-testid={`input-faq-question-${index}`}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(index)}
              data-testid={`button-remove-faq-${index}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <Label>Answer</Label>
            <Textarea
              value={item.answer || ''}
              onChange={(e) => updateItem(index, 'answer', e.target.value)}
              placeholder="Enter answer..."
              rows={2}
              data-testid={`input-faq-answer-${index}`}
            />
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={addItem} className="w-full" data-testid="button-add-faq">
        <Plus className="h-4 w-4 mr-2" />
        Add Question
      </Button>
    </div>
  );
}

function TimelineEditor({ content, onChange }: { content: any; onChange: (key: string, value: any) => void }) {
  const items = content.items || [];

  const addItem = () => {
    onChange('items', [...items, { date: '', title: '', description: '' }]);
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange('items', newItems);
  };

  const removeItem = (index: number) => {
    onChange('items', items.filter((_: any, i: number) => i !== index));
  };

  return (
    <div className="space-y-3">
      {items.map((item: any, index: number) => (
        <div key={index} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <Label>Date/Label</Label>
              <Input
                value={item.date || ''}
                onChange={(e) => updateItem(index, 'date', e.target.value)}
                placeholder="e.g., Step 1 or Jan 2024"
                data-testid={`input-timeline-date-${index}`}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(index)}
              data-testid={`button-remove-timeline-${index}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <Label>Title</Label>
            <Input
              value={item.title || ''}
              onChange={(e) => updateItem(index, 'title', e.target.value)}
              data-testid={`input-timeline-title-${index}`}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={item.description || ''}
              onChange={(e) => updateItem(index, 'description', e.target.value)}
              rows={2}
              data-testid={`input-timeline-description-${index}`}
            />
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={addItem} className="w-full" data-testid="button-add-timeline">
        <Plus className="h-4 w-4 mr-2" />
        Add Timeline Item
      </Button>
    </div>
  );
}

function VideoEmbedEditor({ content, onChange }: { content: any; onChange: (key: string, value: any) => void }) {
  return (
    <>
      <div>
        <Label htmlFor="video-url">Video URL</Label>
        <Input
          id="video-url"
          value={content.url || ''}
          onChange={(e) => onChange('url', e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          data-testid="input-video-url"
        />
      </div>
      <div>
        <Label htmlFor="video-type">Platform</Label>
        <Select value={content.type || 'youtube'} onValueChange={(v) => onChange('type', v)}>
          <SelectTrigger data-testid="select-video-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="vimeo">Vimeo</SelectItem>
            <SelectItem value="loom">Loom</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function TableEditor({ content, onChange }: { content: any; onChange: (key: string, value: any) => void }) {
  const headers = content.headers || ['Column 1', 'Column 2'];
  const rows = content.rows || [];

  const addColumn = () => {
    const newHeaders = [...headers, `Column ${headers.length + 1}`];
    const newRows = rows.map((row: any) => ({
      ...row,
      cells: [...(row.cells || []), ''],
    }));
    onChange('headers', newHeaders);
    onChange('rows', newRows);
  };

  const addRow = () => {
    const newRow = { cells: headers.map(() => '') };
    onChange('rows', [...rows, newRow]);
  };

  const updateHeader = (index: number, value: string) => {
    const newHeaders = [...headers];
    newHeaders[index] = value;
    onChange('headers', newHeaders);
  };

  const updateCell = (rowIndex: number, cellIndex: number, value: string) => {
    const newRows = [...rows];
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      cells: [...(newRows[rowIndex].cells || [])],
    };
    newRows[rowIndex].cells[cellIndex] = value;
    onChange('rows', newRows);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Headers</Label>
        <div className="flex gap-2">
          {headers.map((header: string, index: number) => (
            <Input
              key={index}
              value={header}
              onChange={(e) => updateHeader(index, e.target.value)}
              className="flex-1"
              data-testid={`input-table-header-${index}`}
            />
          ))}
          <Button variant="outline" size="icon" onClick={addColumn} data-testid="button-add-column">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div>
        <Label>Rows</Label>
        {rows.map((row: any, rowIndex: number) => (
          <div key={rowIndex} className="flex gap-2 mb-2">
            {(row.cells || []).map((cell: string, cellIndex: number) => (
              <Input
                key={cellIndex}
                value={cell}
                onChange={(e) => updateCell(rowIndex, cellIndex, e.target.value)}
                className="flex-1"
                data-testid={`input-table-cell-${rowIndex}-${cellIndex}`}
              />
            ))}
          </div>
        ))}
        <Button variant="outline" onClick={addRow} className="w-full" data-testid="button-add-row">
          <Plus className="h-4 w-4 mr-2" />
          Add Row
        </Button>
      </div>
    </div>
  );
}
