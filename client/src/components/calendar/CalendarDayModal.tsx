import { useState, useMemo } from "react";
import { format } from "date-fns";
import { X, ChevronRight, CheckSquare, Calendar, Target, Clock, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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

  const handleEventSelect = (event: CalendarEventType) => {
    setSelectedEvent(event);
    setShowFullDetails(false);
  };

  const handleShowMore = () => {
    setShowFullDetails(true);
  };

  const handleBackToCategories = () => {
    setSelectedEvent(null);
    setShowFullDetails(false);
  };

  const handleViewFullPage = () => {
    if (selectedEvent) {
      onEventClick(selectedEvent);
      onOpenChange(false);
    }
  };

  if (!date) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "max-w-[95vw] h-[80vh] p-0 gap-0 transition-all duration-300",
          showFullDetails ? "md:max-w-6xl" : selectedEvent ? "md:max-w-4xl" : "md:max-w-2xl"
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
          <div 
            className={cn(
              "border-r transition-all duration-300 flex flex-col",
              selectedEvent ? (showFullDetails ? "w-48" : "w-64") : "flex-1"
            )}
          >
            <div className="px-4 py-3 border-b bg-muted/20">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
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
                    <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-accent/50">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <category.icon className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm truncate">
                          {selectedEvent ? "" : category.name}
                        </span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {category.events.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-2 px-2">
                      <div className="space-y-1">
                        {category.events.map((event) => (
                          <button
                            key={event.id}
                            onClick={() => handleEventSelect(event)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                              "hover:bg-accent",
                              selectedEvent?.id === event.id && "bg-accent ring-2 ring-primary"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate font-medium">{event.title}</span>
                            </div>
                            {!selectedEvent && event.clientName && (
                              <p className="text-xs text-muted-foreground mt-0.5 pl-5 truncate">
                                {event.clientName}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          </div>

          {selectedEvent && (
            <div 
              className={cn(
                "border-r transition-all duration-300 flex flex-col",
                showFullDetails ? "w-72" : "flex-1"
              )}
            >
              <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Summary
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleBackToCategories}
                  className="h-7 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Close
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  <div
                    className="w-full h-2 rounded-full"
                    style={{ backgroundColor: selectedEvent.color }}
                  />
                  
                  <div>
                    <h4 className="font-bold text-lg">{selectedEvent.title}</h4>
                    {selectedEvent.clientName && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedEvent.clientName}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Type</p>
                      <p className="font-medium text-sm mt-1 capitalize">
                        {selectedEvent.type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                      <p className="font-medium text-sm mt-1 capitalize">
                        {selectedEvent.status}
                      </p>
                    </div>
                  </div>

                  {selectedEvent.assigneeName && (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Assignee</p>
                      <p className="font-medium text-sm mt-1">{selectedEvent.assigneeName}</p>
                    </div>
                  )}

                  {selectedEvent.meta?.serviceName && (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Service</p>
                      <p className="font-medium text-sm mt-1">{selectedEvent.meta.serviceName}</p>
                    </div>
                  )}

                  {selectedEvent.meta?.stageName && (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Stage</p>
                      <p className="font-medium text-sm mt-1">{selectedEvent.meta.stageName}</p>
                    </div>
                  )}

                  {selectedEvent.isOverdue && (
                    <Badge variant="destructive" className="w-full justify-center py-1.5">
                      Overdue
                    </Badge>
                  )}

                  <div className="flex gap-2 pt-2">
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
                      Open Full View
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}

          {showFullDetails && selectedEvent && (
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Full Details
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullDetails(false)}
                  className="h-7 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Collapse
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                          Event Information
                        </h5>
                        <div className="bg-card border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Type</span>
                            <span className="font-medium capitalize">{selectedEvent.type.replace(/_/g, " ")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Date</span>
                            <span className="font-medium">{format(new Date(selectedEvent.date), "MMM d, yyyy")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <Badge variant={selectedEvent.isOverdue ? "destructive" : "secondary"}>
                              {selectedEvent.status}
                            </Badge>
                          </div>
                          {selectedEvent.isOverdue && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Overdue</span>
                              <Badge variant="destructive">Yes</Badge>
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedEvent.assigneeName && (
                        <div>
                          <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                            Assignment
                          </h5>
                          <div className="bg-card border rounded-lg p-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
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
                      {(selectedEvent.meta?.serviceName || selectedEvent.meta?.projectTypeName) && (
                        <div>
                          <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                            Project Details
                          </h5>
                          <div className="bg-card border rounded-lg p-4 space-y-3">
                            {selectedEvent.meta?.serviceName && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Service</span>
                                <span className="font-medium">{selectedEvent.meta.serviceName}</span>
                              </div>
                            )}
                            {selectedEvent.meta?.projectTypeName && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Project Type</span>
                                <span className="font-medium">{selectedEvent.meta.projectTypeName}</span>
                              </div>
                            )}
                            {selectedEvent.meta?.stageName && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Stage</span>
                                <span className="font-medium">{selectedEvent.meta.stageName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedEvent.meta?.description && (
                        <div>
                          <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                            Description
                          </h5>
                          <div className="bg-card border rounded-lg p-4">
                            <p className="text-sm">{selectedEvent.meta.description}</p>
                          </div>
                        </div>
                      )}

                      {selectedEvent.meta?.priority && (
                        <div>
                          <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                            Priority
                          </h5>
                          <div className="bg-card border rounded-lg p-4">
                            <Badge 
                              variant={
                                selectedEvent.meta.priority === "urgent" ? "destructive" :
                                selectedEvent.meta.priority === "high" ? "destructive" :
                                "secondary"
                              }
                            >
                              {selectedEvent.meta.priority}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-center pt-4">
                    <Button 
                      size="lg" 
                      onClick={handleViewFullPage}
                      className="px-8"
                      data-testid="button-open-full-view-expanded"
                    >
                      Open Full {selectedEvent.entityType === "project" ? "Project" : "Task"} View
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
