import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Archive, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import type { InternalTask, TaskType, User } from '@shared/schema';

interface InternalTaskWithRelations extends InternalTask {
  taskType?: TaskType | null;
  assignee?: User | null;
  creator?: User | null;
}

interface SwipeableTaskCardProps {
  task: InternalTaskWithRelations;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onView: () => void;
  onComplete: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function SwipeableTaskCard({
  task,
  selected,
  onSelect,
  onView,
  onComplete,
  onArchive,
  onDelete,
}: SwipeableTaskCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiped, setIsSwiped] = useState(false);
  const maxSwipe = 240; // Width for three action buttons

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      setIsSwiped(true);
      setSwipeOffset(-maxSwipe);
    },
    onSwipedRight: () => {
      setIsSwiped(false);
      setSwipeOffset(0);
    },
    onSwiping: (eventData) => {
      // deltaX is negative when swiping left, positive when swiping right
      // Clamp between -maxSwipe and 0 to smoothly track finger movement
      const offset = Math.max(-maxSwipe, Math.min(0, eventData.deltaX));
      setSwipeOffset(offset);
    },
    trackMouse: false,
    trackTouch: true,
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-blue-500 text-white';
      case 'low':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500 text-white';
      case 'in_progress':
        return 'bg-yellow-500 text-white';
      case 'closed':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'd MMM yyyy');
  };

  return (
    <div className="relative overflow-hidden" data-testid={`swipeable-task-${task.id}`}>
      {/* Action buttons revealed on swipe */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center justify-end gap-2 pr-4 bg-gradient-to-l from-destructive/10 to-transparent">
        <Button
          variant="default"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
            setIsSwiped(false);
            setSwipeOffset(0);
          }}
          className="bg-green-600 hover:bg-green-700 h-12 w-12"
          data-testid={`button-complete-${task.id}`}
        >
          <Check className="h-5 w-5" />
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
            setIsSwiped(false);
            setSwipeOffset(0);
          }}
          className="bg-blue-600 hover:bg-blue-700 h-12 w-12"
          data-testid={`button-archive-${task.id}`}
        >
          <Archive className="h-5 w-5" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            setIsSwiped(false);
            setSwipeOffset(0);
          }}
          className="h-12 w-12"
          data-testid={`button-delete-${task.id}`}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Main card content */}
      <div
        {...handlers}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiped || swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
        }}
        className="bg-background"
      >
        <Card
          className="mb-2 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => {
            if (isSwiped) {
              setIsSwiped(false);
              setSwipeOffset(0);
            } else {
              onView();
            }
          }}
          data-testid={`card-task-${task.id}`}
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <Checkbox
                checked={selected}
                onCheckedChange={onSelect}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
                data-testid={`checkbox-task-${task.id}`}
              />

              {/* Task content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-sm line-clamp-2" data-testid={`text-title-${task.id}`}>
                    {task.title}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onView();
                    }}
                    className="flex-shrink-0"
                    data-testid={`button-view-${task.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>

                {task.description && (
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2" data-testid={`text-description-${task.id}`}>
                    {task.description}
                  </p>
                )}

                {/* Badges row */}
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`} data-testid={`badge-priority-${task.id}`}>
                    {task.priority}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${getStatusColor(task.status)}`} data-testid={`badge-status-${task.id}`}>
                    {task.status === 'in_progress' ? 'In Progress' : task.status}
                  </Badge>
                  {task.taskType && (
                    <Badge variant="outline" className="text-xs" data-testid={`badge-type-${task.id}`}>
                      {task.taskType.name}
                    </Badge>
                  )}
                </div>

                {/* Details row */}
                <div className="text-xs text-muted-foreground space-y-1">
                  {task.assignee && (
                    <div data-testid={`text-assignee-${task.id}`}>
                      Assigned: {task.assignee.firstName} {task.assignee.lastName}
                    </div>
                  )}
                  {task.dueDate && (
                    <div data-testid={`text-due-${task.id}`}>
                      Due: {formatDate(task.dueDate)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
