import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type CardColorScheme = 'amber' | 'green' | 'sky' | 'purple' | 'cyan' | 'teal' | 'red' | 'pink';

const colorSchemeClasses: Record<CardColorScheme, string> = {
  amber: 'from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800',
  green: 'from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800',
  sky: 'from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border-sky-200 dark:border-sky-800',
  purple: 'from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800',
  cyan: 'from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 border-cyan-200 dark:border-cyan-800',
  teal: 'from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 border-teal-200 dark:border-teal-800',
  red: 'from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-800',
  pink: 'from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800',
};

export const headerColorClasses: Record<CardColorScheme, string> = {
  amber: 'text-amber-700 dark:text-amber-400',
  green: 'text-green-700 dark:text-green-400',
  sky: 'text-sky-700 dark:text-sky-400',
  purple: 'text-purple-700 dark:text-purple-400',
  cyan: 'text-cyan-700 dark:text-cyan-400',
  teal: 'text-teal-700 dark:text-teal-400',
  red: 'text-red-700 dark:text-red-400',
  pink: 'text-purple-700 dark:text-purple-400',
};

export const buttonColorClasses: Record<CardColorScheme, string> = {
  amber: 'bg-amber-600 hover:bg-amber-700',
  green: 'bg-green-600 hover:bg-green-700',
  sky: 'bg-sky-600 hover:bg-sky-700',
  purple: 'bg-purple-600 hover:bg-purple-700',
  cyan: 'bg-cyan-600 hover:bg-cyan-700',
  teal: 'bg-teal-600 hover:bg-teal-700',
  red: 'bg-red-600 hover:bg-red-700',
  pink: 'bg-purple-600 hover:bg-purple-700',
};

interface ActionCardWrapperProps {
  children: React.ReactNode;
  colorScheme: CardColorScheme;
  testId: string;
  className?: string;
}

export function ActionCardWrapper({ 
  children, 
  colorScheme, 
  testId,
  className 
}: ActionCardWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "bg-gradient-to-br border rounded-xl p-4 space-y-3",
        colorSchemeClasses[colorScheme],
        className
      )}
      data-testid={testId}
    >
      {children}
    </motion.div>
  );
}
