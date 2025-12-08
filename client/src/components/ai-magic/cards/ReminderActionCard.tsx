import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Check, X, Edit2, Loader2, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { SearchableSelect } from '../SearchableSelect';
import type { User as UserType } from '@shared/schema';
import type { ActionCardProps } from './types';

export function ReminderActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const args = functionCall.arguments;
  const suggestedAssigneeName = args.assigneeName as string | undefined;
  
  const [title, setTitle] = useState(args.title as string || '');
  const [description, setDescription] = useState(args.details as string || '');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
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

  const aiTriedToAssignOther = suggestedAssigneeName && 
    suggestedAssigneeName.trim().length > 0 && 
    suggestedAssigneeName.toLowerCase() !== 'me' && 
    suggestedAssigneeName.toLowerCase() !== 'myself';

  const matchedAssignee = useMemo(() => {
    if (!aiTriedToAssignOther || !staffMembers) return undefined;
    
    const searchTerms = suggestedAssigneeName!.toLowerCase().trim().split(/\s+/);
    let bestMatch: { user: UserType; score: number } | undefined;
    
    for (const staff of staffMembers) {
      const firstName = (staff.firstName || '').toLowerCase();
      const lastName = (staff.lastName || '').toLowerCase();
      let score = 0;
      
      for (const term of searchTerms) {
        if (firstName === term) score += 50;
        else if (lastName === term) score += 50;
        else if (firstName.startsWith(term) && term.length >= 2) score += 30;
        else if (lastName.startsWith(term) && term.length >= 2) score += 30;
      }
      
      if (score >= 30 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { user: staff, score };
      }
    }
    
    return bestMatch?.user;
  }, [aiTriedToAssignOther, suggestedAssigneeName, staffMembers]);

  const effectiveAssigneeId = useMemo(() => {
    if (assigneeId !== null && assigneeId.length > 0) return assigneeId;
    if (matchedAssignee) return matchedAssignee.id;
    if (aiTriedToAssignOther) return '';
    return user?.id || '';
  }, [assigneeId, matchedAssignee, aiTriedToAssignOther, user?.id]);

  const assigneeRequired = aiTriedToAssignOther && !matchedAssignee && (!assigneeId || assigneeId.length === 0);
  const isValid = title.trim().length > 0 && dueDate.length > 0 && dueTime.length > 0 && effectiveAssigneeId.length > 0;
  
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isValid) throw new Error('Please fill in all required fields');
      if (!effectiveAssigneeId || effectiveAssigneeId.length === 0) {
        throw new Error('Please select who to assign this reminder to');
      }
      const dueDateTime = new Date(`${dueDate}T${dueTime}`);
      if (isNaN(dueDateTime.getTime())) throw new Error('Invalid date/time');
      
      return await apiRequest('POST', '/api/internal-tasks', {
        title: title.trim(),
        description: description?.trim() || undefined,
        dueDate: dueDateTime.toISOString(),
        assignedTo: effectiveAssigneeId,
        isQuickReminder: true,
        priority: 'medium',
      });
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
    if (assigneeRequired) return `${suggestedAssigneeName} (not found - please select)`;
    const matchedStaff = staffMembers?.find(u => u.id === effectiveAssigneeId);
    if (matchedStaff) return `${matchedStaff.firstName} ${matchedStaff.lastName}`.trim();
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
