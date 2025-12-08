import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import type { ActionCardProps } from './types';

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
