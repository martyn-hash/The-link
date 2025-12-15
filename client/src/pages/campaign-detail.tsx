import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowLeft,
  Mail, 
  MessageSquare, 
  Phone, 
  Users, 
  FileText, 
  BarChart3,
  Eye,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Pause,
  MousePointer,
  Download,
  Calendar,
  User,
  Target,
  Layers,
  TrendingUp,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface CampaignDetail {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: string | null;
  createdAt: string;
  scheduledFor: string | null;
  sentAt: string | null;
  createdByUserId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  pageId: string | null;
  isSequence: boolean;
  parentCampaignId: string | null;
  sequenceOrder: number | null;
  targetCriteria: any[];
  messages: any[];
  recipientCount: number;
}

interface CampaignAnalytics {
  campaign: {
    id: string;
    name: string;
    category: string | null;
    status: string | null;
    sentAt: string | null;
  };
  metrics: {
    totalRecipients: number;
    sent: number;
    delivered: number;
    bounced: number;
    failed: number;
    opened: number;
    clicked: number;
    actioned: number;
  };
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    actionRate: number;
    bounceRate: number;
  };
  breakdowns: {
    byManager: Array<{
      managerId: string;
      managerName: string;
      sent: number;
      opened: number;
      clicked: number;
      openRate: number;
      clickRate: number;
    }>;
  };
  timeline: Array<{
    date: string;
    sent: number;
    opened: number;
    clicked: number;
  }>;
}

interface Recipient {
  id: string;
  campaignId: string;
  clientId: string;
  personId: string | null;
  channel: string;
  destination: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  clientName?: string;
  personName?: string;
}

interface SequenceStep {
  id: string;
  name: string;
  sequenceOrder: number;
  status: string;
  recipientCount: number;
  sentCount: number;
  openedCount: number;
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

const recipientStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  queued: 'bg-blue-100 text-blue-800',
  sent: 'bg-yellow-100 text-yellow-800',
  delivered: 'bg-green-100 text-green-800',
  opened: 'bg-emerald-100 text-emerald-800',
  clicked: 'bg-teal-100 text-teal-800',
  bounced: 'bg-orange-100 text-orange-800',
  failed: 'bg-red-100 text-red-800',
};

