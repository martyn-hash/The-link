import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type WidgetType = "bar" | "pie" | "number" | "line";
type WidgetGroupBy = "projectType" | "status" | "assignee" | "serviceOwner" | "daysOverdue";

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newWidgetTitle: string;
  setNewWidgetTitle: (value: string) => void;
  newWidgetType: WidgetType;
  setNewWidgetType: (value: WidgetType) => void;
  newWidgetGroupBy: WidgetGroupBy;
  setNewWidgetGroupBy: (value: WidgetGroupBy) => void;
  onAddWidget: () => void;
}

export function AddWidgetDialog({
  open,
  onOpenChange,
  newWidgetTitle,
  setNewWidgetTitle,
  newWidgetType,
  setNewWidgetType,
  newWidgetGroupBy,
  setNewWidgetGroupBy,
  onAddWidget,
}: AddWidgetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-add-widget-to-dashboard">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
          <DialogDescription>
            Configure a chart or metric to visualize project data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-widget-title">Widget Title</Label>
            <Input
              id="new-widget-title"
              placeholder="e.g., Projects by Type"
              value={newWidgetTitle}
              onChange={(e) => setNewWidgetTitle(e.target.value)}
              data-testid="input-new-widget-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-widget-type">Chart Type</Label>
            <Select value={newWidgetType} onValueChange={(v: any) => setNewWidgetType(v)}>
              <SelectTrigger id="new-widget-type" data-testid="select-new-widget-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="pie">Pie Chart</SelectItem>
                <SelectItem value="line">Line Chart</SelectItem>
                <SelectItem value="number">Number Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-widget-groupby">Group By</Label>
            <Select value={newWidgetGroupBy} onValueChange={(v: any) => setNewWidgetGroupBy(v)}>
              <SelectTrigger id="new-widget-groupby" data-testid="select-new-widget-groupby">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="projectType">Project Type</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="assignee">Assignee</SelectItem>
                <SelectItem value="serviceOwner">Service Owner</SelectItem>
                <SelectItem value="daysOverdue">Days Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-new-widget">
            Cancel
          </Button>
          <Button onClick={onAddWidget} data-testid="button-confirm-add-new-widget">
            Add Widget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
