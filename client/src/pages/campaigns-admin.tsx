import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
  Layers
} from 'lucide-react';

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

export default function CampaignsAdmin() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<Campaign[]>({
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

  const totalCampaigns = campaigns?.length || 0;
  const totalPages = pages?.length || 0;
  const publishedPages = pages?.filter(p => p.isPublished).length || 0;

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Campaign Status Breakdown
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
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
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
                  <Settings className="h-5 w-5" />
                  Implementation Status
                </CardTitle>
                <CardDescription>
                  Campaigns & Pages module completion
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 4: Multi-Step Campaigns</span>
                    <Badge className="bg-green-100 text-green-800">Complete</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 5: Analytics & Polish</span>
                    <Badge className="bg-green-100 text-green-800">Complete</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 6: Campaign List UI</span>
                    <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 7: Campaign Detail UI</span>
                    <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 8: Campaign Creation UI</span>
                    <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phase 9: Browser Testing</span>
                    <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Available Features</CardTitle>
              <CardDescription>Backend services and APIs ready for use</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <h4 className="font-medium">Client Targeting</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    16+ filter types for precise client selection
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-5 w-5 text-green-500" />
                    <h4 className="font-medium">Email Delivery</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    SendGrid integration with retry logic
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-5 w-5 text-purple-500" />
                    <h4 className="font-medium">SMS Delivery</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    VoodooSMS integration with tracking
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="h-5 w-5 text-orange-500" />
                    <h4 className="font-medium">Voice Calls</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Dialora.ai AI-powered voice outreach
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-teal-500" />
                    <h4 className="font-medium">Page Builder</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    14 component types with drag-and-drop
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-5 w-5 text-red-500" />
                    <h4 className="font-medium">Analytics</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Engagement scoring and metrics
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Campaigns</h2>
            <Button disabled data-testid="button-create-campaign">
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign (Coming Soon)
            </Button>
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
          ) : campaigns && campaigns.length > 0 ? (
            <div className="space-y-4">
              {campaigns.map(campaign => {
                const Icon = statusIcons[campaign.status] || FileText;
                return (
                  <Card key={campaign.id} data-testid={`campaign-card-${campaign.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{campaign.name}</h3>
                            <Badge className={statusColors[campaign.status]}>
                              <Icon className="h-3 w-3 mr-1" />
                              {campaign.status}
                            </Badge>
                            <Badge variant="outline">{campaign.category}</Badge>
                          </div>
                          {campaign.description && (
                            <p className="text-muted-foreground text-sm mb-2">
                              {campaign.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Created: {new Date(campaign.createdAt).toLocaleDateString()}</span>
                            {campaign.scheduledFor && (
                              <span>Scheduled: {new Date(campaign.scheduledFor).toLocaleString()}</span>
                            )}
                            {campaign.sentAt && (
                              <span>Sent: {new Date(campaign.sentAt).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" disabled>
                          View Details
                        </Button>
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
                <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first campaign to start reaching clients
                </p>
                <Button disabled>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign (Coming Soon)
                </Button>
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
                          <span className="font-medium truncate flex-1 mr-4">{campaign.name}</span>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-600">{campaign.openRate}% open</span>
                            <span className="text-blue-600">{campaign.clickRate}% click</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
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
                <h3 className="text-lg font-medium mb-2">Analytics Coming Soon</h3>
                <p className="text-muted-foreground">
                  Send campaigns to start seeing engagement metrics
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
