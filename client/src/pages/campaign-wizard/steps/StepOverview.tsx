import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Bell, Megaphone, TrendingUp, RefreshCw, Check, FileText } from 'lucide-react';
import type { WizardState, CampaignCategory } from '../CampaignWizard';

interface StepOverviewProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState> | ((prev: WizardState) => Partial<WizardState>)) => void;
  campaignId: string | null;
}

const CAMPAIGN_TYPES: { value: CampaignCategory; label: string; description: string; icon: any; color: string }[] = [
  {
    value: 'chase',
    label: 'Chase',
    description: 'Follow up on missing items or overdue deadlines',
    icon: Bell,
    color: 'border-orange-200 bg-orange-50 hover:border-orange-400 data-[selected=true]:border-orange-500 data-[selected=true]:bg-orange-100',
  },
  {
    value: 'informational',
    label: 'Informational',
    description: 'Share updates, news, or changes with clients',
    icon: Megaphone,
    color: 'border-blue-200 bg-blue-50 hover:border-blue-400 data-[selected=true]:border-blue-500 data-[selected=true]:bg-blue-100',
  },
  {
    value: 'upsell',
    label: 'Upsell',
    description: 'Promote additional services to clients',
    icon: TrendingUp,
    color: 'border-green-200 bg-green-50 hover:border-green-400 data-[selected=true]:border-green-500 data-[selected=true]:bg-green-100',
  },
  {
    value: 'engagement',
    label: 'Engagement',
    description: 'Re-engage inactive clients',
    icon: RefreshCw,
    color: 'border-purple-200 bg-purple-50 hover:border-purple-400 data-[selected=true]:border-purple-500 data-[selected=true]:bg-purple-100',
  },
];

export function StepOverview({ state, updateState, campaignId }: StepOverviewProps) {
  const { data: templates } = useQuery<any[]>({
    queryKey: ['/api/campaign-templates'],
  });

  const handleNameChange = (name: string) => {
    updateState(prev => ({
      overview: { ...prev.overview, name },
    }));
  };

  const handleCategoryChange = (category: CampaignCategory) => {
    updateState(prev => ({
      overview: { ...prev.overview, category },
    }));
  };

  const handleDescriptionChange = (description: string) => {
    updateState(prev => ({
      overview: { ...prev.overview, description },
    }));
  };

  const handleTemplateChange = (templateId: string) => {
    updateState(prev => ({
      overview: { ...prev.overview, templateId: templateId === 'none' ? null : templateId },
    }));
  };

  return (
    <div className="space-y-8" data-testid="step-overview">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-step-title">Campaign Overview</h2>
        <p className="text-muted-foreground mt-1">
          Set the foundation for your campaign - name, type, and purpose.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campaign Name</CardTitle>
          <CardDescription>
            A clear, descriptive name helps you find this campaign later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="campaign-name" className="sr-only">Campaign Name</Label>
            <Input
              id="campaign-name"
              value={state.overview.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Year-End Tax Document Collection"
              className="text-lg"
              autoFocus
              data-testid="input-campaign-name"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campaign Type</CardTitle>
          <CardDescription>
            Choose the type that best describes your campaign's purpose.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="radiogroup" aria-label="Campaign type">
            {CAMPAIGN_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = state.overview.category === type.value;

              return (
                <button
                  key={type.value}
                  onClick={() => handleCategoryChange(type.value)}
                  data-selected={isSelected}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all",
                    type.color
                  )}
                  role="radio"
                  aria-checked={isSelected}
                  data-testid={`card-type-${type.value}`}
                >
                  <div className={cn(
                    "p-2 rounded-lg",
                    isSelected ? "bg-white/80" : "bg-white"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{type.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-green-600" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Description</CardTitle>
          <CardDescription>
            Internal notes for your team. Not visible to clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="campaign-description" className="sr-only">Description</Label>
            <Textarea
              id="campaign-description"
              value={state.overview.description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Brief description of this campaign's purpose..."
              rows={4}
              data-testid="input-campaign-description"
            />
            <p className="text-sm text-muted-foreground text-right">
              {state.overview.description.length} / 500 characters
            </p>
          </div>
        </CardContent>
      </Card>

      {templates && templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Use Template
            </CardTitle>
            <CardDescription>
              Start from a proven template, or create from scratch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={state.overview.templateId || 'none'}
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger data-testid="select-template">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Create from scratch</SelectItem>
                {templates.map((template: any) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
