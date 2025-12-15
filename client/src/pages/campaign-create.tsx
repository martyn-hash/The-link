import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const CAMPAIGN_CATEGORIES = [
  { value: 'chase', label: 'Chase', description: 'Follow up on missing information or overdue items' },
  { value: 'informational', label: 'Informational', description: 'Share updates, news, or changes' },
  { value: 'upsell', label: 'Upsell', description: 'Promote additional services to clients' },
  { value: 'engagement', label: 'Engagement', description: 'Re-engage inactive clients' },
];

export default function CampaignCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/campaigns', {
        name,
        description: description || null,
        category,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({ title: 'Campaign created', description: 'You can now set up targeting and messages' });
      setLocation(`/super-admin/campaigns/${data.id}`);
    },
    onError: (error: any) => {
      toast({ title: 'Error creating campaign', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a campaign name', variant: 'destructive' });
      return;
    }
    if (!category) {
      toast({ title: 'Category required', description: 'Please select a campaign category', variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/super-admin/campaigns')} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Create Campaign</h1>
            <p className="text-muted-foreground">Set up a new outbound campaign</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>
              Start by giving your campaign a name and choosing its type. You can set up targeting and messages after creating.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Year-End Tax Document Collection"
                  data-testid="input-campaign-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Campaign Type *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" data-testid="select-campaign-category">
                    <SelectValue placeholder="Select campaign type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} data-testid={`option-category-${cat.value}`}>
                        <div>
                          <span className="font-medium">{cat.label}</span>
                          <span className="text-muted-foreground text-sm ml-2">- {cat.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this campaign's purpose..."
                  rows={3}
                  data-testid="input-campaign-description"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation('/super-admin/campaigns')}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !name.trim() || !category}
                  data-testid="button-create-campaign"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
