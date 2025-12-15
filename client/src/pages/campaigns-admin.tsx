import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Users, 
  FileText, 
  BarChart3, 
  Settings,
  Plus,
  Eye,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Pause,
  ArrowRight,
  Layers,
  Search,
  MoreVertical,
  Trash2,
  Play,
  TrendingUp,
  Activity,
  Calendar
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  createdAt: string;
  scheduledFor: string | null;
  sentAt: string | null;
  recipientCount?: number;
  channel?: string;
}

interface CampaignWithMetrics extends Campaign {
  metrics?: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    openRate: number;
    clickRate: number;
  };
}

interface Page {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
  createdAt: string;
}

interface CampaignStats {
  draft: number;
  review: number;
  approved: number;
  scheduled: number;
  sending: number;
  sent: number;
  paused: number;
  cancelled: number;
}

interface AnalyticsOverview {
  totalCampaigns: number;
  sentThisMonth: number;
  averageOpenRate: number;
  averageClickRate: number;
  topPerformingCampaigns: Array<{
    id: string;
    name: string;
    openRate: number;
    clickRate: number;
  }>;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  scheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  sending: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  sent: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const statusIcons: Record<string, any> = {
  draft: FileText,
  review: Eye,
  approved: CheckCircle,
  scheduled: Clock,
  sending: Send,
  sent: CheckCircle,
  paused: Pause,
  cancelled: AlertCircle,
};

const channelIcons: Record<string, any> = {
  email: Mail,
  sms: MessageSquare,
  voice: Phone,
};

const statusTabs = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sending', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
  { value: 'paused', label: 'Paused' },
];

