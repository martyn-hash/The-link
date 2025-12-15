import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { 
  ChevronRight, ChevronLeft, CheckSquare, Calendar, Target, Clock, Building2,
  MessageSquare, User, Briefcase, FileText, AlertCircle, Flag, Tag,
  Activity, ClipboardList, Users, History
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CalendarEvent as CalendarEventType } from "@shared/schema";

interface CalendarDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  events: CalendarEventType[];
  onEventClick: (event: CalendarEventType) => void;
}

interface CategoryGroup {
  id: string;
  name: string;
  icon: any;
  color: string;
  events: CalendarEventType[];
}

function groupEventsByType(events: CalendarEventType[]): CategoryGroup[] {
  const serviceGroups = new Map<string, CalendarEventType[]>();
  const stageEvents: CalendarEventType[] = [];
  const targetEvents: CalendarEventType[] = [];
  const taskEvents: CalendarEventType[] = [];

  events.forEach((event) => {
    if (event.type === "project_due") {
      const serviceName = event.meta?.serviceName || "Other Projects";
      const existing = serviceGroups.get(serviceName) || [];
      existing.push(event);
      serviceGroups.set(serviceName, existing);
    } else if (event.type === "stage_deadline") {
      stageEvents.push(event);
    } else if (event.type === "project_target") {
      targetEvents.push(event);
    } else if (event.type === "task_due") {
      taskEvents.push(event);
    }
  });

  const groups: CategoryGroup[] = [];

  serviceGroups.forEach((groupEvents, serviceName) => {
    groups.push({
      id: `service-${serviceName}`,
      name: serviceName,
      icon: Building2,
      color: groupEvents[0]?.color || "#6b7280",
      events: groupEvents,
    });
  });

  if (stageEvents.length > 0) {
    groups.push({
      id: "stage-deadlines",
      name: "Stage Deadlines",
      icon: Clock,
      color: "#f59e0b",
      events: stageEvents,
    });
  }

  if (targetEvents.length > 0) {
    groups.push({
      id: "target-dates",
      name: "Target Delivery Dates",
      icon: Target,
      color: "#3b82f6",
      events: targetEvents,
    });
  }

  if (taskEvents.length > 0) {
    groups.push({
      id: "tasks",
      name: "Tasks",
      icon: CheckSquare,
      color: "#10b981",
      events: taskEvents,
    });
  }

  return groups.sort((a, b) => b.events.length - a.events.length);
}

interface ProjectChronologyEntry {
  id: string;
  projectId: string;
  fromStatus: string | null;
  toStatus: string | null;
  timestamp: string;
  notes?: string | null;
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  changedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  fieldResponses?: Array<{
    id: string;
    value: string;
    customField: {
      label: string;
    };
  }>;
}

interface Communication {
  id: string;
  content: string;
  createdAt: string;
  createdBy?: {
    firstName: string;
    lastName: string;
  };
  communicationType?: string;
}

interface TaskDetails {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  assignee?: {
    firstName: string;
    lastName: string;
  };
  creator?: {
    firstName: string;
    lastName: string;
  };
  client?: {
    companyName: string;
  };
  project?: {
    name: string;
    clientName?: string;
  };
  progressNotes?: Array<{
    id: string;
    content: string;
    createdAt: string;
    createdBy?: {
      firstName: string;
      lastName: string;
    };
  }>;
  taskType?: {
    name: string;
  };
}

