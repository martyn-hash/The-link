import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckSquare, Check, X, Edit2, Loader2, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import type { User as UserType } from '@shared/schema';
import type { ActionCardProps } from './types';

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
        if (!isNaN(date.getTime())) return format(date, 'yyyy-MM-dd');
      } catch {}
    }
    return '';
  });
  const [isEditing, setIsEditing] = useState(false);

  const { data: users } = useQuery<UserType[]>({ queryKey: ['/api/users/for-messaging'] });
  const { data: taskTypes } = useQuery<{ id: string; name: string }[]>({ queryKey: ['/api/task-types'] });
  
  const matchedTaskType = taskTypes?.find(t => 
    t.name.toLowerCase() === suggestedTaskTypeName?.toLowerCase() ||
    t.name.toLowerCase().includes(suggestedTaskTypeName?.toLowerCase() || '') ||
    (suggestedTaskTypeName?.toLowerCase() || '').includes(t.name.toLowerCase())
  );
  
  const effectiveTaskTypeId = taskTypeId || (matchedTaskType?.id ?? '');

  const matchedAssignee = users?.find(u => {
    const assigneeName = (args.assigneeName as string || '').toLowerCase();
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().trim();
    return fullName.includes(assigneeName) || assigneeName.includes(fullName);
  });

  const effectiveAssigneeId = assigneeId || matchedAssignee?.id || '';
  const hasValidTaskType = effectiveTaskTypeId.length > 0;
  const isValid = title.trim().length > 0 && effectiveAssigneeId.length > 0 && hasValidTaskType;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!isValid) throw new Error('Please fill in all required fields');
      if (!effectiveTaskTypeId) throw new Error('Please select a task type');
      
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
          <span className="text-xs text-blue-600 dark:text-blue-400">Click Create to confirm</span>
        )}
        {!effectiveTaskTypeId && (
          <span className="text-xs text-amber-600 dark:text-amber-400">Select a type to continue</span>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" data-testid="input-task-title" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} className="text-sm min-h-[60px]" data-testid="input-task-description" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Task Type {matchedTaskType ? '(AI suggested)' : '*'}</Label>
              <Select value={effectiveTaskTypeId} onValueChange={handleTaskTypeChange}>
                <SelectTrigger className={cn("h-8 text-sm", !effectiveTaskTypeId && "border-amber-400")} data-testid="select-task-type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {taskTypes?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-task-priority"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="h-8 text-sm" data-testid="select-task-assignee"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent className="z-[100]">
                  {users?.map(u => <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-sm" data-testid="input-task-due-date" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <div className="font-medium">{title || 'Untitled task'}</div>
          {description && <div className="text-muted-foreground text-xs">{description}</div>}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded bg-muted">{taskTypeName}</span>
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{assigneeName}</span>
            <span className={cn(
              "px-1.5 py-0.5 rounded text-xs",
              priority === 'urgent' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              priority === 'high' && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
              priority === 'medium' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
              priority === 'low' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            )}>{priority}</span>
            {dueDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(dueDate), 'd MMM')}</span>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={() => createMutation.mutate()} disabled={!isValid || createMutation.isPending} className="h-7 text-xs" data-testid="button-confirm-task">
          {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
          Create
        </Button>
        <Button size="sm" variant="outline" onClick={() => setIsEditing(!isEditing)} className="h-7 text-xs" data-testid="button-edit-task">
          <Edit2 className="w-3 h-3 mr-1" />{isEditing ? 'Preview' : 'Edit'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7 text-xs ml-auto" data-testid="button-dismiss-task">
          <X className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
}
