import { useState, useEffect, useCallback, useMemo, createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  ArrowLeft, 
  Save, 
  X, 
  Check,
  Bell,
  Megaphone,
  TrendingUp,
  RefreshCw,
  Target,
  Users,
  MessageSquare,
  FileText,
  TestTube,
  Rocket,
  Loader2,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Clock,
  GripVertical
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import TopNavigation from '@/components/top-navigation';
import { useAuth } from '@/hooks/useAuth';

import { StepOverview } from './steps/StepOverview';
import { StepTargeting } from './steps/StepTargeting';
import { StepRecipients } from './steps/StepRecipients';
import { StepMessages } from './steps/StepMessages';
import { StepPage } from './steps/StepPage';
import { StepTesting } from './steps/StepTesting';
import { StepLaunch } from './steps/StepLaunch';

export type CampaignCategory = 'chase' | 'informational' | 'upsell' | 'engagement';
export type ContactStrategy = 'primary_only' | 'all_contacts' | 'role_based';

export interface WizardState {
  campaignId: string | null;
  currentStep: number;
  lastSaved: Date | null;
  isSaving: boolean;
  isDirty: boolean;
  overview: {
    name: string;
    category: CampaignCategory | null;
    description: string;
    templateId: string | null;
  };
  targeting: {
    filterGroups: FilterGroup[];
    matchedClientCount: number | null;
  };
  recipients: {
    strategy: ContactStrategy;
    channels: { email: boolean; sms: boolean; voice: boolean };
    roles: string[];
    recipientCount: number | null;
    resolved: boolean;
  };
  messages: {
    email: { subject: string; body: string; attachments: string[] } | null;
    sms: { body: string } | null;
    voice: { script: string } | null;
  };
  page: {
    mode: 'skip' | 'create' | 'existing';
    pageId: string | null;
    confirmed: boolean;
  };
  testing: {
    checklistComplete: boolean;
    testsSent: { email: boolean; sms: boolean };
  };
  launch: {
    mode: 'now' | 'scheduled';
    scheduledDate: Date | null;
  };
}

export interface FilterGroup {
  id: string;
  filters: Filter[];
}

export interface Filter {
  id: string;
  filterType: string;
  operator: string;
  value: any;
}

const WIZARD_STEPS = [
  { id: 1, name: 'Overview', icon: FileText, shortName: 'Overview' },
  { id: 2, name: 'Targeting', icon: Target, shortName: 'Target' },
  { id: 3, name: 'Recipients', icon: Users, shortName: 'Recipients' },
  { id: 4, name: 'Messages', icon: MessageSquare, shortName: 'Messages' },
  { id: 5, name: 'Page', icon: FileText, shortName: 'Page' },
  { id: 6, name: 'Testing', icon: TestTube, shortName: 'Testing' },
  { id: 7, name: 'Launch', icon: Rocket, shortName: 'Launch' },
];

const CATEGORY_ICONS: Record<CampaignCategory, any> = {
  chase: Bell,
  informational: Megaphone,
  upsell: TrendingUp,
  engagement: RefreshCw,
};

const CATEGORY_COLORS: Record<CampaignCategory, string> = {
  chase: 'text-orange-600',
  informational: 'text-blue-600',
  upsell: 'text-green-600',
  engagement: 'text-purple-600',
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

const initialState: WizardState = {
  campaignId: null,
  currentStep: 1,
  lastSaved: null,
  isSaving: false,
  isDirty: false,
  overview: {
    name: '',
    category: null,
    description: '',
    templateId: null,
  },
  targeting: {
    filterGroups: [],
    matchedClientCount: null,
  },
  recipients: {
    strategy: 'primary_only',
    channels: { email: true, sms: false, voice: false },
    roles: [],
    recipientCount: null,
    resolved: false,
  },
  messages: {
    email: null,
    sms: null,
    voice: null,
  },
  page: {
    mode: 'skip',
    pageId: null,
    confirmed: false,
  },
  testing: {
    checklistComplete: false,
    testsSent: { email: false, sms: false },
  },
  launch: {
    mode: 'now',
    scheduledDate: null,
  },
};

interface WizardSidebarContextType {
  sidebarContent: ReactNode | null;
  setSidebarContent: (content: ReactNode | null) => void;
}

const WizardSidebarContext = createContext<WizardSidebarContextType>({
  sidebarContent: null,
  setSidebarContent: () => {},
});

export function useWizardSidebar() {
  return useContext(WizardSidebarContext);
}

export default function CampaignWizard() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [state, setState] = useState<WizardState>(initialState);
  const [sidebarContent, setSidebarContent] = useState<ReactNode | null>(null);

  const isNewCampaign = !params.id || params.id === 'new';
  const campaignId = isNewCampaign ? state.campaignId : params.id;

  const { data: existingCampaign, isLoading: isLoadingCampaign } = useQuery<any>({
    queryKey: ['/api/campaigns', params.id],
    enabled: !isNewCampaign,
  });

  useEffect(() => {
    if (existingCampaign && !isNewCampaign) {
      const campaign = existingCampaign as any;
      setState(prev => ({
        ...prev,
        campaignId: campaign.id,
        overview: {
          name: campaign.name || '',
          category: campaign.category as CampaignCategory || null,
          description: campaign.description || '',
          templateId: campaign.templateId || null,
        },
        targeting: {
          filterGroups: parseTargetCriteria(campaign.targetCriteria || []),
          matchedClientCount: null,
        },
        recipients: {
          strategy: campaign.recipientRules?.strategy || 'primary_only',
          channels: campaign.recipientRules?.channels || { email: true, sms: false, voice: false },
          roles: campaign.recipientRules?.roles || [],
          recipientCount: campaign.recipientCount || null,
          resolved: (campaign.recipientCount || 0) > 0,
        },
        messages: parseMessages(campaign.messages || []),
        page: {
          mode: campaign.attachedPageId ? 'existing' : 'skip',
          pageId: campaign.attachedPageId || null,
          confirmed: true,
        },
      }));
    }
  }, [existingCampaign, isNewCampaign]);

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/campaigns', data);
    },
    onSuccess: (data: any) => {
      setState(prev => ({ ...prev, campaignId: data.id, lastSaved: new Date(), isDirty: false }));
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PATCH', `/api/campaigns/${id}`, data);
    },
    onSuccess: () => {
      setState(prev => ({ ...prev, lastSaved: new Date(), isDirty: false, isSaving: false }));
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId] });
    },
    onError: () => {
      setState(prev => ({ ...prev, isSaving: false }));
    },
  });

  const autoSave = useCallback(async () => {
    if (!state.isDirty) return;
    
    setState(prev => ({ ...prev, isSaving: true }));

    const campaignData = {
      name: state.overview.name || 'Untitled Campaign',
      category: state.overview.category,
      description: state.overview.description || null,
      recipientRules: {
        strategy: state.recipients.strategy,
        channels: state.recipients.channels,
        roles: state.recipients.roles,
      },
      attachedPageId: state.page.pageId,
    };

    if (campaignId) {
      updateCampaignMutation.mutate({ id: campaignId, data: campaignData });
    } else if (state.overview.name && state.overview.category) {
      createCampaignMutation.mutate(campaignData);
    }
  }, [state, campaignId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.isDirty && (state.overview.name || campaignId)) {
        autoSave();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [state.isDirty, state.overview.name, campaignId, autoSave]);

  const updateState = useCallback((updates: Partial<WizardState> | ((prev: WizardState) => Partial<WizardState>)) => {
    setState(prev => {
      const newUpdates = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...newUpdates, isDirty: true };
    });
  }, []);

  const goToStep = useCallback(async (step: number) => {
    if (step < 1 || step > 7) return;
    
    if (step > 1 && !state.overview.name) {
      toast({ title: 'Campaign name required', description: 'Please enter a campaign name before continuing', variant: 'destructive' });
      return;
    }
    if (step > 1 && !state.overview.category) {
      toast({ title: 'Campaign type required', description: 'Please select a campaign type before continuing', variant: 'destructive' });
      return;
    }
    
    if (step > 1 && !campaignId && state.overview.name && state.overview.category) {
      const campaignData = {
        name: state.overview.name,
        category: state.overview.category,
        description: state.overview.description || null,
        recipientRules: {
          strategy: state.recipients.strategy,
          channels: state.recipients.channels,
          roles: state.recipients.roles,
        },
        attachedPageId: state.page.pageId,
      };
      try {
        await createCampaignMutation.mutateAsync(campaignData);
      } catch (error) {
        toast({ title: 'Failed to save campaign', description: 'Please try again', variant: 'destructive' });
        return;
      }
    }
    
    setState(prev => ({ ...prev, currentStep: step }));
  }, [state, campaignId, createCampaignMutation, toast]);

  const nextStep = useCallback(() => {
    goToStep(state.currentStep + 1);
  }, [state.currentStep, goToStep]);

  const prevStep = useCallback(() => {
    goToStep(state.currentStep - 1);
  }, [state.currentStep, goToStep]);

  const isStepComplete = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        return !!state.overview.name && !!state.overview.category;
      case 2:
        return state.targeting.filterGroups.length > 0 && (state.targeting.matchedClientCount ?? 0) > 0;
      case 3:
        return state.recipients.resolved && (state.recipients.recipientCount ?? 0) > 0;
      case 4:
        return !!(state.messages.email?.body || state.messages.sms?.body || state.messages.voice?.script);
      case 5:
        // Page step is complete if user has explicitly confirmed their choice
        // This tracks whether they've made an active decision (skip, create, or existing)
        return state.page.confirmed;
      case 6:
        return state.testing.checklistComplete;
      case 7:
        return false;
      default:
        return false;
    }
  }, [state]);

  const canProceedFromStep = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        return !!state.overview.name && !!state.overview.category;
      default:
        return true;
    }
  }, [state]);

  const formatLastSaved = (date: Date | null): string => {
    if (!date) return 'Not saved';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    return date.toLocaleTimeString();
  };

  const CategoryIcon = state.overview.category ? CATEGORY_ICONS[state.overview.category] : null;

  if (isLoadingCampaign && !isNewCampaign) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading campaign...</span>
        </div>
      </div>
    );
  }

  return (
    <WizardSidebarContext.Provider value={{ sidebarContent, setSidebarContent }}>
      <div className="min-h-screen bg-muted/30 flex flex-col" data-testid="campaign-wizard">
        <TopNavigation user={user} />
        
        <header className="bg-background border-b px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/super-admin/campaigns')}
              data-testid="button-back-to-campaigns"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Campaigns
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              {CategoryIcon && (
                <CategoryIcon className={cn("h-5 w-5", state.overview.category && CATEGORY_COLORS[state.overview.category])} />
              )}
              <h1 className="font-semibold text-lg" data-testid="text-campaign-name">
                {state.overview.name || 'New Campaign'}
              </h1>
              {state.overview.category && (
                <Badge variant="outline" className="capitalize">
                  {state.overview.category}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {state.isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  <span>{formatLastSaved(state.lastSaved)}</span>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => autoSave()}
              disabled={!state.isDirty || state.isSaving}
              data-testid="button-save-draft"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/super-admin/campaigns')}
              data-testid="button-exit"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <nav className="bg-background border-b px-6 py-3" data-testid="horizontal-stepper">
          <div className="flex items-center justify-center gap-1">
            {WIZARD_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = state.currentStep === step.id;
              const isComplete = isStepComplete(step.id);
              const isAccessible = step.id === 1 || canProceedFromStep(step.id - 1);

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => isAccessible && goToStep(step.id)}
                    disabled={!isAccessible}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                      isActive && "bg-primary text-primary-foreground shadow-sm",
                      !isActive && isComplete && "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400",
                      !isActive && !isComplete && isAccessible && "hover:bg-muted text-muted-foreground",
                      !isAccessible && "opacity-40 cursor-not-allowed text-muted-foreground"
                    )}
                    data-testid={`step-nav-${step.id}`}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                      isActive && "bg-primary-foreground/20 text-primary-foreground",
                      !isActive && isComplete && "bg-green-200 dark:bg-green-800",
                      !isActive && !isComplete && "bg-muted"
                    )}>
                      {isComplete && !isActive ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        step.id
                      )}
                    </div>
                    <span className="text-sm font-medium hidden md:inline">{step.name}</span>
                  </button>
                  {index < WIZARD_STEPS.length - 1 && (
                    <div className={cn(
                      "w-8 h-px mx-1",
                      isComplete ? "bg-green-300 dark:bg-green-700" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="flex flex-1 overflow-hidden">
          {sidebarContent && (
            <aside className="w-72 bg-background border-r flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                {sidebarContent}
              </ScrollArea>
            </aside>
          )}

          <main className="flex-1 overflow-auto">
            <div className={cn(
              "mx-auto p-6",
              sidebarContent ? "max-w-4xl" : "max-w-5xl"
            )}>
              {state.currentStep === 1 && (
                <StepOverview
                  state={state}
                  updateState={updateState}
                  campaignId={campaignId || null}
                />
              )}
              {state.currentStep === 2 && (
                <StepTargeting
                  state={state}
                  updateState={updateState}
                  campaignId={campaignId || null}
                />
              )}
              {state.currentStep === 3 && (
                <StepRecipients
                  state={state}
                  updateState={updateState}
                  campaignId={campaignId || null}
                />
              )}
              {state.currentStep === 4 && (
                <StepMessages
                  state={state}
                  updateState={updateState}
                  campaignId={campaignId || null}
                />
              )}
              {state.currentStep === 5 && (
                <StepPage
                  state={state}
                  updateState={updateState}
                  campaignId={campaignId || null}
                />
              )}
              {state.currentStep === 6 && (
                <StepTesting
                  state={state}
                  updateState={updateState}
                  campaignId={campaignId || null}
                />
              )}
              {state.currentStep === 7 && (
                <StepLaunch
                  state={state}
                  updateState={updateState}
                  campaignId={campaignId || null}
                />
              )}

              <div className="flex items-center justify-between mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={state.currentStep === 1}
                  data-testid="button-previous-step"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>

                <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full">
                  <span className="text-sm text-muted-foreground">
                    Step {state.currentStep} of {WIZARD_STEPS.length}
                  </span>
                  {state.targeting.matchedClientCount !== null && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <span className="text-sm font-medium">
                        {state.targeting.matchedClientCount} clients
                      </span>
                    </>
                  )}
                </div>

                {state.currentStep < 7 ? (
                  <Button
                    onClick={nextStep}
                    disabled={!canProceedFromStep(state.currentStep)}
                    data-testid="button-next-step"
                  >
                    Continue
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => {}}
                    disabled={!state.testing.checklistComplete}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-launch-campaign"
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    Launch Campaign
                  </Button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </WizardSidebarContext.Provider>
  );
}

function parseTargetCriteria(criteria: any[]): FilterGroup[] {
  if (!criteria || criteria.length === 0) return [];
  
  const groupedByGroup: Record<number, Filter[]> = {};
  criteria.forEach((c: any) => {
    const groupNum = c.groupNumber || 0;
    if (!groupedByGroup[groupNum]) groupedByGroup[groupNum] = [];
    groupedByGroup[groupNum].push({
      id: c.id || generateId(),
      filterType: c.filterType,
      operator: c.operator,
      value: c.filterValue,
    });
  });

  return Object.entries(groupedByGroup).map(([num, filters]) => ({
    id: `group-${num}`,
    filters,
  }));
}

function parseMessages(messages: any[]): WizardState['messages'] {
  const result: WizardState['messages'] = { email: null, sms: null, voice: null };
  
  messages.forEach((m: any) => {
    if (m.channel === 'email') {
      result.email = { subject: m.subject || '', body: m.body || '', attachments: [] };
    } else if (m.channel === 'sms') {
      result.sms = { body: m.body || '' };
    } else if (m.channel === 'voice') {
      result.voice = { script: m.body || '' };
    }
  });

  return result;
}