const channelIcons: Record<string, any> = {
  email: Mail,
  sms: MessageSquare,
  voice: Phone,
};

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const [activeTab, setActiveTab] = useState('overview');

  const { data: campaign, isLoading: campaignLoading } = useQuery<CampaignDetail>({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<CampaignAnalytics>({
    queryKey: ['/api/campaigns', campaignId, 'analytics'],
    enabled: !!campaignId && (campaign?.status === 'sent' || campaign?.status === 'sending'),
  });

  const { data: recipients, isLoading: recipientsLoading } = useQuery<Recipient[]>({
    queryKey: ['/api/campaigns', campaignId, 'recipients'],
    enabled: !!campaignId,
  });

  const { data: sequenceSteps } = useQuery<SequenceStep[]>({
    queryKey: ['/api/campaigns', campaignId, 'sequence', 'steps'],
    enabled: !!campaignId && campaign?.isSequence,
  });

  const exportToCSV = () => {
    if (!analytics || !recipients) return;

    const headers = ['Client', 'Contact', 'Channel', 'Destination', 'Status', 'Sent At', 'Opened At', 'Clicked At'];
    const rows = recipients.map(r => [
      r.clientName || r.clientId,
      r.personName || r.personId || 'N/A',
      r.channel,
      r.destination,
      r.status,
      r.sentAt ? format(new Date(r.sentAt), 'yyyy-MM-dd HH:mm') : '',
      r.openedAt ? format(new Date(r.openedAt), 'yyyy-MM-dd HH:mm') : '',
      r.clickedAt ? format(new Date(r.clickedAt), 'yyyy-MM-dd HH:mm') : '',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-${campaignId}-recipients.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (campaignLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-96 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Campaign not found</h3>
            <p className="text-muted-foreground mb-4">
              The campaign you're looking for doesn't exist or has been deleted.
            </p>
            <Button asChild>
              <Link href="/super-admin/campaigns">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Campaigns
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = statusIcons[campaign.status || 'draft'] || FileText;
  const ChannelIcon = channelIcons[campaign.messages?.[0]?.channel || 'email'] || Mail;

  const pieData = analytics ? [
    { name: 'Delivered', value: analytics.metrics.delivered, color: '#22c55e' },
    { name: 'Bounced', value: analytics.metrics.bounced, color: '#f97316' },
    { name: 'Failed', value: analytics.metrics.failed, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/super-admin/campaigns">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Link>
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold" data-testid="text-campaign-name">
                {campaign.name}
              </h1>
              <Badge className={statusColors[campaign.status || 'draft']}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {campaign.status}
              </Badge>
              {campaign.category && (
                <Badge variant="outline">{campaign.category}</Badge>
              )}
            </div>
            {campaign.description && (
              <p className="text-muted-foreground">{campaign.description}</p>
            )}
          </div>
          
          {analytics && (
            <Button onClick={exportToCSV} variant="outline" data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recipients</CardDescription>
            <CardTitle className="text-2xl" data-testid="text-recipient-count">
              {campaign.recipientCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Total targeted</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Rate</CardDescription>
            <CardTitle className="text-2xl" data-testid="text-open-rate">
              {analytics?.rates.openRate ?? 0}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>{analytics?.metrics.opened ?? 0} opened</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Click Rate</CardDescription>
            <CardTitle className="text-2xl" data-testid="text-click-rate">
              {analytics?.rates.clickRate ?? 0}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MousePointer className="h-4 w-4" />
              <span>{analytics?.metrics.clicked ?? 0} clicked</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Delivery Rate</CardDescription>
            <CardTitle className="text-2xl" data-testid="text-delivery-rate">
              {analytics?.rates.deliveryRate ?? 0}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Send className="h-4 w-4" />
              <span>{analytics?.metrics.delivered ?? 0} delivered</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-detail-overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-detail-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="recipients" data-testid="tab-detail-recipients">Recipients</TabsTrigger>
          {campaign.isSequence && (
            <TabsTrigger value="sequence" data-testid="tab-detail-sequence">Sequence</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Campaign Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Channel</p>
                    <div className="flex items-center gap-2 mt-1">
                      <ChannelIcon className="h-4 w-4" />
                      <span className="font-medium capitalize">
                        {campaign.messages?.[0]?.channel || 'Email'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium capitalize mt-1">{campaign.category || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium mt-1">
                      {format(new Date(campaign.createdAt), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                  {campaign.scheduledFor && (
                    <div>
                      <p className="text-sm text-muted-foreground">Scheduled For</p>
                      <p className="font-medium mt-1">
                        {format(new Date(campaign.scheduledFor), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  )}
                  {campaign.sentAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Sent At</p>
                      <p className="font-medium mt-1">
                        {format(new Date(campaign.sentAt), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  )}
                  {campaign.pageId && (
                    <div>
                      <p className="text-sm text-muted-foreground">Linked Page</p>
                      <Button variant="link" size="sm" className="p-0 h-auto mt-1" asChild>
                        <Link href={`/page-builder/${campaign.pageId}`}>
                          View Page
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Targeting Criteria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {campaign.targetCriteria && campaign.targetCriteria.length > 0 ? (
                  <div className="space-y-2">
                    {campaign.targetCriteria.map((criteria, index) => (
                      <div 
                        key={index}
                        className="p-3 bg-muted rounded-lg text-sm"
                      >
                        <span className="font-medium">{criteria.filterType}</span>
                        {criteria.operator && (
                          <span className="text-muted-foreground"> {criteria.operator} </span>
                        )}
                        {criteria.value && (
                          <span>{JSON.stringify(criteria.value)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No targeting criteria set</p>
                )}
              </CardContent>
            </Card>
          </div>

          {campaign.messages && campaign.messages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Message Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                {campaign.messages.map((message, index) => (
                  <div key={index} className="space-y-3">
                    {message.subject && (
                      <div>
                        <p className="text-sm text-muted-foreground">Subject</p>
                        <p className="font-medium">{message.subject}</p>
                      </div>
                    )}
                    {message.body && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Body</p>
                        <div 
                          className="p-4 bg-muted rounded-lg text-sm prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: message.body }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analyticsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
          ) : analytics ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Engagement Timeline
                    </CardTitle>
                    <CardDescription>Opens and clicks over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics.timeline && analytics.timeline.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={analytics.timeline}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(value) => format(new Date(value), 'MMM d')}
                          />
                          <YAxis />
                          <Tooltip 
                            labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="opened" 
                            stroke="#22c55e" 
                            name="Opened"
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="clicked" 
                            stroke="#3b82f6" 
                            name="Clicked"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No timeline data available
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Delivery Breakdown
                    </CardTitle>
                    <CardDescription>Message delivery status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No delivery data available
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Manager Breakdown
                  </CardTitle>
                  <CardDescription>Performance by account manager</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.breakdowns.byManager && analytics.breakdowns.byManager.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Manager</TableHead>
                            <TableHead className="text-right">Sent</TableHead>
                            <TableHead className="text-right">Opened</TableHead>
                            <TableHead className="text-right">Open Rate</TableHead>
                            <TableHead className="text-right">Clicked</TableHead>
                            <TableHead className="text-right">Click Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics.breakdowns.byManager.map((manager) => (
                            <TableRow key={manager.managerId}>
                              <TableCell className="font-medium">{manager.managerName}</TableCell>
                              <TableCell className="text-right">{manager.sent}</TableCell>
                              <TableCell className="text-right">{manager.opened}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline">{manager.openRate}%</Badge>
                              </TableCell>
                              <TableCell className="text-right">{manager.clicked}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline">{manager.clickRate}%</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No manager breakdown available
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">{analytics.metrics.delivered}</p>
                      <p className="text-sm text-muted-foreground">Delivered</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-orange-600">{analytics.metrics.bounced}</p>
                      <p className="text-sm text-muted-foreground">Bounced</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-600">{analytics.metrics.failed}</p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-600">{analytics.metrics.actioned}</p>
                      <p className="text-sm text-muted-foreground">Actions Taken</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No analytics available</h3>
                <p className="text-muted-foreground">
                  Analytics will be available once the campaign has been sent.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recipients" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Recipients
                  </CardTitle>
                  <CardDescription>
                    {recipients?.length || 0} recipients in this campaign
                  </CardDescription>
                </div>
                {recipients && recipients.length > 0 && (
                  <Button onClick={exportToCSV} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recipientsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recipients && recipients.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Opened</TableHead>
                        <TableHead>Clicked</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipients.slice(0, 50).map((recipient) => {
                        const RecipientChannelIcon = channelIcons[recipient.channel] || Mail;
                        return (
                          <TableRow key={recipient.id} data-testid={`recipient-row-${recipient.id}`}>
                            <TableCell className="font-medium">
                              {recipient.clientName || recipient.clientId}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <RecipientChannelIcon className="h-3 w-3" />
                                <span className="capitalize">{recipient.channel}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {recipient.destination}
                            </TableCell>
                            <TableCell>
                              <Badge className={recipientStatusColors[recipient.status] || 'bg-gray-100'}>
                                {recipient.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {recipient.sentAt ? (
                                <span className="text-sm">
                                  {format(new Date(recipient.sentAt), 'MMM d, HH:mm')}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {recipient.openedAt ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell>
                              {recipient.clickedAt ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {recipients.length > 50 && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      Showing first 50 of {recipients.length} recipients. Export to CSV to see all.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No recipients found for this campaign
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {campaign.isSequence && (
          <TabsContent value="sequence" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Sequence Steps
                </CardTitle>
                <CardDescription>
                  Multi-step campaign progression
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sequenceSteps && sequenceSteps.length > 0 ? (
                  <div className="space-y-4">
                    {sequenceSteps.map((step, index) => (
                      <div 
                        key={step.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{step.name}</span>
                            <Badge className={statusColors[step.status] || 'bg-gray-100'}>
                              {step.status}
                            </Badge>
                          </div>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>{step.recipientCount} recipients</span>
                            <span>{step.sentCount} sent</span>
                            <span>{step.openedCount} opened</span>
                          </div>
                          {step.sentCount > 0 && (
                            <Progress 
                              value={(step.openedCount / step.sentCount) * 100} 
                              className="h-2 mt-2"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No sequence steps found
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
