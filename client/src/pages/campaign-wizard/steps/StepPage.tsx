import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  FileText, 
  Plus, 
  ExternalLink, 
  SkipForward,
  FileCheck,
  Calendar,
  CheckCircle,
  MessageCircle,
  Edit3
} from 'lucide-react';
import type { WizardState } from '../CampaignWizard';

interface StepPageProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState> | ((prev: WizardState) => Partial<WizardState>)) => void;
  campaignId: string | null;
}

const PAGE_TEMPLATES = [
  {
    id: 'document_collection',
    name: 'Document Collection',
    icon: FileCheck,
    description: 'Request clients to upload documents',
    color: 'bg-blue-50 border-blue-200 hover:border-blue-400',
  },
  {
    id: 'book_call',
    name: 'Book a Call',
    icon: Calendar,
    description: 'Let clients schedule a meeting',
    color: 'bg-green-50 border-green-200 hover:border-green-400',
  },
  {
    id: 'confirm_details',
    name: 'Confirm Details',
    icon: CheckCircle,
    description: 'Request confirmation of information',
    color: 'bg-purple-50 border-purple-200 hover:border-purple-400',
  },
  {
    id: 'interested',
    name: 'Interested / Not Interested',
    icon: MessageCircle,
    description: 'Simple yes/no response page',
    color: 'bg-amber-50 border-amber-200 hover:border-amber-400',
  },
  {
    id: 'blank',
    name: 'Blank Canvas',
    icon: Edit3,
    description: 'Start from scratch',
    color: 'bg-gray-50 border-gray-200 hover:border-gray-400',
  },
];

export function StepPage({ state, updateState, campaignId }: StepPageProps) {
  const [, setLocation] = useLocation();

  const { data: existingPages } = useQuery<any[]>({
    queryKey: ['/api/pages'],
  });

  const handleModeChange = (mode: 'skip' | 'create' | 'existing') => {
    updateState(prev => ({
      page: { ...prev.page, mode, pageId: mode === 'skip' ? null : prev.page.pageId },
    }));
  };

  const handlePageSelect = (pageId: string) => {
    updateState(prev => ({
      page: { ...prev.page, pageId: pageId === 'none' ? null : pageId },
    }));
  };

  const handleCreatePage = (templateId?: string) => {
    const params = new URLSearchParams();
    if (templateId) params.set('template', templateId);
    if (campaignId) params.set('campaignId', campaignId);
    setLocation(`/page-builder/new?${params.toString()}`);
  };

  return (
    <div className="space-y-6" data-testid="step-page">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-step-title">
          Campaign Page (Optional)
        </h2>
        <p className="text-muted-foreground mt-1">
          A campaign page gives recipients a personalized place to take action, like confirming details, 
          uploading documents, or booking a call.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <RadioGroup
            value={state.page.mode}
            onValueChange={(value) => handleModeChange(value as 'skip' | 'create' | 'existing')}
            className="space-y-4"
          >
            <div className={cn(
              "flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors",
              state.page.mode === 'skip' ? "border-primary bg-primary/5" : "border-muted"
            )}>
              <RadioGroupItem value="skip" id="page-skip" className="mt-1" data-testid="radio-page-skip" />
              <div className="flex-1">
                <Label htmlFor="page-skip" className="font-medium cursor-pointer flex items-center gap-2">
                  <SkipForward className="h-4 w-4" />
                  Skip - No page for this campaign
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Recipients will just receive the message without a landing page
                </p>
              </div>
            </div>

            <div className={cn(
              "flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors",
              state.page.mode === 'create' ? "border-primary bg-primary/5" : "border-muted"
            )}>
              <RadioGroupItem value="create" id="page-create" className="mt-1" data-testid="radio-page-create" />
              <div className="flex-1">
                <Label htmlFor="page-create" className="font-medium cursor-pointer flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Page
                </Label>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Build a custom page for this campaign
                </p>

                {state.page.mode === 'create' && (
                  <div className="space-y-4">
                    <div className="text-sm font-medium text-muted-foreground">Quick Start Templates:</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {PAGE_TEMPLATES.map((template) => {
                        const Icon = template.icon;
                        return (
                          <button
                            key={template.id}
                            onClick={() => handleCreatePage(template.id)}
                            className={cn(
                              "flex flex-col items-center p-4 rounded-lg border-2 transition-all hover:shadow-sm",
                              template.color
                            )}
                            data-testid={`template-${template.id}`}
                          >
                            <Icon className="h-6 w-6 mb-2" />
                            <span className="font-medium text-sm text-center">{template.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    <Button onClick={() => handleCreatePage()} className="w-full" data-testid="button-open-page-builder">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Page Builder
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className={cn(
              "flex items-start space-x-3 p-4 rounded-lg border-2 transition-colors",
              state.page.mode === 'existing' ? "border-primary bg-primary/5" : "border-muted"
            )}>
              <RadioGroupItem value="existing" id="page-existing" className="mt-1" data-testid="radio-page-existing" />
              <div className="flex-1">
                <Label htmlFor="page-existing" className="font-medium cursor-pointer flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Use Existing Page
                </Label>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Select from your existing pages
                </p>

                {state.page.mode === 'existing' && (
                  <Select
                    value={state.page.pageId || 'none'}
                    onValueChange={handlePageSelect}
                  >
                    <SelectTrigger data-testid="select-existing-page">
                      <SelectValue placeholder="Select a page..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a page...</SelectItem>
                      {existingPages?.map((page: any) => (
                        <SelectItem key={page.id} value={page.id}>
                          <div className="flex items-center gap-2">
                            <span>{page.name || 'Untitled Page'}</span>
                            {page.status === 'published' && (
                              <Badge variant="secondary" className="text-xs">Published</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {state.page.pageId && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <FileText className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <div className="font-medium text-green-800">Page Attached</div>
                  <div className="text-sm text-green-600">
                    Recipients will see this page when they click the link in your message
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/page-builder/${state.page.pageId}`)}
                className="border-green-300 text-green-700 hover:bg-green-100"
                data-testid="button-edit-page"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Page
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium">How Campaign Pages Work</div>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1.5">
                <li>• Each recipient gets a unique link to the page in their message</li>
                <li>• The page is personalized with their name, company, and other details</li>
                <li>• Actions they take (like clicking "I'm Interested") are tracked</li>
                <li>• You can see who viewed the page and what they did in analytics</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
