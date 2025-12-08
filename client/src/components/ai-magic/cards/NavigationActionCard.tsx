import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ActionCardProps } from './types';

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
