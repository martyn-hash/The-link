import { Building2, User, Users, Check, ChevronRight, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FuzzyMatchResult, DisambiguationData } from './types';

interface AIMagicDisambiguationProps {
  data: DisambiguationData;
}

export function AIMagicDisambiguation({ data }: AIMagicDisambiguationProps) {
  const { entityType, searchTerm, matches, onSelect, onCancel } = data;

  const getIcon = () => {
    switch (entityType) {
      case 'client':
        return <Building2 className="h-4 w-4" />;
      case 'user':
        return <User className="h-4 w-4" />;
      case 'person':
        return <Users className="h-4 w-4" />;
    }
  };

  const getLabel = () => {
    switch (entityType) {
      case 'client':
        return 'clients';
      case 'user':
        return 'team members';
      case 'person':
        return 'contacts';
    }
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.9) return 'High match';
    if (confidence >= 0.7) return 'Good match';
    if (confidence >= 0.5) return 'Partial match';
    return 'Low match';
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.7) return 'text-blue-600 dark:text-blue-400';
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const getMatchTypeLabel = (matchType?: string): string => {
    switch (matchType) {
      case 'exact':
        return 'Exact match';
      case 'starts_with':
        return 'Starts with';
      case 'abbreviation':
        return 'Abbreviation';
      case 'contains':
        return 'Contains';
      case 'word_match':
        return 'Word match';
      case 'fuzzy':
        return 'Similar to';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg overflow-hidden" data-testid="disambiguation-panel">
      <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Multiple {getLabel()} match "{searchTerm}"
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-6 w-6 p-0"
            data-testid="btn-cancel-disambiguation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Please select the correct one:
        </p>
      </div>

      <div className="max-h-60 overflow-y-auto">
        {matches.map((match, index) => (
          <button
            key={match.id}
            onClick={() => onSelect(match)}
            className={cn(
              "w-full px-4 py-3 flex items-center justify-between gap-3",
              "hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors",
              "border-b border-zinc-100 dark:border-zinc-800 last:border-b-0",
              "text-left focus:outline-none focus:bg-zinc-100 dark:focus:bg-zinc-800"
            )}
            data-testid={`disambiguation-option-${index}`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
                {getIcon()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {match.name}
                </div>
                {match.email && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {match.email}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn("text-xs", getConfidenceColor(match.confidence))}>
                    {getConfidenceLabel(match.confidence)}
                  </span>
                  {match.matchType && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      ({getMatchTypeLabel(match.matchType)})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
          </button>
        ))}
      </div>

      {matches.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No matching {getLabel()} found for "{searchTerm}"
          </p>
        </div>
      )}

      <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
          Tip: Be more specific to get better matches
        </p>
      </div>
    </div>
  );
}
