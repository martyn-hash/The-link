import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { CalendarIcon, Check, X, ChevronDown } from 'lucide-react';
import type { Filter } from '../../CampaignWizard';

interface FilterInputControlProps {
  filter: Filter;
  filterDef: any;
  onUpdate: (updates: Partial<Filter>) => void;
  testId: string;
}

const OPERATOR_LABELS: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  in: 'includes any of',
  not_in: 'excludes all of',
  contains: 'contains',
  greater_than: 'greater than',
  less_than: 'less than',
  between: 'between',
  is_true: 'is true',
  is_false: 'is false',
  within_days: 'within',
  before: 'before',
  after: 'after',
  has_value: 'has value',
  no_value: 'has no value',
};

const DATE_PRESETS = [
  { label: 'Next 7 days', days: 7 },
  { label: 'Next 14 days', days: 14 },
  { label: 'Next 30 days', days: 30 },
  { label: 'Next 60 days', days: 60 },
  { label: 'Next 90 days', days: 90 },
];

export function FilterInputControl({ filter, filterDef, onUpdate, testId }: FilterInputControlProps) {
  const operators = filterDef?.operators || ['equals'];
  const valueType = filterDef?.valueType || 'text';

  const { data: filterOptions } = useQuery<any[]>({
    queryKey: ['/api/campaign-targeting/filter-options', filter.filterType],
    enabled: !!filter.filterType && ['select', 'multi_select', 'service', 'project_type', 'stage', 'user', 'tag'].includes(valueType),
  });

  const renderOperatorSelect = () => (
    <Select
      value={filter.operator}
      onValueChange={(value) => onUpdate({ operator: value })}
    >
      <SelectTrigger className="w-[140px]" data-testid={`${testId}-operator`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {operators.map((op: string) => (
          <SelectItem key={op} value={op}>
            {OPERATOR_LABELS[op] || op}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  switch (valueType) {
    case 'boolean':
      return (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={filter.value === true}
              onCheckedChange={(checked) => onUpdate({ value: checked })}
              data-testid={`${testId}-value`}
            />
            <span className="text-sm text-muted-foreground">
              {filter.value === true ? 'Yes - include clients with this condition' : 'No - exclude clients with this condition'}
            </span>
          </div>
        </div>
      );

    case 'service':
    case 'multi_select':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {renderOperatorSelect()}
          </div>
          <MultiSelectInput
            options={filterOptions || []}
            value={Array.isArray(filter.value) ? filter.value : filter.value ? [filter.value] : []}
            onChange={(values) => onUpdate({ value: values })}
            placeholder={`Select ${filterDef?.label?.toLowerCase() || 'options'}...`}
            testId={`${testId}-value`}
          />
        </div>
      );

    case 'service_pair':
      return (
        <ServicePairInput
          value={filter.value || { has: [], notHas: [] }}
          onChange={(value) => onUpdate({ value })}
          options={filterOptions || []}
          testId={testId}
        />
      );

    case 'project_type':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {renderOperatorSelect()}
          </div>
          <MultiSelectInput
            options={filterOptions || []}
            value={Array.isArray(filter.value) ? filter.value : filter.value ? [filter.value] : []}
            onChange={(values) => onUpdate({ value: values })}
            placeholder="Select project types..."
            testId={`${testId}-value`}
          />
        </div>
      );

    case 'stage':
      return (
        <StageSelectInput
          value={filter.value || { projectTypeId: null, stages: [] }}
          onChange={(value) => onUpdate({ value })}
          testId={testId}
        />
      );

    case 'user':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {renderOperatorSelect()}
          </div>
          <MultiSelectInput
            options={filterOptions || []}
            value={Array.isArray(filter.value) ? filter.value : filter.value ? [filter.value] : []}
            onChange={(values) => onUpdate({ value: values })}
            placeholder="Select team members..."
            testId={`${testId}-value`}
          />
        </div>
      );

    case 'tag':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {renderOperatorSelect()}
          </div>
          <MultiSelectInput
            options={filterOptions || []}
            value={Array.isArray(filter.value) ? filter.value : filter.value ? [filter.value] : []}
            onChange={(values) => onUpdate({ value: values })}
            placeholder="Select tags..."
            testId={`${testId}-value`}
          />
        </div>
      );

    case 'date_range':
      return (
        <DateRangeInput
          value={filter.value || { start: null, end: null }}
          onChange={(value) => onUpdate({ value })}
          testId={testId}
        />
      );

    case 'days':
    case 'number':
      return (
        <div className="flex items-center gap-3">
          {renderOperatorSelect()}
          <div className="flex items-center gap-2 flex-1">
            <Input
              type="number"
              value={filter.value || ''}
              onChange={(e) => onUpdate({ value: e.target.value ? parseInt(e.target.value) : null })}
              placeholder={valueType === 'days' ? 'Number of days' : 'Enter number'}
              className="w-32"
              min={0}
              data-testid={`${testId}-value`}
            />
            {valueType === 'days' && (
              <span className="text-sm text-muted-foreground">days</span>
            )}
          </div>
        </div>
      );

    case 'range':
      return (
        <RangeInput
          value={filter.value || { min: 0, max: 100 }}
          onChange={(value) => onUpdate({ value })}
          min={filterDef?.min || 0}
          max={filterDef?.max || 100}
          testId={testId}
        />
      );

    case 'select':
      return (
        <div className="flex items-center gap-3">
          {renderOperatorSelect()}
          <Select
            value={filter.value || ''}
            onValueChange={(value) => onUpdate({ value })}
          >
            <SelectTrigger className="flex-1" data-testid={`${testId}-value`}>
              <SelectValue placeholder="Select value..." />
            </SelectTrigger>
            <SelectContent>
              {(filterOptions || []).map((opt: any) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'udf_dropdown':
      return (
        <UdfDropdownInput
          filter={filter}
          filterDef={filterDef}
          onUpdate={onUpdate}
          testId={testId}
        />
      );

    case 'udf_boolean':
      return (
        <div className="flex items-center gap-3">
          <Select
            value={filter.operator}
            onValueChange={(value) => onUpdate({ operator: value })}
          >
            <SelectTrigger className="w-[160px]" data-testid={`${testId}-operator`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="has_value">Has a value</SelectItem>
              <SelectItem value="no_value">Has no value</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return (
        <div className="flex items-center gap-3">
          {renderOperatorSelect()}
          <Input
            value={filter.value || ''}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Enter value..."
            className="flex-1"
            data-testid={`${testId}-value`}
          />
        </div>
      );
  }
}

interface MultiSelectInputProps {
  options: any[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  testId: string;
}

function MultiSelectInput({ options, value, onChange, placeholder, testId }: MultiSelectInputProps) {
  const [open, setOpen] = useState(false);

  const selectedLabels = value.map(v => {
    const opt = options.find(o => o.value === v);
    return opt?.label || v;
  });

  const toggleOption = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter(v => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  const removeOption = (optValue: string) => {
    onChange(value.filter(v => v !== optValue));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between min-h-[40px] h-auto"
          data-testid={testId}
        >
          <div className="flex flex-wrap gap-1 flex-1 text-left">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedLabels.map((label, i) => (
                <Badge key={value[i]} variant="secondary" className="mr-1">
                  {label}
                  <button
                    className="ml-1 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOption(value[i]);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => toggleOption(option.value)}
                >
                  <div className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                    value.includes(option.value)
                      ? "bg-primary text-primary-foreground"
                      : "opacity-50"
                  )}>
                    {value.includes(option.value) && <Check className="h-3 w-3" />}
                  </div>
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface ServicePairInputProps {
  value: { has: string[]; notHas: string[] };
  onChange: (value: { has: string[]; notHas: string[] }) => void;
  options: any[];
  testId: string;
}

function ServicePairInput({ value, onChange, options, testId }: ServicePairInputProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Has these services</Label>
        <MultiSelectInput
          options={options}
          value={value.has}
          onChange={(has) => onChange({ ...value, has })}
          placeholder="Select services client must have..."
          testId={`${testId}-has`}
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">But NOT these services</Label>
        <MultiSelectInput
          options={options.filter(o => !value.has.includes(o.value))}
          value={value.notHas}
          onChange={(notHas) => onChange({ ...value, notHas })}
          placeholder="Select services client must not have..."
          testId={`${testId}-not-has`}
        />
      </div>
    </div>
  );
}

interface StageSelectInputProps {
  value: { projectTypeId: string | null; stages: string[] };
  onChange: (value: { projectTypeId: string | null; stages: string[] }) => void;
  testId: string;
}

function StageSelectInput({ value, onChange, testId }: StageSelectInputProps) {
  const { data: projectTypes } = useQuery<any[]>({
    queryKey: ['/api/campaign-targeting/filter-options', 'project_type'],
  });

  const { data: stages } = useQuery<any[]>({
    queryKey: ['/api/campaign-targeting/filter-options', 'stage', value.projectTypeId],
    enabled: !!value.projectTypeId,
  });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Project Type</Label>
        <Select
          value={value.projectTypeId || ''}
          onValueChange={(v) => onChange({ projectTypeId: v, stages: [] })}
        >
          <SelectTrigger data-testid={`${testId}-project-type`}>
            <SelectValue placeholder="Select project type first..." />
          </SelectTrigger>
          <SelectContent>
            {(projectTypes || []).map((pt: any) => (
              <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value.projectTypeId && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Stages</Label>
          <MultiSelectInput
            options={stages || []}
            value={value.stages}
            onChange={(stages) => onChange({ ...value, stages })}
            placeholder="Select stages..."
            testId={`${testId}-stages`}
          />
        </div>
      )}
    </div>
  );
}

interface DateRangeInputProps {
  value: { start: Date | null; end: Date | null } | { preset: number };
  onChange: (value: { start: Date | null; end: Date | null } | { preset: number }) => void;
  testId: string;
}

function DateRangeInput({ value, onChange, testId }: DateRangeInputProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset' in value ? 'preset' : 'custom');

  const handlePresetClick = (days: number) => {
    onChange({ preset: days });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {DATE_PRESETS.map((preset) => (
          <Button
            key={preset.days}
            variant={'preset' in value && value.preset === preset.days ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(preset.days)}
            data-testid={`${testId}-preset-${preset.days}`}
          >
            {preset.label}
          </Button>
        ))}
        <Button
          variant={mode === 'custom' && !('preset' in value) ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setMode('custom');
            onChange({ start: new Date(), end: addDays(new Date(), 30) });
          }}
        >
          Custom
        </Button>
      </div>

      {mode === 'custom' && !('preset' in value) && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.start ? format(value.start, 'MMM d, yyyy') : 'Start date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.start || undefined}
                onSelect={(date) => onChange({ ...value, start: date || null })}
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.end ? format(value.end, 'MMM d, yyyy') : 'End date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.end || undefined}
                onSelect={(date) => onChange({ ...value, end: date || null })}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

interface RangeInputProps {
  value: { min: number; max: number };
  onChange: (value: { min: number; max: number }) => void;
  min: number;
  max: number;
  testId: string;
}

function RangeInput({ value, onChange, min, max, testId }: RangeInputProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Slider
            value={[value.min, value.max]}
            onValueChange={([newMin, newMax]) => onChange({ min: newMin, max: newMax })}
            min={min}
            max={max}
            step={1}
            data-testid={`${testId}-slider`}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Min:</Label>
          <Input
            type="number"
            value={value.min}
            onChange={(e) => onChange({ ...value, min: parseInt(e.target.value) || 0 })}
            className="w-20 h-8"
            min={min}
            max={value.max}
            data-testid={`${testId}-min`}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Max:</Label>
          <Input
            type="number"
            value={value.max}
            onChange={(e) => onChange({ ...value, max: parseInt(e.target.value) || 100 })}
            className="w-20 h-8"
            min={value.min}
            max={max}
            data-testid={`${testId}-max`}
          />
        </div>
      </div>
    </div>
  );
}

interface UdfDropdownInputProps {
  filter: Filter;
  filterDef: any;
  onUpdate: (updates: Partial<Filter>) => void;
  testId: string;
}

function UdfDropdownInput({ filter, filterDef, onUpdate, testId }: UdfDropdownInputProps) {
  const options = filterDef?.options || [];

  return (
    <div className="flex items-center gap-3">
      <Select
        value={filter.operator}
        onValueChange={(value) => onUpdate({ operator: value })}
      >
        <SelectTrigger className="w-[140px]" data-testid={`${testId}-operator`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="equals">is set to</SelectItem>
          <SelectItem value="not_equals">is not set to</SelectItem>
          <SelectItem value="no_value">is blank</SelectItem>
        </SelectContent>
      </Select>
      
      {filter.operator !== 'no_value' && (
        <Select
          value={filter.value || ''}
          onValueChange={(value) => onUpdate({ value })}
        >
          <SelectTrigger className="flex-1" data-testid={`${testId}-value`}>
            <SelectValue placeholder="Select value..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt: any) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
