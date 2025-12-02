import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { 
  X, ChevronRight, CheckSquare, Calendar, Target, Clock, Building2,
  MessageSquare, User, Briefcase, FileText, AlertCircle, ArrowUpRight
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
  onEventClick,
}: CalendarDayModalProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventType | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);

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
      setShowFullDetails(false);
    }
  }, [open]);

  // Fetch project communications when a project event is selected
  const { data: projectCommunications, isLoading: loadingComms } = useQuery<Communication[]>({
    queryKey: ['/api/projects', selectedEvent?.entityId, 'communications'],
    enabled: !!selectedEvent && selectedEvent.entityType === 'project' && open,
  });

  // Fetch client chronology when a project event is selected (for stage changes etc)
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
      .slice(0, 5);
  }, [clientChronology, selectedEvent]);

  const handleEventSelect = (event: CalendarEventType) => {
    setSelectedEvent(event);
    setShowFullDetails(false);
  };

  const handleShowMore = () => {
    setShowFullDetails(true);
  };

  const handleViewFullPage = () => {
    if (selectedEvent) {
      onEventClick(selectedEvent);
      onOpenChange(false);
    }
  };

  if (!date) return null;

  const isLoadingDetails = selectedEvent?.entityType === 'project' 
    ? (loadingComms || loadingChronology)
    : loadingTask;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "max-w-[95vw] h-[85vh] p-0 gap-0 transition-all duration-300",
          showFullDetails ? "md:max-w-6xl" : "md:max-w-4xl"
        )}
      >
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  {format(date, "EEEE, MMMM d, yyyy")}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {events.length} {events.length === 1 ? "item" : "items"} scheduled
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Column 1: Categories */}
          <div 
            className={cn(
              "border-r transition-all duration-300 flex flex-col min-w-0",
              showFullDetails ? "w-44" : "w-56"
            )}
          >
            <div className="px-3 py-2 border-b bg-muted/20">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                Categories
              </h3>
            </div>
            <ScrollArea className="flex-1">
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
            </ScrollArea>
          </div>

          {/* Column 2: Summary with enriched data */}
          <div 
            className={cn(
              "transition-all duration-300 flex flex-col min-w-0",
              showFullDetails ? "w-72 border-r" : "flex-1"
            )}
          >
            <div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between">
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
                    <h4 className="font-bold text-lg leading-tight">{selectedEvent.title}</h4>
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

                  <Separator />

                  {/* Enriched content based on entity type */}
                  {selectedEvent.entityType === 'project' && (
                    <div className="space-y-3">
                      <h5 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Recent Activity
                      </h5>
                      
                      {isLoadingDetails ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse bg-muted/30 rounded-lg h-16" />
                          ))}
                        </div>
                      ) : projectChronology.length > 0 ? (
                        <div className="space-y-2">
                          {projectChronology.map((entry) => (
                            <div key={entry.id} className="bg-muted/30 rounded-lg p-2.5 text-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-xs capitalize">
                                    {entry.eventType.replace(/_/g, " ")}
                                  </p>
                                  {entry.fromValue && entry.toValue && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {entry.fromValue} → {entry.toValue}
                                    </p>
                                  )}
                                  {entry.changeReason && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                      {entry.changeReason}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                                </span>
                              </div>
                              {entry.user && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  by {entry.user.firstName} {entry.user.lastName}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : projectCommunications && projectCommunications.length > 0 ? (
                        <div className="space-y-2">
                          {projectCommunications.slice(0, 3).map((comm) => (
                            <div key={comm.id} className="bg-muted/30 rounded-lg p-2.5 text-sm">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs line-clamp-2">{comm.content}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(comm.createdAt), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No recent activity</p>
                      )}

                      {selectedEvent.meta?.stageName && (
                        <>
                          <Separator />
                          <div className="bg-muted/30 rounded-lg p-2.5">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Stage</p>
                            <p className="font-medium text-sm mt-0.5">{selectedEvent.meta.stageName}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {selectedEvent.entityType === 'task' && (
                    <div className="space-y-3">
                      <h5 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Task Details
                      </h5>
                      
                      {loadingTask ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse bg-muted/30 rounded-lg h-12" />
                          ))}
                        </div>
                      ) : taskDetails ? (
                        <div className="space-y-2">
                          {taskDetails.description && (
                            <div className="bg-muted/30 rounded-lg p-2.5">
                              <p className="text-xs">{taskDetails.description}</p>
                            </div>
                          )}
                          
                          {taskDetails.taskType && (
                            <div className="bg-muted/30 rounded-lg p-2.5">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Task Type</p>
                              <p className="font-medium text-sm mt-0.5">{taskDetails.taskType.name}</p>
                            </div>
                          )}

                          {taskDetails.priority && (
                            <div className="bg-muted/30 rounded-lg p-2.5">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Priority</p>
                              <Badge 
                                variant={taskDetails.priority === "urgent" || taskDetails.priority === "high" ? "destructive" : "secondary"}
                                className="mt-0.5"
                              >
                                {taskDetails.priority}
                              </Badge>
                            </div>
                          )}

                          {(taskDetails.client || taskDetails.project) && (
                            <>
                              <Separator />
                              <h5 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Briefcase className="w-3.5 h-3.5" />
                                Related To
                              </h5>
                              {taskDetails.client && (
                                <div className="bg-muted/30 rounded-lg p-2.5">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Client</p>
                                  <p className="font-medium text-sm mt-0.5">{taskDetails.client.companyName}</p>
                                </div>
                              )}
                              {taskDetails.project && (
                                <div className="bg-muted/30 rounded-lg p-2.5">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Project</p>
                                  <p className="font-medium text-sm mt-0.5">{taskDetails.project.name}</p>
                                </div>
                              )}
                            </>
                          )}

                          {taskDetails.progressNotes && taskDetails.progressNotes.length > 0 && (
                            <>
                              <Separator />
                              <h5 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5" />
                                Recent Notes
                              </h5>
                              {taskDetails.progressNotes.slice(0, 2).map((note) => (
                                <div key={note.id} className="bg-muted/30 rounded-lg p-2.5">
                                  <p className="text-xs line-clamp-2">{note.content}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                                  </p>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Loading task details...</p>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShowMore}
                      className="flex-1"
                      data-testid="button-show-more-details"
                    >
                      Show More
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleViewFullPage}
                      className="flex-1"
                      data-testid="button-view-full-page"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                      Open Page
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full p-8">
                  <p className="text-sm text-muted-foreground">Select an event to view details</p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Column 3: Full Details (only shown when expanded) */}
          {showFullDetails && selectedEvent && (
            <div className="flex-1 flex flex-col min-w-0">
              <div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between">
                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                  Full Details
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullDetails(false)}
                  className="h-6 text-xs px-2"
                >
                  <X className="w-3 h-3 mr-1" />
                  Collapse
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                  {/* Header card */}
                  <div 
                    className="rounded-lg p-4"
                    style={{ 
                      backgroundColor: `${selectedEvent.color}15`,
                      borderLeft: `4px solid ${selectedEvent.color}`
                    }}
                  >
                    <h4 className="font-bold text-xl">{selectedEvent.title}</h4>
                    {selectedEvent.clientName && (
                      <p className="text-muted-foreground mt-1">{selectedEvent.clientName}</p>
                    )}
                    {selectedEvent.isOverdue && (
                      <Badge variant="destructive" className="mt-2">Overdue</Badge>
                    )}
                  </div>

                  {/* Full details grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                          Event Information
                        </h5>
                        <div className="bg-card border rounded-lg divide-y">
                          <div className="flex justify-between p-3">
                            <span className="text-sm text-muted-foreground">Type</span>
                            <span className="font-medium text-sm capitalize">{selectedEvent.type.replace(/_/g, " ")}</span>
                          </div>
                          <div className="flex justify-between p-3">
                            <span className="text-sm text-muted-foreground">Date</span>
                            <span className="font-medium text-sm">{format(new Date(selectedEvent.date), "MMM d, yyyy")}</span>
                          </div>
                          <div className="flex justify-between p-3">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <Badge variant="secondary">{selectedEvent.status}</Badge>
                          </div>
                        </div>
                      </div>

                      {selectedEvent.assigneeName && (
                        <div>
                          <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                            Assignment
                          </h5>
                          <div className="bg-card border rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                                style={{ backgroundColor: selectedEvent.color }}
                              >
                                {selectedEvent.assigneeName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium">{selectedEvent.assigneeName}</p>
                                <p className="text-sm text-muted-foreground">Assigned</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {(selectedEvent.meta?.serviceName || selectedEvent.meta?.projectTypeName || selectedEvent.meta?.stageName) && (
                        <div>
                          <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                            Project Details
                          </h5>
                          <div className="bg-card border rounded-lg divide-y">
                            {selectedEvent.meta?.serviceName && (
                              <div className="flex justify-between p-3">
                                <span className="text-sm text-muted-foreground">Service</span>
                                <span className="font-medium text-sm">{selectedEvent.meta.serviceName}</span>
                              </div>
                            )}
                            {selectedEvent.meta?.projectTypeName && (
                              <div className="flex justify-between p-3">
                                <span className="text-sm text-muted-foreground">Project Type</span>
                                <span className="font-medium text-sm">{selectedEvent.meta.projectTypeName}</span>
                              </div>
                            )}
                            {selectedEvent.meta?.stageName && (
                              <div className="flex justify-between p-3">
                                <span className="text-sm text-muted-foreground">Stage</span>
                                <span className="font-medium text-sm">{selectedEvent.meta.stageName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Full chronology for projects */}
                      {selectedEvent.entityType === 'project' && projectChronology.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                            Activity Timeline
                          </h5>
                          <div className="bg-card border rounded-lg divide-y max-h-64 overflow-y-auto">
                            {projectChronology.map((entry) => (
                              <div key={entry.id} className="p-3">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-sm capitalize">
                                      {entry.eventType.replace(/_/g, " ")}
                                    </p>
                                    {entry.fromValue && entry.toValue && (
                                      <p className="text-sm text-muted-foreground">
                                        {entry.fromValue} → {entry.toValue}
                                      </p>
                                    )}
                                    {entry.notes && (
                                      <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                    {format(new Date(entry.timestamp), "MMM d, HH:mm")}
                                  </span>
                                </div>
                                {entry.user && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    by {entry.user.firstName} {entry.user.lastName}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Full task details */}
                      {selectedEvent.entityType === 'task' && taskDetails && (
                        <>
                          {taskDetails.description && (
                            <div>
                              <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                                Description
                              </h5>
                              <div className="bg-card border rounded-lg p-3">
                                <p className="text-sm">{taskDetails.description}</p>
                              </div>
                            </div>
                          )}
                          
                          {taskDetails.progressNotes && taskDetails.progressNotes.length > 0 && (
                            <div>
                              <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                                All Progress Notes
                              </h5>
                              <div className="bg-card border rounded-lg divide-y max-h-48 overflow-y-auto">
                                {taskDetails.progressNotes.map((note) => (
                                  <div key={note.id} className="p-3">
                                    <p className="text-sm">{note.content}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {format(new Date(note.createdAt), "MMM d, yyyy 'at' HH:mm")}
                                      {note.createdBy && ` by ${note.createdBy.firstName} ${note.createdBy.lastName}`}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bottom action */}
                  <div className="flex justify-center pt-4 border-t">
                    <Button 
                      size="lg" 
                      onClick={handleViewFullPage}
                      className="px-8"
                      data-testid="button-open-full-view-expanded"
                    >
                      <ArrowUpRight className="w-4 h-4 mr-2" />
                      Open Full {selectedEvent.entityType === "project" ? "Project" : "Task"} Page
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
