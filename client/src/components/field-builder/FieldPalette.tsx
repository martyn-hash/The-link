import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDraggable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Search, Library, Sparkles, ChevronDown } from "lucide-react";
import { FIELD_TYPES, type SystemFieldType, getFieldTypeInfo } from "./types";
import type { SystemFieldLibrary } from "@shared/schema";

interface PaletteItemProps {
  type: string;
  label: string;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
  isLibrary?: boolean;
  disabled?: boolean;
  description?: string;
}

function PaletteItem({ 
  type, 
  label, 
  icon: Icon, 
  color, 
  onClick,
  isLibrary = false,
  disabled = false,
  description
}: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: isLibrary ? `library-${type}` : `palette-${type}`,
    data: { type, label, isNew: true, isLibrary },
    disabled,
  });

  const handleClick = (e: React.MouseEvent) => {
    if (onClick && !disabled) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...(disabled ? {} : listeners)}
      {...(disabled ? {} : attributes)}
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 bg-card border rounded-lg transition-all text-sm group",
        isDragging && "opacity-50 scale-95",
        disabled 
          ? "opacity-50 cursor-not-allowed" 
          : "cursor-pointer hover:bg-accent hover:border-primary hover:shadow-sm"
      )}
      data-testid={`palette-field-${type}`}
    >
      <div 
        className="w-8 h-8 rounded-md flex items-center justify-center transition-transform group-hover:scale-110 shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-medium truncate block">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground truncate block">{description}</span>
        )}
      </div>
      {!disabled && (
        <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </div>
  );
}

interface FieldPaletteProps {
  onAddField: (fieldType: SystemFieldType) => void;
  onOpenLibraryPicker?: () => void;
  libraryFields?: SystemFieldLibrary[];
  onAddLibraryField?: (field: SystemFieldLibrary) => void;
  allowedFieldTypes?: SystemFieldType[];
  showLibraryTab?: boolean;
  showSystemLibraryInline?: boolean;
  className?: string;
}

