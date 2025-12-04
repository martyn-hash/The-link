import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { 
  Bell, 
  CheckSquare, 
  Mail, 
  MessageSquare, 
  Navigation, 
  Search,
  Check,
  X,
  Edit2,
  Loader2,
  User,
  Calendar,
  Clock,
  AlertCircle,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { AIFunctionCall } from './types';
import type { User as UserType } from '@shared/schema';

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  suggestedName?: string;
  icon?: JSX.Element;
  testId?: string;
}

function SearchableSelect({ 
  value, 
  onValueChange, 
  options, 
  placeholder, 
  suggestedName,
  icon,
  testId 
}: SearchableSelectProps) {
  const [searchValue, setSearchValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue), 200);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = debouncedSearch.length >= 1
    ? options.filter(o => o.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : options.slice(0, 10);

  const selectedOption = options.find(o => o.id === value);
  const displayValue = selectedOption?.name || (suggestedName ? `${suggestedName} (type to search)` : '');

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {icon && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <Input
          value={showDropdown ? searchValue : displayValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            if (!showDropdown) setShowDropdown(true);
          }}
          onFocus={() => {
            setShowDropdown(true);
            setSearchValue('');
          }}
          placeholder={placeholder}
          className={cn("h-8 text-sm", icon && "pl-8")}
          data-testid={testId}
        />
      </div>
      {showDropdown && (
        <div className="absolute z-[100] mt-1 w-full max-h-48 overflow-auto bg-popover border border-border rounded-md shadow-lg">
          <div
            className="px-3 py-2 text-sm cursor-pointer hover:bg-accent text-muted-foreground"
            onClick={() => {
              onValueChange('');
              setShowDropdown(false);
              setSearchValue('');
            }}
          >
            None
          </div>
          {filteredOptions.length === 0 && debouncedSearch.length >= 1 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches found</div>
          )}
          {filteredOptions.map((option) => (
            <div
              key={option.id}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer hover:bg-accent",
                option.id === value && "bg-accent"
              )}
              onClick={() => {
                onValueChange(option.id);
                setShowDropdown(false);
                setSearchValue('');
              }}
            >
              {option.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ActionCardProps {
  functionCall: AIFunctionCall;
  onComplete: (success: boolean, message: string) => void;
  onDismiss: () => void;
}

export function ReminderActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const args = functionCall.arguments;
  const suggestedClientName = args.clientName as string | undefined;
  const suggestedAssigneeName = args.assigneeName as string | undefined;
  
  const [title, setTitle] = useState(args.title as string || '');
  const [description, setDescription] = useState(args.details as string || '');
  const [clientId, setClientId] = useState<string | null>(null); // null = use AI suggestion, '' = explicitly cleared
  const [assigneeId, setAssigneeId] = useState<string | null>(null); // null = use AI suggestion, '' = explicitly cleared
  const [dueDate, setDueDate] = useState(() => {
    if (args.dateTime) {
      try {
        const date = new Date(args.dateTime as string);
        return format(date, 'yyyy-MM-dd');
      } catch { return ''; }
    }
    return '';
  });
  const [dueTime, setDueTime] = useState(() => {
    if (args.dateTime) {
      try {
        const date = new Date(args.dateTime as string);
        return format(date, 'HH:mm');
      } catch { return '09:00'; }
    }
    return '09:00';
  });
  const [isEditing, setIsEditing] = useState(false);

  const { data: clients } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/clients'],
  });

  const { data: staffMembers } = useQuery<UserType[]>({
    queryKey: ['/api/staff'],
  });

  const matchedClient = clients?.find(c => {
    const clientName = suggestedClientName?.toLowerCase() || '';
    return c.name.toLowerCase().includes(clientName) || clientName.includes(c.name.toLowerCase());
  });

  // Only try to match assignee if AI actually suggested a name (non-empty)
  const matchedAssignee = suggestedAssigneeName && suggestedAssigneeName.trim().length > 0
    ? staffMembers?.find(u => {
        const assigneeName = suggestedAssigneeName.toLowerCase().trim();
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().trim();
        return fullName.includes(assigneeName) || assigneeName.includes(fullName);
      })
    : undefined;

  // If clientId is null, use AI suggestion. If '', user explicitly cleared it.
  const effectiveClientId = clientId === null ? (matchedClient?.id || '') : clientId;
  // If assigneeId is null, use AI suggestion or default to current user. If '', user explicitly cleared it.
  const effectiveAssigneeId = assigneeId === null 
    ? (matchedAssignee?.id || user?.id || '') 
    : (assigneeId || user?.id || '');

  const isValid = title.trim().length > 0 && dueDate.length > 0 && dueTime.length > 0 && effectiveAssigneeId.length > 0;
  
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isValid) {
        throw new Error('Please fill in all required fields');
      }
      const dueDateTime = new Date(`${dueDate}T${dueTime}`);
      if (isNaN(dueDateTime.getTime())) {
        throw new Error('Invalid date/time');
      }
      
      const reminder = await apiRequest('POST', '/api/internal-tasks', {
        title: title.trim(),
        description: description?.trim() || undefined,
        dueDate: dueDateTime.toISOString(),
        assignedTo: effectiveAssigneeId,
        isQuickReminder: true,
        priority: 'medium',
      });
      
      if (effectiveClientId && reminder.id) {
        try {
          await apiRequest('POST', `/api/internal-tasks/${reminder.id}/connections`, {
            connections: [{ entityType: 'client', entityId: effectiveClientId }]
          });
        } catch (e) {
          console.warn('Failed to link client to reminder:', e);
        }
      }
      
      return reminder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: q => 
        typeof q.queryKey[0] === 'string' && 
        (q.queryKey[0].includes('reminder') || q.queryKey[0].includes('internal-task'))
      });
      toast({ title: 'Reminder created', description: `"${title}" has been set.` });
      onComplete(true, `Created reminder: "${title}"`);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      onComplete(false, error.message);
    }
  });
  
  const clientName = clients?.find(c => c.id === effectiveClientId)?.name 
    || (suggestedClientName ? `${suggestedClientName} (suggested)` : 'None');

  const assigneeName = staffMembers?.find(u => u.id === effectiveAssigneeId)
    ? `${staffMembers.find(u => u.id === effectiveAssigneeId)?.firstName} ${staffMembers.find(u => u.id === effectiveAssigneeId)?.lastName}`
    : (suggestedAssigneeName || 'Me');

  const formattedDateTime = dueDate && dueTime 
    ? format(new Date(`${dueDate}T${dueTime}`), "d MMM yyyy 'at' h:mm a")
    : 'Not set';
  
  const staffOptions = staffMembers?.map(u => ({
    id: u.id,
    name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown'
  })) || [];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-reminder"
    >
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <Bell className="w-4 h-4" />
        <span className="font-medium text-sm">Create Reminder</span>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="h-8 text-sm"
              data-testid="input-reminder-title"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Details (optional)</Label>
            <Textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="text-sm min-h-[60px]"
              data-testid="input-reminder-details"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input 
                type="date" 
                value={dueDate} 
                onChange={e => setDueDate(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-reminder-date"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Time</Label>
              <Input 
                type="time" 
                value={dueTime} 
                onChange={e => setDueTime(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-reminder-time"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Assign to {matchedAssignee ? '(AI suggested)' : ''}
            </Label>
            <SearchableSelect
              value={effectiveAssigneeId}
              onValueChange={setAssigneeId}
              options={staffOptions}
              placeholder="Type to search staff..."
              suggestedName={suggestedAssigneeName}
              icon={<User className="w-3 h-3" />}
              testId="search-reminder-assignee"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">
              Link to Client {matchedClient ? '(AI suggested)' : '(optional)'}
            </Label>
            <SearchableSelect
              value={effectiveClientId}
              onValueChange={setClientId}
              options={clients || []}
              placeholder="Type to search clients..."
              suggestedName={suggestedClientName}
              icon={<Building2 className="w-3 h-3" />}
              testId="search-reminder-client"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <div className="font-medium">{title || 'Untitled reminder'}</div>
          {description && <div className="text-muted-foreground text-xs">{description}</div>}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {formattedDateTime}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            {assigneeName}
          </div>
          {effectiveClientId && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="w-3 h-3" />
              {clientName}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => createMutation.mutate()}
          disabled={!isValid || createMutation.isPending}
          className="h-7 text-xs"
          data-testid="button-confirm-reminder"
        >
          {createMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <Check className="w-3 h-3 mr-1" />
          )}
          Create
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsEditing(!isEditing)}
          className="h-7 text-xs"
          data-testid="button-edit-reminder"
        >
          <Edit2 className="w-3 h-3 mr-1" />
          {isEditing ? 'Preview' : 'Edit'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 text-xs ml-auto"
          data-testid="button-dismiss-reminder"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}

export function TaskActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const { toast } = useToast();
  const args = functionCall.arguments;
  const suggestedTaskTypeName = args.taskTypeName as string | undefined;
  
  const [title, setTitle] = useState(args.title as string || '');
  const [description, setDescription] = useState(args.description as string || '');
  const [priority, setPriority] = useState<string>(() => {
    const p = (args.priority as string || 'medium').toLowerCase();
    return ['low', 'medium', 'high', 'urgent'].includes(p) ? p : 'medium';
  });
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [taskTypeId, setTaskTypeId] = useState<string>('');
  const [hasConfirmedType, setHasConfirmedType] = useState(false);
  const [dueDate, setDueDate] = useState(() => {
    if (args.dueDate) {
      try {
        const date = new Date(args.dueDate as string);
        if (!isNaN(date.getTime())) {
          return format(date, 'yyyy-MM-dd');
        }
      } catch { /* fall through */ }
    }
    return '';
  });
  const [isEditing, setIsEditing] = useState(false);

  const { data: users } = useQuery<UserType[]>({
    queryKey: ['/api/staff'],
  });

  const { data: taskTypes } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/task-types'],
  });
  
  // Try to match AI-suggested task type name to available types
  const matchedTaskType = taskTypes?.find(t => 
    t.name.toLowerCase() === suggestedTaskTypeName?.toLowerCase() ||
    t.name.toLowerCase().includes(suggestedTaskTypeName?.toLowerCase() || '') ||
    (suggestedTaskTypeName?.toLowerCase() || '').includes(t.name.toLowerCase())
  );
  
  // Pre-fill task type from AI suggestion if matched
  const effectiveTaskTypeId = taskTypeId || (matchedTaskType?.id ?? '');

  const matchedAssignee = users?.find(u => {
    const assigneeName = (args.assigneeName as string || '').toLowerCase();
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().trim();
    return fullName.includes(assigneeName) || assigneeName.includes(fullName);
  });

  const effectiveAssigneeId = assigneeId || matchedAssignee?.id || '';
  
  // Valid if we have a task type (either user-selected or AI-suggested)
  // The AI-suggested type is valid as long as it was matched from the available types
  const hasValidTaskType = effectiveTaskTypeId.length > 0;
  const isValid = title.trim().length > 0 && effectiveAssigneeId.length > 0 && hasValidTaskType;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isValid) {
        throw new Error('Please fill in all required fields');
      }
      if (!effectiveTaskTypeId) {
        throw new Error('Please select a task type');
      }
      
      return await apiRequest('POST', '/api/internal-tasks', {
        title: title.trim(),
        description: description?.trim() || undefined,
        taskTypeId: effectiveTaskTypeId,
        priority,
        status: 'open',
        assignedTo: effectiveAssigneeId,
        dueDate: dueDate || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: q => 
        typeof q.queryKey[0] === 'string' && q.queryKey[0].includes('internal-task')
      });
      toast({ title: 'Task created', description: `"${title}" has been created.` });
      onComplete(true, `Created task: "${title}"`);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      onComplete(false, error.message);
    }
  });

  const assigneeName = matchedAssignee 
    ? `${matchedAssignee.firstName} ${matchedAssignee.lastName}` 
    : args.assigneeName as string || 'Unassigned';
    
  const taskTypeName = taskTypes?.find(t => t.id === effectiveTaskTypeId)?.name 
    || (suggestedTaskTypeName ? `${suggestedTaskTypeName} (suggested)` : 'Not selected');
    
  const handleTaskTypeChange = (value: string) => {
    setTaskTypeId(value);
    setHasConfirmedType(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-task"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
          <CheckSquare className="w-4 h-4" />
          <span className="font-medium text-sm">Create Task</span>
        </div>
        {matchedTaskType && !hasConfirmedType && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Click Create to confirm
          </span>
        )}
        {!effectiveTaskTypeId && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Select a type to continue
          </span>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="h-8 text-sm"
              data-testid="input-task-title"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description (optional)</Label>
            <Textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="text-sm min-h-[60px]"
              data-testid="input-task-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">
                Task Type {matchedTaskType ? '(AI suggested)' : '*'}
              </Label>
              <Select value={effectiveTaskTypeId} onValueChange={handleTaskTypeChange}>
                <SelectTrigger className={cn("h-8 text-sm", !effectiveTaskTypeId && "border-amber-400")} data-testid="select-task-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {taskTypes?.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Assignee</Label>
              <Select value={effectiveAssigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-task-assignee">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {users?.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Due Date</Label>
              <Input 
                type="date" 
                value={dueDate} 
                onChange={e => setDueDate(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-task-due-date"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <div className="font-medium">{title || 'Untitled task'}</div>
          {description && <div className="text-muted-foreground text-xs">{description}</div>}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded bg-muted">
              {taskTypeName}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {assigneeName}
            </span>
            <span className={cn(
              "px-1.5 py-0.5 rounded text-xs",
              priority === 'urgent' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              priority === 'high' && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
              priority === 'medium' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
              priority === 'low' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            )}>
              {priority}
            </span>
            {dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(dueDate), 'd MMM')}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => createMutation.mutate()}
          disabled={!isValid || createMutation.isPending}
          className="h-7 text-xs"
          data-testid="button-confirm-task"
        >
          {createMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <Check className="w-3 h-3 mr-1" />
          )}
          Create
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsEditing(!isEditing)}
          className="h-7 text-xs"
          data-testid="button-edit-task"
        >
          <Edit2 className="w-3 h-3 mr-1" />
          {isEditing ? 'Preview' : 'Edit'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 text-xs ml-auto"
          data-testid="button-dismiss-task"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}

export function NavigationActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const args = functionCall.arguments;
  const isClient = functionCall.name === 'navigate_to_client';
  const entityName = isClient ? args.clientName : args.personName;
  const entityId = isClient ? args.clientId : args.personId;
  const navigatedRef = useRef(false);
  const [status, setStatus] = useState<'searching' | 'navigating' | 'not_found'>('searching');

  useEffect(() => {
    if (navigatedRef.current) return;
    
    const timer = setTimeout(() => {
      if (entityId) {
        navigatedRef.current = true;
        setStatus('navigating');
        const path = isClient ? `/clients/${entityId}` : `/people/${entityId}`;
        setLocation(path);
        onComplete(true, `Navigating to ${entityName}...`);
      } else {
        setStatus('not_found');
        toast({ 
          title: 'Not found', 
          description: `Could not find ${isClient ? 'client' : 'person'} "${entityName}"`,
          variant: 'destructive'
        });
        onComplete(false, `Could not find ${entityName}`);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [entityId, entityName, isClient, setLocation, onComplete, toast]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-navigate"
    >
      <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
        {status === 'not_found' ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        <span className="font-medium text-sm">
          {status === 'not_found' 
            ? `${isClient ? 'Client' : 'Person'} not found`
            : `Opening ${isClient ? 'Client' : 'Person'}...`}
        </span>
      </div>

      <div className="text-sm font-medium">
        {String(entityName || 'Unknown')}
      </div>
    </motion.div>
  );
}

export function ShowTasksActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const [, setLocation] = useLocation();
  const args = functionCall.arguments;
  const assigneeName = args.assigneeName as string | undefined;
  const rawStatus = args.status as string | undefined;
  const navigatedRef = useRef(false);
  
  const validStatuses = ['all', 'open', 'in_progress', 'closed'];
  const status = rawStatus && validStatuses.includes(rawStatus.toLowerCase()) 
    ? rawStatus.toLowerCase() 
    : 'all';

  const getDescription = () => {
    const parts: string[] = [];
    if (assigneeName) {
      parts.push(`For: ${assigneeName === 'me' ? 'You' : assigneeName}`);
    }
    if (rawStatus && status !== 'all') {
      parts.push(`Status: ${status.replace('_', ' ')}`);
    }
    return parts.length > 0 ? parts.join(' • ') : 'View all your tasks';
  };

  useEffect(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    
    const timer = setTimeout(() => {
      const path = `/internal-tasks?tab=tasks&status=${encodeURIComponent(status)}`;
      setLocation(path);
      onComplete(true, 'Navigating to tasks...');
    }, 400);
    return () => clearTimeout(timer);
  }, [status, setLocation, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-show-tasks"
    >
      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="font-medium text-sm">Opening Tasks...</span>
      </div>

      <div className="text-sm text-muted-foreground">
        {getDescription()}
      </div>
    </motion.div>
  );
}

export function ShowRemindersActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const [, setLocation] = useLocation();
  const args = functionCall.arguments;
  const rawTimeframe = args.timeframe as string | undefined;
  const navigatedRef = useRef(false);
  
  const validTimeframes = ['overdue', 'today', 'this_week', 'all'];
  const timeframe = rawTimeframe && validTimeframes.includes(rawTimeframe.toLowerCase())
    ? rawTimeframe.toLowerCase()
    : 'all';

  const getDescription = () => {
    if (timeframe === 'overdue') return 'Overdue reminders';
    if (timeframe === 'today') return "Today's reminders";
    if (timeframe === 'this_week') return "This week's reminders";
    return 'View all your reminders';
  };

  useEffect(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    
    const timer = setTimeout(() => {
      let path = '/internal-tasks?tab=reminders';
      if (timeframe === 'overdue') {
        path += '&filter=overdue';
      }
      setLocation(path);
      onComplete(true, 'Navigating to reminders...');
    }, 400);
    return () => clearTimeout(timer);
  }, [timeframe, setLocation, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-show-reminders"
    >
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="font-medium text-sm">Opening Reminders...</span>
      </div>

      <div className="text-sm text-muted-foreground">
        {getDescription()}
      </div>
    </motion.div>
  );
}

export function SearchClientsActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const [, setLocation] = useLocation();
  const args = functionCall.arguments;
  const searchTerm = args.searchTerm as string || '';
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    
    const timer = setTimeout(() => {
      const path = `/clients?search=${encodeURIComponent(searchTerm)}`;
      setLocation(path);
      onComplete(true, `Searching for "${searchTerm}"...`);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, setLocation, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-search-clients"
    >
      <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="font-medium text-sm">Searching Clients...</span>
      </div>

      <div className="text-sm">
        <span className="text-muted-foreground">Looking for: </span>
        <span className="font-medium">"{searchTerm}"</span>
      </div>
    </motion.div>
  );
}

export function EmailActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const { toast } = useToast();
  const args = functionCall.arguments;
  
  const [subject, setSubject] = useState(args.subject as string || '');
  const [body, setBody] = useState(args.body as string || '');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');

  const recipientName = args.recipientName as string || 'Unknown';
  const suggestedClientName = args.clientName as string | undefined;

  const { data: people } = useQuery<{ id: string; firstName: string | null; lastName: string | null; email: string | null; clientId: string }[]>({
    queryKey: ['/api/people'],
  });

  const { data: clients } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/clients'],
  });

  const matchedPerson = people?.find(p => {
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().trim();
    const searchName = recipientName.toLowerCase().trim();
    return fullName.includes(searchName) || searchName.includes(fullName);
  });

  const effectivePersonId = selectedPersonId || matchedPerson?.id || '';
  const selectedPerson = people?.find(p => p.id === effectivePersonId);
  const personClient = clients?.find(c => c.id === selectedPerson?.clientId);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPerson?.email) {
        throw new Error('No email address found for this person');
      }
      const response = await apiRequest('POST', '/api/email/send', {
        to: selectedPerson.email,
        subject,
        content: body,
        isHtml: false,
        clientId: selectedPerson.clientId,
        personId: selectedPerson.id
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: 'Email sent!', description: `Email sent to ${selectedPerson?.email}` });
      onComplete(true, `Email sent to ${recipientName}`);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to send email', description: error.message, variant: 'destructive' });
    }
  });

  const isValid = subject.trim().length > 0 && body.trim().length > 0 && selectedPerson?.email;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border border-sky-200 dark:border-sky-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-email"
    >
      <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
        <Mail className="w-4 h-4" />
        <span className="font-medium text-sm">Send Email</span>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">
              To {matchedPerson ? '(AI suggested)' : ''}
            </Label>
            <SearchableSelect
              value={effectivePersonId}
              onValueChange={setSelectedPersonId}
              options={(people || []).filter(p => p.email).map(p => ({
                id: p.id,
                name: `${p.firstName || ''} ${p.lastName || ''} (${p.email})`
              }))}
              placeholder="Type to search contacts with email..."
              suggestedName={recipientName}
              icon={<User className="w-3 h-3" />}
              testId="search-email-recipient"
            />
            {selectedPerson && !selectedPerson.email && (
              <div className="text-xs text-amber-600 mt-1">This person has no email address</div>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input 
              value={subject} 
              onChange={e => setSubject(e.target.value)}
              className="h-8 text-sm"
              data-testid="input-email-subject"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Message</Label>
            <Textarea 
              value={body} 
              onChange={e => setBody(e.target.value)}
              className="text-sm min-h-[80px]"
              data-testid="input-email-body"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">To:</span>
            <span className="font-medium">
              {selectedPerson ? `${selectedPerson.firstName} ${selectedPerson.lastName}` : recipientName}
            </span>
            {selectedPerson?.email && <span className="text-xs text-muted-foreground">({selectedPerson.email})</span>}
            {!selectedPerson && <span className="text-xs text-amber-600">(no match found - click Edit)</span>}
            {selectedPerson && !selectedPerson.email && <span className="text-xs text-amber-600">(no email)</span>}
          </div>
          {personClient && (
            <div className="text-xs text-muted-foreground">{personClient.name}</div>
          )}
          {subject && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Subject:</span>
              <span>{subject}</span>
            </div>
          )}
          {body && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {body}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => sendMutation.mutate()}
          disabled={!isValid || sendMutation.isPending}
          className="h-7 text-xs bg-sky-600 hover:bg-sky-700"
          data-testid="button-confirm-email"
        >
          {sendMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <Mail className="w-3 h-3 mr-1" />
          )}
          Send Email
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsEditing(!isEditing)}
          className="h-7 text-xs"
          data-testid="button-edit-email"
        >
          <Edit2 className="w-3 h-3 mr-1" />
          {isEditing ? 'Preview' : 'Edit'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 text-xs ml-auto"
          data-testid="button-dismiss-email"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}

