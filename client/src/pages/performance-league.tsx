import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import TopNavigation from "@/components/top-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle, User, Calendar as CalendarIcon, Target, Clock, ChevronRight, Download, RefreshCw, Info } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import type { Service, User as UserType } from "@shared/schema";

interface LeagueEntry {
  rank: number;
  assigneeId: string;
  assigneeName: string;
  serviceName: string;
  projectCount: number;
  projectDays: number;
  lateEvents: number;
  totalLateDays: number;
  lir: number;
  ldr: number;
  performanceScore: number;
  trend: "improving" | "stable" | "declining" | "new";
  smallSample: boolean;
}

interface StageBreakdown {
  stageName: string;
  lateEvents: number;
  lateDays: number;
  percentOfLateness: number;
  teamAverage: number;
}

interface ProjectDetail {
  projectId: string;
  projectDescription: string;
  clientName: string;
  stageName: string;
  daysLate: number;
}

interface AssigneeDetail {
  summary: LeagueEntry;
  stageBreakdown: StageBreakdown[];
  projectDetails: ProjectDetail[];
  coachingInsights: string[];
}

interface LeagueResponse {
  entries: LeagueEntry[];
  dateRange: { start: string; end: string };
  serviceName: string;
  generatedAt: string;
}

export default function PerformanceLeaguePage() {
  const { user } = useAuth();
  const [serviceId, setServiceId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [minProjects, setMinProjects] = useState<string>("5");
  const [selectedAssignee, setSelectedAssignee] = useState<LeagueEntry | null>(null);

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "";

  const { data: leagueData, isLoading, refetch, error } = useQuery<LeagueResponse>({
    queryKey: ["/api/analytics/performance-league", { serviceId, startDate, endDate, minProjects }],
    enabled: !!serviceId,
  });

  const { data: assigneeDetail, isLoading: detailLoading } = useQuery<AssigneeDetail>({
    queryKey: ["/api/analytics/performance-league", selectedAssignee?.assigneeId, { serviceId, startDate, endDate }],
    enabled: !!selectedAssignee?.assigneeId && !!serviceId,
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case "stable":
        return <Minus className="w-4 h-4 text-gray-500" />;
      default:
        return <Badge variant="outline" className="text-xs">New</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-900/30";
    if (score >= 60) return "bg-yellow-100 dark:bg-yellow-900/30";
    if (score >= 40) return "bg-orange-100 dark:bg-orange-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Trophy className="w-5 h-5 text-amber-700" />;
    return <span className="text-muted-foreground font-medium">#{rank}</span>;
  };

  return (
    <>
      <TopNavigation user={user} />
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Trophy className="w-8 h-8 text-yellow-500" />
              Performance League
            </h1>
            <p className="text-muted-foreground mt-1">
              Staff effectiveness at keeping projects on schedule
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={!serviceId} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Select service and date range to view performance data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-filter">Service</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger id="service-filter" data-testid="select-service-filter">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                      data-testid="button-date-range"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "d MMM yyyy")} - {format(dateRange.to, "d MMM yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "d MMM yyyy")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                    <div className="p-3 border-t flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange({
                          from: startOfMonth(new Date()),
                          to: endOfMonth(new Date()),
                        })}
                      >
                        This Month
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const lastMonth = subMonths(new Date(), 1);
                          setDateRange({
                            from: startOfMonth(lastMonth),
                            to: endOfMonth(lastMonth),
                          });
                        }}
                      >
                        Last Month
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange({
                          from: startOfMonth(subMonths(new Date(), 2)),
                          to: endOfMonth(new Date()),
                        })}
                      >
                        Last 3 Months
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-projects">Minimum Projects</Label>
                <Select value={minProjects} onValueChange={setMinProjects}>
                  <SelectTrigger id="min-projects" data-testid="select-min-projects">
                    <SelectValue placeholder="Minimum projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No minimum</SelectItem>
                    <SelectItem value="3">At least 3</SelectItem>
                    <SelectItem value="5">At least 5</SelectItem>
                    <SelectItem value="10">At least 10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {!serviceId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a Service</h3>
              <p className="text-muted-foreground">
                Choose a service above to view performance rankings
              </p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card>
            <CardContent className="py-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">Error Loading Data</h3>
              <p className="text-muted-foreground">
                Unable to load performance data. Please try again.
              </p>
            </CardContent>
          </Card>
        ) : !leagueData?.entries?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Data Available</h3>
              <p className="text-muted-foreground">
                No project data found for this service and date range
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>League Table</span>
                <Badge variant="outline" className="font-normal">
                  {format(new Date(leagueData.dateRange.start), "d MMM")} - {format(new Date(leagueData.dateRange.end), "d MMM yyyy")}
                </Badge>
              </CardTitle>
              <CardDescription>
                Click on a row to see detailed breakdown and coaching insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead className="text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center">
                            Projects <Info className="w-3 h-3" />
                          </TooltipTrigger>
                          <TooltipContent>Number of projects assigned during period</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center">
                            Late Events <Info className="w-3 h-3" />
                          </TooltipTrigger>
                          <TooltipContent>Times projects became behind schedule</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center">
                            Late Days <Info className="w-3 h-3" />
                          </TooltipTrigger>
                          <TooltipContent>Business days projects spent behind schedule</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center">
                            LIR <Info className="w-3 h-3" />
                          </TooltipTrigger>
                          <TooltipContent>Late Incidence Rate (late events / projects)</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 justify-center">
                            LDR <Info className="w-3 h-3" />
                          </TooltipTrigger>
                          <TooltipContent>Late Duration Rate (late days / projects)</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="text-center">Trend</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leagueData.entries.map((entry) => (
                      <TableRow
                        key={entry.assigneeId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedAssignee(entry)}
                        data-testid={`row-assignee-${entry.assigneeId}`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center justify-center">
                            {getRankBadge(entry.rank)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{entry.assigneeName}</span>
                            {entry.smallSample && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                </TooltipTrigger>
                                <TooltipContent>Small sample size - results may be less reliable</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{entry.projectCount}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={entry.lateEvents === 0 ? "secondary" : "destructive"}>
                            {entry.lateEvents}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{entry.totalLateDays}</TableCell>
                        <TableCell className="text-center">{entry.lir.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{entry.ldr.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <div className={`inline-flex items-center justify-center w-12 h-8 rounded-md font-bold ${getScoreBg(entry.performanceScore)} ${getScoreColor(entry.performanceScore)}`}>
                            {Math.round(entry.performanceScore)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getTrendIcon(entry.trend)}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Understanding Scores
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Scores are relative to peers within this service and date range</li>
                  <li>• Higher scores indicate better workflow control, not lower workload</li>
                  <li>• A score of 100 means best performance in the cohort</li>
                  <li>• Scores are for coaching and improvement, not punitive evaluation</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={!!selectedAssignee} onOpenChange={(open) => !open && setSelectedAssignee(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {selectedAssignee?.assigneeName} - Performance Detail
              </DialogTitle>
              <DialogDescription>
                Detailed breakdown and coaching insights for the selected period
              </DialogDescription>
            </DialogHeader>

            {detailLoading ? (
              <div className="space-y-4 py-6">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : assigneeDetail ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{assigneeDetail.summary.rank}</div>
                      <div className="text-sm text-muted-foreground">Rank</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className={`text-2xl font-bold ${getScoreColor(assigneeDetail.summary.performanceScore)}`}>
                        {Math.round(assigneeDetail.summary.performanceScore)}
                      </div>
                      <div className="text-sm text-muted-foreground">Score</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold">{assigneeDetail.summary.projectCount}</div>
                      <div className="text-sm text-muted-foreground">Projects</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-red-600">{assigneeDetail.summary.lateEvents}</div>
                      <div className="text-sm text-muted-foreground">Late Events</div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Stage Breakdown</CardTitle>
                    <CardDescription>Where lateness is occurring</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {assigneeDetail.stageBreakdown.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No late events to analyze</p>
                    ) : (
                      <div className="space-y-4">
                        {assigneeDetail.stageBreakdown.map((stage) => (
                          <div key={stage.stageName} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{stage.stageName}</span>
                              <span className="text-sm text-muted-foreground">
                                {stage.lateEvents} events, {stage.lateDays} days ({stage.percentOfLateness}%)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={stage.percentOfLateness} className="flex-1" />
                              <Badge variant={stage.percentOfLateness > stage.teamAverage ? "destructive" : "secondary"}>
                                {stage.percentOfLateness > stage.teamAverage ? "Above" : "Below"} avg
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {assigneeDetail.coachingInsights.length > 0 && (
                  <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-600" />
                        Coaching Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {assigneeDetail.coachingInsights.map((insight, i) => (
                          <p key={i} className="text-sm">{insight}</p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {assigneeDetail.projectDetails.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Late Projects</CardTitle>
                      <CardDescription>Projects that experienced lateness during this period</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Project</TableHead>
                              <TableHead>Client</TableHead>
                              <TableHead>Stage</TableHead>
                              <TableHead className="text-right">Days Late</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {assigneeDetail.projectDetails.map((project) => (
                              <TableRow key={project.projectId}>
                                <TableCell className="font-medium">{project.projectDescription}</TableCell>
                                <TableCell>{project.clientName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{project.stageName}</Badge>
                                </TableCell>
                                <TableCell className="text-right text-red-600">{project.daysLate}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                Unable to load detail data
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