export function FieldPalette({
  onAddField,
  onOpenLibraryPicker,
  libraryFields = [],
  onAddLibraryField,
  allowedFieldTypes,
  showLibraryTab = true,
  showSystemLibraryInline = false,
  className
}: FieldPaletteProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"types" | "library">("types");
  const [isSystemLibraryExpanded, setIsSystemLibraryExpanded] = useState(false);

  const { data: systemFields = [] } = useQuery<SystemFieldLibrary[]>({
    queryKey: ["/api/system-field-library", { isArchived: false }],
    enabled: showSystemLibraryInline,
  });

  const allowedTypeStrings = allowedFieldTypes || FIELD_TYPES.map(ft => ft.type);

  const filteredSystemFields = systemFields.filter(f => 
    allowedTypeStrings.includes(f.fieldType as SystemFieldType) &&
    (!search || f.fieldName.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredFieldTypes = FIELD_TYPES.filter(ft => {
    if (allowedFieldTypes && !allowedFieldTypes.includes(ft.type)) return false;
    if (search && !ft.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredLibraryFields = libraryFields.filter(field => {
    if (search && !field.fieldName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const groupedFieldTypes = {
    basic: filteredFieldTypes.filter(ft => ft.category === "basic"),
    selection: filteredFieldTypes.filter(ft => ft.category === "selection"),
    contact: filteredFieldTypes.filter(ft => ft.category === "contact"),
    numeric: filteredFieldTypes.filter(ft => ft.category === "numeric"),
    files: filteredFieldTypes.filter(ft => ft.category === "files"),
  };

  const renderFieldTypesContent = () => (
    <>
      {Object.entries(groupedFieldTypes).map(([category, types]) => (
        types.length > 0 && (
          <div key={category}>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {category === "basic" ? "Basic" : 
               category === "selection" ? "Selection" :
               category === "contact" ? "Contact" :
               category === "numeric" ? "Numeric" : "Files"}
            </h4>
            <div className="space-y-2">
              {types.map((ft) => (
                <PaletteItem
                  key={ft.type}
                  type={ft.type}
                  label={ft.label}
                  icon={ft.icon}
                  color={ft.color}
                  onClick={() => onAddField(ft.type)}
                />
              ))}
            </div>
          </div>
        )
      ))}
    </>
  );

  if (showSystemLibraryInline) {
    return (
      <div className={cn("flex flex-col h-full bg-muted/30 border-r", className)}>
        <div className="p-4 border-b bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Field Palette</h3>
          </div>
          <p className="text-xs text-muted-foreground">Drag or click to add</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <Collapsible 
              open={isSystemLibraryExpanded} 
              onOpenChange={setIsSystemLibraryExpanded}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors" data-testid="collapsible-system-library">
                <div className="flex items-center gap-2">
                  <Library className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">System Library</span>
                  <Badge variant="secondary" className="bg-purple-200 text-purple-800 text-xs px-1.5 py-0">
                    {filteredSystemFields.length}
                  </Badge>
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-purple-600 transition-transform",
                  isSystemLibraryExpanded && "rotate-180"
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <p className="text-xs text-muted-foreground mb-3 px-1">
                  Click to browse reusable fields from the library
                </p>
                <div className="space-y-2">
                  {filteredSystemFields.slice(0, 10).map((field) => {
                    const typeInfo = getFieldTypeInfo(field.fieldType);
                    return (
                      <PaletteItem
                        key={field.id}
                        type={field.id}
                        label={field.fieldName}
                        description={field.description || undefined}
                        icon={typeInfo.icon}
                        color={typeInfo.color}
                        isLibrary
                        onClick={() => onAddLibraryField?.(field)}
                      />
                    );
                  })}
                  {filteredSystemFields.length > 10 && onOpenLibraryPicker && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                      onClick={onOpenLibraryPicker}
                    >
                      View all {filteredSystemFields.length} fields...
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Custom Fields</span>
              </div>
              {renderFieldTypesContent()}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-muted/30 border-r", className)}>
      <div className="p-4 border-b bg-card">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Add Fields
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-fields"
          />
        </div>
      </div>

      {showLibraryTab ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "types" | "library")} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-4 grid grid-cols-2">
            <TabsTrigger value="types" data-testid="tab-field-types">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Types
            </TabsTrigger>
            <TabsTrigger value="library" data-testid="tab-library-fields">
              <Library className="w-3.5 h-3.5 mr-1.5" />
              Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="types" className="flex-1 mt-0 p-0">
            <ScrollArea className="h-[calc(100%-2rem)]">
              <div className="p-4 space-y-4">
                {renderFieldTypesContent()}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="library" className="flex-1 mt-0 p-0">
            <ScrollArea className="h-[calc(100%-2rem)]">
              <div className="p-4 space-y-3">
                {onOpenLibraryPicker && (
                  <Button
                    variant="outline"
                    className="w-full bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
                    onClick={onOpenLibraryPicker}
                    data-testid="button-open-library-picker"
                  >
                    <Library className="w-4 h-4 mr-2" />
                    Browse Full Library
                  </Button>
                )}
                
                {filteredLibraryFields.length > 0 ? (
                  filteredLibraryFields.map((field) => {
                    const typeInfo = getFieldTypeInfo(field.fieldType);
                    return (
                      <PaletteItem
                        key={field.id}
                        type={field.id}
                        label={field.fieldName}
                        description={field.description || undefined}
                        icon={typeInfo.icon}
                        color={typeInfo.color}
                        isLibrary
                        onClick={() => onAddLibraryField?.(field)}
                      />
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Library className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No library fields yet</p>
                    <p className="text-xs mt-1">Create fields in the Field Library to reuse them here</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {onOpenLibraryPicker && (
              <Button
                variant="outline"
                className="w-full bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:text-purple-800 mb-4"
                onClick={onOpenLibraryPicker}
                data-testid="button-open-library-picker"
              >
                <Library className="w-4 h-4 mr-2" />
                Pick from Library
              </Button>
            )}
            {renderFieldTypesContent()}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