export function SmsActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const { toast } = useToast();
  const args = functionCall.arguments;
  
  const [message, setMessage] = useState(args.message as string || '');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');

  const recipientName = args.recipientName as string || 'Unknown';
  const suggestedClientName = args.clientName as string | undefined;

  const { data: people } = useQuery<{ id: string; firstName: string | null; lastName: string | null; mobile: string | null; clientId: string }[]>({
    queryKey: ['/api/people'],
  });

  const { data: clients } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/clients'],
  });

  const matchedPerson = people?.find(p => {
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().trim();
    const searchName = recipientName.toLowerCase().trim();
    return fullName.includes(searchName) || searchName.includes(fullName);
  });

  const effectivePersonId = selectedPersonId || matchedPerson?.id || '';
  const selectedPerson = people?.find(p => p.id === effectivePersonId);
  const personClient = clients?.find(c => c.id === selectedPerson?.clientId);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPerson?.mobile) {
        throw new Error('No mobile number found for this person');
      }
      if (!selectedPerson?.clientId) {
        throw new Error('Person must be linked to a client to send SMS');
      }
      const response = await apiRequest('POST', '/api/sms/send', {
        to: selectedPerson.mobile,
        message,
        clientId: selectedPerson.clientId,
        personId: selectedPerson.id
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: 'SMS sent!', description: `SMS sent to ${selectedPerson?.mobile}` });
      onComplete(true, `SMS sent to ${recipientName}`);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to send SMS', description: error.message, variant: 'destructive' });
    }
  });

  const isValid = message.trim().length > 0 && selectedPerson?.mobile && selectedPerson?.clientId;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-sms"
    >
      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
        <MessageSquare className="w-4 h-4" />
        <span className="font-medium text-sm">Send SMS</span>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">
              To {matchedPerson ? '(AI suggested)' : ''}
            </Label>
            <SearchableSelect
              value={effectivePersonId}
              onValueChange={setSelectedPersonId}
              options={(people || []).filter(p => p.mobile).map(p => ({
                id: p.id,
                name: `${p.firstName || ''} ${p.lastName || ''} (${p.mobile})`
              }))}
              placeholder="Type to search contacts with mobile..."
              suggestedName={recipientName}
              icon={<User className="w-3 h-3" />}
              testId="search-sms-recipient"
            />
            {selectedPerson && !selectedPerson.mobile && (
              <div className="text-xs text-amber-600 mt-1">This person has no mobile number</div>
            )}
            {selectedPerson && !selectedPerson.clientId && (
              <div className="text-xs text-amber-600 mt-1">Person must be linked to a client</div>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Message</Label>
            <Textarea 
              value={message} 
              onChange={e => setMessage(e.target.value)}
              className="text-sm min-h-[60px]"
              maxLength={160}
              data-testid="input-sms-message"
            />
            <div className="text-xs text-muted-foreground mt-1">
              {message.length}/160 characters
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">To:</span>
            <span className="font-medium">
              {selectedPerson ? `${selectedPerson.firstName} ${selectedPerson.lastName}` : recipientName}
            </span>
            {selectedPerson?.mobile && <span className="text-xs text-muted-foreground">({selectedPerson.mobile})</span>}
            {!selectedPerson && <span className="text-xs text-amber-600">(no match found - click Edit)</span>}
            {selectedPerson && !selectedPerson.mobile && <span className="text-xs text-amber-600">(no mobile)</span>}
          </div>
          {personClient && (
            <div className="text-xs text-muted-foreground">{personClient.name}</div>
          )}
          {message && (
            <div className="text-xs text-muted-foreground mt-1">
              {message}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => sendMutation.mutate()}
          disabled={!isValid || sendMutation.isPending}
          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
          data-testid="button-confirm-sms"
        >
          {sendMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <MessageSquare className="w-3 h-3 mr-1" />
          )}
          Send SMS
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsEditing(!isEditing)}
          className="h-7 text-xs"
          data-testid="button-edit-sms"
        >
          <Edit2 className="w-3 h-3 mr-1" />
          {isEditing ? 'Preview' : 'Edit'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 text-xs ml-auto"
          data-testid="button-dismiss-sms"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}

export function ActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  switch (functionCall.name) {
    case 'create_reminder':
      return <ReminderActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'create_task':
      return <TaskActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'navigate_to_client':
    case 'navigate_to_person':
      return <NavigationActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'show_tasks':
      return <ShowTasksActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'show_reminders':
      return <ShowRemindersActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'search_clients':
      return <SearchClientsActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'send_email':
      return <EmailActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'send_sms':
      return <SmsActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    default:
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-muted/50 border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Unknown action: {functionCall.name}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-7 text-xs mt-2"
          >
            <X className="w-3 h-3 mr-1" />
            Dismiss
          </Button>
        </motion.div>
      );
  }
}
