import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowRight, 
  Check, 
  X, 
  AlertCircle, 
  Info,
  Wand2,
  RotateCcw,
  Save
} from "lucide-react";
import type { 
  FieldMapping, 
  FieldMappingDefinition,
} from "@shared/importTypes";
import { suggestFieldMapping } from "@shared/importTypes";

interface FieldMappingUIProps {
  sourceHeaders: string[];
  fieldDefinitions: FieldMappingDefinition[];
  initialMappings?: FieldMapping[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
  onConfirm: () => void;
  onBack?: () => void;
  sampleData?: Record<string, any>[];
}

export function FieldMappingUI({
  sourceHeaders,
  fieldDefinitions,
  initialMappings = [],
  onMappingsChange,
  onConfirm,
  onBack,
  sampleData = []
}: FieldMappingUIProps) {
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    initialMappings.forEach(m => {
      initial[m.sourceColumn] = m.targetField;
    });
    return initial;
  });

  const [hasAutoMapped, setHasAutoMapped] = useState(false);

  const groupedFields = useMemo(() => {
    const groups: Record<string, FieldMappingDefinition[]> = {};
    fieldDefinitions.forEach(field => {
      if (!groups[field.group]) {
        groups[field.group] = [];
      }
      groups[field.group].push(field);
    });
    return groups;
  }, [fieldDefinitions]);

  const mappedTargetFields = useMemo(() => {
    return new Set(Object.values(mappings).filter(v => v && v !== '_skip'));
  }, [mappings]);

  const requiredFields = useMemo(() => {
    return fieldDefinitions.filter(f => f.required).map(f => f.systemField);
  }, [fieldDefinitions]);

  const missingRequiredFields = useMemo(() => {
    return requiredFields.filter(field => !mappedTargetFields.has(field));
  }, [requiredFields, mappedTargetFields]);

  const autoSuggestMappings = () => {
    const newMappings: Record<string, string> = {};
    
    sourceHeaders.forEach(header => {
      const suggestion = suggestFieldMapping(header, fieldDefinitions);
      if (suggestion && !Object.values(newMappings).includes(suggestion)) {
        newMappings[header] = suggestion;
      }
    });
    
    setMappings(newMappings);
    setHasAutoMapped(true);
  };

  const resetMappings = () => {
    setMappings({});
    setHasAutoMapped(false);
  };

  useEffect(() => {
    const fieldMappings: FieldMapping[] = Object.entries(mappings)
      .filter(([_, target]) => target && target !== '_skip')
      .map(([source, target]) => ({
        sourceColumn: source,
        targetField: target,
        transformationType: 'none' as const
      }));
    onMappingsChange(fieldMappings);
  }, [mappings, onMappingsChange]);

  const handleMappingChange = (sourceColumn: string, targetField: string) => {
    setMappings(prev => ({
      ...prev,
      [sourceColumn]: targetField
    }));
  };

  const getFieldInfo = (fieldName: string): FieldMappingDefinition | undefined => {
    return fieldDefinitions.find(f => f.systemField === fieldName);
  };

  const getSampleValue = (header: string): string => {
    if (sampleData.length === 0) return '';
    const values = sampleData.slice(0, 3).map(row => row[header]).filter(v => v != null && v !== '');
    if (values.length === 0) return '(empty)';
    if (values.length === 1) return String(values[0]);
    return values.map(v => String(v)).join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Map Your Columns</h3>
          <p className="text-sm text-muted-foreground">
            Match your file columns to system fields. Required fields are marked with an asterisk.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetMappings}
            data-testid="button-reset-mappings"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={autoSuggestMappings}
            data-testid="button-auto-map"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Auto-Map
          </Button>
        </div>
      </div>

      {missingRequiredFields.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Missing Required Fields</AlertTitle>
          <AlertDescription>
            Please map the following required fields: {missingRequiredFields.map(f => {
              const info = getFieldInfo(f);
              return info?.label || f;
            }).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {hasAutoMapped && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Auto-Mapping Applied</AlertTitle>
          <AlertDescription>
            {Object.keys(mappings).length} columns were automatically matched based on their names. 
            Please review and adjust as needed.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Column Mappings</CardTitle>
          <CardDescription>
            Your file has {sourceHeaders.length} columns. Map each one to a system field or skip it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-4">
              {sourceHeaders.map((header, index) => {
                const currentMapping = mappings[header];
                const fieldInfo = currentMapping ? getFieldInfo(currentMapping) : null;
                const sampleValue = getSampleValue(header);
                
                return (
                  <div 
                    key={header}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    data-testid={`mapping-row-${index}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate" title={header}>
                          {header}
                        </span>
                        {sampleValue && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs truncate max-w-[120px]">
                                {sampleValue.length > 20 ? sampleValue.slice(0, 20) + '...' : sampleValue}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-xs">Sample: {sampleValue}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    
                    <div className="flex-1 min-w-0">
                      <Select
                        value={currentMapping || '_unmapped'}
                        onValueChange={(value) => handleMappingChange(header, value === '_unmapped' ? '' : value)}
                      >
                        <SelectTrigger 
                          className={`w-full ${currentMapping && currentMapping !== '_skip' ? 'border-green-500' : ''}`}
                          data-testid={`select-mapping-${index}`}
                        >
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_unmapped">
                            <span className="text-muted-foreground">-- Don't import --</span>
                          </SelectItem>
                          <SelectItem value="_skip">
                            <span className="text-muted-foreground italic">Skip this column</span>
                          </SelectItem>
                          <Separator className="my-1" />
                          {Object.entries(groupedFields).map(([group, fields]) => (
                            <div key={group}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                                {group}
                              </div>
                              {fields.map(field => {
                                const isAlreadyMapped = mappedTargetFields.has(field.systemField) && mappings[header] !== field.systemField;
                                return (
                                  <SelectItem 
                                    key={field.systemField} 
                                    value={field.systemField}
                                    disabled={isAlreadyMapped}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span>{field.label}</span>
                                      {field.required && <span className="text-destructive">*</span>}
                                      {isAlreadyMapped && (
                                        <Badge variant="outline" className="text-xs">mapped</Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="w-6 flex-shrink-0">
                      {currentMapping && currentMapping !== '_skip' && currentMapping !== '_unmapped' ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : currentMapping === '_skip' ? (
                        <X className="w-5 h-5 text-muted-foreground" />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mapping Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(mappings).filter(v => v && v !== '_skip' && v !== '_unmapped').length}
              </div>
              <div className="text-xs text-muted-foreground">Mapped</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <div className="text-2xl font-bold text-orange-600">
                {Object.values(mappings).filter(v => v === '_skip').length}
              </div>
              <div className="text-xs text-muted-foreground">Skipped</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <div className="text-2xl font-bold text-muted-foreground">
                {sourceHeaders.length - Object.keys(mappings).length}
              </div>
              <div className="text-xs text-muted-foreground">Unmapped</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <div className={`text-2xl font-bold ${missingRequiredFields.length > 0 ? 'text-destructive' : 'text-green-600'}`}>
                {requiredFields.length - missingRequiredFields.length}/{requiredFields.length}
              </div>
              <div className="text-xs text-muted-foreground">Required</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        {onBack && (
          <Button variant="outline" onClick={onBack} data-testid="button-back">
            Back
          </Button>
        )}
        <div className="flex-1" />
        <Button 
          onClick={onConfirm}
          disabled={missingRequiredFields.length > 0}
          data-testid="button-confirm-mapping"
        >
          Continue to Preview
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

export default FieldMappingUI;
