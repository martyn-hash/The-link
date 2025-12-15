import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Circle,
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
  Clock
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
  { id: 1, name: 'Overview', icon: FileText, description: 'Name and type' },
  { id: 2, name: 'Targeting', icon: Target, description: 'Select audience' },
  { id: 3, name: 'Recipients', icon: Users, description: 'Resolve contacts' },
  { id: 4, name: 'Messages', icon: MessageSquare, description: 'Compose content' },
  { id: 5, name: 'Page', icon: FileText, description: 'Optional landing page' },
  { id: 6, name: 'Testing', icon: TestTube, description: 'Quality assurance' },
  { id: 7, name: 'Launch', icon: Rocket, description: 'Schedule & send' },
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

export default function CampaignWizard() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const { toast } = useToast();
  const [state, setState] = useState<WizardState>(initialState);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    
    // Ensure campaign is persisted before moving to step 2+
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
        return true;
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
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return true;
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

  const currentStepData = WIZARD_STEPS[state.currentStep - 1];
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
    <div className="min-h-screen bg-muted/30 flex flex-col" data-testid="campaign-wizard">
      <header className="bg-background border-b px-4 py-3 flex items-center justify-between sticky top-0 z-50">
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
              {state.overview.name || 'Create New Campaign'}
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

      <div className="flex flex-1 overflow-hidden">
        <aside 
          className={cn(
            "bg-background border-r flex flex-col transition-all duration-200",
            sidebarCollapsed ? "w-16" : "w-72"
          )}
        >
          <ScrollArea className="flex-1">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Progress
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </div>

              <nav className="space-y-1" role="navigation" aria-label="Campaign wizard steps">
                {WIZARD_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = state.currentStep === step.id;
                  const isComplete = isStepComplete(step.id);
                  const isAccessible = step.id === 1 || canProceedFromStep(step.id - 1);

                  return (
                    <button
                      key={step.id}
                      onClick={() => isAccessible && goToStep(step.id)}
                      disabled={!isAccessible}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                        isActive && "bg-primary text-primary-foreground",
                        !isActive && isComplete && "bg-green-50 text-green-700 hover:bg-green-100",
                        !isActive && !isComplete && isAccessible && "hover:bg-muted",
                        !isAccessible && "opacity-50 cursor-not-allowed"
                      )}
                      aria-current={isActive ? 'step' : undefined}
                      data-testid={`step-${step.id}-${step.name.toLowerCase()}`}
                    >
                      <div className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                        isActive && "bg-primary-foreground/20",
                        !isActive && isComplete && "bg-green-200",
                        !isActive && !isComplete && "bg-muted"
                      )}>
                        {isComplete && !isActive ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      {!sidebarCollapsed && (
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{step.name}</div>
                          <div className={cn(
                            "text-xs truncate",
                            isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {step.description}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </ScrollArea>

          {!sidebarCollapsed && (
            <div className="p-4 border-t">
              <div className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="secondary">Draft</Badge>
                </div>
                {state.targeting.matchedClientCount !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Clients</span>
                    <span className="font-medium">{state.targeting.matchedClientCount}</span>
                  </div>
                )}
                {state.recipients.recipientCount !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Recipients</span>
                    <span className="font-medium">{state.recipients.recipientCount}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!sidebarCollapsed && (
            <div className="p-4 border-t bg-muted/30">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <strong className="font-medium text-foreground">Quick tip:</strong>
                  <p className="mt-1">{getStepTip(state.currentStep)}</p>
                </div>
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto p-6">
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

              <div className="flex items-center gap-2">
                {WIZARD_STEPS.map((step) => (
                  <div
                    key={step.id}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      state.currentStep === step.id && "bg-primary",
                      state.currentStep !== step.id && isStepComplete(step.id) && "bg-green-500",
                      state.currentStep !== step.id && !isStepComplete(step.id) && "bg-muted-foreground/30"
                    )}
                  />
                ))}
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

function getStepTip(step: number): string {
  switch (step) {
    case 1:
      return 'Choose a clear, descriptive name that helps you identify this campaign later.';
    case 2:
      return 'Use filters to narrow down your audience. Clients matching ALL filters within a group are included.';
    case 3:
      return 'Select which contacts to reach and via which channels. Email is most reliable for first contact.';
    case 4:
      return 'Use merge fields like {{person.firstName}} to personalize your messages.';
    case 5:
      return 'Pages give recipients a place to take action, like confirming details or uploading documents.';
    case 6:
      return 'Always send a test message to yourself before launching to catch any issues.';
    case 7:
      return 'Review everything carefully. Once launched, messages will begin sending immediately.';
    default:
      return '';
  }
}
