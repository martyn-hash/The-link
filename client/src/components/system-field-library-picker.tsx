import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Library, Type, FileText, Hash, Calendar, ToggleLeft, List, CheckSquare,
  Mail, Phone, Link2, DollarSign, Percent, User, Upload, Image
} from "lucide-react";
import type { SystemFieldLibrary } from "@shared/schema";

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  short_text: Type,
  long_text: FileText,
  number: Hash,
  boolean: ToggleLeft,
  date: Calendar,
  single_select: List,
  multi_select: CheckSquare,
  email: Mail,
  phone: Phone,
  url: Link2,
  currency: DollarSign,
  percentage: Percent,
  user_select: User,
  file_upload: Upload,
  image_upload: Image,
};

const FIELD_TYPE_COLORS: Record<string, string> = {
  short_text: "#3b82f6",
  long_text: "#8b5cf6",
  number: "#22c55e",
  boolean: "#84cc16",
  date: "#f59e0b",
  single_select: "#ec4899",
  multi_select: "#14b8a6",
  email: "#6366f1",
  phone: "#0ea5e9",
  url: "#8b5cf6",
  currency: "#10b981",
  percentage: "#f97316",
  user_select: "#a855f7",
  file_upload: "#64748b",
  image_upload: "#0ea5e9",
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  number: "Number",
  boolean: "Yes/No",
  date: "Date",
  single_select: "Single Select",
  multi_select: "Multi Select",
  email: "Email",
  phone: "Phone",
  url: "URL",
  currency: "Currency",
  percentage: "Percentage",
  user_select: "User Select",
  file_upload: "File Upload",
  image_upload: "Image Upload",
};

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  contact: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  financial: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  compliance: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  documentation: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  scheduling: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  custom: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
};

interface SystemFieldLibraryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectField: (field: SystemFieldLibrary) => void;
  allowedFieldTypes?: string[];
  title?: string;
  description?: string;
}

export function SystemFieldLibraryPicker({
  open,
  onOpenChange,
  onSelectField,
  allowedFieldTypes,
  title = "Pick from System Field Library",
  description = "Select a pre-defined field from your company's field library",
}: SystemFieldLibraryPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: fields = [], isLoading } = useQuery<SystemFieldLibrary[]>({
    queryKey: ["/api/system-field-library", { isArchived: false }],
    enabled: open,
  });

  const filteredFields = useMemo(() => {
    let result = fields;

    if (allowedFieldTypes && allowedFieldTypes.length > 0) {
      result = result.filter(f => allowedFieldTypes.includes(f.fieldType));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f => 
        f.fieldName.toLowerCase().includes(query) ||
        (f.description && f.description.toLowerCase().includes(query))
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter(f => f.category === categoryFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter(f => f.fieldType === typeFilter);
    }

    return result;
  }, [fields, searchQuery, categoryFilter, typeFilter, allowedFieldTypes]);

  const handleSelect = (field: SystemFieldLibrary) => {
    onSelectField(field);
    onOpenChange(false);
    setSearchQuery("");
    setCategoryFilter("all");
    setTypeFilter("all");
  };

  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(fields.map(f => f.fieldType)));
    if (allowedFieldTypes) {
      return types.filter(t => allowedFieldTypes.includes(t));
    }
    return types;
  }, [fields, allowedFieldTypes]);

  const availableCategories = useMemo(() => {
    return Array.from(new Set(fields.map(f => f.category)));
  }, [fields]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="w-5 h-5 text-purple-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-library-fields"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-category-filter">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {availableCategories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {availableTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {FIELD_TYPE_LABELS[type] || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading fields...</div>
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Library className="w-12 h-12 text-muted-foreground mb-4" />
              <h4 className="font-medium text-muted-foreground mb-1">No fields found</h4>
              <p className="text-sm text-muted-foreground">
                {fields.length === 0 
                  ? "Create fields in the System Field Library first"
                  : "Try adjusting your search or filters"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFields.map(field => {
                const Icon = FIELD_TYPE_ICONS[field.fieldType] || Type;
                const color = FIELD_TYPE_COLORS[field.fieldType] || "#6b7280";
                const categoryColor = CATEGORY_COLORS[field.category] || CATEGORY_COLORS.general;

                return (
                  <button
                    key={field.id}
                    onClick={() => handleSelect(field)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all text-left group"
                    data-testid={`library-field-${field.id}`}
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{field.fieldName}</span>
                        {field.isRequired && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant="secondary" 
                          className="text-xs"
                          style={{ backgroundColor: `${color}15`, color }}
                        >
                          {FIELD_TYPE_LABELS[field.fieldType] || field.fieldType}
                        </Badge>
                        <Badge variant="secondary" className={`text-xs ${categoryColor}`}>
                          {field.category}
                        </Badge>
                        {field.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {field.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Select
                    </Button>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function getFieldTypeIcon(fieldType: string) {
  return FIELD_TYPE_ICONS[fieldType] || Type;
}

export function getFieldTypeColor(fieldType: string) {
  return FIELD_TYPE_COLORS[fieldType] || "#6b7280";
}

export function getFieldTypeLabel(fieldType: string) {
  return FIELD_TYPE_LABELS[fieldType] || fieldType;
}
