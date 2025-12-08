import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import type { ActionCardProps } from './types';

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
    
    const searchLower = searchTerm.toLowerCase().trim();
    const exactMatch = clients.find(c => c.name.toLowerCase().trim() === searchLower);
    
    const closeMatch = !exactMatch ? clients.find(c => {
      const nameLower = c.name.toLowerCase().trim();
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
