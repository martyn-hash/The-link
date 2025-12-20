# Form Builder Standards

This document defines the "Gold Standard" wizard pattern used for form and field creation throughout the application. Use this as a reference when creating or refactoring form builders.

## Gold Standard Reference

The **ApprovalWizard** (`client/src/components/approval-builder/ApprovalWizard.tsx`) serves as the reference implementation for all form creation experiences.

## Core Pattern Overview

A well-designed form builder provides a full-screen wizard experience with:
1. Multi-step workflow (Details → Fields)
2. Left sidebar with field palette (System Library + Custom Fields)
3. Main canvas for drag-and-drop field arrangement
4. Clear visual hierarchy with colorful field type indicators

## Key Components

### 1. Full-Screen Wizard Modal

```tsx
<div className="fixed inset-0 z-50 bg-background flex flex-col">
  {/* Header with steps indicator */}
  <div className="border-b bg-card px-6 py-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Title and description */}
        <h1 className="text-xl font-semibold">Create Form</h1>
      </div>
      {/* Step indicators and action buttons */}
    </div>
  </div>
  
  {/* Main content area */}
  <div className="flex-1 flex overflow-hidden">
    {/* Content changes based on step */}
  </div>
</div>
```

**Key Features:**
- Uses `fixed inset-0 z-50` for full-screen overlay
- Distinct header with navigation controls
- Step indicator showing progress (Step 1 of 2, etc.)

### 2. Step Indicator Pattern

```tsx
<div className="flex items-center gap-4">
  {[
    { number: 1, label: "Details" },
    { number: 2, label: "Fields" },
  ].map((step, idx) => (
    <div key={step.number} className="flex items-center">
      {idx > 0 && <ChevronRight className="w-4 h-4 mx-2 text-muted-foreground" />}
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full",
        currentStep === step.number 
          ? "bg-primary text-primary-foreground" 
          : currentStep > step.number 
            ? "bg-primary/20 text-primary" 
            : "bg-muted text-muted-foreground"
      )}>
        <span className="text-xs font-medium">{step.number}</span>
        <span className="text-sm">{step.label}</span>
      </div>
    </div>
  ))}
</div>
```

### 3. Left Sidebar - Field Palette

The field palette is split into two sections:

#### System Library Section (Collapsible)
```tsx
<Collapsible 
  open={isExpanded} 
  onOpenChange={setIsExpanded}
  className={cn(
    "flex flex-col border-b border-border transition-all",
    isExpanded ? "h-1/2" : "h-auto"
  )}
>
  <CollapsibleTrigger asChild>
    <button className="w-full p-3 bg-emerald-50/50 dark:bg-emerald-950/20">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-emerald-600" />
        <h4 className="text-sm font-semibold text-emerald-700">System Library</h4>
        <Badge variant="secondary">{count}</Badge>
        <ChevronDown className={cn(
          "w-4 h-4 ml-auto transition-transform",
          isExpanded && "rotate-180"
        )} />
      </div>
    </button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* Search, filter, and field list */}
  </CollapsibleContent>
</Collapsible>
```

**Key Features:**
- Starts collapsed by default
- Clear expand/collapse indicator (chevron)
- Green/emerald color scheme for library fields
- Search and category filter when expanded
- Shows field count in badge

#### Custom Fields Section
```tsx
<div className="flex-1 flex flex-col">
  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20">
    <div className="flex items-center gap-2">
      <Plus className="w-4 h-4 text-blue-500" />
      <h4 className="text-sm font-semibold text-blue-700">Custom Fields</h4>
    </div>
  </div>
  <ScrollArea className="flex-1">
    <div className="p-3 space-y-1.5">
      {FIELD_TYPES.map(ft => (
        <PaletteItem key={ft.type} {...ft} />
      ))}
    </div>
  </ScrollArea>
</div>
```

**Key Features:**
- Blue color scheme for custom/new fields
- Always visible (not collapsible)
- Takes remaining space when System Library is collapsed

### 4. Palette Item Pattern

Each field type in the palette is a clickable/draggable button:

```tsx
function PaletteItem({ type, label, icon: Icon, color, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
    >
      <div 
        className="w-7 h-7 rounded-md flex items-center justify-center text-white"
        style={{ backgroundColor: color }}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <span className="text-sm">{label}</span>
    </button>
  );
}
```

**Key Features:**
- Colored icon badge matching field type
- Consistent 7x7 icon container with rounded corners
- Hover state for interactivity

