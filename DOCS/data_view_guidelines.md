# Data View Guidelines

This document explains the table-based data view pattern used throughout the application, specifically demonstrated in the Services tab. Use this as a reference when creating similar list views.

## Core Pattern Overview

The data view pattern creates clean, tightly-spaced table rows with consistent column layout and actions. Each row represents one data item with multiple columns displaying related information.

## Key Components

### 1. Table Structure
```tsx
<div className="border rounded-lg">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Column 1</TableHead>
        <TableHead>Column 2</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item) => (
        <YourRowComponent key={item.id} item={item} />
      ))}
    </TableBody>
  </Table>
</div>
```

**Key Features:**
- Wrapped in `border rounded-lg` div for clean edges
- Uses shadcn `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` components
- Actions column aligned right with `className="text-right"`

### 2. Row Component Pattern

Create a dedicated row component for each data type:

```tsx
function YourDataRow({ item }: { item: YourDataType }) {
  return (
    <TableRow data-testid={`row-${item.id}`}>
      <TableCell className="font-medium">
        {/* Primary identifier - bold */}
        <span data-testid={`text-name-${item.id}`}>
          {item.name}
        </span>
      </TableCell>
      
      <TableCell>
        {/* Secondary data - normal weight */}
        <span className="text-sm" data-testid={`text-category-${item.id}`}>
          {item.category || '-'}
        </span>
      </TableCell>
      
      <TableCell className="text-right">
        {/* Action buttons */}
        <Button
          variant="default"
          size="sm"
          onClick={() => handleView(item.id)}
          data-testid={`button-view-${item.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
```

### 3. Styling Guidelines

#### Cell Content
- **Primary column** (usually first): `className="font-medium"` for emphasis
- **Secondary columns**: `className="text-sm"` for compact display
- **Empty values**: Use `-` with `className="text-muted-foreground"`

#### Text and Icons
- Service names, identifiers: Regular text, bolded via `font-medium`
- Dates: Format with utility function (e.g., `formatDate()`)
- Icons: `className="h-4 w-4"` for consistent sizing

#### Badges
For status indicators or tags within cells:
```tsx
<Badge variant="secondary" className="bg-blue-500 text-white text-xs">
  Tag Name
</Badge>
```

### 4. View Button Pattern

The standard view/action button appears in the rightmost column:

```tsx
<TableCell className="text-right">
  <Button
    variant="default"
    size="sm"
    onClick={() => navigate(`/path/${item.id}`)}
    data-testid={`button-view-${item.id}`}
  >
    <Eye className="h-4 w-4 mr-2" />
    View
  </Button>
</TableCell>
```

**Variations:**
- **Icon only** (for tighter spacing): Remove text, use `size="icon"`, `variant="ghost"`
- **Multiple actions**: Group buttons with flex layout
- **Dropdown menu**: Use DropdownMenu for 3+ actions

### 5. Responsive Considerations

- Keep columns concise for mobile viewability
- Hide less critical columns on small screens using responsive classes
- Consider accordion pattern for complex nested data (see Personal Services example)

### 6. Active/Inactive Separation

When data has active/inactive states:

```tsx
<div className="space-y-6">
  {/* Active Items */}
  {activeItems.length > 0 && (
    <div>
      <h4 className="font-medium text-sm text-muted-foreground mb-3">
        Active Services
      </h4>
      <div className="border rounded-lg">
        <Table>{/* ... */}</Table>
      </div>
    </div>
  )}
  
  {/* Inactive Items */}
  {inactiveItems.length > 0 && (
    <div>
      <h4 className="font-medium text-sm text-muted-foreground mb-3">
        Inactive Services
      </h4>
      <div className="border rounded-lg opacity-60">
        <Table>{/* ... */}</Table>
      </div>
    </div>
  )}
</div>
```

**Key points:**
- Section headers: `font-medium text-sm text-muted-foreground mb-3`
- Inactive table wrapped with `opacity-60` for visual distinction
- Vertical spacing: `space-y-6` between sections

### 7. Data Display Best Practices

#### Formatting
- **Dates**: Use consistent date formatter (e.g., "15 Oct 2025")
- **Empty data**: Show `-` instead of empty cells
- **Long text**: Use `line-clamp-1` or `truncate` utilities
- **Descriptions**: `text-xs text-muted-foreground mt-1`

#### Data Testids
Always include for testing:
- Row: `data-testid="row-{id}"`
- Primary text: `data-testid="text-name-{id}"`
- Buttons: `data-testid="button-view-{id}"`
- Dynamic content: `data-testid="text-{field}-{id}"`

## Reference Implementation

See `client/src/pages/client-detail.tsx` for the complete implementation:
- `ClientServiceRow` component (lines 6044-6133)
- Active Services table (lines 7255-7278)
- Table header structure (lines 7258-7266)

## Common Patterns

### Pattern 1: Simple List View
One row per item, 3-5 columns, view button on the right.

**Use for:** Services, Templates, Categories, Roles

### Pattern 2: Grouped View  
Separate active/inactive with section headers.

**Use for:** Client Services, Scheduled Services

### Pattern 3: Expandable Row
Accordion-style for complex nested data.

**Use for:** Personal Services with details

## Quick Checklist

When creating a new data view:
- [ ] Use `border rounded-lg` wrapper
- [ ] First column has `font-medium`
- [ ] Empty values show `-` 
- [ ] View button is `variant="default" size="sm"`
- [ ] All interactive elements have `data-testid`
- [ ] Dates are formatted consistently
- [ ] Actions column aligned right
- [ ] Icons are `h-4 w-4`
- [ ] Text uses appropriate sizing (`text-sm`, `text-xs`)

## Spacing Secrets

The "tightness" comes from:
1. **No extra padding**: Default table cell padding only
2. **Consistent text sizing**: `text-sm` for most content
3. **Compact badges**: `text-xs` for tags/labels
4. **Icon sizing**: Uniform `h-4 w-4` or `h-3 w-3`
5. **Line clamping**: Prevents text from expanding rows
6. **Border containment**: Single border on wrapper, not individual rows
