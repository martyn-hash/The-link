/**
 * Matcher Debug Panel
 * 
 * Testing interface for the people-client matching algorithm.
 * Enter partial person name and partial company name to see
 * scored matches with detailed breakdown.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  User, 
  Building2, 
  Mail, 
  Phone, 
  CheckCircle2, 
  XCircle,
  ChevronDown,
  ChevronRight,
  Bug,
  Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { 
  getAllScoredMatches,
  type MatchResult,
  type PersonWithClient 
} from '@/lib/peopleMatcher';

interface RawPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  primaryEmail: string | null;
  telephone: string | null;
  primaryPhone: string | null;
  relatedCompanies: { id: string; name: string }[];
}

interface MatcherDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MatcherDebugPanel({ isOpen, onClose }: MatcherDebugPanelProps) {
  const [personTerm, setPersonTerm] = useState('');
  const [companyTerm, setCompanyTerm] = useState('');
  const [requireEmail, setRequireEmail] = useState(false);
  const [requireMobile, setRequireMobile] = useState(false);
  const [minScore, setMinScore] = useState([10]);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // Fetch people and clients
  const { data: rawPeople, isLoading: loadingPeople } = useQuery<RawPerson[]>({
    queryKey: ['/api/people'],
  });

  const { data: clients, isLoading: loadingClients } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/clients'],
  });

  // Transform people data
  const people = useMemo(() => {
    if (!rawPeople) return [];
    return rawPeople.map(p => ({
      ...p,
      email: p.email || p.primaryEmail,
      telephone: p.telephone || p.primaryPhone,
      clientId: p.relatedCompanies?.[0]?.id || ''
    }));
  }, [rawPeople]);

  // Run matching
  const matchResults = useMemo(() => {
    if (!personTerm.trim() && !companyTerm.trim()) return [];
    if (!people.length || !clients?.length) return [];

    return getAllScoredMatches(
      { personTerm: personTerm.trim(), companyTerm: companyTerm.trim() || undefined },
      people,
      clients,
      { minScore: minScore[0], requireEmail, requireMobile }
    );
  }, [personTerm, companyTerm, people, clients, minScore, requireEmail, requireMobile]);

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedResults);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedResults(newSet);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    if (score >= 30) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800';
    if (score >= 50) return 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800';
    if (score >= 30) return 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800';
    return 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800';
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-purple-500" />
            <h2 className="font-semibold text-lg">Matcher Debug Panel</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XCircle className="w-4 h-4" />
          </Button>
        </div>

        {/* Inputs */}
        <div className="p-4 border-b border-border space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <User className="w-3.5 h-3.5" />
                Person Name (partial)
              </Label>
              <Input
                value={personTerm}
                onChange={(e) => setPersonTerm(e.target.value)}
                placeholder="e.g., john, josie, mark"
                className="h-9"
                data-testid="debug-person-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Building2 className="w-3.5 h-3.5" />
                Company Name (partial)
              </Label>
              <Input
                value={companyTerm}
                onChange={(e) => setCompanyTerm(e.target.value)}
                placeholder="e.g., victoriam, monkey"
                className="h-9"
                data-testid="debug-company-input"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center text-sm">
            <div className="flex items-center gap-2">
              <Switch 
                id="require-email"
                checked={requireEmail} 
                onCheckedChange={setRequireEmail}
              />
              <Label htmlFor="require-email" className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                Has Email
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="require-mobile"
                checked={requireMobile} 
                onCheckedChange={setRequireMobile}
              />
              <Label htmlFor="require-mobile" className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                Has Mobile
              </Label>
            </div>
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              <Label className="whitespace-nowrap text-muted-foreground">Min Score: {minScore[0]}</Label>
              <Slider
                value={minScore}
                onValueChange={setMinScore}
                min={1}
                max={50}
                step={1}
                className="flex-1"
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>People: {people.length}</span>
            <span>•</span>
            <span>Clients: {clients?.length || 0}</span>
            <span>•</span>
            <span className="text-foreground font-medium">Matches: {matchResults.length}</span>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {(loadingPeople || loadingClients) && (
            <div className="text-center py-8 text-muted-foreground">Loading data...</div>
          )}
          
          {!loadingPeople && !loadingClients && !personTerm.trim() && !companyTerm.trim() && (
            <div className="text-center py-8 text-muted-foreground">
              Enter a person name or company name to see matches
            </div>
          )}

          {!loadingPeople && !loadingClients && (personTerm.trim() || companyTerm.trim()) && matchResults.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No matches found with current filters
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {matchResults.map((result, index) => (
              <motion.div
                key={result.person.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.03 }}
              >
                <Collapsible 
                  open={expandedResults.has(result.person.id)}
                  onOpenChange={() => toggleExpanded(result.person.id)}
                >
                  <div className={cn(
                    "rounded-lg border p-3 transition-colors",
                    index === 0 && "ring-2 ring-purple-500/50",
                    getScoreBg(result.score)
                  )}>
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "font-bold text-lg w-12 text-center",
                            getScoreColor(result.score)
                          )}>
                            {Math.round(result.score)}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {result.matchedPersonName || 'Unknown'}
                              {index === 0 && (
                                <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Best Match
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {result.clientName || 'No company'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.hasEmail ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-muted-foreground/50" />
                          )}
                          {result.hasMobile ? (
                            <Phone className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Phone className="w-4 h-4 text-muted-foreground/50" />
                          )}
                          {expandedResults.has(result.person.id) ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                        {/* Score Breakdown */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="space-y-1">
                            <div className="text-muted-foreground font-medium">Score Breakdown:</div>
                            <div className="flex justify-between">
                              <span>Person Name</span>
                              <span className="font-mono">{result.scoreBreakdown.personNameScore.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Client Name</span>
                              <span className="font-mono">{result.scoreBreakdown.clientNameScore.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Exact Match Bonus</span>
                              <span className="font-mono">{result.scoreBreakdown.exactMatchBonus.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>From Pattern Bonus</span>
                              <span className="font-mono">{result.scoreBreakdown.fromPatternBonus.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Suggested Client Bonus</span>
                              <span className="font-mono">{result.scoreBreakdown.suggestedClientBonus.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between font-medium border-t pt-1">
                              <span>Total</span>
                              <span className="font-mono">{result.scoreBreakdown.total.toFixed(1)}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-muted-foreground font-medium">Debug Info:</div>
                            <div className="flex justify-between">
                              <span>Query Person</span>
                              <span className="font-mono truncate max-w-[120px]">"{result.debugInfo.queryParsed.personSearch}"</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Query Client</span>
                              <span className="font-mono truncate max-w-[120px]">"{result.debugInfo.queryParsed.clientSearch || 'none'}"</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Used "from" pattern</span>
                              <span className="font-mono">{result.debugInfo.queryParsed.usedFromPattern ? 'yes' : 'no'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Person Name (DB)</span>
                              <span className="font-mono truncate max-w-[120px]">"{result.debugInfo.personNameLower}"</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Client Name (DB)</span>
                              <span className="font-mono truncate max-w-[120px]">"{result.debugInfo.clientNameLower}"</span>
                            </div>
                          </div>
                        </div>

                        {/* Contact Info */}
                        <div className="text-xs space-y-1 bg-muted/50 rounded p-2">
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span className={result.hasEmail ? '' : 'text-muted-foreground'}>
                              {result.person.email || result.person.primaryEmail || 'No email'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            <span className={result.hasMobile ? '' : 'text-muted-foreground'}>
                              {result.person.telephone || result.person.primaryPhone || 'No mobile'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
