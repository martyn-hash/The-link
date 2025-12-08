import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { 
  Bell, 
  CheckSquare, 
  Mail, 
  MessageSquare, 
  X,
  Check,
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
import { SearchableSelect } from './SearchableSelect';
import { RecipientSelector } from './RecipientSelector';
import { 
  ReminderActionCard, 
  TaskActionCard, 
  NavigationActionCard,
  ShowTasksActionCard,
  ShowRemindersActionCard,
  SearchClientsActionCard,
  type ActionCardProps
} from './cards';
import type { User as UserType } from '@shared/schema';

export { 
  ReminderActionCard, 
  TaskActionCard, 
  NavigationActionCard,
  ShowTasksActionCard,
  ShowRemindersActionCard,
  SearchClientsActionCard
};


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

interface PersonMatch {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  clientId: string | null;
  clientName: string | null;
  confidence: number;
  matchType: string;
  hasPhone: boolean;
}

export function CallContactActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const args = functionCall.arguments;
  const personName = args.personName as string;
  const matches = (args.matches || []) as PersonMatch[];
  const selectedPerson = args.selectedPerson as PersonMatch | undefined;
  const noMatches = args.noMatches as boolean;
  const needsDisambiguation = args.needsDisambiguation as boolean;
  
  const [selectedMatch, setSelectedMatch] = useState<PersonMatch | null>(selectedPerson || (matches.length === 1 ? matches[0] : null));
  
  const handleCall = () => {
    if (selectedMatch) {
      const phoneNumber = selectedMatch.phone;
      if (phoneNumber) {
        window.dispatchEvent(new CustomEvent('ai-magic-call-person', {
          detail: {
            personId: selectedMatch.id,
            personName: selectedMatch.name,
            phoneNumber: phoneNumber,
            clientId: selectedMatch.clientId,
            clientName: selectedMatch.clientName
          }
        }));
        onComplete(true, `Calling ${selectedMatch.name} at ${phoneNumber}`);
      }
    }
  };
  
  const handleSelectMatch = (match: PersonMatch) => {
    setSelectedMatch(match);
  };
  
  if (noMatches) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3"
        data-testid="action-card-call-no-matches"
      >
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium text-sm">No contacts found</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Could not find anyone named "{personName}" with a phone number.
        </p>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7 text-xs">
          <X className="w-3 h-3 mr-1" />
          Dismiss
        </Button>
      </motion.div>
    );
  }
  
  if (needsDisambiguation && !selectedMatch) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3"
        data-testid="action-card-call-disambiguation"
      >
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
          <Phone className="w-4 h-4" />
          <span className="font-medium text-sm">Who do you want to call?</span>
        </div>
        <p className="text-xs text-muted-foreground">Multiple matches found for "{personName}"</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {matches.map((match) => (
            <div
              key={match.id}
              onClick={() => handleSelectMatch(match)}
              className="flex items-center gap-3 p-2 bg-background/80 rounded-lg border hover:border-blue-400 cursor-pointer transition-colors"
              data-testid={`call-match-${match.id}`}
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{match.name}</div>
                {match.clientName && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {match.clientName}
                  </div>
                )}
                <div className="text-xs text-emerald-600 dark:text-emerald-400">{match.phone}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-call-contact"
    >
      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
        <Phone className="w-4 h-4" />
        <span className="font-medium text-sm">Call Contact</span>
      </div>
      
      {selectedMatch && (
        <div className="flex items-center gap-3 p-3 bg-background/80 rounded-lg border">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
            <User className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{selectedMatch.name}</div>
            {selectedMatch.clientName && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {selectedMatch.clientName}
              </div>
            )}
            <div className="text-sm text-emerald-600 dark:text-emerald-400 font-mono">{selectedMatch.phone}</div>
          </div>
        </div>
      )}
      
      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={handleCall}
          disabled={!selectedMatch}
          className="flex-1 h-8 bg-green-600 hover:bg-green-700"
          data-testid="button-call-now"
        >
          <Phone className="w-3.5 h-3.5 mr-1.5" />
          Call Now
        </Button>
        {matches.length > 1 && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setSelectedMatch(null)}
            className="h-8"
          >
            Change
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-8 px-2">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

export function QuickSmsActionCard({ functionCall, onComplete, onDismiss }: ActionCardProps) {
  const args = functionCall.arguments;
  const personName = args.personName as string;
  const prefilledMessage = args.message as string | undefined;
  const matches = (args.matches || []) as PersonMatch[];
  const selectedPerson = args.selectedPerson as PersonMatch | undefined;
  const noMatches = args.noMatches as boolean;
  const needsDisambiguation = args.needsDisambiguation as boolean;
  
  const [selectedMatch, setSelectedMatch] = useState<PersonMatch | null>(selectedPerson || (matches.length === 1 ? matches[0] : null));
  
  const handleSms = () => {
    if (selectedMatch) {
      const phoneNumber = selectedMatch.phone;
      if (phoneNumber) {
        window.dispatchEvent(new CustomEvent('ai-magic-sms-person', {
          detail: {
            personId: selectedMatch.id,
            personName: selectedMatch.name,
            phoneNumber: phoneNumber,
            clientId: selectedMatch.clientId,
            clientName: selectedMatch.clientName,
            message: prefilledMessage
          }
        }));
        onComplete(true, `Opening SMS to ${selectedMatch.name}`);
      }
    }
  };
  
  const handleSelectMatch = (match: PersonMatch) => {
    setSelectedMatch(match);
  };
  
  if (noMatches) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3"
        data-testid="action-card-sms-no-matches"
      >
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="font-medium text-sm">No contacts found</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Could not find anyone named "{personName}" with a phone number.
        </p>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7 text-xs">
          <X className="w-3 h-3 mr-1" />
          Dismiss
        </Button>
      </motion.div>
    );
  }
  
  if (needsDisambiguation && !selectedMatch) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-3"
        data-testid="action-card-sms-disambiguation"
      >
        <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
          <MessageSquare className="w-4 h-4" />
          <span className="font-medium text-sm">Who do you want to text?</span>
        </div>
        <p className="text-xs text-muted-foreground">Multiple matches found for "{personName}"</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {matches.map((match) => (
            <div
              key={match.id}
              onClick={() => handleSelectMatch(match)}
              className="flex items-center gap-3 p-2 bg-background/80 rounded-lg border hover:border-purple-400 cursor-pointer transition-colors"
              data-testid={`sms-match-${match.id}`}
            >
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                <User className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{match.name}</div>
                {match.clientName && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {match.clientName}
                  </div>
                )}
                <div className="text-xs text-emerald-600 dark:text-emerald-400">{match.phone}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-3"
      data-testid="action-card-quick-sms"
    >
      <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
        <MessageSquare className="w-4 h-4" />
        <span className="font-medium text-sm">Send SMS</span>
      </div>
      
      {selectedMatch && (
        <div className="flex items-center gap-3 p-3 bg-background/80 rounded-lg border">
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
            <User className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{selectedMatch.name}</div>
            {selectedMatch.clientName && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {selectedMatch.clientName}
              </div>
            )}
            <div className="text-sm text-emerald-600 dark:text-emerald-400 font-mono">{selectedMatch.phone}</div>
          </div>
        </div>
      )}
      
      <div className="flex gap-2">
        <Button 
          size="sm" 
          onClick={handleSms}
          disabled={!selectedMatch}
          className="flex-1 h-8 bg-purple-600 hover:bg-purple-700"
          data-testid="button-send-sms"
        >
          <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
          Send SMS
        </Button>
        {matches.length > 1 && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setSelectedMatch(null)}
            className="h-8"
          >
            Change
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-8 px-2">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
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
    case 'call_contact':
      return <CallContactActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
    case 'quick_sms':
      return <QuickSmsActionCard functionCall={functionCall} onComplete={onComplete} onDismiss={onDismiss} />;
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