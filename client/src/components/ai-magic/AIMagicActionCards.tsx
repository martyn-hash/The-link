import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
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
  Building2,
  Briefcase,
  PauseCircle,
  PlayCircle,
  ArrowRightCircle,
  BarChart3,
  FileText,
  ChevronRight,
  ExternalLink,
  Phone,
  ClipboardList
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
import { getBestMatch } from '@/lib/peopleMatcher';
import { AIFunctionCall, ProjectMatchResponse, ProjectDetails, StageReasonsResponse, AnalyticsResult } from './types';
import { TasksRemindersModal } from './TasksRemindersModal';
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

// Person search result from /api/search
interface PersonSearchResult {
  id: string;
  type: 'person';
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: {
    clientId?: string;
    clientName?: string;
    primaryEmail?: string;
    primaryPhone?: string;
    phone?: string;
  };
}

interface RecipientSelectorProps {
  matchedPerson: { id: string; firstName: string | null; lastName: string | null; email?: string | null; telephone?: string | null } | null;
  matchedClientName: string;
  matchConfidence: number;
  originalName: string;
  contactType: 'email' | 'mobile';
  onPersonChange: (person: { id: string; firstName: string; lastName: string; email?: string; telephone?: string; clientId: string; clientName: string }) => void;
}

function RecipientSelector({
  matchedPerson,
  matchedClientName,
  matchConfidence,
  originalName,
  contactType,
  onPersonChange
}: RecipientSelectorProps) {
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue), 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsSearchMode(false);
        setSearchValue('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch search results
  const { data: searchResults, isLoading } = useQuery<{ people: PersonSearchResult[] }>({
    queryKey: ['/api/search', { q: debouncedSearch }],
    enabled: debouncedSearch.length >= 2,
  });

  // Filter to only show people with the required contact type
  const filteredResults = (searchResults?.people || []).filter(p => {
    if (contactType === 'email') {
      // Check both metadata.primaryEmail and subtitle (fallback) for email
      const email = p.metadata?.primaryEmail || p.subtitle;
      return email && email.trim() !== '';
    } else {
      return p.metadata?.primaryPhone && p.metadata.primaryPhone.trim() !== '';
    }
  });

  const handleSelectPerson = (person: PersonSearchResult) => {
    const nameParts = person.title.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    onPersonChange({
      id: person.id,
      firstName,
      lastName,
      email: person.metadata?.primaryEmail || person.subtitle,
      telephone: person.metadata?.primaryPhone,
      clientId: person.metadata?.clientId || '',
      clientName: person.metadata?.clientName || ''
    });
    setIsSearchMode(false);
    setSearchValue('');
  };

  const personName = matchedPerson 
    ? `${matchedPerson.firstName || ''} ${matchedPerson.lastName || ''}`.trim() 
    : '';
  const contactInfo = contactType === 'email' ? matchedPerson?.email : matchedPerson?.telephone;
  
  // If no match found at all, auto-open search mode
  const hasValidMatch = matchedPerson && (personName || contactInfo);

  if (isSearchMode || !hasValidMatch) {
    return (
      <div ref={containerRef} className="space-y-2">
        {/* Show message when no match found */}
        {!hasValidMatch && !isSearchMode && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm text-amber-700 dark:text-amber-400">
              Couldn't find "{originalName}". Search below to select the right person.
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={`Search for a person with ${contactType}...`}
              className="h-8 text-sm pl-8"
              autoFocus
              data-testid="input-recipient-search"
            />
          </div>
          {/* Only show cancel button if we have a valid match to go back to */}
          {hasValidMatch && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsSearchMode(false);
                setSearchValue('');
              }}
              className="h-8 px-2"
              data-testid="button-cancel-search"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        
        {/* Search results dropdown */}
        {debouncedSearch.length >= 2 && (
          <div className="bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
            {isLoading && (
              <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Searching...
              </div>
            )}
            {!isLoading && filteredResults.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No people found with {contactType === 'email' ? 'email address' : 'mobile number'}
              </div>
            )}
            {filteredResults.map((person) => (
              <div
                key={person.id}
                className="px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSelectPerson(person)}
                data-testid={`search-result-${person.id}`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {/* Primary display: Person Name - Company Name */}
                    <div className="font-medium text-sm truncate">
                      {person.title}
                      {person.metadata?.clientName && (
                        <span className="text-muted-foreground font-normal"> - {person.metadata.clientName}</span>
                      )}
                    </div>
                    {/* Secondary: contact info */}
                    <div className="text-xs text-muted-foreground">
                      {contactType === 'email' && (person.metadata?.primaryEmail || person.subtitle) && (
                        <span className="text-sky-600 dark:text-sky-400">{person.metadata?.primaryEmail || person.subtitle}</span>
                      )}
                      {contactType === 'mobile' && person.metadata?.primaryPhone && (
                        <span className="text-emerald-600 dark:text-emerald-400">{person.metadata.primaryPhone}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground text-sm">To:</span>
            <span className="font-medium text-sm">{personName}</span>
            {contactInfo && (
              <span className="text-xs text-muted-foreground">({contactInfo})</span>
            )}
            {!matchedPerson && (
              <span className="text-xs text-amber-600 font-medium">(no match found)</span>
            )}
          </div>
          {matchedClientName && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3" />
              {matchedClientName}
            </div>
          )}
          {matchedPerson && matchConfidence > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Match confidence: {Math.round(matchConfidence)}%
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsSearchMode(true)}
          className="h-7 px-2 text-xs shrink-0"
          data-testid="button-change-recipient"
        >
          <Edit2 className="w-3 h-3 mr-1" />
          Change
        </Button>
      </div>
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
  const suggestedAssigneeName = args.assigneeName as string | undefined;
  
  const [title, setTitle] = useState(args.title as string || '');
  const [description, setDescription] = useState(args.details as string || '');
  const [assigneeId, setAssigneeId] = useState<string | null>(null); // null = not yet set by user
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

  const { data: staffMembers } = useQuery<UserType[]>({
    queryKey: ['/api/users/for-messaging'],
  });

  // Determine if AI tried to assign to someone else (vs current user)
  const aiTriedToAssignOther = suggestedAssigneeName && 
    suggestedAssigneeName.trim().length > 0 && 
    suggestedAssigneeName.toLowerCase() !== 'me' && 
    suggestedAssigneeName.toLowerCase() !== 'myself';

  // Better matching: require first name or last name match, not just partial includes
  const matchedAssignee = useMemo(() => {
    if (!aiTriedToAssignOther || !staffMembers) return undefined;
    
    const searchTerms = suggestedAssigneeName!.toLowerCase().trim().split(/\s+/);
    
    // Find best match with scoring
    let bestMatch: { user: UserType; score: number } | undefined;
    
    for (const staff of staffMembers) {
      const firstName = (staff.firstName || '').toLowerCase();
      const lastName = (staff.lastName || '').toLowerCase();
      let score = 0;
      
      for (const term of searchTerms) {
        // Exact first name match (high confidence)
        if (firstName === term) score += 50;
        // Exact last name match (high confidence)
        else if (lastName === term) score += 50;
        // First name starts with search term
        else if (firstName.startsWith(term) && term.length >= 2) score += 30;
        // Last name starts with search term
        else if (lastName.startsWith(term) && term.length >= 2) score += 30;
      }
      
      // Only consider if we have a reasonable match (at least one name component matched)
      if (score >= 30 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { user: staff, score };
      }
    }
    
    return bestMatch?.user;
  }, [aiTriedToAssignOther, suggestedAssigneeName, staffMembers]);

  // Determine effective assignee:
  // - If user manually selected someone (non-empty value) → use that
  // - If AI found a match → use that (but user can change)
  // - If AI tried to find someone but failed → require user to select (don't default to current user)
  // - If AI didn't try to assign someone else → default to current user
  const effectiveAssigneeId = useMemo(() => {
    // User manually selected a valid staff member (non-empty)
    if (assigneeId !== null && assigneeId.length > 0) return assigneeId;
    if (matchedAssignee) return matchedAssignee.id; // AI found a match
    if (aiTriedToAssignOther) return ''; // AI tried but failed - require selection
    return user?.id || ''; // Default to current user
  }, [assigneeId, matchedAssignee, aiTriedToAssignOther, user?.id]);

  // Track if we need user to select an assignee
  // This is true when AI tried to assign to someone, couldn't match, and user hasn't selected a valid option
  const assigneeRequired = aiTriedToAssignOther && !matchedAssignee && (!assigneeId || assigneeId.length === 0);

  const isValid = title.trim().length > 0 && dueDate.length > 0 && dueTime.length > 0 && effectiveAssigneeId.length > 0;
  
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isValid) {
        throw new Error('Please fill in all required fields');
      }
      if (!effectiveAssigneeId || effectiveAssigneeId.length === 0) {
        throw new Error('Please select who to assign this reminder to');
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
  
  const assigneeName = useMemo(() => {
    if (assigneeRequired) {
      return `${suggestedAssigneeName} (not found - please select)`;
    }
    const matchedStaff = staffMembers?.find(u => u.id === effectiveAssigneeId);
    if (matchedStaff) {
      return `${matchedStaff.firstName} ${matchedStaff.lastName}`.trim();
    }
    return 'Me';
  }, [assigneeRequired, suggestedAssigneeName, staffMembers, effectiveAssigneeId]);

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
            <Label className={`text-xs ${assigneeRequired ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
              Assign to {matchedAssignee ? '(AI matched)' : assigneeRequired ? '(required - select staff member)' : ''}
            </Label>
            <SearchableSelect
              value={effectiveAssigneeId}
              onValueChange={setAssigneeId}
              options={staffOptions}
              placeholder={assigneeRequired ? `Select staff (searching for "${suggestedAssigneeName}")...` : "Type to search staff..."}
              suggestedName={suggestedAssigneeName}
              icon={<User className="w-3 h-3" />}
              testId="search-reminder-assignee"
            />
            {assigneeRequired && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Could not find "{suggestedAssigneeName}" - please select a staff member
              </p>
            )}
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
          <div className={`flex items-center gap-1 text-xs ${assigneeRequired ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
            <User className="w-3 h-3" />
            {assigneeName}
          </div>
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
    queryKey: ['/api/users/for-messaging'],
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
  const [status, setStatus] = useState<'searching' | 'found' | 'navigating'>('searching');
  const [matchedClient, setMatchedClient] = useState<{ id: string; name: string } | null>(null);

  const { data: clients } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/clients'],
  });

  useEffect(() => {
    if (navigatedRef.current || !clients) return;
    
    // Check for exact match (case-insensitive)
    const searchLower = searchTerm.toLowerCase().trim();
    const exactMatch = clients.find(c => c.name.toLowerCase().trim() === searchLower);
    
    // Also check for very close matches (starts with, or search term is substantial part of name)
    const closeMatch = !exactMatch ? clients.find(c => {
      const nameLower = c.name.toLowerCase().trim();
      // Match if the name starts with search term and search is at least 4 chars
      // Or if search term is contained and is at least 60% of the name length
      return (nameLower.startsWith(searchLower) && searchLower.length >= 4) ||
             (nameLower.includes(searchLower) && searchLower.length >= nameLower.length * 0.6);
    }) : null;

    const matched = exactMatch || closeMatch;

    if (matched) {
      setMatchedClient(matched);
      setStatus('found');
      
      navigatedRef.current = true;
      const timer = setTimeout(() => {
        setStatus('navigating');
        setLocation(`/clients/${matched.id}`);
        onComplete(true, `Opening ${matched.name}...`);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      // No exact match - go to search results
      navigatedRef.current = true;
      const timer = setTimeout(() => {
        setStatus('navigating');
        const path = `/clients?search=${encodeURIComponent(searchTerm)}`;
        setLocation(path);
        onComplete(true, `Searching for "${searchTerm}"...`);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [clients, searchTerm, setLocation, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-search-clients"
    >
      <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="font-medium text-sm">
          {matchedClient ? `Opening ${matchedClient.name}...` : 'Searching Clients...'}
        </span>
      </div>

      <div className="text-sm">
        <span className="text-muted-foreground">
          {matchedClient ? 'Found: ' : 'Looking for: '}
        </span>
        <span className="font-medium">
          {matchedClient ? matchedClient.name : `"${searchTerm}"`}
        </span>
      </div>
    </motion.div>
  );
}

// Improved fuzzy matching for people that considers both person name and client name
// Generic to work with both email and mobile contacts
// filterFn: Optional filter to only consider people with required contact method (email or mobile)
function matchPersonWithClientContext<T extends { id: string; firstName: string | null; lastName: string | null; clientId: string }>(
  searchQuery: string,
  suggestedClient: string | undefined,
  people: T[],
  clients: { id: string; name: string }[],
  filterFn?: (person: T) => boolean
): { person: T; score: number; clientName: string } | null {
  if (!people || people.length === 0) return null;
  
  const query = searchQuery.toLowerCase().trim();
  if (!query) return null;
  
  // Create a map of client IDs to names
  const clientMap = new Map(clients.map(c => [c.id, c.name]));
  
  // Filter people by required contact method if provided
  const filteredPeople = filterFn ? people.filter(filterFn) : people;
  
  // Score each person
  const scored = filteredPeople
    .map(p => {
      const firstName = (p.firstName || '').toLowerCase();
      const lastName = (p.lastName || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      const clientName = (clientMap.get(p.clientId) || '').toLowerCase();
      
      let score = 0;
      
      // Check if query contains "from" pattern like "mark from monkey access"
      const fromMatch = query.match(/^(.+?)\s+from\s+(.+)$/i);
      if (fromMatch) {
        const personSearch = fromMatch[1].toLowerCase().trim();
        const clientSearch = fromMatch[2].toLowerCase().trim();
        
        // Match person name
        if (firstName === personSearch || lastName === personSearch) {
          score += 50;
        } else if (fullName.includes(personSearch) || personSearch.includes(fullName)) {
          score += 30;
        } else if (firstName.includes(personSearch) || lastName.includes(personSearch)) {
          score += 20;
        }
        
        // Match client name
        if (clientName.includes(clientSearch) || clientSearch.includes(clientName)) {
          score += 40;
        } else if (clientName.split(/\s+/).some(word => clientSearch.includes(word))) {
          score += 20;
        }
      } else {
        // Simple matching - check if query matches person name or includes client context
        if (firstName === query || lastName === query || fullName === query) {
          score += 60;
        } else if (fullName.includes(query) || query.includes(fullName)) {
          score += 40;
        } else if (firstName.includes(query) || query.includes(firstName) || 
                   lastName.includes(query) || query.includes(lastName)) {
          score += 25;
        }
        
        // Boost if suggested client matches
        if (suggestedClient) {
          const suggestedLower = suggestedClient.toLowerCase();
          if (clientName.includes(suggestedLower) || suggestedLower.includes(clientName)) {
            score += 30;
          }
        }
      }
      
      return { person: p, score, clientName: clientMap.get(p.clientId) || '' };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  
  return scored.length > 0 ? scored[0] : null;
}

export function EmailActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const args = functionCall.arguments;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // User-overridden selection (null = use AI match)
  const [overriddenPerson, setOverriddenPerson] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    clientId: string;
    clientName: string;
  } | null>(null);
  
  const recipientName = args.recipientName as string || 'Unknown';
  const suggestedClientName = args.clientName as string | undefined;
  const suggestedSubject = args.subject as string || '';
  const suggestedBody = args.body as string || '';

  // Fetch all people for matching
  const { data: rawPeople } = useQuery<{ 
    id: string; 
    firstName: string | null; 
    lastName: string | null; 
    email: string | null; 
    primaryEmail: string | null;
    relatedCompanies: { id: string; name: string }[] 
  }[]>({
    queryKey: ['/api/people'],
  });

  const { data: clients } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/clients'],
  });

  // Use the shared matcher to find the best matching person
  const matchResult = useMemo(() => {
    if (!rawPeople || !clients) return null;
    
    // Transform people for matching
    const people = rawPeople.map(p => ({
      ...p,
      email: p.email || p.primaryEmail,
      clientId: p.relatedCompanies?.[0]?.id || ''
    }));
    
    return getBestMatch(
      { personTerm: recipientName, companyTerm: suggestedClientName },
      people,
      clients,
      { requireEmail: true }
    );
  }, [rawPeople, clients, recipientName, suggestedClientName]);

  // Use overridden person if set, otherwise use AI match
  const effectivePerson = overriddenPerson || (matchResult?.person ? {
    id: matchResult.person.id,
    firstName: matchResult.person.firstName || '',
    lastName: matchResult.person.lastName || '',
    email: matchResult.person.email || undefined,
    clientId: matchResult.clientId || '',
    clientName: matchResult.clientName || ''
  } : null);
  
  const effectiveClientId = effectivePerson?.clientId || '';
  const effectiveClientName = effectivePerson?.clientName || '';
  const matchConfidence = overriddenPerson ? 100 : (matchResult?.score || 0);

  // Fetch client's people for the EmailDialog
  const { data: clientPeople } = useQuery({
    queryKey: ['/api/clients', effectiveClientId, 'people'],
    enabled: !!effectiveClientId && isDialogOpen,
  });

  // Transform to PersonOption format expected by EmailDialog
  const clientPeopleForDialog = useMemo(() => {
    if (!clientPeople) return [];
    return (clientPeople as any[]).map((cp: any) => ({
      person: {
        id: cp.person?.id || cp.id,
        firstName: cp.person?.firstName || cp.firstName || '',
        lastName: cp.person?.lastName || cp.lastName || '',
        fullName: cp.person?.fullName || cp.fullName || '',
        primaryEmail: cp.person?.primaryEmail || cp.primaryEmail || '',
        email: cp.person?.email || cp.email || '',
        primaryPhone: cp.person?.primaryPhone || cp.primaryPhone || '',
        telephone: cp.person?.telephone || cp.telephone || '',
      },
      role: cp.role || null
    }));
  }, [clientPeople]);

  const handlePersonChange = (person: { id: string; firstName: string; lastName: string; email?: string; clientId: string; clientName: string }) => {
    setOverriddenPerson(person);
  };

  const handleDialogSuccess = () => {
    const personName = effectivePerson ? `${effectivePerson.firstName} ${effectivePerson.lastName}` : recipientName;
    toast({ title: 'Email sent!', description: `Email sent successfully` });
    onComplete(true, `Email sent to ${personName}`);
    setIsDialogOpen(false);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
  };

  const handleOpenDialog = () => {
    if (!effectiveClientId) {
      toast({ 
        title: 'No contact selected', 
        description: 'Please select a contact using the search above.',
        variant: 'destructive'
      });
      return;
    }
    setIsDialogOpen(true);
  };

  // Dynamically import the EmailDialog to avoid circular dependencies
  const EmailDialogComponent = useMemo(() => {
    return lazy(() => import('@/pages/client-detail/components/communications/dialogs/EmailDialog').then(m => ({ default: m.EmailDialog })));
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border border-sky-200 dark:border-sky-800 rounded-xl p-4 space-y-3"
        data-testid="action-card-email"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
            <Mail className="w-4 h-4" />
            <span className="font-medium text-sm">Send Email</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-6 w-6 p-0"
            data-testid="button-dismiss-email"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Recipient selector with search capability */}
        <RecipientSelector
          matchedPerson={effectivePerson ? {
            id: effectivePerson.id,
            firstName: effectivePerson.firstName,
            lastName: effectivePerson.lastName,
            email: effectivePerson.email
          } : null}
          matchedClientName={effectiveClientName}
          matchConfidence={matchConfidence}
          originalName={recipientName}
          contactType="email"
          onPersonChange={handlePersonChange}
        />

        {/* Subject preview */}
        {suggestedSubject && (
          <div className="flex items-center gap-1.5 text-sm border-t border-sky-100 dark:border-sky-800 pt-2 mt-1">
            <span className="text-muted-foreground">Subject:</span>
            <span className="truncate">{suggestedSubject}</span>
          </div>
        )}

        <Button
          size="sm"
          onClick={handleOpenDialog}
          disabled={!effectiveClientId}
          className="h-7 text-xs bg-sky-600 hover:bg-sky-700 w-full"
          data-testid="button-open-email-dialog"
        >
          <Mail className="w-3 h-3 mr-1" />
          Open Email Composer
        </Button>
      </motion.div>

      {/* Use the real EmailDialog from client detail */}
      {isDialogOpen && effectiveClientId && (
        <Suspense fallback={null}>
          <EmailDialogComponent
            clientId={effectiveClientId}
            clientPeople={clientPeopleForDialog}
            user={user || null}
            isOpen={isDialogOpen}
            onClose={handleDialogClose}
            onSuccess={handleDialogSuccess}
            clientCompany={effectiveClientName}
            initialValues={{
              recipientIds: effectivePerson?.id ? [effectivePerson.id] : [],
              subject: suggestedSubject,
              content: suggestedBody
            }}
          />
        </Suspense>
      )}
    </>
  );
}

export function SmsActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const { toast } = useToast();
  const args = functionCall.arguments;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // User-overridden selection (null = use AI match)
  const [overriddenPerson, setOverriddenPerson] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    telephone?: string;
    clientId: string;
    clientName: string;
  } | null>(null);

  const recipientName = args.recipientName as string || 'Unknown';
  const suggestedClientName = args.clientName as string | undefined;
  const suggestedMessage = args.message as string || '';

  // Fetch all people for matching
  const { data: rawPeople } = useQuery<{ 
    id: string; 
    firstName: string | null; 
    lastName: string | null; 
    telephone: string | null;
    primaryPhone: string | null;
    relatedCompanies: { id: string; name: string }[] 
  }[]>({
    queryKey: ['/api/people'],
  });

  const { data: clients } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/clients'],
  });

  // Use the shared matcher to find the best matching person
  const matchResult = useMemo(() => {
    if (!rawPeople || !clients) return null;
    
    // Transform people for matching
    const people = rawPeople.map(p => ({
      ...p,
      telephone: p.telephone || p.primaryPhone,
      clientId: p.relatedCompanies?.[0]?.id || ''
    }));
    
    return getBestMatch(
      { personTerm: recipientName, companyTerm: suggestedClientName },
      people,
      clients,
      { requireMobile: true }
    );
  }, [rawPeople, clients, recipientName, suggestedClientName]);

  // Use overridden person if set, otherwise use AI match
  const effectivePerson = overriddenPerson || (matchResult?.person ? {
    id: matchResult.person.id,
    firstName: matchResult.person.firstName || '',
    lastName: matchResult.person.lastName || '',
    telephone: matchResult.person.telephone || undefined,
    clientId: matchResult.clientId || '',
    clientName: matchResult.clientName || ''
  } : null);
  
  const effectiveClientId = effectivePerson?.clientId || '';
  const effectiveClientName = effectivePerson?.clientName || '';
  const matchConfidence = overriddenPerson ? 100 : (matchResult?.score || 0);

  // Fetch client's people for the SMSDialog
  const { data: clientPeople } = useQuery({
    queryKey: ['/api/clients', effectiveClientId, 'people'],
    enabled: !!effectiveClientId && isDialogOpen,
  });

  // Transform to PersonOption format expected by SMSDialog
  const clientPeopleForDialog = useMemo(() => {
    if (!clientPeople) return [];
    return (clientPeople as any[]).map((cp: any) => ({
      person: {
        id: cp.person?.id || cp.id,
        firstName: cp.person?.firstName || cp.firstName || '',
        lastName: cp.person?.lastName || cp.lastName || '',
        fullName: cp.person?.fullName || cp.fullName || '',
        primaryEmail: cp.person?.primaryEmail || cp.primaryEmail || '',
        email: cp.person?.email || cp.email || '',
        primaryPhone: cp.person?.primaryPhone || cp.primaryPhone || '',
        telephone: cp.person?.telephone || cp.telephone || '',
      },
      role: cp.role || null
    }));
  }, [clientPeople]);

  const handlePersonChange = (person: { id: string; firstName: string; lastName: string; telephone?: string; clientId: string; clientName: string }) => {
    setOverriddenPerson(person);
  };

  const handleDialogSuccess = () => {
    const personName = effectivePerson ? `${effectivePerson.firstName} ${effectivePerson.lastName}` : recipientName;
    toast({ title: 'SMS sent!', description: `SMS sent successfully` });
    onComplete(true, `SMS sent to ${personName}`);
    setIsDialogOpen(false);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
  };

  const handleOpenDialog = () => {
    if (!effectiveClientId) {
      toast({ 
        title: 'No contact selected', 
        description: 'Please select a contact with a mobile number using the search above.',
        variant: 'destructive'
      });
      return;
    }
    setIsDialogOpen(true);
  };

  // Dynamically import the SMSDialog to avoid circular dependencies
  const SMSDialogComponent = useMemo(() => {
    return lazy(() => import('@/pages/client-detail/components/communications/dialogs/SMSDialog').then(m => ({ default: m.SMSDialog })));
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-3"
        data-testid="action-card-sms"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <MessageSquare className="w-4 h-4" />
            <span className="font-medium text-sm">Send SMS</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-6 w-6 p-0"
            data-testid="button-dismiss-sms"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Recipient selector with search capability */}
        <RecipientSelector
          matchedPerson={effectivePerson ? {
            id: effectivePerson.id,
            firstName: effectivePerson.firstName,
            lastName: effectivePerson.lastName,
            telephone: effectivePerson.telephone
          } : null}
          matchedClientName={effectiveClientName}
          matchConfidence={matchConfidence}
          originalName={recipientName}
          contactType="mobile"
          onPersonChange={handlePersonChange}
        />

        {/* Message preview */}
        {suggestedMessage && (
          <div className="text-xs text-muted-foreground border-t border-emerald-100 dark:border-emerald-800 pt-2 mt-1 line-clamp-2">
            Message: {suggestedMessage}
          </div>
        )}

        <Button
          size="sm"
          onClick={handleOpenDialog}
          disabled={!effectiveClientId}
          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 w-full"
          data-testid="button-open-sms-dialog"
        >
          <MessageSquare className="w-3 h-3 mr-1" />
          Open SMS Dialog
        </Button>
      </motion.div>

      {/* Use the real SMSDialog from client detail */}
      {isDialogOpen && effectiveClientId && (
        <Suspense fallback={null}>
          <SMSDialogComponent
            clientId={effectiveClientId}
            clientPeople={clientPeopleForDialog}
            isOpen={isDialogOpen}
            onClose={handleDialogClose}
            onSuccess={handleDialogSuccess}
            initialValues={{
              personId: effectivePerson?.id,
              message: suggestedMessage
            }}
          />
        </Suspense>
      )}
    </>
  );
}

// Project Status Action Card
function ProjectStatusCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const [, setLocation] = useLocation();
  const projectIdentifier = functionCall.arguments.projectIdentifier as string;

  // Fetch matching projects
  const { data: matchData, isLoading: isMatching, error: matchError } = useQuery<ProjectMatchResponse>({
    queryKey: ['/api/ai/match/projects', { q: projectIdentifier }],
    enabled: !!projectIdentifier,
  });

  const matches = matchData?.matches || [];
  const bestMatch = matches[0];

  // Fetch project details if we have a match
  const { data: projectDetails, isLoading: isLoadingDetails, error: detailsError } = useQuery<ProjectDetails>({
    queryKey: ['/api/ai/projects', bestMatch?.id, 'details'],
    enabled: !!bestMatch?.id,
  });

  const isLoading = isMatching || isLoadingDetails;
  const hasError = matchError || detailsError;

  const handleViewProject = () => {
    if (bestMatch?.id) {
      setLocation(`/projects/${bestMatch.id}`);
      onComplete(true, `Viewing project: ${bestMatch.clientName}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-project-status"
    >
      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
        <Briefcase className="w-4 h-4" />
        <span className="font-medium text-sm">Project Status</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Finding project...
        </div>
      ) : hasError ? (
        <div className="text-sm text-red-600 dark:text-red-400">
          Unable to find project. Try again or be more specific.
        </div>
      ) : !bestMatch ? (
        <div className="text-sm text-muted-foreground">
          No project found matching "{projectIdentifier}"
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm font-medium">{bestMatch.clientName}</div>
          <div className="text-xs text-muted-foreground">{bestMatch.projectTypeName}</div>
          
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-muted-foreground" />
              <span className={cn(
                "font-medium px-2 py-0.5 rounded",
                bestMatch.isBenched 
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              )}>
                {bestMatch.currentStatus}
              </span>
            </div>
            {bestMatch.assigneeName && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3 text-muted-foreground" />
                <span>{bestMatch.assigneeName}</span>
              </div>
            )}
            {bestMatch.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span>{format(new Date(bestMatch.dueDate), 'dd MMM yyyy')}</span>
              </div>
            )}
          </div>

          {projectDetails?.nextStage && (
            <div className="text-xs text-muted-foreground mt-2">
              Next stage: <span className="font-medium">{projectDetails.nextStage.name}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {bestMatch && (
          <Button
            size="sm"
            onClick={handleViewProject}
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
            data-testid="button-view-project"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View Project
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 text-xs ml-auto"
          data-testid="button-dismiss-project-status"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}

// Bench Project Action Card
function BenchProjectCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const { toast } = useToast();
  const projectIdentifier = functionCall.arguments.projectIdentifier as string;
  const benchReason = functionCall.arguments.benchReason as string | undefined;
  const benchReasonOtherText = functionCall.arguments.benchReasonOtherText as string | undefined;
  const [selectedReason, setSelectedReason] = useState<string>(benchReason || '');
  const [otherText, setOtherText] = useState<string>(benchReasonOtherText || '');

  // Fetch matching projects
  const { data: matchData, isLoading: isMatching } = useQuery<ProjectMatchResponse>({
    queryKey: ['/api/ai/match/projects', { q: projectIdentifier }],
    enabled: !!projectIdentifier,
  });

  const matches = matchData?.matches || [];
  const bestMatch = matches[0];

  const benchMutation = useMutation({
    mutationFn: async () => {
      if (!bestMatch?.id) throw new Error('No project selected');
      return apiRequest('POST', `/api/projects/${bestMatch.id}/bench`, {
        benchReason: selectedReason,
        benchReasonOtherText: selectedReason === 'other' ? otherText : undefined
      });
    },
    onSuccess: () => {
      toast({
        title: 'Project benched',
        description: `${bestMatch?.clientName} - ${bestMatch?.projectTypeName} moved to bench`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      onComplete(true, `Benched: ${bestMatch?.clientName}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to bench project',
        description: error.message || 'Something went wrong',
        variant: 'destructive'
      });
    }
  });

  const isValid = bestMatch && selectedReason && (selectedReason !== 'other' || otherText.trim());

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-bench-project"
    >
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <PauseCircle className="w-4 h-4" />
        <span className="font-medium text-sm">Bench Project</span>
      </div>

      {isMatching ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Finding project...
        </div>
      ) : !bestMatch ? (
        <div className="text-sm text-muted-foreground">
          No project found matching "{projectIdentifier}"
        </div>
      ) : bestMatch.isBenched ? (
        <div className="text-sm text-amber-600">
          This project is already on the bench
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium">{bestMatch.clientName}</div>
            <div className="text-xs text-muted-foreground">{bestMatch.projectTypeName}</div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Reason for benching</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-bench-reason">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="legacy_work">Legacy Work</SelectItem>
                <SelectItem value="missing_data">Missing Data</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedReason === 'other' && (
            <div>
              <Label className="text-xs text-muted-foreground">Explain reason</Label>
              <Input
                value={otherText}
                onChange={e => setOtherText(e.target.value)}
                placeholder="Enter reason..."
                className="h-8 text-sm"
                data-testid="input-bench-reason-other"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => benchMutation.mutate()}
          disabled={!isValid || benchMutation.isPending || bestMatch?.isBenched}
          className="h-7 text-xs bg-amber-600 hover:bg-amber-700"
          data-testid="button-confirm-bench"
        >
          {benchMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <PauseCircle className="w-3 h-3 mr-1" />
          )}
          Bench Project
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 text-xs ml-auto"
          data-testid="button-dismiss-bench"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}

// Unbench Project Action Card
function UnbenchProjectCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const { toast } = useToast();
  const projectIdentifier = functionCall.arguments.projectIdentifier as string;
  const notes = functionCall.arguments.notes as string | undefined;
  const [unbenchNotes, setUnbenchNotes] = useState<string>(notes || '');

  // Fetch matching projects
  const { data: matchData, isLoading: isMatching } = useQuery<ProjectMatchResponse>({
    queryKey: ['/api/ai/match/projects', { q: projectIdentifier }],
    enabled: !!projectIdentifier,
  });

  const matches = matchData?.matches || [];
  const bestMatch = matches[0];

  const unbenchMutation = useMutation({
    mutationFn: async () => {
      if (!bestMatch?.id) throw new Error('No project selected');
      return apiRequest('POST', `/api/projects/${bestMatch.id}/unbench`, { 
        notes: unbenchNotes || undefined 
      });
    },
    onSuccess: () => {
      toast({
        title: 'Project unbenched',
        description: `${bestMatch?.clientName} - ${bestMatch?.projectTypeName} removed from bench`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      onComplete(true, `Unbenched: ${bestMatch?.clientName}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to unbench project',
        description: error.message || 'Something went wrong',
        variant: 'destructive'
      });
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-unbench-project"
    >
      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
        <PlayCircle className="w-4 h-4" />
        <span className="font-medium text-sm">Unbench Project</span>
      </div>

      {isMatching ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Finding project...
        </div>
      ) : !bestMatch ? (
        <div className="text-sm text-muted-foreground">
          No project found matching "{projectIdentifier}"
        </div>
      ) : !bestMatch.isBenched ? (
        <div className="text-sm text-green-600">
          This project is not on the bench
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium">{bestMatch.clientName}</div>
            <div className="text-xs text-muted-foreground">{bestMatch.projectTypeName}</div>
            <div className="text-xs text-amber-600 mt-1">Currently on bench</div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
            <Textarea
              value={unbenchNotes}
              onChange={e => setUnbenchNotes(e.target.value)}
              placeholder="Add notes about unbenching..."
              className="text-sm min-h-[60px]"
              data-testid="input-unbench-notes"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => unbenchMutation.mutate()}
          disabled={!bestMatch?.isBenched || unbenchMutation.isPending}
          className="h-7 text-xs bg-green-600 hover:bg-green-700"
          data-testid="button-confirm-unbench"
        >
          {unbenchMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <PlayCircle className="w-3 h-3 mr-1" />
          )}
          Unbench Project
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 text-xs ml-auto"
          data-testid="button-dismiss-unbench"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}

// Move Project Stage Action Card
function MoveProjectStageCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const { toast } = useToast();
  const projectIdentifier = functionCall.arguments.projectIdentifier as string;
  const targetStageName = functionCall.arguments.targetStageName as string | undefined;
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedReasonId, setSelectedReasonId] = useState<string>('');
  const [stageNotes, setStageNotes] = useState<string>('');
  const [step, setStep] = useState<'stage' | 'reason' | 'notes'>('stage');

  // Fetch matching projects
  const { data: matchData, isLoading: isMatching } = useQuery<ProjectMatchResponse>({
    queryKey: ['/api/ai/match/projects', { q: projectIdentifier }],
    enabled: !!projectIdentifier,
  });

  const matches = matchData?.matches || [];
  const bestMatch = matches[0];

  // Fetch project details with stages
  const { data: projectDetails, isLoading: isLoadingDetails } = useQuery<ProjectDetails>({
    queryKey: ['/api/ai/projects', bestMatch?.id, 'details'],
    enabled: !!bestMatch?.id,
  });

  // Fetch reasons for selected stage
  const { data: stageReasons } = useQuery<StageReasonsResponse>({
    queryKey: ['/api/ai/projects', bestMatch?.id, 'stages', selectedStageId, 'reasons'],
    enabled: !!bestMatch?.id && !!selectedStageId,
  });

  // Auto-select next stage or target stage
  useEffect(() => {
    if (projectDetails?.stages) {
      if (targetStageName && targetStageName.toLowerCase() !== 'next') {
        const targetStage = projectDetails.stages.find(
          (s) => s.name.toLowerCase().includes(targetStageName.toLowerCase())
        );
        if (targetStage) {
          setSelectedStageId(targetStage.id);
          setStep('reason');
        }
      } else if (projectDetails.nextStage) {
        setSelectedStageId(projectDetails.nextStage.id);
        setStep('reason');
      }
    }
  }, [projectDetails, targetStageName]);

  const moveStageMutation = useMutation({
    mutationFn: async () => {
      if (!bestMatch?.id || !selectedStageId || !selectedReasonId) {
        throw new Error('Missing required data');
      }
      
      const selectedStage = projectDetails?.stages?.find((s) => s.id === selectedStageId);
      const selectedReason = stageReasons?.reasons?.find((r) => r.id === selectedReasonId);
      
      return apiRequest('PATCH', `/api/projects/${bestMatch.id}/status`, {
        newStatus: selectedStage?.name,
        stageId: selectedStageId,
        reasonId: selectedReasonId,
        changeReason: selectedReason?.name,
        notes: stageNotes || undefined
      });
    },
    onSuccess: () => {
      const selectedStage = projectDetails?.stages?.find((s) => s.id === selectedStageId);
      toast({
        title: 'Stage updated',
        description: `${bestMatch?.clientName} moved to "${selectedStage?.name}"`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      onComplete(true, `Moved: ${bestMatch?.clientName} to ${selectedStage?.name}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to move project',
        description: error.message || 'Something went wrong',
        variant: 'destructive'
      });
    }
  });

  const isLoading = isMatching || isLoadingDetails;
  const selectedStage = projectDetails?.stages?.find((s) => s.id === selectedStageId);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-move-stage"
    >
      <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
        <ArrowRightCircle className="w-4 h-4" />
        <span className="font-medium text-sm">Move Project Stage</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Finding project...
        </div>
      ) : !bestMatch ? (
        <div className="text-sm text-muted-foreground">
          No project found matching "{projectIdentifier}"
        </div>
      ) : bestMatch.isBenched ? (
        <div className="text-sm text-amber-600">
          Cannot change stage - project is on the bench
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium">{bestMatch.clientName}</div>
            <div className="text-xs text-muted-foreground">{bestMatch.projectTypeName}</div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="text-muted-foreground">Current:</span>
              <span className="font-medium text-purple-600">{bestMatch.currentStatus}</span>
              {selectedStage && (
                <>
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  <span className="font-medium text-green-600">{selectedStage.name}</span>
                </>
              )}
            </div>
          </div>

          {step === 'stage' && (
            <div>
              <Label className="text-xs text-muted-foreground">Select stage</Label>
              <Select value={selectedStageId} onValueChange={(v) => { setSelectedStageId(v); setStep('reason'); }}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-target-stage">
                  <SelectValue placeholder="Select stage..." />
                </SelectTrigger>
                <SelectContent>
                  {projectDetails?.stages?.map((stage: any) => (
                    <SelectItem 
                      key={stage.id} 
                      value={stage.id}
                      disabled={stage.name === bestMatch.currentStatus}
                    >
                      {stage.name}
                      {stage.id === projectDetails?.nextStage?.id && ' (Next)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 'reason' && stageReasons?.reasons && stageReasons.reasons.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Change reason</Label>
              <Select value={selectedReasonId} onValueChange={(v) => { setSelectedReasonId(v); setStep('notes'); }}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-change-reason">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {stageReasons.reasons.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 'notes' && (
            <div>
              <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
              <Textarea
                value={stageNotes}
                onChange={e => setStageNotes(e.target.value)}
                placeholder="Add notes about this stage change..."
                className="text-sm min-h-[60px]"
                data-testid="input-stage-notes"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {step !== 'stage' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStep(step === 'notes' ? 'reason' : 'stage')}
            className="h-7 text-xs"
            data-testid="button-back-stage"
          >
            Back
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => moveStageMutation.mutate()}
          disabled={!selectedStageId || !selectedReasonId || moveStageMutation.isPending || bestMatch?.isBenched}
          className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
          data-testid="button-confirm-move-stage"
        >
          {moveStageMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <ArrowRightCircle className="w-3 h-3 mr-1" />
          )}
          Move Stage
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 text-xs ml-auto"
          data-testid="button-dismiss-move-stage"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}

// Analytics Action Card
function AnalyticsCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const [, setLocation] = useLocation();
  const queryType = functionCall.arguments.queryType as string;
  const projectTypeName = functionCall.arguments.projectTypeName as string | undefined;
  const userName = functionCall.arguments.userName as string | undefined;
  const clientName = functionCall.arguments.clientName as string | undefined;
  const timeframe = functionCall.arguments.timeframe as string | undefined;

  // Build query params object for useQuery
  const queryParamsObj: Record<string, string> = { queryType };
  if (projectTypeName) queryParamsObj.projectTypeName = projectTypeName;
  if (userName) queryParamsObj.userName = userName;
  if (clientName) queryParamsObj.clientName = clientName;
  if (timeframe) queryParamsObj.timeframe = timeframe;

  const { data: analytics, isLoading, error } = useQuery<AnalyticsResult>({
    queryKey: ['/api/ai/analytics', queryParamsObj],
    enabled: !!queryType,
  });

  const handleViewProjects = () => {
    // Navigate to projects with filters
    const filterParams = new URLSearchParams();
    if (queryType === 'overdue_count') filterParams.set('filter', 'overdue');
    if (queryType === 'bench_count') filterParams.set('filter', 'benched');
    if (projectTypeName) filterParams.set('type', projectTypeName);
    
    setLocation(`/projects${filterParams.toString() ? '?' + filterParams.toString() : ''}`);
    onComplete(true, `Viewing ${queryType.replace(/_/g, ' ')} analytics`);
  };

  const getIcon = () => {
    switch (queryType) {
      case 'overdue_count': return <Clock className="w-4 h-4" />;
      case 'workload': return <User className="w-4 h-4" />;
      case 'bench_count': return <PauseCircle className="w-4 h-4" />;
      default: return <BarChart3 className="w-4 h-4" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-analytics"
    >
      <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
        {getIcon()}
        <span className="font-medium text-sm">{analytics?.title || 'Analytics'}</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading analytics...
        </div>
      ) : error ? (
        <div className="text-sm text-red-600 dark:text-red-400">
          Unable to load analytics data. Try again later.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-lg font-semibold text-foreground">
            {analytics?.summary || 'No data available'}
          </div>
          
          {analytics?.items && analytics.items.length > 0 && (
            <div className="space-y-1">
              {analytics.items.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.value}</span>
                    {item.subtext && (
                      <span className="text-amber-600">{item.subtext}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleViewProjects}
          className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700"
          data-testid="button-view-analytics"
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          View in Projects
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 text-xs ml-auto"
          data-testid="button-dismiss-analytics"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}

export function PhoneNumberCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const args = functionCall.arguments;
  const personName = args.personName as string || 'Unknown';
  const clientName = args.clientName as string | undefined;
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found'>('loading');
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [matchedPerson, setMatchedPerson] = useState<{ name: string; clientName: string } | null>(null);

  const { data: people } = useQuery<{ 
    id: string; 
    firstName: string | null; 
    lastName: string | null; 
    primaryPhone: string | null;
    telephone: string | null;
    relatedCompanies: { id: string; name: string }[] 
  }[]>({
    queryKey: ['/api/people'],
  });

  const { data: clients } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/clients'],
  });

  // Validate phone number format - must look like a real phone number
  const isValidPhoneNumber = (phone: string | null): boolean => {
    if (!phone) return false;
    // Remove common formatting characters
    const cleaned = phone.replace(/[\s\-\(\)\.\+]/g, '');
    // Must be at least 7 digits, at most 15, and primarily numeric
    if (cleaned.length < 7 || cleaned.length > 15) return false;
    // Must be mostly digits (allow for some non-digit chars in original)
    const digitCount = (cleaned.match(/\d/g) || []).length;
    if (digitCount < 7) return false;
    // Reject obvious test/fake patterns (sequential or repeated digits)
    if (/^(\d)\1{6,}$/.test(cleaned)) return false; // All same digit (1111111)
    if (/0?1234567890?/.test(cleaned) || /9876543210?/.test(cleaned)) return false; // Sequential
    if (/123456789/.test(cleaned) || /987654321/.test(cleaned)) return false; // Sequential partial
    return true;
  };

  useEffect(() => {
    if (!people || !clients) return;

    const searchLower = personName.toLowerCase().trim();
    const clientLower = clientName?.toLowerCase().trim();
    
    // Must have a meaningful search term
    if (searchLower.length < 2) {
      setStatus('not_found');
      return;
    }

    let bestMatch: { person: typeof people[0]; score: number; clientName: string } | null = null;
    const MIN_MATCH_SCORE = 40; // Require at least a partial name match

    for (const person of people) {
      const firstName = (person.firstName || '').toLowerCase().trim();
      const lastName = (person.lastName || '').toLowerCase().trim();
      const fullName = `${firstName} ${lastName}`.trim();
      
      // Skip people with no name - they can't be matched by name
      if (!firstName && !lastName) continue;
      
      // Skip people without a valid phone number
      const phoneToUse = person.primaryPhone || person.telephone;
      if (!isValidPhoneNumber(phoneToUse)) continue;
      
      const personClientName = person.relatedCompanies?.[0]?.name || '';
      const personClientLower = personClientName.toLowerCase();

      let score = 0;

      // Exact matches (high confidence)
      if (fullName === searchLower) {
        score += 80;
      } else if (firstName === searchLower || lastName === searchLower) {
        score += 60;
      } 
      // Partial matches - but only if both strings are non-empty and meaningful
      else if (fullName.length >= 2 && searchLower.length >= 2) {
        if (fullName.includes(searchLower)) {
          score += 50;
        } else if (firstName.length >= 2 && firstName.includes(searchLower)) {
          score += 40;
        } else if (lastName.length >= 2 && lastName.includes(searchLower)) {
          score += 40;
        }
        // Also check if search terms match start of name (e.g., "ser" matches "sergei")
        else if (firstName.startsWith(searchLower) || lastName.startsWith(searchLower)) {
          score += 45;
        }
      }

      // Boost score if client name also matches
      if (clientLower && clientLower.length >= 2 && personClientLower.length >= 2) {
        if (personClientLower.includes(clientLower) || clientLower.includes(personClientLower)) {
          score += 30;
        }
      }

      // Only consider if score meets minimum threshold
      if (score >= MIN_MATCH_SCORE) {
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { person, score, clientName: personClientName };
        }
      }
    }

    if (bestMatch) {
      setPhoneNumber(bestMatch.person.primaryPhone || bestMatch.person.telephone || null);
      setMatchedPerson({
        name: `${bestMatch.person.firstName || ''} ${bestMatch.person.lastName || ''}`.trim(),
        clientName: bestMatch.clientName
      });
      setStatus('found');
    } else {
      setStatus('not_found');
    }
    // Note: Don't call onComplete here - let the card stay visible until user dismisses it
  }, [people, clients, personName, clientName]);

  const handleDismiss = () => {
    if (status === 'found' && matchedPerson) {
      onComplete(true, `Found phone number for ${matchedPerson.name}`);
    } else {
      onComplete(false, `No phone number found for ${personName}`);
    }
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 border border-teal-200 dark:border-teal-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-phone"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
          <Phone className="w-4 h-4" />
          <span className="font-medium text-sm">Phone Number Lookup</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="h-6 w-6 p-0"
          data-testid="button-dismiss-phone"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Searching for {personName}...</span>
        </div>
      )}

      {status === 'found' && matchedPerson && phoneNumber && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{matchedPerson.name}</span>
            {matchedPerson.clientName && (
              <span className="text-muted-foreground text-sm">- {matchedPerson.clientName}</span>
            )}
          </div>
          <div className="flex items-center gap-2 bg-teal-100 dark:bg-teal-900/50 rounded-lg px-3 py-2">
            <Phone className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <a 
              href={`tel:${phoneNumber}`}
              className="font-mono text-lg font-medium text-teal-700 dark:text-teal-300 hover:underline"
              data-testid="link-phone-number"
            >
              {phoneNumber}
            </a>
          </div>
        </div>
      )}

      {status === 'not_found' && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">No phone number found for "{personName}"</span>
        </div>
      )}
    </motion.div>
  );
}

export function TasksModalCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const { user } = useAuth();
  const args = functionCall.arguments;
  const userName = args.userName as string | undefined;
  const initialTab = args.initialTab as 'tasks' | 'reminders' | undefined;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(undefined);
  const [resolvedUserName, setResolvedUserName] = useState<string | undefined>(undefined);
  const openedRef = useRef(false);

  const { data: users } = useQuery<UserType[]>({
    queryKey: ['/api/users/for-messaging'],
  });

  useEffect(() => {
    if (openedRef.current) return;
    if (!users) return;

    let targetUserId: string | undefined;
    let targetUserName: string | undefined;

    if (!userName || userName === 'me' || userName.toLowerCase() === 'my') {
      targetUserId = user?.id;
      targetUserName = user ? `${user.firstName} ${user.lastName}` : undefined;
    } else {
      const searchLower = userName.toLowerCase().trim();
      const matchedUser = users.find(u => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().trim();
        const firstName = (u.firstName || '').toLowerCase();
        const lastName = (u.lastName || '').toLowerCase();
        return fullName === searchLower || 
               firstName === searchLower || 
               lastName === searchLower ||
               fullName.includes(searchLower);
      });
      if (matchedUser) {
        targetUserId = matchedUser.id;
        targetUserName = `${matchedUser.firstName || ''} ${matchedUser.lastName || ''}`.trim();
      }
    }

    setResolvedUserId(targetUserId);
    setResolvedUserName(targetUserName);

    openedRef.current = true;
    setTimeout(() => {
      setIsModalOpen(true);
    }, 300);
  }, [users, userName, user]);

  const handleClose = () => {
    setIsModalOpen(false);
    onComplete(true, 'Closed tasks modal');
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3"
        data-testid="action-card-tasks-modal"
      >
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
          {isModalOpen ? (
            <ClipboardList className="w-4 h-4" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          <span className="font-medium text-sm">
            {isModalOpen ? 'Tasks & Reminders' : 'Opening tasks...'}
          </span>
        </div>

        {resolvedUserName && (
          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Showing {resolvedUserName}'s {initialTab === 'reminders' ? 'reminders' : 'tasks'}
          </div>
        )}
      </motion.div>

      <TasksRemindersModal
        isOpen={isModalOpen}
        onClose={handleClose}
        initialTab={initialTab || 'tasks'}
        filterUserId={resolvedUserId}
        filterUserName={resolvedUserName}
      />
    </>
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
    case 'show_tasks_modal':
      return <TasksModalCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'get_phone_number':
      return <PhoneNumberCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'search_clients':
      return <SearchClientsActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'send_email':
      return <EmailActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'send_sms':
      return <SmsActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'get_project_status':
      return <ProjectStatusCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'bench_project':
      return <BenchProjectCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'unbench_project':
      return <UnbenchProjectCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'move_project_stage':
      return <MoveProjectStageCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'get_analytics':
      return <AnalyticsCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
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