### 5. Main Canvas - Drop Zone

```tsx
<div className="flex-1 p-6 overflow-y-auto bg-muted/10">
  <div className="max-w-3xl mx-auto">
    {/* Summary card at top */}
    <Card className="mb-6 shadow-sm">
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <FormIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{formName}</h3>
            <p className="text-sm text-muted-foreground">{fieldCount} fields</p>
          </div>
        </div>
      </CardContent>
    </Card>
    
    {/* Drop zone for fields */}
    <DropZone isOver={isOverDropZone}>
      <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
        {fields.map((field, index) => (
          <FieldCard key={field.id} field={field} index={index} />
        ))}
      </SortableContext>
    </DropZone>
  </div>
</div>
```

**Key Features:**
- Centered max-width container for comfortable reading
- Summary card showing form name and field count
- Visual drop zone with dashed border
- Highlight effect when dragging over

### 6. Field Card Pattern

Each field in the canvas shows:

```tsx
<div className="bg-card border rounded-lg p-4 shadow-sm">
  <div className="flex items-start gap-3">
    {/* Drag handle */}
    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
    
    {/* Field type icon */}
    <div 
      className="w-8 h-8 rounded-md flex items-center justify-center text-white"
      style={{ backgroundColor: fieldTypeInfo.color }}
    >
      <FieldIcon className="w-4 h-4" />
    </div>
    
    {/* Field info */}
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="font-medium">{field.name}</span>
        {field.isRequired && (
          <Badge variant="destructive" className="text-xs">Required</Badge>
        )}
        {field.libraryFieldId && (
          <Badge variant="outline" className="text-xs text-emerald-600">
            <BookOpen className="w-3 h-3 mr-1" /> Library
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{fieldTypeInfo.label}</p>
    </div>
    
    {/* Actions */}
    <div className="flex gap-1">
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Edit2 className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  </div>
</div>
```

**Key Features:**
- Drag handle for reordering
- Colored field type icon
- Required badge indicator
- Library badge for system library fields
- Edit and delete actions

### 7. Field Configuration Modal

When editing a field, open a modal with configuration options:

```tsx
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Configure Field</DialogTitle>
    </DialogHeader>
    
    <div className="space-y-4">
      <div>
        <Label>Field Name</Label>
        <Input value={fieldName} onChange={...} />
      </div>
      
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={...} />
      </div>
      
      <div className="flex items-center gap-2">
        <Switch checked={isRequired} onCheckedChange={...} />
        <Label>Required field</Label>
      </div>
      
      {/* Type-specific options */}
      {hasOptions && <OptionsEditor options={options} onChange={...} />}
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={onSave}>Save Field</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Color Scheme Reference

| Section | Background | Text/Icon |
|---------|------------|-----------|
| System Library | `emerald-50/50` (light) / `emerald-950/20` (dark) | `emerald-600`, `emerald-700` |
| Custom Fields | `blue-50/50` (light) / `blue-950/20` (dark) | `blue-500`, `blue-700` |
| Primary Actions | `primary` | `primary-foreground` |
| Field Palette Header | `gradient purple to pink` | `white` |

## Field Type Colors

Each field type has a consistent color for its icon badge. See `client/src/components/field-builder/types.ts` for the full color mapping:

- Boolean: `#10b981` (emerald)
- Short Text: `#3b82f6` (blue)
- Long Text: `#6366f1` (indigo)
- Number: `#f59e0b` (amber)
- Date: `#ec4899` (pink)
- Single Select: `#8b5cf6` (violet)
- Multi Select: `#a855f7` (purple)
- etc.

## Implementation Checklist

When creating a new form builder, ensure you have:

- [ ] Full-screen modal overlay (`fixed inset-0 z-50`)
- [ ] Clear header with title and step indicators
- [ ] Cancel and Save buttons in header
- [ ] Left sidebar with 400px width
- [ ] System Library section (collapsible, starts collapsed)
- [ ] Custom Fields section (always visible)
- [ ] Colorful palette items with field type icons
- [ ] Main canvas with max-width container
- [ ] Summary card at top of canvas
- [ ] Drop zone with visual feedback
- [ ] Sortable field cards with drag handles
- [ ] Library badge for system fields
- [ ] Field configuration modal
- [ ] Proper data-testid attributes on interactive elements

## Related Documentation

- [Data View Guidelines](./data_view_guidelines.md) - For table-based list views
- [System Field Library](./system_field_library.md) - Field library architecture
