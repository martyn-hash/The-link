import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { 
  X, ChevronRight, ChevronLeft, CheckSquare, Calendar, Target, Clock, Building2,
  MessageSquare, User, Briefcase, FileText, AlertCircle, Flag, Tag,
  Activity, ClipboardList, Users, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

interface ChronologyEntry {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  fromValue: string | null;
  toValue: string;
  changeReason?: string | null;
  notes?: string | null;
  timestamp: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
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

  // Auto-select first event when modal opens
  useEffect(() => {
    if (open && events.length > 0 && !selectedEvent) {
      setSelectedEvent(events[0]);
    }
  }, [open, events]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedEvent(null);
      setIsExpanded(false);
    }
  }, [open]);

  // Fetch project communications when a project event is selected
  const { data: projectCommunications, isLoading: loadingComms } = useQuery<Communication[]>({
    queryKey: ['/api/projects', selectedEvent?.entityId, 'communications'],
    enabled: !!selectedEvent && selectedEvent.entityType === 'project' && open,
  });

  // Fetch client chronology when a project event is selected
  const { data: clientChronology, isLoading: loadingChronology } = useQuery<ChronologyEntry[]>({
    queryKey: ['/api/clients', selectedEvent?.clientId, 'chronology'],
    enabled: !!selectedEvent && !!selectedEvent.clientId && selectedEvent.entityType === 'project' && open,
  });

  // Fetch task details when a task event is selected
  const { data: taskDetails, isLoading: loadingTask } = useQuery<TaskDetails>({
    queryKey: ['/api/internal-tasks', selectedEvent?.entityId],
    enabled: !!selectedEvent && selectedEvent.entityType === 'task' && open,
  });

  // Filter chronology for this specific project
  const projectChronology = useMemo(() => {
    if (!clientChronology || !selectedEvent) return [];
    return clientChronology
      .filter(entry => entry.entityId === selectedEvent.entityId && entry.entityType === 'project')
      .slice(0, 10);
  }, [clientChronology, selectedEvent]);

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
          "p-0 gap-0 transition-all duration-300 ease-in-out",
          isExpanded 
            ? "max-w-[96vw] w-[96vw] h-[94vh] max-h-[94vh]" 
            : "max-w-[95vw] md:max-w-4xl h-[85vh]"
        )}
      >
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isExpanded && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCollapse}
                  className="mr-2"
                  data-testid="button-collapse-modal"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {format(date, "EEEE, MMMM d, yyyy")}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {events.length} {events.length === 1 ? "item" : "items"} scheduled
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Column 1: Categories - becomes icon rail when expanded */}
          <TooltipProvider>
            <div 
              className={cn(
                "border-r transition-all duration-300 flex flex-col shrink-0",
                isExpanded ? "w-16" : "w-56"
              )}
            >
              {!isExpanded && (
                <div className="px-3 py-2 border-b bg-muted/20 shrink-0">
                  <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                    Categories
                  </h3>
                </div>
              )}
              <ScrollArea className="flex-1">
                {isExpanded ? (
                  // Icon rail mode
                  <div className="py-2 space-y-1">
                    {categories.map((category) => (
                      <Tooltip key={category.id}>
                        <TooltipTrigger asChild>
                          <div className="px-2">
                            <div 
                              className={cn(
                                "w-12 h-12 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors",
                                "hover:bg-accent",
                                selectedEvent && category.events.some(e => e.id === selectedEvent.id) && "bg-accent ring-1 ring-primary"
                              )}
                              style={{ borderLeft: `3px solid ${category.color}` }}
                              onClick={() => handleEventSelect(category.events[0])}
                            >
                              <category.icon className="w-4 h-4 text-muted-foreground" />
                              <span className="text-xs font-bold mt-0.5">{category.events.length}</span>
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
                  // Full accordion mode
                  <Accordion type="multiple" defaultValue={categories.map(c => c.id)} className="px-2 py-2">
                    {categories.map((category) => (
                      <AccordionItem 
                        key={category.id} 
                        value={category.id}
                        className="border rounded-lg mb-2 overflow-hidden"
                      >
                        <AccordionTrigger className="px-2 py-1.5 hover:no-underline hover:bg-accent/50 text-sm">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: category.color }}
                            />
                            <category.icon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium text-xs truncate">{category.name}</span>
                            <Badge variant="secondary" className="ml-auto text-xs h-5">
                              {category.events.length}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-1 px-1">
                          <div className="space-y-0.5">
                            {category.events.map((event) => (
                              <button
                                key={event.id}
                                onClick={() => handleEventSelect(event)}
                                className={cn(
                                  "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors",
                                  "hover:bg-accent",
                                  selectedEvent?.id === event.id && "bg-accent ring-1 ring-primary"
                                )}
                              >
                                <div className="flex items-center gap-1">
                                  <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                  <span className="truncate font-medium">{event.title}</span>
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

          {/* Column 2: Summary - becomes thin when expanded */}
          <div 
            className={cn(
              "transition-all duration-300 flex flex-col min-w-0 shrink-0",
              isExpanded ? "w-64 border-r" : "flex-1"
            )}
          >
            <div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between shrink-0">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                Summary
              </h3>
            </div>
            <ScrollArea className="flex-1">
              {selectedEvent ? (
                <div className="p-4 space-y-4">
                  {/* Event header */}
                  <div
                    className="w-full h-1.5 rounded-full"
                    style={{ backgroundColor: selectedEvent.color }}
                  />
                  
                  <div>
                    <h4 className={cn("font-bold leading-tight", isExpanded ? "text-base" : "text-lg")}>
                      {selectedEvent.title}
                    </h4>
                    {selectedEvent.clientName && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedEvent.clientName}
                      </p>
                    )}
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</p>
                      <p className="font-medium text-sm mt-0.5 capitalize">
                        {selectedEvent.type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</p>
                      <p className="font-medium text-sm mt-0.5 capitalize">
                        {selectedEvent.status}
                      </p>
                    </div>
                  </div>

                  {selectedEvent.assigneeName && (
                    <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2.5">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Assignee</p>
                        <p className="font-medium text-sm">{selectedEvent.assigneeName}</p>
                      </div>
                    </div>
                  )}

                  {selectedEvent.isOverdue && (
                    <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-2.5">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium text-sm">Overdue</span>
                    </div>
                  )}

                  {selectedEvent.meta?.stageName && (
                    <div className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Stage</p>
                      <p className="font-medium text-sm mt-0.5">{selectedEvent.meta.stageName}</p>
                    </div>
                  )}

                  {!isExpanded && (
                    <>
                      <Separator />
                      <Button
                        onClick={handleExpand}
                        className="w-full"
                        data-testid="button-show-more-details"
                      >
                        Show Full Details
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full p-8">
                  <p className="text-sm text-muted-foreground">Select an event to view details</p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Column 3: Full Details - only shown when expanded, takes majority of space */}
          {isExpanded && selectedEvent && (
            <div className="flex-1 flex flex-col min-w-0 bg-background">
              <div className="px-6 py-3 border-b bg-muted/10 flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-sm text-foreground">
                  Full Details
                </h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  {/* Hero Header */}
                  <div 
                    className="rounded-xl p-6"
                    style={{ 
                      background: `linear-gradient(135deg, ${selectedEvent.color}20 0%, ${selectedEvent.color}05 100%)`,
                      borderLeft: `4px solid ${selectedEvent.color}`
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold">{selectedEvent.title}</h2>
                        {selectedEvent.clientName && (
                          <p className="text-lg text-muted-foreground mt-1">{selectedEvent.clientName}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <Badge 
                          variant={selectedEvent.isOverdue ? "destructive" : "secondary"}
                          className="text-sm px-3 py-1"
                        >
                          {selectedEvent.status}
                        </Badge>
                        {selectedEvent.isOverdue && (
                          <Badge variant="destructive" className="text-sm px-3 py-1">
                            Overdue
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card border rounded-lg p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Tag className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wide">Type</span>
                      </div>
                      <p className="font-semibold capitalize">{selectedEvent.type.replace(/_/g, " ")}</p>
                    </div>
                    
                    <div className="bg-card border rounded-lg p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wide">Due Date</span>
                      </div>
                      <p className="font-semibold">{format(new Date(selectedEvent.date), "MMM d, yyyy")}</p>
                    </div>

                    {selectedEvent.assigneeName && (
                      <div className="bg-card border rounded-lg p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <User className="w-4 h-4" />
                          <span className="text-xs uppercase tracking-wide">Assignee</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                            style={{ backgroundColor: selectedEvent.color }}
                          >
                            {selectedEvent.assigneeName.charAt(0)}
                          </div>
                          <p className="font-semibold">{selectedEvent.assigneeName}</p>
                        </div>
                      </div>
                    )}

                    {selectedEvent.meta?.serviceName && (
                      <div className="bg-card border rounded-lg p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <Briefcase className="w-4 h-4" />
                          <span className="text-xs uppercase tracking-wide">Service</span>
                        </div>
                        <p className="font-semibold">{selectedEvent.meta.serviceName}</p>
                      </div>
                    )}

                    {selectedEvent.meta?.stageName && (
                      <div className="bg-card border rounded-lg p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <Flag className="w-4 h-4" />
                          <span className="text-xs uppercase tracking-wide">Stage</span>
                        </div>
                        <p className="font-semibold">{selectedEvent.meta.stageName}</p>
                      </div>
                    )}

                    {selectedEvent.meta?.projectTypeName && (
                      <div className="bg-card border rounded-lg p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <ClipboardList className="w-4 h-4" />
                          <span className="text-xs uppercase tracking-wide">Project Type</span>
                        </div>
                        <p className="font-semibold">{selectedEvent.meta.projectTypeName}</p>
                      </div>
                    )}
                  </div>

                  {/* Task-specific content */}
                  {selectedEvent.entityType === 'task' && (
                    <>
                      {loadingTask ? (
                        <div className="space-y-4">
                          <div className="animate-pulse bg-muted/30 rounded-lg h-32" />
                          <div className="animate-pulse bg-muted/30 rounded-lg h-48" />
                        </div>
                      ) : taskDetails ? (
                        <>
                          {/* Task Description */}
                          {taskDetails.description && (
                            <div className="bg-card border rounded-lg p-6">
                              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                                <FileText className="w-4 h-4" />
                                <span className="text-sm font-semibold uppercase tracking-wide">Description</span>
                              </div>
                              <p className="text-foreground leading-relaxed">{taskDetails.description}</p>
                            </div>
                          )}

                          {/* Task Details Grid */}
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {taskDetails.taskType && (
                              <div className="bg-card border rounded-lg p-4">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Task Type</p>
                                <p className="font-semibold">{taskDetails.taskType.name}</p>
                              </div>
                            )}
                            {taskDetails.priority && (
                              <div className="bg-card border rounded-lg p-4">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Priority</p>
                                <Badge 
                                  variant={taskDetails.priority === "urgent" || taskDetails.priority === "high" ? "destructive" : "secondary"}
                                >
                                  {taskDetails.priority}
                                </Badge>
                              </div>
                            )}
                            {taskDetails.creator && (
                              <div className="bg-card border rounded-lg p-4">
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Created By</p>
                                <p className="font-semibold">{taskDetails.creator.firstName} {taskDetails.creator.lastName}</p>
                              </div>
                            )}
                          </div>

                          {/* Related Entities */}
                          {(taskDetails.client || taskDetails.project) && (
                            <div className="bg-card border rounded-lg p-6">
                              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <Users className="w-4 h-4" />
                                <span className="text-sm font-semibold uppercase tracking-wide">Related To</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                {taskDetails.client && (
                                  <div className="bg-muted/30 rounded-lg p-4">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Client</p>
                                    <p className="font-semibold">{taskDetails.client.companyName}</p>
                                  </div>
                                )}
                                {taskDetails.project && (
                                  <div className="bg-muted/30 rounded-lg p-4">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Project</p>
                                    <p className="font-semibold">{taskDetails.project.name}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Progress Notes */}
                          {taskDetails.progressNotes && taskDetails.progressNotes.length > 0 && (
                            <div className="bg-card border rounded-lg p-6">
                              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <MessageSquare className="w-4 h-4" />
                                <span className="text-sm font-semibold uppercase tracking-wide">Progress Notes</span>
                                <Badge variant="secondary" className="ml-auto">{taskDetails.progressNotes.length}</Badge>
                              </div>
                              <div className="space-y-4">
                                {taskDetails.progressNotes.map((note) => (
                                  <div key={note.id} className="bg-muted/30 rounded-lg p-4">
                                    <p className="text-foreground">{note.content}</p>
                                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
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

                  {/* Project-specific content */}
                  {selectedEvent.entityType === 'project' && (
                    <>
                      {isLoadingDetails ? (
                        <div className="space-y-4">
                          <div className="animate-pulse bg-muted/30 rounded-lg h-32" />
                          <div className="animate-pulse bg-muted/30 rounded-lg h-48" />
                        </div>
                      ) : (
                        <>
                          {/* Activity Timeline */}
                          {projectChronology.length > 0 && (
                            <div className="bg-card border rounded-lg p-6">
                              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <Activity className="w-4 h-4" />
                                <span className="text-sm font-semibold uppercase tracking-wide">Activity Timeline</span>
                                <Badge variant="secondary" className="ml-auto">{projectChronology.length}</Badge>
                              </div>
                              <div className="relative">
                                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                                <div className="space-y-4">
                                  {projectChronology.map((entry, index) => (
                                    <div key={entry.id} className="relative pl-10">
                                      <div 
                                        className="absolute left-2.5 w-3 h-3 rounded-full border-2 border-background"
                                        style={{ backgroundColor: selectedEvent.color }}
                                      />
                                      <div className="bg-muted/30 rounded-lg p-4">
                                        <div className="flex items-start justify-between gap-4">
                                          <div className="flex-1">
                                            <p className="font-semibold capitalize">
                                              {entry.eventType.replace(/_/g, " ")}
                                            </p>
                                            {entry.fromValue && entry.toValue && (
                                              <p className="text-sm text-muted-foreground mt-1">
                                                <span className="line-through">{entry.fromValue}</span>
                                                <span className="mx-2">→</span>
                                                <span className="font-medium text-foreground">{entry.toValue}</span>
                                              </p>
                                            )}
                                            {entry.changeReason && (
                                              <p className="text-sm text-muted-foreground mt-1">
                                                Reason: {entry.changeReason}
                                              </p>
                                            )}
                                            {entry.notes && (
                                              <p className="text-sm mt-2">{entry.notes}</p>
                                            )}
                                          </div>
                                          <div className="text-right shrink-0">
                                            <p className="text-sm text-muted-foreground">
                                              {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {format(new Date(entry.timestamp), "MMM d, HH:mm")}
                                            </p>
                                          </div>
                                        </div>
                                        {entry.user && (
                                          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                                            <div 
                                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                                              style={{ backgroundColor: selectedEvent.color }}
                                            >
                                              {entry.user.firstName.charAt(0)}
                                            </div>
                                            <span className="text-sm text-muted-foreground">
                                              {entry.user.firstName} {entry.user.lastName}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Communications */}
                          {projectCommunications && projectCommunications.length > 0 && (
                            <div className="bg-card border rounded-lg p-6">
                              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                                <MessageSquare className="w-4 h-4" />
                                <span className="text-sm font-semibold uppercase tracking-wide">Communications</span>
                                <Badge variant="secondary" className="ml-auto">{projectCommunications.length}</Badge>
                              </div>
                              <div className="space-y-4">
                                {projectCommunications.slice(0, 5).map((comm) => (
                                  <div key={comm.id} className="bg-muted/30 rounded-lg p-4">
                                    <p className="text-foreground">{comm.content}</p>
                                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
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
                                          <Badge variant="outline" className="text-xs">{comm.communicationType}</Badge>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Empty state for projects with no activity */}
                          {projectChronology.length === 0 && (!projectCommunications || projectCommunications.length === 0) && (
                            <div className="bg-card border rounded-lg p-8 text-center">
                              <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                              <h3 className="font-semibold text-lg mb-2">No Recent Activity</h3>
                              <p className="text-muted-foreground">
                                There is no recorded activity or communications for this project yet.
                              </p>
                            </div>
                          )}
                        </>
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