export default function CampaignsAdmin() {
  const [activeTab, setActiveTab] = useState('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<CampaignWithMetrics[]>({
    queryKey: ['/api/campaigns'],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<CampaignStats>({
    queryKey: ['/api/campaigns/stats/by-status'],
  });

  const { data: pages, isLoading: pagesLoading } = useQuery<Page[]>({
    queryKey: ['/api/pages'],
  });

  const { data: analyticsOverview } = useQuery<AnalyticsOverview>({
    queryKey: ['/api/campaigns/analytics/overview'],
  });

  const pauseMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest('POST', `/api/campaigns/${campaignId}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns/stats/by-status'] });
      toast({ title: 'Campaign paused' });
    },
    onError: () => {
      toast({ title: 'Failed to pause campaign', variant: 'destructive' });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest('POST', `/api/campaigns/${campaignId}/resume`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns/stats/by-status'] });
      toast({ title: 'Campaign resumed' });
    },
    onError: () => {
      toast({ title: 'Failed to resume campaign', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest('DELETE', `/api/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns/stats/by-status'] });
      toast({ title: 'Campaign deleted' });
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    },
    onError: () => {
      toast({ title: 'Failed to delete campaign', variant: 'destructive' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (campaignIds: string[]) => {
      await Promise.all(campaignIds.map(id => 
        apiRequest('DELETE', `/api/campaigns/${id}`)
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns/stats/by-status'] });
      toast({ title: `${selectedCampaigns.size} campaign(s) deleted` });
      setSelectedCampaigns(new Set());
    },
    onError: () => {
      toast({ title: 'Failed to delete campaigns', variant: 'destructive' });
    },
  });

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];
    
    return campaigns.filter(campaign => {
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
      const matchesSearch = !searchQuery || 
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [campaigns, statusFilter, searchQuery]);

  const toggleCampaignSelection = (campaignId: string) => {
    const newSelection = new Set(selectedCampaigns);
    if (newSelection.has(campaignId)) {
      newSelection.delete(campaignId);
    } else {
      newSelection.add(campaignId);
    }
    setSelectedCampaigns(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedCampaigns.size === filteredCampaigns.length) {
      setSelectedCampaigns(new Set());
    } else {
      setSelectedCampaigns(new Set(filteredCampaigns.map(c => c.id)));
    }
  };

  const handleDeleteCampaign = (campaignId: string) => {
    setCampaignToDelete(campaignId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (campaignToDelete) {
      deleteMutation.mutate(campaignToDelete);
    }
  };

  const totalCampaigns = campaigns?.length || 0;
  const totalPages = pages?.length || 0;
  const publishedPages = pages?.filter(p => p.isPublished).length || 0;

  const recentCampaigns = useMemo(() => {
    if (!campaigns) return [];
    return [...campaigns]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [campaigns]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-campaigns-title">
          Campaigns & Pages
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage outbound campaigns, campaign pages, and view analytics
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="pages" data-testid="tab-pages">Pages</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Campaigns</CardDescription>
                <CardTitle className="text-3xl" data-testid="text-total-campaigns">
                  {campaignsLoading ? <Skeleton className="h-9 w-16" /> : totalCampaigns}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>Multi-channel outreach</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Campaign Pages</CardDescription>
                <CardTitle className="text-3xl" data-testid="text-total-pages">
                  {pagesLoading ? <Skeleton className="h-9 w-16" /> : totalPages}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{publishedPages} published</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg Open Rate</CardDescription>
                <CardTitle className="text-3xl" data-testid="text-avg-open-rate">
                  {analyticsOverview?.averageOpenRate !== undefined 
                    ? `${analyticsOverview.averageOpenRate}%` 
                    : <Skeleton className="h-9 w-16" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  <span>Email engagement</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg Click Rate</CardDescription>
                <CardTitle className="text-3xl" data-testid="text-avg-click-rate">
                  {analyticsOverview?.averageClickRate !== undefined 
                    ? `${analyticsOverview.averageClickRate}%` 
                    : <Skeleton className="h-9 w-16" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ArrowRight className="h-4 w-4" />
                  <span>Link engagement</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Campaign Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(stats || {}).map(([status, count]) => {
                      const Icon = statusIcons[status] || FileText;
                      return (
                        <div 
                          key={status} 
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setActiveTab('campaigns');
                            setStatusFilter(status);
                          }}
                          data-testid={`status-row-${status}`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="capitalize">{status}</span>
                          </div>
                          <Badge className={statusColors[status]}>{count}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Performers
                </CardTitle>
                <CardDescription>Highest engagement campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsOverview?.topPerformingCampaigns?.length ? (
                  <div className="space-y-3">
                    {analyticsOverview.topPerformingCampaigns.slice(0, 5).map((campaign, index) => (
                      <div 
                        key={campaign.id} 
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-muted-foreground w-5">
                            {index + 1}.
                          </span>
                          <span className="text-sm truncate max-w-[120px]">{campaign.name}</span>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <Badge variant="outline" className="font-normal">
                            {campaign.openRate}% opens
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No campaigns sent yet
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                {recentCampaigns.length > 0 ? (
                  <div className="space-y-3">
                    {recentCampaigns.map(campaign => {
                      const Icon = statusIcons[campaign.status] || FileText;
                      return (
                        <div 
                          key={campaign.id} 
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium truncate max-w-[140px]">
                                {campaign.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(campaign.createdAt), 'MMM d')}
                              </p>
                            </div>
                          </div>
                          <Badge className={statusColors[campaign.status]} variant="secondary">
                            {campaign.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent activity
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Implementation Status
              </CardTitle>
              <CardDescription>
                Campaigns & Pages module completion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 1: Foundation</span>
                    <Badge className="bg-green-100 text-green-800">Complete</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 2: Campaign Engine</span>
                    <Badge className="bg-green-100 text-green-800">Complete</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 3: Pages Module</span>
                    <Badge className="bg-green-100 text-green-800">Complete</Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 4: Multi-Step</span>
                    <Badge className="bg-green-100 text-green-800">Complete</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 5: Analytics</span>
                    <Badge className="bg-green-100 text-green-800">Complete</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 6: Campaign List UI</span>
                    <Badge className="bg-green-100 text-green-800">Complete</Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 7: Campaign Detail UI</span>
                    <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 8: Creation Wizard</span>
                    <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 9: Browser Testing</span>
                    <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">All Campaigns</h2>
              {selectedCampaigns.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedCampaigns.size} selected
                  </span>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    disabled={bulkDeleteMutation.isPending}
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Selected
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-campaigns"
                />
              </div>
              <Button asChild data-testid="button-create-campaign">
                <Link href="/super-admin/campaigns/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Link>
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="flex gap-2 pb-2">
              {statusTabs.map(tab => (
                <Button
                  key={tab.value}
                  variant={statusFilter === tab.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(tab.value)}
                  data-testid={`filter-${tab.value}`}
                >
                  {tab.label}
                  {tab.value !== 'all' && stats && (
                    <Badge variant="secondary" className="ml-2">
                      {stats[tab.value as keyof CampaignStats] || 0}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {campaignsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-96" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredCampaigns.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={selectedCampaigns.size === filteredCampaigns.length && filteredCampaigns.length > 0}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <span>Select all ({filteredCampaigns.length})</span>
              </div>
              {filteredCampaigns.map(campaign => {
                const StatusIcon = statusIcons[campaign.status] || FileText;
                const ChannelIcon = channelIcons[campaign.channel || 'email'] || Mail;
                return (
                  <Card 
                    key={campaign.id} 
                    className={`transition-colors ${selectedCampaigns.has(campaign.id) ? 'border-primary' : ''}`}
                    data-testid={`campaign-card-${campaign.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="pt-1">
                          <Checkbox
                            checked={selectedCampaigns.has(campaign.id)}
                            onCheckedChange={() => toggleCampaignSelection(campaign.id)}
                            data-testid={`checkbox-campaign-${campaign.id}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="font-semibold text-lg truncate">{campaign.name}</h3>
                            <Badge className={statusColors[campaign.status]}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {campaign.status}
                            </Badge>
                            <Badge variant="outline">
                              <ChannelIcon className="h-3 w-3 mr-1" />
                              {campaign.channel || 'email'}
                            </Badge>
                            <Badge variant="outline">{campaign.category}</Badge>
                          </div>
                          {campaign.description && (
                            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                              {campaign.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Created: {format(new Date(campaign.createdAt), 'MMM d, yyyy')}</span>
                            </div>
                            {campaign.recipientCount !== undefined && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Users className="h-3.5 w-3.5" />
                                <span>{campaign.recipientCount} recipients</span>
                              </div>
                            )}
                            {campaign.scheduledFor && (
                              <div className="flex items-center gap-1 text-purple-600">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Scheduled: {format(new Date(campaign.scheduledFor), 'MMM d, h:mm a')}</span>
                              </div>
                            )}
                            {campaign.sentAt && (
                              <div className="flex items-center gap-1 text-green-600">
                                <Send className="h-3.5 w-3.5" />
                                <span>Sent: {format(new Date(campaign.sentAt), 'MMM d, h:mm a')}</span>
                              </div>
                            )}
                          </div>
                          {campaign.metrics && (
                            <div className="flex gap-4 mt-3 pt-3 border-t">
                              <div className="text-center">
                                <p className="text-lg font-semibold">{campaign.metrics.sent}</p>
                                <p className="text-xs text-muted-foreground">Sent</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-semibold">{campaign.metrics.openRate}%</p>
                                <p className="text-xs text-muted-foreground">Opens</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-semibold">{campaign.metrics.clickRate}%</p>
                                <p className="text-xs text-muted-foreground">Clicks</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" asChild data-testid={`button-view-${campaign.id}`}>
                            <Link href={`/super-admin/campaigns/${campaign.id}`}>View</Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-more-${campaign.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {campaign.status === 'sending' && (
                                <DropdownMenuItem 
                                  onClick={() => pauseMutation.mutate(campaign.id)}
                                  disabled={pauseMutation.isPending}
                                >
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pause
                                </DropdownMenuItem>
                              )}
                              {campaign.status === 'paused' && (
                                <DropdownMenuItem 
                                  onClick={() => resumeMutation.mutate(campaign.id)}
                                  disabled={resumeMutation.isPending}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Resume
                                </DropdownMenuItem>
                              )}
                              {(campaign.status === 'draft' || campaign.status === 'cancelled') && (
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteCampaign(campaign.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {searchQuery || statusFilter !== 'all' ? 'No campaigns found' : 'No campaigns yet'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filter'
                    : 'Create your first campaign to start reaching clients'}
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <Button asChild>
                    <Link href="/super-admin/campaigns/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Campaign
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pages" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Campaign Pages</h2>
            <Button asChild data-testid="button-create-page">
              <Link href="/page-builder/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Page
              </Link>
            </Button>
          </div>

          {pagesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-48" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : pages && pages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pages.map(page => (
                <Card key={page.id} data-testid={`page-card-${page.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">{page.name}</h3>
                      <Badge className={page.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {page.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      /{page.slug}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/page-builder/${page.id}`}>
                          Edit
                        </Link>
                      </Button>
                      {page.isPublished && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                            Preview
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No pages yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create personalised landing pages for your campaigns
                </p>
                <Button asChild>
                  <Link href="/page-builder/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Page
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <h2 className="text-xl font-semibold">Campaign Analytics</h2>

          {analyticsOverview ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Overview Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Campaigns</span>
                    <span className="font-medium">{analyticsOverview.totalCampaigns}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Sent This Month</span>
                    <span className="font-medium">{analyticsOverview.sentThisMonth}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Average Open Rate</span>
                    <span className="font-medium">{analyticsOverview.averageOpenRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Average Click Rate</span>
                    <span className="font-medium">{analyticsOverview.averageClickRate}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Campaigns</CardTitle>
                </CardHeader>
                <CardContent>
                  {analyticsOverview.topPerformingCampaigns?.length > 0 ? (
                    <div className="space-y-3">
                      {analyticsOverview.topPerformingCampaigns.map((campaign: any) => (
                        <div 
                          key={campaign.id} 
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                        >
                          <span className="font-medium truncate max-w-[200px]">{campaign.name}</span>
                          <div className="flex gap-3 text-sm">
                            <span className="text-green-600">{campaign.openRate}% opens</span>
                            <span className="text-blue-600">{campaign.clickRate}% clicks</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-6">
                      No campaign data available yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No analytics data yet</h3>
                <p className="text-muted-foreground">
                  Send your first campaign to see analytics
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the campaign and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCampaigns.size} Campaign{selectedCampaigns.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected campaigns and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                bulkDeleteMutation.mutate(Array.from(selectedCampaigns));
                setBulkDeleteDialogOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedCampaigns.size} Campaign{selectedCampaigns.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