export default function CalendarDayModal({
  open,
  onOpenChange,
  date,
  events,
}: CalendarDayModalProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const categories = useMemo(() => groupEventsByType(events), [events]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedEvent(null);
      setIsExpanded(false);
    }
  }, [open]);

  const { data: projectCommunications, isLoading: loadingComms } = useQuery<Communication[]>({
    queryKey: ['/api/projects', selectedEvent?.entityId, 'communications'],
    enabled: !!selectedEvent && selectedEvent.entityType === 'project' && open,
  });

  const { data: projectChronology, isLoading: loadingChronology } = useQuery<ProjectChronologyEntry[]>({
    queryKey: ['/api/projects', selectedEvent?.entityId, 'field-responses'],
    enabled: !!selectedEvent && selectedEvent.entityType === 'project' && open,
  });

  const { data: taskDetails, isLoading: loadingTask } = useQuery<TaskDetails>({
    queryKey: ['/api/internal-tasks', selectedEvent?.entityId],
    enabled: !!selectedEvent && selectedEvent.entityType === 'task' && open,
  });

  const handleEventSelect = (event: CalendarEventType) => {
    setSelectedEvent(event);
  };

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  if (!date) return null;

  const isLoadingDetails = selectedEvent?.entityType === 'project' 
    ? (loadingComms || loadingChronology)
    : loadingTask;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "p-0 gap-0 transition-all duration-300 ease-in-out flex flex-col",
          isExpanded 
            ? "max-w-[96vw] w-[96vw] h-[94vh] max-h-[94vh]" 
            : "max-w-[95vw] md:max-w-2xl h-auto max-h-[80vh]"
        )}
      >
        <DialogHeader className="px-4 py-3 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            {isExpanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCollapse}
                className="h-8 px-2"
                data-testid="button-collapse-modal"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {format(date, "EEEE, MMMM d, yyyy")}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {events.length} {events.length === 1 ? "item" : "items"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <TooltipProvider>
            <div 
              className={cn(
                "border-r transition-all duration-300 flex flex-col",
                isExpanded ? "w-14 shrink-0" : "w-auto min-w-[180px] max-w-[280px]"
              )}
            >
              {!isExpanded && (
                <div className="px-2 py-1.5 border-b bg-muted/20 shrink-0">
                  <h3 className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
                    Categories
                  </h3>
                </div>
              )}
              <ScrollArea className="flex-1">
                {isExpanded ? (
                  <div className="py-1 space-y-0.5">
                    {categories.map((category) => (
                      <Tooltip key={category.id}>
                        <TooltipTrigger asChild>
                          <div className="px-1">
                            <div 
                              className={cn(
                                "w-12 h-10 rounded-md flex flex-col items-center justify-center cursor-pointer transition-colors",
                                "hover:bg-accent",
                                selectedEvent && category.events.some(e => e.id === selectedEvent.id) && "bg-accent ring-1 ring-primary"
                              )}
                              style={{ borderLeft: `3px solid ${category.color}` }}
                              onClick={() => handleEventSelect(category.events[0])}
                            >
                              <category.icon className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-[10px] font-bold">{category.events.length}</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{category.name} ({category.events.length})</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                ) : (
                  <Accordion type="multiple" defaultValue={categories.map(c => c.id)} className="px-1.5 py-1">
                    {categories.map((category) => (
                      <AccordionItem 
                        key={category.id} 
                        value={category.id}
                        className="border rounded-md mb-1 overflow-hidden"
                      >
                        <AccordionTrigger className="px-2 py-1 hover:no-underline hover:bg-accent/50 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: category.color }}
                            />
                            <category.icon className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium text-[11px] truncate">{category.name}</span>
                            <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1">
                              {category.events.length}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-0.5 px-0.5">
                          <div className="space-y-0">
                            {category.events.map((event) => (
                              <button
                                key={event.id}
                                onClick={() => handleEventSelect(event)}
                                className={cn(
                                  "w-full text-left px-1.5 py-1 rounded text-[11px] transition-colors",
                                  "hover:bg-accent",
                                  selectedEvent?.id === event.id && "bg-accent ring-1 ring-primary"
                                )}
                              >
                                <div className="flex items-center gap-1">
                                  <ChevronRight className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                                  <span className="truncate font-medium">
                                    {event.clientName || event.title}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </ScrollArea>
            </div>
          </TooltipProvider>

          <div 
            className={cn(
              "transition-all duration-300 flex flex-col min-w-0 shrink-0",
              isExpanded ? "w-56 border-r" : "flex-1"
            )}
          >
            <div className="px-3 py-1.5 border-b bg-muted/20 shrink-0">
              <h3 className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
                Summary
              </h3>
            </div>
            <ScrollArea className="flex-1">
              {selectedEvent ? (
                <div className="p-3 space-y-3">
                  <div
                    className="w-full h-1 rounded-full"
                    style={{ backgroundColor: selectedEvent.color }}
                  />
                  
                  <div>
                    <h4 className={cn("font-bold leading-tight", isExpanded ? "text-sm" : "text-base")}>
                      {selectedEvent.title}
                    </h4>
                    {selectedEvent.clientName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedEvent.clientName}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-muted/30 rounded-md p-2">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Type</p>
                      <p className="font-medium text-xs capitalize">
                        {selectedEvent.type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-md p-2">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Status</p>
                      <p className="font-medium text-xs capitalize">
                        {selectedEvent.status}
                      </p>
                    </div>
                  </div>

                  {selectedEvent.assigneeName && (
                    <div className="flex items-center gap-2 bg-muted/30 rounded-md p-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Assignee</p>
                        <p className="font-medium text-xs">{selectedEvent.assigneeName}</p>
                      </div>
                    </div>
                  )}

                  {selectedEvent.isOverdue && (
                    <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-md p-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span className="font-medium text-xs">Overdue</span>
                    </div>
                  )}

                  {selectedEvent.meta?.stageName && (
                    <div className="bg-muted/30 rounded-md p-2">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Current Stage</p>
                      <p className="font-medium text-xs">{selectedEvent.meta.stageName}</p>
                    </div>
                  )}

                  {!isExpanded && (
                    <>
                      <Separator className="my-2" />
                      <Button
                        onClick={handleExpand}
                        className="w-full h-8 text-xs"
                        data-testid="button-show-more-details"
                      >
                        Show Full Details
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No selection</p>
                  <p className="text-xs text-muted-foreground max-w-[180px]">
                    Select a project or task from the categories on the left to see more details
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>

          {isExpanded && selectedEvent && (
            <div className="flex-1 flex flex-col min-w-0 bg-background">
              <div className="px-4 py-1.5 border-b bg-muted/10 shrink-0">
                <h3 className="font-semibold text-xs text-foreground">
                  Full Details
                </h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <div 
                    className="rounded-lg p-4"
                    style={{ 
                      background: `linear-gradient(135deg, ${selectedEvent.color}15 0%, ${selectedEvent.color}05 100%)`,
                      borderLeft: `3px solid ${selectedEvent.color}`
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h2 className="text-xl font-bold">{selectedEvent.title}</h2>
                        {selectedEvent.clientName && (
                          <p className="text-sm text-muted-foreground mt-0.5">{selectedEvent.clientName}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 items-end">
                        <Badge 
                          variant={selectedEvent.isOverdue ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {selectedEvent.status}
                        </Badge>
                        {selectedEvent.isOverdue && (
                          <Badge variant="destructive" className="text-xs">
                            Overdue
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="bg-card border rounded-md p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Tag className="w-3.5 h-3.5" />
                        <span className="text-[10px] uppercase tracking-wide">Type</span>
                      </div>
                      <p className="font-semibold text-sm capitalize">{selectedEvent.type.replace(/_/g, " ")}</p>
                    </div>
                    
                    <div className="bg-card border rounded-md p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[10px] uppercase tracking-wide">Due Date</span>
                      </div>
                      <p className="font-semibold text-sm">{format(new Date(selectedEvent.date), "MMM d, yyyy")}</p>
                    </div>

                    {selectedEvent.assigneeName && (
                      <div className="bg-card border rounded-md p-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <User className="w-3.5 h-3.5" />
                          <span className="text-[10px] uppercase tracking-wide">Assignee</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                            style={{ backgroundColor: selectedEvent.color }}
                          >
                            {selectedEvent.assigneeName.charAt(0)}
                          </div>
                          <p className="font-semibold text-sm">{selectedEvent.assigneeName}</p>
                        </div>
                      </div>
                    )}

                    {selectedEvent.meta?.serviceName && (
                      <div className="bg-card border rounded-md p-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Briefcase className="w-3.5 h-3.5" />
                          <span className="text-[10px] uppercase tracking-wide">Service</span>
                        </div>
                        <p className="font-semibold text-sm">{selectedEvent.meta.serviceName}</p>
                      </div>
                    )}

                    {selectedEvent.meta?.stageName && (
                      <div className="bg-card border rounded-md p-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <Flag className="w-3.5 h-3.5" />
                          <span className="text-[10px] uppercase tracking-wide">Stage</span>
                        </div>
                        <p className="font-semibold text-sm">{selectedEvent.meta.stageName}</p>
                      </div>
                    )}

                    {selectedEvent.meta?.projectTypeName && (
                      <div className="bg-card border rounded-md p-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <ClipboardList className="w-3.5 h-3.5" />
                          <span className="text-[10px] uppercase tracking-wide">Project Type</span>
                        </div>
                        <p className="font-semibold text-sm">{selectedEvent.meta.projectTypeName}</p>
                      </div>
                    )}
                  </div>

                  {selectedEvent.entityType === 'task' && (
                    <>
                      {loadingTask ? (
                        <div className="space-y-3">
                          <div className="animate-pulse bg-muted/30 rounded-md h-24" />
                          <div className="animate-pulse bg-muted/30 rounded-md h-32" />
                        </div>
                      ) : taskDetails ? (
                        <>
                          {taskDetails.description && (
                            <div className="bg-card border rounded-md p-4">
                              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                                <FileText className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold uppercase tracking-wide">Description</span>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed">{taskDetails.description}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                            {taskDetails.taskType && (
                              <div className="bg-card border rounded-md p-3">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Task Type</p>
                                <p className="font-semibold text-sm">{taskDetails.taskType.name}</p>
                              </div>
                            )}
                            {taskDetails.priority && (
                              <div className="bg-card border rounded-md p-3">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Priority</p>
                                <Badge 
                                  variant={taskDetails.priority === "urgent" || taskDetails.priority === "high" ? "destructive" : "secondary"}
                                  className="text-xs"
                                >
                                  {taskDetails.priority}
                                </Badge>
                              </div>
                            )}
                            {taskDetails.creator && (
                              <div className="bg-card border rounded-md p-3">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Created By</p>
                                <p className="font-semibold text-sm">{taskDetails.creator.firstName} {taskDetails.creator.lastName}</p>
                              </div>
                            )}
                          </div>

                          {(taskDetails.client || taskDetails.project) && (
                            <div className="bg-card border rounded-md p-4">
                              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                                <Users className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold uppercase tracking-wide">Related To</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {taskDetails.client && (
                                  <div className="bg-muted/30 rounded-md p-2">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Client</p>
                                    <p className="font-semibold text-sm">{taskDetails.client.companyName}</p>
                                  </div>
                                )}
                                {taskDetails.project && (
                                  <div className="bg-muted/30 rounded-md p-2">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Project</p>
                                    <p className="font-semibold text-sm">{taskDetails.project.name}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {taskDetails.progressNotes && taskDetails.progressNotes.length > 0 && (
                            <div className="bg-card border rounded-md p-4">
                              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold uppercase tracking-wide">Progress Notes</span>
                                <Badge variant="secondary" className="ml-auto text-[10px]">{taskDetails.progressNotes.length}</Badge>
                              </div>
                              <div className="space-y-2">
                                {taskDetails.progressNotes.map((note) => (
                                  <div key={note.id} className="bg-muted/30 rounded-md p-2">
                                    <p className="text-sm text-foreground">{note.content}</p>
                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                                      <span>{format(new Date(note.createdAt), "MMM d, yyyy 'at' HH:mm")}</span>
                                      {note.createdBy && (
                                        <>
                                          <span>•</span>
                                          <span>{note.createdBy.firstName} {note.createdBy.lastName}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : null}
                    </>
                  )}

                  {selectedEvent.entityType === 'project' && (
                    <>
                      {isLoadingDetails ? (
                        <div className="space-y-3">
                          <div className="animate-pulse bg-muted/30 rounded-md h-24" />
                          <div className="animate-pulse bg-muted/30 rounded-md h-32" />
                        </div>
                      ) : (
                        <Tabs defaultValue="chronology" className="w-full">
                          <TabsList className="w-full grid grid-cols-2 h-9">
                            <TabsTrigger value="chronology" className="text-xs gap-1.5">
                              <History className="w-3.5 h-3.5" />
                              Chronology
                              {projectChronology && projectChronology.length > 0 && (
                                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                                  {projectChronology.length}
                                </Badge>
                              )}
                            </TabsTrigger>
                            <TabsTrigger value="messaging" className="text-xs gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5" />
                              Messaging
                              {projectCommunications && projectCommunications.length > 0 && (
                                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                                  {projectCommunications.length}
                                </Badge>
                              )}
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="chronology" className="mt-3">
                            {projectChronology && projectChronology.length > 0 ? (
                              <div className="bg-card border rounded-md p-4">
                                <div className="relative">
                                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
                                  <div className="space-y-3">
                                    {projectChronology.slice(0, 10).map((entry) => (
                                      <div key={entry.id} className="relative pl-8">
                                        <div 
                                          className="absolute left-1.5 w-3 h-3 rounded-full border-2 border-background"
                                          style={{ backgroundColor: selectedEvent.color }}
                                        />
                                        <div className="bg-muted/30 rounded-md p-3">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                              {entry.fromStatus && entry.toStatus ? (
                                                <p className="font-semibold text-sm">
                                                  Stage Change
                                                </p>
                                              ) : (
                                                <p className="font-semibold text-sm">
                                                  {entry.toStatus ? `Set to ${entry.toStatus}` : 'Update'}
                                                </p>
                                              )}
                                              {entry.fromStatus && entry.toStatus && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                  <span className="line-through">{entry.fromStatus}</span>
                                                  <span className="mx-1.5">→</span>
                                                  <span className="font-medium text-foreground">{entry.toStatus}</span>
                                                </p>
                                              )}
                                              {entry.notes && (
                                                <p className="text-xs mt-1.5">{entry.notes}</p>
                                              )}
                                              {entry.fieldResponses && entry.fieldResponses.length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                  {entry.fieldResponses.map((resp) => (
                                                    <div key={resp.id} className="text-xs bg-background/50 rounded p-1.5">
                                                      <span className="text-muted-foreground">{resp.customField.label}:</span>{" "}
                                                      <span className="font-medium">{resp.value}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                            <div className="text-right shrink-0">
                                              <p className="text-[10px] text-muted-foreground">
                                                {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                                              </p>
                                              <p className="text-[10px] text-muted-foreground">
                                                {format(new Date(entry.timestamp), "MMM d, HH:mm")}
                                              </p>
                                            </div>
                                          </div>
                                          {entry.changedBy && (
                                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t">
                                              <div 
                                                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                                                style={{ backgroundColor: selectedEvent.color }}
                                              >
                                                {entry.changedBy.firstName.charAt(0)}
                                              </div>
                                              <span className="text-xs text-muted-foreground">
                                                {entry.changedBy.firstName} {entry.changedBy.lastName}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-card border rounded-md p-6 text-center">
                                <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                <h3 className="font-semibold text-sm mb-1">No Chronology</h3>
                                <p className="text-xs text-muted-foreground">
                                  No stage changes recorded yet.
                                </p>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="messaging" className="mt-3">
                            {projectCommunications && projectCommunications.length > 0 ? (
                              <div className="bg-card border rounded-md p-4">
                                <div className="space-y-2">
                                  {projectCommunications.slice(0, 10).map((comm) => (
                                    <div key={comm.id} className="bg-muted/30 rounded-md p-3">
                                      <p className="text-sm text-foreground">{comm.content}</p>
                                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground">
                                        <span>{formatDistanceToNow(new Date(comm.createdAt), { addSuffix: true })}</span>
                                        {comm.createdBy && (
                                          <>
                                            <span>•</span>
                                            <span>{comm.createdBy.firstName} {comm.createdBy.lastName}</span>
                                          </>
                                        )}
                                        {comm.communicationType && (
                                          <>
                                            <span>•</span>
                                            <Badge variant="outline" className="text-[9px] h-4">{comm.communicationType}</Badge>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-card border rounded-md p-6 text-center">
                                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                <h3 className="font-semibold text-sm mb-1">No Messages</h3>
                                <p className="text-xs text-muted-foreground">
                                  No communications recorded yet.
                                </p>
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
