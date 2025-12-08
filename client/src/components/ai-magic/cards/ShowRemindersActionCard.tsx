import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import type { ActionCardProps } from './types';

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
